// 신청서(위저드) 공통 틀: 한 화면에 한 질문, 조건부 단계, 실시간 견적·설계, 자동 저장, 파일 칸
import { $, $$, esc, toast, store, debounce, url, modal } from '../ui/dom.js';
import { api, apiReady, myOrders, ApiError } from './api.js';
import { putBlob, getBlob, delBlob, checkFile, fmtSize, blobToBase64, MAX_FILES, extOf } from './files.js';
import { won } from '../core/render.js';

export const ICON = {
  check: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  up: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>',
  file: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  x: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  info: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  warn: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  spark: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>',
};

/* ------------------------------------------------------------------ 상태 경로 */
export function getAt(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
export function setAt(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
  o[ks[ks.length - 1]] = val;
}

/* ------------------------------------------------------------------ 입력 부품 */
export function choice(path, value, options, { multi = false, cols = 1, compact = false } = {}) {
  const vals = multi ? (value || []) : [value];
  return `<div class="opts${cols > 1 ? ` opts-${cols}` : ''}${compact ? ' opts-compact' : ''}" role="${multi ? 'group' : 'radiogroup'}">${options.map((o) => {
    const on = vals.includes(o.v);
    return `<label class="opt${on ? ' is-on' : ''}${o.rec ? ' is-rec' : ''}"><input type="${multi ? 'checkbox' : 'radio'}" name="${path}" value="${esc(o.v)}"${on ? ' checked' : ''} data-choice="${path}"${multi ? ' data-multi="1"' : ''}><span class="opt-mark" aria-hidden="true">${ICON.check}</span><span class="opt-txt"><b>${esc(o.t)}${o.badge ? ` <em class="opt-badge">${esc(o.badge)}</em>` : ''}</b>${o.d ? `<small>${esc(o.d)}</small>` : ''}</span>${o.side ? `<span class="opt-side">${esc(o.side)}</span>` : ''}</label>`;
  }).join('')}</div>`;
}

export function textField(path, value, { label = '', placeholder = '', type = 'text', hint = '', required = false, max = 200, inputmode = '', autocomplete = 'off', id = '' } = {}) {
  const fid = id || `f_${path.replace(/\./g, '_')}`;
  return `<div class="field">${label ? `<label class="label" for="${fid}">${esc(label)}${required ? '<span class="req">*</span>' : ''}</label>` : ''}<input class="input" id="${fid}" type="${type}" data-path="${path}" value="${esc(value ?? '')}" placeholder="${esc(placeholder)}" maxlength="${max}"${inputmode ? ` inputmode="${inputmode}"` : ''} autocomplete="${autocomplete}">${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
}

export function textArea(path, value, { label = '', placeholder = '', hint = '', rows = 4, max = 4000, required = false, cls = '' } = {}) {
  const fid = `f_${path.replace(/\./g, '_')}`;
  return `<div class="field">${label ? `<label class="label" for="${fid}">${esc(label)}${required ? '<span class="req">*</span>' : ''}</label>` : ''}<textarea class="textarea ${cls}" id="${fid}" rows="${rows}" data-path="${path}" placeholder="${esc(placeholder)}" maxlength="${max}">${esc(value ?? '')}</textarea>${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
}

export function selectField(path, value, options, { label = '', hint = '' } = {}) {
  const fid = `f_${path.replace(/\./g, '_')}`;
  return `<div class="field">${label ? `<label class="label" for="${fid}">${esc(label)}</label>` : ''}<select class="select" id="${fid}" data-path="${path}">${options.map((o) => `<option value="${esc(o.v)}"${String(o.v) === String(value ?? '') ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select>${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
}

export const SLOT_LABEL = {
  manuscript: '기존 원고', materials: '참고 자료', toc: '목차', format: '학교·학술지 양식', feedback: '피드백 자료',
  questionnaire: '설문지', proposal: '연구계획서', data: '데이터 파일', prevResult: '기존 분석 결과', codebook: '변수 설명', other: '기타 자료',
};

export function uploader(state, slot, { label, required = false, hint = '', accept = '' } = {}) {
  const files = (state.files || []).filter((f) => f.slot === slot);
  const link = (state.links || []).find((l) => l.slot === slot);
  return `<div class="up" data-up="${slot}">
<div class="up-hd"><b>${esc(label || SLOT_LABEL[slot])}${required ? '<span class="req">*</span>' : ' <span class="muted up-opt">선택</span>'}</b>${files.length ? `<span class="up-count">${files.length}개</span>` : ''}</div>
<label class="drop" data-drop="${slot}"><input type="file" multiple data-file="${slot}"${accept ? ` accept="${accept}"` : ''}><span class="drop-ic">${ICON.up}</span><span class="drop-t">파일을 끌어 놓거나 <u>선택</u>하세요</span><span class="drop-h">${hint || '파일당 20MB까지, 여러 개 올릴 수 있습니다'}</span></label>
${files.length ? `<ul class="up-list">${files.map((f) => `<li class="up-item" data-fid="${f.id}"><span class="up-ic">${ICON.file}</span><span class="up-name">${esc(f.name)}</span><span class="up-size">${fmtSize(f.size)}</span><button type="button" class="up-del" data-del="${f.id}" aria-label="${esc(f.name)} 삭제">${ICON.x}</button></li>`).join('')}</ul>` : ''}
<div class="up-err" role="alert" data-err="${slot}"></div>
<details class="up-link"${link && link.url ? ' open' : ''}><summary>20MB가 넘는 파일은 링크로 보내기</summary><input class="input" type="url" placeholder="구글 드라이브·네이버 MYBOX 등 공유 링크" data-link="${slot}" value="${esc(link ? link.url : '')}"></details>
</div>`;
}

export function note(html, kind = '') { return `<div class="note${kind ? ' note-' + kind : ''}">${kind === 'pen' || kind === 'amber' ? ICON.warn : ICON.info}<div>${html}</div></div>`; }

export function hasSlot(state, slot) {
  return (state.files || []).some((f) => f.slot === slot) || (state.links || []).some((l) => l.slot === slot && /^https?:\/\//.test(l.url || ''));
}

/* ------------------------------------------------------------------ 위저드 */
export function createWizard(opts) {
  const { root, key, title, steps, sidePanel, mobileSummary, defaults, prefill, onSubmit, onFileAdded } = opts;
  const draftKey = `draft:${key}`;
  let state = JSON.parse(JSON.stringify(defaults));
  const saved = store.get(draftKey);
  let resumable = saved && saved.v === defaults.v && saved.touched ? saved : null;
  if (prefill) prefill(state);
  let cur = 0;
  let sheetOpen = false;

  const visible = () => steps.filter((s) => !s.when || s.when(state));
  const save = debounce(() => store.set(draftKey, { ...state, touched: true, stepId: visible()[cur] ? visible()[cur].id : '' }), 250);

  root.innerHTML = `<div class="wz">
<div class="wz-top"><div class="wrap wz-top-in"><div class="wz-title"><h1>${esc(title)}</h1><span class="wz-count" id="wzCount"></span></div><div class="wz-bar" aria-hidden="true"><i id="wzBar"></i></div></div></div>
<div class="wrap wz-grid"><section class="wz-main"><div id="wzResume"></div><form class="wz-step" id="wzStep" novalidate autocomplete="off"></form></section>
<aside class="wz-side" id="wzSide" aria-label="실시간 견적과 설계"><div class="wz-side-in" id="wzSideIn"></div></aside></div>
<div class="wz-mbar" id="wzMbar"></div></div>`;
  const stepEl = $('#wzStep', root);
  const sideEl = $('#wzSideIn', root);
  const sideWrap = $('#wzSide', root);
  const mbar = $('#wzMbar', root);

  if (resumable) {
    $('#wzResume', root).innerHTML = `<div class="resume">${ICON.info}<span>작성하던 주문서가 있습니다.</span><button type="button" class="btn btn-soft btn-sm" id="rsYes">이어서 작성</button><button type="button" class="btn btn-ghost btn-sm" id="rsNo">새로 시작</button></div>`;
    $('#rsYes', root).addEventListener('click', () => {
      state = { ...JSON.parse(JSON.stringify(defaults)), ...resumable };
      const idx = visible().findIndex((s) => s.id === resumable.stepId);
      cur = idx >= 0 ? idx : 0;
      $('#wzResume', root).innerHTML = '';
      render();
    });
    $('#rsNo', root).addEventListener('click', async () => {
      for (const f of resumable.files || []) await delBlob(f.id);
      store.del(draftKey);
      resumable = null;
      $('#wzResume', root).innerHTML = '';
    });
  }

  const ctx = {
    get state() { return state; },
    set(path, val, { rerender = false } = {}) { setAt(state, path, val); state.touched = true; save(); if (rerender) renderStep(); refreshSide(); },
    rerender() { renderStep(); refreshSide(); },
    refreshSide: () => refreshSide(),
    go(i) { cur = i; render(); },
  };

  const refreshSide = debounce(() => {
    sideEl.innerHTML = sidePanel(state, ctx);
    mbar.innerHTML = mobileSummary(state, ctx) + `<button type="button" class="btn btn-ghost btn-sm" id="wzSheetBtn">${sheetOpen ? '닫기' : '미리보기'}</button>`;
    $('#wzSheetBtn', mbar).addEventListener('click', () => { sheetOpen = !sheetOpen; sideWrap.classList.toggle('is-open', sheetOpen); refreshSide(); });
    if (opts.afterSide) opts.afterSide(sideEl, state, ctx);
  }, 90);

  function renderStep() {
    const vs = visible();
    if (cur >= vs.length) cur = vs.length - 1;
    const s = vs[cur];
    const last = cur === vs.length - 1;
    $('#wzCount', root).textContent = `${cur + 1} / ${vs.length}단계`;
    $('#wzBar', root).style.width = `${((cur + 1) / vs.length) * 100}%`;
    stepEl.dataset.step = s.id;
    stepEl.innerHTML = `<h2 class="wz-q">${s.title}</h2>${s.help ? `<p class="wz-help">${s.help}</p>` : ''}<div class="wz-body">${s.render(state, ctx)}</div><p class="wz-err" role="alert" id="wzErr"></p>
<div class="wz-nav">${cur > 0 ? '<button type="button" class="btn btn-ghost btn-lg" data-prev>이전</button>' : '<span></span>'}<button type="submit" class="btn btn-primary btn-lg" id="wzNext">${last ? (s.submitLabel ? s.submitLabel(state) : '제출하기') : '다음'}</button></div>`;
    if (s.bind) s.bind(stepEl, state, ctx);
    const first = stepEl.querySelector('input:not([type=hidden]):not([type=file]),textarea,select');
    if (first && !matchMedia('(max-width: 860px)').matches && s.autofocus !== false) setTimeout(() => first.focus({ preventScroll: true }), 30);
  }

  function render() { renderStep(); refreshSide(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  // 입력 이벤트 위임
  stepEl.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.path) {
      let v = t.value;
      if (t.type === 'number') v = t.value === '' ? null : Number(t.value);
      setAt(state, t.dataset.path, v);
      state.touched = true;
      save();
      refreshSide();
      const s = visible()[cur];
      if (s.onInput) s.onInput(t, state, ctx);
    }
    if (t.dataset.link) {
      state.links = (state.links || []).filter((l) => l.slot !== t.dataset.link);
      if (t.value.trim()) state.links.push({ slot: t.dataset.link, url: t.value.trim() });
      save();
    }
  });
  stepEl.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.choice) {
      const path = t.dataset.choice;
      if (t.dataset.multi) {
        const vals = $$(`input[name="${CSS.escape(path)}"]:checked`, stepEl).map((x) => x.value);
        const s = visible()[cur];
        setAt(state, path, s.normalizeMulti ? s.normalizeMulti(vals, t.value, t.checked) : vals);
      } else setAt(state, path, t.value);
      state.touched = true;
      save();
      const s = visible()[cur];
      if (s.onChoice) s.onChoice(path, t.value, state, ctx);
      renderStep();
      refreshSide();
    } else if (t.dataset.path && t.tagName === 'SELECT') {
      setAt(state, t.dataset.path, t.value);
      save();
      const s = visible()[cur];
      if (s.onChoice) s.onChoice(t.dataset.path, t.value, state, ctx);
      if (t.dataset.rerender) renderStep();
      refreshSide();
    } else if (t.type === 'checkbox' && t.dataset.bool) {
      setAt(state, t.dataset.bool, t.checked);
      save();
      refreshSide();
    } else if (t.dataset.file) {
      await addFiles(t.dataset.file, Array.from(t.files || []));
      t.value = '';
    }
  });
  stepEl.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      const id = del.dataset.del;
      state.files = (state.files || []).filter((f) => f.id !== id);
      await delBlob(id);
      save();
      renderStep();
      refreshSide();
    }
    if (e.target.closest('[data-prev]')) { cur = Math.max(0, cur - 1); render(); }
    const g = e.target.closest('[data-goto]');
    if (g) { const idx = visible().findIndex((x) => x.id === g.dataset.goto); if (idx >= 0) { cur = idx; render(); } }
  });
  stepEl.addEventListener('dragover', (e) => { const d = e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('is-over'); } });
  stepEl.addEventListener('dragleave', (e) => { const d = e.target.closest('[data-drop]'); if (d) d.classList.remove('is-over'); });
  stepEl.addEventListener('drop', async (e) => {
    const d = e.target.closest('[data-drop]');
    if (!d) return;
    e.preventDefault();
    d.classList.remove('is-over');
    await addFiles(d.dataset.drop, Array.from(e.dataTransfer.files || []));
  });
  stepEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const vs = visible();
    const s = vs[cur];
    const err = s.valid ? s.valid(state) : null;
    if (err) { $('#wzErr', root).textContent = err; $('#wzErr', root).scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (cur < vs.length - 1) { cur++; render(); return; }
    // 마지막 단계: 앞 단계 전체 검증
    for (let i = 0; i < vs.length; i++) {
      const er = vs[i].valid ? vs[i].valid(state) : null;
      if (er) { cur = i; render(); setTimeout(() => { const el = $('#wzErr', root); if (el) el.textContent = er; }, 60); return; }
    }
    // 지금 고른 분기에 보이는 파일 칸만 보낸다. 중간에 분기를 바꾸기 전에 올린 파일은 빼고 접수한다
    const html = vs.map((x) => { try { return x.render(state, ctx); } catch { return ''; } }).join('');
    const slots = new Set([...html.matchAll(/data-up="([^"]+)"/g)].map((m) => m[1]));
    const keepFile = (f) => slots.has(f.slot);
    const view = { files: (state.files || []).filter(keepFile), links: (state.links || []).filter(keepFile), dropped: (state.files || []).filter((f) => !keepFile(f)).map((f) => f.id) };
    // 읽을 때만 걸러 보이고, 제출 중 기록(_pending 등)은 원래 상태에 그대로 남는다
    const sub = new Proxy(state, { get: (t, k) => (k in view ? view[k] : t[k]) });
    onSubmit(sub, ctx);
  });

  async function addFiles(slot, list) {
    const errEl = stepEl.querySelector(`[data-err="${slot}"]`);
    const maxMB = Number((opts.settings && opts.settings().maxFileMB) || 20);
    const errs = [];
    for (const file of list) {
      if ((state.files || []).length >= MAX_FILES) { errs.push(`한 주문에 ${MAX_FILES}개까지 올릴 수 있습니다.`); break; }
      const er = checkFile(file, slot, maxMB);
      if (er) { errs.push(`${file.name}: ${er}`); continue; }
      if ((state.files || []).some((f) => f.slot === slot && f.name === file.name && f.size === file.size)) continue;
      const id = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      await putBlob(id, file);
      state.files = [...(state.files || []), { id, slot, name: file.name, size: file.size, type: file.type || '', ext: extOf(file.name) }];
      if (onFileAdded) await onFileAdded(slot, file, state, ctx);
    }
    state.touched = true;
    save();
    renderStep();
    refreshSide();
    const e2 = stepEl.querySelector(`[data-err="${slot}"]`);
    if (e2) e2.textContent = errs.join(' ');
    void errEl;
  }

  render();
  return ctx;
}

