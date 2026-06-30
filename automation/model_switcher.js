/**
 * @fileoverview model_switcher.js
 * Live model switching for Cline (VS Code extension).
 * Dynamically updates the Continue/Cline configuration to switch between
 * premium (Claude Sonnet) and cheap (Claude Haiku) models based on
 * task complexity. Controlled via Telegram commands.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ─── Configuration ──────────────────────────────────────────────────────────

const CLINE_CONFIG_PATH =
  process.env.CLINE_CONFIG_PATH ||
  path.join(process.env.HOME || '/Users/sherleybelleus', '.continue', 'config.json');

const MODELS = {
  premium: process.env.CLINE_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
  cheap: process.env.CLINE_CHEAP_MODEL || 'claude-3-haiku-20240307',
};

// ─── State ──────────────────────────────────────────────────────────────────
// Track the last model from outside to avoid redundant writes
let currentModel = null;

/**
 * Read the current Cline/Continue configuration file.
 * @returns {object|null} Parsed config object, or null on error
 */
function readConfig() {
  try {
    if (!fs.existsSync(CLINE_CONFIG_PATH)) {
      console.warn(`[MODEL] Config file not found: ${CLINE_CONFIG_PATH}`);
      return null;
    }
    return JSON.parse(fs.readFileSync(CLINE_CONFIG_PATH, 'utf8'));
  } catch (err) {
    console.error(`[MODEL] Failed to read config: ${err.message}`);
    return null;
  }
}

/**
 * Write the updated Cline/Continue configuration file.
 * Creates parent directories if needed and writes atomically.
 * @param {object} config — The full config object to persist
 * @returns {boolean} true on success, false on failure
 */
function writeConfig(config) {
  try {
    const dir = path.dirname(CLINE_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CLINE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`[MODEL] Failed to write config: ${err.message}`);
    return false;
  }
}

/**
 * Switch the active model in the Cline/Continue configuration.
 * Updates the `models` array to set the requested model as the default.
 *
 * @param {'premium'|'cheap'} tier — The model tier to activate
 * @returns {string} Status message describing the result
 */
function switchModel(tier) {
  const modelId = MODELS[tier];
  if (!modelId) {
    return `❌ Unknown model tier: "${tier}". Use "premium" or "cheap".`;
  }

  const config = readConfig();
  if (!config) {
    return '❌ Could not read Cline config. Ensure CLINE_CONFIG_PATH is correct.';
  }

  // Ensure models array exists
  if (!config.models) {
    config.models = [];
  }

  // Check if the model already has a `title` or `name` field
  const existingIndex = config.models.findIndex(
    (m) => m.model === modelId || m.name === modelId
  );

  if (existingIndex === -1) {
    // Add the model to the list
    config.models.push({
      title: `Claude ${tier === 'premium' ? 'Sonnet' : 'Haiku'} (Automated)`,
      provider: 'anthropic',
      model: modelId,
    });
  }

  // Set as the default model by adding/updating the `model` top-level key
  // Cline uses `model` in the root to specify the default
  config.model = modelId;

  // Also try setting as the first entry in `models` array for fallback
  // Move this model to the front of the array
  if (existingIndex > 0) {
    const item = config.models.splice(existingIndex, 1)[0];
    config.models.unshift(item);
  }

  if (!writeConfig(config)) {
    return '❌ Failed to write config file. Check permissions.';
  }

  currentModel = modelId;
  console.log(`[MODEL] Switched to ${tier}: ${modelId}`);
  return `✅ Switched to **${tier}** model: \`${modelId}\``;
}

/**
 * Get the current active model info.
 * @returns {string} Human-readable status
 */
function getCurrentModel() {
  const config = readConfig();
  if (!config) return '❌ Cannot read Cline config.';

  const active = config.model || config.models?.[0]?.model || 'unknown';
  const tier = active === MODELS.premium ? 'premium' : active === MODELS.cheap ? 'cheap' : 'custom';
  return `🤖 Current model: \`${active}\` (${tier})`;
}

module.exports = { switchModel, getCurrentModel };