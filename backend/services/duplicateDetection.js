// ============================================================================
// duplicateDetection.js
// ----------------------------------------------------------------------------
// Duplicate report detection: before saving a new report to the database, we
// check whether there's a previous report (still pending or approved) with
// the same pollution type, geographically close (less than
// DUPLICATE_RADIUS_METERS meters), and recent (within the last
// DUPLICATE_WINDOW_DAYS days).
//
// If we find one, we don't reject the new report or stop its sender from
// submitting it — we save it normally but flag it (is_duplicate = true) so
// the admin can see it in the admin panel and make the right call (it could
// really be the same source, a mistake, or also useful extra confirmation
// that the problem is still there).
// ============================================================================

import { supabase } from './supabaseClient.js';

// Search radius for "nearby" reports in meters — about 100 meters is roughly the same street/spot
const DUPLICATE_RADIUS_METERS = 100;

// We only compare against recent reports (last two weeks) — pollution
// reported two months ago may have been resolved and come back, so it
// wouldn't make sense to consider it "the same report"
const DUPLICATE_WINDOW_DAYS = 14;

const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine formula: computes the real distance in meters between two
 * points on the Earth's surface, based on each one's latitude and
 * longitude — much more accurate than just subtracting the coordinates,
 * since a degree of longitude shrinks the farther you get from the equator.
 */
export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Looks for the closest similar previous report (if any) and returns it, or returns null.
 * @param {{ latitude: number, longitude: number, pollutionType: string }} params
 * @returns {Promise<{ id: string } | null>}
 */
export async function findDuplicateReport({ latitude, longitude, pollutionType }) {
  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('reports')
    .select('id, latitude, longitude')
    .eq('pollution_type', pollutionType)
    .in('status', ['pending', 'approved'])
    .gte('created_at', windowStart.toISOString());

  if (error) {
    // ⚠️ If something goes wrong here, we don't stop the whole report
    // submission because of it — we just skip duplicate detection for this
    // report and carry on normally (duplicate detection is an "extra",
    // not a requirement for the site to work)
    console.warn('⚠️ Failed to check for duplicate reports (continuing normally without duplicate detection):', error.message);
    return null;
  }

  let closest = null;
  let closestDistance = Infinity;

  for (const report of data) {
    const distance = haversineDistanceMeters(latitude, longitude, report.latitude, report.longitude);
    if (distance <= DUPLICATE_RADIUS_METERS && distance < closestDistance) {
      closest = report;
      closestDistance = distance;
    }
  }

  return closest;
}
