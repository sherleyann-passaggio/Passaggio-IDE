# 🤝 Passaggio Client Handoff Protocol

> **Version:** 1.0.0  
> **Last Updated:** 2026-06-10  
> **Trigger:** After $50 Architecture Discovery + $450 Custom Build completion
> **Goal:** Deliver a production-ready, client-specific app with full documentation

---

## 🎯 The Handoff Promise

> *"Before you pay another dollar, you will see exactly how your app works — with your name, your colors, and your data."*

Every client receives:
1. **Live Demo URL** — Branded, functional, deployed to Firebase Hosting
2. **Owner's Manual PDF** — Auto-generated from their feature manifest
3. **Feature Manifest** — JSON file showing exactly what they bought
4. **Instructional Video** — 3-5 minute walkthrough (Remotion-generated)
5. **Care Plan Proposal** — Monthly maintenance + upgrade options

---

## 📋 Phase 1: Pre-Handoff Checklist (Internal)

Before contacting the client, verify:

- [ ] App builds successfully with client's `.passaggio.config.json`
- [ ] Firebase deployed to client-specific project
- [ ] All enabled features tested with sample data
- [ ] Branding (name, color, logo) correctly applied
- [ ] Auth flow works (test sign-up with dummy email)
- [ ] AI analysis produces meaningful output (test with client-relevant sample)
- [ ] Mobile responsive on iPhone SE (375px width)
- [ ] No console errors or 404s in Network tab
- [ ] Privacy disclaimers visible for any third-party integrations
- [ ] "Locked" features show upsell CTAs (not crashes)
- [ ] Demo data is pre-loaded and realistic

---

## 🎬 Phase 2: Demo Asset Generation

### 2A. Live Demo URL
```bash
# Deploy to Firebase Hosting preview channel
firebase hosting:channel:deploy demo-<client-slug> --expires 7d
# Output: https://<client-project-id>--demo-<client-slug>-<hash>.web.app
```

**Share this URL with the client.** It is live for 7 days and isolated from production.

### 2B. Owner's Manual PDF (Auto-Generated)

Generated from the client's `feature-manifest.json` via a Cloud Function:

```javascript
// Pseudo-code for PDF generation
const doc = new PDFDocument();
doc.fontSize(24).text(`${clientName} — Owner's Manual`, 50, 50);
doc.fontSize(14).text(`Generated: ${new Date().toISOString()}`);
doc.moveDown();
doc.fontSize(16).text('Your Feature Set');
enabledFeatures.forEach(f => doc.text(`✓ ${f.name}: ${f.description}`));
doc.moveDown();
doc.fontSize(16).text('Upgrade Options');
lockedFeatures.forEach(f => doc.text(`🔒 ${f.name}: ${f.upsellPrice}`));
doc.end();
```

**Contents:**
- Cover page with client branding
- Table of enabled features with screenshots
- "How to Use" section for each module
- Privacy & Security summary
- Upgrade path (Care Plan upsell)
- Support contact info

### 2C. Instructional Video (Remotion)

Using the existing Remotion pipeline in `/remotion/`:

```typescript
// remotion/src/compositions/ClientHandoffVideo.tsx
// Auto-generated based on feature-manifest.json

export const ClientHandoffVideo: React.FC<{
  clientName: string;
  appName: string;
  features: string[];
  demoUrl: string;
}> = ({ clientName, appName, features, demoUrl }) => {
  return (
    <Sequence durationInFrames={900}>
      {/* 0-5s: Hook */}
      <TitleOverlay text={`${clientName}, your ${appName} is ready.`} />
      {/* 5-20s: Feature walkthrough */}
      {features.map((f, i) => (
        <FeatureDemo key={f} feature={f} startFrame={150 + i * 150} />
      ))}
      {/* Final: CTA */}
      <CTAOverlay text={`Visit your demo: ${demoUrl}`} />
    </Sequence>
  );
};
```

**Video Structure (3-5 minutes):**
1. **0:00-0:05** — Personalized hook: *"[Client Name], your custom [App Name] is live."*
2. **0:05-0:30** — Dashboard overview with their branding
3. **0:30-2:00** — Walk through each enabled feature with real data
4. **2:00-3:00** — Show a "locked" feature and explain the upgrade path
5. **3:00-3:30** — Privacy & security reassurance
6. **3:30-4:00** — Demo URL + next steps (Care Plan)

### 2D. Feature Manifest JSON

```json
{
  "clientSlug": "acme-realty",
  "clientName": "Acme Realty Group",
  "appId": "lease-guard",
  "deployedAt": "2026-06-10T15:30:00Z",
  "demoUrl": "https://acme-realty-leaseguard--demo-acme-realty-abc123.web.app",
  "enabledFeatures": [
    { "key": "auth", "name": "Authentication", "tier": "core" },
    { "key": "dashboard", "name": "Analytics Dashboard", "tier": "core" },
    { "key": "upload", "name": "Document Upload", "tier": "core" },
    { "key": "aiAnalysis", "name": "AI Lease Analysis", "tier": "core" },
    { "key": "riskScoring", "name": "Risk Scoring", "tier": "core" },
    { "key": "documentExport", "name": "Export to PDF", "tier": "core" }
  ],
  "lockedFeatures": [
    { "key": "foundingPartner", "name": "Founding Partner Tier", "upsellPrice": "$500/mo" },
    { "key": "batchProcessing", "name": "Batch Processing", "upsellPrice": "$200/mo" },
    { "key": "mapsIntegration", "name": "Google Maps", "upsellPrice": "$150/mo" }
  ],
  "privacyMode": "private",
  "aiProvider": "vertex",
  "schemaVersion": "1.0.0"
}
```

---

## 📧 Phase 3: Client Delivery Email

**Subject:** `[Client Name], your custom [App Name] is ready — see it live`

**Body:**

```
Hi [Client Name],

