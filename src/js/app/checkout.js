// 주문 확인과 결제
import { api, loadConfig, myOrders } from './api.js';
import { statusPill, priceSummary, isSimulation, orderFacts, factsTable, orderTitle } from './order-view.js';
import { ICON, note } from './wizard.js';
import { buildDesign } from '../core/engine.js';
import { designReportHtml } from '../ui/report.js';
import { esc, won } from '../core/render.js';
import { $, toast, url, modal, cfg } from '../ui/dom.js';
import { cartPlan, productLinks, amountLinks, amountRows, unitLink, unitRows } from './pay-plan.js';
import { includesFor, listPriceFor, offText } from '../core/pricing.js';
import { shopUrl } from './shop-link.js';

function tokenFor(no) {
  const p = new URLSearchParams(location.search);
  if (p.get('t')) { myOrders.put(no, { token: p.get('t') }); return p.get('t'); }
  const m = myOrders.get(no);
  return m ? m.token : '';
}

// 상품 하나로 결제하는 주소는 결제 화면을 바로 여는 주소로 바꾼다(skkc.co.kr 공통 코드가 처리)
// pt: 결제 연결표(6시간). 아임웹 결제 완료 화면이 이 표로 '결제를 마쳤다'는 알림을 이 주문에 보낸다(조회 키는 싣지 않음)
// 1,000원 단위 상품(link.auto)은 수량을 실어 보내고, skkc.co.kr 공통 코드가 상품 페이지에서 수량을 맞춘다(2026-11-27)
function directUrl(o, link, pt) {
  const auto = !!(link.auto && link.cart && link.cart.length === 1 && link.cart[0].qty > 1);
  const single = auto || (link.cart ? link.cart.length === 1 && link.cart[0].qty === 1 : link.exact && !link.unit && !link.chat);
  if (!single || !/^https?:\/\/(www\.)?skkc\.co\.kr\/shop_view/.test(link.url || '')) return '';
  const code = auto ? ((o.quote || {}).mainCode || '') : link.cart ? link.cart[0].code : ((o.quote || {}).mainCode || '');
  return shopUrl(link.url, { kind: 'order', o: o.orderNo, code, price: o.amountDue, list: auto ? 0 : listPriceFor(code, o.amountDue), label: payLabel(o, link), ...(auto ? { qty: link.cart[0].qty, unit: link.cart[0].unitPrice } : {}), ...(pt ? { pt } : {}) });
}
function payTicket(o, token) {
  return api('payTicket', { orderNo: o.orderNo, token }, { retries: 0, timeoutMs: 8000 }).then((r) => (r && r.ticket) || '').catch(() => '');
}
// 결제할 금액의 이름: 추가 결제만 남았으면 '○○ 추가 결제', 아니면 상품 이름
function dueName(o) {
  const ps = (o.payments || []).filter((p) => p.status === 'requested');
  const name = String(o.productName || '논문AI 주문').replace(/^\[논문AI\]\s*/, '');
  return ps.length && ps.every((p) => p.kind === 'extra') ? `${name} 추가 결제` : name;
}
// 금액이 바뀌었거나 추가 결제만 남은 주문(처음 접수가 아님)
function lastChange(o) { return ((o.quote && o.quote.changes) || []).slice(-1)[0] || null; }
const isRepay = (o) => !!lastChange(o) || (o.payments || []).some((p) => p.status === 'requested' && p.kind === 'extra');
function payLabel(o, link) {
  return (link && link.cart && link.cart[0] ? link.cart[0].name : (o.productName || '논문AI 주문')).replace(/^\[논문AI\]\s*/, '');
}

