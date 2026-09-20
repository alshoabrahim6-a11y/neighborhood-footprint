// ============================================================================
// list-users.js
// ----------------------------------------------------------------------------
// سكريبت بسيط بيطلعلك كل الحسابات المسجّلة بالموقع (إيميلاتهم بس، بدون أي
// معلومة حساسة) عشان تعرف بالظبط شو الإيميل الصحيح يلي بدك تستخدمه.
//
// الاستخدام (من جوا مجلد backend):
//   node scripts/list-users.js
// ============================================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ما لقيت SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY بملف .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

if (error) {
  console.error('❌ صار خطأ وقت جلب الحسابات:', error.message);
  process.exit(1);
}

if (!data.users || data.users.length === 0) {
  console.log('⚠️  ما في ولا حساب مسجّل بالموقع لسا.');
  process.exit(0);
}

console.log(`\n📋 عدد الحسابات المسجّلة بالموقع: ${data.users.length}\n`);

data.users
  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  .forEach((u, i) => {
    const created = new Date(u.created_at).toLocaleString('en-GB');
    console.log(`${i + 1}) ${u.email}   (سُجّل بتاريخ: ${created})`);
  });

console.log('\n👆 انسخ الإيميل يلي تستخدمه فعليًا لتسجّل دخول بالموقع وابعتلي ياه.\n');
