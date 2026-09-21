// ============================================================================
// reportSummary.js
// ----------------------------------------------------------------------------
// "Periodic reports" logic: computes a statistical summary of (approved
// only) reports over a given period — total reports, their distribution by
// neighborhood and by pollution type, and a comparison with the previous
// period (percentage increase or decrease).
//
// This file doesn't handle any route (endpoint) directly — just the data
// calculation logic, so we can use it in two places: (1) a live endpoint
// when the admin requests an instant report, and (2) the automatic weekly
// node-cron job that saves a "snapshot".
// ============================================================================

import { supabase } from './supabaseClient.js';

// Same pollution type translations found in the frontend (pollutionTypes.js)
// — a separate copy here because the backend and frontend are two separate
// projects that don't share code.
const POLLUTION_LABELS = {
  garbage_burning: 'Garbage Burning',
  air_pollution: 'Air Pollution / Smoke',
  illegal_dumping: 'Illegal Dumping',
  water_pollution: 'Water Pollution',
  no_pollution: 'No Pollution',
  unknown: 'Unknown',
};

function pollutionLabel(code) {
  return POLLUTION_LABELS[code] || POLLUTION_LABELS.unknown;
}

/**
 * Computes a summary of (approved only) reports between two dates.
 * @param {Date} start
 * @param {Date} end
 */
async function summarizeReportsBetween(start, end) {
  const { data, error } = await supabase
    .from('reports')
    .select('id, pollution_type, neighborhood_id, created_at, neighborhoods(name)')
    .eq('status', 'approved')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());

  if (error) {
    throw new Error(`Failed to fetch reports: ${error.message}`);
  }

  const byNeighborhoodMap = new Map();
  const byTypeMap = new Map();

  for (const report of data) {
    // Distribution by neighborhood
    const neighborhoodName = report.neighborhoods?.name || 'Unknown';
    byNeighborhoodMap.set(neighborhoodName, (byNeighborhoodMap.get(neighborhoodName) || 0) + 1);

    // Distribution by pollution type
    const label = pollutionLabel(report.pollution_type);
    byTypeMap.set(label, (byTypeMap.get(label) || 0) + 1);
  }

  const byNeighborhood = [...byNeighborhoodMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const byType = [...byTypeMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return { totalReports: data.length, byNeighborhood, byType };
}

/**
 * The main function: returns a summary of a given period (in days) +
 * a comparison with the same-length period before it (to know whether
 * things improved or got worse).
 * @param {number} days
 */
export async function getPeriodSummary(days = 7) {
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

  const current = await summarizeReportsBetween(periodStart, now);
  const previous = await summarizeReportsBetween(previousStart, periodStart);

  let percentChange = null;
  if (previous.totalReports > 0) {
    percentChange = Math.round(
      ((current.totalReports - previous.totalReports) / previous.totalReports) * 100
    );
  } else if (current.totalReports > 0) {
    percentChange = 100; // from zero to any number = a full increase (100%+), we show it as 100%
  }

  return {
    periodDays: days,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    totalReports: current.totalReports,
    byNeighborhood: current.byNeighborhood,
    byType: current.byType,
    previousTotalReports: previous.totalReports,
    percentChange,
  };
}

/**
 * "All time" public statistics (all approved reports since the project
 * started) — used on the public "Statistics" page (available to everyone,
 * no login required), and includes:
 *   - total number of approved reports
 *   - their distribution by neighborhood (for the bar chart)
 *   - their distribution by pollution type (for the pie chart)
 *   - the number of reports per week for the last N weeks (for the line chart)
 *
 * ⚠️ There's no personal information here (no user_email or any sensitive
 * data) — just aggregated numbers, so it's completely safe to show to
 * everyone without logging in, exactly like the public heatmap data.
 * @param {number} weeksCount
 */
export async function getOverallStats(weeksCount = 8) {
  const { data, error } = await supabase
    .from('reports')
    .select('id, pollution_type, neighborhood_id, created_at, neighborhoods(name)')
    .eq('status', 'approved');

  if (error) {
    throw new Error(`Failed to fetch report statistics: ${error.message}`);
  }

  const byNeighborhoodMap = new Map();
  const byTypeMap = new Map();

  for (const report of data) {
    const neighborhoodName = report.neighborhoods?.name || 'Unknown';
    byNeighborhoodMap.set(neighborhoodName, (byNeighborhoodMap.get(neighborhoodName) || 0) + 1);

    const label = pollutionLabel(report.pollution_type);
    byTypeMap.set(label, (byTypeMap.get(label) || 0) + 1);
  }

  const byNeighborhood = [...byNeighborhoodMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const byType = [...byTypeMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // We split the last (weeksCount * 7) days into weekly "buckets", and put
  // every report in the right bucket based on its date — this gives us one
  // data point per week for the line chart, instead of running a separate
  // query for each week.
  const now = new Date();
  const buckets = [];
  for (let i = weeksCount - 1; i >= 0; i--) {
    const bucketEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const bucketStart = new Date(bucketEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    buckets.push({ start: bucketStart, end: bucketEnd, count: 0 });
  }

  for (const report of data) {
    const createdAt = new Date(report.created_at);
    const bucket = buckets.find((b) => createdAt >= b.start && createdAt < b.end);
    if (bucket) bucket.count += 1;
  }

  const weeklyTrend = buckets.map((b) => ({
    weekStart: b.start.toISOString(),
    weekEnd: b.end.toISOString(),
    count: b.count,
  }));

  return {
    totalReports: data.length,
    byNeighborhood,
    byType,
    weeklyTrend,
  };
}

/**
 * Leaderboard — the most active reporters (based only on approved report
 * count). Public and available to everyone without logging in, just like
 * the rest of the aggregated data on the statistics dashboard — and these
 * emails are already publicly visible on the map (in each report's popup),
 * so there's no new information being exposed here.
 * @param {number} limit
 */
export async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('reports')
    .select('user_email')
    .eq('status', 'approved')
    .not('user_email', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch the leaderboard: ${error.message}`);
  }

  const countMap = new Map();
  for (const report of data) {
    countMap.set(report.user_email, (countMap.get(report.user_email) || 0) + 1);
  }

  return [...countMap.entries()]
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * The "automatic weekly report" job: computes a summary of the last 7 days
 * and saves it in the report_snapshots table — this is what runs on its own
 * every week via node-cron (see server.js), and the admin can also run it
 * manually from the admin panel if they want to see a live report without
 * waiting for the weekly schedule.
 */
export async function saveWeeklySnapshot() {
  const summary = await getPeriodSummary(7);

  const { data, error } = await supabase
    .from('report_snapshots')
    .insert({
      period_start: summary.periodStart,
      period_end: summary.periodEnd,
      total_reports: summary.totalReports,
      summary,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save the weekly report: ${error.message}`);
  }

  console.log(`📊 Automatic weekly report generated and saved (${summary.totalReports} reports) on ${new Date().toLocaleString()}`);

  return data;
}
