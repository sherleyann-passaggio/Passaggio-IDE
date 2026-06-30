/**
 * telemetry.ts
 * Swarm Agent 1 — Target Implementation #3
 * Exports sanitized trajectory logs from local Hermes storage to the Desktop.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SanitizedTrajectory {
  filename: string;
  timestamp: number;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  trajectory: Record<string, unknown>;
}

export interface TelemetryBundle {
  exportedAt: string;
  system: string;
  sourceDirectory: string;
  count: number;
  data: SanitizedTrajectory[];
}

const SENSITIVE_KEYS: string[] = [
  'apiKey', 'api_key', 'token', 'secret', 'password',
  'credential', 'auth', 'key', 'privateKey', 'accessToken',
  'bearer', 'authorization'
];

function sanitizeValue(key: string, value: unknown): unknown {
  if (typeof key === 'string') {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sk => lower.includes(sk))) {
      return '[REDACTED]';
    }
  }
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map((v, i) => sanitizeValue(String(i), v));
    }
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = sanitizeValue(key, value);
  }
  return out;
}

function getTrajectoryDirectory(): string {
  return path.join(os.homedir(), '.hermes', 'trajectory');
}

function getDesktopPath(): string {
  const home = os.homedir();
  if (process.platform === 'win32') {
    return path.join(home, 'Desktop');
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Desktop');
  }
  // Linux / FreeBSD / others
  const xdg = process.env.XDG_DESKTOP_DIR;
  if (xdg) return xdg;
  const desktop = path.join(home, 'Desktop');
  if (fs.existsSync(desktop)) return desktop;
  return home;
}

/**
 * Reads all JSON trajectory files, sanitizes sensitive fields,
 * bundles them, and writes the result to the Desktop.
 * @returns The absolute path of the exported file.
 */
export async function exportTelemetryBundle(): Promise<string> {
  const trajectoryDir = getTrajectoryDirectory();
  const desktopDir = getDesktopPath();

  if (!fs.existsSync(trajectoryDir)) {
    throw new Error(`Trajectory directory does not exist: ${trajectoryDir}`);
  }

  if (!fs.existsSync(desktopDir)) {
    fs.mkdirSync(desktopDir, { recursive: true });
  }

  const entries: SanitizedTrajectory[] = [];
  const files = fs.readdirSync(trajectoryDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(trajectoryDir, file);
    try {
      const raw = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
      const parsed = JSON.parse(raw);

      const cleaned: SanitizedTrajectory = {
        filename: file,
        timestamp: parsed.timestamp || parsed.ts || Date.now(),
        provider: parsed.provider || parsed.modelProvider || 'unknown',
        promptTokens: parsed.promptTokens || parsed.prompt_tokens || 0,
        completionTokens: parsed.completionTokens || parsed.completion_tokens || 0,
        trajectory: sanitizeObject(parsed)
      };

      entries.push(cleaned);
    } catch (err) {
      console.error(`[telemetry.ts] Failed to process ${file}:`, err);
    }
  }

  const bundle: TelemetryBundle = {
    exportedAt: new Date().toISOString(),
    system: os.hostname(),
    sourceDirectory: trajectoryDir,
    count: entries.length,
    data: entries
  };

  const outFile = path.join(desktopDir, `telemetry_export_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2));

  return outFile;
}

/**
 * Registers the VS Code command for telemetry export.
 * Call this from extension.ts during activate().
 */
export function registerTelemetryCommands(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'antigravity.exportTelemetry',
    async () => {
      try {
        const exportPath = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Packaging telemetry trajectories...',
            cancellable: false
          },
          () => exportTelemetryBundle()
        );
        vscode.window.showInformationMessage(
          `Telemetry exported to Desktop: ${path.basename(exportPath)}`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Telemetry export failed: ${err.message}`);
        console.error(err);
      }
    }
  );
  context.subscriptions.push(disposable);
}
