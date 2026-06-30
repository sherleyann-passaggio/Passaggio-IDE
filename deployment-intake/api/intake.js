// ═════════════════════════════════════════════════════════════════════════════
// /api/intake — Serverless Monetized Intake Funnel
// ═════════════════════════════════════════════════════════════════════════════
// Deploy target: Vercel (api/ directory auto-mapped), Netlify Functions, or
// Cloudflare Workers with minor adapter changes.
//
// Required environment variables:
//   TELEGRAM_TOKEN        — Bot token from @BotFather
//   CHAT_ID               — Your personal Telegram chat ID (from @userinfobot)
//   STRIPE_SECRET_KEY     — Stripe secret key (sk_test_... or sk_live_...)
//   STRIPE_WEBHOOK_SECRET — Stripe webhook endpoint secret (whsec_...)
//   STRIPE_PRICE_FOUNDER  — Stripe Price ID for the $50 Founding application fee
//   STRIPE_PRICE_STANDARD — Stripe Price ID for the $50 standard-tier start fee
//   VAPI_WEBHOOK_SECRET   — Bearer token used to verify Vapi.ai webhook calls
//   RECAPTCHA_SECRET_KEY  — Google reCAPTCHA v2 secret key
//   DATABASE_URL          — Neon Serverless Postgres connection string
//   BLOB_READ_WRITE_TOKEN — Vercel Blob read/write token for client uploads
//
// Endpoints:
//   GET  /api/intake              → scarcity status { spots_remaining, tier, is_full }
//   GET  /api/intake?status=capacity → combined capacity state (24h + founding 5)
//   GET  /api/upload-url?filename=...&contentType=... → Vercel Blob client upload token
//   POST /api/intake?action=intake → public form submission (Neon + Telegram alert)
//   POST /api/intake?action=waitlist → join waitlist (file-based registry)
//   POST /api/intake?action=checkout → create Stripe Checkout session
//   POST /api/intake?action=stripe-webhook → Stripe webhook handler
//   POST /api/intake (Vapi payload) → voice call end-of-call report (Telegram alert)
// ═════════════════════════════════════════════════════════════════════════════

import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import fs from "fs";
import path from "path";
import os from "os";

const FOUNDER_LIMIT = 5;
const STRIPE_TIER_METADATA_KEY = "tier";
const ACTIVE_CLIENT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLIENT_REGISTRY_PATH = process.env.CLIENT_REGISTRY_PATH
  || path.join(os.homedir(), ".passaggio", "active_clients.json");

const WAITLIST_STATE_PATH = path.join(os.homedir(), ".passaggio", "waitlist_state.json");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
});

// ── Neon serverless client (lazy; created per request for edge safety) ──
function getNeonSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  return neon(databaseUrl);
}

