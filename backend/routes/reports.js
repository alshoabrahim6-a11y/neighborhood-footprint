// ============================================================================
// routes/reports.js
// ----------------------------------------------------------------------------
// All endpoints related to pollution reports:
//   POST /api/reports          → submit a new report (photo + location)
//   GET  /api/reports          → list of all reports (to show as points on the map)
//   GET  /api/reports/heatmap  → the same data, formatted for Leaflet.heat
// ============================================================================

import express from 'express';
import multer from 'multer';
import { supabase, STORAGE_BUCKET } from '../services/supabaseClient.js';
import { classifyPollutionImage } from '../services/aiClassifier.js';
import { getOverallStats, getLeaderboard } from '../services/reportSummary.js';
import { findDuplicateReport } from '../services/duplicateDetection.js';

const router = express.Router();

// multer: receives the uploaded image file from the form and holds it in
// memory (RAM) temporarily (instead of storing it on the server's disk)
// since we're about to upload it straight to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // max 8 MB per image
});

// ----------------------------------------------------------------------------
// POST /api/reports
// ----------------------------------------------------------------------------
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { latitude, longitude, neighborhood_id, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'You must upload a photo with the report (image)' });
    }
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'You must send latitude and longitude' });
    }

    // Logging in is optional: if the frontend sent an "Authorization:
    // Bearer <token>" header (meaning the user is logged in), we verify
    // the token with Supabase and get their identity so we can link the
    // report to them. If there's no token or it's invalid, the report is
    // saved normally without being linked to any account (login isn't
    // required in this version).
    let userId = null;
    let userEmail = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const { data, error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        console.warn('⚠️ Invalid login token, the report will be saved without an account:', authError.message);
      } else if (data?.user) {
        userId = data.user.id;
        userEmail = data.user.email;
      }
    }

    // 1) Upload the image to Supabase Storage under a unique name (timestamp + random number)
    const fileExt = req.file.originalname.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

    if (uploadError) {
      console.error('❌ Error uploading the image:', uploadError.message);
      return res.status(500).json({ error: 'Failed to upload the image to Storage' });
    }

    const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
    const imageUrl = publicUrlData.publicUrl;

    // 2) Classify the image with AI (CLIP via Hugging Face)
    const classification = await classifyPollutionImage(req.file.buffer);

    // 2.5) Duplicate report detection: is there a previous report nearby
    // (< 100 meters) with the same pollution type within the last two
    // weeks? We don't reject the new report — we just flag it so the admin
    // can see it in the admin panel (see services/duplicateDetection.js)
    const duplicateMatch = await findDuplicateReport({
      latitude: Number(latitude),
      longitude: Number(longitude),
      pollutionType: classification.pollutionType,
    });

    // 3) Save the report to the database
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        neighborhood_id: neighborhood_id || null,
        image_url: imageUrl,
        latitude: Number(latitude),
        longitude: Number(longitude),
        pollution_type: classification.pollutionType,
        ai_confidence: classification.confidence,
        ai_raw_labels: classification.rawLabels,
        description: description || null,
        user_id: userId,
        user_email: userEmail,
        is_duplicate: Boolean(duplicateMatch),
        duplicate_of: duplicateMatch?.id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error saving the report:', insertError.message);
      return res.status(500).json({ error: 'Failed to save the report to the database' });
    }

    // ⚠️ Note: neighborhood points no longer drop here immediately. After
    // adding the "Admin Panel", the report stays in "pending" status and
    // doesn't affect neighborhood points or show up on the public map until
    // an admin approves it — only then do the neighborhood points drop
    // (see routes/admin.js).

    res.status(201).json({ report, classification });
  } catch (err) {
    console.error('❌ Unexpected error in POST /api/reports:', err);
    res.status(500).json({ error: 'An unexpected server error occurred' });
  }
});

// ----------------------------------------------------------------------------
// GET /api/reports  → the last 500 "approved" reports (for the map and public list)
// ----------------------------------------------------------------------------
// ⚠️ We only show reports where status = 'approved'. New reports always
// start out 'pending' and don't show up here until an admin approves them
// from the admin panel (see routes/admin.js).
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('reports')
    .select('*, neighborhoods(name)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// ----------------------------------------------------------------------------
// GET /api/reports/heatmap → [[lat, lng, intensity], ...] for Leaflet.heat
// ----------------------------------------------------------------------------
router.get('/heatmap', async (req, res) => {
  const { data, error } = await supabase
    .from('reports')
    .select('latitude, longitude, ai_confidence')
    .eq('status', 'approved')
    .neq('pollution_type', 'no_pollution');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const points = data.map((r) => [r.latitude, r.longitude, r.ai_confidence || 0.5]);
  res.json(points);
});

// ----------------------------------------------------------------------------
// GET /api/reports/stats → public statistics (Public Dashboard) for everyone,
// no login required — total reports, distribution by neighborhood and type,
// and the weekly trend (see services/reportSummary.js → getOverallStats for
// the calculation details)
// ----------------------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const stats = await getOverallStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// GET /api/reports/leaderboard → leaderboard (most active reporters), public
// and available to everyone without logging in (see services/reportSummary.js
// → getLeaderboard for the calculation details and why it's safe to show publicly)
// ----------------------------------------------------------------------------
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const leaderboard = await getLeaderboard(limit);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
