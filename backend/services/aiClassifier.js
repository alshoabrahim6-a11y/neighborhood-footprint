// ============================================================================
// aiClassifier.js
// ----------------------------------------------------------------------------
// This is where the AI classification of the pollution type in the image happens.
//
// ⚠️ Important update (see README): the first version of this file used the
// CLIP model in a "zero-shot" way (comparing the image against free-text
// descriptions). It turned out Hugging Face stopped hosting this type of
// model for free, so we went back to a simpler approach:
//
// The current idea (regular Image Classification, not zero-shot):
//   We use the "microsoft/resnet-50" model — a well-known model that's
//   freely and permanently available on Hugging Face, but it's trained on a
//   general classification of 1000 object/scene types (cats, cars,
//   tools...) called ImageNet — not trained specifically on "pollution".
//
//   To connect its general classifications to our pollution types, we build
//   a "keyword map" (CATEGORY_KEYWORDS below): if the model returns a
//   classification containing a word like "ashcan" (trash can) or "volcano"
//   (volcano/smoke), we map it to the matching pollution type.
//
// ⚠️ Note for the report, to be upfront about it: this is an approximation,
// since it's a general, not purpose-built, model, so its accuracy is
// limited. The right future step is to train a custom model (transfer
// learning) on real pollution photos collected from users — mentioned in
// the "Next Steps" section of README.md.
// ============================================================================

import dotenv from 'dotenv';
dotenv.config();

// Defensive .trim(): sometimes when you copy/paste the token in a text
// editor like Notepad, a stray space or blank line gets pasted along with
// it at the end of the value, and that alone is enough to make the token
// "look" wrong even if you copied it correctly. trim() removes any extra
// whitespace at the start or end.
const HF_API_KEY = (process.env.HUGGINGFACE_API_KEY || '').trim();
const HF_MODEL = 'microsoft/resnet-50';
// Note: Hugging Face changed their API URL in November 2025. The old URL
// (api-inference.huggingface.co) now returns a "no longer supported" error.
// The correct new URL goes through the "router":
const HF_ENDPOINT = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

// Every pollution category is linked to keywords from the ImageNet
// classifications (1000 classes) the model returns. Order matters: the
// first category whose keyword matches the top-ranked classification is
// the one used. Want to improve accuracy? Add/change keywords here.
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
 * Classifies a pollution image using a general image-classification model
 * (ResNet-50) via Hugging Face, then maps the result to the closest
 * pollution type we have based on keywords.
 * @param {Buffer} imageBuffer - bytes of the uploaded image
 * @returns {Promise<{pollutionType: string, confidence: number, rawLabels: object[]}>}
 */
export async function classifyPollutionImage(imageBuffer) {
  console.log('\n🔍 [AI DEBUG] ========== Starting classification of a new image ==========');

  // Step 1: does the token exist at all, and does its shape look reasonable?
  console.log('🔍 [AI DEBUG] 1) Checking HUGGINGFACE_API_KEY:');
  if (!HF_API_KEY) {
    console.warn('   ❌ The token is empty or missing from the .env file — make sure the line HUGGINGFACE_API_KEY=... exists and is filled in.');
    return fallbackResult('missing_api_key');
  }
  console.log(`   ✅ Present — length: ${HF_API_KEY.length} characters, first 6 characters: "${HF_API_KEY.slice(0, 6)}..."`);
  if (!HF_API_KEY.startsWith('hf_')) {
    console.warn('   ⚠️ Warning: a normal Hugging Face token should start with "hf_" — make sure you copied the full, correct token.');
  }

  // Step 2: prepare the image
  console.log('🔍 [AI DEBUG] 2) Uploaded image size (bytes):', imageBuffer.length);
  const base64Image = imageBuffer.toString('base64');
  console.log('🔍 [AI DEBUG] 3) URL we will send the request to:', HF_ENDPOINT);

  try {
    console.log('🔍 [AI DEBUG] 4) Sending the request to Hugging Face... (may take a few seconds)');
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

    console.log(`🔍 [AI DEBUG] 5) Got a response from Hugging Face — status: ${response.status}, ok: ${response.ok}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error('   ❌ Full error text from Hugging Face:', errText);

      if (response.status === 401 || response.status === 403) {
        console.error(
          '   👉 This is a permissions error (401/403): either the token is wrong, or its type is incorrect.\n' +
            '      Go to huggingface.co/settings/tokens and make sure this is exactly the new token\n' +
            '      (Fine-grained + the "Make calls to Inference Providers" permission enabled),\n' +
            '      and that you copied and pasted it into .env in full, with no quotes or extra spaces.'
        );
      }
      if (response.status === 503) {
        console.error('   👉 The model is loading for the first time ("cold start") — try uploading the image again in 10-20 seconds.');
      }
      if (response.status === 404) {
        console.error('   👉 404 error: make sure the model name in the code is correct (' + HF_MODEL + ') and the URL is correct.');
      }

      return fallbackResult(`http_${response.status}`);
    }

    const predictions = await response.json();
    console.log('🔍 [AI DEBUG] 6) Raw classification results from the model:', JSON.stringify(predictions, null, 2));
    // predictions look like: [{ label: "...", score: 0.83 }, ...] for the top 5 classifications

    const matched = matchCategory(predictions);
    console.log('🔍 [AI DEBUG] 7) Match result against the pollution type map:', matched);
    console.log('🔍 [AI DEBUG] ========== Classification finished ==========\n');

    return {
      pollutionType: matched ? matched.code : 'unknown',
      confidence: Number((matched ? matched.score : predictions[0]?.score ?? 0).toFixed(3)),
      rawLabels: predictions,
    };
  } catch (err) {
    console.error('   ❌ Exception while connecting to Hugging Face:', err.message);
    console.error('   👉 This usually means: no internet connection, the URL is wrong, or the service is temporarily down.');
    return fallbackResult('network_error');
  }
}

// Goes through the model's list of classifications (top_k) looking for the
// first matching keyword, and returns the linked pollution type along with
// the confidence score for that specific classification.
function matchCategory(predictions) {
  for (const category of CATEGORY_KEYWORDS) {
    for (const prediction of predictions) {
      const labelLower = prediction.label.toLowerCase();
      if (category.keywords.some((kw) => labelLower.includes(kw))) {
        return { code: category.code, score: prediction.score };
      }
    }
  }
  return null; // none of the model's classifications matched any keyword
}

// A fallback result for when we can't use the AI (instead of crashing the server)
function fallbackResult(reason) {
  return {
    pollutionType: 'unknown',
    confidence: 0,
    rawLabels: [{ note: `classification_unavailable: ${reason}` }],
  };
}
