# Silwan Field Ops — Phase 1 prototype

Deploy technicians and teams to sites, and track them with **location-checked check-in / check-out**.
Built by Redstone for Silwan Security Systems. monday.com-style boards + the time and location layer monday doesn't have.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Deploy: push to GitHub → import in Vercel (no settings, no keys needed).
GPS only works on **https** (Vercel gives this) or localhost.

## What's in Phase 1

| Screen | Who | What |
|---|---|---|
| Today (`/`) | Owner, manager, lead | Today's jobs, "where is my team now" map + list, live alerts |
| Board (`/board`) | Owner, manager, lead | monday-style table grouped by site/team, kanban (drag to Done/Stuck), week calendar |
| Sites (`/sites`) | Owner, manager | Site name, client, stage label, location (search or pin or "use my location"), check-in zone size |
| New task (drawer) | Owner, manager | Task or maintenance ticket, site, time slot, team/people, permissions, report needed |
| Alerts (`/alerts`) | Owner, manager, lead | Late, outside site, still on site, report late, left early, overdue. Filters + "Got it". Alert rules editable |
| Timesheets (`/timesheets`) | Owner, manager, lead | Per person per week: actual vs planned hours, flags, CSV export |
| My day (`/tech`) | Technician | Today's job, map, live distance, **real GPS check-in**, report, check-out |
| My week (`/tech/week`) | Technician | Planned vs worked hours |

Switch roles with **Viewing as** in the header.

### How the location check works
- Each site has a centre point and a zone (default 150 m).
- Check-in reads the phone's GPS. Inside the zone → accepted. Outside → blocked, and the try shows as an alert with the distance.
- Check-in and check-out both save GPS position + time.
- "Still on site after check-out" is simulated with a button in the prototype. In the real app the phone's OS geofencing (enter/exit events, low battery) does this.

### Demo tips
- Sample data is rebuilt around "now" every day (footer → **Reset demo** to rebuild any time).
- Sample sites are around Doha, so a real check-in from the office is blocked (correct behaviour).
- To see a real check-in pass: as a technician, open **Demo tools → Create a test job where I am**, then tap **Check in**.

## Code map (built to keep going, not to throw away)

```
src/lib/types.ts    data model (maps 1:1 to database tables)
src/lib/rules.ts    pure rules: status, alerts, permissions, hours  ← reuse on the server
src/lib/geo.ts      distance + geofence check
src/lib/seed.ts     sample data
src/lib/store.ts    state + actions (browser storage for now)       ← swap for database calls
src/components/     shell, drawers (forms/details), map, UI bits
src/app/            one folder per screen
```

Stack: Next.js (official starter), React, Leaflet + OpenStreetMap/CARTO tiles (no API key), Nominatim search, dnd-kit (kanban), date-fns, Zustand.
Design: monday.com look, built on the colour, font and spacing tokens of monday's open-source design system Vibe (@vibe/style, MIT). Light mode only.

## Next steps for the real build
1. Database + login (Supabase/Postgres): tables from `types.ts`, row-level security from `rules.ts` permissions.
2. Move `store.ts` actions to API calls; run `computeAlerts` on the server every minute; push alerts (WhatsApp/SMS/push).
3. Technician phone app (Expo/React Native or Capacitor) with OS geofencing for enter/exit events.
4. Server-side check of check-in distance (don't trust the phone alone), mock-location detection.
5. Google Places search if wanted (needs a Google Maps key).
6. Arabic translation file + RTL switch.

## Phase 2 (not built)
- Documentation checklist per project
- MOI approval workflow
- BOQ and document storage
- Full project management (stages as real workflows, budgets, materials)
