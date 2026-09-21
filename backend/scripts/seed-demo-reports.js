// ============================================================================
// seed-demo-reports.js
// ----------------------------------------------------------------------------
// A script to add "fully-populated" demo reports (specific neighborhood +
// clear pollution type + location + date) directly into the database — useful
// before presenting the project to the committee so the "📈 Statistics" tab
// shows clear, nice-looking charts instead of being full of incomplete
// (unknown) data from normal testing.
//
// Usage (from inside the backend folder):
//   node scripts/seed-demo-reports.js "exact neighborhood name" [report count]
//
// Example:
//   node scripts/seed-demo-reports.js "Al-Nuzha" 8
//
// If you don't specify a count, the default is 8 reports spread across the
// last 8 weeks (roughly one report per week), so the line chart on the
// statistics dashboard shows a nice gradual progression instead of a sudden
// jump in the last week only.
//
// Important note: every report added here is internally tagged (in the
// ai_raw_labels field, which isn't shown anywhere in the UI) with
// { seed: true } so that after the demo you can easily find and delete them
// without touching your real reports. To delete:
//   node scripts/remove-demo-reports.js
//
// Note about emails: every demo report is now linked to a fake user_email
// (from the DEMO_EMAILS list below) — with no real user_id (meaning these
// aren't actual Supabase Auth accounts, just plain text in the user_email
// column). This is only so the "leaderboard" in the statistics tab shows
// more than one name in a realistic way during the committee presentation,
// instead of being empty or containing only your own personal email.
// ============================================================================

import { supabase } from '../services/supabaseClient.js';
import { applyReportPenalty } from '../services/ecoPoints.js';

const [, , neighborhoodNameArg, countArg] = process.argv;

if (!neighborhoodNameArg) {
  console.error('❌ Correct usage: node scripts/seed-demo-reports.js "exact neighborhood name" [report count]');
  process.exit(1);
}

const count = Number(countArg) > 0 ? Number(countArg) : 8;

// Same pollution types used across the rest of the project (reportSummary.js
// / pollutionTypes.js) — without 'no_pollution' and 'unknown' so the charts
// show clear, useful types
const POLLUTION_TYPES = ['garbage_burning', 'air_pollution', 'illegal_dumping', 'water_pollution'];

// Ready-made images (Picsum — a free public image service) used only if we
// can't find any real image in your database to reuse
const FALLBACK_IMAGES = [
  'https://picsum.photos/seed/pollution1/640/480',
  'https://picsum.photos/seed/pollution2/640/480',
  'https://picsum.photos/seed/pollution3/640/480',
  'https://picsum.photos/seed/pollution4/640/480',
];

// Default fallback location (used if we can't find any coordinates in the
// database to build on) — change these values if you'd like to set your
// area's exact coordinates
const DEFAULT_BASE_LAT = 3.139;
const DEFAULT_BASE_LNG = 101.6869;

// Fake emails (not real accounts) distributed across the demo reports, so
// the "leaderboard" shows more than one name in a realistic ranking (the
// first one gets the most reports, and so on down to the last one). Change
// the names if you'd like different ones.
const DEMO_EMAILS = [
  'sara.student@example.com',
  'omar.volunteer@example.com',
  'lina.eco@example.com',
  'yousef.reports@example.com',
  'huda.green@example.com',
];

// Weights for distributing the emails above (must be the same length as
// DEMO_EMAILS and sum to 1) — the first email gets the largest share of
// reports, and so on in order, so the leaderboard looks graduated and
// realistic, like a real situation with a clear "leader".
const DEMO_EMAIL_WEIGHTS = [0.4, 0.25, 0.17, 0.11, 0.07];

function pickDemoEmail() {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < DEMO_EMAILS.length; i++) {
    cumulative += DEMO_EMAIL_WEIGHTS[i];
    if (r <= cumulative) return DEMO_EMAILS[i];
  }
  return DEMO_EMAILS[DEMO_EMAILS.length - 1];
}

function jitter(value, maxOffset = 0.006) {
  return value + (Math.random() - 0.5) * 2 * maxOffset;
}

function randomConfidence() {
  return Math.round((0.72 + Math.random() * 0.24) * 100) / 100; // between 0.72 and 0.96
}

