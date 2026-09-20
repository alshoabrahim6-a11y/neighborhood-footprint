// ============================================================================
// fix-admin.js
// ----------------------------------------------------------------------------
// سكريبت "شامل": بياخد إيميل + باسوورد جديد، وبيعمل شيئين بضربة وحدة:
//   1) يغيّر باسوورد الحساب لقيمة جديدة إنت تحددها (مفيد لو ناسي الباسوورد
//      القديم أو مش عم تشتغل معك لأي سبب).
//   2) يضيف نفس الحساب للائحة الأدمنية (admins) عشان يقدر يفتح لوحة الإدارة.
//
// الاستخدام (من جوا مجلد backend):
//   node scripts/fix-admin.js your-email@example.com NewPassword123
//
// ملاحظة: اختار باسوورد فيه 6 أحرف عالأقل، وتذكره كويس عشان تسجّل فيه دخول
// بعدين بالموقع.
// ============================================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const [, , emailArg, newPassword] = process.argv;

if (!emailArg || !newPassword) {
  console.error('❌ الاستخدام الصحيح: node scripts/fix-admin.js <email> <new-password>');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ما لقيت SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY بملف .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// 1) نلاقي الحساب بالإيميل المحدد
const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error('❌ صار خطأ وقت البحث عن الحساب:', listError.message);
  process.exit(1);
}

const user = listData.users.find((u) => u.email?.toLowerCase() === emailArg.toLowerCase());

if (!user) {
  console.error(`❌ ما لقيت حساب بهاد الإيميل بالضبط: ${emailArg}`);
  console.error('   شغّل node scripts/list-users.js عشان تشوف الإيميلات المسجّلة فعليًا.');
  process.exit(1);
}

// 2) نغيّر الباسوورد
const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
  password: newPassword,
});

if (updateError) {
  console.error('❌ صار خطأ وقت تغيير الباسوورد:', updateError.message);
  process.exit(1);
}

console.log(`✅ تم تغيير الباسوورد بنجاح لحساب: ${user.email}`);
console.log(`   الباسوورد الجديد: ${newPassword}`);

// 3) نضيفه للائحة الأدمنية (لو مش مضاف أصلًا)
const { error: insertError } = await supabase.from('admins').insert({ user_id: user.id });

if (insertError) {
  if (insertError.code === '23505') {
    console.log('ℹ️  الحساب كان مضاف أصلًا كأدمن من قبل — كل شي تمام.');
  } else {
    console.error('❌ صار خطأ وقت إضافته كأدمن:', insertError.message);
    process.exit(1);
  }
} else {
  console.log('✅ تمت إضافة الحساب كأدمن بنجاح.');
}

console.log('\n🎉 خلص! هلق روح لموقع بصمة الحي، سجّل دخول بهاد الإيميل والباسوورد الجديد،');
console.log('   ولازم يطلعلك تبويب "🛡️ الإدارة" فوق.');
