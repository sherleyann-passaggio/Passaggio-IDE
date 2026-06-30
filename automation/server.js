#!/usr/bin/env node

/**
 * @fileoverview server.js
 * Passaggio Automation Pipeline — Main Entry Point.
 *
 * A self-managed developer automation server that bridges:
 * - Telegram Bot (remote control & media ingestion)
 * - VS Code / Cline (live model switching)
 * - AWS Lambda (serverless Remotion rendering)
 * - Local Remotion (local fallback rendering)
 *
 * Hybrid Environment Support:
 *   ENVIRONMENT=local  → Enables chokidar file watcher (local macOS/Drive sync)
 *   ENVIRONMENT=cloud  → Disables file watcher; relies on Telegram .md ingestion
 *                        and optional Google Drive API polling
 *
 * Architecture:
 *   Telegram ──> server.js ──> model_switcher.js (Cline config)
 *                          ──> render_handler.js (Local / Lambda)
 *                          ──> media_ingestion.js (S3 upload)
 *
 * Usage:
 *   cp .env.example .env   # Fill in your tokens
 *   ENVIRONMENT=cloud node server.js
 */

const { Telegraf } = require('telegraf');
const path = require('path');
const fs = require('fs');

// ─── Load Environment ───────────────────────────────────────────────────────
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ─── Hybrid Environment Mode ────────────────────────────────────────────────
const ENVIRONMENT = (process.env.ENVIRONMENT || 'cloud').toLowerCase();

// ─── Module Imports ─────────────────────────────────────────────────────────
const { switchModel, getCurrentModel } = require('./model_switcher');
const { renderLocal, renderLambda, checkRenderStatus } = require('./render_handler');
const { ingestMedia, cleanupMedia } = require('./media_ingestion');

// chokidar is only loaded when running in local mode
let chokidar = null;
if (ENVIRONMENT === 'local') {
  try {
    chokidar = require('chokidar');
  } catch (err) {
    console.warn('[WATCHER] chokidar not available, file watching disabled');
  }
}

// ─── Configuration & Zero Trust ─────────────────────────────────────────────

const ALLOWED_USER_ID = parseInt(process.env.ALLOWED_USER_ID || '7916710756', 10);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('[FATAL] TELEGRAM_TOKEN is not set in .env');
  process.exit(1);
}

// ─── Bot Initialization ─────────────────────────────────────────────────────

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// ─── Global Middleware: Zero Trust Gate ────────────────────────────────────

bot.use((ctx, next) => {
  const userId = ctx.from?.id;

  if (!userId || userId !== ALLOWED_USER_ID) {
    console.warn(`[SECURITY] Blocked unauthorized access from user ID: ${userId || 'unknown'} at ${new Date().toISOString()}`);
    return; // Deny silently
  }

  return next();
});

// ─── Command: /start ─────────────────────────────────────────────────────────

bot.start((ctx) => {
  ctx.reply(
    '🛡️  **Passaggio Automation Pipeline Online**\n' +
    `Environment: \`${ENVIRONMENT}\`\n\n` +
    '**Commands:**\n' +
    '/render — Local Remotion render\n' +
    '/lambda — AWS Lambda Remotion render\n' +
    '/status <renderId> — Check Lambda render status\n' +
    '/model premium — Switch Cline to premium model (Sonnet)\n' +
    '/model cheap — Switch Cline to cheap model (Haiku)\n' +
    '/model — Show current Cline model\n' +
    '/help — Show this message\n\n' +
    '**Media:** Send a photo, video, or document to ingest it.\n' +
    '**Scripts:** Send a `.md` document or paste markdown to process it.',
    { parse_mode: 'Markdown' }
  );
});

// ─── Command: /help ─────────────────────────────────────────────────────────

