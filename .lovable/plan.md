# BlueGeo AI — Major Restructure

## 1. Auth model: 2 logins (Authority + Citizen)

Landing page now has **two tabs only**: Authority / Citizen.

When signing up or signing in as Authority, a dropdown **"Select Your Role"** is shown with:
- Village Administrative Officer (VAO)
- Tahsildar
- Revenue Divisional Officer (RDO)
- District Collector
- PWD / WRD Engineer

Internally still uses one DB role `officer` for all 5, plus a new `officer_rank` column on `profiles` to distinguish them. `admin` role kept only for the seeded super-admin account (hidden from public login UI). All 5 authority ranks land on a unified `/authority` shell whose sidebar + dashboard data adapts to the rank.

Demo credentials updated to: `authority@bluegeo.gov.in` + `citizen@bluegeo.gov.in`. Sign-up form asks district + rank for authority users.

## 2. Database changes

```sql
ALTER TYPE app_role -- keep as-is (admin/officer/citizen)
ALTER TABLE profiles ADD COLUMN officer_rank TEXT
  CHECK (officer_rank IN ('vao','tahsildar','rdo','collector','wrd'));

ALTER TABLE complaints
  ADD COLUMN current_rank TEXT NOT NULL DEFAULT 'vao',
  ADD COLUMN escalation_level INT NOT NULL DEFAULT 0,
  ADD COLUMN last_escalated_at TIMESTAMPTZ;

-- Restrict complaint type enum (or use TEXT with CHECK) to water-only categories:
-- water_body_encroachment, supply_channel, surplus_channel,
-- water_flow_obstruction, dumping_waste
```

Escalation worker: a SQL function `escalate_overdue_complaints()` invoked from a cron-style server route — every complaint whose `current_rank` SLA (48h) has elapsed and is still not `in_progress`/`resolved` advances to the next rank (VAO → Tahsildar → RDO → Collector) and writes a `complaint_events` row + notifies the new assignee group.

RLS update: `officers read district complaints` policy extended so officer sees complaint only when `current_rank` matches their `officer_rank` OR they are WRD (sees all technical cases in district) OR they are Collector (sees all in district).

## 3. Citizen complaint form

Replace the existing TYPES list with exactly:
- Water Body Encroachment (Lake / Tank / Pond)
- Supply Channel Encroachment
- Surplus / Drain Channel Encroachment
- Water Flow Obstruction
- Dumping / Waste in Water Bodies

Drop the old `encroachment / contamination / dead_fish / oil_spill / sewage / other` options.

## 4. Authority dashboards (rank-scoped)

Single `/authority` route shell; sidebar identical, but **Queue/Dashboard data is filtered by rank**:

- **VAO** → complaints where `current_rank='vao'` in their district (initial field verification)
- **Tahsildar** → `current_rank='tahsildar'` (enforcement)
- **RDO** → `current_rank='rdo'` (escalated)
- **District Collector** → all complaints in district (full oversight)
- **WRD Engineer** → all complaints in district flagged technical (water flow obstruction + supply/surplus channel)

Header chip shows rank label. Resolution still requires geo-tagged proof photo.

## 5. Map View (officer + admin)

Upgrade `ComplaintMap` → **`DistrictMap`** component:
- Renders the selected district as a shaded polygon background (using a static bounding box + simple SVG outline derived from water-body coordinates — no external map tiles required).
- Plots **water bodies** as blue droplet markers (from `water_bodies` table; add `lat`,`lng` columns + seed coords for the 3 districts).
- Plots **complaints** colored by status (red/amber/green).
- Plots **AI alert hotspots** as pulsing rings (computed from clustering existing complaints + new `ai_alerts` table).
- Legend + filter toggles: Water Bodies / Complaints / Alerts.

Officer map → locked to their district. Admin map → district selector (all 3).

## 6. AI Alerts page (officer + admin)

Three tabbed sections:
1. **Fencing Alerts** — simulated geo-fence breaches: any complaint whose coords fall within 200m of a registered water body boundary triggers a fencing alert row. Pre-seeded with a handful of demo rows.
2. **Satellite Alerts** — pre-seeded `ai_alerts` rows with `source='satellite'` representing detected encroachment/turbidity changes per water body (mocked, with date + confidence %).
3. **Overdue (SLA Breach)** — live query of complaints where `sla_deadline < now()` and status not in (`resolved`). Click-through opens the complaint.

New table:
```sql
CREATE TABLE ai_alerts (
  id uuid PK, district_id uuid, water_body_id uuid,
  source TEXT CHECK (source IN ('fencing','satellite')),
  severity complaint_severity,
  title TEXT, description TEXT,
  lat double precision, lng double precision,
  confidence numeric, detected_at timestamptz default now()
);
```

## 7. Files touched

- `supabase/migrations/<new>.sql` — schema + RLS + escalation fn + seed water-body coords + seed `ai_alerts`
- Seed-update via `supabase--insert` to set demo data.
- `src/lib/auth.tsx` — extend Profile with `officer_rank`; signUp accepts rank.
- `src/routes/index.tsx` — collapse to 2 tabs, add rank dropdown for authority.
- New `src/routes/_authenticated/authority.tsx` + child routes (`index`, `queue`, `ai-alerts`, `map`, `notifications`). Delete or alias `officer/*` and `admin/*` (keep `admin/*` accessible only for seeded super-admin).
- `src/routes/_authenticated/citizen/file.tsx` — replace TYPES list.
- New `src/components/maps/DistrictMap.tsx` (replaces ComplaintMap usage).
- New `src/routes/api/public/cron-escalate.ts` server route to run the escalation function (callable by external cron).
- `src/components/app/RoleShell.tsx` — show officer rank under name.

```text
Landing
 ├── Authority tab → email/pwd + "Select Your Role" dropdown (signup)
 └── Citizen tab   → email/pwd

Authority shell (/authority)
 ├── Dashboard (rank-filtered metrics)
 ├── Queue     (rank-filtered complaints + escalate/resolve)
 ├── AI Alerts (Fencing | Satellite | Overdue tabs)
 ├── Map View  (district map + water bodies + complaints + alerts)
 └── Notifications

Escalation: VAO --48h--> Tahsildar --48h--> RDO --48h--> Collector
WRD Engineer: parallel access to technical-category complaints
```

After approval I'll run the migration first (single tool call), then ship the code changes in one batch.