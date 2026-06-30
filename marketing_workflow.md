# Passaggio Unified Marketing Production & Verification Workflow
----
ADDITION:
# Step 1: Run the Antigravity CLI binary to open the agent interface
agy

# Step 2: Once inside the interactive TUI prompt (where you see the agent box), type the command:
agy plugin install nano-banana@focus-marketplace
-----

This document defines the official, end-to-end technical blueprint and operational pipeline for Passaggio's autonomous marketing engine. It details how daily ingestion signals, dynamic motion asset creation, declarative React-based video compilation, and predictive multimodal video auditing coordinate to produce high-retention, high-converting organic video assets.

---

## 1. High-Level Architectural Flow

```
                                  [ 1. SIGNAL INGESTION LAYER ]
                                        (Email reports)
                                                │
                                                ▼ Extract Pain Points, SaaS Contrasts,
                                                ▼ Audio Scripts, and Slide Timelines
                                                │
                    ┌───────────────────────────┴───────────────────────────┐
                    ▼                                                       ▼
        [ 2. MOTION ASSET DESIGN ]                               [ 3. VIDEO ASSEMBLY ENGINE ]
           (Text-to-Lottie Skill)                                      (Remotion React app)
         - SolidJS / CanvasKit Wasm                                  - PremiumShortComposition
         - slots & controls.json                                     - props.json / sound cues
                    │                                                       │
                    └───────────────────────────┬───────────────────────────┘
                                                ▼ Ingests Voiceover, Timestamps,
                                                ▼ and Lottie Vector Assets
                                                │
                                                ▼ Render (CLI Node/Chrome)
                                                │
                                                ▼
                                    [ 4. PLATFORM VIRAL PREDICTOR ]
                                         (Streamlit & Gemini Pro)
                                      - Multimodal sensory analysis
                                      - Virality Score & Hold Timeline
                                      - Final Script Optimizations
```

The workflow operates in four sequential, automated stages:
1. **Signal Ingestion & Brief Generation (`Email reports`):** Raw user pain points are parsed and mapped to designated Passaggio application candidates. This produces visual/audio scripts, on-screen slide properties, and development directives.
2. **Dynamic Motion Graphics Production (`lottie`):** Lightweight, interactive, vector animations are proceduralized via the `text-to-lottie` skill, utilizing slot variables and pre-rendered inside an isolated CanvasKit WASM local player.
3. **Declarative Video Compilation (`remotion`):** Visual assets, audio tracks, word-level speech-to-text timestamps, and interactive mouse coordinates are ingested into a React timeline component and rendered as full-HD vertical video sequences.
4. **Algorithmic Predictive Auditing (`Viral_Video_Predictor`):** Immediately after the `.mp4` is written, `render.py` automatically uploads the rendered video to Gemini-1.5-Pro and writes a detailed markdown virality audit (`<video_name>_virality_audit.md`) next to the output file. No manual upload is required.

---

## 2. Stage-by-Stage Implementation Guide

### Stage 1: Signals & Brief Generation (Email Reports)

This stage extracts high-intent user friction from global community hubs (Reddit `/r/Automation`, `/r/sales`, `/r/msp`, etc.) and industry briefs to build the marketing narrative.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                DAILY SIGNAL LEDGER                                │
├──────────────────────────┬───────────────────────────┬───────────────────────────┤
│ Ingested Source          │ Extract Pain Point        │ Target App Map            │
├──────────────────────────┼───────────────────────────┼───────────────────────────┤
│ "DO NOT use FastSpring"  │ 14-day silent delays,     │ Omni-Channel Concierge    │
│ (Reddit AI Roleplay)     │ opaque support gateways   │                           │
├──────────────────────────┼───────────────────────────┼───────────────────────────┤
│ "Rate-limit hell"        │ Recursive loop failures,  │ Ops Process Analyst       │
│ (Reddit /r/Automation)   │ credit burn, silent bans  │                           │
├──────────────────────────┼───────────────────────────┼───────────────────────────┤
│ "iOS 26 Call Screening" │ 22% outbound drop-offs,   │ Service Trades Dispatcher │
│ (Reddit /r/sales)        │ automatic bot screening   │                           │
├──────────────────────────┼───────────────────────────┼───────────────────────────┤
│ "Vibe-coded AI app leak" │ Exposed user tables,      │ Ops Process Analyst       │
│ (Reddit /u/CompDay)      │ broken Stripe webhooks    │                           │
└──────────────────────────┴───────────────────────────┴───────────────────────────┘
```

#### Brief Generation Schema
For each daily win, the intake pipeline generates a structured brief in the corresponding `/Email reports/<date>` folder. The template includes:
1. **Target App Contrast:** Contrasts a bespoke custom software solution with a brittle SaaS stack (such as combining *Monday.com* boards, *Google Sheets* databases, and *Make.com* webhooks which break under 429 rate limits or column renaming).
2. **Slide-Deck prompts:** High-conversion vertical mobile layouts utilizing standard design schemas:
   - **Background:** Crisp White (`#FFFFFF`) or high-contrast warning elements.
   - **Accents:** Bold Pink (`#D81B60`) and Deep Black (`#111111`).
   - **Fonts:** Oswald (Headings), Lato (Body).
