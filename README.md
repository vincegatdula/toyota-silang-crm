# Toyota CRM — Silang, Cavite

A modern, frontend-only dealership CRM for **Toyota Silang, Cavite**.

**Stack:** HTML5 · CSS3 · JavaScript · IndexedDB — no PHP, no MySQL, no server. Deploys to Vercel as a static website and works offline as a PWA.

---

## Quick start

Run it locally (any static server is fine):

```bash
python3 -m http.server 8080
# open http://localhost:8080/dashboard.html
```

Or deploy to Vercel:

```bash
npm i -g vercel
vercel        # framework preset: "Other" — pure static, no build step
```

---

## Pages

| Page | File | Purpose |
|---|---|---|
| Dashboard | `dashboard.html` | KPIs, monthly sales progress, lead-gen progress, upcoming follow-ups/activities, 6-month trend. Month selector is global. |
| Leads | `leads.html` | Full lead list with search, filters, CSV export, quick-add. |
| Kanban | `kanban.html` | Pipeline board; drag & drop card → column updates the pipeline stage. Stage dropdown per card is the guaranteed fallback. |
| Activities | `activities.html` | Activity ledger with completion checkboxes and Overdue / Due Today / Next 7 / Next 30 buckets. |
| Calendar | `calendar.html` | Monthly grid: follow-ups, activities, test drives, meetings, financing, reservations, payments, releases, birthdays, release anniversaries, holidays. |
| Targets | `targets.html` | Monthly sales target + per-source lead-generation targets with required-per-day math. |
| Reports | `reports.html` | Surveys (by source/status/stage/priority/vehicle), monthly trends, conversion, lost leads, overdue, days-to-close, sales-by-vehicle. CSV export. |
| Archived | `archived.html` | Restore or permanently delete archived leads. |
| Settings | `settings.html` | Configures sources, statuses, stages, priorities, activity types, models, variants, colors, holidays, general defaults + backup/import. |

---

## Data storage architecture

```
UI LAYER (pages, modals)
      │  calls App.* / LeadView.* / db.*
APPLICATION LOGIC (app.js, page modules)
      │  calls db.* only
DATA ACCESS LAYER (js/storage.js)
      │  Promise-wrapped IndexedDB
INDEXEDDB (stores: leads, activities, targets, settings, holidays, vehicles, seq)
```

- **IndexedDB** is the primary store (all CRM data).
- **localStorage** is used only for UI preferences: selected month, theme, sidebar state, install flag.
- The `db.*` facade is intentionally API-shaped like a future cloud client (`db.leads.getAll()`, `db.leads.create()`, …). Replacing IndexedDB with a cloud API later means rewriting **only** `storage.js`.

### Important reality check

Data lives in the device's browser. It is **not** shared between devices,
browsers, or users. Use **Settings → Backup & Data → Export Backup** (JSON) for
moves, and Import Backup to restore. This is a local-first CRM, not a multi-user
cloud system.

---

## Backup / import

- **Export Backup** → `ToyotaCRM_Backup_YYYY-MM-DD.json` — complete restore point (leads, activities, targets, settings, holidays, vehicles).
- **Import Backup** — validates the file structure first (app marker, required collections, duplicate/ID checks) and requires an explicit confirmation before replacing local data.
- **CSV export** for Leads, Activities, Archived, and Reports.
- **Clear ALL Data** and **Load Sample Data** are in the same section.

---

## Feature notes

- **Lead IDs** (`C0001`, `C0002`, …) are generated from a monotonic sequence stored in IndexedDB and are never reused, even after deletion.
- **Released customers** are separated from the active sales pipeline: `Released/Lost/Cold` statuses and `Release/Lost` stages exclude a lead from active-deal metrics, while post-release (OR/CR, plate, after-sales) records stay on the same lead.
- **Follow-up buckets** auto-classify leads/activities as Overdue / Due Today / Due Tomorrow / Next 7 Days / Next 30 Days / No Follow-up.
- **Working-day math** (targets, dashboard) excludes weekends and configured holidays and uses per-month overrides where set.
- **Kanban is never a separate source of truth** — columns are derived from each lead's `stage` on every render; drag & drop and the per-card dropdown both write back to the lead.

---

## PWA / offline

`manifest.json` + `sw.js` register an installable, offline-capable app shell.
All data reads are local (IndexedDB), so the CRM works with no connection.
Offline ≠ cloud sync.

## Security

No passwords, API keys, or credentials are stored in the code. There is no
login, on purpose: a fake login would imply security the static frontend does
not have. Access is only as private as the device.

## Deploy requirements (Vercel)

- All paths are relative; no localhost, XAMPP, PHP, MySQL, or server APIs.
- No build step; deploy the folder as-is (preset: **Other / Static**).