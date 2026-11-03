// 아임웹 결제 상품 안내(장바구니 구성) 단위 테스트
import assert from 'node:assert/strict';
import { cartPlan, linkForLine } from '../../src/js/app/pay-plan.js';
import { DEFAULT_CATALOG, computeQuote } from '../../src/js/core/pricing.js';

const links = { 'P-MASTER-FULL': 'https://skkc.co.kr/shop_view?idx=101', 'X-19000': 'https://skkc.co.kr/shop_view?idx=140', 'A-PRIORITY': 'https://skkc.co.kr/shop_view?idx=141', 'A-REVISION': 'https://skkc.co.kr/shop_view?idx=143' };
const settings = { skkcProducts: JSON.stringify(links) };
const order = (quote, due, kind = 'main') => ({ quote, amountDue: due, payments: [{ status: 'requested', kind, amount: due }] });
const full = (cat, typeId, pages, addons) => computeQuote(cat, { service: 'paper', paper: { typeId, task: 'full', pages }, ...(addons ? { addons } : {}) });

export const tests = [
  { name: '본 상품만 있으면 상품 하나로 바로 결제(석사 80 Page)', fn() {
    const q = full(DEFAULT_CATALOG, 'master', 80);
    const rows = cartPlan(order(q, q.total), settings, DEFAULT_CATALOG);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].url, links['P-MASTER-FULL']);
    assert.equal(rows[0].amount, 99000);
  } },
  { name: '추가 분량·옵션은 단가별 상품과 수량으로 나눔', fn() {
    const q = full(DEFAULT_CATALOG, 'master', 100, { priority: true, revisions: 2 });
    const rows = cartPlan(order(q, q.total), settings, DEFAULT_CATALOG);
    assert.deepEqual(rows.map((r) => [r.url, r.qty]), [[links['P-MASTER-FULL'], 1], [links['X-19000'], 2], [links['A-PRIORITY'], 1], [links['A-REVISION'], 2]]);
    assert.equal(rows.reduce((a, r) => a + r.amount, 0), q.total);
  } },
  { name: '가격표에 묶음 상품이 있으면 본 상품+추가 분량을 하나로 결제(금액이 같을 때만)', fn() {
    // 운영자가 가격표에 '석사 100 Page', '박사 150 Page' 묶음을 따로 두는 경우
    const cat = { ...DEFAULT_CATALOG, items: [...DEFAULT_CATALOG.items,
      { code: 'P-MASTER-FULL-100', service: 'paper', name: '석사학위논문 100 Page 완성', price: 99000 + 2 * 19000, active: true },
      { code: 'P-DOCTOR-FULL-150', service: 'paper', name: '박사학위논문 150 Page 완성', price: 199000 + 2 * 29000, active: true }] };
    const L = { ...links, 'P-MASTER-FULL-100': 'https://skkc.co.kr/shop_view?idx=148', 'P-DOCTOR-FULL-150': 'https://skkc.co.kr/shop_view?idx=149', 'P-DOCTOR-FULL': 'https://skkc.co.kr/shop_view?idx=104', 'X-29000': 'https://skkc.co.kr/shop_view?idx=142' };
    const st = { skkcProducts: JSON.stringify(L) };
    const q100 = full(cat, 'master', 100);
    assert.deepEqual(cartPlan(order(q100, q100.total), st, cat).map((r) => [r.code, r.qty, r.amount, r.url]), [['P-MASTER-FULL-100', 1, 137000, L['P-MASTER-FULL-100']]]);
    const q95 = full(cat, 'master', 95);
    assert.equal(cartPlan(order(q95, q95.total), st, cat)[0].code, 'P-MASTER-FULL-100', '91~100 Page는 100 Page 묶음과 금액이 같음');
    const q150 = full(cat, 'doctor', 150, { priority: true });
    assert.deepEqual(cartPlan(order(q150, q150.total), st, cat).map((r) => r.code), ['P-DOCTOR-FULL-150', 'A-PRIORITY']);
    // 운영자가 본 상품 가격만 바꿔 묶음 금액과 달라지면 묶지 않고 원래대로 나눔
    const cat2 = { ...cat, items: cat.items.map((i) => (i.code === 'P-MASTER-FULL' ? { ...i, price: 109000 } : i)) };
    const qc = full(cat2, 'master', 100);
    assert.deepEqual(cartPlan(order(qc, qc.total), st, cat2).map((r) => r.code), ['P-MASTER-FULL', 'P-MASTER-FULL-X']);
  } },
  { name: '상품이 없는 줄이 있거나 추가 결제면 장바구니 안내를 하지 않음', fn() {
    const q = full(DEFAULT_CATALOG, 'master', 80, { format: true });
    assert.equal(cartPlan(order(q, q.total), settings, DEFAULT_CATALOG), null);
    const q2 = full(DEFAULT_CATALOG, 'master', 80);
    assert.equal(cartPlan(order(q2, 49000, 'extra'), settings, DEFAULT_CATALOG), null);
    assert.equal(cartPlan(order(q2, q2.total - 1000), settings, DEFAULT_CATALOG), null);
  } },
  { name: '가격표의 결제 링크가 코드별 링크보다 먼저', fn() {
    const cat = { items: DEFAULT_CATALOG.items.map((i) => (i.code === 'P-MASTER-FULL' ? { ...i, payUrl: 'https://skkc.co.kr/shop_view?idx=999' } : i)) };
    assert.equal(linkForLine({ code: 'P-MASTER-FULL', amount: 99000 }, links, cat), 'https://skkc.co.kr/shop_view?idx=999');
    assert.equal(linkForLine({ code: 'P-MASTER-FULL-X', unitPrice: 19000, amount: 38000 }, links, cat), links['X-19000']);
  } },
];
