---
type: app
app_slug: omni-channel-concierge
app_name: Omni-Channel Concierge
app_number: 9
episode: 9
cta_keyword: CONCIERGE
status: active
privacy_mode: standard
default_ai_provider: gemini
workspace_path: /Users/sherleybelleus/Downloads/omni-channel-concierge
demo_route: /demo
demo_status: missing
repo_status: needs-attention
health_score: 65
last_audit: 2026-06-13
primary_pain: "zendesk pricing alternative"
description: "An AI Employee interface featuring unified inbox, auto-pilot statuses, branded knowledge portal, and success analytics."
dependencies: [firebase, express, recharts, dotenv]
stack: [react, vite, tailwindcss, typescript, firebase, recharts]
tags: [app, customer-support, ai-employee, b2b]
---

# Omni-Channel Concierge

> An AI Employee interface featuring unified inbox, auto-pilot statuses, branded knowledge portal, and success analytics.

---

## 📋 Metadata

| Field | Value |
|-------|-------|
| **Slug** | `omni-channel-concierge` |
| **Episode** | Ep.9 |
| **CTA** | `CONCIERGE` |
| **Privacy Mode** | standard |
| **AI Provider** | gemini |
| **Health Score** | 65/100 |

---

## 🎯 Primary Pain Point

"The hidden 'Zendesk tax' killing your margin"

**Kindergarten Translation:** You're paying $150/seat for support software that doesn't even answer the questions. An AI employee handles tickets 24/7 for the price of coffee.

---

## 🏗️ Architecture Decisions

- **Unified Inbox:** Single dashboard for email, chat, and social DMs.
- **Auto-Pilot:** AI draft responses with human approval toggle.
- **Knowledge Portal:** Self-service FAQ that learns from resolved tickets.
- **Success Analytics:** Response time, resolution rate, CSAT via Recharts.
- **Integration Opt-ins:** Slack, Zendesk, Intercom, Teams connectors.

---

## 📦 Dependencies

- Firebase (Auth, Firestore, Hosting)
- Express (channel webhook router)
- Recharts (support analytics)
- Google GenAI (Gemini for response drafting)

---

## 🧪 Demo Status

- [ ] `/demo` route exists
- [ ] Mock data loads
- [ ] Renders without login wall
- [ ] Screenshots captured for Remotion

---

## 🔗 Related

- [[Ep.09 - omni-channel-concierge - The Hidden Zendesk Tax Killing Your Margin]]
- [[omni-channel-concierge - Feature Manifest]]
- [[2026-06-13 - omni-channel-concierge - Readiness Audit]]
