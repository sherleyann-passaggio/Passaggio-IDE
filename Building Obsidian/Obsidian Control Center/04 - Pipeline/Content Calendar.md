---
type: sop
sop_name: "Content Calendar"
version: 1.0
last_reviewed: 2026-06-13
owner: cline
automation_level: partial
tags: [sop, content, calendar]
---

# Content Calendar

> Tracks scheduled vs. published episodes. Replaces `content_calendar.json`.

---

## 📅 Weekly View

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 2026-W24 | — | — | — | — | — | — | — |

---

## 🗓️ Backlog

```dataview
TABLE episode_number, app_slug, title, status
FROM "04 - Pipeline/Content/Episodes"
WHERE type = "episode" AND status != "published"
SORT episode_number ASC
```

---

## ✅ Published

```dataview
TABLE episode_number, app_slug, title, publish_date, view_multiplier
FROM "04 - Pipeline/Content/Episodes"
WHERE type = "episode" AND status = "published"
SORT publish_date DESC
```

---

## 📋 Rules

- **Max 1 episode per day.** Each piece gets 24 hours to breathe.
- **Batch production:** Write 9 scripts in one session, record in one session, render in one session.
- **Distribution:** Auto-schedule via `distribute.py`.
