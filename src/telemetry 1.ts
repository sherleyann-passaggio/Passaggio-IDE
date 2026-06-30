import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TrajectoryEntry {
    timestamp?: number | string;
    provider?: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs?: number;
    sessionId?: string;
    trajectory?: any;
}

export interface TelemetryExport {
    exportedAt: string;
    system: string;
    user: string;
    version: string;
    count: number;
    data: TrajectoryEntry[];
}

function getTrajectoryDirectory(): string {
    return path.join(os.homedir(), '.hermes', 'trajectory');
}

function getDesktopDirectory(): string {
    const home = os.homedir();
    const candidates = [
        path.join(home, 'Desktop'),
        path.join(home, 'desktop'),
        path.join(home, 'OneDrive', 'Desktop'),
    ];

    for (const dir of candidates) {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            return dir;
        }
    }

    return home;
}

/**
 * Sanitizes a raw trajectory object by extracting structural metadata
 * and stripping any raw prompt text or potential PII.
 */
function sanitizeTrajectory(raw: any): TrajectoryEntry {
    const safe: TrajectoryEntry = {
        timestamp: Date.now(),
        provider: 'unknown',
        model: 'unknown',
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
        sessionId: 'anonymous',
        trajectory: null,
    };

    if (!raw || typeof raw !== 'object') {
        return safe;
    }

    safe.timestamp = raw.timestamp ?? raw.ts ?? raw.created_at ?? Date.now();
    safe.provider = raw.provider ?? raw.modelProvider ?? 'unknown';
    safe.model = raw.model ?? raw.modelName ?? 'unknown';
    safe.promptTokens = raw.promptTokens ?? raw.input_tokens ?? 0;
    safe.completionTokens = raw.completionTokens ?? raw.output_tokens ?? 0;
    safe.latencyMs = raw.latencyMs ?? raw.latency ?? 0;
    safe.sessionId = raw.sessionId ?? raw.session ?? 'anonymous';

    // Retain only structural and status metadata; drop raw prompt/response strings.
    if (raw.trajectory && typeof raw.trajectory === 'object') {
        safe.trajectory = {
            turnCount: raw.trajectory.turnCount ?? raw.trajectory.turns ?? 0,
            status: raw.trajectory.status ?? 'completed',
            tags: Array.isArray(raw.trajectory.tags) ? raw.trajectory.tags : [],
            toolCalls: raw.trajectory.toolCalls ?? [],
            errors: raw.trajectory.errors ?? [],
        };
    } else {
        const sanitized: any = {};
        const allowedKeys = ['status', 'tags', 'turnCount', 'turns', 'toolCalls', 'actions', 'errors'];
        for (const key of allowedKeys) {
            if (key in raw) {
                sanitized[key] = raw[key];
            }
        }
        safe.trajectory = sanitized;
    }

    return safe;
}

function readTrajectoryFile(filePath: string): TrajectoryEntry | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        return sanitizeTrajectory(parsed);
    } catch (err) {
        console.error(`Failed to parse trajectory file ${filePath}:`, err);
        return null;
    }
}

/**
 * Reads all JSON trajectory files from the given directory (defaults to ~/.hermes/trajectory).
 */
export function readTrajectories(sourceDir?: string): { entries: TrajectoryEntry[]; errors: number } {
    const dir = sourceDir || getTrajectoryDirectory();
    const result = { entries: [] as TrajectoryEntry[], errors: 0 };

    if (!fs.existsSync(dir)) {
        console.warn(`Trajectory directory not found: ${dir}`);
        return result;
    }

    const files = fs.readdirSync(dir).filter(name => name.endsWith('.json'));

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (!fs.statSync(fullPath).isFile()) { continue; }

        const entry = readTrajectoryFile(fullPath);
        if (entry) {
            result.entries.push(entry);
        } else {
            result.errors += 1;
        }
    }

    return result;
}

/**
 * Packages sanitized trajectories into a single JSON file and writes it
 * directly to the Desktop (or targetDir if provided).
 * Returns the absolute export path and summary metadata.
 */
export function exportTelemetry(targetDir?: string, sourceDir?: string): { exportPath: string; count: number; errors: number } {
    const desktop = targetDir || getDesktopDirectory();
    const { entries, errors } = readTrajectories(sourceDir);

    const payload: TelemetryExport = {
        exportedAt: new Date().toISOString(),
        system: os.hostname(),
        user: os.userInfo().username,
        version: '1.0.0',
        count: entries.length,
        data: entries,
    };

    const filename = `telemetry_export_${Date.now()}.json`;
    const exportPath = path.join(desktop, filename);

    fs.writeFileSync(exportPath, JSON.stringify(payload, null, 2), 'utf-8');

    return { exportPath, count: entries.length, errors };
}

/**
 * Async wrapper for VS Code extension integration.
 */
export async function exportTelemetryAsync(targetDir?: string, sourceDir?: string): Promise<{ exportPath: string; count: number; errors: number }> {
    return exportTelemetry(targetDir, sourceDir);
}
