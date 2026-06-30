/**
 * @fileoverview render_handler.js
 * AWS Lambda Remotion render handler.
 * Bridges the local Remotion project with @remotion/lambda for serverless
 * MP4 rendering. Supports both local and cloud render paths.
 */

const path = require('path');
const { execSync, exec } = require('child_process');
const fs = require('fs');

// Load env vars
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ─── Configuration ──────────────────────────────────────────────────────────

const REMOTION_DIR = path.resolve(__dirname, process.env.REMOTION_DIR || '../remotion');
const BLUEPRINT_PATH = path.resolve(__dirname, process.env.BLUEPRINT_PATH || '../remotion/props.json');

// AWS Lambda configuration (read from env)
const AWS_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  bucketName: process.env.AWS_S3_BUCKET_NAME || 'passaggio-remotion-renders',
  functionName: process.env.REMOTION_FUNCTION_NAME || 'passaggio-remotion-renderer',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

// ─── Local Render ───────────────────────────────────────────────────────────

/**
 * Execute a local Remotion render using `remotion render`.
 * Writes output to remotion/out/ directory.
 *
 * @param {object} [overrides] — Optional prop overrides to merge into props.json
 * @returns {Promise<object>} Result with success status and output path or error
 */
function renderLocal(overrides = {}) {
  return new Promise((resolve, reject) => {
    // Apply prop overrides if provided
    if (Object.keys(overrides).length > 0) {
      try {
        const existingProps = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf8'));
        const merged = { ...existingProps, ...overrides };
        fs.writeFileSync(BLUEPRINT_PATH, JSON.stringify(merged, null, 2), 'utf8');
        console.log(`[RENDER] Merged ${Object.keys(overrides).length} prop overrides into ${BLUEPRINT_PATH}`);
      } catch (err) {
        console.warn(`[RENDER] Could not merge overrides: ${err.message}`);
      }
    }

    // Ensure we have the right CWD
    if (!fs.existsSync(path.join(REMOTION_DIR, 'package.json'))) {
      return reject(new Error(`Remotion project not found at ${REMOTION_DIR}`));
    }

    const cmd = 'npm run render';
    console.log(`[RENDER] Starting local render: ${cmd} in ${REMOTION_DIR}`);

    const child = exec(cmd, { cwd: REMOTION_DIR, timeout: 600000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[RENDER] Local render failed: ${error.message}`);
        resolve({ success: false, error: error.message, stdout, stderr });
        return;
      }
      console.log(`[RENDER] Local render completed`);
      if (stderr) console.warn(`[RENDER] stderr: ${stderr}`);

      // Find the most recent .mp4 in the remotion output
      const outDir = path.join(REMOTION_DIR, 'out');
      let outputFile = null;
      if (fs.existsSync(outDir)) {
        const files = fs.readdirSync(outDir).filter(f => f.endsWith('.mp4'));
        if (files.length > 0) {
          // Sort by modification time descending
          files.sort((a, b) => {
            return fs.statSync(path.join(outDir, b)).mtimeMs -
                   fs.statSync(path.join(outDir, a)).mtimeMs;
          });
          outputFile = path.join(outDir, files[0]);
        }
      }

      resolve({
        success: true,
        outputFile,
        stdout,
        stderr,
      });
    });
  });
}

// ─── AWS Lambda Render (Remotion Lambda) ────────────────────────────────────

/**
 * Render a video via @remotion/lambda on AWS.
 * Requires AWS credentials to be set in environment variables.
 *
 * Steps:
 * 1. Deploy the Remotion function if not already deployed
 * 2. Bundle the Remotion project
 * 3. Call `renderMediaOnLambda` to start the render
 * 4. Poll or return the render ID for async retrieval
 *
 * @param {object} [overrides] — Optional prop overrides
 * @returns {Promise<object>} Result with render details
 */
async function renderLambda(overrides = {}) {
  // Dynamic import — @remotion/lambda is heavy and only needed for cloud renders
  let RemotionLambda;
  try {
    RemotionLambda = require('@remotion/lambda');
  } catch (err) {
    return { success: false, error: '@remotion/lambda is not installed. Run: npm install @remotion/lambda' };
  }

  if (!AWS_CONFIG.accessKeyId || !AWS_CONFIG.secretAccessKey) {
    return { success: false, error: 'AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env' };
  }

  // Set AWS credentials for this process
  process.env.AWS_ACCESS_KEY_ID = AWS_CONFIG.accessKeyId;
  process.env.AWS_SECRET_ACCESS_KEY = AWS_CONFIG.secretAccessKey;
  process.env.AWS_REGION = AWS_CONFIG.region;

  try {
    // Apply prop overrides
    let inputProps = {};
    if (fs.existsSync(BLUEPRINT_PATH)) {
      inputProps = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf8'));
    }
    if (Object.keys(overrides).length > 0) {
      inputProps = { ...inputProps, ...overrides };
    }

    console.log(`[RENDER-LAMBDA] Deploying function: ${AWS_CONFIG.functionName}...`);

    // Deploy the function (idempotent — skips if already deployed)
    const { functionName, alreadyExisted } = await RemotionLambda.deployFunction({
      region: AWS_CONFIG.region,
      createCloudWatchLogGroup: true,
      timeoutInSeconds: 240,
    });
    console.log(`[RENDER-LAMBDA] Function "${functionName}" ${alreadyExisted ? 'already existed' : 'deployed'}`);

    // Deploy the site/bundle
    console.log(`[RENDER-LAMBDA] Deploying site bundle...`);
    const { serveUrl } = await RemotionLambda.deploySite({
      region: AWS_CONFIG.region,
      siteName: 'passaggio-remotion-site',
      entryPoint: path.join(REMOTION_DIR, 'src', 'index.ts'),
      bucketName: AWS_CONFIG.bucketName,
    });
    console.log(`[RENDER-LAMBDA] Site deployed to: ${serveUrl}`);

    // Start the render
    console.log(`[RENDER-LAMBDA] Starting render...`);
    const renderResponse = await RemotionLambda.renderMediaOnLambda({
      region: AWS_CONFIG.region,
      functionName,
      serveUrl,
      composition: 'PremiumShortComposition',
      inputProps,
      codec: 'h264',
      imageFormat: 'jpeg',
      maxRetries: 1,
      privacy: 'public',
      framesPerLambda: 30,
    });

    console.log(`[RENDER-LAMBDA] Render started. Render ID: ${renderResponse.renderId}`);
    console.log(`[RENDER-LAMBDA] Bucket: ${renderResponse.bucketName}`);

    return {
      success: true,
      renderId: renderResponse.renderId,
      bucketName: renderResponse.bucketName,
      folderName: renderResponse.folderName,
      functionName,
      serveUrl,
      type: 'lambda',
      message: `🎬 Lambda render started!\nRender ID: \`${renderResponse.renderId}\`\nBucket: \`${renderResponse.bucketName}\``,
    };
  } catch (err) {
    console.error(`[RENDER-LAMBDA] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── Render Status Check ────────────────────────────────────────────────────

/**
 * Check the status of an in-progress or completed Lambda render.
 *
 * @param {string} renderId — The render ID from renderLambda()
 * @param {string} bucketName — The S3 bucket name
 * @returns {Promise<object>} Render status with download URL if complete
 */
async function checkRenderStatus(renderId, bucketName) {
  let RemotionLambda;
  try {
    RemotionLambda = require('@remotion/lambda');
  } catch (err) {
    return { success: false, error: '@remotion/lambda not installed' };
  }

  try {
    const status = await RemotionLambda.getRenderProgress({
      region: AWS_CONFIG.region,
      renderId,
      bucketName: bucketName || AWS_CONFIG.bucketName,
      functionName: AWS_CONFIG.functionName,
    });

    if (status.done) {
      // Construct the output URL
      const outputUrl = `https://${bucketName || AWS_CONFIG.bucketName}.s3.${AWS_CONFIG.region}.amazonaws.com/${renderId}/out.mp4`;
      return {
        success: true,
        done: true,
        outputUrl,
        progress: 100,
        status,
      };
    }

    return {
      success: true,
      done: false,
      progress: Math.round((status.framesRendered || 0) / Math.max(status.totalFrames, 1) * 100),
      status,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { renderLocal, renderLambda, checkRenderStatus };