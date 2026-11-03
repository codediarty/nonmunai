// 가격 계산 단위 테스트 (TESTS.md 22, 23, 40 일부)
import assert from 'node:assert/strict';
import { DEFAULT_CATALOG, computeQuote, addBusinessDays, includesFor, listPriceFor, discountRate, pageLabel } from '../../src/js/core/pricing.js';

export const tests = [];
const t = (name, fn) => tests.push({ name, fn });
const clone = (o) => JSON.parse(JSON.stringify(o));

t('논문 유형·작업 변경 시 가격 즉시 변경', () => {
  const base = { service: 'paper', paper: { typeId: 'master', task: 'full' } };
  assert.equal(computeQuote(DEFAULT_CATALOG, base).total, 99000);
  assert.equal(computeQuote(DEFAULT_CATALOG, { ...base, paper: { typeId: 'doctor', task: 'full' } }).total, 199000);
  assert.equal(computeQuote(DEFAULT_CATALOG, { ...base, paper: { typeId: 'master', task: 'edit' } }).total, 49000);
  assert.equal(computeQuote(DEFAULT_CATALOG, { ...base, paper: { typeId: 'master', task: 'feedback' } }).total, 59000);
  assert.equal(computeQuote(DEFAULT_CATALOG, { ...base, paper: { typeId: 'journal', task: 'full' } }).total, 99000);
});
t('추가 분량·옵션 가산', () => {
  const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 85 }, addons: { priority: true, format: true, revisions: 1 } });
  // 99,000(80 Page) + 추가 5 Page(1블록×19,000) + 우선 처리 29,000 + 양식 19,000 + 추가 수정 19,000
  assert.equal(q.total, 99000 + 19000 + 29000 + 19000 + 19000);
  assert.equal(q.payableNow, true);
});
t('피드백 항목 수 기반 가산', () => {
  const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'feedback', feedbackItems: 17 } });
  assert.equal(q.total, 59000 + 2 * 19000);
});
t('설문 모집 의뢰는 견적형(결제 불가)', () => {
  const q = computeQuote(DEFAULT_CATALOG, { service: 'survey', survey: { mode: 'full', recruit: 'us' } });
  assert.equal(q.quoteRequired, true); assert.equal(q.payableNow, false);
  assert.ok(q.quoteReasons[0].includes('견적'));
});
t('통계: 데이터 유무·결과물에 따른 가격', () => {
  assert.equal(computeQuote(DEFAULT_CATALOG, { service: 'statistics', statistics: { hasData: true, output: 'table' } }).total, 49000);
  assert.equal(computeQuote(DEFAULT_CATALOG, { service: 'statistics', statistics: { hasData: true, output: 'interp', advanced: true } }).total, 69000 + 19000);
  assert.equal(computeQuote(DEFAULT_CATALOG, { service: 'statistics', statistics: { hasData: false, noDataPath: 'simulation' } }).total, 19000);
  const sem = computeQuote(DEFAULT_CATALOG, { service: 'statistics', statistics: { hasData: true, output: 'interp', sem: true } });
  assert.equal(sem.payableNow, false);
});
t('가격표 변경은 새 견적에만 반영', () => {
  const before = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full' } });
  const changed = clone(DEFAULT_CATALOG);
  changed.items.find((i) => i.code === 'P-MASTER-FULL').price = 179000;
  const after = computeQuote(changed, { service: 'paper', paper: { typeId: 'master', task: 'full' } });
  assert.equal(before.total, 99000); assert.equal(after.total, 179000);
});
t('영업일 계산(주말 제외)', () => {
  const d = addBusinessDays(new Date(2026, 10, 6), 1, []); // 2026-11-06 금 → 11-09 월
  assert.equal(d.getDate(), 9);
});
t('심사 발표 PPT·영문 논문 작성·논문 첨삭 옵션', () => {
  // 석사 80 Page + 영문(80 Page → 10 Page 단위 8개) + PPT
  const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 80 }, addons: { ppt: true, english: true } });
  const en = q.lines.find((l) => l.code === 'A-ENGLISH');
  assert.equal(en.qty, 8);
  assert.equal(en.amount, 8 * 29000);
  assert.ok(q.lines.some((l) => l.code === 'A-PPT' && l.amount === 39000));
  assert.equal(q.total, 99000 + 8 * 29000 + 39000);
  // 영문 작성은 전체 구성·초고 완성에만, 논문 첨삭은 피드백 반영·통계·설문에만 붙는다
  const fb = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'doctor', task: 'feedback' }, addons: { english: true, editing: true } });
  assert.ok(!fb.lines.some((l) => l.code === 'A-ENGLISH'));
  assert.ok(fb.lines.some((l) => l.code === 'P-DOCTOR-EDIT' && l.amount === 69000));
  const full = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full' }, addons: { editing: true } });
  assert.ok(!full.lines.some((l) => /-EDIT$/.test(l.code)));
  const st = computeQuote(DEFAULT_CATALOG, { service: 'statistics', statistics: { hasData: true, output: 'interp' }, addons: { editing: true, editingType: 'journal', ppt: true } });
  assert.ok(st.lines.some((l) => l.code === 'P-JOURNAL-EDIT'));
  assert.equal(st.total, 69000 + 39000 + 39000);
  const sv = computeQuote(DEFAULT_CATALOG, { service: 'survey', survey: { mode: 'full', recruit: 'none' }, addons: { editing: true, editingType: 'nope' } });
  assert.ok(sv.lines.some((l) => l.code === 'P-MASTER-EDIT'), '알 수 없는 유형은 석사 기준');
});
t('논문 완성 대표 요금(소논문 15·학사 30·학술지 20·석사 80·박사 130 Page)', () => {
  const q = (typeId, pages) => computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId, task: 'full', pages } });
  assert.equal(q('short', 15).total, 29000);
  assert.equal(q('short', 15).days, 2);
  assert.equal(q('short', 20).total, 29000 + 9000);
  assert.equal(q('short', 25).total, 29000 + 9000 * 2);
  assert.ok(q('short', 20).lines.some((l) => l.code === 'P-SHORT-FULL-X' && l.qty === 1));
  assert.equal(q('bachelor', 30).total, 59000);
  assert.equal(q('journal', 20).total, 99000);
  assert.equal(q('master', 80).total, 99000);
  assert.equal(q('master', 80).lines.length, 1, '석사 80 Page는 상품 하나로 결제');
  assert.equal(q('doctor', 130).total, 199000);
  assert.equal(q('doctor', 130).lines.length, 1, '박사 130 Page는 상품 하나로 결제');
  // 소논문은 전체 구성·초고 완성만 있음(첨삭·피드백 상품 없음)
  assert.ok(!DEFAULT_CATALOG.items.some((i) => /^P-SHORT-(EDIT|FB|PROP)$/.test(i.code)));
});

