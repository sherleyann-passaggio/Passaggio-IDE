import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TrajectoryEntry {
  filename: string;
  timestamp: number;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  trajectory: any;
}

const SENSITIVE_KEYS: string[] = [
  'api_key', 'apikey', 'apiKey', 'api-key',
  'token', 'auth_token', 'access_token',
  'secret', 'secret_key', 'password',
  'credential', 'credentials', 'bearer',
  'authorization'
];

/**
 * Recursively sanitize an object by redacting sensitive keys and truncating oversized strings.
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 2048) {
      sanitized[key] = value.substring(0, 2048) + '...[truncated]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Resolve the local trajectory storage directory (~/.hermes/trajectory).
 */
function getTrajectoryDir(): string {
  return path.join(os.homedir(), '.hermes', 'trajectory');
}

/**
 * Resolve the user's Desktop directory with cross-platform fallbacks.
 */
export function getDesktopDir(): string {
  const home = os.homedir();
  // macOS / Windows
  const desktop = path.join(home, 'Desktop');
  if (fs.existsSync(desktop)) {
    return desktop;
  }
  // Linux XDG fallback
  if (process.env.XDG_DESKTOP_DIR) {
    const xdgDesktop = path.resolve(process.env.XDG_DESKTOP_DIR);
    if (fs.existsSync(xdgDesktop)) {
      return xdgDesktop;
    }
  }
  return home;
}

/**
 * Read all JSON trajectory files from local storage, sanitize them, and sort by timestamp.
 */
export function readLocalTrajectories(): TrajectoryEntry[] {
  const trajectoryDir = getTrajectoryDir();
  if (!fs.existsSync(trajectoryDir)) {
    return [];
  }

  const files = fs.readdirSync(trajectoryDir).filter(f => f.endsWith('.json'));
  const entries: TrajectoryEntry[] = [];

  for (const file of files) {
    const filePath = path.join(trajectoryDir, file);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const sanitized = sanitizeObject(raw);

      entries.push({
        filename: file,
        timestamp: Number(sanitized.timestamp || Date.now()),
        provider: String(sanitized.provider || 'unknown'),
        promptTokens: Number(
          sanitized.promptTokens ?? sanitized.prompt_tokens ?? sanitized.input_tokens ?? 0
        ),
        completionTokens: Number(
          sanitized.completionTokens ?? sanitized.completion_tokens ?? sanitized.output_tokens ?? 0
        ),
        trajectory: sanitized
      });
    } catch (err) {
      console.warn(`[telemetry.ts] Skipping unreadable trajectory ${file}:`, err);
    }
  }

  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Package sanitized trajectories into a JSON file and write it directly to the Desktop.
 * @param targetDir Optional override for the export destination.
 * @returns The absolute file path of the exported JSON.
 */
export async function exportToDesktop(targetDir?: string): Promise<string> {
  const entries = readLocalTrajectories();
  const desktop = targetDir || getDesktopDir();

  if (!fs.existsSync(desktop)) {
    fs.mkdirSync(desktop, { recursive: true });
  }

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    system: os.hostname(),
    user: os.userInfo().username,
    platform: process.platform,
    count: entries.length,
    trajectories: entries
  };

  const outName = `telemetry_export_${Date.now()}.json`;
  const outPath = path.join(desktop, outName);

  fs.writeFileSync(outPath, JSON.stringify(exportPayload, null, 2), 'utf8');
  return outPath;
}

/**
 * Standalone CLI execution entrypoint.
 * Usage: npx ts-node workspace-ide/telemetry.ts
 */
if (require.main === module) {
  (async () => {
    try {
      const outPath = await exportToDesktop();
      console.log(`Telemetry exported successfully to: ${outPath}`);
      console.log(`Entries packaged: ${readLocalTrajectories().length}`);
    } catch (err) {
      console.error('Telemetry export failed:', err);
      process.exit(1);
    }
  })();
}
