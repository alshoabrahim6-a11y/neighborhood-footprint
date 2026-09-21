-- ============================================================================
--  Neighborhood Footprint — Database
-- ============================================================================
-- Run this file once, inside your Supabase project:
--   1) Open your project on supabase.com
--   2) From the side menu: SQL Editor
--   3) Click New query, paste this entire file's content, and click Run
--
-- This file creates: two tables (neighborhoods and reports) + simple security
-- policies (RLS)
-- ============================================================================

-- Enable the uuid extension (so we can generate a random, unique id for each row)
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1) Neighborhoods table
--    Each neighborhood has "eco points" (eco_points) that start at 100 and go
--    down every time pollution is reported in it, and gradually go back up
--    when there are no new reports.
-- ----------------------------------------------------------------------------
create table if not exists neighborhoods (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,          -- neighborhood name, must be unique
  eco_points    numeric not null default 100,  -- from 0 to 100
  last_report_at timestamptz,                  -- last time pollution was reported in this neighborhood
  created_at    timestamptz not null default now()
);

comment on table neighborhoods is 'Neighborhoods and their eco score (0 to 100)';

-- Initial seed: a few demo neighborhoods so you can try the system right away.
-- Change these names to real neighborhoods in your area for the presentation.
insert into neighborhoods (name) values
  ('Al-Nuzha'),
  ('Al-Zuhoor'),
  ('Al-Amal')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 2) Reports table
--    Each row = one pollution report submitted by a user: image + location +
--    pollution type (from AI)
-- ----------------------------------------------------------------------------
create table if not exists reports (
  id               uuid primary key default gen_random_uuid(),
  neighborhood_id  uuid references neighborhoods(id) on delete set null,
  image_url        text not null,               -- image URL on Supabase Storage
  latitude         double precision not null,
  longitude        double precision not null,
  pollution_type   text not null default 'unknown', -- the type determined by the AI
  ai_confidence    numeric,                      -- AI confidence score (0 to 1)
  ai_raw_labels    jsonb,                        -- all classification results (for transparency/reporting)
  description      text,                         -- optional note from the user
  status           text not null default 'pending', -- pending / reviewed (for the future)
  user_id          uuid references auth.users(id) on delete set null, -- report owner (if logged in at the time)
  user_email       text,                         -- a copy of the email at submission time (easier to display without a join)
  created_at       timestamptz not null default now()
);

comment on table reports is 'Pollution reports submitted by users';

-- Index so queries that fetch reports by neighborhood or date are faster
create index if not exists idx_reports_neighborhood on reports(neighborhood_id);
create index if not exists idx_reports_created_at on reports(created_at desc);

-- ----------------------------------------------------------------------------
-- 3) Security policies (Row Level Security)
--    Our server (Express backend) connects to the database with a private key
--    (service role key), and this key automatically bypasses all these rules.
--    The rules below are just extra protection, to prevent anyone from
--    accessing the database directly from the browser with the public
--    (anon) key and reading/modifying something they shouldn't.
-- ----------------------------------------------------------------------------
alter table neighborhoods enable row level security;
alter table reports enable row level security;

-- Public reads are allowed so any visitor can view the map and the points board
drop policy if exists "public read neighborhoods" on neighborhoods;
create policy "public read neighborhoods" on neighborhoods
  for select using (true);

drop policy if exists "public read reports" on reports;
create policy "public read reports" on reports
  for select using (true);

-- No INSERT/UPDATE/DELETE is allowed from the anon key — all writes happen
-- only through our server (which uses the service role key and bypasses RLS).

-- ----------------------------------------------------------------------------
-- 4) Admins table — admin panel
--    Any account (user_id) present in this table can open the admin panel
--    and approve/reject reports. Entries are normally added via the
--    backend/scripts/make-admin.js script, not manually from here.
-- ----------------------------------------------------------------------------
create table if not exists admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;
-- There is intentionally no public policy here — only the backend server
-- (service role) can read this table, which is exactly what we want (so
-- even the frontend can't reach it directly under any circumstances).

-- Automatically approve any old reports that existed before the admin panel
-- feature was enabled, so they don't suddenly disappear from the public map.
update reports set status = 'approved' where status = 'pending';

-- ----------------------------------------------------------------------------
-- 5) Saved periodic report snapshots table (report_snapshots) — automatic
--    periodic reports: every week (via node-cron in backend/server.js) a
--    statistical summary of the reports is calculated and saved here
--    automatically, so we keep a historical "archive" even if the data
--    changes later. The admin can also generate a report on demand manually
--    without waiting for the weekly schedule.
-- ----------------------------------------------------------------------------
create table if not exists report_snapshots (
  id            uuid primary key default gen_random_uuid(),
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  total_reports integer not null default 0,
  summary       jsonb not null,   -- all report details (breakdown by neighborhood/type, comparison...)
  created_at    timestamptz not null default now()
);

alter table report_snapshots enable row level security;
-- There is intentionally no public policy here — only the backend server
-- (service role) can reach it.

-- ============================================================================
-- Done! Go back to the app and continue with the steps in README.md
-- ============================================================================
