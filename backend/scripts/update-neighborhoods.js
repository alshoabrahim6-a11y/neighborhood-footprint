// ============================================================================
// update-neighborhoods.js
// ----------------------------------------------------------------------------
// A small one-time script that replaces the placeholder neighborhoods
// (Al-Nuzha, Al-Zuhoor, Al-Amal) with real neighborhoods from Selangor,
// Malaysia.
//
// How to run it: from inside the backend folder, type:
//   node scripts/update-neighborhoods.js
//
// The script uses the same database connection you already have in your
// .env file, so there's no need to add any new key or touch any settings.
// ============================================================================

import { supabase } from '../services/supabaseClient.js';

const OLD_NAMES = ['Al-Nuzha', 'Al-Zuhoor', 'Al-Amal'];

const NEW_NEIGHBORHOODS = [
  'Subang Jaya',
  'Petaling Jaya',
  'Shah Alam',
  'Puchong',
  'Klang',
];

async function main() {
  console.log('🗑️  Deleting the old placeholder neighborhoods...');
  const { error: deleteError } = await supabase
    .from('neighborhoods')
    .delete()
    .in('name', OLD_NAMES);

  if (deleteError) {
    console.error('❌ An error occurred while deleting:', deleteError.message);
    process.exit(1);
  }
  console.log('✅ Old neighborhoods deleted (old reports linked to them stay, just without a specific neighborhood).');

  console.log('\n➕ Adding the real neighborhoods from Selangor...');
  const { data, error: insertError } = await supabase
    .from('neighborhoods')
    .insert(NEW_NEIGHBORHOODS.map((name) => ({ name })))
    .select();

  if (insertError) {
    // If they already exist (e.g. you ran the script twice), that's not a problem
    console.error('⚠️  A warning occurred while adding (they may already be added):', insertError.message);
  } else {
    console.log(`✅ Successfully added ${data.length} neighborhoods:`);
    data.forEach((n) => console.log(`   - ${n.name} (points: ${n.eco_points})`));
  }

  console.log('\n🎉 Done! Refresh the site (F5) and check out the new neighborhood list.');
}

main();
