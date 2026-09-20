// ============================================================================
// api.js
// ----------------------------------------------------------------------------
// كل الاتصالات مع السيرفر الخلفي (backend) من مكان واحد، عشان لو غيرنا
// عنوان السيرفر ما نلاقي حالنا مضطرين نغيره بكل مكان بالكود.
// ============================================================================

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const api = axios.create({ baseURL: API_BASE_URL });

export async function fetchNeighborhoods() {
  const res = await api.get('/api/neighborhoods');
  return res.data;
}

export async function fetchReports() {
  const res = await api.get('/api/reports');
  return res.data;
}

export async function fetchHeatmapPoints() {
  const res = await api.get('/api/reports/heatmap');
  return res.data;
}

/** إحصائيات عامة (لوحة الإحصائيات) — متاحة للجميع بدون تسجيل دخول */
export async function fetchPublicStats() {
  const res = await api.get('/api/reports/stats');
  return res.data;
}

/** لوحة المتصدرين (أكتر المستخدمين نشاطًا بالإبلاغ) — متاحة للجميع بدون تسجيل دخول */
export async function fetchLeaderboard(limit = 10) {
  const res = await api.get('/api/reports/leaderboard', { params: { limit } });
  return res.data;
}

/**
 * بيبعت بلاغ تلوث جديد للسيرفر (صورة + موقع + بيانات إضافية)
 * @param {{ image: File, latitude: number, longitude: number, neighborhoodId: string, description: string, accessToken?: string }} report
 *
 * accessToken اختياري: لو المستخدم مسجّل دخول، بنبعت "توكن" جلسته بهيدر
 * Authorization عشان السيرفر الخلفي يتأكد مين هو ويربط البلاغ بحسابه.
 * لو ما بعثناه (مستخدم غير مسجّل)، البلاغ بينحفظ عادي بس بدون ربطه بحساب.
 */
export async function submitReport({ image, latitude, longitude, neighborhoodId, description, accessToken }) {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('latitude', latitude);
  formData.append('longitude', longitude);
  if (neighborhoodId) formData.append('neighborhood_id', neighborhoodId);
  if (description) formData.append('description', description);

  const headers = { 'Content-Type': 'multipart/form-data' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await api.post('/api/reports', formData, { headers });
  return res.data;
}

// ----------------------------------------------------------------------------
// لوحة الإدارة (Admin Panel) — كل هاي الدوال بتحتاج accessToken لحساب أدمن،
// وإلا السيرفر الخلفي بيرفض الطلب (401 لو مش مسجّل دخول، 403 لو مسجّل
// دخول بس مش أدمن).
// ----------------------------------------------------------------------------

/** بيتأكد هل صاحب هاد التوكن حساب أدمن أو لأ */
export async function checkIsAdmin(accessToken) {
  try {
    const res = await api.get('/api/admin/check', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data.isAdmin === true;
  } catch {
    // 401 أو 403 يعني ببساطة مش أدمن (أو مش مسجّل دخول أصلاً)
    return false;
  }
}

/** بيجيب كل البلاغات (بكل الحالات) عشان الأدمن يراجعها */
export async function fetchAdminReports(accessToken) {
  const res = await api.get('/api/admin/reports', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** بيغيّر حالة بلاغ معيّن: 'approved' أو 'rejected' */
export async function updateReportStatus(reportId, status, accessToken) {
  const res = await api.patch(
    `/api/admin/reports/${reportId}/status`,
    { status },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}

// ----------------------------------------------------------------------------
// التقارير الدورية (Reports Summary) — كلها كمان محتاجة حساب أدمن
// ----------------------------------------------------------------------------

/** ملخص إحصائي فوري لآخر N يوم (بيتحسب لحظيًا، مش محفوظ) */
export async function fetchReportSummary(days, accessToken) {
  const res = await api.get('/api/admin/reports/summary', {
    params: { days },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** لستة التقارير الأسبوعية المحفوظة تلقائيًا (بدون تفاصيلها الكاملة) */
export async function fetchSnapshots(accessToken) {
  const res = await api.get('/api/admin/reports/snapshots', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** تفاصيل تقرير أسبوعي محفوظ معيّن */
export async function fetchSnapshotById(id, accessToken) {
  const res = await api.get(`/api/admin/reports/snapshots/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** توليد وحفظ تقرير أسبوعي فورًا (يدويًا، بدل انتظار الموعد التلقائي) */
export async function generateSnapshotNow(accessToken) {
  const res = await api.post(
    '/api/admin/reports/snapshots/generate',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}
