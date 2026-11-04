// ===== 00_core.gs =====
/**
 * 논문AI 백엔드 (Google Apps Script 웹 앱)
 * 00_core: 상수, 저장소 접근, 보안 유틸리티
 *
 * 배포: 웹 앱 / 실행 사용자: 나 / 액세스: 모든 사용자
 * 최초 1회: setup() 실행 또는 웹 앱 주소에 ?setup=1 접속
 */

var APP_VERSION = '1.0.0';
var TZ = 'Asia/Seoul';

var SHEETS = {
  orders: '주문',
  history: '이력',
  files: '파일',
  payments: '결제',
  messages: '메시지',
  settings: '설정',
  catalog: '가격표',
  logs: '로그',
  mailq: '메일대기',
};

var ORDER_COLS = ['주문번호', '상태', '상태명', '서비스', '상품명', '요약', '금액', '결제상태', '결제금액', '접수일시', '결제일시', '예정일', '완료일시',
  '고객명', '이메일', '연락처', 'PIN', '토큰키', '견적필요', '우선처리', '폴더ID', '데이터', '메모', '수정횟수', '수정일시', '삭제상태'];
var HISTORY_COLS = ['주문번호', '일시', '상태', '상태명', '고객안내', '작성자', '내부메모'];
var FILE_COLS = ['파일ID', '주문번호', '구분', '항목', '파일명', '크기', '형식', '업로드일시', '업로더', '상태', '만료일'];
var PAYMENT_COLS = ['결제ID', '주문번호', '일시', '유형', '금액', '수단', '상태', '참조', '메모', '확인일시'];
var MESSAGE_COLS = ['주문번호', '일시', '보낸이', '유형', '내용', '처리'];
var SETTING_COLS = ['키', '값', '설명'];
var CATALOG_COLS = ['코드', '서비스', '유형', '작업', '상품명', '가격', '기준분량', '단위', '단위크기', '추가단가', '기본납기', '포함내역', '제외내역', '견적형', '옵션', '사용', '결제링크'];
var LOG_COLS = ['일시', '종류', '내용'];
var MAILQ_COLS = ['일시', '받는사람', '제목', '본문', '상태', '시도', '처리일시'];

var STATUS = {
  draft: '작성 중',
  quote_requested: '견적 확인 중',
  pending_payment: '결제 대기',
  payment_review: '결제 확인 중',
  received: '접수 완료',
  checking: '자료 확인',
  needs_materials: '자료 보완 필요',
  preparing: '작업 준비',
  in_progress: '작성·분석 진행',
  review: '품질 검토',
  delivered: '전달 완료',
  revision: '수정 진행',
  completed: '완료',
  cancelled: '취소',
};

var SERVICE_LABEL = { paper: '논문', survey: '설문조사', statistics: '통계분석' };

var DEFAULT_SETTINGS = {
  siteName: ['논문AI', '사이트 이름(메일 발신 이름)'],
  siteUrl: ['https://nonmunai.kr', '사이트 주소(메일 속 링크에 사용)'],
  operatorEmails: ['contact@skkc.co.kr', '새 주문·결제 알림을 받을 메일(쉼표로 여러 개)'],
  replyTo: ['contact@skkc.co.kr', '고객이 메일에 답장하면 받을 주소'],
  ntfyTopic: ['', '휴대폰 푸시(ntfy 앱) 토픽 이름, 비우면 사용 안 함'],
  skkcEnabled: ['true', '성균관컨설팅(skkc.co.kr) 결제 연결 사용'],
  skkcCustomUrl: ['', '금액이 맞는 결제 링크가 없을 때 안내할 결제 페이지(비우면 상담 채널에서 결제 링크를 받도록 안내)'],
  skkcLinks: ['[]', '금액별 결제 링크 목록(JSON: [{"amount":399000,"url":"https://skkc.co.kr/shop_view?idx=..."}])'],
  skkcProducts: ['{}', '아임웹 상품 링크(JSON: {"P-MASTER-FULL":"https://skkc.co.kr/shop_view?idx=...", "X-29000":"..."}). 주문 금액 줄마다 맞는 상품을 안내'],
  skkcUnitUrl: ['', '금액 단위 결제 상품 링크(예: 1,000원 상품). 수량을 금액에 맞춰 결제'],
  skkcUnitPrice: ['1000', '금액 단위 결제 상품의 1개 가격(원)'],
  bankEnabled: ['false', '무통장입금 안내 사용'],
  bankName: ['', '은행명'],
  bankAccount: ['', '계좌번호'],
  bankHolder: ['성균관컨설팅', '예금주'],
  tossEnabled: ['false', '토스페이먼츠 결제창 사용(키 입력 후 켜기)'],
  tossClientKey: ['', '토스페이먼츠 클라이언트 키(공개 키)'],
  advanceOnPayment: ['in_progress', '결제 확인 시 바뀔 상태(in_progress 또는 received)'],
  advanceOnClaim: ['skkc', '고객이 "결제했어요"를 누르면 바로 작업 대기열로 넣을 결제수단(skkc,bank 중 쉼표 구분, 비우면 확인 후 진행)'],
  dailyCapacity: ['3', '하루에 마무리할 수 있는 주문 수(예정일 계산)'],
  holidays: ['2026-12-25,2027-01-01,2027-02-16,2027-02-17,2027-02-18,2027-03-01', '쉬는 날(예정일 계산에서 제외)'],
  retentionDays: ['90', '전달 완료 후 파일 보관 일수(지나면 자동 삭제)'],
  revisionDays: ['30', '전달 후 수정 요청을 받는 일수'],
  draftExpireDays: ['3', '제출하지 않은 작성 중 주문 자동 정리 일수'],
  unpaidExpireDays: ['30', '결제하지 않은 주문 자동 취소 일수'],
  maxFileMB: ['20', '파일 1개 최대 용량(MB)'],
  digestHour: ['8', '일일 브리핑 메일 보낼 시각(0~23)'],
  notifyStatusMail: ['true', '상태가 바뀌면 고객에게 메일 보내기'],
  bizName: ['성균관컨설팅', '상호'],
  bizCeo: ['이채연', '대표자'],
  bizNo: ['272-32-01885', '사업자등록번호'],
  bizMailOrder: ['제 2026-경기송탄-0622 호', '통신판매업 신고번호'],
  bizAddress: ['경기도 수원시 장안구 서부로 2066 성균관대학교 브릿지팩토리', '주소'],
  bizPhone: ['010-9913-7771', '대표 전화'],
  bizEmail: ['contact@skkc.co.kr', '대표 메일'],
  noticeBanner: ['', '사이트 상단 공지(비우면 숨김)'],
  addonServices: ['[{"key":"aicheck","name":"AI 사용 여부 점검(카피클린)","url":"https://www.skkc.co.kr/ai-detector","desc":"제출 전 AI 작성 의심 구간 확인","enabled":true},{"key":"humanize","name":"문장 다듬기(카피휴먼)","url":"https://copyhuman.kr/","desc":"AI 문체를 사람 문장으로 다듬기","enabled":true}]', '전달 후 함께 안내할 후속 서비스(JSON)'],
};

var PUBLIC_SETTING_KEYS = ['siteName', 'siteUrl', 'skkcEnabled', 'skkcCustomUrl', 'skkcLinks', 'skkcProducts', 'skkcUnitUrl', 'skkcUnitPrice', 'bankEnabled', 'bankName', 'bankAccount', 'bankHolder', 'tossEnabled', 'tossClientKey',
  'dailyCapacity', 'holidays', 'maxFileMB', 'bizName', 'bizCeo', 'bizNo', 'bizMailOrder', 'bizAddress', 'bizPhone', 'bizEmail', 'noticeBanner', 'addonServices', 'retentionDays', 'revisionDays', 'replyTo'];

/* ------------------------------------------------------------------ 속성·저장소 */
function props_() { return PropertiesService.getScriptProperties(); }
function prop_(k) { return props_().getProperty(k); }

var __ss = null;
function ss_() {
  if (__ss) return __ss;
  var id = prop_('SPREADSHEET_ID');
  if (!id) throw appError_('not_setup', '서버 초기 설정이 필요합니다.');
  __ss = SpreadsheetApp.openById(id);
  return __ss;
}
function sheet_(key) {
  var sh = ss_().getSheetByName(SHEETS[key]);
  if (!sh) throw appError_('sheet_missing', '시트를 찾을 수 없습니다: ' + SHEETS[key]);
  return sh;
}

var __cache = {};
function rows_(key) {
  if (__cache[key]) return __cache[key];
  var sh = sheet_(key);
  var last = sh.getLastRow();
  var cols = sh.getLastColumn();
  var values = last > 1 ? sh.getRange(2, 1, last - 1, cols).getValues() : [];
  __cache[key] = values;
  return values;
}
function invalidate_(key) { if (key) delete __cache[key]; else __cache = {}; }

/* ------------------------------------------------------------------ 오류·응답 */
function appError_(code, message, extra) {
  var e = new Error(message || code);
  e.appCode = code;
  e.extra = extra || null;
  return e;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ 시간 */
function now_() { return new Date(); }
function iso_(d) {
  if (!d) return '';
  if (Object.prototype.toString.call(d) !== '[object Date]') {
    var p = new Date(d);
    if (isNaN(p.getTime())) return String(d);
    d = p;
  }
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
function ymd_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function korDate_(d) {
  if (!d) return '';
  if (Object.prototype.toString.call(d) !== '[object Date]') d = new Date(d);
  var w = ['일', '월', '화', '수', '목', '금', '토'][dow_(d)];
  return Utilities.formatDate(d, TZ, 'M월 d일') + '(' + w + ')';
}
function dow_(d) {
  var p = Utilities.formatDate(d, TZ, 'yyyy-MM-dd').split('-');
  return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))).getUTCDay();
}
function toDate_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function daysBetween_(a, b) { return Math.floor((b.getTime() - a.getTime()) / 86400000); }

/* ------------------------------------------------------------------ 문자열·검증 */
function clean_(v, max) {
  if (v === null || v === undefined) return '';
  var s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (max && s.length > max) s = s.slice(0, max);
  return s;
}
function cell_(v) {
  // 시트 수식 주입 방지
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}
function isEmail_(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s || ''); }
function normPhone_(s) {
  var d = String(s || '').replace(/[^0-9]/g, '');
  if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  return d;
}
function maskName_(s) { s = String(s || ''); return s.length <= 1 ? s : s.length === 2 ? s[0] + '*' : s[0] + '*'.repeat(s.length - 2) + s[s.length - 1]; }
function maskEmail_(s) { var p = String(s || '').split('@'); if (p.length < 2) return ''; return p[0].slice(0, 2) + '***@' + p[1]; }
function maskPhone_(s) { var d = String(s || '').replace(/[^0-9]/g, ''); return d.length >= 8 ? d.slice(0, 3) + '-****-' + d.slice(-4) : ''; }
function escHtml_(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

/* ------------------------------------------------------------------ 암호 유틸 */
function toHex_(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) { var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i]; out += (b < 16 ? '0' : '') + b.toString(16); }
  return out;
}
function b64url_(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
function sha256Hex_(s) { return toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)); }
function hmac_(msg) {
  var secret = prop_('HMAC_SECRET');
  if (!secret) throw appError_('not_setup', '서버 보안 키가 없습니다.');
  return b64url_(Utilities.computeHmacSha256Signature(String(msg), secret));
}
function safeEq_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function randomString_(len, alphabet) {
  alphabet = alphabet || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  while (out.length < len) {
    var hex = Utilities.getUuid().replace(/-/g, '');
    for (var i = 0; i + 1 < hex.length && out.length < len; i += 2) {
      var v = parseInt(hex.substr(i, 2), 16);
      if (v < 256 - (256 % alphabet.length)) out += alphabet[v % alphabet.length];
    }
  }
  return out;
}
function hashPin_(pin, salt) { return sha256Hex_('pin|' + salt + '|' + String(pin)); }
function hashPassword_(pw, salt) {
  var h = 'pw|' + salt + '|' + String(pw);
  for (var i = 0; i < 2000; i++) h = sha256Hex_(h + '|' + i);
  return h;
}

/* 고객 주문 토큰: v1.<만료초>.<서명> */
function makeOrderToken_(orderNo, tokenKey, days) {
  var exp = Math.floor(now_().getTime() / 1000) + (days || 180) * 86400;
  return 'v1.' + exp + '.' + hmac_('ord|' + orderNo + '|' + exp + '|' + tokenKey).slice(0, 32);
}
function verifyOrderToken_(orderNo, tokenKey, token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  var exp = Number(parts[1]);
  if (!exp || exp * 1000 < now_().getTime()) return false;
  return safeEq_(parts[2], hmac_('ord|' + orderNo + '|' + exp + '|' + tokenKey).slice(0, 32));
}
function makeAdminToken_() {
  var exp = Math.floor(now_().getTime() / 1000) + 12 * 3600;
  var ver = prop_('ADMIN_VERSION') || '1';
  return 'a1.' + exp + '.' + hmac_('adm|' + exp + '|' + ver);
}
function verifyAdminToken_(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'a1') return false;
  var exp = Number(parts[1]);
  if (!exp || exp * 1000 < now_().getTime()) return false;
  return safeEq_(parts[2], hmac_('adm|' + exp + '|' + (prop_('ADMIN_VERSION') || '1')));
}
function makeFileTicket_(orderNo, fileId, minutes) {
  var exp = Math.floor(now_().getTime() / 1000) + (minutes || 30) * 60;
  return 'f1.' + exp + '.' + hmac_('file|' + orderNo + '|' + fileId + '|' + exp).slice(0, 24);
}
function verifyFileTicket_(orderNo, fileId, ticket) {
  var parts = String(ticket || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'f1') return false;
  var exp = Number(parts[1]);
  if (!exp || exp * 1000 < now_().getTime()) return false;
  return safeEq_(parts[2], hmac_('file|' + orderNo + '|' + fileId + '|' + exp).slice(0, 24));
}

/* ------------------------------------------------------------------ 요청 제한 */
function rateLimit_(key, max, windowSec) {
  var cache = CacheService.getScriptCache();
  var k = 'rl:' + key;
  var cur = Number(cache.get(k) || 0);
  if (cur >= max) throw appError_('rate_limited', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  cache.put(k, String(cur + 1), windowSec);
}
function rateReset_(key) { CacheService.getScriptCache().remove('rl:' + key); }

/* ------------------------------------------------------------------ 로그 */
function log_(kind, text) {
  try {
    var sh = sheet_('logs');
    sh.appendRow([now_(), clean_(kind, 30), clean_(text, 2000)]);
    if (sh.getLastRow() > 5000) sh.deleteRows(2, 1000);
  } catch (e) { /* 로그 실패는 무시 */ }
}

/* ------------------------------------------------------------------ 설정 */
var __settings = null;
function settings_() {
  if (__settings) return __settings;
  var out = {};
  for (var k in DEFAULT_SETTINGS) out[k] = DEFAULT_SETTINGS[k][0];
  try {
    var rows = rows_('settings');
    for (var i = 0; i < rows.length; i++) if (rows[i][0]) out[String(rows[i][0])] = String(rows[i][1]);
  } catch (e) { /* 초기 설정 전 */ }
  __settings = out;
  return out;
}
function setting_(k) { return settings_()[k]; }
function settingBool_(k) { return String(setting_(k)).toLowerCase() === 'true'; }
function settingNum_(k, d) { var n = Number(setting_(k)); return isNaN(n) ? d : n; }
function settingJson_(k, d) { try { return JSON.parse(setting_(k) || ''); } catch (e) { return d; } }
function holidays_() { return String(setting_('holidays') || '').split(/[,\s]+/).filter(function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }); }
function operatorEmails_() {
  var list = String(setting_('operatorEmails') || '').split(/[,\s;]+/).filter(isEmail_);
  if (!list.length) {
    try { var me = Session.getEffectiveUser().getEmail(); if (me) list.push(me); } catch (e) { }
  }
  return list;
}


// ===== 05_pricing.gs =====
/**
 * 05_pricing: 가격 계산 (src/js/core/pricing.js에서 자동 생성, 직접 수정 금지)
 */
// 논문AI 가격표와 견적 계산 (브라우저·Apps Script 공용)


