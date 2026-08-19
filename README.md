# Dan's Travels

Trip planning app: multiple trips, each with one or more city stops, each
with its own itinerary (grouped by date) and a running list of ideas
(unscheduled things to do), filterable by tag and by area.

## Stack
React + Vite, Tailwind CSS, Supabase (Postgres). Same pattern as Dan's
Dashboard, but a separate project/deployment — different repo, different
Supabase project, its own home-screen icon.

## Setup

1. `npm install`
2. Create a **new** Supabase project (separate from Dan's Dashboard's).
3. Run `supabase/schema.sql` in that project's SQL editor. It's all new
   tables, safe to run as one block.
4. `cp .env.example .env` and fill in that project's URL + anon key.
5. `npm run dev`
6. Deploy to Vercel the same way as Dan's Dashboard: push to a new GitHub
   repo, import into Vercel, set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` as env vars there too.

## How the auto-select logic works

On load, the app looks across every city stop in every trip and picks the
**earliest one that hasn't ended yet** (`end_at` in the future). That single
rule handles all three cases:
- Before a trip: shows the soonest upcoming stop.
- During a stop: keeps showing it until `end_at` passes.
- The moment a stop ends: automatically rolls over to whichever stop is
  next, no manual switching needed.

If every stop in every trip has ended, there's nothing to auto-select, and
you land on a "no active trip" screen rather than a guess. You can always
override the auto pick via the **Switch** button — that override only lasts
for the current session (it doesn't persist on reload), so opening the app
fresh always goes back to whatever's actually current.

## Data model

- **trips**: just a name.
- **city_stops**: belongs to a trip, has `start_at`/`end_at` (full
  timestamps, not just dates — needed since you gave an exact "6pm
  Wednesday" cutoff).
- **places**: belongs to a city stop. An "idea" and an "itinerary item" are
  the same row — the only difference is whether `scheduled_date` is set.
  Scheduling an idea (via the "Schedule this" button) just fills in that
  column; unscheduling clears it. `area` is free text but also drives the
  auto-generated area filter chips (whatever values you've actually used
  show up as pills — no separate area-management screen).
- **tags**: shared across every trip and city, same pattern as Vancouver in
  Dan's Dashboard — user-managed label + emoji icon, reorderable, editable,
  deletable (with cascading rename so existing places don't go stale).

## Not built yet

- **Google Maps import** — you've used ExportMyMap before for Dan & Tobi HQ;
  a bulk-import feature reading that export format is a reasonable follow-up
  if re-typing saved places by hand gets old.
- **Location features** (nearby-me, click-a-map-area) — discussed at length
  but intentionally not built yet; needs coordinates on each place
  (geocoding) plus a mapping library decision (Leaflet/OSM leaned toward for
  cost reasons).
- **Offline support** — no service worker yet, so it needs a connection.
  Worth adding before actual travel with spotty signal, but intentionally
  skipped for now since it complicates active development (stale cache risk
  while you're still iterating on the app).
