-- ============================================================================
-- 003_enable_realtime.sql
-- ----------------------------------------------------------------------------
-- "Live map updates" feature: for the frontend to receive instant
-- notifications whenever anything changes in the reports table (new report,
-- approval, rejection...), we need to enable the Realtime feature on this
-- table in your Supabase project.
--
-- ⚠️ Note: if this code returns an error like "relation "reports" is
-- already member of publication", that means Realtime is already enabled
-- on the table — that's fine, ignore the error and continue, no need to do
-- anything else.
--
-- Easier alternative (if you'd like): instead of running this code, you can
-- go from the Supabase dashboard to: Database → Replication → click
-- "supabase_realtime" → enable (toggle) the "reports" table.
--
-- How to run it (only once), exactly like the other migration files:
--   1) Open your project on supabase.com → SQL Editor
--   2) Click New query, paste this entire file's content, and click Run
-- ============================================================================

alter publication supabase_realtime add table reports;

-- ============================================================================
-- Done! Go back to the app — refresh the map page and check for the green
-- "Live updates enabled" badge
-- ============================================================================
