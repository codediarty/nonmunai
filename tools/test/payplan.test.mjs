// 아임웹 결제 상품 안내(장바구니 구성) 단위 테스트
import assert from 'node:assert/strict';
import { cartPlan, linkForLine } from '../../src/js/app/pay-plan.js';
import { DEFAULT_CATALOG, computeQuote } from '../../src/js/core/pricing.js';

const links = { 'P-MASTER-FULL': 'https://skkc.co.kr/shop_view?idx=101', 'X-49000': 'https://skkc.co.kr/shop_view?idx=140', 'A-PRIORITY': 'https://skkc.co.kr/shop_view?idx=141', 'A-REVISION': 'https://skkc.co.kr/shop_view?idx=143' };
const settings = { skkcProducts: JSON.stringify(links) };
const order = (quote, due, kind = 'main') => ({ quote, amountDue: due, payments: [{ status: 'requested', kind, amount: due }] });

export const tests = [
  { name: '본 상품만 있으면 상품 하나로 바로 결제', fn() {
    const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 60 } });
    const rows = cartPlan(order(q, q.total), settings, DEFAULT_CATALOG);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].url, links['P-MASTER-FULL']);
    assert.equal(rows[0].amount, 399000);
  } },
  { name: '추가 분량·옵션은 단가별 상품과 수량으로 나눔', fn() {
    const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 80 }, addons: { priority: true, revisions: 2 } });
    const rows = cartPlan(order(q, q.total), settings, DEFAULT_CATALOG);
    assert.deepEqual(rows.map((r) => [r.url, r.qty]), [[links['P-MASTER-FULL'], 1], [links['X-49000'], 2], [links['A-PRIORITY'], 1], [links['A-REVISION'], 2]]);
    assert.equal(rows.reduce((a, r) => a + r.amount, 0), q.total);
  } },
  { name: '상품이 없는 줄이 있거나 추가 결제면 장바구니 안내를 하지 않음', fn() {
    const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 60 }, addons: { format: true } });
    assert.equal(cartPlan(order(q, q.total), settings, DEFAULT_CATALOG), null);
    const q2 = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 60 } });
    assert.equal(cartPlan(order(q2, 49000, 'extra'), settings, DEFAULT_CATALOG), null);
    assert.equal(cartPlan(order(q2, q2.total - 1000), settings, DEFAULT_CATALOG), null);
  } },
  { name: '가격표의 결제 링크가 코드별 링크보다 먼저', fn() {
    const cat = { items: DEFAULT_CATALOG.items.map((i) => (i.code === 'P-MASTER-FULL' ? { ...i, payUrl: 'https://skkc.co.kr/shop_view?idx=999' } : i)) };
    assert.equal(linkForLine({ code: 'P-MASTER-FULL', amount: 399000 }, links, cat), 'https://skkc.co.kr/shop_view?idx=999');
    assert.equal(linkForLine({ code: 'P-MASTER-FULL-X', unitPrice: 49000, amount: 98000 }, links, cat), links['X-49000']);
  } },
];
