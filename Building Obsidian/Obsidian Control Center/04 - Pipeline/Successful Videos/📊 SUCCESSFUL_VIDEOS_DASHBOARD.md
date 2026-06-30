---
type: dashboard
dashboard_name: "Successful Videos"
version: 1.0
last_reviewed: 2026-06-22
owner: cline
tags: [dashboard, content, successful-videos]
---

# 📊 Successful Videos Dashboard

> Track high-performing videos, their formats, and the clients they attract.

---

## 🏆 All Successful Videos

```dataview
TABLE video_title, platform, format, app_slug, client_slug, virality_score, views, lead_source, published_date
FROM "04 - Pipeline/Successful Videos/By Year"
WHERE type = "successful_video"
SORT published_date DESC
```

---

## 🎬 Top Performing Formats

```dataview
TABLE WITHOUT ID format, count(format) AS "Video Count", average(virality_score) AS "Avg Virality"
FROM "04 - Pipeline/Successful Videos/By Year"
WHERE type = "successful_video"
GROUP BY format
SORT "Avg Virality" DESC
```

---

## 🤝 Client-Win Videos

```dataview
TABLE video_title, format, app_slug, client_slug, lead_notes, published_date
FROM "04 - Pipeline/Successful Videos/By Year"
WHERE type = "successful_video" AND lead_source = true
SORT published_date DESC
```

---

## 📈 By Platform

```dataview
TABLE WITHOUT ID platform, count(platform) AS "Videos", average(virality_score) AS "Avg Score"
FROM "04 - Pipeline/Successful Videos/By Year"
WHERE type = "successful_video"
GROUP BY platform
SORT "Avg Score" DESC
```

---

## 📝 Recent Additions

```dataview
LIST
FROM "04 - Pipeline/Successful Videos/By Year"
WHERE type = "successful_video"
SORT created DESC
LIMIT 10
```

---

## 🛠️ Maintenance

- **Weekly:** Review new videos, update view/engagement stats, and confirm client associations.
- **Monthly:** Analyze format performance trends and update the `Formats/` archetype notes.

---

*For logging instructions, see [[README]].*
