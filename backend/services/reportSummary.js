// ============================================================================
// reportSummary.js
// ----------------------------------------------------------------------------
// منطق "التقارير الدورية": بيحسب ملخص إحصائي للبلاغات (الموافق عليها فقط)
// خلال فترة معيّنة — إجمالي البلاغات، توزيعها حسب الحي وحسب نوع التلوث،
// ومقارنة مع الفترة اللي قبلها (نسبة الزيادة أو النقصان).
//
// هاد الملف ما بيتعامل مع أي واجهة (route) مباشرة — بس منطق حساب البيانات،
// عشان نقدر نستخدمه بمكانين: (1) endpoint حي لما الأدمن يطلب تقرير فوري،
// و(2) وظيفة node-cron الأسبوعية التلقائية يلي بتحفظ "لقطة" (snapshot).
// ============================================================================

import { supabase } from './supabaseClient.js';

// نفس ترجمة أنواع التلوث الموجودة بالفرونت إند (pollutionTypes.js) — نسخة
// مستقلة هون لأنه backend وfrontend مشروعين منفصلين ومابيتشاركوا كود.
const POLLUTION_LABELS = {
  garbage_burning: 'حرق قمامة',
  air_pollution: 'تلوث هوائي / دخان',
  illegal_dumping: 'رمي نفايات عشوائي',
  water_pollution: 'تلوث مائي',
  no_pollution: 'لا يوجد تلوث',
  unknown: 'غير محدد',
};

function pollutionLabel(code) {
  return POLLUTION_LABELS[code] || POLLUTION_LABELS.unknown;
}

/**
 * بيحسب ملخص البلاغات (الموافق عليها بس) بين تاريخين.
 * @param {Date} start
 * @param {Date} end
 */
