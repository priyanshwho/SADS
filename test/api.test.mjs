import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { once } from 'node:events';

async function start(path) {
  const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0', DATA_PATH: path }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for await (const chunk of child.stdout) {
    output += chunk;
    const match = output.match(/listening on (\d+)/);
    if (match) return { child, url: `http://127.0.0.1:${match[1]}` };
  }
  throw new Error(`Server failed to start: ${output}`);
}
async function stop(child) { child.kill(); await once(child, 'exit'); }
async function post(url, body, contentType = 'application/json') {
  const response = await fetch(`${url}/api/subscriptions`, { method: 'POST', headers: { 'content-type': contentType }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

test('signup API validates, deduplicates and persists subscriptions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'good-letter-'));
  const path = join(dir, 'data.sqlite');
  let server;
  try {
    server = await start(path);
    const health = await fetch(`${server.url}/api/health`);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const signup = await post(server.url, { email: '  Person@Example.com ', consent: true, interests: ['reuse', 'giving'] });
    assert.equal(signup.status, 200);
    assert.deepEqual(signup.body, { message: 'Your subscription is saved.' });
    const duplicate = await post(server.url, { email: 'person@example.com', consent: true });
    assert.deepEqual(duplicate, signup);
    for (const [input, field] of [
      [{ email: 'invalid', consent: true }, 'email'],
      [{ email: 'a@example.com', consent: false }, 'consent'],
      [{ email: 'a@example.com', consent: true, interests: ['unknown'] }, 'interests'],
      [{ email: 'a@example.com', consent: true, interests: 'reuse' }, 'interests']
    ]) {
      const result = await post(server.url, input);
      assert.equal(result.status, 400);
      assert.equal(result.body.field, field);
    }
    assert.equal((await post(server.url, '{')).status, 400);
    assert.equal((await post(server.url, 'null')).status, 400);
    assert.equal((await post(server.url, 'x'.repeat(4097))).status, 413);
    assert.equal((await post(server.url, '{}', 'text/plain')).status, 415);
    await stop(server.child); server = null;
    server = await start(path);
    assert.deepEqual(await post(server.url, { email: 'PERSON@example.com', consent: true }), signup);
    await stop(server.child); server = null;
    const db = new DatabaseSync(path);
    const rows = db.prepare('SELECT email, interests, consent_at FROM subscriptions').all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, 'person@example.com');
    assert.deepEqual(JSON.parse(rows[0].interests), ['reuse', 'giving']);
    assert.ok(!Number.isNaN(Date.parse(rows[0].consent_at)));
    db.close();
  } finally {
    if (server) await stop(server.child);
    await rm(dir, { recursive: true, force: true });
  }
});
