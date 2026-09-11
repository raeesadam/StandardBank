# Data model and API

## Entities

```
themes (a recurrent complaint)
  ├── observations   one per reporting period   (the monitoring history)
  ├── root_causes    what is causing it
  │     └── actions  linked via actions.root_cause_id (nullable)
  ├── actions        proposed by product owners
  ├── incidents      operational incidents linked to the theme
  ├── notes          free-form complaint manager input
  └── activity       append-only audit trail of every change
```

Deleting a theme removes everything recorded against it. Deleting a root cause does *not*
remove the actions raised against it — they stay, unlinked and flagged in the UI as
unattributed, because the work someone did is not erased by revising the diagnosis.

Storage is `server/store.js`: records held in memory, persisted as one JSON file at
`data/complaints.json`, written via a temporary file and an atomic rename. Tables are
plain arrays; ids are per-table and monotonic across restarts.

### themes

The recurring issue being monitored. `reference` is allocated as `RC-<year>-<seq>` when a
theme is registered, unless one is supplied.

| Column | Notes |
|---|---|
| `reference` | unique, e.g. `RC-2026-001` |
| `title`, `description` | the recurring issue, not a single case |
| `product`, `channel`, `category` | from `reference.js` vocabularies |
| `severity` | Low / Medium / High / Critical |
| `status` | New · Under investigation · Action plan agreed · Remediation in progress · Monitoring · Resolved · Reopened |
| `product_owner`, `product_owner_email`, `business_unit`, `complaint_manager` | accountability |
| `first_reported_on`, `last_reported_on` | kept in step with the monitoring data automatically |
| `target_close_date` | drives the "days left / days past" readout |
| `regulatory_risk`, `watchlist` | flags |

Derived on read, never stored:

| Field | How |
|---|---|
| `volume_recent` / `volume_previous` | complaints over the last 6 periods, and the 6 before |
| `change_pct`, `trend` | `Increasing` ≥ +15%, `Decreasing` ≤ −15%, else `Stable`; `Insufficient history` without a comparable prior window |
| `avg_resolution_days` | mean of the last 3 periods |
| `open_actions`, `overdue_actions`, `completed_actions` | overdue = open and past `due_date` |
| `root_cause_count`, `confirmed_cause_count`, `incident_count`, `open_incidents`, `note_count` | counts |

### observations

One row per theme per period; `(theme_id, period_start)` is unique, so a period cannot be
double-counted. `period_label` is derived from the date when left blank.

Fields: `complaint_count`, `resolved_count`, `avg_resolution_days`, `financial_impact`,
`repeat_customers`, `notes`, `recorded_by`.

### root_causes

`category` (Process, System / Technology, People & Training, Third party / Vendor,
Policy & Product design, Data quality, Customer communication, Regulatory change),
`confidence` (Suspected → Under analysis → Confirmed → Ruled out), `contribution_pct`
(0–100, the share of complaints attributed to this cause), `status`, `evidence`,
`identified_by`, `identified_on`.

### actions

`proposed_by` is required — an action on the register always has a name against it.
`status` (Proposed · Approved · In progress · Blocked · Completed · Deferred · Rejected),
`priority`, `proposed_on`, `due_date`, `completed_on`, and `effectiveness`
(Not assessed · Too early to tell · Effective · Partially effective · Ineffective),
assessed after the action has been live for a monitoring period.

### incidents

`incident_ref`, `severity` (P1–P4), `status` (Open · Mitigated · Resolved · Closed),
`started_at`, `resolved_at`, `systems_affected`, `customers_affected`, `postmortem_url`.

### activity

Written by the API on every create, update and delete. `entity_type`, `action` and `subject`
describe *what* changed; the client composes the sentence around them in the reader's
language, so the timeline is never stuck in the language of whoever made the change.
`summary` is kept only as a fallback for entries written before those fields existed. `detail` holds a JSON array of
`{ field, from, to }` changes, so the timeline can show exactly what moved. `actor` comes
from the `actor` field on the request body (the UI's "Working as" value).

## API

All responses are JSON. Validation failures return `422` with
`{ error, fields: { <field>: <message> } }`, which the UI maps straight back onto the inputs.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/meta` | controlled vocabularies |
| GET | `/api/dashboard?months=12` | KPIs, volume series, top themes, distributions, overdue actions, recent activity |
| GET | `/api/activity?limit=50` | activity across all themes |
| GET | `/api/export` | every table, for reporting |
| GET | `/api/themes` | register listing — see filters below |
| POST | `/api/themes` | register a recurrent complaint |
| GET | `/api/themes/:id` | theme with all children and its history |
| PATCH | `/api/themes/:id` | partial update |
| DELETE | `/api/themes/:id` | delete, cascading to children |
| GET/POST | `/api/themes/:id/{observations,root-causes,actions,incidents,notes}` | list / create |
| GET/PATCH/DELETE | `/api/themes/:id/{collection}/:childId` | read / update / delete |
| GET | `/api/themes/:id/activity` | full history for one theme |

A child is always addressed through its theme, so a record cannot be read or written
through the wrong parent.

**Listing filters:** `search` (title, description, reference, owner, product), `status`,
`product`, `channel`, `severity`, `category`, `business_unit`, `owner`, `open=true`,
`watchlist=true`, `regulatory=true`, and `sort` (`volume`, `severity`, `open_actions`,
`last_reported`, `updated`, `reference`, `title`).
