# Sovereign Email Ingestion Daemon

A self-contained, local-first Python daemon that polls Gmail, queues unread newsletters from trusted senders, synthesizes them daily via Gemini, and commits structured 4-section markdown reports to a local Git branch.

## Architecture (Hot Folder)

```
Gmail ──poll──▶ /queue/*.json  ──08:00 AM──▶ Gemini ──▶ /reports/daily_summary_YYYY-MM-DD.md
                  │                                      │
                  └── marked READ in Gmail               └── auto-committed to `content-ingestion`
```

- **`/queue`** — Raw email JSON payloads saved atomically so IDE watchers never see partial files.
- **`/reports`** — Final AI-generated daily digest markdown files.
- **`/inbox`** — Optional hook directory for external drops.

## Prerequisites

- Python 3.10+
- A Gemini API key set as `GEMINI_API_KEY`
- Google OAuth credentials set as env vars (or leave the hardcoded defaults in `gmail_client.py` for local dev only)

## Quick Start

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Run the daemon
python Blueprints/app.py
```

The daemon will:
1. Poll Gmail immediately on startup.
2. Continue polling every **15 minutes**.
3. Run the daily digest synthesizer every day at **08:00 AM**.

## Endpoints (observability)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Daemon alive + Gemini ready check |
| `/status` | GET | Queue depth, last poll, last digest |
| `/trigger-digest` | POST | Manually trigger the daily digest job |

## Git Workflow

Reports are committed automatically to the local branch `content-ingestion`.
To sync into your main working branch:

```bash
git checkout main
git pull content-ingestion
```

No GitHub login is required — everything stays local until you decide to push.

## Why No Make.com / No ngrok?

This daemon authenticates directly to Gmail via the official Google API. There are no external webhooks, no tunneling, and no brittle third-party queueing. Rate limits and backoffs are managed entirely inside the Python process.

## Additional Notes

- All file writes use an **atomic temp-write + rename** pattern to prevent partial reads by file system watchers.
- The `content-ingestion` branch is created automatically on the first digest run.
