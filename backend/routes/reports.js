// ============================================================================
// routes/reports.js
// ----------------------------------------------------------------------------
// كل الـ endpoints (نقاط الاتصال) المتعلقة ببلاغات التلوث:
//   POST /api/reports          → رفع بلاغ جديد (صورة + موقع)
//   GET  /api/reports          → قائمة كل البلاغات (لعرضها كنقاط على الخريطة)
//   GET  /api/reports/heatmap  → نفس البيانات بس بصيغة جاهزة لـ Leaflet.heat
// ============================================================================

import express from 'express';
import multer from 'multer';
import { supabase, STORAGE_BUCKET } from '../services/supabaseClient.js';
import { classifyPollutionImage } from '../services/aiClassifier.js';
import { getOverallStats, getLeaderboard } from '../services/reportSummary.js';
import { findDuplicateReport } from '../services/duplicateDetection.js';

const router = express.Router();

// multer: بيستقبل ملف الصورة المرفوع من الفورم ويحطه بالذاكرة (RAM) مؤقتًا
// (بدل ما يخزنه على قرص السيرفر) لأننا رح نرفعه فورًا لـ Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // حد أقصى 8 ميجا للصورة
});

// ----------------------------------------------------------------------------
// POST /api/reports
// ----------------------------------------------------------------------------
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { latitude, longitude, neighborhood_id, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'لازم ترفع صورة مع البلاغ (image)' });
    }
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'لازم تبعت latitude و longitude' });
    }

    // تسجيل الدخول اختياري: لو الفرونت إند بعت هيدر "Authorization: Bearer <token>"
    // (يعني المستخدم مسجّل دخول)، بنتحقق من التوكن مع Supabase ونجيب هويته
    // عشان نربط البلاغ فيه. لو ما في توكن أو كان غير صالح، البلاغ بينحفظ
    // عادي بدون ربطه بأي حساب (تسجيل الدخول مش إجباري بهاي النسخة).
    let userId = null;
    let userEmail = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const { data, error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        console.warn('⚠️ توكن تسجيل الدخول غير صالح، رح يتحفظ البلاغ بدون حساب:', authError.message);
      } else if (data?.user) {
        userId = data.user.id;
        userEmail = data.user.email;
      }
    }

    // 1) رفع الصورة لـ Supabase Storage باسم فريد (تاريخ + رقم عشوائي)
    const fileExt = req.file.originalname.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

    if (uploadError) {
      console.error('❌ خطأ رفع الصورة:', uploadError.message);
      return res.status(500).json({ error: 'فشل رفع الصورة لـ Storage' });
    }

    const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
    const imageUrl = publicUrlData.publicUrl;

    // 2) تصنيف الصورة بالذكاء الاصطناعي (CLIP عبر Hugging Face)
    const classification = await classifyPollutionImage(req.file.buffer);

    // 2.5) كشف البلاغات المكررة: هل في بلاغ سابق قريب جغرافيًا (< 100 متر)
    // ونفس نوع التلوث خلال آخر أسبوعين؟ ما منرفض البلاغ، بس منعلّمه عشان
    // الأدمن يشوفه بلوحة الإدارة (راجع services/duplicateDetection.js)
    const duplicateMatch = await findDuplicateReport({
      latitude: Number(latitude),
      longitude: Number(longitude),
      pollutionType: classification.pollutionType,
    });

    // 3) حفظ البلاغ بقاعدة البيانات
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        neighborhood_id: neighborhood_id || null,
        image_url: imageUrl,
        latitude: Number(latitude),
        longitude: Number(longitude),
        pollution_type: classification.pollutionType,
        ai_confidence: classification.confidence,
        ai_raw_labels: classification.rawLabels,
        description: description || null,
        user_id: userId,
        user_email: userEmail,
        is_duplicate: Boolean(duplicateMatch),
        duplicate_of: duplicateMatch?.id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ خطأ حفظ البلاغ:', insertError.message);
      return res.status(500).json({ error: 'فشل حفظ البلاغ بقاعدة البيانات' });
    }

    // ⚠️ ملاحظة: نقاط الحي ما عادت تنزل هون فورًا. بعد ما ضفنا "لوحة
    // الإدارة"، البلاغ بيضل بحالة "pending" (معلّق) وما بيأثر على نقاط
    // الحي ولا بيظهر عالخريطة العامة لغاية ما أدمن يوافق عليه — حينها
    // بس نقاط الحي بتنزل (شوف routes/admin.js).

    res.status(201).json({ report, classification });
  } catch (err) {
    console.error('❌ خطأ غير متوقع بـ POST /api/reports:', err);
    res.status(500).json({ error: 'صار خطأ غير متوقع بالسيرفر' });
  }
});

// ----------------------------------------------------------------------------
// GET /api/reports  → آخر 500 بلاغ "موافق عليه" (للخريطة والقائمة العامة)
// ----------------------------------------------------------------------------
// ⚠️ منعرض بس البلاغات يلي status = 'approved'. البلاغات الجديدة تبدأ
// دايمًا بحالة 'pending' (معلّقة) وما بتظهر هون لغاية ما أدمن يوافق عليها
// من لوحة الإدارة (راجع routes/admin.js).
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('reports')
    .select('*, neighborhoods(name)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// ----------------------------------------------------------------------------
// GET /api/reports/heatmap → [[lat, lng, intensity], ...] لـ Leaflet.heat
// ----------------------------------------------------------------------------
router.get('/heatmap', async (req, res) => {
  const { data, error } = await supabase
    .from('reports')
    .select('latitude, longitude, ai_confidence')
    .eq('status', 'approved')
    .neq('pollution_type', 'no_pollution');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const points = data.map((r) => [r.latitude, r.longitude, r.ai_confidence || 0.5]);
  res.json(points);
});

// ----------------------------------------------------------------------------
// GET /api/reports/stats → إحصائيات عامة (Public Dashboard) للجميع بدون
// تسجيل دخول — إجمالي البلاغات، توزيعها حسب الحي والنوع، والاتجاه الأسبوعي
// (راجع services/reportSummary.js → getOverallStats لتفاصيل الحساب)
// ----------------------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const stats = await getOverallStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// GET /api/reports/leaderboard → لوحة المتصدرين (أكتر المستخدمين نشاطًا)
// عامة ومتاحة للجميع بدون تسجيل دخول (راجع services/reportSummary.js →
// getLeaderboard لتفاصيل الحساب وسبب إنها آمنة نعرضها للعموم)
// ----------------------------------------------------------------------------
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const leaderboard = await getLeaderboard(limit);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
