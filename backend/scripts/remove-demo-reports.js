// ============================================================================
// remove-demo-reports.js
// ----------------------------------------------------------------------------
// بيحذف كل البلاغات التجريبية يلي انضافت عبر seed-demo-reports.js فقط —
// بيتعرّف عليها من علامة داخلية { seed: true } بحقل ai_raw_labels (مش ظاهرة
// بأي مكان بالواجهة)، فمستحيل يحذف غلط ولا بلاغ حقيقي رفعه مستخدم فعلي.
//
// الاستخدام (من جوا مجلد backend):
//   node scripts/remove-demo-reports.js
// ============================================================================

import { supabase } from '../services/supabaseClient.js';

async function main() {
  const { data: demoReports, error: findError } = await supabase
    .from('reports')
    .select('id')
    .eq('ai_raw_labels->>seed', 'true');

  if (findError) {
    console.error('❌ صار خطأ وقت البحث عن البلاغات التجريبية:', findError.message);
    process.exit(1);
  }

  if (!demoReports || demoReports.length === 0) {
    console.log('ℹ️  ما في ولا بلاغ تجريبي لحذفه — كل شي نظيف أصلًا.');
    return;
  }

  const ids = demoReports.map((r) => r.id);

  const { error: deleteError } = await supabase.from('reports').delete().in('id', ids);

  if (deleteError) {
    console.error('❌ صار خطأ وقت الحذف:', deleteError.message);
    process.exit(1);
  }

  console.log(`✅ تم حذف ${ids.length} بلاغ تجريبي بنجاح.`);
  console.log('ℹ️  ملاحظة: نقاط الأحياء يلي نزلت وقت إضافة البلاغات التجريبية ما بترجع تلقائيًا —');
  console.log('   بترجع لحالها تدريجيًا مع وظيفة "التعافي اليومية" العادية، أو تقدر تعدّلها يدويًا من Supabase.');
}

main();
