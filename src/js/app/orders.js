// 주문 조회와 고객 주문 페이지
import { api, loadConfig, myOrders } from './api.js';
import { statusPill, timelineHtml, downloadFile, fileRows, priceSummary, isSimulation, fmtAt, orderFacts, factsTable, orderTitle } from './order-view.js';
import { ICON, note, SLOT_LABEL } from './wizard.js';
import { checkFile, blobToBase64, fmtSize } from './files.js';
import { buildDesign } from '../core/engine.js';
import { designReportHtml } from '../ui/report.js';
import { esc, won } from '../core/render.js';
import { $, $$, toast, url, modal } from '../ui/dom.js';

const POLL_MS = 60000;
const MSG_TYPE = { revision: '수정 요청', materials_done: '보완 자료 제출', question: '문의', reply: '답변', materials: '자료 요청', deletion: '삭제 요청', note: '안내' };
const SLOTS_BY_SERVICE = {
  paper: ['manuscript', 'materials', 'toc', 'format', 'feedback', 'data', 'other'],
  survey: ['questionnaire', 'proposal', 'feedback', 'data', 'materials', 'other'],
  statistics: ['data', 'codebook', 'prevResult', 'questionnaire', 'feedback', 'other'],
};
const NEXT = {
  paper: [
    { href: '/statistics/new/', t: '통계분석 의뢰', d: '데이터 분석과 결과 해석까지' },
    { href: '/survey/new/', t: '설문조사 의뢰', d: '설문지 작성부터 통계 해석까지' },
    { href: '/paper/new/?task=feedback', t: '교수님 피드백 반영', d: '심사 의견을 항목별로 반영' },
  ],
  survey: [
    { href: '/statistics/new/', t: '통계분석 의뢰', d: '응답 데이터로 결과표와 해석' },
    { href: '/paper/new/', t: '논문 작성 지원', d: '연구 결과를 논문 구조로' },
  ],
  statistics: [
    { href: '/paper/new/', t: '논문 작성 지원', d: '분석 결과를 본문 장으로' },
    { href: '/paper/new/?task=feedback', t: '교수님 피드백 반영', d: '심사 의견을 항목별로 반영' },
  ],
  // 학습용 시뮬레이션: 가상 데이터 결과를 논문으로 옮기는 안내는 하지 않고 실제 조사·분석으로만 잇는다
  simulation: [
    { href: '/survey/new/', t: '실제 설문조사 의뢰', d: '실제 응답을 모아 연구 데이터로' },
    { href: '/statistics/new/', t: '실제 데이터 통계분석', d: '직접 모은 데이터로 분석과 해석' },
  ],
};

const params = () => new URLSearchParams(location.search);

// 고객에게 보일 결과물: 전달 완료로 공개된 것만(수정 진행 중 새로 올린 수정본은 다시 전달할 때까지 숨김)
function deliveredResults(o) {
  const res = (o.files && o.files.results) || [];
  if (['delivered', 'completed'].includes(o.status)) return res;
  const at = (o.timeline || []).filter((t) => t.status === 'delivered').map((t) => Date.parse(t.at)).filter((n) => !Number.isNaN(n));
  if (!at.length) return [];
  const last = Math.max(...at);
  return res.filter((f) => { const u = Date.parse(f.uploadedAt); return Number.isNaN(u) || u <= last; });
}

function cancelNote(o) {
  const last = [...(o.timeline || [])].reverse().find((t) => t.status === 'cancelled' && t.message);
  return last ? `취소된 주문입니다. ${esc(last.message)}` : '취소된 주문입니다.';
}

/* ------------------------------------------------------------------ 시작 */
export async function startOrders(root) {
  const p = params();
  const no = (p.get('o') || '').trim().toUpperCase();
  if (p.get('t') && no) {
    myOrders.put(no, { token: p.get('t') });
    history.replaceState(null, '', `${location.pathname}?o=${encodeURIComponent(no)}${p.get('paid') ? '&paid=1' : ''}`);
  }
  const mine = no ? myOrders.get(no) : null;
  if (!no || !mine || !mine.token) { renderLookup(root, { orderNo: no }); return; }
  const page = new OrderPage(root, no, mine.token);
  page.load();
}

