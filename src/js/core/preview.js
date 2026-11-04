// 프롬프트 읽기와 '내 논문 미리보기' 문장 만들기 (DOM 없음, 테스트 가능)
// 고객이 편하게 적은 관심 주제·키워드에서 논문 종류, 쪽수, 전공, 키워드를 읽고
// 서론 첫 문단과 목차를 그 키워드로 만든다. 제목은 확정하지 않는다(연구진이 다듬음).
import { POPULATIONS, FIELDS, guessField } from './kb.js';
import { josa } from './engine.js';

// 홈 첫 화면 예시 문장과 제목(주문서에는 그대로 옮기지 않는다)
export const DEMO_PROMPT = '경영학 석사인데, MZ세대 직장인 워라밸이랑 이직 관련해서 논문 완성해줘';
export const DEMO_TITLE = 'MZ세대 직장인의 워라밸이 이직의도에 미치는 영향';
// 예전 예시 문장(브라우저에 남은 옛 화면에서 넘어와도 빈 주문서가 열리도록 함께 둔다)
export const DEMO_PROMPTS = [DEMO_PROMPT, '간호학과 석사인데, 간호사 이직이랑 번아웃 관련해서 논문 완성해줘',
  '경영학 석사인데, MZ세대 직장인 워라밸이랑 이직 관련해서 논문 완성해 주세요', '간호학과 석사인데, 간호사 이직이랑 번아웃 관련해서 논문 완성해 주세요'];
export const TYPE_LABEL = { short: '소논문', bachelor: '학사 졸업논문', journal: '학술지 투고논문', master: '석사학위논문', doctor: '박사학위논문', youth: '청소년 탐구논문', personal: '개인 관심연구', report: '연구보고서' };

const TYPE_RULES = [
  ['doctor', /박사/],
  ['master', /석사|대학원생?|학위\s*논문/],
  ['journal', /학술지|KCI|SCI|등재지|투고/i],
  ['bachelor', /학사|졸업\s*논문|학부/],
  ['youth', /청소년\s*탐구|탐구\s*(?:논문|보고서)|고등학생|고교/],
  ['report', /연구\s*보고서/],
  ['short', /소논문|리포트|레포트|과제|기말/],
];

// 주제가 아닌 말(부탁·말끝·자기소개)
const FILLER = [
  /(?:논문|글|원고|레포트|리포트)?\s*(?:을|를)?\s*(?:좀\s*)?(?:완성|작성|써|만들어|정리)\s*(?:시켜|해)?\s*(?:주세요|주실\s*수\s*있나요|줘요|줘|주라|줄래|주시면\s*좋겠어요|주십시오|드려요|드립니다|바랍니다)?[.!?~]*/g,
  /(?:부탁|의뢰)\s*(?:해요|합니다|드려요|드립니다|드리고\s*싶어요)?[.!?~]*/g,
  /(?:하고|쓰고|알아보고|연구하고)\s*싶(?:어요|습니다|은데요?|어)[.!?~]*/g,
  /(?:관련(?:해서|된|한)?|관해서|관한|에\s*대(?:해서?|한)|쪽으로|중심으로|주제로|위주로|에\s*관한\s*연구|에\s*대한\s*연구)/g,
  /(?:석사|박사|학사)?\s*(?:학위)?\s*(?:과정|과정생|대학원생|학생)?\s*(?:이에요|예요|이고요?|입니다|인데요?|이라서|인데|이며)/g,
  /(?:^|\s)(?:저는|제가|저|요즘|그냥|좀|약|대략|정도|총|아무거나|아무\s*주제나|아무|뭐든지?|뭐|거|것|암튼|일단)(?=\s|$|[,.])/g,
  /(?:\d\s*학년|학년|\d\s*학기|재학\s*중|재학생|졸업\s*예정)(?:이에요|인데요?|입니다|이고)?/g,
  /(?:논문|소논문|학위논문|졸업논문|연구계획서|계획서)/g,
];