export default async function handler(req, res) {
  // ── CORS (allow public form + Vapi) ──────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-vapi-secret");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { pathname } = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && pathname === "/api/upload-url") {
      return await handleUploadUrl(req, res);
    }
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    return res.status(405).json({ error: "Method not allowed. Use GET or POST." });
  } catch (err) {
    console.error("Unhandled /api/intake error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/upload-url — Vercel Blob presigned upload URL for direct browser upload
// ═════════════════════════════════════════════════════════════════════════════
async function handleUploadUrl(req, res) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "BLOB_READ_WRITE_TOKEN is not configured." });
  }

  const url = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
  const filename = (url.searchParams.get("filename") || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
  const contentType = url.searchParams.get("contentType") || "application/octet-stream";

  const pathname = `intake/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;

  try {
    const signedToken = await issueSignedToken({
      token,
      pathname,
      operations: ["put"],
      allowedContentTypes: [contentType],
      maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB per file
    });

    const { presignedUrl } = await presignUrl(signedToken, {
      pathname,
      operation: "put",
    });

    return res.status(200).json({
      success: true,
      presigned_url: presignedUrl,
      pathname,
      filename,
      content_type: contentType,
    });
  } catch (err) {
    console.error("Vercel Blob presigned URL error:", err);
    return res.status(500).json({ error: "Unable to generate upload URL." });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/intake — Combined capacity status
// ═════════════════════════════════════════════════════════════════════════════
async function handleGet(req, res) {
  const { status } = req.query || {};

  if (status === "capacity") {
    return await handleCapacityStatus(req, res);
  }

  return await handleScarcity(req, res);
}

async function handleScarcity(req, res) {
  const { spots_remaining, tier, is_full } = await getFounderScarcity();
  return res.status(200).json({
    spots_remaining,
    tier,
    is_full,
    founder_limit: FOUNDER_LIMIT,
    message: is_full
      ? "The Founding 5 cohort is full. You're being routed to the Scale Tier."
      : `Only ${spots_remaining} of ${FOUNDER_LIMIT} Founding spots remain.`,
  });
}

async function handleCapacityStatus(req, res) {
  const [founderState, waitlistState] = await Promise.all([
    getFounderScarcity(),
    readWaitlistState(),
  ]);

  // Waitlist is only active when explicitly set by Stripe webhook
  const is_at_capacity = waitlistState.active;

  return res.status(200).json({
    is_at_capacity,
    mode: is_at_capacity ? "waitlist" : "intake",
    boutique: boutiqueState,
    founding: {
      is_full: founderState.is_full,
      spots_remaining: founderState.spots_remaining,
      founder_limit: FOUNDER_LIMIT,
      tier: founderState.tier,
    },
    message: is_at_capacity
      ? "Current Status: One-on-One Boutique Service. I only onboard one new client per 24-hour cycle to ensure artisanal quality and zero-bug performance."
      : "Accepting new intakes now.",
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/intake — Route by ?action= or detect Vapi/Stripe payloads
// ═════════════════════════════════════════════════════════════════════════════
async function handlePost(req, res) {
  const { action } = req.query || {};

  // Stripe webhook has a raw body; don't JSON.parse it here.
  if (action === "stripe-webhook") return await handleStripeWebhook(req, res);

  // Vapi sends its end-of-call payload with a Bearer token in Authorization.
  const authHeader = req.headers.authorization || req.headers["Authorization"];
  if (isVapiWebhookPath(req) || authHeader?.startsWith("Bearer ")) {
    return await handleVapiWebhook(req, res, authHeader);
  }

  // Public form / checkout / waitlist actions.
  const body = await parseJsonBody(req);

  if (action === "checkout") return await handleCheckout(req, res, body);
  if (action === "waitlist") return await handleWaitlist(req, res, body);
  if (action === "intake" || !action) return await handleIntake(req, res, body);

  return res.status(400).json({ error: "Unknown action." });
}

// ═════════════════════════════════════════════════════════════════════════════
// Stripe Checkout Session Creation
// ═════════════════════════════════════════════════════════════════════════════
async function handleCheckout(req, res, body) {
  const { email, client_name, success_url, cancel_url } = body || {};

  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Missing required field: email" });
  }

  const { is_full } = await getFounderScarcity();
  const tier = is_full ? "standard" : "founder";
  const priceId = tier === "founder"
    ? process.env.STRIPE_PRICE_FOUNDER
    : process.env.STRIPE_PRICE_STANDARD;

  if (!priceId) {
    console.error(`Missing STRIPE_PRICE_${tier.toUpperCase()} environment variable.`);
    return res.status(500).json({ error: "Server configuration error — Stripe price not set." });
  }

  const origin = req.headers.origin || success_url || "https://passaggio.io";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      [STRIPE_TIER_METADATA_KEY]: tier,
      customer_email: email.trim(),
      customer_name: (client_name || "").trim(),
    },
    success_url: success_url || `${origin}/intake?checkout=success&tier=${tier}`,
    cancel_url: cancel_url || `${origin}/intake?checkout=canceled&tier=${tier}`,
  });

  return res.status(200).json({
    success: true,
    checkout_url: session.url,
    tier,
    session_id: session.id,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Stripe Webhook — checkout.session.completed + customer/payment/identity events
// ═════════════════════════════════════════════════════════════════════════════
async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid Stripe signature." });
  }

  // Always ack quickly; process asynchronously below.
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const tier = session.metadata?.[STRIPE_TIER_METADATA_KEY];
    const email = session.customer_email || session.metadata?.customer_email || "(not provided)";
    const clientName = session.metadata?.customer_name || "(not provided)";

    if (tier === "founder") {
      const { paid_founders_count } = await getFounderScarcity();
      if (paid_founders_count >= FOUNDER_LIMIT) {
        await sendTelegramMessage(
          `🚨 <b>VICTORY!</b> All ${FOUNDER_LIMIT} Founding Members have been locked in! Funnel shifting to Tier 2.`,
          { disable_notification: false }
        );
      }
    }

    // Record the new active client in the file-based registry.
    await recordActiveClient({
      email,
      client_name: clientName,
      tier,
      status: "active",
      source: "stripe_checkout",
      stripe_session_id: session.id,
    });

    // Activate waitlist after a successful checkout
    await setWaitlistFlag(true);
    await sendTelegramMessage(
      `🔒 <b>Boutique Waitlist Activated</b>\n` +
        `• Triggered by: checkout.session.completed\n` +
        `• Customer: ${escapeHtml(clientName)} <${escapeHtml(email)}>\n` +
        `• Tier: ${escapeHtml(tier || \"unknown\")}\n` +
        `• Time: ${new Date().toISOString()}\n\n` +
        `The intake portal is now in WAITLIST mode until manually reset.`,
      { disable_notification: false }
    );
  }

  if (event.type === "customer.created") {
    const customer = event.data.object;
    console.log("[stripe] customer.created:", customer.id, customer.email);
    await sendTelegramMessage(
      `🆕 <b>New Customer Profile Initialized</b>\n` +
        `• ID: <code>${escapeHtml(customer.id)}</code>\n` +
        `• Email: ${escapeHtml(customer.email || "(not provided)")}\n` +
        `• Name: ${escapeHtml(customer.name || "(not provided)")}`,
      { disable_notification: false }
    );
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    const amount = (pi.amount_received ?? pi.amount ?? 0) / 100;
    const currency = (pi.currency || "usd").toUpperCase();
    const customerEmail = pi.receipt_email || pi.charges?.data?.[0]?.receipt_email || "(not provided)";

    console.log("[stripe] payment_intent.succeeded:", pi.id, `${amount} ${currency}`);
    await sendTelegramMessage(
      `💰 <b>Payment Received</b>\n` +
        `• PaymentIntent: <code>${escapeHtml(pi.id)}</code>\n` +
        `• Amount: <b>${amount.toFixed(2)} ${currency}</b>\n` +
        `• Customer: ${escapeHtml(customerEmail)}\n` +
        `⏳ Preparing next internal step (Design Bridge / intake transaction log).`,
      { disable_notification: false }
    );

    // TODO: trigger Design Bridge or log successful intake transaction here.
  }

  if (event.type === "identity.verification_session.verified") {
    const session = event.data.object;
    const verifiedEmail = session.metadata?.customer_email || session.last_verification_report?.email || "(not provided)";

    console.log("[stripe] identity.verification_session.verified:", session.id);
    await sendTelegramMessage(
      `✅ <b>Identity Verification Successful</b>\n` +
        `• Verification Session: <code>${escapeHtml(session.id)}</code>\n` +
        `• Customer: ${escapeHtml(verifiedEmail)}\n` +
        `• Status: <b>verified</b> — local record updated.`,
      { disable_notification: false }
    );

    // Persist a local verification record.
    await recordVerificationStatus(session.id, verifiedEmail, "verified", session);
  }

  return res.status(200).json({ received: true });
}

