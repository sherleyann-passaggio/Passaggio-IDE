/**
 * @fileoverview telegram_bridge.js
 * Remote Telegram Bridge Integration for the Passaggio IDE Remotion Pipeline.
 * A lightweight, highly secure local Node.js bridge that allows remote control
 * of the Remotion workspace and file updates via a private Telegram Bot interface.
 *
 * Architecture: Zero Trust Gateway
 * - All incoming messages are gated by a hardcoded ALLOWED_USER_ID.
 * - Unauthorized access attempts are logged silently and denied immediately.
 * - No system functions are exposed to the public web.
 */

const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Dotenv Initialization ─────────────────────────────────────────────────
require('dotenv').config({ path: path.join(__dirname, 'Blueprints', '.env') });

// ─── Configuration & Zero Trust Guardrails ─────────────────────────────────

/**
 * Hardcoded allowed user ID.
 * This is the only Telegram user authorized to interact with this bot.
 * Any other user will be silently blocked.
 */
const ALLOWED_USER_ID = 7916710756;

/**
 * Path to the active Remotion video blueprint file.
 * Incoming JSON/markdown code blocks will be written here.
 */
const BLUEPRINT_PATH = path.join(__dirname, 'remotion', 'props.json');

/**
 * Absolute path to the Remotion workspace directory.
 * Used as the CWD for child process execution.
 */
const REMOTION_DIR = path.join(__dirname, 'remotion');

// ─── Google Drive Local Sync Configuration ───────────────────────────────────

/**
 * Absolute path to the locally synced Google Drive marketing folder.
 * We watch the Email reports folder directly for newly synced .md files.
 */
const WATCH_FOLDER = path.join(__dirname, 'Email reports');

/**
 * Path to the lightweight JSON file that persists already-processed file names.
 */
const STATE_FILE = path.join(__dirname, 'processed_scripts.json');

// ─── Environment Variable Validation ─────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('[FATAL] TELEGRAM_TOKEN is not set in Blueprints/.env');
  process.exit(1);
}

// ─── Bot Initialization ────────────────────────────────────────────────────

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// ─── Global Middleware: Zero Trust Gate ────────────────────────────────────

bot.use((ctx, next) => {
  const userId = ctx.from?.id;

  if (!userId || userId !== ALLOWED_USER_ID) {
    // Silently log unauthorized access attempts
    console.warn(`[SECURITY] Blocked unauthorized access from user ID: ${userId || 'unknown'} at ${new Date().toISOString()}`);
    return; // Stop processing — deny without response
  }

  return next();
});

// ─── Command: /start ─────────────────────────────────────────────────────────

bot.start((ctx) => {
  ctx.reply('🛡️  Passaggio Remote Bridge Online\nAuthorized user confirmed.\n\nCommands:\n/render — Compile the Remotion video\nSend a JSON blueprint to update props.json');
});

// ─── Command: /render ────────────────────────────────────────────────────────

bot.command('render', (ctx) => {
  ctx.reply('🎬 Initiating Remotion render pipeline...');

  const renderCommand = 'npm run render';

  ctx.reply('⏳ Headless browser spinning up...');

  const child = exec(renderCommand, { cwd: REMOTION_DIR }, (error, stdout, stderr) => {
    if (error) {
      console.error(`[RENDER ERROR] ${error.message}`);
      ctx.reply('❌ Render failed. Check server logs for details.');
      return;
    }

    if (stderr) {
      console.warn(`[RENDER STDERR] ${stderr}`);
    }

    console.log(`[RENDER STDOUT] ${stdout}`);
    ctx.reply('✅ MP4 compilation complete!');
  });

  // Stream live PID status for debugging
  console.log(`[RENDER] Spawned process PID: ${child.pid}`);
});

// ─── Message Handler: Blueprint JSON Ingestion ───────────────────────────────

bot.on('text', (ctx) => {
  const text = ctx.message.text;

  // Skip commands — they are handled above
  if (text.startsWith('/')) return;

  let rawJson = text;

  // Detect and strip markdown code blocks (```json ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    rawJson = codeBlockMatch[1];
  }

  // Attempt JSON parsing
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    // Not valid JSON — ignore silently or optionally notify
    ctx.reply('⚠️ Received message does not contain valid JSON. Send a JSON blueprint or use /render.');
    return;
  }

  // Validate minimal structure to avoid corrupting props.json
  if (!parsed || typeof parsed !== 'object') {
    ctx.reply('⚠️ Invalid JSON structure. Must be a valid object.');
    return;
  }

  // Write to the active blueprint file
  try {
    fs.writeFileSync(BLUEPRINT_PATH, JSON.stringify(parsed, null, 2), 'utf8');
    ctx.reply('📋 Video blueprint updated successfully.');
    console.log(`[BLUEPRINT] Updated ${BLUEPRINT_PATH} at ${new Date().toISOString()}`);
  } catch (writeErr) {
    console.error(`[BLUEWRITE ERROR] ${writeErr.message}`);
    ctx.reply('❌ Failed to save blueprint. Check server permissions.');
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FILE WATCHER & STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load persisted processed-file state from disk.
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error(`[WATCHER] Failed to load state: ${err.message}`);
  }
  return { processed: [] };
}

