// 교수님 피드백 자동 분류: 항목 나누기 + 범주 판별 (규칙 기반)
const CATS = [
  ['연구방법', /(표본|대상자?|측정|척도|도구|표집|설계|IRB|절차|모집|변인|통제변수|변수 선정|변수 정의|조작적)/],
  ['통계', /(분석|회귀|상관|유의|효과크기|SPSS|신뢰도|타당도|결측|검정|통계|β|p값|표준오차|부트스트)/i],
  ['문헌', /(선행연구|문헌|인용|참고문헌|출처|최신|최근|국내 자료|해외 자료|자료를? 보완|근거 자료|레퍼런스)/],
  ['논리·구성', /(논리|흐름|구성|연결|목적|필요성|근거|일관|중복|반복|구체|명확|주장)/],
  ['형식', /(형식|양식|서식|표기|띄어쓰기|맞춤법|APA|번호|그림|쪽|페이지|여백|글꼴|목차|각주)/i],
  ['표현', /(문장|표현|어색|용어|오타|어휘|문체|비문|간결)/],
];

export function splitFeedback(text) {
  const raw = String(text || '').replace(/\r/g, '').trim();
  if (!raw) return [];
  let parts = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  // 한 줄에 여러 번호가 붙은 경우 분리
  parts = parts.flatMap((p) => p.split(/\s(?=(?:\d{1,2}[.)]|[①-⑳]|[-•·]\s))/));
  // 긴 문단은 지시형 문장 단위로 분리
  parts = parts.flatMap((p) => p.split(/(?<=(?:다|요|것|음|함|람|임|오|라|망)[.?!])\s+|(?<=\?)\s+/));
  return parts
    .map((p) => p.replace(/^(?:\d{1,2}[.)]\s*|[①-⑳]\s*|[-•·*]\s*)/, '').trim())
    .filter((p) => p.length >= 4);
}

export function classifyFeedback(text) {
  const items = splitFeedback(text).map((t) => {
    const cat = (CATS.find(([, re]) => re.test(t)) || ['기타'])[0];
    return { text: t, category: cat };
  });
  const counts = {};
  for (const i of items) counts[i.category] = (counts[i.category] || 0) + 1;
  return { items, count: items.length, counts };
}
