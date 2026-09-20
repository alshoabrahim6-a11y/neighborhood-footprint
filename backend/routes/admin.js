// ============================================================================
// routes/admin.js
// ----------------------------------------------------------------------------
// كل الـ endpoints الخاصة بلوحة الإدارة (Admin Panel). كلها محمية بـ
// requireAdmin: أي طلب مش من حساب أدمن بينرفض تلقائيًا قبل ما يوصل هون.
//
//   GET   /api/admin/check                    → للتأكد (من الفرونت إند) إن المستخدم أدمن
//   GET   /api/admin/reports                  → كل البلاغات (معلّقة أولًا) لمراجعتها
//   PATCH /api/admin/reports/:id/status       → قبول أو رفض بلاغ معيّن
//   GET   /api/admin/reports/summary          → ملخص إحصائي فوري لفترة معيّنة (تقرير حي)
//   GET   /api/admin/reports/snapshots        → لستة التقارير الأسبوعية المحفوظة تلقائيًا
//   GET   /api/admin/reports/snapshots/:id    → تفاصيل تقرير أسبوعي محفوظ معيّن
//   POST  /api/admin/reports/snapshots/generate → توليد تقرير أسبوعي فورًا يدويًا (بدل انتظار الموعد)
// ============================================================================

import express from 'express';
import { supabase } from '../services/supabaseClient.js';
import { applyReportPenalty } from '../services/ecoPoints.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getPeriodSummary, saveWeeklySnapshot } from '../services/reportSummary.js';

const router = express.Router();

// كل الـ endpoints تحت هون بتمر أول شي على requireAdmin
router.use(requireAdmin);

router.get('/check', (req, res) => {
  res.json({ isAdmin: true, email: req.user.email });
});

// ----------------------------------------------------------------------------
// GET /api/admin/reports → كل البلاغات، البلاغات "المعلّقة" (pending) أولًا
// ----------------------------------------------------------------------------
router.get('/reports', async (req, res) => {
  const { data, error } = await supabase
    .from('reports')
    .select('*, neighborhoods(name), duplicate_report:duplicate_of(created_at, user_email)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // نرتب بحيث "pending" تطلع فوق (أهم شي يراجعه الأدمن)، وباقي البلاغات
  // تحتها بترتيبها الأصلي (الأحدث أولًا). Array.prototype.sort مستقر
  // (stable) بجافاسكريبت الحديث، فترتيب "الأحدث أولًا" جوا كل مجموعة بيضل.
  const sorted = [...data].sort((a, b) => {
    if (a.status === b.status) return 0;
    if (a.status === 'pending') return -1;
    if (b.status === 'pending') return 1;
    return 0;
  });

  res.json(sorted);
});

// ----------------------------------------------------------------------------
// PATCH /api/admin/reports/:id/status → { status: 'approved' | 'rejected' }
// ----------------------------------------------------------------------------
router.patch('/reports/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'قيمة status لازم تكون approved أو rejected أو pending' });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('reports')
    .select('status, neighborhood_id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'البلاغ غير موجود' });
  }

  const { error: updateError } = await supabase.from('reports').update({ status }).eq('id', id);

  if (updateError) {
    return res.status(500).json({ error: 'فشل تحديث حالة البلاغ' });
  }

  // نقاط الحي بتنزل بس أول مرة ينوافق فيها على البلاغ (تجنّب تكرار
  // العقوبة لو الأدمن ضغط "قبول" أكتر من مرة بالغلط)
  if (status === 'approved' && existing.status !== 'approved' && existing.neighborhood_id) {
    await applyReportPenalty(existing.neighborhood_id);
  }

  res.json({ success: true });
});

// ----------------------------------------------------------------------------
// GET /api/admin/reports/summary?days=7 → ملخص إحصائي فوري لآخر N يوم
// (مش محفوظ — بيتحسب لحظيًا كل ما الأدمن يفتح الصفحة أو يغيّر الفترة)
// ----------------------------------------------------------------------------
router.get('/reports/summary', async (req, res) => {
  const days = Number(req.query.days) || 7;

  try {
    const summary = await getPeriodSummary(days);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// GET /api/admin/reports/snapshots → لستة التقارير الأسبوعية المحفوظة
// (يلي بتتولّد تلقائيًا كل أسبوع عبر node-cron — راجع server.js)
// ----------------------------------------------------------------------------
router.get('/reports/snapshots', async (req, res) => {
  const { data, error } = await supabase
    .from('report_snapshots')
    .select('id, period_start, period_end, total_reports, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// ----------------------------------------------------------------------------
// GET /api/admin/reports/snapshots/:id → تفاصيل تقرير أسبوعي محفوظ معيّن
// ----------------------------------------------------------------------------
router.get('/reports/snapshots/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('report_snapshots')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'التقرير غير موجود' });
  }

  res.json(data.summary);
});

// ----------------------------------------------------------------------------
// POST /api/admin/reports/snapshots/generate → توليد وحفظ تقرير أسبوعي فورًا
// (نفس الوظيفة التلقائية بالضبط، بس الأدمن بيشغّلها يدويًا لما يحب،
// بدون ما ينتظر الموعد الأسبوعي — مفيد للتجربة والعرض)
// ----------------------------------------------------------------------------
router.post('/reports/snapshots/generate', async (req, res) => {
  try {
    const snapshot = await saveWeeklySnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