function skkcLink(o, settings, catalog) {
  const due = o.amountDue;
  // 1,000원 단위 결제 상품(있을 때만): 상품 둘 이상·수량이 있는 결제를 상품 하나로 한 번에 결제한다
  const unit = unitRows(due, unitLink(settings), dueName(o));
  const auto = unit ? { url: unit[0].url, exact: true, cart: unit, auto: true } : null;
  // 1) 주문 금액 줄마다 맞는 아임웹 상품(본 상품, 추가 분량, 옵션)
  const cart = cartPlan(o, settings, catalog);
  if (cart && cart.length === 1 && cart[0].qty === 1) return { url: cart[0].url, exact: true, cart };
  if (cart && auto) return auto;
  if (cart) return { url: cart[0].url, exact: false, cart };
  // 2) 남은 금액과 값이 같은 상품(추가 결제 등): 추가 분량 단가 상품을 먼저 본다
  const pl = productLinks(settings);
  if (pl[`X-${due}`]) return { url: pl[`X-${due}`], exact: true };
  // 3) 맞춤 견적 결제 상품(10만~100만 원, 10만 원 단위). 100만 원이 넘으면 100만 원 상품과 나머지를 함께 담는다
  const ar = amountRows(due, amountLinks(settings), dueName(o));
  if (ar && ar.length === 1 && ar[0].qty === 1) return { url: ar[0].url, exact: true, cart: ar };
  if (auto) return auto;
  if (ar) return { url: ar[0].url, exact: false, cart: ar };
  const same = (catalog.items || []).find((i) => i.price === due && (i.payUrl || pl[i.code]));
  if (same) return { url: same.payUrl || pl[same.code], exact: true };
  const item = (catalog.items || []).find((i) => i.code === (o.quote || {}).mainCode);
  if (item && item.payUrl && due === item.price) return { url: item.payUrl, exact: true };
  let links = [];
  try { links = JSON.parse(settings.skkcLinks || '[]'); } catch { links = []; }
  const m = links.find((l) => Number(l.amount) === Number(due));
  if (m) return { url: m.url, exact: true };
  // 금액이 맞는 상품이 없으면 단위 결제 상품(예: 1,000원)을 수량으로 맞춘다
  const unitPrice = Number(settings.skkcUnitPrice) || 1000;
  if (settings.skkcUnitUrl && due > 0 && due % unitPrice === 0) return { url: settings.skkcUnitUrl, exact: false, unit: { price: unitPrice, qty: due / unitPrice } };
  if (settings.skkcCustomUrl) return { url: settings.skkcCustomUrl, exact: false };
  // 결제 링크가 없으면 상담 채널에서 이 주문 금액의 결제 링크를 받는다
  const chat = (cfg().brand || {}).chatUrl;
  return chat ? { url: chat, exact: false, chat: true } : { url: 'https://www.skkc.co.kr', exact: false };
}

