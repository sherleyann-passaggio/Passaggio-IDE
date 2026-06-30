#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
render.py
Content Creation Protocol v3.0 — Lean Remotion Renderer
─────────────────────────────────────────────────────────
Single-entry production loop. Given a script:

    1. Infers lucide-react icon names via a quick LLM call.
    2. Generates voiceover audio (ElevenLabs) + optional music/SFX via ElevenLabs sound-generation.
    3. Builds word-level timestamps (ElevenLabs preferred; falls back to local Whisper).
    4. Writes remotion/props.json with iconNames + audioCueTimeline.
    5. Executes npx remotion render.
    6. Runs the Viral Video Predictor (Gemini-1.5-Pro) on the rendered .mp4.

Usage
-----
    python3 Blueprints/render.py \
        --script "Still tracking background checks manually? One click, verified safe." \
        --out ./remotion/out/ep15.mp4 \
        --episode "Ep.15 | Background Checks" \
    --music-prompt "Upbeat minimal tech-pop bed, 120 BPM, 15 seconds, no vocals"

Environment
-----------
Reads ELEVENLABS_API_KEY, GEMINI_API_KEY, and ACTIVE_LLM_PROVIDER from Blueprints/.env.
"""

import argparse
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

# ── Ensure sibling scripts are importable ───────────────────────────────
_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None  # type: ignore

try:
    from gateway import UnifiedModelGateway, GatewayConfig
except ImportError as _exc:  # noqa: F841
    UnifiedModelGateway = None  # type: ignore
    GatewayConfig = None  # type: ignore

LOGGER = logging.getLogger("CCPv3Renderer")

REPO_ROOT = _SCRIPT_DIR.parent
REMOTION_ROOT = REPO_ROOT / "remotion"
AUDIO_DIR = REMOTION_ROOT / "audio"
PROPS_PATH = REMOTION_ROOT / "props.json"
ENV_PATH = _SCRIPT_DIR / ".env"

DEFAULT_COMPOSITION = "PremiumShortComposition"
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # ElevenLabs default "Rachel"
DEFAULT_MODEL = "eleven_multilingual_v2"
DEFAULT_MUSIC_DURATION_SECONDS = 15


# ═════════════════════════════════════════════════════════════════════════════
# DATA SHAPES
# ═════════════════════════════════════════════════════════════════════════════
@dataclass
class AudioCue:
    time_ms: int
    cue_type: str  # voice | music | sfx
    icon_name: Optional[str] = None
    note: Optional[str] = None


@dataclass
class RenderProps:
    voiceover_url: str
    timestamps: List[Dict[str, Any]]
    icon_names: List[str]
    audio_cue_timeline: List[Dict[str, Any]]
    hook_text: str
    cta_keyword: str
    episode: str = ""


# ═════════════════════════════════════════════════════════════════════════════
# ENVIRONMENT
# ═════════════════════════════════════════════════════════════════════════════
def _load_env() -> None:
    """Load Blueprints/.env if python-dotenv is available."""
    if load_dotenv is not None and ENV_PATH.exists():
        load_dotenv(ENV_PATH, override=False)
        LOGGER.info("Loaded environment from %s", ENV_PATH)


# ═════════════════════════════════════════════════════════════════════════════
# LLM HELPERS
# ═════════════════════════════════════════════════════════════════════════════
def _llm_complete(prompt: str, system: Optional[str] = None, temperature: float = 0.3) -> str:
    """Quick LLM call via UnifiedModelGateway."""
    if UnifiedModelGateway is None:
        raise RuntimeError("gateway.py unavailable; cannot infer icons.")
    gateway = UnifiedModelGateway(GatewayConfig.from_env())
    provider = os.getenv("ACTIVE_LLM_PROVIDER", "ai_studio")
    return gateway.complete(
        prompt,
        provider=provider,
        system=system,
        temperature=temperature,
        max_tokens=512,
    )


def _extract_json_block(text: str) -> Optional[Any]:
    """Extract the first JSON object/array from a markdown fenced block or raw text."""
    # Try fenced json block
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        candidate = fence.group(1).strip()
    else:
        candidate = text.strip()
    # Find the outermost JSON object/array
    start = next((i for i, ch in enumerate(candidate) if ch in "{["), None)
    if start is None:
        return None
    # Simple brace matching
    stack = []
    end = None
    for i, ch in enumerate(candidate[start:], start=start):
        if ch in "{[":
            stack.append(ch)
        elif ch == "}" and stack and stack[-1] == "{":
            stack.pop()
        elif ch == "]" and stack and stack[-1] == "[":
            stack.pop()
        if not stack:
            end = i + 1
            break
    if end is None:
        return None
    return json.loads(candidate[start:end])


def infer_icons(script_text: str, max_icons: int = 5) -> List[str]:
    """
    Ask the LLM to pick lucide-react icon names that match the script.
    Returns a list like ['Shield', 'CheckCircle', 'MousePointerClick'].
    """
    system = (
        "You are a motion-design assistant. Given a short marketing script, "
        "return ONLY a JSON object with a single key 'icons' containing 3-5 "
        "valid lucide-react icon export names (PascalCase) that visually "
        "represent the script's key concepts. Prefer concrete nouns/verbs."
    )
    prompt = (
        f"Script:\n{script_text}\n\n"
        "Choose icons from lucide-react. Example response:\n"
        '{"icons": ["Shield", "CheckCircle", "MousePointerClick"]}'
    )
    raw = _llm_complete(prompt, system=system, temperature=0.4)
    try:
        data = _extract_json_block(raw)
        icons = data.get("icons", []) if isinstance(data, dict) else []
        if not isinstance(icons, list):
            icons = []
    except Exception as exc:
        LOGGER.warning("Icon inference failed (%s); using fallback.", exc)
        icons = []

    # Deduplicate, cap, fallback
    seen = []
    for icon in icons:
        name = str(icon).strip()
        if name and name not in seen:
            seen.append(name)
    result = seen[:max_icons]
    if not result:
        result = ["Zap", "CheckCircle", "ArrowRight"]
    LOGGER.info("Inferred icons: %s", result)
    return result


def extract_hook_and_cta(script_text: str) -> tuple[str, str]:
    """
    Naive but reliable hook/CTA extraction.
    Hook = first sentence (up to 6 words, title-cased).
    CTA = last impactful word, or a default.
    """
    sentences = re.split(r"[.!?]+", script_text.strip())
    first = sentences[0].strip() if sentences else script_text.strip()
    words = first.split()
    hook = " ".join(words[:6]).upper()

    # CTA: last word that is a verb/noun and not punctuation
    last_words = re.findall(r"[A-Za-z]+", script_text)
    cta = last_words[-1].upper() if last_words else "START"
    return hook, cta


# ═════════════════════════════════════════════════════════════════════════════
# AUDIO GENERATION
# ═════════════════════════════════════════════════════════════════════════════
def _spawn(cmd: List[str], cwd: Optional[Path] = None, timeout: int = 300) -> tuple[int, str, str]:
    """Run a subprocess and return (rc, stdout, stderr)."""
    LOGGER.info("Spawning (%ss): %s", timeout, " ".join(cmd))
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired as exc:
        return -2, exc.stdout or "", exc.stderr or f"TIMEOUT after {timeout}s"
    except Exception as exc:
        return -3, "", str(exc)


def generate_music_sfx(
    prompt: str,
    out_path: Path,
    duration_seconds: int = DEFAULT_MUSIC_DURATION_SECONDS,
) -> Dict[str, Any]:
    """
    Generate a music/SFX bed via the ElevenLabs Sound Generation endpoint.
    Falls back to a stub manifest if the key is missing or the call fails.
    """
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        LOGGER.warning("ELEVENLABS_API_KEY not set — writing music/SFX stub.")
        return _music_sfx_fallback(prompt, out_path)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    url = "https://api.elevenlabs.io/v1/sound-generation"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key,
    }
    payload = {
        "text": prompt,
        "duration_seconds": duration_seconds,
        "prompt_influence": 0.7,
    }

    try:
        import requests
        resp = requests.post(url, json=payload, headers=headers, timeout=180)
        resp.raise_for_status()
        out_path.write_bytes(resp.content)
        LOGGER.info("Music/SFX saved: %s (%d bytes)", out_path, len(resp.content))
        return {"success": True, "output_audio": str(out_path), "prompt": prompt}
    except Exception as exc:
        LOGGER.warning("ElevenLabs music/SFX failed: %s", exc)
        return _music_sfx_fallback(prompt, out_path)


def _music_sfx_fallback(prompt: str, out_path: Path) -> Dict[str, Any]:
    """Graceful stub when ElevenLabs music/SFX generation is unavailable."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path = out_path.with_suffix(".stub.json")
    manifest = {
        "version": "1.0",
        "note": "ElevenLabs Music/SFX stub — API key missing or call failed.",
        "prompt": prompt,
        "cues": [
            {"time_ms": 0, "type": "music", "description": "upbeat intro bed"},
            {"time_ms": 11000, "type": "sfx", "description": "cta punch"},
        ],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    LOGGER.info("Wrote music/SFX stub manifest to %s", manifest_path)
    return {"success": True, "manifest": str(manifest_path), "cues": manifest["cues"], "note": "stub"}


def generate_voiceover(
    script_text: str,
    out_path: Path,
    voice_id: str = DEFAULT_VOICE_ID,
    model: str = DEFAULT_MODEL,
) -> Dict[str, Any]:
    """
    Generate voiceover via ElevenLabs Text-to-Speech API.
    Falls back to a text stub if the key is missing or the call fails.
    """
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        LOGGER.warning("ELEVENLABS_API_KEY not set — writing audio stub.")
        return _audio_fallback(script_text, out_path)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key,
    }
    payload = {
        "text": script_text,
        "model_id": model,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    try:
        import requests
        resp = requests.post(url, json=payload, headers=headers, timeout=120)
        resp.raise_for_status()
        out_path.write_bytes(resp.content)
        LOGGER.info("Voiceover saved: %s (%d bytes)", out_path, len(resp.content))
        return {"success": True, "output_audio": str(out_path)}
    except Exception as exc:
        LOGGER.warning("ElevenLabs voiceover failed: %s", exc)
        return _audio_fallback(script_text, out_path)


def _audio_fallback(script_text: str, out_path: Path) -> Dict[str, Any]:
    """Graceful stub when audio generation is unavailable."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    stub = out_path.with_suffix(".stub.txt")
    stub.write_text(
        f"# AUDIO STUB\nProvider: ElevenLabs (not configured)\n\nScript:\n{script_text}",
        encoding="utf-8",
    )
    LOGGER.info("Wrote audio stub to %s", stub)
    return {"success": True, "output_audio": str(stub), "note": "stub — no audio engine"}


def generate_timestamps(
    audio_path: Path,
    out_path: Path,
    model: str = "base",
) -> List[Dict[str, Any]]:
    """
    Generate word-level timestamps. Preferred: ElevenLabs (not implemented here).
    Fallback: local Whisper via generate_timestamps.py, then expand segments to words.
    """
    ts_script = _SCRIPT_DIR / "generate_timestamps.py"
    if not ts_script.exists():
        LOGGER.warning("generate_timestamps.py not found; returning empty timestamps.")
        return []

    rc, out, err = _spawn(
        [sys.executable, str(ts_script), "--audio", str(audio_path), "--out", str(out_path), "--model", model],
        timeout=180,
    )
    if rc != 0 or not out_path.exists():
        LOGGER.warning("Timestamp generation failed (rc=%d): %s", rc, err)
        return []

    try:
        segments = json.loads(out_path.read_text(encoding="utf-8"))
    except Exception as exc:
        LOGGER.warning("Could not parse timestamps: %s", exc)
        return []

    # Convert segment-level captions to word-level timestamps for Remotion
    words: List[Dict[str, Any]] = []
    for seg in segments:
        text = seg.get("text", "").strip()
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", 0.0))
        seg_words = re.findall(r"[A-Za-z0-9']+", text.upper())
        if not seg_words:
            continue
        duration = end - start
        step = duration / len(seg_words)
        for i, word in enumerate(seg_words):
            w_start = round(start + i * step, 3)
            w_end = round(w_start + step, 3)
            words.append({"word": word, "start": w_start, "end": w_end})

    LOGGER.info("Generated %d word-level timestamps", len(words))
    return words


# ═════════════════════════════════════════════════════════════════════════════
# PROPS BUILDER
# ═════════════════════════════════════════════════════════════════════════════
def build_props(
    script_text: str,
    voiceover_path: Path,
    music_path: Optional[Path],
    timestamps: List[Dict[str, Any]],
    icons: List[str],
    episode: str,
) -> Dict[str, Any]:
    """Assemble the Remotion props.json payload for CCP v3.0."""
    hook, cta = extract_hook_and_cta(script_text)

    # Build audio cue timeline from timestamps + icons
    cues: List[Dict[str, Any]] = []
    for ts in timestamps:
        cues.append({
            "timeMs": int(ts["start"] * 1000),
            "cueType": "voice",
            "word": ts["word"],
        })

    # Add music/SFX stub cues at key moments
    cues.append({"timeMs": 0, "cueType": "music", "note": "intro bed"})
    if timestamps:
        cta_time = int(timestamps[-1]["start"] * 1000)
        cues.append({"timeMs": cta_time, "cueType": "sfx", "note": "cta punch"})

    # Sort and attach nearest icon to each visual cue
    cues.sort(key=lambda c: c["timeMs"])
    for cue in cues:
        if cue["cueType"] == "voice":
            # Cycle through icons based on time
            idx = (cue["timeMs"] // 2000) % max(len(icons), 1)
            cue["iconName"] = icons[idx] if icons else None

    props: Dict[str, Any] = {
        "_schema": "PremiumShortCompositionProps v3.0",
        "_episode": episode,
        "_generatedBy": "render.py — Content Creation Protocol v3.0",

        "voiceoverUrl": f"./audio/{voiceover_path.name}",
        "timestamps": timestamps,
        "iconNames": icons,
        "audioCueTimeline": cues,

        "hookText": hook,
        "ctaKeyword": cta,
    }
    if music_path:
        props["musicUrl"] = f"./audio/{music_path.name}"
    return props


# ═════════════════════════════════════════════════════════════════════════════
# VIRAL VIDEO PREDICTOR
# ═════════════════════════════════════════════════════════════════════════════
VIRAL_AUDITOR_PROMPT = """
You are the world's most advanced Short-Form and Long-Form Multimodal Algorithmic Video Auditor, engineered to replicate the precise analytic capabilities of Higgsfield, Go Viral, and predictive analytics tools. Your purpose is to evaluate uploaded video files or transcripts across TikTok, Instagram Reels, and YouTube Shorts algorithms to predict virality before publication.

Analyze the uploaded media across all sensory modalities (visual frames, audio cues, text overlays, and transcript pacing). Deliver a highly technical, objective, and data-backed Virality Audit using the exact breakdown structure below:

### 1. VIRALITY INDEX OVERVIEW
* **Overall Virality Score:** [0-100] (State a raw score based on hook strength, visual pacing, and transcript uniqueness).
* **Estimated Retention Curve Category:** [High-Retention Loop / Steady Decline / Immediate Drop-off]
* **Target Audience Alignment:** [Define the exact viewer demographic or algorithmic niche this video fits into].

### 2. HIGGSFIELD-STYLE METRIC BREAKDOWN
* **Hook Score (First 3 Seconds):** [0-100]. Analyze the visual changes, text overlays, and spoken script within the first 3000ms. Detail if an "open loop" or psychological curiosity gap was successfully established.
* **Pacing Density (Pattern Interrupts):** [Low / Medium / High]. Calculate the frequency of pattern interrupts (cuts, zooms, graphics, B-roll, or sound effects). Specify the average number of seconds between visual shifts.
* **Brain Heat Map Simulation (Visual Focus Points):** Describe where the human eye will focus during key frames of the video. Flag any visual dead zones, distracting backgrounds, or areas where on-screen text clashes with facial framing.
* **Transcript Novelty & Saturation:** Evaluate the uniqueness of the spoken words. Is this copy identical to oversaturated trends, or does it contain high-value, novel keywords that algorithms rank highly for SEO?

### 3. SECOND-BY-SECOND HOLD RATE TIMELINE
Provide a simulated timestamp analysis predicting exactly where human attention dips:
* **0:00 - 0:03:** [Predicted Hold Rate %] - Behavior analysis of the hook.
* **[Identify Drop-off Point 1]:** [Predicted Hold Rate %] - Flag the exact visual frame or sentence where viewers will swipe away due to a lull in pacing or confusing information.
* **[Identify Drop-off Point 2]:** [Predicted Hold Rate %] - Flag secondary retention risks (e.g., weak transitions, over-explaining).
* **Video Climax/Ending:** [Predicted Hold Rate %] - Evaluate the Call to Action (CTA) or the loop smoothness. Does the video end abruptly, or does it seamless loop to farm extra watch time?

### 4. ACTIONABLE OPTIMIZATION SCRIPT (THE FIXES)
Provide concrete, non-generic instructions to instantly elevate the Virality Score:
* **Visual Adjustments:** (e.g., "Add a crop zoom at 0:04," "Move text overlay higher to avoid the TikTok UI overlay," "Inject B-roll at 0:12").
* **Script & Audio Polish:** (e.g., "Cut the phrase 'Hey guys welcome back' from the first second," "Incorporate a high-frequency sound effect or text pop at 0:08").
* **SEO Optimization Package:** Generate 3 hyper-optimized Hooks, an algorithmic video description, and 5 highly-targeted keywords based on current platform trends.

Maintain an analytical, critical, and objective tone. Do not give generic praise. Focus purely on maximizing human attention metrics and algorithmic trigger points.
"""


def _get_genai_client() -> Optional[Any]:
    """Return a Google GenAI client if google-genai is installed and GEMINI_API_KEY is set."""
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        LOGGER.warning("google-genai not installed; Viral Video Predictor will be skipped.")
        return None

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        LOGGER.warning("GEMINI_API_KEY not set; Viral Video Predictor will be skipped.")
        return None

    return genai.Client(api_key=api_key)


def run_viral_video_predictor(
    video_path: Path,
    out_path: Optional[Path] = None,
    platform: str = "YouTube Shorts",
    niche: str = "Tech",
    timeout: int = 300,
) -> Dict[str, Any]:
    """
    Upload the rendered video to Gemini-1.5-Pro and write a markdown virality audit.

    The audit is saved next to the video file unless ``out_path`` is provided.
    """
    client = _get_genai_client()
    if client is None:
        return {"success": True, "note": "skipped — google-genai or GEMINI_API_KEY unavailable"}

    if not video_path.exists():
        return {"success": False, "error": f"video not found: {video_path}"}

    if out_path is None:
        out_path = video_path.with_suffix("").with_name(f"{video_path.stem}_virality_audit.md")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        from google.genai import types

        LOGGER.info("Uploading video to Gemini for viral audit: %s", video_path)
        video_file_remote = client.files.upload(file=str(video_path))

        LOGGER.info("Running Gemini-1.5-Pro viral audit...")
        response = client.models.generate_content(
            model="gemini-1.5-pro",
            contents=[
                video_file_remote,
                f"Target Platform: {platform}. Target Niche: {niche}. Execute the system instructions on this file.",
            ],
            config=types.GenerateContentConfig(
                system_instruction=VIRAL_AUDITOR_PROMPT,
                temperature=0.2,
            ),
        )

        audit_text = response.text or ""
        out_path.write_text(audit_text, encoding="utf-8")
        LOGGER.info("Wrote viral audit to %s", out_path)

        return {
            "success": True,
            "audit_path": str(out_path),
            "platform": platform,
            "niche": niche,
            "audit_text": audit_text,
        }
    except Exception as exc:
        LOGGER.error("Viral Video Predictor failed: %s", exc)
        return {"success": False, "error": str(exc)}


# ═════════════════════════════════════════════════════════════════════════════
# RENDER
# ═════════════════════════════════════════════════════════════════════════════
def render_remotion(
    composition: str = DEFAULT_COMPOSITION,
    out_path: Path = REMOTION_ROOT / "out" / "video.mp4",
    timeout: int = 600,
) -> Dict[str, Any]:
    """Run the local npx remotion render command."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    npx = shutil.which("npx") or "npx"
    cmd = [
        npx,
        "remotion",
        "render",
        "src/index.ts",
        composition,
        str(out_path),
        "--props",
        str(PROPS_PATH),
        "--log=error",
    ]
    rc, out, err = _spawn(cmd, cwd=REMOTION_ROOT, timeout=timeout)
    return {
        "success": rc == 0,
        "returncode": rc,
        "stdout": out,
        "stderr": err,
        "output_video": str(out_path) if rc == 0 and out_path.exists() else None,
    }


# ═════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═════════════════════════════════════════════════════════════════════════════
def run(
    script_text: str,
    out_path: Path,
    episode: str = "",
    voice_id: str = DEFAULT_VOICE_ID,
    composition: str = DEFAULT_COMPOSITION,
    skip_render: bool = False,
    music_prompt: Optional[str] = None,
    skip_viral_audit: bool = False,
    viral_platform: str = "YouTube Shorts",
    viral_niche: str = "Tech",
) -> Dict[str, Any]:
    """End-to-end CCP v3.0 render pipeline."""
    _load_env()
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Infer icons
    icons = infer_icons(script_text)

    # 2. Generate voiceover audio
    safe_name = re.sub(r"[^A-Za-z0-9_-]+", "_", episode or "episode").strip("_") or "voiceover"
    voiceover_path = AUDIO_DIR / f"{safe_name}.mp3"
    audio_result = generate_voiceover(script_text, voiceover_path, voice_id=voice_id)

    # 3. Music/SFX bed
    music_path: Optional[Path] = None
    if music_prompt:
        music_path = AUDIO_DIR / f"{safe_name}_music.mp3"
        music_result = generate_music_sfx(music_prompt, music_path)
    else:
        music_result = _music_sfx_fallback("", AUDIO_DIR / f"{safe_name}_music.stub.json")

    # 4. Timestamps
    ts_path = AUDIO_DIR / f"{safe_name}.timestamps.json"
    timestamps = generate_timestamps(Path(audio_result["output_audio"]), ts_path)

    # 5. Props
    props = build_props(script_text, voiceover_path, music_path, timestamps, icons, episode)
    PROPS_PATH.write_text(json.dumps(props, indent=2, ensure_ascii=False), encoding="utf-8")
    LOGGER.info("Wrote props to %s", PROPS_PATH)

    # 6. Render
    if skip_render:
        return {
            "success": True,
            "props": props,
            "audio": audio_result,
            "music_sfx": music_result,
            "render_skipped": True,
        }

    render_result = render_remotion(composition=composition, out_path=out_path)

    # 7. Automatic Viral Video Predictor audit
    viral_result: Dict[str, Any] = {"success": True, "note": "skipped"}
    if not skip_viral_audit and render_result.get("output_video"):
        viral_result = run_viral_video_predictor(
            video_path=out_path,
            platform=viral_platform,
            niche=viral_niche,
        )

    return {
        "success": render_result["success"] and viral_result.get("success", True),
        "props": props,
        "audio": audio_result,
        "music_sfx": music_result,
        "render": render_result,
        "viral_audit": viral_result,
        "output_video": render_result.get("output_video"),
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Content Creation Protocol v3.0 — Lean Remotion Renderer"
    )
    parser.add_argument("--script", required=True, help="The script text to render.")
    parser.add_argument(
        "--out",
        type=Path,
        default=REMOTION_ROOT / "out" / "video.mp4",
        help="Output video path.",
    )
    parser.add_argument("--episode", default="", help="Episode title / identifier.")
    parser.add_argument("--voice-id", default=DEFAULT_VOICE_ID, help="ElevenLabs voice ID.")
    parser.add_argument("--composition", default=DEFAULT_COMPOSITION, help="Remotion composition ID.")
    parser.add_argument("--skip-render", action="store_true", help="Prepare props/audio but do not render.")
    parser.add_argument(
        "--music-prompt",
        default=None,
        help="Text prompt for ElevenLabs sound-generation music/SFX bed (e.g. 'upbeat tech-pop, 15s, no vocals').",
    )
    parser.add_argument(
        "--skip-viral-audit",
        action="store_true",
        help="Skip the automatic Gemini-1.5-Pro viral video audit after rendering.",
    )
    parser.add_argument(
        "--viral-platform",
        default="YouTube Shorts",
        help="Target platform for the viral audit (TikTok, Instagram Reels, YouTube Shorts, Long-form YouTube).",
    )
    parser.add_argument(
        "--viral-niche",
        default="Tech",
        help="Content niche for the viral audit (e.g. Tech, Comedy, Cooking).",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging.")

    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        stream=sys.stderr,
    )

    result = run(
        script_text=args.script,
        out_path=args.out.resolve(),
        episode=args.episode,
        voice_id=args.voice_id,
        composition=args.composition,
        skip_render=args.skip_render,
        music_prompt=args.music_prompt,
        skip_viral_audit=args.skip_viral_audit,
        viral_platform=args.viral_platform,
        viral_niche=args.viral_niche,
    )

    print(json.dumps(result, indent=2, default=str))
    return 0 if result.get("success") else 1


if __name__ == "__main__":
    sys.exit(main())
