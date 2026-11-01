// 설문 구성·통계 분석 계획 미리보기 (규칙 기반)
import { buildDesign } from './engine.js';

const TARGET_LABEL = { auto: '추천 대상', student: '대학생', worker: '직장인', teacher: '교사', parent: '학부모', adult: '성인', other: '기타 대상' };

export function surveyPlan({ title = '', keywords = [], fieldId = 'other', target = 'auto', targetN = 'auto', mode = 'full', analysis = 'auto' }) {
  const d = buildDesign({ title, keywords, fieldId, typeId: 'master' });
  const vars = d.model.nodes.filter((n) => !['group', 'program'].includes(n.role));
  const sections = [{ name: '연구 참여 안내와 동의', items: 1, note: '연구 목적, 익명 처리, 중도 철회 안내' }];
  let total = 0;
  for (const v of vars) {
    const sc = v.scales[0];
    const items = v.known ? 12 : 10;
    sections.push({ name: v.name, items, note: sc ? `${sc.name} (${sc.ref}) 후보` : '선행연구 검증 척도에서 선정' });
    total += items;
  }
  if (!vars.length) { sections.push({ name: '주요 변인 문항', items: 20, note: '연구 주제에 맞춰 설계' }); total += 20; }
  sections.push({ name: '인구사회학적 특성', items: 7, note: '성별, 연령, 학력·경력 등' });
  total += 7;
  const minutes = Math.max(5, Math.round((total * 10) / 60));
  const rec = d.sample.recommended || null;
  const nLabel = targetN === 'auto' ? (rec ? `${rec}명(추천)` : '설계 후 추천') : `${targetN}명`;
  const analyses = analysis === 'basic' ? ['빈도분석·기술통계', '신뢰도 분석'] : analysis === 'relation' ? ['신뢰도 분석', '상관분석', 't검정·분산분석', '회귀분석'] : analysis === 'advanced' ? ['신뢰도·요인분석', '상관분석', '매개·조절효과(PROCESS)', '필요 시 구조방정식'] : d.analysis;
  return { design: d, sections, totalItems: total, minutes, targetLabel: TARGET_LABEL[target] || target, nLabel, recommendedN: rec, analyses };
}

const METHOD_PLAN = {
  auto: '연구 목적에 맞는 분석 추천',
  basic: '빈도분석·기술통계',
  group: '독립표본 t검정, 일원분산분석(사후검정)',
  correg: '상관분석, 다중·위계적 회귀분석',
  reliability: '신뢰도 분석, 탐색적 요인분석',
  medmod: 'PROCESS Macro 매개·조절효과(부트스트래핑 5,000회)',
  sem: '확인적 요인분석, 구조방정식모형',
  other: '요청 내용에 따른 분석',
};
export const METHOD_LABELS = { auto: '잘 모르겠어요 (추천)', basic: '기초 통계', group: '집단 차이', correg: '상관·회귀', reliability: '신뢰도·요인', medmod: '매개·조절', sem: '구조방정식', other: '기타' };

export function statsPlan({ methods = ['auto'], title = '' }) {
  const steps = ['데이터 점검(결측·이상치·역문항)', '응답자 일반적 특성(빈도분석)'];
  const ms = methods.length ? methods : ['auto'];
  if (ms.includes('auto')) {
    const d = title ? buildDesign({ title }) : null;
    (d ? d.analysis : ['신뢰도 분석', '기술통계', '연구 가설에 맞는 분석']).forEach((a) => steps.push(a));
  } else {
    if (!ms.includes('reliability')) steps.push('측정도구 신뢰도(Cronbach\'s α)');
    ms.forEach((m) => steps.push(METHOD_PLAN[m]));
  }
  return { steps: [...new Set(steps)], advanced: ms.includes('medmod'), sem: ms.includes('sem') };
}
