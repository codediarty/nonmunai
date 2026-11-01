// 브랜드 이미지 생성: 파비콘·앱 아이콘·페이지별 OG 이미지(1200×630)
// 사용: node tools/og.mjs   (docs/ 빌드가 있어야 글꼴을 씀, 정적 서버를 잠깐 띄움)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createTemplates } from '../src/templates/layout.mjs';
import { loadGuides } from './guides.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }

const imgDir = path.join(root, 'src/assets/img');
const ogDir = path.join(imgDir, 'og');
fs.mkdirSync(ogDir, { recursive: true });

const MARK = (s = 32) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${s}" height="${s}"><rect x="5" y="3.5" width="19" height="25" rx="2.5" fill="none" stroke="#0F1B3D" stroke-width="2.2"/><path d="M9.5 10h10M9.5 14.5h10M9.5 19h6" stroke="#0F1B3D" stroke-width="2.2" stroke-linecap="round"/><circle cx="24.5" cy="23.5" r="5.5" fill="#2346E8"/><path d="M22.2 23.6l1.6 1.6 3-3.2" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// 작은 크기용 아이콘: 종이와 확인 표시를 굵게
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0F1B3D"/><rect x="15" y="11" width="28" height="38" rx="4" fill="#fff"/><path d="M21 21h16M21 28h16M21 35h9" stroke="#0F1B3D" stroke-width="3.6" stroke-linecap="round"/><circle cx="44" cy="45" r="11" fill="#2346E8" stroke="#0F1B3D" stroke-width="3"/><path d="M39.2 45.2l3.4 3.4 6-6.4" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
fs.writeFileSync(path.join(root, 'src/assets/favicon.svg'), ICON_SVG);

// 페이지 목록에서 OG 대상 모으기
const site = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const T = createTemplates({ site, root, assetVersion: 'og' });
const ctx = { site, T, root, assetVersion: 'og', guides: loadGuides(root) };
const pageDir = path.join(root, 'src/content/pages');
const targets = new Map();
targets.set('/assets/img/og/default.png', { kicker: '논문 자동작성 AI', title: '프롬프트 한 줄로\n논문을 완성합니다', sub: '참고문헌은 모두 실존 문헌, 본문 인용까지 연결' });
for (const f of fs.readdirSync(pageDir).filter((x) => x.endsWith('.mjs'))) {
  const mod = await import(pathToFileURL(path.join(pageDir, f)).href);
  for (const p of await mod.default(ctx)) {
    if (!p.ogImage || targets.has(p.ogImage)) continue;
    const isGuide = p.ogImage.includes('/og/guide-');
    const title = p.path === '/' ? '프롬프트 한 줄로\n논문을 완성합니다' : (p.ogTitle || p.h1 || p.title.replace(/\s*\|\s*논문AI$/, ''));
    const kicker = p.path === '/' ? '논문 자동작성 AI' : isGuide ? `논문AI 가이드${p.category ? ' · ' + p.category : ''}` : (p.crumbs && p.crumbs[1] ? p.crumbs[1][0] : '논문AI');
    targets.set(p.ogImage, { kicker, title, sub: p.path === '/' ? '참고문헌은 모두 실존 문헌, 본문 인용까지 연결합니다' : p.path === '/ai-thesis/' ? '실존 참고문헌, 본문 인용, 8쪽부터 130쪽까지' : '' });
  }
}

