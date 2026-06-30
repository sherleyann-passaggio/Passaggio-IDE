# Pain Phrase Library

> Central registry of all validated pain phrases across the ecosystem.

---

## Active Phrases

```dataview
TABLE source_app, phrase, view_multiplier, date_validated
FROM "04 - Pipeline/Intelligence/Pain Phrases"
WHERE type = "pain-phrase" AND status = "active"
SORT view_multiplier DESC
```

---

## Stale Phrases (> 90 Days)

```dataview
TABLE source_app, phrase, view_multiplier, date_validated
FROM "04 - Pipeline/Intelligence/Pain Phrases"
WHERE type = "pain-phrase" AND status = "stale"
SORT date_validated ASC
```

---

## 📝 How to Add a New Phrase

1. Create a new note in `04 - Pipeline/Intelligence/Pain Phrases/`.
2. Use the template from `00 - System/templates/Pain Phrase.md`.
3. Fill `view_multiplier` from vidIQ CSV export.
4. Tag with `pain-phrase` and the relevant `app_slug`.