var DEFAULT_CATALOG = {
  version: '2026-11-03',
  currency: 'KRW',
  items: [
    // 논문: 유형별 4개 작업. unit = 추가 분량 과금 단위
    { code: 'P-MASTER-FULL', service: 'paper', type: 'master', task: 'full', name: '석사학위논문 80 Page 완성', price: 99000, baseUnits: 80, unitLabel: '쪽', unitSize: 10, unitPrice: 19000, days: 5, includes: ['연구 설계서(연구모형·가설·분석 계획)', '목차 확정본', '서론부터 결론까지 장별 본문 80 Page', '실존 참고문헌과 본문 인용(APA 7판)', '전공 분야 박사 최종 검수', '수정 1회'] },
    { code: 'P-MASTER-EDIT', service: 'paper', type: 'master', task: 'edit', name: '석사학위논문 첨삭·교정', price: 49000, baseUnits: 30, unitLabel: '쪽', unitSize: 10, unitPrice: 19000, days: 2, includes: ['요청 범위 문장·논리 첨삭(기준 30쪽)', '수정 내역 표시본과 정리본', '형식·인용 점검'] },
    { code: 'P-MASTER-FB', service: 'paper', type: 'master', task: 'feedback', name: '석사학위논문 교수님 피드백 반영', price: 59000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 19000, days: 2, includes: ['피드백 항목별 수정(기준 10개 항목)', '수정 대조표 작성(의견·수정 내용·쪽)', '반영 부분 파란색 표시본', '최종 정리본'] },
    { code: 'P-MASTER-PROP', service: 'paper', type: 'master', task: 'proposal', name: '석사학위논문 연구계획서 작성', price: 69000, baseUnits: 15, unitLabel: '쪽', unitSize: 5, unitPrice: 19000, days: 3, includes: ['연구 주제·제목 확정안', '연구 목적과 필요성', '이론적 배경 요약과 연구모형', '연구 방법·분석 계획', '참고문헌'] },
    { code: 'P-DOCTOR-FULL', service: 'paper', type: 'doctor', task: 'full', name: '박사학위논문 130 Page 완성', price: 199000, baseUnits: 130, unitLabel: '쪽', unitSize: 10, unitPrice: 29000, days: 10, includes: ['연구 설계서와 연구모형', '목차 확정본', '장별 본문 130 Page', '실존 참고문헌과 본문 인용(APA 7판)', '전공 분야 박사 최종 검수', '수정 1회'] },
    { code: 'P-DOCTOR-EDIT', service: 'paper', type: 'doctor', task: 'edit', name: '박사학위논문 첨삭·교정', price: 69000, baseUnits: 40, unitLabel: '쪽', unitSize: 10, unitPrice: 19000, days: 3, includes: ['요청 범위 문장·논리 첨삭(기준 40쪽)', '수정 내역 표시본과 정리본', '형식·인용 점검'] },
    { code: 'P-DOCTOR-FB', service: 'paper', type: 'doctor', task: 'feedback', name: '박사학위논문 교수님 피드백 반영', price: 89000, baseUnits: 15, unitLabel: '항목', unitSize: 5, unitPrice: 19000, days: 3, includes: ['피드백 항목별 수정(기준 15개 항목)', '수정 대조표 작성(의견·수정 내용·쪽)', '반영 부분 파란색 표시본', '최종 정리본'] },
    { code: 'P-DOCTOR-PROP', service: 'paper', type: 'doctor', task: 'proposal', name: '박사학위논문 연구계획서 작성', price: 99000, baseUnits: 25, unitLabel: '쪽', unitSize: 5, unitPrice: 19000, days: 4, includes: ['연구 주제·제목 확정안', '연구 목적과 독창성', '이론적 배경과 연구모형', '연구 방법·분석 계획', '참고문헌'] },
    { code: 'P-JOURNAL-FULL', service: 'paper', type: 'journal', task: 'full', name: '학술지 투고논문 20 Page 완성', price: 99000, baseUnits: 20, unitLabel: '쪽', unitSize: 5, unitPrice: 19000, days: 4, includes: ['투고 학술지 형식 원고 20 Page', '국문·영문 초록', '실존 참고문헌과 본문 인용', '전공 분야 박사 최종 검수', '수정 1회'] },
    { code: 'P-JOURNAL-EDIT', service: 'paper', type: 'journal', task: 'edit', name: '학술지 투고논문 첨삭·교정', price: 39000, baseUnits: 20, unitLabel: '쪽', unitSize: 5, unitPrice: 9000, days: 2, includes: ['원고 첨삭(기준 20쪽)', '투고 규정 형식 점검', '수정 내역 표시본'] },
    { code: 'P-JOURNAL-FB', service: 'paper', type: 'journal', task: 'feedback', name: '학술지 심사 의견 반영(수정 보완)', price: 49000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 19000, days: 2, includes: ['심사 의견별 수정', '심사 의견 답변서(Response letter) 작성', '반영 부분 파란색 표시본', '최종 정리본'] },
    { code: 'P-BACHELOR-FULL', service: 'paper', type: 'bachelor', task: 'full', name: '학사 졸업논문 30 Page 완성', price: 59000, baseUnits: 30, unitLabel: '쪽', unitSize: 10, unitPrice: 19000, days: 3, includes: ['주제·목차 구성', '장별 본문 30 Page', '실존 참고문헌과 본문 인용', '전공 분야 박사 최종 검수', '수정 1회'] },
    { code: 'P-BACHELOR-EDIT', service: 'paper', type: 'bachelor', task: 'edit', name: '학사·졸업논문 첨삭·교정', price: 29000, baseUnits: 20, unitLabel: '쪽', unitSize: 10, unitPrice: 9000, days: 2, includes: ['원고 첨삭(기준 20쪽)', '수정 내역 표시본'] },
    { code: 'P-BACHELOR-FB', service: 'paper', type: 'bachelor', task: 'feedback', name: '학사·졸업논문 교수님 피드백 반영', price: 39000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 9000, days: 2, includes: ['피드백 항목별 수정', '수정 대조표 작성', '반영 부분 파란색 표시본'] },
    { code: 'P-BACHELOR-PROP', service: 'paper', type: 'bachelor', task: 'proposal', name: '학사·졸업논문 연구계획서 작성', price: 29000, baseUnits: 8, unitLabel: '쪽', unitSize: 4, unitPrice: 9000, days: 2, includes: ['주제·제목 확정안', '연구 목적과 방법', '목차안', '참고문헌'] },
    { code: 'P-REPORT-FULL', service: 'paper', type: 'report', task: 'full', name: '일반 연구보고서 전체 구성·초고 완성', price: 59000, baseUnits: 20, unitLabel: '쪽', unitSize: 10, unitPrice: 19000, days: 3, includes: ['보고서 구성안', '본문 초고(기준 20쪽)', '참고자료 정리', '수정 1회'] },
    { code: 'P-REPORT-EDIT', service: 'paper', type: 'report', task: 'edit', name: '일반 연구보고서 첨삭·교정', price: 29000, baseUnits: 20, unitLabel: '쪽', unitSize: 10, unitPrice: 9000, days: 2, includes: ['원고 첨삭(기준 20쪽)', '수정 내역 표시본'] },
    { code: 'P-REPORT-FB', service: 'paper', type: 'report', task: 'feedback', name: '일반 연구보고서 검토 의견 반영', price: 29000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 9000, days: 2, includes: ['의견 항목별 수정', '수정 대조표 작성', '반영 부분 파란색 표시본'] },
    { code: 'P-YOUTH-FULL', service: 'paper', type: 'youth', task: 'full', name: '청소년 탐구논문 구성·초고 완성', price: 39000, baseUnits: 10, unitLabel: '쪽', unitSize: 5, unitPrice: 9000, days: 2, includes: ['탐구 주제·질문 정리', '탐구 보고서 초고(기준 10쪽)', '참고자료 정리', '수정 1회'] },
    { code: 'P-YOUTH-EDIT', service: 'paper', type: 'youth', task: 'edit', name: '청소년 탐구논문 첨삭·교정', price: 19000, baseUnits: 10, unitLabel: '쪽', unitSize: 5, unitPrice: 9000, days: 1, includes: ['원고 첨삭(기준 10쪽)', '수정 내역 표시본'] },
    { code: 'P-YOUTH-FB', service: 'paper', type: 'youth', task: 'feedback', name: '청소년 탐구논문 선생님 피드백 반영', price: 19000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 9000, days: 1, includes: ['피드백 항목별 수정', '수정 대조표 작성', '반영 부분 파란색 표시본'] },
    { code: 'P-PERSONAL-FULL', service: 'paper', type: 'personal', task: 'full', name: '개인 관심연구 구성·초고 완성', price: 49000, baseUnits: 15, unitLabel: '쪽', unitSize: 5, unitPrice: 9000, days: 3, includes: ['연구 질문 정리', '연구 원고 초고(기준 15쪽)', '참고문헌 정리', '수정 1회'] },
    { code: 'P-PERSONAL-EDIT', service: 'paper', type: 'personal', task: 'edit', name: '개인 관심연구 첨삭·교정', price: 19000, baseUnits: 15, unitLabel: '쪽', unitSize: 5, unitPrice: 9000, days: 2, includes: ['원고 첨삭(기준 15쪽)', '수정 내역 표시본'] },
    { code: 'P-SHORT-FULL', service: 'paper', type: 'short', task: 'full', name: '소논문 15 Page 완성', price: 29000, baseUnits: 15, unitLabel: '쪽', unitSize: 5, unitPrice: 9000, days: 2, includes: ['주제와 연구 질문 정리', '소논문 본문 15 Page', '실존 참고문헌과 본문 인용', '전공 분야 박사 최종 검수', '수정 1회'] },
    { code: 'P-PERSONAL-FB', service: 'paper', type: 'personal', task: 'feedback', name: '개인 관심연구 피드백 반영', price: 19000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 9000, days: 2, includes: ['의견 항목별 수정', '수정 대조표 작성', '반영 부분 파란색 표시본'] },
    // 설문조사
    { code: 'S-FULL', service: 'survey', task: 'full', name: '설문조사 원스톱: 설문지 작성부터 통계 해석까지', price: 129000, days: 4, includes: ['연구 목적에 맞는 설문지 작성(검증된 척도)', '온라인 설문 제작과 설문조사 진행 관리', '응답 데이터 정리·익명화', '논문 맞춤 통계 분석과 결과 해석', '연구결과 정리'], excludes: ['응답자 모집·사례비(모집 의뢰 시 별도 견적)'] },
    { code: 'S-NEW', service: 'survey', task: 'new', name: '설문지 작성', price: 39000, days: 2, includes: ['연구 변인별 검증된 척도 선정과 문항 구성', '인구통계 문항 구성', '설문지 파일(Word)', '배포용 온라인 설문 링크'] },
    { code: 'S-EDIT', service: 'survey', task: 'edit', name: '설문지 점검·수정', price: 29000, days: 1, includes: ['문항 구성·표현 점검과 수정', '척도 구성 점검', '수정본과 수정 내역'] },
    { code: 'S-FB', service: 'survey', task: 'feedback', name: '설문지 교수님 피드백 반영', price: 29000, days: 1, includes: ['피드백 항목별 수정', '수정 대조표 작성', '반영 부분 파란색 표시본'] },
    { code: 'S-ANALYZE', service: 'survey', task: 'analyze', name: '설문 응답 통계 분석·해석', price: 69000, days: 3, includes: ['응답 데이터 정리·결측 점검', '연구 가설에 맞는 분석(신뢰도·기술통계·가설 검증)', 'APA 형식 통계표와 결과 해석'] },
    { code: 'S-RECRUIT', service: 'survey', task: 'recruit', name: '응답자 모집·배포 대행', price: 0, quoteOnly: true, days: 0, includes: ['모집 경로·일정·표본 계획 수립', '참여 동의 절차와 개인정보 보호 안내', '모집 진행 현황 공유'], excludes: ['IRB 심의 비용'] },
    // 통계분석
    { code: 'T-BASIC', service: 'statistics', task: 'table', name: '논문 맞춤 통계분석 기본형', price: 49000, days: 2, includes: ['데이터 점검·정리', '주제와 데이터에 맞는 분석 실행', 'APA 형식 통계표', '핵심 결과 해석'] },
    { code: 'T-INTERP', service: 'statistics', task: 'interp', name: '논문 맞춤 통계분석 표준형', price: 69000, days: 3, includes: ['연구 주제·가설에 맞는 분석 설계', '데이터 점검·정리', '분석 실행(SPSS·PROCESS 등)', 'APA 형식 통계표', '표별 결과 해석과 설명'] },
    { code: 'T-CHAPTER', service: 'statistics', task: 'chapter', name: '논문 맞춤 통계분석과 연구결과 작성', price: 99000, days: 4, includes: ['표준형 분석 전체(분석 설계·통계표·해석)', '연구결과(4장) 본문 작성', '표·그림 번호 정리'] },
    { code: 'T-FB', service: 'statistics', task: 'revise', name: '통계 재분석·교수님 피드백 반영', price: 39000, days: 2, includes: ['피드백 항목별 재분석·수정', '수정된 통계표', '수정 대조표 작성', '반영 부분 파란색 표시'] },
    { code: 'T-SIM', service: 'statistics', task: 'simulation', name: '학습용 시뮬레이션 데이터 분석', price: 19000, days: 2, includes: ['교육용 가상 데이터 생성', '분석 절차 실습 결과와 해설'], excludes: ['실제 연구 결과로 사용 불가(가상 데이터 표시)'] },
    { code: 'T-ADV', service: 'statistics', task: 'advanced', name: '심화 분석(매개·조절효과)', price: 19000, days: 1, addon: true, includes: ['PROCESS Macro 매개·조절효과 분석'] },
    // 공통 추가 옵션: 심사 발표 PPT, 영문 논문 작성(10쪽 단위)이 앞, 일정·형식 옵션이 뒤
    { code: 'A-PPT', service: 'addon', name: '심사 발표 PPT 제작', price: 39000, days: 1, addon: true, includes: ['논문 핵심을 담은 발표 자료(15~20장)', '장표별 발표 스크립트', '표·그림을 살린 학술 발표 디자인'] },
    { code: 'A-ENGLISH', service: 'addon', name: '영문 논문 작성(10 Page 단위)', price: 29000, baseUnits: 0, unitLabel: '쪽', unitSize: 10, unitPrice: 29000, days: 3, addon: true, includes: ['학술 영어로 원고 작성', '영문 초록과 주제어', '영문 참고문헌 형식 정리'] },
    { code: 'A-PRIORITY', service: 'addon', name: '우선 처리', price: 29000, addon: true, includes: ['작업 순서를 앞당겨 납기 단축(가능한 경우에만 선택 가능)'] },
    { code: 'A-FORMAT', service: 'addon', name: '학교·학술지 양식 상세 적용', price: 19000, addon: true, includes: ['제출 양식(여백·글꼴·표·그림·목차 서식) 상세 적용'] },
    { code: 'A-REVISION', service: 'addon', name: '추가 수정 1회', price: 19000, addon: true, includes: ['전달 후 수정 요청 1회 추가'] },
  ],
  settings: {
    priorityEnabled: true,
    vatIncluded: true,
    payInFullDiscountRate: 0,
  },
};

// 정가: 할인 행사 가격과 함께 보여 주는 기준 가격(표시용, 결제 금액 계산에는 쓰지 않음)
var LIST_PRICE = {
  'P-SHORT-FULL': 59000, 'P-BACHELOR-FULL': 119000, 'P-JOURNAL-FULL': 199000, 'P-MASTER-FULL': 199000, 'P-DOCTOR-FULL': 399000,
  'P-BACHELOR-PROP': 59000, 'P-MASTER-PROP': 139000, 'P-DOCTOR-PROP': 199000,
};
function listPriceFor(code, price) {
  var l = LIST_PRICE[code];
  return l && l > (Number(price) || 0) ? l : 0;
}
function discountRate(list, price) {
  if (!list || !price || list <= price) return 0;
  return Math.floor((1 - price / list) * 100);
}
// 할인 행사 이름과 할인 표시: 정가의 절반(50%)이면 '반값', 아니면 '43%'처럼
var PROMO_NAME = '졸업 시즌 반값';
var PROMO_SHORT = '졸업 시즌';
function offText(list, price, opts) {
  var r = discountRate(list, price);
  if (!r) return '';
  if (r === 50 || r === 51) return '반값';
  return opts && opts.short ? r + '%' : r + '% 할인';
}
// 행사 이름: 반값이면 '졸업 시즌 반값', 아니면 '졸업 시즌 43% 할인'
function promoText(list, price) {
  var o = offText(list, price);
  return !o ? '' : o === '반값' ? PROMO_NAME : PROMO_SHORT + ' ' + o;
}
// 분량 표기: 80 Page
function pageLabel(n) { return n ? n + ' Page' : ''; }

var TASK_LABELS = { full: '논문 완성(전체 구성·본문)', edit: '논문 첨삭·교정', feedback: '교수님 피드백 반영', proposal: '연구계획서 작성' };

// 논문 첨삭 추가 옵션이 쓸 수 있는 논문 유형
var EDIT_TYPES = ['master', 'doctor', 'journal', 'bachelor', 'report', 'youth', 'personal'];

function findItem(catalog, code) {
  var items = (catalog && catalog.items) || [];
  for (var i = 0; i < items.length; i++) if (items[i].code === code && items[i].active !== false) return items[i];
  return null;
}

function paperItemCode(typeId, task) {
  return 'P-' + String(typeId || 'master').toUpperCase() + '-' + ({ full: 'FULL', edit: 'EDIT', feedback: 'FB', proposal: 'PROP' }[task] || 'FULL');
}

// 포함 항목의 분량 표기를 실제 주문 분량으로 바꾸고, 'N쪽'은 'N Page'로 보여 준다
function includesFor(list, pages) {
  const n = Number(pages) || 0;
  return (list || []).map((x) => {
    let t = String(x);
    if (n > 0) t = t.replace(/\(기준\s*\d+\s*쪽(\s*내외)?\)/, `(${n} Page)`).replace(/(본문|원고)\s+\d+\s*Page/, `$1 ${n} Page`);
    // 운영 가격표에 예전 문구(전문가 최종 검토·전공 분야 전문가 최종 검수)가 남아 있어도 화면에는 새 표현으로(전공 분야 박사 최종 검수)
    return t.replace(/(\d+)\s*쪽/g, '$1 Page').replace(/(?:석·박사\s*)?전문가\s*최종\s*검토|전공\s*분야\s*전문가\s*최종\s*검수/, '전공 분야 박사 최종 검수');
  });
}

function won(n) {
  return (Math.round(Number(n) || 0)).toLocaleString('ko-KR') + '원';
}

function line(item, opts) {
  opts = opts || {};
  var qty = opts.qty || 1;
  var unit = opts.unitPrice != null ? opts.unitPrice : item.price;
  return { code: item.code, name: opts.name || item.name, qty: qty, unitPrice: unit, amount: unit * qty, note: opts.note || '' };
}

