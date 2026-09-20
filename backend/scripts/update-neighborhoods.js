// ============================================================================
// update-neighborhoods.js
// ----------------------------------------------------------------------------
// سكريبت صغير تشغّله مرة وحدة بس، بيبدّل الأحياء الوهمية (حي النزهة، حي
// الزهور، حي الأمل) بأحياء حقيقية من سيلانجور، ماليزيا.
//
// طريقة التشغيل: من داخل مجلد backend، اكتب:
//   node scripts/update-neighborhoods.js
//
// السكريبت بيستخدم نفس الاتصال بقاعدة البيانات يلي عندك أصلاً بملف .env،
// فما في داعي تحط أي مفتاح جديد أو تلمس أي إعدادات.
// ============================================================================

import { supabase } from '../services/supabaseClient.js';

const OLD_NAMES = ['حي النزهة', 'حي الزهور', 'حي الأمل'];

const NEW_NEIGHBORHOODS = [
  'سوبانج جايا',
  'بيتالينغ جايا',
  'شاه علم',
  'بوتشونغ',
  'كلانج',
];

async function main() {
  console.log('🗑️  عم نحذف الأحياء الوهمية القديمة...');
  const { error: deleteError } = await supabase
    .from('neighborhoods')
    .delete()
    .in('name', OLD_NAMES);

  if (deleteError) {
    console.error('❌ صار خطأ وقت الحذف:', deleteError.message);
    process.exit(1);
  }
  console.log('✅ تم حذف الأحياء القديمة (البلاغات القديمة المرتبطة فيها بتضل موجودة، بس بدون حي محدد).');

  console.log('\n➕ عم نضيف الأحياء الحقيقية من سيلانجور...');
  const { data, error: insertError } = await supabase
    .from('neighborhoods')
    .insert(NEW_NEIGHBORHOODS.map((name) => ({ name })))
    .select();

  if (insertError) {
    // لو كانت موجودة أصلاً (مثلاً شغّلت السكريبت مرتين)، ما هيك مشكلة
    console.error('⚠️  صار تنبيه وقت الإضافة (ممكن تكون الأحياء مضافة أصلاً):', insertError.message);
  } else {
    console.log(`✅ تم إضافة ${data.length} حي بنجاح:`);
    data.forEach((n) => console.log(`   - ${n.name} (نقاط: ${n.eco_points})`));
  }

  console.log('\n🎉 خلصنا! روح حدّث صفحة الموقع (F5) وشوف قائمة الأحياء الجديدة.');
}

main();
