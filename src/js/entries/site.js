// 전 페이지 공통 동작: 모바일 메뉴, 탭, 외부 링크
import { $, $$ } from '../ui/dom.js';

const burger = $('.hd-burger');
const mnav = $('#mnav');
if (burger && mnav) {
  burger.addEventListener('click', () => {
    const open = mnav.hidden;
    mnav.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  });
}

for (const tabs of $$('[data-tabs]')) {
  const btns = $$('[role=tab]', tabs);
  const select = (b, focus) => {
    for (const x of btns) {
      const on = x === b;
      x.setAttribute('aria-selected', String(on));
      x.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(x.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    }
    if (focus) b.focus();
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => select(b));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        select(btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length], true);
      }
    });
  });
}

// 가격표: 빌드 때 넣은 기본 가격을 운영자가 바꾼 현재 가격으로 고친다
if (document.querySelector('[data-price]')) {
  Promise.all([import('../app/api.js'), import('../core/pricing.js')]).then(async ([A, P]) => {
    if (!A.apiReady()) return;
    const c = await A.loadConfig();
    if (!c || c.offline || !c.catalog) return;
    const find = (code) => (c.catalog.items || []).find((i) => i.code === code);
    for (const el of $$('[data-price]')) { const it = find(el.dataset.price); if (it) el.textContent = it.quoteOnly ? '별도 견적' : P.won(it.price); }
    for (const el of $$('[data-days]')) { const it = find(el.dataset.days); if (it) el.textContent = it.days ? `영업일 ${it.days}일` : '견적 후 안내'; }
  }).catch(() => { /* 기본 가격 그대로 둔다 */ });
}
