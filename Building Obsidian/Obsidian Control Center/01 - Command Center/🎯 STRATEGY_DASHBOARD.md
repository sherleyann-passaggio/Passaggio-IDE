# 🎯 STRATEGY_DASHBOARD.md

> Competitive intelligence, market positioning, and content strategy direction.  
> **Rule:** All data below is derived from notes via Dataview. Do not hardcode KPIs here.

---

## 🏆 High-Opportunity Pain Phrases

```dataview
TABLE source_app, view_multiplier, date_validated, status
FROM "04 - Pipeline/Intelligence/Pain Phrases"
WHERE type = "pain-phrase" AND status = "active"
SORT view_multiplier DESC
LIMIT 10
```

---

## ⚔️ Competitive Threats

```dataview
TABLE category, threat_level, differentiator, pricing_signal, last_updated
FROM "04 - Pipeline/Intelligence/Competitors"
WHERE type = "competitor"
SORT threat_level DESC, last_updated DESC
```

---

## 📈 Content Performance (Published Episodes)

```dataview
TABLE episode_number, app_slug, title, view_multiplier, performance_score
FROM "04 - Pipeline/Content/Episodes"
WHERE type = "episode" AND status = "published"
SORT view_multiplier DESC
```

---

## 🎯 Recommended Next Actions

Based on current intelligence:

1. **Pain Phrase Validation:** Review top 3 pain phrases with `view_multiplier >= 3.0x` and generate scripts.
2. **Competitor Response:** Any competitor with `threat_level = high` and `last_updated > 14 days ago` needs fresh intel.
3. **Episode Gap:** If `content_insights` shows validated phrases without matching episode notes, queue for script generation.

---

## 🔗 Related

- [[Pain Phrase Library]]
- [[Content Insights]]
- [[04 - Pipeline/Intelligence/Competitors]]
