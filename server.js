const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') {
    reqPath = '/index.html';
  }

  // API endpoint to get network IP and URL for the phone
  if (reqPath === '/api/info') {
    const localIp = getLocalIp();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ip: localIp,
      port: PORT,
      phoneUrl: `http://${localIp}:${PORT}`
    }));
    return;
  }

  // CORS preflight for API
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // AI Vision OCR Proxy endpoint (reads handwriting via Gemini without asking users for keys)
  if (reqPath === '/api/scan' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        req.body = JSON.parse(body);
        const scanHandler = require('./api/scan.js');
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (data) => {
          res.writeHead(res.statusCode || 200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify(data));
        };
        scanHandler(req, res);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid JSON request' }));
      }
    });
    return;
  }

  // Yandex Cloud SpeechKit (Alice Voice) Proxy endpoint
  if (reqPath === '/api/tts/yandex' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { text, apiKey, folderId, emotion = 'good', voice = 'alena' } = data;

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'API key is required' }));
          return;
        }

        const https = require('https');
        const params = new URLSearchParams({
          text: text || 'Привет!',
          lang: 'ru-RU',
          voice: voice || 'alena',
          emotion: emotion || 'good',
          format: 'mp3'
        });
        if (folderId) {
          params.append('folderId', folderId);
        }

        const authHeader = apiKey.startsWith('AQVN') || !apiKey.includes('.')
          ? `Api-Key ${apiKey}`
          : `Bearer ${apiKey}`;

        const postData = params.toString();
        const options = {
          hostname: 'tts.api.cloud.yandex.net',
          port: 443,
          path: '/speech/v1/tts:synthesize',
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const proxyReq = https.request(options, proxyRes => {
          res.writeHead(proxyRes.statusCode, {
            'Content-Type': proxyRes.headers['content-type'] || 'audio/mpeg',
            'Access-Control-Allow-Origin': '*'
          });
          proxyRes.pipe(res);
        });

        proxyReq.on('error', err => {
          console.error('Yandex TTS proxy error:', err.message);
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        });

        proxyReq.write(postData);
        proxyReq.end();
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid JSON request' }));
      }
    });
    return;
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`🛒 Голосовой Список Покупок запущен!`);
  console.log(`💻 На компьютере:   http://localhost:${PORT}`);
  console.log(`📱 На телефоне:     http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);
});
