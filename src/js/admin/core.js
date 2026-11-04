// 운영자 화면 공통: 인증, API, 작은 도우미
import { api } from '../app/api.js';
import { store, toast } from '../ui/dom.js';
import { esc, won } from '../core/render.js';

export { esc, won, toast };

const KEY = 'admin';
export const auth = {
  get() { const a = store.get(KEY); return a && a.exp > Date.now() ? a.token : ''; },
  set(token, sec = 12 * 3600) { store.set(KEY, { token, exp: Date.now() + (sec - 300) * 1000 }); },
  clear() { store.del(KEY); },
};

let onLogout = () => {};
export function setLogoutHandler(fn) { onLogout = fn; }
// 로그인이 풀려 로그인 창으로 바뀐 경우: 화면을 오류 문구로 덮어쓰지 않는다
export const authLost = (e) => !!e && e.code === 'admin_required';

export async function aapi(action, payload = {}, opts = {}) {
  try {
    return await api(action, { adminToken: auth.get(), ...payload }, { retries: 0, timeoutMs: 120000, ...opts });
  } catch (e) {
    if (e.code === 'admin_required') { auth.clear(); onLogout(); }
    throw e;
  }
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

export function fmtAt(iso, { time = true } = {}) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const s = `${d.getMonth() + 1}/${d.getDate()}`;
  return time ? `${s} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : s;
}

export function daysLeft(ymd) {
  if (!ymd) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(ymd + 'T00:00:00');
  return Math.round((d - today) / 86400000);
}

export function etaChip(ymd) {
  const n = daysLeft(ymd);
  if (n === null) return '<span class="muted">미정</span>';
  const label = `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;
  if (n < 0) return `<span class="eta-chip is-late">${label} · ${-n}일 지남</span>`;
  if (n === 0) return `<span class="eta-chip is-today">${label} · 오늘</span>`;
  return `<span class="eta-chip${n <= 1 ? ' is-soon' : ''}">${label} · ${n}일 남음</span>`;
}

export const STATUS_LABEL = {
  draft: '작성 중', quote_requested: '견적 확인 중', pending_payment: '결제 대기', payment_review: '결제 확인 중', received: '접수 완료', checking: '자료 확인',
  needs_materials: '자료 보완 필요', preparing: '작업 준비', in_progress: '작성·분석 진행', review: '전문가 검수', delivered: '전달 완료', revision: '수정 진행', completed: '완료', cancelled: '취소',
};
export const METHOD_LABEL = { skkc: '성균관컨설팅', bank: '무통장입금', toss: '카드·간편결제', '': '-' };
export const SERVICE_LABEL = { paper: '논문', survey: '설문', statistics: '통계' };

export function pill(status, label) {
  const cls = ['quote_requested', 'pending_payment', 'payment_review'].includes(status) ? 'st-wait' : ['delivered', 'completed'].includes(status) ? 'st-done' : status === 'cancelled' ? 'st-stop' : status === 'needs_materials' || status === 'revision' ? 'st-need' : '';
  return `<span class="status-pill sm ${cls}"><i></i>${esc(label || STATUS_LABEL[status] || status)}</span>`;
}

export function confirmBox({ title, html, ok = '확인', danger = false }) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-hd"><h2>${esc(title)}</h2></div><div class="modal-bd">${html}<div class="ad-modal-act"><button type="button" class="btn btn-ghost" data-x>취소</button><button type="button" class="btn ${danger ? 'btn-pen' : 'btn-primary'}" data-ok>${esc(ok)}</button></div></div></div>`;
    const close = (v) => { back.remove(); resolve(v); };
    back.querySelector('[data-x]').addEventListener('click', () => close(null));
    back.querySelector('[data-ok]').addEventListener('click', () => {
      const vals = {};
      back.querySelectorAll('[name]').forEach((el) => { vals[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
      close(vals);
    });
    back.addEventListener('click', (e) => { if (e.target === back) close(null); });
    document.body.appendChild(back);
    const f = back.querySelector('input,textarea,select');
    (f || back.querySelector('[data-ok]')).focus();
  });
}

export function busy(btn, on, text) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${text ? ' ' + esc(text) : ''}`; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}
