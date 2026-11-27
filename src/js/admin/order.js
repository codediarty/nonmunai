// 운영자 주문 상세: 다음 할 일, 작업지시문, 파일, 기록, 결제·상태 처리
import { aapi, esc, won, toast, fmtAt, etaChip, pill, METHOD_LABEL, STATUS_LABEL, copyText, confirmBox, busy, authLost } from './core.js';
import { workBrief, aiPrompts, customerTemplates, designOf } from './brief.js';
import { designReportHtml } from '../ui/report.js';
import { orderFacts, factsTable, orderTitle, isSimulation } from '../app/order-view.js';
import { blobToBase64, base64ToBlob, saveBlob, fmtSize } from '../app/files.js';
import { loadConfig } from '../app/api.js';
import { computeQuote, findItem, editLevelOfCode, includesFor, QUOTE_AMOUNTS, QUOTE_MAX, QUOTE_STEP, isQuoteAmount } from '../core/pricing.js';
import { EXTRA_WORK, neededLevel } from '../app/edit-scope.js';
import { statExtras } from '../app/stat-extras.js';
import { unitLink } from '../app/pay-plan.js';

const SLOT = { manuscript: '기존 원고', materials: '참고 자료', toc: '목차', format: '양식', feedback: '피드백', questionnaire: '설문지', proposal: '연구계획서', data: '데이터', prevResult: '기존 분석', codebook: '변수 설명', other: '기타', result: '결과물' };
const STATUS_FLOW = ['quote_requested', 'pending_payment', 'payment_review', 'received', 'checking', 'needs_materials', 'preparing', 'in_progress', 'review', 'delivered', 'revision', 'completed', 'cancelled'];
const PAY_ST = { requested: '결제 대기', claimed: '확인 필요', confirmed: '확인됨', refunded: '환불', cancelled: '취소' };

export async function renderOrder(root, orderNo, go) {
  root.innerHTML = '<div class="ad-loading"><span class="spin spin-dark"></span> 주문을 불러오는 중입니다</div>';
  let o;
  try { o = (await aapi('adminGetOrder', { orderNo })).order; } catch (e) { if (!authLost(e)) root.innerHTML = `<div class="ad-empty">${esc(e.message)} <a href="#orders">목록으로</a></div>`; return; }
  const view = new AdminOrder(root, o, go);
  view.render();
}

// 금액 단추(10만~100만 원)와 그 금액이 아임웹에서 어떻게 결제되는지 안내
function amountChips() {
  return `<div class="am-chips" role="group" aria-label="금액 빠르게 고르기">${QUOTE_AMOUNTS.map((a) => `<button type="button" class="am-chip" data-amt="${a}">${a / 10000}만</button>`).join('')}</div>`;
}
// unit: 1,000원 단위 결제 상품(있으면 10만 원 단위가 아닌 금액도 상품 하나로 바로 결제)
function payHint(n, paid, unit) {
  if (!(n > 0)) return '';
  const total = paid ? ` · 총 주문 금액 ${won(paid + n)}` : '';
  if (isQuoteAmount(n)) return `아임웹 '맞춤 견적 결제 ${won(n)}' 상품으로 고객이 바로 결제해요${total}`;
  if (unit && n % unit.price === 0) return `아임웹 '1,000원 단위 결제' 상품 ${(n / unit.price).toLocaleString('ko-KR')}개로 고객이 바로 결제해요(수량은 자동으로 맞춰져요)${total}`;
  if (n > QUOTE_MAX && n % 100000 === 0) return `100만 원 상품 ${Math.floor(n / QUOTE_MAX)}개${n % QUOTE_MAX ? `와 ${won(n % QUOTE_MAX)} 상품` : ''}을 함께 담아 결제해요${total}`;
  return `10만 원 단위가 아니면 같은 금액 상품이 있을 때만 바로 결제돼요. 없으면 고객이 상담 채널에서 결제 링크를 받아야 해요${total}`;
}
function bindAmount(box, input, paidOf, unit = null) {
  const hint = box.querySelector('[data-pay-hint]');
  const sync = () => {
    const n = Number(input.value) || 0;
    const easy = n % 100000 === 0 || !!(unit && n % unit.price === 0);
    if (hint) { hint.textContent = payHint(n, paidOf(), unit); hint.classList.toggle('is-warn', n > 0 && !easy); }
    box.querySelectorAll('[data-amt]').forEach((c) => c.classList.toggle('is-on', Number(c.dataset.amt) === n));
  };
  box.querySelectorAll('[data-amt]').forEach((c) => c.addEventListener('click', () => { input.value = c.dataset.amt; sync(); input.focus(); }));
  input.addEventListener('input', sync);
  sync();
}

// 금액 창 이름: 견적 요청이면 '견적 보내기', 결제 전이면 '결제 금액 바꾸기', 결제 후면 '추가 결제 요청'
function amountAct(o) {
  if (o.status === 'quote_requested') return { quote: true, button: '견적 보내기', title: '견적 보내기', ok: '견적 보내기' };
  if ((o.paidAmount || 0) > 0) return { button: '추가 결제 요청', title: '추가 결제 요청', ok: '요청 보내기' };
  return { button: '결제 금액 바꾸기', title: '결제 금액 바꾸기', ok: '바꾸고 보내기' };
}

class AdminOrder {
  constructor(root, o, go) { this.root = root; this.o = o; this.go = go; this.tab = sessionStorage.getItem('nm:adtab') || 'brief'; }

