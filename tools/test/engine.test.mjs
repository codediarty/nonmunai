// 연구 설계 엔진 단위 테스트
import assert from 'node:assert/strict';
import * as S from '../../src/js/core/stats.js';
import { parseTitle, buildDesign, suggestTitles, josa, tocToText } from '../../src/js/core/engine.js';
import { renderModelSVG } from '../../src/js/core/model-svg.js';

export const tests = [];
const t = (name, fn) => tests.push({ name, fn });

t('G*Power 회귀분석 표본 수 일치', () => {
  const expect = { 1: 55, 2: 68, 3: 77, 4: 85, 5: 92, 6: 98, 7: 103, 8: 109, 10: 118 };
  for (const [k, n] of Object.entries(expect)) assert.equal(S.nRegression({ predictors: +k }).n, n, `k=${k}`);
});
t('G*Power t검정·대응·분산분석·카이제곱·상관 일치', () => {
  assert.equal(S.nTTest({}).perGroup, 64);
  assert.equal(S.nTTest({ d: 0.8 }).perGroup, 26);
  assert.equal(S.nPairedT({}).n, 34);
  assert.equal(S.nAnova({ groups: 3 }).n, 159);
  assert.equal(S.nAnova({ groups: 4 }).n, 180);
  assert.equal(S.nChiSquare({ df: 1 }).n, 88);
  assert.equal(S.nChiSquare({ df: 2 }).n, 108);
  assert.equal(S.nCorrelation({ r: 0.3 }).n, 84);
  assert.equal(S.nProportion({}).n, 385);
});
t('크론바흐 알파 계산', () => {
  const r = S.cronbachAlpha([[1, 2, 3], [2, 3, 3], [3, 4, 5], [4, 4, 5], [5, 5, 4]]);
  assert.ok(Math.abs(r.alpha - 0.8898) < 1e-3);
});
t('조사 처리(받침)', () => {
  assert.equal(josa('직무스트레스', '이/가'), '직무스트레스가');
  assert.equal(josa('회복탄력성', '은/는'), '회복탄력성은');
  assert.equal(josa('서울', '으로/로'), '서울로');
  assert.equal(josa('TAM', '이/가'), 'TAM이');
});
t('매개효과 제목 해석', () => {
  const p = parseTitle('간호사의 직무스트레스가 이직의도에 미치는 영향: 회복탄력성의 매개효과');
  assert.equal(p.design, 'mediation'); assert.equal(p.population, '간호사');
  assert.deepEqual(p.ivs, ['직무스트레스']); assert.deepEqual(p.dvs, ['이직의도']); assert.deepEqual(p.mediators, ['회복탄력성']);
});
t('조절된 매개 제목 해석', () => {
  const p = parseTitle('초심상담자의 거부민감성과 상담자 소진의 관계: 정신화로 조절된 정서표현억제의 매개효과');
  assert.equal(p.design, 'modmed'); assert.deepEqual(p.moderators, ['정신화']); assert.deepEqual(p.mediators, ['정서표현억제']);
});
t('조절·차이·영향요인·프로그램·질적·문헌·개발 판별', () => {
  assert.equal(parseTitle('대학생의 SNS 이용과 우울의 관계에서 자기효능감의 조절효과').design, 'moderation');
  assert.equal(parseTitle('직위에 따른 공무원의 직무만족 차이').design, 'difference');
  assert.equal(parseTitle('노인의 삶의 만족 영향요인').design, 'factors');
  const pg = parseTitle('웃음치료 프로그램이 요양시설 노인의 우울에 미치는 효과');
  assert.equal(pg.design, 'program'); assert.equal(pg.population, '요양시설 노인');
  assert.equal(parseTitle('신규간호사의 이직 경험에 관한 현상학적 연구').design, 'qualitative');
  assert.equal(parseTitle('생성형 AI 활용 교육에 관한 국내 연구 동향 분석').design, 'literature');
  assert.equal(parseTitle('딥러닝 기반 객체 인식 시스템 설계 및 구현').design, 'development');
  assert.equal(parseTitle('대학생의 SNS 활동이 우울에 미치는 영향').design, 'effect');
});
t('가설 방향(정·부) 추론', () => {
  const d = buildDesign({ title: '간호사의 직무스트레스가 이직의도에 미치는 영향: 회복탄력성의 매개효과' });
  assert.match(d.hypotheses[0].text, /정\(\+\)의 영향/);
  assert.match(d.hypotheses[1].text, /부\(-\)의 영향/);
  assert.match(d.hypotheses[3].text, /매개할 것이다/);
});
t('주제 모름: 키워드로 추천 주제 생성', () => {
  const s = suggestTitles({ keywords: ['감정노동'], fieldId: 'tour' });
  assert.ok(s.length >= 3); assert.ok(s[0].title.startsWith('호텔 종사원'));
});
t('목차·표본·일정 산출', () => {
  const d = buildDesign({ typeId: 'master', title: '간호사의 직무스트레스가 이직의도에 미치는 영향: 회복탄력성의 매개효과', start: '2026-11-01', due: '2027-01-31' });
  const txt = tocToText(d.toc);
  assert.match(txt, /제2장 이론적 배경/); assert.match(txt, /매개효과 검증/);
  assert.equal(d.sample.n, 92); assert.equal(d.sample.recommended, 109);
  assert.equal(d.schedule.phases[0].start, '2026.11.01');
});
t('결정론: 같은 입력이면 같은 결과', () => {
  const a = JSON.stringify(buildDesign({ title: '대학생의 자아존중감과 우울의 관계', start: '2026-11-01' }));
  const b = JSON.stringify(buildDesign({ title: '대학생의 자아존중감과 우울의 관계', start: '2026-11-01' }));
  assert.equal(a, b);
});
t('연구모형 SVG 생성', () => {
  const d = buildDesign({ title: '대학생의 SNS 이용과 우울의 관계에서 자기효능감의 조절효과' });
  const svg = renderModelSVG(d.model);
  assert.match(svg, /^<svg/); assert.match(svg, /조절변수/); assert.match(svg, /자기효능감/);
});