// 주문 입력(정규화된 형태)으로 견적 계산
function computeQuote(catalog, input) {
  catalog = catalog || DEFAULT_CATALOG;
  input = input || {};
  var lines = [];
  var reasons = [];
  var notes = [];
  var includes = [];
  var excludes = [];
  var days = 0;
  var main = null;
  var service = input.service;

  if (service === 'paper') {
    var p = input.paper || {};
    main = findItem(catalog, paperItemCode(p.typeId, p.task));
    if (!main) main = findItem(catalog, paperItemCode(p.typeId, 'full'));
    if (main) {
      lines.push(line(main));
      days = main.days || 0;
      includes = (main.includes || []).slice();
      // 추가 분량
      var units = null;
      if (main.unitLabel === '항목') units = p.feedbackItems != null ? Number(p.feedbackItems) : null;
      else units = p.pages != null && p.pages !== '' ? Number(p.pages) : null;
      if (units != null && units > main.baseUnits) {
        var extraBlocks = Math.ceil((units - main.baseUnits) / main.unitSize);
        lines.push({ code: main.code + '-X', name: '추가 분량 (' + main.unitSize + main.unitLabel + ' 단위 × ' + extraBlocks + ')', qty: extraBlocks, unitPrice: main.unitPrice, amount: main.unitPrice * extraBlocks, note: '기준 ' + main.baseUnits + main.unitLabel + ' 초과 ' + (units - main.baseUnits) + main.unitLabel });
        days += Math.min(5, Math.ceil(extraBlocks / 2));
      }
      if (units == null) notes.push('분량을 모르셔도 기준 분량(' + main.baseUnits + main.unitLabel + ')으로 먼저 진행하고, 자료 확인 후 초과분이 있을 때만 추가 결제를 안내드립니다.');
      if (p.needsData) notes.push('결과 장은 실제 데이터 분석 후 작성됩니다. 데이터가 없으면 설문조사·통계분석 서비스와 연결해 드립니다.');
    }
  } else if (service === 'survey') {
    var s = input.survey || {};
    main = findItem(catalog, { full: 'S-FULL', new: 'S-NEW', edit: 'S-EDIT', feedback: 'S-FB', analyze: 'S-ANALYZE' }[s.mode] || 'S-FULL');
    if (main) { lines.push(line(main)); days = main.days || 0; includes = (main.includes || []).slice(); excludes = (main.excludes || []).slice(); }
    if (s.recruit === 'us') {
      reasons.push('응답자 모집·배포는 대상, 응답 수, 모집 경로, 기간에 따라 비용이 달라 확정 견적 후 결제합니다.');
      var r = findItem(catalog, 'S-RECRUIT');
      if (r) { lines.push({ code: r.code, name: r.name, qty: 1, unitPrice: 0, amount: 0, note: '견적 확정 후 안내', pending: true }); includes = includes.concat(r.includes || []); }
    }
    if (s.mode === 'analyze' && s.advanced) {
      var adv = findItem(catalog, 'T-ADV');
      if (adv) lines.push(line(adv));
    }
    if (s.sem) reasons.push('구조방정식 분석은 모형 복잡도에 따라 별도 견적입니다.');
  } else if (service === 'statistics') {
    var t = input.statistics || {};
    if (t.hasData === false && t.noDataPath === 'survey') {
      main = findItem(catalog, 'S-FULL');
      if (main) { lines.push(line(main)); days = main.days || 0; includes = (main.includes || []).slice(); excludes = (main.excludes || []).slice(); }
      reasons.push('실제 응답 조사부터 진행하는 경우 모집 비용을 포함한 통합 견적을 드립니다.');
    } else if (t.hasData === false) {
      main = findItem(catalog, 'T-SIM');
      if (main) { lines.push(line(main)); days = main.days || 0; includes = (main.includes || []).slice(); excludes = (main.excludes || []).slice(); }
    } else {
      main = findItem(catalog, { table: 'T-BASIC', interp: 'T-INTERP', chapter: 'T-CHAPTER', revise: 'T-FB' }[t.output] || 'T-INTERP');
      if (main) { lines.push(line(main)); days = main.days || 0; includes = (main.includes || []).slice(); }
      if (t.advanced && t.output !== 'revise') {
        var adv2 = findItem(catalog, 'T-ADV');
        if (adv2) { lines.push(line(adv2)); days += adv2.days || 0; }
      }
      if (t.sem) reasons.push('구조방정식·다층모형 등 심화 분석은 모형과 데이터 구조를 확인한 뒤 견적을 확정합니다.');
      if (t.messy) reasons.push('여러 파일 병합·대규모 정리 등 복잡한 데이터 정리는 분량 확인 후 견적을 확정합니다.');
    }
  }

  // 공통 추가 옵션
  var a = input.addons || {};
  var settings = catalog.settings || {};
  if (a.priority && settings.priorityEnabled !== false) {
    var pr = findItem(catalog, 'A-PRIORITY');
    if (pr) { lines.push(line(pr)); days = Math.max(1, Math.ceil(days / 2)); }
  }
  if (a.format && service === 'paper') {
    var fm = findItem(catalog, 'A-FORMAT');
    if (fm) lines.push(line(fm));
  }
  if (a.revisions && Number(a.revisions) > 0) {
    var rv = findItem(catalog, 'A-REVISION');
    if (rv) lines.push(line(rv, { qty: Math.min(5, Number(a.revisions)) }));
  }
  // 심사 발표 PPT: 모든 서비스
  if (a.ppt && main) {
    var ppt = findItem(catalog, 'A-PPT');
    if (ppt) { lines.push(line(ppt)); days += ppt.days || 0; includes = includes.concat(ppt.includes || []); }
  }
  // 영문 논문 작성: 전체 구성·초고 완성에만, 원고 분량 10쪽마다 1단위
  if (a.english && service === 'paper' && main && main.task === 'full') {
    var en = findItem(catalog, 'A-ENGLISH');
    if (en) {
      var enSize = Number(en.unitSize) || 10;
      var enPages = Math.max(Number(main.baseUnits) || 0, Number((input.paper || {}).pages) || 0);
      var enBlocks = Math.max(1, Math.ceil(enPages / enSize));
      var enUnit = Number(en.unitPrice) || Number(en.price) || 0;
      lines.push(line(en, { qty: enBlocks, unitPrice: enUnit, name: '영문 논문 작성 (' + enSize + ' Page 단위 × ' + enBlocks + ')' }));
      days += en.days || 0;
      includes = includes.concat(en.includes || []);
    }
  }
  // 논문 첨삭·교정 추가: 직접 쓴 원고가 있는 주문(통계·설문, 피드백 반영)에 그 유형의 첨삭 상품을 더한다
  if (a.editing && main && (service === 'statistics' || service === 'survey' || (service === 'paper' && main.task === 'feedback'))) {
    var edType = service === 'paper' ? main.type : (EDIT_TYPES.indexOf(a.editingType) >= 0 ? a.editingType : 'master');
    var ed = findItem(catalog, paperItemCode(edType, 'edit'));
    if (ed) {
      lines.push(line(ed, { name: ed.name + ' (추가)', note: '기준 ' + ed.baseUnits + ed.unitLabel }));
      days += 1;
      includes = includes.concat(['논문 원고 문장·논리 첨삭(기준 ' + ed.baseUnits + ed.unitLabel + ')']);
      notes.push('논문 첨삭은 기준 ' + ed.baseUnits + ed.unitLabel + '으로 계산했습니다. 원고가 더 길면 확인한 뒤 추가 금액을 안내드립니다.');
    }
  }

  var total = 0;
  for (var i = 0; i < lines.length; i++) total += lines[i].amount;
  var quoteRequired = reasons.length > 0 || (main && main.quoteOnly) || !main;
  if (!main) reasons.push('선택하신 조건에 맞는 상품을 찾지 못해 견적 확인이 필요합니다.');
  return {
    catalogVersion: catalog.version,
    lines: lines,
    total: total,
    quoteRequired: !!quoteRequired,
    quoteReasons: reasons,
    payableNow: !quoteRequired && total > 0,
    days: days,
    includes: includes,
    excludes: excludes,
    notes: notes,
    mainCode: main ? main.code : null,
    mainName: main ? main.name : '',
  };
}

// 영업일 계산 (주말·지정 휴일 제외)
function addBusinessDays(start, n, holidays) {
  var d = new Date(start.getTime());
  var hs = holidays || [];
  var added = 0;
  var guard = 0;
  while (added < n && guard < 400) {
    d.setDate(d.getDate() + 1);
    guard++;
    var dow = d.getDay();
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (dow === 0 || dow === 6 || hs.indexOf(key) >= 0) continue;
    added++;
  }
  return d;
}

function etaDate(fromDate, days, holidays) {
  return addBusinessDays(fromDate, Math.max(1, days || 1), holidays);
}


// ===== 10_store.gs =====
/**
 * 10_store: 주문·이력·파일·결제·메시지·설정·가격표 저장
 */

function colIndex_(cols, name) { return cols.indexOf(name); }

/* ------------------------------------------------------------------ 주문 */
function orderFromRow_(r, rowNum) {
  var o = { row: rowNum };
  for (var i = 0; i < ORDER_COLS.length; i++) o[ORDER_COLS[i]] = r[i];
  return {
    row: rowNum,
    orderNo: String(o['주문번호']),
    status: String(o['상태'] || 'draft'),
    service: String(o['서비스'] || ''),
    productName: String(o['상품명'] || ''),
    summary: String(o['요약'] || ''),
    amount: Number(o['금액'] || 0),
    payStatus: String(o['결제상태'] || 'unpaid'),
    paidAmount: Number(o['결제금액'] || 0),
    createdAt: toDate_(o['접수일시']),
    paidAt: toDate_(o['결제일시']),
    eta: toDate_(o['예정일']),
    deliveredAt: toDate_(o['완료일시']),
    name: String(o['고객명'] || ''),
    email: String(o['이메일'] || ''),
    phone: String(o['연락처'] || '').replace(/^'/, ''),
    pinHash: String(o['PIN'] || ''),
    tokenKey: String(o['토큰키'] || ''),
    quoteRequired: String(o['견적필요']) === 'Y',
    priority: String(o['우선처리']) === 'Y',
    folderId: String(o['폴더ID'] || ''),
    dataRaw: String(o['데이터'] || ''),
    memo: String(o['메모'] || ''),
    revisionsUsed: Number(o['수정횟수'] || 0),
    updatedAt: toDate_(o['수정일시']),
    deletedState: String(o['삭제상태'] || ''),
  };
}

function orderToRow_(o) {
  return [
    o.orderNo, o.status, STATUS[o.status] || o.status, SERVICE_LABEL[o.service] || o.service, cell_(o.productName), cell_(o.summary), o.amount || 0,
    o.payStatus || 'unpaid', o.paidAmount || 0, o.createdAt || '', o.paidAt || '', o.eta || '', o.deliveredAt || '',
    cell_(o.name), cell_(o.email), o.phone || '', o.pinHash || '', o.tokenKey || '', o.quoteRequired ? 'Y' : 'N', o.priority ? 'Y' : 'N',
    o.folderId || '', o.dataRaw || '', cell_(o.memo || ''), o.revisionsUsed || 0, now_(), o.deletedState || '',
  ];
}

function serviceKey_(label) {
  for (var k in SERVICE_LABEL) if (SERVICE_LABEL[k] === label || k === label) return k;
  return label;
}

function orderData_(o) {
  if (o._data) return o._data;
  try { o._data = o.dataRaw ? JSON.parse(o.dataRaw) : {}; } catch (e) { o._data = {}; }
  return o._data;
}
function setOrderData_(o, data) {
  var raw = JSON.stringify(data || {});
  if (raw.length > 48000) throw appError_('too_large', '입력 내용이 너무 깁니다. 긴 내용은 파일로 올려 주세요.');
  o._data = data;
  o.dataRaw = raw;
}

function allOrders_() {
  var rows = rows_('orders');
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var o = orderFromRow_(rows[i], i + 2);
    o.service = serviceKey_(o.service);
    out.push(o);
  }
  return out;
}

function findOrder_(orderNo) {
  orderNo = clean_(orderNo, 30).toUpperCase();
  if (!/^NA\d{6}-[A-Z0-9]{4}$/.test(orderNo)) return null;
  var rows = rows_('orders');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === orderNo) {
      var o = orderFromRow_(rows[i], i + 2);
      o.service = serviceKey_(o.service);
      return o;
    }
  }
  return null;
}

function saveOrder_(o) {
  var sh = sheet_('orders');
  var row = orderToRow_(o);
  if (o.row) sh.getRange(o.row, 1, 1, row.length).setValues([row]);
  else { sh.appendRow(row); o.row = sh.getLastRow(); }
  invalidate_('orders');
  return o;
}

function newOrderNo_() {
  var d = Utilities.formatDate(now_(), TZ, 'yyMMdd');
  for (var tries = 0; tries < 20; tries++) {
    var no = 'NA' + d + '-' + randomString_(4);
    if (!findOrder_(no)) return no;
  }
  throw appError_('server', '주문번호를 만들지 못했습니다.');
}

/* ------------------------------------------------------------------ 이력 */
function addHistory_(orderNo, status, customerMsg, actor, internal) {
  sheet_('history').appendRow([orderNo, now_(), status || '', STATUS[status] || status || '', cell_(clean_(customerMsg, 1500)), actor || 'system', cell_(clean_(internal, 1500))]);
  invalidate_('history');
}
function historyFor_(orderNo) {
  var rows = rows_('history');
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) !== orderNo) continue;
    out.push({ at: iso_(rows[i][1]), status: String(rows[i][2]), label: String(rows[i][3]), message: String(rows[i][4] || ''), actor: String(rows[i][5] || ''), internal: String(rows[i][6] || '') });
  }
  return out;
}

/* ------------------------------------------------------------------ 파일 */
function fileFromRow_(r, rowNum) {
  return { row: rowNum, id: String(r[0]), orderNo: String(r[1]), kind: String(r[2]), slot: String(r[3]), name: String(r[4]), size: Number(r[5] || 0), mime: String(r[6] || ''), uploadedAt: toDate_(r[7]), uploader: String(r[8] || ''), state: String(r[9] || 'active'), expiresAt: toDate_(r[10]) };
}
function addFile_(f) {
  sheet_('files').appendRow([f.id, f.orderNo, f.kind, f.slot || '', cell_(f.name), f.size || 0, f.mime || '', now_(), f.uploader || '', 'active', f.expiresAt || '']);
  invalidate_('files');
}
function filesFor_(orderNo, includeInactive) {
  var rows = rows_('files');
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][1]) !== orderNo) continue;
    var f = fileFromRow_(rows[i], i + 2);
    if (!includeInactive && f.state !== 'active') continue;
    out.push(f);
  }
  return out;
}
function setFileState_(f, state) {
  sheet_('files').getRange(f.row, 10).setValue(state);
  invalidate_('files');
}
function fileView_(f, orderNo, withTicket) {
  var v = { id: f.id, name: f.name, size: f.size, slot: f.slot, kind: f.kind, uploadedAt: iso_(f.uploadedAt), expiresAt: f.expiresAt ? iso_(f.expiresAt) : '' };
  if (withTicket) v.ticket = makeFileTicket_(orderNo, f.id, 60);
  return v;
}

// Drive 파일·폴더 영구 삭제(휴지통을 거치지 않음). 실패하면 휴지통으로 옮긴다.
function driveDeleteForever_(id, isFolder) {
  if (!id) return false;
  try {
    var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?supportsAllDrives=true', {
      method: 'delete', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    });
    var code = res.getResponseCode();
    if (code === 204 || code === 200 || code === 404) return true;
    log_('drive_delete', id + ' ' + code);
  } catch (e) { log_('drive_delete', id + ' ' + e.message); }
  try { (isFolder ? DriveApp.getFolderById(id) : DriveApp.getFileById(id)).setTrashed(true); } catch (e2) { }
  return false;
}

/* ------------------------------------------------------------------ 결제 */
function paymentFromRow_(r, rowNum) {
  return { row: rowNum, id: String(r[0]), orderNo: String(r[1]), at: toDate_(r[2]), kind: String(r[3]), amount: Number(r[4] || 0), method: String(r[5] || ''), status: String(r[6] || ''), ref: String(r[7] || ''), memo: String(r[8] || ''), confirmedAt: toDate_(r[9]) };
}
function addPayment_(p) {
  var id = p.id || ('PAY-' + randomString_(8));
  sheet_('payments').appendRow([id, p.orderNo, now_(), p.kind || 'main', p.amount || 0, p.method || '', p.status || 'requested', cell_(clean_(p.ref, 200)), cell_(clean_(p.memo, 500)), p.confirmedAt || '']);
  invalidate_('payments');
  return id;
}
function paymentsFor_(orderNo) {
  var rows = rows_('payments');
  var out = [];
  for (var i = 0; i < rows.length; i++) if (String(rows[i][1]) === orderNo) out.push(paymentFromRow_(rows[i], i + 2));
  return out;
}
function updatePayment_(p) {
  sheet_('payments').getRange(p.row, 1, 1, PAYMENT_COLS.length).setValues([[p.id, p.orderNo, p.at || now_(), p.kind, p.amount, p.method, p.status, cell_(p.ref || ''), cell_(p.memo || ''), p.confirmedAt || '']]);
  invalidate_('payments');
}
function paymentView_(p) {
  return { id: p.id, kind: p.kind, amount: p.amount, method: p.method, status: p.status, memo: p.kind === 'extra' ? p.memo : '', at: iso_(p.at), confirmedAt: iso_(p.confirmedAt) };
}
function amountDue_(o) {
  // 아직 확인되지 않은 결제 요청(본 결제·추가 결제) 합계
  var due = 0;
  var ps = paymentsFor_(o.orderNo);
  for (var i = 0; i < ps.length; i++) if (ps[i].status === 'requested' || ps[i].status === 'claimed') due += ps[i].amount;
  return due;
}

/* ------------------------------------------------------------------ 메시지 */
function addMessage_(orderNo, from, type, text) {
  sheet_('messages').appendRow([orderNo, now_(), from, type || 'note', cell_(clean_(text, 4000)), from === 'admin' ? 'Y' : 'N']);
  invalidate_('messages');
}
function messagesFor_(orderNo) {
  var rows = rows_('messages');
  var out = [];
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === orderNo) out.push({ row: i + 2, at: iso_(rows[i][1]), from: String(rows[i][2]), type: String(rows[i][3]), text: String(rows[i][4]), done: String(rows[i][5]) === 'Y' });
  return out;
}
function markMessagesDone_(orderNo) {
  var sh = sheet_('messages');
  var ms = messagesFor_(orderNo);
  for (var i = 0; i < ms.length; i++) if (!ms[i].done) sh.getRange(ms[i].row, 6).setValue('Y');
  invalidate_('messages');
}

/* ------------------------------------------------------------------ 설정 저장 */
function saveSettings_(obj) {
  var sh = sheet_('settings');
  var rows = rows_('settings');
  var index = {};
  for (var i = 0; i < rows.length; i++) index[String(rows[i][0])] = i + 2;
  for (var k in obj) {
    if (!DEFAULT_SETTINGS.hasOwnProperty(k)) continue;
    var v = clean_(obj[k], 20000);
    if (index[k]) sh.getRange(index[k], 2).setValue(cell_(v));
    else sh.appendRow([k, cell_(v), DEFAULT_SETTINGS[k][1]]);
  }
  invalidate_('settings');
  __settings = null;
}

/* ------------------------------------------------------------------ 가격표 */
function catalogFromSheet_() {
  var rows;
  try { rows = rows_('catalog'); } catch (e) { return null; }
  if (!rows.length) return null;
  var items = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    var it = {
      code: String(r[0]), service: String(r[1]), name: String(r[4]), price: Number(r[5] || 0),
      days: Number(r[10] || 0), includes: String(r[11] || '').split('\n').filter(String), excludes: String(r[12] || '').split('\n').filter(String),
      active: String(r[15]) !== 'N',
    };
    if (r[2]) it.type = String(r[2]);
    if (r[3]) it.task = String(r[3]);
    if (r[6] !== '' && r[6] !== null) { it.baseUnits = Number(r[6]); it.unitLabel = String(r[7] || '쪽'); it.unitSize = Number(r[8] || 1); it.unitPrice = Number(r[9] || 0); }
    if (String(r[13]) === 'Y') it.quoteOnly = true;
    if (String(r[14]) === 'Y') it.addon = true;
    if (r[16]) it.payUrl = String(r[16]);
    items.push(it);
  }
  var version = prop_('CATALOG_VERSION') || DEFAULT_CATALOG.version;
  return { version: version, currency: 'KRW', items: items, settings: { priorityEnabled: true } };
}

function catalog_() {
  return catalogFromSheet_() || JSON.parse(JSON.stringify(DEFAULT_CATALOG));
}

function writeCatalog_(catalog) {
  var sh = sheet_('catalog');
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, CATALOG_COLS.length).clearContent();
  var rows = (catalog.items || []).map(function (it) {
    return [it.code, it.service || '', it.type || '', it.task || '', it.name || '', Number(it.price || 0),
      it.baseUnits != null ? it.baseUnits : '', it.unitLabel || '', it.unitSize != null ? it.unitSize : '', it.unitPrice != null ? it.unitPrice : '',
      Number(it.days || 0), (it.includes || []).join('\n'), (it.excludes || []).join('\n'), it.quoteOnly ? 'Y' : 'N', it.addon ? 'Y' : 'N', it.active === false ? 'N' : 'Y', it.payUrl || ''];
  });
  if (rows.length) sh.getRange(2, 1, rows.length, CATALOG_COLS.length).setValues(rows);
  props_().setProperty('CATALOG_VERSION', Utilities.formatDate(now_(), TZ, 'yyyy-MM-dd HH:mm'));
  invalidate_('catalog');
}

/* ------------------------------------------------------------------ 드라이브 */
function rootFolder_() {
  var id = prop_('ROOT_FOLDER_ID');
  if (!id) throw appError_('not_setup', '자료 폴더가 설정되지 않았습니다.');
  return DriveApp.getFolderById(id);
}
function childFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function orderFolder_(o) {
  if (o.folderId) {
    try { return DriveApp.getFolderById(o.folderId); } catch (e) { /* 다시 만듦 */ }
  }
  var month = childFolder_(rootFolder_(), Utilities.formatDate(o.createdAt || now_(), TZ, 'yyyy-MM'));
  var folder = month.createFolder(o.orderNo + ' ' + (o.name || '') + ' (' + (SERVICE_LABEL[o.service] || '') + ')');
  folder.createFolder('1_고객자료');
  folder.createFolder('2_결과물');
  o.folderId = folder.getId();
  return folder;
}
function subFolder_(o, kind) {
  return childFolder_(orderFolder_(o), kind === 'result' ? '2_결과물' : '1_고객자료');
}


// ===== 20_public.gs =====
/**
 * 20_public: 고객용 API
 */