t('포함 항목의 분량은 주문한 Page로 표시', () => {
  const q = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'full', pages: 80 } });
  const inc = includesFor(q.includes, 80);
  assert.ok(inc.includes('서론부터 결론까지 장별 본문 80 Page'), inc.join(' / '));
  assert.ok(includesFor(q.includes, 90).includes('서론부터 결론까지 장별 본문 90 Page'));
  assert.ok(!inc.some((x) => /쪽/.test(x)));
  // 분량을 모르면 원래 문구 그대로, 항목 수 기준(피드백)은 건드리지 않음
  assert.deepEqual(includesFor(q.includes, 0), q.includes);
  const fb = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'master', task: 'feedback', feedbackItems: 10 } });
  assert.deepEqual(includesFor(fb.includes, 45), fb.includes);
  const ed = computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId: 'bachelor', task: 'edit', pages: 45 } });
  assert.ok(includesFor(ed.includes, 45).includes('원고 첨삭(45 Page)'));
});

t('정가와 런칭 특가 할인율', () => {
  // 런칭 특가는 정가의 반값(50%)
  for (const [code, price, list] of [['P-SHORT-FULL', 29000, 59000], ['P-BACHELOR-FULL', 59000, 119000], ['P-JOURNAL-FULL', 99000, 199000], ['P-MASTER-FULL', 99000, 199000], ['P-DOCTOR-FULL', 199000, 399000], ['P-BACHELOR-PROP', 29000, 59000], ['P-MASTER-PROP', 69000, 139000], ['P-DOCTOR-PROP', 99000, 199000]]) {
    assert.equal(listPriceFor(code, price), list, code);
    assert.equal(discountRate(list, price), 50, code);
  }
  // 정가가 없거나 판매가보다 낮으면 표시하지 않음
  assert.equal(listPriceFor('T-BASIC', 49000), 0);
  assert.equal(listPriceFor('P-SHORT-FULL', 60000), 0);
  assert.equal(discountRate(0, 99000), 0);
  assert.equal(pageLabel(80), '80 Page');
});
