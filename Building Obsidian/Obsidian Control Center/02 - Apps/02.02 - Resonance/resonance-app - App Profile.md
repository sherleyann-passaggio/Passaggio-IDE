---
type: app
app_slug: resonance-app
app_name: Resonance
app_number: 2
episode: 2
cta_keyword: VERIFY
status: active
privacy_mode: standard
default_ai_provider: gemini
workspace_path: /Users/sherleybelleus/Downloads/resonance-app-(beta) (1)
demo_route: /demo
demo_status: missing
repo_status: needs-attention
health_score: 65
last_audit: 2026-06-13
primary_pain: "paying influencers with fake followers"
description: "A high-trust, real-world social connection app with a dark eco-luxury glassmorphism UI."
dependencies: [firebase, stripe, google-maps, express, recharts]
stack: [react, vite, tailwindcss, typescript, firebase, google-maps]
tags: [app, social, dating, trust, b2c]
---

# Resonance

> A high-trust, real-world social connection app with a dark eco-luxury glassmorphism UI.

---

## 📋 Metadata

| Field | Value |
|-------|-------|
| **Slug** | `resonance-app` |
| **Episode** | Ep.2 |
| **CTA** | `VERIFY` |
| **Privacy Mode** | standard |
| **AI Provider** | gemini |
| **Health Score** | 65/100 |

---

## 🎯 Primary Pain Point

"Paying influencers with fake followers"

**Kindergarten Translation:** Brands are burning budgets on creators with bot followers — no real audience, no real ROI.

---

## 🏗️ Architecture Decisions

- **Trust Score:** Multi-factor authenticity scoring (follower ratio, engagement rate, platform verification).
- **Stripe Identity:** Government ID upload + selfie matching for creator verification.
- **Geolocation:** `geolocation` frame permission for real-world event matching.
- **Analytics:** Recharts dashboards for campaign ROI tracking.

---

## 📦 Dependencies

- Firebase (Auth, Firestore, Hosting)
- Stripe (Identity verification + payouts)
- Google Maps Services (event proximity)
- Recharts (analytics dashboards)

---

## 🧪 Demo Status

- [ ] `/demo` route exists
- [ ] Mock data loads
- [ ] Renders without login wall
- [ ] Screenshots captured for Remotion

---

## 🔗 Related

- [[Ep.02 - resonance-app - Spotting a Romance Scam in 3 Seconds]]
- [[resonance-app - Feature Manifest]]
- [[2026-06-13 - resonance-app - Readiness Audit]]
