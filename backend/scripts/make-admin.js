// ============================================================================
// make-admin.js
// ----------------------------------------------------------------------------
// سكريبت صغير يحوّل أي حساب مسجّل عندك (بإيميله) إلى "أدمن" — يعني يصير
// يقدر يفتح لوحة الإدارة ويوافق/يرفض البلاغات.
//
// طريقة التشغيل: من داخل مجلد backend، اكتب (استبدل الإيميل بإيميل حسابك):
//   node scripts/make-admin.js your-email@example.com
// ============================================================================

import { supabase } from '../services/supabaseClient.js';

const email = process.argv[2];

if (!email) {
  console.error('❌ لازم تبعت الإيميل كمعامل، مثلًا:');
  console.error('   node scripts/make-admin.js your-email@example.com');
  process.exit(1);
}

async function main() {
  console.log(`🔍 عم ندور عن حساب بالإيميل: ${email} ...`);

  // بنجيب لائحة كل المستخدمين المسجّلين (عبر Admin API يلي بيحتاج service_role)
  // وندور فيها عن الإيميل المطلوب.
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    console.error('❌ صار خطأ وقت جلب المستخدمين:', error.message);
    process.exit(1);
  }

  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    console.error(`❌ ما لقينا حساب مسجّل بهاد الإيميل: ${email}`);
    console.error('   تأكد إنك سجّلت حساب بهاد الإيميل من الموقع أولًا (تسجيل دخول / حساب جديد).');
    process.exit(1);
  }

  const { error: insertError } = await supabase.from('admins').insert({ user_id: user.id });

  if (insertError) {
    if (insertError.code === '23505') {
      console.log(`ℹ️ هاد الحساب (${email}) أصلاً أدمن من قبل — ما في داعي تعيد الخطوة.`);
      return;
    }
    console.error('❌ صار خطأ وقت الإضافة:', insertError.message);
    process.exit(1);
  }

  console.log(`✅ تم! صار حساب "${email}" أدمن بنجاح. سجّل خروج ودخول من جديد بالموقع عشان تشوف تبويب "الإدارة".`);
}

main();