  async reload(msg) {
    try { this.o = (await aapi('adminGetOrder', { orderNo: this.o.orderNo })).order; } catch (e) { toast(e.message, { error: true }); }
    this.render();
    if (msg) toast(msg);
  }

  async run(btn, action, payload, msg) {
    busy(btn, true);
    try {
      const r = await aapi(action, { orderNo: this.o.orderNo, ...payload }, { timeoutMs: 180000 });
      if (r.order) this.o = r.order;
      this.render();
      if (msg) toast(msg);
      return r;
    } catch (e) { toast(e.message, { error: true, ms: 6000 }); busy(btn, false); return null; }
  }

  render() {
    const o = this.o;
    const sim = isSimulation(o);
    const claimed = (o.paymentsAll || []).filter((p) => p.status === 'claimed');
    this.root.innerHTML = `<div class="ad-page ad-order">
<div class="ad-crumb"><a href="#">오늘의 작업</a> / <a href="#orders">주문</a> / ${esc(o.orderNo)}</div>
<div class="ad-ohead"><div class="oh-main"><p class="oh-no">${esc(o.orderNo)} · ${esc(o.serviceLabel)} · ${fmtAt(o.createdAt)} 접수${o.paidAt ? ` · ${fmtAt(o.paidAt)} 결제` : ''}</p><h1>${esc(orderTitle(o))}</h1><p class="muted">${esc(o.productName)}${o.summary ? ` · ${esc(o.summary)}` : ''}</p>
<div class="oh-tags">${pill(o.status, o.statusLabel)}${o.status !== 'delivered' && o.status !== 'completed' && o.status !== 'cancelled' ? etaChip(o.eta) : ''}${(o.input && o.input.addons && o.input.addons.priority) ? '<span class="badge badge-amber">우선 처리</span>' : ''}${sim ? '<span class="sim-mark">가상 데이터</span>' : ''}${o.workStartedAt ? `<span class="badge badge-green">착수 ${fmtAt(o.workStartedAt)}</span>` : (['received', 'checking', 'preparing', 'in_progress', 'needs_materials'].includes(o.status) ? '<span class="badge">착수 전</span>' : '')}${claimed.length ? '<span class="badge badge-pen">결제 확인 필요</span>' : ''}${o.deletedState ? `<span class="badge">자료 삭제됨</span>` : ''}</div></div>
<div class="oh-money"><span>주문 금액</span><b class="num">${won(o.amount)}</b><small>결제 ${won(o.paidAmount || 0)}${o.amountDue ? ` · 미결제 ${won(o.amountDue)}` : ''}</small></div></div>
${this.nextHtml()}
<div class="ad-ogrid">
<div class="ad-omain">
<div class="ad-tabs" role="tablist">${[['brief', '작업지시문'], ['prompts', 'AI 작업 프롬프트'], ['design', '연구 설계'], ['files', `파일 ${(o.files.customer.length + o.files.results.length) || ''}`], ['log', `기록·메시지 ${o.messages.length || ''}`]].map(([k, t]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${this.tab === k}" class="${this.tab === k ? 'is-on' : ''}">${t}</button>`).join('')}</div>
<div class="ad-tabbody">${this.tabHtml()}</div>
</div>
<aside class="ad-oside">
${this.customerCard()}
${this.paymentCard()}
${this.statusCard()}
<div class="ad-card"><h2>내부 메모</h2><textarea class="textarea" id="memo" rows="4" placeholder="고객에게 보이지 않는 메모. 입력을 마치면 자동 저장됩니다.">${esc(o.memo || '')}</textarea></div>
<div class="ad-card ad-danger"><h2>자료 삭제</h2><p class="small muted">고객 파일, 결과물, 연구 내용을 영구 삭제합니다. 주문번호와 결제 기록은 남습니다.</p><button class="btn btn-pen btn-sm" type="button" data-act="purge"${o.deletedState ? ' disabled' : ''}>자료 영구 삭제</button></div>
</aside></div></div>`;
    this.bind();
  }

  /* ---------------------------------------------------------------- 다음 할 일 */
  nextHtml() {
    const o = this.o;
    const claimed = (o.paymentsAll || []).filter((p) => p.status === 'claimed');
    const lastCustomer = [...(o.messagesAll || [])].reverse().find((m) => m.from === 'customer' && !m.done);
    const items = [];
    if (claimed.length) items.push(`<div class="nx nx-pay"><b>결제 확인</b><span>${claimed.map((p) => `${METHOD_LABEL[p.method] || p.method} ${won(p.amount)}${p.ref ? ` (${esc(p.ref)})` : ''}`).join(', ')}</span><div><button class="btn btn-primary btn-xs" data-act="confirm" data-pay="${esc(claimed[0].id)}">결제 확인</button><button class="btn btn-ghost btn-xs" data-act="reject" data-pay="${esc(claimed[0].id)}">내역 없음</button></div></div>`);
    if (o.status === 'quote_requested') items.push(`<div class="nx"><b>견적 확정</b><span>${esc((o.quote && o.quote.quoteReasons || [])[0] || '조건을 확인해 금액을 정해 주세요.')}</span><div><button class="btn btn-primary btn-xs" data-act="quote">견적 보내기</button></div></div>`);
    if (['received', 'checking', 'preparing', 'in_progress'].includes(o.status)) {
      items.push(`<div class="nx"><b>작업</b><span>${o.workStartedAt ? '작업지시문을 보며 결과물을 만들고 올려 주세요.' : '작업지시문을 복사해 시작하세요. 착수를 기록해 두면 작업 개시(청약철회 제한)의 근거로 남습니다.'}</span><div><button class="btn btn-dark btn-xs" data-act="copyBrief">지시문 복사</button>${o.workStartedAt ? '' : '<button class="btn btn-ghost btn-xs" data-act="started">착수 기록</button>'}<button class="btn btn-soft btn-xs" data-act="pickResult">결과물 올리기</button><button class="btn btn-ghost btn-xs" data-act="materials">자료 요청</button></div></div>`);
    }
    if (o.status === 'needs_materials') items.push(`<div class="nx"><b>자료 보완 대기</b><span>${o.missingNow && o.missingNow.length ? esc(o.missingNow.join(', ')) : '고객이 자료를 올리고 제출 완료를 누르면 알림이 옵니다.'}</span><div><button class="btn btn-ghost btn-xs" data-act="status" data-to="in_progress">보완 없이 진행</button></div></div>`);
    if (['in_progress', 'review', 'revision'].includes(o.status) && o.files.results.length) items.push(`<div class="nx nx-go"><b>전달</b><span>결과물 ${o.files.results.length}개가 올라가 있습니다. 전달 완료로 바꾸면 고객에게 내려받기 메일이 갑니다.</span><div><button class="btn btn-primary btn-xs" data-act="deliver">전달 완료 처리</button></div></div>`);
    if (o.status === 'revision') items.push(`<div class="nx"><b>수정 요청</b><span>${esc(((o.messagesAll || []).filter((m) => m.type === 'revision').pop() || {}).text || '')}</span><div><button class="btn btn-soft btn-xs" data-act="pickResult">수정본 올리기</button></div></div>`);
    if (lastCustomer && lastCustomer.type !== 'revision') items.push(`<div class="nx"><b>답하지 않은 메시지</b><span>${esc(lastCustomer.text.slice(0, 120))}</span><div><button class="btn btn-ghost btn-xs" data-act="toLog">답장하기</button></div></div>`);
    if (o.status === 'delivered') items.push(`<div class="nx"><b>마무리</b><span>수정 요청 기간이 지나거나 고객이 만족하면 완료로 바꿔 주세요.</span><div><button class="btn btn-ghost btn-xs" data-act="status" data-to="completed">완료 처리</button></div></div>`);
    return items.length ? `<div class="ad-next">${items.join('')}</div><input type="file" id="resultPick" multiple hidden>` : '<input type="file" id="resultPick" multiple hidden>';
  }

  /* ---------------------------------------------------------------- 탭 */
  tabHtml() {
    const o = this.o;
    if (this.tab === 'brief') {
      return `<div class="ad-card"><div class="ad-card-h"><h2>작업지시문</h2><div><button class="btn btn-dark btn-xs" data-act="copyBrief">복사</button><button class="btn btn-ghost btn-xs" data-act="saveBrief">텍스트 파일</button></div></div>