// 여러 상품을 함께 담아 한 번에 결제하는 안내
function cartHtml(rows, o) {
  const qtyTxt = (r) => (r.qty > 1 ? `${r.qty}개` : '1개');
  return `<p class="small">아래 상품을 <b>장바구니에 함께 담아 한 번에</b> 결제합니다. 상품마다 수량을 표시된 개수로 맞춰 '장바구니'에 담아 주세요.</p>
<ol class="cart-list">${rows.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a><span class="cart-q">${qtyTxt(r)}</span><b class="num">${won(r.amount)}</b></li>`).join('')}</ol>
<p class="cart-total"><span>합계</span><b class="num">${won(rows.reduce((a, r) => a + r.amount, 0))}</b></p>`;
}

function designFor(o) {
  const c = (o.input && o.input.common) || {};
  if (c.topicKnown === 'free') return null;
  const title = (o.design && o.design.title) || c.title;
  if (o.service !== 'paper' || !(title || (c.keywords || []).length)) return null;
  return buildDesign({ title, keywords: c.keywords || [], typeId: (o.input.paper || {}).typeId || 'master', fieldId: c.fieldId || 'other', fieldText: c.fieldText, method: c.method || 'auto', due: c.due || null });
}

export async function startCheckout(root) {
  const no = (new URLSearchParams(location.search).get('o') || '').toUpperCase();
  const token = tokenFor(no);
  if (!no || !token) {
    root.innerHTML = `<div class="wrap pg-wrap"><div class="card lookup"><h1 class="h-2" style="margin-bottom:10px">주문을 찾을 수 없습니다</h1><p class="muted">주문 조회 화면에서 주문번호와 조회 비밀번호로 다시 열어 주세요.</p><a class="btn btn-primary" href="${url('/orders/')}">주문 조회로 이동</a></div></div>`;
    return;
  }
  const [cfg, res] = await Promise.all([loadConfig(), api('getOrder', { orderNo: no, token }).catch((e) => ({ error: e }))]);
  if (res.error) {
    root.innerHTML = `<div class="wrap pg-wrap"><div class="card lookup"><h1 class="h-2" style="margin-bottom:10px">주문을 불러오지 못했습니다</h1><p class="muted">${esc(res.error.message)}</p><a class="btn btn-primary" href="${url('/orders/')}">주문 조회로 이동</a></div></div>`;
    return;
  }
  const o = res.order;
  const p = new URLSearchParams(location.search);
  if (p.get('toss') === 'ok' && p.get('paymentKey')) {
    root.innerHTML = '<div class="app-loading"><span class="spin spin-dark"></span><span>결제를 승인하고 있습니다</span></div>';
    try {
      const tossOrderId = p.get('orderId') || '';
      const pid = tossOrderId.startsWith(no + '-') ? tossOrderId.slice(no.length + 1) : '';
      await api('confirmToss', { orderNo: no, token, paymentKey: p.get('paymentKey'), tossOrderId, amount: Number(p.get('amount')), paymentId: pid });
      location.replace(`${url('/orders/')}?o=${no}&paid=1`);
    } catch (e) {
      toast(e.message || '결제 승인에 실패했습니다.', { error: true, ms: 6000 });
      render(root, o, cfg, token);
    }
    return;
  }
  if (p.get('toss') === 'fail') toast(p.get('message') || '결제가 완료되지 않았습니다.', { error: true, ms: 5000 });
  // 주문서를 막 낸 경우: 결제할 상품이 하나면 결제 대기 화면 없이 결제 화면으로 바로 잇는다
  if (p.get('pay') === '1') {
    history.replaceState(null, '', `${url('/checkout/')}?o=${encodeURIComponent(o.orderNo)}`);
    const s = cfg.settings || {};
    if (o.amountDue > 0 && o.allow && o.allow.pay && String(s.skkcEnabled) !== 'false' && !(String(s.tossEnabled) === 'true' && s.tossClientKey)) {
      const link = skkcLink(o, s, cfg.catalog || { items: [] });
      if (directUrl(o, link)) { renderHandoff(root, o, link, payTicket(o, token).then((pt) => directUrl(o, link, pt))); return; }
    }
  }
  render(root, o, cfg, token);
}

// 결제 화면으로 넘어가는 화면(잠깐 보여 주고 이동). goP: 결제 화면 주소(결제 연결표를 받는 동안 기다리는 Promise)
function renderHandoff(root, o, link, goP) {
  const item = payLabel(o, link);
  const code = link.cart && link.cart[0] ? link.cart[0].code : ((o.quote || {}).mainCode || '');
  const list = listPriceFor(code, o.amountDue);
  const mail = (o.contact && o.contact.email) || '';
  const again = isRepay(o);
  const ch = lastChange(o);
  root.innerHTML = `<div class="wrap handoff"><div class="handoff-card">
