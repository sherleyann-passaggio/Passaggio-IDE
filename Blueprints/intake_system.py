#! /usr/bin/env python3
# -*- coding: utf-8 -*-
"""
intake_system.py
Unified Intake Pipeline for the Passaggio IDE Client Portal.
Handles voice (Vapi) and file/data uploads, runs the Intelligence Layer
via Gemini, writes markdown summaries, and enforces API-key security.
"""

import base64
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Header, HTTPException
from pydantic import BaseModel, Field


# ── Configuration ────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
CLIENT_INTAKE_DIR = BASE_DIR / "client_intake"
CLIENT_INTAKE_DIR.mkdir(parents=True, exist_ok=True)

VAPI_SECRET_TOKEN = os.environ.get("VAPI_SECRET_TOKEN", "")
INTAKE_API_KEY = os.environ.get("INTAKE_API_KEY", "")

# Reuse the same Gemini client setup as app.py (imported there)
# We expose a generate_intelligence_layer() function that accepts
# an already-initialised genai client to keep things DRY.


# ── Pydantic Models ────────────────────────────────────────────────

class FileMeta(BaseModel):
    filename: str
    content_type: str
    content_base64: Optional[str] = None


class UnifiedIntakePayload(BaseModel):
    client_name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=1)
    transcript_text: str = ""
    file_metadata: List[FileMeta] = []


class VapiWebhookPayload(BaseModel):
    name: str = Field(default="", alias="name")
    email: str = Field(default="", alias="email")
    company_url: str = Field(default="", alias="company_url")
    problem_summary: str = Field(default="", alias="problem_summary")
    transcript: Optional[str] = Field(default=None, alias="transcript")


# ── Intelligence Layer Prompt ──────────────────────────────────────

INTAKE_INTELLIGENCE_PROMPT = r"""You are the Sovereign Intake Intelligence Layer for a high-speed, elite custom-software development agency.

Your job is to analyse a prospective client's described business pain points and map them to the correct application from the agency's 9-asset ecosystem.

The 9-Asset Application Ecosystem
----------------------------------
1. SafeSitter Canada – Premium, trust-gated childcare ecosystem. Mandatory $5 verification gate, VSC validation, caregiver tiers (standard/premium/elite).
2. Resonance – Social safety networking app. Stripe Identity liveness checks, AI "Tuning Questions" building "Vibe Profiles", 10-minute "Virtual Meets" to prevent catfishing and romance scams.
3. Passaggio (Vocal Sanctuary) – Somatic/wellness vocal training. AI "Sovereign Concierge" routes users to practice rooms (BreathSync, VoiceGym).
4. Lease Guard – B2B prototype. Parses complex real-estate leases, extracts rent/renewal dates, flags non-compliant or high-risk clauses.
5. Legal Discovery Agent – B2B prototype. Reviews Tier 1 documents and summarises case research securely in a private cloud.
6. Service Trades Dispatcher – B2B prototype. Branded portal that qualifies leads, tracks technician coordinates, auto-updates CRM records.
7. B2B Lead Sculptor – B2B prototype. Analyses organic comments, reviews won/lost deal data, identifies targeted niches based on real buyer language.
8. Ops Process Analyst – B2B prototype. Audits ticket-handling data, detects workflow bottlenecks, flags silent deactivations/rate-limit breaks.
9. Omni-Channel Concierge – B2B prototype. Autonomously resolves 95% of routine Tier 1 billing and scheduling support tickets.

Brittle SaaS Reference
----------------------
Always contrast the selected custom app against standard multi-tenant SaaS limits where relevant:
• Monday.com – 1,000 board actions per 60 s (throttled); 30,000 per 60 s (blocked). Automations silently deactivate if target columns are renamed or the integration creator is deactivated/downgraded.
• Google Sheets – 300 requests/minute per project; 60 per minute per user → immediate 429 errors during bulk imports.
• Make.com – No persistent queuing or native backoff; partial data transfers and fragmentation when downstream rate limits fail.

Required Output Format
---------------------
Return a clean markdown document containing exactly four sections:

### SECTION 1: Client Problem Summary & Quantified Impact
Summarise the core business pain in 3 sentences. Pull any quantitative metrics the client mentioned (revenue lost, hours wasted, team size, etc.). If the topic is Social Safety, reference the FTC romance-scam losses (over $1.16 billion) or the BYU study showing 14% of dating-app sexual assaults happen on the first meeting. If Vocal Health, use the Northwestern/Bienen School vocal-dosimetry equation: Total Vocal Load=\int_{t_0}^{t_1}f(Amplitude,Frequency,Duration)dt with no spaces inside the delimiters. If Childcare, reference Canadian VSC processing times (3-5 business days).

### SECTION 2: Recommended App & Brittle SaaS Contrast
Identify which of the 9 apps most naturally resolves this pain. Explain explicitly why a DIY low-code setup (e.g. complex Monday.com workspace, Make.com → Google Sheets script) would break or hit cost/rate/maintenance limits under this specific scenario.

### SECTION 3: 6-Second Retention Hook (25-34 Professional Cohort)
Write a fast, pattern-interrupting visual and spoken hook. It must call out the parsed client topic to create instant relevance.

### SECTION 4: Developer Asset Directives
List the concrete files/components that should be generated inside the Google Antigravity IDE to match this build:
• Required design.md parameters (colours, fonts, tone).
• Key React/Vue components.
• Backend API endpoints.
• Database schema suggestions.
• Owner's Manual PDF checklist items.
• Optional Enhancement Modules (upsell hooks, e.g. "Add AI Voice Concierge (+$500 module)", "Advanced Analytics Dashboard (+$300 module)") — these keep the base app flexible while creating natural upgrade paths.
"""


