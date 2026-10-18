#!/usr/bin/env node
/* Gharkul local test server: zero dependencies. Run:  node server.js
   Serves the website AND a small API so every phone/laptop on your Wi-Fi sees the same data.
   For testing only. Data is stored in ./data  (db.json + uploads/) */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const ROOT = __dirname, DATA = path.join(ROOT, 'data'), UP = path.join(DATA, 'uploads'), DBF = path.join(DATA, 'db.json');
const PORT = +process.env.PORT || 3000;
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'owner@gharkul.demo').toLowerCase();
const OWNER_PASS = process.env.OWNER_PASSWORD || 'owner123';
fs.mkdirSync(UP, { recursive: true });

// ---------- owner password (scrypt, constant-time compare) ----------
const salt = crypto.randomBytes(16);
const hash = p => crypto.scryptSync(String(p), salt, 32);
const OWNER_HASH = hash(OWNER_PASS);
const passOK = p => crypto.timingSafeEqual(hash(p), OWNER_HASH);

// ---------- data ----------
function ph(a, b, t) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='560'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='800' height='560' fill='url(#g)'/><g fill='none' stroke='white' stroke-opacity='.7' stroke-width='10' stroke-linejoin='round'><path d='M280 330 L400 230 L520 330 V420 H280 Z'/><path d='M370 420 V350 H430 V420'/></g><text x='400' y='490' text-anchor='middle' font-family='sans-serif' font-size='30' fill='white' fill-opacity='.85'>${t}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
const seed = () => ({
  properties: [
    { id: 'p1', title: 'Luxury 2 BHK Apartment', type: 'residential', transaction: 'sale', price: 18500000, location: 'Bandra East, Mumbai', beds: 2, baths: 2, area: 950, ownerName: '', ownerPhone: '', description: 'Sample listing. Replace it from the owner dashboard.', images: [ph('#2f6f4f', '#16263d', 'Sample photo')], createdAt: 3 },
    { id: 'p2', title: 'Sea-View 3 BHK Residence', type: 'residential', transaction: 'sale', price: 32000000, location: 'Khar West, Mumbai', beds: 3, baths: 3, area: 1450, ownerName: '', ownerPhone: '', description: 'Sample listing.', images: [ph('#355c7d', '#0e1a2b', 'Sample photo')], createdAt: 2 },
    { id: 'p3', title: 'Compact 1 BHK for Rent', type: 'residential', transaction: 'rent', price: 38000, location: 'Andheri East, Mumbai', beds: 1, baths: 1, area: 520, ownerName: '', ownerPhone: '', description: 'Sample listing.', images: [ph('#8a5a44', '#2b1d16', 'Sample photo')], createdAt: 1 }
  ],
  announcements: [
    { id: 'a1', title: 'Ganesh Chaturthi Office Hours', category: 'Festival', date: '2026-08-12', text: 'Our Bandra East office will observe modified hours during the festival week. Site visits remain available on prior appointment.', image: ph('#2f6f4f', '#16263d', 'Festival notice'), createdAt: 3 },
    { id: 'a2', title: '31 Years of Gharkul', category: 'Company', date: '2026-08-02', text: "We're proud to mark 31 years of helping Mumbai families and businesses find the right property. Thank you for your continued trust.", image: ph('#355c7d', '#0e1a2b', 'Gharkul'), createdAt: 2 }
  ],
  appointments: [], audit: []
});
let db = null;
try { db = JSON.parse(fs.readFileSync(DBF, 'utf8')); } catch (e) {}
if (!db) { db = seed(); persist(); }
function persist() { fs.writeFileSync(DBF + '.tmp', JSON.stringify(db)); fs.renameSync(DBF + '.tmp', DBF); }
const audit = (action, detail, email) => { db.audit.push({ action, detail: String(detail || '').slice(0, 200), email: email || '', at: Date.now() }); db.audit = db.audit.slice(-500); persist(); };