bot.help((ctx) => {
  ctx.reply(
    '📖 **Passaggio Automation Pipeline Help**\n\n' +
    '**Render Commands:**\n' +
    '`/render` — Run a local Remotion render (uses props.json)\n' +
    '`/lambda` — Deploy & render via AWS Lambda (requires AWS config)\n' +
    '`/status <renderId>` — Check progress of a Lambda render\n\n' +
    '**Model Switching:**\n' +
    '`/model premium` — Switch Cline to Claude Sonnet (powerful, expensive)\n' +
    '`/model cheap` — Switch Cline to Claude Haiku (fast, cheap)\n' +
    '`/model` — Show currently active model\n\n' +
    '**Media Ingestion:**\n' +
    'Send a photo, video, document, or audio file — it will be downloaded\n' +
    'locally and uploaded to S3 (if configured).\n\n' +
    '**Script Ingestion (Cloud Mode):**\n' +
    'Send a `.md` document or paste markdown to save, validate, and log it.\n\n' +
    '**Architecture:**\n' +
    'Telegram ↔ server.js ↔ model_switcher.js | render_handler.js | media_ingestion.js',
    { parse_mode: 'Markdown' }
  );
});

// ─── Command: /model ─────────────────────────────────────────────────────────

bot.command('model', (ctx) => {
  const args = ctx.message.text.split(/\s+/);
  const tier = args[1]; // 'premium', 'cheap', or undefined

  if (!tier) {
    // Just show current model
    const status = getCurrentModel();
    ctx.reply(status, { parse_mode: 'Markdown' });
    return;
  }

  if (tier !== 'premium' && tier !== 'cheap') {
    ctx.reply('❌ Invalid model tier. Use `premium` or `cheap`.', { parse_mode: 'Markdown' });
    return;
  }

  const result = switchModel(tier);
  ctx.reply(result, { parse_mode: 'Markdown' });
});

// ─── Command: /render (Local) ────────────────────────────────────────────────

