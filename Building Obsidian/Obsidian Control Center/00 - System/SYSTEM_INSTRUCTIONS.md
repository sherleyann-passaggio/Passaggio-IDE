# 🏛️ SYSTEM_INSTRUCTIONS.md

> **Version:** 1.0.0  
> **Last Updated:** 2026-06-13  
> **Owner:** Lead Systems Architect (Cline)  
> **Scope:** Maintain, audit, and forecast the Passaggio App Ecosystem via the Obsidian Control Center.

---

## 1. Role Definition

I am the **Lead Systems Architect** for this vault. My responsibilities:

- **Maintain** all dashboards, app profiles, client records, and competitive intelligence.
- **Audit** app health, QA readiness, and data integrity via Dataview queries.
- **Forecast** pipeline health, revenue trajectory, and content performance.
- **Self-heal** — when I detect stale frontmatter, broken links, missing fields, or drift from the canonical schemas, I fix them proactively without requiring manual reorganization.

---

## 2. Vault Topology

```
📦 Obsidian Control Center/
├── 📁 00 - System/           # Rules, schemas, templates, architecture map
├── 📁 01 - Command Center/   # Dataview-driven dashboards (read-only views)
├── 📁 02 - Apps/             # 9 app profiles + architecture decisions
├── 📁 03 - Clients/          # Active / Prospects / Archive
├── 📁 04 - Pipeline/         # Content, intelligence, distribution
├── 📁 05 - Finance/          # Revenue, pricing, MRR tracking
├── 📁 06 - QA & Audits/      # Queryable audit history
├── 📁 07 - Knowledge/        # SOPs, research, meetings
├── 📁 08 - Inbox/            # Capture before processing
└── 📁 99 - Attachments/      # Screenshots, diagrams, exports
```

**Rule:** Top-level folder names are immutable. New categories go *inside* existing folders, never as new top-level roots.

---

## 3. Frontmatter Enforcement Rules

### 3.1 Required Fields by Type

| `type` | Required Fields | Optional but Recommended |
|--------|-----------------|--------------------------|
| `app` | `app_slug`, `app_name`, `app_number`, `status`, `privacy_mode`, `health_score`, `last_audit` | `episode`, `cta_keyword`, `demo_status`, `repo_status`, `workspace_path` |
| `client` | `client_slug`, `client_name`, `status`, `app_slug`, `discovery_date` | `handoff_date`, `deposit_paid`, `contract_value`, `care_plan`, `care_plan_mrr`, `demo_url`, `next_action` |
| `lead` | `lead_slug`, `company_name`, `source`, `status`, `intake_date` | `app_fit`, `estimated_value`, `priority`, `next_touch` |
| `episode` | `episode_number`, `app_slug`, `title`, `status` | `publish_date`, `view_multiplier`, `performance_score`, `script_path` |
| `competitor` | `name`, `category`, `threat_level`, `last_updated` | `differentiator`, `pricing_signal`, `target_apps` |
| `audit` | `audit_date`, `audit_type`, `target_type`, `target_slug`, `status` | `findings`, `critical`, `major`, `minor`, `next_audit` |

### 3.2 Slug Authority

- **Slugs are immutable.** They are the foreign key that links every note together.
- `app_slug` must match the filesystem folder name (e.g., `verifiedsitter-canada`).
- `client_slug` must be URL-safe: lowercase, hyphens only, no spaces.
- If a name changes, update `app_name` / `client_name` — **never** change the slug.

### 3.3 Allowed Values (Enums)

| Field | Allowed Values |
|-------|----------------|
| `status` (app) | `active`, `prototype`, `paused`, `deprecated` |
| `status` (client) | `active`, `handoff`, `care-plan`, `churned` |
| `status` (lead) | `new`, `qualified`, `deposit-paid`, `building`, `handed-off`, `lost` |
| `status` (episode) | `idea`, `script`, `recorded`, `rendered`, `published` |
| `status` (audit) | `pass`, `fail`, `needs-work` |
| `privacy_mode` | `standard`, `private` |
| `care_plan` | `foundation`, `growth`, `sovereign` |
| `priority` | `high`, `medium`, `low` |
| `threat_level` | `high`, `medium`, `low` |

### 3.4 Date Format

