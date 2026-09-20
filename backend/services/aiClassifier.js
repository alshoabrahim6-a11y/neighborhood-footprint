// ============================================================================
// aiClassifier.js
// ----------------------------------------------------------------------------
// هون بصير "التصنيف بالذكاء الاصطناعي" لنوع التلوث بالصورة.
//
// ⚠️ تحديث مهم (راجع README): النسخة الأولى من هاد الملف كانت بتستخدم موديل
// CLIP بطريقة "zero-shot" (نقارن الصورة بأوصاف نصية حرة). تبيّن إن Hugging
// Face وقفوا استضافة هاد النوع من الموديلات مجانًا، فرجعنا لطريقة أبسط:
//
// الفكرة الحالية (Image Classification عادي، مش zero-shot):
//   بنستخدم موديل "microsoft/resnet-50" — موديل مشهور ومتوفر مجانًا وبشكل
//   دائم على Hugging Face، بس هو مدرب على تصنيف عام لـ 1000 نوع غرض/مشهد
//   (قطط، سيارات، أدوات...) اسمها ImageNet — مش مدرب خصيصًا على "تلوث".
//
//   عشان نربط تصنيفاته العامة بأنواع التلوث عندنا، بنعمل "خريطة كلمات
//   مفتاحية" (CATEGORY_KEYWORDS تحت): إذا الموديل رجع تصنيف فيه كلمة زي
//   "ashcan" (سلة قمامة) أو "volcano" (بركان/دخان)، منربطه بنوع التلوث
//   المناسب.
//
// ⚠️ ملاحظة صراحة للتقرير: هاي طريقة تقريبية (approximation) لأنها موديل
// عام مش مخصص، فدقتها محدودة. الخطوة المستقبلية الصح هي تدريب موديل مخصص
// (transfer learning) على صور تلوث حقيقية جمعتوها من المستخدمين — مذكورة
// بقسم "الخطوات الجاية" بملف README.md.
// ============================================================================

import dotenv from 'dotenv';
dotenv.config();

// .trim() دفاعي: أحيانًا لما تنسخ/تلصق التوكن بمحرر نصوص متل Notepad، بينلصق
// معه مسافة أو سطر فاضي بالغلط بآخر القيمة، وهاد كافي يخلي التوكن "يبان" غلط
// حتى لو نسخته صح. الـ trim() بيشيل أي مسافات زايدة بالبداية أو النهاية.
const HF_API_KEY = (process.env.HUGGINGFACE_API_KEY || '').trim();
const HF_MODEL = 'microsoft/resnet-50';
// ملاحظة: Hugging Face غيّروا عنوان الـ API بنوفمبر 2025. العنوان القديم
// (api-inference.huggingface.co) صار يرجع خطأ "no longer supported".
// العنوان الصحيح الجديد هو عبر "router":
const HF_ENDPOINT = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

// كل فئة تلوث مرتبطة بكلمات مفتاحية من تصنيفات ImageNet (1000 فئة) اللي
// بيرجعها الموديل. الترتيب مهم: أول فئة تلاقي فيها كلمة مطابقة بأعلى
// تصنيف هي يلي بتنستخدم. حاب تحسّن الدقة؟ زيد/بدّل كلمات هون.
const CATEGORY_KEYWORDS = [
  {
    code: 'illegal_dumping',
    keywords: ['ashcan', 'trash', 'garbage', 'dustbin', 'wastebin', 'dump', 'plastic bag'],
  },
  {
    code: 'garbage_burning',
    keywords: ['fire', 'flame', 'torch', 'matchstick', 'candle'],
  },
  {
    code: 'air_pollution',
    keywords: ['volcano', 'geyser'],
  },
  {
    code: 'water_pollution',
    keywords: ['seashore', 'lakeside', 'breakwater', 'sandbar', 'wreck'],
  },
];

/**
 * بيصنّف صورة تلوث باستخدام موديل تصنيف صور عام (ResNet-50) عبر Hugging Face،
 * ثم بيربط النتيجة بأقرب نوع تلوث عندنا حسب كلمات مفتاحية.
 * @param {Buffer} imageBuffer - بايتات الصورة المرفوعة
 * @returns {Promise<{pollutionType: string, confidence: number, rawLabels: object[]}>}
 */
