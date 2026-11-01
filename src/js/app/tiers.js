// 논문 자동작성 가격 카드(소논문 8쪽·석사 80쪽·박사 130쪽)와 쪽수 계산기: 홈과 가격 안내에서 함께 씀
import { computeQuote, DEFAULT_CATALOG } from '../core/pricing.js';
import { $, $$, url } from '../ui/dom.js';

// 종류별 쪽수 범위와 기본 분량 [최소, 최대, 기본]
export const RANGES = { short: [8, 20, 8], personal: [8, 40, 8], bachelor: [20, 60, 30], journal: [10, 40, 20], master: [40, 130, 80], doctor: [80, 200, 130] };

export function initTiers({ onCatalog } = {}) {
  let catalog = DEFAULT_CATALOG;
  const wonNum = (n) => Math.round(Number(n) || 0).toLocaleString('ko-KR');
  const perPage = (total, pages) => `쪽당 ${wonNum(total / Math.max(1, pages))}원`;
  const quote = (typeId, pages) => computeQuote(catalog, { service: 'paper', paper: { typeId, task: 'full', pages } });
  const calc = $('#tierCalc');
  let update = () => {};
  if (calc) {
    const range = $('#calcRange', calc);
    const segBtns = $$('[data-type]', calc);
    let typeId = 'master';
    update = () => {
      const [min, max] = RANGES[typeId];
      const p = Math.max(min, Math.min(max, Number(range.value)));
      const q = quote(typeId, p);
      $('#calcPages', calc).textContent = p;
      $('#calcTotal', calc).textContent = wonNum(q.total);
      $('#calcNote', calc).textContent = `${perPage(q.total, p)} · 영업일 ${q.days}일 완성`;
      $('#calcGo', calc).href = `${url('/paper/new/')}?${new URLSearchParams({ type: typeId, task: 'full', pages: String(p) })}`;
      range.style.setProperty('--fill', `${((p - min) / (max - min)) * 100}%`);
    };
    const setType = (t) => {
      typeId = t;
      const [min, max, def] = RANGES[t];
      range.min = String(min); range.max = String(max); range.value = String(def);
      $('#calcMin', calc).textContent = `${min}쪽`;
      $('#calcMax', calc).textContent = `${max}쪽`;
      for (const b of segBtns) b.setAttribute('aria-checked', String(b.dataset.type === t));
      update();
    };
    for (const b of segBtns) {
      b.addEventListener('click', () => setType(b.dataset.type));
      b.addEventListener('keydown', (e) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
        e.preventDefault();
        const i = segBtns.indexOf(b);
        const n = segBtns[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : segBtns.length - 1)) % segBtns.length];
        setType(n.dataset.type); n.focus();
      });
    }
    range.addEventListener('input', update);
    setType('master');
  }
  // 운영자가 바꾼 현재 가격이 있으면 다시 계산
  import('./api.js').then(async (A) => {
    if (!A.apiReady()) return;
    const c = await A.loadConfig();
    if (!c || c.offline || !c.catalog) return;
    catalog = c.catalog;
    if (onCatalog) onCatalog(c.catalog);
    for (const card of $$('.tier[data-tier]')) {
      const q = quote(card.dataset.tier, Number(card.dataset.pages));
      const t = $('[data-tier-total]', card); if (t) t.textContent = wonNum(q.total);
      const d = $('[data-tier-days]', card); if (d) d.textContent = `영업일 ${q.days}일 완성`;
      const pp = $('[data-tier-pp]', card); if (pp) pp.textContent = perPage(q.total, Number(card.dataset.pages));
    }
    // 문장 속 대표 금액: <span data-q="master:80">
    for (const el of $$('[data-q]')) {
      const [t, pg] = el.dataset.q.split(':');
      el.textContent = wonNum(quote(t, Number(pg)).total);
    }
    update();
  }).catch(() => { /* 기본 가격 그대로 */ });
}
