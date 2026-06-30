---
type: audit
audit_date: YYYY-MM-DD
audit_type: readiness
target_type: app
target_slug: TARGET_SLUG
auditor: cline
status: needs-work
findings: 0
critical: 0
major: 0
minor: 0
next_audit:
tags: [audit]
---

# YYYY-MM-DD — [Target] — [Type] Audit

---

## ✅ Checklist

### Build-Time Configuration
- [ ] `.passaggio.config.json` exists and is valid JSON
- [ ] `clientSlug` is unique and URL-safe
- [ ] `clientName` is human-readable
- [ ] `firebase` block contains client-specific credentials
- [ ] `aiProvider` is permitted under current `privacyMode`
- [ ] `schemaVersion` matches current config schema

### Security & Privacy
- [ ] No API keys committed to git
- [ ] Firebase config uses per-client project isolation
- [ ] Firestore security rules deployed and tested
- [ ] `privacyMode: 'private'` has zero third-party integrations
- [ ] Document processing happens server-side

### Bundle & Performance
- [ ] `npm run build` completes without errors
- [ ] Bundle size under 500KB gzipped
- [ ] No console errors in production build
- [ ] `__PASSAGGIO_CONFIG__` correctly injected

### Firebase Deployment
- [ ] `firebase login` authenticated
- [ ] Hosting target set
- [ ] Cloud Functions deployed (if applicable)
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
| 🔴 Critical | {{critical}} |
| 🟠 Major | {{major}} |
| 🟡 Minor | {{minor}} |

---

## 📝 Notes

---

## 🔗 Related

- [[{{target_slug}} - App Profile]]