var FILE_RULES = {
  common: ['docx', 'doc', 'hwp', 'hwpx', 'pdf', 'txt', 'rtf', 'pptx', 'ppt', 'xlsx', 'xls', 'csv', 'png', 'jpg', 'jpeg', 'zip'],
  data: ['xlsx', 'xls', 'csv', 'sav', 'txt', 'zip', 'sps', 'spv'],
  result: ['docx', 'doc', 'hwp', 'hwpx', 'pdf', 'txt', 'pptx', 'xlsx', 'xls', 'csv', 'sav', 'spv', 'sps', 'png', 'jpg', 'jpeg', 'zip'],
};
var SLOT_LABEL = {
  manuscript: '기존 원고', materials: '참고 자료', toc: '목차', format: '학교·학술지 양식', feedback: '피드백 자료',
  questionnaire: '설문지', proposal: '연구계획서', data: '데이터 파일', prevResult: '기존 분석 결과', codebook: '변수 설명', other: '기타 자료', result: '결과물',
};
var MAX_FILES_PER_ORDER = 40;

/* ------------------------------------------------------------------ 입력 정리 */
function str_(v, max) { return clean_(v, max || 300); }
function bool_(v) { return v === true || v === 'true' || v === 'Y' || v === 1; }

function normalizeInput_(service, raw) {
  raw = raw || {};
  var common = raw.common || {};
  var input = {
    service: service,
    common: {
      fieldId: str_(common.fieldId, 20), fieldText: str_(common.fieldText, 80), school: str_(common.school, 80), dept: str_(common.dept, 80),
      purpose: str_(common.purpose, 30), topicKnown: str_(common.topicKnown, 10), title: str_(common.title, 200), keywords: (common.keywords || []).slice(0, 5).map(function (k) { return str_(k, 30); }),
      due: str_(common.due, 10), outputFormat: str_(common.outputFormat, 10), request: str_(common.request, 3000), method: str_(common.method, 20),
    },
    addons: (function (ad) {
      return {
        priority: bool_(ad.priority), format: bool_(ad.format), revisions: Math.min(5, Math.max(0, Number(ad.revisions || 0))),
        ppt: bool_(ad.ppt), english: bool_(ad.english), editing: bool_(ad.editing), editingType: EDIT_TYPES.indexOf(String(ad.editingType || '')) >= 0 ? String(ad.editingType) : '',
      };
    })(raw.addons || {}),
  };
  if (service === 'paper') {
    var p = raw.paper || {};
    input.paper = {
      typeId: str_(p.typeId, 12) || 'master', task: str_(p.task, 12) || 'full',
      hasToc: str_(p.hasToc, 8), tocText: str_(p.tocText, 4000), hasFormat: str_(p.hasFormat, 8), formatName: str_(p.formatName, 100),
      pages: p.pages === '' || p.pages === null || p.pages === undefined ? null : Math.max(0, Math.min(999, Number(p.pages) || 0)),
      feedbackItems: p.feedbackItems === null || p.feedbackItems === undefined || p.feedbackItems === '' ? null : Math.max(0, Math.min(200, Number(p.feedbackItems) || 0)),
      feedbackText: str_(p.feedbackText, 8000), editScope: str_(p.editScope, 2000), needsData: bool_(p.needsData),
    };
  } else if (service === 'survey') {
    var s = raw.survey || {};
    input.survey = {
      mode: str_(s.mode, 12) || 'full', hasPlan: str_(s.hasPlan, 8), target: str_(s.target, 30), targetOther: str_(s.targetOther, 60),
      targetN: str_(s.targetN, 10), recruit: str_(s.recruit, 10), analysis: str_(s.analysis, 20), feedbackText: str_(s.feedbackText, 8000),
      advanced: bool_(s.advanced), sem: bool_(s.sem), deliverables: (s.deliverables || []).slice(0, 10).map(function (d) { return str_(d, 30); }),
    };
  } else if (service === 'statistics') {
    var t = raw.statistics || {};
    input.statistics = {
      hasData: t.hasData === false || t.hasData === 'false' ? false : true, noDataPath: str_(t.noDataPath, 12), output: str_(t.output, 12) || 'interp',
      methods: (t.methods || []).slice(0, 10).map(function (m) { return str_(m, 20); }), variables: str_(t.variables, 2000),
      advanced: bool_(t.advanced), sem: bool_(t.sem), messy: bool_(t.messy), feedbackText: str_(t.feedbackText, 8000), dataInfo: str_(t.dataInfo, 2000),
    };
  }
  return input;
}

function requiredSlots_(input) {
  // [항목, 대체 가능한 텍스트 존재 여부, 안내 문구]
  var req = [];
  if (input.service === 'paper') {
    var p = input.paper;
    if (p.task === 'edit') req.push({ slot: 'manuscript', label: '기존 원고 파일' });
    if (p.task === 'feedback') { req.push({ slot: 'manuscript', label: '기존 원고 파일' }); req.push({ slot: 'feedback', alt: !!p.feedbackText, label: '교수님 피드백(파일 또는 붙여넣기)' }); }
    if (p.hasToc === 'yes') req.push({ slot: 'toc', alt: !!p.tocText, label: '목차(파일 또는 직접 입력)' });
    if (p.hasFormat === 'yes') req.push({ slot: 'format', label: '학교·학술지 양식 파일' });
  } else if (input.service === 'survey') {
    var s = input.survey;
    if (s.mode === 'edit') req.push({ slot: 'questionnaire', label: '기존 설문지 파일' });
    if (s.mode === 'feedback') { req.push({ slot: 'questionnaire', label: '기존 설문지 파일' }); req.push({ slot: 'feedback', alt: !!s.feedbackText, label: '교수님 피드백(파일 또는 붙여넣기)' }); }
    if (s.mode === 'analyze') req.push({ slot: 'data', label: '실제 응답 데이터 파일' });
  } else if (input.service === 'statistics') {
    var t = input.statistics;
    if (t.hasData !== false) req.push({ slot: 'data', label: '데이터 파일(Excel, CSV, SPSS)' });
    if (t.hasData !== false && t.output === 'revise') { req.push({ slot: 'prevResult', label: '기존 분석 결과 파일' }); req.push({ slot: 'feedback', alt: !!t.feedbackText, label: '교수님 의견(파일 또는 붙여넣기)' }); }
  }
  return req;
}

function missingMaterials_(o) {
  var data = orderData_(o);
  var files = filesFor_(o.orderNo).filter(function (f) { return f.kind === 'customer'; });
  var links = data.links || [];
  var missing = [];
  var req = requiredSlots_(data.input || {});
  for (var i = 0; i < req.length; i++) {
    var r = req[i];
    if (r.alt) continue;
    var has = files.some(function (f) { return f.slot === r.slot; }) || links.some(function (l) { return l.slot === r.slot && l.url; });
    if (!has) missing.push(r.label);
  }
  return missing;
}

function quoteInput_(input) {
  return { service: input.service, paper: input.paper, survey: input.survey, statistics: input.statistics, addons: input.addons };
}

/* ------------------------------------------------------------------ 주문 보기(고객용) */
function stepsFor_(o) {
  return ['received', 'checking', 'preparing', 'in_progress', 'review', 'delivered'];
}

function queuePosition_(o) {
  if (o.status !== 'in_progress' && o.status !== 'preparing' && o.status !== 'received' && o.status !== 'checking') return null;
  var active = allOrders_().filter(function (x) { return ['received', 'checking', 'preparing', 'in_progress'].indexOf(x.status) >= 0; });
  active.sort(function (a, b) { return (a.eta ? a.eta.getTime() : 9e15) - (b.eta ? b.eta.getTime() : 9e15) || (a.paidAt ? a.paidAt.getTime() : 0) - (b.paidAt ? b.paidAt.getTime() : 0); });
  for (var i = 0; i < active.length; i++) if (active[i].orderNo === o.orderNo) return i + 1;
  return null;
}

function revisionAllowance_(o) {
  var q = orderData_(o).quote || {};
  var allowed = 0;
  (q.lines || []).forEach(function (l) { if (l.code === 'A-REVISION') allowed += l.qty || 1; });
  if (/FULL$|PROP$/.test(q.mainCode || '') || /^S-FULL$/.test(q.mainCode || '')) allowed += 1;
  return allowed;
}

// 마지막 '전달 완료' 시각(ms). 전달한 적이 없으면 0
function lastDeliveredAt_(o, history) {
  var t = 0;
  (history || historyFor_(o.orderNo)).forEach(function (h) {
    if (h.status !== 'delivered') return;
    var d = new Date(h.at).getTime();
    if (d > t) t = d;
  });
  if (!t && o.deliveredAt) t = o.deliveredAt.getTime();
  return t;
}

// 고객에게 공개된 결과물: 마지막 전달 완료 이전에 올린 것만. 수정 중에 새로 올린 파일은 다시 전달할 때 공개된다
function isPublishedResult_(o, f, history) {
  if (f.kind !== 'result') return false;
  var cut = lastDeliveredAt_(o, history);
  // 이력 시각은 초 단위로 남으므로 올린 시각도 초 단위로 비교한다
  return !!cut && !!f.uploadedAt && Math.floor(f.uploadedAt.getTime() / 1000) * 1000 <= cut;
}

function orderView_(o, opts) {
  opts = opts || {};
  var data = orderData_(o);
  var files = filesFor_(o.orderNo);
  var history = historyFor_(o.orderNo);
  var payments = paymentsFor_(o.orderNo);
  var msgs = messagesFor_(o.orderNo);
  var retention = settingNum_('retentionDays', 90);
  var customerFiles = files.filter(function (f) { return f.kind === 'customer'; }).map(function (f) { return fileView_(f, o.orderNo, true); });
  var results = files.filter(function (f) { return f.kind === 'result' && (opts.admin || isPublishedResult_(o, f, history)); }).map(function (f) { return fileView_(f, o.orderNo, true); });
  var due = 0;
  payments.forEach(function (p) { if (p.status === 'requested') due += p.amount; });
  var view = {
    orderNo: o.orderNo,
    status: o.status,
    statusLabel: STATUS[o.status] || o.status,
    service: o.service,
    serviceLabel: SERVICE_LABEL[o.service] || '',
    productName: o.productName,
    summary: o.summary,
    amount: o.amount,
    paidAmount: o.paidAmount,
    payStatus: o.payStatus,
    amountDue: due,
    quoteRequired: o.quoteRequired,
    createdAt: iso_(o.createdAt),
    paidAt: iso_(o.paidAt),
    eta: o.eta ? ymd_(o.eta) : '',
    etaLabel: o.eta ? korDate_(o.eta) : '',
    deliveredAt: iso_(o.deliveredAt),
    filesExpireAt: o.deliveredAt ? ymd_(new Date(o.deliveredAt.getTime() + retention * 86400000)) : '',
    quote: data.quote || null,
    input: data.input || null,
    design: data.design || null,
    links: data.links || [],
    timeline: history.filter(function (h) { return h.status && h.actor !== 'internal'; }).map(function (h) { return { status: h.status, label: h.label, at: h.at, message: h.message }; }),
    steps: stepsFor_(o),
    files: { customer: customerFiles, results: results },
    payments: payments.filter(function (p) { return p.status !== 'cancelled'; }).map(paymentView_),
    messages: msgs.map(function (m) { return { at: m.at, from: m.from, type: m.type, text: m.text }; }),
    queuePosition: queuePosition_(o),
    revisions: { allowed: revisionAllowance_(o), used: o.revisionsUsed },
    missing: o.status === 'draft' || o.status === 'needs_materials' ? missingMaterials_(o) : [],
    missingSlots: o.status === 'draft' || o.status === 'needs_materials' ? missingSlots_(o) : [],
    revisionUntil: o.deliveredAt ? ymd_(new Date(o.deliveredAt.getTime() + settingNum_('revisionDays', 30) * 86400000)) : '',
    deleted: !!o.deletedState,
    allow: {
      upload: !o.deletedState && ['cancelled', 'completed'].indexOf(o.status) < 0,
      deleteFiles: !o.deletedState && ['draft', 'quote_requested', 'pending_payment', 'needs_materials'].indexOf(o.status) >= 0,
      pay: due > 0 && ['cancelled'].indexOf(o.status) < 0,
      revision: ['delivered', 'completed'].indexOf(o.status) >= 0 && revisionOpen_(o),
      cancel: ['draft', 'quote_requested', 'pending_payment'].indexOf(o.status) >= 0,
      deletion: !o.deletedState,
    },
  };
  if (opts.admin) {
    view.contact = { name: o.name, email: o.email, phone: o.phone };
    view.memo = o.memo;
    view.historyAll = history;
    view.folderUrl = o.folderId ? 'https://drive.google.com/drive/folders/' + o.folderId : '';
    view.paymentsAll = payments.map(function (p) { var v = paymentView_(p); v.ref = p.ref; v.memoAll = p.memo; return v; });
    view.consents = data.consents || {};
    view.missingNow = missingMaterials_(o);
    view.messagesAll = msgs;
    view.deletedState = o.deletedState;
    view.workStartedAt = data.workStartedAt || '';
  } else {
    view.contact = { name: maskName_(o.name), email: maskEmail_(o.email), phone: maskPhone_(o.phone) };
  }
  return view;
}

function missingSlots_(o) {
  var data = orderData_(o);
  var files = filesFor_(o.orderNo).filter(function (f) { return f.kind === 'customer'; });
  var links = data.links || [];
  return requiredSlots_(data.input || {}).filter(function (r) {
    if (r.alt) return false;
    return !(files.some(function (f) { return f.slot === r.slot; }) || links.some(function (l) { return l.slot === r.slot && l.url; }));
  }).map(function (r) { return r.slot; });
}

function revisionOpen_(o) {
  if (!o.deliveredAt) return true;
  return daysBetween_(o.deliveredAt, now_()) <= settingNum_('revisionDays', 30);
}

/* ------------------------------------------------------------------ 인증 */
function requireOrder_(req) {
  var o = findOrder_(req.orderNo);
  if (!o) throw appError_('not_found', '주문을 찾을 수 없습니다.');
  if (!verifyOrderToken_(o.orderNo, o.tokenKey, req.token)) throw appError_('forbidden', '주문 조회 권한이 없습니다. 주문번호와 조회 비밀번호로 다시 확인해 주세요.');
  return o;
}

/* ------------------------------------------------------------------ 공개 API */
function api_ping() { return { time: iso_(now_()), version: APP_VERSION }; }

function api_config() {
  var s = settings_();
  var pub = {};
  PUBLIC_SETTING_KEYS.forEach(function (k) { pub[k] = s[k]; });
  return { catalog: catalog_(), settings: pub, serverTime: iso_(now_()), version: APP_VERSION };
}

function api_createOrder(req) {
  if (req.hp) throw appError_('bad_request', '요청을 처리할 수 없습니다.');
  var service = str_(req.service, 20);
  if (!SERVICE_LABEL[service]) throw appError_('bad_request', '서비스를 선택해 주세요.');
  var c = req.contact || {};
  var name = str_(c.name, 40), email = str_(c.email, 120).toLowerCase(), phone = normPhone_(c.phone);
  if (!name) throw appError_('invalid', '이름을 입력해 주세요.');
  if (!isEmail_(email)) throw appError_('invalid', '이메일 주소를 확인해 주세요.');
  if (phone.replace(/-/g, '').length < 9) throw appError_('invalid', '연락처를 확인해 주세요.');
  var pin = String(req.pin || '');
  if (!/^\d{4,8}$/.test(pin)) throw appError_('invalid', '주문 조회 비밀번호는 숫자 4~8자리로 입력해 주세요.');
  var consents = req.consents || {};
  if (!bool_(consents.privacy)) throw appError_('invalid', '개인정보 수집·이용에 동의해 주세요.');
  if (!bool_(consents.ethics)) throw appError_('invalid', '연구윤리 안내를 확인해 주세요.');
  if (!bool_(consents.withdrawal)) throw appError_('invalid', '주문 제작 서비스와 청약철회 제한 안내를 확인해 주세요.');
  rateLimit_('create:' + email, 8, 3600);
  rateLimit_('create:all', 120, 3600);

  var input = normalizeInput_(service, req.input);
  if (service === 'statistics' && input.statistics.hasData === false && input.statistics.noDataPath !== 'survey' && !bool_(consents.simulation)) {
    throw appError_('invalid', '학습용 시뮬레이션은 가상 데이터라는 안내에 동의해야 신청할 수 있습니다.');
  }
  var catalog = catalog_();
  var quote = computeQuote(catalog, quoteInput_(input));
  var design = req.design && typeof req.design === 'object' ? sanitizeDesign_(req.design) : null;

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var o = {
      orderNo: newOrderNo_(), status: 'draft', service: service, productName: quote.mainName || '', summary: summaryOf_(input, quote, design),
      amount: quote.total, payStatus: quote.quoteRequired ? 'quote' : 'unpaid', paidAmount: 0, createdAt: now_(), paidAt: '', eta: '', deliveredAt: '',
      name: name, email: email, phone: phone, tokenKey: randomString_(16), quoteRequired: quote.quoteRequired, priority: !!input.addons.priority,
      folderId: '', memo: '', revisionsUsed: 0, deletedState: '',
    };
    var salt = randomString_(8);
    o.pinHash = salt + '$' + hashPin_(pin, salt);
    setOrderData_(o, {
      input: input, quote: quote, design: design, links: sanitizeLinks_(req.links),
      consents: { privacy: true, ethics: true, withdrawal: true, marketing: bool_(consents.marketing), simulation: bool_(consents.simulation), at: iso_(now_()) },
      clientTotal: Number((req.clientQuote || {}).total || 0),
    });
    orderFolder_(o);
    saveOrder_(o);
    addHistory_(o.orderNo, 'draft', '', 'system', '주문서 작성 시작');
  } finally { lock.releaseLock(); }
  if (Number((req.clientQuote || {}).total || 0) && Number(req.clientQuote.total) !== quote.total) log_('price_mismatch', o.orderNo + ' client=' + req.clientQuote.total + ' server=' + quote.total);
  return { orderNo: o.orderNo, token: makeOrderToken_(o.orderNo, o.tokenKey), quote: quote };
}

