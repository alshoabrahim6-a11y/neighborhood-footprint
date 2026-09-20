// ============================================================================
// routes/neighborhoods.js
// ----------------------------------------------------------------------------
//   GET /api/neighborhoods → قائمة الأحياء مع نقاطها البيئية (للوحة النقاط)
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
