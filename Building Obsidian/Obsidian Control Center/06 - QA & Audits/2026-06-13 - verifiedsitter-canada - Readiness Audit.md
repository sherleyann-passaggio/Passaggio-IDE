---
type: audit
audit_date: 2026-06-13
audit_type: readiness
target_type: app
target_slug: verifiedsitter-canada
auditor: cline
status: needs-work
findings: 4
critical: 0
major: 2
minor: 2
next_audit: 2026-06-20
tags: [audit, readiness, verifiedsitter]
---

# 2026-06-13 — VerifiedSitter Canada — Readiness Audit

---

## ✅ Checklist

### Build-Time Configuration
- [x] `.passaggio.config.json` exists and is valid JSON
- [ ] `clientSlug` is unique and URL-safe — *not yet set for generic build*
- [ ] `clientName` is human-readable — *not yet set*
- [ ] `firebase` block contains client-specific credentials — *using default Passaggio project*
- [x] `aiProvider` is permitted under current `privacyMode`
- [x] `schemaVersion` matches current config schema

### Security & Privacy
- [x] No API keys committed to git
- [ ] Firebase config uses per-client project isolation — *using shared project*
- [ ] Firestore security rules deployed and tested
- [x] `privacyMode: 'private'` has zero third-party integrations — N/A (standard mode)
- [x] Document processing happens server-side

### Bundle & Performance
- [ ] `npm run build` completes without errors — *needs validation*
- [ ] Bundle size under 500KB gzipped
- [ ] No console errors in production build
- [ ] `__PASSAGGIO_CONFIG__` correctly injected

### Firebase Deployment
- [ ] `firebase login` authenticated with client-specific GCP account
- [ ] `firebase use --add` configured
- [ ] Firestore database provisioned
- [ ] Firebase Hosting target set
- [ ] Cloud Functions deployed
- [ ] Firebase Auth configured

### Demo-Ready Criteria
- [ ] 2-minute build to preview URL
- [ ] Branded experience
- [ ] Feature-gated navigation
- [ ] Upsell hooks visible
- [ ] Sample data pre-loaded
- [ ] Mobile-first workflows
- [ ] No "Under Construction"

---

## 📊 Findings Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 Major | 2 |
| 🟡 Minor | 2 |

---

## 📝 Notes

- App is in active development. Needs `/demo` route scaffolded.
- Regional toggle (CA vs US) not yet implemented in UI.
- Stripe Identity integration present but not wired to demo flow.

---

## 🔗 Related

- [[verifiedsitter-canada - App Profile]]
