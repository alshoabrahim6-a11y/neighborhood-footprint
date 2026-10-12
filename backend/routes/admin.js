// ============================================================================
// routes/admin.js
// ----------------------------------------------------------------------------
// All the endpoints for the Admin Panel. All protected by requireAdmin: any
// request not from an admin account is automatically rejected before it
// reaches here.
//
//   GET   /api/admin/check                    → lets the frontend confirm the user is an admin
//   GET   /api/admin/reports                  → all reports (pending first) for review
//   PATCH /api/admin/reports/:id/status       → approve or reject a given report
//   GET   /api/admin/reports/summary          → live statistical summary for a given period (a quick report)
//   GET   /api/admin/reports/snapshots        → list of automatically saved weekly reports
//   GET   /api/admin/reports/snapshots/:id    → details of a specific saved weekly report
//   POST  /api/admin/reports/snapshots/generate → generate a weekly report immediately, by hand (instead of waiting for the schedule)
// ============================================================================

import express from 'express';
import { supabase } from '../services/supabaseClient.js';
import { applyReportPenalty } from '../services/ecoPoints.js';
import { requireAdmin, requireFullAdmin } from '../middleware/requireAdmin.js';
import { getPeriodSummary, saveWeeklySnapshot } from '../services/reportSummary.js';

const router = express.Router();

// All endpoints below first pass through requireAdmin
router.use(requireAdmin);

router.get('/check', (req, res) => {
  res.json({ isAdmin: true, email: req.user.email, role: req.user.role });
});

// ----------------------------------------------------------------------------
// User & admin management — everything here used to require running a
// script from the terminal (backend/scripts/make-admin.js, list-users.js,
// fix-admin.js). It now all lives in the app itself, behind requireAdmin
// (and requireFullAdmin for anything that grants/revokes permissions).
// ----------------------------------------------------------------------------

