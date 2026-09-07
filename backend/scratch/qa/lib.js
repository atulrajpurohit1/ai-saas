/* Shared helpers for the AegisLead QA E2E suite. */
const http = require('http');
const { PrismaClient } = require('@prisma/client');

const BASE = process.env.QA_BASE || 'http://127.0.0.1:5000/api';
// Keep the QA script's own DB footprint tiny so it doesn't starve the running
// server's Neon connection pool (Neon dev endpoint has a low connection cap).
function tunedUrl() {
  const u = process.env.DATABASE_URL || '';
  if (!u) return u;
  const sep = u.includes('?') ? '&' : '?';
  return u + `${sep}connection_limit=5&pool_timeout=60&connect_timeout=60`;
}
const prisma = new PrismaClient({ datasources: { db: { url: tunedUrl() } } });

/** Retry a Prisma op through Neon cold-start / pool timeouts (P2024/P2028/P2010). */
async function db(fn, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      const code = e && e.code;
      if (!['P2024', 'P2028', 'P2010', 'P2037'].includes(code)) throw e;
      await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
    }
  }
  throw last;
}

let PASS = 0, FAIL = 0;
const FAILURES = [];
const RESULTS = [];

function rec(name, ok, detail) {
  RESULTS.push({ name, ok, detail: detail || '' });
  if (ok) { PASS++; process.stdout.write(`  \x1b[32mPASS\x1b[0m ${name}\n`); }
  else { FAIL++; FAILURES.push({ name, detail }); process.stdout.write(`  \x1b[31mFAIL\x1b[0m ${name} :: ${detail}\n`); }
}

function section(t) { process.stdout.write(`\n\x1b[1m=== ${t} ===\x1b[0m\n`); }

/** Retry a request while it returns 5xx (Neon cold-start / P2028 transaction
 * timeouts surface as 500). Up to `tries` attempts with backoff. */
async function reqRetry(method, path, opts = {}, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    last = await req(method, path, opts);
    if (last.status !== 0 && last.status < 500) return last;
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  return last;
}

/** Low-level request. Returns {status, json, text, headers}. NEVER rejects —
 * a socket error / timeout resolves as {status:0} so the suite keeps going. */
function req(method, path, { token, body, raw, headers, timeoutMs = 60000 } = {}) {
  return new Promise((resolve) => {
    const url = new URL(path.startsWith('http') ? path : BASE + path);
    const h = { 'Accept': 'application/json', ...(headers || {}) };
    let payload;
    if (raw !== undefined) { payload = raw; }
    else if (body !== undefined) { payload = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (payload) h['Content-Length'] = Buffer.byteLength(payload);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: h };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch { /* not json */ }
        resolve({ status: res.statusCode, json, text: data, headers: res.headers });
      });
    });
    r.setTimeout(timeoutMs, () => { r.destroy(new Error('timeout')); });
    r.on('error', (e) => resolve({ status: 0, json: null, text: String(e && e.message || e), headers: {} }));
    if (payload) r.write(payload);
    r.end();
  });
}

/** multipart/form-data upload of a single file field + optional text fields. */
function uploadFile(method, path, { token, fieldName = 'file', filename, contentType, buffer, fields = {} }) {
  return new Promise((resolve) => {
    const url = new URL(BASE + path);
    const boundary = '----qa' + Math.random().toString(16).slice(2);
    const parts = [];
    for (const [k, v] of Object.entries(fields)) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    }
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`));
    parts.push(buffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const payload = Buffer.concat(parts);
    const h = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length,
      'Accept': 'application/json',
    };
    if (token) h['Authorization'] = `Bearer ${token}`;
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: h };
    const r = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(raw.toString()); } catch {}
        resolve({ status: res.statusCode, json, buffer: raw, text: raw.toString(), headers: res.headers });
      });
    });
    r.setTimeout(90000, () => { r.destroy(new Error('timeout')); });
    r.on('error', (e) => resolve({ status: 0, json: null, buffer: Buffer.alloc(0), text: String(e && e.message || e), headers: {} }));
    r.write(payload);
    r.end();
  });
}

// 1x1 PNG
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');
// tiny fake PDF
const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF', 'utf8');

module.exports = {
  BASE, prisma, db, req, reqRetry, uploadFile, rec, section, PNG_1PX, PDF_BYTES,
  summary: () => ({ PASS, FAIL, FAILURES, RESULTS }),
};