// docs/를 잠깐 서비스해 사이트 글꼴(CSS) 사용
const docs = path.join(root, 'docs');
if (!fs.existsSync(path.join(docs, 'assets/css/site.css'))) { console.error('docs/ 빌드가 필요합니다: node tools/build.mjs'); process.exit(1); }
const types = { '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.join(docs, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(docs) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ogHtml = ({ kicker, title, sub }) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="${base}/assets/css/site.css"><style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#F5F7FB}
.c{position:relative;width:1200px;height:630px;box-sizing:border-box;padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between;font-family:var(--sans);color:#0F1B3D}
.sheet{position:absolute;right:-40px;top:70px;width:470px;height:600px;background:#fff;border:1px solid #DDE3EE;border-radius:6px;box-shadow:0 30px 80px -30px rgba(15,27,61,.35);transform:rotate(-4deg)}
.sheet .ln{position:absolute;left:44px;height:9px;border-radius:5px;background:#EDF0F6}
.sheet svg{position:absolute;left:40px;top:230px}
.top{position:relative;display:flex;align-items:center;gap:12px;font-weight:800;font-size:30px;letter-spacing:-.02em}
.top b{color:#2346E8}
.k{position:relative;font-size:24px;font-weight:700;color:#2346E8;margin:0 0 18px}
h1{position:relative;font-family:var(--sans);font-weight:800;font-size:${title.length > 40 ? 44 : title.length > 26 ? 52 : 62}px;line-height:1.22;letter-spacing:-.05em;margin:0;max-width:680px;word-break:keep-all;color:#0B1633}
.s{position:relative;font-size:24px;color:#41506B;margin:20px 0 0;max-width:620px;word-break:keep-all}
.foot{position:relative;font-size:19px;color:#5B6478;font-weight:600}
</style></head><body><div class="c">
<div class="sheet">${[60, 92, 124, 156].map((y, i) => `<span class="ln" style="top:${y}px;width:${[300, 340, 260, 320][i]}px"></span>`).join('')}
<svg width="340" height="148" viewBox="0 0 390 170"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#41506B"/></marker></defs>
<rect x="0" y="95" width="104" height="46" rx="23" fill="#EEF2FF" stroke="#2346E8" stroke-width="2"/><rect x="143" y="10" width="104" height="46" rx="23" fill="#E8F7F1" stroke="#0E9F6E" stroke-width="2"/><rect x="286" y="95" width="104" height="46" rx="23" fill="#F1F4F9" stroke="#0F1B3D" stroke-width="2"/>
<path d="M60 95L170 58" stroke="#41506B" stroke-width="2.2" marker-end="url(#a)"/><path d="M222 58L330 95" stroke="#41506B" stroke-width="2.2" marker-end="url(#a)"/><path d="M106 118H282" stroke="#41506B" stroke-width="2.2" marker-end="url(#a)"/></svg>
${[350, 382, 414, 446, 478].map((y, i) => `<span class="ln" style="top:${y}px;width:${[330, 280, 340, 300, 220][i]}px"></span>`).join('')}</div>
<div class="top">${MARK(46)}<span>논문<b>AI</b></span></div>
<div><p class="k">${esc(kicker)}</p><h1>${esc(title.includes('\n') || title.length < 17 ? title : title.replace(/, /, ',\n')).replace(/\n/g, '<br>')}</h1>${sub ? `<p class="s">${esc(sub)}</p>` : ''}</div>
<div class="foot">운영 성균관컨설팅 · 성균관대학교 RISE사업 지원 기업</div></div></body></html>`;

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
let n = 0;
for (const [rel, t] of targets) {
  await page.setContent(ogHtml(t), { waitUntil: 'networkidle' });
  await page.evaluate(async (txt) => {
    await Promise.all([document.fonts.load(`800 56px "Pretendard Variable"`, txt.title), document.fonts.load(`700 24px "Pretendard Variable"`, txt.kicker + txt.sub + '논문AI 운영 성균관컨설팅')]);
    await document.fonts.ready;
  }, t);
  await page.waitForTimeout(150);
  const out = path.join(root, 'src', rel.replace(/^\/assets\//, 'assets/'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'png' });
  n++;
}
// 앱 아이콘
const iconPage = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
for (const [size, file] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png'], [192, 'img/logo-192.png'], [512, 'img/logo-512.png']]) {
  await iconPage.setViewportSize({ width: size, height: size });
  await iconPage.setContent(`<html><body style="margin:0;background:transparent">${ICON_SVG.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await iconPage.screenshot({ path: path.join(root, 'src/assets', file), omitBackground: true });
}
await browser.close();
server.close();
// 용량 줄이기: 128색 PNG (파이썬 PIL이 있으면)
try {
  execSync(`python3 -c "import glob;from PIL import Image\nfor f in glob.glob('${ogDir}/*.png'):\n  Image.open(f).convert('RGB').quantize(colors=128,dither=Image.Dither.NONE).save(f,optimize=True)"`);
} catch { /* PIL 없음: 원본 유지 */ }
console.log(`og: ${n}개, 아이콘 4개 → src/assets`);
