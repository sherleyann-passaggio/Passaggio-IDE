# 🛡️ Passaggio App Ecosystem — Production Readiness Checklist

> **Version:** 1.0.0  
> **Last Updated:** 2026-06-10  
> **Applies to:** All 6 Core B2B Apps (Lease Guard, Lexa Legal, Service Trades, Lead Sculptor, OpsAnalyst, Omni-Channel)

---

## 📋 Pre-Deployment Verification

### Build-Time Configuration
- [ ] `.passaggio.config.json` exists in project root and is valid JSON
- [ ] `clientSlug` is unique and URL-safe (no spaces, lowercase, hyphens only)
- [ ] `clientName` is human-readable and appears correctly in branding
- [ ] `firebase` block contains **client-specific** project credentials (NOT the default Passaggio project)
- [ ] `aiProvider` is permitted under current `privacyMode`:
  - `private` mode → only `vertex` or `local` allowed
  - `standard` mode → any provider permitted
- [ ] All `enabled: true` third-party integrations have acknowledged privacy disclaimers
- [ ] `schemaVersion` matches current config schema (currently `1.0.0`)

### Security & Privacy
- [ ] **No API keys committed to git** — all secrets injected at build time or stored in Firebase Cloud Functions
- [ ] Firebase config uses **per-client project isolation** (not shared `the-passaggio-app` project)
- [ ] Firestore security rules (`firestore.rules`) are deployed and tested
- [ ] `privacyMode: 'private'` deployments have **zero** third-party integrations enabled
- [ ] Maps/Twilio/Slack/Jira/HubSpot/Zendesk/Intercom integrations all require explicit opt-in + disclaimer acknowledgment
- [ ] Document processing happens **server-side** (Cloud Functions) — never client-side for sensitive data
- [ ] AI inference for legal/medical/financial data uses **Vertex AI** (enterprise GCP) or **local Hermes**

### Bundle & Performance
- [ ] `npm run build` completes without errors
- [ ] Bundle size is under 500KB gzipped for core shell
- [ ] Disabled features are tree-shaken (verify via `vite-bundle-visualizer` if needed)
- [ ] React.lazy() chunks load correctly for enabled modules
- [ ] No console errors in production build
- [ ] `__PASSAGGIO_CONFIG__` is correctly injected (verify in built `index.html` or network tab)

### Firebase Deployment
- [ ] `firebase login` is authenticated with client-specific GCP account
- [ ] `firebase use --add <client-project-id>` is configured
- [ ] Firestore database is provisioned (check `firestoreDatabaseId` in config)
- [ ] Firebase Hosting target is set: `firebase target:apply hosting <client-slug> <client-site-id>`
- [ ] Cloud Functions deployed (if using server-side AI processing)
- [ ] Firebase Auth is configured with appropriate sign-in methods (Email/Password, Google, etc.)

---

## 🚀 Deployment Pipeline

### Step 1: Client Intake → Config Generation
```bash
# After $50 Architecture Discovery, the Intelligence Layer generates a config recommendation
# The developer copies the recommended config into .passaggio.config.json
```

### Step 2: Build
```bash
cd <app-directory>
# Place client config
cp configs/<client-slug>.passaggio.config.json .passaggio.config.json
# Install dependencies
npm ci
# Build client-specific bundle
npm run build
```

### Step 3: Firebase Deploy
```bash
# Switch to client project
firebase use <client-project-id>
# Deploy hosting + firestore rules
firebase deploy --only hosting,firestore:rules
# Deploy Cloud Functions (if applicable)
firebase deploy --only functions
```

### Step 4: Post-Deploy Verification
- [ ] App loads at `https://<client-slug>.web.app`
- [ ] Branding colors/name are correctly applied
- [ ] Only enabled features appear in sidebar/navigation
- [ ] Disabled features show "locked" or "not included" states (not crashes)
- [ ] Auth flow works (sign up / sign in / password reset)
- [ ] AI analysis produces results (test with sample document/data)
- [ ] Privacy disclaimers appear for any third-party integrations
- [ ] Mobile responsive (test on 375px width)

---

## 🔒 Privacy-First Compliance Matrix

| App | Default Privacy Mode | Default AI Provider | Third-Party Risk Level |
|-----|---------------------|---------------------|------------------------|
| Lease Guard AI | `standard` | `gemini` | Medium (Maps opt-in) |
| Lexa Legal | `private` | `vertex` | Low (no third-party default) |
| Service Trades | `standard` | `gemini` | High (Maps + Twilio opt-in) |
| Lead Sculptor | `private` | `vertex` | Low (no third-party default) |
| OpsAnalyst | `private` | `local` | Low (Slack/Jira/Zendesk opt-in) |
| Omni-Channel | `standard` | `gemini` | Medium (Slack/Zendesk/Intercom opt-in) |

---

## 🧪 Demo-Ready Criteria ($50 Architecture Discovery Flow)

Before presenting to a client, verify:

- [ ] **2-Minute Build**: From config placement to deployed preview URL in < 2 minutes
- [ ] **Branded Experience**: Client name, colors, and logo appear throughout
- [ ] **Feature-Gated Navigation**: Only purchased modules are visible
- [ ] **Upsell Hooks**: Locked modules show clear "Upgrade to Unlock" CTAs
- [ ] **Sample Data**: Pre-loaded demo data shows the app's value in 30 seconds
- [ ] **Mobile-First**: Primary workflows work on a phone screen
- [ ] **No "Under Construction"**: Every visible feature is functional
- [ ] **Privacy Badge**: "Private-by-Default" or "Enterprise-Secure" badge visible for private-mode apps

---

## 📦 Care Plan Upsell Hooks

Each app has natural upgrade paths built into the feature config:

| Base Feature | Upsell Module | Price Anchor |
|-------------|---------------|--------------|
| Single document upload | Batch processing | +$200/mo |
| Basic AI summary | Advanced risk scoring | +$300/mo |
| Standard dashboard | Founding Partner tier | +$500/mo |
| Internal analysis only | Third-party integrations | +$150/mo each |
| Gemini AI | Vertex AI (enterprise) | +$400/mo |
| Email support | Slack/Teams connector | +$100/mo |

---

## 🔄 Rollback Plan

If a deployment fails:

1. **Immediate**: `firebase hosting:clone <client-site-id>:live <client-site-id>:rollback`
2. **Config Fix**: Update `.passaggio.config.json` and rebuild
3. **Full Reset**: Re-deploy previous known-good version from git tag

---

## 📞 Emergency Contacts

| Issue | Escalation |
|-------|-----------|
| Firebase outage | Check [Firebase Status](https://status.firebase.google.com/) |
| AI provider failure | Fallback to `local` provider via config swap |
| Privacy breach | Immediately set `privacyMode: 'private'` and redeploy |
| Build failure | Check `vite build` output; verify `.passaggio.config.json` syntax |

---

*This checklist is a living document. Update as the ecosystem evolves.*
