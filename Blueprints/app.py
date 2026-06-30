"""
Passaggio Intake API — Lean, intake-only FastAPI server.

ARCHITECTURE UPDATE (2026-06-12):
─────────────────────────────────
Newsletter ingestion has been fully migrated to Google Apps Script (GAS).
The heavy lifting (Gmail fetching, unread management, domain matching,
Gemini 3.5 Flash API batching, and daily report synthesis) now runs
natively in the cloud on a 24-hour time-driven trigger hooked to a
Google Sheet control panel.

Generated daily_summary_YYYY-MM-DD.md files are written directly to a
Google Drive folder, which is synchronized to the local environment via
Google Drive for Desktop (mounted locally or via symbolic link).

This local API retains ONLY the client intake endpoints:
  • POST /webhook/vapi     — Voice transcript leads from Vapi.ai
  • POST /intake/process   — Unified file + transcript uploads

SECTION 3 SCRIPT GENERATION RULES (Immutable Blueprint):
────────────────────────────────────────────────────────
When the Intelligence Layer generates or reads video hook content,
it must enforce these boundaries:

  • One Sentence, One Idea: 15-second limits require one hook, one
    concept, one takeaway.

  • Kindergarten Translation: Forbidden terms — API, loop breakage,
    containerization, sovereignty, authentication. Required replacements
    — invisible vaults, traffic cops, live selfies, secret-locking.

  • Pain + Solution Framework:
      – Hook (0-3s):   triggers a specific frustration
      – Concept (3-12s): defines the tool's core value
      – Takeaway (12-15s): delivers the benefit and links to the next
        chronological episode tracking via series_map.json
"""

import json
import os
import sys
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from google import genai

sys.path.insert(0, str(Path(__file__).resolve().parent))
import intake_system as intake

# Load environment variables from Blueprints/.env
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI()

# ── Static serving for the intake portal ──────────────────────────────
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
if PUBLIC_DIR.exists():
    app.mount("/public", StaticFiles(directory=str(PUBLIC_DIR)), name="public")

# ── Configuration ────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
CLIENT_INTAKE_DIR = BASE_DIR / "client_intake"
CLIENT_INTAKE_DIR.mkdir(parents=True, exist_ok=True)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
ai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


# ── FastAPI health / status ──────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "gemini_ready": ai_client is not None}


@app.get("/status")
def status():
    """Lightweight metadata endpoint."""
    return {
        "service": "Passaggio Intake API",
        "mode": "intake-only",
        "ingestion": "delegated-to-gas",
        "gemini_ready": ai_client is not None,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }


# ── Client Intake Endpoints ──────────────────────────────────────────

@app.post("/webhook/vapi")
async def webhook_vapi(request: Request):
    """
    Receive end-of-call payload from Vapi.ai.
    Auth via x-vapi-secret header matching env VAPI_SECRET_TOKEN.
    """
    intake.require_vapi_secret(request.headers.get("x-vapi-secret"))
    body = await request.json()

    # Vapi may wrap data under "message.analysis.structuredData" or send flat JSON
    raw = body if isinstance(body, dict) else {}
    msg = raw.get("message", raw)
    call = msg.get("call", {})
    analysis = msg.get("analysis", {})
    structured = analysis.get("structuredData", {}) if isinstance(analysis, dict) else {}
    artifact = msg.get("artifact", {})

    # Prefer flat keys, fall back to structuredData extraction
    name = raw.get("name") or structured.get("name") or "Unknown"
    email = raw.get("email") or structured.get("email") or ""
    company_url = raw.get("company_url") or structured.get("company_url") or ""
    problem_summary = raw.get("problem_summary") or structured.get("problem_summary") or analysis.get("summary", "")
    transcript = raw.get("transcript") or artifact.get("transcript")

    payload = intake.VapiWebhookPayload(
        name=name,
        email=email,
        company_url=company_url,
        problem_summary=problem_summary,
        transcript=transcript,
    )

    try:
        file_path = intake.process_vapi_lead(ai_client, payload)
        return JSONResponse({
            "status": "ok",
            "file": str(file_path),
            "client": name,
        })
    except Exception as exc:
        return JSONResponse({"status": "error", "detail": str(exc)}, status_code=500)


@app.post("/intake/process")
async def intake_process(request: Request):
    """
    Unified intake endpoint (voice transcript + file uploads).
    Auth via X-API-KEY header matching env INTAKE_API_KEY.
    """
    intake.require_intake_api_key(request.headers.get("x-api-key"))
    body = await request.json()
    payload = intake.UnifiedIntakePayload(**body)
    try:
        file_path = intake.process_unified_intake(ai_client, payload)
        return JSONResponse({
            "status": "ok",
            "file": str(file_path),
            "client": payload.client_name,
        })
    except Exception as exc:
        return JSONResponse({"status": "error", "detail": str(exc)}, status_code=500)


@app.get("/")
def root_redirect():
    """Redirect root to the intake portal for convenience."""
    return {"message": "Passaggio Intake API running.", "intake_url": "/public/intake.html"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