<p class="handoff-ok">${ICON.check}<span>${again ? '결제 안내' : '의뢰 접수 완료'} · 주문번호 ${esc(o.orderNo)}</span></p>
<h1 class="handoff-h">결제 화면을 여는 중이에요</h1>
<div class="handoff-item"><span>${esc(item)}</span><span class="handoff-price">${list ? `<s class="num">${won(list)}</s><em>${offText(list, o.amountDue, { short: true })}</em>` : ch && ch.before && !ch.paid ? `<s class="num">${won(ch.before)}</s>` : ''}<b class="num">${won(o.amountDue)}</b></span></div>
${ch && ch.reason ? `<p class="handoff-why"><b>${ch.paid ? '추가 결제 사유' : ch.quote ? '견적 설명' : '금액이 바뀐 이유'}</b>${esc(ch.reason)}</p>` : ''}
<div class="handoff-bar" aria-hidden="true"><i></i></div>
<ul class="handoff-list"><li>${ICON.check}<span>${again ? '결제가 확인되면 바로 이어서 진행해요.' : '결제가 확인되면 바로 작업을 시작해요.'}</span></li><li>${ICON.check}<span>진행 안내와 결과물은 ${mail ? `<b>${esc(mail)}</b>로` : '메일로'} 보내 드려요.</span></li><li>${ICON.check}<span>결제할 때 주문자 이름과 연락처를 주문서와 같게 적어 주세요.</span></li></ul>
<a class="btn btn-primary btn-lg btn-block" id="handoffGo" href="${esc(directUrl(o, link))}">결제 화면 바로 열기</a>
<a class="handoff-later" href="${url('/checkout/')}?o=${encodeURIComponent(o.orderNo)}">나중에 결제할게요</a>
</div></div>`;
  const btn = root.querySelector('#handoffGo');
  let go = btn.getAttribute('href');
  let stop = false;
  const t0 = Date.now();
  // 결제 연결표는 3초까지만 기다린다(못 받으면 연결표 없이 연다)
  const ready = Promise.race([Promise.resolve(goP).then((h) => { if (h) { go = h; btn.setAttribute('href', h); } }), new Promise((r) => setTimeout(r, 3000))]);
  ready.then(() => { if (!stop) setTimeout(() => { if (!stop) location.href = go; }, Math.max(0, 1800 - (Date.now() - t0))); });
  root.querySelector('.handoff-later').addEventListener('click', () => { stop = true; });
  // 결제 화면에서 뒤로 돌아오면 다시 넘기지 않고 결제 화면을 보여 준다
  window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
}

function afterPayHtml(o) {
  if (!['pending_payment', 'quote_requested'].includes(o.status)) return '';
  const quote = o.status === 'quote_requested';
  const steps = (quote ? [['확정 견적 안내', '자료와 조건을 확인해 영업일 1일 안에 확정 금액과 예상 기간을 알려 드립니다.']] : [])
    .concat([
      ['작업 순서 배정', '결제가 확인되는 즉시 작업 순서와 예상 전달일이 정해집니다.'],
      ['진행 상황 공유', '단계가 바뀔 때마다 주문 페이지와 메일로 알려 드립니다. 자료가 더 필요하면 바로 요청드립니다.'],
      ['완성본 메일 전달', '같은 전공 분야 박사의 최종 검수를 마친 완성본을 메일로 보내 드려요. 주문 페이지에서도 내려받고, 포함된 범위 안에서 수정을 요청할 수 있어요.'],
    ]);
  return `<div class="card"><div class="card-h"><h2>${quote ? '견적 확정 후 진행' : '결제 후 진행'}</h2></div><ol class="flow-steps">${steps.map(([b, t]) => `<li><b>${esc(b)}</b><span>${esc(t)}</span></li>`).join('')}</ol></div>`;
}

function headNote(o) {
  // 금액이 바뀌었으면(관리자 결제 금액 바꾸기) 바뀐 금액과 이유를 맨 먼저 보여 준다
  const ch = lastChange(o);
  if (ch && o.amountDue > 0) return note(`<b>${ch.paid ? `추가 결제 ${won(ch.pay)}을 부탁드려요.` : ch.quote ? `확정 견적은 ${won(ch.pay)}이에요.` : `결제 금액이 ${ch.before ? `${won(ch.before)}에서 ` : ''}${won(ch.pay)}으로 바뀌었어요.`}</b> ${esc(ch.reason || '')}`, 'amber');
  if (['pending_payment', 'quote_requested'].includes(o.status) && !o.paidAmount) {
    return note(`주문서가 접수되었습니다. 주문 내용은 등록하신 메일(${esc(o.contact.email)})로도 보내 드렸습니다. 이 기기에서는 주문 조회 화면에 바로 표시되고, 다른 기기에서는 주문번호와 조회 비밀번호${o.input && o.input.common && o.input.common.topicKnown === 'free' ? '(휴대전화 뒤 4자리)' : ''}로 확인할 수 있습니다.`, 'green');
  }
  const extra = (o.payments || []).filter((p) => p.status === 'requested' && p.kind === 'extra');
  if (extra.length) return note(`추가 결제 요청이 있습니다. ${extra.map((p) => `${esc(p.memo || '추가 작업')} ${won(p.amount)}`).join(', ')}`, 'amber');
  return '';
}

function render(root, o, cfg, token) {
  const s = cfg.settings || {};
  const d = designFor(o);
  const title = orderTitle(o);
  const sub = title === o.productName ? (o.summary || '') : [o.productName, o.summary].filter(Boolean).join(' · ');
  let payBox = '';
  if (o.status === 'quote_requested') {
    payBox = `<div class="card"><div class="card-h"><h2>견적 확인 중</h2>${statusPill(o)}</div><p>요청하신 조건과 자료를 확인해 <b>영업일 1일 안에 확정 견적</b>을 메일과 주문 페이지로 안내드립니다. 확정되지 않은 금액은 결제할 수 없습니다.</p>${(o.quote && o.quote.quoteReasons || []).map((r) => note(esc(r), 'amber')).join('')}<a class="btn btn-ghost" href="${url('/orders/')}?o=${o.orderNo}">주문 페이지에서 진행 상황 보기</a></div>`;
  } else if (o.amountDue > 0 && o.allow.pay) {
    const methods = [];
    if (String(s.tossEnabled) === 'true' && s.tossClientKey) methods.push('toss');
    if (String(s.skkcEnabled) !== 'false') methods.push('skkc');
    if (String(s.bankEnabled) === 'true' && s.bankAccount) methods.push('bank');
    const link = skkcLink(o, s, cfg.catalog || { items: [] });
    const blocks = [];
    if (methods.includes('toss')) blocks.push(`<div class="pay-m is-main"><h3>카드·간편결제</h3><div id="tossMethods"></div><div id="tossAgree"></div><button class="btn btn-primary btn-lg" type="button" id="tossPay">${won(o.amountDue)} 결제하기</button></div>`);
    if (methods.includes('skkc')) {
      const multi = link.cart && link.cart.length > 1;
      const single = link.cart && link.cart.length === 1 ? link.cart[0] : null;
      const what = multi ? cartHtml(link.cart, o)
        : single ? `<p class="pay-what"><span>${esc(single.name.replace(/^\[논문AI\]\s*/, ''))}</span><b class="num">${won(o.amountDue)}</b></p>`
        : link.unit ? `<p class="small">결제 페이지에서 수량을 <b>${link.unit.qty.toLocaleString('ko-KR')}개</b>로 맞추면 <b>${won(o.amountDue)}</b>이 됩니다(${won(link.unit.price)} × ${link.unit.qty.toLocaleString('ko-KR')}).</p>`
        : link.chat ? `<p class="small">상담 채널에 주문번호를 남기시면 이 주문 금액(<b>${won(o.amountDue)}</b>)의 결제 링크를 바로 보내 드립니다.</p>`
        : '';
      const goLabel = link.chat ? '결제 링크 받기' : multi ? '첫 상품 담으러 가기' : `${won(o.amountDue)} 결제하기`;
      blocks.push(`<div class="pay-m${methods[0] === 'skkc' ? ' is-main' : ''}"><h3>안전결제</h3>
