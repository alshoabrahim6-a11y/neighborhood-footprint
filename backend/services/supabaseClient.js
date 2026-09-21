// ============================================================================
// supabaseClient.js
// ----------------------------------------------------------------------------
// This file creates a single "connection" to the Supabase database and
// exports it, so the rest of the server's files can use it instead of each
// file making its own connection.
//
// Important note: we're using the "service role key" here (the server's
// secret key), not the "anon key" (the public key). The difference:
//   - anon key    → safe to put in the browser (frontend), limited permissions
//   - service key → dangerous, must never leave the server, has full access
// That's why this key only lives in the server's .env file, and we never send it to the browser.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    '❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the .env file — see the steps in README.md'
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'pollution-photos';
