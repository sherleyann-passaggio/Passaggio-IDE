# FRONTMATTER_SCHEMAS.md

> Canonical reference for every `type` used in this vault.  
> When creating a new note, copy the matching template from `00 - System/templates/` and fill every required field.

---

## `type: app`

```yaml
---
type: app
app_slug: verifiedsitter-canada       # stable filesystem slug
app_name: VerifiedSitter Canada
app_number: 1
episode: 1
cta_keyword: SAFE
status: active                        # active | prototype | paused | deprecated
privacy_mode: standard                # standard | private
default_ai_provider: gemini           # gemini | vertex | local
workspace_path: /Users/.../verifiedsitter-canada
demo_route: /demo
demo_status: pass                     # pass | fail | missing
repo_status: clean                    # clean | needs-attention | failing
health_score: 85                      # 0-100
last_audit: 2026-06-13
primary_pain: "tracking verified background checks manually"
description: "A safety-first babysitting marketplace with map-based discovery and verification dashboards."
dependencies: [firebase, stripe, google-maps]
stack: [react, vite, tailwind, firebase]
tags: [app, marketplace, b2c]
---
```

---

## `type: client`

```yaml
---
type: client
client_slug: acme-realty
client_name: Acme Realty Group
status: active                       # active | handoff | care-plan | churned
app_slug: lease-guard
discovery_date: 2026-06-10
handoff_date:
deposit_paid: true
contract_value: 450                  # $450 custom build
care_plan: foundation                # foundation | growth | sovereign
care_plan_mrr: 99
total_contract_value: 549            # 450 + 99 (first month)
health_score: 90
demo_url:
next_action: "Schedule handoff call"
assigned_apps: [lease-guard]
tags: [client, real-estate]
---
```

---

## `type: lead`

```yaml
---
type: lead
lead_slug: acme-realty
company_name: Acme Realty Group
source: vapi                         # vapi | intake-form | youtube | referral | outreach
status: qualified                    # new | qualified | deposit-paid | building | handed-off | lost
intake_date: 2026-06-10
app_fit: lease-guard
estimated_value: 500
priority: high                       # high | medium | low
next_touch: 2026-06-14
tags: [lead, real-estate]
---
```

---

## `type: episode`

```yaml
---
type: episode
episode_number: 1
app_slug: verifiedsitter-canada
title: "The Childcare Screening Loophole"
cta_keyword: SAFE
status: published                     # idea | script | recorded | rendered | published
publish_date: 2026-06-13
script_path: "04 - Pipeline/Content/Scripts/Ep.01 - VerifiedSitter - The Childcare Screening Loophole.md"
video_path:
hook: "STOP TRACKING CHECKS MANUALLY"
view_multiplier: 4.2
performance_score:
tags: [episode, verifiedsitter]
---
```

---

## `type: competitor`

```yaml
---
type: competitor
name: Checkr
category: background-checks
threat_level: medium                 # high | medium | low
differentiator: "Manual API vs our one-click VSC queue"
pricing_signal: "$35/check"
last_updated: 2026-06-13
target_apps: [verifiedsitter-canada]
tags: [competitor, verifiedsitter]
---
```

---

## `type: audit`

```yaml
---
type: audit
audit_date: 2026-06-13
audit_type: readiness                # readiness | handoff | security | performance
target_type: app                    # app | client
target_slug: verifiedsitter-canada
auditor: cline
status: pass                        # pass | fail | needs-work
findings: 2
critical: 0
major: 1
minor: 1
next_audit: 2026-06-20
tags: [audit, readiness, verifiedsitter]
---
```

---

## `type: pain-phrase`

```yaml
---
type: pain-phrase
phrase: "vulnerable sector check delay"
source_app: verifiedsitter-canada
source_tool: vidIQ
view_multiplier: 4.2
date_validated: 2026-06-13
status: active                     # active | stale
context: "Parental anxiety questions, long wait-time complaints"
tags: [pain-phrase, verifiedsitter]
---
```

---

## `type: sop`

```yaml
---
type: sop
sop_name: "Morning Autonomous Workflow"
version: 1.0
last_reviewed: 2026-06-13
owner: cline
automation_level: full              # full | partial | manual
tags: [sop, automation]
---
```

---

*Any note without a `type` field is considered "untyped" and should be reviewed for categorization.*