async function main() {
  // 1) Find the neighborhood by its exact name
  const { data: neighborhood, error: nError } = await supabase
    .from('neighborhoods')
    .select('id, name')
    .eq('name', neighborhoodNameArg)
    .maybeSingle();

  if (nError) {
    console.error('❌ An error occurred while looking up the neighborhood:', nError.message);
    process.exit(1);
  }

  if (!neighborhood) {
    const { data: allNeighborhoods } = await supabase.from('neighborhoods').select('name');
    console.error(`❌ No neighborhood found with this exact name: "${neighborhoodNameArg}"`);
    console.error('   The neighborhoods you actually have:');
    (allNeighborhoods || []).forEach((n) => console.error(`   - ${n.name}`));
    process.exit(1);
  }

  console.log(`✅ Found the neighborhood: ${neighborhood.name} (${neighborhood.id})`);

  // 2) Get a location (lat/lng) to build on — priority to a real report in
  // the same neighborhood, then any report in the database, otherwise the
  // default location above
  let baseLat = DEFAULT_BASE_LAT;
  let baseLng = DEFAULT_BASE_LNG;

  const { data: sameNeighborhoodReport } = await supabase
    .from('reports')
    .select('latitude, longitude')
    .eq('neighborhood_id', neighborhood.id)
    .limit(1)
    .maybeSingle();

  if (sameNeighborhoodReport) {
    baseLat = sameNeighborhoodReport.latitude;
    baseLng = sameNeighborhoodReport.longitude;
    console.log('📍 Used the location of a real report in the same neighborhood as the base point.');
  } else {
    const { data: anyReport } = await supabase
      .from('reports')
      .select('latitude, longitude')
      .limit(1)
      .maybeSingle();

    if (anyReport) {
      baseLat = anyReport.latitude;
      baseLng = anyReport.longitude;
      console.log('📍 No reports in the same neighborhood, used the location of another real report as the base point.');
    } else {
      console.log('📍 There are no reports in the database at all, used a default location (edit it in the script if you like).');
    }
  }

  // 3) Get real images you already have so we can reuse them (instead of
  // generic images)
  const { data: existingImages } = await supabase
    .from('reports')
    .select('image_url')
    .not('image_url', 'is', null)
    .limit(20);

  const imagePool =
    existingImages && existingImages.length > 0 ? existingImages.map((r) => r.image_url) : FALLBACK_IMAGES;

  if (existingImages && existingImages.length > 0) {
    console.log(`🖼️  Reusing ${imagePool.length} real image(s) you already have.`);
  } else {
    console.log('🖼️  No real images in the database, using generic (Picsum) images just for the demo.');
  }

  // 4) Build the reports and spread their dates across the last (count)
  // weeks, roughly one report per week, so the line chart on the statistics
  // dashboard shows a nice gradual progression instead of a jump
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const rows = Array.from({ length: count }).map((_, i) => {
    const weeksAgo = count - 1 - i; // oldest report first (large weeksAgo), most recent last
    const createdAt = new Date(now - weeksAgo * weekMs - Math.random() * weekMs * 0.5);

    return {
      neighborhood_id: neighborhood.id,
      image_url: imagePool[i % imagePool.length],
      latitude: jitter(baseLat),
      longitude: jitter(baseLng),
      pollution_type: POLLUTION_TYPES[i % POLLUTION_TYPES.length],
      ai_confidence: randomConfidence(),
      ai_raw_labels: { seed: true, note: 'demo-seed-script', createdBy: 'seed-demo-reports.js' },
      user_email: pickDemoEmail(),
      status: 'approved',
      created_at: createdAt.toISOString(),
    };
  });

  const { data: inserted, error: insertError } = await supabase.from('reports').insert(rows).select('id');

  if (insertError) {
    console.error('❌ An error occurred while adding the demo reports:', insertError.message);
    process.exit(1);
  }

  console.log(`✅ Successfully added ${inserted.length} demo report(s) to the "${neighborhood.name}" neighborhood.`);

  // Distribution of the fake emails that were added, so you know in advance
  // what you'll see on the leaderboard before checking it yourself
  const emailCounts = new Map();
  for (const row of rows) {
    emailCounts.set(row.user_email, (emailCounts.get(row.user_email) || 0) + 1);
  }
  console.log('👤 Report distribution across the fake emails (leaderboard):');
  [...emailCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([email, c]) => console.log(`   - ${email}: ${c} report(s)`));

  // 5) Lower the neighborhood's points using the same logic as a normal
  // approval (each report = -5 points), so the "neighborhood points" board
  // stays consistent with the new reports
  for (let i = 0; i < inserted.length; i++) {
    await applyReportPenalty(neighborhood.id);
  }
  console.log(`📉 Updated the environmental points for "${neighborhood.name}" (${inserted.length} × -5 points).`);

  console.log('\n🎉 Done! Go to the "📈 Statistics" and "🏆 Neighborhood Points" tabs and check the result.');
  console.log('   If you want to delete these demo reports after the presentation, run:');
  console.log('   node scripts/remove-demo-reports.js');
}

main();
