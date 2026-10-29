// Request guard shared by all API endpoints: same-origin check + simple rate limiting.
// API keys live only on the server, so the endpoints must not be usable by arbitrary websites
// (no wildcard CORS) and must not allow unlimited calls that burn the key's quota.

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

const hits = new Map(); // ip -> { count, resetAt }

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(req) {
  const now = Date.now();
  const ip = clientIp(req);

  // Opportunistic cleanup so the map cannot grow forever
  if (hits.size > 1000) {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }

  let entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    hits.set(ip, entry);
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

/** Browsers always send Origin on cross-origin POSTs; it must match our own host. */
function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin GET or non-browser client (still rate limited)
  try {
    return new URL(origin).host === req.headers.host;
  } catch (e) {
    return false;
  }
}

/**
 * Returns true (and answers the request) if it must be rejected.
 * `res` must support status().json().
 */
function rejectIfUnsafe(req, res) {
  if (!isSameOrigin(req)) {
    res.status(403).json({ error: 'Forbidden origin' });
    return true;
  }
  if (isRateLimited(req)) {
    res.setHeader('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
    res.status(429).json({ error: 'Слишком много запросов. Подождите минуту и повторите.' });
    return true;
  }
  return false;
}

module.exports = { rejectIfUnsafe };