export async function classifyPollutionImage(imageBuffer) {
  console.log('\n🔍 [AI DEBUG] ========== بدء تصنيف صورة جديدة ==========');

  // خطوة 1: هل التوكن موجود أصلاً، وشكله منطقي؟
  console.log('🔍 [AI DEBUG] 1) فحص HUGGINGFACE_API_KEY:');
  if (!HF_API_KEY) {
    console.warn('   ❌ التوكن فاضي أو مش موجود بملف .env — تأكد إن السطر HUGGINGFACE_API_KEY=... موجود ومعبّى.');
    return fallbackResult('missing_api_key');
  }
  console.log(`   ✅ موجود — الطول: ${HF_API_KEY.length} حرف، أول 6 أحرف: "${HF_API_KEY.slice(0, 6)}..."`);
  if (!HF_API_KEY.startsWith('hf_')) {
    console.warn('   ⚠️ تنبيه: التوكن العادي من Hugging Face المفروض يبدأ بـ "hf_" — تأكد إنك نسخت التوكن كامل وصح.');
  }

  // خطوة 2: تجهيز الصورة
  console.log('🔍 [AI DEBUG] 2) حجم الصورة المرفوعة (bytes):', imageBuffer.length);
  const base64Image = imageBuffer.toString('base64');
  console.log('🔍 [AI DEBUG] 3) الرابط اللي رح نبعتله الطلب:', HF_ENDPOINT);

  try {
    console.log('🔍 [AI DEBUG] 4) عم نبعت الطلب لـ Hugging Face... (ممكن ياخد كذا ثانية)');
    const response = await fetch(HF_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: base64Image,
        parameters: { top_k: 5 },
      }),
    });

    console.log(`🔍 [AI DEBUG] 5) رجع رد من Hugging Face — status: ${response.status}, ok: ${response.ok}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error('   ❌ نص الخطأ الكامل من Hugging Face:', errText);

      if (response.status === 401 || response.status === 403) {
        console.error(
          '   👉 هاد خطأ صلاحيات (401/403): التوكن إما غلط، أو نوعه مش صحيح.\n' +
            '      روح لـ huggingface.co/settings/tokens وتأكد إن هاد بالضبط التوكن الجديد\n' +
            '      (Fine-grained + صلاحية "Make calls to Inference Providers" مفعّلة)،\n' +
            '      وإنك نسخته ولصقته كامل بملف .env بدون علامات اقتباس أو مسافات زيادة.'
        );
      }
      if (response.status === 503) {
        console.error('   👉 الموديل عم يتحمّل لأول مرة ("cold start") — جرب ترفع الصورة كرة ثانية بعد ١٠-٢٠ ثانية.');
      }
      if (response.status === 404) {
        console.error('   👉 خطأ 404: تأكد إن اسم الموديل بالكود صحيح (' + HF_MODEL + ') والرابط صحيح.');
      }

      return fallbackResult(`http_${response.status}`);
    }

    const predictions = await response.json();
    console.log('🔍 [AI DEBUG] 6) نتائج التصنيف الخام من الموديل:', JSON.stringify(predictions, null, 2));
    // predictions شكله: [{ label: "...", score: 0.83 }, ...] لأعلى 5 تصنيفات

    const matched = matchCategory(predictions);
    console.log('🔍 [AI DEBUG] 7) نتيجة المطابقة مع خريطة أنواع التلوث:', matched);
    console.log('🔍 [AI DEBUG] ========== انتهى التصنيف ==========\n');

    return {
      pollutionType: matched ? matched.code : 'unknown',
      confidence: Number((matched ? matched.score : predictions[0]?.score ?? 0).toFixed(3)),
      rawLabels: predictions,
    };
  } catch (err) {
    console.error('   ❌ استثناء (exception) وقت الاتصال بـ Hugging Face:', err.message);
    console.error('   👉 هاد عادة معناه: ما في اتصال إنترنت، أو الرابط مكتوب غلط، أو الخدمة واقعة مؤقتًا.');
    return fallbackResult('network_error');
  }
}

// بيدور بلائحة تصنيفات الموديل (top_k) عن أول كلمة مفتاحية مطابقة،
// وبيرجع نوع التلوث المرتبط بيها مع نسبة الثقة لهاد التصنيف بالذات.
function matchCategory(predictions) {
  for (const category of CATEGORY_KEYWORDS) {
    for (const prediction of predictions) {
      const labelLower = prediction.label.toLowerCase();
      if (category.keywords.some((kw) => labelLower.includes(kw))) {
        return { code: category.code, score: prediction.score };
      }
    }
  }
  return null; // ما في ولا كلمة مفتاحية طابقت أي تصنيف من الموديل
}

// نتيجة احتياطية لما ما نقدر نستخدم الذكاء الاصطناعي (بدل ما السيرفر يطيح)
function fallbackResult(reason) {
  return {
    pollutionType: 'unknown',
    confidence: 0,
    rawLabels: [{ note: `classification_unavailable: ${reason}` }],
  };
}
