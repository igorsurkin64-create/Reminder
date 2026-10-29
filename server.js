const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Minimal .env loader (no dependencies). Real environment variables take precedence.
function loadEnvFile(file) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return;
  }
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadEnvFile(path.join(__dirname, '.env'));
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MAX_BODY_BYTES = 15 * 1024 * 1024; // photos are sent as base64

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

// Only these locations are served as static files (never server code, .git, package.json, etc.)
const PUBLIC_FILES = new Set(['index.html', 'sw.js', 'manifest.json']);
const PUBLIC_DIRS = ['css', 'js', 'icons'];

// Sent with every response. The app is same-origin only, so no CORS headers are emitted.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'microphone=(self), camera=(self), geolocation=()'
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

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS });
  res.end(JSON.stringify(data));
}

/** Reads the request body (size-limited) and parses it as JSON. */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(Object.assign(new Error('Invalid JSON request'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/** Adapts a Vercel-style handler (req.body, res.status().json()) to plain node http. */
function vercelRoute(handler) {
  return async (req, res) => {
    if (req.method === 'POST') {
      try {
        req.body = await readJsonBody(req);
      } catch (e) {
        sendJson(res, e.statusCode || 400, { error: e.message });
        return;
      }
    }
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => sendJson(res, res.statusCode || 200, data);
    try {
      await handler(req, res);
    } catch (e) {
      console.error('Handler error:', e);
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
    }
  };
}

const apiRoutes = {
  '/api/scan': vercelRoute(require('./api/scan.js')),
  '/api/chef': vercelRoute(require('./api/chef.js')),
  '/api/tts/yandex': vercelRoute(require('./lib/yandex.js')),
  '/api/config': vercelRoute(require('./api/config.js'))
};

function isPublicPath(relPath) {
  const parts = relPath.split(path.sep);
  if (parts.length === 1) return PUBLIC_FILES.has(parts[0]);
  return PUBLIC_DIRS.includes(parts[0]);
}

function serveStatic(reqPath, res) {
  let decoded;
  try {
    decoded = decodeURIComponent(reqPath);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request');
    return;
  }

  const filePath = path.resolve(ROOT, '.' + decoded);
  const relPath = path.relative(ROOT, filePath);

  // Reject anything outside the project root or outside the public whitelist
  if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath) || !isPublicPath(relPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...SECURITY_HEADERS
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0];

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, SECURITY_HEADERS);
    res.end();
    return;
  }

  // Network IP and URL for the phone
  if (reqPath === '/api/info') {
    const localIp = getLocalIp();
    sendJson(res, 200, { ip: localIp, port: PORT, phoneUrl: `http://${localIp}:${PORT}` });
    return;
  }

  const route = apiRoutes[reqPath];
  if (route) {
    route(req, res);
    return;
  }

  serveStatic(reqPath === '/' ? '/index.html' : reqPath, res);
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`🛒 Голосовой Список Покупок запущен!`);
  console.log(`💻 На компьютере:   http://localhost:${PORT}`);
  console.log(`📱 На телефоне:     http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);
});
