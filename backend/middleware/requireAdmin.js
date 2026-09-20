// ============================================================================
// requireAdmin.js
// ----------------------------------------------------------------------------
// "حارس" (middleware) بنحطه قبل أي endpoint خاص بالأدمن: بيتأكد إن الطلب
// جاي من مستخدم مسجّل دخول (عبر هيدر Authorization: Bearer <token>)، وإنه
// هاد المستخدم موجود بجدول "admins" بقاعدة البيانات.
//
// لو أي شرط ما تحقق، بيرفض الطلب فورًا (401 أو 403) وما بيوصل لكود الـ
// endpoint نفسه أبدًا.
// ============================================================================

import { supabase } from '../services/supabaseClient.js';

export async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'لازم تسجّل دخول أولاً' });
  }

  const token = authHeader.slice('Bearer '.length);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'جلسة الدخول غير صالحة، سجّل دخول من جديد' });
  }

  const { data: adminRow, error: adminError } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (adminError) {
    console.error('❌ خطأ وقت فحص صلاحية الأدمن:', adminError.message);
    return res.status(500).json({ error: 'صار خطأ غير متوقع بفحص الصلاحيات' });
  }

  if (!adminRow) {
    return res.status(403).json({ error: 'هاد الحساب ما إله صلاحية أدمن' });
  }

  // منحط بيانات المستخدم بالطلب عشان أي endpoint جاي بعده يقدر يستخدمها
  req.user = userData.user;
  next();
}
