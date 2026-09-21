// ============================================================================
// fix-admin.js
// ----------------------------------------------------------------------------
// An "all-in-one" script: takes an email + a new password, and does two
// things at once:
//   1) Changes the account's password to a new value you choose (useful if
//      you forgot the old password or it's not working for some reason).
//   2) Adds that same account to the admin list (admins) so they can open the admin panel.
//
// Usage (from inside the backend folder):
//   node scripts/fix-admin.js your-email@example.com NewPassword123
//
// Note: choose a password with at least 6 characters, and remember it well
// so you can log in with it afterward on the site.
// ============================================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const [, , emailArg, newPassword] = process.argv;

if (!emailArg || !newPassword) {
  console.error('❌ Correct usage: node scripts/fix-admin.js <email> <new-password>');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Could not find SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// 1) Find the account with the given email
const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error('❌ An error occurred while searching for the account:', listError.message);
  process.exit(1);
}

const user = listData.users.find((u) => u.email?.toLowerCase() === emailArg.toLowerCase());

if (!user) {
  console.error(`❌ Could not find an account with exactly this email: ${emailArg}`);
  console.error('   Run node scripts/list-users.js to see the emails actually registered.');
  process.exit(1);
}

// 2) Change the password
const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
  password: newPassword,
});

if (updateError) {
  console.error('❌ An error occurred while changing the password:', updateError.message);
  process.exit(1);
}

console.log(`✅ Password changed successfully for account: ${user.email}`);
console.log(`   New password: ${newPassword}`);

// 3) Add them to the admin list (if not already added)
const { error: insertError } = await supabase.from('admins').insert({ user_id: user.id });

if (insertError) {
  if (insertError.code === '23505') {
    console.log('ℹ️  The account was already an admin — all good.');
  } else {
    console.error('❌ An error occurred while adding them as an admin:', insertError.message);
    process.exit(1);
  }
} else {
  console.log('✅ Account successfully added as an admin.');
}

console.log('\n🎉 Done! Now go to the Neighborhood Footprint site, log in with this email and the new password,');
console.log('   and the "🛡️ Admin" tab should show up at the top.');
