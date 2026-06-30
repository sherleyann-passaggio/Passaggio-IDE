/**
 * @fileoverview media_ingestion.js
 * Telegram media ingestion pipeline.
 * Downloads media attachments (images, audio, video) from Telegram,
 * saves them locally, uploads to S3, and provides URLs back for
 * use in Remotion rendering.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

require('dotenv').config({ path: path.join(__dirname, '.env') });

// ─── Configuration ──────────────────────────────────────────────────────────

const MEDIA_DIR = path.resolve(__dirname, process.env.MEDIA_DIR || './public/images');
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || 'passaggio-remotion-renders';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// ─── AWS S3 Upload ──────────────────────────────────────────────────────────

let AWS;
try {
  AWS = require('aws-sdk');
} catch (err) {
  console.warn('[MEDIA] aws-sdk not available, S3 uploads disabled');
}

/**
 * Initialize S3 client with credentials from environment.
 * @returns {AWS.S3|null}
 */
function getS3Client() {
  if (!AWS) return null;
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn('[MEDIA] AWS credentials not set');
    return null;
  }
  return new AWS.S3({
    region: AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
}

/**
 * Upload a file to S3 and return a public URL.
 * @param {string} filePath — Absolute path to the local file
 * @param {string} s3Key — Key/path in the S3 bucket
 * @returns {Promise<string|null>} Public URL or null on failure
 */
async function uploadToS3(filePath, s3Key) {
  const s3 = getS3Client();
  if (!s3) return null;

  try {
    const fileContent = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Determine content type
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.mov': 'video/quicktime',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    await s3
      .putObject({
        Bucket: AWS_S3_BUCKET,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
        ACL: 'public-read',
      })
      .promise();

    const publicUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log(`[MEDIA] Uploaded to S3: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error(`[MEDIA] S3 upload failed: ${err.message}`);
    return null;
  }
}

// ─── File Download ──────────────────────────────────────────────────────────

/**
 * Download a file from Telegram (via file link) to local storage.
 *
 * @param {import('telegraf').Telegraf} bot — The Telegraf bot instance
 * @param {string} fileId — Telegram file_id
 * @param {string} [fileExt] — Desired file extension (e.g., '.jpg', '.mp4')
 * @returns {Promise<{filePath: string, fileName: string}|null>} Local file info
 */
async function downloadTelegramFile(bot, fileId, fileExt = null) {
  try {
    // Get file link from Telegram API
    const link = await bot.telegram.getFileLink(fileId);
    console.log(`[MEDIA] Downloading: ${link.href}`);

    // Determine extension and filename
    const urlPath = new URL(link.href).pathname;
    const baseName = path.basename(urlPath);
    const ext = fileExt || path.extname(baseName) || '.bin';
    const fileName = `${Date.now()}-${baseName}`;

    // Ensure media directory exists
    if (!fs.existsSync(MEDIA_DIR)) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true });
    }

    const filePath = path.join(MEDIA_DIR, fileName);

    // Download the file
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      https.get(link.href, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlinkSync(filePath); // Clean up partial file
        reject(err);
      });
    });

    const stats = fs.statSync(filePath);
    console.log(`[MEDIA] Saved: ${filePath} (${(stats.size / 1024).toFixed(1)} KB)`);

    return { filePath, fileName };
  } catch (err) {
    console.error(`[MEDIA] Download failed: ${err.message}`);
    return null;
  }
}

// ─── Media Processing ───────────────────────────────────────────────────────

/**
 * Process a Telegram media message: download, optionally upload to S3,
 * and return metadata.
 *
 * @param {import('telegraf').Telegraf} bot — Telegraf bot instance
 * @param {object} ctx — Telegraf context (the message context)
 * @returns {Promise<object|null>} Media metadata
 */
async function ingestMedia(bot, ctx) {
  const msg = ctx.message;
  if (!msg) return null;

  // Determine media type and file_id
  let fileId = null;
  let mediaType = null;
  let fileExt = null;

  // Photo — Telegram sends multiple sizes, pick the largest
  if (msg.photo && msg.photo.length > 0) {
    const largest = msg.photo.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b));
    fileId = largest.file_id;
    mediaType = 'photo';
    fileExt = '.jpg';
  }
  // Video
  else if (msg.video) {
    fileId = msg.video.file_id;
    mediaType = 'video';
    fileExt = `.${(msg.video.file_name || 'video.mp4').split('.').pop() || 'mp4'}`;
  }
  // Document
  else if (msg.document) {
    fileId = msg.document.file_id;
    mediaType = 'document';
    const originalName = msg.document.file_name || 'document.bin';
    fileExt = path.extname(originalName) || '.bin';
  }
  // Audio
  else if (msg.audio) {
    fileId = msg.audio.file_id;
    mediaType = 'audio';
    fileExt = `.${(msg.audio.file_name || 'audio.mp3').split('.').pop() || 'mp3'}`;
  }
  // Voice
  else if (msg.voice) {
    fileId = msg.voice.file_id;
    mediaType = 'voice';
    fileExt = '.ogg';
  }
  // Animation (GIF)
  else if (msg.animation) {
    fileId = msg.animation.file_id;
    mediaType = 'animation';
    fileExt = '.mp4';
  }

  if (!fileId) return null;

  // Download the file
  const localFile = await downloadTelegramFile(bot, fileId, fileExt);
  if (!localFile) return null;

  // Build metadata response
  const result = {
    type: mediaType,
    localPath: localFile.filePath,
    fileName: localFile.fileName,
    fileSize: fs.statSync(localFile.filePath).size,
  };

  // Try S3 upload (non-blocking — don't fail if S3 is unavailable)
  try {
    const s3Key = `media/${localFile.fileName}`;
    const s3Url = await uploadToS3(localFile.filePath, s3Key);
    if (s3Url) {
      result.s3Url = s3Url;
    }
  } catch (err) {
    console.warn(`[MEDIA] S3 upload skipped: ${err.message}`);
  }

  return result;
}

/**
 * Delete a locally stored media file.
 * @param {string} filePath — Absolute path to the file
 */
function cleanupMedia(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[MEDIA] Cleaned up: ${filePath}`);
    }
  } catch (err) {
    console.warn(`[MEDIA] Cleanup failed: ${err.message}`);
  }
}

module.exports = { ingestMedia, downloadTelegramFile, cleanupMedia, uploadToS3 };