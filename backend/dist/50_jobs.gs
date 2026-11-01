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
