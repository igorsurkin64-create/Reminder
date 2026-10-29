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

/**
 * Calls Gemini with a model fallback cascade.
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
    if (remaining < 2000) break;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, remaining));

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
        continue;
      }

      const errJson = await response.json().catch(() => ({}));
      const message = errJson.error?.message || `HTTP ${response.status}`;
      lastError = { status: response.status, message, code: errJson.error?.code || response.status };
      console.warn(`Model ${model} returned ${response.status}: ${message}. Trying fallback model...`);

      // Depleted billing: switching models on the same key won't help
      if (isBillingError(lastError)) break;
    } catch (err) {
      lastError = { status: 504, message: err.message };
      console.warn(`Fetch error for model ${model}: ${err.message}. Trying fallback model...`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { result: null, model: null, lastError };
}

module.exports = {
  handlePreflight,
  parseBody,
  resolveApiKey,
  generateWithFallback,
  isBillingError
};
