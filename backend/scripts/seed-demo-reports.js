// ============================================================================
// seed-demo-reports.js
// ----------------------------------------------------------------------------
// سكريبت لإضافة بلاغات تجريبية "كاملة البيانات" (حي محدد + نوع تلوث واضح +
// موقع + تاريخ) مباشرة بقاعدة البيانات — مفيد قبل عرض المشروع على اللجنة
// عشان تبويب "📈 الإحصائيات" يطلع برسوم بيانية واضحة وجميلة بدل ما يكون
// مليان بيانات ناقصة (غير محدد) من التجربة العادية.
//
// الاستخدام (من جوا مجلد backend):
//   node scripts/seed-demo-reports.js "اسم الحي بالضبط" [عدد البلاغات]
//
// مثال:
//   node scripts/seed-demo-reports.js "حي النزهة" 8
//
// لو ما حددت عدد، الافتراضي 8 بلاغات موزّعة على آخر 8 أسابيع (بلاغ بكل
// أسبوع تقريبًا)، عشان الرسم الخطي بلوحة الإحصائيات يطلع بشكل تدريجي حلو
// بدل قفزة مفاجئة بآخر أسبوع بس.
//
// ملاحظة مهمة: كل بلاغ منضيفه هون بنعلّمه داخليًا (بحقل ai_raw_labels، يلي
// مش ظاهر بأي مكان بالواجهة) بعلامة { seed: true } عشان تقدر بعد العرض
// تلاقيهم وتحذفهم بسهولة لو حبيت، بدون ما تلمس بلاغاتك الحقيقية. للحذف:
//   node scripts/remove-demo-reports.js
//
// ملاحظة عن الإيميلات: كل بلاغ تجريبي هلا منربطه بـ user_email وهمي (من
// قائمة DEMO_EMAILS تحت) — بدون user_id حقيقي (يعني مش حسابات فعلية
// بـ Supabase Auth، بس نص عادي بعمود user_email). هاد بس عشان "لوحة
// المتصدرين" بتبويب الإحصائيات تطلع فيها أكتر من اسم بشكل واقعي وقت
// العرض على اللجنة، بدل ما تكون فاضية أو فيها إيميلك الشخصي بس.
// ============================================================================

import { supabase } from '../services/supabaseClient.js';
import { applyReportPenalty } from '../services/ecoPoints.js';

const [, , neighborhoodNameArg, countArg] = process.argv;

if (!neighborhoodNameArg) {
  console.error('❌ الاستخدام الصحيح: node scripts/seed-demo-reports.js "اسم الحي بالضبط" [عدد البلاغات]');
  process.exit(1);
}

const count = Number(countArg) > 0 ? Number(countArg) : 8;

// نفس أنواع التلوث الموجودة بباقي المشروع (reportSummary.js / pollutionTypes.js)
// — بدون 'no_pollution' و 'unknown' عشان الرسوم البيانية تطلع بأنواع واضحة ومفيدة
const POLLUTION_TYPES = ['garbage_burning', 'air_pollution', 'illegal_dumping', 'water_pollution'];

// صور جاهزة (Picsum — خدمة صور عامة مجانية) نستخدمها بس لو ما لقينا ولا
// صورة حقيقية عندك بقاعدة البيانات نقدر نعيد استخدامها
const FALLBACK_IMAGES = [
  'https://picsum.photos/seed/pollution1/640/480',
  'https://picsum.photos/seed/pollution2/640/480',
  'https://picsum.photos/seed/pollution3/640/480',
  'https://picsum.photos/seed/pollution4/640/480',
];

// موقع افتراضي احتياطي (لو ما لقينا ولا إحداثيات بقاعدة البيانات نبني عليها)
// — عدّل هاي القيم إذا حابب تحط إحداثيات منطقتك بالضبط
const DEFAULT_BASE_LAT = 3.139;
const DEFAULT_BASE_LNG = 101.6869;

// إيميلات وهمية (مش حسابات حقيقية) نوزّعها على البلاغات التجريبية، عشان
// "لوحة المتصدرين" تطلع فيها أكتر من اسم بترتيب واقعي (أول واحد أكتر
// بلاغات، وهيك لحد آخر واحد). عدّل الأسماء لو حابب أسماء غير هاي.
const DEMO_EMAILS = [
  'sara.student@example.com',
  'omar.volunteer@example.com',
  'lina.eco@example.com',
  'yousef.reports@example.com',
  'huda.green@example.com',
];

// أوزان توزيع الإيميلات فوق (لازم يكون نفس عدد DEMO_EMAILS ومجموعها 1) —
// أول إيميل بياخد أكبر نسبة بلاغات، وهيك بالترتيب، عشان شكل اللوحة يطلع
// متدرّج ومنطقي متل موقف حقيقي فيه "متصدر" واضح.
const DEMO_EMAIL_WEIGHTS = [0.4, 0.25, 0.17, 0.11, 0.07];

function pickDemoEmail() {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < DEMO_EMAILS.length; i++) {
    cumulative += DEMO_EMAIL_WEIGHTS[i];
    if (r <= cumulative) return DEMO_EMAILS[i];
  }
  return DEMO_EMAILS[DEMO_EMAILS.length - 1];
}

function jitter(value, maxOffset = 0.006) {
  return value + (Math.random() - 0.5) * 2 * maxOffset;
}

function randomConfidence() {
  return Math.round((0.72 + Math.random() * 0.24) * 100) / 100; // بين 0.72 و 0.96
}