function sanitizeLinks_(links) {
  return (links || []).slice(0, 10).map(function (l) { return { slot: str_(l.slot, 20), url: str_(l.url, 500) }; }).filter(function (l) { return /^https?:\/\//i.test(l.url); });
}

function sanitizeDesign_(d) {
  var out = {
    title: str_(d.title, 200), titleSource: str_(d.titleSource, 12), designLabel: str_(d.designLabel, 40), methodLabel: str_(d.methodLabel, 40),
    population: str_(d.population, 60), sampleText: str_(d.sampleText, 200),
    vars: {}, hypotheses: [], titleCandidates: [],
  };
  ['iv', 'dv', 'med', 'mod'].forEach(function (k) { out.vars[k] = ((d.vars || {})[k] || []).slice(0, 6).map(function (v) { return str_(v, 60); }); });
  out.hypotheses = (d.hypotheses || []).slice(0, 10).map(function (h) { return str_(h, 300); });
  out.titleCandidates = (d.titleCandidates || []).slice(0, 5).map(function (h) { return str_(h, 200); });
  return out;
}

function summaryOf_(input, quote, design) {
  var parts = [];
  if (input.service === 'paper') {
    var typeLabel = { master: '석사', doctor: '박사', journal: '학술지', bachelor: '학사', report: '보고서', youth: '청소년 탐구', personal: '개인 연구', short: '소논문' }[input.paper.typeId] || '';
    parts.push(typeLabel);
    parts.push({ full: '전체 초안', edit: '첨삭', feedback: '피드백 반영', proposal: '연구계획서' }[input.paper.task] || '');
    if (input.paper.pages) parts.push(input.paper.pages + '쪽');
  } else if (input.service === 'survey') {
    parts.push({ full: '설문 원스톱', new: '설문지 작성', edit: '설문 점검', feedback: '피드백 반영', analyze: '응답 분석' }[input.survey.mode] || '');
    if (input.survey.recruit === 'us') parts.push('모집 의뢰');
  } else if (input.service === 'statistics') {
    parts.push(input.statistics.hasData === false ? (input.statistics.noDataPath === 'survey' ? '조사부터' : '학습용 시뮬레이션') : ({ table: '맞춤 분석 기본형', interp: '맞춤 분석 표준형', chapter: '연구결과 작성', revise: '재분석' }[input.statistics.output] || ''));
  }
  if (input.common.fieldText) parts.push(input.common.fieldText);
  if (design && design.designLabel) parts.push(design.designLabel);
  if (input.addons.priority) parts.push('우선');
  if (input.addons.ppt) parts.push('발표 PPT');
  if (input.addons.english) parts.push('영문');
  if (input.addons.editing) parts.push('첨삭 추가');
  return parts.filter(String).join(' · ').slice(0, 120);
}

function checkFileBytes_(ext, bytes) {
  var b = function (i) { var v = bytes[i]; return v < 0 ? v + 256 : v; };
  if (bytes.length < 4) return ext === 'txt' || ext === 'csv';
  if (b(0) === 0x4d && b(1) === 0x5a) return false; // 실행 파일(MZ)
  var zip = b(0) === 0x50 && b(1) === 0x4b;
  var ole = b(0) === 0xd0 && b(1) === 0xcf && b(2) === 0x11 && b(3) === 0xe0;
  switch (ext) {
    case 'pdf': return b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46;
    case 'docx': case 'xlsx': case 'pptx': case 'hwpx': case 'zip': return zip;
    case 'doc': case 'xls': case 'ppt': case 'hwp': return ole || (ext === 'hwp' && zip);
    case 'png': return b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47;
    case 'jpg': case 'jpeg': return b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff;
    case 'sav': return b(0) === 0x24 && b(1) === 0x46 && b(2) === 0x4c;
    case 'spv': return zip;
    case 'rtf': return b(0) === 0x7b && b(1) === 0x5c;
    case 'txt': case 'csv': case 'sps':
      for (var i = 0; i < Math.min(bytes.length, 2048); i++) if (bytes[i] === 0) return false;
      return true;
  }
  return false;
}

function storeFile_(o, kind, slot, name, mime, base64, uploader) {
  name = str_(name, 150).replace(/[\\/:*?"<>|]/g, '_');
  var ext = (name.split('.').pop() || '').toLowerCase();
  var allowed = kind === 'result' ? FILE_RULES.result : slot === 'data' ? FILE_RULES.data : FILE_RULES.common.concat(slot === 'prevResult' ? ['spv', 'sav', 'sps'] : []);
  if (allowed.indexOf(ext) < 0) throw appError_('file_type', '허용되지 않는 파일 형식입니다: .' + ext);
  var bytes;
  try { bytes = Utilities.base64Decode(String(base64 || '')); } catch (e) { throw appError_('file_corrupt', '파일을 읽지 못했습니다. 다시 올려 주세요.'); }
  var maxBytes = settingNum_('maxFileMB', 20) * 1024 * 1024;
  if (!bytes.length) throw appError_('file_empty', '빈 파일은 올릴 수 없습니다.');
  if (bytes.length > maxBytes) throw appError_('file_size', '파일 용량이 ' + settingNum_('maxFileMB', 20) + 'MB를 넘습니다.');
  if (!checkFileBytes_(ext, bytes)) throw appError_('file_content', '파일 내용이 확장자(.' + ext + ')와 맞지 않거나 손상되었습니다.');
  var count = filesFor_(o.orderNo).length;
  if (count >= MAX_FILES_PER_ORDER) throw appError_('file_count', '한 주문에 올릴 수 있는 파일 수를 넘었습니다.');
  var blob = Utilities.newBlob(bytes, mime || 'application/octet-stream', name);
  var folder = subFolder_(o, kind);
  var file = folder.createFile(blob);
  file.setDescription(o.orderNo + ' / ' + (SLOT_LABEL[slot] || slot));
  addFile_({ id: file.getId(), orderNo: o.orderNo, kind: kind, slot: slot, name: name, size: bytes.length, mime: blob.getContentType(), uploader: uploader });
  if (!o.folderId) saveOrder_(o);
  return { id: file.getId(), name: name, size: bytes.length, slot: slot };
}

function api_uploadFile(req) {
  var o = requireOrder_(req);
  if (o.deletedState) throw appError_('forbidden', '삭제 처리된 주문입니다.');
  if (['cancelled', 'completed'].indexOf(o.status) >= 0) throw appError_('forbidden', '종료된 주문에는 파일을 올릴 수 없습니다.');
  rateLimit_('upload:' + o.orderNo, 60, 3600);
  var slot = SLOT_LABEL[req.slot] ? req.slot : 'other';
  var f = storeFile_(o, 'customer', slot, req.name, req.mime, req.data, 'customer');
  if (o.status !== 'draft') {
    addHistory_(o.orderNo, '', '', 'customer', '자료 추가: ' + f.name);
    notifyOperatorDebounced_(o, '자료 추가', SLOT_LABEL[slot] + ' · ' + f.name);
  }
  return { file: f };
}

function api_deleteFile(req) {
  var o = requireOrder_(req);
  if (['draft', 'quote_requested', 'pending_payment', 'needs_materials'].indexOf(o.status) < 0) throw appError_('forbidden', '작업이 시작된 뒤에는 파일을 직접 삭제할 수 없습니다. 메시지로 요청해 주세요.');
  var f = filesFor_(o.orderNo).filter(function (x) { return x.id === String(req.fileId) && x.kind === 'customer'; })[0];
  if (!f) throw appError_('not_found', '파일을 찾을 수 없습니다.');
  driveDeleteForever_(f.id);
  setFileState_(f, 'deleted');
  return { deleted: f.id };
}

function api_submitOrder(req) {
  var o = requireOrder_(req);
  if (o.status !== 'draft') return { order: orderView_(o) };
  var data = orderData_(o);
  if (req.links) { data.links = sanitizeLinks_(req.links); setOrderData_(o, data); }
  var missing = missingMaterials_(o);
  if (missing.length) throw appError_('missing_files', '필수 자료가 빠졌습니다: ' + missing.join(', '), { missing: missing });
  var q = data.quote || {};
  if (q.quoteRequired) {
    o.status = 'quote_requested';
    addHistory_(o.orderNo, 'quote_requested', '주문이 접수되었습니다. 자료를 확인한 뒤 확정 견적을 안내드립니다.', 'system');
  } else {
    o.status = 'pending_payment';
    addPayment_({ orderNo: o.orderNo, kind: 'main', amount: q.total, status: 'requested', memo: q.mainName || '' });
    addHistory_(o.orderNo, 'pending_payment', '주문서가 접수되었습니다. 결제가 확인되면 작업 순서에 배정됩니다.', 'system');
  }
  saveOrder_(o);
  mailCustomer_(o, 'received');
  notifyOperator_(o, q.quoteRequired ? '견적 요청' : '신규 주문', o.summary);
  return { order: orderView_(o) };
}

function api_getOrder(req) {
  var o = requireOrder_(req);
  return { order: orderView_(o) };
}

function api_lookupOrder(req) {
  var orderNo = str_(req.orderNo, 30).toUpperCase();
  rateLimit_('lookup:' + orderNo, 6, 900);
  var o = findOrder_(orderNo);
  var contact = str_(req.contact, 120).toLowerCase();
  var ok = false;
  if (o && !o.deletedState) {
    var phoneMatch = contact.replace(/[^0-9]/g, '') && contact.replace(/[^0-9]/g, '') === o.phone.replace(/[^0-9]/g, '');
    var emailMatch = contact === o.email.toLowerCase();
    var parts = o.pinHash.split('$');
    ok = (phoneMatch || emailMatch) && parts.length === 2 && safeEq_(parts[1], hashPin_(String(req.pin || ''), parts[0]));
  }
  if (!ok) throw appError_('lookup_failed', '주문번호, 연락처, 조회 비밀번호를 다시 확인해 주세요.');
  rateReset_('lookup:' + orderNo);
  return { orderNo: o.orderNo, token: makeOrderToken_(o.orderNo, o.tokenKey) };
}

function api_sendAccessLink(req) {
  var email = str_(req.email, 120).toLowerCase();
  if (!isEmail_(email)) throw appError_('invalid', '이메일 주소를 확인해 주세요.');
  rateLimit_('access:' + email, 3, 3600);
  var mine = allOrders_().filter(function (o) { return o.email.toLowerCase() === email && !o.deletedState && o.status !== 'draft'; }).slice(-10);
  if (mine.length) mailAccessLinks_(email, mine);
  return { sent: true };
}

function api_downloadFile(req) {
  var o = findOrder_(req.orderNo);
  if (!o) throw appError_('not_found', '주문을 찾을 수 없습니다.');
  if (!verifyFileTicket_(o.orderNo, String(req.fileId), req.ticket)) throw appError_('forbidden', '내려받기 권한이 만료되었습니다. 주문 페이지를 새로 고침해 주세요.');
  var f = filesFor_(o.orderNo).filter(function (x) { return x.id === String(req.fileId); })[0];
  if (!f) throw appError_('not_found', '파일이 삭제되었거나 보관 기간이 지났습니다.');
  // 결과물은 전달 완료로 공개된 것만 내려받을 수 있다
  if (f.kind === 'result' && !isPublishedResult_(o, f)) throw appError_('forbidden', '아직 전달되지 않은 파일입니다.');
  var blob = DriveApp.getFileById(f.id).getBlob();
  return { name: f.name, mime: f.mime || blob.getContentType(), size: f.size, data: Utilities.base64Encode(blob.getBytes()) };
}

function api_claimPayment(req) {
  var o = requireOrder_(req);
  var method = req.method === 'bank' ? 'bank' : 'skkc';
  var ps = paymentsFor_(o.orderNo).filter(function (p) { return p.status === 'requested' && (!req.paymentId || p.id === req.paymentId); });
  if (!ps.length) throw appError_('no_payment', '결제할 금액이 없습니다.');
  var p = ps[0];
  p.status = 'claimed';
  p.method = method;
  p.ref = str_(req.payerName, 40);
  p.memo = (p.memo ? p.memo + ' / ' : '') + '고객 결제 완료 알림';
  updatePayment_(p);
  var advance = String(setting_('advanceOnClaim') || '').split(/[,\s]+/).indexOf(method) >= 0;
  if (p.kind === 'main' && advance && ['pending_payment', 'payment_review'].indexOf(o.status) >= 0) {
    o.payStatus = 'claimed';
    startWork_(o, '결제 완료 알림을 받았습니다. 결제 내역은 담당자가 확인합니다.', { claimed: true });
  } else if (p.kind === 'main' && ['pending_payment'].indexOf(o.status) >= 0) {
    o.status = 'payment_review';
    o.payStatus = 'claimed';
    saveOrder_(o);
    addHistory_(o.orderNo, 'payment_review', '결제 확인 중입니다. 확인되는 대로 작업 순서에 배정됩니다.', 'customer');
  } else {
    addHistory_(o.orderNo, '', '', 'customer', '추가 결제 완료 알림: ' + p.amount);
  }
  notifyOperator_(o, '결제 확인 요청', (method === 'bank' ? '무통장입금' : '성균관컨설팅 결제') + ' · ' + won(p.amount) + (p.ref ? ' · 입금자 ' + p.ref : ''));
  return { order: orderView_(findOrder_(o.orderNo)) };
}

function api_confirmToss(req) {
  var o = requireOrder_(req);
  var secret = prop_('TOSS_SECRET_KEY');
  if (!secret || !settingBool_('tossEnabled')) throw appError_('not_available', '카드 결제가 아직 연결되지 않았습니다.');
  var p = paymentsFor_(o.orderNo).filter(function (x) { return x.id === String(req.paymentId) && (x.status === 'requested' || x.status === 'claimed'); })[0];
  if (!p) throw appError_('no_payment', '결제 요청을 찾을 수 없습니다.');
  if (Number(req.amount) !== p.amount) throw appError_('amount_mismatch', '결제 금액이 주문 금액과 다릅니다.');
  var res = UrlFetchApp.fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(secret + ':') },
    payload: JSON.stringify({ paymentKey: String(req.paymentKey), orderId: String(req.tossOrderId), amount: p.amount }),
  });
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) { }
  if (res.getResponseCode() !== 200) {
    log_('toss_fail', o.orderNo + ' ' + res.getResponseCode() + ' ' + (body.code || '') + ' ' + (body.message || ''));
    throw appError_('payment_failed', body.message || '결제 승인에 실패했습니다.');
  }
  p.method = 'toss';
  p.ref = String(req.paymentKey).slice(0, 80);
  if (body.status === 'DONE') {
    confirmPayment_(o, p, 'toss', '카드·간편결제 승인 완료');
  } else {
    p.status = 'claimed';
    p.memo = '가상계좌 입금 대기 (' + (body.status || '') + ')';
    updatePayment_(p);
    addHistory_(o.orderNo, 'payment_review', '가상계좌가 발급되었습니다. 입금이 확인되면 작업 순서에 배정됩니다.', 'system');
    o.status = 'payment_review'; saveOrder_(o);
  }
  return { order: orderView_(findOrder_(o.orderNo)) };
}

function api_addMessage(req) {
  var o = requireOrder_(req);
  var type = ['revision', 'materials_done', 'question'].indexOf(req.type) >= 0 ? req.type : 'question';
  var text = str_(req.text, 4000);
  if (!text && type !== 'materials_done') throw appError_('invalid', '내용을 입력해 주세요.');
  rateLimit_('msg:' + o.orderNo, 20, 3600);
  if (type === 'revision' && ['delivered', 'completed'].indexOf(o.status) < 0) throw appError_('forbidden', '전달 완료 후 수정 요청을 할 수 있습니다.');
  if (type === 'revision' && !revisionOpen_(o)) throw appError_('forbidden', '수정 요청 기간(전달 후 ' + settingNum_('revisionDays', 30) + '일)이 지났습니다. 메시지로 문의해 주세요.');
  addMessage_(o.orderNo, 'customer', type, text || '보완 자료 제출 완료');
  if (type === 'revision') {
    o.revisionsUsed += 1;
    var over = o.revisionsUsed > revisionAllowance_(o);
    o.status = 'revision';
    saveOrder_(o);
    addHistory_(o.orderNo, 'revision', over ? '수정 요청이 접수되었습니다. 포함된 수정 횟수를 넘어 추가 수정 비용이 안내될 수 있습니다.' : '수정 요청이 접수되었습니다. 요청 내용을 반영해 다시 전달드립니다.', 'customer');
    notifyOperator_(o, '수정 요청', text.slice(0, 80) + (over ? ' (포함 횟수 초과)' : ''));
  } else if (type === 'materials_done') {
    if (o.status === 'needs_materials') {
      var missing = missingMaterials_(o);
      if (missing.length) throw appError_('missing_files', '아직 필요한 자료가 있습니다: ' + missing.join(', '));
      o.status = o.paidAmount > 0 || o.payStatus === 'claimed' ? 'checking' : (o.quoteRequired ? 'quote_requested' : 'pending_payment');
      saveOrder_(o);
      addHistory_(o.orderNo, o.status, '보완 자료가 제출되었습니다. 확인 후 이어서 진행합니다.', 'customer');
    }
    notifyOperator_(o, '보완 자료 제출', text.slice(0, 80));
  } else {
    notifyOperator_(o, '고객 문의', text.slice(0, 80));
  }
  return { order: orderView_(findOrder_(o.orderNo)) };
}

function api_cancelOrder(req) {
  var o = requireOrder_(req);
  if (['draft', 'quote_requested', 'pending_payment'].indexOf(o.status) < 0) throw appError_('forbidden', '결제 이후에는 메시지로 취소·환불을 요청해 주세요.');
  var prev = o.status;
  o.status = 'cancelled';
  saveOrder_(o);
  paymentsFor_(o.orderNo).forEach(function (p) { if (p.status === 'requested') { p.status = 'cancelled'; updatePayment_(p); } });
  addHistory_(o.orderNo, 'cancelled', '주문이 취소되었습니다. 올리신 자료는 바로 삭제했습니다.', 'customer');
  if (!o.paidAmount) purgeOrderContent_(o, '결제 전 취소');
  if (prev !== 'draft') notifyOperator_(o, '주문 취소', '고객이 결제 전 주문을 취소했습니다.');
  return { order: orderView_(findOrder_(o.orderNo)) };
}

function api_requestDeletion(req) {
  var o = requireOrder_(req);
  var reason = str_(req.reason, 500);
  var immediate = ['draft', 'quote_requested', 'pending_payment', 'cancelled', 'delivered', 'completed'].indexOf(o.status) >= 0;
  if (immediate) {
    purgeOrderContent_(o, '고객 삭제 요청' + (reason ? ': ' + reason : ''));
    if (['draft', 'quote_requested', 'pending_payment'].indexOf(o.status) >= 0) { o.status = 'cancelled'; saveOrder_(o); }
    addHistory_(o.orderNo, o.status, '요청에 따라 올리신 파일과 연구 자료를 삭제했습니다. 거래 기록은 관련 법령에 따라 보관 후 파기됩니다.', 'customer');
    return { deleted: true, order: orderView_(findOrder_(o.orderNo)) };
  }
  addMessage_(o.orderNo, 'customer', 'deletion', '자료 삭제 요청' + (reason ? ': ' + reason : ''));
  notifyOperator_(o, '자료 삭제 요청', '작업 중인 주문의 자료 삭제 요청입니다. 확인 후 처리해 주세요.');
  return { deleted: false, pending: true, order: orderView_(o) };
}

/* ------------------------------------------------------------------ 작업 시작·결제 확정 */
function computeEta_(o) {
  var q = orderData_(o).quote || {};
  var cap = Math.max(1, settingNum_('dailyCapacity', 3));
  var queue = allOrders_().filter(function (x) { return x.orderNo !== o.orderNo && ['received', 'checking', 'preparing', 'in_progress', 'revision'].indexOf(x.status) >= 0; }).length;
  var delay = Math.floor(queue / cap);
  return etaDate(now_(), Math.max(1, (q.days || 2) + delay), holidays_());
}

// opts.claimed: 고객의 결제 완료 알림만 받은 상태(담당자 확인 전). 고객 안내에 '결제가 확인되었다'고 쓰지 않는다
function startWork_(o, message, opts) {
  opts = opts || {};
  var target = setting_('advanceOnPayment') === 'received' ? 'received' : 'in_progress';
  var missing = missingMaterials_(o);
  o.eta = o.eta || computeEta_(o);
  if (missing.length) {
    o.status = 'needs_materials';
    saveOrder_(o);
    addHistory_(o.orderNo, 'needs_materials', (opts.claimed ? '결제 완료 알림을 받았습니다. ' : '결제가 확인되었습니다. ') + '작업에 필요한 자료가 있어 보완을 부탁드립니다: ' + missing.join(', '), 'system');
    mailCustomer_(o, 'materials', { items: missing });
    return;
  }
  if (target === 'received') {
    o.status = 'received';
    saveOrder_(o);
    addHistory_(o.orderNo, 'received', message || '결제가 확인되어 주문이 접수되었습니다.', 'system');
  } else {
    o.status = 'received';
    addHistory_(o.orderNo, 'received', message || '결제가 확인되어 주문이 접수되었습니다.', 'system');
    o.status = 'in_progress';
    saveOrder_(o);
    var pos = queuePosition_(o);
    addHistory_(o.orderNo, 'in_progress', '작업 순서에 배정되었습니다' + (pos ? '(현재 ' + pos + '번째)' : '') + '. 예상 전달일은 ' + korDate_(o.eta) + '입니다.', 'system');
  }
  mailCustomer_(o, 'started', { claimed: !!opts.claimed });
}

