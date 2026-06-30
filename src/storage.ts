/* --------------------------------------------------------------------------
 * storage.ts
 * Passaggio IDE — Append-only JSON line storage for voice-agent leads
 * --------------------------------------------------------------------------
 *
 * Responsibilities:
 *   • Create ~/.passaggio/leads/ if it doesn't exist.
 *   • Append every lead (approved or rejected) as a single JSON line
 *     (NDJSON) so the file is human-readable and trivially parseable.
 *   • Provide a read helper that returns an array of all leads.
 *   • Auto-create daily rollup files: approved_YYYY-MM-DD.ndjson,
 *     rejected_YYYY-MM-DD.ndjson.
 *
 * -------------------------------------------------------------------------- */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const STORAGE_DIR = path.join(os.homedir(), ".passaggio", "leads");

function ensureDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function dailyFileName(status: "approved" | "rejected" | "pending"): string {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return path.join(STORAGE_DIR, `${status}_${today}.ndjson`);
}

function masterFileName(status: "approved" | "rejected" | "pending"): string {
  return path.join(STORAGE_DIR, `${status}.ndjson`);
}

/**
 * Append a lead object to both the master NDJSON file and the daily rollup.
 */
export async function appendLead(
  lead: Record<string, unknown>
): Promise<void> {
  ensureDir();

  const status = (lead.status as "approved" | "rejected") ?? "pending";
  const line = JSON.stringify(lead) + "\n";

  // Write to master file (e.g. approved.ndjson)
  const master = masterFileName(status);
  fs.appendFileSync(master, line, { encoding: "utf-8" });

  // Also write to daily file (e.g. approved_2026-06-05.ndjson)
  const daily = dailyFileName(status);
  fs.appendFileSync(daily, line, { encoding: "utf-8" });
}

/**
 * Read every line from an NDJSON file and return an array of objects.
 */
export function readLeads(
  status: "approved" | "rejected"
): Record<string, unknown>[] {
  ensureDir();
  const master = masterFileName(status);
  if (!fs.existsSync(master)) {
    return [];
  }
  const raw = fs.readFileSync(master, "utf-8");
  return raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

/**
 * Return the full filesystem path to the requested master file.
 */
export function getLeadFilePath(status: "approved" | "rejected"): string {
  ensureDir();
  return masterFileName(status);
}
