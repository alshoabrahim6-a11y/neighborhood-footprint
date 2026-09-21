// ============================================================================
// delete-placeholder-neighborhoods.js
// ----------------------------------------------------------------------------
// One-time cleanup script: removes the original placeholder neighborhoods
// (Al-Nuzha / Al-Zuhoor / Al-Amal, in Arabic or English spelling) that are
// no longer needed now that real Selangor neighborhoods (Subang Jaya,
// Petaling Jaya, Shah Alam, Puchong, Klang) have been added.
//
// Any report that was linked to one of these neighborhoods will simply have
// its neighborhood_id set to null (per the database's "on delete set null"
// rule) — no reports are deleted.
//
// Usage (from inside the backend folder):
//   node scripts/delete-placeholder-neighborhoods.js
// ============================================================================

import { supabase } from '../services/supabaseClient.js';

// Both the original Arabic names and their English equivalents, in case
// some were already renamed and some weren't.
const NAMES_TO_DELETE = [
  'حي النزهة',
  'حي الأمل',
  'حي الزهور',
  'Al-Nuzha',
  'Al-Amal',
  'Al-Zuhoor',
];

async function main() {
  console.log('🔎 Checking current neighborhood names...');
  const { data: neighborhoods, error } = await supabase.from('neighborhoods').select('id, name');

  if (error) {
    console.error('❌ Error fetching neighborhoods:', error.message);
    process.exit(1);
  }

  const toDelete = (neighborhoods || []).filter((n) => NAMES_TO_DELETE.includes(n.name));

  if (toDelete.length === 0) {
    console.log('⚠️  None of the placeholder neighborhoods were found — nothing to delete.');
    return;
  }

  let deletedCount = 0;

  for (const n of toDelete) {
    const { error: deleteError } = await supabase.from('neighborhoods').delete().eq('id', n.id);

    if (deleteError) {
      console.error(`❌ Failed to delete "${n.name}":`, deleteError.message);
      continue;
    }

    console.log(`✅ Deleted "${n.name}"`);
    deletedCount++;
  }

  console.log(`\n🎉 Done! Deleted ${deletedCount} placeholder neighborhood(s).`);
  console.log('   Refresh the site — the dropdown should now show only the real neighborhoods.');
}

main();
