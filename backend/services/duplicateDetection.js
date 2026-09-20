// ============================================================================
// duplicateDetection.js
// ----------------------------------------------------------------------------
// كشف البلاغات المكررة: قبل ما نحفظ بلاغ جديد بقاعدة البيانات، منشوف هل في
// بلاغ سابق (لسا pending أو approved) بنفس نوع التلوث، وقريب جغرافيًا (أقل
// من DUPLICATE_RADIUS_METERS متر)، وحديث (خلال آخر DUPLICATE_WINDOW_DAYS يوم).
//
// لو لقينا هيك بلاغ، ما منرفض البلاغ الجديد ولا منمنع صاحبه من إرساله —
// منحفظه عادي بس منعلّمه (is_duplicate = true) عشان الأدمن يشوفه بلوحة
// الإدارة وياخد القرار المناسب (ممكن يكون فعلاً نفس المصدر، أو غلطة، أو
// كمان تأكيد إضافي مفيد إنه المشكلة لسا موجودة).
// ============================================================================

import { supabase } from './supabaseClient.js';

// نصف قطر البحث عن بلاغات "قريبة" بالمتر — 100 متر تقريبًا نفس الشارع/المكان
const DUPLICATE_RADIUS_METERS = 100;

// بس البلاغات الحديثة (آخر أسبوعين) منقارن فيها — تلوث انبلّغ عنه من شهرين
// ممكن يكون انحل ورجع صار، فمش منطقي نعتبره "نفس البلاغ"
const DUPLICATE_WINDOW_DAYS = 14;

const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * صيغة هافرساين (Haversine): بتحسب المسافة الحقيقية بالمتر بين نقطتين على
 * سطح الكرة الأرضية، حسب خط العرض والطول تبع كل وحدة — أدق بكتير من مجرد
 * طرح الإحداثيات عن بعض لأنه درجة الطول بتصغر كل ما ابتعدنا عن خط الاستواء.
 */
export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * بيدور على أقرب بلاغ سابق مشابه (لو في)، ويرجعه، وإلا بيرجع null.
 * @param {{ latitude: number, longitude: number, pollutionType: string }} params
 * @returns {Promise<{ id: string } | null>}
 */
export async function findDuplicateReport({ latitude, longitude, pollutionType }) {
  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('reports')
    .select('id, latitude, longitude')
    .eq('pollution_type', pollutionType)
    .in('status', ['pending', 'approved'])
    .gte('created_at', windowStart.toISOString());

  if (error) {
    // ⚠️ لو صار خطأ هون، ما منوقف عملية إرسال البلاغ كلها بسبب هيك — بس
    // منتجاهل كشف التكرار لهاد البلاغ ومنكمل عادي (كشف التكرار "إضافة"،
    // مش شرط أساسي لعمل الموقع)
    console.warn('⚠️ فشل التحقق من البلاغات المكررة (رح نتابع عادي بدون كشف تكرار):', error.message);
    return null;
  }

  let closest = null;
  let closestDistance = Infinity;

  for (const report of data) {
    const distance = haversineDistanceMeters(latitude, longitude, report.latitude, report.longitude);
    if (distance <= DUPLICATE_RADIUS_METERS && distance < closestDistance) {
      closest = report;
      closestDistance = distance;
    }
  }

  return closest;
}