3. **Narrative/Vertical Scripts:** Exactly timed, spoken sequences bounded strictly to **42–45 words** to guarantee high retention on mobile swipe algorithms.
4. **On-Screen Text Timelines:** Maximum of **4 words per line** to match visual reading speed.
5. **Developer Asset Directives:** Code blueprints (e.g., custom React widgets like `AutoBackoffMonitor.tsx`, `AuditStatusWidget.jsx`, `CustomerPortal.tsx`) to implement the target solution on a technical level.

---

### Stage 2: Motion Asset Creation (Text-to-Lottie)

This framework generates and refines highly polished, lightweight vector animations using CanvasKit WASM inside SolidJS.

#### Workspace Structure
Animations must reside strictly in the following layout:
```
lottie/
├── public/
│   └── projects/
│       └── <project-slug>/
│           └── <scene-N>/
│               ├── lottie.json        # Mandatory Bodymovin JSON
│               ├── controls.json      # Optional presentation metadata (sliders, ranges)
│               └── [assets]           # Relevant PNG/SVG file references
```
*Note: A trailing `-N` (e.g., `scene-1`) enforces sorting orders.*

#### Slot Declarations & Property Bindings
To make properties live-adjustable via the sidecar controls pane, animations declare the `"slots"` property directly in the `lottie.json` root. 

##### Example `lottie.json` Slot Mapping:
```json
{
  "v": "5.7.0",
  "fr": 60,
  "ip": 0,
  "op": 90,
  "w": 512,
  "h": 512,
  "nm": "High-Contrast Indicator",
  "slots": {
    "indicatorColor": { "p": { "a": 0, "k": [0.847, 0.106, 0.376, 1] } },
    "indicatorRadius": { "p": { "a": 0, "k": 120 } },
    "panelBgColor": { "p": { "a": 0, "k": [1, 1, 1, 1] } }
  },
  "layers": [
    {
      "ty": 4,
      "nm": "TriggerRing",
      "ip": 0,
      "op": 90,
      "st": 0,
      "ks": {
        "s": { "a": 0, "k": [100, 100, 100] },
        "p": { "a": 0, "k": [256, 256, 0] }
      },
      "shapes": [
        {
          "ty": "gr",
          "nm": "geometry",
          "it": [
            { "ty": "el", "p": { "a": 0, "k": [0, 0] }, "s": { "sid": "indicatorRadius" } },
            { "ty": "fl", "c": { "sid": "indicatorColor" }, "o": { "a": 0, "k": 100 } },
            { "ty": "tr", "p": { "a": 0, "k": [0, 0] } }
          ]
        }
      ]
    }
  ]
}
```

##### Coinciding `controls.json` Configuration:
```json
{
  "controls": [
    { "sid": "indicatorColor", "label": "Indicator Highlight Color" },
    { "sid": "indicatorRadius", "label": "Indicator Scale Boundary", "min": 20, "max": 400, "step": 1 },
    { "sid": "panelBgColor", "label": "Background Panel Color" }
  ]
}
```

#### Playback Verification Protocol
1. Start the local server: `cd lottie && npm install && npm run dev` (running default on `http://localhost:3030`).
2. Run a fetch query against `GET /__context` to verify tree health, scanning active playhead coordinates.
3. Seek to precise milestones for steady-state screenshots using URL-based parameters:
   - `http://localhost:3030/<project-slug>/<scene-slug>?frame=0` (Initial frame state)
   - `http://localhost:3030/<project-slug>/<scene-slug>?frame=45` (Midpoint motion analysis)
   - `http://localhost:3030/<project-slug>/<scene-slug>?frame=89` (Final boundary state)

