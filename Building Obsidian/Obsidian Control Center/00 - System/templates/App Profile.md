---
type: app
app_slug: APP_SLUG
app_name: App Display Name
app_number: 0
episode: 0
cta_keyword: KEYWORD
status: prototype
privacy_mode: standard
default_ai_provider: gemini
workspace_path:
demo_route: /demo
demo_status: missing
repo_status: clean
health_score: 0
last_audit:
primary_pain: ""
description: ""
dependencies: []
stack: []
tags: [app]
---

# App Name

> One-line value proposition.

---

## 📋 Metadata

| Field | Value |
|-------|-------|
| **Slug** | `{{app_slug}}` |
| **Episode** | Ep.{{episode}} |
| **CTA** | `{{cta_keyword}}` |
| **Privacy** | {{privacy_mode}} |
| **AI Provider** | {{default_ai_provider}} |
| **Health** | {{health_score}}/100 |

---

## 🎯 Primary Pain Point

{{primary_pain}}

---

## 🏗️ Architecture Decisions

- Decision 1
- Decision 2

---

## 📦 Dependencies

{{dependencies}}

---

## 🧪 Demo Status

- [ ] `/demo` route exists
- [ ] Mock data loads
- [ ] Renders without login wall
- [ ] Screenshots captured for Remotion

---

## 🔗 Related

- [[Ep.## - {{app_slug}} - Hook]]
- [[{{app_slug}} - Feature Manifest]]
- [[{{app_slug}} - QA Audit]]