/* ------------------------------------------------------------------ 조회 화면 */
function renderLookup(root, { orderNo = '', error = '' } = {}) {
  const list = Object.entries(myOrders.all() || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, 8);
  root.innerHTML = `<div class="wrap pg-wrap"><div class="lookup">
<h1 class="lk-title">주문 조회</h1>
<p class="muted lk-lead">주문번호와 주문할 때 적은 이메일 또는 휴대전화, 조회 비밀번호를 입력하세요. 비밀번호를 따로 정하지 않았다면 휴대전화 뒤 4자리입니다.</p>
<form class="card" id="lk" novalidate>
<div class="field"><label class="label" for="lkNo">주문번호</label><input class="input" id="lkNo" value="${esc(orderNo)}" placeholder="예: NA261101-AB12" autocomplete="off" autocapitalize="characters" maxlength="30"></div>
<div class="field"><label class="label" for="lkContact">이메일 또는 휴대전화</label><input class="input" id="lkContact" placeholder="주문할 때 적은 연락처" autocomplete="email" maxlength="120"></div>
<div class="field"><label class="label" for="lkPin">조회 비밀번호</label><input class="input" id="lkPin" type="password" inputmode="numeric" placeholder="휴대전화 뒤 4자리 또는 정한 숫자" maxlength="8" autocomplete="current-password"></div>
<p class="wz-err" id="lkErr" role="alert">${esc(error)}</p>
<button class="btn btn-primary btn-lg btn-block" type="submit" id="lkGo">주문 확인하기</button>
</form>
${list.length ? `<div class="card"><div class="card-h"><h2>이 기기에서 접수한 주문</h2></div><ul class="my-orders">${list.map(([n, v]) => `<li><a href="?o=${encodeURIComponent(n)}"><span><b>${esc(n)}</b><small class="muted">${esc(v.product || '')}</small></span><span class="mo-st" data-st="${esc(n)}"><span class="spin spin-dark"></span></span></a></li>`).join('')}</ul></div>` : ''}
<details class="card lk-forgot"><summary>주문번호나 비밀번호를 잊으셨나요?</summary>
<p class="small">주문할 때 적은 이메일을 입력하면, 등록된 주문의 조회 링크를 메일로 보내 드립니다.</p>
<div class="lk-row"><input class="input" id="lkMail" type="email" placeholder="이메일 주소" autocomplete="email" maxlength="120"><button class="btn btn-ghost" type="button" id="lkSend">조회 링크 받기</button></div>
</details>
</div></div>`;
  const form = $('#lk', root);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = $('#lkNo', root).value.trim().toUpperCase();
    const contact = $('#lkContact', root).value.trim();
    const pin = $('#lkPin', root).value.trim();
    const err = $('#lkErr', root);
    if (!/^NA\d{6}-[A-Z0-9]{4}$/.test(n)) { err.textContent = '주문번호를 확인해 주세요. 예: NA261101-AB12'; return; }
    if (!contact) { err.textContent = '주문할 때 적은 이메일 또는 휴대전화를 입력해 주세요.'; return; }
    if (!/^\d{4,8}$/.test(pin)) { err.textContent = '조회 비밀번호는 숫자 4~8자리입니다.'; return; }
    err.textContent = '';
    const btn = $('#lkGo', root);
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 확인하는 중';
    try {
      const r = await api('lookupOrder', { orderNo: n, contact, pin });
      myOrders.put(r.orderNo, { token: r.token });
      location.href = `?o=${encodeURIComponent(r.orderNo)}`;
    } catch (ex) {
      err.textContent = ex.code === 'rate_limited' ? '조회를 여러 번 실패했습니다. 15분 뒤에 다시 시도해 주세요.' : ex.message;
      btn.disabled = false; btn.textContent = '주문 확인하기';
    }
  });
  const send = $('#lkSend', root);
  if (send) send.addEventListener('click', async () => {
    const email = $('#lkMail', root).value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast('이메일 주소를 확인해 주세요.', { error: true }); return; }
    send.disabled = true;
    try {
      await api('sendAccessLink', { email });
      toast('등록된 주문이 있으면 조회 링크를 메일로 보내 드렸습니다.', { ms: 5000 });
    } catch (ex) { toast(ex.message, { error: true }); }
    send.disabled = false;
  });
  // 이 기기 주문의 현재 상태 채우기
  for (const [n, v] of list.slice(0, 5)) {
    api('getOrder', { orderNo: n, token: v.token }, { retries: 0, timeoutMs: 30000 }).then((r) => {
      const el = root.querySelector(`[data-st="${n}"]`);
      if (el) el.innerHTML = statusPill(r.order);
      if (r.order.productName && !v.product) myOrders.put(n, { product: r.order.productName });
    }).catch((ex) => {
      const el = root.querySelector(`[data-st="${n}"]`);
      if (el) el.innerHTML = `<span class="small muted">${ex.code === 'not_found' ? '삭제된 주문' : '열어서 확인'}</span>`;
    });
  }
  for (const el of $$('[data-st]', root).slice(5)) el.innerHTML = '<span class="small muted">열어서 확인</span>';
}

