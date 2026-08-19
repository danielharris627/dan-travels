-- Run this in the Supabase SQL editor for your Travels project (a NEW
-- Supabase project, separate from Dan's Dashboard).

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists city_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  city_name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'America/New_York',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists city_stops_trip_idx on city_stops (trip_id);

-- Safe to re-run on an existing table: adds the column if you already ran
-- the create table above without it.
alter table city_stops add column if not exists timezone text not null default 'America/New_York';

-- Shared tag vocabulary (Bars, Cafés, Attractions, Hiking...) — reused
-- across every city stop and trip, same pattern as Vancouver's tags table.
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  icon text not null default '🏷️',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- A place is either an "idea" (scheduled_date is null) or an itinerary item
-- (scheduled_date is set). Scheduling an idea just fills in that column —
-- no separate table, no duplication.
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  city_stop_id uuid not null references city_stops(id) on delete cascade,
  title text not null,
  area text,
  borough text,
  notes text,
  tags text[] default '{}',
  status text not null default 'active',
  in_itinerary boolean not null default false,
  scheduled_date date,
  scheduled_time time,
  sort_order integer not null default 0,
  address text,
  lat double precision,
  lng double precision,
  maps_url text,
  google_place_id text,
  source text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists places_city_stop_idx on places (city_stop_id);
create index if not exists places_status_idx on places (status);
create index if not exists places_scheduled_idx on places (scheduled_date);

alter table trips enable row level security;
alter table city_stops enable row level security;
alter table tags enable row level security;
alter table places enable row level security;

create policy "Allow all for anon (personal use only) - trips"
  on trips for all using (true) with check (true);
create policy "Allow all for anon (personal use only) - city_stops"
  on city_stops for all using (true) with check (true);
create policy "Allow all for anon (personal use only) - tags"
  on tags for all using (true) with check (true);
create policy "Allow all for anon (personal use only) - places"
  on places for all using (true) with check (true);

insert into tags (label, icon, sort_order) values
  ('Bars', '🍺', 0),
  ('Cafés', '☕', 1),
  ('Food & Restaurants', '🍽️', 2),
  ('Hiking & Outdoors', '🥾', 3),
  ('Attractions', '⭐', 4)
on conflict (label) do nothing;

-- Which import a place came from ('2025 notes', '2026 notes', 'Google Maps'),
-- shown as a small badge. Left null for anything added directly in the app.
alter table places add column if not exists source text;

-- Trip-level notes, grouped into user-named categories (Links, Flights,
-- Packing, etc). One note per category, same link-in-notes pattern as places.
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  category text not null,
  content text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resources_trip_idx on resources (trip_id);

alter table resources enable row level security;

create policy "Allow all for anon (personal use only) - resources"
  on resources
  for all
  using (true)
  with check (true);

-- Ideas for the Travels app itself — not scoped to any trip.
create table if not exists app_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table app_ideas enable row level security;

create policy "Allow all for anon (personal use only) - app_ideas"
  on app_ideas
  for all
  using (true)
  with check (true);

-- Free-form notes per itinerary day (bold, nested bullets, interactive
-- checklists, links). One row per city_stop + calendar date.
create table if not exists day_notes (
  id uuid primary key default gen_random_uuid(),
  city_stop_id uuid not null references city_stops(id) on delete cascade,
  date date not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(city_stop_id, date)
);

alter table day_notes enable row level security;

create policy "Allow all for anon (personal use only) - day_notes"
  on day_notes
  for all
  using (true)
  with check (true);

-- One free-form notes block per city stop for the "Other" tab — same
-- purpose as day_notes but not tied to a specific date.
create table if not exists other_notes (
  city_stop_id uuid primary key references city_stops(id) on delete cascade,
  content text,
  updated_at timestamptz not null default now()
);

alter table other_notes enable row level security;

create policy "Allow all for anon (personal use only) - other_notes"
  on other_notes
  for all
  using (true)
  with check (true);

-- Areas you can hide from the filter row per city stop (e.g. "Sunset Park"
-- with just one saved place) without deleting the places themselves.
create table if not exists hidden_areas (
  id uuid primary key default gen_random_uuid(),
  city_stop_id uuid not null references city_stops(id) on delete cascade,
  area text not null,
  created_at timestamptz not null default now(),
  unique(city_stop_id, area)
);

alter table hidden_areas enable row level security;

create policy "Allow all for anon (personal use only) - hidden_areas"
  on hidden_areas
  for all
  using (true)
  with check (true);