<p class="pay-lead">카드, 간편결제, 계좌이체로 결제합니다. 카드 명세서와 영수증에는 운영사 <b>성균관컨설팅</b>으로 표시됩니다.</p>
${what}
<div class="pay-go"><a class="btn btn-primary btn-lg" id="skkcGo" href="${esc(directUrl(o, link) || link.url)}"${directUrl(o, link) ? ' data-direct="1"' : ''}${multi || link.chat ? ' target="_blank" rel="noopener"' : ''}>${goLabel}</a><button type="button" class="btn btn-ghost btn-lg" id="skkcDone">결제를 마쳤어요</button></div>
<ol class="pay-steps"><li>결제 화면에서 결제를 마칩니다. 주문자 이름과 연락처는 주문서와 같게 적어 주세요.</li><li>결제가 확인되면 작업이 시작되고 메일로 알려 드립니다. 이 화면에서 <b>결제를 마쳤어요</b>를 누르면 더 빨리 시작합니다.</li></ol>
<div class="copy-row"><span class="muted small">주문번호</span><span class="copy-chip">${esc(o.orderNo)}</span><button type="button" class="link-btn" id="copyNo">복사</button></div>
<ul class="trust-chips"><li>성균관대학교 RISE사업 지원 기업</li><li>통신판매업 신고 사업자</li><li>전공 분야 박사 검수</li><li>철저한 보안 관리</li><li>전달 후 자료 삭제</li></ul></div>`);
    }
    if (methods.includes('bank')) blocks.push(`<div class="pay-m"><h3>무통장입금</h3><dl class="bank-box"><dt>은행</dt><dd>${esc(s.bankName)}</dd><dt>계좌</dt><dd>${esc(s.bankAccount)}</dd><dt>예금주</dt><dd>${esc(s.bankHolder)}</dd><dt>금액</dt><dd>${won(o.amountDue)}</dd></dl><div class="field"><label class="label" for="payer">입금자명</label><input class="input" id="payer" placeholder="입금하신 분 이름" autocomplete="name"></div><button type="button" class="btn btn-ghost" id="bankDone">입금했어요</button></div>`);
    payBox = `<div class="card"><div class="card-h"><h2 class="serif">결제</h2><span class="num" style="font-family:var(--serif);font-size:24px;font-weight:700">${won(o.amountDue)}</span></div>