# ── Auth Helpers ────────────────────────────────────────────────────

def require_vapi_secret(x_vapi_secret: Optional[str] = Header(None)) -> None:
    if not VAPI_SECRET_TOKEN:
        raise HTTPException(status_code=500, detail="VAPI_SECRET_TOKEN not configured on server.")
    if x_vapi_secret != VAPI_SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid Vapi secret.")


def require_intake_api_key(x_api_key: Optional[str] = Header(None)) -> None:
    if not INTAKE_API_KEY:
        raise HTTPException(status_code=500, detail="INTAKE_API_KEY not configured on server.")
    if x_api_key != INTAKE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key.")


# ── Core Logic ─────────────────────────────────────────────────────

def atomic_write(path: Path, content: str) -> None:
    """Write to a temp file and rename into place so watchers never see partial files."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def _slugify(name: str) -> str:
    """Sanitise a client name for safe filenames."""
    return re.sub(r"[^\w\-]", "_", name.strip()).strip("_")


def build_intake_path(client_name: str) -> Path:
    """Generate a deterministic .md path inside CLIENT_INTAKE_DIR."""
    date_stamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    slug = _slugify(client_name) if client_name else "unknown_client"
    filename = f"{slug}_{date_stamp}.md"
    return CLIENT_INTAKE_DIR / filename


def _decode_files(file_meta_list: List[FileMeta]) -> List[Dict[str, Any]]:
    """Decode base64 file payloads and return structured dicts."""
    decoded = []
    for fm in file_meta_list:
        entry: Dict[str, Any] = {
            "filename": fm.filename,
            "content_type": fm.content_type,
        }
        if fm.content_base64:
            try:
                entry["content"] = base64.b64decode(fm.content_base64).decode("utf-8", errors="replace")
            except Exception:
                entry["content"] = "[Error decoding file content]"
        decoded.append(entry)
    return decoded


def compose_source_text(transcript: str, problem_summary: str, files: List[Dict[str, Any]]) -> str:
    """Merge transcript, problem_summary, and any uploaded doc text into one analysis payload."""
    parts: List[str] = []
    if problem_summary:
        parts.append(f"PROBLEM SUMMARY:\n{problem_summary}\n")
    if transcript:
        parts.append(f"RAW TRANSCRIPT:\n{transcript}\n")
    if files:
        for f in files:
            parts.append(f"UPLOADED DOC ({f['filename']}):\n{f.get('content', '')}\n")
    return "\n---\n".join(parts)


def run_intelligence_layer(ai_client, source_text: str) -> str:
    """Call Gemini with the Intelligence Layer prompt and return the markdown report."""
    if ai_client is None:
        raise HTTPException(status_code=503, detail="Gemini client not initialised (GEMINI_API_KEY missing).")
    try:
        response = ai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"Analyse the following client intake data:\n{source_text}",
            config={"system_instruction": INTAKE_INTELLIGENCE_PROMPT},
        )
        return response.text
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gemini processing failed: {exc}")


def generate_intake_markdown(
    client_name: str,
    email: str,
    company_url: str,
    transcript: Optional[str],
    intelligence_analysis: str,
) -> str:
    """Build the final markdown file content."""
    lines: List[str] = [
        "# 🎯 Client Intake Report",
        "",
        f"**Client:** {client_name}",
        f"**Email:** {email}",
        f"**Company URL:** {company_url if company_url else '*Not provided*'}",
        f"**Generated:** {datetime.now().isoformat()}",
        "",
    ]
    if transcript:
        lines.extend([
            "---",
            "",
            "## Raw Transcript",
            "",
            transcript,
            "",
        ])
    lines.extend([
        "---",
        "",
        "## Intelligence Layer Analysis",
        "",
        intelligence_analysis,
        "",
        "---",
        "",
        "## Next Steps",
        "",
        "1. Review Section 4 (Developer Asset Directives).",
        "2. Confirm app template selection with client.",
        "3. Trigger build pipeline via `sovereign-workspace-ide.runOrchestrator`.",
        "",
    ])
    return "\n".join(lines)


def write_intake_file(client_name: str, email: str, company_url: str,
                      transcript: Optional[str], intelligence_analysis: str) -> Path:
    """Atomically write the intake markdown file and return its path."""
    md = generate_intake_markdown(client_name, email, company_url, transcript, intelligence_analysis)
    out_path = build_intake_path(client_name)
    atomic_write(out_path, md)
    return out_path


# ── Convenience wrappers used by app.py routes ─────────────────────

def process_vapi_lead(ai_client, payload: VapiWebhookPayload) -> Path:
    """Full pipeline for a Vapi voice-agent lead."""
    source = compose_source_text(
        transcript=payload.transcript or "",
        problem_summary=payload.problem_summary,
        files=[],
    )
    analysis = run_intelligence_layer(ai_client, source)
    return write_intake_file(
        client_name=payload.name,
        email=payload.email,
        company_url=payload.company_url,
        transcript=payload.transcript,
        intelligence_analysis=analysis,
    )


def process_unified_intake(ai_client, payload: UnifiedIntakePayload) -> Path:
    """Full pipeline for the unified /intake/process endpoint (voice + files)."""
    files = _decode_files(payload.file_metadata)
    source = compose_source_text(
        transcript=payload.transcript_text,
        problem_summary="",  # derived from transcript + files by the AI
        files=files,
    )
    analysis = run_intelligence_layer(ai_client, source)
    return write_intake_file(
        client_name=payload.client_name,
        email=payload.email,
        company_url="",  # not required for unified endpoint
        transcript=payload.transcript_text,
        intelligence_analysis=analysis,
    )