/* ------------------------------------------------------------------ 제출 */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export async function submitOrder({ service, state, input, design, quote, draftKey }) {
  if (!apiReady()) {
    modal({ title: '접수 서버 연결 준비 중', html: `<p>온라인 접수 서버를 연결하는 중입니다. 작성하신 내용은 이 브라우저에 그대로 저장되어 있으니 잠시 후 다시 제출해 주세요.</p><p class="muted small">급한 의뢰는 contact@skkc.co.kr 로 연락 주세요.</p>` });
    return;
  }
  const files = state.files || [];
  const host = document.createElement('div');
  host.className = 'modal-back';
  host.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="주문서 제출"><div class="modal-hd"><h2>주문서를 제출하고 있습니다</h2></div><div class="modal-bd"><ol class="sub-steps">
<li data-s="create"><span class="ss-dot"></span><span>주문서 저장</span></li>
<li data-s="files"><span class="ss-dot"></span><span>자료 파일 올리기 <em id="ssFiles">${files.length ? `0 / ${files.length}` : '없음'}</em></span></li>
<li data-s="submit"><span class="ss-dot"></span><span>필수 자료 확인과 접수</span></li></ol>
<ul class="sub-files" id="ssList">${files.map((f) => `<li data-fid="${f.id}"><span>${esc(f.name)}</span><b class="muted">대기</b></li>`).join('')}</ul>
<p class="wz-err" id="ssErr" role="alert"></p><div id="ssNote"></div><div class="sub-actions" id="ssAct"></div><p class="hint">큰 파일은 올리는 데 시간이 걸릴 수 있습니다. 이 창을 닫지 말아 주세요.</p></div></div>`;
  document.body.appendChild(host);
  const mark = (s, st) => { const li = host.querySelector(`[data-s="${s}"]`); li.className = st; };
  const fileMark = (id, txt, cls = '') => { const li = host.querySelector(`[data-fid="${id}"] b`); if (li) { li.textContent = txt; li.className = cls; } };
  const fail = (msg, retry) => {
    host.querySelector('#ssErr').textContent = msg;
    host.querySelector('#ssAct').innerHTML = `<button class="btn btn-primary" type="button" id="ssRetry">다시 시도</button><button class="btn btn-ghost" type="button" id="ssClose">닫기</button>`;
    host.querySelector('#ssRetry').addEventListener('click', () => { host.querySelector('#ssErr').textContent = ''; host.querySelector('#ssAct').innerHTML = ''; retry(); });
    host.querySelector('#ssClose').addEventListener('click', () => host.remove());
  };
  // 서버 견적이 화면 견적과 다르면(가격표 변경 등) 바뀐 금액을 알리고 확인을 받은 뒤에만 이어 간다
  const confirmPrice = (total) => new Promise((resolve) => {
    host.querySelector('#ssNote').innerHTML = note(`가격표가 바뀌어 주문 금액이 <b>${won(quote.total)}</b>에서 <b>${won(total)}</b>으로 다시 계산되었습니다. 이 금액으로 제출하려면 계속을 눌러 주세요. 결제는 다음 화면에서 금액을 확인한 뒤 진행합니다.`, 'amber');
    host.querySelector('#ssAct').innerHTML = `<button class="btn btn-primary" type="button" id="ssPriceOk">바뀐 금액으로 계속</button><button class="btn btn-ghost" type="button" id="ssClose">닫기</button>`;
    host.querySelector('#ssPriceOk').addEventListener('click', () => { host.querySelector('#ssNote').innerHTML = ''; host.querySelector('#ssAct').innerHTML = ''; resolve(true); });
    host.querySelector('#ssClose').addEventListener('click', () => { host.remove(); resolve(false); });
  });
  // 실패 뒤 다시 제출할 때는 내용이 같을 때만 앞서 만든 주문을 이어서 쓴다(내용을 고쳤다면 고친 내용으로 새로 접수)
  const sig = hashStr(JSON.stringify([service, input, design || null, state.links || [], state.contact || {}, state.pin || '', state.consents || {}, quote.total]));
  const keep = () => store.set(draftKey, { ...state, touched: true, stepId: 'review' });
  let order = state._pending && state._pending.sig === sig ? state._pending : null;
  const run = async () => {
    try {
      if (!order) {
        mark('create', 'is-now');
        const r = await api('createOrder', { service, input, contact: state.contact, pin: state.pin, consents: state.consents, design, links: state.links || [], clientQuote: { total: quote.total }, hp: state.hp || '' }, { retries: 1 });
        order = { orderNo: r.orderNo, token: r.token, uploaded: [], sig, total: r.quote && typeof r.quote.total === 'number' ? r.quote.total : quote.total };
        state._pending = order;
        keep();
        myOrders.put(r.orderNo, { token: r.token, service, product: quote.mainName || '' });
      }
      mark('create', 'is-done');
      if (typeof order.total === 'number' && order.total !== quote.total && !order.priceOk) {
        try { sessionStorage.removeItem('nm:config'); } catch { /* 무시 */ }
        if (!(await confirmPrice(order.total))) return;
        order.priceOk = true;
        state._pending = order;
        keep();
      }
      mark('files', 'is-now');
      let done = order.uploaded.length;
      host.querySelector('#ssFiles').textContent = `${done} / ${files.length}`;
      for (const f of files) {
        if (order.uploaded.includes(f.id)) { fileMark(f.id, '완료', 'ok'); continue; }
        fileMark(f.id, '올리는 중', 'now');
        const blob = await getBlob(f.id);
        if (!blob) { fileMark(f.id, '파일 없음', 'bad'); throw new ApiError('file_missing', `${f.name} 파일을 다시 선택해 주세요(브라우저 저장소에서 찾지 못했습니다).`); }
        const data = await blobToBase64(blob);
        try {
          await api('uploadFile', { orderNo: order.orderNo, token: order.token, slot: f.slot, name: f.name, mime: f.type || 'application/octet-stream', data }, { retries: 2, timeoutMs: 180000 });
        } catch (e) { fileMark(f.id, '실패', 'bad'); throw e; }
        order.uploaded.push(f.id);
        state._pending = order;
        keep();
        fileMark(f.id, '완료', 'ok');
        done++;
        host.querySelector('#ssFiles').textContent = `${done} / ${files.length}`;
      }
      mark('files', 'is-done');
      mark('submit', 'is-now');
      await api('submitOrder', { orderNo: order.orderNo, token: order.token, links: state.links || [] }, { retries: 1 });
      mark('submit', 'is-done');
      for (const f of files) await delBlob(f.id);
      for (const id of state.dropped || []) await delBlob(id);
      store.del(draftKey);
      location.href = `${url('/checkout/')}?o=${encodeURIComponent(order.orderNo)}`;
    } catch (e) {
      fail(e.message || '제출하지 못했습니다.', run);
    }
  };
  run();
}

export function priceLinesHtml(q, { compact = false } = {}) {
  if (!q) return '';
  const lines = q.lines.map((l) => `<li><span>${esc(l.name)}${l.note ? `<small>${esc(l.note)}</small>` : ''}</span><b class="num">${l.pending ? '견적 후 안내' : won(l.amount)}</b></li>`).join('');
  return `<ul class="pl">${lines}</ul><div class="pl-total"><span>${q.quoteRequired ? '현재 확정 금액' : '총 결제 금액'}</span><b class="num">${won(q.total)}</b></div>${q.quoteRequired ? `<p class="pl-quote">${ICON.info}<span>${esc(q.quoteReasons[0] || '확정 견적 후 결제합니다.')}</span></p>` : ''}${!compact && q.notes && q.notes.length ? `<p class="pl-note">${esc(q.notes[0])}</p>` : ''}`;
}
