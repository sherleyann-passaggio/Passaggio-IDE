#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_timestamps.py
Sovereign Studio — Local Whisper Caption Generator
─────────────────────────────────────────────────
Generates segment-level captions JSON from audio using openai-whisper
(or whisper-mlx on Apple Silicon). Output format is compatible with
Remotion MyComposition/ActiveCaptions (seconds-based start/end).

Usage:
    python3 generate_timestamps.py \
        --audio ./audio/voiceover.mp3 \
        --out ./audio/timestamps.json \
        --model base
"""

import argparse
import json
import os
import sys
from pathlib import Path


def log(msg: str):
    print(f"[generate_timestamps] {msg}", file=sys.stderr)


def _load_whisper():
    """Attempt to load whisper; if missing give install instructions."""
    try:
        import whisper
        return whisper, "openai"
    except ImportError:
        pass

    try:
        import whisper_mlx
        return whisper_mlx, "mlx"
    except ImportError:
        pass

    log("ERROR: No local Whisper backend found.")
    log("  Option A (Apple Silicon, fastest):  pip install whisper-mlx")
    log("  Option B (any CPU/GPU):             pip install openai-whisper")
    sys.exit(1)


def _transcribe_mlx(audio_path: Path, model_name: str = "base") -> dict:
    import whisper_mlx
    log(f"Loading whisper-mlx model '{model_name}'...")
    # whisper-mlx API: whisper_mlu.load_model() then .transcribe()
    model = whisper_mlx.load_model(model_name)
    log(f"Transcribing {audio_path} ...")
    result = model.transcribe(str(audio_path))
    return result


def _transcribe_openai(audio_path: Path, model_name: str = "base") -> dict:
    import whisper
    log(f"Loading openai-whisper model '{model_name}'...")
    model = whisper.load_model(model_name)
    log(f"Transcribing {audio_path} ...")
    result = model.transcribe(str(audio_path))
    return result


def to_captions(whisper_result: dict) -> list:
    """
    Convert Whisper result segments to Remotion caption format:
    [
      { "text": "...", "start": 0.000, "end": 2.340 },
      ...
    ]
    """
    captions = []
    for seg in whisper_result.get("segments", []):
        text = seg.get("text", "").strip()
        if not text:
            continue
        captions.append(
            {
                "text": text,
                "start": round(float(seg.get("start", 0.0)), 3),
                "end": round(float(seg.get("end", 0.0)), 3),
            }
        )
    return captions


def main():
    parser = argparse.ArgumentParser(
        description="Generate captions JSON from audio via local Whisper."
    )
    parser.add_argument(
        "--audio", type=Path, required=True,
        help="Input audio file (.mp3, .wav, .m4a, etc.)"
    )
    parser.add_argument(
        "--out", type=Path, required=True,
        help="Output JSON path (captions array)"
    )
    parser.add_argument(
        "--model", default="base",
        help="Whisper model size (tiny/base/small/medium/large)"
    )
    args = parser.parse_args()

    if not args.audio.exists():
        log(f"Audio file not found: {args.audio}")
        sys.exit(1)

    backend, backend_name = _load_whisper()
    if backend_name == "mlx":
        result = _transcribe_mlx(args.audio, model_name=args.model)
    else:
        result = _transcribe_openai(args.audio, model_name=args.model)

    captions = to_captions(result)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(captions, f, indent=2, ensure_ascii=False)

    log(f"Wrote {len(captions)} caption segments to {args.out}")
    print(json.dumps({"success": True, "captions_count": len(captions), "path": str(args.out)}))


if __name__ == "__main__":
    main()
