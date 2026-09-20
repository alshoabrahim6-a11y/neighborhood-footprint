// ============================================================================
// supabaseClient.js
// ----------------------------------------------------------------------------
// هاد الملف بيعمل "اتصال" واحد بقاعدة بيانات Supabase ويصدّره (export) عشان
// باقي ملفات السيرفر تستخدمه بدل ما كل ملف يعمل اتصال لحاله.
//
// ملاحظة مهمة: إحنا هون مستخدمين الـ "service role key" (مفتاح السيرفر السري)
// مش الـ "anon key" (المفتاح العام). الفرق:
//   - anon key   → آمن نحطه بالمتصفح (frontend)، إله صلاحيات محدودة
//   - service key→ خطير، ما لازم يطلع من السيرفر أبدًا، إله صلاحية كاملة
// عشان هيك هاد المفتاح موجود بس بملف .env على السيرفر، وما بنبعته للمتصفح.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    '❌ ناقص SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY بملف .env — راجع خطوات README.md'
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'pollution-photos';
