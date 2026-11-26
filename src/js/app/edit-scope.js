// 첨삭 요청 사항 읽기(2026-11-26): 고객이 적은 요청에 고른 첨삭 단계보다 높은 단계의 작업이 있으면 알려 준다.
// 예) 기본 교정(문장 교정)을 고르고 '내용 보완, 구조 검토'를 적으면 완성도 보완을 권한다. 강제로 바꾸지는 않는다.
const RULES = [
  { level: 'complete', label: '내용 보완', re: /내용\s*(을|를|도|까지)?\s*(보완|보강|추가|채워|늘려)|보완\s*(집필|작성)|(내용|분량)\s*(이|을|를)?\s*(부족|모자|늘려|채워)|추가\s*(집필|작성)|더\s*(써|채워)/ },
  { level: 'complete', label: '구조·목차 재구성', re: /(구조|구성|목차|장\s*구성|체계)\s*(을|를|도|까지|의|및)?\s*(검토|점검|수정|변경|재구성|다시|바꿔|손봐|정리|개선)|재구성|재배치/ },
  { level: 'complete', label: '논리·사실 확인', re: /(사실|팩트|수치|통계\s*수치|데이터)\s*(관계)?\s*(을|를|도|까지|의)?\s*(확인|검증|체크|점검)|팩트\s*체크|사실\s*관계|(논리|사실)\s*[·,/및]\s*(사실|논리)\s*(확인|검증|점검|체크)/ },
  { level: 'complete', label: '제출 수준 완성', re: /(제출|심사|졸업)\s*(이|을|를)?\s*(가능한|할\s*수\s*있는|수준|직전|용)|완성도|처음부터\s*다시|전면\s*(수정|개정|재작성)/ },
  { level: 'deep', label: 'AI 문체 교정', re: /AI\s*[-·]?\s*(문체|말투|톤|티|느낌|흔적|표현|가\s*쓴|가\s*작성|로\s*쓴|로\s*작성)|에이아이|G\s*P\s*T|지피티|챗\s*지피티|인공지능\s*(문체|티|느낌)|번역투|기계\s*(적|번역)/i },
  { level: 'deep', label: '흐름·논리 다듬기', re: /흐름|논리|매끄럽|문단\s*연결|전개|일관성/ },
  { level: 'deep', label: '인용·참고문헌 점검', re: /인용|참고\s*문헌|레퍼런스|APA|출처|각주|reference|citation/i },
  { level: 'deep', label: '보완 의견', re: /코멘트|(의견|피드백)\s*(을|를)?\s*(주|달아|남겨|적어)|보완\s*(점|할\s*(부분|점))/ },
];
const RANK = { basic: 0, deep: 1, complete: 2 };

export function scopeHits(text) {
  const t = String(text || '');
  const out = [];
  for (const r of RULES) if (r.re.test(t) && !out.some((x) => x.label === r.label)) out.push({ level: r.level, label: r.label });
  return out;
}
export function neededLevel(text) {
  const hits = scopeHits(text);
  return hits.some((h) => h.level === 'complete') ? 'complete' : hits.some((h) => h.level === 'deep') ? 'deep' : 'basic';
}
// 고른 단계(picked)보다 높은 단계가 필요하면 { level, labels } , 아니면 null
export function scopeNudge(text, picked) {
  const need = neededLevel(text);
  if ((RANK[need] || 0) <= (RANK[picked] || 0)) return null;
  // 필요한 단계의 작업을 앞에(높은 단계 먼저)
  const hits = scopeHits(text).filter((h) => RANK[h.level] > (RANK[picked] || 0)).sort((a, b) => RANK[b.level] - RANK[a.level]);
  return { level: need, labels: hits.map((h) => h.label) };
}

// 받침에 맞는 조사: josa('완성도 보완', '을/를') → '완성도 보완을'
export function josa(word, pair) {
  const w = String(word || '');
  const [a, b] = pair.split('/');
  const ch = w.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (!(code >= 0 && code <= 11171)) return w + b;
  const jong = code % 28;
  if (pair === '으로/로') return w + (jong === 0 || jong === 8 ? b : a);
  return w + (jong ? a : b);
}
