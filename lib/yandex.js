// Yandex SpeechKit (Alice voice) proxy. The API key is read from server environment only.

const { rejectIfUnsafe } = require('./guard');
const { parseBody } = require('./gemini');

const MAX_TEXT_LENGTH = 500;
const ALLOWED_EMOTIONS = new Set(['good', 'neutral', 'evil']);
const ALLOWED_VOICES = new Set(['alena', 'filipp', 'ermil', 'jane', 'madirus', 'omazh', 'zahar']);
const TIMEOUT_MS = 8000;

function isConfigured() {
  return !!(process.env.YANDEX_API_KEY || '').trim();
}

function authHeader(key) {
  // IAM tokens contain dots; API keys do not
  return key.startsWith('AQVN') || !key.includes('.') ? `Api-Key ${key}` : `Bearer ${key}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (rejectIfUnsafe(req, res)) return;

  const apiKey = (process.env.YANDEX_API_KEY || '').trim();
  if (!apiKey) {
    res.status(503).json({ error: 'YANDEX_API_KEY не задан на сервере' });
    return;
  }

  const { text, emotion, voice } = parseBody(req);
  const cleanText = typeof text === 'string' ? text.trim().slice(0, MAX_TEXT_LENGTH) : '';
  if (!cleanText) {
    res.status(400).json({ error: 'Пустой текст' });
    return;
  }

  const params = new URLSearchParams({
    text: cleanText,
    lang: 'ru-RU',
    voice: ALLOWED_VOICES.has(voice) ? voice : 'alena',
    emotion: ALLOWED_EMOTIONS.has(emotion) ? emotion : 'good',
    format: 'mp3'
  });
  const folderId = (process.env.YANDEX_FOLDER_ID || '').trim();
  if (folderId) params.append('folderId', folderId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: {
        'Authorization': authHeader(apiKey),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString(),
      signal: controller.signal
    });

    if (!response.ok) {
      console.warn('Yandex TTS returned', response.status);
      res.status(502).json({ error: `Yandex TTS error ${response.status}` });
      return;
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Content-Length', audio.length);
    res.statusCode = 200;
    res.end(audio);
  } catch (err) {
    console.error('Yandex TTS proxy error:', err.message);
    res.status(502).json({ error: 'Yandex TTS недоступен' });
  } finally {
    clearTimeout(timeoutId);
  }
};

module.exports.isConfigured = isConfigured;