${methods.length ? `<div class="pay-methods">${blocks.join('')}</div><p class="hint" style="margin-top:14px">결제가 확인되면 작업 순서에 배정되고 예상 전달일을 바로 알려 드립니다.</p>` : note('결제 연결을 준비하고 있습니다. 결제 방법이 연결되면 메일로 바로 안내드리며, 그 전에는 결제가 진행되지 않습니다.', 'amber')}</div>`;
  } else {
    payBox = `<div class="card"><div class="card-h"><h2>주문 상태</h2>${statusPill(o)}</div><p>${o.status === 'payment_review' ? '결제 확인을 기다리고 있습니다. 확인되는 대로 작업 순서에 배정됩니다.' : '결제할 금액이 없습니다.'}</p><a class="btn btn-primary" href="${url('/orders/')}?o=${o.orderNo}">주문 페이지로 이동</a></div>`;
  }
  const head = `<div class="card"><div class="ord-head"><div><p class="ord-no">주문번호 ${esc(o.orderNo)}</p><h1 class="ord-title">${esc(title)}</h1>${sub ? `<p class="muted small">${esc(sub)}</p>` : ''}</div>${statusPill(o)}</div>${isSimulation(o) ? '<p><span class="sim-mark">가상 데이터, 실제 연구 결과 아님</span></p>' : ''}
