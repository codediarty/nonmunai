// 설문 응답 분석·통계분석 요청에서 기본 금액에 없는 분석 찾기(2026-11-27)
import assert from 'node:assert/strict';
import { statExtras } from '../../src/js/app/stat-extras.js';

const keys = (t) => statExtras(t).map((x) => x.key);

export const tests = [
  { name: '매개·조절효과, PROCESS를 적으면 심화 분석으로 봄', fn() {
    assert.deepEqual(keys('직무스트레스가 이직의도에 미치는 영향: 회복탄력성의 매개효과'), ['adv']);
    assert.deepEqual(keys('사회적 지지의 조절효과도 보고 싶어요'), ['adv']);
    assert.deepEqual(keys('PROCESS macro model 7로 조절된 매개를 봐 주세요'), ['adv']);
    assert.deepEqual(keys('이중매개 모형'), ['adv']);
  } },
  { name: '변인 이름에 들어간 조절·매개 같은 말은 심화 분석으로 보지 않음', fn() {
    assert.deepEqual(keys('초등학생의 정서조절 능력과 또래관계'), []);
    assert.deepEqual(keys('감정조절과 소진의 관계, 위계적 회귀분석'), []);
    assert.deepEqual(keys('미디어 매개 커뮤니케이션 이용 실태'), []);
  } },
  { name: '구조방정식·확인적 요인분석·다층모형은 복잡한 모형으로 봄', fn() {
    assert.deepEqual(keys('AMOS로 구조방정식 분석'), ['sem']);
    assert.deepEqual(keys('확인적 요인분석(CFA)까지 해 주세요'), ['sem']);
    assert.deepEqual(keys('HLM 다층모형'), ['sem']);
    assert.deepEqual(keys('매개효과를 구조방정식으로 검증'), ['adv', 'sem']);
  } },
  { name: '빈 글이나 기본 분석만 적으면 아무것도 없음', fn() {
    assert.deepEqual(keys(''), []);
    assert.deepEqual(keys(null), []);
    assert.deepEqual(keys('t검정, 분산분석, 상관분석, 다중회귀분석'), []);
  } },
];
