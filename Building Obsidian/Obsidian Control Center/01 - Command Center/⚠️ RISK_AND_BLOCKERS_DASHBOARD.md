# ⚠️ RISK_AND_BLOCKERS_DASHBOARD.md

> Stale audits, failing checks, missed deadlines, and anything that will break if not addressed.  
> **Rule:** All data below is derived from notes via Dataview. Do not hardcode KPIs here.

---

## 🚨 Failing / Stale Audits

```dataview
TABLE audit_date, target_slug, audit_type, status, findings, critical
FROM "06 - QA & Audits"
WHERE type = "audit" AND (status != "pass" OR audit_date < date(today) - dur(14 days))
SORT critical DESC, audit_date ASC
```

---

## 🔴 Apps with No Audit in 14+ Days

```dataview
TABLE app_name, last_audit, health_score
FROM "02 - Apps"
WHERE type = "app" AND last_audit < date(today) - dur(14 days)
SORT last_audit ASC
```

---

## ❌ Missing Demo Routes

```dataview
TABLE app_name, demo_status, workspace_path
FROM "02 - Apps"
WHERE type = "app" AND demo_status = "missing"
SORT app_number ASC
```

---

## 📉 Stale Leads (No Touch in 7+ Days)

```dataview
TABLE company_name, status, next_touch, priority
FROM "03 - Clients/Prospects"
WHERE type = "lead" AND status != "lost" AND next_touch < date(today) - dur(7 days)
SORT priority DESC, next_touch ASC
```

---

## 📝 Notes with Missing `type`

```dataview
TABLE file.name, file.folder
FROM ""
WHERE !type
SORT file.folder ASC
LIMIT 20
```

---

## 🎯 Top Blockers — Action Required

Based on current risk state:

1. **Audit overdue:** Any app with `last_audit` > 14 days ago → generate readiness audit.
2. **Demo missing:** Any app with `demo_status: missing` → scaffold `/demo` route.
3. **Health critical:** Any app with `health_score < 60` → full architecture review.
4. **Lead stale:** Any lead with `next_touch` in the past → re-engage or mark lost.

---

## 🔗 Related

- [[🏥 ECOSYSTEM_HEALTH_DASHBOARD]]
- [[📊 OPERATIONS_DASHBOARD]]
- [[06 - QA & Audits]]
