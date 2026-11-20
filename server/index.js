/*
 * clipZ API server — zero dependencies (Node 18+).
 *   POST /api/<method>   JSON body = params, "Authorization: Bearer <token>"
 *   everything else      static files from ../web
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Core = require('../web/js/core.js');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const WEB_DIR = path.join(__dirname, '..', 'web');
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const TOKEN_TTL = 7 * 86400000;

fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- persistence: JSON file, atomic writes ---------- */
let db = Core.emptyDb();
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
let saveTimer = null;
function flush() {
  saveTimer = null;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
const save = () => { if (!saveTimer) saveTimer = setTimeout(flush, 150); };

/* ---------- secrets, passwords, tokens ---------- */
if (!db.secret) db.secret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const SECRET = process.env.JWT_SECRET || db.secret;

function hash(pw) {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function verify(pw, stored) {
  const [, salt, key] = String(stored).split('$');
  if (!salt || !key) return false;
  const got = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 32);
  const want = Buffer.from(key, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (body) => crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
function makeToken(userId) {
  const body = b64(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL }));
  return body + '.' + sign(body);
}
function readToken(header) {
  const m = /^Bearer (.+)\.(.+)$/.exec(header || '');
  if (!m) return null;
  const want = Buffer.from(sign(m[1])), got = Buffer.from(m[2]);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(m[1], 'base64url').toString());
    return p.exp > Date.now() ? p.uid : null;
  } catch (e) { return null; }
}

const core = Core.createCore(db, { hash, verify, save });
if (core.seed()) console.log('Seeded demo data (accounts: clipper@ / brand@ / admin@clipz.demo, password demo1234)');
flush();

// Optional simulated view growth so the demo feels alive.
if (process.env.SIMULATE_VIEWS === '1') setInterval(() => { core.syncViews(); save(); }, 60000);

/* ---------- basic login throttling ---------- */
const attempts = new Map();
function throttled(ip) {
  const t = Date.now(), a = (attempts.get(ip) || []).filter((x) => t - x < 60000);
  a.push(t); attempts.set(ip, a);
  return a.length > 20;
}

/* ---------- http ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 100000) { reject(new Core.ApiError('Request too large', 413)); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { reject(new Core.ApiError('Invalid JSON', 400)); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'POST') return json(res, 405, { error: 'Use POST' });
    const method = url.pathname.slice(5);
    try {
      if ((method === 'login' || method === 'signup') && throttled(req.socket.remoteAddress)) throw new Core.ApiError('Too many attempts, try again in a minute', 429);
      const params = await readBody(req);
      const out = core.call(method, readToken(req.headers.authorization), params);
      if (method === 'login' || method === 'signup') out.token = makeToken(out.user.id);
      return json(res, 200, out);
    } catch (e) {
      if (e instanceof Core.ApiError) return json(res, e.status, { error: e.message });
      console.error(e);
      return json(res, 500, { error: 'Server error' });
    }
  }

  // The served frontend talks to this server instead of the in-browser demo store.
  if (url.pathname === '/js/config.js') {
    res.writeHead(200, { 'Content-Type': MIME['.js'] });
    return res.end("window.CLIPZ_API_URL = '/api';\n");
  }
  let file = path.normalize(path.join(WEB_DIR, decodeURIComponent(url.pathname)));
  if (!file.startsWith(WEB_DIR)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_DIR, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => console.log('clipZ running on http://localhost:' + PORT));
process.on('SIGTERM', () => { if (saveTimer) flush(); process.exit(0); });
process.on('SIGINT', () => { if (saveTimer) flush(); process.exit(0); });