// ═════════════════════════════════════════════════════════════════════════════
// Waitlist Handler
// ═════════════════════════════════════════════════════════════════════════════
async function handleWaitlist(req, res, body) {
  const { client_name, email } = body || {};

  if (!client_name || !client_name.trim()) {
    return res.status(400).json({ error: "Missing required field: client_name" });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Missing required field: email" });
  }

  const record = await recordActiveClient({
    email: email.trim(),
    client_name: client_name.trim(),
    tier: "waitlist",
    status: "waitlisted",
    source: "waitlist_form",
  });

  await sendTelegramMessage(
    `📋 <b>New Waitlist Signup</b>\n` +
      `• Name: ${escapeHtml(record.client_name)}\n` +
      `• Email: ${escapeHtml(record.email)}\n` +
      `• Requested: ${record.accepted_at}\n` +
      `⏳ They will be notified when the boutique cycle opens.`,
    { disable_notification: false }
  );

  return res.status(200).json({
    success: true,
    message: "You're on the waitlist. We'll contact you when a spot opens.",
    record,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Public Form Intake — with reCAPTCHA verification + Neon persistence
// ═════════════════════════════════════════════════════════════════════════════
async function handleIntake(req, res, body) {
  const {
    client_name,
    email,
    website,
    transcript_text,
    file_metadata,
    vapi_call_id,
    vapi_summary,
    vapi_transcript,
    recaptcha_token,
  } = body || {};

  if (!client_name || !client_name.trim()) {
    return res.status(400).json({ error: "Missing required field: client_name" });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Missing required field: email" });
  }

  // Verify reCAPTCHA token if present (mandatory on the frontend).
  if (recaptcha_token) {
    const recaptchaOk = await verifyRecaptcha(recaptcha_token);
    if (!recaptchaOk) {
      return res.status(400).json({ error: "reCAPTCHA verification failed. Please try again." });
    }
  }

  // Persist structured intake data to Neon.
  const fileUrls = Array.isArray(file_metadata)
    ? file_metadata.map((f) => f.url).filter(Boolean)
    : [];

  try {
    const sql = getNeonSql();
    await sql`
      INSERT INTO intakes (name, email, website, fallback_notes, file_urls)
      VALUES (${client_name.trim()}, ${email.trim()}, ${website ? website.trim() : null}, ${transcript_text || null}, ${JSON.stringify(fileUrls)})
    `;
  } catch (err) {
    console.error("Neon intake insert failed:", err);
    return res.status(500).json({ error: "Unable to save intake. Please try again." });
  }

  await sendIntakeTelegramAlert({
    client_name: client_name.trim(),
    email: email.trim(),
    website: website ? website.trim() : "",
    transcript_text,
    file_metadata,
    vapi_call_id,
    vapi_summary,
    vapi_transcript,
  });

  return res.status(200).json({
    success: true,
    message: "Intake received. We'll review and respond within 24 hours.",
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Vapi Webhook — end-of-call-report / tool-calls (with AI Game Plan generation)
// ═════════════════════════════════════════════════════════════════════════════
function isVapiWebhookPath(req) {
  const url = req.url || "";
  return url === "/api/intake" || url.startsWith("/api/intake?");
}

// ── Intelligence Layer Prompt (mirrors intake_system.py) ──────────────────
const GAME_PLAN_PROMPT = `You are the Sovereign Intake Intelligence Layer for a high-speed, elite custom-software development agency.

Your job is to analyse a prospective client's described business pain points and map them to the correct application from the agency's 9-asset ecosystem.

The 9-Asset Application Ecosystem
----------------------------------
1. SafeSitter Canada – Premium, trust-gated childcare ecosystem. Mandatory $5 verification gate, VSC validation, caregiver tiers (standard/premium/elite).
2. Resonance – Social safety networking app. Stripe Identity liveness checks, AI "Tuning Questions" building "Vibe Profiles", 10-minute "Virtual Meets" to prevent catfishing and romance scams.
3. Passaggio (Vocal Sanctuary) – Somatic/wellness vocal training. AI "Sovereign Concierge" routes users to practice rooms (BreathSync, VoiceGym).
4. Lease Guard – B2B prototype. Parses complex real-estate leases, extracts rent/renewal dates, flags non-compliant or high-risk clauses.
5. Legal Discovery Agent – B2B prototype. Reviews Tier 1 documents and summarises case research securely in a private cloud.
6. Service Trades Dispatcher – B2B prototype. Branded portal that qualifies leads, tracks technician coordinates, auto-updates CRM records.
7. B2B Lead Sculptor – B2B prototype. Analyses organic comments, reviews won/lost deal data, identifies targeted niches based on real buyer language.
8. Ops Process Analyst – B2B prototype. Audits ticket-handling data, detects workflow bottlenecks, flags silent deactivations/rate-limit breaks.
9. Omni-Channel Concierge – B2B prototype. Autonomously resolves 95% of routine Tier 1 billing and scheduling support tickets.

Brittle SaaS Reference
----------------------
Always contrast the selected custom app against standard multi-tenant SaaS limits where relevant:
• Monday.com – 1,000 board actions per 60 s (throttled); 30,000 per 60 s (blocked). Automations silently deactivate if target columns are renamed or the integration creator is deactivated/downgraded.
• Google Sheets – 300 requests/minute per project; 60 per minute per user → immediate 429 errors during bulk imports.
• Make.com – No persistent queuing or native backoff; partial data transfers and fragmentation when downstream rate limits fail.

Required Output Format
---------------------
Return a clean markdown document containing exactly four sections:

### SECTION 1: Client Problem Summary & Quantified Impact
Summarise the core business pain in 3 sentences. Pull any quantitative metrics the client mentioned (revenue lost, hours wasted, team size, etc.). If the topic is Social Safety, reference the FTC romance-scam losses (over $1.16 billion) or the BYU study showing 14% of dating-app sexual assaults happen on the first meeting. If Vocal Health, use the Northwestern/Bienen School vocal-dosimetry equation: Total Vocal Load=\\int_{t_0}^{t_1}f(Amplitude,Frequency,Duration)dt with no spaces inside the delimiters. If Childcare, reference Canadian VSC processing times (3-5 business days).

### SECTION 2: Recommended App & Brittle SaaS Contrast
Identify which of the 9 apps most naturally resolves this pain. Explain explicitly why a DIY low-code setup (e.g. complex Monday.com workspace, Make.com → Google Sheets script) would break or hit cost/rate/maintenance limits under this specific scenario.

### SECTION 3: 6-Second Retention Hook (25-34 Professional Cohort)
Write a fast, pattern-interrupting visual and spoken hook. It must call out the parsed client topic to create instant relevance.

### SECTION 4: SOP Hand-Off & Developer Asset Directives
Reference the newworkflow.md Client Delivery Map (§2) and list:
1. **Setup**: Create folder under 03 - Clients/Active/ with app/ and notes.md
2. **Context Loading**: Summarize requirements in notes.md from the transcript
3. **Diff Execution**: Compare against 00 - System/templates/ master prototype; produce written diff in notes.md under ## Feature Diff
4. **Build**: Copy prototype to app/ and implement agreed changes; commit after each milestone
5. **QA / Validation**: List modified files and summary in notes.md under ## QA Summary
6. **Documentation**: Update client-history.md with every modification, decision, and prompt

Also list concrete files/components to generate in the IDE:
• Required design.md parameters (colours, fonts, tone).
• Key React/Vue components.
• Backend API endpoints.
• Database schema suggestions.
• Owner's Manual PDF checklist items.
• Optional Enhancement Modules (upsell hooks, e.g. "Add AI Voice Concierge (+$500 module)", "Advanced Analytics Dashboard (+$300 module)") — these keep the base app flexible while creating natural upgrade paths.
`;

async function generateGamePlan(sourceText) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("No GEMINI_API_KEY or OPENROUTER_API_KEY configured; skipping Game Plan generation.");
    return null;
  }

  try {
    // Use OpenRouter as the default provider (supports Gemini via OpenRouter)
    const isOpenRouter = !process.env.GEMINI_API_KEY && process.env.OPENROUTER_API_KEY;
    const url = isOpenRouter
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;

    let body;
    if (isOpenRouter) {
      body = JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          { role: "system", content: GAME_PLAN_PROMPT },
          { role: "user", content: `Analyse the following client intake data and return a Game Plan markdown document:\n\n${sourceText}` }
        ],
        temperature: 0.3,
      });
    } else {
      body = JSON.stringify({
        contents: [{ parts: [{ text: `${GAME_PLAN_PROMPT}\n\nAnalyse the following client intake data and return a Game Plan markdown document:\n\n${sourceText}` }] }],
        generationConfig: { temperature: 0.3 },
      });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(isOpenRouter ? { "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": "https://passaggio.io" } : {}),
      },
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Game Plan generation failed:", response.status, errText);
      return null;
    }

    const data = await response.json();
    if (isOpenRouter) {
      return data.choices?.[0]?.message?.content || null;
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.error("Game Plan generation error:", err);
    return null;
  }
}

async function handleVapiWebhook(req, res, authHeader) {
  const expected = process.env.VAPI_WEBHOOK_SECRET || "";
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!expected) {
    console.warn("VAPI_WEBHOOK_SECRET is not configured; rejecting Vapi webhook.");
    return res.status(401).json({ error: "Unauthorized — webhook secret not configured." });
  }

  if (!token || token !== expected) {
    console.warn("Vapi webhook Authorization header missing or invalid.");
    return res.status(401).json({ error: "Unauthorized — invalid or missing Bearer token." });
  }

  const body = await parseJsonBody(req);
  const message = body?.message || body;
  const type = message?.type || body?.type;

  if (type !== "end-of-call-report" && type !== "tool-calls") {
    return res.status(200).json({ ok: true, note: "Ignored non-terminal Vapi event." });
  }

  const call = message?.call || body?.call || {};
  const customer = call?.customer || {};
  const analysis = call?.analysis || message?.analysis || {};

  const payload = {
    client_name: customer?.name || body?.client_name || "Vapi Caller",
    email: customer?.email || body?.email || "(not captured)",
    company_url: body?.company_url || body?.website || "",
    transcript_text: analysis?.summary || body?.summary || "(Vapi call ended)",
    vapi_call_id: call?.id || body?.call?.id || "(unknown)",
    vapi_summary: analysis?.summary || body?.summary,
    vapi_transcript: call?.transcript || body?.transcript,
    file_metadata: body?.file_metadata,
  };

  // ── AI Intelligence Layer: Generate Game Plan ─────────────────────────────
  let gamePlanMarkdown = null;
  try {
    const sourceText = `
PROBLEM SUMMARY: ${payload.transcript_text}
RAW TRANSCRIPT: ${payload.vapi_transcript || "(not available)"}
CLIENT NAME: ${payload.client_name}
EMAIL: ${payload.email}
COMPANY URL: ${payload.company_url}
    `.trim();

    gamePlanMarkdown = await generateGamePlan(sourceText);
    if (gamePlanMarkdown) {
      console.log(`[vapi] Game Plan generated for ${payload.client_name} (${payload.email})`);
    }
  } catch (err) {
    console.error("[vapi] Game Plan generation failed:", err);
  }

  // ── Persist to Neon with new columns ─────────────────────────────────────
  try {
    const sql = getNeonSql();
    await sql`
      INSERT INTO intakes (name, email, website, fallback_notes, file_urls, vapi_transcript, vapi_summary, game_plan_markdown)
      VALUES (
        ${payload.client_name.trim()},
        ${payload.email.trim()},
        ${payload.company_url ? payload.company_url.trim() : null},
        ${payload.transcript_text || null},
        ${payload.file_metadata ? JSON.stringify(payload.file_metadata) : '[]'::jsonb},
        ${payload.vapi_transcript || null},
        ${payload.vapi_summary || null},
        ${gamePlanMarkdown || null}
      )
    `;
  } catch (err) {
    console.error("Neon Vapi intake insert failed:", err);
    // Non-blocking: continue to send Telegram alert even if DB fails
  }

  await sendIntakeTelegramAlert({ ...payload, game_plan_markdown: gamePlanMarkdown });

  return res.status(200).json({ success: true, game_plan_generated: !!gamePlanMarkdown });
}

