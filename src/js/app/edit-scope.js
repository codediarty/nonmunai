// 첨삭 요청 사항 읽기(2026-11-26): 고객이 적은 요청에 기본 교정(문장 교정)에 없는 작업이 있는지 본다.
// 고객에게 단계를 고르게 하지 않는다. 주문서는 '원고를 보고 추가 금액을 먼저 알려 드린다'고만 알리고,
// 운영자 화면은 요청에 맞는 '자주 쓰는 추가 작업' 단추를 먼저 보여 준다.
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
// 기본 교정에 없는 작업 이름(일이 많은 것부터): ['내용 보완', 'AI 문체 교정', ...]
export function extraWork(text) {
  return scopeHits(text).filter((h) => (RANK[h.level] || 0) > 0).sort((a, b) => RANK[b.level] - RANK[a.level]).map((h) => h.label);
}

// 운영자 '추가 결제 요청'의 자주 쓰는 추가 작업 두 가지. 금액은 가격표의 같은 유형 EDIT2·EDIT3(10만 원 단위) 금액을 쓴다
export const EXTRA_WORK = [
  {
    level: 'deep', label: 'AI 문체·흐름·인용 맞추기',
    work: ['AI 문체·번역투를 자연스러운 학술 문장으로 고쳐 쓰기', '문단 흐름과 논리 연결 다듬기', '본문 인용과 참고문헌 목록 대조·형식 통일', '장별 보완 코멘트'],
    reason: '적어 주신 AI 문체 교정과 흐름·인용 정리는 문장만 다듬는 기본 교정에 없는 작업이라, 추가 작업으로 함께 진행하려고 해요.',
  },
  {
    level: 'complete', label: '내용 보완·구성 다시 잡기',
    work: ['AI 문체·번역투를 자연스러운 학술 문장으로 고쳐 쓰기', '문단 흐름과 논리 연결 다듬기', '본문 인용과 참고문헌 목록 대조·형식 통일', '목차·장 구성 점검과 재배치', '부족한 근거·선행연구 보완 집필(실존 문헌만)', '논리 비약과 사실·수치 확인', '수정 1회'],
    reason: '적어 주신 내용 보완과 구성 검토까지 하려면 문단을 새로 쓰고 근거를 찾아 넣어야 해서, 추가 작업으로 함께 진행하려고 해요.',
  },
];

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