Your custom [App Name] is built, deployed, and ready for your review.

🔗 LIVE DEMO: [Demo URL]
📄 OWNER'S MANUAL: [PDF Attachment]
🎥 WALKTHROUGH VIDEO: [Video Link]
📋 FEATURE MANIFEST: [JSON Attachment]

WHAT YOU'RE SEEING
------------------
This is YOUR app — branded with your colors, configured for your workflow,
and pre-loaded with sample data relevant to your business.

Every feature you see is fully functional. Every feature marked "locked"
can be unlocked with a Care Plan upgrade.

PRIVACY & SECURITY
------------------
✓ Your data lives in your own isolated Firebase project
✓ AI processing uses Google Cloud Vertex AI (enterprise-grade)
✓ No third-party integrations are active without your explicit consent
✓ Full audit trail of all document processing

NEXT STEPS
----------
1. Review the demo (link expires in 7 days)
2. Reply with any feedback or change requests
3. When you're satisfied, we'll transfer full ownership
4. Optional: Add a Care Plan for ongoing maintenance + upgrades

QUESTIONS?
----------
Reply to this email or book a 15-min call: [Calendly Link]

— The Passaggio Team
```

---

## 💼 Phase 4: Care Plan Upsell

During the handoff call/video, present these tiers:

### 🥉 Foundation Care — $99/mo
- Monthly security patches
- Firebase monitoring & alerts
- Email support (48h response)
- Quarterly feature reviews

### 🥈 Growth Care — $299/mo
- Everything in Foundation
- Priority support (24h response)
- 1 unlocked premium feature/month
- Monthly performance reports
- A/B testing for conversion optimization

### 🥇 Sovereign Care — $599/mo
- Everything in Growth
- Dedicated account manager
- Unlimited feature unlocks
- Custom AI model fine-tuning
- White-label options
- Annual security audit

---

## ✅ Phase 5: Client Sign-Off

Before final access transfer:

- [ ] Client confirms demo meets requirements
- [ ] Client acknowledges feature manifest (signed or email reply)
- [ ] Client accepts privacy & security terms
- [ ] Firebase project ownership transferred to client's GCP account
- [ ] Client added as `owner` in Firebase console
- [ ] Passaggio retained as `editor` (for Care Plan maintenance)
- [ ] Final invoice sent (remaining balance after $50 Architecture Discovery)
- [ ] Care Plan subscription activated (if purchased)
- [ ] Support onboarding scheduled (if Care Plan purchased)

---

## 🔄 Post-Handoff: The Care Plan Loop

```
Client Request → Config Update → Rebuild → Redeploy → Notify Client
     ↑                                                              |
     └──────────────────────────────────────────────────────────────┘
```

Every Care Plan change follows this loop:
1. Client requests feature unlock or config change
2. Developer updates `.passaggio.config.json`
3. `npm run build` + `firebase deploy`
4. Client receives "Your app has been updated" notification
5. New feature appears instantly (no app store, no download)

---

## 📊 Handoff Metrics (Track These)

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Demo-to-Close Rate | > 60% | Measures build quality |
| Care Plan Attach Rate | > 40% | Measures upsell effectiveness |
| Time to Handoff | < 48h from intake | Measures operational speed |
| Client Satisfaction | > 4.5/5 | Measures product-market fit |
| Feature Unlock Rate | > 2 per client | Measures upsell success |

---

## 🚨 Red Flags — Do NOT Handoff If:

- [ ] App crashes on mobile
- [ ] AI returns nonsense for client-relevant data
- [ ] Branding is wrong (wrong color, wrong name)
- [ ] Auth flow is broken
- [ ] Demo data is generic (not relevant to client's industry)
- [ ] Privacy disclaimers are missing
- [ ] Build time > 5 minutes (indicates bloat)

---

*This protocol ensures every client receives a sovereign, secure, and stunning product — every time.*
