// 운영자 화면 시각 점검: node tools/qa-admin.cjs <base> <outdir>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const [base = 'http://localhost:4174', outdir = '.'] = process.argv.slice(2);
  fs.mkdirSync(outdir, { recursive: true });
  const dev = await (await fetch(base + '/__dev')).json();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const snap = async (name, full = true) => { await p.waitForTimeout(500); await p.screenshot({ path: path.join(outdir, name + '.png'), fullPage: full }); };
  await p.goto(base + '/admin/', { waitUntil: 'networkidle' });
  await snap('ad-login', false);
  await p.fill('#pw', dev.password);
  await p.click('#lbtn');
  await p.waitForSelector('.ad-tiles', { timeout: 15000 });
  await snap('ad-dashboard');
  const progress = dev.seeded.find((s) => s.label.startsWith('진행 중'));
  await p.goto(`${base}/admin/#order=${progress.orderNo}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.ad-ohead');
  await snap('ad-order-brief');
  for (const t of ['prompts', 'design', 'files', 'log']) {
    await p.click(`[data-tab="${t}"]`);
    await snap('ad-order-' + t);
  }
  const quote = dev.seeded.find((s) => s.label === '견적 확인 중');
  await p.goto(`${base}/admin/#order=${quote.orderNo}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.ad-ohead');
  await p.click('[data-tab="brief"]');
  await snap('ad-order-quote');
  await p.goto(`${base}/admin/#orders?status=all`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.ad-list');
  await snap('ad-list');
  await p.goto(`${base}/admin/settings/`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.ad-set-grid');
  await snap('ad-settings');
  await p.goto(`${base}/admin/#catalog`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.ad-cat');
  await snap('ad-catalog');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${base}/admin/#order=${progress.orderNo}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.ad-ohead');
  await snap('ad-order-mobile');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
  await b.close();
})();
