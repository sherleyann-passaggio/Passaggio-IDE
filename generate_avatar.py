#!/usr/bin/env python3
"""
generate_avatar.py
==================
Autonomous thumbnail avatar generator for the Passaggio Remotion pipeline.

Reads a video script, selects the best seed image from ./avatar_seeds/,
builds a dynamic high-fashion / relief-setting prompt, and generates
./public/avatar-context.png via Google's Nano Banana image model
(gemini-3.1-flash-image).

Usage:
    python3 generate_avatar.py --script "./Email App.py Results/Episode 4 - Lease Guard (Script).md"

The GEMINI_API_KEY is loaded automatically from:
    /Users/sherleybelleus/Library/Mobile Documents/com~apple~CloudDocs/Passaggio IDE/Blueprints/.env
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import List, Tuple

from dotenv import load_dotenv
from google import genai
from google.genai import types

# ═════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═════════════════════════════════════════════════════════════════════════════

ROOT_DIR = Path(__file__).resolve().parent
AVATAR_SEEDS_DIR = ROOT_DIR / "avatar_seeds"
PUBLIC_DIR = ROOT_DIR / "public"
OUTPUT_PATH = PUBLIC_DIR / "avatar-context.png"
ENV_PATH = ROOT_DIR / "Blueprints" / ".env"

MODEL_NAME = "gemini-3.1-flash-image"
VALID_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Keywords used to rank seed images against the script mood.
# Add more mappings as your library grows.
MOOD_KEYWORDS: dict[str, List[str]] = {
    "closeup": ["closeup", "face", "portrait", "headshot"],
    "midshot": ["mid", "torso", "waist", "standing"],
    "relief": ["smile", "happy", "relaxed", "confident", "celebration"],
    "tension": ["serious", "concern", "confused", "focused", "intense"],
    "luxury": ["suit", "blazer", "dress", "elegant", "chic"],
    "casual": ["casual", "lounge", "street", "denim", "tshirt"],
}


# ═════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═════════════════════════════════════════════════════════════════════════════


def load_api_key() -> str:
    """Load GEMINI_API_KEY from Blueprints/.env or the environment."""
    if ENV_PATH.exists():
        load_dotenv(ENV_PATH, override=True)

    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        print(f"❌ GEMINI_API_KEY not found. Expected in: {ENV_PATH}")
        sys.exit(1)
    return key


def discover_seed_images() -> List[Path]:
    """Return all valid image files in ./avatar_seeds/, sorted."""
    if not AVATAR_SEEDS_DIR.exists():
        print(f"❌ Seed library not found: {AVATAR_SEEDS_DIR}")
        print("   Create the folder and drop your reference portraits inside.")
        sys.exit(1)

    images = [
        p for p in AVATAR_SEEDS_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in VALID_IMAGE_EXTENSIONS
    ]
    images.sort(key=lambda p: p.name.lower())

    if not images:
        print(f"❌ No seed images found in: {AVATAR_SEEDS_DIR}")
        print(f"   Supported formats: {', '.join(VALID_IMAGE_EXTENSIONS)}")
        sys.exit(1)

    return images


def extract_hook_text(script_text: str) -> str:
    """Extract the first 3-5 spoken words from the script for the thumbnail."""
    # Remove markdown headers and common stage directions / cues.
    cleaned = re.sub(r"#+\s*", "", script_text)
    cleaned = re.sub(r"\[.*?\]", "", cleaned)
    cleaned = re.sub(r"\(.*?\)", "", cleaned)
    cleaned = re.sub(r"[^\w\s'’]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    words = cleaned.split()
    if not words:
        return "WATCH THIS"

    # Take first 3-5 words, but stop early at natural punctuation if possible.
    hook = " ".join(words[:5]).upper()
    return hook


def analyze_mood(script_text: str) -> str:
    """Infer a simple mood tag from the script text."""
    text_lower = script_text.lower()

    # Relief / solution language usually appears later in the script.
    relief_score = sum(1 for w in MOOD_KEYWORDS["relief"] if w in text_lower)
    tension_score = sum(1 for w in MOOD_KEYWORDS["tension"] if w in text_lower)

    if relief_score > tension_score:
        return "relief"
    if tension_score > relief_score:
        return "tension"
    return "neutral"


def score_seed_for_script(image: Path, mood: str, script_text: str) -> int:
    """Score a seed image based on filename hints and script mood."""
    name = image.stem.lower()
    score = 0

    # Prefer the canonical default anchor.
    if name == "seed-face":
        score += 50

    # Filename mood hints.
    mood_tags = MOOD_KEYWORDS.get(mood, [])
    for tag in mood_tags:
        if tag in name:
            score += 10

    # Shot-type hints.
    if "closeup" in name or "face" in name or "headshot" in name:
        score += 5
    if "mid" in name or "torso" in name:
        score += 3

    # General positive descriptors.
    positive = ["smile", "happy", "bright", "clean", "professional"]
    for word in positive:
        if word in name:
            score += 2

    return score


def select_seed_image(images: List[Path], script_text: str) -> Path:
    """Pick the best seed image for the script context."""
    mood = analyze_mood(script_text)
    print(f"🎭 Inferred script mood: {mood}")

    scored = [(score_seed_for_script(img, mood, script_text), img) for img in images]
    scored.sort(key=lambda x: x[0], reverse=True)

    best = scored[0][1]
    print(f"🖼️  Selected seed: {best.name} (score: {scored[0][0]})")
    return best


def build_avatar_prompt(script_text: str, hook_text: str) -> str:
    """Build the Nano Banana image-generation prompt."""
    return (
        "A premium lifestyle editorial photograph of a chic, stylish, and self-assured individual. "
        "The composition looks like a high-fashion magazine feature or luxury brand campaign — "
        "never a programmer desk, webcam, or generic office setting.\n\n"
        "WARDROBE: Dress the subject in an ultra-chic, fashionable outfit that fits this video's mood. "
        "Examples: a tailored modern blazer, an oversized linen button-down, a luxury cashmere knit, "
        "or elegant high-end leisurewear. Subtly integrate a minimalist graphic design, embroidery, "
        "or elegant vector icon into the clothing fabric that cleverly represents the video's core topic "
        "(e.g., clean code brackets, data nodes, automation flows, or miniature compasses).\n\n"
        "SETTING: Place the subject in an aspirational, high-status location that visually telegraphs "
        "the ultimate relief of the solution. Examples: lounging at a luxury beach resort, enjoying an "
        "upscale patio restaurant, or standing on a penthouse balcony at golden hour. Include a clean "
        "foreground prop like a smartphone or laptop display elegantly showing a 'Task Completed' or "
        "automated dashboard screen.\n\n"
        "TECHNICAL: Cinematic golden hour lighting, 85mm lens emulation, f/1.4 shallow depth of field, "
        "creamy background bokeh, sharp focus on the subject, expensive skin tones, luminous textures.\n\n"
        f"VIDEO CONTEXT (use as inspiration, not as text to render): {script_text[:600].strip()}\n"
        f"THUMBNAIL HOOK TEXT (do not render this text in the image): {hook_text}"
    )


def generate_avatar(seed_path: Path, prompt: str, api_key: str) -> bytes:
    """Call Nano Banana and return raw image bytes."""
    client = genai.Client(api_key=api_key)

    # Upload the seed image to be used as an image-to-image reference.
    print(f"⏳ Uploading seed image to Gemini...")
    uploaded = client.files.upload(file=seed_path)

    print(f"⏳ Generating avatar via {MODEL_NAME}...")
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[
            uploaded,
            prompt,
        ],
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            return part.inline_data.data

    raise RuntimeError("No image data returned by Nano Banana.")


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a contextual AI avatar thumbnail for a Remotion short."
    )
    parser.add_argument(
        "--script",
        required=True,
        help="Path to the active video script markdown file.",
    )
    parser.add_argument(
        "--output",
        default=str(OUTPUT_PATH),
        help="Output path for the generated avatar image.",
    )
    args = parser.parse_args()

    script_path = Path(args.script).expanduser().resolve()
    if not script_path.exists():
        print(f"❌ Script not found: {script_path}")
        sys.exit(1)

    script_text = script_path.read_text(encoding="utf-8")
    hook_text = extract_hook_text(script_text)
    print(f"🪝 Thumbnail hook text: {hook_text}")

    api_key = load_api_key()
    images = discover_seed_images()
    print(f"📚 Seed library: {len(images)} image(s) found")

    seed_path = select_seed_image(images, script_text)
    prompt = build_avatar_prompt(script_text, hook_text)

    image_bytes = generate_avatar(seed_path, prompt, api_key)

    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(image_bytes)

    print(f"✅ Avatar saved to: {output_path}")
    print(f"   Hook text for Remotion: {hook_text}")


if __name__ == "__main__":
    main()
