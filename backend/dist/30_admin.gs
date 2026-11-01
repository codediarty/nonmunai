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
