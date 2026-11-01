// 운영자 화면: 로그인, 메뉴, 화면 전환
import { auth, aapi, esc, toast, setLogoutHandler, busy } from './core.js';
import { api, apiReady } from '../app/api.js';
import { renderDashboard, renderList } from './dashboard.js';
import { renderOrder } from './order.js';
import { renderSettings, renderCatalog } from './settings.js';

const NAV = [['#', '오늘의 작업'], ['#orders', '주문'], ['#catalog', '가격표'], ['#settings', '설정']];

export function startAdmin(root) {
  if (location.pathname.replace(/\/+$/, '').endsWith('/admin/settings') && !location.hash) history.replaceState(null, '', location.pathname + '#settings');
  setLogoutHandler(() => login(root));
  window.addEventListener('hashchange', () => route(root));
  if (!apiReady()) { root.innerHTML = '<div class="ad-empty">서버 주소(apiUrl)가 아직 설정되지 않았습니다. site.config.json의 apiUrl을 채운 뒤 다시 배포해 주세요.</div>'; return; }
  if (!auth.get()) login(root); else route(root);
}

function go(hash) { if (location.hash === hash) route(document.getElementById('admin')); else location.hash = hash; }

function headerNav(active) {
  const slot = document.getElementById('adminHeaderSlot');
  if (!slot) return;
  if (!auth.get()) { slot.innerHTML = ''; return; }
  slot.innerHTML = `<nav class="ad-nav" aria-label="운영 메뉴">${NAV.map(([h, t]) => `<a href="${h}"${active === h ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav><button class="btn btn-ghost btn-xs" type="button" id="adLogout">로그아웃</button>`;
  slot.querySelector('#adLogout').addEventListener('click', () => { auth.clear(); login(document.getElementById('admin')); });
}

function route(root) {
  if (!auth.get()) { login(root); return; }
  const h = location.hash || '#';
  window.scrollTo(0, 0);
  const m = h.match(/^#order=([A-Za-z0-9-]+)/);
  if (m) { headerNav('#orders'); renderOrder(root, m[1].toUpperCase(), go); return; }
  if (h.startsWith('#orders')) { headerNav('#orders'); renderList(root, new URLSearchParams(h.split('?')[1] || ''), go); return; }
  if (h.startsWith('#settings')) { headerNav('#settings'); renderSettings(root); return; }
  if (h.startsWith('#catalog')) { headerNav('#catalog'); renderCatalog(root); return; }
  headerNav('#');
  renderDashboard(root, go);
}

function login(root) {
  headerNav('');
  root.innerHTML = `<div class="ad-login"><form class="ad-card" id="lf"><h1>운영자 로그인</h1><p class="muted small">처음 설정할 때 운영자 메일로 받은 비밀번호를 입력하세요.</p>
<div class="field"><label class="label" for="pw">비밀번호</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
<p class="wz-err" id="lerr" role="alert"></p><button class="btn btn-primary btn-block" type="submit" id="lbtn">로그인</button></form></div>`;
  const f = root.querySelector('#lf');
  root.querySelector('#pw').focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = root.querySelector('#lbtn');
    busy(btn, true);
    try {
      const r = await api('adminLogin', { password: root.querySelector('#pw').value }, { retries: 0 });
      auth.set(r.adminToken, r.expiresIn);
      route(root);
    } catch (ex) {
      root.querySelector('#lerr').textContent = ex.code === 'rate_limited' ? '로그인을 여러 번 실패했습니다. 15분 뒤에 다시 시도해 주세요.' : ex.message;
      busy(btn, false);
    }
  });
}

export { aapi, esc, toast };
