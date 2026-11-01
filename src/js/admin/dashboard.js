// 오늘의 작업(대시보드)과 주문 목록
import { aapi, esc, won, toast, fmtAt, etaChip, pill, METHOD_LABEL, SERVICE_LABEL, copyText, confirmBox, busy, authLost } from './core.js';
import { workBrief } from './brief.js';

const TILES = [
  ['payment', '결제 확인', 'claims'], ['quote', '견적 작성', 'quote_requested'], ['materials', '자료 보완 대기', 'needs_materials'], ['working', '작업 대기·진행', 'active'],
  ['review', '검토', 'review'], ['revision', '수정 요청', 'revision'], ['dueToday', '오늘 마감', 'active'], ['overdue', '지연', 'active'],
];

export async function renderDashboard(root, go) {
  root.innerHTML = '<div class="ad-loading"><span class="spin spin-dark"></span> 오늘 처리할 주문을 모으는 중입니다</div>';
  let d;
  try { d = await aapi('adminDashboard'); } catch (e) { if (!authLost(e)) root.innerHTML = `<div class="ad-empty">${esc(e.message)}</div>`; return; }
  const c = d.counts;
  const todo = c.payment + c.quote + c.working + c.review + c.revision + d.unread.length;
  const today = new Date();
  root.innerHTML = `<div class="ad-page">
<div class="ad-head"><div><h1>오늘의 작업</h1><p class="muted">${today.getMonth() + 1}월 ${today.getDate()}일(${'일월화수목금토'[today.getDay()]}) · 처리할 일 <b>${todo}건</b>${c.overdue ? ` · <b class="pen-t">지연 ${c.overdue}건</b>` : ''}</p></div>
<div class="ad-head-act"><button class="btn btn-ghost btn-sm" type="button" data-act="reload">새로 고침</button><button class="btn btn-dark btn-sm" type="button" data-act="briefs"${d.queue.length ? '' : ' disabled'}>오늘 작업지시문 한 번에 복사</button></div></div>
<div class="ad-tiles">${TILES.map(([k, label, filter]) => `<button type="button" class="ad-tile${c[k] ? ' has' : ''}${k === 'overdue' && c[k] ? ' is-bad' : ''}" data-filter="${filter}"><span>${label}</span><b>${c[k]}</b></button>`).join('')}</div>
<div class="ad-grid">
<div class="ad-main">
${section('결제 확인 요청', d.claims.length, d.claims.length ? `<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>주문</th><th>고객</th><th>방법</th><th>입금자·결제자</th><th class="r">금액</th><th>알림 시각</th><th></th></tr></thead><tbody>${d.claims.map((x) => `<tr>
<td><a href="#order=${esc(x.orderNo)}" class="ad-no">${esc(x.orderNo)}</a><small>${x.claimKind === 'extra' ? '추가 결제' : esc(x.productName)}</small></td><td>${esc(x.name)}</td><td>${esc(METHOD_LABEL[x.claimMethod] || x.claimMethod)}</td><td>${esc(x.claimRef || '-')}</td><td class="r num">${won(x.claimAmount)}</td><td>${fmtAt(x.claimAt)}</td>
<td><div class="ad-row-act"><button class="btn btn-primary btn-xs" type="button" data-confirm="${esc(x.orderNo)}" data-pay="${esc(x.paymentId)}">확인</button><button class="btn btn-ghost btn-xs" type="button" data-reject="${esc(x.orderNo)}" data-pay="${esc(x.paymentId)}">내역 없음</button></div></td></tr>`).join('')}</tbody></table></div><p class="hint">성균관컨설팅 결제 관리 화면이나 통장 내역에서 금액과 이름을 확인한 뒤 눌러 주세요. 성균관컨설팅 결제는 알림과 동시에 작업 순서에 들어가 있습니다.</p>` : '<p class="ad-none">확인할 결제가 없습니다.</p>')}
${section('작업 순서', d.queue.length, d.queue.length ? `<ol class="ad-queue">${d.queue.map((x, i) => `<li>
<span class="q-no">${i + 1}</span>
<div class="q-main"><a href="#order=${esc(x.orderNo)}" class="q-title">${x.priority ? '<em class="badge badge-amber">우선</em> ' : ''}${esc(x.title || x.summary || x.productName)}</a><small>${esc(x.orderNo)} · ${esc(SERVICE_LABEL[x.service] || '')} · ${esc(x.productName)}${x.workStarted ? ' · <b class="ok-t">착수함</b>' : ''}</small></div>
<div class="q-side">${pill(x.status, x.statusLabel)}${etaChip(x.eta)}</div>
<div class="q-act"><button class="btn btn-soft btn-xs" type="button" data-brief="${esc(x.orderNo)}">지시문 복사</button><a class="btn btn-ghost btn-xs" href="#order=${esc(x.orderNo)}">열기</a></div></li>`).join('')}</ol>` : '<p class="ad-none">진행 중인 작업이 없습니다.</p>')}
${section('견적 요청', d.quotes.length, d.quotes.length ? rows(d.quotes, '견적 작성') : '<p class="ad-none">견적을 기다리는 주문이 없습니다.</p>')}
</div>
<aside class="ad-side">
${section('새 메시지', d.unread.length, d.unread.length ? `<ul class="ad-msgs">${d.unread.map((m) => `<li><a href="#order=${esc(m.orderNo)}"><b>${esc(m.orderNo)}</b><span class="badge${m.type === 'revision' ? ' badge-pen' : m.type === 'deletion' ? ' badge-amber' : ''}">${esc({ revision: '수정 요청', materials_done: '보완 제출', question: '문의', deletion: '삭제 요청' }[m.type] || m.type)}</span><small>${fmtAt(m.at)}</small><p>${esc(m.text)}</p></a></li>`).join('')}</ul>` : '<p class="ad-none">새 메시지가 없습니다.</p>')}
<div class="ad-card"><h2>이번 달</h2><dl class="ad-kv"><div><dt>결제 확인 매출</dt><dd>${won(d.revenue.month)}</dd></div><div><dt>결제 건수</dt><dd>${d.revenue.count}건</dd></div><div><dt>결제 대기 주문</dt><dd>${c.unpaid}건</dd></div><div><dt>최근 30일 전달</dt><dd>${c.delivered30}건</dd></div><div><dt>오늘 남은 메일 발송량</dt><dd>${d.mailQuota === null ? '-' : d.mailQuota + '통'}</dd></div></dl></div>
${section('최근 주문', d.recent.length, rows(d.recent.slice(0, 8)))}
</aside></div></div>`;

  root.querySelector('[data-act="reload"]').addEventListener('click', () => renderDashboard(root, go));
  root.querySelector('[data-act="briefs"]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    busy(btn, true, '모으는 중');
    try {
      const texts = [];
      for (const x of d.queue) {
        const r = await aapi('adminGetOrder', { orderNo: x.orderNo });
        texts.push(workBrief(r.order));
      }
      const ok = await copyText(texts.join('\n\n' + '='.repeat(40) + '\n\n'));
      toast(ok ? `작업지시문 ${texts.length}건을 복사했습니다.` : '복사하지 못했습니다.', { error: !ok });
    } catch (ex) { toast(ex.message, { error: true }); }
    busy(btn, false);
  });
  root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.filter;
    if (f === 'claims') { const el = root.querySelector('.ad-table'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    go(`#orders?status=${f}`);
  }));
  root.querySelectorAll('[data-brief]').forEach((b) => b.addEventListener('click', async () => {
    busy(b, true);
    try {
      const r = await aapi('adminGetOrder', { orderNo: b.dataset.brief });
      const ok = await copyText(workBrief(r.order));
      toast(ok ? '작업지시문을 복사했습니다.' : '복사하지 못했습니다.', { error: !ok });
    } catch (ex) { toast(ex.message, { error: true }); }
    busy(b, false);
  }));
  root.querySelectorAll('[data-confirm]').forEach((b) => b.addEventListener('click', async () => {
    const v = await confirmBox({ title: '결제 확인', html: `<p><b>${esc(b.dataset.confirm)}</b> 결제를 확인 처리합니다. 고객에게 결제 확인 메일이 가고, 아직 작업 순서에 없다면 바로 배정됩니다.</p>`, ok: '결제 확인' });
    if (!v) return;
    busy(b, true);
    try { await aapi('adminConfirmPayment', { orderNo: b.dataset.confirm, paymentId: b.dataset.pay }); toast('결제를 확인했습니다.'); renderDashboard(root, go); } catch (ex) { toast(ex.message, { error: true }); busy(b, false); }
  }));
  root.querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', async () => {
    const v = await confirmBox({ title: '결제 내역 없음', html: `<p>결제 내역을 찾지 못했다고 고객에게 알리고 주문을 결제 대기로 되돌립니다.</p><div class="field"><label class="label" for="rjm">고객 안내</label><textarea class="textarea" id="rjm" name="message" rows="3">결제 내역을 확인하지 못했습니다. 결제하신 이름과 시각을 메시지로 알려 주시면 다시 확인하겠습니다.</textarea></div>`, ok: '안내 보내기', danger: true });
    if (!v) return;
    busy(b, true);
    try { await aapi('adminRejectClaim', { orderNo: b.dataset.reject, paymentId: b.dataset.pay, message: v.message }); toast('고객에게 안내했습니다.'); renderDashboard(root, go); } catch (ex) { toast(ex.message, { error: true }); busy(b, false); }
  }));
}

