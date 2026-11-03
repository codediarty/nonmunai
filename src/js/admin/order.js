// 운영자 주문 상세: 다음 할 일, 작업지시문, 파일, 기록, 결제·상태 처리
import { aapi, esc, won, toast, fmtAt, etaChip, pill, METHOD_LABEL, STATUS_LABEL, copyText, confirmBox, busy, authLost } from './core.js';
import { workBrief, aiPrompts, customerTemplates, designOf } from './brief.js';
import { designReportHtml } from '../ui/report.js';
import { orderFacts, factsTable, orderTitle, isSimulation } from '../app/order-view.js';
import { blobToBase64, base64ToBlob, saveBlob, fmtSize } from '../app/files.js';

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
    if (o.status === 'quote_requested') items.push(`<div class="nx"><b>견적 확정</b><span>${esc((o.quote && o.quote.quoteReasons || [])[0] || '조건을 확인해 금액을 정해 주세요.')}</span><div><button class="btn btn-primary btn-xs" data-act="quote">견적 작성</button></div></div>`);
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
      return d ? `<div class="ad-card"><p class="hint">주문할 때 고객에게 보여 준 자동 설계안입니다. 고객 원고·목차와 다르면 작업지시문의 고객 자료를 우선합니다.</p><div class="sheet">${designReportHtml(d)}</div></div>` : `<div class="ad-card">${factsTable(orderFacts(o))}<p class="muted small" style="margin-top:12px">연구 설계 리포트는 논문 주문에만 있습니다.</p></div>`;
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
<div class="ad-btnrow"><button class="btn btn-ghost btn-xs" data-act="quote">${o.status === 'quote_requested' ? '견적 작성' : '금액 다시 정하기'}</button><button class="btn btn-ghost btn-xs" data-act="extra">추가 결제 요청</button></div></div>`;
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
        const q = o.quote || {};
        const v = await confirmBox({ title: '확정 견적', html: `<p class="small muted">확정하면 고객에게 결제 안내 메일이 가고, 주문이 결제 대기로 바뀝니다.</p><div class="row-2"><div class="field"><label class="label" for="qT">확정 금액(원)</label><input class="input" id="qT" name="total" type="number" min="1000" step="1000" value="${q.total || o.amount || ''}"></div><div class="field"><label class="label" for="qD">작업 기간(영업일)</label><input class="input" id="qD" name="days" type="number" min="1" value="${q.days || ''}"></div></div><div class="field"><label class="label" for="qE">예상 전달일 <small>비우면 결제 시 계산</small></label><input class="input" id="qE" name="eta" type="date"></div><div class="field"><label class="label" for="qM">고객 안내</label><textarea class="textarea" id="qM" name="message" rows="3" placeholder="견적 근거와 포함 범위를 적어 주세요"></textarea></div>`, ok: '견적 확정' });
        if (!v) return;
        if (!(Number(v.total) > 0)) { toast('금액을 입력해 주세요.', { error: true }); return; }
        this.run(b, 'adminSetQuote', { total: Number(v.total), days: Number(v.days) || undefined, eta: v.eta || undefined, message: v.message }, '견적을 보냈습니다.');
        break;
      }
      case 'extra': {
        const v = await confirmBox({ title: '추가 결제 요청', html: '<div class="field"><label class="label" for="xA">금액(원)</label><input class="input" id="xA" name="amount" type="number" min="1000" step="1000"></div><div class="field"><label class="label" for="xR">사유(고객에게 보임)</label><input class="input" id="xR" name="reason" placeholder="예: 분량 추가 20쪽, 추가 수정 1회"></div>', ok: '요청 보내기' });
        if (!v) return;
        if (!(Number(v.amount) > 0)) { toast('금액을 입력해 주세요.', { error: true }); return; }
        this.run(b, 'adminRequestExtra', { amount: Number(v.amount), reason: v.reason }, '추가 결제를 요청했습니다.');
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
