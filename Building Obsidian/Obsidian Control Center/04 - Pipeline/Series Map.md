---
type: sop
sop_name: "Series Map"
version: 1.0
last_reviewed: 2026-06-13
owner: cline
automation_level: full
tags: [sop, content, series-map]
---

# Series Map

> Canonical mapping of episodes → apps → hooks → CTAs. This note replaces `series_map.json`.

---

| Ep | App | Title | CTA | Next | Status |
|----|-----|-------|-----|------|--------|
| 1 | VerifiedSitter Canada | The Childcare Screening Loophole | `SAFE` | 2 | idea |
| 2 | Resonance | Spotting a Romance Scam in 3 Seconds | `VERIFY` | 3 | idea |
| 3 | Passaggio | The Silent Career-Killer for Singers | `VOICE` | 4 | idea |
| 4 | Lease Guard | The $10,000 Lease Mistake | `LEASE` | 5 | idea |
| 5 | Lexa Legal | Tech That Replaces Junior Billable Hours | `AGENT` | 6 | idea |
| 6 | Service Trades Dispatcher | Blue Collar Shops Are Losing Millions Here | `DISPATCH` | 7 | idea |
| 7 | Lead Sculptor | Stop Paying Influencers with Fake Followers | `SCULPT` | 8 | idea |
| 8 | OpsAnalyst | Why Your No-Code Automations Silently Break | `WATCH` | 9 | idea |
| 9 | Omni Concierge | The Hidden "Zendesk Tax" Killing Your Margin | `CONCIERGE` | — | idea |

---

## 🔄 Maintenance Rule

When an episode changes status (e.g., from `script` → `recorded`), update both:
1. This table
2. The episode note's frontmatter

This table is for human reference; Dataview queries pull from episode note frontmatter.