function section(title, count, body) {
  return `<section class="ad-card"><h2>${esc(title)}${count ? ` <span class="ad-count">${count}</span>` : ''}</h2>${body}</section>`;
}

function rows(list, cta = '') {
  if (!list.length) return '<p class="ad-none">없습니다.</p>';
  return `<ul class="ad-rows">${list.map((x) => `<li><a href="#order=${esc(x.orderNo)}"><span class="r-main"><b>${esc(x.title || x.summary || x.productName)}</b><small>${esc(x.orderNo)} · ${esc(x.name || '')} · ${fmtAt(x.createdAt)}</small></span><span class="r-side">${pill(x.status, x.statusLabel)}<span class="num">${x.quoteRequired && !x.amount ? '견적 전' : won(x.amount)}</span></span>${cta ? `<span class="r-cta">${esc(cta)}</span>` : ''}</a></li>`).join('')}</ul>`;
}

/* ------------------------------------------------------------------ 주문 목록 */
const FILTERS = [['active', '진행 중'], ['quote_requested', '견적'], ['pending_payment', '결제 대기'], ['payment_review', '결제 확인'], ['needs_materials', '자료 보완'], ['review', '검토'], ['revision', '수정'], ['delivered', '전달 완료'], ['completed', '완료'], ['cancelled', '취소'], ['all', '전체']];

