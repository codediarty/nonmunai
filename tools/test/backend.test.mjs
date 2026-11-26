// Apps Script 백엔드 API 테스트 (gas-mock 에뮬레이터 위에서 실제 Code.gs 실행)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createGasEnv } from '../gas-mock/index.mjs';
import { DEFAULT_CATALOG, computeQuote } from '../../src/js/core/pricing.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
execFileSync(process.execPath, [path.join(root, 'tools/build-backend.mjs')], { stdio: 'ignore' });
const CODE = fs.readFileSync(path.join(root, 'backend/dist/Code.gs'), 'utf8');

export const tests = [];
const t = (name, fn) => tests.push({ name, fn });

const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(300, 7)]).toString('base64');
const XLSX = DOCX;
const PDF = Buffer.from('%PDF-1.4\n% test\n1 0 obj<<>>endobj\n').toString('base64');
const EXE = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(100, 1)]).toString('base64');
const CONSENTS = { privacy: true, ethics: true, withdrawal: true, marketing: false };
const CONTACT = { name: '김연구', email: 'kim@example.com', phone: '010-1234-5678' };

export function makeEnv({ now = '2026-11-02T10:00:00+09:00', toss = null } = {}) {
  let env;
  const fetchHandler = (url, params) => {
    if (url.startsWith('https://ntfy.sh')) return { code: 200, body: '{}', headers: {} };
    const m = url.match(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/([^?]+)/);
    if (m && params.method === 'delete') {
      const id = decodeURIComponent(m[1]);
      env.state.drive.files.delete(id);
      env.state.drive.folders.delete(id);
      return { code: 204, body: '', headers: {} };
    }
    if (url.startsWith('https://api.tosspayments.com/')) {
      if (toss) return toss(url, params);
      return { code: 401, body: JSON.stringify({ code: 'UNAUTHORIZED', message: 'no key' }), headers: {} };
    }
    return { code: 404, body: 'not found', headers: {} };
  };
  env = createGasEnv({ now, ownerEmail: 'owner@skkc.test', mailQuota: 100, fetchHandler, webAppUrl: 'https://script.google.com/macros/s/TEST/exec' });
  env.load(CODE, 'Code.gs');
  const r = env.call('setup');
  const post = (action, payload = {}) => {
    const res = env.doPost({ action, ...payload });
    assert.ok(res.json, `${action}: JSON 응답이 아닙니다: ${res.text.slice(0, 200)}`);
    return res.json;
  };
  const ok = (action, payload) => {
    const j = post(action, payload);
    assert.equal(j.ok, true, `${action} 실패: ${j.error} ${j.message}`);
    return j;
  };
  const fail = (action, payload, code) => {
    const j = post(action, payload);
    assert.equal(j.ok, false, `${action}이 실패해야 하는데 성공했습니다`);
    if (code) assert.equal(j.error, code, `${action}: 오류 코드 ${j.error} (${j.message})`);
    return j;
  };
  const login = () => ok('adminLogin', { password: r.password }).adminToken;
  return { env, setup: r, post, ok, fail, login };
}

function paperOrder(x, { task = 'full', typeId = 'master', extra = {} } = {}) {
  const input = { common: { fieldId: 'edu', title: '중학생의 학업 스트레스가 학교적응에 미치는 영향: 자기효능감의 매개효과', keywords: [], method: 'auto', due: '' }, paper: { typeId, task, ...extra }, addons: {} };
  const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: input.paper, addons: input.addons });
  const r = x.ok('createOrder', { service: 'paper', input, contact: CONTACT, pin: '2468', consents: CONSENTS, design: { title: input.common.title, designLabel: '매개효과 모형' }, clientQuote: { total: q.total } });
  return { ...r, clientTotal: q.total };
}

t('setup: 시트·폴더·트리거를 만들고 관리자 비밀번호를 운영자 메일로 보냄', () => {
  const x = makeEnv();
  assert.ok(x.setup.spreadsheetUrl);
  assert.match(x.setup.password, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  const mail = x.env.state.mails.find((m) => /관리자 설정 완료/.test(m.subject));
  assert.ok(mail, '설정 메일이 없습니다');
  assert.ok(mail.htmlBody.includes(x.setup.password));
  assert.deepEqual(x.env.state.triggers.map((tr) => tr.handler || tr.handlerFunction).sort(), ['dailyDigest', 'hourlyJob']);
  // 두 번 실행해도 비밀번호가 바뀌지 않음
  const again = x.env.call('setup');
  assert.equal(again.password, null);
  x.ok('ping');
  const cfg = x.ok('config');
  assert.ok(cfg.catalog.items.length > 30);
  assert.equal(cfg.settings.skkcEnabled, 'true');
  assert.equal(cfg.settings.ADMIN_HASH, undefined);
});

t('주문서 검증: 필수 동의·연락처·비밀번호', () => {
  const x = makeEnv();
  const base = { service: 'paper', input: { common: {}, paper: { typeId: 'master', task: 'full' } }, contact: CONTACT, pin: '2468', consents: CONSENTS };
  x.fail('createOrder', { ...base, consents: { privacy: true, ethics: true } }, 'invalid');
  x.fail('createOrder', { ...base, consents: { ethics: true, withdrawal: true } }, 'invalid');
  x.fail('createOrder', { ...base, contact: { ...CONTACT, email: 'bad' } }, 'invalid');
  x.fail('createOrder', { ...base, pin: '12' }, 'invalid');
  x.fail('createOrder', { ...base, hp: 'bot' }, 'bad_request');
  x.fail('createOrder', { ...base, service: 'nope' }, 'bad_request');
  const r = x.ok('createOrder', base);
  assert.match(r.orderNo, /^NA\d{6}-[A-Z0-9]{4}$/);
});

t('서버 가격이 화면 가격과 같고 위조된 금액은 무시됨', () => {
  const x = makeEnv();
  const input = { common: { fieldId: 'edu' }, paper: { typeId: 'master', task: 'full', pages: 85 }, addons: { priority: true, revisions: 1 } };
  const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: input.paper, addons: input.addons });
  const r = x.ok('createOrder', { service: 'paper', input, contact: CONTACT, pin: '2468', consents: CONSENTS, clientQuote: { total: 1000 } });
  assert.equal(r.quote.total, q.total);
  const o = x.ok('getOrder', { orderNo: r.orderNo, token: r.token }).order;
  assert.equal(o.amount, q.total);
  const logs = x.env.sheetValues(x.env.findSpreadsheetByName('논문AI 운영 시트').getId(), '로그');
  assert.ok(logs.some((row) => row[1] === 'price_mismatch'));
});

