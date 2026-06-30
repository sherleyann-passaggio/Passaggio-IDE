# 💰 REVENUE_DASHBOARD.md

> MRR, contract values, pipeline forecasting, and care plan tiers.  
> **Rule:** All data below is derived from notes via Dataview. Do not hardcode KPIs here.

---

## 💳 Monthly Recurring Revenue (MRR) by Tier

```dataview
TABLE sum(rows.care_plan_mrr) AS Total_MRR, length(rows) AS Clients
FROM "03 - Clients/Active"
WHERE type = "client" AND care_plan_mrr > 0
GROUP BY care_plan
```

---

## 💰 Total Contract Value (TCV)

```dataview
TABLE client_name, contract_value, care_plan_mrr, total_contract_value
FROM "03 - Clients/Active"
WHERE type = "client"
SORT total_contract_value DESC
```

---

## 📈 Pipeline Value by Lead Status

```dataview
TABLE length(rows) AS Leads, sum(rows.estimated_value) AS Pipeline_Value
FROM "03 - Clients/Prospects"
WHERE type = "lead" AND status != "lost"
GROUP BY status
```

---

## 🎯 Revenue Forecast

| Metric | Source |
|--------|--------|
| **Current MRR** | Sum of `care_plan_mrr` from active clients |
| **Pipeline Value** | Sum of `estimated_value` from non-lost leads |
| **Discovery Revenue** | Count of `deposit_paid: true` × $50 |
| **Build Revenue** | Count of `status = handed-off` × $450 |
| **Upsell Potential** | Count of locked features × average upsell price |

---

## 🔗 Related

- [[📊 OPERATIONS_DASHBOARD]]
- [[05 - Finance]]
- [[03 - Clients]]
