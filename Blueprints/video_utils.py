#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
video_utils.py
Sovereign Studio Engine — MoviePy Compositing & FFmpeg Packaging
───────────────────────────────────────────────────────────────
Handles:
• Video slicing (subclips via MoviePy)
• Resizing / aspect-ratio preservation & letterboxing
• Layering (PiP overlays, alpha compositing, watermark/caption burns)
• Volume attenuation & audio fade envelopes
• ffprobe metadata extraction
• FFmpeg HLS segmentation with optional watermark drawtext
• B-roll stock fetch placeholder

Consumed by:
• backend/app.py (Streamlit control center)
• backend/gemma_engine.py (for multi-modal preview pipelines)
"""

import json
import logging
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

# ── Soft import: MoviePy ─────────────────────────────────────────────
try:
  from moviepy.editor import (
      ColorClip,
      CompositeVideoClip,
      ImageClip,
      TextClip,
      VideoFileClip,
  )
  import moviepy.audio.fx.all as afx
  import moviepy.video.fx.all as vfx

  _HAS_MOVIEPY = True
except Exception as _mp_exc:
  _HAS_MOVIEPY = False
  VideoFileClip = CompositeVideoClip = TextClip = ImageClip = ColorClip = None  # type: ignore
  vfx = None  # type: ignore
  afx = None  # type: ignore

LOGGER = logging.getLogger(__name__)

FFMPEG_PATH: str = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE_PATH: str = shutil.which("ffprobe") or "ffprobe"

DEFAULT_HLS_SEGMENT: int = 6


# ═════════════════════════════════════════════════════════════════════
# EXCEPTIONS
# ═════════════════════════════════════════════════════════════════════
class VideoEditError(Exception):
  """Base error for all video_utils failures."""
  pass


def _require_moviepy() -> None:
  if not _HAS_MOVIEPY:
      raise VideoEditError(
          "MoviePy is required but not installed. "
          "Run:  pip install moviepy==1.0.3  (or your environment's pinned version)"
      )


# ═════════════════════════════════════════════════════════════════════
# FFPROBE METADATA EXTRACTOR
# ═════════════════════════════════════════════════════════════════════
def _parse_fraction(val: Optional[str]) -> float:
  """Safely turn '30000/1001' or '30/1' into a float."""
  if not val:
      return 0.0
  try:
      if "/" in val:
          num, den = val.split("/", 1)
          return float(num) / float(den) if float(den) else 0.0
      return float(val)
  except ValueError:
      return 0.0


def probe_media(filepath: Union[str, Path]) -> Dict[str, Any]:
  """
  Return ffprobe JSON stream metadata.

  Returns dict with:
      duration, width, height, fps, bit_rate,
      video_codec, audio_codec, audio_channels, format_name
  """
  fp = Path(filepath)
  if not fp.exists():
      raise FileNotFoundError(f"Probe target not found: {fp}")

  cmd = [
      FFPROBE_PATH,
      "-v", "error",
      "-show_format",
      "-show_streams",
      "-print_format", "json",
      str(fp),
  ]

  try:
      result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
      if result.returncode != 0:
          raise RuntimeError(result.stderr.strip())
      payload = json.loads(result.stdout)
  except Exception as exc:
      LOGGER.error("ffprobe failed for %s: %s", fp, exc)
      return {"error": str(exc), "file": str(fp)}

  video_stream = next(
      (s for s in payload.get("streams", []) if s.get("codec_type") == "video"),
      {},
  )
  audio_stream = next(
      (s for s in payload.get("streams", []) if s.get("codec_type") == "audio"),
      {},
  )
  fmt = payload.get("format", {})

  return {
      "file": str(fp),
      "format_name": fmt.get("format_name"),
      "duration": float(video_stream.get("duration", fmt.get("duration", 0))),
      "width": video_stream.get("width"),
      "height": video_stream.get("height"),
      "fps": _parse_fraction(video_stream.get("r_frame_rate")),
      "bit_rate": int(fmt.get("bit_rate", 0)),
      "video_codec": video_stream.get("codec_name"),
      "audio_codec": audio_stream.get("codec_name"),
      "audio_channels": audio_stream.get("channels"),
  }


# ═════════════════════════════════════════════════════════════════════
# MOVIEPY WRAPPERS: Slicing, Resizing, Layering, Volume
# ═════════════════════════════════════════════════════════════════════
def load_clip(filepath: Union[str, Path], **kwargs: Any) -> Any:
  """Load a VideoFileClip."""
  _require_moviepy()
  return VideoFileClip(str(filepath), **kwargs)


def slice_video(
  filepath: Union[str, Path],
  start: float,
  end: float,
  output: Optional[Union[str, Path]] = None,
  codec: str = "libx264",
  preset: str = "fast",
  audio_codec: str = "aac",
  verbose: bool = False,
) -> Union[str, Any]:
  """
  Extract a subclip from *start* to *end* (seconds) using MoviePy.

  If *output* is provided, write the file and return the absolute path.
  Otherwise return the in-memory VideoFileClip (caller must close).
  """
  _require_moviepy()
  clip = VideoFileClip(str(filepath)).subclip(start, end)

  if output is None:
      return clip

  out = Path(output)
  out.parent.mkdir(parents=True, exist_ok=True)
  clip.write_videofile(
      str(out),
      codec=codec,
      audio_codec=audio_codec,
      preset=preset,
      verbose=verbose,
      logger="bar" if verbose else None,
      threads=4,
  )
  clip.close()
  return str(out.resolve())


def resize_video(
  clip: Any,
  width: Optional[int] = None,
  height: Optional[int] = None,
  target_resolution: Optional[Tuple[int, int]] = None,
  method: str = "fit",
  bg_color: Tuple[int, int, int] = (0, 0, 0),
) -> Any:
  """
  Resize a MoviePy clip to target dimensions.

  Methods
  -------
  fit   : Preserve aspect ratio, letterbox with bg_color on underscan.
  fill  : Preserve aspect ratio, center-crop any overscan.
  stretch: Distort to exact target dimensions.
  """
  _require_moviepy()

  if target_resolution:
      width, height = target_resolution
  if not width and not height:
      raise ValueError("Supply width/height or target_resolution.")

  w, h = clip.size

  if method == "stretch":
      return clip.resize(newsize=(width, height))

  if method == "fit":
      scale = min(width / w, height / h) if (width and height) else (width / w if width else height / h)
      new_w, new_h = int(w * scale), int(h * scale)
      resized = clip.resize(newsize=(new_w, new_h))
      if new_w == width and new_h == height:
          return resized
      bg = ColorClip(size=(width, height), color=bg_color).set_duration(resized.duration)
      x = (width - new_w) // 2
      y = (height - new_h) // 2
      return CompositeVideoClip([bg, resized.set_position((x, y))])

  if method == "fill":
      scale = max(width / w, height / h) if (width and height) else (width / w if width else height / h)
      new_w, new_h = int(w * scale), int(h * scale)
      resized = clip.resize(newsize=(new_w, new_h))
      x = (new_w - width) // 2 if new_w > width else 0
      y = (new_h - height) // 2 if new_h > height else 0
      return resized.crop(x1=x, y1=y, x2=x + width, y2=y + height)

  raise ValueError(f"Unknown resize method: {method}")


def adjust_volume(
  clip: Any,
  factor: float = 1.0,
  fade_in: float = 0.0,
  fade_out: float = 0.0,
) -> Any:
  """
  Attenuate or boost audio volume by *factor*.

  Parameters
  ----------
  factor : float
      1.0 = unchanged, <1.0 attenuates, >1.0 boosts (MoviePy clamps).
  fade_in, fade_out : float
      Seconds of fade-in / fade-out envelope.
  """
  _require_moviepy()
  if getattr(clip, "audio", None) is None:
      return clip

  audio = clip.audio

  if factor != 1.0:
      audio = audio.fx(afx.volumex, factor)

  if fade_in > 0:
      audio = audio.fx(afx.audio_fadein, fade_in)

  if fade_out > 0 and clip.duration:
      audio = audio.fx(afx.audio_fadeout, fade_out)

  return clip.set_audio(audio)


def composite_layers(
  base_clip: Any,
  overlays: List[Dict[str, Any]],
  bg_color: Tuple[int, int, int] = (0, 0, 0),
) -> Any:
  """
  Layer multiple clips atop a base clip.

  Each overlay dict supports:
    {
      "clip": VideoFileClip,
      "position": (x, y) | "center" | "top-right" …,
      "start": float,
      "end": float,
      "opacity": float (0.0–1.0),
    }
  """
  _require_moviepy()

  duration = base_clip.duration
  w, h = base_clip.size
  bg = ColorClip(size=(w, h), color=bg_color).set_duration(duration)
  layers: List[Any] = [bg, base_clip]

  for ov in overlays:
      oclip = ov["clip"]
      start = ov.get("start", 0.0)
      end = min(ov.get("end", duration), duration)
      pos = ov.get("position", "center")
      opacity = ov.get("opacity", 1.0)

      sub = (
          oclip.subclip(0, min(end - start, oclip.duration))
          .set_start(start)
          .set_position(pos)
      )
      if opacity < 1.0:
          sub = sub.set_opacity(opacity)
      layers.append(sub)

  return CompositeVideoClip(layers).set_duration(duration)


def burn_caption(
  clip: Any,
  text: str,
  start: float,
  end: float,
  position: Union[str, Tuple[int, int]] = ("center", "bottom"),
  fontsize: int = 48,
  color: str = "white",
  stroke_color: str = "black",
  stroke_width: int = 2,
  font: str = "Arial-Bold",
) -> Any:
  """
  Burn a single text caption onto the video using MoviePy TextClip.
  """
  _require_moviepy()
  duration = end - start
  txt = (
      TextClip(
          text,
          fontsize=fontsize,
          color=color,
          stroke_color=stroke_color,
          stroke_width=stroke_width,
          font=font,
          method="caption",
          size=(int(clip.w * 0.9), None),
      )
      .set_duration(duration)
      .set_start(start)
      .set_position(position)
  )
  return CompositeVideoClip([clip, txt])


def burn_image_overlay(
  clip: Any,
  image_path: Union[str, Path],
  start: float,
  end: float,
  position: Union[str, Tuple[int, int]] = ("right", "top"),
  width: Optional[int] = None,
  opacity: float = 1.0,
) -> Any:
  """Burn a static image (watermark, logo) over the video."""
  _require_moviepy()
  img = (
      ImageClip(str(image_path))
      .set_start(start)
      .set_duration(end - start)
      .set_position(position)
  )
  if width:
      img = img.resize(width=width)
  if opacity < 1.0:
      img = img.set_opacity(opacity)
  return CompositeVideoClip([clip, img])


# ═════════════════════════════════════════════════════════════════════
# FFMPEG HLS PACKAGING
# ═════════════════════════════════════════════════════════════════════
def slice_hls(
  input_path: Union[str, Path],
  out_dir: Union[str, Path],
  segment_time: int = DEFAULT_HLS_SEGMENT,
  playlist_name: str = "master.m3u8",
  video_codec: str = "libx264",
  audio_codec: str = "aac",
  preset: str = "fast",
  watermark: bool = False,
  watermark_text: str = "Sovereign Studio",
) -> Path:
  """
  Slice an MP4 into HTTP Live Streaming segments using FFmpeg.

  Produces:
      <out_dir>/<playlist_name>
      <out_dir>/segment_001.ts … segment_NNN.ts

  If *watermark* is True, burns a lightweight text overlay via FFmpeg drawtext
  (requires libfreetype support in the ffmpeg build).
  """
  inp = Path(input_path).resolve()
  out = Path(out_dir).resolve()
  out.mkdir(parents=True, exist_ok=True)

  playlist = out / playlist_name

  vf_parts: List[str] = ["format=yuv420p"]
  if watermark:
      escaped_text = watermark_text.replace("'", r"\'")
      vf_parts.append(
          f"drawtext=text='{escaped_text}':fontcolor=white@0.35:fontsize=22:"
          "x=(w-text_w-16):y=(h-text_h-16):box=0"
      )

  vf_str = ",".join(vf_parts)
  segment_pattern = out / "segment_%03d.ts"

  cmd: List[str] = [
      FFMPEG_PATH, "-y",
      "-i", str(inp),
      "-c:v", video_codec,
      "-preset", preset,
      "-c:a", audio_codec,
      "-pix_fmt", "yuv420p",
      "-vf", vf_str,
      "-f", "hls",
      "-hls_time", str(segment_time),
      "-hls_list_size", "0",
      "-hls_segment_filename", str(segment_pattern),
      "-hls_flags", "independent_segments",
      str(playlist),
  ]

  LOGGER.info("Executing FFmpeg HLS segmentation:\n%s", " ".join(cmd))
  result = subprocess.run(cmd, capture_output=True, text=True, timeout=900)

  if result.returncode != 0:
      LOGGER.error("FFmpeg stderr:\n%s", result.stderr)
      raise RuntimeError(
          f"FFmpeg HLS segmentation failed (rc={result.returncode}): "
          f"{result.stderr[:2000]}"
      )

  LOGGER.info("Master playlist ready: %s", playlist)
  return playlist.resolve()


# ═════════════════════════════════════════════════════════════════════
# B-ROLL STOCK FETCH (STUB / LOCAL-FIRST)
# ═════════════════════════════════════════════════════════════════════
def fetch_stock_broll(
  query: str,
  dest_dir: Union[str, Path],
  max_results: int = 5,
  api_key: Optional[str] = None,
) -> List[Path]:
  """
  Placeholder / stub for fetching stock B-roll from external APIs.

  In production, wire this to Pexels, Pixabay, or Storyblocks endpoints
  using *api_key*. For local-first operation, scans *dest_dir* for
  pre-cached clips whose filenames match *query*.

  Returns
  -------
  List of Path objects (up to *max_results*).
  """
  dest = Path(dest_dir)
  dest.mkdir(parents=True, exist_ok=True)

  # Local keyword-match fallback
  qlower = query.lower()
  hits: List[Path] = []
  for ext in ("*.mp4", "*.mov", "*.webm", "*.mkv", "*.avi"):
      hits.extend(dest.glob(ext))

  filtered = [p for p in hits if qlower in p.stem.lower()]
  LOGGER.info(
      "fetch_stock_broll(query=%r, dest=%s) yielded %d local matches",
      query, dest, len(filtered),
  )
  return filtered[:max_results]


# ═════════════════════════════════════════════════════════════════════
# CONVENIENCE: END-TO-END COMPOSITE RENDERER
# ═════════════════════════════════════════════════════════════════════
def render_composition(
  base_video: Union[str, Path],
  output_path: Union[str, Path],
  overlays: Optional[List[Dict[str, Any]]] = None,
  captions: Optional[List[Dict[str, Any]]] = None,
  target_resolution: Tuple[int, int] = (1920, 1080),
  volume_factor: float = 1.0,
  volume_fade_in: float = 0.0,
  volume_fade_out: float = 0.0,
  watermark_path: Optional[Union[str, Path]] = None,
  fps: int = 30,
  codec: str = "libx264",
  preset: str = "fast",
) -> Path:
  """
  End-to-end MoviePy pipeline tying together:
    slicing hints, resizing, volume attenuation, overlays, captions,
    and static image watermarking.

  Returns absolute path to the finalized MP4.
  """
  _require_moviepy()

  clip = load_clip(base_video)

  # Resize / fit letterbox
  clip = resize_video(clip, target_resolution=target_resolution, method="fit")
  clip = clip.set_fps(fps)

  # Audio adjustments
  clip = adjust_volume(
      clip,
      factor=volume_factor,
      fade_in=volume_fade_in,
      fade_out=volume_fade_out,
  )

  # Layered b-roll / PiP
  if overlays:
      clip = composite_layers(clip, overlays)

  # Caption burn-in
  if captions:
      for cap in captions:
          clip = burn_caption(
              clip,
              text=cap.get("text", ""),
              start=cap.get("start", 0.0),
              end=cap.get("end", clip.duration),
              fontsize=cap.get("fontsize", 48),
              color=cap.get("color", "white"),
              position=cap.get("position", ("center", "bottom")),
          )

  # Image watermark overlay
  if watermark_path:
      clip = burn_image_overlay(
          clip,
          watermark_path,
          start=0.0,
          end=clip.duration,
          position=("right", "top"),
          width=int(clip.w * 0.12),
          opacity=0.6,
      )

  out = Path(output_path)
  out.parent.mkdir(parents=True, exist_ok=True)
  clip.write_videofile(
      str(out),
      fps=fps,
      codec=codec,
      audio_codec="aac",
      preset=preset,
      threads=4,
      logger=None,
  )
  clip.close()
  return out.resolve()