t('파일: 형식·내용 검사, 필수 자료 없으면 제출 불가', () => {
  const x = makeEnv();
  const r = paperOrder(x, { task: 'edit' });
  const auth = { orderNo: r.orderNo, token: r.token };
  x.fail('submitOrder', auth, 'missing_files');
  x.fail('uploadFile', { ...auth, slot: 'manuscript', name: 'virus.exe', mime: 'application/octet-stream', data: EXE }, 'file_type');
  x.fail('uploadFile', { ...auth, slot: 'manuscript', name: 'fake.docx', mime: 'application/msword', data: EXE }, 'file_content');
  x.fail('uploadFile', { ...auth, slot: 'manuscript', name: 'fake.pdf', mime: 'application/pdf', data: DOCX }, 'file_content');
  const up = x.ok('uploadFile', { ...auth, slot: 'manuscript', name: '원고 초안.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: DOCX });
  assert.equal(up.file.slot, 'manuscript');
  const sub = x.ok('submitOrder', auth);
  assert.equal(sub.order.status, 'pending_payment');
  assert.equal(sub.order.amountDue, 49000);
  // 다른 주문 토큰으로는 볼 수 없음
  const r2 = paperOrder(x);
  x.fail('getOrder', { orderNo: r.orderNo, token: r2.token }, 'forbidden');
});

t('주문 흐름: 제출 → 결제 완료 알림 → 작성·분석 진행 → 결과 전달 → 내려받기 → 수정 요청', () => {
  const x = makeEnv();
  const r = paperOrder(x);
  const auth = { orderNo: r.orderNo, token: r.token };
  const sub = x.ok('submitOrder', auth).order;
  assert.equal(sub.status, 'pending_payment');
  assert.ok(x.env.state.mails.some((m) => m.to.includes(CONTACT.email) && /주문서가 접수/.test(m.subject)), '고객 접수 메일 없음');
  assert.ok(x.env.state.mails.some((m) => m.to.includes('contact@skkc.co.kr') && /신규 주문/.test(m.subject)), '운영자 알림 없음');
  // 고객이 성균관컨설팅 결제 후 "결제를 마쳤어요"
  const pay = sub.payments.find((p) => p.status === 'requested');
  const cl = x.ok('claimPayment', { ...auth, method: 'skkc', payerName: '김연구', paymentId: pay.id }).order;
  assert.equal(cl.status, 'in_progress');
  assert.ok(cl.eta, '예상 전달일 없음');
  assert.equal(cl.queuePosition, 1);
  assert.ok(cl.timeline.some((h) => h.status === 'in_progress' && /예상 전달일/.test(h.message)));
  // 관리자: 결제 확인 목록에 보이고 확인 처리
  const token = x.login();
  const dash = x.ok('adminDashboard', { adminToken: token });
  assert.equal(dash.claims.length, 1);
  assert.equal(dash.queue.length, 1);
  assert.equal(dash.claims[0].claimRef, '김연구');
  x.ok('adminConfirmPayment', { adminToken: token, orderNo: r.orderNo, paymentId: pay.id });
  let ao = x.ok('adminGetOrder', { adminToken: token, orderNo: r.orderNo }).order;
  assert.equal(ao.payStatus, 'paid');
  assert.equal(ao.paidAmount, r.clientTotal);
  assert.equal(ao.contact.email, CONTACT.email);
  assert.equal(ao.workStartedAt, '');
  // 결과물 올리기(착수 자동 기록) → 전달
  const res = x.ok('adminUploadResult', { adminToken: token, orderNo: r.orderNo, name: '논문 초안 v1.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: DOCX });
  assert.equal(res.file.name, '논문 초안 v1.docx');
  assert.ok(res.order.workStartedAt, '착수 기록 없음');
  x.ok('adminUpdateStatus', { adminToken: token, orderNo: r.orderNo, status: 'delivered' });
  assert.ok(x.env.state.mails.some((m) => m.to.includes(CONTACT.email) && /결과물이 전달/.test(m.subject)));
  const o = x.ok('getOrder', auth).order;
  assert.equal(o.status, 'delivered');
  assert.equal(o.files.results.length, 1);
  assert.ok(o.filesExpireAt);
  assert.ok(o.revisionUntil);
  assert.equal(o.allow.revision, true);
  assert.equal(o.contact.email, 'ki***@example.com');
  const f = o.files.results[0];
  const dl = x.ok('downloadFile', { orderNo: r.orderNo, fileId: f.id, ticket: f.ticket });
  assert.equal(dl.data, DOCX);
  x.fail('downloadFile', { orderNo: r.orderNo, fileId: f.id, ticket: 'forged' }, 'forbidden');
  // 수정 요청(포함 1회)
  const rv = x.ok('addMessage', { ...auth, type: 'revision', text: '2장 선행연구 3편을 보강해 주세요.' }).order;
  assert.equal(rv.status, 'revision');
  assert.equal(rv.revisions.used, 1);
  assert.equal(rv.revisions.allowed, 1);
});

t('수정 요청은 전달 후 30일까지만', () => {
  const x = makeEnv();
  const r = paperOrder(x);
  const auth = { orderNo: r.orderNo, token: r.token };
  x.ok('submitOrder', auth);
  const token = x.login();
  x.ok('adminConfirmPayment', { adminToken: token, orderNo: r.orderNo });
  x.ok('adminUpdateStatus', { adminToken: token, orderNo: r.orderNo, status: 'delivered' });
  x.env.clock.advance(31 * 86400000);
  const o = x.ok('getOrder', auth).order;
  assert.equal(o.allow.revision, false);
  x.fail('addMessage', { ...auth, type: 'revision', text: '수정해 주세요' }, 'forbidden');
  x.ok('addMessage', { ...auth, type: 'question', text: '문의드립니다' });
});

t('견적형 주문: 결제 불가 → 관리자 견적 확정 → 결제 대기', () => {
  const x = makeEnv();
  const input = { common: { fieldId: 'nursing' }, survey: { mode: 'full', recruit: 'us', target: 'nurse', targetN: '200' }, addons: {} };
  const r = x.ok('createOrder', { service: 'survey', input, contact: CONTACT, pin: '1357', consents: CONSENTS });
  assert.equal(r.quote.quoteRequired, true);
  const auth = { orderNo: r.orderNo, token: r.token };
  const sub = x.ok('submitOrder', auth).order;
  assert.equal(sub.status, 'quote_requested');
  assert.equal(sub.amountDue, 0);
  assert.equal(sub.allow.pay, false);
  x.fail('claimPayment', { ...auth, method: 'skkc' }, 'no_payment');
  const token = x.login();
  const dash = x.ok('adminDashboard', { adminToken: token });
  assert.equal(dash.quotes.length, 1);
  x.ok('adminSetQuote', { adminToken: token, orderNo: r.orderNo, total: 549000, message: '간호사 200명 모집 포함 견적입니다.', days: 10 });
  const o = x.ok('getOrder', auth).order;
  assert.equal(o.status, 'pending_payment');
  assert.equal(o.amountDue, 549000);
  assert.ok(x.env.state.mails.some((m) => /확정 견적/.test(m.subject)));
});

t('무통장입금 알림은 확인 전까지 결제 확인 중, 거절하면 결제 대기로', () => {
  const x = makeEnv();
  const r = paperOrder(x);
  const auth = { orderNo: r.orderNo, token: r.token };
  x.ok('submitOrder', auth);
  const cl = x.ok('claimPayment', { ...auth, method: 'bank', payerName: '김연구' }).order;
  assert.equal(cl.status, 'payment_review');
  const token = x.login();
  const dash = x.ok('adminDashboard', { adminToken: token });
  const claim = dash.claims[0];
  x.ok('adminRejectClaim', { adminToken: token, orderNo: r.orderNo, paymentId: claim.paymentId });
  const o = x.ok('getOrder', auth).order;
  assert.equal(o.status, 'pending_payment');
  assert.equal(o.amountDue, r.clientTotal);
});

t('자료 보완 요청 → 고객 업로드 → 보완 완료로 다시 진행', () => {
  const x = makeEnv();
  const r = paperOrder(x);
  const auth = { orderNo: r.orderNo, token: r.token };
  x.ok('submitOrder', auth);
  const token = x.login();
  x.ok('adminConfirmPayment', { adminToken: token, orderNo: r.orderNo });
  x.ok('adminRequestMaterials', { adminToken: token, orderNo: r.orderNo, items: ['학교 논문 양식 파일'], message: '학교 홈페이지의 양식 파일을 올려 주세요.' });
  let o = x.ok('getOrder', auth).order;
  assert.equal(o.status, 'needs_materials');
  assert.ok(o.messages.some((m) => m.from === 'admin' && m.type === 'materials'));
  assert.ok(x.env.state.mails.some((m) => /자료 보완/.test(m.subject)));
  x.ok('uploadFile', { ...auth, slot: 'format', name: '양식.pdf', mime: 'application/pdf', data: PDF });
  o = x.ok('addMessage', { ...auth, type: 'materials_done', text: '' }).order;
  assert.equal(o.status, 'checking');
});

t('통계 학습용 시뮬레이션: 동의 필수, 결과 파일명에 가상 데이터 표시', () => {
  const x = makeEnv();
  const input = { common: { fieldId: 'social' }, statistics: { hasData: false, noDataPath: 'simulation', output: 'interp', methods: ['regression'] }, addons: {} };
  x.fail('createOrder', { service: 'statistics', input, contact: CONTACT, pin: '1357', consents: CONSENTS }, 'invalid');
  const r = x.ok('createOrder', { service: 'statistics', input, contact: CONTACT, pin: '1357', consents: { ...CONSENTS, simulation: true } });
  assert.equal(r.quote.total, 19000);
  x.ok('submitOrder', { orderNo: r.orderNo, token: r.token });
  const token = x.login();
  const res = x.ok('adminUploadResult', { adminToken: token, orderNo: r.orderNo, name: '분석결과.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: XLSX });
  assert.equal(res.file.name, '[가상데이터_실제연구결과아님] 분석결과.xlsx');
});

t('주문 조회: 연락처+비밀번호, 틀리면 실패, 반복 실패는 잠금', () => {
  const x = makeEnv();
  const r = paperOrder(x);
  x.ok('submitOrder', { orderNo: r.orderNo, token: r.token });
  const a = x.ok('lookupOrder', { orderNo: r.orderNo, contact: '01012345678', pin: '2468' });
  x.ok('getOrder', { orderNo: r.orderNo, token: a.token });
  x.ok('lookupOrder', { orderNo: r.orderNo.toLowerCase(), contact: 'KIM@example.com', pin: '2468' });
  x.fail('lookupOrder', { orderNo: r.orderNo, contact: CONTACT.email, pin: '0000' }, 'lookup_failed');
  for (let i = 0; i < 6; i++) x.post('lookupOrder', { orderNo: r.orderNo, contact: CONTACT.email, pin: '9999' });
  const locked = x.post('lookupOrder', { orderNo: r.orderNo, contact: CONTACT.email, pin: '2468' });
  assert.equal(locked.ok, false);
  assert.equal(locked.error, 'rate_limited');
  // 조회 링크 메일: 존재 여부를 드러내지 않음
  assert.equal(x.ok('sendAccessLink', { email: 'nobody@example.com' }).sent, true);
  x.ok('sendAccessLink', { email: CONTACT.email });
  assert.ok(x.env.state.mails.some((m) => /주문 조회 링크/.test(m.subject) && m.to.includes(CONTACT.email)));
});

t('결제 전 취소는 자료를 바로 삭제(영구 삭제)', () => {
  const x = makeEnv();
  const r = paperOrder(x, { task: 'edit' });
  const auth = { orderNo: r.orderNo, token: r.token };
  const up = x.ok('uploadFile', { ...auth, slot: 'manuscript', name: '원고.docx', mime: 'application/octet-stream', data: DOCX });
  x.ok('submitOrder', auth);
  assert.ok(x.env.state.drive.files.has(up.file.id));
  const o = x.ok('cancelOrder', auth).order;
  assert.equal(o.status, 'cancelled');
  assert.equal(o.deleted, true);
  assert.equal(x.env.state.drive.files.has(up.file.id), false, 'Drive에서 영구 삭제되지 않았습니다');
  assert.ok(x.env.state.fetches.some((f) => f.url.includes('/drive/v3/files/') && f.params.method === 'delete'));
});

t('자동 정리: 미제출 3일(개인정보까지), 미결제 30일, 전달 후 90일', () => {
  const x = makeEnv();
  const draft = paperOrder(x);
  const unpaid = paperOrder(x, { task: 'edit' });
  const up = x.ok('uploadFile', { orderNo: unpaid.orderNo, token: unpaid.token, slot: 'manuscript', name: 'a.docx', mime: '', data: DOCX });
  x.ok('submitOrder', { orderNo: unpaid.orderNo, token: unpaid.token });
  const done = paperOrder(x);
  x.ok('submitOrder', { orderNo: done.orderNo, token: done.token });
  const token = x.login();
  x.ok('adminConfirmPayment', { adminToken: token, orderNo: done.orderNo });
  const res = x.ok('adminUploadResult', { adminToken: token, orderNo: done.orderNo, name: 'r.docx', mime: '', data: DOCX });
  x.ok('adminUpdateStatus', { adminToken: token, orderNo: done.orderNo, status: 'delivered' });

  x.env.clock.advance(4 * 86400000);
  x.env.call('maintenance_');
  let a = x.ok('adminGetOrder', { adminToken: x.login(), orderNo: draft.orderNo }).order;
  assert.equal(a.status, 'cancelled');
  assert.equal(a.contact.email, '');
  assert.equal(a.contact.name, '');
  x.fail('lookupOrder', { orderNo: draft.orderNo, contact: CONTACT.email, pin: '2468' }, 'lookup_failed');

  x.env.clock.advance(27 * 86400000);
  x.env.call('maintenance_');
  a = x.ok('adminGetOrder', { adminToken: x.login(), orderNo: unpaid.orderNo }).order;
  assert.equal(a.status, 'cancelled');
  assert.equal(x.env.state.drive.files.has(up.file.id), false);
  assert.equal(a.contact.email, CONTACT.email, '결제 전이라도 제출한 주문의 거래 기록은 남김');

  assert.ok(x.env.state.drive.files.has(res.file.id));
  x.env.clock.advance(60 * 86400000);
  x.env.call('maintenance_');
  assert.equal(x.env.state.drive.files.has(res.file.id), false, '보관 기간 만료 파일이 남아 있습니다');
});

t('관리자: 로그인 실패 제한, 토큰 없으면 거부, 비밀번호 변경 후 이전 토큰 무효', () => {
  const x = makeEnv();
  x.fail('adminDashboard', {}, 'admin_required');
  x.fail('adminLogin', { password: 'wrong' }, 'login_failed');
  const token = x.login();
  x.ok('adminDashboard', { adminToken: token });
  x.fail('adminChangePassword', { adminToken: token, current: x.setup.password, next: 'short' }, 'invalid');
  const ch = x.ok('adminChangePassword', { adminToken: token, current: x.setup.password, next: 'new-password-2026' });
  x.fail('adminDashboard', { adminToken: token }, 'admin_required');
  x.ok('adminDashboard', { adminToken: ch.adminToken });
  x.ok('adminLogin', { password: 'new-password-2026' });
});

t('관리자 설정 저장: 공개 설정에 반영, 비밀 키는 공개되지 않음', () => {
  const x = makeEnv();
  const token = x.login();
  const s = x.ok('adminGetSettings', { adminToken: token });
  assert.ok(s.settings || s.items);
  x.ok('adminSaveSettings', { adminToken: token, settings: { bankEnabled: 'true', bankName: '국민은행', bankAccount: '000-00-0000', dailyCapacity: '2' } });
  const cfg = x.ok('config');
  assert.equal(cfg.settings.bankEnabled, 'true');
  assert.equal(cfg.settings.bankName, '국민은행');
  assert.equal(JSON.stringify(cfg).includes('TOSS_SECRET'), false);
});

t('가격표 편집이 서버 견적에 바로 반영', () => {
  const x = makeEnv();
  const token = x.login();
  const cat = x.ok('adminGetCatalog', { adminToken: token }).catalog;
  const item = cat.items.find((i) => i.code === 'P-MASTER-FULL');
  item.price = 459000;
  item.payUrl = 'https://skkc.co.kr/shop_view/?idx=99';
  x.ok('adminSaveCatalog', { adminToken: token, catalog: cat });
  const r = paperOrder(x);
  assert.equal(r.quote.total, 459000);
  const cfg = x.ok('config');
  assert.equal(cfg.catalog.items.find((i) => i.code === 'P-MASTER-FULL').payUrl, 'https://skkc.co.kr/shop_view/?idx=99');
});

t('가격표 문구 맞추기(syncCatalogText): 이름·포함 문구만 기본값으로, 가격과 결제 링크는 유지', () => {
  const x = makeEnv();
  const token = x.login();
  const cat = x.ok('adminGetCatalog', { adminToken: token }).catalog;
  const item = cat.items.find((i) => i.code === 'P-MASTER-FULL');
  item.name = '석사학위논문 옛 이름'; item.includes = ['옛 포함 문구']; item.price = 459000; item.payUrl = 'https://skkc.co.kr/shop_view/?idx=99';
  x.ok('adminSaveCatalog', { adminToken: token, catalog: cat });
  cat.items = cat.items.filter((i) => i.code !== 'A-PPT');
  x.ok('adminSaveCatalog', { adminToken: token, catalog: cat });
  const res = x.env.call('syncCatalogText');
  assert.deepEqual(res.changed, ['P-MASTER-FULL']);
  assert.deepEqual(res.added, ['A-PPT']);
  const ppt = x.ok('config').catalog.items.find((i) => i.code === 'A-PPT');
  assert.equal(ppt.price, DEFAULT_CATALOG.items.find((i) => i.code === 'A-PPT').price);
  const after = x.ok('config').catalog.items.find((i) => i.code === 'P-MASTER-FULL');
  const def = DEFAULT_CATALOG.items.find((i) => i.code === 'P-MASTER-FULL');
  assert.equal(after.name, def.name);
  assert.deepEqual(after.includes, def.includes);
  assert.equal(after.price, 459000);
  assert.equal(after.payUrl, 'https://skkc.co.kr/shop_view/?idx=99');
  const again = x.env.call('syncCatalogText');
  assert.deepEqual([again.changed, again.added], [[], []]);
});

t('토스페이먼츠: 승인 성공 시 결제 확정, 금액 위조 거부', () => {
  const x = makeEnv({
    toss: (url, params) => {
      if (url.endsWith('/v1/payments/confirm')) {
        const body = JSON.parse(params.payload);
        return { code: 200, body: JSON.stringify({ status: 'DONE', orderId: body.orderId, totalAmount: body.amount, paymentKey: body.paymentKey }), headers: {} };
      }
      return { code: 404, body: '{}', headers: {} };
    },
  });
  const token = x.login();
  const saved = x.ok('adminSaveSettings', { adminToken: token, settings: { tossEnabled: 'true', tossClientKey: 'test_gck_x' }, tossSecretKey: 'test_gsk_x' });
  assert.equal(saved.secrets.tossSecretKey, 'set');
  assert.equal(JSON.stringify(saved).includes('test_gsk_x'), false, '비밀 키가 응답에 노출됨');
  const r = paperOrder(x);
  const auth = { orderNo: r.orderNo, token: r.token };
  const o = x.ok('submitOrder', auth).order;
  const pay = o.payments[0];
  x.fail('confirmToss', { ...auth, paymentKey: 'pk_1', tossOrderId: `${r.orderNo}-${pay.id}`, amount: 1000, paymentId: pay.id }, 'amount_mismatch');
  const ok = x.ok('confirmToss', { ...auth, paymentKey: 'pk_1', tossOrderId: `${r.orderNo}-${pay.id}`, amount: pay.amount, paymentId: pay.id }).order;
  assert.equal(ok.payStatus, 'paid');
  assert.equal(ok.status, 'in_progress');
});

t('예약 작업: 아침 작업과 매시간 작업이 오류 없이 실행, 오늘의 작업 브리핑은 기본으로 보내지 않고 켜면 보냄', () => {
  const x = makeEnv({ now: '2026-11-02T07:30:00+09:00' });
  const r = paperOrder(x);
  x.ok('submitOrder', { orderNo: r.orderNo, token: r.token });
  x.ok('claimPayment', { orderNo: r.orderNo, token: r.token, method: 'skkc' });
  const before = x.env.state.mails.length;
  x.env.clock.advance(60 * 60 * 1000);
  const ran = x.env.runTriggers();
  assert.ok(ran.includes('dailyDigest') || ran.includes('hourlyJob'));
  x.env.call('dailyDigest');
  assert.ok(!x.env.state.mails.slice(before).some((m) => /오늘의 작업/.test(m.subject)), '끈 브리핑 메일이 감');
  x.ok('adminSaveSettings', { adminToken: x.login(), settings: { dailyBriefing: 'true' } });
  x.env.call('dailyDigest');
  assert.ok(x.env.state.mails.slice(before).some((m) => /오늘의 작업/.test(m.subject)), '켠 브리핑 메일 없음');
});

t('아침 메일은 전달 예정일에만: 오늘이 예정일인 진행 중 주문만 주문마다 알림(내용 전체, 답장은 고객에게), 같은 날 다시 보내지 않음', () => {
  const x = makeEnv({ now: '2026-11-24T14:00:00+09:00' });
  const token = x.login();
  const make = () => {
    const r = paperOrder(x);
    x.ok('submitOrder', { orderNo: r.orderNo, token: r.token });
    x.ok('claimPayment', { orderNo: r.orderNo, token: r.token, method: 'skkc', payerName: CONTACT.name });
    return { ...r, eta: x.ok('getOrder', { orderNo: r.orderNo, token: r.token }).order.eta };
  };
  const a = make(), b = make(), c = make();
  assert.ok(a.eta && a.eta === b.eta && a.eta === c.eta, `예정일: ${a.eta} ${b.eta} ${c.eta}`);
  x.ok('adminUpdateStatus', { adminToken: token, orderNo: b.orderNo, status: 'completed', notify: false });
  x.ok('adminUpdateStatus', { adminToken: token, orderNo: c.orderNo, status: 'review' });
  const due = (m) => /오늘 전달 예정/.test(m.subject);
  const morning = (ymd) => x.env.clock.set(`${ymd}T08:00:00+09:00`);
  // 예정일 전날 아침: 아무 메일도 없음
  const prev = new Date(new Date(`${a.eta}T00:00:00+09:00`).getTime() - 86400000);
  morning(new Date(prev.getTime() + 9 * 3600000).toISOString().slice(0, 10));
  let before = x.env.state.mails.length;
  x.env.call('dailyDigest');
  assert.equal(x.env.state.mails.slice(before).filter((m) => m.to.includes('contact@skkc.co.kr')).length, 0, '예정일 전날 운영자 메일이 감');
  // 예정일 아침: 진행 중인 a와 검토 중인 c만, 주문마다 한 통
  morning(a.eta);
  before = x.env.state.mails.length;
  x.env.call('dailyDigest');
  const sent = x.env.state.mails.slice(before).filter(due);
  assert.equal(sent.length, 2, sent.map((m) => m.subject).join(' / '));
  for (const r of [a, c]) {
    const m = sent.find((k) => k.htmlBody.includes(r.orderNo));
    assert.ok(m, `${r.orderNo} 알림 없음`);
    assert.ok(m.subject.includes(CONTACT.name), m.subject);
    assert.equal(m.replyTo, CONTACT.email);
    for (const s of ['고객 정보', '의뢰 내용', '요청 사항', '주문·결제', '오늘(']) assert.ok(m.htmlBody.includes(s), `알림 본문에 '${s}' 없음`);
  }
  assert.ok(!sent.some((m) => m.htmlBody.includes(b.orderNo)), '완료한 주문도 알림');
  assert.ok(!x.env.state.mails.slice(before).some((m) => /오늘의 작업/.test(m.subject)), '브리핑 메일이 감');
  // 같은 날 다시 돌려도 또 보내지 않음, 다음 날도 보내지 않음(예정일에만)
  before = x.env.state.mails.length;
  x.env.call('dailyDigest');
  x.env.clock.advance(86400000);
  x.env.call('dailyDigest');
  assert.equal(x.env.state.mails.slice(before).filter(due).length, 0, '같은 날 또는 다음 날 다시 보냄');
});

t('운영자 알림 메일: 받는 주소 여러 개, 고객 정보(이름·이메일·연락처)와 의뢰 내용·요청 사항을 한 번에, 브리핑도 주문마다 같은 내용', () => {
  const x = makeEnv({ now: '2026-11-24T14:00:00+09:00' });
  const token = x.login();
  x.ok('adminSaveSettings', { adminToken: token, settings: { operatorEmails: 'contact@skkc.co.kr, owner@example.com' } });
  const input = { service: 'paper', common: { fieldId: 'media', fieldText: '미디어커뮤니케이션', school: '', dept: '', purpose: '', topicKnown: 'free', title: '숏폼 콘텐츠의 협찬 고지 방식이 브랜드 진정성 인식에 미치는 영향', keywords: ['숏폼 콘텐츠의 협찬 고지 방식', '브랜드 진정성 인식'], due: '', outputFormat: 'docx', request: '졸업 논문은 공백 포함 16,000자 이상\n학과 양식은 따로 보낼게요', method: 'auto' }, paper: { typeId: 'bachelor', task: 'full', pages: 30, hasToc: 'no', tocText: '', hasFormat: 'no', formatName: '', feedbackText: '', editScope: '', needsData: false }, addons: {} };
  const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: input.paper, addons: input.addons });
  const r = x.ok('createOrder', { service: 'paper', input, contact: CONTACT, pin: '5678', consents: CONSENTS, design: null, clientQuote: { total: q.total } });
  x.ok('submitOrder', { orderNo: r.orderNo, token: r.token });
  x.ok('claimPayment', { orderNo: r.orderNo, token: r.token, method: 'skkc', payerName: CONTACT.name });
  const must = ['고객 정보', CONTACT.name, CONTACT.email, CONTACT.phone, '의뢰 내용', '관심 주제', '숏폼 콘텐츠의 협찬 고지 방식이 브랜드 진정성 인식에 미치는 영향', '미디어커뮤니케이션', '30쪽', '워드(docx)', '요청 사항', '졸업 논문은 공백 포함 16,000자 이상<br>학과 양식은 따로 보낼게요', '주문·결제', r.orderNo];
  for (const ev of ['신규 주문', '결제 확인 요청']) {
    const m = x.env.state.mails.find((k) => new RegExp(ev).test(k.subject) && k.to.includes('owner@example.com'));
    assert.ok(m, `${ev} 메일이 두 번째 주소로 가지 않음`);
    assert.ok(m.to.includes('contact@skkc.co.kr'), `${ev} 메일이 첫 번째 주소로 가지 않음`);
    assert.ok(m.subject.includes(CONTACT.name), `${ev} 메일 제목에 고객 이름 없음: ${m.subject}`);
    for (const s of must) assert.ok(m.htmlBody.includes(s), `${ev} 메일 본문에 '${s}' 없음`);
  }
  const before = x.env.state.mails.length;
  x.ok('adminSaveSettings', { adminToken: token, settings: { dailyBriefing: 'true' } });
  x.env.call('dailyDigest');
  const dg = x.env.state.mails.slice(before).find((m) => /오늘의 작업/.test(m.subject));
  assert.ok(dg, '켠 브리핑 메일 없음');
  assert.ok(/주문 1건/.test(dg.subject), `브리핑 제목의 주문 수: ${dg.subject}`);
  for (const s of must) assert.ok(dg.htmlBody.includes(s), `브리핑 본문에 '${s}' 없음`);
});

t('긴 요청 사항: 맡겨 둔 전문을 주문에 붙이고(한 번 쓰면 지움), 못 찾으면 앞부분만 왔다고 적음', () => {
  const x = makeEnv();
  const full = `${'가'.repeat(2990)}\n끝`;
  x.fail('stashRequest', { text: '   ' }, 'invalid');
  const k = x.ok('stashRequest', { text: full }).key;
  assert.match(k, /^[A-Z0-9]{24}$/);
  const input = (common) => ({ common: { fieldId: 'edu', title: '긴 요청 사항 확인 주제', keywords: [], method: 'auto', due: '', request: `${full.slice(0, 900)}…`, requestCut: true, ...common }, paper: { typeId: 'master', task: 'full' }, addons: {} });
  const make = (common) => { const r = x.ok('createOrder', { service: 'paper', input: input(common), contact: CONTACT, pin: '2468', consents: CONSENTS }); return x.ok('getOrder', { orderNo: r.orderNo, token: r.token }).order; };
  const o = make({ requestKey: k });
  assert.equal(o.input.common.request, full);
  assert.equal(o.input.common.requestKey, undefined);
  const o2 = make({ requestKey: k });
  assert.ok(o2.input.common.request.startsWith(full.slice(0, 900)));
  assert.ok(o2.input.common.request.endsWith('(요청 사항이 길어 앞부분만 전달됨)'), o2.input.common.request.slice(-40));
  const o3 = make({});
  assert.ok(o3.input.common.request.endsWith('(요청 사항이 길어 앞부분만 전달됨)'));
  const k4 = x.ok('stashRequest', { text: 'ㄱ'.repeat(3500) }).key;
  assert.equal(make({ requestKey: k4, requestCut: false }).input.common.request.length, 3000);
});

t('운영자 알림 메일은 답장하면 고객에게 가고, 고객 메시지는 전문과 주문 정보를 함께 보냄', () => {
  const x = makeEnv({ now: '2026-11-24T16:40:00+09:00' });
  const r = paperOrder(x);
  x.ok('submitOrder', { orderNo: r.orderNo, token: r.token });
  x.ok('claimPayment', { orderNo: r.orderNo, token: r.token, method: 'skkc', payerName: CONTACT.name });
  const paid = x.env.state.mails.find((m) => /결제 확인 요청/.test(m.subject));
  assert.ok(paid, '결제 확인 요청 메일 없음');
  assert.equal(paid.replyTo, CONTACT.email);
  assert.ok(paid.htmlBody.includes(`주문자(${CONTACT.email})에게 바로 갑니다`));
  assert.ok(!/AI 프롬프트/.test(paid.htmlBody), '답장에 따라갈 본문에 내부용 표현');
  const cust = x.env.state.mails.find((m) => m.to.includes(CONTACT.email) && /작업 순서에 배정/.test(m.subject));
  assert.ok(cust, '고객 안내 메일 없음');
  assert.equal(cust.replyTo, 'contact@skkc.co.kr');
  assert.ok(cust.htmlBody.includes('이 메일에 답장해 주세요'));
  const long = `3장 연구 방법은 설문 대신 문헌연구로 바꿔 주세요.\n${'참고문헌은 최근 5년 국내 학술지 위주로 넣어 주시고, 표 번호는 장별로 매겨 주세요. '.repeat(4)}\n마지막 줄입니다.`;
  x.ok('addMessage', { orderNo: r.orderNo, token: r.token, type: 'question', text: long });
  const q = x.env.state.mails.find((m) => /고객 문의/.test(m.subject));
  assert.ok(q, '고객 문의 메일 없음');
  assert.equal(q.replyTo, CONTACT.email);
  assert.ok(q.subject.includes(CONTACT.name), q.subject);
  assert.ok(q.htmlBody.includes('마지막 줄입니다.'), '문의 전문이 실리지 않음');
  for (const s of ['고객 정보', '의뢰 내용', '요청 사항', '주문·결제']) assert.ok(q.htmlBody.includes(s), `문의 메일에 '${s}' 없음`);
});

t('대기열에 쌓인 운영자 알림도 보낼 때 답장 주소(고객)를 지킴', () => {
  const x = makeEnv();
  const r = paperOrder(x);
  x.env.state.mailQuota.used = 100;
  x.ok('submitOrder', { orderNo: r.orderNo, token: r.token });
  const ssId = x.env.findSpreadsheetByName('논문AI 운영 시트').getId();
  const row = x.env.sheetValues(ssId, '메일대기').slice(1).find((v) => /신규 주문/.test(v[2]));
  assert.ok(row && row[4] === 'queued', '운영자 알림이 대기열에 없음');
  const before = x.env.state.mails.length;
  x.env.clock.advance(25 * 3600 * 1000);
  x.env.call('hourlyJob');
  const sent = x.env.state.mails.slice(before).find((m) => /신규 주문/.test(m.subject));
  assert.ok(sent, '대기열 운영자 알림이 발송되지 않음');
  assert.equal(sent.replyTo, CONTACT.email);
  assert.ok(!sent.htmlBody.includes('nm-reply'), '답장 주소 표시가 본문에 남음');
});

t('메일 할당량이 바닥나면 대기열에 쌓았다가 다음 날 보냄', () => {
  const x = makeEnv();
  const used = x.env.state.mails.length;
  x.env.state.mailQuota.used = 100 - 2;
  const r = paperOrder(x);
  x.ok('submitOrder', { orderNo: r.orderNo, token: r.token });
  const ssId = x.env.findSpreadsheetByName('논문AI 운영 시트').getId();
  const queued = x.env.sheetValues(ssId, '메일대기').slice(1).filter((row) => row[4] === 'queued');
  assert.ok(queued.length >= 1, '대기열에 쌓이지 않았습니다');
  x.env.clock.advance(25 * 3600 * 1000);
  x.env.call('hourlyJob');
  const after = x.env.sheetValues(ssId, '메일대기').slice(1).filter((row) => row[4] === 'sent');
  assert.ok(after.length >= 1, '대기열 메일이 발송되지 않았습니다');
  assert.ok(x.env.state.mails.length > used);
});

// ---------------------------------------------------------------- 2026-11-26 첨삭 단계 · 결제 금액 바꾸기 · 맞춤 견적 결제
const MANUSCRIPT = { slot: 'manuscript', name: '졸업논문 원고.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: DOCX };
function editOrder(x, { level, pages = 20, typeId = 'bachelor', request = '' } = {}) {
  const r = paperOrder(x, { task: 'edit', typeId, extra: { pages, editLevel: level, editScope: '원고 전체' } });
  x.ok('uploadFile', { orderNo: r.orderNo, token: r.token, ...MANUSCRIPT });
  x.ok('submitOrder', { orderNo: r.orderNo, token: r.token });
  return r;
}
const pick = (xs, re) => xs.filter((m) => re.test(m.subject));

t('첨삭 단계: 서버도 같은 금액(학사 20 Page 완성도 보완 30만 원), 운영자 메일에 단계 표시', () => {
  const x = makeEnv();
  const r = editOrder(x, { level: 'complete' });
  assert.equal(r.quote.total, 300000);
  assert.equal(r.quote.mainCode, 'P-BACHELOR-EDIT3');
  const o = x.ok('getOrder', { orderNo: r.orderNo, token: r.token }).order;
  assert.equal(o.amountDue, 300000);
  assert.equal(o.productName, '학사·졸업논문 완성도 보완');
  assert.match(o.summary, /완성도 보완/);
  assert.equal(o.revisions.allowed, 1, '완성도 보완은 수정 1회 포함');
  const op = pick(x.env.state.mails, /신규 주문/).pop();
  assert.ok(op.htmlBody.includes('첨삭 단계') && op.htmlBody.includes('완성도 보완'));
  // 잘못된 단계 값은 기본 교정으로
  const b = paperOrder(x, { task: 'edit', typeId: 'bachelor', extra: { pages: 20, editLevel: 'hack' } });
  assert.equal(b.quote.total, 29000);
});

t('결제 금액 바꾸기(결제 전): 사유·포함 범위·바로 결제 버튼이 담긴 메일, 단계도 함께 변경', () => {
  const x = makeEnv();
  const r = editOrder(x, { level: 'basic' });
  const token = x.login();
  x.fail('adminChangeAmount', { adminToken: token, orderNo: r.orderNo, amount: 300000 }, 'invalid');
  const reason = '요청하신 AI 문체 교정, 흐름·구조 검토, 내용 보완, 인용 점검은 기본 교정(29,000원) 범위를 넘어 완성도 보완 단계로 진행해요.';
  const before = x.env.state.mails.length;
  const res = x.ok('adminChangeAmount', { adminToken: token, orderNo: r.orderNo, amount: 300000, reason, level: 'complete' }).order;
  assert.equal(res.amount, 300000);
  assert.equal(res.amountDue, 300000);
  assert.equal(res.status, 'pending_payment');
  assert.equal(res.productName, '학사·졸업논문 완성도 보완');
  assert.equal(res.quote.mainCode, 'P-BACHELOR-EDIT3');
  assert.ok(res.quote.includes.some((x2) => /보완 집필/.test(x2)));
  const ps = res.paymentsAll;
  assert.deepEqual(ps.map((p) => [p.amount, p.status]).sort(), [[29000, 'cancelled'], [300000, 'requested']].sort());
  const mail = x.env.state.mails.slice(before).find((m) => m.to.includes(CONTACT.email));
  assert.ok(mail, '고객 메일 없음');
  assert.match(mail.subject, /결제 금액 안내 300,000원/);
  assert.ok(mail.htmlBody.includes('금액이 바뀐 이유') && mail.htmlBody.includes('완성도 보완 단계로 진행해요'));
  assert.ok(mail.htmlBody.includes('29,000원') && mail.htmlBody.includes('300,000원 결제하기'));
  assert.ok(mail.htmlBody.includes('보완 집필'), '포함 범위가 메일에 없음');
  const link = (mail.htmlBody.match(/href="([^"]*\/checkout\/[^"]*)"/) || [])[1] || '';
  assert.match(link.replace(/&amp;/g, '&'), /\/checkout\/\?o=NA\d{6}-[A-Z0-9]{4}&t=[^&]+&pay=1$/);
  // 고객 화면: 진행 기록에 사유가 보이고 수정 1회가 생김
  const o = x.ok('getOrder', { orderNo: r.orderNo, token: r.token }).order;
  assert.ok(o.timeline.some((h) => /300,000원으로 바뀌었습니다/.test(h.message) && h.message.includes('AI 문체 교정')));
  assert.equal(o.revisions.allowed, 1);
  assert.equal(o.quote.changes.length, 1);
  assert.equal(o.quote.changes[0].before, 29000);
  // 고객이 결제 완료를 알린 뒤에는 바로 바꿀 수 없음(확인 먼저)
  x.ok('claimPayment', { orderNo: r.orderNo, token: r.token, method: 'bank', payerName: '김연구' });
  x.fail('adminChangeAmount', { adminToken: token, orderNo: r.orderNo, amount: 400000, reason: '분량 추가' }, 'claimed');
  // 메일 안 보내기
  const y = makeEnv();
  const r2 = editOrder(y, { level: 'deep' });
  const t2 = y.login();
  const n = y.env.state.mails.length;
  y.ok('adminChangeAmount', { adminToken: t2, orderNo: r2.orderNo, amount: 200000, reason: '분량이 41 Page예요.', notify: false });
  assert.equal(y.env.state.mails.slice(n).filter((m) => m.to.includes(CONTACT.email)).length, 0);
});

t('결제 금액 바꾸기(결제 후): 낸 금액은 두고 추가 결제로 요청', () => {
  const x = makeEnv();
  const r = editOrder(x, { level: 'basic' });
  const token = x.login();
  x.ok('adminConfirmPayment', { adminToken: token, orderNo: r.orderNo });
  const before = x.env.state.mails.length;
  const o = x.ok('adminChangeAmount', { adminToken: token, orderNo: r.orderNo, amount: 300000, reason: '내용 보완 집필이 필요해 완성도 보완으로 바꿔요.', level: 'complete' }).order;
  assert.equal(o.paidAmount, 29000);
  assert.equal(o.amount, 329000);
  assert.equal(o.amountDue, 300000);
  assert.equal(o.paymentsAll.filter((p) => p.kind === 'extra' && p.status === 'requested').length, 1);
  assert.equal(o.quote.lines.reduce((a, l) => a + l.amount, 0), 329000);
  const mail = x.env.state.mails.slice(before).find((m) => m.to.includes(CONTACT.email));
  assert.match(mail.subject, /추가 결제 안내 300,000원/);
  assert.ok(mail.htmlBody.includes('결제 완료') && mail.htmlBody.includes('329,000원'));
  x.fail('adminChangeAmount', { adminToken: token, orderNo: r.orderNo, amount: 0, reason: 'x' }, 'invalid');
});

t('아임웹 결제 화면 주문자 정보 미리 채우기: 결제 연결표가 맞을 때만, 연결표 하나에 다섯 번까지', () => {
  const x = makeEnv();
  const r = editOrder(x, {});
  const tk = x.ok('payTicket', { orderNo: r.orderNo, token: r.token }).ticket;
  const c = x.ok('payTicketContact', { ticket: tk }).contact;
  assert.equal(c.name, CONTACT.name);
  assert.equal(c.email, CONTACT.email);
  assert.equal(c.phone.replace(/\D/g, ''), CONTACT.phone.replace(/\D/g, ''));
  assert.equal(x.ok('payTicketContact', { ticket: 'A'.repeat(24) }).contact, null, '없는 연결표');
  assert.equal(x.ok('payTicketContact', { ticket: '' }).contact, null, '빈 연결표');
  assert.equal(x.ok('payTicketContact', { ticket: '../x' }).contact, null, '형식이 틀린 연결표');
  for (let i = 0; i < 4; i++) x.ok('payTicketContact', { ticket: tk });
  assert.equal(x.ok('payTicketContact', { ticket: tk }).contact, null, '다섯 번 넘게는 주지 않음');
});

t('맞춤 견적 결제 완료 알림: 결제 연결표면 바로 연결, 연락처가 같으면 결제 확인 중, 아니면 운영자에게만', () => {
  const x = makeEnv();
  const r = editOrder(x, { level: 'complete' });
  const tk = x.ok('payTicket', { orderNo: r.orderNo, token: r.token }).ticket;
  assert.match(tk, /^[A-Za-z0-9]{24}$/);
  x.fail('payTicket', { orderNo: r.orderNo, token: 'bad' }, 'forbidden');
  // 1) 결제 연결표: 연락처가 달라도 연결, advanceOnClaim(skkc)이라 작업 대기열로
  const res = x.ok('claimShopPayment', { orderNo: r.orderNo, ticket: tk, amount: 300000, label: '학사·졸업논문 완성도 보완', contact: { name: '김부모', phone: '010-9999-0000', email: 'parent@example.com' } });
  assert.equal(res.linked, true);
  assert.equal(res.order, undefined, '응답에 주문 내용을 싣지 않음');
  let o = x.ok('getOrder', { orderNo: r.orderNo, token: r.token }).order;
  assert.equal(o.payments.find((p) => p.amount === 300000).status, 'claimed');
  assert.ok(['in_progress', 'received', 'needs_materials'].includes(o.status), o.status);
  assert.ok(x.env.state.mails.some((m) => /결제 확인 요청/.test(m.subject) && m.htmlBody.includes('아임웹 결제 완료')));
  // 2) 연락처로만 확인: 결제 확인 중(작업은 운영자 확인 뒤)
  const y = makeEnv();
  const r2 = editOrder(y, { level: 'deep' });
  const res2 = y.ok('claimShopPayment', { orderNo: r2.orderNo.toLowerCase(), amount: 100000, contact: { name: '김연구', phone: '01012345678', email: 'other@example.com' } });
  assert.equal(res2.linked, true);
  o = y.ok('getOrder', { orderNo: r2.orderNo, token: r2.token }).order;
  assert.equal(o.status, 'payment_review');
  // 3) 연락처가 다르고 연결표도 없음: 주문은 그대로, 운영자에게 확인 요청
  const z = makeEnv();
  const r3 = editOrder(z, { level: 'deep' });
  const n = z.env.state.mails.length;
  const res3 = z.ok('claimShopPayment', { orderNo: r3.orderNo, amount: 100000, contact: { name: '박모름', phone: '010-0000-1111', email: 'x@example.com' } });
  assert.equal(res3.linked, false);
  assert.equal(z.ok('getOrder', { orderNo: r3.orderNo, token: r3.token }).order.status, 'pending_payment');
  const warn = z.env.state.mails.slice(n).find((m) => /주문 연결 확인 필요/.test(m.subject));
  assert.ok(warn && warn.htmlBody.includes('박모름') && warn.htmlBody.includes('100,000원'));
  assert.equal(warn.replyTo, 'x@example.com');
  // 4) 주문번호 없이 결제: 운영자에게만
  const res4 = z.ok('claimShopPayment', { orderNo: '', amount: 500000, contact: { name: '최견적', phone: '010-2222-3333', email: 'q@example.com' } });
  assert.equal(res4.linked, false);
  assert.ok(z.env.state.mails.some((m) => /주문 연결 확인 필요/.test(m.subject) && m.htmlBody.includes('주문번호 없이')));
  z.fail('claimShopPayment', { orderNo: '', amount: 1, hp: 'bot' }, 'bad_request');
});

t('운영 가격표에 첨삭 단계 상품 추가(syncCatalogText): 기본 교정 문구도 범위가 보이게', () => {
  const x = makeEnv();
  const token = x.login();
  const cat = x.ok('adminGetCatalog', { adminToken: token }).catalog;
  cat.items = cat.items.filter((i) => !/-EDIT[23]$/.test(i.code)).map((i) => (i.code === 'P-BACHELOR-EDIT' ? { ...i, includes: ['원고 첨삭(기준 20쪽)', '수정 내역 표시본'], price: 33000 } : i));
  x.ok('adminSaveCatalog', { adminToken: token, catalog: cat });
  // 단계 상품이 없을 때 완성도 보완을 고르면 결제받지 않고 견적 확인
  const old = paperOrder(x, { task: 'edit', typeId: 'bachelor', extra: { pages: 20, editLevel: 'complete' } });
  assert.equal(old.quote.quoteRequired, true);
  const res = x.env.call('syncCatalogText');
  assert.ok(res.added.includes('P-BACHELOR-EDIT3') && res.added.includes('P-DOCTOR-EDIT2'));
  assert.ok(res.changed.includes('P-BACHELOR-EDIT'));
  const items = x.ok('config').catalog.items;
  const basic = items.find((i) => i.code === 'P-BACHELOR-EDIT');
  assert.equal(basic.price, 33000, '가격은 그대로');
  assert.ok(basic.includes.includes('맞춤법·띄어쓰기·비문 바로잡기'));
  const e3 = items.find((i) => i.code === 'P-BACHELOR-EDIT3');
  assert.equal(e3.price, 300000);
  assert.equal(e3.unitPrice, 100000);
  const now = paperOrder(x, { task: 'edit', typeId: 'bachelor', extra: { pages: 20, editLevel: 'complete' } });
  assert.equal(now.quote.total, 300000);
  assert.equal(now.quote.quoteRequired, false);
});
