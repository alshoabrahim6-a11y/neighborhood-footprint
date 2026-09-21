// ============================================================================
// ecoPoints.js
// ----------------------------------------------------------------------------
// "Eco points" logic for each neighborhood:
//   - every new pollution report drops the neighborhood's points (a penalty)
//   - every day with no new reports, the neighborhood's points go back up a little (recovery)
//   Points are always kept between 0 and 100.
// ============================================================================

import { supabase } from './supabaseClient.js';

const PENALTY_PER_REPORT = 5; // how many points drop with each new report
const RECOVERY_PER_DAY = 2; // how many points come back each day with no new reports
const MAX_POINTS = 100;
const MIN_POINTS = 0;

/**
 * Drops a given neighborhood's points after a new pollution report for it arrives.
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
    console.error("❌ Couldn't fetch the neighborhood's points:", fetchError.message);
    return;
  }

  const newPoints = Math.max(MIN_POINTS, neighborhood.eco_points - PENALTY_PER_REPORT);

  const { error: updateError } = await supabase
    .from('neighborhoods')
    .update({ eco_points: newPoints, last_report_at: new Date().toISOString() })
    .eq('id', neighborhoodId);

  if (updateError) {
    console.error("❌ Couldn't update the neighborhood's points:", updateError.message);
  }
}

/**
 * A periodic job (runs once a day from server.js via node-cron): gradually
 * increases the points of every neighborhood with no new reports, based on
 * how many days have passed since its last report.
 */
export async function recoverPointsForAllNeighborhoods() {
  const { data: neighborhoods, error } = await supabase
    .from('neighborhoods')
    .select('id, eco_points, last_report_at');

  if (error) {
    console.error("❌ Couldn't fetch the neighborhood list for recovery:", error.message);
    return;
  }

  const now = Date.now();

  for (const n of neighborhoods) {
    if (n.eco_points >= MAX_POINTS) continue;

    const daysSinceLastReport = n.last_report_at
      ? Math.floor((now - new Date(n.last_report_at).getTime()) / (1000 * 60 * 60 * 24))
      : 1; // if there are no reports at all, treat it as one empty day

    if (daysSinceLastReport < 1) continue;

    const recovered = Math.min(MAX_POINTS, n.eco_points + RECOVERY_PER_DAY * daysSinceLastReport);

    await supabase.from('neighborhoods').update({ eco_points: recovered }).eq('id', n.id);
  }

  console.log(`✅ Periodic neighborhood points update completed at ${new Date().toLocaleString()}`);
}
