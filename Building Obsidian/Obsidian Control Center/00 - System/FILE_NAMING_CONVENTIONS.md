# FILE_NAMING_CONVENTIONS.md

> Immutable rules for creating new files. This ensures Dataview queries, backlinks, and human browsing stay coherent.

---

## App Folders

```
02.## - [App Display Name]/
```
- Zero-padded two-digit prefix (`02.01`, `02.02`...).
- The prefix matches `app_number`.
- App Display Name uses sentence case with spaces.

**Examples:**
- `02.01 - VerifiedSitter Canada/`
- `02.04 - Lease Guard/`

---

## App Profile Notes

```
[app-slug] - App Profile.md
```
- Always inside the app's own folder.
- This is the canonical note for that app.

**Example:**
- `02 - Apps/02.01 - VerifiedSitter Canada/verifiedsitter-canada - App Profile.md`

---

## Client Folders

```
YYYY-MM-DD - [client-slug] - [Client Name]/
```
- Date = discovery date or intake date.
- `client-slug` is URL-safe.

**Example:**
- `2026-06-10 - acme-realty - Acme Realty Group/`

---

## Client Artifacts (inside client folder)

```
[client-slug] - [Entity].md
```

**Examples:**
- `acme-realty - Contract.md`
- `acme-realty - Discovery Notes.md`
- `acme-realty - QA Audit.md`

---

## Leads (in Prospects)

```
YYYY-MM-DD - [lead-slug] - Lead.md
```

**Example:**
- `2026-06-10 - acme-realty - Lead.md`

---

## Episodes

```
Ep.## - [app-slug] - [Hook].md
```
- Hook should be short and descriptive.
- Stored in `04 - Pipeline/Content/Episodes/`.

**Example:**
- `Ep.01 - verifiedsitter-canada - The Childcare Screening Loophole.md`

---

## Scripts

```
Ep.## - [app-slug] - Script.md
```
- Stored in `04 - Pipeline/Content/Scripts/`.

**Example:**
- `Ep.01 - verifiedsitter-canada - Script.md`

---

## Audits

```
YYYY-MM-DD - [target-slug] - [Audit Type] Audit.md
```
- Stored in `06 - QA & Audits/`.

**Example:**
- `2026-06-13 - verifiedsitter-canada - Readiness Audit.md`

---

## Competitors

```
YYYY-MM-DD - [Competitor Name] - [Category].md
```
- Stored in `04 - Pipeline/Intelligence/Competitors/`.

**Example:**
- `2026-06-13 - Checkr - Background Checks.md`

---

## Pain Phrases

```
YYYY-MM-DD - [app-slug] - [Phrase Slug].md
```
- Stored in `04 - Pipeline/Intelligence/Pain Phrases/`.

**Example:**
- `2026-06-13 - verifiedsitter-canada - vulnerable-sector-check-delay.md`

---

## Dashboards

```
[Emoji] [NAME]_DASHBOARD.md
```
- Stored in `01 - Command Center/`.
- Always uppercase `_DASHBOARD` suffix.

**Examples:**
- `🎯 STRATEGY_DASHBOARD.md`
- `📊 OPERATIONS_DASHBOARD.md`
- `💰 REVENUE_DASHBOARD.md`

---

## System Notes

```
[NAME].md
```
- Stored in `00 - System/`.
- Uppercase for clarity.

**Examples:**
- `SYSTEM_INSTRUCTIONS.md`
- `FRONTMATTER_SCHEMAS.md`
- `ARCHITECTURE_MAP.md`

---

## Inbox Captures

```
YYYY-MM-DD - [Source] - [Topic].md
```
- Stored in `08 - Inbox/`.
- Processed into categorized notes, then removed or archived.

**Example:**
- `2026-06-13 - Newsletter - AI Employee Pricing Trends.md`

---

*If a situation does not fit these conventions, create a new convention here and update `SYSTEM_INSTRUCTIONS.md`.*
