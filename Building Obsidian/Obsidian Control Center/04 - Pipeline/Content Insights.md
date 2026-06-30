---
type: sop
sop_name: "Content Insights"
version: 1.0
last_reviewed: 2026-06-13
owner: cline
automation_level: partial
tags: [sop, content, insights]
---

# Content Insights

> Living document of validated pain phrases from vidIQ and newsletter hooks. Replaces `content_insights.md`.

---

## 🏆 Validated Pain Phrases

```dataview
TABLE source_app, phrase, view_multiplier, date_validated
FROM "04 - Pipeline/Intelligence/Pain Phrases"
WHERE type = "pain-phrase" AND status = "active"
SORT view_multiplier DESC
```

---

## 📰 Newsletter Hooks

- 2026-06-13: VerifiedSitter — "vulnerable sector check delay" (ViewMult: 4.2x)
- 2026-06-13: Resonance — "dating app scams" (ViewMult: 3.8x)

---

## 🎯 Next Research Targets

| App | Keyword Seed | What to Hunt |
|-----|--------------|--------------|
| VerifiedSitter | `childcare canada`, `babysitter background check` | Parental anxiety, wait-time complaints |
| Resonance | `dating app scams`, `how to spot fake profiles` | Fraud horror stories |
| Passaggio | `vocal fatigue remedies`, `singer throat care` | Phrases by teachers, coaches |
| Lease Guard | `property management automation`, `commercial lease audit` | Overwhelmed property managers |
| Lexa Legal | `legal document review ai`, `law firm billable hours` | Teams cutting junior hours |
| Service Trades | `hvac dispatching software`, `plumbing leads generator` | Missed emergency calls |
| Lead Sculptor | `how to find creators for brand deals` | Brands burned by fake followers |
| OpsAnalyst | `make com errors`, `monday com limits` | Error-code searches |
| Omni Concierge | `zendesk pricing alternative`, `reduce customer support churn` | Owners cutting stack costs |

---

*Update this note whenever new vidIQ exports or newsletter insights arrive.*
