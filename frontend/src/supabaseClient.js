// ============================================================================
// supabaseClient.js (frontend)
// ----------------------------------------------------------------------------
// Connection to Supabase from the browser, just for "login" (Auth) — not for
// reading or writing pollution data directly (that always goes through the
// backend server, as explained in the README under "Important things to
// know").
//
// We only use the "anon" (public) key here — completely safe to expose in
// browser code.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in frontend/.env — login will not work. See README.md.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
