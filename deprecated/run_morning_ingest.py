#!/usr/bin/env python3
"""Run the morning email polling and daily digest generation."""

import sys
from pathlib import Path

# Add Blueprints directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent / "Blueprints"))

import app

def main():
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  🚀 Passaggio Email Ingest Daemon                        ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print("Polling Gmail for new unread newsletters (last 12 hours)...")
    try:
        # Polling Gmail for unread emails in the last 12 hours
        queued = app.poll_gmail_job(max_results=100, max_loops=20, timeframe="12h")
        print(f"Polling completed. Queued: {queued}")
        
        print("Synthesizing daily digest report via Gemini...")
        app.generate_daily_digest_job()
        print("Daily digest pipeline finished successfully!")
    except Exception as e:
        print(f"Error during email ingestion / digest generation: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
