// 아임웹 상품 상세 설명에 쓰는 공용 이미지: 진행 순서, 결과물 예시(논문·설문·통계)
// 사용: node tools/shop-images.mjs   (docs/ 빌드 필요) → src/assets/img/shop/*.png
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildDesign } from '../src/js/core/engine.js';
import { designReportHtml } from '../src/js/ui/report.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'src/assets/img/shop');
fs.mkdirSync(outDir, { recursive: true });
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }

const docs = path.join(root, 'docs');
const server = http.createServer((req, res) => {
  const file = path.join(docs, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(docs) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', { '.css': 'text/css', '.woff2': 'font/woff2' }[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const head = (w, extra = '') => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="${base}/assets/css/app.css"><style>
html,body{margin:0;width:${w}px;background:#E9ECF2}
.scene{position:relative;box-sizing:border-box;padding:56px 48px;font-family:var(--sans);color:#0F1B3D;background:radial-gradient(120% 80% at 20% 0,#F5F7FB 0,#E6EAF1 70%)}
.tag{display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:#2346E8;margin:0 0 12px}
.tag i{width:8px;height:8px;border-radius:50%;background:#2346E8}
.ttl{font-family:var(--serif);font-size:34px;font-weight:800;letter-spacing:-.035em;line-height:1.3;margin:0 0 30px;word-break:keep-all}
.sheet{background:#fff;border:1px solid #DDE3EE;border-radius:8px;box-shadow:0 26px 50px -30px rgba(15,27,61,.45)}
.note{margin:22px 0 0;font-size:14px;color:#6B7487}
${extra}</style></head><body>`;

// 1) 진행 순서
const steps = [
  ['주문서 작성', '주제와 작업을 고르면 연구 설계와 금액이 바로 나옵니다', 'M7 4h10l3 3v13H7z M10 11h7 M10 15h7'],
  ['결제', '주문 금액과 같은 상품으로 바로 결제합니다', 'M4 7h16v11H4z M4 11h16'],
  ['작업과 진행 안내', '단계가 바뀔 때마다 주문 페이지와 메일로 알려 드립니다', 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z M12 8v4l3 2'],
  ['결과물 전달', '주문 페이지에서 내려받고 수정을 요청합니다', 'M12 4v11 M7 10l5 5l5-5 M5 19h14'],
];
const processHtml = head(780, `.row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;position:relative}
.ps{background:#fff;border:1px solid #DDE3EE;border-radius:14px;padding:22px 16px 20px;text-align:center;position:relative;font-style:normal}
.ps .n{font-style:normal;position:absolute;top:-13px;left:50%;transform:translateX(-50%);width:26px;height:26px;border-radius:50%;background:#0F1B3D;color:#fff;font-size:13px;font-weight:800;line-height:26px}
.ps svg{width:44px;height:44px;margin:6px auto 12px;display:block}
.ps b{display:block;font-size:17px;letter-spacing:-.02em;margin-bottom:8px;font-style:normal}
.ps span{display:block;font-size:13.5px;line-height:1.55;color:#5B6478;word-break:keep-all;font-style:normal}`)
  + `<div class="scene"><p class="tag"><i></i>논문AI 진행 순서</p><p class="ttl">주문서 한 장으로 시작해<br>결과물까지 한 화면에서</p><div class="row">${steps.map(([b, t, d], i) => `<div class="ps"><span class="n">${i + 1}</span><svg viewBox="0 0 24 24" fill="none" stroke="#2346E8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg><b>${b}</b><span>${t}</span></div>`).join('')}</div></div></body></html>`;

// 2) 논문 결과물 예시: 연구 설계 엔진이 실제로 만든 설계서
const d = buildDesign({ title: '간호사의 직무스트레스가 이직의도에 미치는 영향: 회복탄력성의 매개효과', typeId: 'master', fieldId: 'nursing', start: '2026-11-02' });
const paperHtml = head(780, `.wrap{display:grid;grid-template-columns:1fr;gap:0}
.sheet{padding:30px 30px 10px;max-height:1180px;overflow:hidden;position:relative}
.sheet:after{content:"";position:absolute;left:0;right:0;bottom:0;height:120px;background:linear-gradient(rgba(255,255,255,0),#fff)}
.report .rp-sec:nth-of-type(n+7){display:none}`)
  + `<div class="scene"><p class="tag"><i></i>결과물 예시 · 연구 설계서</p><p class="ttl">작업 전에 연구모형, 가설, 분석 계획부터<br>한눈에 확인합니다</p><div class="sheet">${designReportHtml(d, { showSchedule: false, showToc: false })}</div><p class="note">예시 주제로 만든 실제 설계서 일부입니다. 주문마다 주제와 자료에 맞춰 연구진이 확정합니다.</p></div></body></html>`;

// 3) 설문 결과물 예시: 설문지 문항과 신뢰도 정리표
const items = ['업무량이 많아 정해진 시간 안에 일을 끝내기 어렵다', '업무 중 갑작스러운 상황에 대처해야 하는 일이 잦다', '업무 결과에 대한 책임이 크게 느껴진다', '동료와 업무 분담이 공정하다고 느낀다(역문항)'];
const surveyHtml = head(780, `.two{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;align-items:start}
.sheet{padding:24px 24px 20px}
.sheet h4{margin:0 0 4px;font-size:17px;letter-spacing:-.02em}.sheet .s{margin:0 0 14px;font-size:12.5px;color:#6B7487}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{border-bottom:1px solid #E3E7EF;padding:8px 5px;text-align:center;word-break:keep-all}
th{font-size:11.5px;line-height:1.35;white-space:nowrap}
.apa td,.apa th{white-space:nowrap}
th{background:#F5F7FB;font-weight:700;color:#0F1B3D}
td.q{text-align:left;color:#2B3654;line-height:1.45;width:56%}
td.o{color:#C9D3FB;font-size:15px}
.apa{border-top:2px solid #0F1B3D;border-bottom:2px solid #0F1B3D}
.apa th{background:none;border-bottom:1px solid #0F1B3D}
.cap{font-size:12.5px;font-weight:700;margin:0 0 8px}.cap i{font-style:italic;font-weight:400}`)
  + `<div class="scene"><p class="tag"><i></i>결과물 예시 · 설문지와 응답 정리</p><p class="ttl">검증된 척도로 문항을 구성하고<br>응답을 논문 형식으로 정리합니다</p><div class="two"><div class="sheet"><h4>Ⅱ. 직무스트레스</h4><p class="s">각 문항에 대해 해당하는 정도에 표시해 주십시오.</p><table><thead><tr><th style="text-align:left">문항</th><th>전혀<br>아니다</th><th>아니다</th><th>보통</th><th>그렇다</th><th>매우<br>그렇다</th></tr></thead><tbody>${items.map((q, i) => `<tr><td class="q">${i + 1}. ${q}</td>${'<td class="o">○</td>'.repeat(5)}</tr>`).join('')}</tbody></table></div>
<div class="sheet"><p class="cap">표 2. <i>측정도구의 신뢰도</i></p><table class="apa"><thead><tr><th style="text-align:left">변인</th><th>문항 수</th><th>Cronbach's α</th></tr></thead><tbody><tr><td class="q">직무스트레스</td><td>12</td><td>.89</td></tr><tr><td class="q">회복탄력성</td><td>10</td><td>.86</td></tr><tr><td class="q">이직의도</td><td>6</td><td>.91</td></tr></tbody></table><p class="s" style="margin:12px 0 0">모든 척도의 신뢰도가 .80 이상으로 양호하였다.</p></div></div><p class="note">형식을 보여 드리기 위한 예시입니다. 수치는 실제 응답 분석 결과로 채워집니다.</p></div></body></html>`;

// 4) 통계 결과물 예시: APA 통계표와 쉬운 해석
const statsHtml = head(780, `.sheet{padding:26px 28px 22px}
.cap{font-size:13px;font-weight:700;margin:0 0 8px}.cap i{font-style:italic;font-weight:400}
table{width:100%;border-collapse:collapse;font-size:13px;border-top:2px solid #0F1B3D;border-bottom:2px solid #0F1B3D}
th{border-bottom:1px solid #0F1B3D;padding:8px 6px;font-weight:700;text-align:center}
td{padding:7px 6px;text-align:center;color:#2B3654}td.l{text-align:left}
.fn{font-size:11.5px;color:#6B7487;margin:8px 0 0}
.easy{margin:18px 0 0;background:#EEF2FF;border-radius:12px;padding:16px 18px;font-size:14px;line-height:1.7;color:#1B2B5E}
.easy b{display:block;margin-bottom:4px;color:#2346E8}`)
  + `<div class="scene"><p class="tag"><i></i>결과물 예시 · 통계표와 해석</p><p class="ttl">APA 형식 통계표에<br>읽기 쉬운 해석을 붙여 드립니다</p><div class="sheet"><p class="cap">표 4. <i>이직의도에 대한 위계적 회귀분석 결과</i></p><table><thead><tr><th style="text-align:left">변인</th><th>B</th><th>SE</th><th>β</th><th>t</th></tr></thead><tbody>
<tr><td class="l">1단계: 연령</td><td>-0.08</td><td>0.03</td><td>-.14</td><td>-2.41*</td></tr><tr><td class="l">2단계: 직무스트레스</td><td>0.46</td><td>0.06</td><td>.41</td><td>7.52***</td></tr><tr><td class="l">3단계: 회복탄력성</td><td>-0.31</td><td>0.05</td><td>-.33</td><td>-6.08***</td></tr></tbody></table>
<p class="fn">R² = .32, ΔR² = .09, F = 41.27***. *p &lt; .05, ***p &lt; .001</p>
<div class="easy"><b>쉬운 해석</b>직무스트레스가 높을수록 이직의도가 높아졌고, 회복탄력성을 함께 넣자 직무스트레스의 영향이 줄어들어 회복탄력성이 그 관계를 일부 설명하는 것으로 나타났습니다.</div></div><p class="note">형식을 보여 드리기 위한 예시입니다. 실제 결과는 의뢰하신 데이터로 분석합니다.</p></div></body></html>`;

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 780, height: 900 }, deviceScaleFactor: 2 });
for (const [name, html] of [['process', processHtml], ['sample-paper', paperHtml], ['sample-survey', surveyHtml], ['sample-stats', statsHtml]]) {
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await Promise.all([document.fonts.load('800 34px "Noto Serif KR"', '논문AI 결과물 예시'), document.fonts.load('700 16px "Pretendard Variable"', '논문AI')]); await document.fonts.ready; });
  await page.waitForTimeout(200);
  const h = await page.evaluate(() => document.querySelector('.scene').getBoundingClientRect().height);
  await page.setViewportSize({ width: 780, height: Math.ceil(h) });
  await page.screenshot({ path: path.join(outDir, `${name}.png`), type: 'png', fullPage: false });
  await page.setViewportSize({ width: 780, height: 900 });
}
await browser.close();
server.close();
try {
  execSync(`python3 -c "import glob;from PIL import Image\nfor f in glob.glob('${outDir}/*.png'):\n  Image.open(f).convert('RGB').quantize(colors=200,dither=Image.Dither.NONE).save(f,optimize=True)"`);
} catch { /* PIL 없음 */ }
console.log('shop: 상세 이미지 4개 → src/assets/img/shop');
