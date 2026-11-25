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

// replyTo: 이 메일에 답장하면 갈 주소(운영자 알림은 고객 이메일). 없으면 설정의 replyTo.
// 대기열에 쌓을 때는 본문 앞에 <!--nm-reply:주소-->를 붙여 두었다가 보낼 때 떼어 쓴다(시트 열은 그대로)
var REPLY_MARK = /^<!--nm-reply:([^>]*?)-->/;
function sendMail_(to, subject, html, isOperator, replyTo) {
  if (!to) return false;
  var recipients = String(to).split(/[,;\s]+/).filter(isEmail_);
  if (!recipients.length) return false;
  var own = replyTo && isEmail_(String(replyTo)) ? String(replyTo) : '';
  var queued = (own ? '<!--nm-reply:' + own + '-->' : '') + html;
  var quota = safeQuota_();
  var reserve = isOperator ? 1 : 3;
  if (quota !== null && quota < recipients.length + reserve) {
    sheet_('mailq').appendRow([now_(), recipients.join(','), subject, queued, 'queued', 0, '']);
    log_('mail_queued', subject + ' → ' + recipients.join(','));
    return false;
  }
  try {
    MailApp.sendEmail({ to: recipients.join(','), subject: subject, htmlBody: html, body: htmlToText_(html), name: setting_('siteName') || '논문AI', replyTo: own || setting_('replyTo') || undefined });
    return true;
  } catch (e) {
    sheet_('mailq').appendRow([now_(), recipients.join(','), subject, queued, 'retry', 1, '']);
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
    var html = String(rows[i][3]);
    var mark = html.match(REPLY_MARK);
    var own = mark && isEmail_(mark[1]) ? mark[1] : '';
    if (mark) html = html.slice(mark[0].length);
    try {
      MailApp.sendEmail({ to: String(rows[i][1]), subject: String(rows[i][2]), htmlBody: html, body: htmlToText_(html), name: setting_('siteName') || '논문AI', replyTo: own || setting_('replyTo') || undefined });
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

// 고객 안내 메일: 더 알려 줄 내용은 답장으로(답장은 설정의 replyTo, 운영 메일로 간다)
var REPLY_INVITE = '<p style="color:#4A5468;font-size:14px">학교 양식, 교수님 의견처럼 더 알려 주실 내용이 생기면 이 메일에 답장해 주세요. 담당자에게 바로 전달됩니다.</p>';

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
        body = '<p>' + name + '님, 논문AI에 맡겨 주셔서 감사합니다.</p><p>결제가 확인되면 작업 순서에 배정되고, 예상 전달일을 바로 알려 드립니다. 주문 페이지에서 결제와 진행 상황을 확인하실 수 있습니다.</p>' + REPLY_INVITE;
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
        body = '<p>' + name + '님, 결제 완료 알림을 받아 작업 순서에 배정했습니다. 결제 내역은 담당자가 확인하며, 확인되면 메일로 다시 알려 드립니다.</p><p>진행 단계가 바뀔 때마다 주문 페이지에서 바로 확인하실 수 있습니다.</p>' + REPLY_INVITE;
      } else {
        subject = '[논문AI] 결제가 확인되어 작업이 시작되었습니다 (' + o.orderNo + ')';
        title = '작업이 시작되었습니다';
        body = '<p>' + name + '님, 결제가 확인되어 작업 순서에 배정되었습니다. 진행 단계가 바뀔 때마다 주문 페이지에서 바로 확인하실 수 있습니다.</p>' + REPLY_INVITE;
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

// 운영자 메일: 논문을 쓰는 데 필요한 정보(고객 정보, 의뢰 내용, 요청 사항, 주문·결제)를 한 번에 보여 준다(2026-11-24)
var REQUEST_EVENTS = { '신규 주문': 1, '견적 요청': 1, '결제 확인 요청': 1, '결제 확인됨': 1, '오늘 전달 예정': 1 };
var OUT_FMT_LABEL = { docx: '워드(docx)', hwp: '한글(hwp)', pdf: 'PDF' };
var METHOD_LABEL_KO = { survey: '설문·통계', literature: '문헌연구', qualitative: '면담·사례', experiment: '실험·개발' };
var TARGET_LABEL_KO = { auto: '추천 필요', student: '대학생', worker: '직장인', teacher: '교사', parent: '학부모', adult: '성인' };
var PAY_LABEL_KO = { unpaid: '결제 전', quote: '견적 전', claimed: '결제 확인 요청(결제 완료 알림 받음)', partial: '일부 결제', paid: '결제 확인됨' };

function mailSection_(title, rows) {
  if (!rows.length) return '';
  return '<p style="margin:22px 0 8px;font-size:13px;font-weight:800;color:#2346E8;letter-spacing:-.01em">' + escHtml_(title) + '</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E7F0;border-radius:12px;background:#F8F9FC">' +
    rows.map(function (r) {
      return '<tr><td style="padding:9px 14px;color:#6B7487;font-size:13px;width:88px;vertical-align:top;white-space:nowrap">' + escHtml_(r[0]) + '</td>' +
        '<td style="padding:9px 14px 9px 0;color:#0F1B3D;font-size:14px;line-height:1.65">' + r[1] + '</td></tr>';
    }).join('') + '</table>';
}

// 주문 한 건의 고객 정보·의뢰 내용·요청 사항·주문 정보(운영자에게만 보내는 메일용)
function orderDetailHtml_(o) {
  var data = {};
  try { data = orderData_(o) || {}; } catch (e) { data = {}; }
  var i = data.input || {};
  var c = i.common || {};
  var p = i.paper || {};
  var s = i.survey || {};
  var t = i.statistics || {};
  var q = data.quote || {};
  var text = function (v, max) {
    var x = v === undefined || v === null ? '' : String(v).trim();
    if (max && x.length > max) x = x.slice(0, max) + '…';
    return x;
  };
  var put = function (rows, k, v, max, strong) {
    var x = text(v, max);
    if (x) rows.push([k, (strong ? '<b>' : '') + escHtml_(x).replace(/\n/g, '<br>') + (strong ? '</b>' : '')]);
  };
  var who = [];
  put(who, '이름', o.name, 60, true);
  put(who, '이메일', o.email, 120);
  put(who, '연락처', o.phone, 40);
  var job = [];
  put(job, '상품', o.productName, 120, true);
  if (o.service === 'paper' && p.pages) put(job, '분량', p.pages + '쪽(Page)');
  put(job, c.topicKnown === 'free' ? '관심 주제' : '연구 주제', c.title, 400, true);
  put(job, '전공', c.fieldText, 80);
  put(job, '키워드', (c.keywords || []).join(', '), 200);
  put(job, '학교·학과', [c.school, c.dept].filter(function (x) { return !!x; }).join(' '), 120);
  if (METHOD_LABEL_KO[c.method]) put(job, '연구 방법', METHOD_LABEL_KO[c.method]);
  put(job, '받을 파일', OUT_FMT_LABEL[c.outputFormat] || c.outputFormat);
  if (o.eta) put(job, '전달 예정일', korDate_(o.eta));
  if (o.service === 'survey') {
    put(job, '응답 대상', s.target === 'other' ? s.targetOther : (TARGET_LABEL_KO[s.target] || s.target));
    put(job, '목표 응답 수', s.targetN);
  }
  if (o.service === 'statistics') {
    put(job, '변수 설명', t.variables, 1000);
    put(job, '데이터 정보', t.dataInfo, 1000);
  }
  var req = [];
  put(req, '요청 사항', c.request || '(따로 적은 요청 사항 없음)', 3200);
  put(req, '희망 마감일', c.due);
  if (p.task === 'edit') put(req, '첨삭 범위', p.editScope, 300);
  if (p.task === 'feedback') put(req, '교수님 피드백', p.feedbackText, 3000);
  if (o.service === 'survey') put(req, '피드백', s.feedbackText, 3000);
  if (o.service === 'statistics') put(req, '교수님 의견', t.feedbackText, 3000);
  var files = [];
  try { files = filesFor_(o.orderNo).filter(function (f) { return f.kind !== 'result'; }); } catch (e) { files = []; }
  if (files.length) req.push(['고객 자료', files.map(function (f) { return escHtml_((SLOT_LABEL[f.slot] || f.slot || '자료') + ' · ' + f.name); }).join('<br>')]);
  var ord = [];
  put(ord, '주문번호', o.orderNo);
  if (o.amount) put(ord, '금액', won(o.amount));
  put(ord, '결제', PAY_LABEL_KO[o.payStatus] || o.payStatus);
  put(ord, '상태', STATUS[o.status] || o.status);
  if (o.createdAt) put(ord, '접수', Utilities.formatDate(o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt), TZ, 'yyyy-MM-dd HH:mm'));
  if ((q.lines || []).length > 1) ord.push(['견적', (q.lines || []).map(function (l) { return escHtml_(l.name + (l.note ? ' (' + l.note + ')' : '') + ': ' + (l.pending ? '견적' : won(l.amount))); }).join('<br>')]);
  return mailSection_('고객 정보', who) + mailSection_('의뢰 내용', job) + mailSection_('요청 사항', req) + mailSection_('주문·결제', ord);
}

// 고객이 주문 페이지에서 보낸 메시지: 전문을 맨 위에 싣고 주문 정보 전체를 함께 보낸다(2026-11-24)
var MESSAGE_EVENTS = { '고객 문의': 1, '보완 자료 제출': 1, '수정 요청': 1 };

// 운영자 메일의 답장 주소는 고객 이메일: 받은 메일에 바로 답장하면(결과물 첨부 등) 고객에게 간다(2026-11-24)
function notifyOperator_(o, event, detail, opts) {
  opts = opts || {};
  var amount = o.amount ? won(o.amount) : '';
  var msg = !!MESSAGE_EVENTS[event];
  var full = !!REQUEST_EVENTS[event] || msg;
  var reply = o.email && isEmail_(String(o.email)) && !o.deletedState ? String(o.email) : '';
  var subject = full
    ? '[논문AI] ' + event + ' · ' + (o.name || '고객') + ' · ' + String(o.productName || o.summary || '').slice(0, 40) + (amount && !msg ? ' · ' + amount : '')
    : '[논문AI] ' + event + (amount ? ' ' + amount : '') + ' · ' + (o.summary || o.productName || '').slice(0, 40);
  var said = msg && opts.text
    ? '<p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#2346E8">고객이 보낸 내용</p><div style="padding:14px 16px;border-left:3px solid #2346E8;border-radius:8px;background:#F4F6FE;color:#0F1B3D;font-size:15px;line-height:1.75">' + escHtml_(String(opts.text)).replace(/\n/g, '<br>') + '</div>'
    : '<p>' + escHtml_(detail || '') + '</p>';
  var replyNote = reply ? '<p style="margin:0 0 14px;padding:10px 14px;border-radius:10px;background:#F2F4F8;font-size:13px;line-height:1.6;color:#4A5468">이 메일에 답장하면 주문자(' + escHtml_(reply) + ')에게 바로 갑니다. 결과물 파일을 첨부해 답장으로 보내도 됩니다.</p>' : '';
  var html = mailLayout_(event, replyNote + said + (full ? orderDetailHtml_(o) + '<p style="margin-top:18px;font-size:13px;color:#6B7487">연구 설계와 목차 초안이 담긴 작업지시문은 관리자 화면에서 볼 수 있습니다.</p>' : ''), {
    card: full ? null : [['주문번호', escHtml_(o.orderNo)], ['고객', escHtml_(o.name) + ' · ' + escHtml_(o.phone) + (o.email ? ' · ' + escHtml_(o.email) : '')], ['상품', escHtml_(o.productName)], ['금액', amount || '견적 전'], ['상태', escHtml_(STATUS[o.status] || '')]],
    button: { label: '관리자 화면에서 보기', url: adminLink_(o) },
  });
  sendMail_(operatorEmails_().join(','), subject, html, true, reply);
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
