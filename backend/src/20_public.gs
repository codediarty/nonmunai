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
    addons: { priority: bool_((raw.addons || {}).priority), format: bool_((raw.addons || {}).format), revisions: Math.min(5, Math.max(0, Number((raw.addons || {}).revisions || 0))) },
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
    var typeLabel = { master: '석사', doctor: '박사', journal: '학술지', bachelor: '학사', report: '보고서', youth: '청소년 탐구', personal: '개인 연구' }[input.paper.typeId] || '';
    parts.push(typeLabel);
    parts.push({ full: '전체 초안', edit: '첨삭', feedback: '피드백 반영', proposal: '연구계획서' }[input.paper.task] || '');
    if (input.paper.pages) parts.push(input.paper.pages + '쪽');
  } else if (input.service === 'survey') {
    parts.push({ full: '처음부터 끝까지', new: '설문지 제작', edit: '설문 수정', feedback: '피드백 반영', analyze: '응답 분석' }[input.survey.mode] || '');
    if (input.survey.recruit === 'us') parts.push('모집 의뢰');
  } else if (input.service === 'statistics') {
    parts.push(input.statistics.hasData === false ? (input.statistics.noDataPath === 'survey' ? '조사부터' : '학습용 시뮬레이션') : ({ table: '통계표', interp: '통계표+해석', chapter: '결과장', revise: '분석 수정' }[input.statistics.output] || ''));
  }
  if (input.common.fieldText) parts.push(input.common.fieldText);
  if (design && design.designLabel) parts.push(design.designLabel);
  if (input.addons.priority) parts.push('우선');
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
