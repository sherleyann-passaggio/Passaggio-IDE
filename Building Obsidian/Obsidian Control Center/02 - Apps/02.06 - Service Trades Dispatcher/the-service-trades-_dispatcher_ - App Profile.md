---
type: app
app_slug: the-service-trades-_dispatcher_
app_name: Service Trades Dispatcher
app_number: 6
episode: 6
cta_keyword: DISPATCH
status: active
privacy_mode: standard
default_ai_provider: gemini
workspace_path: /Users/sherleybelleus/Downloads/the-service-trades-_dispatcher_
demo_route: /demo
demo_status: missing
repo_status: needs-attention
health_score: 65
last_audit: 2026-06-13
primary_pain: "hvac dispatching software"
description: "Field service automation platform for blue-collar trades — HVAC, plumbing, electrical."
dependencies: [firebase, express, react-firebase-hooks]
stack: [react, vite, tailwindcss, typescript, firebase]
tags: [app, field-service, dispatch, b2b]
---

# Service Trades Dispatcher

> Field service automation platform for blue-collar trades — HVAC, plumbing, electrical.

---

## 📋 Metadata

| Field | Value |
|-------|-------|
| **Slug** | `the-service-trades-_dispatcher_` |
| **Episode** | Ep.6 |
| **CTA** | `DISPATCH` |
| **Privacy Mode** | standard |
| **AI Provider** | gemini |
| **Health Score** | 65/100 |

---

## 🎯 Primary Pain Point

"Blue collar shops are losing millions here"

**Kindergarten Translation:** Emergency repair calls go to voicemail while competitors with dispatch software steal the job and the revenue.

---

## 🏗️ Architecture Decisions

- **Emergency Queue:** Real-time dispatch board with priority routing.
- **Job Cards:** Structured work orders with parts, labor, and customer history.
- **Field Tech Mobile:** Optimized for phone screens in trucks and basements.
- **Twilio Integration:** SMS/voice dispatch alerts (opt-in, standard mode only).

---

## 📦 Dependencies

- Firebase (Auth, Firestore, Hosting)
- Express (webhook integrations)
- React Firebase Hooks (real-time sync)
- Twilio (optional, opt-in for SMS dispatch)

---

## 🧪 Demo Status

- [ ] `/demo` route exists
- [ ] Mock data loads
- [ ] Renders without login wall
- [ ] Screenshots captured for Remotion

---

## 🔗 Related

- [[Ep.06 - the-service-trades-_dispatcher_ - Blue Collar Shops Are Losing Millions Here]]
- [[the-service-trades-_dispatcher_ - Feature Manifest]]
- [[2026-06-13 - the-service-trades-_dispatcher_ - Readiness Audit]]
