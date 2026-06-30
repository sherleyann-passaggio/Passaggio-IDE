#!/bin/zsh
# schedule_morning_ingest.sh
# Runs the morning newsletter intelligence ingest for the Autonomous Agency Pipeline
# ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="${0:A:h}"          # resolves to the directory this script lives in
LOG_DIR="$SCRIPT_DIR/.passaggio_cache/logs"
LOG_FILE="$LOG_DIR/ingest_$(date +%Y-%m-%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

{
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  🚀 Passaggio Morning Ingest — $(date '+%Y-%m-%d %H:%M:%S %Z')  ║"
  echo "╚══════════════════════════════════════════════════════════╝"

  cd "$SCRIPT_DIR"

  # ── Phase 0: Google Doc ──
  echo ""
  echo "📄  Phase 0: Reading The Centralized Newsletter Scripts..."
  /usr/bin/env python3 read_docs.py "The Centralized Newsletter Scripts" --schedule daily

  # ── Phase 0b: Check and ingest Gmail newsletters from the past 12 hours ──
  echo ""
  echo "📧  Phase 0b: Polling Gmail & Synthesizing Daily Digest..."
  /usr/bin/env python3 run_morning_ingest.py

  echo ""
  echo "✅  Morning ingest complete."

} &> "$LOG_FILE"

# Also tee the final line to a "latest" symlink for quick inspection
ln -sf "$LOG_FILE" "$LOG_DIR/latest_ingest.log"