<p class="hint">고객 이름과 연락처는 넣지 않았습니다. 외부 작업자나 AI 도구에 그대로 붙여 넣어도 됩니다.</p><pre class="ad-pre" id="briefText">${esc(workBrief(o))}</pre></div>
<div class="ad-card"><h2>주문 내용</h2>${factsTable(orderFacts(o))}</div>`;
    }
    if (this.tab === 'prompts') {
      const ps = aiPrompts(o);
      return ps.length ? ps.map((p, k) => `<div class="ad-card"><div class="ad-card-h"><h2>${esc(p.title)}</h2><button class="btn btn-soft btn-xs" data-copy-prompt="${k}">복사</button></div><pre class="ad-pre ad-pre-sm">${esc(p.text)}</pre></div>`).join('')
        : '<div class="ad-card"><p class="muted">이 주문 유형에는 준비된 프롬프트가 없습니다. 작업지시문을 사용해 주세요.</p></div>';
    }
    if (this.tab === 'design') {
      const d = o.service === 'paper' ? designOf(o) : null;
      const hint = d && d.draft
        ? '고객이 적은 관심 주제로 만든 자동 설계 초안입니다(고객에게 보여 준 설계가 아닙니다). 고객 데이터가 없는 실증 주제라면 작업지시문의 A안(문헌연구)을 따릅니다.'
        : '주문할 때 고객에게 보여 준 자동 설계안입니다. 고객 원고·목차와 다르면 작업지시문의 고객 자료를 우선합니다.';
      return d ? `<div class="ad-card"><p class="hint">${hint}</p><div class="sheet">${designReportHtml(d)}</div></div>` : `<div class="ad-card">${factsTable(orderFacts(o))}<p class="muted small" style="margin-top:12px">연구 설계 리포트는 논문 주문에만 있습니다.</p></div>`;
    }
    if (this.tab === 'files') {
      const cf = o.files.customer;
      const rf = o.files.results;
      return `<div class="ad-card"><div class="ad-card-h"><h2>고객 자료 ${cf.length}개</h2><div>${cf.length > 1 ? '<button class="btn btn-dark btn-xs" data-act="zip">모두 받기(zip)</button>' : ''}${o.folderUrl ? `<a class="btn btn-ghost btn-xs" href="${esc(o.folderUrl)}" target="_blank" rel="noopener">Drive 폴더</a>` : ''}</div></div>