// ---------- two-factor authentication (TOTP, RFC 6238: works with Google/Microsoft Authenticator, Authy, 1Password) ----------
const MFA_FILE = path.join(DATA, '2fa.json'), MFA_ON = process.env.OWNER_2FA !== 'off';
let mfa = null; try { mfa = JSON.parse(fs.readFileSync(MFA_FILE, 'utf8')); } catch (e) {}
const saveMfa = () => fs.writeFileSync(MFA_FILE, JSON.stringify(mfa), { mode: 0o600 });
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32enc = buf => { let bits = '', out = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; };
const b32dec = str => { let bits = ''; for (const c of str.replace(/=+$/, '')) bits += B32.indexOf(c).toString(2).padStart(5, '0'); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
function hotp(key, counter) {
  const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(b).digest(), o = h[19] & 15;
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}
let lastStep = (mfa && mfa.lastStep) || 0;     // a code can be used only once (replay protection)
function totpOK(secretB32, code) {
  if (!/^\d{6}$/.test(code)) return false;
  const key = b32dec(secretB32), step = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) {                // allows 30 s clock drift
    if (crypto.timingSafeEqual(Buffer.from(hotp(key, step + d)), Buffer.from(code)) && step + d > lastStep) { lastStep = step + d; if (mfa) { mfa.lastStep = lastStep; saveMfa(); } return true; }
  }
  return false;
}
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const pending = new Map();                     // password OK, waiting for 2FA code: token -> { email, exp, tries, secret|null }

// ---------- sessions & throttling ----------
const sessions = new Map();           // token -> { email, exp }
const fails = new Map();              // ip -> { n, until }
const hits = new Map();               // ip -> [timestamps] for public appointment posts
const parseCookies = h => Object.fromEntries((h || '').split(';').map(c => c.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => [k, v.join('=')]));
function sessionOf(req) {
  const t = parseCookies(req.headers.cookie).sid, s = t && sessions.get(t);
  if (!s) return null; if (Date.now() > s.exp) { sessions.delete(t); return null; } return { ...s, token: t };
}

// ---------- helpers ----------
const json = (res, code, obj, extra) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(extra || {}) }); res.end(JSON.stringify(obj)); };
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Request too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('Bad JSON'), { code: 400 })); } });
  });
}
const str = (v, max, min = 0) => typeof v === 'string' && v.length <= max && v.length >= min;
const num = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
function cleanProperty(b) {
  if (!b || !str(b.title, 90, 1) || !['residential', 'commercial'].includes(b.type) || !['sale', 'rent'].includes(b.transaction) || !num(b.price, 0, 1e12) ||
      !str(b.location, 90) || !num(b.beds, 0, 50) || !num(b.baths, 0, 50) || !num(b.area, 0, 1e7) || !str(b.ownerName || '', 60) || !str(b.ownerPhone || '', 20) ||
      !str(b.description || '', 1500) || !Array.isArray(b.images) || b.images.length < 1 || b.images.length > 10 ||
      !b.images.every(u => typeof u === 'string' && (/^\/uploads\/[a-f0-9]{16}\.(jpg|png|webp)$/.test(u) || /^data:image\/svg\+xml/.test(u) && u.length < 20000))) return null;
  return { title: b.title, type: b.type, transaction: b.transaction, price: b.price, location: b.location, beds: b.beds, baths: b.baths, area: b.area, ownerName: b.ownerName || '', ownerPhone: b.ownerPhone || '', description: b.description || '', images: b.images };
}
function cleanAnnouncement(b) {
  if (!b || !str(b.title, 90, 1) || !['Festival', 'Company', 'Property', 'Notice'].includes(b.category) || !str(b.date, 10) || !str(b.text, 1200, 1) ||
      !(b.image === '' || b.image == null || (typeof b.image === 'string' && (/^\/uploads\/[a-f0-9]{16}\.(jpg|png|webp)$/.test(b.image) || /^data:image\/svg\+xml/.test(b.image) && b.image.length < 20000)))) return null;
  return { title: b.title, category: b.category, date: b.date, text: b.text, image: b.image || '' };
}
function cleanAppointment(b) {
  if (!b || !str(b.name, 80, 1) || !str(b.phone, 15, 10) || !/^[0-9+]+$/.test(b.phone) || !str(b.propertyId || '', 40) || !str(b.propertyTitle || '', 120) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || !str(b.time, 10, 1)) return null;
  return { propertyId: b.propertyId || '', propertyTitle: b.propertyTitle || '', name: b.name, phone: b.phone, date: b.date, time: b.time, status: 'new' };
}
const newId = () => crypto.randomBytes(6).toString('hex');
const sortDesc = a => a.slice().sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));

function startSession(res, email, recovery) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { email, exp: Date.now() + 8 * 3600000 });
  return json(res, 200, { ok: true, next: 'done', recovery: recovery || undefined },
    { 'Set-Cookie': [`sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`, 'pre=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'] });
}

