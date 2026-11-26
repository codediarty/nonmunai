// 성균관컨설팅(아임웹) 결제 안내: 주문 금액 줄마다 맞는 상품을 찾아 장바구니 구성을 만든다 (DOM 없음, 테스트 가능)
import { AMOUNT_PRODUCTS } from './amount-products.js';
import { QUOTE_MAX, isQuoteAmount } from '../core/pricing.js';

export function productLinks(settings) {
  try { const m = JSON.parse((settings && settings.skkcProducts) || '{}'); return m && typeof m === 'object' ? m : {}; } catch { return {}; }
}

// 맞춤 견적 결제 상품(10만~100만 원, 10만 원 단위): 금액 → 상품 주소. 기본 목록 위에 설정(skkcProducts의 Q-금액, skkcLinks)을 덮어쓴다
export function amountLinks(settings) {
  const out = {};
  const put = (amount, url) => { const n = Number(amount); if (n > 0 && /^https?:\/\//.test(String(url || ''))) out[n] = String(url); };
  for (const [a, u] of Object.entries(AMOUNT_PRODUCTS)) put(a, u);
  for (const [k, u] of Object.entries(productLinks(settings))) { const m = /^Q-(\d+)$/.exec(k); if (m) put(m[1], u); }
  let arr = [];
  try { arr = JSON.parse((settings && settings.skkcLinks) || '[]'); } catch { arr = []; }
  for (const l of Array.isArray(arr) ? arr : []) if (l) put(l.amount, l.url);
  return out;
}

// 금액 하나를 맞춤 견적 결제 상품으로: 100만 원까지는 상품 하나, 넘으면 100만 원 상품 여러 개와 나머지. 맞는 상품이 없으면 null
export function amountRows(total, links, name = '맞춤 견적 결제') {
  let left = Math.round(Number(total) || 0);
  if (!(left > 0)) return null;
  const big = Math.floor(left / QUOTE_MAX);
  const rest = left - big * QUOTE_MAX;
  const rows = [];
  if (big > 0) {
    if (!links[QUOTE_MAX] || (rest && !isQuoteAmount(rest))) return null;
    rows.push({ code: `Q-${QUOTE_MAX}`, name: `${name} (${(QUOTE_MAX).toLocaleString('ko-KR')}원)`, qty: big, unitPrice: QUOTE_MAX, amount: big * QUOTE_MAX, url: links[QUOTE_MAX] });
  }
  if (rest) {
    if (!isQuoteAmount(rest) || !links[rest]) return null;
    rows.push({ code: `Q-${rest}`, name: big ? `${name} (${rest.toLocaleString('ko-KR')}원)` : name, qty: 1, unitPrice: rest, amount: rest, url: links[rest] });
  }
  if (rows.length === 1 && rows[0].qty === 1) rows[0].name = name;
  return rows;
}

// 금액 줄 하나에 맞는 상품 링크: 가격표 결제 링크 → 코드별 상품 링크 → 추가 분량은 단가별 상품
export function linkForLine(line, links, catalog) {
  const it = ((catalog && catalog.items) || []).find((i) => i.code === line.code);
  if (it && it.payUrl) return it.payUrl;
  if (links[line.code]) return links[line.code];
  if (/-X$/.test(line.code || '') && links[`X-${line.unitPrice}`]) return links[`X-${line.unitPrice}`];
  return '';
}

// 묶음 상품: 본 상품과 추가 분량 줄을 '석사 100 Page'처럼 상품 하나로 바꾼다(가격표의 묶음 금액과 같을 때만)
export function mergeBundle(rows, links, catalog) {
  const items = (catalog && catalog.items) || [];
  const x = rows.find((r) => /-X$/.test(r.code || ''));
  if (!x) return rows;
  const mainCode = x.code.replace(/-X$/, '');
  const main = rows.find((r) => r.code === mainCode);
  const base = items.find((i) => i.code === mainCode);
  if (!main || !base || !Number(base.unitSize)) return rows;
  const pages = Number(base.baseUnits) + Number(x.qty) * Number(base.unitSize);
  const b = items.find((i) => i.code === `${mainCode}-${pages}` && i.active !== false);
  if (!b || Number(b.price) !== Number(main.amount) + Number(x.amount)) return rows;
  const url = b.payUrl || links[b.code] || '';
  if (!/^https?:\/\//.test(url)) return rows;
  const merged = { code: b.code, name: b.name, qty: 1, unitPrice: Number(b.price), amount: Number(b.price), url };
  return [merged, ...rows.filter((r) => r !== main && r !== x)];
}

// 결제할 상품 목록. 본 결제(남은 금액 = 견적 합계)이고 모든 줄에 상품이 있을 때만 돌려준다
export function cartPlan(o, settings, catalog) {
  const pay = ((o && o.payments) || []).find((p) => p.status === 'requested');
  if (!pay || pay.kind !== 'main') return null;
  const lines = (((o.quote || {}).lines) || []).filter((l) => Number(l.amount) > 0);
  if (!lines.length) return null;
  const sum = lines.reduce((a, l) => a + Number(l.amount), 0);
  if (sum !== Number(o.amountDue)) return null;
  const links = productLinks(settings);
  let rows = mergeBundle(lines.map((l) => ({ code: l.code, name: l.name, qty: Number(l.qty) || 1, unitPrice: Number(l.unitPrice) || Number(l.amount), amount: Number(l.amount), url: linkForLine(l, links, catalog) })), links, catalog);
  const has = (r) => /^https?:\/\//.test(r.url);
  if (rows.some((r) => !has(r))) {
    // 상품이 따로 없는 줄(심화 첨삭·완성도 보완과 그 추가 분량, 맞춤 견적)은 합쳐서 맞춤 견적 결제 상품으로 결제한다(합이 10만 원 단위일 때만)
    const miss = rows.filter((r) => !has(r));
    const sum = miss.reduce((a, r) => a + r.amount, 0);
    const name = String(miss[0].name || '맞춤 견적 결제').replace(/^\[논문AI\]\s*/, '');
    const amt = amountRows(sum, amountLinks(settings), name);
    if (!amt) return null;
    rows = [...amt, ...rows.filter(has)];
  }
  return rows;
}
