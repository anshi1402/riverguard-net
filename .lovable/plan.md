
# BlueGeo AI — Smart Water Body Protection System

A full‑stack Tamil Nadu water body complaint management platform with three roles, realtime sync, geo‑tagged image uploads, and 48‑hour SLA enforcement. Visual style mirrors your reference (deep navy hero with cyan/teal accents, blue gradient sign‑in card, dark sidebar shell for dashboards).

## Scope (initial 3 districts)
From your CSV: **Tirunelveli, Thoothukudi, Tenkasi** — including their rivers, dams/reservoirs, lakes/tanks/wetlands and waterfalls.

## Pages & flows

### Public landing (`/`)
- Left: "Protecting Tamil Nadu's Water Bodies Together" hero with feature bullets and stats (3 Districts, 100+ Water Bodies, etc.)
- Right: Sign‑in card with role tabs **Administrator / Field Officer / Citizen**, email + password, Sign In button
- Sign‑up link for citizens; demo credentials hint for each role

### Citizen dashboard (`/citizen/*`)
- **Home** — greeting, "Report a Complaint" CTA, Filed/In‑Progress/Resolved counters, recent complaints list
- **File Complaint** — step flow:
  1. Pick district (only 3 available) → water body dropdown filtered to that district
  2. Complaint type (Encroachment, Water Contamination, Dead Fish, Oil Spill, Sewage, Other) + description
  3. **Upload image** (must contain GPS EXIF; we read and verify) **OR** **Take photo** (in‑browser camera + `navigator.geolocation` overlay stamped on image)
  4. Submit → record created, officers in district notified
- **My Complaints** — status timeline (Submitted → Assigned → In Progress → Resolved). On Resolved, citizen sees **Re‑investigate** action (one‑time) which reopens with reason
- **Notifications**

### Officer dashboard (`/officer/*`)
- **My Dashboard** — Assigned / In Progress / Resolved Today / Overdue tiles, SLA breach banner
- **Assigned Complaints** — list scoped to officer's district, sortable by remaining SLA, status update (Acknowledge → In Progress → Submit Resolution Report with notes + optional photo)
- **Map View** — pins for complaints in district
- **Notifications**
- 48h SLA countdown on every card; auto‑escalation when breached

### Admin dashboard (`/admin/*`)
- **Dashboard** — SLA breach banner, KPI tiles (Total Complaints, Active, Resolved, SLA Breached, Escalated, Officers on Duty, Critical, High‑Risk Bodies, Districts Covered, SLA Compliance %), trend chart (filed vs resolved vs breach), district distribution bar chart, severity pie, water body risk summary
- **Complaints** — full table with filters
- **Officer Tracking** — officers, district, on‑duty, open caseload, SLA performance
- **SLA Monitoring & Escalation Center** — list of breached cases
- **District View / Map View / Water Bodies / Reports / Notifications / Officer Notices**

## Realtime
Supabase Realtime channels on `complaints` and `complaint_events` so any insert/update by one role instantly reflects in the other two dashboards (no refresh).

## Design system
- Deep navy background `oklch(0.20 0.05 250)` with cyan/teal accent `oklch(0.78 0.14 195)` matching the hero
- Blue gradient primary button for citizen, green accent for officer header, dark navy for admin
- Inter (body) + a tight display weight for headings
- Sidebar shell shared across all three dashboards — only the brand stripe color changes per role

## Technical details

**Backend**: Lovable Cloud (Postgres + Auth + Storage + Realtime).

**Schema**
- `profiles` (id → auth.users, full_name, phone, district, avatar_url)
- `user_roles` (user_id, role: `admin` | `officer` | `citizen`) — separate table, `has_role()` SECURITY DEFINER fn
- `districts` (id, name) — seeded with 3
- `water_bodies` (id, district_id, name, type) — seeded from CSV
- `complaints` (id, code `CMP‑####`, citizen_id, water_body_id, district_id, type, description, image_url, lat, lng, status, severity, assigned_officer_id, sla_deadline (filed_at + 48h), resolved_at, reinvestigation_count, created_at, updated_at)
- `complaint_events` (id, complaint_id, actor_id, action, notes, photo_url, created_at) — full audit trail
- `notifications` (id, user_id, complaint_id, title, body, read, created_at)

**RLS**
- Citizens: read/insert own complaints, read events on own complaints
- Officers: read/update complaints in their district, insert events
- Admin: full read; insert notices via `has_role('admin')`
- All tables RLS enabled; role checks via `has_role()` to avoid recursion

**SLA & escalation**: `sla_deadline = filed_at + 48h`. A `pg_cron` job every 15 min flips overdue open complaints to `sla_breached`, inserts an admin notification, and logs an escalation event. Frontend also displays live countdowns.

**Geo‑tagging**
- Upload path: parse EXIF GPS in browser via `exifr`; reject if missing
- Camera path: `getUserMedia` + `navigator.geolocation.getCurrentPosition`; stamp lat/lng/timestamp onto the captured frame via canvas before upload
- Stored in Supabase Storage bucket `complaint-photos` (public read, authenticated write)

**Charts**: Recharts (line, bar, pie) for admin analytics.

**Files to create** (high level)
```
src/routes/
  index.tsx                     landing + sign-in
  signup.tsx                    citizen sign-up
  _authenticated.tsx            session gate
  _authenticated/citizen/...    home, file, my-complaints, complaint.$id, notifications
  _authenticated/officer/...    dashboard, complaints, complaint.$id, map, notifications
  _authenticated/admin/...      dashboard, complaints, officers, sla, districts, map, water-bodies, reports, notifications
src/components/
  layout/RoleSidebar.tsx, AppHeader.tsx
  complaints/ComplaintCard, StatusBadge, SlaCountdown, GeoCamera, GeoUploader
  charts/TrendChart, DistrictBars, SeverityPie, RiskSummary
src/lib/
  complaints.functions.ts, sla.ts, exif.ts, geo.ts
```

## What's intentionally out of scope for v1
- SMS / WhatsApp notifications (in‑app only)
- Live map tiles (we use a stylized district map; can swap to Mapbox later)
- Multi‑language UI (English only first; Tamil later)

## Build order
1. Enable Lovable Cloud, create schema + RLS + seed 3 districts and water bodies
2. Design system + landing page with role‑tabbed sign‑in
3. Auth + role‑aware routing + shared sidebar shell
4. Citizen flow (file → camera/upload geo → track → re‑investigate)
5. Officer flow (assigned list, SLA countdown, resolution report)
6. Admin dashboard (KPIs, charts, SLA monitoring)
7. Realtime subscriptions + pg_cron SLA breach job
8. Polish, demo seed data, QA all three roles

Approve and I'll start building.