// ═════════════════════════════════════════════════════════════════════════════
// Founder Scarcity Calculation (Stripe)
// ═════════════════════════════════════════════════════════════════════════════
async function getFounderScarcity() {
  try {
    // Stripe Checkout Sessions with metadata.tier === "founder" and payment_status === "paid"
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      status: "complete",
    });

    const paidFounders = sessions.data.filter(
      (s) => s.payment_status === "paid" && s.metadata?.[STRIPE_TIER_METADATA_KEY] === "founder"
    );

    const paid_founders_count = paidFounders.length;
    const spots_remaining = Math.max(0, FOUNDER_LIMIT - paid_founders_count);
    const is_full = spots_remaining === 0;
    const tier = is_full ? "standard" : "founder";

    return { paid_founders_count, spots_remaining, tier, is_full };
  } catch (err) {
    console.error("Stripe scarcity query failed:", err);
    // Fail-safe: assume full so we don't oversell.
    return { paid_founders_count: FOUNDER_LIMIT, spots_remaining: 0, tier: "standard", is_full: true };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Boutique Cycle State (One client per 24h)
// ═════════════════════════════════════════════════════════════════════════════
async function getBoutiqueCycleState() {
  try {
    const registry = await readClientRegistry();
    const now = Date.now();

    const activeOrRecent = registry.filter((r) => {
      if (!r.accepted_at) return false;
      const acceptedAt = new Date(r.accepted_at).getTime();
      return (now - acceptedAt) < ACTIVE_CLIENT_WINDOW_MS && ["active", "waitlisted"].includes(r.status);
    });

    // Only "active" clients block the cycle; waitlisted clients do not.
    const blockingClients = activeOrRecent.filter((r) => r.status === "active");
    const cycle_is_full = blockingClients.length > 0;

    return {
      cycle_is_full,
      active_clients: blockingClients,
      recently_waitlisted: activeOrRecent.filter((r) => r.status === "waitlisted"),
      next_opening_estimate: cycle_is_full
        ? new Date(new Date(blockingClients[0].accepted_at).getTime() + ACTIVE_CLIENT_WINDOW_MS).toISOString()
        : null,
    };
  } catch (err) {
    console.error("Boutique cycle state error:", err);
    // Fail-safe: assume full so we don't oversell.
    return { cycle_is_full: true, active_clients: [], recently_waitlisted: [], next_opening_estimate: null };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// File-Based Active Client Registry
//
// Default location: ~/.passaggio/active_clients.json
// Migration note: on true serverless platforms (Vercel, Netlify, Cloudflare),
// replace these helpers with KV / Redis / Postgres calls. Revisit per client.
// ═════════════════════════════════════════════════════════════════════════════
async function readClientRegistry() {
  try {
    if (!fs.existsSync(CLIENT_REGISTRY_PATH)) return [];
    const raw = fs.readFileSync(CLIENT_REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read client registry:", err);
    return [];
  }
}

async function writeClientRegistry(registry) {
  try {
    fs.mkdirSync(path.dirname(CLIENT_REGISTRY_PATH), { recursive: true });
    fs.writeFileSync(CLIENT_REGISTRY_PATH, JSON.stringify(registry, null, 2));
  } catch (err) {
    console.error("Failed to write client registry:", err);
    throw new Error("Registry write failed.");
  }
}

async function recordActiveClient({ email, client_name, tier, status, source, stripe_session_id }) {
  const registry = await readClientRegistry();
  const record = {
    id: generateId(),
    email: (email || "").trim().toLowerCase(),
    client_name: (client_name || "").trim(),
    tier: tier || "standard",
    status: status || "waitlisted",
    source: source || "unknown",
    stripe_session_id: stripe_session_id || null,
    accepted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  registry.push(record);
  await writeClientRegistry(registry);
  return record;
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
// ── Waitlist State (controlled by Stripe webhooks) ─────────────────────────
async function readWaitlistState() {
  try {
    if (!fs.existsSync(WAITLIST_STATE_PATH)) return { active: false };
    const raw = fs.readFileSync(WAITLIST_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed || { active: false };
  } catch (err) {
    console.error("Failed to read waitlist state:", err);
    return { active: false };
  }
}

async function setWaitlistFlag(active) {
  try {
    const dir = path.dirname(WAITLIST_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WAITLIST_STATE_PATH, JSON.stringify({ active, updated_at: new Date().toISOString() }, null, 2));
  } catch (err) {
    console.error("Failed to write waitlist state:", err);
  }
}


// ═════════════════════════════════════════════════════════════════════════════
// Telegram Alert Builder
// ═════════════════════════════════════════════════════════════════════════════
async function sendIntakeTelegramAlert({
  client_name,
  email,
  website,
  transcript_text,
  file_metadata,
  vapi_call_id,
  vapi_summary,
  vapi_transcript,
  game_plan_markdown,
}) {
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.CHAT_ID;

  if (!telegramToken || !chatId) {
    console.error("Missing TELEGRAM_TOKEN or CHAT_ID environment variables.");
    throw new Error("Telegram not wired.");
  }

  const problemText = transcript_text?.trim() || "(No problem description provided)";
  const fileList = file_metadata?.length
    ? file_metadata.map((f) => `• ${f.filename} (${f.content_type}, ${f.size_bytes} bytes)`).join("\n")
    : "";
  const vapiNote = vapi_call_id ? `\n📞 <b>Vapi Call ID:</b> ${escapeHtml(vapi_call_id)}` : "";
  const summaryNote = vapi_summary
    ? `\n📝 <b>Call Summary:</b>\n${escapeHtml(vapi_summary.trim())}`
    : "";
  const transcriptNote = vapi_transcript
    ? `\n🎙 <b>Transcript:</b>\n${escapeHtml(truncate(vapi_transcript.trim(), 3500))}`
    : "";
  const gamePlanNote = game_plan_markdown
    ? `\n🎯 <b>Game Plan:</b> AI-generated and saved to database (\`game_plan_markdown\` column).`
    : "";

  const message = [
    `🚀 <b>New Passaggio Intake</b>`,
    ``,
    `<b>Name:</b> ${escapeHtml(client_name)}`,
    `<b>Email:</b> ${escapeHtml(email)}`,
    website ? `<b>Website:</b> ${escapeHtml(website)}` : "",
    ``,
    `<b>Problem:</b>`,
    `${escapeHtml(problemText)}`,
    fileList ? `\n<b>Files:</b>\n${escapeHtml(fileList)}` : "",
    vapiNote,
    summaryNote,
    transcriptNote,
    gamePlanNote,
    ``,
    `⏳ <i>Review and respond within 24 hours.</i>`,
  ]
    .filter(Boolean)
    .join("\n");

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `approve:${email}` },
        { text: "❌ Decline", callback_data: `decline:${email}` },
      ],
    ],
  };

  const telegramResp = await fetch(
    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        reply_markup: inlineKeyboard,
      }),
    }
  );

  const telegramData = await telegramResp.json();
  if (!telegramResp.ok || !telegramData.ok) {
    console.error("Telegram API error:", telegramData);
    throw new Error(telegramData.description || "Telegram delivery failed.");
  }

  return telegramData;
}

