-- ============================================================================
-- 004_admin_roles.sql
-- ----------------------------------------------------------------------------
-- "Roles & permissions (RBAC)" feature: until now, the `admins` table only
-- recorded WHO is an admin (a flat list), and the only way to add/remove
-- someone was by running a script from the terminal
-- (backend/scripts/make-admin.js).
--
-- This migration adds a `role` column so an admin's permission level is a
-- real, explicit field (not just "present in the table = admin"), and sets
-- up what's needed so admins can now be managed from INSIDE the app
-- (Admin Panel → "Manage Admins"), not from scripts.
--
-- Roles:
--   'admin'       → full access (approve/reject reports, manage other admins)
--   'moderator'   → can approve/reject reports, cannot manage other admins
--                   (kept here for future use; the app currently only
--                   assigns 'admin' — you can extend the Admin Panel later
--                   to offer 'moderator' too)
--
-- ⚠️ This only changes the table's "shape" (schema) — it does not remove or
-- affect any existing admin. Every admin currently in the table
-- automatically gets role = 'admin' (same permissions they already had).
--
-- How to run it (only once), exactly like the other migration files:
--   1) Open your project on supabase.com → SQL Editor
--   2) Click New query, paste this entire file's content, and click Run
-- ============================================================================

alter table admins
  add column if not exists role text not null default 'admin'
    check (role in ('admin', 'moderator')),
  add column if not exists added_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

comment on column admins.role is 'Permission level: admin (full access) or moderator (reports only)';
comment on column admins.added_by is 'Which admin account granted this permission (set by the in-app Admin Panel; null for admins added before this column existed)';

comment on table admins is 'Role-based access: any account (user_id) listed here has elevated permissions at the level given by "role". Managed from the app itself — Admin Panel → Manage Admins — not from scripts.';

-- ============================================================================
-- Done! Go back to the app — open the Admin Panel, you should now see a
-- "Manage Admins" section where you can add/remove admins by email.
-- ============================================================================