// ---------- API ----------
async function api(req, res, p) {
  const ip = req.socket.remoteAddress, me = sessionOf(req), method = req.method;
  if (p === '/api/ping') return json(res, 200, { gharkul: true });
  if (p === '/api/me') return json(res, 200, { owner: !!me });

  if (method !== 'GET') {   // CSRF defence: same-origin only + JSON only
    const o = req.headers.origin;
    if (o) { let h = ''; try { h = new URL(o).host; } catch (e) {} if (h !== req.headers.host) return json(res, 403, { error: 'Forbidden' }); }
    if (method === 'POST' && !/^application\/json/.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'JSON only' });
  }

  if (p === '/api/login' && method === 'POST') {
    const f = fails.get(ip) || { n: 0, until: 0 };
    if (Date.now() < f.until) return json(res, 429, { error: 'Too many attempts. Try again later.' });
    const b = await readBody(req, 4096);
    const ok = str(b.email, 200) && str(b.password, 200) && String(b.email).trim().toLowerCase() === OWNER_EMAIL & passOK(b.password);   // & (not &&) on purpose: no early exit
    if (!ok) { f.n++; if (f.n >= 5) { f.n = 0; f.until = Date.now() + 15 * 60000; } fails.set(ip, f); audit('login.failed', ip, ''); return json(res, 401, { error: 'Invalid email or password.' }); }
    if (!MFA_ON) { fails.delete(ip); audit('login', 'ok (2FA off)', OWNER_EMAIL); return startSession(res, OWNER_EMAIL); }
    const pt = crypto.randomBytes(24).toString('hex'), secret = mfa ? null : b32enc(crypto.randomBytes(20));
    pending.set(pt, { email: OWNER_EMAIL, exp: Date.now() + 10 * 60000, tries: 0, secret });
    audit('login.password-ok', 'waiting for 2FA code', OWNER_EMAIL);
    return json(res, 200, mfa ? { next: 'code' } : { next: 'setup', secret, otpauth: `otpauth://totp/Gharkul%20Owner:${encodeURIComponent(OWNER_EMAIL)}?secret=${secret}&issuer=Gharkul%20Owner` },
      { 'Set-Cookie': `pre=${pt}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=600` });
  }
  if (p === '/api/2fa/verify' && method === 'POST') {
    const pre = parseCookies(req.headers.cookie).pre, pe = pre && pending.get(pre);
    if (!pe || Date.now() > pe.exp) { pending.delete(pre); return json(res, 401, { error: 'Session expired. Sign in again.', expired: true }); }
    const b = await readBody(req, 1024), code = String(b.code || '').replace(/[\s-]/g, '').toLowerCase();
    let ok = false, recovery = null;
    if (pe.secret) {                           // first login: enrolling the authenticator app
      if (totpOK(pe.secret, code)) {
        ok = true; recovery = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex'));
        mfa = { secret: pe.secret, recovery: recovery.map(sha), lastStep }; saveMfa();
        recovery = recovery.map(c => c.slice(0, 4) + '-' + c.slice(4));
      }
    } else if (/^\d{6}$/.test(code)) ok = totpOK(mfa.secret, code);
    else { const i = mfa.recovery.indexOf(sha(code)); if (i >= 0) { mfa.recovery.splice(i, 1); saveMfa(); ok = true; audit('login.recovery-code-used', (mfa.recovery.length) + ' left', pe.email); } }
    if (!ok) {
      pe.tries++; audit('login.2fa-failed', ip, pe.email);
      if (pe.tries >= 5) { pending.delete(pre); fails.set(ip, { n: 0, until: Date.now() + 15 * 60000 }); return json(res, 429, { error: 'Too many wrong codes. Locked for 15 minutes.', expired: true }); }
      return json(res, 401, { error: 'Invalid code.' });
    }
    pending.delete(pre); fails.delete(ip); audit('login', pe.secret ? '2FA enrolled + ok' : '2FA ok', pe.email);
    return startSession(res, pe.email, recovery);
  }
  if (p === '/api/logout' && method === 'POST') {
    if (me) { audit('logout', '', me.email); sessions.delete(me.token); }
    return json(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (p === '/api/audit' && method === 'GET') { if (!me) return json(res, 401, { error: 'Sign in required' }); return json(res, 200, db.audit.slice(-100).reverse()); }

  if (p === '/api/upload' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in required' });
    const b = await readBody(req, 5 * 1024 * 1024);
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.dataUrl || '');
    if (!m) return json(res, 400, { error: 'Only JPEG, PNG or WebP images are allowed.' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 3 * 1024 * 1024) return json(res, 413, { error: 'Image is larger than 3 MB.' });
    const magic = { jpeg: buf.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), png: buf.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), webp: buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP' };
    if (!magic[m[1]]) return json(res, 400, { error: 'File content does not match an image.' });
    const name = crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
    fs.writeFileSync(path.join(UP, name), buf);
    return json(res, 200, { url: '/uploads/' + name });
  }

  const m = /^\/api\/(properties|announcements|appointments)(?:\/([\w-]+))?$/.exec(p);
  if (!m) return json(res, 404, { error: 'Not found' });
  const coll = m[1], id = m[2];

  if (method === 'GET' && !id) {
    if (coll === 'appointments' && !me) return json(res, 401, { error: 'Sign in required' });
    return json(res, 200, sortDesc(db[coll]));
  }
  if (method === 'POST' && !id) {
    if (coll === 'appointments') {                       // public, validated, rate-limited
      const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 3600000);
      if (arr.length >= 10) return json(res, 429, { error: 'Too many requests. Please call us.' });
      const rec = cleanAppointment(await readBody(req, 8192));
      if (!rec) return json(res, 400, { error: 'Invalid details.' });
      arr.push(now); hits.set(ip, arr);
      const out = { ...rec, id: newId(), createdAt: now }; db.appointments.push(out); persist();
      return json(res, 200, { id: out.id });
    }
    if (!me) return json(res, 401, { error: 'Sign in required' });
    const b = await readBody(req, 1024 * 1024);
    const rec = (coll === 'properties' ? cleanProperty : cleanAnnouncement)(b);
    if (!rec) return json(res, 400, { error: 'Some fields are missing or invalid.' });
    const idx = b.id ? db[coll].findIndex(x => x.id === b.id) : -1;
    if (idx >= 0) { db[coll][idx] = { ...rec, id: b.id, createdAt: db[coll][idx].createdAt }; audit(coll.slice(0, -1) + '.update', rec.title, me.email); persist(); return json(res, 200, { id: b.id }); }
    const out = { ...rec, id: newId(), createdAt: Date.now() }; db[coll].push(out);
    audit(coll.slice(0, -1) + '.create', rec.title, me.email); persist(); return json(res, 200, { id: out.id });
  }
  if (method === 'DELETE' && id) {
    if (!me) return json(res, 401, { error: 'Sign in required' });
    db[coll] = db[coll].filter(x => x.id !== id); audit(coll.slice(0, -1) + '.delete', id, me.email); persist(); return json(res, 200, { ok: true });
  }
  return json(res, 405, { error: 'Method not allowed' });
}

