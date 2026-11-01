// 주문 확인과 결제
import { api, loadConfig, myOrders } from './api.js';
import { statusPill, priceSummary, isSimulation, orderFacts, factsTable, orderTitle } from './order-view.js';
import { ICON, note } from './wizard.js';
import { buildDesign } from '../core/engine.js';
import { designReportHtml } from '../ui/report.js';
import { esc, won } from '../core/render.js';
import { $, toast, url, modal, cfg } from '../ui/dom.js';

function tokenFor(no) {
  const p = new URLSearchParams(location.search);
  if (p.get('t')) { myOrders.put(no, { token: p.get('t') }); return p.get('t'); }
  const m = myOrders.get(no);
  return m ? m.token : '';
}

function skkcLink(o, settings, catalog) {
  const due = o.amountDue;
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

function designFor(o) {
  const c = (o.input && o.input.common) || {};
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
  render(root, o, cfg, token);
}

function afterPayHtml(o) {
  if (!['pending_payment', 'quote_requested'].includes(o.status)) return '';
  const quote = o.status === 'quote_requested';
  const steps = (quote ? [['확정 견적 안내', '자료와 조건을 확인해 영업일 1일 안에 확정 금액과 예상 기간을 알려 드립니다.']] : [])
    .concat([
      ['작업 순서 배정', '결제가 확인되는 즉시 작업 순서와 예상 전달일이 정해집니다.'],
      ['진행 상황 공유', '단계가 바뀔 때마다 주문 페이지와 메일로 알려 드립니다. 자료가 더 필요하면 바로 요청드립니다.'],
      ['결과물 전달', '주문 페이지에서 내려받고, 포함된 범위 안에서 수정을 요청할 수 있습니다.'],
    ]);
  return `<div class="card"><div class="card-h"><h2>${quote ? '견적 확정 후 진행' : '결제 후 진행'}</h2></div><ol class="flow-steps">${steps.map(([b, t]) => `<li><b>${esc(b)}</b><span>${esc(t)}</span></li>`).join('')}</ol></div>`;
}

function headNote(o) {
  if (['pending_payment', 'quote_requested'].includes(o.status) && !o.paidAmount) {
    return note(`주문서가 접수되었습니다. 주문 내용은 등록하신 메일(${esc(o.contact.email)})로도 보내 드렸습니다. 이 기기에서는 주문 조회 화면에 바로 표시되고, 다른 기기에서는 주문번호와 조회 비밀번호로 확인할 수 있습니다.`, 'green');
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
    if (methods.includes('skkc')) blocks.push(`<div class="pay-m${methods[0] === 'skkc' ? ' is-main' : ''}"><h3>성균관컨설팅 안전결제</h3><p>운영사 성균관컨설팅의 결제 페이지에서 카드, 간편결제, 계좌이체로 결제합니다. 결제 내역에는 '성균관컨설팅'으로 표시됩니다.</p>
<div class="copy-row"><span class="muted small">주문번호</span><span class="copy-chip">${esc(o.orderNo)}</span><button type="button" class="link-btn" id="copyNo">복사</button></div>
${link.exact ? `<p class="small">결제 페이지에 이 주문 금액(${won(o.amountDue)})의 상품이 열립니다. 주문자 이름은 신청서와 같게 적어 주세요.</p>`
    : link.unit ? `<div class="copy-row"><span class="muted small">수량</span><span class="copy-chip">${link.unit.qty.toLocaleString('ko-KR')}개</span><span class="muted small">(${won(link.unit.price)} × ${link.unit.qty.toLocaleString('ko-KR')} = ${won(o.amountDue)})</span></div><p class="small">결제 페이지에서 수량을 <b>${link.unit.qty.toLocaleString('ko-KR')}개</b>로 바꿔 <b>${won(o.amountDue)}</b>을 결제하고, 요청사항 칸에 주문번호 <b>${esc(o.orderNo)}</b>를 적어 주세요.</p>`
    : link.chat ? `<p class="small">상담 채널에 주문번호 <b>${esc(o.orderNo)}</b>를 남기시면 이 주문 금액(<b>${won(o.amountDue)}</b>)의 결제 링크를 바로 보내 드립니다.</p>`
    : `<p class="small">결제 페이지에서 <b>${won(o.amountDue)}</b>을 결제하고, 요청사항 칸에 주문번호 <b>${esc(o.orderNo)}</b>를 적어 주세요.</p>`}
<div class="copy-row"><a class="btn btn-primary btn-lg" id="skkcGo" href="${esc(link.url)}" target="_blank" rel="noopener">${link.chat ? '결제 링크 받기' : '결제 페이지 열기'}</a><button type="button" class="btn btn-ghost btn-lg" id="skkcDone">결제를 마쳤어요</button></div></div>`);
    if (methods.includes('bank')) blocks.push(`<div class="pay-m"><h3>무통장입금</h3><dl class="bank-box"><dt>은행</dt><dd>${esc(s.bankName)}</dd><dt>계좌</dt><dd>${esc(s.bankAccount)}</dd><dt>예금주</dt><dd>${esc(s.bankHolder)}</dd><dt>금액</dt><dd>${won(o.amountDue)}</dd></dl><div class="field"><label class="label" for="payer">입금자명</label><input class="input" id="payer" placeholder="입금하신 분 이름" autocomplete="name"></div><button type="button" class="btn btn-ghost" id="bankDone">입금했어요</button></div>`);
    payBox = `<div class="card"><div class="card-h"><h2 class="serif">결제</h2><span class="num" style="font-family:var(--serif);font-size:24px;font-weight:700">${won(o.amountDue)}</span></div>
${methods.length ? `<div class="pay-methods">${blocks.join('')}</div><p class="hint" style="margin-top:14px">결제가 확인되면 작업 순서에 배정되고 예상 전달일을 바로 알려 드립니다. 작업이 시작된 뒤에는 진행 단계에 따라 환불이 제한됩니다. <a href="${url('/refund/')}" target="_blank">환불 규정</a></p>` : note('결제 연결을 준비하고 있습니다. 결제 방법이 연결되면 메일로 바로 안내드리며, 그 전에는 결제가 진행되지 않습니다.', 'amber')}</div>`;
  } else {
    payBox = `<div class="card"><div class="card-h"><h2>주문 상태</h2>${statusPill(o)}</div><p>${o.status === 'payment_review' ? '결제 확인을 기다리고 있습니다. 확인되는 대로 작업 순서에 배정됩니다.' : '결제할 금액이 없습니다.'}</p><a class="btn btn-primary" href="${url('/orders/')}?o=${o.orderNo}">주문 페이지로 이동</a></div>`;
  }
  const head = `<div class="card"><div class="ord-head"><div><p class="ord-no">주문번호 ${esc(o.orderNo)}</p><h1 class="ord-title">${esc(title)}</h1>${sub ? `<p class="muted small">${esc(sub)}</p>` : ''}</div>${statusPill(o)}</div>${isSimulation(o) ? '<p><span class="sim-mark">가상 데이터, 실제 연구 결과 아님</span></p>' : ''}
${headNote(o)}</div>`;
  const facts = `<div class="card"><div class="card-h"><h2>주문 내용</h2></div>${factsTable(orderFacts(o))}</div>`;
  const report = d ? `<div class="card"><div class="card-h"><h2>연구 설계 리포트</h2><span class="muted small">작업 준비 단계에서 연구진이 확정합니다</span></div><div class="sheet">${designReportHtml(d)}</div></div>` : '';
  const price = `<div class="card"><div class="card-h"><h2>주문 금액</h2></div>${priceSummary(o)}${(o.quote && o.quote.includes || []).length ? `<h3 class="sub-q">포함</h3><ul class="chk">${o.quote.includes.map((x) => `<li class="ok">${ICON.check}<span>${esc(x)}</span></li>`).join('')}</ul>` : ''}</div>`;
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
  const copy = $('#copyNo', root);
  if (copy) copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(o.orderNo); toast('주문번호를 복사했습니다.'); } catch { toast('복사하지 못했습니다.', { error: true }); } });
  const go = $('#skkcGo', root);
  if (go) go.addEventListener('click', async () => { try { await navigator.clipboard.writeText(o.orderNo); toast('주문번호를 복사했습니다. 결제 페이지 요청사항에 붙여 넣으세요.'); } catch { /* 무시 */ } });
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
      title: '결제를 마치셨나요?', html: `<p>성균관컨설팅 결제 페이지에서 <b>${won(o.amountDue)}</b> 결제를 마쳤다면 아래 버튼을 눌러 주세요. 담당자가 결제 내역을 확인합니다.</p><div class="field"><label class="label" for="pn">결제자 이름</label><input class="input" id="pn" value=""></div><button class="btn btn-primary btn-block" style="margin-top:14px" id="pnOk">결제 완료 알리기</button>`,
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
