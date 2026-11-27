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

// 2026-11-26 맞춤 견적 결제(10만~100만 원) 상품으로 첨삭 단계·견적 금액 결제
import { amountLinks, amountRows } from '../../src/js/app/pay-plan.js';
import { AMOUNT_PRODUCTS } from '../../src/js/app/amount-products.js';
import { QUOTE_AMOUNTS } from '../../src/js/core/pricing.js';
import fs from 'node:fs';
const Q = Object.fromEntries(QUOTE_AMOUNTS.map((a, i) => [`Q-${a}`, `https://skkc.co.kr/shop_view/?idx=${200 + i}`]));
const qs = { skkcProducts: JSON.stringify({ ...links, ...Q }) };
const edit = (typeId, level, pages, addons) => computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId, task: 'edit', pages, editLevel: level }, ...(addons ? { addons } : {}) });
tests.push(
  { name: '첨삭 완성도 보완(학사 20 Page 30만 원)은 맞춤 견적 결제 30만 원 상품 하나로', fn() {
    const q = edit('bachelor', 'complete', 20);
    const rows = cartPlan(order(q, q.total), qs, DEFAULT_CATALOG);
    assert.deepEqual(rows.map((r) => [r.code, r.qty, r.amount, r.url, r.name]), [['Q-300000', 1, 300000, Q['Q-300000'], '학사·졸업논문 완성도 보완']]);
  } },
  { name: '단계 상품의 추가 분량은 본 금액과 합쳐 한 상품으로, 100만 원이 넘으면 100만 원 상품과 나머지', fn() {
    const q = edit('master', 'complete', 120);
    assert.deepEqual(cartPlan(order(q, q.total), qs, DEFAULT_CATALOG).map((r) => [r.code, r.qty]), [['Q-600000', 1]]);
    const d = edit('doctor', 'complete', 200);
    assert.equal(d.total, 1100000);
    assert.deepEqual(cartPlan(order(d, d.total), qs, DEFAULT_CATALOG).map((r) => [r.code, r.qty, r.amount]), [['Q-1000000', 1, 1000000], ['Q-100000', 1, 100000]]);
    const big = amountRows(2300000, amountLinks(qs));
    assert.deepEqual(big.map((r) => [r.code, r.qty]), [['Q-1000000', 2], ['Q-300000', 1]]);
    assert.equal(amountRows(250000, amountLinks(qs)), null, '10만 원 단위가 아니면 상품 없음');
    assert.equal(amountRows(1050000, amountLinks(qs)), null);
  } },
  { name: '옵션은 옵션 상품으로 함께 담고, 상품이 없으면(설정 전) 장바구니 안내를 하지 않음', fn() {
    const q = edit('bachelor', 'deep', 20, { priority: true });
    assert.deepEqual(cartPlan(order(q, q.total), qs, DEFAULT_CATALOG).map((r) => r.code), ['Q-100000', 'A-PRIORITY']);
    const q2 = edit('bachelor', 'complete', 20);
    const none = Object.keys(AMOUNT_PRODUCTS).length ? null : cartPlan(order(q2, q2.total), settings, DEFAULT_CATALOG);
    assert.equal(none, null);
  } },
  { name: '금액별 상품 목록: 기본 목록 위에 설정(Q-금액, skkcLinks)이 덮어씀', fn() {
    const m = amountLinks({ skkcProducts: JSON.stringify({ 'Q-300000': 'https://skkc.co.kr/shop_view/?idx=9', 'Q-x': 'bad' }), skkcLinks: JSON.stringify([{ amount: 400000, url: 'https://skkc.co.kr/shop_view/?idx=10' }, { amount: 5, url: 'javascript:1' }]) });
    assert.equal(m[300000], 'https://skkc.co.kr/shop_view/?idx=9');
    assert.equal(m[400000], 'https://skkc.co.kr/shop_view/?idx=10');
    assert.equal(m[5], undefined);
    assert.equal(amountLinks({ skkcLinks: 'not json' })[300000], AMOUNT_PRODUCTS[300000]);
  } },
  { name: '기본 맞춤 견적 결제 목록은 tools/imweb/links.json의 Q- 상품과 같음', fn() {
    const lj = JSON.parse(fs.readFileSync(new URL('../imweb/links.json', import.meta.url), 'utf8'));
    const fromLinks = Object.fromEntries(Object.entries(lj).filter(([k]) => /^Q-\d+$/.test(k)).map(([k, u]) => [Number(k.slice(2)), u]));
    assert.deepEqual(Object.fromEntries(Object.entries(AMOUNT_PRODUCTS).map(([a, u]) => [Number(a), u])), fromLinks);
    if (Object.keys(fromLinks).length) assert.deepEqual(Object.keys(fromLinks).map(Number).sort((a, b) => a - b), QUOTE_AMOUNTS);
  } },
);