---

### Stage 3: Automated Video Assembly (Remotion React Engine)

The video engine reads JSON timelines to choreograph high-retention video compositions.

#### Master React Component Composition
All marketing episodes are defined as specialized instances of the `PremiumShortComposition` component. Compositions are strictly typed with Zod schemas.

```typescript
// Location: remotion/src/PremiumShortComposition.tsx
export const PremiumShortCompositionSchema = z.object({
  voiceoverUrl: z.string(),
  timestamps: z.array(
    z.object({
      word: z.string(),
      start: z.number(), // seconds
      end: z.number(),   // seconds
    })
  ),
  iconNames: z.array(z.string()).default(["Zap"]),
  audioCueTimeline: z.array(
    z.object({
      timeMs: z.number(),
      cueType: z.enum(["voice", "music", "sfx"]),
      iconName: z.string().optional(),
 Freund: z.string().optional(),
      note: z.string().optional(),
    })
  ).default([]),
  hookText: z.string(),
  ctaKeyword: z.string(),
});
```

#### Production Layout Timing Constraints
Compositions strictly adhere to rigid, professional motion-graphic boundaries:
- **Total Duration:** Exactly **450 frames** (15 seconds at 30fps).
- **Resolution:** Dedicated mobile vertical vertical aspect ratio: **1080x1920**.
- **The Hook Phase (0.0s – 3.0s / Frames 0–90):** Focuses heavily on massive text overlays. A background mockup screen is heavily blurred using interpolation.
- **The Demo Phase (3.0s – 11.0s / Frames 90–330):** The background blur is smoothly cleared using springs, macro-zooming into simulated product interface interactions.
- **The CTA Phase (11.0s – 15.0s / Frames 330–450):** Mockups fade out, replacing the canvas with a high-impact `CTABillboard` modal driven by spring scaling.

#### Interactive Element Simulations
1. **Camera Drift:** Subtle, continuous zoom-in and translational pan interpolates throughout the full 15 seconds so no frame remains perfectly static.
2. **Spring Shake Transitions:** Transition between words and phases trigger subtle x-and-y shake vectors modeled using physical spring models (`damping: 12, mass: 0.5, stiffness: 100`).
3. **Sound-Cue Trigger Scales:** Sound events (like SFX hit boundaries) cause the main visual viewport to spikes slightly in scale, settling immediately using a spring solver.
4. **Click Sequences:** An dynamic virtual cursor coordinates transition tracks based on millisecond cues (`props.json`), simulating a mouse pointer navigating the mock app interface.

#### Video Rendering Commands
Renders are initiated via CLI scripts. If a browser launch hang is detected at the `[openBrowser()]` step due to system-level permissions, bypass local configurations using explicit flags:
```bash
cd remotion
npx remotion render src/index.ts PremiumShortComposition \
  --props=./props.json \
  --output=./out/final_output.mp4 \
  --browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

---

### Stage 4: Predictive Algorithmic Audit (Viral Video Predictor)

The Viral Video Predictor is no longer a manual Streamlit upload step. It is now an automatic post-render action inside `Blueprints/render.py`. As soon as Remotion writes the final `.mp4`, the pipeline uploads the video file to Gemini-1.5-Pro and writes a detailed markdown audit report (`<video_name>_virality_audit.md`) into the same output directory.

```
       Rendered .mp4 ────────────────────┐
                                         ▼
                   Gemini Algorithmic Verification Sandbox
                                         │
       ┌─────────────────────────────────┴─────────────────────────────────┐
       ▼                                 ▼                                 ▼
 VIRALITY INDEX                    RETENTION MAPPING                THE ACTIONABLE FIXES
 - Overall score (0-100)           - Second-by-second hold %        - Cut specific phrases
 - Curated audience demographic    - Target major drop-off zones    - Visual element shift
 - Algorithmic SEO keyword load    - Call to Action timing audit    - Dynamic crop zooms
