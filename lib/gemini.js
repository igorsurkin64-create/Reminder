// Shared helpers for the Gemini-backed API endpoints (api/scan.js, api/chef.js)

const { rejectIfUnsafe } = require('./guard');

// Per-model timeout and total time budget (must stay below maxDuration in vercel.json
// and below the client-side fetch timeouts)
const REQUEST_TIMEOUT_MS = 12000;
const TOTAL_BUDGET_MS = 24000;

/**
 * Handles method check + origin/rate guard. Returns true if the request was already answered.
 * No CORS headers are sent: the API is meant to be called only by the app from the same origin.
 */
function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return true;
  }
  return rejectIfUnsafe(req, res);
}
function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body || {};
}

function resolveApiKey() {
  return (process.env.GEMINI_API_KEY || '').trim();
}

/** Extracts JSON from a model answer, tolerating ```json fences and surrounding text. */
function extractJson(text) {
  if (!text) return null;
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) { /* fall through */ }
    }
  }
  return null;
}

function isBillingError(err) {
  return !!err && (err.code === 402 || (err.message || '').includes('credits are depleted'));
}

function formatFriendlyGeminiError(lastError) {
  if (isBillingError(lastError)) {
    return 'У ключа Google AI исчерпан баланс (ошибка 402). Нужен ключ без биллинга (Google AI Studio -> Create API key).';
  }
  const msg = lastError?.message || '';
  if (msg.includes('API_KEY_INVALID') || lastError?.code === 400) {
    return 'Неверный ключ Google Gemini API. Проверьте настройки API ключа.';
  }
  if (msg.includes('high demand') || msg.includes('Spikes in demand') || msg.includes('overloaded') || lastError?.status === 503) {
    return 'Серверы Google сейчас испытывают пиковую нагрузку. Нажмите «Повторить попытку» через несколько секунд.';
  }
  if (lastError?.status === 429) {
    return 'Превышен лимит запросов в минуту. Пожалуйста, подождите несколько секунд и повторите.';
  }
  return 'Серверы распознавания временно перегружены. Пожалуйста, нажмите «Повторить попытку» через несколько секунд.';
}

/**
 * Calls Gemini with a model fallback cascade and automatic retry on 503/429 spikes.
 * @param {string[]} models candidate models, in priority order
 * @param {string} apiKey
 * @param {object} payload generateContent request body
 * @param {(parsed:any)=>boolean} [validate] result validator
 * @returns {Promise<{result:any, model:string|null, lastError:object|null}>}
 */
async function generateWithFallback(models, apiKey, payload, validate = () => true) {
  let lastError = null;
  const startedAt = Date.now();

  for (const model of models) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < 2500) break;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    // Attempt model call, with one internal retry on temporary 503/429 spikes
    for (let attempt = 0; attempt < 2; attempt++) {
      const budgetLeft = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (budgetLeft < 2000) break;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, budgetLeft));

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (response.ok) {
          const data = await response.json();
          const parsed = extractJson(data.candidates?.[0]?.content?.parts?.[0]?.text);
          if (parsed !== null && validate(parsed)) {
            return { result: parsed, model, lastError: null };
          }
          lastError = { status: 502, message: `Unparsable answer from ${model}` };
          break; // break retry loop, try next model
        }

        const errJson = await response.json().catch(() => ({}));
        const message = errJson.error?.message || `HTTP ${response.status}`;
        lastError = { status: response.status, message, code: errJson.error?.code || response.status };

        // Depleted billing: switching models on the same key won't help
        if (isBillingError(lastError)) return { result: null, model: null, lastError };

        // If high demand spike (503) or rate limit (429) on first attempt, sleep 850ms and retry once
        const isSpike = response.status === 503 || response.status === 429 ||
          message.includes('high demand') || message.includes('Spikes in demand');
        if (attempt === 0 && isSpike && (TOTAL_BUDGET_MS - (Date.now() - startedAt)) > 4000) {
          console.warn(`Model ${model} returned ${response.status} (demand spike), waiting 850ms before retry...`);
          await new Promise(r => setTimeout(r, 850));
          continue; // retry loop attempt 1
        }

        console.warn(`Model ${model} returned ${response.status}: ${message}. Trying fallback model...`);
        break; // break retry loop, try next model
      } catch (err) {
        lastError = { status: 504, message: err.message };
        console.warn(`Fetch error for model ${model}: ${err.message}. Trying fallback model...`);
        break; // break retry loop, try next model
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  return { result: null, model: null, lastError };
}

module.exports = {
  handlePreflight,
  parseBody,
  resolveApiKey,
  generateWithFallback,
  isBillingError,
  formatFriendlyGeminiError
};
