#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
convert_hls.py
Sovereign Studio Engine — FFmpeg HLS Converter
──────────────────────────────────────────────
Converts compiled MP4 outputs into optimized, multi-variant HLS segment
arrays with master .m3u8 playlists. Uses local FFmpeg only; no HTTP
dependencies required for generation.

Supports:
 • Single or multi-bitrate ladders (360p / 720p / 1080p)
 • GOP-aligned segment boundaries for clean cuts
 • Optional AES-128 HLS encryption
 • Fast-start H.264 + AAC baseline profiles

Typical invocation:
 python convert_hls.py \
     --input storage/raw/final_output.mp4 \
     --output-dir storage/hls/ \
     --presets 1080p 720p \
     --encrypt \
     --segment-duration 6
"""

import argparse
import logging
import os
import secrets
import shutil
import subprocess
import sys
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

LOGGER = logging.getLogger("SovereignHLS")

FFMPEG_BIN: str = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE_BIN: str = shutil.which("ffprobe") or "ffprobe"

# ── Resolution ladder tuned for talking-head / screencast content ──
_LADDER: Dict[str, Dict[str, Any]] = {
 "360p": {
     "w": 640,
     "h": 360,
     "vb": "800k",
     "maxrate": "856k",
     "bufsize": "1200k",
     "ab": "96k",
 },
 "480p": {
     "w": 854,
     "h": 480,
     "vb": "1400k",
     "maxrate": "1498k",
     "bufsize": "2100k",
     "ab": "128k",
 },
 "720p": {
     "w": 1280,
     "h": 720,
     "vb": "2800k",
     "maxrate": "2996k",
     "bufsize": "4200k",
     "ab": "128k",
 },
 "1080p": {
     "w": 1920,
     "h": 1080,
     "vb": "5000k",
     "maxrate": "5350k",
     "bufsize": "7500k",
     "ab": "192k",
 },
}


# ═════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ═════════════════════════════════════════════════════════════════════
@dataclass
class VariantSpec:
 name: str
 width: int
 height: int
 video_bitrate: str
 maxrate: str
 bufsize: str
 audio_bitrate: str


# ═════════════════════════════════════════════════════════════════════
# FFPROBE HELPERS
# ═════════════════════════════════════════════════════════════════════
def _probe_duration(filepath: Path) -> float:
 """Return media duration in seconds via ffprobe."""
 cmd = [
     FFPROBE_BIN,
     "-v", "error",
     "-show_entries", "format=duration",
     "-of",
     "default=noprint_wrappers=1:nokey=1",
     str(filepath),
 ]
 try:
     result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
     if result.returncode == 0 and result.stdout.strip():
         return float(result.stdout.strip())
 except Exception as exc:
     LOGGER.warning("ffprobe duration failed: %s", exc)
 return 0.0


def _probe_dimensions(filepath: Path) -> Tuple[int, int]:
 """Return (width, height) of first video stream."""
 for dim in ("width", "height"):
     cmd = [
         FFPROBE_BIN,
         "-v", "error",
         "-select_streams", "v:0",
         "-show_entries", f"stream={dim}",
         "-of", "default=noprint_wrappers=1:nokey=1",
         str(filepath),
     ]
     try:
         result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
         if result.returncode == 0 and result.stdout.strip():
             yield int(float(result.stdout.strip()))
     except Exception:
         yield 0


# ═════════════════════════════════════════════════════════════════════
# ENCRYPTION UTILITIES
# ═════════════════════════════════════════════════════════════════════
def _generate_aes_key_file(variant_dir: Path) -> Tuple[Path, Path]:
 """
 Create a random 16-byte AES-128 key and the key_info file that
 FFmpeg consumes via -hls_key_info_file.

 Returns (key_file_path, key_info_path).
 """
 key_file = variant_dir / "key.bin"
 key_info = variant_dir / "key_info.dat"

 # 16 bytes × 8 = 128 bits
 key_bytes = secrets.token_bytes(16)
 key_file.write_bytes(key_bytes)

 # ffmpeg key_info format:
 #   Line 1: URI written into the playlist
 #   Line 2: local filesystem path to key file
 #   Line 3: optional IV (hex); omit → ffmpeg generates per-segment IVs
 key_uri = "key.bin"  # relative to variant playlist
 key_info.write_text(f"{key_uri}\n{key_file.resolve()}\n", encoding="utf-8")

 LOGGER.debug("AES-128 key material written to %s", key_file)
 return key_file, key_info


# ═════════════════════════════════════════════════════════════════════
# CONVERTER CORE
# ═════════════════════════════════════════════════════════════════════
class HLSConverter:
 def __init__(
     self,
     input_path: Path,
     output_dir: Path,
     segment_duration: int = 6,
     encrypt: bool = False,
     base_url: Optional[str] = None,
 ):
     self.input_path = input_path.resolve()
     self.output_dir = output_dir.resolve()
     self.segment_duration = segment_duration
     self.encrypt = encrypt
     self.base_url = base_url.rstrip("/") if base_url else None

     if not self.input_path.exists():
         raise FileNotFoundError(f"Input not found: {self.input_path}")

     self.output_dir.mkdir(parents=True, exist_ok=True)

     # Dynamic GOP = fps ≈ 30 × segment_duration ensures clean boundaries
     # We'll compute GOP once from probe or assume 30 fps fallback
     self.gop_size = segment_duration * 30
     self.duration = _probe_duration(self.input_path)
     src_w, src_h = _probe_dimensions(self.input_path)
     self.source_dims = (src_w or 1920, src_h or 1080)
     LOGGER.info(
         "Source: %s | %dx%d | %.2fs",
         self.input_path,
         src_w,
         src_h,
         self.duration,
     )

 # ── Variant generation ─────────────────────────────────────────
 def _transcode_variant(self, spec: VariantSpec) -> Path:
     """Run FFmpeg to create one HLS variant playlist + segments."""
     variant_dir = self.output_dir / spec.name
     variant_dir.mkdir(parents=True, exist_ok=True)

     playlist = variant_dir / "playlist.m3u8"
     segment_pattern = variant_dir / "segment_%04d.ts"

     vf_parts = [
         f"scale={spec.width}:{spec.height}:force_original_aspect_ratio=decrease",
         "format=yuv420p",
     ]

     # If source is smaller than target, pad instead of upscale (optional)
     if self.source_dims[0] < spec.width or self.source_dims[1] < spec.height:
         LOGGER.warning(
             "Source smaller than %s target; FFmpeg will upscale. Consider using a lower ladder.",
             spec.name,
         )

     cmd: List[str] = [
         FFMPEG_BIN,
         "-y",
         "-i", str(self.input_path),
         "-vf", ",".join(vf_parts),
         "-c:v", "libx264",
         "-preset", "fast",
         "-profile:v", "high",
         "-level", "4.2",
         "-crf", "23",
         "-g", str(self.gop_size),
         "-keyint_min", str(self.gop_size),
         "-sc_threshold", "0",
         "-b:v", spec.video_bitrate,
         "-maxrate", spec.maxrate,
         "-bufsize", spec.bufsize,
         "-c:a", "aac",
         "-b:a", spec.audio_bitrate,
         "-ac", "2",
         "-ar", "48000",
         "-f", "hls",
         "-hls_time", str(self.segment_duration),
         "-hls_list_size", "0",
         "-hls_segment_filename", str(segment_pattern),
         "-hls_flags", "independent_segments+omit_endlist",
         "-hls_playlist_type", "vod",
         "-master_pl_name", "master_temp.m3u8",  # overwritten later by unified master
     ]

     if self.encrypt:
         _, key_info = _generate_aes_key_file(variant_dir)
         cmd += ["-hls_key_info_file", str(key_info)]

     cmd.append(str(playlist))

     LOGGER.info(
         "Transcoding %s variant → %s (%s vb / %s ab)",
         spec.name,
         variant_dir,
         spec.video_bitrate,
         spec.audio_bitrate,
     )
     LOGGER.debug("FFmpeg command: %s", " ".join(cmd))

     result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
     if result.returncode != 0:
         LOGGER.error("FFmpeg stderr:\n%s", result.stderr)
         raise RuntimeError(
             f"FFmpeg failed for variant {spec.name} (rc={result.returncode})"
         )

     LOGGER.info("Variant '%s' ready: %s", spec.name, playlist)
     return playlist

 # ── Master playlist assembly ─────────────────────────────────────
 def _write_master_playlist(self, variants: List[VariantSpec]) -> Path:
     """
     Assemble unified master.m3u8 referencing each variant playlist.
     """
     master = self.output_dir / "master.m3u8"
     lines: List[str] = ["#EXTM3U", "#EXT-X-VERSION:4"]

     for spec in variants:
         playlist_path = self.output_dir / spec.name / "playlist.m3u8"
         if not playlist_path.exists():
             LOGGER.warning("Missing variant playlist for %s — skipping", spec.name)
             continue

         bandwidth_str = spec.video_bitrate.upper().replace("K", "000").replace("M", "000000")
         bandwidth = "".join(c for c in bandwidth_str if c.isdigit())
         # Use video bitrate as bandwidth proxy; add audio for safety
         bandwidth = str(int(bandwidth) + int(spec.audio_bitrate.upper().replace("K", "000")))

         uri = f"{spec.name}/playlist.m3u8"
         if self.base_url:
             uri = f"{self.base_url}/{uri}"

         lines.append(
             f"#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},"
             f"RESOLUTION={spec.width}x{spec.height},"
             f"CODECS=\"avc1.640028,mp4a.40.2\""
         )
         lines.append(uri)

     if len(lines) <= 2:
         raise RuntimeError("No valid variant playlists found; aborting master write.")

     master.write_text("\n".join(lines) + "\n", encoding="utf-8")
     LOGGER.info("Master playlist written: %s", master)
     return master

 # ── Public entry ─────────────────────────────────────────────────
 def run(self, presets: List[str]) -> Dict[str, Any]:
     """
     Execute full pipeline: transcode requested variants, write master.
     """
     active_specs: List[VariantSpec] = []
     for p in presets:
         if p not in _LADDER:
             raise ValueError(f"Unknown preset '{p}'. Valid: {list(_LADDER.keys())}")
         cfg = _LADDER[p]
         active_specs.append(
             VariantSpec(
                 name=p,
                 width=cfg["w"],
                 height=cfg["h"],
                 video_bitrate=cfg["vb"],
                 maxrate=cfg["maxrate"],
                 bufsize=cfg["bufsize"],
                 audio_bitrate=cfg["ab"],
             )
         )

     written_playlists: List[Path] = []
     for spec in active_specs:
         pl = self._transcode_variant(spec)
         written_playlists.append(pl)

     master = self._write_master_playlist(active_specs)

     # Summarize segment counts
     segment_summary: Dict[str, Any] = {}
     for spec in active_specs:
         vdir = self.output_dir / spec.name
         segments = sorted(vdir.glob("segment_*.ts"))
         segment_summary[spec.name] = {
             "playlist": str(vdir / "playlist.m3u8"),
             "segments": [s.name for s in segments],
             "segment_count": len(segments),
         }

     return {
         "success": True,
         "master_playlist": str(master),
         "variants": segment_summary,
         "encryption": self.encrypt,
         "source": str(self.input_path),
         "output_dir": str(self.output_dir),
     }


# ═════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════
def main(argv: Optional[List[str]] = None) -> int:
 parser = argparse.ArgumentParser(
     description="Convert compiled MP4 into optimized HLS segments with FFmpeg.",
     formatter_class=argparse.RawDescriptionHelpFormatter,
     epilog=textwrap.dedent("""
         Examples:
           %(prog)s -i final.mp4 -o storage/hls --presets 720p 360p
           %(prog)s -i final.mp4 -o storage/hls --encrypt --segment-duration 4
     """),
 )
 parser.add_argument(
     "-i", "--input",
     type=Path,
     required=True,
     help="Source MP4 file produced by Remotion / MoviePy.",
 )
 parser.add_argument(
     "-o", "--output-dir",
     type=Path,
     required=True,
     help="HLS output root directory (master.m3u8 will live here).",
 )
 parser.add_argument(
     "--presets",
     nargs="+",
     default=["1080p"],
     choices=list(_LADDER.keys()),
     help="Bitrate ladder variants to generate.",
 )
 parser.add_argument(
     "--segment-duration",
     type=int,
     default=6,
     help="Seconds per TS segment.",
 )
 parser.add_argument(
     "--encrypt",
     action="store_true",
     help="Enable AES-128 segment encryption.",
 )
 parser.add_argument(
     "--base-url",
     default=None,
     help="CDN / Base URL prefixed to variant playlist URIs in master.m3u8.",
 )
 parser.add_argument(
     "--output-json",
     type=Path,
     default=None,
     help="Write structured result to JSON file.",
 )

 args = parser.parse_args(argv)

 logging.basicConfig(
     level=logging.INFO,
     format="%(asctime)s %(name)s %(levelname)s %(message)s",
     stream=sys.stderr,
 )

 try:
     converter = HLSConverter(
         input_path=args.input,
         output_dir=args.output_dir,
         segment_duration=args.segment_duration,
         encrypt=args.encrypt,
         base_url=args.base_url,
     )
     result = converter.run(args.presets)
 except Exception as exc:
     LOGGER.exception("Pipeline failed")
     result = {
         "success": False,
         "error": str(exc),
         "source": str(args.input),
         "output_dir": str(args.output_dir),
     }

 payload = json.dumps(result, indent=2, ensure_ascii=False)
 if args.output_json:
     args.output_json.write_text(payload, encoding="utf-8")
     print(args.output_json)
 else:
     print(payload)

 return 0 if result.get("success") else 1


if __name__ == "__main__":
 sys.exit(main())
