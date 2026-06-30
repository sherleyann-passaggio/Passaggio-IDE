#!/bin/bash

# start_webhook.sh
# This script starts the local Python webhook listener and exposes it to the web using ngrok.

# --- Configuration ---
# The local port your hermes_bridge.py script is listening on.
# This should match the port configured in your VS Code settings (`sovereign-workspace-ide.webhook.port`).
LOCAL_PORT=8787

# The absolute path to your 'Blueprints' directory containing hermes_bridge.py.
# Update this path to match your project structure.
BLUEPRINTS_DIR="/Users/sherleybelleus/Library/Mobile Documents/com~apple~CloudDocs/Passaggio IDE/Blueprints"

# --- Execution ---

echo "🚀 Starting Sovereign Workstation Webhook Bridge..."

# 1. Start the local Python webhook listener in the background.
echo "[1/2] Starting hermes_bridge.py on port $LOCAL_PORT..."
python3 "${BLUEPRINTS_DIR}/hermes_bridge.py" &
LISTENER_PID=$!
echo "    > Listener started with PID: $LISTENER_PID"

# 2. Start ngrok to expose the local port to the internet.
echo "[2/2] Starting ngrok tunnel..."
ngrok http $LOCAL_PORT

# When you stop ngrok (Ctrl+C), you may need to manually stop the Python script.
echo "Tunnel closed. Killing listener process $LISTENER_PID..."
kill $LISTENER_PID
