'use strict';
/*
 * 논문AI 인수 테스트(E2E): 필수 인수 항목 40개를 실제 브라우저(Playwright + Chromium)로 확인합니다.
 *
 * 실행: NODE_PATH=$(npm root -g) node tools/test/e2e.cjs [기본 주소] [--only=1,2,3] [--verbose]
 *   기본 주소를 주지 않으면 http://localhost:4174 를 씁니다.
 * 전제: ./tools/dev-restart.sh 로 개발 서버(Apps Script 에뮬레이터 API 포함)가 떠 있어야 합니다.
 *   이 스크립트는 서버를 재시작하지 않습니다. 대신 /__dev(관리자 비밀번호, 보낸 메일·대기 메일),
 *   /__clock(에뮬레이터 시계), /__jobs(예약 작업 실행)를 씁니다. /__jobs와 /__dev의 queued는
 *   이 테스트를 위해 tools/dev-server.mjs에 더한 개발용 기능입니다.
 *
 * 순서: 1~38, 40을 먼저 돌리고, 서버 시계를 앞당기는 39(보관 만료·접근 기한)를 맨 마지막에 돌립니다.
 *   그래서 전체 실행 뒤에는 서버 시계가 약 181일 앞서 있습니다. 서버를 다시 띄우지 않고 이어서 돌려도
 *   동작하지만, 깨끗한 상태가 필요하면 dev-restart.sh로 서버를 새로 띄워 주세요.
 *   주문 생성 제한(시간당 120건)이 있으므로 39를 빼고(--only) 여러 번 돌릴 때는 서버를 다시 띄워 주세요.
 *
 * 결과: 확인마다 PASS/FAIL 한 줄, 마지막에 항목별(1~40) 결과와 확인 범위(E2E, 기존 단위·API 테스트) 표.
 *   KNOWN은 프런트엔드에서 고칠 수 없는 알려진 백엔드 결함으로, 종료 코드에는 반영하지 않습니다.
 *   FAIL이 하나라도 있거나 페이지 스크립트 오류(pageerror)가 나면 종료 코드 1.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const BASE = (ARGS.find((a) => /^https?:\/\//.test(a)) || process.env.E2E_BASE || 'http://localhost:4174').replace(/\/+$/, '');
const ONLY = ((ARGS.find((a) => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean).map(Number);
const VERBOSE = ARGS.includes('--verbose');
const ROOT = path.resolve(__dirname, '../..');
const DOCS = path.join(ROOT, 'docs-dev');
const RUN = Date.now().toString(36).slice(-6);

/* =================================================================== 결과 기록 */
const TITLES = {
  1: '홈에서 3개 서비스 각각 독립 경로 이동', 2: '논문 유형 기본 순서 석사→박사→학술지→학사→일반→청소년→개인', 3: '주제 모름 선택 시 관심 키워드 입력',
  4: '목차 있음 선택 시 실제 업로드 또는 텍스트 입력', 5: '양식 있음 선택 시 실제 업로드 및 학교/학술지명', 6: "연구방법 '잘 모르겠어요' 기본, 문헌연구 첫 구체 옵션",
  7: '전체 작성 지원 시 기존 자료 선택 업로드', 8: '부분 첨삭 시 기존 원고 필수 및 수정 요청 입력', 9: '교수 피드백 반영 시 원고+피드백 필수',
  10: '설문 처음부터 끝까지 선택 시 설계·모집·분석·해석 범위 안내', 11: '설문지 수정 시 기존 설문지 필수', 12: '설문 피드백 반영 시 설문지+의견 필수',
  13: '설문 응답 데이터 분석 시 실제 데이터 파일 필수', 14: '설문 응답 수 모름으로도 다음 단계 진행', 15: '실제 응답 모집 선택 시 모집 비용 별도 견적',
  16: '통계 데이터 있음 선택 시 데이터 업로드 필수', 17: '통계 데이터 없음 선택 시 실제 조사/학습용 시뮬레이션 명확히 분리', 18: '시뮬레이션 주문·파일·보고서에 가상 데이터 표시',
  19: '실제 연구 결과인 것처럼 시뮬레이션을 내보내는 기능 없음', 20: '통계 분석법 모름으로도 주문 가능', 21: '통계 교수 피드백 반영 시 데이터·기존 결과·의견 확인',
  22: '유형·서비스·옵션 변경 시 가격 즉시 갱신', 23: '견적형 주문은 확정되지 않은 금액 결제 불가', 24: '필수 파일 누락 시 정확한 안내',
  25: '허용되지 않은 파일 확장자/용량 차단', 26: '여러 파일 업로드/삭제/오류 재시도 동작', 27: '주문 저장 후 새로고침해도 데이터 유지',
  28: '고객은 다른 고객 주문/파일 접근 불가', 29: '비관리자는 관리자 접근 불가', 30: '관리자 상태 변경이 고객 화면에 반영',
  31: '가짜 자동 AI 생성·가짜 퍼센트 없음', 32: '작업지시문 복사에 선택한 주문 정보 반영', 33: '관리자 결과 파일 업로드 후 고객 다운로드',
  34: '모바일 화면에서 입력·결제 요약 사용 가능', 35: '결제사 미설정 시 결제 완료를 가장하지 않음', 36: '데이터·파일 삭제 및 개인정보 동의 처리',
  41: '한 화면 논문 주문(관심 주제만, 제목 확정 없음)과 성균관컨설팅 결제 바로 연결',
  37: '실제 응답자 개인정보 비식별화 안내', 38: '제출·게재·유의성 보장 문구 없음', 39: '파일 보관 만료 및 접근 통제 테스트', 40: '관리자 가격 변경 시 신규 주문 가격 반영, 기존 주문 가격 유지',
};
// 같은 항목을 서버·계산 쪽에서 나눠 확인하는 기존 단위·API 테스트(node tools/test/run-all.mjs)
const BACKEND = {
  3: 'engine: 키워드로 추천 주제 생성', 8: 'backend: 첨삭 원고 없으면 제출 불가', 9: 'pricing: 피드백 항목 수 가산', 15: 'pricing: 모집 의뢰는 견적형',
  17: 'pricing: 데이터 유무에 따른 가격', 18: 'backend: 시뮬레이션 동의 필수·결과 파일명 표시', 22: 'pricing: 유형·작업·분량·옵션 가산, backend: 서버 가격=화면 가격',
  23: 'backend: 견적형 결제 불가→견적 확정', 24: 'backend: 필수 자료 누락 시 missing_files', 25: 'backend: 형식·내용 검사(위장 파일 차단)',
  28: 'backend: 다른 주문 토큰·위조 티켓 거부, 조회 잠금', 29: 'backend: 토큰 없으면 거부·로그인 제한·비밀번호 변경 시 토큰 무효', 30: 'backend: 자료 보완 요청→보완 완료',
  33: 'backend: 결과 업로드→전달→내려받기', 35: 'backend: 무통장 알림은 확인 중, 토스 승인·금액 위조 거부', 36: 'backend: 필수 동의 없으면 거부, 결제 전 취소 시 영구 삭제',
  39: 'backend: 자동 정리(미제출 3일·미결제 30일·보관 90일), 수정 요청 30일', 40: 'pricing·backend: 가격표 변경은 새 견적에만 반영',
};
const results = [];
const pageErrors = [];
const pad = (n) => String(n).padStart(2, '0');

async function check(item, name, fn, { known = '' } = {}) {
  if (ONLY.length && !ONLY.includes(item)) return;
  const t0 = Date.now();
  try {
    await fn();
    results.push({ item, name, status: 'PASS', ms: Date.now() - t0 });
    console.log(`PASS  ${pad(item)} ${name}${known ? '  (알려진 백엔드 결함이 고쳐진 것으로 보입니다. known 표시를 지워 주세요)' : ''}`);
  } catch (e) {
    const status = known ? 'KNOWN' : 'FAIL';
    const msg = String((e && e.message) || e).split('\n').slice(0, 3).join(' / ');
    results.push({ item, name, status, detail: msg, ms: Date.now() - t0 });
    console.log(`${status}  ${pad(item)} ${name}\n        → ${msg}${known ? `\n        알려진 백엔드 결함: ${known}` : ''}`);
    if (VERBOSE && e && e.stack) console.log(e.stack);
  }
}

/* =================================================================== 단언 */
function ok(cond, msg) { if (!cond) throw new Error(msg); }
function eq(actual, expected, msg) {
  const a = typeof actual === 'string' ? actual : JSON.stringify(actual);
  const b = typeof expected === 'string' ? expected : JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg}: 기대 ${b}, 실제 ${a}`);
}
function has(hay, needle, msg) { if (!String(hay).includes(needle)) throw new Error(`${msg || '문구 없음'}: "${needle}" 없음 (본문: ${String(hay).replace(/\s+/g, ' ').slice(0, 240)})`); }
function hasNot(hay, needle, msg) { if (String(hay).includes(needle)) throw new Error(`${msg || '있으면 안 되는 문구'}: "${needle}"`); }
const sq = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const parseWon = (s) => Number(String(s).replace(/[^0-9]/g, '')) || 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function once(fn) { let p = null; return () => (p = p || fn()); }

/* =================================================================== 서버 API */
async function rawApi(action, payload = {}) {
  const res = await fetch(`${BASE}/api`, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...payload }) });
  return res.json();
}
async function api(action, payload = {}) {
  const j = await rawApi(action, payload);
  if (!j.ok) { const e = new Error(`${action} 실패: ${j.error} ${j.message}`); e.code = j.error; throw e; }
  return j;
}
let DEV = null;
async function devInfo(fresh = false) { if (!DEV || fresh) DEV = await (await fetch(`${BASE}/__dev`)).json(); return DEV; }
let ADMIN = '';
async function adminToken(fresh = false) {
  if (!ADMIN || fresh) ADMIN = (await api('adminLogin', { password: (await devInfo()).password })).adminToken;
  return ADMIN;
}
async function adminApi(action, payload = {}) {
  try { return await api(action, { adminToken: await adminToken(), ...payload }); } catch (e) {
    if (e.code !== 'admin_required') throw e;
    return api(action, { adminToken: await adminToken(true), ...payload });
  }
}
async function clock(days) { const r = await fetch(`${BASE}/__clock?days=${days}`, { method: 'POST' }); ok(r.ok, '/__clock 실패'); ADMIN = ''; }
async function runJobs() {
  const r = await fetch(`${BASE}/__jobs`, { method: 'POST' });
  if (r.status === 404) throw new Error('개발 서버에 /__jobs가 없습니다(tools/dev-server.mjs 최신본으로 dev-restart.sh 실행 필요)');
  return r.json();
}

/* =================================================================== 파일 */
const B64 = (buf) => Buffer.from(buf).toString('base64');
const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf', csv: 'text/csv', png: 'image/png' };
const file = (name, buffer, mimeType) => ({ name, buffer: Buffer.from(buffer), mimeType: mimeType || MIME[name.split('.').pop()] || 'application/octet-stream' });
const zipBytes = (n = 2400, fill = 7) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(n, fill)]);
const docx = (name = '원고.docx', n = 2400) => file(name, zipBytes(n));
const xlsx = (name = '결과.xlsx') => file(name, zipBytes(1600, 5));
const pdf = (name = '양식.pdf') => file(name, Buffer.from('%PDF-1.4\n% e2e\n1 0 obj<<>>endobj\ntrailer<<>>\n'));
const png = (name = '메모.png') => file(name, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]));
function csv(name = '응답.csv', { pii = false } = {}) {
  const head = pii ? ['번호', '이름', '연락처', '성별', '만족1', '만족2', '만족3', '소진1', '소진2', '소진3'] : ['번호', '성별', '학년', '만족1', '만족2', '만족3', '소진1', '소진2', '소진3'];
  const rows = [head.join(',')];
  for (let i = 1; i <= 24; i++) {
    const v = (k) => String(1 + ((i * (k + 3)) % 5));
    const base = [String(i)];
    if (pii) base.push(`응답자${i}`, `010-${String(1000 + i).padStart(4, '0')}-${String(2000 + i)}`);
    base.push(String(1 + (i % 2)));
    if (!pii) base.push(String(1 + (i % 3)));
    base.push(v(1), v(2), v(3), v(4), v(5), v(6));
    rows.push(base.join(','));
  }
  return file(name, Buffer.from(rows.join('\n'), 'utf8'), 'text/csv');
}
async function realDocx(name, paragraphs) {
  const JSZip = require(path.join(ROOT, 'node_modules/jszip'));
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map((t) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
  return file(name, await zip.generateAsync({ type: 'nodebuffer' }));
}

/* =================================================================== 주문 준비(API) */
let seq = 0;
const mail = (tag = 'c') => `e2e.${RUN}.${tag}${++seq}@example.com`;
const CONSENT = { privacy: true, ethics: true, withdrawal: true };
const paperIn = (o = {}) => ({
  common: { fieldId: 'edu', title: o.title || '중학생의 학업 스트레스가 학교적응에 미치는 영향', keywords: [], method: 'auto', request: o.request || '' },
  paper: { typeId: o.typeId || 'master', task: o.task || 'full', ...(o.paper || {}) }, addons: o.addons || {},
});
async function makeOrder({ service = 'paper', input = paperIn(), files = [], submit = true, consents = {}, contact } = {}) {
  const c = contact || { name: '테스트고객', email: mail(), phone: `010-3${String(seq).padStart(3, '0')}-${String(4000 + seq).slice(-4)}` };
  const r = await api('createOrder', { service, input, contact: c, pin: '1357', consents: { ...CONSENT, ...consents } });
  for (const x of files) await api('uploadFile', { orderNo: r.orderNo, token: r.token, slot: x.slot, name: x.name, mime: x.mimeType, data: B64(x.buffer) });
  if (submit) await api('submitOrder', { orderNo: r.orderNo, token: r.token });
  return { orderNo: r.orderNo, token: r.token, contact: c, pin: '1357', quote: r.quote };
}
async function paidOrder(o = {}) { const x = await makeOrder(o); await adminApi('adminConfirmPayment', { orderNo: x.orderNo }); return x; }
async function deliveredOrder(o = {}, { name = '결과물_v1.docx', bytes } = {}) {
  const x = await paidOrder(o);
  const buf = bytes || zipBytes(1800, 3);
  const up = await adminApi('adminUploadResult', { orderNo: x.orderNo, name, mime: MIME.docx, data: B64(buf) });
  await adminApi('adminUpdateStatus', { orderNo: x.orderNo, status: 'delivered' });
  return { ...x, resultId: up.file.id, resultName: up.file.name, resultBytes: buf };
}
const getOrder = async (x) => (await api('getOrder', { orderNo: x.orderNo, token: x.token })).order;
const adminOrder = async (no) => (await adminApi('adminGetOrder', { orderNo: no })).order;
const ordersUrl = (x) => `${BASE}/orders/?o=${x.orderNo}&t=${encodeURIComponent(x.token)}`;
const checkoutUrl = (x) => `${BASE}/checkout/?o=${x.orderNo}&t=${encodeURIComponent(x.token)}`;

/* =================================================================== 브라우저 */
let browser;
async function newCtx({ admin = false, mobile = false, clipboard = false, ...rest } = {}) {
  const c = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1360, height: 900 },
    ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
    acceptDownloads: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', ...rest,
  });
  c.setDefaultTimeout(15000);
  if (clipboard) await c.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  if (admin) {
    const t = await adminToken();
    await c.addInitScript((tok) => { try { if (!localStorage.getItem('nm:admin')) localStorage.setItem('nm:admin', JSON.stringify({ token: tok, exp: Date.now() + 11 * 3600 * 1000 })); } catch (e) { /* 무시 */ } }, t);
  }
  c.on('page', (p) => p.on('pageerror', (e) => pageErrors.push(`${p.url()} → ${e.message}`)));
  return c;
}
async function withCtx(opts, fn) {
  const c = await newCtx(opts);
  try { const p = await c.newPage(); return await fn(p, c); } finally { await c.close().catch(() => {}); }
}
async function waitText(p, sel, text, timeout = 15000) {
  try {
    await p.waitForFunction(([s, t]) => [...document.querySelectorAll(s)].some((el) => el.textContent.includes(t)), [sel, text], { timeout });
  } catch (e) {
    const now = await p.$$eval(sel, (els) => els.map((el) => el.textContent).join(' | ')).catch(() => '(없음)');
    throw new Error(`${sel}에 "${text}"가 나타나지 않음 (현재: ${sq(now).slice(0, 240)})`);
  }
}
const toast = (p, text, timeout = 15000) => waitText(p, '.toast-host .toast', text, timeout);
// 복사 버튼을 누른 뒤 클립보드가 기대한 내용으로 바뀔 때까지 기다린다(앞선 복사의 알림이 남아 있어도 헷갈리지 않게)
async function clipAfter(p, sel, mustInclude, timeout = 15000) {
  await p.evaluate(() => navigator.clipboard.writeText('')).catch(() => {});
  await p.click(sel);
  const until = Date.now() + timeout;
  let got = '';
  while (Date.now() < until) {
    got = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    if (got.includes(mustInclude)) return got;
    await sleep(150);
  }
  throw new Error(`${sel}을 눌렀는데 클립보드에 "${mustInclude}"가 들어가지 않음: ${sq(got).slice(0, 160)}`);
}
const text = async (p, sel) => sq(await p.textContent(sel));
async function noHScroll(p, where) {
  const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok(r.sw <= r.cw + 1, `${where}: 가로 스크롤이 생김 (scrollWidth ${r.sw} > ${r.cw})`);
}
async function downloadVia(p, sel) {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click(sel)]);
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(await dl.path()) };
}

/* =================================================================== 신청서 도우미 */
// 데스크톱에서는 새 단계가 그려지고 30ms 뒤 첫 입력 칸에 자동으로 초점이 간다. 그 전에 입력하면 초점이 옮겨 가며
// 글자가 다른 칸에 들어갈 수 있으므로, 초점이 단계 안으로 들어올 때까지(최대 0.4초, 모바일은 자동 초점 없음) 기다린다.
const settle = (p) => p.waitForFunction(() => {
  const a = document.activeElement;
  return matchMedia('(max-width: 860px)').matches || !!(a && a !== document.body && a.closest && a.closest('#wzStep'));
}, null, { timeout: 400 }).catch(() => {});
const W = {
  async open(p, url, first) { await p.goto(BASE + url); await p.waitForSelector(`#wzStep[data-step="${first}"]`); await settle(p); },
  step: (p) => p.$eval('#wzStep', (e) => e.dataset.step),
  async pick(p, name, value) {
    await p.click(`#wzStep label.opt:has(input[data-choice="${name}"][value="${value}"])`);
    await p.waitForSelector(`#wzStep input[data-choice="${name}"][value="${value}"]:checked`, { state: 'attached' });
  },
  async toggle(p, name, value) { await p.click(`#wzStep label.opt:has(input[data-choice="${name}"][value="${value}"])`); await sleep(60); },
  checked: (p, name) => p.$$eval(`#wzStep input[data-choice="${name}"]:checked`, (els) => els.map((e) => e.value)),
  async fill(p, name, value) { await p.fill(`#wzStep [data-path="${name}"]`, String(value)); },
  value: (p, name) => p.inputValue(`#wzStep [data-path="${name}"]`),
  async next(p) {
    const before = await W.step(p);
    await p.$eval('#wzErr', (e) => { e.textContent = ''; }).catch(() => {});
    await p.click('#wzNext');
    await p.waitForFunction((b) => {
      const s = document.querySelector('#wzStep'); const e = document.querySelector('#wzErr');
      return (s && s.dataset.step !== b) || (e && e.textContent.trim());
    }, before);
    const after = await W.step(p);
    if (after !== before) await settle(p);
    return { step: after, err: after === before ? sq(await p.textContent('#wzErr')) : '' };
  },
  async go(p, expect) {
    const r = await W.next(p);
    if (r.err) throw new Error(`${expect || '다음'} 단계로 넘어가지 못함: ${r.err}`);
    if (expect && r.step !== expect) throw new Error(`다음 단계가 ${expect}가 아니라 ${r.step}`);
    return r;
  },
  async blocked(p, expected) {
    const r = await W.next(p);
    if (!r.err) throw new Error(`필수 입력 없이 ${r.step} 단계로 넘어감`);
    if (expected) eq(r.err, expected, '안내 문구');
    return r.err;
  },
  async back(p, expect) { await p.click('#wzStep [data-prev]'); await p.waitForSelector(`#wzStep[data-step="${expect}"]`); await settle(p); },
  count: (p, slot) => p.$$eval(`#wzStep [data-up="${slot}"] .up-item`, (els) => els.length),
  names: (p, slot) => p.$$eval(`#wzStep [data-up="${slot}"] .up-item .up-name`, (els) => els.map((e) => e.textContent)),
  async upload(p, slot, files, { expect } = {}) {
    const before = await W.count(p, slot);
    await p.setInputFiles(`#wzStep input[data-file="${slot}"]`, files);
    if (expect === 'error') {
      await p.waitForFunction((s) => { const e = document.querySelector(`#wzStep [data-err="${s}"]`); return e && e.textContent.trim(); }, slot);
      return sq(await p.textContent(`#wzStep [data-err="${slot}"]`));
    }
    const want = typeof expect === 'number' ? expect : before + files.length;
    try {
      await p.waitForFunction(([s, n]) => document.querySelectorAll(`#wzStep [data-up="${s}"] .up-item`).length === n, [slot, want], { timeout: 10000 });
    } catch (e) {
      throw new Error(`${slot} 칸 파일 수가 ${want}개가 아님: ${await W.count(p, slot)}개, 안내: ${sq(await p.textContent(`#wzStep [data-err="${slot}"]`).catch(() => ''))}`);
    }
    return sq(await p.textContent(`#wzStep [data-err="${slot}"]`).catch(() => ''));
  },
  async del(p, slot, name) {
    const n = await W.count(p, slot);
    await p.click(`#wzStep [data-up="${slot}"] .up-item:has(.up-name:text-is("${name}")) [data-del]`);
    await p.waitForFunction(([s, k]) => document.querySelectorAll(`#wzStep [data-up="${s}"] .up-item`).length === k, [slot, n - 1]);
  },
  price: async (p) => sq(await p.textContent('#wzSideIn .pl-total b').catch(() => '')),
  async waitPrice(p, txt, why = '실시간 금액') {
    try { await p.waitForFunction((t) => { const b = document.querySelector('#wzSideIn .pl-total b'); return b && b.textContent.trim() === t; }, txt, { timeout: 5000 }); } catch (e) { throw new Error(`${why}이 ${txt}이 아님: ${await W.price(p) || '없음'}`); }
  },
  mbar: async (p) => sq(await p.textContent('#wzMbar .mb-price b').catch(() => '')),
  side: async (p) => sq(await p.textContent('#wzSideIn')),
};

