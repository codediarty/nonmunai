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