async function main() {
  // 1) نلاقي الحي بالاسم بالضبط
  const { data: neighborhood, error: nError } = await supabase
    .from('neighborhoods')
    .select('id, name')
    .eq('name', neighborhoodNameArg)
    .maybeSingle();

  if (nError) {
    console.error('❌ صار خطأ وقت البحث عن الحي:', nError.message);
    process.exit(1);
  }

  if (!neighborhood) {
    const { data: allNeighborhoods } = await supabase.from('neighborhoods').select('name');
    console.error(`❌ ما لقيت حي بهاد الاسم بالضبط: "${neighborhoodNameArg}"`);
    console.error('   الأحياء الموجودة عندك فعليًا:');
    (allNeighborhoods || []).forEach((n) => console.error(`   - ${n.name}`));
    process.exit(1);
  }

  console.log(`✅ لقينا الحي: ${neighborhood.name} (${neighborhood.id})`);

  // 2) نجيب موقع (lat/lng) نبني عليه — أولوية لبلاغ حقيقي بنفس الحي،
  // بعدها أي بلاغ بقاعدة البيانات، وإلا الموقع الافتراضي فوق
  let baseLat = DEFAULT_BASE_LAT;
  let baseLng = DEFAULT_BASE_LNG;

  const { data: sameNeighborhoodReport } = await supabase
    .from('reports')
    .select('latitude, longitude')
    .eq('neighborhood_id', neighborhood.id)
    .limit(1)
    .maybeSingle();

  if (sameNeighborhoodReport) {
    baseLat = sameNeighborhoodReport.latitude;
    baseLng = sameNeighborhoodReport.longitude;
    console.log('📍 استخدمنا موقع بلاغ حقيقي موجود بنفس الحي كنقطة أساس.');
  } else {
    const { data: anyReport } = await supabase
      .from('reports')
      .select('latitude, longitude')
      .limit(1)
      .maybeSingle();

    if (anyReport) {
      baseLat = anyReport.latitude;
      baseLng = anyReport.longitude;
      console.log('📍 ما في بلاغات بنفس الحي، استخدمنا موقع أي بلاغ حقيقي ثاني كنقطة أساس.');
    } else {
      console.log('📍 ما في ولا بلاغ بقاعدة البيانات أصلًا، استخدمنا موقع افتراضي (عدّله بالسكريبت لو حابب).');
    }
  }

  // 3) نجيب صور حقيقية موجودة عندك بالفعل عشان نعيد استخدامها (بدل صور عامة)
  const { data: existingImages } = await supabase
    .from('reports')
    .select('image_url')
    .not('image_url', 'is', null)
    .limit(20);

  const imagePool =
    existingImages && existingImages.length > 0 ? existingImages.map((r) => r.image_url) : FALLBACK_IMAGES;

  if (existingImages && existingImages.length > 0) {
    console.log(`🖼️  رح نعيد استخدام ${imagePool.length} صورة حقيقية موجودة عندك أصلًا.`);
  } else {
    console.log('🖼️  ما في صور حقيقية بقاعدة البيانات، رح نستخدم صور عامة (Picsum) بس للعرض.');
  }

  // 4) نبني البلاغات ونوزّع تواريخها على آخر (count) أسبوع، بلاغ بكل أسبوع
  // تقريبًا، عشان الرسم الخطي بلوحة الإحصائيات يطلع تدرّج حلو بدل قفزة
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const rows = Array.from({ length: count }).map((_, i) => {
    const weeksAgo = count - 1 - i; // أقدم بلاغ أول (weeksAgo كبير)، الأحدث آخر شي
    const createdAt = new Date(now - weeksAgo * weekMs - Math.random() * weekMs * 0.5);

    return {
      neighborhood_id: neighborhood.id,
      image_url: imagePool[i % imagePool.length],
      latitude: jitter(baseLat),
      longitude: jitter(baseLng),
      pollution_type: POLLUTION_TYPES[i % POLLUTION_TYPES.length],
      ai_confidence: randomConfidence(),
      ai_raw_labels: { seed: true, note: 'demo-seed-script', createdBy: 'seed-demo-reports.js' },
      user_email: pickDemoEmail(),
      status: 'approved',
      created_at: createdAt.toISOString(),
    };
  });

  const { data: inserted, error: insertError } = await supabase.from('reports').insert(rows).select('id');

  if (insertError) {
    console.error('❌ صار خطأ وقت إضافة البلاغات التجريبية:', insertError.message);
    process.exit(1);
  }

  console.log(`✅ تمت إضافة ${inserted.length} بلاغ تجريبي بحي "${neighborhood.name}" بنجاح.`);

  // توزيع الإيميلات الوهمية اللي انحطت، عشان تعرف مسبقًا شو رح تشوف
  // بلوحة المتصدرين قبل ما تروح تتأكد بنفسك
  const emailCounts = new Map();
  for (const row of rows) {
    emailCounts.set(row.user_email, (emailCounts.get(row.user_email) || 0) + 1);
  }
  console.log('👤 توزيع البلاغات على الإيميلات الوهمية (لوحة المتصدرين):');
  [...emailCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([email, c]) => console.log(`   - ${email}: ${c} بلاغ`));

  // 5) ننزّل نقاط الحي بنفس منطق الموافقة العادية (كل بلاغ = -5 نقاط)، عشان
  // لوحة "نقاط الأحياء" تكون متناسقة مع البلاغات الجديدة
  for (let i = 0; i < inserted.length; i++) {
    await applyReportPenalty(neighborhood.id);
  }
  console.log(`📉 تم تحديث النقاط البيئية لحي "${neighborhood.name}" (${inserted.length} × -5 نقاط).`);

  console.log('\n🎉 خلص! روح لتبويب "📈 الإحصائيات" و"🏆 نقاط الأحياء" وشوف النتيجة.');
  console.log('   لو حبيت تحذف هاي البلاغات التجريبية بعد العرض، شغّل:');
  console.log('   node scripts/remove-demo-reports.js');
}

main();
