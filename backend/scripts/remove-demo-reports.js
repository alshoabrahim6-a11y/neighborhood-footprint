// ============================================================================
// remove-demo-reports.js
// ----------------------------------------------------------------------------
// Deletes only the demo reports that were added via seed-demo-reports.js —
// they're identified by an internal { seed: true } marker in the
// ai_raw_labels field (not shown anywhere in the UI), so there's no risk of
// accidentally deleting a real report submitted by an actual user.
//
// Usage (from inside the backend folder):
//   node scripts/remove-demo-reports.js
// ============================================================================

import { supabase } from '../services/supabaseClient.js';

async function main() {
  const { data: demoReports, error: findError } = await supabase
    .from('reports')
    .select('id')
    .eq('ai_raw_labels->>seed', 'true');

  if (findError) {
    console.error('❌ An error occurred while searching for demo reports:', findError.message);
    process.exit(1);
  }

  if (!demoReports || demoReports.length === 0) {
    console.log('ℹ️  There are no demo reports to delete — everything is already clean.');
    return;
  }

  const ids = demoReports.map((r) => r.id);

  const { error: deleteError } = await supabase.from('reports').delete().in('id', ids);

  if (deleteError) {
    console.error('❌ An error occurred while deleting:', deleteError.message);
    process.exit(1);
  }

  console.log(`✅ Successfully deleted ${ids.length} demo reports.`);
  console.log('ℹ️  Note: neighborhood points that dropped when the demo reports were added do not come back automatically —');
  console.log('   they recover gradually via the regular "daily recovery" job, or you can adjust them manually from Supabase.');
}

main();
