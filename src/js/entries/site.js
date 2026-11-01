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
