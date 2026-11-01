// 개발 서버: 정적 사이트 + Apps Script 에뮬레이터 API (/api)
// 사용: OUT_DIR=docs-dev API_URL=/api node tools/build.mjs && node tools/dev-server.mjs [port] [dir] [--seed]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createGasEnv } from './gas-mock/index.mjs';
import { DEFAULT_CATALOG, computeQuote } from '../src/js/core/pricing.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const port = Number(args[0] || 4174);
const dir = path.resolve(root, args[1] || 'docs-dev');
const seed = process.argv.includes('--seed');

execFileSync(process.execPath, [path.join(root, 'tools/build-backend.mjs')], { stdio: 'ignore' });
let env;
env = createGasEnv({
  now: new Date(),
  ownerEmail: 'owner@skkc.test',
  mailQuota: 100,
  webAppUrl: `http://localhost:${port}/api`,
  fetchHandler: (url, params) => {
    const m = url.match(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/([^?]+)/);
    if (m && params.method === 'delete') { env.state.drive.files.delete(decodeURIComponent(m[1])); env.state.drive.folders.delete(decodeURIComponent(m[1])); return { code: 204, body: '', headers: {} }; }
    return { code: 200, body: '{}', headers: {} };
  },
});
env.load(fs.readFileSync(path.join(root, 'backend/dist/Code.gs'), 'utf8'), 'Code.gs');
const setup = env.call('setup');
env.call('saveSettings_', { siteUrl: `http://localhost:${port}`, bankEnabled: 'true', bankName: '국민은행', bankAccount: '123456-01-000000', bankHolder: '성균관컨설팅' });

const call = (action, payload = {}) => {
  const r = env.doPost({ action, ...payload }).json;
  if (!r || !r.ok) throw new Error(`${action}: ${r && r.message}`);
  return r;
};

