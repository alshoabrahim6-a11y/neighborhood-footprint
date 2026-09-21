// ============================================================================
// routes/neighborhoods.js
// ----------------------------------------------------------------------------
//   GET /api/neighborhoods → list of neighborhoods with their eco points (for the points board)
// ============================================================================

import express from 'express';
import { supabase } from '../services/supabaseClient.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('neighborhoods')
    .select('*')
    .order('eco_points', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

export default router;
