# 🏆 Successful Videos

This folder tracks high-performing organic videos, their formats, categories, and any client associations they generate. It is the single source of truth for understanding what content resonates and which formats spur inbound client interest.

---

## 📁 Folder Layout

```
04 - Pipeline/Successful Videos/
├── README.md                          # This file
├── 📊 SUCCESSFUL_VIDEOS_DASHBOARD.md  # Dataview dashboard of all tracked videos
├── 📹 Formats/                        # Reusable format archetypes
│   ├── Format - Pain Point Hook.md
│   ├── Format - SaaS Contrast.md
│   ├── Format - Demo Loop.md
│   └── Format - CTA Billboard.md
└── 📅 By Year/
    └── 2026/
        └── 2026-06-22 - Video Title.md
```

---

## 🚀 Quick Start

1. **To log a new successful video:** Copy `00 - System/Templates/Successful Video Template.md` into `04 - Pipeline/Successful Videos/By Year/YYYY/` and fill in the frontmatter.
2. **To log by format only:** Add a note under `Formats/` describing the reusable pattern.
3. **To see the big picture:** Open `📊 SUCCESSFUL_VIDEOS_DASHBOARD.md`.

---

## 📝 What Counts as "Successful"?

A video belongs here if it meets **any** of the following criteria:

- Exceeds the internal Virality Score threshold (≥ 85) from the automatic Gemini audit.
- Drives a measurable inbound lead, demo request, or client conversation.
- Achieves above-average view/engagement performance on its primary platform.
- Demonstrates a repeatable format worth cloning for future episodes.

---

## 🏷️ Required Frontmatter

Every video note should include:

```yaml
---
type: successful_video
video_title: "Ep.15 | Background Checks"
youtube_url: "https://youtube.com/shorts/..."
platform: YouTube Shorts
format: Pain Point Hook
app_slug: ops_process_analyst
client_slug: ""          # Fill when a client association is confirmed
status: published
virality_score: 87
views: 0
likes: 0
comments: 0
shares: 0
lead_source: true        # true if this video generated a lead
lead_notes: ""
published_date: 2026-06-22
created: 2026-06-22
---
```

---

## 🔗 Client Association Workflow

When a successful video is linked to a client:

1. Update the `client_slug` field in the video note.
2. Add a backlink to the client note in `03 - Clients/Active/<Client Name>.md`.
3. Tag the note with `#client-win`.

This makes it trivial to answer: *"Which video formats have spurred which clients?"*

---

*Maintained by Cline. Last reviewed: 2026-06-22.*