async function fillContact(p, { email, all = false, irb = false, sim = false } = {}) {
  await W.fill(p, 'contact.name', '이테스트');
  await W.fill(p, 'contact.phone', '01023456789');
  await W.fill(p, 'contact.email', email || mail('w'));
  await W.fill(p, 'pin', '2468');
  if (all) await p.check('#wzStep [data-bool="consents.marketing"]');
  if (sim) await p.check('#wzStep [data-bool="consents.simulation"]');
}

async function submitWizard(p, { timeout = 45000 } = {}) {
  await Promise.all([p.waitForURL(/\/checkout\/\?o=NA\d{6}-[A-Z0-9]{4}/, { timeout }), p.click('#wzNext')]);
  const orderNo = new URL(p.url()).searchParams.get('o');
  await p.waitForSelector('.ord-no');
  const token = await p.evaluate((n) => { try { return (JSON.parse(localStorage.getItem('nm:orders') || '{}')[n] || {}).token || ''; } catch (e) { return ''; } }, orderNo);
  ok(token, '접수 후 이 기기에 조회 키가 저장되지 않음');
  return { orderNo, token };
}
const pendingNo = (p, key) => p.evaluate((k) => { try { return ((JSON.parse(localStorage.getItem(`nm:draft:${k}`) || '{}')._pending) || {}).orderNo || ''; } catch (e) { return ''; } }, key);

// 논문 신청서: 유형 → 분야 → 주제 → 목차 → 양식 → 연구방법 → 작업
async function paperToTask(p, { type = 'master', title = '간호사의 직무스트레스가 이직의도에 미치는 영향: 회복탄력성의 매개효과' } = {}) {
  await W.open(p, '/paper/new/?detail=1', 'type');
  await W.pick(p, 'paper.typeId', type); await W.go(p, 'field');
  await W.pick(p, 'common.fieldId', 'nursing'); await W.go(p, 'topic');
  await W.pick(p, 'common.topicKnown', 'yes'); await W.fill(p, 'common.title', title); await W.go(p, 'toc');
  await W.pick(p, 'paper.hasToc', 'no'); await W.go(p, 'format');
  await W.pick(p, 'paper.hasFormat', 'no'); await W.go(p, 'method');
  await W.go(p, 'task');
}
async function paperTaskToReview(p, { request = '', contact = {} } = {}) {
  await W.go(p, 'volume'); await W.go(p, 'request');
  if (request) await W.fill(p, 'common.request', request);
  await W.go(p, 'contact'); await fillContact(p, contact); await W.go(p, 'review');
}
async function surveyToMode(p, { purpose = 'master', title = '간호사의 감정노동이 소진에 미치는 영향' } = {}) {
  await W.open(p, '/survey/new/', 'purpose');
  await W.pick(p, 'common.purpose', purpose); await W.go(p, 'topic');
  await W.pick(p, 'common.fieldId', 'nursing'); await W.pick(p, 'common.topicKnown', 'yes'); await W.fill(p, 'common.title', title);
  await W.go(p, 'mode');
}
async function statsToData(p, { purpose = 'degree', title = '중학생의 학업스트레스가 학교적응에 미치는 영향에서 사회적 지지의 조절효과' } = {}) {
  await W.open(p, '/statistics/new/', 'purpose');
  await W.pick(p, 'common.purpose', purpose); await W.go(p, 'topic');
  await W.pick(p, 'common.fieldId', 'edu'); await W.fill(p, 'common.title', title);
  await W.go(p, 'data');
}

// "+N원" 표시가 붙은 선택지를 고르면 금액이 정확히 N원 늘어나고, "별도 견적" 표시는 견적형으로 바뀌는지
async function surchargeLabelsHold(p, name, where) {
  const opts = await p.$$eval(`#wzStep input[data-choice="${name}"]`, (els) => els.map((e) => ({ v: e.value, side: ((e.closest('label').querySelector('.opt-side') || {}).textContent || '').trim(), on: e.checked, multi: e.type === 'checkbox' })));
  const start = opts.filter((o) => o.on).map((o) => o.v);
  await sleep(200); // 오른쪽 견적은 입력 뒤 90ms 지연해서 다시 그려지므로, 기준 금액을 읽기 전에 반영을 기다린다
  const base = parseWon(await W.price(p));
  let checkedAny = 0;
  for (const o of opts) {
    const plus = o.side.match(/^\+([\d,]+)원$/);
    const quote = o.side === '별도 견적';
    if (!plus && !quote) continue;
    checkedAny++;
    await W.pick(p, name, o.v);
    if (plus) await W.waitPrice(p, won(base + parseWon(plus[1])), `${where}: '${o.side}' 표시 선택지(${o.v})를 고른 뒤 금액`);
    if (quote) {
      try { await p.waitForFunction(() => /현재 확정 금액/.test((document.querySelector('#wzSideIn .pl-total') || {}).textContent || ''), null, { timeout: 4000 }); } catch (e) { throw new Error(`${where}: '별도 견적' 표시 선택지(${o.v})를 골랐는데 견적형으로 바뀌지 않음`); }
    }
    for (const v of start) await W.pick(p, name, v);
    if (o.multi && !start.includes(o.v) && (await W.checked(p, name)).includes(o.v)) await W.toggle(p, name, o.v);
    await W.waitPrice(p, won(base), `${where}: 원래 선택으로 되돌린 뒤 금액`);
  }
  return checkedAny;
}

/* =================================================================== 정적 검사(31, 38) */
function walk(dir, exts, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(f))) out.push(full);
  }
  return out;
}
function htmlToText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/li|\/h\d|\/td|\/th|\/tr|\/div|\/dd|\/dt|\/summary|\/caption)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ');
}
function corpus() {
  ok(fs.existsSync(DOCS), `${DOCS}가 없습니다. ./tools/dev-restart.sh를 먼저 실행해 주세요.`);
  const html = walk(DOCS, ['.html']).map((f) => ({ file: path.relative(ROOT, f), text: htmlToText(fs.readFileSync(f, 'utf8')) }));
  const js = walk(path.join(DOCS, 'assets/js'), ['.js']).map((f) => ({ file: path.relative(ROOT, f), text: fs.readFileSync(f, 'utf8') }));
  const txt = ['llms.txt', 'llms-full.txt'].map((f) => path.join(DOCS, f)).filter((f) => fs.existsSync(f)).map((f) => ({ file: path.relative(ROOT, f), text: fs.readFileSync(f, 'utf8') }));
  return [...html, ...js, ...txt];
}
function scan(docs, patterns, isAllowed) {
  const hits = [];
  for (const d of docs) {
    for (const { re, why } of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(d.text))) {
        const ctx = d.text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 60).replace(/\s+/g, ' ');
        const after = d.text.slice(m.index + m[0].length, m.index + m[0].length + 60);
        const before = d.text.slice(Math.max(0, m.index - 40), m.index);
        hits.push({ file: d.file, match: m[0], why, ctx, allowed: isAllowed(m[0], after, before) });
      }
    }
  }
  return hits;
}

