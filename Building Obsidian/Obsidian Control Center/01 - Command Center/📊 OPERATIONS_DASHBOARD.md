# 📊 OPERATIONS_DASHBOARD.md

> Active clients, leads, and immediate next actions.  
> **Rule:** All data below is derived from notes via Dataview. Do not hardcode KPIs here.

---

## 🏢 Active Clients

```dataview
TABLE client_name, app_slug, care_plan, care_plan_mrr, health_score, next_action
FROM "03 - Clients/Active"
WHERE type = "client"
SORT health_score ASC, next_action ASC
```

---

## 📬 Qualified Leads

```dataview
TABLE company_name, source, status, app_fit, estimated_value, priority, next_touch
FROM "03 - Clients/Prospects"
WHERE type = "lead" AND status != "lost"
SORT priority DESC, next_touch ASC
```

---

## 🔥 High-Priority Next Actions

```dataview
TABLE client_name, next_action, health_score
FROM "03 - Clients/Active"
WHERE type = "client" AND (health_score < 80 OR next_action != "")
SORT health_score ASC
```

---

## 📅 Lead Pipeline Summary

```dataview
TABLE length(rows) AS Count, sum(rows.estimated_value) AS Pipeline_Value
FROM "03 - Clients/Prospects"
WHERE type = "lead" AND status != "lost"
GROUP BY status
```

---

## 🔗 Related

- [[💰 REVENUE_DASHBOARD]]
- [[🏥 ECOSYSTEM_HEALTH_DASHBOARD]]
- [[03 - Clients]]
