// Tells the client which server-side features are configured (no secrets are returned).
const { isConfigured } = require('../lib/yandex');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    gemini: !!(process.env.GEMINI_API_KEY || '').trim(),
    tts: isConfigured()
  });
};