/* =================================================================== 1~38, 40 */
async function tests() {
  /* ---------------------------------------------------------------- 1 */
  await check(1, '홈의 서비스 버튼으로 논문·설문·통계 신청서가 각각 열림', async () => {
    for (const [href, h1, first] of [['/paper/new/', '논문 의뢰하기', 'type'], ['/survey/new/', '설문조사 의뢰하기', 'purpose'], ['/statistics/new/', '통계분석 의뢰하기', 'purpose']]) {
      await withCtx({}, async (p) => {
        await p.goto(`${BASE}/`);
        const link = p.locator(`.svc a[href="${href}"]`);
        eq(await link.count(), 1, `홈 서비스 영역의 ${href} 버튼 수`);
        await Promise.all([p.waitForURL(`${BASE}${href}`), link.click()]);
        if (href === '/paper/new/') {
          // 논문은 한 화면 주문서(관심 주제·전공·논문 종류·받을 곳)
          await p.waitForSelector('#qoForm #qoTopic');
          has(await text(p, '.qo-h1'), '주제만 알려 주세요', '논문 주문서 제목');
          return;
        }
        await p.waitForSelector(`#wzStep[data-step="${first}"]`);
        eq(await text(p, '.wz-title h1'), h1, `${href} 신청서 제목`);
      });
    }
  });
  await check(1, '세 신청서는 서로 독립: 주소로 바로 열리고 임시 저장도 따로 관리', async () => withCtx({}, async (p) => {
    await W.open(p, '/paper/new/?detail=1', 'type');
    await W.pick(p, 'paper.typeId', 'doctor');
    await sleep(450);
    for (const [url, first] of [['/statistics/new/', 'purpose'], ['/survey/new/', 'purpose']]) {
      await W.open(p, url, first);
      eq(await p.$('#rsYes'), null, `${url}에 논문 신청서 이어쓰기 안내가 뜸`);
    }
    await W.open(p, '/paper/new/?detail=1', 'type');
    ok(await p.$('#rsYes'), '논문 신청서 임시 저장이 사라짐');
    const keys = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('nm:draft:')).sort());
    eq(keys, ['nm:draft:paper'], '임시 저장 키');
  }));

  /* ---------------------------------------------------------------- 2 */
  await check(2, '신청서 논문 유형 선택지 순서: 석사→박사→학술지→학사→일반→청소년→개인', async () => withCtx({}, async (p) => {
    await W.open(p, '/paper/new/?detail=1', 'type');
    const opts = await p.$$eval('#wzStep input[data-choice="paper.typeId"]', (els) => els.map((e) => [e.value, e.closest('label').querySelector('b').textContent.trim()]));
    eq(opts.map((x) => x[0]), ['master', 'doctor', 'journal', 'bachelor', 'report', 'youth', 'personal', 'short'], '유형 값 순서');
    eq(opts.map((x) => x[1]), ['석사학위논문', '박사학위논문', '학술지 투고논문', '학사·졸업논문', '일반 연구보고서', '청소년 탐구논문', '개인 관심연구', '소논문(15 Page)'], '유형 이름 순서');
  }));
  await check(2, '가격 안내 페이지 논문 표도 같은 순서', async () => withCtx({}, async (p) => {
    await p.goto(`${BASE}/pricing/`);
    const caps = await p.$$eval('table.price-table caption', (els) => els.map((e) => e.textContent.trim()));
    eq(caps.slice(0, 7), ['석사학위논문', '박사학위논문', '학술지 투고논문', '학사·졸업논문', '일반 연구보고서', '청소년 탐구논문', '개인 관심연구'], '가격표 순서');
  }));

  /* ---------------------------------------------------------------- 3~7: 논문 신청서 하나로 접수까지 */
  const paperA = once(() => withCtx({}, async (p) => {
    const f = {};
    await W.open(p, '/paper/new/?detail=1', 'type');
    await W.pick(p, 'paper.typeId', 'master'); await W.go(p, 'field');
    await W.pick(p, 'common.fieldId', 'edu'); await W.go(p, 'topic');
    f.topicErr = await W.blocked(p);
    await W.pick(p, 'common.topicKnown', 'no');
    f.kwVisible = await p.isVisible('#wzStep [data-path="common.keywordsText"]');
    f.titleField = !!(await p.$('#wzStep [data-path="common.title"]'));
    f.kwErr = await W.blocked(p);
    await W.fill(p, 'common.keywordsText', '초등교사, 직무스트레스, 회복탄력성');
    await p.waitForSelector('#suggestLive .rp-cand');
    f.suggestions = await p.$$eval('#suggestLive .rp-cand', (els) => els.length);
    await W.go(p, 'toc');
    // 목차
    f.tocChoiceErr = await W.blocked(p);
    await W.pick(p, 'paper.hasToc', 'yes');
    f.tocDrop = await p.isVisible('#wzStep [data-drop="toc"]');
    f.tocText = await p.isVisible('#wzStep [data-path="paper.tocText"]');
    f.tocErr = await W.blocked(p);
    await W.upload(p, 'toc', [docx('E2E_목차초안.docx')]);
    await W.fill(p, 'paper.tocText', '제1장 서론\n제2장 이론적 배경\n제3장 연구 방법');
    await W.go(p, 'format');
    // 양식
    f.fmtChoiceErr = await W.blocked(p);
    await W.pick(p, 'paper.hasFormat', 'yes');
    f.fmtNameErr = await W.blocked(p);
    await W.fill(p, 'paper.formatName', '○○대학교 교육대학원 학위논문 작성 지침');
    f.fmtFileErr = await W.blocked(p);
    await W.upload(p, 'format', [pdf('E2E_학위논문양식.pdf')]);
    await W.go(p, 'method');
    // 연구방법
    f.methods = await p.$$eval('#wzStep input[data-choice="common.method"]', (els) => els.map((e) => ({ v: e.value, on: e.checked, t: e.closest('label').querySelector('b').textContent.trim(), rec: e.closest('label').classList.contains('is-rec') })));
    await W.go(p, 'task');
    // 작업: 전체 작성 지원
    f.taskErr = await W.blocked(p);
    await W.pick(p, 'paper.task', 'full');
    f.materialsHead = await text(p, '#wzStep [data-up="materials"] .up-hd');
    await W.go(p, 'volume');
    f.passedWithoutMaterials = true;
    await W.back(p, 'task');
    await W.upload(p, 'materials', [docx('E2E_연구계획서초안.docx'), pdf('E2E_선행연구정리.pdf')]);
    await W.go(p, 'volume'); await W.go(p, 'request');
    await W.fill(p, 'common.request', 'E2E 요청: 최근 5년 국내 논문 위주로 부탁드립니다.');
    await W.go(p, 'contact'); await fillContact(p); await W.go(p, 'review');
    f.review = await text(p, '#wzStep');
    f.order = await submitWizard(p);
    f.server = await getOrder(f.order);
    f.files = f.server.files.customer.map((x) => `${x.slot}:${x.name}`).sort();
    return f;
  }));
  await check(3, '주제 모름: 관심 키워드 칸이 나오고 키워드 없이는 넘어가지 않으며 추천 주제가 나타남', async () => {
    const f = await paperA();
    eq(f.topicErr, '주제가 있는지 골라 주세요.', '주제 선택 전 안내');
    ok(f.kwVisible, '관심 키워드 칸이 없음');
    ok(!f.titleField, '주제 모름인데 제목 칸이 나옴');
    eq(f.kwErr, '관심 키워드를 하나 이상 적어 주세요.', '키워드 없이 다음');
    ok(f.suggestions >= 1, '추천 주제가 나타나지 않음');
  });
  await check(3, '주제 모름 주문이 키워드와 함께 서버에 접수됨', async () => {
    const f = await paperA();
    eq(f.server.input.common.topicKnown, 'no', '서버 주제 여부');
    eq(f.server.input.common.keywords, ['초등교사', '직무스트레스', '회복탄력성'], '서버 키워드');
    has(f.review, '추천 주제 요청 (키워드: 초등교사, 직무스트레스, 회복탄력성)', '확인 단계 요약');
  });
  await check(4, '목차 있음: 파일 칸과 직접 입력 칸이 나오고 둘 다 없으면 넘어가지 않음', async () => {
    const f = await paperA();
    eq(f.tocChoiceErr, '목차가 있는지 골라 주세요.', '목차 선택 전 안내');
    ok(f.tocDrop && f.tocText, '목차 파일 칸 또는 직접 입력 칸이 없음');
    eq(f.tocErr, '목차 파일을 올리거나 목차를 직접 입력해 주세요.', '목차 없이 다음');
  });
  await check(4, '목차 파일이 서버에 실제로 올라가고 입력한 목차도 저장됨', async () => {
    const f = await paperA();
    ok(f.files.includes('toc:E2E_목차초안.docx'), `서버 파일에 목차가 없음: ${f.files.join(', ')}`);
    eq(f.server.input.paper.hasToc, 'yes', '서버 목차 여부');
    has(f.server.input.paper.tocText, '제2장 이론적 배경', '서버 목차 내용');
  });
  await check(4, '목차는 파일 없이 직접 입력만으로도 진행', async () => withCtx({}, async (p) => {
    await W.open(p, '/paper/new/?detail=1', 'type');
    await W.pick(p, 'paper.typeId', 'bachelor'); await W.go(p, 'field');
    await W.pick(p, 'common.fieldId', 'edu'); await W.go(p, 'topic');
    await W.pick(p, 'common.topicKnown', 'yes'); await W.fill(p, 'common.title', '초등학생의 독서 습관과 어휘력의 관계'); await W.go(p, 'toc');
    await W.pick(p, 'paper.hasToc', 'yes');
    await W.fill(p, 'paper.tocText', 'Ⅰ. 서론\nⅡ. 이론적 배경');
    await W.go(p, 'format');
  }));
  await check(5, '양식 있음: 학교·학술지 이름과 양식 파일이 각각 없으면 정확히 안내', async () => {
    const f = await paperA();
    eq(f.fmtChoiceErr, '양식이 있는지 골라 주세요.', '양식 선택 전 안내');
    eq(f.fmtNameErr, '학교 또는 학술지 이름을 적어 주세요.', '이름 없이 다음');
    eq(f.fmtFileErr, '양식 파일을 올려 주세요.', '파일 없이 다음');
  });
  await check(5, '양식 파일과 학교·학술지 이름이 서버에 실제로 저장됨', async () => {
    const f = await paperA();
    ok(f.files.includes('format:E2E_학위논문양식.pdf'), `서버 파일에 양식이 없음: ${f.files.join(', ')}`);
    eq(f.server.input.paper.formatName, '○○대학교 교육대학원 학위논문 작성 지침', '서버 양식 이름');
  });
  await check(6, "연구방법: '잘 모르겠어요'가 기본 선택·추천 표시, 첫 구체 선택지는 문헌연구", async () => {
    const f = await paperA();
    eq(f.methods[0].v, 'auto', '첫 선택지');
    ok(f.methods[0].on, "'잘 모르겠어요'가 기본 선택이 아님");
    ok(f.methods[0].rec, "'잘 모르겠어요'에 추천 표시가 없음");
    eq(f.methods.filter((m) => m.on).length, 1, '기본 선택 개수');
    eq(f.methods[1].v, 'literature', '첫 구체 선택지');
    eq(f.methods[1].t, '문헌연구·선행연구 분석', '첫 구체 선택지 이름');
    eq(f.server.input.common.method, 'auto', '서버 연구방법');
  });
  await check(7, '전체 작성 지원: 기존 자료 칸은 선택이고 없이도 진행, 올린 자료는 서버에 실제로 올라감', async () => {
    const f = await paperA();
    eq(f.taskErr, '필요한 작업을 골라 주세요.', '작업 선택 전 안내');
    has(f.materialsHead, '선택', '기존 자료 칸 선택 표시');
    hasNot(f.materialsHead, '*', '기존 자료 칸이 필수로 표시됨');
    ok(f.passedWithoutMaterials, '기존 자료 없이 넘어가지 못함');
    ok(f.files.includes('materials:E2E_연구계획서초안.docx') && f.files.includes('materials:E2E_선행연구정리.pdf'), `서버 자료 파일: ${f.files.join(', ')}`);
    eq(f.server.input.paper.task, 'full', '서버 작업');
  });

  /* ---------------------------------------------------------------- 8 */
  await check(8, '부분 첨삭: 기존 원고(필수)와 수정할 부분이 모두 있어야 진행, 원고는 자동 분석', async () => withCtx({}, async (p) => {
    await paperToTask(p);
    await W.pick(p, 'paper.task', 'edit');
    has(await text(p, '#wzStep [data-up="manuscript"] .up-hd'), '*', '기존 원고 필수 표시');
    ok(await p.isVisible('#wzStep [data-path="paper.editScope"]'), '수정할 부분 입력 칸이 없음');
    await W.blocked(p, '기존 원고 파일을 올려 주세요.');
    await W.fill(p, 'paper.editScope', '2장 문장 다듬기');
    await W.blocked(p, '기존 원고 파일을 올려 주세요.');
    await waitText(p, '#wzSideIn .chk li', '기존 원고');
    ok(!(await p.$('#wzSideIn .chk li.ok:has-text("기존 원고")')), '원고를 올리기 전인데 필수 자료가 충족으로 표시됨');
    await W.fill(p, 'paper.editScope', '');
    const body = Array.from({ length: 8 }, (_, i) => `제${i + 1}장 본문 ${'가나다라마바사아자차카타파하'.repeat(57)}`);
    await W.upload(p, 'manuscript', [await realDocx('E2E_석사논문_심사본.docx', body)]);
    await p.waitForSelector('#docInfo .auto-card');
    has(await text(p, '#docInfo'), '원고 자동 분석', '원고 분석 결과');
    await p.waitForSelector('#wzSideIn .chk li.ok:has-text("기존 원고")');
    await W.blocked(p, '수정할 부분을 적어 주세요. 전체라면 "전체"라고 적어 주세요.');
    await W.fill(p, 'paper.editScope', '2장 이론적 배경 전체와 5장 논의의 문장 다듬기');
    await W.go(p, 'volume');
  }));

  /* ---------------------------------------------------------------- 9 */
  await check(9, '교수 피드백 반영: 원고가 없으면, 피드백(파일·붙여넣기)이 없으면 각각 진행 불가', async () => withCtx({}, async (p) => {
    await paperToTask(p);
    await W.pick(p, 'paper.task', 'feedback');
    await W.blocked(p, '기존 원고 파일을 올려 주세요.');
    await W.fill(p, 'paper.feedbackText', '1. 서론 보강');
    await W.blocked(p, '기존 원고 파일을 올려 주세요.');
    await W.fill(p, 'paper.feedbackText', '');
    await W.upload(p, 'manuscript', [docx('E2E_원고.docx')]);
    await W.blocked(p, '교수님 피드백을 파일로 올리거나 붙여 넣어 주세요.');
    await W.upload(p, 'feedback', [png('E2E_교수님메모.png')]);
    await W.go(p, 'volume');
    await W.back(p, 'task');
    await W.del(p, 'feedback', 'E2E_교수님메모.png');
    await W.blocked(p, '교수님 피드백을 파일로 올리거나 붙여 넣어 주세요.');
    await W.fill(p, 'paper.feedbackText', '1. 연구의 필요성에 최근 자료를 보완할 것\n2. 통제변수 선정 근거를 추가할 것\n3. 표 4-2 소수점 자리를 통일할 것');
    await waitText(p, '#fbLive', '피드백 3개 항목');
    await W.go(p, 'volume');
  }));

  /* ---------------------------------------------------------------- 10, 14, 15, 23: 설문 처음부터 끝까지 + 모집 의뢰 */
  const surveyS = once(() => withCtx({}, async (p) => {
    const f = {};
    await surveyToMode(p);
    await W.pick(p, 'survey.mode', 'full');
    f.fullNote = await text(p, '#wzStep .note');
    await W.go(p, 'materials');
    f.planErr = await W.blocked(p);
    await W.pick(p, 'survey.hasPlan', 'no'); await W.pick(p, 'survey.hasQuestionnaire', 'no');
    await W.go(p, 'target'); await W.go(p, 'targetN');
    f.nDefault = await W.checked(p, 'survey.targetN');
    f.nOpts = await p.$$eval('#wzStep input[data-choice="survey.targetN"]', (els) => els.map((e) => e.closest('label').querySelector('b').textContent.trim()));
    await W.go(p, 'recruit');
    f.nPassed = true;
    f.recruitErr = await W.blocked(p);
    await W.pick(p, 'survey.recruit', 'us');
    f.recruitNote = await text(p, '#wzStep .note');
    await waitText(p, '#wzSideIn', '응답자 모집·배포 대행');
    f.side = await W.side(p);
    f.sideTotalLabel = await text(p, '#wzSideIn .pl-total span');
    f.mbar = await text(p, '#wzMbar');
    await W.go(p, 'analysis'); await W.go(p, 'deliver');
    f.deliverables = await p.$$eval('#wzStep ul.chk li', (els) => els.map((e) => e.textContent.trim()));
    await W.go(p, 'contact'); await fillContact(p, { irb: true }); await W.go(p, 'review');
    f.submitLabel = await text(p, '#wzNext');
    f.order = await submitWizard(p);
    await p.waitForSelector('.pg-wrap .card');
    f.checkout = await text(p, '#app');
    f.payButtons = await p.$$eval('#skkcDone, #skkcGo, #bankDone, #tossPay', (els) => els.length);
    f.server = await getOrder(f.order);
    await p.goto(`${BASE}/orders/?o=${f.order.orderNo}`);
    await p.waitForSelector('.ord-card');
    f.ordersPay = await p.$$eval('a[href*="/checkout/"]', (els) => els.length);
    f.ordersHead = await text(p, '.ord-card');
    f.claim = await rawApi('claimPayment', { orderNo: f.order.orderNo, token: f.order.token, method: 'skkc', payerName: '테스트' });
    return f;
  }));
  await check(10, '처음부터 끝까지: 설계·모집(응답 수집)·분석·해석 범위를 안내하고 결과물에 반영', async () => {
    const f = await surveyS();
    for (const w of ['설문지 작성부터 통계 해석까지 범위', '설문지 작성', '응답 수집', '모집', '통계분석', '해석']) has(f.fullNote, w, '범위 안내');
    for (const d of ['설문지(Word)', '익명화 응답 데이터', 'APA 형식 통계표', '논문 맞춤 결과 해석', '연구결과 정리']) ok(f.deliverables.includes(d), `받을 결과물에 "${d}" 없음: ${f.deliverables.join(', ')}`);
    eq(f.planErr, '연구계획서가 있는지 골라 주세요.', '자료 단계 안내');
  });
  await check(14, "응답 수 '잘 모르겠어요'가 기본이고 그대로 다음 단계로 진행·접수", async () => {
    const f = await surveyS();
    eq(f.nDefault, ['auto'], '응답 수 기본 선택');
    has(f.nOpts[0], '잘 모르겠어요', '첫 선택지');
    ok(f.nPassed, '응답 수 모름으로 넘어가지 못함');
    eq(f.server.input.survey.targetN, 'auto', '서버 응답 수');
    has(f.checkout, '추천 받기', '주문 내용 표의 목표 응답 수');
  });
  await check(15, '응답자 모집 의뢰: 모집 비용은 견적 후 안내로 따로 표시되고 견적 요청으로 접수', async () => {
    const f = await surveyS();
    eq(f.recruitErr, '응답 수집 방법을 골라 주세요.', '수집 방법 선택 전 안내');
    has(f.recruitNote, '확정 견적', '모집 의뢰 안내');
    has(f.recruitNote, '모집 비용', '모집 의뢰 안내');
    has(f.side, '견적 후 안내', '오른쪽 견적의 모집 줄');
    eq(f.sideTotalLabel, '현재 확정 금액', '합계 이름');
    has(f.mbar, '견적 후 확정', '모바일 요약');
    eq(f.submitLabel, '견적 요청하기', '제출 버튼');
    eq(f.server.status, 'quote_requested', '서버 상태');
    ok(f.server.quoteRequired, '서버 견적 필요 표시');
    ok(f.server.quote.lines.some((l) => l.code === 'S-RECRUIT' && l.pending), '서버 견적의 모집 줄');
  });
  await check(23, '견적형 주문: 결제 화면·주문 화면에 결제 버튼이 없고 결제 요청도 거부', async () => {
    const f = await surveyS();
    eq(f.payButtons, 0, '결제 화면의 결제 버튼 수');
    has(f.checkout, '확정되지 않은 금액은 결제할 수 없습니다', '결제 화면 안내');
    eq(f.ordersPay, 0, '주문 화면의 결제하기 링크 수');
    has(f.ordersHead, '확정 견적', '주문 화면 안내');
    eq(f.server.amountDue, 0, '서버 결제 요청 금액');
    eq(f.server.allow.pay, false, '서버 결제 허용');
    eq(f.claim.error, 'no_payment', '결제 완료 알림 API');
  });
  await check(23, '운영자가 견적을 확정해야 그 금액으로 결제 화면이 열림', async () => {
    const f = await surveyS();
    await withCtx({ admin: true }, async (ap) => {
      await ap.goto(`${BASE}/admin/#order=${f.order.orderNo}`);
      await ap.waitForSelector('.ad-next [data-act="quote"]');
      await ap.click('.ad-next [data-act="quote"]');
      await ap.fill('.modal [name="total"]', '549000');
      await ap.fill('.modal [name="days"]', '10');
      await ap.fill('.modal [name="message"]', '간호사 200명 모집 포함 견적입니다.');
      await ap.click('.modal [data-ok]');
      await toast(ap, '견적을 보냈습니다.');
    });
    await withCtx({}, async (p) => {
      await p.goto(checkoutUrl(f.order));
      await p.waitForSelector('#skkcDone');
      has(await text(p, '#app'), '549,000원', '확정 금액');
    });
  });
  await check(23, '구조방정식처럼 조건에 따라 달라지는 분석도 견적 요청으로 접수', async () => withCtx({}, async (p) => {
    await statsToData(p);
    await W.pick(p, 'statistics.hasData', 'yes'); await W.upload(p, 'data', [csv()]);
    await W.go(p, 'methods');
    await W.pick(p, 'statistics.methods', 'sem');
    has(await text(p, '#wzStep'), '확정 견적을 드리고, 확정 전에는 결제하지 않습니다', '구조방정식 안내');
    await waitText(p, '#wzSideIn .pl-total', '현재 확정 금액');
    await W.go(p, 'output'); await W.pick(p, 'statistics.output', 'interp');
    await W.go(p, 'detail'); await W.go(p, 'contact'); await fillContact(p); await W.go(p, 'review');
    eq(await text(p, '#wzNext'), '견적 요청하기', '제출 버튼');
  }));

  /* ---------------------------------------------------------------- 11, 12 */
  await check(11, '설문지 수정: 기존 설문지(필수)가 없으면 진행 불가', async () => withCtx({}, async (p) => {
    await surveyToMode(p);
    await W.pick(p, 'survey.mode', 'edit'); await W.go(p, 'materials');
    has(await text(p, '#wzStep [data-up="questionnaire"] .up-hd'), '*', '기존 설문지 필수 표시');
    await W.blocked(p, '기존 설문지 파일을 올려 주세요.');
    await W.upload(p, 'questionnaire', [docx('E2E_기존설문지.docx')]);
    await W.go(p, 'target');
  }));
  await check(11, '서버도 기존 설문지 없는 설문지 수정 주문은 빠진 자료 이름으로 거부', async () => {
    const x = await makeOrder({ service: 'survey', input: { common: { fieldId: 'edu' }, survey: { mode: 'edit', recruit: 'none' }, addons: {} }, submit: false });
    const r = await rawApi('submitOrder', { orderNo: x.orderNo, token: x.token });
    eq([r.error, r.message], ['missing_files', '필수 자료가 빠졌습니다: 기존 설문지 파일'], '서버 응답');
  });
  const surveyFb = once(() => withCtx({}, async (p) => {
    const f = {};
    await surveyToMode(p);
    await W.pick(p, 'survey.mode', 'feedback'); await W.go(p, 'materials');
    f.qErr = await W.blocked(p);
    await W.fill(p, 'survey.feedbackText', '1. 인구통계 문항 축소');
    f.qErr2 = await W.blocked(p);
    await W.fill(p, 'survey.feedbackText', '');
    await W.upload(p, 'questionnaire', [docx('E2E_설문지_심사본.docx')]);
    f.fbErr = await W.blocked(p);
    await W.fill(p, 'survey.feedbackText', '1. 인구통계 문항을 줄일 것\n2. 역문항 표시를 추가할 것');
    await waitText(p, '#fbLive', '피드백 2개 항목');
    await W.go(p, 'target'); await W.go(p, 'targetN'); await W.go(p, 'recruit');
    await W.pick(p, 'survey.recruit', 'self');
    await W.go(p, 'deliver'); await W.go(p, 'contact'); await fillContact(p, { irb: true }); await W.go(p, 'review');
    f.order = await submitWizard(p);
    f.server = await getOrder(f.order);
    return f;
  }));
  await check(12, '설문 피드백 반영: 설문지가 없으면, 의견이 없으면 각각 진행 불가', async () => {
    const f = await surveyFb();
    eq(f.qErr, '기존 설문지 파일을 올려 주세요.', '설문지 없이 다음');
    eq(f.qErr2, '기존 설문지 파일을 올려 주세요.', '의견만 있고 설문지 없이 다음');
    eq(f.fbErr, '교수님 피드백을 파일로 올리거나 붙여 넣어 주세요.', '의견 없이 다음');
  });
  await check(12, '설문지 파일과 의견이 서버에 함께 접수됨', async () => {
    const f = await surveyFb();
    ok(f.server.files.customer.some((x) => x.slot === 'questionnaire' && x.name === 'E2E_설문지_심사본.docx'), '서버에 설문지 없음');
    has(f.server.input.survey.feedbackText, '역문항 표시', '서버 의견');
    eq(f.server.status, 'pending_payment', '서버 상태');
  });

  /* ---------------------------------------------------------------- 13 */
  await check(13, '모은 응답 분석: 실제 데이터 파일이 없으면 진행 불가, 데이터 형식이 아니면 거부', async () => withCtx({}, async (p) => {
    await surveyToMode(p);
    await W.pick(p, 'survey.mode', 'analyze'); await W.go(p, 'materials');
    has(await text(p, '#wzStep [data-up="data"] .up-hd'), '*', '데이터 필수 표시');
    await W.blocked(p, '실제 응답 데이터 파일을 올려 주세요.');
    const e = await W.upload(p, 'data', [docx('E2E_응답정리.docx')], { expect: 'error' });
    has(e, '허용되지 않는 형식입니다(.docx)', '데이터 칸 형식 안내');
    eq(await W.count(p, 'data'), 0, '거부된 파일이 목록에 남음');
    await W.blocked(p, '실제 응답 데이터 파일을 올려 주세요.');
    await W.upload(p, 'data', [csv('E2E_응답원자료.csv')]);
    await W.go(p, 'analysis');
  }));
  await check(13, '서버도 응답 데이터 없는 분석 주문은 빠진 자료 이름으로 거부', async () => {
    const x = await makeOrder({ service: 'survey', input: { common: { fieldId: 'edu' }, survey: { mode: 'analyze' }, addons: {} }, submit: false });
    const r = await rawApi('submitOrder', { orderNo: x.orderNo, token: x.token });
    eq(r.error, 'missing_files', '오류 코드');
    has(r.message, '실제 응답 데이터 파일', '오류 문구');
  });

  /* ---------------------------------------------------------------- 16, 17 */
  await check(16, '데이터 있음: 데이터 파일 없이는 진행 불가, 데이터 형식만 허용, 올리면 자동 진단', async () => withCtx({}, async (p) => {
    await statsToData(p);
    await W.blocked(p, '데이터가 있는지 골라 주세요.');
    await W.pick(p, 'statistics.hasData', 'yes');
    await W.blocked(p, '데이터 파일을 올려 주세요.');
    const e = await W.upload(p, 'data', [pdf('E2E_데이터.pdf')], { expect: 'error' });
    has(e, '허용되지 않는 형식입니다(.pdf)', '데이터 칸 형식 안내');
    await W.upload(p, 'data', [csv('E2E_설문응답.csv')]);
    await p.waitForSelector('#diag .data-diag');
    has(await text(p, '#diag'), '24명', '자동 진단 응답 수');
    await W.go(p, 'methods');
  }));
  await check(16, '서버도 데이터 파일 없는 통계 주문은 거부', async () => {
    const x = await makeOrder({ service: 'statistics', input: { common: { fieldId: 'edu' }, statistics: { hasData: true, output: 'interp', methods: ['auto'] }, addons: {} }, submit: false });
    const r = await rawApi('submitOrder', { orderNo: x.orderNo, token: x.token });
    eq(r.error, 'missing_files', '오류 코드');
    has(r.message, '데이터 파일', '오류 문구');
  });
  await check(17, '데이터 없음: 실제 응답 조사와 학습용 시뮬레이션이 다른 선택지·안내·가격으로 나뉨', async () => withCtx({}, async (p) => {
    await statsToData(p);
    await W.pick(p, 'statistics.hasData', 'no');
    const opts = await p.$$eval('#wzStep input[data-choice="statistics.noDataPath"]', (els) => els.map((e) => [e.value, e.closest('label').querySelector('b').textContent.trim()]));
    eq(opts, [['survey', '실제 응답 조사부터 의뢰'], ['simulation', '연습·방법 확인용 시뮬레이션']], '진행 방법 선택지');
    await W.blocked(p, '진행 방법을 골라 주세요.');
    await W.pick(p, 'statistics.noDataPath', 'simulation');
    const simNote = await text(p, '#wzStep .note-pen');
    has(simNote, '가상 데이터, 실제 연구 결과 아님', '시뮬레이션 안내');
    has(simNote, '실제로 수집한 결과처럼 제출하거나', '시뮬레이션 사용 제한');
    await W.waitPrice(p, '19,000원', '시뮬레이션 금액');
    has(await W.side(p), '학습용 시뮬레이션', '오른쪽 표시');
    await W.pick(p, 'statistics.noDataPath', 'survey');
    hasNot(await text(p, '#wzStep'), '가상 데이터, 실제 연구 결과 아님', '실제 조사 선택인데 가상 데이터 안내');
    has(await text(p, '#wzStep .cond'), '응답 수집', '실제 조사 안내');
    ok(await p.$('#wzStep a[href="/survey/new/"]'), '설문조사 신청서 링크 없음');
    await waitText(p, '#wzSideIn .pl-total', '현재 확정 금액');
    has(await W.side(p), '실제 응답 조사부터', '견적 사유');
    await W.go(p, 'detail');
    await W.back(p, 'data');
    await W.pick(p, 'statistics.noDataPath', 'simulation');
    await W.go(p, 'methods'); await W.go(p, 'detail');
  }));

  /* ---------------------------------------------------------------- 18, 19: 시뮬레이션 주문 */
  const simA = once(() => withCtx({}, async (p) => {
    const f = {};
    await statsToData(p, { purpose: 'study', title: '대학생의 스마트폰 이용 시간과 수면의 질의 관계' });
    // 먼저 데이터 있음 → 논문 결과장을 골랐다가 데이터 없음(시뮬레이션)으로 바꾼 경우
    await W.pick(p, 'statistics.hasData', 'yes'); await W.upload(p, 'data', [csv('E2E_임시.csv')]);
    await W.go(p, 'methods'); await W.go(p, 'output'); await W.pick(p, 'statistics.output', 'chapter');
    await W.back(p, 'methods'); await W.back(p, 'data');
    await W.pick(p, 'statistics.hasData', 'no'); await W.pick(p, 'statistics.noDataPath', 'simulation');
    await W.go(p, 'methods'); await W.go(p, 'detail'); await W.go(p, 'contact');
    await fillContact(p);
    f.simConsentText = await text(p, '#wzStep');
    f.simErr = await W.blocked(p);
    await p.check('#wzStep [data-bool="consents.simulation"]');
    await W.go(p, 'review');
    f.reviewSim = await text(p, '#wzStep .sim-mark').catch(() => '');
    f.order = await submitWizard(p);
    f.checkoutSim = await text(p, '.ord-card .sim-mark, .card .sim-mark').catch(() => '');
    f.server = await getOrder(f.order);
    return f;
  }));
  const simDelivered = once(async () => {
    const f = await simA();
    const g = {};
    await adminApi('adminConfirmPayment', { orderNo: f.order.orderNo });
    await withCtx({ admin: true, clipboard: true }, async (ap) => {
      await ap.goto(`${BASE}/admin/#order=${f.order.orderNo}`);
      await ap.waitForSelector('#briefText');
      g.adminHead = await text(ap, '.ad-ohead');
      g.brief = await ap.textContent('#briefText');
      await ap.click('[data-tab="prompts"]');
      g.prompts = await text(ap, '.ad-tabbody');
      await ap.click('[data-tab="files"]');
      g.filesNote = await text(ap, '#resultDrop');
      await ap.setInputFiles('#resultPick', [xlsx('analysis_result.xlsx')]);
      await toast(ap, '결과물 1개를 올렸습니다.');
      await waitText(ap, '.ad-files .fn', 'analysis_result.xlsx');
      g.adminFiles = await ap.$$eval('.ad-files .fn', (els) => els.map((e) => e.textContent));
      await ap.click('.ad-next [data-act="deliver"]');
      await ap.click('.modal [data-ok]');
      await toast(ap, '전달 완료로 바꿨습니다.');
    });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(f.order));
      await p.waitForSelector('#results [data-dl]');
      g.ordersSim = await text(p, '.ord-card .sim-mark');
      g.results = await text(p, '#results');
      g.resultNames = await p.$$eval('#results .fn', (els) => els.map((e) => e.textContent));
      g.download = await downloadVia(p, '#results [data-dl]');
      g.next = await p.$$eval('.next-svc a', (els) => els.map((a) => `${a.getAttribute('href')}|${a.textContent}`));
      g.page = await text(p, '#app');
    });
    return g;
  });
  await check(18, '시뮬레이션은 사용 제한 동의 없이 제출 불가, 확인 단계에 가상 데이터 표시', async () => {
    const f = await simA();
    has(f.simConsentText, '[필수] 가상 데이터 사용 제한 확인', '동의 항목');
    eq(f.simErr, '가상 데이터 사용 제한을 확인해 주세요.', '동의 없이 다음');
    eq(f.reviewSim, '가상 데이터, 실제 연구 결과 아님', '확인 단계 표시');
  });
  await check(18, '시뮬레이션 주문의 결제 화면·주문 화면·운영자 화면에 가상 데이터 표시', async () => {
    const f = await simA();
    const g = await simDelivered();
    eq(f.checkoutSim, '가상 데이터, 실제 연구 결과 아님', '결제 화면 표시');
    eq(g.ordersSim, '가상 데이터, 실제 연구 결과 아님', '주문 화면 표시');
    has(g.adminHead, '가상 데이터', '운영자 주문 머리');
    has(g.brief, '시뮬레이션 주의', '작업지시문');
    has(g.brief, '"가상 데이터, 실제 연구 결과 아님" 표시', '작업지시문 표시 지시');
  });
  await check(18, '시뮬레이션 결과 파일 이름에 가상 데이터 표시가 붙고 고객 화면에도 안내', async () => {
    const g = await simDelivered();
    has(g.filesNote, '[가상데이터_실제연구결과아님]', '운영자 업로드 칸 안내');
    ok(g.adminFiles.includes('[가상데이터_실제연구결과아님] analysis_result.xlsx'), `운영자 결과물 이름: ${g.adminFiles.join(', ')}`);
    eq(g.resultNames, ['[가상데이터_실제연구결과아님] analysis_result.xlsx'], '고객 결과물 이름');
    ok(g.download.name.startsWith('[가상데이터_실제연구결과아님]'), `내려받은 파일 이름: ${g.download.name}`);
    has(g.results, '학습용 시뮬레이션 결과입니다', '결과물 안내');
  });
  await check(19, '시뮬레이션 결과를 표시 없이 내려받거나 논문 결과로 옮기라는 경로가 없음', async () => {
    const g = await simDelivered();
    ok(g.resultNames.every((n) => n.startsWith('[가상데이터_실제연구결과아님]')), '표시 없는 결과 파일이 있음');
    ok(!g.next.some((x) => x.startsWith('/paper/new/')), `시뮬레이션 주문에 논문 작성 연결이 보임: ${g.next.join(' / ')}`);
    hasNot(g.page, '분석 결과를 본문 장으로', '시뮬레이션 결과를 논문 본문으로 옮기라는 안내');
    has(g.prompts, '가상 데이터, 실제 연구 결과 아님', 'AI 작업 프롬프트의 표시 지시');
  });
  await check(19, '데이터 있음에서 고른 "논문 결과장" 선택이 시뮬레이션 주문에 남지 않음', async () => {
    const f = await simA();
    const g = await simDelivered();
    hasNot(g.brief, '연구결과(4장)', '시뮬레이션 작업지시문');
    ok(f.server.input.statistics.output !== 'chapter', `서버에 저장된 결과물 형태: ${f.server.input.statistics.output}`);
  });
  await check(19, "'데이터 있음'에서 올렸던 파일은 시뮬레이션으로 바꾸면 주문에 붙지 않음", async () => {
    const f = await simA();
    eq(((f.server.files || {}).customer || []).map((x) => x.name), [], '시뮬레이션 주문에 붙은 고객 파일');
  });

  /* ---------------------------------------------------------------- 20, 21 */
  await check(20, "분석 방법 '잘 모르겠어요'가 기본이고 그대로 주문이 접수됨", async () => withCtx({}, async (p) => {
    await statsToData(p);
    await W.pick(p, 'statistics.hasData', 'yes'); await W.upload(p, 'data', [csv('E2E_응답.csv')]);
    await W.go(p, 'methods');
    eq(await W.checked(p, 'statistics.methods'), ['auto'], '기본 선택');
    await W.pick(p, 'statistics.methods', 'correg');
    eq(await W.checked(p, 'statistics.methods'), ['correg'], '구체 방법을 고르면 모름 해제');
    await W.pick(p, 'statistics.methods', 'auto');
    eq(await W.checked(p, 'statistics.methods'), ['auto'], '모름을 다시 고르면 나머지 해제');
    await W.go(p, 'output'); await W.pick(p, 'statistics.output', 'interp');
    await W.go(p, 'detail'); await W.go(p, 'contact'); await fillContact(p); await W.go(p, 'review');
    eq(await text(p, '#wzNext'), '주문서 제출하기', '제출 버튼');
    const order = await submitWizard(p);
    has(await text(p, '#app'), '잘 모르겠어요 (추천)', '주문 내용의 분석 방법');
    const o = await getOrder(order);
    eq(o.input.statistics.methods, ['auto'], '서버 분석 방법');
    eq(o.status, 'pending_payment', '서버 상태');
  }));
  await check(21, '기존 분석 수정·교수 피드백: 데이터·기존 결과·의견을 모두 확인하고 서버에 함께 접수', async () => withCtx({}, async (p) => {
    await statsToData(p);
    await W.pick(p, 'statistics.hasData', 'yes'); await W.upload(p, 'data', [csv('E2E_원자료.csv')]);
    await W.go(p, 'methods'); await W.go(p, 'output');
    await W.pick(p, 'statistics.output', 'revise');
    await waitText(p, '#wzSideIn', '기존 분석 결과');
    await W.blocked(p, '기존 분석 결과 파일을 올려 주세요.');
    await W.upload(p, 'prevResult', [file('E2E_기존분석.spv', zipBytes())]);
    await W.blocked(p, '교수님 의견을 파일로 올리거나 붙여 넣어 주세요.');
    await W.fill(p, 'statistics.feedbackText', '1. 위계적 회귀분석으로 다시 할 것\n2. 효과크기를 함께 보고할 것');
    try {
      await p.waitForFunction((want) => { const got = [...document.querySelectorAll('#wzSideIn .chk li.ok')].map((e) => e.textContent.trim()); return want.every((k) => got.includes(k)); }, ['데이터 파일', '기존 분석 결과', '교수님 의견'], { timeout: 5000 });
    } catch (e) {
      throw new Error(`필수 자료 목록이 모두 충족으로 바뀌지 않음: ${await p.$$eval('#wzSideIn .chk li.ok', (els) => els.map((x) => x.textContent.trim()).join(', '))}`);
    }
    await W.waitPrice(p, '39,000원', '기존 분석 수정 금액');
    await W.go(p, 'detail'); await W.go(p, 'contact'); await fillContact(p); await W.go(p, 'review');
    const order = await submitWizard(p);
    const o = await getOrder(order);
    const slots = o.files.customer.map((x) => x.slot).sort();
    eq(slots, ['data', 'prevResult'], '서버 파일 종류');
    eq(o.input.statistics.output, 'revise', '서버 결과물 형태');
    has(o.input.statistics.feedbackText, '효과크기', '서버 의견');
    const brief = (await adminOrder(order.orderNo));
    ok(brief.files.customer.length === 2, '운영자 화면 파일 수');
  }));
  await check(21, '서버도 기존 결과·교수 의견이 빠진 분석 수정 주문은 빠진 자료 이름으로 거부', async () => {
    const x = await makeOrder({ service: 'statistics', input: { common: { fieldId: 'edu' }, statistics: { hasData: true, output: 'revise', methods: ['auto'] }, addons: {} }, files: [{ slot: 'data', ...csv() }], submit: false });
    const r = await rawApi('submitOrder', { orderNo: x.orderNo, token: x.token });
    eq([r.error, r.message], ['missing_files', '필수 자료가 빠졌습니다: 기존 분석 결과 파일, 교수님 의견(파일 또는 붙여넣기)'], '서버 응답');
  });

  /* ---------------------------------------------------------------- 22 */
  await check(22, '논문: 유형·작업·분량·옵션을 바꿀 때마다 견적과 모바일 요약 금액이 바로 바뀜', async () => withCtx({}, async (p) => {
    await W.open(p, '/paper/new/?detail=1', 'type');
    for (const [t, price] of [['master', '99,000원'], ['doctor', '199,000원'], ['journal', '99,000원'], ['youth', '39,000원'], ['master', '99,000원']]) {
      await W.pick(p, 'paper.typeId', t);
      await W.waitPrice(p, price, `${t} 유형 금액`);
      eq(await W.mbar(p), price, `${t} 유형 모바일 요약 금액`);
    }
    await W.go(p, 'field'); await W.pick(p, 'common.fieldId', 'edu'); await W.go(p, 'topic');
    await W.pick(p, 'common.topicKnown', 'yes'); await W.fill(p, 'common.title', '교사의 직무스트레스와 소진의 관계'); await W.go(p, 'toc');
    await W.pick(p, 'paper.hasToc', 'no'); await W.go(p, 'format'); await W.pick(p, 'paper.hasFormat', 'no'); await W.go(p, 'method'); await W.go(p, 'task');
    for (const [task, price] of [['edit', '49,000원'], ['feedback', '59,000원'], ['proposal', '69,000원'], ['full', '99,000원']]) {
      await W.pick(p, 'paper.task', task);
      await W.waitPrice(p, price, `${task} 작업 금액`);
    }
    await W.go(p, 'volume');
    await W.pick(p, 'paper.pagesMode', 'custom'); await W.fill(p, 'paper.pages', '85');
    await W.waitPrice(p, '118,000원', '85 Page(기준 80 Page + 10 Page 단위 1개)');
    await p.check('#wzStep [data-bool="addons.priority"]'); await W.waitPrice(p, '147,000원', '우선 처리 추가');
    await p.selectOption('#wzStep [data-path="addons.revisions"]', '1'); await W.waitPrice(p, '166,000원', '추가 수정 1회');
    await p.check('#wzStep [data-bool="addons.format"]'); await W.waitPrice(p, '185,000원', '양식 상세 적용');
    await p.uncheck('#wzStep [data-bool="addons.priority"]'); await W.waitPrice(p, '156,000원', '우선 처리 해제');
    eq(await W.mbar(p), '156,000원', '모바일 요약 금액');
  }));
  await check(22, '설문: 의뢰 유형을 바꾸면 견적이 바뀌고, "+금액" 표시는 실제로 그만큼 더해짐', async () => withCtx({}, async (p) => {
    await surveyToMode(p);
    for (const [mode, price] of [['full', '129,000원'], ['new', '39,000원'], ['edit', '29,000원'], ['analyze', '69,000원']]) {
      await W.pick(p, 'survey.mode', mode); await W.waitPrice(p, price, `${mode} 유형 금액`);
    }
    await W.go(p, 'materials'); await W.upload(p, 'data', [csv()]); await W.go(p, 'analysis');
    ok(await surchargeLabelsHold(p, 'survey.analysis', '모은 응답 분석') >= 1, '모은 응답 분석의 심화 분석에 추가 금액 표시가 없음');
    await W.back(p, 'materials'); await W.back(p, 'mode');
    await W.pick(p, 'survey.mode', 'full'); await W.go(p, 'materials');
    await W.pick(p, 'survey.hasPlan', 'no'); await W.pick(p, 'survey.hasQuestionnaire', 'no');
    await W.go(p, 'target'); await W.go(p, 'targetN'); await W.go(p, 'recruit'); await W.pick(p, 'survey.recruit', 'self');
    await W.go(p, 'analysis');
    await surchargeLabelsHold(p, 'survey.analysis', '처음부터 끝까지');
    await W.go(p, 'deliver');
    await p.check('#wzStep [data-bool="addons.priority"]'); await W.waitPrice(p, '158,000원', '설문 우선 처리');
  }));
  await check(22, '통계: 결과물·분석 방법을 바꾸면 견적이 바뀌고, "+금액"·"별도 견적" 표시가 실제 견적과 일치', async () => withCtx({}, async (p) => {
    await statsToData(p);
    await W.pick(p, 'statistics.hasData', 'yes'); await W.upload(p, 'data', [csv()]);
    await W.waitPrice(p, '69,000원', '데이터 있음 기본 금액');
    await W.go(p, 'methods');
    ok(await surchargeLabelsHold(p, 'statistics.methods', '데이터 있음 분석 방법') >= 2, '매개·조절 또는 구조방정식 표시가 없음');
    await W.go(p, 'output');
    for (const [o, price] of [['table', '49,000원'], ['chapter', '99,000원'], ['revise', '39,000원'], ['interp', '69,000원']]) { await W.pick(p, 'statistics.output', o); await W.waitPrice(p, price, `${o} 결과물 금액`); }
    await W.back(p, 'methods'); await W.back(p, 'data');
    await W.pick(p, 'statistics.hasData', 'no'); await W.pick(p, 'statistics.noDataPath', 'simulation');
    await W.waitPrice(p, '19,000원', '시뮬레이션 금액');
    await W.go(p, 'methods');
    await surchargeLabelsHold(p, 'statistics.methods', '시뮬레이션 분석 방법');
  }));

  /* ---------------------------------------------------------------- 24 */
  await check(24, '결제 뒤 필수 자료가 빠졌으면 빠진 자료 이름을 안내하고, 올린 뒤에만 보완 완료 처리', async () => {
    const x = await makeOrder({ input: paperIn({ task: 'edit', paper: { editScope: '전체' } }), files: [{ slot: 'manuscript', ...docx('E2E_심사본.docx') }] });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('#myfiles [data-rm]');
      await p.click('#myfiles [data-rm]');
      await p.click('.modal #rmOk');
      await toast(p, '파일을 삭제했습니다.');
      await p.waitForFunction(() => !document.querySelector('#myfiles [data-rm]'));
      await api('claimPayment', { orderNo: x.orderNo, token: x.token, method: 'skkc', payerName: '테스트' });
      await p.reload();
      await p.waitForSelector('#materials');
      has(await text(p, '#materials'), '기존 원고 파일', '자료 보완 카드');
      eq(await p.$eval('#matSlot', (e) => e.value), 'manuscript', '자료 종류 기본값');
      await p.click('#matDone');
      await toast(p, '아직 필요한 자료가 있습니다: 기존 원고 파일');
      ok(await p.$eval('#matDone', (b) => !b.disabled), '실패한 뒤 보완 완료 버튼이 계속 비활성 상태');
      await p.setInputFiles('#matFile', [docx('E2E_심사본_다시.docx')]);
      await toast(p, '1개 파일을 올렸습니다.');
      await p.waitForSelector('#materials #matDone:not([disabled])');
      await p.click('#matDone');
      await toast(p, '보완 자료 제출을 알렸습니다');
      await waitText(p, '.ord-card .status-pill', '자료 확인');
    });
  });
  await check(24, '서버도 빠진 필수 자료를 이름으로 안내(첨삭 원고·피드백)', async () => {
    const a = await makeOrder({ input: paperIn({ task: 'edit' }), submit: false });
    let r = await rawApi('submitOrder', { orderNo: a.orderNo, token: a.token });
    eq(r.error, 'missing_files', '첨삭 오류 코드');
    eq(r.message, '필수 자료가 빠졌습니다: 기존 원고 파일', '첨삭 오류 문구');
    const b = await makeOrder({ input: paperIn({ task: 'feedback' }), submit: false });
    r = await rawApi('submitOrder', { orderNo: b.orderNo, token: b.token });
    eq(r.message, '필수 자료가 빠졌습니다: 기존 원고 파일, 교수님 피드백(파일 또는 붙여넣기)', '피드백 오류 문구');
  });

  /* ---------------------------------------------------------------- 25 */
  await check(25, '신청서 파일 칸: 실행 파일·20MB 초과·빈 파일은 올라가지 않고 이유를 안내', async () => withCtx({}, async (p) => {
    await paperToTask(p);
    await W.pick(p, 'paper.task', 'full');
    let e = await W.upload(p, 'materials', [file('virus.exe', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100, 1)]))], { expect: 'error' });
    has(e, '허용되지 않는 형식입니다(.exe)', '실행 파일');
    e = await W.upload(p, 'materials', [file('big.pdf', Buffer.alloc(21 * 1024 * 1024, 1))], { expect: 'error' });
    has(e, '20MB를 넘는 파일입니다', '용량 초과');
    e = await W.upload(p, 'materials', [file('empty.docx', Buffer.alloc(0))], { expect: 'error' });
    has(e, '빈 파일입니다', '빈 파일');
    eq(await W.count(p, 'materials'), 0, '거부된 파일이 목록에 남음');
    e = await W.upload(p, 'materials', [docx('E2E_정상.docx'), file('script.js', Buffer.from('alert(1)'))], { expect: 1 });
    has(e, 'script.js', '섞어 올린 파일 중 거부된 파일 안내');
    eq(await W.names(p, 'materials'), ['E2E_정상.docx'], '허용된 파일만 남음');
  }));
  await check(25, '서버도 허용되지 않은 형식·20MB 초과·빈 파일을 거부(화면 검사를 거치지 않은 요청)', async () => {
    const x = await makeOrder({ input: paperIn(), submit: false });
    const up = (name, buf, slot = 'materials') => rawApi('uploadFile', { orderNo: x.orderNo, token: x.token, slot, name, mime: 'application/octet-stream', data: B64(buf) });
    eq((await up('virus.exe', Buffer.from('MZxxxx'))).error, 'file_type', '실행 파일');
    eq((await up('big.pdf', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(20 * 1024 * 1024 + 10, 0x20)]))).error, 'file_size', '20MB 초과');
    eq((await up('empty.docx', Buffer.alloc(0))).error, 'file_empty', '빈 파일');
    eq((await up('data.docx', zipBytes(), 'data')).error, 'file_type', '데이터 칸의 문서 파일');
    eq((await getOrder(x)).files.customer.length, 0, '거부된 파일이 서버에 남음');
  });
  await check(25, '주문 화면에서 더 올리는 파일도 형식을 막음', async () => {
    const x = await makeOrder({ input: paperIn() });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('#addFile', { state: 'attached' });
      await p.setInputFiles('#addFile', [file('macro.exe', Buffer.from('MZxx'))]);
      await toast(p, '허용되지 않는 형식입니다(.exe)');
      await waitText(p, '#addList', '불가');
      eq((await getOrder(x)).files.customer.length, 0, '거부된 파일이 서버에 올라감');
    });
  });
  const disguised = once(() => withCtx({}, async (p) => {
    const f = {};
    await paperToTask(p);
    await W.pick(p, 'paper.task', 'full');
    await W.upload(p, 'materials', [docx('E2E_정상자료.docx'), file('E2E_위장.pdf', zipBytes(800, 2), 'application/pdf')]);
    await paperTaskToReview(p);
    await p.click('#wzNext');
    await p.waitForSelector('#ssRetry', { timeout: 30000 });
    f.err = await text(p, '#ssErr');
    f.marks = await p.$$eval('#ssList li', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    f.first = await pendingNo(p, 'paper');
    await p.click('#ssClose');
    await p.click('#wzStep [data-goto="task"]');
    await p.waitForSelector('#wzStep[data-step="task"]');
    await W.del(p, 'materials', 'E2E_위장.pdf');
    await W.go(p, 'volume'); await W.go(p, 'request'); await W.go(p, 'contact'); await W.go(p, 'review');
    f.order = await submitWizard(p);
    f.server = await getOrder(f.order);
    return f;
  }));
  await check(25, '확장자를 속인 파일은 서버 내용 검사에서 막히고 제출 창에 이유를 안내', async () => {
    const f = await disguised();
    eq(f.err, '파일 내용이 확장자(.pdf)와 맞지 않거나 손상되었습니다.', '제출 창 안내');
    ok(f.marks.some((m) => m.includes('E2E_위장.pdf') && m.includes('실패')), `파일별 표시: ${f.marks.join(' / ')}`);
  });
  await check(26, '문제 파일을 빼고 다시 제출하면 같은 주문으로 이어서 접수(중복 주문 없음)', async () => {
    const f = await disguised();
    ok(f.first, '첫 시도 주문번호를 찾지 못함');
    eq(f.order.orderNo, f.first, '다시 제출한 주문번호');
    eq(f.server.files.customer.map((x) => x.name), ['E2E_정상자료.docx'], '서버 파일');
  });

  /* ---------------------------------------------------------------- 26 */
  await check(26, '여러 파일을 한 번에 올리고, 같은 파일은 한 번만 들어가며, 지우면 목록에서 빠짐', async () => withCtx({}, async (p) => {
    await paperToTask(p);
    await W.pick(p, 'paper.task', 'full');
    await W.upload(p, 'materials', [docx('E2E_a.docx'), pdf('E2E_b.pdf'), png('E2E_c.png')]);
    eq(await text(p, '#wzStep [data-up="materials"] .up-count'), '3개', '파일 수 표시');
    await p.setInputFiles('#wzStep input[data-file="materials"]', [docx('E2E_a.docx')]);
    await sleep(500);
    eq(await W.count(p, 'materials'), 3, '같은 파일을 다시 올렸을 때 파일 수');
    await W.del(p, 'materials', 'E2E_b.pdf');
    eq(await W.names(p, 'materials'), ['E2E_a.docx', 'E2E_c.png'], '삭제 뒤 목록');
  }));
  await check(26, '제출 중 업로드가 실패하면 실패 표시와 다시 시도 버튼이 나오고, 다시 시도하면 접수', async () => withCtx({}, async (p) => {
    await paperToTask(p);
    await W.pick(p, 'paper.task', 'full');
    await W.upload(p, 'materials', [docx('E2E_재시도1.docx'), pdf('E2E_재시도2.pdf')]);
    await paperTaskToReview(p);
    let failLeft = 3;
    await p.route('**/api', (route) => {
      const body = route.request().postData() || '';
      if (failLeft > 0 && body.includes('"action":"uploadFile"')) { failLeft--; return route.abort('connectionreset'); }
      return route.continue();
    });
    await p.click('#wzNext');
    await p.waitForSelector('#ssRetry', { timeout: 30000 });
    eq(await text(p, '#ssErr'), '네트워크 연결을 확인해 주세요.', '실패 안내');
    has(await text(p, '#ssList'), '실패', '파일별 실패 표시');
    const modal = await text(p, '.modal');
    ok(!/\d+\s*%/.test(modal), `제출 창에 퍼센트 표시: ${modal}`);
    await Promise.all([p.waitForURL(/\/checkout\/\?o=/, { timeout: 30000 }), p.click('#ssRetry')]);
    const no = new URL(p.url()).searchParams.get('o');
    const token = await p.evaluate((n) => JSON.parse(localStorage.getItem('nm:orders'))[n].token, no);
    const o = await getOrder({ orderNo: no, token });
    eq(o.files.customer.map((x) => x.name).sort(), ['E2E_재시도1.docx', 'E2E_재시도2.pdf'], '서버 파일');
  }));
  await check(26, '주문 화면에서도 여러 파일을 한 번에 올리고 하나씩 지울 수 있음', async () => {
    const x = await makeOrder({ input: paperIn() });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('#addFile', { state: 'attached' });
      await p.setInputFiles('#addFile', [docx('E2E_추가1.docx'), pdf('E2E_추가2.pdf')]);
      await toast(p, '2개 파일을 올렸습니다.');
      await p.waitForFunction(() => document.querySelectorAll('#myfiles [data-rm]').length === 2);
      await p.click('#myfiles li:has-text("E2E_추가1.docx") [data-rm]');
      await p.click('.modal #rmOk');
      await toast(p, '파일을 삭제했습니다.');
      await p.waitForFunction(() => document.querySelectorAll('#myfiles [data-rm]').length === 1);
      eq((await getOrder(x)).files.customer.map((y) => y.name), ['E2E_추가2.pdf'], '서버 파일');
    });
  });

  /* ---------------------------------------------------------------- 27 */
  await check(27, '작성 중 새로 고침: 이어서 작성하면 입력값·올린 파일·단계가 그대로이고 그대로 제출하면 파일도 접수', async () => withCtx({}, async (p) => {
    await W.open(p, '/paper/new/?detail=1', 'type');
    await W.pick(p, 'paper.typeId', 'doctor'); await W.go(p, 'field');
    await W.pick(p, 'common.fieldId', 'nursing'); await W.fill(p, 'common.fieldText', '간호학과'); await W.go(p, 'topic');
    await W.pick(p, 'common.topicKnown', 'yes'); await W.fill(p, 'common.title', '중환자실 간호사의 도덕적 고뇌와 소진의 관계'); await W.go(p, 'toc');
    await W.pick(p, 'paper.hasToc', 'yes');
    await W.upload(p, 'toc', [docx('E2E_새로고침목차.docx')]);
    await W.fill(p, 'paper.tocText', 'Ⅰ. 서론\nⅡ. 문헌고찰');
    await sleep(500);
    await p.reload();
    await p.waitForSelector('#rsYes');
    await p.click('#rsYes');
    await p.waitForSelector('#wzStep[data-step="toc"]');
    eq(await W.names(p, 'toc'), ['E2E_새로고침목차.docx'], '올린 목차 파일');
    eq(await W.value(p, 'paper.tocText'), 'Ⅰ. 서론\nⅡ. 문헌고찰', '입력한 목차');
    await W.back(p, 'topic');
    eq(await W.value(p, 'common.title'), '중환자실 간호사의 도덕적 고뇌와 소진의 관계', '제목');
    await W.back(p, 'field');
    eq(await W.value(p, 'common.fieldText'), '간호학과', '학과');
    await W.back(p, 'type');
    eq(await W.checked(p, 'paper.typeId'), ['doctor'], '논문 유형');
    await W.go(p, 'field'); await W.go(p, 'topic'); await W.go(p, 'toc'); await W.go(p, 'format');
    await W.pick(p, 'paper.hasFormat', 'no'); await W.go(p, 'method'); await W.go(p, 'task'); await W.pick(p, 'paper.task', 'full');
    await paperTaskToReview(p);
    const order = await submitWizard(p);
    const o = await getOrder(order);
    eq(o.files.customer.map((x) => `${x.slot}:${x.name}`), ['toc:E2E_새로고침목차.docx'], '새로 고친 뒤 제출한 파일');
    eq(o.input.paper.typeId, 'doctor', '서버 논문 유형');
    eq(await p.evaluate(() => localStorage.getItem('nm:draft:paper')), null, '접수 뒤 임시 저장이 남음');
  }));
  await check(27, "'새로 시작'을 고르면 임시 저장과 파일이 지워지고 다시 묻지 않음", async () => withCtx({}, async (p) => {
    await W.open(p, '/paper/new/?detail=1', 'type');
    await W.pick(p, 'paper.typeId', 'journal'); await sleep(450);
    await p.reload(); await p.waitForSelector('#rsNo');
    await p.click('#rsNo');
    await p.waitForFunction(() => !document.querySelector('#rsNo'));
    eq(await p.evaluate(() => localStorage.getItem('nm:draft:paper')), null, '임시 저장이 남음');
    await p.reload(); await p.waitForSelector('#wzStep[data-step="type"]');
    eq(await p.$('#rsYes'), null, '새로 시작 뒤에도 이어쓰기를 물음');
  }));
  await check(27, '접수 뒤 결제·주문 화면을 새로 고쳐도 같은 주문이 열림(이 기기 조회 키 유지)', async () => {
    const x = await makeOrder({ input: paperIn({ title: 'E2E 새로 고침 확인 주제: 대학생의 진로 정체감' }) });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('.ord-card');
      eq(new URL(p.url()).searchParams.get('t'), null, '주소에 조회 키가 남음');
      await p.reload(); await p.waitForSelector('.ord-card');
      has(await text(p, '.ord-title'), 'E2E 새로 고침 확인 주제', '새로 고친 주문 화면');
      await p.goto(`${BASE}/checkout/?o=${x.orderNo}`); await p.waitForSelector('.ord-no');
      await p.reload(); await p.waitForSelector('.ord-no');
      has(await text(p, '.ord-no'), x.orderNo, '새로 고친 결제 화면');
    });
  });
  await check(27, '제출 도중 실패하고 새로 고쳐도 마지막 확인 단계에서 같은 주문으로 이어서 제출', async () => withCtx({}, async (p) => {
    await paperToTask(p);
    await W.pick(p, 'paper.task', 'full');
    await W.upload(p, 'materials', [docx('E2E_실패후새로고침.docx')]);
    await paperTaskToReview(p);
    await p.route('**/api', (route) => ((route.request().postData() || '').includes('"action":"uploadFile"') ? route.abort('connectionreset') : route.continue()));
    await p.click('#wzNext');
    await p.waitForSelector('#ssRetry', { timeout: 30000 });
    const first = await pendingNo(p, 'paper');
    ok(first, '첫 시도 주문번호를 찾지 못함');
    await p.unroute('**/api');
    await p.reload();
    await p.waitForSelector('#rsYes'); await p.click('#rsYes');
    await p.waitForSelector('#wzStep[data-step]');
    eq(await W.step(p), 'review', '이어서 작성한 단계');
    const order = await submitWizard(p);
    eq(order.orderNo, first, '이어서 제출한 주문번호');
    eq((await getOrder(order)).files.customer.map((x) => x.name), ['E2E_실패후새로고침.docx'], '서버 파일');
  }));
  await check(27, '제출 실패 뒤 내용을 고치면 고친 내용으로 접수(앞선 시도 내용으로 접수되지 않음)', async () => withCtx({}, async (p) => {
    await paperToTask(p);
    await W.pick(p, 'paper.task', 'full');
    await W.upload(p, 'materials', [docx('E2E_수정후제출.docx')]);
    await paperTaskToReview(p);
    await p.route('**/api', (route) => ((route.request().postData() || '').includes('"action":"uploadFile"') ? route.abort('connectionreset') : route.continue()));
    await p.click('#wzNext');
    await p.waitForSelector('#ssRetry', { timeout: 30000 });
    await p.click('#ssClose');
    await p.unroute('**/api');
    await p.click('#wzStep [data-goto="task"]');
    await p.waitForSelector('#wzStep[data-step="task"]');
    await W.pick(p, 'paper.task', 'proposal');
    await W.waitPrice(p, '69,000원', '연구계획서 금액');
    await W.go(p, 'volume'); await W.go(p, 'request'); await W.go(p, 'contact'); await W.go(p, 'review');
    const order = await submitWizard(p);
    const o = await getOrder(order);
    eq(o.input.paper.task, 'proposal', '서버에 접수된 작업');
    eq(o.amount, 69000, '서버 주문 금액');
    eq(o.files.customer.map((x) => x.name), ['E2E_수정후제출.docx'], '서버 파일');
  }));

  /* ---------------------------------------------------------------- 28 */
  const pair = once(async () => {
    const a = await makeOrder({ input: paperIn({ title: 'A고객 비공개 주제: 요양병원 간호사의 소진', task: 'edit', paper: { editScope: '전체' } }), files: [{ slot: 'manuscript', ...docx('A고객_원고.docx') }] });
    const b = await deliveredOrder({ input: paperIn({ title: 'B고객 비공개 주제: 중학교 교사의 직무만족' }) }, { name: 'B고객_결과물.docx' });
    return { a, b };
  });
  await check(28, '내 조회 키로 다른 고객 주문번호를 열면 주문·결제 화면 모두 열리지 않음', async () => {
    const { a, b } = await pair();
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(a)); await p.waitForSelector('.ord-card');
      await p.goto(`${BASE}/orders/?o=${b.orderNo}&t=${encodeURIComponent(a.token)}`);
      await p.waitForSelector('#lk');
      has(await text(p, '#lkErr'), '권한이 없습니다', '주문 조회 안내');
      hasNot(await text(p, '#app'), 'B고객 비공개 주제', '다른 고객 주문 내용');
      await p.goto(`${BASE}/checkout/?o=${b.orderNo}&t=${encodeURIComponent(a.token)}`);
      await waitText(p, '#app', '주문을 불러오지 못했습니다');
      hasNot(await text(p, '#app'), 'B고객 비공개 주제', '다른 고객 결제 화면 내용');
    });
  });
  await check(28, '조회 키 없는 기기에서는 주문번호만으로 열리지 않고, 다른 고객 연락처·비밀번호로도 조회 불가', async () => {
    const { a, b } = await pair();
    await withCtx({}, async (p) => {
      await p.goto(`${BASE}/orders/?o=${b.orderNo}`);
      await p.waitForSelector('#lk');
      hasNot(await text(p, '#app'), 'B고객 비공개 주제', '조회 키 없이 보인 내용');
      await p.fill('#lkContact', a.contact.email); await p.fill('#lkPin', a.pin);
      await p.click('#lkGo');
      await waitText(p, '#lkErr', '주문번호, 연락처, 조회 비밀번호를 다시 확인해 주세요.');
      await p.fill('#lkContact', b.contact.phone.replace(/-/g, '')); await p.fill('#lkPin', b.pin);
      await p.click('#lkGo');
      await p.waitForSelector('.ord-card');
      has(await text(p, '.ord-title'), 'B고객 비공개 주제', '본인 연락처로 조회');
    });
  });
  await check(28, '다른 주문의 파일은 내 내려받기 권한으로 받을 수 없고, 고객 화면에는 연락처가 가려짐', async () => {
    const { a, b } = await pair();
    const ao = await getOrder(a);
    const bo = await getOrder(b);
    const bFile = bo.files.results[0];
    const aFile = ao.files.customer[0];
    let r = await rawApi('downloadFile', { orderNo: b.orderNo, fileId: bFile.id, ticket: aFile.ticket });
    eq(r.error, 'forbidden', 'A 권한으로 B 파일');
    r = await rawApi('downloadFile', { orderNo: a.orderNo, fileId: bFile.id, ticket: aFile.ticket });
    ok(!r.ok, 'A 주문번호로 B 파일을 받을 수 있음');
    r = await rawApi('downloadFile', { orderNo: b.orderNo, fileId: bFile.id, ticket: 'f1.9999999999.forged' });
    eq(r.error, 'forbidden', '위조 권한');
    r = await rawApi('getOrder', { orderNo: b.orderNo, token: a.token });
    eq(r.error, 'forbidden', 'A 조회 키로 B 주문');
    ok((await rawApi('downloadFile', { orderNo: b.orderNo, fileId: bFile.id, ticket: bFile.ticket })).ok, '본인 권한으로도 받지 못함');
    ok(!bo.contact.email.includes(b.contact.email.split('@')[0]), `고객 화면 이메일이 가려지지 않음: ${bo.contact.email}`);
    has(bo.contact.phone, '****', '고객 화면 전화번호 가림');
  });

  /* ---------------------------------------------------------------- 29 */
  await check(29, '로그인하지 않으면 운영자 화면 어느 주소로 가도 로그인 창만 보이고 틀린 비밀번호는 거부', async () => {
    const x = await makeOrder({ input: paperIn() });
    await withCtx({}, async (p) => {
      for (const h of ['/admin/', '/admin/#orders?status=all', '/admin/#catalog', `/admin/#order=${x.orderNo}`, '/admin/settings/']) {
        await p.goto(BASE + h);
        await p.waitForSelector('#pw');
        eq(await p.$('.ad-tiles, .ad-ohead, .ad-cat, .ad-set-grid, .ad-list, .ad-nav'), null, `${h}에서 운영자 내용이 보임`);
      }
      await p.fill('#pw', 'wrong-password-e2e');
      await p.click('#lbtn');
      await waitText(p, '#lerr', '비밀번호가 맞지 않습니다.');
      eq(await p.$('.ad-tiles'), null, '틀린 비밀번호로 대시보드가 열림');
    });
  });
  await check(29, '가짜 관리자 토큰은 지워지고 로그인 창으로, 고객 조회 키로는 관리자 API가 모두 거부', async () => {
    const x = await makeOrder({ input: paperIn() });
    await withCtx({}, async (p) => {
      await p.goto(`${BASE}/admin/`); await p.waitForSelector('#pw');
      await p.evaluate(() => localStorage.setItem('nm:admin', JSON.stringify({ token: 'a1.9999999999.forged-signature', exp: Date.now() + 3600e3 })));
      await p.goto(`${BASE}/admin/#order=${x.orderNo}`);
      await p.waitForSelector('#pw');
      eq(await p.evaluate(() => localStorage.getItem('nm:admin')), null, '가짜 토큰이 남음');
    });
    for (const [action, payload] of [['adminDashboard', {}], ['adminGetOrder', { orderNo: x.orderNo }], ['adminUpdateStatus', { orderNo: x.orderNo, status: 'delivered' }], ['adminGetSettings', {}], ['adminSaveCatalog', { catalog: { items: [] } }], ['adminDownloadFile', { orderNo: x.orderNo, fileId: 'x' }]]) {
      for (const tok of [x.token, '', 'a1.1.x']) {
        const r = await rawApi(action, { adminToken: tok, ...payload });
        eq(r.error, 'admin_required', `${action}(${tok ? '고객·위조 토큰' : '토큰 없음'})`);
      }
    }
    eq((await getOrder(x)).status, 'pending_payment', '거부된 상태 변경이 반영됨');
  });

  /* ---------------------------------------------------------------- 30 */
  await check(30, '운영자가 바꾼 단계·안내·예상 전달일이 고객 화면에 자동 확인(1분)과 새로 고침으로 반영', async () => {
    const x = await paidOrder({ input: paperIn() });
    const cust = await newCtx();
    try {
      const cp = await cust.newPage();
      await cp.clock.install();
      await cp.goto(ordersUrl(x));
      await cp.waitForSelector('.ord-card .status-pill');
      has(await text(cp, '.ord-card .status-pill'), '작성·분석 진행', '처음 단계');
      const eta = new Date(Date.now() + 40 * 86400000);
      const etaYmd = `${eta.getFullYear()}-${String(eta.getMonth() + 1).padStart(2, '0')}-${String(eta.getDate()).padStart(2, '0')}`;
      await withCtx({ admin: true }, async (ap) => {
        await ap.goto(`${BASE}/admin/#order=${x.orderNo}`);
        await ap.waitForSelector('#stSel');
        await ap.selectOption('#stSel', 'review');
        await ap.fill('#stMsg', 'E2E 안내: 검토를 시작했습니다.');
        await ap.click('[data-act="setStatus"]');
        await toast(ap, '단계로 바꿨습니다.');
        await ap.fill('#etaIn', etaYmd);
        await ap.click('[data-act="setEta"]');
        await toast(ap, '예정일을 바꿨습니다.');
      });
      await cp.clock.runFor(61000);
      await waitText(cp, '.ord-card .status-pill', '전문가 검수');
      has(await text(cp, '#progress'), 'E2E 안내: 검토를 시작했습니다.', '고객 진행 상황 안내');
      const label = `${eta.getMonth() + 1}월 ${eta.getDate()}일`;
      has(await text(cp, '.eta-box'), label, '예상 전달일');
      await cp.reload();
      await waitText(cp, '.ord-card .status-pill', '전문가 검수');
    } finally { await cust.close(); }
  });
  await check(30, '운영자 자료 보완 요청이 고객 화면의 보완 카드와 메시지로 나타남', async () => {
    const x = await paidOrder({ input: paperIn() });
    await withCtx({ admin: true }, async (ap) => {
      await ap.goto(`${BASE}/admin/#order=${x.orderNo}`);
      await ap.waitForSelector('.ad-next [data-act="materials"]');
      await ap.click('.ad-next [data-act="materials"]');
      await ap.fill('.modal [name="items"]', 'E2E 학교 논문 양식 파일');
      await ap.fill('.modal [name="message"]', '대학원 홈페이지의 양식 파일을 올려 주세요.');
      await ap.click('.modal [data-ok]');
      await toast(ap, '자료 보완을 요청했습니다.');
    });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('#materials');
      has(await text(p, '#materials'), 'E2E 학교 논문 양식 파일', '보완 카드');
      has(await text(p, '#messages'), '대학원 홈페이지의 양식 파일을 올려 주세요.', '메시지');
      has(await text(p, '.ord-card .status-pill'), '자료 보완 필요', '단계');
    });
  });

  /* ---------------------------------------------------------------- 31 */
  await check(31, '정적 검사: 빌드된 HTML·JS에 가짜 AI 생성 문구나 가짜 진행 퍼센트가 없음', async () => {
    const docs = corpus();
    const hits = scan(docs, [
      { re: /AI[가는이]?\s*(?:지금\s*)?(?:논문|원고|초안|본문|결과|설계|답변|분석)?[을를]?\s*(?:자동\s*)?(?:생성|작성|분석)(?:하고\s*있|하는\s*중|\s*중)/g, why: 'AI가 생성 중이라는 표현' },
      { re: /(?:생성|작성|분석|검토|집필)\s*(?:하고\s*있습니다|하는\s*중|중)\s*(?:\.{2,}|…)/g, why: '진행 중 말줄임' },
      { re: /\d{1,3}[ \t]*%[ \t]*(?:완료|진행|생성|분석|작성|처리)/g, why: '퍼센트 진행률' },
      { re: /(?:진행률|완료율|생성률|처리율)[ \t]*[:：]?[ \t]*\d/g, why: '진행률 숫자' },
      { re: /Math\.random\(\)[^;\n]{0,80}%/g, why: '무작위 퍼센트' },
    ], () => false);
    if (VERBOSE) for (const h of hits) console.log(`        ${h.file}: ${h.match} | ${h.ctx}`);
    eq(hits.map((h) => `${h.file}: ${h.match}`), [], '가짜 진행 표현');
    ok(docs.length > 40, `검사한 파일이 너무 적음(${docs.length}개)`);
  });
  await check(31, '실행 중: 원고 자동 분석은 실제 파일 내용으로 계산되고, 제출 창은 퍼센트 없이 실제 처리 단계만 표시', async () => withCtx({}, async (p) => {
    await paperToTask(p);
    await W.pick(p, 'paper.task', 'edit');
    const para = '가나다라마바사아자차카타파하'.repeat(57);
    await W.upload(p, 'manuscript', [await realDocx('E2E_분량확인.docx', Array.from({ length: 8 }, () => para))]);
    await p.waitForSelector('#docInfo .auto-card');
    const expected = Math.max(1, Math.round((para.length * 8 + 7) / 1600));
    has(await text(p, '#docInfo'), `약 ${expected} Page`, '원고 분석 분량(1 Page 1,600자 기준)');
    await W.upload(p, 'manuscript', [docx('E2E_가짜원고.docx')]);
    await W.fill(p, 'paper.editScope', '전체');
    has(await text(p, '#docInfo'), '파일을 분석하지 못했습니다', '읽을 수 없는 원고는 분석 결과를 꾸며 내지 않음');
    await paperTaskToReview(p);
    await p.route('**/api', async (route) => {
      if ((route.request().postData() || '').includes('"action":"submitOrder"')) await sleep(1500);
      return route.continue();
    });
    await p.click('#wzNext');
    await p.waitForSelector('.sub-steps li[data-s="submit"].is-now', { timeout: 30000 });
    const modal = await text(p, '.modal');
    ok(!/\d+\s*%/.test(modal), `제출 창에 퍼센트가 보임: ${modal}`);
    has(modal, '2 / 2', '실제 파일 처리 수');
    await p.waitForURL(/\/checkout\//, { timeout: 30000 });
  }));
  await check(31, '검토 단계를 거치지 않고 전달된 주문에 "검토 완료"를 꾸며 표시하지 않음', async () => {
    const x = await deliveredOrder({ input: paperIn() });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('#progress .timeline');
      const review = await p.$$eval('#progress .timeline li', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()).find((t) => t.startsWith('전문가 검수')) || '');
      ok(review, '진행 단계에 전문가 검수가 없음');
      hasNot(review, '검수 완료', '기록 없는 검수 단계');
    });
  });

  /* ---------------------------------------------------------------- 32 */
  await check(32, '작업지시문 복사: 고른 주문의 번호·상품·주제·요청·파일이 들어가고 고객 개인정보는 빠짐, 다른 주문은 그 주문 내용', async () => {
    const x = await paidOrder({ input: paperIn({ title: 'E2E 지시문 주제: 요양보호사의 감정노동과 이직의도', request: 'E2E 요청: 표는 APA 7판으로' }), files: [{ slot: 'materials', ...docx('E2E_참고자료.docx') }], contact: { name: '홍길동이투이', email: mail('brief'), phone: '010-9876-5432' } });
    const y = await paidOrder({ service: 'survey', input: { common: { fieldId: 'nursing', title: 'E2E 설문 주제: 간호사의 회복탄력성' }, survey: { mode: 'new', recruit: 'self', target: 'adult', targetN: '150' }, addons: {} } });
    await withCtx({ admin: true, clipboard: true }, async (p) => {
      await p.goto(`${BASE}/admin/#order=${x.orderNo}`);
      await p.waitForSelector('#briefText');
      const shown = await p.textContent('#briefText');
      const clip = await clipAfter(p, '.ad-card-h [data-act="copyBrief"]', `[논문AI 작업지시문] ${x.orderNo}`);
      await toast(p, '작업지시문을 복사했습니다.');
      eq(clip.trim(), shown.trim(), '복사한 내용과 화면의 지시문');
      for (const s of [`[논문AI 작업지시문] ${x.orderNo}`, '석사학위논문 80 Page 완성', 'E2E 지시문 주제: 요양보호사의 감정노동과 이직의도', 'E2E 요청: 표는 APA 7판으로', '[참고 자료] E2E_참고자료.docx', '요청 작업: 전체 구성·초고 완성']) has(clip, s, '복사한 작업지시문');
      for (const s of ['홍길동이투이', x.contact.email, '010-9876-5432', '9876']) hasNot(clip, s, '복사한 작업지시문의 고객 개인정보');
      await p.goto(`${BASE}/admin/#order=${y.orderNo}`);
      await waitText(p, '#briefText', y.orderNo);
      const clip2 = await clipAfter(p, '.ad-card-h [data-act="copyBrief"]', `[논문AI 작업지시문] ${y.orderNo}`);
      for (const s of ['의뢰 유형: 설문지 작성', '목표 응답 수: 150명', '연구 주제: E2E 설문 주제: 간호사의 회복탄력성']) has(clip2, s, '두 번째 주문 지시문');
      hasNot(clip2, x.orderNo, '두 번째 주문 지시문에 첫 주문 번호');
      await p.goto(`${BASE}/admin/#`);
      await p.waitForSelector(`[data-brief="${x.orderNo}"]`);
      const clip3 = await clipAfter(p, `[data-brief="${x.orderNo}"]`, `[논문AI 작업지시문] ${x.orderNo}`);
      has(clip3, 'E2E 지시문 주제', '대시보드에서 복사한 지시문');
      hasNot(clip3, y.orderNo, '대시보드에서 복사한 지시문에 다른 주문 번호');
    });
  });

  /* ---------------------------------------------------------------- 33 */
  await check(33, '운영자가 올린 결과물은 전달 완료 전에는 고객에게 보이지 않고, 전달 뒤 같은 파일로 내려받아짐', async () => {
    const x = await paidOrder({ input: paperIn() });
    const bytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(`E2E-RESULT-${RUN}-`.repeat(40))]);
    const name = 'E2E_결과물_초안_v1.docx';
    await withCtx({ admin: true }, async (ap) => {
      await ap.goto(`${BASE}/admin/#order=${x.orderNo}`);
      await ap.waitForSelector('.ad-ohead');
      await ap.setInputFiles('#resultPick', [{ name, mimeType: MIME.docx, buffer: bytes }]);
      await toast(ap, '결과물 1개를 올렸습니다.');
      await waitText(ap, '.ad-files .fn', name);
    });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('.ord-card');
      eq(await p.$('#results [data-dl]'), null, '전달 완료 전인데 결과물 내려받기 버튼이 고객에게 보임');
      hasNot(await text(p, '#app'), name, '전달 전 고객 화면의 결과물 이름');
    });
    await withCtx({ admin: true }, async (ap) => {
      await ap.goto(`${BASE}/admin/#order=${x.orderNo}`);
      await ap.waitForSelector('.ad-next [data-act="deliver"]');
      await ap.click('.ad-next [data-act="deliver"]');
      has(await text(ap, '.modal'), name, '전달 확인 창의 결과물 목록');
      await ap.click('.modal [data-ok]');
      await toast(ap, '전달 완료로 바꿨습니다.');
    });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('#results [data-dl]');
      has(await text(p, '#results'), name, '고객 결과물 목록');
      const dl = await downloadVia(p, '#results [data-dl]');
      eq(dl.name, name, '내려받은 파일 이름');
      ok(dl.bytes.equals(bytes), `내려받은 내용이 올린 내용과 다름(${dl.bytes.length}/${bytes.length}바이트)`);
    });
  });
  await check(33, '고객 API(getOrder)도 전달 전 결과물과 내려받기 권한을 주지 않음', async () => {
    const x = await paidOrder({ input: paperIn() });
    const up = await adminApi('adminUploadResult', { orderNo: x.orderNo, name: 'E2E_전달전초안.docx', mime: MIME.docx, data: B64(zipBytes(700, 6)) });
    const o = await getOrder(x);
    eq(o.files.results.map((f) => f.name), [], '전달 전 고객 API의 결과물 목록');
    const r = await rawApi('downloadFile', { orderNo: x.orderNo, fileId: up.file.id, ticket: (o.files.results[0] || {}).ticket || '' });
    ok(!r.ok, '전달 전 결과물을 고객 권한으로 내려받을 수 있음');
  });
  await check(33, '수정 진행 중 새로 올린 수정본은 다시 전달하기 전까지 고객에게 보이지 않음', async () => {
    const x = await deliveredOrder({ input: paperIn() }, { name: 'E2E_1차본.docx' });
    // 에뮬레이터 시계는 저절로 흐르지 않으므로, 전달 뒤 수정 요청·수정본 업로드까지 시간이 흐른 것을 2분 앞당겨 재현한다
    await clock(2 / 1440);
    await api('addMessage', { orderNo: x.orderNo, token: x.token, type: 'revision', text: 'E2E 수정 요청: 2장 보강' });
    await adminApi('adminUploadResult', { orderNo: x.orderNo, name: 'E2E_수정본.docx', mime: MIME.docx, data: B64(zipBytes(900, 4)) });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('#results');
      const names = await p.$$eval('#results .fn', (els) => els.map((e) => e.textContent));
      eq(names, ['E2E_1차본.docx'], '수정 진행 중 고객 결과물');
    });
  });

  /* ---------------------------------------------------------------- 34 */
  await check(34, '모바일: 하단 요약 막대에 금액이 바로 보이고 미리보기로 견적을 펼치고 닫을 수 있음', async () => withCtx({ mobile: true }, async (p) => {
    await W.open(p, '/paper/new/?detail=1', 'type');
    ok(await p.isVisible('#wzMbar'), '하단 요약 막대가 보이지 않음');
    await waitText(p, '#wzMbar', '유형을 고르면 금액이 나옵니다');
    await W.pick(p, 'paper.typeId', 'master');
    await p.waitForFunction(() => (document.querySelector('#wzMbar .mb-price b') || {}).textContent === '99,000원');
    const hidden = await p.$eval('#wzSide', (e) => e.getBoundingClientRect().top >= document.querySelector('#wzMbar').getBoundingClientRect().top - 1);
    ok(hidden, '견적 패널이 처음부터 화면을 가림');
    await p.click('#wzSheetBtn');
    await p.waitForFunction(() => {
      const r = document.querySelector('#wzSide .pl-total').getBoundingClientRect();
      const bar = document.querySelector('#wzMbar').getBoundingClientRect();
      return document.querySelector('#wzSide').classList.contains('is-open') && r.bottom <= bar.top + 1 && r.top >= 0;
    });
    has(await text(p, '#wzSide .pl-total'), '99,000원', '펼친 견적');
    has(await text(p, '#wzSheetBtn'), '닫기', '닫기 버튼');
    await p.click('#wzSheetBtn');
    await p.waitForFunction(() => !document.querySelector('#wzSide').classList.contains('is-open'));
    await noHScroll(p, '모바일 신청서');
  }));
  await check(34, '모바일: 끝까지 입력해 제출할 수 있고, 다음 버튼이 하단 막대에 가리지 않으며 결제 화면은 결제 상자가 먼저 나옴', async () => withCtx({ mobile: true }, async (p) => {
    // 사용자가 끝까지 내렸을 때 다음 버튼을 하단 요약 막대 바로 위에 온전히 보이게 둘 수 있는지(가려지면 누를 수 없음)
    const covered = async (where) => {
      const r = await p.evaluate(() => {
        const btn = document.querySelector('#wzNext');
        const bar = document.querySelector('#wzMbar').getBoundingClientRect();
        const b0 = btn.getBoundingClientRect();
        window.scrollBy({ top: b0.bottom - (bar.top - 12), behavior: 'instant' });
        const b = btn.getBoundingClientRect();
        const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { hit: !!(el && el.closest('#wzNext')), bottom: Math.round(b.bottom), barTop: Math.round(bar.top), at: el ? `${el.tagName}.${el.className}` : 'null' };
      });
      ok(r.hit && r.bottom <= r.barTop, `${where}: 다음 버튼이 하단 막대에 가려 누를 수 없음 (버튼 아래 ${r.bottom}, 막대 위 ${r.barTop}, 맞은 요소 ${r.at})`);
    };
    await W.open(p, '/paper/new/?detail=1', 'type');
    await W.pick(p, 'paper.typeId', 'master'); await covered('유형'); await W.go(p, 'field');
    await W.pick(p, 'common.fieldId', 'edu'); await W.go(p, 'topic');
    await W.pick(p, 'common.topicKnown', 'yes'); await W.fill(p, 'common.title', '모바일 신청 확인: 고등학생의 진로 결정 수준'); await W.go(p, 'toc');
    await W.pick(p, 'paper.hasToc', 'no'); await W.go(p, 'format'); await W.pick(p, 'paper.hasFormat', 'no'); await W.go(p, 'method'); await W.go(p, 'task');
    await W.pick(p, 'paper.task', 'full'); await covered('작업');
    await W.go(p, 'volume'); await W.go(p, 'request'); await W.go(p, 'contact');
    await fillContact(p); await covered('연락처'); await noHScroll(p, '모바일 연락처 단계');
    await W.go(p, 'review'); await covered('확인'); await noHScroll(p, '모바일 확인 단계');
    const order = await submitWizard(p);
    await p.waitForSelector('#skkcDone');
    const orderOk = await p.evaluate(() => {
      const cards = [...document.querySelectorAll('.pg-main > .card')].map((c) => (c.querySelector('h2') || {}).textContent || '');
      return cards.indexOf('결제') >= 0 && cards.indexOf('결제') < cards.indexOf('주문 금액');
    });
    ok(orderOk, '모바일 결제 화면에서 결제 상자가 주문 금액보다 아래에 있음');
    ok(await p.isVisible('#skkcDone'), '결제를 마쳤어요 버튼이 보이지 않음');
    await noHScroll(p, '모바일 결제 화면');
    await p.goto(`${BASE}/orders/?o=${order.orderNo}`);
    await p.waitForSelector('.ord-card');
    await noHScroll(p, '모바일 주문 화면');
  }));

  /* ---------------------------------------------------------------- 35 */
  await check(35, '결제 수단이 모두 꺼져 있으면 결제 버튼 없이 준비 중 안내만 보이고, 결제 완료처럼 꾸민 주소도 승인되지 않음', async () => {
    const x = await makeOrder({ input: paperIn() });
    try {
      await withCtx({ admin: true }, async (ap) => {
        await ap.goto(`${BASE}/admin/#settings`);
        await ap.waitForSelector('.ad-set-grid');
        await ap.uncheck('[data-key="skkcEnabled"]');
        await ap.uncheck('[data-key="bankEnabled"]');
        if (await ap.isChecked('[data-key="tossEnabled"]')) await ap.uncheck('[data-key="tossEnabled"]');
        await ap.click('#saveAll');
        await toast(ap, '설정을 저장했습니다.');
      });
      await withCtx({}, async (p) => {
        await p.goto(checkoutUrl(x));
        await p.waitForSelector('.ord-no');
        has(await text(p, '#app'), '결제 연결을 준비하고 있습니다', '준비 중 안내');
        eq(await p.$$eval('#skkcDone, #skkcGo, #bankDone, #tossPay, #tossMethods', (els) => els.length), 0, '결제 버튼 수');
        const pay = (await getOrder(x)).payments.find((y) => y.status === 'requested');
        await p.goto(`${BASE}/checkout/?o=${x.orderNo}&toss=ok&paymentKey=e2e_fake_key&orderId=${x.orderNo}-${pay.id}&amount=${pay.amount}`);
        await toast(p, '카드 결제가 아직 연결되지 않았습니다.');
        ok(!/paid=1/.test(p.url()), '결제 완료 화면으로 넘어감');
        const o = await getOrder(x);
        eq([o.status, o.paidAmount, o.amountDue], ['pending_payment', 0, pay.amount], '서버 결제 상태');
        has(await text(p, '#app'), '결제 전', '결제 화면 상태');
      });
    } finally {
      await adminApi('adminSaveSettings', { settings: { skkcEnabled: 'true', bankEnabled: 'true' } });
    }
  });
  let claimed = null;
  await check(35, "'결제를 마쳤어요'를 눌러도 결제 완료로 표시하지 않고 담당자 확인 중으로 안내", async () => {
    const x = await makeOrder({ input: paperIn() });
    claimed = x;
    await withCtx({}, async (p) => {
      await p.goto(checkoutUrl(x));
      await p.waitForSelector('#skkcDone');
      await p.click('#skkcDone');
      await p.fill('.modal #pn', '이테스트');
      await Promise.all([p.waitForURL(/\/orders\/\?o=.*paid=1/), p.click('.modal #pnOk')]);
      await p.waitForSelector('.ord-card');
      const head = await text(p, '.ord-card');
      has(head, '결제 완료 알림을 받았습니다', '알림 접수 안내');
      has(head, '담당자가 함께 확인', '확인 전 안내');
      const pays = await p.$$eval('.pay-list em', (els) => els.map((e) => e.textContent));
      eq(pays, ['확인 중'], '결제 내역 표시');
      eq((await getOrder(x)).paidAmount, 0, '서버 결제 금액');
    });
  });
  await check(35, "'결제를 마쳤어요'만 누른 단계의 고객 메일에 '결제가 확인되어'라고 쓰지 않음", async () => {
    ok(claimed, '앞 확인이 실패해 주문이 없음');
    // 에뮬레이터 하루 메일 할당량(100통)을 넘으면 메일은 대기열(queued)에 쌓이므로 둘 다 본다
    const dv = await devInfo(true);
    const mails = [...(dv.mails || []), ...(dv.queued || [])].filter((m) => m.subject.includes(claimed.orderNo) && String(m.to).includes(claimed.contact.email));
    ok(mails.length, '고객 메일을 찾지 못함');
    const bad = mails.filter((m) => /결제가 확인/.test(m.subject));
    eq(bad.map((m) => m.subject), [], '결제 확인 전 고객 메일 제목');
  });

  /* ---------------------------------------------------------------- 36 */
  await check(36, '연락처 단계: 동의 체크 없이 안내 한 줄로 진행, 약관·개인정보·환불 규정 링크, 선택 항목은 선택대로 저장', async () => withCtx({}, async (p) => {
    await paperToTask(p);
    await W.pick(p, 'paper.task', 'full');
    await W.go(p, 'volume'); await W.go(p, 'request'); await W.go(p, 'contact');
    await W.blocked(p, '이름을 입력해 주세요.');
    await W.fill(p, 'contact.name', '이동의'); await W.fill(p, 'contact.phone', '01055556666'); await W.fill(p, 'contact.email', mail('consent'));
    await W.blocked(p, '주문 조회 비밀번호는 숫자 4~8자리로 정해 주세요.');
    await W.fill(p, 'pin', '2468');
    eq(await p.$$eval('#wzStep input[type=checkbox]', (els) => els.map((e) => e.dataset.bool)), ['consents.marketing'], '남은 체크 항목은 선택 항목 하나');
    eq(await p.isChecked('#wzStep [data-bool="consents.marketing"]'), false, '선택 항목은 기본으로 꺼짐');
    const note = await text(p, '#wzStep .consent-note');
    for (const s of ['이용약관', '개인정보 처리방침', '환불 규정']) has(note, s, '주문 안내');
    eq(await p.$$eval('#wzStep .consent-note a', (els) => els.map((e) => new URL(e.href).pathname)), ['/terms/', '/privacy/', '/refund/'], '안내 링크');
    await W.go(p, 'review');
    const order = await submitWizard(p);
    const a = await adminOrder(order.orderNo);
    eq([a.consents.privacy, a.consents.ethics, a.consents.withdrawal, a.consents.marketing], [true, true, true, false], '서버 동의 기록');
  }));
  await check(36, '결제 전 주문의 자료 삭제 요청은 바로 삭제되고, 화면·서버 모두 파일이 사라짐', async () => {
    const x = await makeOrder({ input: paperIn({ task: 'edit', paper: { editScope: '전체' } }), files: [{ slot: 'manuscript', ...docx('E2E_삭제될원고.docx') }] });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('#doDelete');
      await p.click('#doDelete');
      has(await text(p, '.modal'), '요청하는 즉시 삭제되며 되살릴 수 없습니다', '삭제 안내');
      await p.fill('.modal #delWhy', 'E2E 삭제 요청');
      await p.click('.modal #dOk');
      await toast(p, '자료를 삭제했습니다.');
      await waitText(p, '.ord-card', '삭제되었습니다');
      eq(await p.$$eval('#myfiles [data-dl]', (els) => els.length), 0, '화면에 남은 파일');
      hasNot(await text(p, '#app'), 'E2E_삭제될원고.docx', '삭제한 파일 이름');
    });
    const o = await getOrder(x);
    eq([o.deleted, o.files.customer.length, o.status], [true, 0, 'cancelled'], '서버 상태');
  });
  await check(36, '작업 중 주문의 삭제 요청은 운영자에게 전달되고, 운영자 영구 삭제 뒤 고객 화면에서도 사라짐', async () => {
    const x = await paidOrder({ input: paperIn(), files: [{ slot: 'materials', ...docx('E2E_작업중자료.docx') }] });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('#doDelete');
      await p.click('#doDelete');
      await p.click('.modal #dOk');
      await toast(p, '삭제 요청을 접수했습니다.');
    });
    await withCtx({ admin: true }, async (ap) => {
      await ap.goto(`${BASE}/admin/#`);
      await ap.waitForSelector('.ad-tiles');
      await waitText(ap, '.ad-msgs', x.orderNo);
      has(await text(ap, `.ad-msgs a[href="#order=${x.orderNo}"]`), '삭제 요청', '대시보드 새 메시지');
      await ap.goto(`${BASE}/admin/#order=${x.orderNo}`);
      await ap.waitForSelector('[data-act="purge"]');
      await ap.click('[data-act="purge"]');
      await ap.fill('.modal [name="reason"]', '고객 요청(E2E)');
      await ap.click('.modal [data-ok]');
      await toast(ap, '확인란을 체크해 주세요.');
      await ap.click('[data-act="purge"]');
      await ap.fill('.modal [name="reason"]', '고객 요청(E2E)');
      await ap.check('.modal [name="sure"]');
      await ap.click('.modal [data-ok]');
      await toast(ap, '자료를 삭제했습니다.');
      await waitText(ap, '.ad-ohead', '자료 삭제됨');
    });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await waitText(p, '.ord-card', '삭제되었습니다');
      hasNot(await text(p, '#app'), 'E2E_작업중자료.docx', '삭제된 파일 이름');
    });
  });
  await check(36, "'이 기기에서 주문 지우기'를 누르면 이 브라우저의 조회 키가 지워짐", async () => {
    const x = await makeOrder({ input: paperIn() });
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(x));
      await p.waitForSelector('#doForget');
      await Promise.all([p.waitForURL(`${BASE}/orders/`), p.click('#doForget')]);
      await p.waitForSelector('#lk');
      eq(await p.evaluate((n) => (JSON.parse(localStorage.getItem('nm:orders') || '{}'))[n] || null, x.orderNo), null, '남은 조회 키');
      await p.goto(`${BASE}/orders/?o=${x.orderNo}`);
      await p.waitForSelector('#lk');
    });
  });

  /* ---------------------------------------------------------------- 37 */
  await check(37, '응답 데이터를 올리는 칸마다 응답자 식별 정보를 지우라는 안내가 있음', async () => withCtx({}, async (p) => {
    await surveyToMode(p);
    await W.pick(p, 'survey.mode', 'analyze'); await W.go(p, 'materials');
    has(await text(p, '#wzStep .note-amber'), '응답자를 알아볼 수 있는 열은 지운 뒤 올려 주세요', '설문 응답 분석 안내');
    await statsToData(p);
    await W.pick(p, 'statistics.hasData', 'yes');
    const n = await text(p, '#wzStep .note-amber');
    has(n, '개인정보는 지우고 올려 주세요', '통계 데이터 안내');
    has(n, '이름, 연락처, 이메일, 학번', '통계 데이터 안내의 예시');
  }));
  await check(37, '데이터의 이름·연락처 열을 자동으로 찾아 개인정보 열로 알려 줌', async () => withCtx({}, async (p) => {
    await statsToData(p);
    await W.pick(p, 'statistics.hasData', 'yes');
    await W.upload(p, 'data', [csv('E2E_개인정보포함.csv', { pii: true })]);
    await p.waitForSelector('#diag .data-diag');
    const d = await text(p, '#diag');
    has(d, '개인정보로 보이는 열', '자동 진단');
    has(d, '이름', '자동 진단 열');
    has(d, '연락처', '자동 진단 열');
    await waitText(p, '#wzSideIn', '개인정보 열 확인 필요');
  }));
  await check(37, '설문 의뢰는 응답자 보호(동의·익명화·IRB) 확인 없이 제출할 수 없고 모집 의뢰 시 개인정보 처리도 안내', async () => withCtx({}, async (p) => {
    await surveyToMode(p);
    await W.pick(p, 'survey.mode', 'new'); await W.go(p, 'materials');
    await W.pick(p, 'survey.hasPlan', 'no'); await W.pick(p, 'survey.hasQuestionnaire', 'no');
    await W.go(p, 'target'); await W.go(p, 'targetN'); await W.go(p, 'recruit');
    await W.pick(p, 'survey.recruit', 'us');
    has(await text(p, '#wzStep .note-amber'), '응답자 동의와 개인정보 처리 방법', '모집 의뢰 안내');
    await W.go(p, 'deliver'); await W.go(p, 'contact');
    await fillContact(p);
    const irb = await text(p, '#wzStep');
    for (const s of ['응답자 동의', 'IRB', '익명화']) has(irb, s, '응답자 보호 안내');
    await W.go(p, 'review');
  }));

  /* ---------------------------------------------------------------- 38 */
  await check(38, '정적 검사: 빌드된 HTML·JS·llms.txt에 합격·통과·게재·유의성 보장 문구가 없음(보장하지 않는다는 문장만 허용)', async () => {
    const docs = corpus();
    const NEG = /^[^.!?。\n]{0,6}?(하지\s*않|되지\s*않|할\s*수\s*없|해\s*드리지\s*않|하지\s*못|해\s*드릴\s*수\s*없|하지는\s*않|않)/;
    const QUESTION = /^[^.!?。\n]{0,6}?(하나요|되나요|해\s*주나요|할\s*수\s*있나요|\?)/;
    const REPORTED = /^[^.!?。\n]{0,4}?(한다고|하는\s*곳|하는\s*광고|하는\s*업체|하는\s*것처럼)/;
    const hits = scan(docs, [
      { re: /(합격|심사\s*통과|통과|게재|채택|유의성|유의한\s*결과|유의미한\s*결과|통계적\s*유의|p\s*<\s*\.?0?5)[^.!?。\n<]{0,16}?(보장|약속|책임지)/g, why: '결과 보장' },
      { re: /(100\s*%|백\s*퍼센트|무조건)\s*(합격|통과|게재|채택|유의)/g, why: '확정 표현' },
    ], (m, after) => NEG.test(after) || QUESTION.test(after) || REPORTED.test(after));
    const bad = hits.filter((h) => !h.allowed);
    if (VERBOSE) for (const h of hits) console.log(`        [${h.allowed ? '허용' : '문제'}] ${h.file}: ${h.ctx}`);
    eq(bad.map((h) => `${h.file}: ${h.ctx}`), [], '보장 문구');
    ok(hits.length > 0, '검사 패턴이 하나도 걸리지 않음(부정 문장도 없음: 검사가 동작하지 않는 것으로 보임)');
    console.log(`        보장 관련 문장 ${hits.length}건은 모두 "보장하지 않습니다" 같은 부정·질문 문장입니다.`);
  });
  await check(38, '실행 중 화면(신청서·결제·주문)에도 보장 문구가 없고 결과물 확인 책임을 안내', async () => {
    const x = await deliveredOrder({ input: paperIn() });
    await withCtx({}, async (p) => {
      const bodies = [];
      for (const u of ['/paper/new/', '/paper/new/?detail=1', '/survey/new/', '/statistics/new/']) { await p.goto(BASE + u); await p.waitForSelector(u === '/paper/new/' ? '#qoForm' : '#wzStep'); bodies.push(await text(p, 'body')); }
      await p.goto(ordersUrl(x)); await p.waitForSelector('#results'); bodies.push(await text(p, 'body'));
      has(bodies[4], '제출 전에 내용과 출처를 직접 확인해 주세요', '결과물 확인 안내');
      await p.goto(checkoutUrl(await makeOrder({ input: paperIn() }))); await p.waitForSelector('.ord-no'); bodies.push(await text(p, 'body'));
      const all = bodies.join('\n');
      const m = all.match(/(합격|통과|게재|유의)[^.!?\n]{0,10}(보장|약속)(합니다|해 드립니다|드립니다)/);
      ok(!m, `화면에 보장 문구: ${m && m[0]}`);
    });
  });

  /* ---------------------------------------------------------------- 40 */
  await check(40, '가격표를 바꾸면 새 주문은 새 가격, 이미 접수된 주문은 원래 가격 그대로', async () => {
    const before = await makeOrder({ input: paperIn({ title: 'E2E 가격 변경 전 주문' }) });
    eq(before.quote.total, 99000, '변경 전 주문 금액');
    const stale = await newCtx();
    try {
      const sp = await stale.newPage();
      await W.open(sp, '/paper/new/?detail=1', 'type');
      await W.pick(sp, 'paper.typeId', 'master');
      await W.waitPrice(sp, '99,000원', '가격 변경 전 화면 금액');
      await withCtx({ admin: true }, async (ap) => {
        await ap.goto(`${BASE}/admin/#catalog`);
        await ap.waitForSelector('.ad-cat');
        const row = ap.locator('.ad-cat tbody tr', { has: ap.locator('td.ad-code', { hasText: /^\s*P-MASTER-FULL\s*$/ }) });
        eq(await row.count(), 1, '가격표의 석사 전체 작성 줄');
        await row.locator('[data-f="price"]').fill('119000');
        await ap.click('#catSave');
        await toast(ap, '가격표를 저장했습니다.');
      });
      // 새로 들어온 고객: 바뀐 가격으로 계산·접수
      await withCtx({}, async (p) => {
        await W.open(p, '/paper/new/?detail=1', 'type');
        await W.pick(p, 'paper.typeId', 'master');
        await W.waitPrice(p, '119,000원', '가격 변경 뒤 새 고객 화면 금액');
        await W.go(p, 'field'); await W.pick(p, 'common.fieldId', 'edu'); await W.go(p, 'topic');
        await W.pick(p, 'common.topicKnown', 'yes'); await W.fill(p, 'common.title', 'E2E 가격 변경 뒤 주문: 교사의 수업 몰입'); await W.go(p, 'toc');
        await W.pick(p, 'paper.hasToc', 'no'); await W.go(p, 'format'); await W.pick(p, 'paper.hasFormat', 'no'); await W.go(p, 'method'); await W.go(p, 'task');
        await W.pick(p, 'paper.task', 'full'); await paperTaskToReview(p);
        has(await text(p, '#wzStep .rv-price'), '119,000원', '확인 단계 견적');
        const order = await submitWizard(p);
        has(await text(p, '#app'), '119,000원', '결제 화면 금액');
        eq((await getOrder(order)).amount, 119000, '서버 주문 금액');
      });
      // 바뀌기 전 화면을 열어 둔 고객: 제출할 때 바뀐 금액을 알리고 확인을 받음
      await W.go(sp, 'field'); await W.pick(sp, 'common.fieldId', 'edu'); await W.go(sp, 'topic');
      await W.pick(sp, 'common.topicKnown', 'yes'); await W.fill(sp, 'common.title', 'E2E 가격 변경 중 작성하던 주문'); await W.go(sp, 'toc');
      await W.pick(sp, 'paper.hasToc', 'no'); await W.go(sp, 'format'); await W.pick(sp, 'paper.hasFormat', 'no'); await W.go(sp, 'method'); await W.go(sp, 'task');
      await W.pick(sp, 'paper.task', 'full'); await paperTaskToReview(sp);
      await sp.click('#wzNext');
      await sp.waitForSelector('#ssPriceOk', { timeout: 20000 });
      const note = await text(sp, '.modal');
      has(note, '99,000원', '바뀌기 전 금액');
      has(note, '119,000원', '바뀐 금액');
      await Promise.all([sp.waitForURL(/\/checkout\/\?o=/, { timeout: 30000 }), sp.click('#ssPriceOk')]);
      await sp.waitForSelector('.ord-no');
      has(await text(sp, '#app'), '119,000원', '확인 뒤 결제 화면 금액');
      // 이미 접수된 주문은 그대로
      const old = await getOrder(before);
      eq([old.amount, old.amountDue], [99000, 99000], '기존 주문 금액');
      await sp.goto(checkoutUrl(before));
      await sp.waitForSelector('.ord-no');
      has(await text(sp, '#app'), '99,000원', '기존 주문 결제 화면 금액');
      eq((await adminOrder(before.orderNo)).amount, 99000, '운영자 화면의 기존 주문 금액');
    } finally {
      await stale.close().catch(() => {});
      const cat = (await adminApi('adminGetCatalog')).catalog;
      const it = cat.items.find((i) => i.code === 'P-MASTER-FULL');
      if (it && it.price !== 99000) { it.price = 99000; await adminApi('adminSaveCatalog', { catalog: cat }); }
    }
  });

  /* ---------------------------------------------------------------- 41 */
  // 한 화면 주문: 관심 주제만 적고(제목 확정 없음) 내면 결제 대기 화면 없이 성균관컨설팅 결제로 넘어간다
  const SKKC = 'https://skkc.co.kr/shop_view/?idx=';
  const withShop = async (fn, { direct = false } = {}) => {
    const before = (await adminApi('adminGetSettings')).settings || {};
    const links = { 'P-MASTER-FULL': `${SKKC}100`, 'P-DOCTOR-FULL': `${SKKC}104`, 'P-SHORT-FULL': `${SKKC}147`, 'P-BACHELOR-FULL': `${SKKC}150`, 'A-PRIORITY': `${SKKC}139`, 'X-19000': `${SKKC}141`, 'X-9000': `${SKKC}140`, 'P-MASTER-EDIT': `${SKKC}101` };
    if (direct) links._direct = 'on';
    await adminApi('adminSaveSettings', { settings: { skkcEnabled: 'true', skkcProducts: JSON.stringify(links), tossEnabled: 'false' } });
    try { return await fn(); } finally { await adminApi('adminSaveSettings', { settings: { skkcProducts: before.skkcProducts || '{}', skkcEnabled: before.skkcEnabled || 'true', tossEnabled: before.tossEnabled || 'false' } }); }
  };
  // 결제 페이지(외부)로 가는 요청은 막고 주소만 기록한다
  const catchShop = async (p) => {
    const hits = [];
    await p.route('https://skkc.co.kr/**', (r) => { hits.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>성균관컨설팅 결제 페이지(테스트)</body></html>' }); });
    return hits;
  };
  const decodeNm = (u) => JSON.parse(Buffer.from(new URL(u).searchParams.get('nm').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  const prompt = '간호학과 석사인데, 신규 간호사 번아웃이랑 이직 관련해서 논문 써 주세요';
  const DEMO = '경영학 석사인데, MZ세대 직장인 워라밸이랑 이직 관련해서 논문 완성해줘'; // 홈 예시 문장(src/js/core/preview.js DEMO_PROMPT)
  await check(41, '홈 작성 화면: 예시 문장(논문 완성해줘)을 친 뒤 서론 연구의 필요성 4문단을 실존 인용과 함께 써 내려가다 문장 중간에서 끊기고 모자이크로 가려짐', async () => withCtx({}, async (p) => {
    await p.goto(`${BASE}/`);
    await p.locator('#hxWin').scrollIntoViewIfNeeded();
    await p.waitForSelector('#hxWin.is-ready', { timeout: 45000 });
    eq(await p.inputValue('#hxText'), DEMO, '예시 문장');
    const paras = await p.$$eval('#hxFlow .hx-p', (ps) => ps.map((x) => x.textContent.trim()));
    eq(paras.length, 4, '연구의 필요성 문단 수');
    ok(paras.every((x) => x.length > 150), `짧은 문단이 있음: ${paras.map((x) => x.length).join(',')}`);
    ok(paras[3].endsWith('일-성장 균형 가운데'), `끊긴 자리: ${paras[3].slice(-20)}`);
    const cites = await p.$$eval('#hxFlow .hx-cite', (cs) => cs.map((c) => c.dataset.ref));
    eq(cites.length, 8, '본문 인용 수');
    const listed = await p.$$eval('#hxRefList li[data-ref]', (ls) => ls.map((l) => l.dataset.ref));
    ok(cites.every((id) => listed.includes(id)), '인용한 문헌이 실존 확인 목록에 없음');
    ok(await p.$('#hxLock.is-on.is-locked'), '모자이크가 걸리지 않음');
    has(await text(p, '#hxLock .pv-lock'), '결제하시면 나머지 78 Page를 완성해 드려요', '결제 후 완성 안내');
    ok(await p.$eval('#hxScroll', (x) => x.classList.contains('is-free') && x.scrollTop > 0), '다 쓴 뒤 지면을 굴려 읽을 수 없음');
  }));
  await check(41, '홈 프롬프트로 연 주문서는 주제·전공·석사 80 Page가 채워지고 미리보기가 써진 뒤 모자이크로 가려짐(홈 예시 문장은 채우지 않음)', async () => withCtx({}, async (p) => {
    await p.goto(`${BASE}/paper/new/?${new URLSearchParams({ prompt })}`);
    await p.waitForSelector('#qoForm #qoTopic');
    eq(await p.inputValue('#qoTopic'), prompt, '관심 주제 칸');
    eq(await p.inputValue('#qoMajor'), '간호학', '전공 칸(프롬프트에서 읽음)');
    eq(await p.$eval('input[name="qoPkg"]:checked', (e) => e.value), 'master80', '고른 논문 종류');
    const sum = await text(p, '#qoSum');
    has(sum, '99,000원', '결제 금액');
    has(sum, '199,000원', '정가');
    has(sum, '50% 할인', '할인율');
    has(await text(p, '#qoRead'), '번아웃', 'AI가 읽은 키워드');
    await p.waitForFunction(() => document.querySelector('#qoPv .pv') && document.querySelector('#qoPv .pv').dataset.state === 'done', null, { timeout: 20000 });
    ok(await p.$('#qoPv .pv-lockzone.is-locked'), '미리보기 모자이크가 걸리지 않음');
    has(await text(p, '#qoPv .pv-lock'), '결제하시면 나머지 78 Page를 완성해 드려요', '결제 후 완성 안내');
    // 제목을 확정하라는 칸이나 추천 주제 목록은 없다
    ok(!(await p.$('[data-path="common.title"], .rp-cands, [data-pick]')), '제목 확정 칸이나 추천 주제가 보임');
    // 홈 예시 문장을 그대로 들고 오면 칸을 비워 둔다
    await p.evaluate(() => { try { localStorage.removeItem('nm:draft:quick'); } catch (e) { /* 무시 */ } });
    await p.goto(`${BASE}/paper/new/?${new URLSearchParams({ prompt: DEMO })}`);
    await p.waitForSelector('#qoTopic');
    eq([await p.inputValue('#qoTopic'), await p.inputValue('#qoMajor')], ['', ''], '예시 문장으로 채운 칸');
  }));
  await check(41, '바로 결제가 꺼져 있으면 연락처를 받고 접수한 뒤 주문번호가 담긴 성균관컨설팅 결제 주소로 이동', async () => withShop(() => withCtx({}, async (p) => {
    const hits = await catchShop(p);
    await p.goto(`${BASE}/paper/new/?${new URLSearchParams({ prompt })}`);
    await p.waitForSelector('#qoTopic');
    const email = mail('qo');
    await p.fill('#qoName', '김논문');
    await p.fill('#qoPhone', '010-2468-1357');
    await p.fill('#qoEmail', email);
    await p.click('#qoSubmit');
    await p.waitForSelector('.handoff-card', { timeout: 30000 });
    const card = await text(p, '.handoff-card');
    has(card, '99,000원', '결제 연결 화면 금액');
    const orderNo = (card.match(/NA\d{6}-[A-Z0-9]+/) || [''])[0];
    ok(orderNo, `결제 연결 화면에 주문번호가 없음: ${card.slice(0, 120)}`);
    await p.waitForFunction(() => location.hostname === 'skkc.co.kr', null, { timeout: 15000 });
    ok(hits[0].startsWith(`${SKKC}100&`), `열린 결제 상품: ${hits[0]}`);
    const nm = decodeNm(hits[0]);
    eq([nm.kind, nm.o, nm.code, nm.price], ['order', orderNo, 'P-MASTER-FULL', 99000], '결제 주소에 담긴 주문');
    // 주문 기록: 관심 주제(제목 아님), 석사 80 Page, 조회 비밀번호는 휴대전화 뒤 4자리
    const r = await api('lookupOrder', { orderNo, contact: email, pin: '1357' }).catch((e) => ({ error: e }));
    ok(!r.error, `휴대전화 뒤 4자리로 주문 조회가 안 됨: ${r.error && r.error.message}`);
    const o = (await api('getOrder', { orderNo: r.orderNo, token: r.token })).order;
    eq([o.input.common.topicKnown, o.input.common.title, o.input.common.fieldText], ['free', prompt, '간호학'], '주제 기록');
    eq([o.input.paper.typeId, o.input.paper.pages, o.amount], ['master', 80, 99000], '논문 종류·분량·금액');
    eq(o.status, 'pending_payment', '주문 상태');
  })));
  await check(41, '바로 결제: 연락처 없이 내면 작업 순서 안내 창을 거쳐 결제 화면으로 가고, 결제하기를 누르면 주문이 등록되고 완료 화면에서 결제 확인 요청까지 됨', async () => withShop(async () => {
    const SNIP = fs.readFileSync(path.join(__dirname, '../imweb/skkc-connect.html'), 'utf8');
    const shopPage = (body, extra = '') => `<!doctype html><html><head><meta charset="utf-8"></head><body><header>skkc</header><main>${body}</main>${extra}${SNIP}</body></html>`;
    const VIEW = shopPage('<h1>상품 상세</h1>', '<script>window.SITE_SHOP_DETAIL = { confirmOrderWithCartItems: function () { setTimeout(function () { location.href = "/shop_payment/?order_code=o1&order_no=1"; }, 150); } };</script>');
    const PAY = shopPage('<div id="host"></div><h2>주문 상품 정보</h2>', `<script>var h = document.getElementById('host').attachShadow({ mode: 'open' });
h.innerHTML = '<input name="ordererName"><input name="ordererCall"><input name="ordererEmail"><button type="button" id="pay">결제하기</button>';
h.getElementById('pay').addEventListener('click', function () { setTimeout(function () { location.href = '/shop_payment_complete/?order_code=o1'; }, 1500); });</script>`);
    const DONE = shopPage('<h1>주문 완료</h1>');
    const c = await newCtx();
    try {
      await c.route('https://skkc.co.kr/**', (r) => {
        const u = new URL(r.request().url());
        const html = u.pathname.startsWith('/shop_view') ? VIEW : u.pathname.startsWith('/shop_payment_complete') ? DONE : u.pathname.startsWith('/shop_payment') ? PAY : '<html><body>other</body></html>';
        r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      });
      // 연결 코드는 운영 API 주소를 부른다: 개발 서버 API로 돌려 보낸다
      const calls = [];
      await c.route('https://script.google.com/**', async (r) => {
        const body = r.request().postData() || '{}';
        calls.push(JSON.parse(body).action);
        const res = await fetch(`${BASE}/api`, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
        r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: await res.text() });
      });
      const p = await c.newPage();
      await p.goto(`${BASE}/paper/new/?${new URLSearchParams({ prompt })}`);
      await p.waitForSelector('#qoTopic');
      await p.waitForFunction(() => !document.querySelector('#qoName'), null, { timeout: 10000 });
      await p.click('#qoSubmit');
      await p.waitForSelector('.go-modal');
      const modal = await text(p, '.go-modal');
      has(modal, '전공 분야 전문가 최종 검수', '작업 순서 안내');
      ok(!/성균관컨설팅/.test(modal), '안내 창에 결제 대행 이름이 보임');
      await p.waitForURL(/skkc\.co\.kr\/shop_payment\//, { timeout: 15000 });
      await p.waitForSelector('#nmBanner', { timeout: 8000 });
      const banner = await text(p, '#nmBanner');
      for (const s of ['석사학위논문 80 Page', '199,000원', '50%', '99,000원']) has(banner, s, '결제 화면 안내');
      await p.evaluate(() => { const sr = document.getElementById('host').shadowRoot; const set = (n, v) => { sr.querySelector(`[name=${n}]`).value = v; }; set('ordererName', '최간호'); set('ordererCall', '010-3456-7890'); set('ordererEmail', 'e2e-direct@example.com'); });
      await p.evaluate(() => document.getElementById('host').shadowRoot.getElementById('pay').click());
      await p.waitForURL(/shop_payment_complete/, { timeout: 10000 });
      await p.waitForFunction(() => document.getElementById('nmBanner') && /접수 완료/.test(document.getElementById('nmBanner').textContent), null, { timeout: 20000 });
      const saved = JSON.parse(await p.evaluate(() => sessionStorage.getItem('nmOrder')));
      ok(saved && saved.orderNo && saved.token, '등록된 주문이 없음');
      ok(/\/orders\/\?o=/.test(await p.getAttribute('#nmBanner a', 'href')), '진행 상황 링크');
      for (const a of ['createOrder', 'submitOrder', 'claimPayment']) ok(calls.includes(a), `${a} 호출 없음: ${calls.join(',')}`);
      const o = (await api('getOrder', { orderNo: saved.orderNo, token: saved.token })).order;
      eq([o.input.common.title, o.input.common.fieldText, o.input.paper.typeId, o.input.paper.pages, o.amount], [prompt, '간호학', 'master', 80, 99000], '등록된 주문');
      eq(o.payStatus, 'claimed', '결제 확인 요청');
      // 조회 비밀번호는 결제할 때 적은 휴대전화 뒤 4자리
      const lk = await api('lookupOrder', { orderNo: saved.orderNo, contact: 'e2e-direct@example.com', pin: '7890' }).catch((e) => ({ error: e }));
      ok(!lk.error, `휴대전화 뒤 4자리로 조회가 안 됨: ${lk.error && lk.error.message}`);
    } finally { await c.close().catch(() => {}); }
  }, { direct: true }));
  await check(41, '학교 양식·연구 방법은 보조 선택이고, 파일 없이 골라도 접수되며 요청 사항에 따로 보낸다고 남음', async () => withShop(() => withCtx({}, async (p) => {
    await catchShop(p);
    await p.goto(`${BASE}/paper/new/?${new URLSearchParams({ prompt: '사회복지학과 졸업논문인데 독거노인 고독사 예방 쪽으로 써줘' })}`);
    await p.waitForSelector('#qoTopic');
    eq(await p.$eval('input[name="qoFmt"]:checked', (e) => e.value), 'general', '기본 양식 선택');
    await p.click('label.qo-fmt-sub');
    await p.waitForSelector('[data-up="format"]');
    // 연구 방법은 접힌 칸에서 한 번 눌러 바꾸고, 금액은 그대로
    const before = await text(p, '#qoSum');
    eq(await p.$eval('input[name="qoMethod"]:checked', (e) => e.value), 'auto', '기본 연구 방법');
    await p.click('.qo-more > summary');
    await p.click('label.qo-seg-i:has(input[name="qoMethod"][value="survey"])');
    eq(await text(p, '#qoSum'), before, '연구 방법을 바꿔도 결제 요약 그대로');
    await p.fill('#qoName', '박학사');
    await p.fill('#qoPhone', '010-1111-2222');
    const email = mail('fmt');
    await p.fill('#qoEmail', email);
    await p.click('#qoSubmit');
    await p.waitForSelector('.handoff-card, .ord-no', { timeout: 30000 });
    const orderNo = ((await text(p, '#app')).match(/NA\d{6}-[A-Z0-9]+/) || [''])[0];
    const lk = await api('lookupOrder', { orderNo, contact: email, pin: '2222' });
    const o = (await api('getOrder', { orderNo: lk.orderNo, token: lk.token })).order;
    eq([o.input.paper.typeId, o.input.paper.hasFormat, o.amount], ['bachelor', 'no', 59000], '학사·양식 파일 없음·금액');
    has(o.input.common.request, '학교 양식은 나중에', '양식 안내 기록');
    eq(o.input.common.method, 'survey', '고른 연구 방법');
  })));
  await check(41, '옵션은 같은 화면에서 켜고 끄면 금액이 바로 바뀌고, 필수 칸이 비면 그 칸으로 안내', async () => withCtx({ mobile: true }, async (p) => {
    await p.goto(`${BASE}/paper/new/`);
    await p.evaluate(() => { try { localStorage.removeItem('nm:draft:quick'); } catch (e) { /* 무시 */ } });
    await p.reload();
    await p.waitForSelector('#qoTopic');
    await p.click('#qoBar button');
    await waitText(p, '#qoErr', '관심 주제나 키워드');
    await p.fill('#qoTopic', '호텔 서비스 품질');
    await p.fill('#qoMajor', '관광경영학');
    await p.click('.qo-pkg:has(input[value="short15"])');
    await waitText(p, '#qoBar', '29,000원');
    await p.click('.qo-more > summary');
    await p.click('.qo-add:has(input[data-add="priority"])');
    await waitText(p, '#qoBar', '58,000원');
    await p.click('.qo-add:has(input[data-add="priority"])');
    await waitText(p, '#qoBar', '29,000원');
    await p.click('#qoBar button');
    await waitText(p, '#qoErr', '이름');
  }));
}

/* =================================================================== 39: 시계를 앞당기는 확인(마지막) */
async function timeTravel() {
  if (ONLY.length && !ONLY.includes(39)) return;
  let D, P, U, S;
  await check(39, '전달된 결과물에 보관 기한(전달 후 90일)이 표시됨', async () => {
    D = await deliveredOrder({ input: paperIn({ title: 'E2E 보관 기한 확인 주제' }) }, { name: 'E2E_보관확인.docx' });
    P = await paidOrder({ input: paperIn({ title: 'E2E 조회 기한 확인 주제' }) });
    U = await makeOrder({ input: paperIn({ title: 'E2E 미결제 자동 취소 확인 주제' }) });
    S = await deliveredOrder({ service: 'statistics', input: { common: { fieldId: 'edu', title: 'E2E 시뮬레이션 보관 확인 주제' }, statistics: { hasData: false, noDataPath: 'simulation', output: 'interp', methods: ['auto'] }, addons: {} }, consents: { simulation: true } }, { name: 'sim_result.docx' });
    const o = await getOrder(D);
    const ymd = new Date(new Date(o.deliveredAt).getTime() + 90 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    eq(o.filesExpireAt, ymd, '서버 보관 기한');
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(D));
      await p.waitForSelector('#results');
      has(await text(p, '#results'), `${ymd}까지 보관`, '결과물 보관 기한');
      has(await text(p, '.eta-box'), `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`, '내려받기 기한');
    });
  });
  await check(39, '내려받기 권한은 60분 뒤 만료되고, 새로 고치면 새 권한으로 다시 받을 수 있음', async () => {
    ok(D, '앞 확인 실패');
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(D));
      await p.waitForSelector('#results [data-dl]');
      await clock(0.05);
      await p.click('#results [data-dl]');
      await toast(p, '내려받기 권한이 만료되었습니다. 주문 페이지를 새로 고침해 주세요.');
      await p.reload();
      await p.waitForSelector('#results [data-dl]');
      const dl = await downloadVia(p, '#results [data-dl]');
      eq(dl.name, 'E2E_보관확인.docx', '새로 고친 뒤 내려받은 파일');
    });
  });
  await check(39, '보관 기간(90일)이 지나면 예약 작업이 파일을 지우고, 열어 둔 화면에서도 내려받을 수 없음', async () => {
    ok(D && U, '앞 확인 실패');
    const c = await newCtx();
    try {
      const p = await c.newPage();
      await clock(91);
      // 정리 작업 직전에 주문 화면을 열어 둔 고객(내려받기 권한은 아직 유효)
      await p.goto(ordersUrl(D));
      await p.waitForSelector('#results [data-dl]');
      const jobs = await runJobs();
      ok(jobs.ran.includes('hourlyJob'), `매시간 작업이 돌지 않음: ${JSON.stringify(jobs)}`);
      const a = await adminOrder(D.orderNo);
      ok(a.deletedState, '보관 기간이 지났는데 삭제 표시가 없음');
      eq(a.files.results.length + a.files.customer.length, 0, '남은 파일 수');
      await p.click('#results [data-dl]');
      await toast(p, '파일이 삭제되었거나 보관 기간이 지났습니다.');
      await p.reload();
      await p.waitForSelector('.ord-card');
      eq(await p.$$eval('[data-dl]', (els) => els.length), 0, '삭제 뒤 남은 내려받기 버튼');
      const page = await text(p, '#app');
      has(page, '삭제되었습니다', '삭제 안내');
      hasNot(page, '결과물을 정리하고 있습니다', '삭제된 결과물을 준비 중으로 안내');
      hasNot(page, '요청에 따라 올리신', '보관 기간 만료인데 고객 요청 삭제로 안내');
      const u = await getOrder(U);
      eq([u.status, u.deleted], ['cancelled', true], '30일 넘은 미결제 주문');
      await p.goto(ordersUrl(U));
      await waitText(p, '#progress', '결제가 진행되지 않아 주문이 자동 취소되었습니다');
    } finally { await c.close(); }
  });
  await check(39, '보관 기간이 지나 자료가 지워진 시뮬레이션 주문도 가상 데이터 표시가 남고 논문 작성 연결을 보이지 않음', async () => {
    ok(S, '앞 확인 실패');
    ok((await adminOrder(S.orderNo)).deletedState, '시뮬레이션 주문 자료가 정리되지 않음');
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(S));
      await p.waitForSelector('.ord-card');
      eq(await text(p, '.ord-card .sim-mark'), '가상 데이터, 실제 연구 결과 아님', '삭제 뒤 가상 데이터 표시');
      eq(await p.$$eval('.next-svc a[href^="/paper/new/"]', (els) => els.length), 0, '삭제 뒤 논문 작성 연결 수');
    });
  });
  await check(39, '조회 키는 180일 뒤 만료되어 주문이 열리지 않고, 연락처와 비밀번호로 다시 확인해야 열림', async () => {
    ok(P, '앞 확인 실패');
    await withCtx({}, async (p) => {
      await p.goto(ordersUrl(P));
      await p.waitForSelector('.ord-card');
      await clock(90);
      await p.reload();
      await p.waitForSelector('#lk');
      has(await text(p, '#lkErr'), '조회 기간이 지났거나 권한이 없습니다', '만료 안내');
      hasNot(await text(p, '#app'), 'E2E 조회 기한 확인 주제', '만료된 조회 키로 보인 내용');
      await p.fill('#lkContact', P.contact.email); await p.fill('#lkPin', P.pin);
      await p.click('#lkGo');
      await p.waitForSelector('.ord-card');
      has(await text(p, '.ord-title'), 'E2E 조회 기한 확인 주제', '다시 확인한 주문');
    });
  });
}

