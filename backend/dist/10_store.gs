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
