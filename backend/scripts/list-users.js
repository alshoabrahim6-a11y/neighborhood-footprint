// ============================================================================
// list-users.js
// ----------------------------------------------------------------------------
// A simple script that lists all accounts registered on the site (just
// their emails, no sensitive information) so you know exactly which email
// you should be using.
//
// Usage (from inside the backend folder):
//   node scripts/list-users.js
// ============================================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Could not find SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

if (error) {
  console.error('❌ An error occurred while fetching accounts:', error.message);
  process.exit(1);
}

if (!data.users || data.users.length === 0) {
  console.log('⚠️  No accounts are registered on the site yet.');
  process.exit(0);
}

console.log(`\n📋 Number of accounts registered on the site: ${data.users.length}\n`);

data.users
  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  .forEach((u, i) => {
    const created = new Date(u.created_at).toLocaleString('en-GB');
    console.log(`${i + 1}) ${u.email}   (registered on: ${created})`);
  });

console.log('\n👆 Copy the email you actually use to log in on the site and send it to me.\n');
