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
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getPeriodSummary, saveWeeklySnapshot } from '../services/reportSummary.js';

const router = express.Router();

// All endpoints below first pass through requireAdmin
router.use(requireAdmin);

router.get('/check', (req, res) => {
  res.json({ isAdmin: true, email: req.user.email });
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
