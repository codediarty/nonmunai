// 성균관컨설팅(아임웹) 결제 안내: 주문 금액 줄마다 맞는 상품을 찾아 장바구니 구성을 만든다 (DOM 없음, 테스트 가능)

export function productLinks(settings) {
  try { const m = JSON.parse((settings && settings.skkcProducts) || '{}'); return m && typeof m === 'object' ? m : {}; } catch { return {}; }
}

// 금액 줄 하나에 맞는 상품 링크: 가격표 결제 링크 → 코드별 상품 링크 → 추가 분량은 단가별 상품
export function linkForLine(line, links, catalog) {
  const it = ((catalog && catalog.items) || []).find((i) => i.code === line.code);
  if (it && it.payUrl) return it.payUrl;
  if (links[line.code]) return links[line.code];
  if (/-X$/.test(line.code || '') && links[`X-${line.unitPrice}`]) return links[`X-${line.unitPrice}`];
  return '';
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
  const rows = lines.map((l) => ({ code: l.code, name: l.name, qty: Number(l.qty) || 1, unitPrice: Number(l.unitPrice) || Number(l.amount), amount: Number(l.amount), url: linkForLine(l, links, catalog) }));
  if (rows.some((r) => !/^https?:\/\//.test(r.url))) return null;
  return rows;
}