${headNote(o)}</div>`;
  const facts = `<div class="card"><div class="card-h"><h2>주문 내용</h2></div>${factsTable(orderFacts(o))}</div>`;
  const report = d ? `<div class="card"><div class="card-h"><h2>연구 설계 리포트</h2><span class="muted small">작업 준비 단계에서 연구진이 확정합니다</span></div><div class="sheet">${designReportHtml(d)}</div></div>` : '';
  const inc = includesFor(o.quote && o.quote.includes, o.input && o.input.paper && o.input.paper.pages);
  const price = `<div class="card"><div class="card-h"><h2>주문 금액</h2></div>${priceSummary(o)}${inc.length ? `<h3 class="sub-q">포함</h3><ul class="chk">${inc.map((x) => `<li class="ok">${ICON.check}<span>${esc(x)}</span></li>`).join('')}</ul>` : ''}</div>`;
  // 좁은 화면에서는 결제 상자를 주문 제목 바로 아래에 둔다
  const narrow = window.matchMedia('(max-width: 1080px)').matches;
  root.innerHTML = narrow
    ? `<div class="wrap pg-wrap"><div class="pg-main">${head}${payBox}${price}${facts}${afterPayHtml(o)}${report}</div></div>`
    : `<div class="wrap pg-wrap"><div class="pg-grid"><div class="pg-main">${head}${facts}${afterPayHtml(o)}${report}</div><aside class="pg-side">${payBox}${price}</aside></div></div>`;
  if (!root._mq) {
    root._mq = window.matchMedia('(max-width: 1080px)');
    root._mq.addEventListener('change', () => { if (!document.querySelector('#tossMethods')) render(root, o, cfg, token); });
  }
  bind(root, o, cfg, token);
}

function bind(root, o, cfg, token) {
  const go = $('#skkcGo', root);
  if (go && go.dataset.direct === '1') {
    const link = skkcLink(o, cfg.settings || {}, cfg.catalog || { items: [] });
    payTicket(o, token).then((pt) => { const h = pt && directUrl(o, link, pt); if (h) go.setAttribute('href', h); });
  }
  const copy = $('#copyNo', root);
  if (copy) copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(o.orderNo); toast('주문번호를 복사했습니다.'); } catch { toast('복사하지 못했습니다.', { error: true }); } });
  const claim = async (method, payerName) => {
    const pay = (o.payments || []).find((p) => p.status === 'requested');
    try {
      await api('claimPayment', { orderNo: o.orderNo, token, method, payerName, paymentId: pay ? pay.id : '' });
      location.href = `${url('/orders/')}?o=${o.orderNo}&paid=1`;
    } catch (e) { toast(e.message, { error: true }); }
  };
  const done = $('#skkcDone', root);
  if (done) done.addEventListener('click', () => {
    modal({
      title: '결제를 마치셨나요?', html: `<p>결제 화면에서 <b>${won(o.amountDue)}</b> 결제를 마쳤다면 아래 버튼을 눌러 주세요. 결제 내역을 확인하는 대로 작업을 시작합니다.</p><div class="field"><label class="label" for="pn">결제자 이름</label><input class="input" id="pn" value="${esc((o.contact && o.contact.name) || '')}"></div><button class="btn btn-primary btn-block" style="margin-top:14px" id="pnOk">결제 완료 알리기</button>`,
      onOpen: (m, close) => { m.querySelector('#pnOk').addEventListener('click', () => { close(); claim('skkc', m.querySelector('#pn').value); }); },
    });
  });
  const bank = $('#bankDone', root);
  if (bank) bank.addEventListener('click', () => { const n = $('#payer', root).value.trim(); if (!n) { toast('입금자명을 적어 주세요.', { error: true }); return; } claim('bank', n); });
  const tossBtn = $('#tossPay', root);
  if (tossBtn) initToss(o, cfg, tossBtn);
}

async function initToss(o, cfg, btn) {
  const s = cfg.settings;
  try {
    if (!window.TossPayments) {
      await new Promise((resolve, reject) => { const sc = document.createElement('script'); sc.src = 'https://js.tosspayments.com/v2/standard'; sc.onload = resolve; sc.onerror = reject; document.head.appendChild(sc); });
    }
    const tp = window.TossPayments(s.tossClientKey);
    const widgets = tp.widgets({ customerKey: window.TossPayments.ANONYMOUS });
    await widgets.setAmount({ currency: 'KRW', value: o.amountDue });
    await widgets.renderPaymentMethods({ selector: '#tossMethods', variantKey: 'DEFAULT' });
    await widgets.renderAgreement({ selector: '#tossAgree', variantKey: 'AGREEMENT' });
    const pay = (o.payments || []).find((p) => p.status === 'requested');
    btn.addEventListener('click', async () => {
      try {
        await widgets.requestPayment({
          orderId: `${o.orderNo}-${pay.id}`, orderName: (o.productName || '논문AI 주문').slice(0, 90),
          successUrl: `${location.origin}${url('/checkout/')}?o=${o.orderNo}&toss=ok`, failUrl: `${location.origin}${url('/checkout/')}?o=${o.orderNo}&toss=fail`,
        });
      } catch (e) { toast(e.message || '결제창을 열지 못했습니다.', { error: true }); }
    });
  } catch {
    btn.closest('.pay-m').innerHTML = '<p class="small muted">카드 결제창을 불러오지 못했습니다. 다른 결제 방법을 이용해 주세요.</p>';
  }
}