// GET /api/admin/users → every registered account, with their admin role (if any)
router.get('/users', async (req, res) => {
  try {
    const { data: userList, error: usersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) {
      return res.status(500).json({ error: usersError.message });
    }

    // select('*') so this also works before migration 004_admin_roles.sql
    // has been applied (the 'role' column wouldn't exist yet).
    const { data: adminRows, error: adminsError } = await supabase.from('admins').select('*');

    if (adminsError) {
      return res.status(500).json({ error: adminsError.message });
    }

    // Before the migration, being listed in `admins` at all meant full
    // admin access (no role column existed) — default to 'admin' so those
    // accounts still show up correctly as admins here.
    const roleByUserId = Object.fromEntries((adminRows || []).map((row) => [row.user_id, row.role || 'admin']));

    const users = userList.users.map((u) => ({
      id: u.id,
      email: u.email,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
      role: roleByUserId[u.id] || null, // 'admin' / 'moderator' / null (regular user)
    }));

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/admins → just the accounts that currently have admin/moderator access
router.get('/admins', async (req, res) => {
  // select('*') so this also works before migration 004_admin_roles.sql
  // has been applied (role/added_by/created_at wouldn't exist yet).
  const { data, error } = await supabase.from('admins').select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// POST /api/admin/admins → { email, role } — grants admin/moderator access to an existing account
// Only a full admin can do this (see requireFullAdmin).
router.post('/admins', requireFullAdmin, async (req, res) => {
  const { email, role } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email is required' });
  }
  const safeRole = role === 'moderator' ? 'moderator' : 'admin';

  // Find the account by email so we can add it by its user_id (the admins
  // table is keyed by user_id, not email — the account has to already exist).
  const { data: userList, error: lookupError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (lookupError) {
    return res.status(500).json({ error: lookupError.message });
  }

  const targetUser = userList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!targetUser) {
    return res.status(404).json({ error: 'No registered account found with that email. They need to sign up first.' });
  }

  // Try with the full RBAC columns first; if migration 004_admin_roles.sql
  // hasn't been run on this database yet, 'role'/'added_by' won't exist —
  // fall back to inserting just the user_id so this endpoint still works
  // (the account will have full admin access either way, just without the
  // extra bookkeeping columns until the migration is applied).
  let insertError = (await supabase
    .from('admins')
    .upsert({ user_id: targetUser.id, role: safeRole, added_by: req.user.id }, { onConflict: 'user_id' })).error;

  if (insertError && /column .* does not exist/i.test(insertError.message || '')) {
    insertError = (await supabase.from('admins').upsert({ user_id: targetUser.id }, { onConflict: 'user_id' })).error;
  }

  if (insertError) {
    return res.status(500).json({ error: insertError.message });
  }

  res.json({ success: true, userId: targetUser.id, email: targetUser.email, role: safeRole });
});

// DELETE /api/admin/admins/:userId → revokes admin/moderator access
// Only a full admin can do this, and an admin cannot remove their own
// access this way (avoids everyone accidentally locking themselves out).
router.delete('/admins/:userId', requireFullAdmin, async (req, res) => {
  const { userId } = req.params;

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'You cannot remove your own admin access.' });
  }

  const { error } = await supabase.from('admins').delete().eq('user_id', userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// ----------------------------------------------------------------------------
// GET /api/admin/reports → all reports, with "pending" ones first
// ----------------------------------------------------------------------------
router.get('/reports', async (req, res) => {
  const { data, error } = await supabase
    .from('reports')
    .select('*, neighborhoods(name), duplicate_report:duplicate_of(created_at, user_email)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Sort so "pending" reports show up on top (the most important thing for
  // the admin to review), with the rest below in their original order
  // (newest first). Array.prototype.sort is stable in modern JavaScript, so
  // the "newest first" order within each group is preserved.
  const sorted = [...data].sort((a, b) => {
    if (a.status === b.status) return 0;
    if (a.status === 'pending') return -1;
    if (b.status === 'pending') return 1;
    return 0;
  });

  res.json(sorted);
});

// ----------------------------------------------------------------------------
// PATCH /api/admin/reports/:id/status → { status: 'approved' | 'rejected' }
// ----------------------------------------------------------------------------
router.patch('/reports/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved, rejected, or pending' });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('reports')
    .select('status, neighborhood_id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Report not found' });
  }

  // Once a report has been decided (approved or rejected), that decision is
  // final — an admin cannot flip it to a different status afterwards. This
  // avoids accidentally (or intentionally) reversing a decision that may
  // have already affected a neighborhood's eco points. Re-sending the same
  // status again (e.g. double-clicking "Approve") is harmless and allowed.
  const alreadyDecided = existing.status === 'approved' || existing.status === 'rejected';
  if (alreadyDecided && existing.status !== status) {
    return res.status(409).json({
      error: `This report was already ${existing.status} and its decision cannot be changed.`,
    });
  }

  const { error: updateError } = await supabase.from('reports').update({ status }).eq('id', id);

  if (updateError) {
    return res.status(500).json({ error: 'Failed to update the report status' });
  }

  // Neighborhood points only drop the first time a report gets approved
  // (avoids applying the penalty twice if the admin accidentally clicks
  // "Approve" more than once)
  if (status === 'approved' && existing.status !== 'approved' && existing.neighborhood_id) {
    await applyReportPenalty(existing.neighborhood_id);
  }

  res.json({ success: true });
});

// ----------------------------------------------------------------------------
// GET /api/admin/reports/summary?days=7 → a live statistical summary for the last N days
// (not saved — computed live every time the admin opens the page or changes the period)
// ----------------------------------------------------------------------------
router.get('/reports/summary', async (req, res) => {
  const days = Number(req.query.days) || 7;

  try {
    const summary = await getPeriodSummary(days);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// GET /api/admin/reports/snapshots → list of saved weekly reports
// (generated automatically every week via node-cron — see server.js)
// ----------------------------------------------------------------------------
router.get('/reports/snapshots', async (req, res) => {
  const { data, error } = await supabase
    .from('report_snapshots')
    .select('id, period_start, period_end, total_reports, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// ----------------------------------------------------------------------------
// GET /api/admin/reports/snapshots/:id → details of a specific saved weekly report
// ----------------------------------------------------------------------------
router.get('/reports/snapshots/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('report_snapshots')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Report not found' });
  }

  res.json(data.summary);
});

// ----------------------------------------------------------------------------
// POST /api/admin/reports/snapshots/generate → generate and save a weekly report immediately
// (exactly the same as the automatic job, but the admin triggers it by hand
// whenever they like, without waiting for the weekly schedule — useful for
// testing and demos)
// ----------------------------------------------------------------------------
router.post('/reports/snapshots/generate', async (req, res) => {
  try {
    const snapshot = await saveWeeklySnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
