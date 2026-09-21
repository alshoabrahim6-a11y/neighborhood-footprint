// ============================================================================
// rename-neighborhoods-to-english.js
// ----------------------------------------------------------------------------
// One-time script: renames the neighborhood names currently stored in the
// database (written in Arabic script from an earlier setup step) to their
// English spelling, so they match the now-fully-English user interface.
//
// This does NOT touch any reports, points, or other data — it only updates
// the `name` column on the `neighborhoods` table for the rows listed below.
// It is safe to run more than once: any name not found is simply skipped.
//
// Usage (from inside the backend folder):
//   node scripts/rename-neighborhoods-to-english.js
// ============================================================================

import { supabase } from '../services/supabaseClient.js';

// Map of { old name currently in the database → new English name }
const RENAME_MAP = {
  'سوبانج جايا': 'Subang Jaya',
  'بيتالينغ جايا': 'Petaling Jaya',
  'شاه علم': 'Shah Alam',
  'بوتشونغ': 'Puchong',
  'كلانج': 'Klang',
};

async function main() {
  console.log('🔎 Checking current neighborhood names...');
  const { data: neighborhoods, error } = await supabase.from('neighborhoods').select('id, name');

  if (error) {
    console.error('❌ Error fetching neighborhoods:', error.message);
    process.exit(1);
  }

  if (!neighborhoods || neighborhoods.length === 0) {
    console.log('⚠️  No neighborhoods found in the database.');
    return;
  }

  let renamedCount = 0;

  for (const n of neighborhoods) {
    const newName = RENAME_MAP[n.name];
    if (!newName) {
      console.log(`⏭️  Skipping "${n.name}" (not in the rename list, already English, or already renamed).`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('neighborhoods')
      .update({ name: newName })
      .eq('id', n.id);

    if (updateError) {
      console.error(`❌ Failed to rename "${n.name}" → "${newName}":`, updateError.message);
      continue;
    }

    console.log(`✅ Renamed "${n.name}" → "${newName}"`);
    renamedCount++;
  }

  console.log(`\n🎉 Done! Renamed ${renamedCount} neighborhood(s).`);
  console.log('   Refresh the site — the map, points board, and statistics should now show the English names.');
}

main();