function confirmPayment_(o, p, method, memo) {
  p.status = 'confirmed';
  p.method = method || p.method;
  p.confirmedAt = now_();
  if (memo) p.memo = (p.memo ? p.memo + ' / ' : '') + memo;
  updatePayment_(p);
  o.paidAmount = (o.paidAmount || 0) + p.amount;
  o.paidAt = o.paidAt || now_();
  var stillDue = paymentsFor_(o.orderNo).some(function (x) { return x.status === 'requested' || x.status === 'claimed'; });
  o.payStatus = stillDue ? 'partial' : 'paid';
  if (p.kind === 'main' && ['pending_payment', 'payment_review', 'quote_requested'].indexOf(o.status) >= 0) {
    startWork_(o, '결제가 확인되었습니다.');
  } else {
    saveOrder_(o);
    addHistory_(o.orderNo, '', p.kind === 'extra' ? '추가 결제가 확인되었습니다.' : '결제가 확인되었습니다.', 'system');
  }
  notifyOperator_(o, '결제 확인됨', won(p.amount) + ' · ' + ({ toss: '토스페이먼츠', skkc: '성균관컨설팅', bank: '무통장입금' }[p.method] || p.method));
}

function purgeOrderContent_(o, reason) {
  filesFor_(o.orderNo).forEach(function (f) {
    driveDeleteForever_(f.id);
    setFileState_(f, 'deleted');
  });
  if (o.folderId) driveDeleteForever_(o.folderId, true);
  var data = orderData_(o);
  setOrderData_(o, { quote: data.quote || null, consents: data.consents || null, purged: iso_(now_()), purgeReason: reason });
  o.deletedState = 'content:' + ymd_(now_());
  saveOrder_(o);
  log_('purge', o.orderNo + ' ' + reason);
}


// ===== 30_admin.gs =====
/**
 * 30_admin: 관리자 API
 */

function requireAdmin_(req) {
  if (!verifyAdminToken_(req.adminToken)) throw appError_('admin_required', '관리자 로그인이 필요합니다.');
}

function api_adminLogin(req) {
  rateLimit_('adminlogin', 8, 900);
  var stored = prop_('ADMIN_HASH') || '';
  var parts = stored.split('$');
  if (parts.length !== 2) throw appError_('not_setup', '관리자 비밀번호가 설정되지 않았습니다.');
  if (!safeEq_(parts[1], hashPassword_(String(req.password || ''), parts[0]))) {
    log_('admin_login_fail', '');
    throw appError_('login_failed', '비밀번호가 맞지 않습니다.');
  }
  rateReset_('adminlogin');
  return { adminToken: makeAdminToken_(), expiresIn: 12 * 3600 };
}

function api_adminChangePassword(req) {
  requireAdmin_(req);
  var stored = (prop_('ADMIN_HASH') || '').split('$');
  if (!safeEq_(stored[1], hashPassword_(String(req.current || ''), stored[0]))) throw appError_('login_failed', '현재 비밀번호가 맞지 않습니다.');
  var next = String(req.next || '');
  if (next.length < 10) throw appError_('invalid', '새 비밀번호는 10자 이상으로 정해 주세요.');
  var salt = randomString_(12);
  props_().setProperty('ADMIN_HASH', salt + '$' + hashPassword_(next, salt));
  props_().setProperty('ADMIN_VERSION', String(Number(prop_('ADMIN_VERSION') || 1) + 1));
  log_('admin_password', 'changed');
  return { changed: true, adminToken: makeAdminToken_() };
}

function adminRow_(o) {
  var data = orderData_(o);
  var due = 0, claimed = 0;
  paymentsFor_(o.orderNo).forEach(function (p) { if (p.status === 'requested') due += p.amount; if (p.status === 'claimed') claimed += p.amount; });
  return {
    orderNo: o.orderNo, status: o.status, statusLabel: STATUS[o.status] || o.status, service: o.service, serviceLabel: SERVICE_LABEL[o.service],
    productName: o.productName, summary: o.summary, amount: o.amount, paidAmount: o.paidAmount, payStatus: o.payStatus, due: due, claimed: claimed,
    name: o.name, email: o.email, phone: o.phone, createdAt: iso_(o.createdAt), paidAt: iso_(o.paidAt), eta: o.eta ? ymd_(o.eta) : '',
    deliveredAt: iso_(o.deliveredAt), priority: o.priority, quoteRequired: o.quoteRequired, title: (data.design || {}).title || (data.input && data.input.common ? data.input.common.title : '') || '',
    deleted: !!o.deletedState, workStarted: !!data.workStartedAt,
  };
}

function api_adminDashboard(req) {
  requireAdmin_(req);
  var orders = allOrders_();
  var today = ymd_(now_());
  var c = { quote: 0, payment: 0, materials: 0, working: 0, review: 0, revision: 0, overdue: 0, dueToday: 0, unpaid: 0, delivered30: 0, drafts: 0 };
  var queue = [], claims = [], quotes = [], recent = [];
  var monthKey = Utilities.formatDate(now_(), TZ, 'yyyy-MM');
  var revenue = 0, revenueCount = 0;
  orders.forEach(function (o) {
    if (o.status === 'draft') { c.drafts++; return; }
    var row = null;
    var getRow = function () { return row || (row = adminRow_(o)); };
    if (o.status === 'quote_requested') { c.quote++; quotes.push(getRow()); }
    if (o.status === 'pending_payment') c.unpaid++;
    if (o.status === 'needs_materials') c.materials++;
    if (['received', 'checking', 'preparing', 'in_progress'].indexOf(o.status) >= 0) {
      c.working++;
      queue.push(getRow());
      if (o.eta && ymd_(o.eta) < today) c.overdue++;
      if (o.eta && ymd_(o.eta) === today) c.dueToday++;
    }
    if (o.status === 'review') { c.review++; queue.push(getRow()); }
    if (o.status === 'revision') { c.revision++; queue.push(getRow()); }
    if (o.status === 'delivered' && o.deliveredAt && daysBetween_(o.deliveredAt, now_()) <= 30) c.delivered30++;
  });
  rows_('payments').forEach(function (r, i) {
    var p = paymentFromRow_(r, i + 2);
    if (p.status === 'claimed') {
      var o = findOrder_(p.orderNo);
      if (o) { var v = adminRow_(o); v.paymentId = p.id; v.claimAmount = p.amount; v.claimMethod = p.method; v.claimRef = p.ref; v.claimAt = iso_(p.at); v.claimKind = p.kind; claims.push(v); }
    }
    if (p.status === 'confirmed' && p.confirmedAt && Utilities.formatDate(p.confirmedAt, TZ, 'yyyy-MM') === monthKey) { revenue += p.amount; revenueCount++; }
  });
  c.payment = claims.length;
  queue.sort(function (a, b) { return (a.priority === b.priority ? 0 : a.priority ? -1 : 1) || String(a.eta || '9').localeCompare(String(b.eta || '9')); });
  var unread = [];
  rows_('messages').forEach(function (r) { if (String(r[2]) === 'customer' && String(r[5]) !== 'Y') unread.push({ orderNo: String(r[0]), at: iso_(r[1]), type: String(r[3]), text: String(r[4]).slice(0, 200) }); });
  recent = orders.filter(function (o) { return o.status !== 'draft'; }).slice(-12).reverse().map(adminRow_);
  return { counts: c, queue: queue, claims: claims, quotes: quotes, unread: unread.slice(-30).reverse(), recent: recent, revenue: { month: revenue, count: revenueCount, monthKey: monthKey }, mailQuota: safeQuota_(), today: today };
}

function safeQuota_() { try { return MailApp.getRemainingDailyQuota(); } catch (e) { return null; } }

function api_adminListOrders(req) {
  requireAdmin_(req);
  var status = str_(req.status, 30);
  var q = str_(req.q, 60).toLowerCase();
  var list = allOrders_().filter(function (o) {
    if (status === 'active') { if (['draft', 'cancelled', 'completed', 'delivered'].indexOf(o.status) >= 0) return false; }
    else if (status === 'all') { if (o.status === 'draft' && !req.includeDrafts) return false; }
    else if (status && o.status !== status) return false;
    else if (!status && o.status === 'draft') return false;
    if (q) {
      var hay = (o.orderNo + ' ' + o.name + ' ' + o.email + ' ' + o.phone + ' ' + o.productName + ' ' + o.summary).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
  list.reverse();
  var offset = Math.max(0, Number(req.offset || 0)), limit = Math.min(200, Math.max(1, Number(req.limit || 50)));
  return { total: list.length, orders: list.slice(offset, offset + limit).map(adminRow_) };
}

function adminOrder_(req) {
  requireAdmin_(req);
  var o = findOrder_(req.orderNo);
  if (!o) throw appError_('not_found', '주문을 찾을 수 없습니다.');
  return o;
}

function api_adminGetOrder(req) {
  var o = adminOrder_(req);
  return { order: orderView_(o, { admin: true }) };
}

var ADMIN_STATUSES = ['quote_requested', 'pending_payment', 'payment_review', 'received', 'checking', 'needs_materials', 'preparing', 'in_progress', 'review', 'delivered', 'revision', 'completed', 'cancelled'];

function api_adminUpdateStatus(req) {
  var o = adminOrder_(req);
  var status = str_(req.status, 30);
  if (ADMIN_STATUSES.indexOf(status) < 0) throw appError_('invalid', '알 수 없는 상태입니다.');
  var msg = str_(req.message, 1500);
  var prev = o.status;
  o.status = status;
  if (req.eta) { var d = toDate_(req.eta + 'T18:00:00+09:00'); if (d) o.eta = d; }
  if (status === 'delivered' && !o.deliveredAt) o.deliveredAt = now_();
  saveOrder_(o);
  addHistory_(o.orderNo, status, msg || defaultStatusMessage_(status, o), 'admin', str_(req.internal, 1500));
  if (status === 'delivered') {
    markMessagesDone_(o.orderNo);
    mailCustomer_(o, 'delivered');
  } else if (req.notify !== false && settingBool_('notifyStatusMail') && prev !== status) {
    mailCustomer_(o, 'status', { message: msg || defaultStatusMessage_(status, o) });
  }
  return { order: orderView_(o, { admin: true }) };
}

function defaultStatusMessage_(status, o) {
  switch (status) {
    case 'received': return '주문이 접수되었습니다.';
    case 'checking': return '올려 주신 자료를 확인하고 있습니다.';
    case 'preparing': return '연구 설계를 확정하고 작업을 준비하고 있습니다.';
    case 'in_progress': return '작성·분석을 진행하고 있습니다.' + (o.eta ? ' 예상 전달일은 ' + korDate_(o.eta) + '입니다.' : '');
    case 'review': return '결과물을 검토하고 있습니다. 검토가 끝나면 바로 전달드립니다.';
    case 'delivered': return '결과물이 전달되었습니다. 주문 페이지에서 내려받으실 수 있습니다.';
    case 'revision': return '수정 요청을 반영하고 있습니다.';
    case 'completed': return '주문이 완료되었습니다. 이용해 주셔서 감사합니다.';
    case 'cancelled': return '주문이 취소되었습니다.';
    case 'needs_materials': return '작업에 필요한 자료 보완을 부탁드립니다.';
    case 'pending_payment': return '결제를 기다리고 있습니다.';
    default: return '';
  }
}

function api_adminSetQuote(req) {
  var o = adminOrder_(req);
  var total = Math.round(Number(req.total || 0));
  if (!(total > 0)) throw appError_('invalid', '견적 금액을 입력해 주세요.');
  var data = orderData_(o);
  var q = data.quote || {};
  q.lines = (req.lines && req.lines.length ? req.lines : [{ name: o.productName || '맞춤 견적', amount: total }]).slice(0, 12).map(function (l) {
    return { code: str_(l.code, 30) || 'QUOTE', name: str_(l.name, 100), qty: 1, unitPrice: Math.round(Number(l.amount || 0)), amount: Math.round(Number(l.amount || 0)), note: str_(l.note, 120) };
  });
  q.total = total;
  q.quoteRequired = false;
  q.payableNow = true;
  q.quotedAt = iso_(now_());
  if (req.days) q.days = Math.max(1, Number(req.days));
  data.quote = q;
  setOrderData_(o, data);
  o.amount = total;
  o.quoteRequired = false;
  o.payStatus = 'unpaid';
  o.status = 'pending_payment';
  if (req.eta) { var d = toDate_(req.eta + 'T18:00:00+09:00'); if (d) o.eta = d; }
  paymentsFor_(o.orderNo).forEach(function (p) { if (p.kind === 'main' && p.status === 'requested') { p.status = 'cancelled'; updatePayment_(p); } });
  addPayment_({ orderNo: o.orderNo, kind: 'main', amount: total, status: 'requested', memo: '확정 견적' });
  saveOrder_(o);
  addHistory_(o.orderNo, 'pending_payment', str_(req.message, 1500) || '확정 견적이 준비되었습니다. 결제가 확인되면 작업 순서에 배정됩니다.', 'admin');
  mailCustomer_(o, 'quote', { message: str_(req.message, 1500) });
  return { order: orderView_(o, { admin: true }) };
}

function api_adminRequestExtra(req) {
  var o = adminOrder_(req);
  var amount = Math.round(Number(req.amount || 0));
  if (!(amount > 0)) throw appError_('invalid', '추가 결제 금액을 입력해 주세요.');
  var reason = str_(req.reason, 300) || '추가 작업';
  addPayment_({ orderNo: o.orderNo, kind: 'extra', amount: amount, status: 'requested', memo: reason });
  addHistory_(o.orderNo, '', '추가 결제 요청: ' + reason + ' (' + won(amount) + ')', 'admin');
  mailCustomer_(o, 'extra', { amount: amount, reason: reason });
  return { order: orderView_(o, { admin: true }) };
}

function api_adminConfirmPayment(req) {
  var o = adminOrder_(req);
  var p = paymentsFor_(o.orderNo).filter(function (x) { return (req.paymentId ? x.id === req.paymentId : true) && (x.status === 'claimed' || x.status === 'requested'); })[0];
  if (!p) throw appError_('no_payment', '확인할 결제가 없습니다.');
  if (req.amount && Number(req.amount) !== p.amount) { p.amount = Math.round(Number(req.amount)); }
  var wasStarted = ['received', 'checking', 'preparing', 'in_progress', 'review', 'needs_materials'].indexOf(o.status) >= 0;
  confirmPayment_(o, p, str_(req.method, 10) || p.method || 'skkc', str_(req.memo, 200) || '관리자 결제 확인');
  if (wasStarted) { var fresh = findOrder_(o.orderNo); if (fresh.payStatus === 'paid') mailCustomer_(fresh, 'paid'); }
  return { order: orderView_(findOrder_(o.orderNo), { admin: true }) };
}

function api_adminRejectClaim(req) {
  var o = adminOrder_(req);
  var p = paymentsFor_(o.orderNo).filter(function (x) { return x.id === String(req.paymentId) && x.status === 'claimed'; })[0];
  if (!p) throw appError_('no_payment', '확인 대기 중인 결제가 없습니다.');
  p.status = 'requested';
  p.memo = (p.memo || '') + ' / 결제 내역 미확인';
  updatePayment_(p);
  if (p.kind === 'main') {
    o.status = 'pending_payment';
    o.payStatus = 'unpaid';
    saveOrder_(o);
  }
  var msg = str_(req.message, 500) || '결제 내역을 확인하지 못했습니다. 결제 화면에서 다시 확인해 주시거나 메시지로 알려 주세요.';
  addHistory_(o.orderNo, p.kind === 'main' ? 'pending_payment' : '', msg, 'admin');
  mailCustomer_(o, 'status', { message: msg });
  return { order: orderView_(o, { admin: true }) };
}

var SIM_PREFIX = '[가상데이터_실제연구결과아님] ';
function isSimulationOrder_(o) {
  var t = (orderData_(o).input || {}).statistics;
  return !!(t && t.hasData === false && t.noDataPath === 'simulation');
}
function resultName_(o, name) {
  name = String(name || '결과물');
  return isSimulationOrder_(o) && name.indexOf(SIM_PREFIX.trim()) < 0 ? SIM_PREFIX + name : name;
}
function markStarted_(o, by) {
  var data = orderData_(o);
  if (data.workStartedAt) return false;
  data.workStartedAt = iso_(now_());
  setOrderData_(o, data);
  saveOrder_(o);
  addHistory_(o.orderNo, '', '', 'admin', '실제 작업 착수 기록(' + by + ')');
  return true;
}

function api_adminMarkStarted(req) {
  var o = adminOrder_(req);
  markStarted_(o, '직접 기록');
  return { order: orderView_(findOrder_(o.orderNo), { admin: true }) };
}

function api_adminUploadResult(req) {
  var o = adminOrder_(req);
  var f = storeFile_(o, 'result', 'result', resultName_(o, req.name), req.mime, req.data, 'admin');
  addHistory_(o.orderNo, '', '', 'admin', '결과물 업로드: ' + f.name);
  markStarted_(findOrder_(o.orderNo), '결과물 업로드');
  return { file: f, order: orderView_(findOrder_(o.orderNo), { admin: true }) };
}

function api_adminSyncResults(req) {
  var o = adminOrder_(req);
  var folder = subFolder_(o, 'result');
  var known = {};
  filesFor_(o.orderNo, true).forEach(function (f) { known[f.id] = true; });
  var added = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var file = it.next();
    if (known[file.getId()]) continue;
    var nm = resultName_(o, file.getName());
    if (nm !== file.getName()) { try { file.setName(nm); } catch (e) { } }
    addFile_({ id: file.getId(), orderNo: o.orderNo, kind: 'result', slot: 'result', name: nm, size: file.getSize(), mime: file.getMimeType(), uploader: 'drive' });
    added.push(file.getName());
  }
  if (!o.folderId) saveOrder_(o);
  return { added: added, order: orderView_(findOrder_(o.orderNo), { admin: true }) };
}

function api_adminDeleteFile(req) {
  var o = adminOrder_(req);
  var f = filesFor_(o.orderNo).filter(function (x) { return x.id === String(req.fileId); })[0];
  if (!f) throw appError_('not_found', '파일을 찾을 수 없습니다.');
  driveDeleteForever_(f.id);
  setFileState_(f, 'deleted');
  return { order: orderView_(o, { admin: true }) };
}

function api_adminDownloadFile(req) {
  var o = adminOrder_(req);
  var f = filesFor_(o.orderNo).filter(function (x) { return x.id === String(req.fileId); })[0];
  if (!f) throw appError_('not_found', '파일을 찾을 수 없습니다.');
  var blob = DriveApp.getFileById(f.id).getBlob();
  return { name: f.name, mime: f.mime || blob.getContentType(), size: f.size, data: Utilities.base64Encode(blob.getBytes()) };
}

function api_adminSetMemo(req) {
  var o = adminOrder_(req);
  o.memo = str_(req.memo, 3000);
  saveOrder_(o);
  return { saved: true };
}

function api_adminSetEta(req) {
  var o = adminOrder_(req);
  var d = toDate_(str_(req.eta, 10) + 'T18:00:00+09:00');
  if (!d) throw appError_('invalid', '날짜를 확인해 주세요.');
  o.eta = d;
  saveOrder_(o);
  addHistory_(o.orderNo, '', str_(req.message, 500) || ('예상 전달일이 ' + korDate_(d) + '로 조정되었습니다.'), 'admin');
  if (req.notify) mailCustomer_(o, 'status', { message: '예상 전달일이 ' + korDate_(d) + '로 조정되었습니다.' });
  return { order: orderView_(o, { admin: true }) };
}

function api_adminSendMessage(req) {
  var o = adminOrder_(req);
  var text = str_(req.text, 4000);
  if (!text) throw appError_('invalid', '메시지를 입력해 주세요.');
  addMessage_(o.orderNo, 'admin', 'reply', text);
  markMessagesDone_(o.orderNo);
  mailCustomer_(o, 'message', { message: text });
  return { order: orderView_(o, { admin: true }) };
}

function api_adminRequestMaterials(req) {
  var o = adminOrder_(req);
  var items = (req.items || []).slice(0, 10).map(function (s) { return str_(s, 200); }).filter(String);
  var msg = str_(req.message, 1500);
  if (!items.length && !msg) throw appError_('invalid', '요청할 자료를 적어 주세요.');
  o.status = 'needs_materials';
  saveOrder_(o);
  addHistory_(o.orderNo, 'needs_materials', '자료 보완 요청: ' + (items.length ? items.join(', ') : '') + (msg ? (items.length ? ' / ' : '') + msg : ''), 'admin');
  addMessage_(o.orderNo, 'admin', 'materials', (items.length ? '필요 자료: ' + items.join(', ') + '\n' : '') + msg);
  mailCustomer_(o, 'materials', { items: items, message: msg });
  return { order: orderView_(o, { admin: true }) };
}

function api_adminPurgeOrder(req) {
  var o = adminOrder_(req);
  purgeOrderContent_(o, '관리자 삭제: ' + str_(req.reason, 300));
  addHistory_(o.orderNo, '', '', 'admin', '자료 삭제 처리');
  return { order: orderView_(findOrder_(o.orderNo), { admin: true }) };
}

function api_adminGetSettings(req) {
  requireAdmin_(req);
  var s = settings_();
  var out = [];
  for (var k in DEFAULT_SETTINGS) out.push({ key: k, value: s[k], label: DEFAULT_SETTINGS[k][1] });
  return { settings: out, secrets: { tossSecretKey: prop_('TOSS_SECRET_KEY') ? 'set' : '' }, spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + prop_('SPREADSHEET_ID'), folderUrl: 'https://drive.google.com/drive/folders/' + prop_('ROOT_FOLDER_ID'), version: APP_VERSION, webAppUrl: safeServiceUrl_() };
}

function safeServiceUrl_() { try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; } }

function api_adminSaveSettings(req) {
  requireAdmin_(req);
  var s = req.settings || {};
  if (s.skkcLinks) { try { JSON.parse(s.skkcLinks); } catch (e) { throw appError_('invalid', '금액별 결제 링크 형식(JSON)을 확인해 주세요.'); } }
  if (s.addonServices) { try { JSON.parse(s.addonServices); } catch (e) { throw appError_('invalid', '후속 서비스 형식(JSON)을 확인해 주세요.'); } }
  saveSettings_(s);
  if (typeof req.tossSecretKey === 'string') {
    if (req.tossSecretKey === '') props_().deleteProperty('TOSS_SECRET_KEY');
    else props_().setProperty('TOSS_SECRET_KEY', clean_(req.tossSecretKey, 200));
  }
  if (s.digestHour !== undefined) installTriggers_();
  log_('settings', Object.keys(s).join(','));
  return api_adminGetSettings(req);
}

function api_adminGetCatalog(req) {
  requireAdmin_(req);
  return { catalog: catalog_() };
}

function api_adminSaveCatalog(req) {
  requireAdmin_(req);
  var c = req.catalog || {};
  var items = (c.items || []).slice(0, 200).map(function (it) {
    var out = { code: str_(it.code, 40).toUpperCase(), service: str_(it.service, 20), name: str_(it.name, 120), price: Math.max(0, Math.round(Number(it.price || 0))), days: Math.max(0, Number(it.days || 0)),
      includes: (it.includes || []).slice(0, 12).map(function (x) { return str_(x, 160); }).filter(String), excludes: (it.excludes || []).slice(0, 8).map(function (x) { return str_(x, 160); }).filter(String), active: it.active !== false };
    if (it.type) out.type = str_(it.type, 20);
    if (it.task) out.task = str_(it.task, 20);
    if (it.baseUnits !== undefined && it.baseUnits !== null && it.baseUnits !== '') { out.baseUnits = Number(it.baseUnits); out.unitLabel = str_(it.unitLabel, 10) || '쪽'; out.unitSize = Math.max(1, Number(it.unitSize || 1)); out.unitPrice = Math.max(0, Math.round(Number(it.unitPrice || 0))); }
    if (it.quoteOnly) out.quoteOnly = true;
    if (it.addon) out.addon = true;
    if (it.payUrl && /^https?:\/\//.test(it.payUrl)) out.payUrl = str_(it.payUrl, 300);
    return out;
  }).filter(function (it) { return it.code && it.name; });
  if (!items.length) throw appError_('invalid', '가격표가 비어 있습니다.');
  writeCatalog_({ items: items });
  log_('catalog', 'saved ' + items.length);
  return { catalog: catalog_() };
}

function api_adminResetCatalog(req) {
  requireAdmin_(req);
  writeCatalog_(DEFAULT_CATALOG);
  return { catalog: catalog_() };
}

function api_adminTestNotify(req) {
  requireAdmin_(req);
  var to = operatorEmails_();
  sendMail_(to.join(','), '[논문AI] 알림 테스트', mailLayout_('알림 테스트', '<p>운영 알림 메일이 정상적으로 도착했습니다.</p>'), true);
  pushNtfy_('논문AI 알림 테스트', '휴대폰 푸시가 정상적으로 도착했습니다.');
  return { sentTo: to, quota: safeQuota_() };
}


// ===== 40_notify.gs =====
/**
 * 40_notify: 메일·푸시 알림
 */

function siteUrl_() { return String(setting_('siteUrl') || '').replace(/\/+$/, ''); }
function orderLink_(o) { return siteUrl_() + '/orders/?o=' + encodeURIComponent(o.orderNo) + '&t=' + encodeURIComponent(makeOrderToken_(o.orderNo, o.tokenKey)); }
function adminLink_(o) { return siteUrl_() + '/admin/#order=' + encodeURIComponent(o.orderNo); }

function mailLayout_(title, body, opts) {
  opts = opts || {};
  var s = settings_();
  var btn = opts.button ? '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr><td style="background:#2346E8;border-radius:10px"><a href="' + escHtml_(opts.button.url) + '" style="display:inline-block;padding:14px 26px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none">' + escHtml_(opts.button.label) + '</a></td></tr></table>' : '';
  var card = opts.card ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #E3E7F0;border-radius:12px;background:#F8F9FC">' + opts.card.map(function (r) {
    return '<tr><td style="padding:10px 16px;color:#6B7487;font-size:13px;width:96px;vertical-align:top">' + escHtml_(r[0]) + '</td><td style="padding:10px 16px 10px 0;color:#0F1B3D;font-size:14px;font-weight:600">' + r[1] + '</td></tr>';
  }).join('') + '</table>' : '';
  return '<!doctype html><html><body style="margin:0;background:#F2F4F8;font-family:-apple-system,BlinkMacSystemFont,\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F8;padding:28px 12px"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E3E7F0">' +
    '<tr><td style="padding:22px 28px;border-bottom:1px solid #EEF1F6"><span style="font-size:19px;font-weight:800;color:#0F1B3D;letter-spacing:-.02em">논문<span style="color:#2346E8">AI</span></span></td></tr>' +
    '<tr><td style="padding:28px 28px 30px"><h1 style="margin:0 0 14px;font-size:21px;line-height:1.4;color:#0F1B3D">' + escHtml_(title) + '</h1>' +
    '<div style="font-size:15px;line-height:1.75;color:#2B3446">' + body + '</div>' + card + btn + '</td></tr>' +
    '<tr><td style="padding:18px 28px;background:#F8F9FC;border-top:1px solid #EEF1F6;color:#8A93A6;font-size:12px;line-height:1.7">' +
    escHtml_(s.siteName || '논문AI') + ' · 운영 ' + escHtml_(s.bizName) + ' · 대표 ' + escHtml_(s.bizCeo) + ' · 사업자등록번호 ' + escHtml_(s.bizNo) + '<br>' + escHtml_(s.bizAddress) + ' · ' + escHtml_(s.bizEmail) +
    (opts.footnote ? '<br>' + escHtml_(opts.footnote) : '') + '</td></tr></table></td></tr></table></body></html>';
}