// 2026-11-27 1,000원 단위 결제 상품: 상품 둘 이상·수량이 있는 결제를 상품 하나와 수량으로
import { unitLink, unitRows } from '../../src/js/app/pay-plan.js';
import { UNIT_PRODUCT, UNIT_MAX_QTY } from '../../src/js/app/amount-products.js';
tests.push(
  { name: '1,000원 단위 상품: 설정이 먼저, 주소가 없으면 쓰지 않음', fn() {
    assert.deepEqual(unitLink({ skkcUnitUrl: 'https://skkc.co.kr/shop_view/?idx=999', skkcUnitPrice: '1000' }), { url: 'https://skkc.co.kr/shop_view/?idx=999', price: 1000 });
    if (!UNIT_PRODUCT.url) assert.equal(unitLink({}), null, '기본 상품 주소가 비어 있으면 없음');
    else assert.deepEqual(unitLink({}), { url: UNIT_PRODUCT.url, price: UNIT_PRODUCT.price });
    assert.equal(unitLink({ skkcUnitUrl: 'not a url' }), null, '주소가 아니면 없음');
    assert.equal(unitLink({ skkcUnitUrl: 'off' }), null, '설정 off면 쓰지 않음');
  } },
  { name: '1,000원 단위 상품 수량: 석사 첨삭 80 Page(본 상품+추가 분량 5단위)를 상품 하나 144개로', fn() {
    const unit = { url: 'https://skkc.co.kr/shop_view/?idx=999', price: 1000 };
    const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'edit', pages: 80 } });
    assert.equal(q.total, 144000);
    assert.equal(cartPlan(order(q, q.total), settings, DEFAULT_CATALOG) === null || cartPlan(order(q, q.total), settings, DEFAULT_CATALOG).length !== 1, true, '상품별로는 하나로 결제할 수 없음');
    assert.deepEqual(unitRows(q.total, unit, '석사학위논문 첨삭·교정').map((r) => [r.code, r.qty, r.unitPrice, r.amount, r.url, r.name]), [['U-1000', 144, 1000, 144000, unit.url, '석사학위논문 첨삭·교정']]);
    assert.equal(unitRows(144500, unit), null, '1,000원으로 나누어떨어지지 않으면 없음');
    assert.equal(unitRows((UNIT_MAX_QTY + 1) * 1000, unit), null, '수량 한도를 넘으면 없음');
    assert.equal(unitRows(0, unit), null);
    assert.equal(unitRows(144000, null), null);
  } },
);
tests.push(
  { name: '1,000원 단위 상품 주소는 tools/imweb/links.json의 U-1000과 같음', fn() {
    const lj = JSON.parse(fs.readFileSync(new URL('../imweb/links.json', import.meta.url), 'utf8'));
    assert.equal(UNIT_PRODUCT.url, lj['U-1000'] || '');
    assert.equal(UNIT_PRODUCT.price, 1000);
  } },
);