// ---------- static files ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const BLOCK = /^\/(data|scripts|server\.js|firebase\.json|firestore\.rules|storage\.rules|start-server|\.)|\.md$|serviceAccountKey|\/\./i;
function serveStatic(req, res, p) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let file;
  if (p.startsWith('/uploads/')) {
    const n = p.slice(9); if (!/^[a-f0-9]{16}\.(jpg|png|webp)$/.test(n)) { res.writeHead(404); return res.end('Not found'); }
    file = path.join(UP, n);
  } else {
    if (p === '/') p = '/index.html';
    if (BLOCK.test(p)) { res.writeHead(404); return res.end('Not found'); }
    file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end('Not found'); }
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.startsWith('/api/')) return await api(req, res, p);
    serveStatic(req, res, p);
  } catch (e) { if (!res.headersSent) json(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { error: e.code ? e.message : 'Server error' }); }
}).listen(PORT, '0.0.0.0', () => {
  console.log('\nGharkul test server is running.\n');
  console.log('  On this laptop:   http://localhost:' + PORT);
  for (const l of Object.values(os.networkInterfaces()).flat()) if (l && l.family === 'IPv4' && !l.internal) console.log('  Phones / laptops on the same Wi-Fi:   http://' + l.address + ':' + PORT);
  console.log('\n  Two-factor login: ' + (MFA_ON ? (mfa ? 'ON (authenticator enrolled)' : 'ON - you will set up your authenticator app at the first owner login') : 'OFF (OWNER_2FA=off)'));
  console.log('\n  Owner page:  /owner.html    (login: ' + OWNER_EMAIL + (process.env.OWNER_PASSWORD ? ' / your OWNER_PASSWORD' : ' / owner123  <- default, TEST ONLY') + ')');
  console.log('  Press Ctrl+C to stop.\n');
});
