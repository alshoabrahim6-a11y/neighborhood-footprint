// ============================================================================
// supabaseClient.js (frontend)
// ----------------------------------------------------------------------------
// اتصال بـ Supabase من المتصفح، بس عشان "تسجيل الدخول" (Auth) — مش لقراءة
// أو كتابة بيانات التلوث مباشرة (هاي بتضل تمر عبر السيرفر الخلفي دايمًا،
// متل ما هو موضح بملف README تحت "أشياء مهمة تعرفها").
//
// بنستخدم هون مفتاح "anon" (العام) فقط — آمن تمامًا يظهر بكود المتصفح.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ ناقص VITE_SUPABASE_URL أو VITE_SUPABASE_ANON_KEY بملف frontend/.env — تسجيل الدخول ما رح يشتغل. راجع README.md.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
