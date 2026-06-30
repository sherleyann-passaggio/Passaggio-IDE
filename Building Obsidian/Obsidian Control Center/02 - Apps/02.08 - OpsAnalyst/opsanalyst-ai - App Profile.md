---
type: app
app_slug: opsanalyst-ai
app_name: OpsAnalyst AI
app_number: 8
episode: 8
cta_keyword: WATCH
status: active
privacy_mode: private
default_ai_provider: local
workspace_path: /Users/sherleybelleus/Downloads/opsanalyst-ai
demo_route: /demo
demo_status: missing
repo_status: needs-attention
health_score: 65
last_audit: 2026-06-13
primary_pain: "make com errors"
description: "Enterprise-grade Process Analyst AI Employee dashboard. Maps out company processes, highlights bottlenecks, provides strategic automated efficiency fixes, and calculates ROI/Labor Loss."
dependencies: [firebase, express, recharts, clsx, tailwind-merge]
stack: [react, vite, tailwindcss, typescript, firebase, recharts]
tags: [app, process-analysis, enterprise, b2b, private-mode]
---

# OpsAnalyst AI

> Enterprise-grade Process Analyst AI Employee dashboard. Maps out company processes, highlights bottlenecks, provides strategic automated efficiency fixes, and calculates ROI/Labor Loss.

---

## 📋 Metadata

| Field | Value |
|-------|-------|
| **Slug** | `opsanalyst-ai` |
| **Episode** | Ep.8 |
| **CTA** | `WATCH` |
| **Privacy Mode** | **private** |
| **AI Provider** | **local** |
| **Health Score** | 65/100 |

---

## 🎯 Primary Pain Point

"Why your no-code automations silently break"

**Kindergarten Translation:** Your Zapier/Make.com workflows fail at 2 AM and nobody knows until Monday morning when 50 orders are stuck.

---

## 🏗️ Architecture Decisions

- **Privacy-First:** `privacyMode: private` with local Hermes inference for sensitive process data.
- **Process Mapping:** Visual workflow builder with bottleneck detection.
- **ROI Calculator:** Labor cost vs automation savings with payback period.
- **Integration Opt-ins:** Slack, Jira, Zendesk connectors (explicit consent required).
- **Charts:** Recharts for trend visualization.

---

## 📦 Dependencies

- Firebase (Auth, Firestore, Hosting)
- Express (webhook monitoring)
- Recharts (analytics dashboards)
- Local Hermes (on-device AI inference)
- Optional: Slack, Jira, Zendesk connectors

---

## 🧪 Demo Status

- [ ] `/demo` route exists
- [ ] Mock data loads
- [ ] Renders without login wall
- [ ] Screenshots captured for Remotion

---

## 🔗 Related

- [[Ep.08 - opsanalyst-ai - Why Your No-Code Automations Silently Break]]
- [[opsanalyst-ai - Feature Manifest]]
- [[2026-06-13 - opsanalyst-ai - Readiness Audit]]
