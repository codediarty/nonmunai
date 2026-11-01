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
  siteUrl: ['https://nonmunai.com', '사이트 주소(메일 속 링크에 사용)'],
  operatorEmails: ['contact@skkc.co.kr', '새 주문·결제 알림을 받을 메일(쉼표로 여러 개)'],
  replyTo: ['contact@skkc.co.kr', '고객이 메일에 답장하면 받을 주소'],
  ntfyTopic: ['', '휴대폰 푸시(ntfy 앱) 토픽 이름, 비우면 사용 안 함'],
  skkcEnabled: ['true', '성균관컨설팅(skkc.co.kr) 결제 연결 사용'],
  skkcCustomUrl: ['https://skkc.co.kr/pricing', '금액이 맞는 결제 링크가 없을 때 안내할 결제 페이지'],
  skkcLinks: ['[]', '금액별 결제 링크 목록(JSON: [{"amount":399000,"url":"https://skkc.co.kr/shop_view?idx=..."}])'],
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
  addonServices: ['[{"key":"aicheck","name":"AI 유사도 점검(카피클린)","url":"https://www.skkc.co.kr/ai-detector","enabled":true},{"key":"humanize","name":"문장 다듬기(휴머나이징)","url":"https://copyhuman.kr/","enabled":false}]', '전달 후 함께 안내할 후속 서비스(JSON)'],
};

var PUBLIC_SETTING_KEYS = ['siteName', 'siteUrl', 'skkcEnabled', 'skkcCustomUrl', 'skkcLinks', 'bankEnabled', 'bankName', 'bankAccount', 'bankHolder', 'tossEnabled', 'tossClientKey',
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
