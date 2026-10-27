const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const { mkdtemp, rm, mkdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'letter-ui-'));
  let server, browser;
  try {
    server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0', DATA_PATH: join(dir, 'data.sqlite') }, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '', port;
    for await (const chunk of server.stdout) { out += chunk; const match = out.match(/listening on (\d+)/); if(match) { port = match[1]; break; } }
    assert.ok(port, 'Server started');
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mkdir('artifacts', { recursive: true });
    for (const width of [1440, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`http://127.0.0.1:${port}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow at ${width}`);
      await page.screenshot({ path: `artifacts/signup-${width}.png`, fullPage: true });
    }
    await page.getByRole('button', {name: 'Save my subscription'}).click();
    assert.equal(await page.locator('#email').getAttribute('aria-invalid'), 'true');
    await page.getByLabel('Email address').fill('reader@example.com');
    await page.getByRole('button', {name: 'Save my subscription'}).click();
    assert.equal(await page.locator('#consent').getAttribute('aria-invalid'), 'true');
    await page.getByLabel('I agree to receive').check();
    await page.getByText('Reuse ideas', {exact: true}).click();
    await page.getByRole('button', {name: 'Save my subscription'}).click();
    await page.getByRole('status').filter({hasText: 'Your subscription is saved.'}).waitFor();
    await page.getByLabel('Email address').fill('second@example.com');
    await page.getByLabel('I agree to receive').check();
    await page.route('**/api/subscriptions', route => route.abort());
    await page.getByRole('button', {name: 'Save my subscription'}).click();
    await page.getByRole('status').filter({hasText: 'Could not connect.'}).waitFor();
    assert.equal(await page.getByRole('button', {name: 'Save my subscription'}).isEnabled(), true);
    await page.unroute('**/api/subscriptions');
    await page.getByRole('button', {name: 'Save my subscription'}).click();
    await page.getByRole('status').filter({hasText: 'Your subscription is saved.'}).waitFor();
    assert.deepEqual(errors, []);
    console.log('UI passed: four widths, validation, consent, success, network failure and retry.');
  } finally { if(browser) await browser.close(); if(server) server.kill(); await rm(dir, { recursive:true, force:true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
