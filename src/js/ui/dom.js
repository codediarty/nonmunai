// 공용 DOM 유틸
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export { esc } from '../core/render.js';

export function toast(msg, { error = false, ms = 3200 } = {}) {
  let host = document.querySelector('.toast-host');
  if (!host) { host = document.createElement('div'); host.className = 'toast-host'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' is-err' : '');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function cfg() { return window.NONMUN || {}; }
export function url(p) { return (cfg().basePath || '') + p; }

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem('nm:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('nm:' + k, JSON.stringify(v)); } catch { /* 저장 불가 */ } },
  del(k) { try { localStorage.removeItem('nm:' + k); } catch { /* 무시 */ } },
};

export function modal({ title, html, onOpen }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-hd"><h2>${title}</h2><button class="modal-x" type="button" aria-label="닫기"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div><div class="modal-bd">${html}</div></div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.querySelector('.modal-x').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  const first = back.querySelector('input,textarea,select,button:not(.modal-x)');
  if (first) first.focus();
  if (onOpen) onOpen(back, close);
  return close;
}
