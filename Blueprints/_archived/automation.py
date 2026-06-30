#!/usr/bin/env python3
"""
automation.py
Sovereign Prototype Recorder — Playwright Interaction Engine
─────────────────────────────────────────────────────────────
Records smooth demo footage of any web prototype by executing a
JSON interaction script. Falls back to the legacy Spline demo if
no script is provided.

Usage
-----
  # Custom interaction script
  python3 automation.py \
      --url http://localhost:3000/demo \
      --script interactions.json \
      --out ./storage/raw/demo.mp4

  # Legacy Spline fallback (hardcoded behaviour)
  python3 automation.py \
      --url http://localhost:3000 \
      --out ./storage/raw/spline_demo.mp4

Interaction JSON schema
-----------------------
[
  {"action": "goto",   "url": "http://localhost:3000/demo"},
  {"action": "hover",  "selector": "#hero-card", "wait": 1},
  {"action": "click",  "selector": "#submit-btn", "wait": 2},
  {"action": "type",   "selector": "#email", "text": "hello@example.com", "wait": 0.5},
  {"action": "scroll", "selector": "#results", "deltaY": 500, "wait": 1},
  {"action": "wait",   "duration": 3}
]
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

from playwright.async_api import async_playwright


# ── Constants ───────────────────────────────────────────────────────
DEFAULT_VIEWPORT = {"width": 1280, "height": 720}
DEFAULT_VIDEO_DIR = Path("./storage/raw")


# ── Interaction handlers ──────────────────────────────────────────
async def _act(page, step: Dict[str, Any]) -> None:
    """Dispatch a single interaction step on the given Playwright page."""
    action = step.get("action", "").lower()
    selector = step.get("selector")
    wait = step.get("wait", 0.5)

    if action == "goto":
        url = step.get("url")
        print(f"🌐  goto → {url}")
        await page.goto(url)

    elif action == "hover":
        print(f"🖱️  hover → {selector}")
        await page.hover(selector)

    elif action == "click":
        print(f"🖱️  click → {selector}")
        await page.click(selector)

    elif action == "type":
        text = step.get("text", "")
        print(f"⌨️  type  → {selector} ({len(text)} chars)")
        await page.fill(selector, text)

    elif action == "scroll":
        delta_y = step.get("deltaY", 500)
        print(f"📜 scroll → {selector} by {delta_y}px")
        await page.evaluate(
            f"document.querySelector('{selector}').scrollBy(0, {delta_y})"
        )

    elif action == "wait":
        duration = step.get("duration", 1)
        print(f"⏳ wait  → {duration}s")
        await asyncio.sleep(duration)
        return  # skip generic tail-sleep

    else:
        print(f"⚠️  Unknown action '{action}' — skipping.")

    if wait:
        await asyncio.sleep(wait)


async def _default_spline_interactions(page) -> None:
    """Legacy hard-coded Spline demo interactions."""
    print("🖱️  Simulating smooth mouse move and click on Spline element...")
    await page.hover("#spline-canvas")
    await asyncio.sleep(1)
    await page.click("#rotate-button")
    await asyncio.sleep(3)


async def _load_script(script_path: Path) -> List[Dict[str, Any]]:
    """Load and validate an interaction JSON script."""
    if not script_path.exists():
        print(f"❌ Interaction script not found: {script_path}", file=sys.stderr)
        sys.exit(1)
    data = json.loads(script_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print("❌ Interaction script must be a JSON array of step objects.", file=sys.stderr)
        sys.exit(1)
    return data


# ── Core recorder ───────────────────────────────────────────────────
async def record_demo(
    prototype_url: str,
    output_video_path: Path,
    interaction_script: List[Dict[str, Any]] | None = None,
    headless: bool = True,
) -> Path:
    """
    Launch Playwright, optionally run interactions, save recording.
    Returns the resolved path to the generated video.
    """
    output_video_path = output_video_path.resolve()
    output_video_path.parent.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        # Browser launch (non-recording context — we'll make a recording one below)
        browser = await p.chromium.launch(headless=headless)
        page = await browser.new_page(viewport=DEFAULT_VIEWPORT)

        print(f"🌐 Loading prototype: {prototype_url}")
        await page.goto(prototype_url)

        # Dedicated recording context
        context = await browser.new_context(
            record_video_dir=str(output_video_path.parent),
            viewport=DEFAULT_VIEWPORT,
        )
        record_page = await context.new_page()
        await record_page.goto(prototype_url)

        # Run interactions
        if interaction_script:
            for idx, step in enumerate(interaction_script, start=1):
                print(f"▶ Step {idx}/{len(interaction_script)}")
                await _act(record_page, step)
        else:
            await _default_spline_interactions(record_page)

        # Tear-down
        await context.close()
        await browser.close()

    # Playwright names the file automatically; rename to user's desired name
    # Find the most recently created webm in the directory
    candidates = sorted(
        output_video_path.parent.glob("*.webm"),
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )
    if candidates:
        latest = candidates[0]
        final_path = output_video_path.with_suffix(".webm")
        latest.rename(final_path)
        print(f"✅ Explainer footage recorded: {final_path}")
        return final_path
    else:
        print("⚠️  No video file detected — Playwright may have failed to record.")
        return output_video_path


# ── CLI ─────────────────────────────────────────────────────────────
def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Sovereign Prototype Recorder")
    p.add_argument("--url", required=True, help="Prototype URL to record")
    p.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_VIDEO_DIR / "demo_capture.webm",
        help="Output video path (default: ./storage/raw/demo_capture.webm)",
    )
    p.add_argument(
        "--script",
        type=Path,
        default=None,
        help="Path to JSON interaction script (optional; uses Spline fallback if omitted)",
    )
    p.add_argument("--headless", action="store_true", default=True, help="Run headless")
    p.add_argument("--no-headless", dest="headless", action="store_false", help="Show browser window")
    return p


def main():
    args = _build_parser().parse_args()
    script = None
    if args.script:
        script = _load_script(args.script)
    asyncio.run(
        record_demo(
            prototype_url=args.url,
            output_video_path=args.out,
            interaction_script=script,
            headless=args.headless,
        )
    )


if __name__ == "__main__":
    main()
