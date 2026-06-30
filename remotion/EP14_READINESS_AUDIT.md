# Episode 14 — Omni-Channel Concierge Readiness Audit

> **Date:** 2026-06-16  
> **Composition:** `PremiumShortComposition`  
> **Props:** `remotion/props.json`  
> **Episode:** Ep.14 | Omni-Channel Concierge — Drowning in Support Emails?

---

## 1. Content & Script

| Item | Status | Notes |
|------|--------|-------|
| Voiceover asset | ✅ Ready | `./audio/ep14-omniconcierge-voiceover.wav` exists |
| Word-level timestamps | ✅ Ready | 28 words, 0.0s – 12.3s |
| Hook text | ✅ Ready | "DROWNING IN SUPPORT EMAILS?" |
| CTA keyword | ✅ Ready | "START" |
| Script-to-timestamp alignment | ✅ Ready | Matches existing props.json script |

---

## 2. Visual Transitions (Inbox → Form → Plan)

| Phase | Time | Asset | Status | Notes |
|-------|------|-------|--------|-------|
| Hook / Inbox | 0–3s | `ep14-omniconcierge-plan.png` | ⚠️ Placeholder | Inbox screenshot not yet captured |
| Demo / Intake Form | 3–8s | `ep14-omniconcierge-plan.png` | ⚠️ Placeholder | Form screenshot not yet captured |
| Demo / Resolution Plan | 8–15s | `ep14-omniconcierge-plan.png` | ✅ Ready | Plan screenshot exists |

**Action required:** Capture and drop `ep14-omniconcierge-inbox.png` and `ep14-omniconcierge-form.png` into `remotion/assets/`, then update `sceneSchedule` and `appScreenshot` in `props.json`.

---

## 3. Click Schedule

| # | Target | Time | X | Y | Purpose |
|---|--------|------|---|---|---------|
| 1 | Inbox → Intake Form transition | 3.0s | 50 | 45 | Demo phase start |
| 2 | Intake Form → Resolution Plan | 6.9s | 50 | 55 | Mid-demo focus shift |
| 3 | Resolution Plan "Start" CTA | 11.2s | 72 | 34 | Primary CTA |

---

## 4. Render Tests

| Test | Command | Status | Output | Notes |
|------|---------|--------|--------|-------|
| Test frame (frame 150) | `npx remotion render ... --frame 150` | ❌ Blocked | No output file | CLI hangs during browser launch |
| Test 15s video | `npx remotion render ...` | ❌ Blocked | No output file | Same hang |

**Root cause:** `npx remotion render` reaches `[openBrowser()] Opening browser: ... Google Chrome` and stalls. This is an environment/render-pipeline issue, not a props/content issue.

---

## 5. Known Issues & Blockers

| # | Issue | Severity | Owner / Next Step |
|---|-------|----------|-------------------|
| 1 | Remotion CLI hangs at Chrome browser launch | 🔴 Blocker | Investigate Chrome executable / headless flags / Remotion config |
| 2 | Missing inbox and form screenshot assets | 🟡 Medium | Capture from omni-channel-concierge demo and add to `remotion/assets/` |
| 3 | `remotion.config.ts` warning: `"./src/theme" should be marked as external` | 🟢 Low | Non-blocking warning; can be cleaned up later |

---

## 6. Recommended Next Steps

1. **Unblock renders:** Try launching Remotion with explicit Chrome path or headless flag, e.g.:
   ```bash
   cd remotion
   npx remotion render src/index.ts PremiumShortComposition --props ./props.json --output /tmp/ep14-test.mp4 --browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   ```
   If still hanging, test with `--browser=chrome` or check macOS permissions / Chrome updates.
2. **Capture missing assets:** Use Playwright/screenshot tool to generate:
   - `remotion/assets/ep14-omniconcierge-inbox.png`
   - `remotion/assets/ep14-omniconcierge-form.png`
3. **Update props.json:** Point `sceneSchedule` entries to the correct phase assets.
4. **Re-run render tests:** Frame 150 (5s) and full 15s video.

---

## 7. Sign-Off

| Role | Status |
|------|--------|
| Content ready | ✅ |
| Props configured | ✅ |
| Visual assets | ⚠️ Partial (1/3) |
| Render pipeline | ❌ Blocked |
| Video delivered | ❌ Not yet |

**Verdict:** Episode 14 is content-ready and props-configured, but cannot be rendered until the Remotion/Chrome launch hang is resolved and the missing inbox/form screenshots are added.
