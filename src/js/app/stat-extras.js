// 통계·설문 응답 분석에서 기본 금액에 없는 분석 알아보기(2026-11-27, DOM 없음, 테스트 가능)
// 고객에게 분석 방법을 고르게 하지 않는다. 연구 주제·요청 사항에 적힌 말을 보고 '데이터를 확인한 뒤 추가 금액 안내'를
// 미리 알려 주기만 한다(첨삭 extraWork와 같은 방식). 금액은 운영자가 확인하고 '추가 결제 요청'으로 받는다.

export const STAT_EXTRAS = [
  {
    key: 'adv', code: 'T-ADV', label: '매개·조절효과 분석',
    re: /매개\s*(효과|변수|변인|역할|모형|분석)|(이중|병렬|순차적?|다중)\s*매개|조절된\s*매개|조절\s*(효과|변수|변인|역할|모형|분석)|PROCESS|프로세스\s*매크로|부트스트래?핑|bootstrap/i,
  },
  {
    key: 'sem', code: '', label: '구조방정식 같은 복잡한 모형',
    re: /구조\s*방정식|\bSEM\b|AMOS|에이모스|확인적\s*요인|\bCFA\b|다층\s*모형|위계적\s*선형\s*모형|\bHLM\b|잠재\s*(성장|프로파일|계층|집단)|다집단\s*분석|lavaan|Mplus/i,
  },
];

// 글에서 찾은 추가 분석(위에 적은 순서대로)
export function statExtras(text) {
  const t = String(text || '');
  return STAT_EXTRAS.filter((x) => x.re.test(t));
}