/* =================================================================== 실행 */
(async () => {
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/__dev`);
    ok(r.ok, `개발 서버 응답 ${r.status}`);
  } catch (e) {
    console.error(`개발 서버(${BASE})에 연결하지 못했습니다. ./tools/dev-restart.sh를 먼저 실행해 주세요. (${e.message})`);
    process.exit(2);
  }
  console.log(`논문AI 인수 테스트(E2E) · ${BASE} · 실행 ${RUN}${ONLY.length ? ` · 일부 항목만: ${ONLY.join(',')}` : ''}\n`);
  // 리눅스에서 LANG이 비어 있으면 Chromium이 한글 파일 이름을 저장하지 못하고 'download'로 바꾼다(실사용 브라우저와 무관한 환경 문제)
  const utf8 = /utf-?8/i.test(process.env.LC_ALL || process.env.LANG || '');
  browser = await chromium.launch(utf8 ? {} : { env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
  try {
    await tests();
    await timeTravel();
  } finally {
    await browser.close().catch(() => {});
  }

  const items = ONLY.length ? ONLY : Object.keys(TITLES).map(Number);
  console.log('\n=== 항목별 결과 ===');
  let failed = 0;
  for (const i of items) {
    const rs = results.filter((r) => r.item === i);
    const st = !rs.length ? 'FAIL' : rs.some((r) => r.status === 'FAIL') ? 'FAIL' : 'PASS';
    if (st === 'FAIL') failed++;
    const known = rs.filter((r) => r.status === 'KNOWN').length;
    const cover = BACKEND[i] ? `E2E+단위·API(${BACKEND[i]})` : 'E2E';
    console.log(`${st}  ${pad(i)} ${TITLES[i]}  [확인 ${rs.length}개${known ? `, 알려진 백엔드 결함 ${known}` : ''} · ${cover}]${!rs.length ? ' (확인이 실행되지 않음)' : ''}`);
  }
  if (pageErrors.length) {
    console.log(`\n페이지 스크립트 오류 ${pageErrors.length}건:`);
    for (const e of [...new Set(pageErrors)].slice(0, 20)) console.log(`  ${e}`);
  }
  const n = { PASS: 0, FAIL: 0, KNOWN: 0 };
  for (const r of results) n[r.status]++;
  console.log(`\n확인 ${results.length}개: PASS ${n.PASS}, FAIL ${n.FAIL}, KNOWN ${n.KNOWN} · 항목 ${items.length}개 중 실패 ${failed}개 · ${Math.round((Date.now() - t0) / 1000)}초`);
  process.exit(failed || n.FAIL || pageErrors.length ? 1 : 0);
})();
