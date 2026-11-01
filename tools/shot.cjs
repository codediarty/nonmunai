// 스크린샷: node tools/shot.cjs <url> <out.png> [width] [height] [fullPage]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = '1440', h = '900', full = '1'] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: out, fullPage: full === '1' });
  if (errors.length) console.log('ERRORS:', errors.join(' | '));
  await b.close();
})();