${cf.length ? `<ul class="ad-files">${cf.map((f) => `<li><span class="badge">${esc(SLOT[f.slot] || f.slot)}</span><span class="fn">${esc(f.name)}</span><span class="fm">${fmtSize(f.size)} · ${fmtAt(f.uploadedAt)}</span><button class="btn btn-soft btn-xs" data-dl="${esc(f.id)}">받기</button></li>`).join('')}</ul>` : '<p class="ad-none">올린 자료가 없습니다.</p>'}
${(o.links || []).length ? `<h3 class="ad-h3">대용량 링크</h3><ul class="ad-files">${o.links.map((l) => `<li><span class="badge">${esc(SLOT[l.slot] || l.slot)}</span><a class="fn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url)}</a></li>`).join('')}</ul>` : ''}</div>
<div class="ad-card"><div class="ad-card-h"><h2>결과물 ${rf.length}개</h2><div><button class="btn btn-primary btn-xs" data-act="pickResult">결과물 올리기</button><button class="btn btn-ghost btn-xs" data-act="sync">Drive에서 가져오기</button></div></div>
<div class="ad-drop" id="resultDrop">여기에 결과물 파일을 끌어 놓으세요${isSimulation(o) ? '<br><b class="pen-t">파일 이름 앞에 [가상데이터_실제연구결과아님]이 자동으로 붙습니다</b>' : ''}</div><ul class="sub-files" id="upList"></ul>
${rf.length ? `<ul class="ad-files">${rf.map((f) => `<li><span class="badge badge-green">결과</span><span class="fn">${esc(f.name)}</span><span class="fm">${fmtSize(f.size)} · ${fmtAt(f.uploadedAt)}</span><button class="btn btn-soft btn-xs" data-dl="${esc(f.id)}">받기</button><button class="btn btn-ghost btn-xs" data-rmres="${esc(f.id)}">삭제</button></li>`).join('')}</ul>` : ''}
<p class="hint">Drive의 주문 폴더(2_결과물)에 직접 넣은 파일은 'Drive에서 가져오기'로 등록합니다. 결과물은 전달 완료로 바꿔야 고객에게 보입니다.</p></div>`;
    }
    // 기록·메시지
    const tpls = customerTemplates(o);
    return `<div class="ad-card"><h2>고객에게 메시지</h2><div class="ad-tpls">${tpls.map((t, k) => `<button type="button" class="btn btn-ghost btn-xs" data-tpl="${k}">${esc(t.label)}</button>`).join('')}</div>
<textarea class="textarea" id="msgText" rows="4" placeholder="고객 주문 페이지와 메일로 전달됩니다."></textarea><div class="ad-row-end"><button class="btn btn-primary btn-sm" data-act="send">보내기</button></div>
${(o.messagesAll || []).length ? `<ul class="msg-list ad-msglist">${o.messagesAll.map((m) => `<li class="msg from-${m.from === 'admin' ? 'admin' : 'customer'}"><small>${m.from === 'admin' ? '운영자' : '고객'} · ${esc({ revision: '수정 요청', materials_done: '보완 제출', question: '문의', reply: '답변', materials: '자료 요청', deletion: '삭제 요청' }[m.type] || m.type)} · ${fmtAt(m.at)}${m.from === 'customer' && !m.done ? ' · <b class="pen-t">미답변</b>' : ''}</small>${esc(m.text).replace(/\n/g, '<br>')}</li>`).join('')}</ul>` : ''}</div>
<div class="ad-card"><h2>진행 기록</h2><ol class="ad-hist">${(o.historyAll || []).slice().reverse().map((h) => `<li><time>${fmtAt(h.at)}</time><div>${h.status ? pill(h.status, STATUS_LABEL[h.status]) : ''}${h.message ? `<p>${esc(h.message)}</p>` : ''}${h.internal ? `<p class="muted small">내부: ${esc(h.internal)}</p>` : ''}<small class="muted">${esc({ system: '자동', admin: '운영자', customer: '고객' }[h.actor] || h.actor)}</small></div></li>`).join('')}</ol></div>`;
  }

  customerCard() {
    const o = this.o;
    const c = o.contact || {};
    const cons = o.consents || {};
    return `<div class="ad-card"><h2>고객</h2><dl class="ad-kv">
<div><dt>이름</dt><dd>${esc(c.name || '-')}</dd></div>
<div><dt>이메일</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '-'}</dd></div>
<div><dt>휴대전화</dt><dd>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '-'}</dd></div>
<div><dt>소식 수신</dt><dd>${cons.marketing ? '동의' : '안 함'}</dd></div>
</dl></div>`;
  }

  paymentCard() {
    const o = this.o;
    const q = o.quote || {};
    return `<div class="ad-card"><h2>금액·결제</h2>
<ul class="pl">${(q.lines || []).map((l) => `<li><span>${esc(l.name)}${l.note ? `<small>${esc(l.note)}</small>` : ''}</span><b class="num">${l.pending ? '견적' : won(l.amount)}</b></li>`).join('')}</ul>
<div class="pl-total"><span>합계</span><b class="num">${won(o.amount)}</b></div>
${(o.paymentsAll || []).length ? `<ul class="ad-pays">${o.paymentsAll.map((p) => `<li><span><b>${p.kind === 'extra' ? '추가' : '본 결제'}</b> ${won(p.amount)}<small>${esc(METHOD_LABEL[p.method] || p.method || '')}${p.ref ? ` · ${esc(p.ref)}` : ''} · ${fmtAt(p.confirmedAt || p.at)}</small></span><em class="ps ps-${esc(p.status)}">${esc(PAY_ST[p.status] || p.status)}</em>${['claimed', 'requested'].includes(p.status) ? `<button class="btn btn-ghost btn-xs" data-act="confirm" data-pay="${esc(p.id)}">확인 처리</button>` : ''}</li>`).join('')}</ul>` : ''}
<div class="ad-btnrow"><button class="btn btn-dark btn-xs" data-act="quote">${amountAct(o).button}</button></div>
${((o.quote && o.quote.changes) || []).length ? `<p class="hint am-last">마지막 변경 ${fmtAt(o.quote.changes.slice(-1)[0].at)} · ${esc(o.quote.changes.slice(-1)[0].reason.slice(0, 60))}</p>` : ''}</div>`;
  }

  statusCard() {
    const o = this.o;
    return `<div class="ad-card"><h2>상태·예정일</h2>