async function summarizeReportsBetween(start, end) {
  const { data, error } = await supabase
    .from('reports')
    .select('id, pollution_type, neighborhood_id, created_at, neighborhoods(name)')
    .eq('status', 'approved')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());

  if (error) {
    throw new Error(`فشل جلب البلاغات: ${error.message}`);
  }

  const byNeighborhoodMap = new Map();
  const byTypeMap = new Map();

  for (const report of data) {
    // توزيع حسب الحي
    const neighborhoodName = report.neighborhoods?.name || 'غير محدد';
    byNeighborhoodMap.set(neighborhoodName, (byNeighborhoodMap.get(neighborhoodName) || 0) + 1);

    // توزيع حسب نوع التلوث
    const label = pollutionLabel(report.pollution_type);
    byTypeMap.set(label, (byTypeMap.get(label) || 0) + 1);
  }

  const byNeighborhood = [...byNeighborhoodMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const byType = [...byTypeMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return { totalReports: data.length, byNeighborhood, byType };
}

/**
 * الدالة الرئيسية: بترجع ملخص فترة معيّنة (بالأيام) + مقارنة مع الفترة يلي
 * قبلها بنفس الطول (عشان نعرف هل الوضع تحسّن أو ساء).
 * @param {number} days
 */
export async function getPeriodSummary(days = 7) {
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

  const current = await summarizeReportsBetween(periodStart, now);
  const previous = await summarizeReportsBetween(previousStart, periodStart);

  let percentChange = null;
  if (previous.totalReports > 0) {
    percentChange = Math.round(
      ((current.totalReports - previous.totalReports) / previous.totalReports) * 100
    );
  } else if (current.totalReports > 0) {
    percentChange = 100; // من صفر لأي رقم = زيادة كاملة (100%+)، منعرضها كـ 100%
  }

  return {
    periodDays: days,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    totalReports: current.totalReports,
    byNeighborhood: current.byNeighborhood,
    byType: current.byType,
    previousTotalReports: previous.totalReports,
    percentChange,
  };
}

/**
 * إحصائيات عامة "لكل الوقت" (كل البلاغات الموافق عليها منذ بداية المشروع) —
 * تُستخدم بصفحة "الإحصائيات" العامة (متاحة للجميع، بدون تسجيل دخول)، وبتحتوي:
 *   - إجمالي عدد البلاغات الموافق عليها
 *   - توزيعها حسب الحي (للرسم البياني الشريطي / bar chart)
 *   - توزيعها حسب نوع التلوث (للرسم الدائري / pie chart)
 *   - عدد البلاغات بكل أسبوع من آخر N أسبوع (للرسم الخطي / line chart)
 *
 * ⚠️ ما في ولا معلومة شخصية هون (بدون user_email أو أي بيانات حساسة) —
 * بس أرقام مجمّعة (aggregated)، فآمنة تمامًا نعرضها للجميع بدون تسجيل دخول،
 * تمامًا متل بيانات الخريطة الحرارية العامة.
 * @param {number} weeksCount
 */
export async function getOverallStats(weeksCount = 8) {
  const { data, error } = await supabase
    .from('reports')
    .select('id, pollution_type, neighborhood_id, created_at, neighborhoods(name)')
    .eq('status', 'approved');

  if (error) {
    throw new Error(`فشل جلب إحصائيات البلاغات: ${error.message}`);
  }

  const byNeighborhoodMap = new Map();
  const byTypeMap = new Map();

  for (const report of data) {
    const neighborhoodName = report.neighborhoods?.name || 'غير محدد';
    byNeighborhoodMap.set(neighborhoodName, (byNeighborhoodMap.get(neighborhoodName) || 0) + 1);

    const label = pollutionLabel(report.pollution_type);
    byTypeMap.set(label, (byTypeMap.get(label) || 0) + 1);
  }

  const byNeighborhood = [...byNeighborhoodMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const byType = [...byTypeMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // نقسم آخر (weeksCount * 7) يوم لـ "دلاء" (buckets) أسبوعية، وكل بلاغ
  // منحطه بالدلو المناسب حسب تاريخه — هيك منحصل على نقطة واحدة بالرسم
  // الخطي عن كل أسبوع، بدل ما نسوي استعلام منفصل لكل أسبوع.
  const now = new Date();
  const buckets = [];
  for (let i = weeksCount - 1; i >= 0; i--) {
    const bucketEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const bucketStart = new Date(bucketEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    buckets.push({ start: bucketStart, end: bucketEnd, count: 0 });
  }

  for (const report of data) {
    const createdAt = new Date(report.created_at);
    const bucket = buckets.find((b) => createdAt >= b.start && createdAt < b.end);
    if (bucket) bucket.count += 1;
  }

  const weeklyTrend = buckets.map((b) => ({
    weekStart: b.start.toISOString(),
    weekEnd: b.end.toISOString(),
    count: b.count,
  }));

  return {
    totalReports: data.length,
    byNeighborhood,
    byType,
    weeklyTrend,
  };
}

/**
 * لوحة المتصدرين (Leaderboard) — أكتر المستخدمين نشاطًا بالإبلاغ (حسب عدد
 * البلاغات الموافق عليها فقط). عامة ومتاحة للجميع بدون تسجيل دخول، تمامًا
 * متل باقي البيانات المجمّعة بلوحة الإحصائيات — والإيميلات هون أصلًا ظاهرة
 * للعموم بالخريطة (النافذة المنبثقة لكل بلاغ)، فما في معلومة إضافية جديدة
 * منكشفها هون.
 * @param {number} limit
 */
export async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('reports')
    .select('user_email')
    .eq('status', 'approved')
    .not('user_email', 'is', null);

  if (error) {
    throw new Error(`فشل جلب لوحة المتصدرين: ${error.message}`);
  }

  const countMap = new Map();
  for (const report of data) {
    countMap.set(report.user_email, (countMap.get(report.user_email) || 0) + 1);
  }

  return [...countMap.entries()]
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * وظيفة "التقرير الأسبوعي التلقائي": بتحسب ملخص آخر 7 أيام وبتحفظه بجدول
 * report_snapshots — هاد يلي بيشتغل لحاله كل أسبوع عبر node-cron
 * (راجع server.js)، وكمان ممكن الأدمن يشغّله يدويًا من لوحة الإدارة لو
 * بده يشوف تقرير فوري بدون ما ينتظر الموعد الأسبوعي.
 */
export async function saveWeeklySnapshot() {
  const summary = await getPeriodSummary(7);

  const { data, error } = await supabase
    .from('report_snapshots')
    .insert({
      period_start: summary.periodStart,
      period_end: summary.periodEnd,
      total_reports: summary.totalReports,
      summary,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`فشل حفظ التقرير الأسبوعي: ${error.message}`);
  }

  console.log(`📊 تم إنشاء وحفظ التقرير الأسبوعي التلقائي (${summary.totalReports} بلاغ) بتاريخ ${new Date().toLocaleString()}`);

  return data;
}