/**
 * Persist processed-file state to disk atomically.
 */
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error(`[WATCHER] Failed to save state: ${err.message}`);
  }
}

/**
 * Recursively scan a directory for .md files.
 * @param {string} dirPath — Absolute path to the directory
 * @returns {string[]} Array of absolute file paths
 */
function findMarkdownFiles(dirPath) {
  const files = [];
  if (!fs.existsSync(dirPath)) return files;

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    console.error(`[WATCHER] Error reading directory ${dirPath}: ${err.message}`);
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Process a single .md file: read content, send via Telegram, record state.
 * Uses a fallback to plain text if Markdown send fails.
 */
async function processFile(filePath) {
  const state = loadState();
  // Normalize to relative path for portable state
  const relativePath = path.relative(__dirname, filePath);

  if (state.processed.includes(relativePath)) {
    console.log(`[WATCHER] Skipping already processed file: ${relativePath}`);
    return;
  }

  // Wait a brief moment to ensure the file is fully written (especially for Google Drive syncs)
  await new Promise(r => setTimeout(r, 500));

  if (!fs.existsSync(filePath)) {
    console.warn(`[WATCHER] File vanished before processing: ${filePath}`);
    return;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`[WATCHER] Error reading file ${filePath}: ${err.message}`);
    return;
  }

  // Attempt to send via Telegram with Markdown formatting, fall back to plain text
  try {
    await bot.telegram.sendMessage(ALLOWED_USER_ID, `📄 *New Script: ${relativePath}*\n\n${content}`, { parse_mode: 'Markdown' });
    console.log(`[WATCHER] Sent ${relativePath} to Telegram`);
  } catch (telegramErr) {
    console.warn(`[WATCHER] Failed to send with Markdown, falling back to plain text: ${telegramErr.message}`);
    try {
      await bot.telegram.sendMessage(ALLOWED_USER_ID, `📄 New Script: ${relativePath}\n\n${content}`);
      console.log(`[WATCHER] Sent ${relativePath} to Telegram (plain text fallback)`);
    } catch (fatalErr) {
      console.error(`[WATCHER] Telegram send failed completely: ${fatalErr.message}`);
      return;
    }
  }

  // Mark as processed
  state.processed.push(relativePath);
  saveState(state);
}

/**
 * Initial startup scan to process any files already in the folder.
 */
async function startupScan() {
  console.log('[WATCHER] Running startup catch-up scan...');
  const files = findMarkdownFiles(WATCH_FOLDER);
  console.log(`[WATCHER] Found ${files.length} .md files during startup scan.`);

  for (const file of files) {
    try {
      await processFile(file);
    } catch (err) {
      console.error(`[WATCHER] Error during startup scan for ${file}: ${err.message}`);
    }
  }
  console.log('[WATCHER] Startup scan complete.');
}

// ─── Error Handling ──────────────────────────────────────────────────────────

bot.catch((err, ctx) => {
  console.error(`[BOT ERROR] ${err.message}`, err);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// ─── Start the Bot & File Watcher ───────────────────────────────────────────

bot.launch()
  .then(() => {
    console.log('[BRIDGE] Telegram bot is polling...');
    console.log(`[BRIDGE] Zero Trust gate active for user ID: ${ALLOWED_USER_ID}`);
    console.log(`[BRIDGE] Blueprint target: ${BLUEPRINT_PATH}`);
    console.log(`[BRIDGE] Render CWD: ${REMOTION_DIR}`);
    console.log(`[BRIDGE] Watch folder: ${WATCH_FOLDER}`);

    // Setup the file watcher
    if (!fs.existsSync(WATCH_FOLDER)) {
      console.warn(`[WATCHER] Watch folder does not exist, creating: ${WATCH_FOLDER}`);
      fs.mkdirSync(WATCH_FOLDER, { recursive: true });
    }

    const watcher = fs.watch(WATCH_FOLDER, { recursive: true }, async (eventType, filename) => {
      if (!filename) return;
      if (!filename.endsWith('.md')) return;

      const fullPath = path.join(WATCH_FOLDER, filename);
      console.log(`[WATCHER] Detected ${eventType} on: ${filename}`);

      try {
        await processFile(fullPath);
      } catch (err) {
        console.error(`[WATCHER] Error processing file: ${err.message}`);
      }
    });

    console.log('[BRIDGE] File watcher activated (recursive fs.watch on macOS)');

    // Run the initial catch-up scan
    startupScan().catch(err => {
      console.error(`[WATCHER] Startup scan encountered error: ${err.message}`);
    });

    process.once('SIGINT', () => {
      console.log('[BRIDGE] Closing file watcher...');
      watcher.close();
    });
    process.once('SIGTERM', () => {
      console.log('[BRIDGE] Closing file watcher...');
      watcher.close();
    });
  })
  .catch((err) => {
    console.error('[FATAL] Failed to launch bot:', err.message);
    process.exit(1);
  });