const seeded = [];
if (seed) {
  const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(2400, 7)]).toString('base64');
  const C = { privacy: true, ethics: true, withdrawal: true };
  const mk = (service, input, contact, extra = {}) => {
    const q = computeQuote(DEFAULT_CATALOG, { service, paper: input.paper, survey: input.survey, statistics: input.statistics, addons: input.addons || {} });
    const r = call('createOrder', { service, input, contact, pin: '1234', consents: { ...C, ...extra.consents }, design: extra.design || null, clientQuote: { total: q.total } });
    for (const f of extra.files || []) call('uploadFile', { orderNo: r.orderNo, token: r.token, slot: f.slot, name: f.name, mime: 'application/octet-stream', data: DOCX });
    if (extra.submit !== false) call('submitOrder', { orderNo: r.orderNo, token: r.token });
    seeded.push({ orderNo: r.orderNo, token: r.token, label: extra.label });
    return r;
  };
  const admin = call('adminLogin', { password: setup.password }).adminToken;
  const t1 = '중학생의 학업 스트레스가 학교적응에 미치는 영향: 자기효능감의 매개효과';
  const a = mk('paper', { common: { fieldId: 'edu', title: t1, keywords: [], method: 'auto' }, paper: { typeId: 'master', task: 'full' }, addons: { revisions: 1 } }, { name: '김연구', email: 'kim@example.com', phone: '010-1234-5678' }, { label: '진행 중(결제 확인 대기)', design: { title: t1, designLabel: '매개효과 모형', methodLabel: '양적연구' } });
  call('claimPayment', { orderNo: a.orderNo, token: a.token, method: 'skkc', payerName: '김연구' });
  const b = mk('paper', { common: { fieldId: 'nursing', title: '간호사의 감정노동이 소진에 미치는 영향', keywords: [] }, paper: { typeId: 'master', task: 'feedback', feedbackText: '1. 서론의 연구 필요성을 보강할 것\n2. 표 4-2의 소수점 자리를 통일할 것' } }, { name: '이간호', email: 'lee@example.com', phone: '010-2222-3333' }, { label: '자료 보완 필요', files: [{ slot: 'manuscript', name: '석사논문_심사본.docx' }] });
  call('adminConfirmPayment', { adminToken: admin, orderNo: b.orderNo });
  call('adminRequestMaterials', { adminToken: admin, orderNo: b.orderNo, items: ['학교 논문 작성 양식'], message: '학교 대학원 홈페이지의 학위논문 양식 파일을 올려 주세요.' });
  mk('survey', { common: { fieldId: 'nursing' }, survey: { mode: 'full', recruit: 'us', target: 'nurse', targetN: '200' } }, { name: '박설문', email: 'park@example.com', phone: '010-3333-4444' }, { label: '견적 확인 중' });
  mk('statistics', { common: { fieldId: 'biz' }, statistics: { hasData: true, output: 'interp', methods: ['regression', 'mediation'], advanced: true } }, { name: '최통계', email: 'choi@example.com', phone: '010-4444-5555' }, { label: '결제 대기', files: [{ slot: 'data', name: '설문응답_정리.xlsx' }] });
  const e = mk('paper', { common: { fieldId: 'media', title: '대학생의 SNS 이용 동기가 외로움에 미치는 영향', keywords: [] }, paper: { typeId: 'journal', task: 'full' } }, { name: '정학술', email: 'jung@example.com', phone: '010-5555-6666' }, { label: '전달 완료', design: { title: '대학생의 SNS 이용 동기가 외로움에 미치는 영향' } });
  call('adminConfirmPayment', { adminToken: admin, orderNo: e.orderNo });
  call('adminUploadResult', { adminToken: admin, orderNo: e.orderNo, name: '투고논문_초안_v1.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: DOCX });
  call('adminUploadResult', { adminToken: admin, orderNo: e.orderNo, name: '참고문헌_APA7.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: DOCX });
  call('adminUpdateStatus', { adminToken: admin, orderNo: e.orderNo, status: 'delivered' });
  const f = mk('statistics', { common: { fieldId: 'counsel' }, statistics: { hasData: false, noDataPath: 'simulation', output: 'interp', methods: ['ttest'] } }, { name: '한학습', email: 'han@example.com', phone: '010-6666-7777' }, { label: '결제 확인 중(무통장)', consents: { simulation: true } });
  call('claimPayment', { orderNo: f.orderNo, token: f.token, method: 'bank', payerName: '한학습' });
  call('addMessage', { orderNo: a.orderNo, token: a.token, type: 'question', text: '심사가 다음 달 20일인데 그 전에 받을 수 있을까요?' });
  mk('paper', { common: { fieldId: 'edu', title: '', keywords: ['초등교사', '직무스트레스', '회복탄력성'] }, paper: { typeId: 'master', task: 'proposal' } }, { name: '오계획', email: 'oh@example.com', phone: '010-7777-8888' }, { label: '결제 대기(계획서)' });
}

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api' || u.pathname === '/api/') {
    if (req.method === 'GET') {
      const r = env.doGet(Object.fromEntries(u.searchParams));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(r.text);
    }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let r;
      try { r = env.doPost(body); } catch (e) { res.writeHead(500); return res.end(JSON.stringify({ ok: false, error: 'server', message: e.message })); }
      setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(r.text); }, Number(process.env.API_DELAY || 120));
    });
    return;
  }
  if (u.pathname === '/__dev') {
    // queued: 하루 메일 할당량(에뮬레이터 100통)을 넘어 메일대기 시트에 쌓인 메일
    let queued = [];
    try {
      const ss = env.findSpreadsheetByName('논문AI 운영 시트');
      if (ss) queued = env.sheetValues(ss.getId(), '메일대기').slice(1).filter((r) => r[4] !== 'sent').slice(-30).map((r) => ({ to: String(r[1]), subject: String(r[2]), status: String(r[4]) }));
    } catch { queued = []; }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ password: setup.password, seeded, mails: env.state.mails.slice(-30).map((m) => ({ to: m.to, subject: m.subject })), queued }, null, 2));
  }
  if (u.pathname === '/__clock' && req.method === 'POST') {
    env.clock.advance(Number(u.searchParams.get('days') || 1) * 86400000);
    res.writeHead(200); return res.end('ok');
  }
  if (u.pathname === '/__jobs' && req.method === 'POST') {
    // 예약 작업(매시간 정리·일일 브리핑) 중 지금 시각에 돌아야 하는 것을 한 번 실행
    let ran = [], error = '';
    try { ran = env.runTriggers(); } catch (e) { ran = e.ran || []; error = e.message; }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ran, error, now: env.clock.now().toISOString() }));
  }
  let p = decodeURIComponent(u.pathname);
  let file = path.join(dir, p);
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { file = path.join(dir, '404.html'); res.statusCode = 404; if (!fs.existsSync(file)) return res.end('not found'); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
});
server.listen(port, () => {
  console.log(`dev http://localhost:${port} → ${path.relative(root, dir)}/  (API: /api, 관리자 비밀번호: ${setup.password})`);
  for (const s of seeded) console.log(`  ${s.label}: http://localhost:${port}/orders/?o=${s.orderNo}&t=${encodeURIComponent(s.token)}`);
});