<div class="field"><label class="label" for="stSel">진행 단계</label><select class="select" id="stSel">${STATUS_FLOW.map((s) => `<option value="${s}"${s === o.status ? ' selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select></div>
<div class="field"><label class="label" for="stMsg">고객 안내 <small>비우면 기본 문구</small></label><textarea class="textarea" id="stMsg" rows="2"></textarea></div>
<label class="check"><input type="checkbox" id="stNotify" checked><span>고객에게 메일 보내기</span></label>
<button class="btn btn-dark btn-sm btn-block" data-act="setStatus">단계 바꾸기</button>
<div class="field" style="margin-top:18px"><label class="label" for="etaIn">예상 전달일</label><input class="input" type="date" id="etaIn" value="${esc(o.eta || '')}"></div>
<label class="check"><input type="checkbox" id="etaNotify"><span>바뀐 날짜를 고객에게 알리기</span></label>
<button class="btn btn-ghost btn-sm btn-block" data-act="setEta">예정일 바꾸기</button></div>`;
  }

  /* ---------------------------------------------------------------- 결제 금액 바꾸기·추가 결제 요청 */
  // 창 하나로 처리한다(2026-11-26 단순화). 결제 전이면 결제할 금액을 바꾸고, 결제 후면 추가 금액만 받는다.
  // 금액은 10만 원 단위 단추로 고르면 아임웹 상품 하나로 고객이 바로 결제한다. 첨삭 주문은 '자주 쓰는 추가 작업' 두 가지를
  // 누르면 금액·이유·포함 작업·작업 기간이 채워진다. 이유는 고객 메일에 그대로 실리고, 나머지 칸은 '더 적기'에 접어 둔다
  async amountBox() {
    const o = this.o;
    const paid = o.paidAmount || 0;
    const due = o.amountDue || 0;
    const q = o.quote || {};
    const p = (o.input && o.input.paper) || {};
    const edit = o.service === 'paper' && p.task === 'edit';
    const act = amountAct(o);
    const curInc = includesFor(q.includes || [], p.pages);
    const ceil = (n) => Math.max(QUOTE_STEP, Math.ceil(n / QUOTE_STEP) * QUOTE_STEP);
    let unit = null;
    try { unit = unitLink((await loadConfig()).settings); } catch { unit = null; }
    let extras = [];
    if (edit) {
      try {
        const cfg = await loadConfig();
        extras = EXTRA_WORK.map((x) => {
          const r = computeQuote(cfg.catalog, { service: 'paper', paper: { typeId: p.typeId, task: 'edit', pages: p.pages, editLevel: x.level } });
          const lv = editLevelOfCode(r.mainCode);
          if (!lv || lv.id !== x.level || r.quoteRequired) return null;
          // 결제 후에는 이미 낸 금액을 빼고 10만 원 단위로 올려서 추가로 받고, 결제 전에는 그 작업까지 들어간 금액으로 바꾼다
          return { ...x, amount: paid ? ceil(r.total - paid) : r.total, days: r.days };
        }).filter(Boolean);
      } catch { extras = []; }
    }
    // 설문 응답 분석·통계분석: 매개·조절효과 분석(T-ADV)을 고객이 적었거나 데이터를 보고 필요하면 한 번에 채운다(2026-11-27)
    const st = (o.input && o.input.statistics) || {};
    const sv = (o.input && o.input.survey) || {};
    const advOk = (o.service === 'statistics' && st.hasData !== false && st.output !== 'revise' && !st.advanced) || (o.service === 'survey' && sv.mode === 'analyze' && !sv.advanced);
    if (advOk && !(q.lines || []).some((l) => l.code === 'T-ADV')) {
      try {
        const cfg = await loadConfig();
        const it = findItem(cfg.catalog, 'T-ADV');
        if (it) extras.push({ level: 'adv', label: '매개·조절효과 분석', amount: paid ? it.price : (o.amount || 0) + it.price, days: (q.days || 0) + (it.days || 0), work: ['PROCESS Macro 매개·조절효과 분석(부트스트래핑)'], reason: '요청하신 매개·조절효과 분석은 기본 분석에 들어 있지 않은 심화 분석이라 그만큼 금액을 안내드려요.' });
      } catch { /* 가격표를 못 받으면 단추 없이 */ }
    }
    const advNeed = advOk && statExtras(`${((o.input && o.input.common) || {}).title || ''}\n${((o.input && o.input.common) || {}).request || ''}`).some((x) => x.key === 'adv');
    const need = edit ? neededLevel(`${((o.input && o.input.common) || {}).request || ''}\n${p.editScope || ''}`) : advNeed ? 'adv' : 'basic';
    const REASONS = [
      ['범위', '요청하신 작업이 처음 결제하신 범위보다 넓어서 그만큼 금액을 안내드려요.'],
      ['분량', '보내 주신 원고 분량이 주문서에 적은 분량보다 많아서 늘어난 분량만큼 금액을 안내드려요.'],
      ['일정', '요청하신 제출 일정에 맞추려면 우선 처리가 필요해서 금액을 안내드려요.'],
      ['추가 요청', '주문 뒤에 요청하신 추가 작업을 함께 진행하려고 금액을 안내드려요.'],
      ['상담 견적', '상담에서 말씀 나눈 작업 범위와 일정으로 금액을 정했어요.'],
    ];
    const extraBtns = extras.length ? `<div class="field"><span class="label">자주 쓰는 추가 작업 <small>누르면 금액과 이유가 채워져요${p.pages ? `(${p.pages} Page 기준)` : ''}</small></span><div class="am-lv am-x">${extras.map((x) => `<button type="button" class="am-lv-b" data-xw="${x.level}"><b>${esc(x.label)}</b><span class="num">${paid ? '+' : ''}${won(x.amount)}</span>${x.level === need ? '<i>요청과 맞음</i>' : ''}</button>`).join('')}</div></div>` : '';
    const html = `<div class="am-now"><span>주문 금액<b class="num">${won(o.amount || 0)}</b></span><span>결제 완료<b class="num">${won(paid)}</b></span><span>결제 대기<b class="num">${won(due)}</b></span></div>
${paid ? `<p class="hint am-note">이미 결제한 ${won(paid)}은 그대로 두고, 아래 금액만 <b>추가로</b> 받아요.</p>` : ''}
${extraBtns}
<div class="field"><label class="label" for="amA">${paid ? '추가로 받을 금액(원)' : '고객이 결제할 금액(원)'}</label>${amountChips()}
<input class="input" id="amA" name="amount" type="number" min="1000" step="1000" value="${paid ? '' : (due || o.amount || '')}"><p class="hint am-pay" data-pay-hint></p></div>
<div class="field"><label class="label" for="amR">${act.quote ? '견적 설명' : '이유'} <small>고객 메일에 그대로 실려요</small></label><div class="am-rs">${REASONS.map(([k, t]) => `<button type="button" class="am-r" data-r="${esc(t)}">${esc(k)}</button>`).join('')}</div>
<textarea class="textarea" id="amR" name="reason" rows="3" placeholder="예: 적어 주신 AI 문체 교정과 인용 정리는 기본 교정에 없는 작업이라 추가로 안내드려요."></textarea></div>
<details class="am-more"${act.quote ? ' open' : ''}><summary>포함 작업·작업 기간·예상 전달일 더 적기(선택)</summary>
<div class="field"><label class="label" for="amS">이 금액에 들어 있는 작업 <small>한 줄에 하나, 고객 메일과 주문 화면에 보여요</small></label><textarea class="textarea" id="amS" name="scope" rows="4">${esc(curInc.join('\n'))}</textarea></div>
<div class="row-2"><div class="field"><label class="label" for="amD">작업 기간(영업일)</label><input class="input" id="amD" name="days" type="number" min="1" value="${q.days || ''}"></div><div class="field"><label class="label" for="amE">예상 전달일 <small>비우면 그대로</small></label><input class="input" id="amE" name="eta" type="date"></div></div></details>
<label class="check"><input type="checkbox" name="notify" checked><span>고객에게 메일 보내기(금액, 이유, 바로 결제 버튼)</span></label>`;
    const v = await confirmBox({
      title: act.title,
      html,
      ok: act.ok,
      wide: true,
      onOpen: (box) => {
        const amt = box.querySelector('#amA');
        bindAmount(box, amt, () => paid, unit);
        const reason = box.querySelector('#amR');
        box.querySelectorAll('[data-r]').forEach((btn) => btn.addEventListener('click', () => {
          reason.value = reason.value.trim() ? `${reason.value.trim()} ${btn.dataset.r}` : btn.dataset.r;
          reason.focus();
        }));
        box.querySelectorAll('[data-xw]').forEach((btn) => btn.addEventListener('click', () => {
          const x = extras.find((e) => e.level === btn.dataset.xw);
          if (!x) return;
          box.querySelectorAll('[data-xw]').forEach((e) => e.classList.toggle('is-on', e === btn));
          amt.value = x.amount;
          amt.dispatchEvent(new Event('input'));
          const keep = curInc.filter((l) => !x.work.includes(l));
          box.querySelector('#amS').value = [...keep, ...x.work].join('\n');
          if (x.days) box.querySelector('#amD').value = x.days;
          if (!reason.value.trim() || extras.some((e) => e.reason === reason.value.trim())) reason.value = x.reason;
        }));
      },
      validate: (x) => (!(Number(x.amount) >= 1000) ? (paid ? '추가로 받을 금액을 입력해 주세요.' : '고객이 결제할 금액을 입력해 주세요.') : !String(x.reason || '').trim() ? '이유를 적어 주세요. 고객 메일에 그대로 실려요.' : ''),
    });
    if (!v) return null;
    return {
      amount: Number(v.amount), reason: String(v.reason).trim(), scope: String(v.scope || '').split('\n').map((x) => x.trim()).filter(Boolean),
      days: Number(v.days) || undefined, eta: v.eta || undefined, notify: !!v.notify,
    };
  }

  /* ---------------------------------------------------------------- 동작 */
  bind() {
    const r = this.root;
    const o = this.o;
    r.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab; sessionStorage.setItem('nm:adtab', this.tab); this.render(); }));
    const memo = r.querySelector('#memo');
    memo.addEventListener('change', async () => { try { await aapi('adminSetMemo', { orderNo: o.orderNo, memo: memo.value }); toast('메모를 저장했습니다.'); o.memo = memo.value; } catch (e) { toast(e.message, { error: true }); } });
    const pick = r.querySelector('#resultPick');
    pick.addEventListener('change', () => { this.uploadResults(Array.from(pick.files || [])); pick.value = ''; });
    const drop = r.querySelector('#resultDrop');
    if (drop) {
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); this.uploadResults(Array.from(e.dataTransfer.files || [])); });
      drop.addEventListener('click', () => pick.click());
    }
    r.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => this.download(b, b.dataset.dl)));
    r.querySelectorAll('[data-rmres]').forEach((b) => b.addEventListener('click', async () => {
      const v = await confirmBox({ title: '결과물 삭제', html: '<p>이 결과물을 삭제할까요? Drive에서도 영구 삭제됩니다.</p>', ok: '삭제', danger: true });
      if (v) this.run(b, 'adminDeleteFile', { fileId: b.dataset.rmres }, '결과물을 삭제했습니다.');
    }));
    r.querySelectorAll('[data-copy-prompt]').forEach((b) => b.addEventListener('click', async () => {
      const ok = await copyText(aiPrompts(o)[Number(b.dataset.copyPrompt)].text);
      toast(ok ? '프롬프트를 복사했습니다.' : '복사하지 못했습니다.', { error: !ok });
    }));
    r.querySelectorAll('[data-tpl]').forEach((b) => b.addEventListener('click', () => { r.querySelector('#msgText').value = customerTemplates(o)[Number(b.dataset.tpl)].text; r.querySelector('#msgText').focus(); }));
    r.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => this.action(b.dataset.act, b)));
  }

  async action(act, b) {
    const o = this.o;
    const r = this.root;
    switch (act) {
      case 'copyBrief': { const ok = await copyText(workBrief(o)); toast(ok ? '작업지시문을 복사했습니다.' : '복사하지 못했습니다.', { error: !ok }); break; }
      case 'saveBrief': saveBlob(new Blob([workBrief(o)], { type: 'text/plain;charset=utf-8' }), `${o.orderNo}_작업지시문.txt`); break;
      case 'started': this.run(b, 'adminMarkStarted', {}, '착수를 기록했습니다.'); break;
      case 'pickResult': r.querySelector('#resultPick').click(); break;
      case 'toLog': this.tab = 'log'; sessionStorage.setItem('nm:adtab', 'log'); this.render(); this.root.querySelector('#msgText').focus(); break;
      case 'sync': { const res = await this.run(b, 'adminSyncResults', {}); if (res) toast(res.added.length ? `${res.added.length}개를 가져왔습니다.` : '새로 넣은 파일이 없습니다.'); break; }
      case 'zip': await this.zipAll(b); break;
      case 'send': {
        const text = r.querySelector('#msgText').value.trim();
        if (!text) { toast('메시지를 입력해 주세요.', { error: true }); return; }
        this.run(b, 'adminSendMessage', { text }, '메시지를 보냈습니다.');
        break;
      }
      case 'confirm': {
        const p = (o.paymentsAll || []).find((x) => x.id === b.dataset.pay);
        const v = await confirmBox({ title: '결제 확인', html: `<p>${p ? `${p.kind === 'extra' ? '추가 결제' : '본 결제'} <b>${won(p.amount)}</b>` : '결제'}를 확인 처리합니다.</p><div class="row-2"><div class="field"><label class="label" for="cfAmt">확인 금액</label><input class="input" id="cfAmt" name="amount" type="number" value="${p ? p.amount : ''}"></div><div class="field"><label class="label" for="cfM">결제 수단</label><select class="select" id="cfM" name="method">${['skkc', 'bank', 'toss'].map((m) => `<option value="${m}"${p && p.method === m ? ' selected' : ''}>${METHOD_LABEL[m]}</option>`).join('')}</select></div></div>`, ok: '결제 확인' });
        if (v) this.run(b, 'adminConfirmPayment', { paymentId: b.dataset.pay, amount: Number(v.amount) || undefined, method: v.method }, '결제를 확인했습니다.');
        break;
      }
      case 'reject': {
        const v = await confirmBox({ title: '결제 내역 없음', html: '<div class="field"><label class="label" for="rj">고객 안내</label><textarea class="textarea" id="rj" name="message" rows="3">결제 내역을 확인하지 못했습니다. 결제하신 이름과 시각을 메시지로 알려 주시면 다시 확인하겠습니다.</textarea></div>', ok: '안내 보내기', danger: true });
        if (v) this.run(b, 'adminRejectClaim', { paymentId: b.dataset.pay, message: v.message }, '고객에게 안내했습니다.');
        break;
      }
      case 'quote': {
        const v = await this.amountBox();
        if (!v) return;
        this.run(b, 'adminChangeAmount', v, v.notify ? `${won(v.amount)} ${o.paidAmount ? '추가 결제' : '결제'} 안내 메일을 보냈습니다.` : '금액을 바꿨습니다.');
        break;
      }
      case 'materials': {
        const v = await confirmBox({ title: '자료 보완 요청', html: '<div class="field"><label class="label" for="mI">필요한 자료 <small>한 줄에 하나</small></label><textarea class="textarea" id="mI" name="items" rows="3" placeholder="학교 논문 양식 파일\n설문 원자료(엑셀)"></textarea></div><div class="field"><label class="label" for="mM">설명</label><textarea class="textarea" id="mM" name="message" rows="2"></textarea></div><p class="small muted">주문이 \'자료 보완 필요\'로 바뀌고 고객에게 메일이 갑니다.</p>', ok: '요청 보내기' });
        if (!v) return;
        this.run(b, 'adminRequestMaterials', { items: String(v.items || '').split('\n').map((s) => s.trim()).filter(Boolean), message: v.message }, '자료 보완을 요청했습니다.');
        break;
      }
      case 'deliver': {
        const v = await confirmBox({ title: '전달 완료', html: `<p>결과물 ${o.files.results.length}개를 고객에게 공개하고 내려받기 메일을 보냅니다.</p><ul class="small">${o.files.results.map((f) => `<li>${esc(f.name)}</li>`).join('')}</ul><div class="field"><label class="label" for="dM">함께 보낼 안내 <small>선택</small></label><textarea class="textarea" id="dM" name="message" rows="2"></textarea></div>`, ok: '전달 완료' });
        if (v) this.run(b, 'adminUpdateStatus', { status: 'delivered', message: v.message || '' }, '전달 완료로 바꿨습니다.');
        break;
      }
      case 'status': this.run(b, 'adminUpdateStatus', { status: b.dataset.to }, '단계를 바꿨습니다.'); break;
      case 'setStatus': {
        const status = r.querySelector('#stSel').value;
        if (status === o.status) { toast('지금과 같은 단계입니다.', { error: true }); return; }
        this.run(b, 'adminUpdateStatus', { status, message: r.querySelector('#stMsg').value.trim(), notify: r.querySelector('#stNotify').checked }, `${STATUS_LABEL[status]} 단계로 바꿨습니다.`);
        break;
      }
      case 'setEta': {
        const eta = r.querySelector('#etaIn').value;
        if (!eta) { toast('날짜를 고르세요.', { error: true }); return; }
        this.run(b, 'adminSetEta', { eta, notify: r.querySelector('#etaNotify').checked }, '예정일을 바꿨습니다.');
        break;
      }
      case 'purge': {
        const v = await confirmBox({ title: '자료 영구 삭제', html: '<p>고객 파일, 결과물, 연구 내용을 <b>되살릴 수 없게</b> 삭제합니다. 진행 중인 주문이라면 작업도 멈춰야 합니다.</p><div class="field"><label class="label" for="pR">사유</label><input class="input" id="pR" name="reason" placeholder="예: 고객 요청"></div><label class="check"><input type="checkbox" name="sure"><span>되살릴 수 없다는 것을 확인했습니다</span></label>', ok: '영구 삭제', danger: true });
        if (!v) return;
        if (!v.sure) { toast('확인란을 체크해 주세요.', { error: true }); return; }
        this.run(b, 'adminPurgeOrder', { reason: v.reason }, '자료를 삭제했습니다.');
        break;
      }
      default: break;
    }
  }

  async download(btn, id) {
    const o = this.o;
    const f = [...o.files.customer, ...o.files.results].find((x) => x.id === id);
    busy(btn, true);
    try {
      const res = await aapi('adminDownloadFile', { orderNo: o.orderNo, fileId: id }, { timeoutMs: 180000 });
      saveBlob(base64ToBlob(res.data, res.mime), res.name || (f && f.name) || 'file');
    } catch (e) { toast(e.message, { error: true }); }
    busy(btn, false);
  }

  async zipAll(btn) {
    const o = this.o;
    busy(btn, true, '압축 중');
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const used = {};
      for (const f of o.files.customer) {
        const res = await aapi('adminDownloadFile', { orderNo: o.orderNo, fileId: f.id }, { timeoutMs: 180000 });
        let name = `${SLOT[f.slot] || f.slot}_${res.name || f.name}`;
        if (used[name]) name = name.replace(/(\.[^.]+)?$/, `_${++used[name]}$1`); else used[name] = 1;
        zip.file(name, res.data, { base64: true });
      }
      zip.file('작업지시문.txt', workBrief(o));
      const blob = await zip.generateAsync({ type: 'blob' });
      saveBlob(blob, `${o.orderNo}_고객자료.zip`);
    } catch (e) { toast(e.message, { error: true }); }
    busy(btn, false);
  }

  async uploadResults(files) {
    if (!files.length) return;
    const o = this.o;
    if (this.tab !== 'files') { this.tab = 'files'; sessionStorage.setItem('nm:adtab', 'files'); this.render(); }
    const list = this.root.querySelector('#upList');
    let ok = 0;
    for (const file of files) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${esc(file.name)} <small class="muted">${fmtSize(file.size)}</small></span><b class="now">올리는 중</b>`;
      list.appendChild(li);
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error('20MB를 넘는 파일은 Drive 주문 폴더(2_결과물)에 직접 넣고 Drive에서 가져오기를 눌러 주세요.');
        const data = await blobToBase64(file);
        await aapi('adminUploadResult', { orderNo: o.orderNo, name: file.name, mime: file.type || 'application/octet-stream', data }, { timeoutMs: 300000 });
        li.querySelector('b').className = 'ok'; li.querySelector('b').textContent = '완료';
        ok++;
      } catch (e) {
        li.querySelector('b').className = 'bad'; li.querySelector('b').textContent = '실패';
        toast(`${file.name}: ${e.message}`, { error: true, ms: 7000 });
      }
    }
    if (ok) this.reload(`결과물 ${ok}개를 올렸습니다. 전달 완료로 바꾸면 고객에게 공개됩니다.`);
  }
}
