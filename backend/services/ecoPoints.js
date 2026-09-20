// ============================================================================
// ecoPoints.js
// ----------------------------------------------------------------------------
// منطق "النقاط البيئية" لكل حي:
//   - كل بلاغ تلوث جديد بينزل نقاط الحي (عقوبة)
//   - كل يوم ما في فيه بلاغات جديدة، نقاط الحي بترجع تزيد شوي (تعافي)
//   النقاط محصورة دائمًا بين 0 و 100.
// ============================================================================

import { supabase } from './supabaseClient.js';

const PENALTY_PER_REPORT = 5; // كم نقطة تنزل مع كل بلاغ جديد
const RECOVERY_PER_DAY = 2; // كم نقطة ترجع كل يوم بدون بلاغات جديدة
const MAX_POINTS = 100;
const MIN_POINTS = 0;

/**
 * بينزل نقاط حي معيّن بعد وصول بلاغ تلوث جديد له.
 * @param {string} neighborhoodId
 */
export async function applyReportPenalty(neighborhoodId) {
  if (!neighborhoodId) return;

  const { data: neighborhood, error: fetchError } = await supabase
    .from('neighborhoods')
    .select('eco_points')
    .eq('id', neighborhoodId)
    .single();

  if (fetchError) {
    console.error('❌ ما قدرنا نجيب نقاط الحي:', fetchError.message);
    return;
  }

  const newPoints = Math.max(MIN_POINTS, neighborhood.eco_points - PENALTY_PER_REPORT);

  const { error: updateError } = await supabase
    .from('neighborhoods')
    .update({ eco_points: newPoints, last_report_at: new Date().toISOString() })
    .eq('id', neighborhoodId);

  if (updateError) {
    console.error('❌ ما قدرنا نحدّث نقاط الحي:', updateError.message);
  }
}

/**
 * وظيفة دورية (بتشتغل مرة كل يوم من server.js عبر node-cron):
 * بترجع تزيد نقاط كل الأحياء اللي ما إلها بلاغات جديدة، حسب عدد
 * الأيام اللي مرّت من آخر بلاغ.
 */
export async function recoverPointsForAllNeighborhoods() {
  const { data: neighborhoods, error } = await supabase
    .from('neighborhoods')
    .select('id, eco_points, last_report_at');

  if (error) {
    console.error('❌ ما قدرنا نجيب قائمة الأحياء للتعافي:', error.message);
    return;
  }

  const now = Date.now();

  for (const n of neighborhoods) {
    if (n.eco_points >= MAX_POINTS) continue;

    const daysSinceLastReport = n.last_report_at
      ? Math.floor((now - new Date(n.last_report_at).getTime()) / (1000 * 60 * 60 * 24))
      : 1; // إذا ما في بلاغات أبدًا، اعتبره يوم واحد فاضي

    if (daysSinceLastReport < 1) continue;

    const recovered = Math.min(MAX_POINTS, n.eco_points + RECOVERY_PER_DAY * daysSinceLastReport);

    await supabase.from('neighborhoods').update({ eco_points: recovered }).eq('id', n.id);
  }

  console.log(`✅ تحديث دوري لنقاط الأحياء تم الساعة ${new Date().toLocaleString()}`);
}