/* ------------------------------------------------------------------ 주문 페이지 */
class OrderPage {
  constructor(root, orderNo, token) {
    this.root = root; this.no = orderNo; this.token = token;
    this.o = null; this.cfg = { settings: {}, catalog: { items: [] } }; this.sig = ''; this.timer = null; this.lastLoad = 0; this.busy = false;
  }

  async load() {
    try {
      const [cfg, r] = await Promise.all([loadConfig(), api('getOrder', { orderNo: this.no, token: this.token })]);
      this.cfg = cfg;
      this.set(r.order);
      this.render();
      this.poll();
    } catch (e) {
      if (e.code === 'forbidden' || e.code === 'not_found') {
        myOrders.remove(this.no);
        renderLookup(this.root, { orderNo: this.no, error: e.code === 'not_found' ? '주문을 찾을 수 없습니다. 주문번호를 확인해 주세요.' : '조회 기간이 지났거나 권한이 없습니다. 연락처와 조회 비밀번호로 다시 확인해 주세요.' });
        return;
      }
      this.root.innerHTML = `<div class="wrap pg-wrap"><div class="card lookup"><h1 class="lk-title">주문을 불러오지 못했습니다</h1><p class="muted">${esc(e.message)}</p><button class="btn btn-primary" type="button" id="again">다시 시도</button></div></div>`;
      $('#again', this.root).addEventListener('click', () => location.reload());
    }
  }

  set(o) {
    this.o = o;
    this.lastLoad = Date.now();
    this.sig = JSON.stringify([o.status, o.timeline.length, o.files.results.length, o.files.customer.length, o.messages.length, o.amountDue, o.eta, o.queuePosition]);
    if (o.productName) myOrders.put(this.no, { product: o.productName });
  }

