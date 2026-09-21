// ============================================================================
// make-admin.js
// ----------------------------------------------------------------------------
// A small script that turns any account you already registered (by email)
// into an "admin" — meaning they can open the admin panel and approve/reject
// reports.
//
// How to run it: from inside the backend folder, type (replace the email with your account's email):
//   node scripts/make-admin.js your-email@example.com
// ============================================================================

import { supabase } from '../services/supabaseClient.js';

const email = process.argv[2];

if (!email) {
  console.error('❌ You must pass the email as an argument, for example:');
  console.error('   node scripts/make-admin.js your-email@example.com');
  process.exit(1);
}

async function main() {
  console.log(`🔍 Looking for an account with the email: ${email} ...`);

  // Fetch the list of all registered users (via the Admin API, which needs
  // service_role) and search it for the requested email.
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    console.error('❌ An error occurred while fetching users:', error.message);
    process.exit(1);
  }

  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    console.error(`❌ No registered account found with this email: ${email}`);
    console.error('   Make sure you registered an account with this email on the site first (login / new account).');
    process.exit(1);
  }

  const { error: insertError } = await supabase.from('admins').insert({ user_id: user.id });

  if (insertError) {
    if (insertError.code === '23505') {
      console.log(`ℹ️ This account (${email}) is already an admin — no need to repeat this step.`);
      return;
    }
    console.error('❌ An error occurred while adding it:', insertError.message);
    process.exit(1);
  }

  console.log(`✅ Done! The account "${email}" is now an admin. Log out and back in on the site to see the "Admin" tab.`);
}

main();
