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
  assert.equal(sub.order.amountDue, 99000);
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
  assert.equal(r.quote.total, 49000);
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

t('예약 작업: 일일 브리핑 메일과 매시간 작업이 오류 없이 실행', () => {
  const x = makeEnv({ now: '2026-11-02T07:30:00+09:00' });
  const r = paperOrder(x);
  x.ok('submitOrder', { orderNo: r.orderNo, token: r.token });
  x.ok('claimPayment', { orderNo: r.orderNo, token: r.token, method: 'skkc' });
  const before = x.env.state.mails.length;
  x.env.clock.advance(60 * 60 * 1000);
  const ran = x.env.runTriggers();
  assert.ok(ran.includes('dailyDigest') || ran.includes('hourlyJob'));
  x.env.call('dailyDigest');
  assert.ok(x.env.state.mails.slice(before).some((m) => /오늘의 작업/.test(m.subject)), '브리핑 메일 없음');
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