function sendMail_(to, subject, html, isOperator) {
  if (!to) return false;
  var recipients = String(to).split(/[,;\s]+/).filter(isEmail_);
  if (!recipients.length) return false;
  var quota = safeQuota_();
  var reserve = isOperator ? 1 : 3;
  if (quota !== null && quota < recipients.length + reserve) {
    sheet_('mailq').appendRow([now_(), recipients.join(','), subject, html, 'queued', 0, '']);
    log_('mail_queued', subject + ' → ' + recipients.join(','));
    return false;
  }
  try {
    MailApp.sendEmail({ to: recipients.join(','), subject: subject, htmlBody: html, body: htmlToText_(html), name: setting_('siteName') || '논문AI', replyTo: setting_('replyTo') || undefined });
    return true;
  } catch (e) {
    sheet_('mailq').appendRow([now_(), recipients.join(','), subject, html, 'retry', 1, '']);
    log_('mail_error', subject + ' ' + e.message);
    return false;
  }
}

function htmlToText_(html) {
  return String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|tr|h1|div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
}

function processMailQueue_() {
  var sh = sheet_('mailq');
  var rows = rows_('mailq');
  for (var i = 0; i < rows.length; i++) {
    var st = String(rows[i][4]);
    if (st !== 'queued' && st !== 'retry') continue;
    var quota = safeQuota_();
    if (quota !== null && quota < 4) break;
    try {
      MailApp.sendEmail({ to: String(rows[i][1]), subject: String(rows[i][2]), htmlBody: String(rows[i][3]), body: htmlToText_(rows[i][3]), name: setting_('siteName') || '논문AI', replyTo: setting_('replyTo') || undefined });
      sh.getRange(i + 2, 5, 1, 3).setValues([['sent', Number(rows[i][5] || 0) + 1, now_()]]);
    } catch (e) {
      var tries = Number(rows[i][5] || 0) + 1;
      sh.getRange(i + 2, 5, 1, 3).setValues([[tries >= 5 ? 'failed' : 'retry', tries, now_()]]);
    }
  }
  invalidate_('mailq');
}

function orderCard_(o, extraRows) {
  var rows = [['주문번호', escHtml_(o.orderNo)], ['서비스', escHtml_(o.productName || SERVICE_LABEL[o.service] || '')]];
  if (o.summary) rows.push(['요약', escHtml_(o.summary)]);
  (extraRows || []).forEach(function (r) { rows.push(r); });
  return rows;
}

function mailCustomer_(o, kind, extra) {
  extra = extra || {};
  if (!o.email || o.deletedState) return;
  var link = orderLink_(o);
  var name = escHtml_(o.name || '고객');
  var subject = '', title = '', body = '', card = null, button = { label: '주문 확인하기', url: link };
  var q = orderData_(o).quote || {};
  switch (kind) {
    case 'received':
      if (o.quoteRequired) {
        subject = '[논문AI] 견적 요청이 접수되었습니다 (' + o.orderNo + ')';
        title = '견적 요청이 접수되었습니다';
        body = '<p>' + name + '님, 논문AI에 맡겨 주셔서 감사합니다.</p><p>요청하신 조건과 자료를 확인해 <b>영업일 1일 안에 확정 견적</b>을 안내드립니다. 견적이 확정되기 전에는 결제가 진행되지 않습니다.</p>';
        card = orderCard_(o, [['상태', '견적 확인 중']]);
      } else {
        subject = '[논문AI] 주문서가 접수되었습니다 (' + o.orderNo + ')';
        title = '주문서가 접수되었습니다';
        body = '<p>' + name + '님, 논문AI에 맡겨 주셔서 감사합니다.</p><p>결제가 확인되면 작업 순서에 배정되고, 예상 전달일을 바로 알려 드립니다. 주문 페이지에서 결제와 진행 상황을 확인하실 수 있습니다.</p>';
        card = orderCard_(o, [['결제 금액', '<span style="color:#2346E8">' + won(q.total || o.amount) + '</span>'], ['상태', '결제 대기']]);
        button = { label: '결제하고 작업 시작하기', url: link };
      }
      break;
    case 'quote':
      subject = '[논문AI] 확정 견적이 준비되었습니다 (' + o.orderNo + ')';
      title = '확정 견적이 준비되었습니다';
      body = '<p>' + name + '님, 요청하신 작업의 확정 견적을 안내드립니다.</p>' + (extra.message ? '<p>' + escHtml_(extra.message).replace(/\n/g, '<br>') + '</p>' : '');
      card = orderCard_(o, [['확정 금액', '<span style="color:#2346E8">' + won(q.total || o.amount) + '</span>']].concat(o.eta ? [['예상 전달일', korDate_(o.eta)]] : []));
      button = { label: '견적 확인하고 결제하기', url: link };
      break;
    case 'started':
      if (extra.claimed) {
        // 고객이 '결제를 마쳤어요'만 누른 단계: 담당자 확인 전이므로 결제 확인이라고 쓰지 않는다
        subject = '[논문AI] 작업 순서에 배정되었습니다 (' + o.orderNo + ')';
        title = '작업 순서에 배정되었습니다';
        body = '<p>' + name + '님, 결제 완료 알림을 받아 작업 순서에 배정했습니다. 결제 내역은 담당자가 확인하며, 확인되면 메일로 다시 알려 드립니다.</p><p>진행 단계가 바뀔 때마다 주문 페이지에서 바로 확인하실 수 있습니다.</p>';
      } else {
        subject = '[논문AI] 결제가 확인되어 작업이 시작되었습니다 (' + o.orderNo + ')';
        title = '작업이 시작되었습니다';
        body = '<p>' + name + '님, 결제가 확인되어 작업 순서에 배정되었습니다. 진행 단계가 바뀔 때마다 주문 페이지에서 바로 확인하실 수 있습니다.</p>';
      }
      card = orderCard_(o, [['진행 단계', escHtml_(STATUS[o.status])], ['예상 전달일', '<span style="color:#2346E8">' + (o.eta ? korDate_(o.eta) : '안내 예정') + '</span>']]);
      break;
    case 'paid':
      subject = '[논문AI] 결제가 확인되었습니다 (' + o.orderNo + ')';
      title = '결제가 확인되었습니다';
      body = '<p>' + name + '님, 결제가 정상적으로 확인되었습니다. 작업은 순서대로 진행되고 있습니다.</p>';
      card = orderCard_(o, [['결제 금액', won(o.paidAmount)]]);
      break;
    case 'materials':
      subject = '[논문AI] 자료 보완을 부탁드립니다 (' + o.orderNo + ')';
      title = '자료 보완을 부탁드립니다';
      body = '<p>' + name + '님, 정확한 작업을 위해 아래 자료가 더 필요합니다. 주문 페이지에서 바로 올려 주시면 이어서 진행합니다.</p>' +
        (extra.items && extra.items.length ? '<ul style="padding-left:18px;margin:12px 0">' + extra.items.map(function (i) { return '<li>' + escHtml_(i) + '</li>'; }).join('') + '</ul>' : '') +
        (extra.message ? '<p>' + escHtml_(extra.message).replace(/\n/g, '<br>') + '</p>' : '');
      button = { label: '자료 올리기', url: link };
      break;
    case 'status':
      subject = '[논문AI] 진행 상황 안내: ' + (STATUS[o.status] || '') + ' (' + o.orderNo + ')';
      title = '주문 진행 상황 안내';
      body = '<p>' + name + '님, 주문 진행 단계가 바뀌었습니다. 현재 단계: <b>' + escHtml_(STATUS[o.status] || '') + '</b></p>' + (extra.message ? '<p>' + escHtml_(extra.message).replace(/\n/g, '<br>') + '</p>' : '');
      card = orderCard_(o, o.eta ? [['예상 전달일', korDate_(o.eta)]] : []);
      break;
    case 'delivered':
      var days = settingNum_('retentionDays', 90);
      subject = '[논문AI] 결과물이 전달되었습니다 (' + o.orderNo + ')';
      title = '결과물이 전달되었습니다';
      body = '<p>' + name + '님, 요청하신 결과물을 주문 페이지에 올려 두었습니다. 내용을 확인하시고 수정이 필요하면 주문 페이지에서 바로 요청해 주세요.</p><p style="color:#6B7487;font-size:13px">보안을 위해 파일은 전달일부터 ' + days + '일 동안 보관된 뒤 자동 삭제됩니다.</p>';
      card = orderCard_(o, [['전달일', korDate_(o.deliveredAt || now_())]]);
      button = { label: '결과물 내려받기', url: link };
      break;
    case 'extra':
      subject = '[논문AI] 추가 결제 안내 (' + o.orderNo + ')';
      title = '추가 결제 안내';
      body = '<p>' + name + '님, 아래 사유로 추가 결제를 요청드립니다. 결제가 확인되면 이어서 진행합니다.</p>';
      card = orderCard_(o, [['사유', escHtml_(extra.reason || '')], ['금액', '<span style="color:#2346E8">' + won(extra.amount) + '</span>']]);
      button = { label: '추가 결제하기', url: link };
      break;
    case 'cancelled':
      subject = '[논문AI] 주문이 자동 취소되었습니다 (' + o.orderNo + ')';
      title = '주문이 자동 취소되었습니다';
      body = '<p>' + name + '님, 주문서를 제출하신 뒤 ' + (extra.days || 30) + '일 동안 결제가 진행되지 않아 주문을 자동으로 취소했습니다. 올려 주신 자료도 함께 삭제했습니다.</p><p>다시 맡기시려면 논문AI에서 새로 신청해 주세요. 이미 결제하셨다면 이 메일에 답장으로 알려 주세요.</p>';
      card = orderCard_(o, [['상태', '취소']]);
      button = { label: '새로 신청하기', url: siteUrl_() + '/' };
      break;
    case 'message':
      subject = '[논문AI] 담당자 메시지가 도착했습니다 (' + o.orderNo + ')';
      title = '담당자 메시지';
      body = '<p>' + name + '님, 주문과 관련해 메시지를 남겼습니다.</p><div style="margin:14px 0;padding:14px 16px;background:#F8F9FC;border-radius:10px;border:1px solid #E3E7F0">' + escHtml_(extra.message || '').replace(/\n/g, '<br>') + '</div>';
      break;
    default:
      return;
  }
  sendMail_(o.email, subject, mailLayout_(title, body, { card: card, button: button, footnote: '이 메일에 답장하시면 담당자에게 전달됩니다.' }), false);
}

