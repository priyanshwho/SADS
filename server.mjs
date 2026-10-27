import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATA_PATH || join(root, 'data', 'subscriptions.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS subscriptions (
  email TEXT PRIMARY KEY, interests TEXT NOT NULL, consent_at TEXT NOT NULL
)`);
const insert = db.prepare('INSERT OR IGNORE INTO subscriptions (email, interests, consent_at) VALUES (?, ?, ?)');
const interests = new Set(['giving', 'reuse', 'community']);
const maxBody = 4096;
const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']]
]);

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { status: 'ok' });
  if (req.method === 'POST' && pathname === '/api/subscriptions') {
    if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'Send JSON data.' });
    let chunks = [], size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBody) return json(res, 413, { error: 'Request is too large.' });
      chunks.push(chunk);
    }
    let data;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { return json(res, 400, { error: 'Enter valid signup details.' }); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json(res, 400, { error: 'Enter valid signup details.' });
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const selected = data.interests === undefined ? [] : data.interests;
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { field: 'email', error: 'Enter a valid email address.' });
    if (data.consent !== true) return json(res, 400, { field: 'consent', error: 'Please agree before signing up.' });
    if (!Array.isArray(selected) || selected.some(item => typeof item !== 'string' || !interests.has(item))) return json(res, 400, { field: 'interests', error: 'Choose only the listed interests.' });
    try {
      insert.run(email, JSON.stringify([...new Set(selected)]), new Date().toISOString());
      return json(res, 200, { message: 'Your subscription is saved.' });
    } catch {
      return json(res, 500, { error: 'We could not save your subscription. Please try again.' });
    }
  }
  const file = req.method === 'GET' && publicFiles.get(pathname);
  if (file) {
    res.writeHead(200, { 'Content-Type': file[1], 'X-Content-Type-Options': 'nosniff' });
    return res.end(readFileSync(join(root, 'public', file[0])));
  }
  json(res, 404, { error: 'Not found.' });
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`The Good Letter listening on ${server.address().port}`));
