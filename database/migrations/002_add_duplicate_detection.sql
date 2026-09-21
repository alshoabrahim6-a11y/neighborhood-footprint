-- ============================================================================
-- 002_add_duplicate_detection.sql
-- ----------------------------------------------------------------------------
-- "Duplicate report detection" feature: we add two columns to the reports
-- table:
--   is_duplicate  → whether the system detected that this report is
--                   similar/duplicate to a nearby previous report
--   duplicate_of  → the id of the original report it resembles (if it's a
--                   duplicate)
--
-- ⚠️ This is only a change to the table's "shape" (schema) — it does not
-- delete or change any report you currently have. All old reports will
-- automatically get is_duplicate = false.
--
-- How to run it (only once), exactly like schema.sql:
--   1) Open your project on supabase.com
--   2) From the side menu: SQL Editor
--   3) Click New query, paste this entire file's content, and click Run
-- ============================================================================

alter table reports
  add column if not exists is_duplicate boolean not null default false,
  add column if not exists duplicate_of uuid references reports(id) on delete set null;

create index if not exists idx_reports_duplicate_of on reports(duplicate_of);

comment on column reports.is_duplicate is 'Whether the system detected that this report is geographically/type-similar to a nearby previous report';
comment on column reports.duplicate_of is 'The id of the original report this one resembles (if there is a potential duplicate)';

-- ============================================================================
-- Done! Go back to the app — no need to restart the database
-- ============================================================================
