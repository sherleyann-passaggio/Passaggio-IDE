---
type: app
app_slug: lexa-discovery-agent--legal
app_name: Lexa Discovery Agent — Legal
app_number: 5
episode: 5
cta_keyword: AGENT
status: active
privacy_mode: private
default_ai_provider: vertex
workspace_path: /Users/sherleybelleus/Downloads/lexa-discovery-agent--legal
demo_route: /demo
demo_status: missing
repo_status: needs-attention
health_score: 65
last_audit: 2026-06-13
primary_pain: "legal document review ai"
description: "Functional interface for a Legal Discovery Agent featuring document indexing, risk flagging, and an interrogator chat."
dependencies: [firebase, express, dotenv]
stack: [react, vite, tailwindcss, typescript, firebase]
tags: [app, legal, discovery, b2b, private-mode]
---

# Lexa Discovery Agent — Legal

> Functional interface for a Legal Discovery Agent featuring document indexing, risk flagging, and an interrogator chat.

---

## 📋 Metadata

| Field | Value |
|-------|-------|
| **Slug** | `lexa-discovery-agent--legal` |
| **Episode** | Ep.5 |
| **CTA** | `AGENT` |
| **Privacy Mode** | **private** |
| **AI Provider** | **vertex** |
| **Health Score** | 65/100 |

---

## 🎯 Primary Pain Point

"Tech that replaces junior billable hours"

**Kindergarten Translation:** Law firms pay associates $400/hour to read boxes of documents. Lexa reads them in minutes and flags what matters.

---

## 🏗️ Architecture Decisions

- **Privacy-First:** `privacyMode: private` — zero third-party integrations by default.
- **Vertex AI:** Enterprise-grade AI processing in isolated GCP VPC.
- **Document Indexing:** Full-text search across uploaded discovery documents.
- **Interrogator Chat:** Natural language Q&A against document corpus.

---

## 📦 Dependencies

- Firebase (Auth, Firestore, Hosting, Cloud Functions)
- Express (secure document upload)
- Google Vertex AI (enterprise inference, zero data leakage)

---

## 🧪 Demo Status

- [ ] `/demo` route exists
- [ ] Mock data loads
- [ ] Renders without login wall
- [ ] Screenshots captured for Remotion

---

## 🔗 Related

- [[Ep.05 - lexa-discovery-agent--legal - Tech That Replaces Junior Billable Hours]]
- [[lexa-discovery-agent--legal - Feature Manifest]]
- [[2026-06-13 - lexa-discovery-agent--legal - Readiness Audit]]
