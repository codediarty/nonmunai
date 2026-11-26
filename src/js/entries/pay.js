// 요금 결제(2026-11-26): 안내받은 금액(10만~100만 원)을 고르면 아임웹(성균관컨설팅) '맞춤 견적 결제' 상품 결제 화면을 바로 연다.
// 주문번호를 적으면 결제 완료 화면이 그 주문에 결제 완료를 알린다. 메일·주문 화면에서 ?o=&t=로 오면 주문을 불러와 금액을 미리 고른다.
import { loadConfig, peekConfig, api, myOrders } from '../app/api.js';
import { amountLinks } from '../app/pay-plan.js';
import { shopUrl } from '../app/shop-link.js';
import { isQuoteAmount } from '../core/pricing.js';
import { esc, won } from '../core/render.js';
import { url, cfg, toast } from '../ui/dom.js';

const $ = (s) => document.querySelector(s);
const ORDER_RE = /^NA\d{6}-[A-Z0-9]{4}$/;
const st = { amount: 0, orderNo: '', ticket: '', order: null, links: amountLinks(peekConfig().settings || {}) };

function chatUrl() { return (cfg().brand || {}).chatUrl || 'https://www.skkc.co.kr'; }
function label() { return st.order ? String(st.order.productName || '논문AI 주문').replace(/^\[논문AI\]\s*/, '') + (st.order.paidAmount ? ' 추가 결제' : '') : '맞춤 견적 결제'; }

function href() {
  const link = st.links[st.amount];
  if (!link) return '';
  const no = ORDER_RE.test(st.orderNo) ? st.orderNo : '';
  return shopUrl(link, { kind: 'quote', o: no, code: `Q-${st.amount}`, price: st.amount, label: label(), ...(st.ticket && no ? { pt: st.ticket } : {}) });
}

function render() {
  for (const l of document.querySelectorAll('.pay-amt')) {
    const on = Number(l.querySelector('input').value) === st.amount;
    l.classList.toggle('is-on', on);
    l.querySelector('input').checked = on;
  }
  const go = $('#payGo');
  $('#payTotal').textContent = st.amount ? won(st.amount) : '금액을 골라 주세요';
  $('#payItem').textContent = st.amount ? `[논문AI] 맞춤 견적 결제 (${won(st.amount)})` : '[논문AI] 맞춤 견적 결제';
  const h = st.amount ? href() : '';
  if (h) { go.href = h; go.removeAttribute('aria-disabled'); go.textContent = `${won(st.amount)} 결제하기`; go.classList.remove('is-off'); }
  else if (st.amount) { go.href = chatUrl(); go.removeAttribute('aria-disabled'); go.textContent = '상담 채널에서 결제 링크 받기'; go.classList.remove('is-off'); go.target = '_blank'; }
  else { go.href = '#'; go.setAttribute('aria-disabled', 'true'); go.textContent = '금액을 고르면 결제할 수 있어요'; go.classList.add('is-off'); }
  if (h) go.removeAttribute('target');
  const hint = $('#payNoHint');
  const bad = st.orderNo && !ORDER_RE.test(st.orderNo);
  hint.textContent = bad ? '주문번호 형식을 확인해 주세요. 예: NA261126-AB12' : st.orderNo ? '이 주문에 결제가 바로 연결돼요.' : '메일로 받은 주문번호를 적으면 결제가 그 주문에 바로 연결돼요. 상담에서 금액만 안내받으셨다면 비워 두셔도 돼요.';
  hint.classList.toggle('is-bad', !!bad);
}

function orderBox(o) {
  const ch = ((o.quote && o.quote.changes) || []).slice(-1)[0];
  const due = o.amountDue || 0;
  const ok = isQuoteAmount(due);
  return `<div class="pay-order"><p class="pay-order-k">주문번호 ${esc(o.orderNo)}</p><p class="pay-order-t">${esc(String(o.productName || '논문AI 주문').replace(/^\[논문AI\]\s*/, ''))}</p>
<p class="pay-order-d">${due ? `결제할 금액 <b class="num">${won(due)}</b>` : '결제할 금액이 없어요.'}${o.paidAmount ? ` · 결제 완료 ${won(o.paidAmount)}` : ''}</p>
${ch && ch.reason ? `<p class="pay-order-r"><b>${ch.paid ? '추가 결제 사유' : ch.quote ? '견적 설명' : '금액이 바뀐 이유'}</b>${esc(ch.reason)}</p>` : ''}
${due && !ok ? `<p class="pay-order-r">이 금액은 주문 결제 화면에서 맞는 상품으로 결제해 주세요. <a href="${url('/checkout/')}?o=${encodeURIComponent(o.orderNo)}">주문 결제 화면으로</a></p>` : ''}</div>`;
}

async function start() {
  const p = new URLSearchParams(location.search);
  const a = Number(p.get('a'));
  if (isQuoteAmount(a)) st.amount = a;
  const no = String(p.get('o') || '').toUpperCase();
  const token = p.get('t') || (myOrders.get(no) || {}).token || '';
  if (ORDER_RE.test(no)) { st.orderNo = no; $('#payNo').value = no; }
  document.querySelector('.pay-amts').addEventListener('change', (e) => { if (e.target.name === 'payAmt') { st.amount = Number(e.target.value); render(); } });
  $('#payNo').addEventListener('input', (e) => {
    const v = e.target.value.toUpperCase().replace(/\s+/g, '');
    if (v !== e.target.value) e.target.value = v;
    st.orderNo = v;
    if (st.order && st.order.orderNo !== v) { st.order = null; st.ticket = ''; $('#payOrder').innerHTML = ''; }
    render();
  });
  $('#payGo').addEventListener('click', (e) => {
    if (!st.amount) { e.preventDefault(); toast('결제할 금액을 먼저 골라 주세요.', { error: true }); document.querySelector('.pay-amts').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (st.orderNo && !ORDER_RE.test(st.orderNo)) { e.preventDefault(); toast('주문번호 형식을 확인해 주세요. 모르시면 비워 두셔도 돼요.', { error: true }); $('#payNo').focus(); }
  });
  render();
  loadConfig().then((c) => { st.links = amountLinks((c && c.settings) || {}); render(); });
  if (st.orderNo && token) {
    if (p.get('t')) myOrders.put(st.orderNo, { token });
    try {
      const r = await api('getOrder', { orderNo: st.orderNo, token }, { retries: 0, timeoutMs: 20000 });
      st.order = r.order;
      $('#payOrder').innerHTML = orderBox(r.order);
      if (!st.amount && isQuoteAmount(r.order.amountDue)) st.amount = r.order.amountDue;
      render();
      api('payTicket', { orderNo: st.orderNo, token }, { retries: 0, timeoutMs: 8000 }).then((t) => { st.ticket = (t && t.ticket) || ''; render(); }).catch(() => {});
    } catch { /* 주문을 못 불러와도 금액만으로 결제할 수 있다 */ }
  }
}
start();