export async function renderList(root, params, go) {
  const status = params.get('status') || 'active';
  const q = params.get('q') || '';
  const offset = Number(params.get('offset') || 0);
  root.innerHTML = `<div class="ad-page"><div class="ad-head"><div><h1>주문</h1></div>
<form class="ad-search" id="srch"><input class="input" name="q" value="${esc(q)}" placeholder="주문번호, 이름, 이메일, 전화, 상품" aria-label="주문 검색"><button class="btn btn-dark btn-sm" type="submit">찾기</button></form></div>
<div class="ad-filters" role="tablist">${FILTERS.map(([v, t]) => `<a role="tab" href="#orders?status=${v}${q ? `&q=${encodeURIComponent(q)}` : ''}" class="${v === status ? 'is-on' : ''}" aria-selected="${v === status}">${t}</a>`).join('')}</div>
<div id="listBody"><div class="ad-loading"><span class="spin spin-dark"></span> 불러오는 중</div></div></div>`;
  root.querySelector('#srch').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = new FormData(e.target).get('q').trim();
    go(`#orders?status=${v ? 'all' : status}${v ? `&q=${encodeURIComponent(v)}` : ''}`);
  });
  let r;
  try { r = await aapi('adminListOrders', { status, q, offset, limit: 50 }); } catch (e) { if (!authLost(e)) root.querySelector('#listBody').innerHTML = `<div class="ad-empty">${esc(e.message)}</div>`; return; }
  const body = root.querySelector('#listBody');
  if (!r.orders.length) { body.innerHTML = '<div class="ad-empty">조건에 맞는 주문이 없습니다.</div>'; return; }
  body.innerHTML = `<div class="ad-card ad-table-wrap"><table class="ad-table ad-list"><thead><tr><th>주문</th><th>고객</th><th>상태</th><th class="r">금액</th><th>예정일</th><th>접수</th></tr></thead><tbody>${r.orders.map((x) => `<tr data-go="${esc(x.orderNo)}">
<td><a href="#order=${esc(x.orderNo)}" class="ad-no">${esc(x.orderNo)}</a><small>${x.priority ? '<em class="badge badge-amber">우선</em> ' : ''}${esc(x.title || x.summary || x.productName)}</small></td>
<td>${esc(x.name)}<small>${esc(x.phone)}</small></td><td>${pill(x.status, x.statusLabel)}${x.claimed ? '<small class="pen-t">결제 확인 필요</small>' : ''}</td>
<td class="r num">${x.quoteRequired && !x.amount ? '견적 전' : won(x.amount)}${x.paidAmount ? `<small>결제 ${won(x.paidAmount)}</small>` : ''}</td>
<td>${['delivered', 'completed', 'cancelled'].includes(x.status) ? `<span class="muted">${fmtAt(x.deliveredAt, { time: false }) || '-'}</span>` : etaChip(x.eta)}</td><td>${fmtAt(x.createdAt)}</td></tr>`).join('')}</tbody></table></div>
<div class="ad-pager"><span class="muted">${r.total}건 중 ${offset + 1}~${Math.min(r.total, offset + r.orders.length)}</span>${offset > 0 ? `<a class="btn btn-ghost btn-xs" href="#orders?status=${status}&q=${encodeURIComponent(q)}&offset=${Math.max(0, offset - 50)}">이전</a>` : ''}${offset + 50 < r.total ? `<a class="btn btn-ghost btn-xs" href="#orders?status=${status}&q=${encodeURIComponent(q)}&offset=${offset + 50}">다음</a>` : ''}</div>`;
  body.querySelectorAll('[data-go]').forEach((tr) => tr.addEventListener('click', (e) => { if (e.target.closest('a')) return; go(`#order=${tr.dataset.go}`); }));
}
