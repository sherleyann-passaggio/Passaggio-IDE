# 🎬 CONTENT_DASHBOARD.md

> Episode pipeline, script status, render queue, and published performance.  
> **Rule:** All data below is derived from notes via Dataview. Do not hardcode KPIs here.

---

## 📺 Episode Pipeline

```dataview
TABLE episode_number, app_slug, title, status, publish_date, view_multiplier
FROM "04 - Pipeline/Content/Episodes"
WHERE type = "episode"
SORT episode_number ASC
```

---

## 📝 Scripts Ready for Production

```dataview
TABLE episode_number, app_slug, title, script_path
FROM "04 - Pipeline/Content/Episodes"
WHERE type = "episode" AND status = "script"
SORT episode_number ASC
```

---

## 🎥 Ready to Render

```dataview
TABLE episode_number, app_slug, title, video_path
FROM "04 - Pipeline/Content/Episodes"
WHERE type = "episode" AND status = "recorded"
SORT episode_number ASC
```

---

## 📊 Published Performance

```dataview
TABLE episode_number, app_slug, title, view_multiplier, performance_score
FROM "04 - Pipeline/Content/Episodes"
WHERE type = "episode" AND status = "published"
SORT view_multiplier DESC
```

---

## 🗺️ Series Map

```dataview
TABLE episode_number, app_slug, cta_keyword, status
FROM "04 - Pipeline/Content/Episodes"
WHERE type = "episode"
SORT episode_number ASC
```

---

## 🔗 Related

- [[Pain Phrase Library]]
- [[Content Calendar]]
- [[Content Insights]]
- [[04 - Pipeline/Content]]
