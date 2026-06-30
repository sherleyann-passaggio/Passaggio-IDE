---
type: app
app_slug: verifiedsitter-canada
app_name: VerifiedSitter Canada
app_number: 1
episode: 1
cta_keyword: SAFE
status: active
privacy_mode: standard
default_ai_provider: gemini
workspace_path: /Users/sherleybelleus/Downloads/verifiedsitter-canada
demo_route: /demo
demo_status: missing
repo_status: needs-attention
health_score: 65
last_audit: 2026-06-13
primary_pain: "tracking verified background checks manually"
description: "A safety-first babysitting marketplace with map-based discovery and verification dashboards."
dependencies: [firebase, stripe, google-maps, geofire-common, better-sqlite3, express]
stack: [react, vite, tailwindcss, typescript, firebase, leaflet]
tags: [app, marketplace, b2c, childcare, canada]
---

# VerifiedSitter Canada

> A safety-first babysitting marketplace with map-based discovery and verification dashboards.

---

## 📋 Metadata

| Field | Value |
|-------|-------|
| **Slug** | `verifiedsitter-canada` |
| **Episode** | Ep.1 |
| **CTA** | `SAFE` |
| **Privacy Mode** | standard |
| **AI Provider** | gemini |
| **Health Score** | 65/100 |

---

## 🎯 Primary Pain Point

"Still tracking verified background checks manually"

**Kindergarten Translation:** Parents are stuck with paper checklists and long police wait times instead of one-click verified badges.

---

## 🏗️ Architecture Decisions

- **Regional Toggle:** CA variant uses Vulnerable Sector Check (VSC) via local police + manual queue. US variant uses Checkr API for instant results.
- **Geolocation:** `geolocation` frame permission requested; map-based discovery powered by Leaflet + GeoFire.
- **Payments:** Stripe Identity + Stripe Payments for verification and booking deposits.
- **Database:** Firebase Firestore with offline persistence via `better-sqlite3`.

---

## 📦 Dependencies

- Firebase (Auth, Firestore, Hosting)
- Stripe (Payments + Identity verification)
- Google Maps / Leaflet (discovery)
- GeoFire (proximity queries)
- Express (server-side VSC webhook handling)

---

## 🧪 Demo Status

- [ ] `/demo` route exists
- [ ] Mock data loads
- [ ] Renders without login wall
- [ ] Screenshots captured for Remotion

---

## 🔗 Related

- [[Ep.01 - verifiedsitter-canada - The Childcare Screening Loophole]]
- [[verifiedsitter-canada - Feature Manifest]]
- [[2026-06-13 - verifiedsitter-canada - Readiness Audit]]
