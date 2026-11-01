// 서버(Apps Script 웹 앱) 호출
import { cfg, store } from '../ui/dom.js';
import { DEFAULT_CATALOG } from '../core/pricing.js';

export class ApiError extends Error {
  constructor(code, message, extra) { super(message); this.code = code; this.extra = extra; }
}

export function apiReady() { return !!cfg().apiUrl; }

export async function api(action, payload = {}, { retries = 1, timeoutMs = 90000 } = {}) {
  const url = cfg().apiUrl;
  if (!url) throw new ApiError('no_api', '온라인 접수 서버가 아직 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'POST', body: JSON.stringify({ action, ...payload }), redirect: 'follow', signal: ctrl.signal });
      clearTimeout(timer);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new ApiError('bad_response', '서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
      if (!data.ok) throw new ApiError(data.error, data.message || '요청을 처리하지 못했습니다.', data.extra);
      return data;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e instanceof ApiError ? e : new ApiError('network', e.name === 'AbortError' ? '서버 응답이 늦어 요청을 멈췄습니다. 다시 시도해 주세요.' : '네트워크 연결을 확인해 주세요.');
      if (e instanceof ApiError && !['bad_response', 'server'].includes(e.code)) throw lastErr;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// 공개 설정(가격표 등): 서버 → 세션 캐시 → 기본값
// 서버를 기다리지 않고 바로 그릴 때 쓰는 설정: 이 탭에서 받은 적 있는 설정, 없으면 기본 가격표
export function peekConfig() {
  try {
    const c = JSON.parse(sessionStorage.getItem('nm:config') || 'null');
    if (c && c.data && c.data.catalog) return c.data;
  } catch { /* 무시 */ }
  return { catalog: DEFAULT_CATALOG, settings: {}, provisional: true };
}

export async function loadConfig() {
  const cached = (() => { try { return JSON.parse(sessionStorage.getItem('nm:config') || 'null'); } catch { return null; } })();
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.data;
  if (!apiReady()) return { catalog: DEFAULT_CATALOG, settings: {}, offline: true };
  try {
    const data = await api('config', {}, { retries: 1, timeoutMs: 20000 });
    try { sessionStorage.setItem('nm:config', JSON.stringify({ at: Date.now(), data })); } catch { /* 무시 */ }
    return data;
  } catch {
    return { catalog: DEFAULT_CATALOG, settings: {}, offline: true };
  }
}

// 이 브라우저에서 만든 주문의 조회 키
export const myOrders = {
  all() { return store.get('orders', {}); },
  get(no) { return (store.get('orders', {}) || {})[no] || null; },
  put(no, info) { const all = store.get('orders', {}) || {}; all[no] = { ...(all[no] || {}), ...info, at: (all[no] && all[no].at) || Date.now() }; store.set('orders', all); },
  remove(no) { const all = store.get('orders', {}) || {}; delete all[no]; store.set('orders', all); },
};
