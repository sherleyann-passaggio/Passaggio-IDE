# ARCHITECTURE_MAP.md

> Visual overview of how every domain in this vault connects to the others.

---

## System Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                        01 - Command Center                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐  │
│  │ 🎯 Strategy │ │ 📊 Ops      │ │ 💰 Revenue  │ │ 🎬 Content    │  │
│  │ Dashboard   │ │ Dashboard   │ │ Dashboard   │ │ Dashboard     │  │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └───────┬───────┘  │
│  ┌─────────────┐ ┌─────────────────────────────────────────────────┐  │
│  │ 🏥 Health   │ │ ⚠️ Risk & Blockers Dashboard                  │  │
│  │ Dashboard   │ │                                                 │  │
│  └─────────────┘ └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  02 - Apps       │  │  03 - Clients    │  │  04 - Pipeline   │
│  (9 App Profiles)│  │  Active/Prospects│  │  Content/Intel   │
└──────────────────┘  │  Archive         │  │  Distribution    │
           │          └──────────────────┘  └──────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  06 - QA & Audits│  │  05 - Finance    │  │  07 - Knowledge  │
│  (Audit History) │  │  (MRR/Invoices)  │  │  SOPs/Research   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │ 00 - System      │
                        │ Rules/Schemas/   │
                        │ Templates        │
                        └──────────────────┘
```

---

## Data Flow

### App → Episode → Content Pipeline

1. Each app profile (`type: app`) declares `episode` and `cta_keyword`.
2. Episode notes (`type: episode`) link back to `app_slug`.
3. Content Dashboard queries episodes and joins app health scores.
4. Scripts live in `04 - Pipeline/Content/Scripts/` and are linked from episode notes.

### Client → App → Revenue

1. Client notes (`type: client`) declare `app_slug`.
2. Revenue Dashboard groups clients by `care_plan` and sums `care_plan_mrr`.
3. Operations Dashboard surfaces `next_action` and `health_score`.

### Lead → Client

1. Lead notes (`type: lead`) track progression through the state machine.
2. When `status` changes to `deposit-paid`, a Client note is generated (or updated).
3. `lead_slug` becomes `client_slug` for continuity.

### QA → App Health

1. Audit notes (`type: audit`) target an app or client via `target_slug`.
2. App profiles update `last_audit` and `health_score` based on audit results.
3. Ecosystem Health Dashboard ranks apps by `health_score`.

### Intelligence → Competitive Strategy

1. Pain phrase notes (`type: pain-phrase`) link to `source_app`.
2. Competitor notes (`type: competitor`) link to `target_apps`.
3. Strategy Dashboard surfaces high-view-multiplier phrases and high-threat competitors.
4. Inbox captures (`08 - Inbox/`) are triaged into pain phrases or competitor intel.

---

## Key Integrations (External)

| External System | Vault Representation | Sync Direction |
|-----------------|----------------------|----------------|
| `series_map.json` | `04 - Pipeline/Series Map.md` | Vault is source of truth |
| `content_calendar.json` | `04 - Pipeline/Content Calendar.md` | Vault is source of truth |
| `content_insights.md` | `04 - Pipeline/Content Insights.md` | Vault is source of truth |
| `metadata.json` (per app) | `02 - Apps/[app]/[slug] - App Profile.md` | One-time import, then vault owns it |
| `.passaggio.config.json` | Referenced in app profile body | External file, documented in vault |
| `design.md` (brand tokens) | Referenced in `07 - Knowledge/Research/` | External file, linked |
| Daily email summaries | `08 - Inbox/` → triaged to `07 - Knowledge/` | Manual or automated ingest |
| VidIQ CSV exports | `04 - Pipeline/Intelligence/Pain Phrases/` | Manual import via template |

---

*This map is a living document. Update it when new domains or integrations are added.*