bot.command('render', async (ctx) => {
  ctx.reply('🎬 **Starting local Remotion render...**', { parse_mode: 'Markdown' });

  try {
    const result = await renderLocal();

    if (result.success) {
      let reply = '✅ **Local render complete!**\n';
      if (result.outputFile) {
        reply += `📁 Output: \`${result.outputFile}\``;
      }
      ctx.reply(reply, { parse_mode: 'Markdown' });
    } else {
      ctx.reply(`❌ **Render failed:**\n\`\`\`\n${result.error}\n\`\`\``, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    ctx.reply(`❌ **Render error:** ${err.message}`, { parse_mode: 'Markdown' });
  }
});

// ─── Command: /lambda (AWS Lambda Render) ────────────────────────────────────

bot.command('lambda', async (ctx) => {
  ctx.reply('☁️ **Starting AWS Lambda Remotion render...**\nThis may take a few minutes.', { parse_mode: 'Markdown' });

  try {
    const result = await renderLambda();

    if (result.success) {
      ctx.reply(result.message, { parse_mode: 'Markdown' });
    } else {
      ctx.reply(`❌ **Lambda render failed:**\n\`\`\`\n${result.error}\n\`\`\``, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    ctx.reply(`❌ **Lambda error:** ${err.message}`, { parse_mode: 'Markdown' });
  }
});

// ─── Command: /status (Check Lambda Render) ─────────────────────────────────

bot.command('status', async (ctx) => {
  const args = ctx.message.text.split(/\s+/);
  const renderId = args[1];
  const bucketName = args[2]; // optional

  if (!renderId) {
    ctx.reply('❌ Usage: `/status <renderId> [bucketName]`', { parse_mode: 'Markdown' });
    return;
  }

  ctx.reply(`🔍 Checking status of render \`${renderId}\`...`, { parse_mode: 'Markdown' });

  try {
    const result = await checkRenderStatus(renderId, bucketName);

    if (result.success) {
      if (result.done) {
        ctx.reply(
          `✅ **Render complete!**\n📥 Download: ${result.outputUrl}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        ctx.reply(
          `⏳ **Render in progress...**\nProgress: ${result.progress}%`,
          { parse_mode: 'Markdown' }
        );
      }
    } else {
      ctx.reply(`❌ **Status check failed:**\n\`\`\`\n${result.error}\n\`\`\``, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    ctx.reply(`❌ **Status error:** ${err.message}`, { parse_mode: 'Markdown' });
  }
});

// ─── Media Ingestion Handler ─────────────────────────────────────────────────

bot.on(['photo', 'video', 'document', 'audio', 'voice', 'animation'], async (ctx) => {
  ctx.reply('📥 **Ingesting media...**', { parse_mode: 'Markdown' });

  try {
    const media = await ingestMedia(bot, ctx);

    if (!media) {
      ctx.reply('⚠️ Could not process media. Unsupported format or download failed.');
      return;
    }

    let reply = `✅ **Media ingested!**\n`;
    reply += `📁 Type: \`${media.type}\`\n`;
    reply += `📄 File: \`${media.fileName}\`\n`;
    reply += `📏 Size: ${(media.fileSize / 1024).toFixed(1)} KB\n`;

    if (media.s3Url) {
      reply += `☁️ S3 URL: ${media.s3Url}\n`;
      reply += `\n💡 Use this URL in your Remotion props as an image/video source.`;
    } else {
      reply += `\n⚠️ S3 upload not configured. File saved locally at:\n\`${media.localPath}\``;
    }

    ctx.reply(reply, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error(`[MEDIA] Ingestion error: ${err.message}`);
    ctx.reply(`❌ **Media ingestion failed:** ${err.message}`, { parse_mode: 'Markdown' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SCRIPT INGESTION ENGINE (Cloud Mode)
// Processes .md scripts sent via Telegram to the same pipeline as the
// local file watcher — validates, saves, and logs to processed_scripts.json.
// ═══════════════════════════════════════════════════════════════════════════

const STATE_FILE = path.join(__dirname, 'processed_scripts.json');
const SCRIPTS_DIR = path.join(__dirname, 'scripts');

/**
 * Load persisted processed-file state from disk.
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error(`[SCRIPTS] Failed to load state: ${err.message}`);
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
    console.error(`[SCRIPTS] Failed to save state: ${err.message}`);
  }
}

/**
 * Validate a .md script content.
 * Returns an object with { valid, warnings }.
 */
function validateScript(content, fileName) {
  const warnings = [];

  if (!content || content.trim().length === 0) {
    return { valid: false, warnings: ['Script content is empty.'] };
  }

  // Check for basic markdown structure
  const lines = content.split('\n');

  // Check for frontmatter (optional but recommended)
  if (lines[0] && lines[0].trim() === '---') {
    const endIndex = lines.slice(1).findIndex(l => l.trim() === '---');
    if (endIndex === -1) {
      warnings.push('Frontmatter opening `---` found but no closing `---` detected.');
    }
  }

  // Check for at least some content beyond frontmatter
  const contentLines = lines.filter(l => l.trim() && !l.trim().startsWith('---'));
  if (contentLines.length < 2) {
    warnings.push('Script has minimal content (less than 2 non-frontmatter lines).');
  }

  return { valid: true, warnings };
}

/**
 * Save an ingested script to the scripts/ directory and log it in
 * processed_scripts.json — exactly as the file watcher does for local files.
 *
 * @param {string} content - The full text content of the script
 * @param {string} fileName - A unique file name for the script
 * @param {object} ctx - Telegraf context (for sending confirmation messages)
 */
async function ingestScript(content, fileName, ctx) {
  const state = loadState();
  const relativePath = `scripts/${fileName}`;

  // Deduplicate: check if we've already processed this exact content hash
  const contentHash = simpleHash(content);
  if (state.processed.some(entry => {
    // Support both old string format and new object format
    if (typeof entry === 'string') return entry === relativePath;
    return entry.path === relativePath || entry.hash === contentHash;
  })) {
    console.log(`[SCRIPTS] Skipping already processed script: ${relativePath}`);
    if (ctx) {
      ctx.reply('⚠️ This script has already been processed (duplicate detected).', { parse_mode: 'Markdown' });
    }
    return;
  }

  // Validate the script
  const validation = validateScript(content, fileName);
  if (!validation.valid) {
    console.warn(`[SCRIPTS] Validation failed for ${relativePath}: ${validation.warnings.join(', ')}`);
    if (ctx) {
      ctx.reply(`⚠️ **Script validation failed:**\n${validation.warnings.map(w => `- ${w}`).join('\n')}`, { parse_mode: 'Markdown' });
    }
    return;
  }

  // Ensure scripts directory exists
  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  }

  // Save the script to disk
  const savePath = path.join(SCRIPTS_DIR, fileName);
  try {
    fs.writeFileSync(savePath, content, 'utf8');
    console.log(`[SCRIPTS] Saved script to ${savePath}`);
  } catch (err) {
    console.error(`[SCRIPTS] Failed to save script ${fileName}: ${err.message}`);
    if (ctx) {
      ctx.reply('❌ Failed to save script to disk. Check server permissions.', { parse_mode: 'Markdown' });
    }
    return;
  }

  // Log in processed_scripts.json (object format for richer tracking)
  const entry = {
    path: relativePath,
    fileName: fileName,
    hash: contentHash,
    ingestedAt: new Date().toISOString(),
    source: 'telegram',
    warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
  };
  state.processed.push(entry);
  saveState(state);

  // Notify via Telegram
  let reply = `✅ **Script ingested!**\n`;
  reply += `📄 File: \`${fileName}\`\n`;
  reply += `📏 Size: ${(content.length / 1024).toFixed(1)} KB\n`;
  reply += `🔢 Lines: ${content.split('\n').length}\n`;

  if (validation.warnings.length > 0) {
    reply += `\n⚠️ **Warnings:**\n${validation.warnings.map(w => `- ${w}`).join('\n')}\n`;
  }

  if (ctx) {
    ctx.reply(reply, { parse_mode: 'Markdown' });
  }

  console.log(`[SCRIPTS] Successfully ingested ${relativePath}`);
}

/**
 * Simple string hash for deduplication.
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// ─── Text Handler: Blueprint JSON + .md Script Ingestion ─────────────────

bot.on('text', (ctx) => {
  const text = ctx.message.text;

  // Skip commands
  if (text.startsWith('/')) return;

  // ── Check for .md code block or markdown content ──
  // Detect if this looks like a markdown script (starts with #, ---, or has markdown structure)
  const isMarkdown = (
    text.trim().startsWith('---') ||       // Frontmatter
    /^#[#\s]/.test(text.trim()) ||         // Headings (# ## ### etc.)
    (text.includes('\n') && (              // Multi-line with markdown patterns
      text.includes('**') ||
      /\[.*\]\(.*\)/.test(text) ||
      text.includes('- ') ||
      text.includes('1. ')
    ))
  );

  if (isMarkdown && ENVIRONMENT === 'cloud') {
    // Process as a markdown script (cloud mode ingestion)
    const timestamp = Date.now();
    const safePrefix = text.trim().substring(0, 40).replace(/[^a-zA-Z0-9_ -]/g, '').trim().replace(/\s+/g, '_');
    const fileName = `telegram_${timestamp}_${safePrefix || 'script'}.md`;

    ingestScript(text, fileName, ctx).catch(err => {
      console.error(`[SCRIPTS] Error ingesting markdown: ${err.message}`);
      ctx.reply('❌ Error processing markdown script.', { parse_mode: 'Markdown' }).catch(() => {});
    });
    return;
  }

  // ── Check if it looks like JSON (Blueprint) ──
  let rawJson = text;
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    rawJson = codeBlockMatch[1];
  }

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    // Not JSON and not detected as markdown — ignore
    return;
  }

  if (!parsed || typeof parsed !== 'object') {
    ctx.reply('⚠️ Invalid JSON structure. Must be a valid object.');
    return;
  }

  // Write to blueprint
  const blueprintPath = path.resolve(__dirname, process.env.BLUEPRINT_PATH || '../remotion/props.json');
  try {
    const dir = path.dirname(blueprintPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(blueprintPath, JSON.stringify(parsed, null, 2), 'utf8');
    ctx.reply('📋 **Video blueprint updated successfully.**\nUse `/render` or `/lambda` to compile.', { parse_mode: 'Markdown' });
    console.log(`[BLUEPRINT] Updated ${blueprintPath} at ${new Date().toISOString()}`);
  } catch (writeErr) {
    console.error(`[BLUEPRINT] Write error: ${writeErr.message}`);
    ctx.reply('❌ Failed to save blueprint. Check server permissions.');
  }
});

// ─── Document Handler: Process .md files sent as documents ────────────────

bot.on('document', async (ctx) => {
  const doc = ctx.message.document;
  if (!doc) return;

  const fileName = doc.file_name || '';
  const isMarkdownFile = fileName.endsWith('.md') || fileName.endsWith('.markdown');

  if (isMarkdownFile && ENVIRONMENT === 'cloud') {
    ctx.reply('📄 **Processing markdown script...**', { parse_mode: 'Markdown' });

    try {
      // Download the .md file content via Telegram
      const link = await bot.telegram.getFileLink(doc.file_id);
      const content = await fetchUrlContent(link.href);

      // Use original file name, prefixed with timestamp to avoid collisions
      const safeName = `${Date.now()}_${fileName}`;
      await ingestScript(content, safeName, ctx);
    } catch (err) {
      console.error(`[SCRIPTS] Error processing .md document: ${err.message}`);
      ctx.reply('❌ Failed to process the markdown document.', { parse_mode: 'Markdown' });
    }
    return; // Don't fall through to media ingestion for .md files
  }

  // For non-.md documents, fall through to the media ingestion handler
  // (the media handler is registered below this, but since document is handled here,
  //  we need to re-trigger for non-.md files — actually the bot.on(['photo', 'video', ...])
  //  handler catches documents too, so non-.md documents will be handled there)
  // For .md files, we've already returned above. For non-.md files, we do nothing here
  // and the media ingestion handler (registered on ['photo', 'video', 'document', ...])
  // will catch them. Since there are two document handlers, the second one (media ingestion)
  // will fire for non-.md documents.
  // For .md files, we return early to avoid double-processing.
});

/**
 * Fetch content from a URL and return as text.
 */
function fetchUrlContent(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE DRIVE FILE WATCHER (Local Mode Only)
// Monitors the `Email reports/` folder for newly synced .md files from
// Google Drive and forwards them to Telegram.
// ═══════════════════════════════════════════════════════════════════════════

let WATCH_FOLDER = null;
if (ENVIRONMENT === 'local') {
  WATCH_FOLDER = path.resolve(__dirname, '..', 'Email reports');

  /**
   * Recursively find all .md files in a directory.
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
   * Process a single .md file: read, send via Telegram, record state.
   */
  async function processFile(filePath) {
    const state = loadState();
    const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);

    // Check both string and object formats for backward compatibility
    const alreadyProcessed = state.processed.some(entry => {
      if (typeof entry === 'string') return entry === relativePath;
      return entry.path === relativePath;
    });

    if (alreadyProcessed) {
      console.log(`[WATCHER] Skipping already processed file: ${relativePath}`);
      return;
    }

    // Brief delay to ensure file is fully synced from Google Drive
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

    // Send to Telegram via the bot
    try {
      await bot.telegram.sendMessage(
        ALLOWED_USER_ID,
        `📄 *New Script: ${relativePath}*\n\n${content}`,
        { parse_mode: 'Markdown' }
      );
      console.log(`[WATCHER] Sent ${relativePath} to Telegram`);
    } catch (telegramErr) {
      // Fallback to plain text if Markdown parsing fails
      console.warn(`[WATCHER] Markdown send failed, falling back to plain text: ${telegramErr.message}`);
      try {
        await bot.telegram.sendMessage(
          ALLOWED_USER_ID,
          `📄 New Script: ${relativePath}\n\n${content}`
        );
        console.log(`[WATCHER] Sent ${relativePath} to Telegram (plain text fallback)`);
      } catch (fatalErr) {
        console.error(`[WATCHER] Telegram send failed completely: ${fatalErr.message}`);
        return;
      }
    }

    // Mark as processed (object format for consistency)
    const hash = simpleHash(content);
    state.processed.push({
      path: relativePath,
      fileName: path.basename(filePath),
      hash: hash,
      ingestedAt: new Date().toISOString(),
      source: 'file_watcher',
    });
    saveState(state);
  }

  /**
   * Initial startup scan to catch up on files that arrived while server was offline.
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
}

// ─── Error Handling ──────────────────────────────────────────────────────────

bot.catch((err, ctx) => {
  console.error(`[BOT ERROR] ${err.message}`, err);
  ctx.reply('⚠️ An unexpected error occurred. Check server logs.').catch(() => {});
});

// ─── Launch ──────────────────────────────────────────────────────────────────

bot.launch()
  .then(() => {
    console.log('══════════════════════════════════════════════════');
    console.log('  🚀 Passaggio Automation Pipeline');
    console.log('══════════════════════════════════════════════════');
    console.log(`  Environment: ${ENVIRONMENT}`);
    console.log(`  Bot:        Active (Zero Trust: ${ALLOWED_USER_ID})`);
    console.log(`  Model:      ${getCurrentModel()}`);
    console.log(`  Render:     Local + Lambda (if AWS configured)`);
    console.log(`  Media:      Local + S3 (if AWS configured)`);
    console.log('══════════════════════════════════════════════════');

    if (ENVIRONMENT === 'local') {
      // ─── Start Google Drive File Watcher (Local Mode Only) ──────────────
      if (!fs.existsSync(WATCH_FOLDER)) {
        console.warn(`[WATCHER] Watch folder does not exist, creating: ${WATCH_FOLDER}`);
        fs.mkdirSync(WATCH_FOLDER, { recursive: true });
      }

      console.log(`[WATCHER] Monitoring for new .md files in: ${WATCH_FOLDER}`);

      const watcher = chokidar.watch(WATCH_FOLDER, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
        depth: 10,
      });

      watcher.on('add', async (filePath) => {
        if (!filePath.endsWith('.md')) return;
        console.log(`[WATCHER] New file detected: ${path.basename(filePath)}`);
        try {
          await processFile(filePath);
        } catch (err) {
          console.error(`[WATCHER] Error processing file: ${err.message}`);
        }
      });

      watcher.on('change', async (filePath) => {
        if (!filePath.endsWith('.md')) return;
        console.log(`[WATCHER] File modified: ${path.basename(filePath)}`);
        try {
          await processFile(filePath);
        } catch (err) {
          console.error(`[WATCHER] Error processing changed file: ${err.message}`);
        }
      });

      console.log('[WATCHER] File watcher activated (chokidar)');

      // Run the initial catch-up scan
      startupScan().catch(err => {
        console.error(`[WATCHER] Startup scan error: ${err.message}`);
      });

      // Clean up watcher on shutdown
      const shutdown = () => {
        console.log('[SERVER] Closing file watcher...');
        watcher.close();
        bot.stop('SIGINT');
        process.exit(0);
      };

      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);

    } else {
      // ─── Cloud Mode ─────────────────────────────────────────────────────
      console.log('[CLOUD] Running in cloud mode — file watcher disabled.');
      console.log('[CLOUD] .md script ingestion via Telegram is active.');
      console.log('[CLOUD] Scripts are saved to: scripts/');
      console.log('[CLOUD] Processed scripts tracked in: processed_scripts.json');

      // Graceful shutdown (no watcher to close)
      const shutdown = () => {
        console.log('[SERVER] Shutting down...');
        bot.stop('SIGINT');
        process.exit(0);
      };

      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    }
  })
  .catch((err) => {
    console.error('[FATAL] Failed to launch bot:', err.message);
    process.exit(1);
  });

// Export for testing and external integrations
module.exports = {
  bot,
  ingestScript,
  loadState,
  saveState,
  validateScript,
  ENVIRONMENT,
};