// ============================================================================
// aiClassifier.js
// ----------------------------------------------------------------------------
// This is where the AI classification of the pollution type in the image happens.
//
// We use the "microsoft/resnet-50" model on Hugging Face — a well-known
// model that's freely and permanently available, but it's trained on a
// general classification of 1000 object/scene types (ImageNet), not
// trained specifically on "pollution".
//
// To connect its general classifications to our pollution types, we build
// a "keyword map" (CATEGORY_KEYWORDS below): if the model returns a
// classification containing a word like "ashcan" (trash can) or "volcano"
// (volcano/smoke), we map it to the matching pollution type.
//
// Note for the report, to be upfront about it: this is an approximation,
// since it's a general, not purpose-built, model, so its accuracy is
// limited. The right future step is to train a custom model (transfer
// learning) on real pollution photos collected from users.
//
// Fix (this revision): the Hugging Face Inference API for an
// image-classification model expects the RAW image bytes as the request
// body (with Content-Type set to the image's mime type), not a JSON
// envelope with the image re-encoded as base64 text. Sending JSON here was
// the bug that made classification silently fail / always fall back to
// "unknown" even for images the model should recognize.
// ============================================================================

import dotenv from 'dotenv';
dotenv.config();

const HF_API_KEY = (process.env.HUGGINGFACE_API_KEY || '').trim();
const HF_MODEL = 'microsoft/resnet-50';
// Hugging Face changed their API URL in November 2025. The old URL
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
 * @param {string} [mimeType] - the uploaded file's mime type (e.g. "image/jpeg")
 * @returns {Promise<{pollutionType: string, confidence: number, rawLabels: object[]}>}
 */
export async function classifyPollutionImage(imageBuffer, mimeType = 'application/octet-stream') {
  if (!HF_API_KEY) {
    console.warn('[AI] HUGGINGFACE_API_KEY is missing from .env — classification skipped.');
    return fallbackResult('missing_api_key');
  }
  if (!HF_API_KEY.startsWith('hf_')) {
    console.warn('[AI] Warning: HUGGINGFACE_API_KEY does not start with "hf_" — double-check the token.');
  }

  try {
    const response = await fetch(HF_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        // The HF Inference API expects the raw image bytes with the
        // image's own content type — not a JSON body.
        'Content-Type': mimeType,
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[AI] Hugging Face returned ${response.status}:`, errText.slice(0, 500));

      if (response.status === 401 || response.status === 403) {
        console.error(
          '[AI] Permissions error: either the token is wrong, or its type is incorrect. ' +
            'Go to huggingface.co/settings/tokens and make sure it is a Fine-grained token ' +
            'with "Make calls to Inference Providers" enabled.'
        );
      }
      if (response.status === 503) {
        console.error('[AI] The model is loading for the first time ("cold start") — try again in 10-20 seconds.');
      }
      if (response.status === 404) {
        console.error(`[AI] 404 error: check the model name (${HF_MODEL}) and endpoint URL.`);
      }

      return fallbackResult(`http_${response.status}`);
    }

    const predictions = await response.json();
    // predictions look like: [{ label: "...", score: 0.83 }, ...] for the top 5 classifications

    const matched = matchCategory(predictions);

    return {
      pollutionType: matched ? matched.code : 'unknown',
      confidence: Number((matched ? matched.score : predictions[0]?.score ?? 0).toFixed(3)),
      rawLabels: predictions,
    };
  } catch (err) {
    console.error('[AI] Exception while connecting to Hugging Face:', err.message);
    console.error('[AI] This usually means: no internet connection, the URL is wrong, or the service is temporarily down.');
    return fallbackResult('network_error');
  }
}

// Goes through the model's list of classifications (top_k) looking for the
// first matching keyword, and returns the linked pollution type along with
// the confidence score for that specific classification.
function matchCategory(predictions) {
  if (!Array.isArray(predictions)) return null;
  for (const category of CATEGORY_KEYWORDS) {
    for (const prediction of predictions) {
      const labelLower = (prediction.label || '').toLowerCase();
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