function mailAccessLinks_(email, orders) {
  var list = orders.map(function (o) {
    return '<tr><td style="padding:10px 0;border-bottom:1px solid #EEF1F6"><a href="' + escHtml_(orderLink_(o)) + '" style="color:#2346E8;font-weight:700;text-decoration:none">' + escHtml_(o.orderNo) + '</a><br><span style="color:#6B7487;font-size:13px">' + escHtml_(o.productName) + ' · ' + escHtml_(STATUS[o.status] || '') + '</span></td></tr>';
  }).join('');
  sendMail_(email, '[논문AI] 주문 조회 링크', mailLayout_('주문 조회 링크', '<p>요청하신 주문 조회 링크입니다. 링크를 누르면 바로 주문 페이지가 열립니다.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + list + '</table>', { footnote: '본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.' }), false);
}

function notifyOperator_(o, event, detail) {
  var amount = o.amount ? won(o.amount) : '';
  var subject = '[논문AI] ' + event + (amount ? ' ' + amount : '') + ' · ' + (o.summary || o.productName || '').slice(0, 40);
  var html = mailLayout_(event, '<p>' + escHtml_(detail || '') + '</p>', {
    card: [['주문번호', escHtml_(o.orderNo)], ['고객', escHtml_(o.name) + ' · ' + escHtml_(o.phone)], ['상품', escHtml_(o.productName)], ['금액', amount || '견적 전'], ['상태', escHtml_(STATUS[o.status] || '')]],
    button: { label: '관리자 화면에서 보기', url: adminLink_(o) },
  });
  sendMail_(operatorEmails_().join(','), subject, html, true);
  pushNtfy_('논문AI ' + event, (amount ? amount + ' · ' : '') + (o.summary || o.productName) + ' · ' + o.orderNo, adminLink_(o));
}

function notifyOperatorDebounced_(o, event, detail) {
  var cache = CacheService.getScriptCache();
  var key = 'notify:' + o.orderNo + ':' + event;
  if (cache.get(key)) return;
  cache.put(key, '1', 600);
  notifyOperator_(o, event, detail);
}

function pushNtfy_(title, message, click) {
  var topic = clean_(setting_('ntfyTopic'), 80);
  if (!topic) return;
  try {
    UrlFetchApp.fetch('https://ntfy.sh/', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ topic: topic, title: title, message: message, priority: 4, tags: ['memo'], click: click || siteUrl_() + '/admin/' }),
    });
  } catch (e) { log_('ntfy_error', e.message); }
}


// ===== 50_jobs.gs =====
/**
 * 50_jobs: 최초 설정, 예약 작업(일일 브리핑·정리), 보관 기간 관리
 */

function ensureSheets_(ss) {
  var defs = [
    ['orders', ORDER_COLS], ['history', HISTORY_COLS], ['files', FILE_COLS], ['payments', PAYMENT_COLS], ['messages', MESSAGE_COLS],
    ['settings', SETTING_COLS], ['catalog', CATALOG_COLS], ['logs', LOG_COLS], ['mailq', MAILQ_COLS],
  ];
  defs.forEach(function (d, i) {
    var name = SHEETS[d[0]];
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name, i);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, d[1].length).setValues([d[1]]).setFontWeight('bold').setBackground('#EEF2FF');
      sh.setFrozenRows(1);
    }
  });
  ['Sheet1', '시트1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
}

function seedSettings_() {
  var existing = {};
  rows_('settings').forEach(function (r) { existing[String(r[0])] = true; });
  var sh = sheet_('settings');
  var add = [];
  for (var k in DEFAULT_SETTINGS) {
    if (existing[k]) continue;
    var v = DEFAULT_SETTINGS[k][0];
    if (k === 'operatorEmails' && !v) { try { v = Session.getEffectiveUser().getEmail() || ''; } catch (e) { v = ''; } }
    add.push([k, v, DEFAULT_SETTINGS[k][1]]);
  }
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 3).setValues(add);
  invalidate_('settings');
  __settings = null;
}

function generatePassword_() {
  var a = randomString_(4, 'abcdefghjkmnpqrstuvwxyz23456789');
  var b = randomString_(4, 'abcdefghjkmnpqrstuvwxyz23456789');
  var c = randomString_(4, 'abcdefghjkmnpqrstuvwxyz23456789');
  return a + '-' + b + '-' + c;
}

function setup() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var p = props_();
    var created = [];
    var ss = null;
    var ssId = p.getProperty('SPREADSHEET_ID');
    if (ssId) { try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; } }
    if (!ss) { ss = SpreadsheetApp.create('논문AI 운영 시트'); p.setProperty('SPREADSHEET_ID', ss.getId()); created.push('운영 시트'); }
    __ss = ss;
    invalidate_();
    ensureSheets_(ss);
    var root = null;
    var rootId = p.getProperty('ROOT_FOLDER_ID');
    if (rootId) { try { root = DriveApp.getFolderById(rootId); } catch (e) { root = null; } }
    if (!root) {
      root = DriveApp.createFolder('논문AI 주문 자료');
      p.setProperty('ROOT_FOLDER_ID', root.getId());
      created.push('자료 폴더');
      try { DriveApp.getFileById(ss.getId()).moveTo(root); } catch (e) { }
    }
    if (!p.getProperty('HMAC_SECRET')) p.setProperty('HMAC_SECRET', randomString_(48, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'));
    var password = null;
    if (!p.getProperty('ADMIN_HASH')) {
      password = generatePassword_();
      var salt = randomString_(12);
      p.setProperty('ADMIN_HASH', salt + '$' + hashPassword_(password, salt));
      p.setProperty('ADMIN_VERSION', '1');
      created.push('관리자 비밀번호');
    }
    seedSettings_();
    if (!catalogFromSheet_()) { writeCatalog_(DEFAULT_CATALOG); created.push('가격표'); }
    installTriggers_();
    if (password) {
      var to = operatorEmails_();
      var html = mailLayout_('논문AI 관리자 설정이 완료되었습니다', '<p>서버 초기 설정이 끝났습니다. 아래 비밀번호로 관리자 화면에 로그인한 뒤, 설정 메뉴에서 원하는 비밀번호로 바꿔 주세요.</p>', {
        card: [['관리자 비밀번호', '<span style="font-family:monospace;font-size:16px">' + escHtml_(password) + '</span>'], ['운영 시트', '<a href="' + ss.getUrl() + '">열기</a>'], ['자료 폴더', '<a href="' + root.getUrl() + '">열기</a>']],
        button: { label: '관리자 화면 열기', url: siteUrl_() + '/admin/' },
      });
      try { MailApp.sendEmail({ to: to.join(','), subject: '[논문AI] 관리자 설정 완료 및 비밀번호 안내', htmlBody: html, body: htmlToText_(html), name: '논문AI' }); } catch (e) { log_('setup_mail', e.message); }
    }
    log_('setup', '완료: ' + (created.join(', ') || '변경 없음'));
    return { created: created, spreadsheetUrl: ss.getUrl(), folderUrl: root.getUrl(), passwordMailed: !!password, password: password };
  } finally { lock.releaseLock(); }
}

/* 편집기에서 직접 실행: 가격표의 상품명·포함·제외 문구를 기본 가격표에 맞추고, 새로 생긴 기본 상품은 뒤에 더한다
   (이미 있는 상품의 가격, 결제 링크, 사용 여부는 그대로 둠) */
function syncCatalogText() {
  var cur = catalogFromSheet_();
  if (!cur) { writeCatalog_(DEFAULT_CATALOG); log_('catalog', 'created from default'); return { created: true }; }
  var def = {};
  DEFAULT_CATALOG.items.forEach(function (it) { def[it.code] = it; });
  var changed = [], added = [], have = {};
  cur.items.forEach(function (it) {
    have[it.code] = true;
    var d = def[it.code];
    if (!d) return;
    var inc = (d.includes || []).slice(), exc = (d.excludes || []).slice();
    if (it.name !== d.name || it.includes.join('\n') !== inc.join('\n') || it.excludes.join('\n') !== exc.join('\n')) changed.push(it.code);
    it.name = d.name; it.includes = inc; it.excludes = exc;
  });
  DEFAULT_CATALOG.items.forEach(function (d) {
    if (have[d.code]) return;
    cur.items.push(JSON.parse(JSON.stringify(d)));
    added.push(d.code);
  });
  if (changed.length || added.length) writeCatalog_(cur);
  log_('catalog', 'text synced ' + changed.length + (changed.length ? ': ' + changed.join(',') : '') + (added.length ? ' / added: ' + added.join(',') : ''));
  return { changed: changed, added: added };
}

function installTriggers_() {
  var handlers = ['dailyDigest', 'hourlyJob'];
  ScriptApp.getProjectTriggers().forEach(function (t) { if (handlers.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  var hour = Math.max(0, Math.min(23, settingNum_('digestHour', 8)));
  ScriptApp.newTrigger('dailyDigest').timeBased().atHour(hour).everyDays(1).inTimezone(TZ).create();
  ScriptApp.newTrigger('hourlyJob').timeBased().everyHours(1).create();
}

/* ------------------------------------------------------------------ 일일 브리핑 */
function dailyDigest() {
  invalidate_(); __settings = null;
  var d = api_adminDashboard({ adminToken: makeAdminToken_() });
  var c = d.counts;
  var rows = d.queue.slice(0, 25).map(function (o) {
    var late = o.eta && o.eta < d.today;
    return '<tr><td style="padding:8px 6px;border-bottom:1px solid #EEF1F6;font-size:13px;white-space:nowrap">' + (o.priority ? '<b style="color:#E07B12">우선</b> ' : '') + escHtml_(o.orderNo) + '</td>' +
      '<td style="padding:8px 6px;border-bottom:1px solid #EEF1F6;font-size:13px">' + escHtml_(o.summary || o.productName) + '</td>' +
      '<td style="padding:8px 6px;border-bottom:1px solid #EEF1F6;font-size:13px;white-space:nowrap;color:' + (late ? '#D92D20' : '#0F1B3D') + '">' + escHtml_(o.eta || '-') + '</td></tr>';
  }).join('');
  var lines = [
    ['결제 확인', c.payment], ['견적 작성', c.quote], ['자료 보완 대기', c.materials], ['작업 대기·진행', c.working], ['검토', c.review], ['수정 요청', c.revision], ['오늘 마감', c.dueToday], ['지연', c.overdue],
  ].map(function (r) { return '<td style="padding:10px;text-align:center;border:1px solid #EEF1F6"><div style="font-size:12px;color:#6B7487">' + r[0] + '</div><div style="font-size:20px;font-weight:800;color:' + (r[0] === '지연' && r[1] ? '#D92D20' : '#0F1B3D') + '">' + r[1] + '</div></td>'; });
  var todo = c.payment + c.quote + c.working + c.review + c.revision + d.unread.length;
  if (!todo && !c.materials) return;
  var body = '<p>오늘 처리할 주문을 정리했습니다. 관리자 화면의 [오늘의 작업]에서 작업지시문을 바로 복사할 수 있습니다.</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0"><tr>' + lines.slice(0, 4).join('') + '</tr><tr>' + lines.slice(4).join('') + '</tr></table>' +
    (rows ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px"><tr><th align="left" style="font-size:12px;color:#6B7487;padding:6px">주문</th><th align="left" style="font-size:12px;color:#6B7487;padding:6px">내용</th><th align="left" style="font-size:12px;color:#6B7487;padding:6px">예정일</th></tr>' + rows + '</table>' : '') +
    (d.unread.length ? '<p style="margin-top:16px"><b>확인하지 않은 고객 메시지 ' + d.unread.length + '건</b></p>' : '');
  sendMail_(operatorEmails_().join(','), '[논문AI] 오늘의 작업 ' + todo + '건 · ' + Utilities.formatDate(now_(), TZ, 'M/d'), mailLayout_('오늘의 작업 브리핑', body, { button: { label: '관리자 화면 열기', url: siteUrl_() + '/admin/' } }), true);
}

/* ------------------------------------------------------------------ 매시간 작업 */
function hourlyJob() {
  invalidate_(); __settings = null;
  try { processMailQueue_(); } catch (e) { log_('job_mail', e.message); }
  var today = ymd_(now_());
  if (prop_('LAST_MAINT') === today) return;
  props_().setProperty('LAST_MAINT', today);
  try { maintenance_(); } catch (e) { log_('job_maint', e.message); }
}

function maintenance_() {
  var now = now_();
  var draftDays = settingNum_('draftExpireDays', 3), unpaidDays = settingNum_('unpaidExpireDays', 30), keepDays = settingNum_('retentionDays', 90);
  var stats = { drafts: 0, unpaid: 0, purged: 0, anonymized: 0 };
  allOrders_().forEach(function (o) {
    var age = o.createdAt ? daysBetween_(o.createdAt, now) : 0;
    if (o.status === 'draft' && age >= draftDays) {
      // 제출하지 않은 주문서는 계약 전이므로 개인정보까지 지운다
      o.status = 'cancelled'; saveOrder_(o);
      purgeOrderContent_(o, '미제출 주문 자동 정리');
      o = findOrder_(o.orderNo);
      o.name = ''; o.email = ''; o.phone = ''; o.pinHash = ''; o.tokenKey = randomString_(16);
      o.deletedState = (o.deletedState ? o.deletedState + ' ' : '') + 'anon:' + ymd_(now);
      saveOrder_(o);
      stats.drafts++;
      return;
    }
    if ((o.status === 'pending_payment' || o.status === 'quote_requested') && age >= unpaidDays) {
      o.status = 'cancelled'; saveOrder_(o);
      paymentsFor_(o.orderNo).forEach(function (p) { if (p.status === 'requested') { p.status = 'cancelled'; updatePayment_(p); } });
      addHistory_(o.orderNo, 'cancelled', '결제가 진행되지 않아 주문이 자동 취소되었습니다. 올리신 자료는 삭제했습니다.', 'system');
      mailCustomer_(o, 'cancelled', { days: unpaidDays });
      if (!o.paidAmount && o.deletedState.indexOf('content') < 0) purgeOrderContent_(o, '미결제 ' + unpaidDays + '일 자동 취소');
      stats.unpaid++;
      return;
    }
    var endAt = o.deliveredAt || (o.status === 'cancelled' ? o.updatedAt : null);
    if (endAt && ['delivered', 'completed', 'cancelled'].indexOf(o.status) >= 0 && daysBetween_(endAt, now) >= keepDays && o.deletedState.indexOf('content') < 0) {
      purgeOrderContent_(o, '보관 기간(' + keepDays + '일) 만료');
      stats.purged++;
    }
    if (o.createdAt && daysBetween_(o.createdAt, now) >= 1830 && o.deletedState.indexOf('anon') < 0) {
      o.name = maskName_(o.name); o.email = maskEmail_(o.email); o.phone = maskPhone_(o.phone);
      o.deletedState = (o.deletedState ? o.deletedState + ' ' : '') + 'anon:' + ymd_(now);
      saveOrder_(o);
      stats.anonymized++;
    }
  });
  log_('maintenance', JSON.stringify(stats));
  return stats;
}

/* ------------------------------------------------------------------ 토스페이먼츠 웹훅 */
function handleTossWebhook_(body) {
  var secret = prop_('TOSS_SECRET_KEY');
  if (!secret) return { ok: false };
  var orderId = String((body.data && body.data.orderId) || body.orderId || '');
  var m = orderId.match(/^(NA\d{6}-[A-Z0-9]{4})-(PAY-[A-Z0-9]{8})$/);
  if (!m) return { ok: false };
  var res = UrlFetchApp.fetch('https://api.tosspayments.com/v1/payments/orders/' + encodeURIComponent(orderId), { headers: { Authorization: 'Basic ' + Utilities.base64Encode(secret + ':') }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { ok: false };
  var pay = JSON.parse(res.getContentText());
  if (pay.status !== 'DONE') return { ok: true, ignored: pay.status };
  var o = findOrder_(m[1]);
  if (!o) return { ok: false };
  var p = paymentsFor_(o.orderNo).filter(function (x) { return x.id === m[2]; })[0];
  if (!p || p.status === 'confirmed') return { ok: true };
  if (Number(pay.totalAmount) !== p.amount) { log_('toss_amount', orderId); return { ok: false }; }
  confirmPayment_(o, p, 'toss', '가상계좌 입금 확인');
  return { ok: true };
}


// ===== 90_router.gs =====
/**
 * 90_router: 웹 앱 진입점
 */

var ROUTES = {
  ping: api_ping,
  config: api_config,
  createOrder: api_createOrder,
  uploadFile: api_uploadFile,
  deleteFile: api_deleteFile,
  submitOrder: api_submitOrder,
  getOrder: api_getOrder,
  lookupOrder: api_lookupOrder,
  sendAccessLink: api_sendAccessLink,
  downloadFile: api_downloadFile,
  claimPayment: api_claimPayment,
  confirmToss: api_confirmToss,
  addMessage: api_addMessage,
  cancelOrder: api_cancelOrder,
  requestDeletion: api_requestDeletion,
  adminLogin: api_adminLogin,
  adminChangePassword: api_adminChangePassword,
  adminDashboard: api_adminDashboard,
  adminListOrders: api_adminListOrders,
  adminGetOrder: api_adminGetOrder,
  adminUpdateStatus: api_adminUpdateStatus,
  adminSetQuote: api_adminSetQuote,
  adminRequestExtra: api_adminRequestExtra,
  adminConfirmPayment: api_adminConfirmPayment,
  adminRejectClaim: api_adminRejectClaim,
  adminUploadResult: api_adminUploadResult,
  adminSyncResults: api_adminSyncResults,
  adminDeleteFile: api_adminDeleteFile,
  adminDownloadFile: api_adminDownloadFile,
  adminSetMemo: api_adminSetMemo,
  adminSetEta: api_adminSetEta,
  adminSendMessage: api_adminSendMessage,
  adminRequestMaterials: api_adminRequestMaterials,
  adminPurgeOrder: api_adminPurgeOrder,
  adminGetSettings: api_adminGetSettings,
  adminSaveSettings: api_adminSaveSettings,
  adminGetCatalog: api_adminGetCatalog,
  adminSaveCatalog: api_adminSaveCatalog,
  adminResetCatalog: api_adminResetCatalog,
  adminTestNotify: api_adminTestNotify,
  adminMarkStarted: api_adminMarkStarted,
};

var GET_ACTIONS = { ping: true, config: true };

function resetRequestState_() {
  __cache = {};
  __settings = null;
  __ss = null;
}

function dispatch_(req) {
  resetRequestState_();
  var action = String((req && req.action) || '');
  var fn = ROUTES[action];
  if (!fn) return { ok: false, error: 'unknown_action', message: '알 수 없는 요청입니다.' };
  try {
    var result = fn(req) || {};
    result.ok = true;
    return result;
  } catch (err) {
    if (err && err.appCode) return { ok: false, error: err.appCode, message: err.message, extra: err.extra || undefined };
    try { log_('error', action + ': ' + ((err && err.stack) || err)); } catch (e2) { }
    return { ok: false, error: 'server', message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
  }
}

function doPost(e) {
  var req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'bad_json', message: '요청 형식이 올바르지 않습니다.' }); }
  if (!req.action && req.eventType) { resetRequestState_(); return json_(handleTossWebhook_(req)); }
  return json_(dispatch_(req));
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.setup === '1') {
    resetRequestState_();
    if (prop_('SPREADSHEET_ID') && prop_('ADMIN_HASH')) return HtmlService.createHtmlOutput('<meta charset="utf-8"><p style="font-family:sans-serif">논문AI 서버는 이미 설정되어 있습니다.</p>');
    var r = setup();
    return HtmlService.createHtmlOutput('<meta charset="utf-8"><div style="font-family:sans-serif;padding:24px"><h2>논문AI 서버 설정 완료</h2><p>관리자 비밀번호를 운영자 메일로 보냈습니다.</p><p><a href="' + r.spreadsheetUrl + '">운영 시트 열기</a> · <a href="' + r.folderUrl + '">자료 폴더 열기</a></p></div>');
  }
  if (p.action && GET_ACTIONS[p.action]) return json_(dispatch_({ action: p.action }));
  return ContentService.createTextOutput('논문AI API v' + APP_VERSION + ' 정상 작동 중').setMimeType(ContentService.MimeType.TEXT);
}