  poll() {
    clearInterval(this.timer);
    this.timer = setInterval(() => { if (document.visibilityState === 'visible') this.refresh(true); }, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - this.lastLoad > 30000) this.refresh(true);
    });
  }

  async refresh(quiet = false) {
    if (this.busy) return;
    try {
      const r = await api('getOrder', { orderNo: this.no, token: this.token }, { retries: 0, timeoutMs: 30000 });
      const before = this.sig;
      this.set(r.order);
      if (before !== this.sig) {
        const typing = $$('textarea', this.root).some((t) => t.value.trim());
        if (typing && quiet) { this.pendingRender = true; toast('주문에 새 소식이 있습니다. 작성 중인 내용을 보낸 뒤 화면이 새로 고쳐집니다.', { ms: 5000 }); }
        else this.render();
      } else {
        const st = $('#syncAt', this.root);
        if (st) st.textContent = fmtAt(new Date().toISOString());
      }
    } catch (e) {
      if (!quiet) toast(e.message, { error: true });
    }
  }

  async act(action, payload, okMsg) {
    this.busy = true;
    try {
      const r = await api(action, { orderNo: this.no, token: this.token, ...payload });
      if (r.order) this.set(r.order);
      if (okMsg) toast(okMsg);
      this.pendingRender = false;
      this.render();
      return r;
    } catch (e) {
      toast(e.message || '처리하지 못했습니다.', { error: true, ms: 5000 });
      return null;
    } finally { this.busy = false; }
  }

  /* -------------------------------------------------------------- 화면 */
  render() {
    const o = this.o;
    const sim = isSimulation(o);
    const title = orderTitle(o);
    this.root.innerHTML = `<div class="wrap pg-wrap"><div class="pg-grid">
<div class="pg-main">
${this.headCard(title, sim)}
${this.materialsCard()}
${this.resultsCard(sim)}
<div class="card" id="progress"><div class="card-h"><h2>진행 상황</h2><span class="small muted">마지막 확인 <span id="syncAt">${fmtAt(new Date(this.lastLoad).toISOString())}</span></span></div>${o.status === 'cancelled' ? note(cancelNote(o), '') : timelineHtml(o)}<p class="hint">이 화면은 1분마다 새 소식을 확인합니다. 단계가 바뀌면 메일로도 알려 드립니다.</p></div>
${this.messagesCard()}
${this.designCard()}
</div>
<aside class="pg-side">
<div class="card"><div class="card-h"><h2>결제 정보</h2>${o.paidAmount ? `<span class="small muted">결제 ${won(o.paidAmount)}</span>` : ''}</div>${priceSummary(o)}${this.paymentsHtml()}</div>
<details class="card card-fold"><summary><span class="card-h"><h2>주문 내용</h2></span></summary>${factsTable(orderFacts(o))}</details>
${this.filesCard()}
${this.nextCard()}
${this.manageCard()}
</aside>
</div></div>`;
    this.bind();
  }

  headCard(title, sim) {
    const o = this.o;
    const p = params();
    const banners = [];
    if (p.get('paid') && ['payment_review', 'received', 'checking', 'preparing', 'in_progress', 'needs_materials'].includes(o.status)) {
      banners.push(note(o.status === 'payment_review' ? '결제 완료 알림을 받았습니다. 결제 내역을 확인하는 대로 작업 순서에 배정해 드립니다.' : '결제 완료 알림을 받았습니다. 작업 순서에 배정되었고 예상 전달일이 정해졌습니다. 결제 내역은 담당자가 함께 확인합니다.', 'green'));
    }
    if (o.amountDue > 0 && o.allow.pay) {
      banners.push(`<div class="note note-amber">${ICON.warn}<div><b>${won(o.amountDue)} 결제를 기다리고 있습니다.</b> ${o.status === 'pending_payment' ? '결제가 확인되면 작업 순서에 배정되고 예상 전달일이 확정됩니다.' : '추가 결제가 확인되면 이어서 진행합니다.'}<div class="note-act"><a class="btn btn-primary" href="${url('/checkout/')}?o=${encodeURIComponent(o.orderNo)}">결제하기</a></div></div></div>`);
    } else if (o.status === 'quote_requested') {
      banners.push(note('요청하신 조건과 자료를 확인해 <b>영업일 1일 안에 확정 견적</b>을 메일과 이 화면으로 안내드립니다.', 'amber'));
    } else if (o.status === 'payment_review') {
      banners.push(note('결제 내역을 확인하고 있습니다. 확인되는 대로 작업 순서에 배정됩니다.', ''));
    } else if (o.status === 'draft') {
      banners.push(note('아직 제출되지 않은 주문서입니다. 신청 화면에서 이어서 제출해 주세요.', 'amber'));
    }
    if (o.deleted) banners.push(note('올리신 파일과 결과물, 연구 자료가 삭제되었습니다. 주문번호와 결제 기록만 관련 법령에 따라 정해진 기간 보관됩니다.', ''));
    const cells = [
      ['예상 전달일', o.status === 'delivered' || o.status === 'completed' ? (o.deliveredAt ? fmtAt(o.deliveredAt).replace(/ \d\d:\d\d$/, '') + ' 전달' : '전달 완료') : (o.etaLabel || (['quote_requested', 'pending_payment', 'payment_review', 'draft'].includes(o.status) ? '결제 후 확정' : '확인 중'))],
      ['현재 단계', o.status === 'review' ? '전문가 검수' : o.statusLabel],
      o.queuePosition && !['delivered', 'completed', 'cancelled'].includes(o.status) ? ['작업 순서', `${o.queuePosition}번째`] : o.filesExpireAt ? ['내려받기 기한', o.deleted ? '파일 삭제됨' : `${Number(o.filesExpireAt.slice(5, 7))}월 ${Number(o.filesExpireAt.slice(8, 10))}일`] : ['주문 금액', won(o.amount)],
    ];
    return `<div class="card ord-card"><div class="ord-head"><div class="ord-hd-txt"><p class="ord-no">주문번호 ${esc(o.orderNo)} · ${esc(fmtAt(o.createdAt))} 접수</p><h1 class="ord-title">${esc(title)}</h1>${(() => { const sub = title === o.productName ? (o.summary || '') : [o.productName, o.summary].filter(Boolean).join(' · '); return sub ? `<p class="muted small">${esc(sub)}</p>` : ''; })()}${sim ? '<p><span class="sim-mark">가상 데이터, 실제 연구 결과 아님</span></p>' : ''}</div>${statusPill(o)}</div>
<div class="eta-box">${cells.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
${banners.join('')}</div>`;
  }

  materialsCard() {
    const o = this.o;
    if (o.status !== 'needs_materials') return '';
    const req = [...(o.messages || [])].reverse().find((m) => m.from === 'admin' && m.type === 'materials');
    const lastTl = [...(o.timeline || [])].reverse().find((t) => t.status === 'needs_materials');
    const slots = o.missingSlots && o.missingSlots.length ? o.missingSlots : ['other'];
    return `<div class="card card-need" id="materials"><div class="card-h"><h2>자료 보완이 필요합니다</h2></div>
${o.missing.length ? `<ul class="chk">${o.missing.map((m) => `<li><i></i><span>${esc(m)}</span></li>`).join('')}</ul>` : ''}
${req ? `<p class="need-msg">${esc(req.text).replace(/\n/g, '<br>')}</p>` : lastTl && lastTl.message ? `<p class="need-msg">${esc(lastTl.message)}</p>` : ''}
${this.uploadBox(slots[0], 'mat')}
<div class="need-act"><button class="btn btn-primary" type="button" id="matDone">보완 자료 제출 완료</button><span class="hint">자료를 모두 올린 뒤 눌러 주세요. 보완이 늦어지면 예상 전달일이 함께 늦어집니다.</span></div></div>`;
  }

  resultsCard(sim) {
    const o = this.o;
    const res = deliveredResults(o);
    if (!res.length && !['delivered', 'completed', 'revision'].includes(o.status)) return '';
    const left = Math.max(0, (o.revisions.allowed || 0) - (o.revisions.used || 0));
    const revItem = (this.cfg.catalog.items || []).find((i) => i.code === 'A-REVISION');
    const deliveredAt = o.deliveredAt ? new Date(o.deliveredAt) : null;
    const revUntil = deliveredAt ? new Date(deliveredAt.getTime() + 30 * 86400000) : null;
    const revOpen = o.allow.revision && (!revUntil || revUntil > new Date());
    return `<div class="card card-result" id="results"><div class="card-h"><h2 class="serif">결과물</h2>${o.filesExpireAt && !o.deleted ? `<span class="small muted">${esc(o.filesExpireAt)}까지 보관</span>` : ''}</div>
${sim ? note('학습용 시뮬레이션 결과입니다. 가상 데이터로 만든 결과이므로 실제 연구 결과로 제출하거나 인용할 수 없습니다.', 'pen') : ''}
${res.length ? fileRows(res, { results: true }) : o.deleted ? '<p class="muted">결과물 파일은 삭제되어 더 이상 내려받을 수 없습니다.</p>' : '<p class="muted">결과물을 정리하고 있습니다.</p>'}
${res.length ? '<p class="hint">결과물은 연구를 돕는 참고 자료입니다. 제출 전에 내용과 출처를 직접 확인해 주세요.</p>' : ''}
${o.allow.revision ? `<div class="rev-box"><h3 class="sub-q">수정 요청</h3>
<p class="small">${o.revisions.allowed ? `포함된 수정 ${o.revisions.allowed}회 중 ${left}회 남았습니다.` : '이 주문에는 무상 수정이 포함되어 있지 않습니다.'} ${left ? '' : `추가 수정은 1회 단위${revItem ? `(${won(revItem.price)})` : ''}로 진행하며, 요청을 남기시면 범위를 확인해 안내드립니다.`} 저희 쪽 오류나 누락은 횟수와 관계없이 무상으로 고쳐 드립니다.${revUntil ? ` 수정 요청은 ${revUntil.getMonth() + 1}월 ${revUntil.getDate()}일까지 받습니다.` : ''}</p>
${revOpen ? `<textarea class="textarea" id="revText" rows="4" maxlength="4000" placeholder="고칠 부분을 한 번에 모아 적어 주세요. 예: 2장 2절 선행연구 3편 추가, 표 4-2 소수점 둘째 자리로 통일"></textarea><button class="btn btn-primary" type="button" id="revSend">수정 요청 보내기</button>` : '<p class="small muted">수정 요청 기간이 지났습니다. 필요한 내용은 아래 메시지로 문의해 주세요.</p>'}</div>` : ''}</div>`;
  }

  messagesCard() {
    const o = this.o;
    const ms = o.messages || [];
    const closed = o.deleted || o.status === 'draft';
    return `<div class="card" id="messages"><div class="card-h"><h2>문의·메시지</h2></div>
${ms.length ? `<ul class="msg-list">${ms.map((m) => `<li class="msg from-${m.from === 'admin' ? 'admin' : 'customer'}"><small>${m.from === 'admin' ? '논문AI 연구진' : '나'} · ${esc(MSG_TYPE[m.type] || '메시지')} · ${esc(fmtAt(m.at))}</small>${esc(m.text).replace(/\n/g, '<br>')}</li>`).join('')}</ul>` : '<p class="muted small">진행 중 궁금한 점이나 추가로 알려 주실 내용을 남겨 주세요. 답변은 메일로도 알려 드립니다.</p>'}
${closed ? '' : `<textarea class="textarea" id="msgText" rows="3" maxlength="4000" placeholder="문의 내용을 적어 주세요"></textarea><button class="btn btn-ghost" type="button" id="msgSend">메시지 보내기</button>`}</div>`;
  }

  designCard() {
    const o = this.o;
    const c = (o.input && o.input.common) || {};
    const t = (o.design && o.design.title) || c.title;
    if (o.service !== 'paper' || !(t || (c.keywords || []).length) || o.deleted) return '';
    let d;
    try { d = buildDesign({ title: t, keywords: c.keywords || [], typeId: (o.input.paper || {}).typeId || 'master', fieldId: c.fieldId || 'other', fieldText: c.fieldText, method: c.method || 'auto', due: c.due || null }); } catch { return ''; }
    return `<details class="card card-design"><summary><span class="card-h"><h2>연구 설계 리포트</h2><span class="small muted">주문할 때 만든 설계안, 작업 준비 단계에서 확정</span></span></summary><div class="sheet">${designReportHtml(d)}</div></details>`;
  }

  paymentsHtml() {
    const ps = this.o.payments || [];
    if (!ps.length) return '';
    const st = { requested: '결제 전', claimed: '확인 중', confirmed: '결제 완료', refunded: '환불', rejected: '확인 안 됨' };
    return `<ul class="pay-list">${ps.map((p) => `<li><span>${p.kind === 'extra' ? esc(p.memo || '추가 결제') : '주문 결제'}<small>${esc(fmtAt(p.confirmedAt || p.at))}</small></span><span class="num">${won(p.amount)}</span><em class="ps ps-${esc(p.status)}">${esc(st[p.status] || p.status)}</em></li>`).join('')}</ul>`;
  }

  uploadBox(slot, idp) {
    const o = this.o;
    const slots = SLOTS_BY_SERVICE[o.service] || ['other'];
    const opts = Array.from(new Set([slot, ...slots]));
    return `<div class="add-files" data-up="${idp}"><div class="af-row"><select class="select" id="${idp}Slot" aria-label="자료 종류">${opts.map((s) => `<option value="${s}"${s === slot ? ' selected' : ''}>${esc(SLOT_LABEL[s] || s)}</option>`).join('')}</select>
<label class="btn btn-soft af-pick">${ICON.up}<span>파일 선택</span><input type="file" multiple id="${idp}File" hidden></label></div>
<ul class="sub-files" id="${idp}List"></ul><p class="hint">파일당 ${Number(this.cfg.settings.maxFileMB || 20)}MB까지 올릴 수 있습니다. 더 큰 파일은 공유 링크를 메시지로 보내 주세요.</p></div>`;
  }

  filesCard() {
    const o = this.o;
    const cf = o.files.customer || [];
    if (!cf.length && !o.allow.upload) return '';
    return `<div class="card" id="myfiles"><div class="card-h"><h2>올린 자료</h2>${cf.length ? `<span class="small muted">${cf.length}개</span>` : ''}</div>
${cf.length ? fileRows(cf, { canDelete: o.allow.deleteFiles }) : '<p class="muted small">올린 자료가 없습니다.</p>'}
${o.allow.upload && o.status !== 'needs_materials' && !o.deleted ? `<details class="af-more"><summary>자료 더 올리기</summary>${this.uploadBox('other', 'add')}</details>` : ''}</div>`;
  }

  nextCard() {
    const o = this.o;
    if (!['delivered', 'completed', 'revision', 'in_progress', 'review'].includes(o.status)) return '';
    const sim = isSimulation(o);
    let addons = [];
    try { addons = sim ? [] : JSON.parse(this.cfg.settings.addonServices || '[]').filter((a) => a.enabled && /^https?:\/\//.test(a.url || '')); } catch { addons = []; }
    const items = ((sim ? NEXT.simulation : NEXT[o.service]) || []).map((n) => `<a href="${url(n.href)}"><b>${esc(n.t)}</b><span>${esc(n.d)}</span></a>`)
      .concat(addons.map((a) => `<a href="${esc(a.url)}" target="_blank" rel="noopener"><b>${esc(a.name)}</b><span>${esc(a.desc || '성균관컨설팅 제휴 서비스')}</span></a>`));
    if (!items.length) return '';
    return `<div class="card"><div class="card-h"><h2>함께 많이 찾는 서비스</h2></div><div class="next-svc">${items.join('')}</div></div>`;
  }

  manageCard() {
    const o = this.o;
    const btns = [];
    if (o.allow.cancel) btns.push('<button class="btn btn-ghost btn-sm" type="button" id="doCancel">주문 취소</button>');
    if (o.allow.deletion) btns.push('<button class="btn btn-ghost btn-sm" type="button" id="doDelete">자료 삭제 요청</button>');
    btns.push('<button class="btn btn-ghost btn-sm" type="button" id="doForget">이 기기에서 주문 지우기</button>');
    return `<div class="card card-manage"><div class="card-h"><h2>주문 관리</h2></div><div class="danger-zone">${btns.join('')}</div>
<p class="hint">결제 후 취소·환불은 메시지로 요청해 주세요. 환불 기준은 <a href="${url('/refund/')}" target="_blank">이용약관의 환불 규정</a>을 따라요.</p></div>`;
  }

  /* -------------------------------------------------------------- 동작 */
  bind() {
    const r = this.root;
    const o = this.o;
    for (const b of $$('[data-dl]', r)) {
      b.addEventListener('click', async () => {
        const all = [...(o.files.results || []), ...(o.files.customer || [])];
        const f = all.find((x) => x.id === b.dataset.dl);
        if (!f) return;
        b.disabled = true;
        await downloadFile(o.orderNo, f);
        b.disabled = false;
      });
    }
    for (const b of $$('[data-rm]', r)) {
      b.addEventListener('click', () => {
        const f = (o.files.customer || []).find((x) => x.id === b.dataset.rm);
        if (!f) return;
        modal({ title: '파일 삭제', html: `<p><b>${esc(f.name)}</b> 파일을 삭제할까요? 삭제한 파일은 되살릴 수 없습니다.</p><button class="btn btn-primary btn-block" type="button" id="rmOk" style="margin-top:12px">삭제하기</button>`, onOpen: (m, close) => {
          m.querySelector('#rmOk').addEventListener('click', async () => { close(); await this.act('deleteFile', { fileId: f.id }, '파일을 삭제했습니다.'); this.refresh(); });
        } });
      });
    }
    for (const idp of ['mat', 'add']) {
      const input = $(`#${idp}File`, r);
      if (input) input.addEventListener('change', () => { this.upload(idp, Array.from(input.files || [])); input.value = ''; });
    }
    const matDone = $('#matDone', r);
    if (matDone) matDone.addEventListener('click', async () => {
      matDone.disabled = true;
      const ok = await this.act('addMessage', { type: 'materials_done', text: '' }, '보완 자료 제출을 알렸습니다. 확인 후 이어서 진행합니다.');
      if (!ok) matDone.disabled = false;
    });
    const rev = $('#revSend', r);
    if (rev) rev.addEventListener('click', async () => {
      const text = $('#revText', r).value.trim();
      if (text.length < 5) { toast('고칠 내용을 구체적으로 적어 주세요.', { error: true }); return; }
      rev.disabled = true;
      const ok = await this.act('addMessage', { type: 'revision', text }, '수정 요청을 보냈습니다.');
      if (!ok) rev.disabled = false;
    });
    const ms = $('#msgSend', r);
    if (ms) ms.addEventListener('click', async () => {
      const text = $('#msgText', r).value.trim();
      if (!text) { toast('내용을 입력해 주세요.', { error: true }); return; }
      ms.disabled = true;
      const ok = await this.act('addMessage', { type: 'question', text }, '메시지를 보냈습니다. 답변은 메일로도 알려 드립니다.');
      if (!ok) ms.disabled = false;
    });
    const cancel = $('#doCancel', r);
    if (cancel) cancel.addEventListener('click', () => modal({ title: '주문 취소', html: '<p>결제 전 주문을 취소합니다. 취소한 주문은 되돌릴 수 없고, 다시 의뢰하려면 신청서를 새로 작성해야 합니다.</p><button class="btn btn-primary btn-block" type="button" id="cOk" style="margin-top:12px">주문 취소하기</button>', onOpen: (m, close) => {
      m.querySelector('#cOk').addEventListener('click', () => { close(); this.act('cancelOrder', {}, '주문을 취소했습니다.'); });
    } }));
    const del = $('#doDelete', r);
    if (del) del.addEventListener('click', () => modal({ title: '자료 삭제 요청', html: `<p>올리신 파일, 결과물, 연구 자료를 삭제합니다. ${['draft', 'quote_requested', 'pending_payment', 'cancelled', 'delivered', 'completed'].includes(o.status) ? '요청하는 즉시 삭제되며 되살릴 수 없습니다. 결제 전 주문은 함께 취소됩니다.' : '작업 중인 주문이라 담당자가 확인한 뒤 지체 없이 삭제하고, 진행 중인 작업은 멈춥니다.'} 거래 기록(주문번호, 결제 내역)은 관련 법령에 따라 정해진 기간 보관 후 파기됩니다.</p><div class="field"><label class="label" for="delWhy">요청 사유(선택)</label><textarea class="textarea" id="delWhy" rows="2" maxlength="500"></textarea></div><button class="btn btn-primary btn-block" type="button" id="dOk" style="margin-top:12px">삭제 요청하기</button>`, onOpen: (m, close) => {
      m.querySelector('#dOk').addEventListener('click', async () => {
        const reason = m.querySelector('#delWhy').value.trim();
        close();
        const res = await this.act('requestDeletion', { reason });
        if (res) toast(res.deleted ? '자료를 삭제했습니다.' : '삭제 요청을 접수했습니다. 확인 후 처리 결과를 알려 드립니다.', { ms: 5000 });
      });
    } }));
    const forget = $('#doForget', r);
    if (forget) forget.addEventListener('click', () => {
      myOrders.remove(this.no);
      clearInterval(this.timer);
      location.href = url('/orders/');
    });
  }

  async upload(idp, files) {
    if (!files.length) return;
    const slot = ($(`#${idp}Slot`, this.root) || {}).value || 'other';
    const list = $(`#${idp}List`, this.root);
    const maxMB = Number(this.cfg.settings.maxFileMB || 20);
    this.busy = true;
    let ok = 0;
    for (const file of files) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${esc(file.name)} <small class="muted">${fmtSize(file.size)}</small></span><b class="now">올리는 중</b>`;
      list.appendChild(li);
      const bad = checkFile(file, slot, maxMB);
      if (bad) { li.querySelector('b').className = 'bad'; li.querySelector('b').textContent = '불가'; toast(`${file.name}: ${bad}`, { error: true, ms: 6000 }); continue; }
      try {
        const data = await blobToBase64(file);
        await api('uploadFile', { orderNo: this.no, token: this.token, slot, name: file.name, mime: file.type || 'application/octet-stream', data }, { retries: 2, timeoutMs: 180000 });
        li.querySelector('b').className = 'ok'; li.querySelector('b').textContent = '완료';
        ok++;
      } catch (e) {
        li.querySelector('b').className = 'bad'; li.querySelector('b').textContent = '실패';
        toast(`${file.name}: ${e.message}`, { error: true, ms: 6000 });
      }
    }
    this.busy = false;
    if (ok) { toast(`${ok}개 파일을 올렸습니다.`); await this.refresh(); this.render(); }
  }
}