async function sendTelegramMessage(text, opts = {}) {
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.CHAT_ID;
  if (!telegramToken || !chatId) {
    console.error("Missing TELEGRAM_TOKEN or CHAT_ID environment variables.");
    return;
  }

  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_notification: opts.disable_notification ?? true,
    }),
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Google reCAPTCHA v2 Verification
// ═════════════════════════════════════════════════════════════════════════════
async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.warn("RECAPTCHA_SECRET_KEY not set; skipping verification.");
    return true;
  }

  try {
    const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await resp.json();
    return data.success === true;
  } catch (err) {
    console.error("reCAPTCHA verification error:", err);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Local Verification Record Persistence
// ═════════════════════════════════════════════════════════════════════════════
async function recordVerificationStatus(sessionId, email, status, session) {
  try {
    const recordDir = path.join(os.homedir(), ".passaggio", "verifications");
    fs.mkdirSync(recordDir, { recursive: true });

    const recordPath = path.join(recordDir, `${sessionId}.json`);
    const record = {
      session_id: sessionId,
      email,
      status,
      provider: "stripe_identity",
      verified_at: session.verified_at
        ? new Date(session.verified_at * 1000).toISOString()
        : new Date().toISOString(),
      created_at: session.created
        ? new Date(session.created * 1000).toISOString()
        : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
    console.log("[stripe] verification record saved:", recordPath);
  } catch (err) {
    console.error("[stripe] failed to save verification record:", err);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Body Parsers
// ═════════════════════════════════════════════════════════════════════════════
async function parseJsonBody(req) {
  if (typeof req.body === "object" && req.body !== null) return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function getRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ═════════════════════════════════════════════════════════════════════════════
// Utilities
// ═════════════════════════════════════════════════════════════════════════════
function escapeHtml(str) {
  if (typeof str !== "string") return String(str);
  return str
    .replace(/&/g, '\x26amp;')
    .replace(/</g, '\x26lt;')
    .replace(/>/g, '\x26gt;')
    .replace(/"/g, '\x26quot;');
}

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "\n\n[…truncated]";
}