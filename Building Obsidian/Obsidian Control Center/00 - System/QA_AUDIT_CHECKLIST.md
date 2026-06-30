# QA_AUDIT_CHECKLIST.md

> Master checklist referenced by all readiness, handoff, security, and performance audits.

---

## Build-Time Configuration

- [ ] `.passaggio.config.json` exists and is valid JSON
- [ ] `clientSlug` is unique and URL-safe (lowercase, hyphens only)
- [ ] `clientName` is human-readable
- [ ] `firebase` block contains client-specific credentials
- [ ] `aiProvider` is permitted under current `privacyMode`
- [ ] All `enabled: true` third-party integrations have privacy disclaimers
- [ ] `schemaVersion` matches current config schema

## Security & Privacy

- [ ] No API keys committed to git
- [ ] Firebase config uses per-client project isolation
- [ ] Firestore security rules deployed and tested
- [ ] `privacyMode: 'private'` has zero third-party integrations
- [ ] Maps/Twilio/Slack/Jira/HubSpot/Zendesk/Intercom integrations require explicit opt-in
- [ ] Document processing happens server-side
- [ ] AI inference for legal/medical/financial data uses Vertex AI or local Hermes

## Bundle & Performance

- [ ] `npm run build` completes without errors
- [ ] Bundle size under 500KB gzipped for core shell
- [ ] Disabled features are tree-shaken
- [ ] React.lazy() chunks load correctly
- [ ] No console errors in production build
- [ ] `__PASSAGGIO_CONFIG__` correctly injected

## Firebase Deployment

- [ ] `firebase login` authenticated with client-specific GCP account
- [ ] `firebase use --add <client-project-id>` configured
- [ ] Firestore database provisioned
- [ ] Firebase Hosting target set
- [ ] Cloud Functions deployed (if applicable)
- [ ] Firebase Auth configured with appropriate sign-in methods

## Demo-Ready Criteria

- [ ] 2-minute build to deployed preview URL
- [ ] Branded experience (name, color, logo)
- [ ] Feature-gated navigation (only purchased modules visible)
- [ ] Upsell hooks (locked modules show "Upgrade to Unlock")
- [ ] Sample data pre-loaded and realistic
- [ ] Mobile-first workflows (test on 375px width)
- [ ] No "Under Construction" states
- [ ] Privacy badge visible for private-mode apps

---

*This checklist is a living document. Update as the ecosystem evolves.*