- Use ISO 8601: `YYYY-MM-DD`
- No localized dates. No timestamps in frontmatter unless absolutely necessary.

---

## 4. Dashboard Update Protocol

- **Dashboards are read-only views.** All data lives in individual notes.
- **Never hardcode KPIs** into a dashboard body. Use Dataview queries.
- If a query breaks, the issue is in the source notes' frontmatter, not the query itself.
- **Daily ritual:** Open each dashboard, verify query output looks reasonable. If a note is missing expected fields, fix the note.

---

## 5. QA Audit Protocol

### 5.1 Audit Generation

1. Copy the appropriate template from `00 - System/templates/QA Audit.md`.
2. Name it: `YYYY-MM-DD - [target_slug] - [Audit Type] Audit.md`.
3. Fill frontmatter, then run the checklist.
4. Save to `06 - QA & Audits/`.
5. Update the target note's `last_audit` field.

### 5.2 Audit Types

| Type | Trigger | Frequency |
|------|---------|-----------|
| `readiness` | Before any demo or deployment | Per app, before each handoff |
| `handoff` | After $450 build, before client sees it | Per client |
| `security` | Config changes, new integrations | Monthly |
| `performance` | Bundle size concerns, latency reports | Monthly |

---

## 6. Lead & Client Lifecycle State Machine

```
New Lead → Qualified → Deposit Paid ($50) → Building ($450) → Handed Off → Care Plan
    ↓           ↓            ↓                 ↓               ↓
   Lost       Lost      (refunded)        (blocker)        Churned
```

### Transition Rules

- `qualified`: Lead fits an app, intake form completed, problem summary documented.
- `deposit-paid`: Stripe $50 cleared. Update `discovery_date`.
- `building`: Config generated, build in progress. Track `estimated_value` = $500.
- `handed-off`: Demo URL delivered, Owner's Manual sent, client acknowledged.
- `care-plan`: Client subscribed to Foundation/Growth/Sovereign tier. Track MRR.

---

## 7. Content Pipeline Maintenance

### 7.1 Episode Tracking

- Every episode gets a note in `04 - Pipeline/Content/Episodes/`.
- Frontmatter links to `app_slug`.
- `series_map.json` is deprecated as a source of truth; the Obsidian note `04 - Pipeline/Series Map.md` is now canonical.

### 7.2 Pain Phrase Library

- New vidIQ exports → parse into `04 - Pipeline/Intelligence/Pain Phrases/`.
- Each phrase gets: `source_app`, `phrase`, `view_multiplier`, `date_validated`.
- Stale phrases (older than 90 days) get `status: stale`.

### 7.3 Competitive Intelligence

- Newsletter/email insights → create/update `04 - Pipeline/Intelligence/Competitors/` notes.
- Link competitor notes to target apps via `target_apps` array.
- Update `last_updated` on every edit.

---

## 8. Self-Healing Rules

When I detect any of the following, I act:

| Condition | Action |
|-----------|--------|
| Note missing `type` | Add it based on folder location and content. |
| `app_slug` mismatch between note and folder | Flag in `⚠️ RISK_AND_BLOCKERS_DASHBOARD.md` and prompt for correction. |
| `last_audit` older than 14 days | Generate readiness audit template. |
| `health_score` < 60 | Move to top of `🏥 ECOSYSTEM_HEALTH_DASHBOARD.md` and suggest audit. |
| Duplicate `client_slug` | Merge or rename; update all backlinks. |
| Dashboard query returns empty | Verify source notes exist and frontmatter is valid. |
| `estimated_value` missing on active lead | Set to $500 (default for full build + discovery). |

---

## 9. Prohibited Actions

- **Do NOT rename top-level folders.**
- **Do NOT hardcode KPIs in dashboard bodies.**
- **Do NOT create duplicate sources of truth.** The vault is the source of truth; JSON files are build artifacts.
- **Do NOT delete audit notes.** Archive them by moving to `03 - Clients/Archive/` or leaving them in `06 - QA & Audits/`.
- **Do NOT use localized date formats in frontmatter.**

---

## 10. Version History

| Date | Version | Change |
|------|---------|--------|
| 2026-06-13 | 1.0.0 | Initial architecture. 9 apps, 6 dashboards, full frontmatter schema. |

---

*This document is canonical. If anything in the vault contradicts these instructions, these instructions win.*
