/* --------------------------------------------------------------------------
 * webhook_server.ts
 * Passaggio IDE — Local HTTP webhook receiver for Vapi.ai lead pipeline
 * --------------------------------------------------------------------------
 *
 * Responsibilities:
 *   • Start/stop a lightweight Node.js HTTP server on a configurable port.
 *   • Listen for POST /webhook calls from Vapi.ai (via ngrok tunnel).
 *   • Parse the lead payload and delegate to the lead handler.
 *   • Gracefully handle port conflicts and shutdown on extension deactivation.
 *
 * Architecture:
 *   Vapi.ai ──POST──▶ ngrok ──POST──▶ localhost:8787/webhook
 *                                      │
 *                                      ▼
 *                              webhook_server.ts
 *                                      │
 *                                      ▼
 *                              lead_handler.ts
 * -------------------------------------------------------------------------- */

import * as http from "http";
import * as vscode from "vscode";

/**
 * Minimal webhook payload shape accepted from Vapi.ai.
 * See: https://docs.vapi.ai/webhooks
 */
interface VapiWebhookPayload {
  message?: {
    type: string;
    call: {
      id: string;
      status: string;
      endedReason?: string;
    };
    analysis?: {
      summary?: string;
      structuredData?: Record<string, unknown>;
      successEvaluation?: string;
    };
    artifact?: {
      transcript?: string;
      recordingUrl?: string;
    };
  };
}

/** Runtime server state */
let _server: http.Server | undefined;
let _port: number | undefined;

/**
 * Start the webhook HTTP server.
 *
 * @param port   TCP port to bind (default 8787).
 * @param leadHandler  Callback invoked with parsed lead data.
 */
export function startWebhookServer(
  port: number,
  leadHandler: (payload: unknown) => void
): Promise<number> {
  return new Promise((resolve, reject) => {
    if (_server?.listening) {
      vscode.window.showInformationMessage(
        `Webhook server already running on port ${_port}.`
      );
      resolve(_port!);
      return;
    }

    _server = http.createServer((req, res) => {
      // CORS pre-flight — Vapi may hit us from any origin.
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method Not Allowed" }));
        return;
      }

      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          // Respond immediately (best practice for webhooks)
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ received: true }));
          // Hand off asynchronously so we never block the HTTPS ack
          leadHandler(payload);
        } catch (err: any) {
          console.error("[webhook] JSON parse error:", err.message);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Bad Request" }));
        }
      });
    });

    _server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        vscode.window.showErrorMessage(
          `Port ${port} is already in use. Change passaggio.webhook.port in Settings.`
        );
        reject(err);
      } else {
        reject(err);
      }
    });

    _server.listen(port, () => {
      _port = port;
      vscode.window.showInformationMessage(
        `🟢 Passaggio webhook server listening on http://localhost:${port}/webhook`
      );
      resolve(port);
    });
  });
}

/**
 * Gracefully shut down the webhook server.
 */
export function stopWebhookServer(): void {
  if (_server) {
    _server.close(() => {
      console.log("[webhook] Server closed.");
    });
    _server = undefined;
    _port = undefined;
  }
}
