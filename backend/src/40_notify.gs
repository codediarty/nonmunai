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
