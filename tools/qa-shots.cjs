// 주문 화면 시각 점검: node tools/qa-shots.cjs <base> <outdir> [mobile]
// 개발 서버(/__dev)의 예시 주문으로 주문·결제 화면을 찍고 콘솔 오류를 모은다.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const [base = 'http://localhost:4174', outdir = '.', mode = ''] = process.argv.slice(2);
  fs.mkdirSync(outdir, { recursive: true });
  const dev = await (await fetch(base + '/__dev')).json();
  const b = await chromium.launch();
  const vp = mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const errors = [];
  const shot = async (url, name) => {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(outdir, `${name}${mode ? '-' + mode : ''}.png`), fullPage: true });
    await p.close();
  };
  const slug = (s) => s.replace(/[^가-힣a-z0-9]+/gi, '_');
  for (const s of dev.seeded) {
    await shot(`${base}/orders/?o=${s.orderNo}&t=${encodeURIComponent(s.token)}`, 'ord_' + slug(s.label));
    if (/결제 대기|견적/.test(s.label)) await shot(`${base}/checkout/?o=${s.orderNo}&t=${encodeURIComponent(s.token)}`, 'pay_' + slug(s.label));
  }
  await shot(`${base}/orders/`, 'lookup');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
  await b.close();
})();
