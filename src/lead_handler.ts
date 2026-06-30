/* --------------------------------------------------------------------------
 * lead_handler.ts
 * Passaggio IDE — Lead notification & human-in-the-loop approval
 * --------------------------------------------------------------------------
 *
 * Responsibilities:
 *   • Format the raw Vapi webhook payload into a human-readable lead summary.
 *   • Present a native VS Code notification with "Approve" and "Reject" buttons.
 *   • On approval: persist the lead to local JSON storage (storage.ts).
 *   • On rejection: log discard reason.
 *   • Provide keyboard shortcuts and command palette access to inspect the
 *     most recent lead without waiting for a new webhook.
 *
 * -------------------------------------------------------------------------- */

import * as vscode from "vscode";
import * as path from "path";
import { appendLead } from "./storage";

let _extensionPath: string = "";

export function setExtensionPath(p: string): void {
  _extensionPath = p;
}

/** Normalised lead structure derived from Vapi.ai webhook payload */
export interface ParsedLead {
  id: string;
  summary: string;
  structuredData: Record<string, unknown>;
  transcript?: string;
  recordingUrl?: string;
  timestamp: string;
}

/** Last lead cached for "Show Last Lead" quick-access command. */
let _lastLead: ParsedLead | undefined;

/**
 * Parse a raw Vapi webhook payload into a clean ParsedLead object.
 */
function parseVapiPayload(payload: any): ParsedLead | null {
  const msg = payload?.message ?? payload ?? {};
  const call = msg.call ?? {};
  const analysis = msg.analysis ?? {};
  const artifact = msg.artifact ?? {};

  const id: string = call.id ?? msg.id ?? `unknown-${Date.now()}`;
  const summary: string =
    analysis.summary ??
    analysis.successEvaluation ??
    "(No summary provided by Vapi)";

  return {
    id,
    summary,
    structuredData: analysis.structuredData ?? {},
    transcript: artifact.transcript ?? undefined,
    recordingUrl: artifact.recordingUrl ?? undefined,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Entry point called by webhook_server.ts every time a POST arrives.
 */
export async function handleIncomingLead(rawPayload: unknown): Promise<void> {
  const lead = parseVapiPayload(rawPayload);
  if (!lead) {
    vscode.window.showWarningMessage(
      "Webhook received but payload could not be parsed. Check the webhook server logs."
    );
    return;
  }

  _lastLead = lead;

  // Build a concise, readable summary for the notification.
  const structuredSnippet = Object.entries(lead.structuredData)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v).substring(0, 60)}`)
    .join(" | ");

  const notificationTitle = "🎯 New Lead Qualified by AI Voice Agent";
  const notificationDetail = structuredSnippet
    ? `${lead.summary.substring(0, 120)} … | ${structuredSnippet}`
    : lead.summary.substring(0, 180);

  const selection = await vscode.window.showInformationMessage(
    notificationTitle,
    { modal: false, detail: notificationDetail },
    { title: "👍 Approve", isCloseAffordance: false },
    { title: "👎 Reject", isCloseAffordance: false },
    { title: "📋 View Details", isCloseAffordance: false }
  );

  if (!selection) {
    // User dismissed the toast without clicking → treat as pending
    vscode.window.showWarningMessage(
      `Lead ${lead.id} left pending. Use "Passaggio: Show Last Lead" to review.`
    );
    return;
  }

  switch (selection.title) {
    case "👍 Approve":
      await onApprove(lead);
      break;
    case "👎 Reject":
      await onReject(lead);
      break;
    case "📋 View Details":
      await showLeadDetails(lead);
      break;
  }
}

async function onApprove(lead: ParsedLead): Promise<void> {
  const approved = { ...lead, status: "approved" as const };
  try {
    await appendLead(approved);
    vscode.window.showInformationMessage(
      `Lead ${lead.id} approved and saved to ~/.passaggio/leads/approved.json`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to save approved lead: ${err.message}`);
    return;
  }

  // ── Trigger the autonomous Design Bridge ───────────────────
  if (_extensionPath) {
    const designBridgePath = path.join(_extensionPath, "Blueprints", "design_bridge.py");
    const term = vscode.window.createTerminal({
      name: `🎨 Design Bridge: ${lead.id}`,
      cwd: vscode.workspace.workspaceFolders
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : process.cwd(),
    });
    term.sendText(`python3 "${designBridgePath}" --lead-id "${lead.id}" -v`);
    term.show();
    vscode.window.showInformationMessage(
      `Design bridge triggered for lead ${lead.id} — spawning terminal.`
    );
  }
}

async function onReject(lead: ParsedLead): Promise<void> {
  const reason = await vscode.window.showInputBox({
    prompt: "Why is this lead being rejected? (optional)",
    placeHolder: "e.g. budget too low, wrong industry, etc.",
  });
  const rejected = {
    ...lead,
    status: "rejected" as const,
    rejectReason: reason ?? "",
  };
  try {
    await appendLead(rejected);
    vscode.window.showInformationMessage(
      `Lead ${lead.id} rejected and logged to ~/.passaggio/leads/rejected.json`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to save rejected lead: ${err.message}`);
  }
}

/**
 * Render the full lead details in a read-only untitled document.
 */
async function showLeadDetails(lead: ParsedLead): Promise<void> {
  const docContent = JSON.stringify(lead, null, 2);
  const doc = await vscode.workspace.openTextDocument({
    language: "json",
    content: docContent,
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}

/**
 * Command handler: "Passaggio: Show Last Lead"
 * Useful when the user missed the toast or wants to re-inspect.
 */
export async function showLastLeadCommand(): Promise<void> {
  if (!_lastLead) {
    vscode.window.showInformationMessage(
      "No lead has arrived yet. Start the webhook server and wait for a call to complete."
    );
    return;
  }
  await showLeadDetails(_lastLead);
}

/**
 * Return the most recently parsed lead (exposed for other UI components).
 */
export function getLastLead(): ParsedLead | undefined {
  return _lastLead;
}