```

#### System Audit Instructions (Core Prompts)
The predictor uses multimodal processing of visual frames, audio cues, and text pacing to output four highly analytical diagnostic blocks:
1. **Virality Index Overview:** Standardized score (0-100) alongside predicted audience demographics.
2. **Platform Hook Score:** Analytics on the crucial first 3000ms. Verifies if a psychological "curiosity gap" or "open loop" is established within 90 frames.
3. **Second-by-Second Hold Timeline:** Predicted drop-off markers identifying high-risk pacing gaps, transitions, and CTA loop traps.
4. **Actionable Optimization Script:** Precise edit commands (e.g. *"Shift text higher on y-axis by 150px to avoid default TikTok overlay UI elements"*, or *"Prune verbal greeting from frame 0-15 to reduce initial user churn"*).

#### CLI Overrides
You can customize or disable the audit directly from the render command:
- `--skip-viral-audit` — Skip the audit entirely.
- `--viral-platform TikTok` — Target a different platform.
- `--viral-niche "SaaS"` — Specify a content niche for the audit.

> **Note:** The audit requires `GEMINI_API_KEY` to be set in `Blueprints/.env` or in your environment, and the `google-genai` package must be installed. If either is missing, the pipeline logs a warning and continues without failing.

---

## 3. The User Operational Sequence (From the Top)

This execution runbook focuses on your direct, high-level creative decisions to produce a validated video marketing run:

```
[ STEP 1: PARSE SIGNAL ]
   Review the daily brief located at Email reports/<date>/daily_summary_YYYY-MM-DD.md.
   Identify the pain point, the 42-word speech sequence, and the designated target application.

[ STEP 2: STAGING CUSTOM ASSETS (Optional but Recommended) ]
   If you have specific brand assets, custom backgrounds, logo files, or specific graphics
   you want to feature in the video, either upload them to a workspace folder or drop them
   directly in the assistant chat.
       │
       └── On ingest, the system automatically moves those files into the Remotion /assets/
           directory and updates the props.json pointers to use your uploads.

[ STEP 3: TRIGGER COMPILATION ]
   Say "render" or "run the daily summary for <date> with the uploaded assets!"
   The engine automatically handles the rest:
        - Infers lucide-react icons from the script text
        - Synthesizes voiceover audio (ElevenLabs / local)
        - Generates music/sfx beds
        - Calculates word-level timestamps via Whisper
        - Writes the complete props.json timeline
        - Renders the final vertical .mp4 video (1080x1920)

[ STEP 4: FINAL AUDIT AND DISTRIBUTION ]
   The Viral Video Predictor runs automatically as soon as the .mp4 is rendered.
   Open the generated `<video_name>_virality_audit.md` file next to the output video.
   Verify the Virality Score exceeds 85 and that the first-3-second hold rate is maximized.
   Accept or incorporate actionable algorithmic fixes before distribution.
```

By maintaining this rigid, programmatic alignment across ingestion indices, lightweight vector designs, motion frameworks, and analytics, Passaggio ensures its organic distribution pipelines remain highly scalable, automated, and mathematically optimized for short-form video algorithms.

---

## Remote Production Pipeline (Telegram API Bridge)

This section documents the lightweight, highly secure local Node.js bridge (`telegram_bridge.js`) that enables remote control of the Remotion workspace via a private Telegram Bot interface.

### Environment Variables

The bridge loads its configuration from `Blueprints/.env`:

| Variable | Description |
|----------|-------------|
| `TELEGRAM_TOKEN` | Bot token from @BotFather (required) |
| `CHAT_ID` | Your personal Telegram chat ID (hardcoded as `ALLOWED_USER_ID`) |

### Required User Access Variables

- **`ALLOWED_USER_ID`** (hardcoded in `telegram_bridge.js`): `7916710756`
  - Only this Telegram user can interact with the bot.
  - All other users are silently logged and denied access immediately.

### Available Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Confirm bridge online status and list commands |
| `/render` | Execute `npm run render` inside the `remotion/` directory |

### Additional Capabilities

- **Blueprint Ingestion**: Send raw JSON or a markdown code block (```json ... ```) to update `remotion/props.json` dynamically.
- **Zero Trust Gate**: All incoming requests are filtered by `ALLOWED_USER_ID`. No system functions are exposed to unauthorized users.

### Running the Bridge

```bash
node telegram_bridge.js
```

Ensure `Blueprints/.env` contains a valid `TELEGRAM_TOKEN` before starting.