const PARTS = ['에서의', '에서는', '에서', '으로의', '으로', '로의', '에게', '에는', '에도', '에', '을', '를', '이', '가', '은', '는', '의', '도', '와', '과', '로'];
const KEEP_END = /(?:효과|결과|성과|학과|교과|통과|초과|경과|사과|만족도|정도|태도|제도|속도|빈도|강도|밀도|용도|의도|이직의도|구매의도|재방문의도|사용의도|과정|가구|학교|기관|문화|지도|도구|강의|회의|정의|주의|여가|평가|대가|국가|작가|전문가|휴가|가치|이야기|아이|노인이|어르신|청소년|이)$/;

function stripEnd(w) {
  let s = String(w || '').trim().replace(/^[,·\s"'“”‘’()]+|[,·\s"'“”‘’()?!.~]+$/g, '');
  if (!s || KEEP_END.test(s)) return s;
  for (const p of PARTS) {
    if (s.endsWith(p) && s.length > p.length + 1) {
      const cand = s.slice(0, -p.length).trim();
      if (cand.length >= 2 && !/\s$/.test(cand)) return cand;
    }
  }
  return s;
}

// 전공: '간호학과', '경영학 석사', '유아교육과', '상담심리 전공'
const MAJOR_STEM = '(?:치위생|방사선|임상병리|응급구조|안경광학|미용|뷰티|경찰행정|소방|세무|비서|물리치료|작업치료|교육|공학|과학|복지|경영|행정|심리|디자인|예술|체육|간호|보건|치료|의학|약학|무용|음악|미술|신학|법학|정책|관광|조리|식품|영양|미디어|광고|언론|정보|컴퓨터|전자|기계|건축|토목|화학|물리|생물|수학|통계|경제|무역|회계|금융|부동산|국문|영문|사학|철학|문헌정보|아동|가족|청소년|노인|상담|특수|유아|영상|패션|항공|호텔|외식|스포츠)';
const MAJOR_RES = [
  [new RegExp('([가-힣A-Za-z]{1,12})학과'), (m) => `${m[1]}학`],
  [new RegExp('([가-힣A-Za-z]{1,12}학)\\s*(?:석사|박사|학사|전공|과정|대학원|부)'), (m) => m[1]],
  [new RegExp(`([가-힣]{0,8}${MAJOR_STEM})과(?=[\\s,.]|$|에|이|생|를|입니다|이에요|인데)`), (m) => m[1]],
  [new RegExp('([가-힣A-Za-z]{2,12})\\s?전공'), (m) => m[1]],
];
function readMajor(t) {
  for (const [re, f] of MAJOR_RES) { const m = t.match(re); if (m) return { label: f(m), text: m[0] }; }
  return { label: '', text: '' };
}

function splitTopic(t) {
  // '무엇이 무엇에 미치는 영향', 'A와 B의 관계' 같은 제목형 문장도 키워드로 나눈다
  let s = t.replace(/에\s*미치는\s*(?:영향|효과)/g, ' , ').replace(/의\s*(?:관계|차이|효과|영향)\b/g, ' , ');
  if (/,\s*$/.test(s.trim()) || /미치는/.test(t)) s = s.replace(/(?<=[가-힣A-Za-z0-9])(?:이|가)\s+/g, ' , ');
  s = s.replace(/(?<=[가-힣A-Za-z0-9])(?:이랑|랑|하고|및|그리고|또는)\s+/g, ' , ')
    .replace(/\s+(?:및|그리고|또는|vs|VS)\s+/g, ' , ');
  // '와/과'는 받침에 맞을 때만(효과·결과 같은 낱말은 그대로 둔다)
  s = s.replace(/([가-힣A-Za-z0-9]+)(와|과)\s+/g, (all, w, p) => {
    if (/(?:효|결|성|학|교|통|초|경|사)$/.test(w) && p === '과') return all;
    const code = w.slice(-1).charCodeAt(0);
    const batchim = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : /[0-9lmnr]$/i.test(w);
    return (p === '과') === batchim ? `${w} , ` : all;
  });
  return s.split(/\s*[,，、\/·ㆍ;]\s*|\s*\n\s*/).map((x) => stripEnd(x.replace(/\s+/g, ' '))).filter((x) => x && x.length >= 2 && x.length <= 30 && !/^[0-9\s]+$/.test(x));
}

// 프롬프트 읽기: { typeId, pages, major, fieldId, fieldLabel, population, keywords }
export function readPrompt(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  const typeRule = TYPE_RULES.find(([, re]) => re.test(raw));
  const pm = raw.match(/(\d{1,3})\s*(?:쪽|페이지|[Pp]ages?\b|p\b|P\b)/);
  const mj = readMajor(raw);
  const major = mj.label;
  const f = guessField(major || raw);
  let rest = (mj.text ? raw.replace(mj.text, ' ') : raw)
    .replace(/\d{1,3}\s*(?:쪽|페이지|[Pp]ages?\b|p\b|P\b)(?:\s*(?:짜리|분량|정도|내외|으로|로))?/g, ' ')
    .replace(/^\s*(?:이에요|예요|이고|인데요?|입니다|에서|이며|이라서|학생|생)[.,]?/, ' ')
    .replace(/[가-힣A-Za-z]{2,12}\s?(?:학과|전공)(?:이에요|이고|인데|입니다|에서|이며|이라서)?/g, ' ')
    .replace(/[가-힣A-Za-z]{2,12}학\s*(?:석사|박사|학사)(?:\s*과정)?/g, ' ')
    .replace(/(?:석사|박사|학사)(?:\s*과정)?(?:생|이에요|예요|인데요?|입니다|이고)?/g, ' ');
  for (const re of FILLER) rest = rest.replace(re, ' ');
  rest = rest.replace(/[.!?~]+/g, ' , ').replace(/\s+/g, ' ').trim();
  let keywords = splitTopic(rest)
    .map((k) => k.replace(/(?:\s*(?:조사|연구|분석|주제|현황|관련|문제))+$/, '').trim())
    .filter((k) => k.length >= 2 && !/^(?:학생|과정|대학원|전공|분야|논문)$/.test(k));
  if (major) keywords = keywords.filter((k) => k !== major && k !== major.replace(/학$/, ''));
  // 같은 말 반복 제거, 3개까지
  keywords = keywords.filter((k, i) => keywords.findIndex((x) => x === k || x.includes(k)) === i).slice(0, 3);
  // 연구 대상: 키워드 앞부분이 대상이면 그 구절 전체('MZ세대 직장인', '반려동물 키우는 1인 가구')
  let population = '';
  for (const k of keywords) {
    let end = -1;
    for (const p of POPULATIONS) {
      let at = k.indexOf(p);
      while (at >= 0) {
        const e = at + p.length;
        const boundary = (at === 0 || k[at - 1] === ' ') && (e === k.length || k[e] === ' ');
        if (boundary && e > end) end = e;
        at = k.indexOf(p, at + 1);
      }
    }
    if (end > 0) { population = k.slice(0, end).trim(); break; }
  }
  if (!population) population = POPULATIONS.filter((p) => rest.includes(p)).sort((a, b) => b.length - a.length)[0] || '';
  return {
    typeId: typeRule ? typeRule[0] : '',
    pages: pm ? Number(pm[1]) : 0,
    major,
    fieldId: f ? f.id : '',
    fieldLabel: f ? f.label : '',
    population,
    keywords,
  };
}

// 키워드 안의 연구 대상 뒤에 '의'를 붙여 읽기 쉽게: 'MZ세대 직장인 조용한 퇴사' → 'MZ세대 직장인의 조용한 퇴사'
function withPop(k, pop) {
  if (!pop || !k.startsWith(pop)) return k;
  const after = k.slice(pop.length);
  if (!after.trim() || /^의\s/.test(after) || !/^\s/.test(after)) return k;
  return `${pop}의${after}`;
}
function withoutPop(k, pop) {
  if (!pop || !k.startsWith(pop)) return k;
  const r = k.slice(pop.length).replace(/^\s*의?\s+/, '').trim();
  return r.length >= 2 ? r : k;
}

function hashNum(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const PAGES_DEFAULT = { short: 15, bachelor: 30, journal: 20, master: 80, doctor: 130, youth: 10, personal: 15, report: 20 };
export const refsFor = (pages) => Math.max(12, Math.min(90, Math.round((Number(pages) || 60) * 0.45)));

function tocFor(typeId, task, k1, k2) {
  const pair = k2 ? `${josa(k1, '과/와')} ${k2}의 관계` : '선행연구 종합과 연구모형';
  if (task === 'proposal') {
    return [
      ['1. 연구의 필요성과 목적', []],
      ['2. 이론적 배경', [`${k1}의 개념과 선행연구`, k2 ? `${k2}의 개념과 선행연구` : '선행연구 검토']],
      ['3. 연구 방법과 분석 계획', ['연구 대상과 표집', '측정 도구', '자료 분석 방법']],
      ['4. 연구 일정과 기대 효과', []],
      ['참고문헌', []],
    ];
  }
  if (['short', 'journal', 'youth', 'personal', 'report'].includes(typeId)) {
    return [
      ['Ⅰ. 서론', ['연구의 필요성', '연구 목적']],
      ['Ⅱ. 이론적 배경', [`${k1}의 개념`, k2 ? `${k2}의 개념` : `${k1}의 관련 요인`, pair]],
      ['Ⅲ. 연구 방법', ['연구 대상', '측정 도구', '분석 방법']],
      ['Ⅳ. 결과 및 논의', []],
      ['Ⅴ. 결론', []],
    ];
  }
  const out = [
    ['제1장 서론', ['연구의 필요성', '연구 목적', '연구 문제', '용어의 정의']],
    ['제2장 이론적 배경', [`${k1}의 개념과 선행연구`, k2 ? `${k2}의 개념과 선행연구` : `${k1}의 관련 요인`, pair]],
    ['제3장 연구 방법', ['연구 설계', '연구 대상', '측정 도구', '자료 수집과 분석']],
    ['제4장 연구 결과', ['일반적 특성', '주요 변인의 기술통계', '가설 검증']],
  ];
  if (typeId === 'doctor') out.push(['제5장 논의', []], ['제6장 결론 및 제언', []]);
  else out.push(['제5장 논의 및 결론', []]);
  return out;
}

// 미리보기 내용: 문장은 [{ t: '글자' } | { cite: 2023 }] 조각 배열
export function buildPreview({ typeId = 'master', task = 'full', major = '', fieldLabel = '', population = '', keywords = [], pages = 0 } = {}) {
  const ks = (keywords || []).filter(Boolean);
  const pop = population;
  const k1raw = ks[0] || (pop ? `${pop}의 경험` : '연구 주제');
  const k2raw = ks[1] || '';
  const k1 = withPop(k1raw, pop);
  const k1core = withoutPop(k1raw, pop);
  const k2 = k2raw ? withoutPop(k2raw, pop) : '';
  const field = major || (fieldLabel && fieldLabel !== '기타·융합' ? fieldLabel : '');
  const where = field ? `${field} 분야에서` : '관련 분야에서';
  const seed = hashNum(ks.join('|') + pop + field);
  const years = [2024, 2023, 2022, 2021, 2020].map((y, i, a) => a[(i + seed) % a.length]);
  const y = (i) => ({ cite: years[i % years.length] });
  const T = (t) => ({ t });

  // 서론 '연구의 필요성': 실제 논문처럼 여러 문단으로 쓰고, 마지막 문단은 문장 중간에서 끊어 나머지(needRest)는 가린다
  const view = pop ? `${pop}의 관점에서` : '현장의 관점에서';
  const need = [
    [
      T(`최근 ${where} ${josa(k1, '은/는')} 현장의 변화와 맞물려 꾸준히 논의되어 온 핵심 주제이다`), y(0), T('. '),
      T(pop
        ? `사회와 산업 환경이 빠르게 바뀌면서 ${josa(pop, '이/가')} 마주하는 일상과 요구도 함께 달라지고 있으며, 이에 따라 ${josa(k1core, '을/를')} 바라보는 관점 역시 넓어지고 있다`
        : `사회와 산업 환경이 빠르게 바뀌면서 현장에서 요구되는 역량과 경험도 함께 달라지고 있으며, 이에 따라 ${josa(k1core, '을/를')} 바라보는 관점 역시 넓어지고 있다`), y(1), T('. '),
      T(`특히 ${josa(k1core, '은/는')} 개인의 삶의 질은 물론 가족과 조직, 지역사회에까지 영향을 미치는 만큼 체계적인 연구가 필요하다는 지적이 이어지고 있다`), y(2), T('.'),
    ],
    [
      T(`${k1core}에 관한 선행연구는 주로 그 개념과 수준을 확인하거나 관련 요인을 탐색하는 데 초점을 맞추어 왔다`), y(3), T('. '),
      T(`국내외 연구들은 ${josa(k1core, '이/가')} 개인의 심리적 특성, 주변 환경, 사회적 지지 등 여러 요인과 관련된다고 보고하였다`), y(4), T('. '),
      ...(k2
        ? [T(`그 가운데 ${josa(k2, '은/는')} ${josa(k1core, '과/와')} 밀접하게 관련된 요인으로 거듭 보고되어 왔다`), y(0), T('.')]
        : [T(`다만 이러한 요인들이 어떤 경로로 ${k1core}에 영향을 미치는지는 연구마다 결과가 엇갈린다`), y(0), T('.')]),
    ],
    [
      T(k2
        ? `그러나 ${josa(k1core, '과/와')} ${k2}의 관계를 ${view} 함께 살펴본 국내 연구는 아직 많지 않다`
        : `그러나 ${k1core}의 실태와 관련 요인을 ${view} 함께 살펴본 국내 연구는 아직 많지 않다`), y(1), T('. '),
      T('또한 기존 연구의 상당수는 일부 집단이나 특정 시기의 자료에 기대고 있어, 달라진 현장을 반영한 실증 자료가 필요하다는 지적이 있다'), y(2), T('.'),
    ],
    [
      T(`이에 본 연구는 ${pop ? `${josa(pop, '을/를')} 대상으로 ` : ''}${k2 ? `${josa(k1core, '과/와')} ${k2}의 관계를` : `${k1core}의 실태와 관련 요인을`} 실증적으로 분석하고,`),
    ],
  ];
  const needRest = [T(`그 결과를 바탕으로 ${field || '관련'} 현장에 필요한 실천적 시사점을 제시하고자 한다.`)];
  const purpose = [
    [T(`본 연구의 목적은 ${k2 ? `${josa(k1core, '과/와')} ${k2}의 관계를 밝히고` : `${k1core}의 수준과 관련 요인을 확인하고`}, 그 결과를 바탕으로 실천적 개입 방안을 제시하는 데 있다. 구체적인 연구 문제는 다음과 같다.`)],
  ];
  const theory = [
    [T(`${josa(k1core, '은/는')} 연구자에 따라 다양하게 정의되어 왔으나, 대체로 개인이 처한 환경과 경험이 태도와 행동으로 나타나는 과정을 설명하는 개념으로 이해된다`), y(3), T('. ')],
    [T(`국내외 선행연구는 ${josa(k1core, '이/가')} 개인의 심리적 특성, 조직 환경, 사회적 지지 등 여러 요인과 관련된다고 보고한다`), y(4), T('. ')],
    k2 ? [T(`${josa(k2, '은/는')} 이러한 관계를 설명하는 주요 변인으로 다루어져 왔다`), y(0), T('.')] : [T('이 장에서는 주요 개념을 정리하고 연구모형의 근거를 제시한다.')],
  ];
  const workTitle = `${pop && !k1core.includes(pop) ? `${pop}의 ` : ''}${k2 ? `${josa(k1core, '과/와')} ${k2}의 관계` : `${k1core}에 관한 연구`}`;
  const tocKey = task === 'proposal' ? 'proposal' : typeId;
  const p = Number(pages) || PAGES_DEFAULT[typeId] || 60;
  return {
    typeLabel: task === 'proposal' ? '연구계획서' : (TYPE_LABEL[typeId] || '논문'),
    field,
    pages: p,
    refs: refsFor(p),
    workTitle,
    toc: tocFor(tocKey, task, k1core, k2),
    need,
    needRest,
    purpose,
    theory,
    keywords: ks,
  };
}

// 조각 배열(문단 또는 문장 목록)을 글자로(테스트·접근성용)
export const plainText = (blocks) => blocks.map((s) => s.map((x) => (x.t != null ? x.t : `(○○, ${x.cite})`)).join('')).join('\n');

export { FIELDS };
