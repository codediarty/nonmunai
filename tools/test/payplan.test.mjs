// 아임웹 결제 상품 안내(장바구니 구성) 단위 테스트
import assert from 'node:assert/strict';
import { cartPlan, linkForLine } from '../../src/js/app/pay-plan.js';
import { DEFAULT_CATALOG, computeQuote } from '../../src/js/core/pricing.js';

const links = { 'P-MASTER-FULL': 'https://skkc.co.kr/shop_view?idx=101', 'X-19000': 'https://skkc.co.kr/shop_view?idx=140', 'A-PRIORITY': 'https://skkc.co.kr/shop_view?idx=141', 'A-REVISION': 'https://skkc.co.kr/shop_view?idx=143' };
const settings = { skkcProducts: JSON.stringify(links) };
const order = (quote, due, kind = 'main') => ({ quote, amountDue: due, payments: [{ status: 'requested', kind, amount: due }] });

export const tests = [
  { name: '본 상품만 있으면 상품 하나로 바로 결제', fn() {
    const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 60 } });
    const rows = cartPlan(order(q, q.total), settings, DEFAULT_CATALOG);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].url, links['P-MASTER-FULL']);
    assert.equal(rows[0].amount, 159000);
  } },
  { name: '추가 분량·옵션은 단가별 상품과 수량으로 나눔', fn() {
    const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 80 }, addons: { priority: true, revisions: 2 } });
    const rows = cartPlan(order(q, q.total), settings, DEFAULT_CATALOG);
    assert.deepEqual(rows.map((r) => [r.url, r.qty]), [[links['P-MASTER-FULL'], 1], [links['X-19000'], 2], [links['A-PRIORITY'], 1], [links['A-REVISION'], 2]]);
    assert.equal(rows.reduce((a, r) => a + r.amount, 0), q.total);
  } },
  { name: '석사 80쪽·박사 130쪽은 묶음 상품 하나로 결제(금액이 같을 때만)', fn() {
    const L = { ...links, 'P-MASTER-FULL-80': 'https://skkc.co.kr/shop_view?idx=148', 'P-DOCTOR-FULL-130': 'https://skkc.co.kr/shop_view?idx=149', 'P-DOCTOR-FULL': 'https://skkc.co.kr/shop_view?idx=104', 'X-29000': 'https://skkc.co.kr/shop_view?idx=142' };
    const st = { skkcProducts: JSON.stringify(L) };
    const q80 = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 80 } });
    const r80 = cartPlan(order(q80, q80.total), st, DEFAULT_CATALOG);
    assert.deepEqual(r80.map((r) => [r.code, r.qty, r.amount, r.url]), [['P-MASTER-FULL-80', 1, 197000, L['P-MASTER-FULL-80']]]);
    const q75 = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 75 } });
    assert.equal(cartPlan(order(q75, q75.total), st, DEFAULT_CATALOG)[0].code, 'P-MASTER-FULL-80', '71~80쪽은 80쪽 묶음과 금액이 같음');
    const q130 = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'doctor', task: 'full', pages: 130 }, addons: { priority: true } });
    assert.deepEqual(cartPlan(order(q130, q130.total), st, DEFAULT_CATALOG).map((r) => r.code), ['P-DOCTOR-FULL-130', 'A-PRIORITY']);
    // 운영자가 본 상품 가격만 바꿔 묶음 금액과 달라지면 묶지 않고 원래대로 나눔
    const cat = { ...DEFAULT_CATALOG, items: DEFAULT_CATALOG.items.map((i) => (i.code === 'P-MASTER-FULL' ? { ...i, price: 169000 } : i)) };
    const qc = computeQuote(cat, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 80 } });
    assert.deepEqual(cartPlan(order(qc, qc.total), st, cat).map((r) => r.code), ['P-MASTER-FULL', 'P-MASTER-FULL-X']);
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
    assert.equal(linkForLine({ code: 'P-MASTER-FULL', amount: 159000 }, links, cat), 'https://skkc.co.kr/shop_view?idx=999');
    assert.equal(linkForLine({ code: 'P-MASTER-FULL-X', unitPrice: 19000, amount: 38000 }, links, cat), links['X-19000']);
  } },
];
