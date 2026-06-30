#!/usr/bin/env python3
"""Historical backfill for Gmail emails.

This script connects to Gmail using the same OAuth configuration as the
background job, searches for all historical emails from the addresses listed
in :data:`Blueprints.app.ALLOWED_SENDERS`, and queues them for processing
through the intake system. It can be run manually or exposed as a temporary
FastAPI route.
"""

import json
import os
from pathlib import Path

from fastapi import FastAPI
from googleapiclient.errors import HttpError

# Import the shared modules from the project
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gmail_client as gmail
import intake_system as intake
import app as app_module

app = FastAPI()

@app.get("/backfill")
def backfill():
    """Trigger a one‑time backfill of all historical emails.

    The function returns a JSON payload with the number of messages queued.
    """
    service = gmail.build_service()
    # Search for all messages (no is:unread filter) from allowed senders
    query = " OR ".join(f'"{s}"' for s in app_module.ALLOWED_SENDERS)
    query = f"in:anywhere from:({query})"
    messages = []
    page_token = None
    while True:
        try:
            result = (
                service.users()
                .messages()
                .list(userId="me", q=query, pageToken=page_token, maxResults=100)
                .execute()
            )
        except HttpError as exc:
            return {"error": str(exc)}
        batch = result.get("messages", [])
        messages.extend(batch)
        page_token = result.get("nextPageToken")
        if not page_token:
            break
    queued = 0
    for meta in messages:
        msg_id = meta["id"]
        try:
            payload = gmail.fetch_full_message(service, msg_id)
        except HttpError:
            # Skip messages that cannot be fetched
            continue
        sender = gmail.extract_email(payload.get("sender", ""))
        if sender not in app_module.ALLOWED_SENDERS:
            continue
        # Queue the message using the same logic as poll_gmail_job
        out_path = app_module.QUEUE_DIR / f"{msg_id}.json"
        if out_path.exists():
            continue
        app_module.atomic_write(out_path, json.dumps(payload, indent=2, ensure_ascii=False))
        queued += 1
    return {"queued": queued}
