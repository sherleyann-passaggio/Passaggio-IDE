---
type: app
app_slug: lease-guard-ai
app_name: Lease Guard AI
app_number: 4
episode: 4
cta_keyword: LEASE
status: active
privacy_mode: standard
default_ai_provider: gemini
workspace_path: /Users/sherleybelleus/Downloads/lease-guard-ai
demo_route: /demo
demo_status: missing
repo_status: needs-attention
health_score: 65
last_audit: 2026-06-13
primary_pain: "property management automation"
description: "Real Estate AI Assistant to parse and audit commercial leases."
dependencies: [firebase, express, dotenv]
stack: [react, vite, tailwindcss, typescript, firebase]
tags: [app, real-estate, legal, b2b]
---

# Lease Guard AI

> Real Estate AI Assistant to parse and audit commercial leases.

---

## 📋 Metadata

| Field | Value |
|-------|-------|
| **Slug** | `lease-guard-ai` |
| **Episode** | Ep.4 |
| **CTA** | `LEASE` |
| **Privacy Mode** | standard |
| **AI Provider** | gemini |
| **Health Score** | 65/100 |

---

## 🎯 Primary Pain Point

"The $10,000 lease mistake"

**Kindergarten Translation:** Property managers miss hidden fees and risky clauses because they read leases like novels instead of having an AI highlight the danger.

---

## 🏗️ Architecture Decisions

- **Document Parsing:** Server-side AI analysis of lease PDFs for risk scoring.
- **Clause Extraction:** Automated identification of renewal terms, penalties, and insurance requirements.
- **Risk Dashboard:** Visual risk score with color-coded severity.

---

## 📦 Dependencies

- Firebase (Auth, Firestore, Hosting, Cloud Functions)
- Express (document upload proxy)
- Google GenAI (Gemini 2.5 Pro for document parsing)

---

## 🧪 Demo Status

- [ ] `/demo` route exists
- [ ] Mock data loads
- [ ] Renders without login wall
- [ ] Screenshots captured for Remotion

---

## 🔗 Related

- [[Ep.04 - lease-guard-ai - The $10,000 Lease Mistake]]
- [[lease-guard-ai - Feature Manifest]]
- [[2026-06-13 - lease-guard-ai - Readiness Audit]]
