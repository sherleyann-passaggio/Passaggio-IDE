# 🏥 ECOSYSTEM_HEALTH_DASHBOARD.md

> App health scores, demo readiness, audit status, and QA coverage.  
> **Rule:** All data below is derived from notes via Dataview. Do not hardcode KPIs here.

---

## 📊 App Health Scorecard

```dataview
TABLE app_name, status, health_score, demo_status, last_audit, repo_status
FROM "02 - Apps"
WHERE type = "app"
SORT health_score ASC
```

---

## 🔴 Critical Health (Score < 60)

```dataview
TABLE app_name, health_score, demo_status, repo_status, last_audit
FROM "02 - Apps"
WHERE type = "app" AND health_score < 60
SORT health_score ASC
```

---

## 🟡 Needs Attention (60-79)

```dataview
TABLE app_name, health_score, demo_status, repo_status, last_audit
FROM "02 - Apps"
WHERE type = "app" AND health_score >= 60 AND health_score < 80
SORT health_score ASC
```

---

## 🟢 Healthy (Score >= 80)

```dataview
TABLE app_name, health_score, demo_status, last_audit
FROM "02 - Apps"
WHERE type = "app" AND health_score >= 80
SORT health_score DESC
```

---

## 📋 Missing Demos

```dataview
TABLE app_name, demo_status, workspace_path
FROM "02 - Apps"
WHERE type = "app" AND demo_status = "missing"
SORT app_number ASC
```

---

## 🧪 Privacy Mode Distribution

```dataview
TABLE length(rows) AS Count
FROM "02 - Apps"
WHERE type = "app"
GROUP BY privacy_mode
```

---

## 🔗 Related

- [[⚠️ RISK_AND_BLOCKERS_DASHBOARD]]
- [[06 - QA & Audits]]
- [[02 - Apps]]
