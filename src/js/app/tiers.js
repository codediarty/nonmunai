// 논문 완성 가격 카드(소논문 15 Page·학사 30 Page·석사 80 Page·박사 130 Page): 홈과 가격 안내에서 함께 씀
// 운영자가 가격표를 바꾸면 카드의 행사 가격·정가·할인 표시(반값)와 문장 속 대표 금액을 다시 계산한다
import { computeQuote, DEFAULT_CATALOG, listPriceFor, offText } from '../core/pricing.js';
import { $, $$ } from '../ui/dom.js';

export function initTiers({ onCatalog } = {}) {
  const wonNum = (n) => Math.round(Number(n) || 0).toLocaleString('ko-KR');
  import('./api.js').then(async (A) => {
    if (!A.apiReady()) return;
    const c = await A.loadConfig();
    if (!c || c.offline || !c.catalog) return;
    const catalog = c.catalog || DEFAULT_CATALOG;
    const quote = (typeId, pages) => computeQuote(catalog, { service: 'paper', paper: { typeId, task: 'full', pages } });
    if (onCatalog) onCatalog(catalog);
    for (const card of $$('.tier[data-tier]')) {
      const q = quote(card.dataset.tier, Number(card.dataset.pages));
      if (!q.total) continue;
      const t = $('[data-tier-total]', card); if (t) t.textContent = wonNum(q.total);
      const code = q.lines[0] ? q.lines[0].code : '';
      const list = listPriceFor(code, q.total);
      const was = $('.tier-was', card);
      if (was) {
        was.hidden = !list;
        const l = $('[data-tier-list]', card); if (l) l.textContent = list ? `${wonNum(list)}원` : '';
        const o = $('[data-tier-off]', card); if (o) o.textContent = list ? offText(list, q.total, { short: true }) : '';
      }
    }
    // 문장 속 대표 금액: <span data-q="master:80">
    for (const el of $$('[data-q]')) {
      const [t, pg] = el.dataset.q.split(':');
      const q = quote(t, Number(pg));
      if (q.total) el.textContent = wonNum(q.total);
    }
  }).catch(() => { /* 기본 가격 그대로 */ });
}
