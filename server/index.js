import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './store.js';
import { handleApi } from './api.js';
import { ValidationError, NotFoundError } from './validate.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIR = join(ROOT, 'web');
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 1_000_000; // 1 MB

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

export function createApp(db = getDb()) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);

      if (pathname.startsWith('/api/')) {
        await handleApiRequest(db, req, res, url, pathname);
        return;
      }
      await serveStatic(res, pathname);
    } catch (err) {
      sendError(res, err);
    }
  });
}

async function handleApiRequest(db, req, res, url, pathname) {
  const segments = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const query = Object.fromEntries(url.searchParams.entries());
  const method = req.method.toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  let body = null;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
    body = await readJsonBody(req);
  } else if (method === 'DELETE') {
    body = await readJsonBody(req).catch(() => null);
  }

  try {
    const result = handleApi(db, { method, segments, query, body });
    sendJson(res, result.status, result.body);
  } catch (err) {
    sendError(res, err);
  }
}

function readJsonBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        const err = new Error('Request body too large');
        err.statusCode = 413;
        req.destroy();
        rejectPromise(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) { resolvePromise({}); return; }
      try {
        resolvePromise(JSON.parse(raw));
      } catch {
        const err = new Error('Request body must be valid JSON');
        err.statusCode = 400;
        rejectPromise(err);
      }
    });
    req.on('error', rejectPromise);
  });
}

async function serveStatic(res, pathname) {
  // Client-side routes (/themes/12) must still return the app shell.
  let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = join(WEB_DIR, normalize(relative));

  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  let found = await isFile(filePath);
  if (!found && !extname(relative)) {
    filePath = join(WEB_DIR, 'index.html');
    found = await isFile(filePath);
  }
  if (!found) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const data = await readFile(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  res.end(data);
}

async function isFile(path) {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.RCM_CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sendJson(res, status, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    ...corsHeaders(),
  });
  res.end(data);
}

function sendError(res, err) {
  const status = err.statusCode || 500;
  if (status >= 500) console.error('[rcm]', err);
  const payload = { error: err.message || 'Internal server error' };
  if (err instanceof ValidationError) payload.fields = err.errors;
  if (err instanceof NotFoundError) payload.error = err.message;
  if (res.headersSent) { res.end(); return; }
  sendJson(res, status, payload);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const server = createApp();
  server.listen(PORT, HOST, () => {
    console.log(`Recurrent Complaints Management platform running at http://localhost:${PORT}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
