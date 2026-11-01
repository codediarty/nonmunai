// 논문AI 연구 설계 엔진 (규칙 기반)
// 입력한 주제·전공·연구방법으로 연구모형, 가설, 목차, 분석 계획, 표본 수, 일정을 자동 산출합니다.
// 같은 입력이면 항상 같은 결과가 나오도록 무작위 요소를 쓰지 않습니다.

import {
  PAPER_TYPES, FIELDS, CONSTRUCTS, ANALYSIS_PLANS, DESIGN_LABELS,
  findConstruct, isPopulation, guessField, fieldById, typeById,
} from './kb.js';
import { nRegression, nTTest, nAnova, nCorrelation, nProportion, MEDIATION_RULE, withDropout } from './stats.js';

/* ------------------------------------------------------------------ 한국어 조사 */
export function hasBatchim(word) {
  const s = String(word || '').trim().replace(/[\s)\]}"'”’.]+$/, '');
  if (!s) return false;
  const ch = s.slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return '013678'.includes(ch);
  if (/[a-z]/i.test(ch)) return /[lmnr]/i.test(ch);
  return false;
}

export function josa(word, pair) {
  const w = String(word || '');
  const [withB, withoutB] = pair.split('/');
  if (pair === '으로/로') {
    const code = w.trim().slice(-1).charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8) return w + '로';
  }
  return w + (hasBatchim(w) ? withB : withoutB);
}

/* ------------------------------------------------------------------ 정규화 유틸 */
const PARTICLES = ['에서의', '에서', '으로', '에게', '이', '가', '은', '는', '을', '를', '과', '와', '의', '에'];

function exactName(word) {
  const t = word.replace(/\s+/g, '');
  return CONSTRUCTS.some((c) => c.names.some((n) => n.replace(/\s+/g, '') === t));
}

export function stripParticle(word) {
  let w = String(word || '').trim().replace(/^[,·\s]+|[,·\s]+$/g, '');
  if (!w || exactName(w)) return w;
  for (const p of PARTICLES) {
    if (w.endsWith(p) && w.length > p.length + 1) {
      const cand = w.slice(0, -p.length).trim();
      if (cand.length >= 2) return cand;
    }
  }
  return w;
}

export function splitVars(text) {
  if (!text) return [];
  let parts = String(text)
    .split(/\s*(?:,|·|ㆍ|및|그리고|\/)\s*|(?<=[가-힣A-Za-z0-9)])(?:와|과)\s+/)
    .map((s) => stripParticle(s))
    .filter((s) => s && s.length >= 2);
  // 잘못 쪼개진 1글자 조각 방지
  if (parts.some((p) => p.length < 2)) parts = [stripParticle(text)];
  return [...new Set(parts)];
}

function cleanTitle(t) {
  return String(t || '')
    .replace(/[“”"「」『』]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–―]{1,2}\s*/g, ' : ')
    .trim();
}

/* ------------------------------------------------------------------ 제목 해석 */
export function parseTitle(rawTitle) {
  const title = cleanTitle(rawTitle);
  const out = { raw: rawTitle || '', title, population: '', ivs: [], dvs: [], mediators: [], moderators: [], design: '', flags: {}, focus: '', topic: '', confidence: 0 };
  if (!title) return out;

  let [main, ...subParts] = title.split(/\s*[:：]\s*/);
  let sub = subParts.join(' ');
  // 괄호 속 부제
  const paren = main.match(/^(.*?)\s*\(([^)]*(?:매개|조절|중심으로)[^)]*)\)\s*$/);
  if (paren) { main = paren[1]; sub = (sub + ' ' + paren[2]).trim(); }

  const whole = `${main} ${sub}`;
  if (/구조방정식|구조모형|구조적\s*관계/.test(whole)) out.flags.sem = true;

  // 부제·본제의 매개·조절 표현 수집
  const roleRe = /([가-힣A-Za-z0-9·,\s]+?)의\s*(이중\s*|순차적\s*|다중\s*)?(조절된\s*)?(매개|조절)\s*(?:효과|역할|변인|모형|작용)/g;
  const scan = (txt) => {
    let m; const found = [];
    while ((m = roleRe.exec(txt))) found.push(m);
    roleRe.lastIndex = 0;
    return found;
  };
  const applyRoles = (found) => {
    for (const m of found) {
      let varsText = m[1].replace(/^.*?(?:관계에서|관계에 있어서|영향에서|과정에서|에서)\s*/, '');
      const vars = splitVars(varsText);
      if (m[2]) out.flags.serial = true;
      if (m[3]) out.flags.modmed = true;
      if (m[4] === '매개') out.mediators.push(...vars); else out.moderators.push(...vars);
    }
  };
  const modMedRe = /([가-힣A-Za-z0-9\s·,]+?)(?:으로|로|에\s*의해|에\s*의하여)\s*조절된\s*([가-힣A-Za-z0-9\s·,]+?)의\s*매개\s*(?:효과|역할|모형)/;
  const takeModMed = (txt) => {
    const mm = txt.match(modMedRe);
    if (!mm) return txt;
    out.moderators.push(...splitVars(mm[1].replace(/^.*?(?:관계에서|에서)\s*/, '')));
    out.mediators.push(...splitVars(mm[2]));
    out.flags.modmed = true;
    return txt.replace(mm[0], ' ');
  };
  sub = takeModMed(sub);
  main = takeModMed(main);
  applyRoles(scan(sub));
  const focusM = sub.match(/([가-힣A-Za-z0-9\s]+?)(?:을|를)\s*중심으로/);
  if (focusM) out.focus = stripParticle(focusM[1].trim());

  // 본제에 붙은 '관계에서 ~의 매개효과'
  const inMain = scan(main);
  if (inMain.length) {
    applyRoles(inMain);
    main = main.replace(/\s*(?:의\s*)?관계에서.*$/, '의 관계').replace(/\s*에서\s*[^에]*?의\s*(?:매개|조절).*$/, '');
  }

  let m;
  const setPop = (p) => { if (p && !out.population) out.population = stripParticle(p); };
  const peelPopulation = (left) => {
    // '간호사가 지각한 조직문화', '간호사의 직무스트레스'
    let mm = left.match(/^(.+?)(?:이|가)\s+(?:지각한|지각하는|인식한|인식하는|경험한|경험하는|느끼는|느낀|보고한|평가한)\s+(.+)$/);
    if (mm) { setPop(mm[1]); return mm[2]; }
    mm = left.match(/^(.+?)의\s+(.+)$/);
    if (mm && isPopulation(mm[1])) { setPop(mm[1]); return mm[2]; }
    mm = left.match(/^(.+?)\s+대상(?:의)?\s+(.+)$/);
    if (mm) { setPop(mm[1]); return mm[2]; }
    return left;
  };

  // 1) 질적 연구
  if (/(질적|현상학|근거이론|내러티브|해석학적|문화기술지|사례\s*연구|참여자\s*경험|생애사|포토보이스)/.test(whole)) {
    out.design = 'qualitative';
    const t = main.replace(/\s*(?:에\s*관한|에\s*대한|의)?\s*(?:질적|현상학적|근거이론|내러티브|해석학적|문화기술지적?|사례)\s*연구.*$/, '');
    const left = peelPopulation(t);
    out.topic = stripParticle(left.replace(/\s*(경험|체험|삶|과정|의미)$/, ' $1').trim());
    out.confidence = 0.7;
  }
  // 2) 문헌 연구
  else if (/(체계적\s*문헌\s*고찰|메타\s*분석|문헌\s*연구|문헌\s*고찰|주제범위\s*고찰|스코핑\s*리뷰|통합적\s*문헌|연구\s*동향|동향\s*분석)/.test(whole)) {
    out.design = 'literature';
    out.topic = stripParticle(main.replace(/\s*(?:에\s*관한|에\s*대한|의)?\s*(?:국내외?\s*)?(?:체계적\s*문헌\s*고찰|메타\s*분석|문헌\s*연구|문헌\s*고찰|주제범위\s*고찰|스코핑\s*리뷰|통합적\s*문헌\s*고찰|연구\s*동향\s*분석|연구\s*동향|동향\s*분석).*$/, ''));
    out.confidence = 0.7;
  }
  // 3) 프로그램·중재 효과
  else if ((m = main.match(/^(.+(?:프로그램|중재|훈련|치료|요법|코칭|캠프|모듈))(?:이|가|을\s*적용한|를\s*적용한|을\s*활용한|를\s*활용한)\s+(.+?)에\s*(?:미치는|대한)\s*(효과|영향)/))
    || (m = main.match(/^(.+(?:교육|수업|활동|앱|콘텐츠|학습))(?:이|가|을\s*적용한|를\s*적용한|을\s*활용한|를\s*활용한)\s+(.+?)에\s*(?:미치는|대한)\s*(효과)/))) {
    out.design = 'program';
    let iv = m[1], rest = m[2];
    iv = peelPopulation(iv);
    rest = peelPopulation(rest);
    out.ivs = [stripParticle(iv)];
    out.dvs = splitVars(rest);
    out.confidence = 0.85;
  }
  // 4) 영향 관계 (A가 B에 미치는 영향)
  else if ((m = main.match(/^(.+?)에\s*(?:미치는|대한|주는|끼치는)\s*(영향|효과)/))) {
    const before = m[1];
    let left, right;
    const mm = before.match(/^(.+)(?:이|가|은|는)\s+(.+)$/);
    if (mm) { left = mm[1]; right = mm[2]; }
    else {
      const mo = before.match(/^(.+)의\s+(.+)$/);
      if (mo) { left = mo[1]; right = mo[2]; } else { left = before; right = ''; }
    }
    left = peelPopulation(left);
    right = peelPopulation(right);
    out.ivs = splitVars(left);
    out.dvs = splitVars(right);
    out.design = 'effect';
    out.confidence = out.ivs.length && out.dvs.length ? 0.9 : 0.5;
  }
  // 5) 관계 연구 (A와 B의 관계)
  else if ((m = main.match(/^(.+?)\s*(?:간의|사이의|의)?\s*(?:상관\s*)?관계/))) {
    let t = peelPopulation(m[1].trim());
    const vars = splitVars(t.replace(/\s*간$/, ''));
    if (vars.length >= 2) {
      out.ivs = vars.slice(0, -1);
      out.dvs = [vars[vars.length - 1]];
    } else out.ivs = vars;
    out.design = 'relation';
    out.confidence = vars.length >= 2 ? 0.85 : 0.5;
  }
  // 6) 차이 연구 (A에 따른 B의 차이)
  else if ((m = main.match(/^(.+?)(?:에\s*따른|별)\s+(.+?)(?:의)?\s*(차이|비교|분석)/))) {
    const left = peelPopulation(m[1]);
    out.ivs = splitVars(left);
    out.dvs = splitVars(peelPopulation(m[2]));
    out.design = 'difference';
    out.confidence = 0.85;
  }
  // 7) 영향요인
  else if ((m = main.match(/^(.+?)(?:에\s*영향을\s*미치는\s*요인|의?\s*영향\s*요인|의?\s*관련\s*요인|의?\s*예측\s*요인)/))) {
    out.dvs = splitVars(peelPopulation(m[1]));
    out.design = 'factors';
    out.confidence = 0.8;
  }
  // 8) 개발 연구
  else if (/(설계\s*및\s*구현|시스템\s*개발|모델\s*개발|플랫폼\s*개발|알고리즘|프로토타입|구현|개발\s*연구|척도\s*개발|프로그램\s*개발)/.test(whole)) {
    out.design = 'development';
    out.topic = stripParticle(main.replace(/\s*(?:을|를|의)?\s*(?:위한\s*)?(?:설계\s*및\s*구현|개발\s*및\s*(?:효과|적용|평가)|개발\s*연구|개발|구현).*$/, ''));
    out.confidence = 0.7;
  }
  // 9) 실태·인식 조사
  else if (/(인식|실태|현황|요구|태도|인지도|만족도\s*조사|이용\s*현황)/.test(main)) {
    out.design = 'descriptive';
    out.topic = stripParticle(peelPopulation(main.replace(/\s*(?:에\s*관한|에\s*대한)?\s*(?:조사\s*)?(?:연구|분석|조사)$/, '')));
    out.confidence = 0.65;
  }
  // 10) 판별 실패: 알려진 변인 추출
  else {
    const found = [];
    for (const c of CONSTRUCTS) {
      for (const n of c.names) {
        if (n.length >= 2 && whole.replace(/\s+/g, '').includes(n.replace(/\s+/g, '')) && !found.includes(n)) { found.push(n); break; }
      }
    }
    if (found.length >= 2) { out.ivs = [found[0]]; out.dvs = [found[found.length - 1]]; out.design = 'effect'; out.confidence = 0.45; }
    else { out.topic = stripParticle(peelPopulation(main)); out.design = found.length ? 'descriptive' : ''; out.confidence = 0.3; }
    const pm = main.match(/^(.+?)의\s/);
    if (pm && isPopulation(pm[1])) setPop(pm[1]);
  }

  if (!out.population && out.focus && isPopulation(out.focus)) out.population = out.focus;
  // 역할 확정
  const has = (a) => a && a.length;
  if (['effect', 'relation', 'difference', 'factors', 'descriptive', ''].includes(out.design) || out.design === 'effect') {
    if (has(out.mediators) && has(out.moderators)) out.design = 'modmed';
    else if (has(out.mediators)) out.design = out.flags.serial || out.mediators.length >= 2 ? 'serial' : 'mediation';
    else if (has(out.moderators)) out.design = 'moderation';
  }
  if (out.flags.modmed) out.design = 'modmed';
  if (out.flags.sem && !['qualitative', 'literature', 'development'].includes(out.design)) out.semRequested = true;
  // 매개·조절 변수가 독립·종속에 중복되면 제거
  out.ivs = out.ivs.filter((v) => !out.mediators.includes(v) && !out.moderators.includes(v));
  out.dvs = out.dvs.filter((v) => !out.mediators.includes(v) && !out.moderators.includes(v));
  if (!out.topic) out.topic = [...out.ivs, ...out.dvs].join(', ');
  return out;
}

/* ------------------------------------------------------------------ 변인 정보 */
function valenceOf(name) {
  const c = findConstruct(name);
  if (c) return c.valence;
  if (/(스트레스|불안|우울|갈등|중독|의존|소진|피로|부담|위험|문제|폭력|부정|저하|이직|퇴사|결근|불만)/.test(name)) return -1;
  if (/(만족|몰입|효능|성과|행복|안녕|지지|역량|성취|적응|신뢰|충성|의도|참여|회복|건강|웰빙|긍정)/.test(name)) return 1;
  return 0;
}

export function variableInfo(name, role) {
  const c = findConstruct(name);
  return {
    name, role,
    key: c ? c.key : null,
    valence: valenceOf(name),
    scales: c ? c.scales.map(([n, ref]) => ({ name: n, ref })) : [],
    known: !!c,
  };
}

const ROLE_LABEL = { iv: '독립변수', dv: '종속변수', med: '매개변수', mod: '조절변수', ctrl: '통제변수', group: '집단 변수', program: '처치(프로그램)' };

/* ------------------------------------------------------------------ 주제 추천 */
const FIELD_DV = {
  edu: ['학교적응', '학업성취'], counsel: ['심리적 안녕감', '우울'], nursing: ['이직의도', '직무만족'],
  welfare: ['삶의 만족', '우울'], biz: ['직무만족', '구매의도'], tour: ['재방문의도', '고객만족'],
  admin: ['직무만족', '정책 만족도'], sport: ['운동지속의도', '운동몰입'], it: ['사용의도', '이용만족'],
  media: ['이용만족', '구전의도'], arts: ['만족도', '창의성'], human: ['삶의 만족', '영적 안녕'], other: ['삶의 만족', '만족도'],
};
const FIELD_MED = { edu: '자기효능감', counsel: '정서조절', nursing: '회복탄력성', welfare: '사회적 지지', biz: '조직몰입', tour: '지각된 가치', admin: '조직몰입', sport: '자기효능감', it: '지각된 유용성', media: '신뢰', arts: '몰입', human: '사회적 지지', other: '자기효능감' };
const FIELD_MOD = { edu: '사회적 지지', counsel: '마음챙김', nursing: '사회적 지지', welfare: '가족지지', biz: '조직공정성', tour: '관여도', admin: '조직공정성', sport: '사회적 지지', it: '개인 혁신성', media: '관여도', arts: '사회적 지지', human: '사회적 지지', other: '사회적 지지' };

const WORK_KEYS = new Set(['직무스트레스', '직무만족', '조직몰입', '이직의도', '직무열의', '조직시민행동', '변혁적리더십', '서번트리더십', '리더십', '조직공정성', '심리적안전감', '혁신행동', '일가정갈등', '감정노동', '간호근무환경', '환자안전문화', '조직문화', '직무성과', '전문직관', '소진']);
const CONSUMER_KEYS = new Set(['서비스품질', '고객만족', '구매의도', '재방문의도', '충성도', '브랜드이미지', '지각된가치', '신뢰', '구전', '지각된유용성', '지각된용이성', '사용의도', '정보품질']);

function contextOf(keywords) {
  const keys = keywords.map((k) => (findConstruct(k) || {}).key).filter(Boolean);
  if (keys.some((k) => WORK_KEYS.has(k))) return 'work';
  if (keys.some((k) => CONSUMER_KEYS.has(k))) return 'consumer';
  return 'general';
}

function pickPopulation(field, ctx) {
  if (ctx === 'work') return field.populations.find((p) => /종사원|근로자|직원|구성원|간호사|공무원|교사|사회복지사|상담자|직장인|종사자/.test(p)) || '직장인';
  if (ctx === 'consumer') return field.populations.find((p) => /관광객|소비자|고객|이용자|방문객|관람객/.test(p)) || '소비자';
  return field.populations[0] || '성인';
}

export function suggestTitles({ keywords = [], fieldId = 'other', method = 'auto', population = '' }) {
  const field = fieldById(fieldId);
  const ks = keywords.map((k) => stripParticle(k)).filter(Boolean).slice(0, 3);
  const ctx = contextOf(ks);
  const P = population || pickPopulation(field, ctx);
  const out = [];
  const add = (title, design, why) => { if (!out.some((o) => o.title === title)) out.push({ title, design, why }); };
  const k1 = ks[0], k2 = ks[1], k3 = ks[2];
  let dvs = ctx === 'work' ? ['직무만족', '이직의도'] : ctx === 'consumer' ? ['고객만족', '재방문의도'] : (FIELD_DV[field.id] || FIELD_DV.other);
  dvs = dvs.filter((d) => !ks.includes(d)).concat(dvs.filter((d) => ks.includes(d))).filter((d) => !ks.includes(d)).concat(['삶의 만족']);
  const med = FIELD_MED[field.id], mod = FIELD_MOD[field.id];

  if (method === 'literature') {
    if (k1) add(`${k1}에 관한 국내 연구 동향 분석`, 'literature', '자료 수집 없이 진행할 수 있는 문헌연구');
    if (k1 && k2) add(`${k1}${josa(k1, '과/와').slice(k1.length)} ${k2}의 관계에 관한 체계적 문헌고찰`, 'literature', '두 개념의 관계를 선행연구로 정리');
    if (k1) add(`${P} 대상 ${k1} 중재 연구의 체계적 문헌고찰`, 'literature', '중재 효과를 종합하는 고찰');
  }
  if (method === 'qualitative') {
    if (k1) add(`${P}의 ${k1} 경험에 관한 현상학적 연구`, 'qualitative', '경험의 본질적 의미를 탐구');
    if (k1) add(`${P}의 ${k1} 과정에 관한 근거이론 연구`, 'qualitative', '과정과 맥락을 이론화');
  }
  if (method === 'experiment') {
    if (k1 && k2) add(`${k1} 프로그램이 ${P}의 ${k2}에 미치는 효과`, 'program', '프로그램 전후 효과를 검증');
    else if (k1) add(`${k1} 프로그램이 ${P}의 ${dvs[0]}에 미치는 효과`, 'program', '프로그램 전후 효과를 검증');
  }
  if (k1 && k2 && k3) {
    add(`${P}의 ${josa(k1, '이/가')} ${k3}에 미치는 영향: ${k2}의 매개효과`, 'mediation', '세 변인의 경로를 한 번에 검증');
    add(`${P}의 ${josa(k1, '과/와')} ${k3}의 관계에서 ${k2}의 조절효과`, 'moderation', '조건에 따라 달라지는 관계를 검증');
  }
  if (k1 && k2) {
    add(`${P}의 ${josa(k1, '이/가')} ${k2}에 미치는 영향`, 'effect', '가장 기본적이고 변인 관계가 명확한 구조');
    if (!k3) add(`${P}의 ${josa(k1, '이/가')} ${k2}에 미치는 영향: ${med}의 매개효과`, 'mediation', `${med}${josa(med, '을/를').slice(med.length)} 매개변수로 넣어 연구 기여도를 높인 구조`);
    if (!k3) add(`${P}의 ${josa(k1, '과/와')} ${k2}의 관계에서 ${mod}의 조절효과`, 'moderation', '보호요인을 함께 보는 구조');
    add(`${P}의 ${k1} 수준에 따른 ${k2}의 차이`, 'difference', '집단 비교 중심의 간결한 구조');
  } else if (k1) {
    add(`${P}의 ${k1} 영향요인`, 'factors', '여러 요인 중 무엇이 중요한지 확인');
    add(`${P}의 ${josa(k1, '이/가')} ${dvs[0]}에 미치는 영향: ${med}의 매개효과`, 'mediation', `${field.label} 분야에서 자주 쓰는 결과변수로 구성`);
    add(`${P}의 ${josa(k1, '과/와')} ${dvs[1] || dvs[0]}의 관계`, 'relation', '관계 확인 중심의 입문형 구조');
    if (method !== 'qualitative') add(`${P}의 ${k1} 경험에 관한 질적 연구`, 'qualitative', '면담으로 경험을 깊이 탐구');
  }
  if (!out.length) {
    add(`${P}의 ${dvs[0]} 영향요인`, 'factors', `${field.label} 분야 대표 주제`);
    add(`${P}의 ${josa(med, '이/가')} ${dvs[0]}에 미치는 영향`, 'effect', `${field.label} 분야 대표 주제`);
  }
  return out.slice(0, 5);
}

/* ------------------------------------------------------------------ 연구모형 */
export function buildModel(parsed, opts = {}) {
  const design = parsed.design || (opts.method === 'qualitative' ? 'qualitative' : opts.method === 'literature' ? 'literature' : 'descriptive');
  const nodes = [];
  const edges = [];
  const add = (name, role) => { const id = `${role}${nodes.filter((n) => n.role === role).length + 1}`; nodes.push({ id, ...variableInfo(name, role), label: ROLE_LABEL[role] }); return id; };
  if (['qualitative', 'literature', 'development', 'descriptive'].includes(design) && !parsed.ivs.length && !parsed.dvs.length) {
    return { design, nodes, edges, hypotheses: [], quantitative: false };
  }
  const roleIv = design === 'program' ? 'program' : design === 'difference' ? 'group' : 'iv';
  const ivIds = parsed.ivs.map((v) => add(v, roleIv));
  const medIds = parsed.mediators.map((v) => add(v, 'med'));
  const modIds = parsed.moderators.map((v) => add(v, 'mod'));
  const dvIds = (parsed.dvs.length ? parsed.dvs : design === 'factors' ? [] : []).map((v) => add(v, 'dv'));
  if (design === 'factors' && !ivIds.length) {
    ['일반적 특성', '심리적 요인', '환경적 요인'].forEach((v) => ivIds.push(add(v, 'iv')));
  }
  let h = 0;
  const H = () => `H${++h}`;
  const out = dvIds.length ? dvIds : [];
  if (design === 'relation') {
    for (const a of ivIds) for (const b of out) edges.push({ from: a, to: b, kind: 'corr', h: H() });
  } else {
    for (const a of ivIds) for (const b of out) edges.push({ from: a, to: b, kind: medIds.length ? 'direct' : 'path', h: H() });
    if (medIds.length) {
      const serial = design === 'serial';
      if (serial) {
        ivIds.forEach((a) => edges.push({ from: a, to: medIds[0], kind: 'path', h: H() }));
        for (let i = 0; i < medIds.length - 1; i++) edges.push({ from: medIds[i], to: medIds[i + 1], kind: 'path', h: H() });
        out.forEach((b) => edges.push({ from: medIds[medIds.length - 1], to: b, kind: 'path', h: H() }));
      } else {
        for (const mId of medIds) {
          ivIds.forEach((a) => edges.push({ from: a, to: mId, kind: 'path', h: H() }));
          out.forEach((b) => edges.push({ from: mId, to: b, kind: 'path', h: H() }));
        }
      }
    }
    for (const mod of modIds) {
      const prefer = design === 'modmed'
        ? edges.find((e) => ivIds.includes(e.from) && medIds.includes(e.to))
        : null;
      const target = prefer || edges.find((e) => ivIds.includes(e.from) && (medIds.includes(e.to) || out.includes(e.to)) && e.kind !== 'mod');
      if (target) edges.push({ from: mod, toEdge: `${target.from}>${target.to}`, kind: 'mod', h: H() });
    }
  }
  const model = { design, nodes, edges, quantitative: true };
  model.hypotheses = buildHypotheses(model, parsed);
  return model;
}

function nodeName(model, id) { const n = model.nodes.find((x) => x.id === id); return n ? n.name : ''; }

function signWord(a, b) {
  const va = valenceOf(a), vb = valenceOf(b);
  if (!va || !vb) return null;
  return va * vb > 0 ? '정(+)의' : '부(-)의';
}

export function buildHypotheses(model, parsed = {}) {
  const hs = [];
  const P = parsed.population ? `${parsed.population}의 ` : '';
  for (const e of model.edges) {
    const a = nodeName(model, e.from);
    if (e.kind === 'corr') {
      const b = nodeName(model, e.to);
      const s = signWord(a, b);
      hs.push({ id: e.h, text: `${P}${josa(a, '과/와')} ${b} 간에는 ${s ? (s.startsWith('정') ? '정적(+) ' : '부적(-) ') : '유의한 '}상관관계가 있을 것이다.` });
    } else if (e.kind === 'mod') {
      const [f, t] = e.toEdge.split('>');
      const x = nodeName(model, f), y = nodeName(model, t);
      hs.push({ id: e.h, text: `${josa(a, '은/는')} ${josa(x, '과/와')} ${y}의 관계를 조절할 것이다.` });
    } else {
      const b = nodeName(model, e.to);
      const from = model.nodes.find((n) => n.id === e.from);
      if (from && from.role === 'program') {
        const v = valenceOf(b);
        hs.push({ id: e.h, text: `${a}에 참여한 실험군은 대조군보다 ${b} 점수가 유의하게 ${v < 0 ? '낮을' : v > 0 ? '높을' : '다를'} 것이다.` });
      } else if (from && from.role === 'group') {
        hs.push({ id: e.h, text: `${P}${a}에 따라 ${b}에 유의한 차이가 있을 것이다.` });
      } else {
        const s = signWord(a, b);
        hs.push({ id: e.h, text: `${josa(a, '은/는')} ${b}에 ${s ? s + ' ' : '유의한 '}영향을 미칠 것이다.` });
      }
    }
  }
  // 매개 가설
  const meds = model.nodes.filter((n) => n.role === 'med');
  const ivs = model.nodes.filter((n) => n.role === 'iv' || n.role === 'program');
  const dvs = model.nodes.filter((n) => n.role === 'dv');
  if (meds.length && ivs.length && dvs.length) {
    let next = model.edges.length;
    if (model.design === 'serial' && meds.length >= 2) {
      hs.push({ id: `H${++next}`, text: `${meds.slice(0, -1).map((m) => josa(m.name, '과/와')).join(' ')} ${josa(meds[meds.length - 1].name, '은/는')} ${josa(ivs[0].name, '과/와')} ${dvs[0].name}의 관계를 순차적으로 매개할 것이다.` });
    } else {
      for (const m of meds) for (const iv of ivs) for (const dv of dvs) {
        const conditional = model.design === 'modmed';
        hs.push({ id: `H${++next}`, text: conditional
          ? `${josa(iv.name, '이/가')} ${m.name}${josa(m.name, '을/를').slice(m.name.length)} 통해 ${dv.name}에 미치는 간접효과는 ${model.nodes.find((n) => n.role === 'mod')?.name || '조절변수'}의 수준에 따라 달라질 것이다.`
          : `${josa(m.name, '은/는')} ${josa(iv.name, '과/와')} ${dv.name}의 관계를 매개할 것이다.` });
      }
    }
  }
  return hs;
}

/* ------------------------------------------------------------------ 연구문제 */
function researchQuestions(parsed, model, typeId) {
  const P = parsed.population || '연구 대상자';
  const allVars = model.nodes.map((n) => n.name);
  const qs = [];
  switch (model.design) {
    case 'qualitative':
      qs.push(`${P}의 ${parsed.topic || '경험'}은(는) 어떠한가?`);
      qs.push(`${P}에게 그 경험이 지니는 본질적 의미와 구조는 무엇인가?`);
      break;
    case 'literature':
      qs.push(`${parsed.topic || '연구 주제'}에 관한 선행연구의 동향(연도, 대상, 방법)은 어떠한가?`);
      qs.push('선행연구에서 확인된 주요 결과와 효과는 무엇인가?');
      qs.push('향후 연구와 실무에 주는 시사점은 무엇인가?');
      break;
    case 'development':
      qs.push(`${parsed.topic || '개발 대상'}의 요구사항과 설계 원리는 무엇인가?`);
      qs.push('개발 결과물의 타당성과 효과(성능)는 어떠한가?');
      break;
    case 'descriptive':
      qs.push(`${P}의 ${parsed.topic || '주요 변인'} 수준(실태)은 어떠한가?`);
      qs.push(`${P}의 일반적 특성에 따라 ${parsed.topic || '주요 변인'}에 차이가 있는가?`);
      break;
    default:
      if (allVars.length) qs.push(`${P}의 ${allVars.join(', ')} 수준은 어떠한가?`);
      if (model.design !== 'program') qs.push(`${P}의 일반적 특성에 따라 주요 변인에 차이가 있는가?`);
      if (allVars.length >= 2 && model.design !== 'program') qs.push(`${allVars.join(', ')} 간의 상관관계는 어떠한가?`);
      for (const h of model.hypotheses.slice(-2)) qs.push(h.text.replace(/것이다\.$/, '는가?').replace(/있을 는가\?$/, '있는가?').replace(/미칠 는가\?$/, '미치는가?').replace(/매개할 는가\?$/, '매개하는가?').replace(/조절할 는가\?$/, '조절하는가?').replace(/달라질 는가\?$/, '달라지는가?').replace(/(높을|낮을|다를) 는가\?$/, (s, w) => ({ 높을: '높은가?', 낮을: '낮은가?', 다를: '다른가?' }[w])));
  }
  return [...new Set(qs)].slice(0, 5);
}

/* ------------------------------------------------------------------ 목차 */
const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ'];

function theorySections(model, parsed, depth) {
  const order = ['iv', 'program', 'group', 'med', 'mod', 'dv'];
  const nodes = [...model.nodes].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  const secs = nodes.filter((n) => n.role !== 'group').map((n) => ({
    title: n.name,
    subs: depth >= 2 ? (n.role === 'program'
      ? [`${n.name}의 개념과 구성`, '프로그램 관련 이론', `${n.name} 관련 선행연구`]
      : [`${n.name}의 개념`, n.known ? `${n.name}의 구성요인과 측정` : `${n.name} 관련 이론`, `${n.name} 관련 선행연구`]) : [],
  }));
  if (model.design === 'difference' && nodes.find((n) => n.role === 'group')) {
    secs.push({ title: `${nodes.find((n) => n.role === 'group').name}에 따른 차이`, subs: [] });
  }
  const rel = model.edges.filter((e) => e.kind !== 'mod').slice(0, 4).map((e) => `${josa(nodeName(model, e.from), '과/와')} ${nodeName(model, e.to)}의 관계`);
  if (rel.length && model.design !== 'program') secs.push({ title: '주요 변인 간의 관계', subs: depth >= 2 ? rel : [] });
  return secs;
}

function methodSections(model, parsed, depth, typeId) {
  const d = model.design;
  if (d === 'qualitative') return [
    { title: '연구 설계', subs: depth >= 2 ? ['현상학적 연구 방법의 적용'] : [] },
    { title: '연구 참여자', subs: [] },
    { title: '자료 수집(심층면담)', subs: depth >= 2 ? ['면담 질문의 구성', '자료 수집 절차'] : [] },
    { title: '자료 분석', subs: depth >= 2 ? ['Colaizzi의 분석 절차'] : [] },
    { title: '연구의 엄밀성', subs: [] },
    { title: '윤리적 고려', subs: [] },
  ];
  if (d === 'literature') return [
    { title: '문헌 검색 전략', subs: depth >= 2 ? ['검색 데이터베이스', '검색어와 검색식'] : [] },
    { title: '문헌 선정 및 배제 기준', subs: [] },
    { title: '문헌 선정 과정(PRISMA 2020)', subs: [] },
    { title: '질 평가와 자료 추출', subs: [] },
    { title: '자료 분석 방법', subs: [] },
  ];
  if (d === 'development') return [
    { title: '연구 절차', subs: [] },
    { title: '요구 분석', subs: [] },
    { title: '설계 원리와 개발', subs: depth >= 2 ? ['구성 요소 설계', '개발 환경'] : [] },
    { title: '타당성 검증', subs: [] },
    { title: '평가 방법', subs: [] },
  ];
  if (d === 'program') return [
    { title: '연구 설계', subs: depth >= 2 ? ['비동등성 대조군 전후 설계'] : [] },
    { title: '연구 대상', subs: [] },
    { title: '프로그램 구성', subs: depth >= 2 ? ['프로그램 개발 절차', '회기별 내용'] : [] },
    { title: '측정 도구', subs: depth >= 2 ? model.nodes.filter((n) => n.role === 'dv').map((n) => n.name) : [] },
    { title: '자료 수집 절차', subs: [] },
    { title: '자료 분석 방법', subs: [] },
    { title: '윤리적 고려', subs: [] },
  ];
  return [
    { title: '연구 모형', subs: [] },
    ...(typeId === 'doctor' ? [] : [{ title: '연구 가설', subs: [] }]),
    { title: '연구 대상 및 자료 수집', subs: [] },
    { title: '측정 도구', subs: depth >= 2 ? model.nodes.filter((n) => n.role !== 'group').map((n) => n.name).concat(['일반적 특성']) : [] },
    { title: '자료 분석 방법', subs: [] },
    ...(depth >= 2 ? [{ title: '윤리적 고려', subs: [] }] : []),
  ];
}

function resultSections(model, parsed) {
  const d = model.design;
  if (d === 'qualitative') return [{ title: '연구 참여자의 일반적 특성', subs: [] }, { title: '주제 모음과 주제', subs: [] }, { title: '경험의 본질적 구조', subs: [] }];
  if (d === 'literature') return [{ title: '선정 문헌의 일반적 특성', subs: [] }, { title: '연구 동향 분석', subs: [] }, { title: '주요 결과 종합', subs: [] }];
  if (d === 'development') return [{ title: '개발 결과', subs: [] }, { title: '타당성 검증 결과', subs: [] }, { title: '적용 및 평가 결과', subs: [] }];
  if (d === 'program') return [{ title: '대상자의 일반적 특성과 동질성 검증', subs: [] }, { title: '가설 검증', subs: model.hypotheses.map((h) => `가설 ${h.id.slice(1)} 검증`) }];
  const hyp = { mediation: '매개효과 검증', serial: '순차적 매개효과 검증', moderation: '조절효과 검증', modmed: '조절된 매개효과 검증', difference: '집단 간 차이 검증', factors: '영향요인 분석', relation: '변인 간 상관관계', effect: '가설 검증', sem: '구조모형 검증', descriptive: '주요 변인의 수준' }[d] || '가설 검증';
  return [
    { title: '연구 대상자의 일반적 특성', subs: [] },
    { title: '측정 도구의 신뢰도와 타당도', subs: [] },
    { title: '주요 변인의 기술통계', subs: [] },
    ...(d !== 'difference' ? [{ title: '일반적 특성에 따른 주요 변인의 차이', subs: [] }] : []),
    ...(d !== 'relation' && d !== 'descriptive' ? [{ title: '주요 변인 간의 상관관계', subs: [] }] : []),
    { title: hyp, subs: [] },
  ];
}

export function buildTOC({ typeId = 'master', model, parsed }) {
  const type = typeById(typeId);
  const isJournal = type.id === 'journal';
  const isYouth = type.id === 'youth';
  const isReport = type.id === 'report';
  const depth = type.id === 'master' || type.id === 'doctor' ? 2 : 1;
  const total = type.pages;
  const ch = [];
  if (isYouth) {
    ch.push({ title: '탐구 동기 및 목적', w: 1.2, sections: [{ title: '탐구 동기', subs: [] }, { title: '탐구 목적과 탐구 질문', subs: [] }] });
    ch.push({ title: '이론적 배경', w: 2, sections: theorySections(model, parsed, 1).length ? theorySections(model, parsed, 1) : [{ title: '관련 개념', subs: [] }, { title: '선행 탐구 사례', subs: [] }] });
    ch.push({ title: '탐구 방법', w: 2, sections: [{ title: '탐구 대상과 기간', subs: [] }, { title: '탐구 도구와 절차', subs: [] }, { title: '자료 정리 방법', subs: [] }] });
    ch.push({ title: '탐구 결과', w: 3, sections: [{ title: '결과 정리', subs: [] }, { title: '결과 해석', subs: [] }] });
    ch.push({ title: '결론 및 제언', w: 1.3, sections: [{ title: '결론', subs: [] }, { title: '탐구를 통해 배운 점', subs: [] }, { title: '후속 탐구 제안', subs: [] }] });
  } else if (isReport) {
    ch.push({ title: '서론', w: 1, sections: [{ title: '연구 배경과 목적', subs: [] }, { title: '연구 범위와 방법', subs: [] }] });
    ch.push({ title: '현황 및 이론적 검토', w: 2, sections: theorySections(model, parsed, 1).length ? theorySections(model, parsed, 1) : [{ title: '관련 개념과 제도', subs: [] }, { title: '선행연구 검토', subs: [] }] });
    ch.push({ title: '분석 방법', w: 1, sections: methodSections(model, parsed, 1, type.id) });
    ch.push({ title: '분석 결과', w: 2.5, sections: resultSections(model, parsed) });
    ch.push({ title: '결론 및 정책적 제언', w: 1.2, sections: [{ title: '요약', subs: [] }, { title: '개선 방안과 제언', subs: [] }] });
  } else {
    const intro = [{ title: '연구의 필요성', subs: [] }, { title: '연구의 목적', subs: [] }];
    if (model.quantitative && model.hypotheses.length) intro.push({ title: '연구 문제와 연구 가설', subs: [] });
    else intro.push({ title: '연구 문제', subs: [] });
    if (depth >= 2) intro.push({ title: '용어의 정의', subs: model.nodes.filter((n) => n.role !== 'group').map((n) => n.name) });
    ch.push({ title: isJournal ? '서론' : '서론', w: 1, sections: intro });
    const theory = theorySections(model, parsed, depth);
    ch.push({ title: '이론적 배경', w: 2.4, sections: theory.length ? theory : [{ title: `${parsed.topic || '연구 주제'}의 개념`, subs: [] }, { title: '관련 이론', subs: [] }, { title: '선행연구 고찰', subs: [] }] });
    if (type.id === 'doctor' && model.quantitative) {
      ch.push({ title: '연구 모형 및 연구 가설', w: 1, sections: [{ title: '연구 모형', subs: [] }, { title: '연구 가설', subs: [] }, { title: '변인의 조작적 정의', subs: [] }] });
    }
    ch.push({ title: '연구 방법', w: 1.4, sections: methodSections(model, parsed, depth, type.id) });
    ch.push({ title: '연구 결과', w: 2.2, sections: resultSections(model, parsed) });
    if (type.id === 'doctor') {
      ch.push({ title: '논의', w: 1.4, sections: [{ title: '주요 결과에 대한 논의', subs: [] }, { title: '이론적 시사점', subs: [] }, { title: '실천적 시사점', subs: [] }] });
      ch.push({ title: '결론', w: 0.8, sections: [{ title: '연구의 요약', subs: [] }, { title: '연구의 한계와 후속 연구 제언', subs: [] }] });
    } else {
      ch.push({ title: isJournal ? '논의 및 결론' : '논의 및 결론', w: 1.2, sections: [{ title: '결과 요약 및 논의', subs: [] }, { title: '연구의 의의와 시사점', subs: [] }, { title: '연구의 제한점 및 제언', subs: [] }] });
    }
  }
  const wsum = ch.reduce((a, c) => a + c.w, 0);
  const bodyPages = Math.round(total * 0.86);
  const chapters = ch.map((c, i) => ({
    no: isJournal ? `${ROMAN[i]}.` : isYouth || isReport ? `${i + 1}.` : `제${i + 1}장`,
    title: c.title,
    pages: Math.max(1, Math.round((bodyPages * c.w) / wsum)),
    sections: c.sections.map((s, j) => ({ no: isJournal || isYouth ? `${j + 1}.` : `${j + 1}.`, title: s.title, subs: (s.subs || []).map((t, k) => `${k + 1}) ${t}`) })),
  }));
  const back = ['참고문헌'];
  if (type.id !== 'youth') back.push(type.id === 'journal' ? 'Abstract' : 'Abstract(영문 초록)');
  if (model.quantitative && model.design !== 'literature') back.push('부록(설문지)');
  if (model.design === 'qualitative') back.push('부록(면담 질문지, 연구 참여 동의서)');
  return { chapters, back, totalPages: total, front: type.id === 'journal' ? ['국문 초록', '주제어'] : type.id === 'youth' ? ['요약'] : ['국문 초록', '목차', '표 목차', '그림 목차'] };
}

export function tocToText(toc) {
  const lines = [];
  for (const f of toc.front || []) lines.push(f);
  for (const c of toc.chapters) {
    lines.push(`${c.no} ${c.title}`);
    for (const s of c.sections) {
      lines.push(`  ${s.no} ${s.title}`);
      for (const sub of s.subs) lines.push(`    ${sub}`);
    }
  }
  for (const b of toc.back) lines.push(b);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ 연구방법·분석·표본 */
function methodFor(design) {
  if (design === 'qualitative') return 'qualitative';
  if (design === 'literature') return 'literature';
  if (design === 'program' || design === 'development') return 'experiment';
  return 'survey';
}

export function samplePlan(model, parsed, { dropout = 0.15 } = {}) {
  const d = model.design;
  const nIv = model.nodes.filter((n) => ['iv', 'program'].includes(n.role)).length || 1;
  const nMed = model.nodes.filter((n) => n.role === 'med').length;
  const nMod = model.nodes.filter((n) => n.role === 'mod').length;
  const controls = 3;
  const items = [];
  let base = null;
  if (d === 'qualitative') return { text: '연구 참여자 6~12명 내외(자료가 포화될 때까지 모집)', n: null, recommended: null, items: [], note: '질적 연구는 통계적 표본 수 대신 자료의 포화를 기준으로 합니다.' };
  if (d === 'literature') return { text: '선정 기준을 충족한 문헌 전수(일반적으로 15~40편 내외)', n: null, recommended: null, items: [], note: '검색 결과에 따라 PRISMA 흐름도로 최종 편수를 확정합니다.' };
  if (d === 'development') return { text: '전문가 타당도 검증 5~10명, 시범 적용 대상은 설계에 따라 결정', n: null, recommended: null, items: [], note: '' };
  if (d === 'program') {
    const r = nTTest({ d: 0.8 });
    items.push({ ...r, label: '두 집단 비교(큰 효과크기 d=.80)' });
    base = r.n;
  } else if (d === 'difference') {
    const r = nAnova({ groups: 3 });
    items.push({ ...r, label: '세 집단 비교 기준' });
    base = r.n;
  } else if (d === 'relation') {
    const r = nCorrelation({ r: 0.3 });
    items.push({ ...r, label: '상관분석 기준(r=.30)' });
    base = r.n;
  } else if (d === 'descriptive') {
    const r = nProportion({ e: 0.07 });
    items.push({ ...r, label: '실태 조사(허용오차 ±7%p)' });
    base = r.n;
  } else {
    const k = nIv + nMed + nMod * 2 + controls;
    const r = nRegression({ predictors: k });
    items.push({ ...r, label: `회귀분석 기준(예측변수 ${k}개: 주요 변인 ${nIv + nMed + nMod}개, 상호작용항 ${nMod}개, 통제변수 ${controls}개)` });
    base = r.n;
    if (nMed) { items.push({ n: MEDIATION_RULE.medium.n, method: '매개효과 부트스트래핑 경험 기준', assumptions: MEDIATION_RULE.medium.note, label: '매개효과 검증 기준' }); base = Math.max(base, MEDIATION_RULE.medium.n); }
    if (parsed.semRequested || d === 'sem') { items.push({ n: 200, method: '구조방정식 경험 기준', assumptions: '모형 추정 안정성을 위한 최소 200명 권장 (Kline, 2016)', label: '구조방정식 기준' }); base = Math.max(base, 200); }
  }
  const recommended = withDropout(base, dropout);
  return { n: base, recommended, dropout, items, text: `최소 ${base}명, 탈락률 ${Math.round(dropout * 100)}%를 고려해 ${recommended}명 이상 모집 권장`, note: 'G*Power와 같은 비중심 분포 계산으로 산출했으며, 선행연구의 효과크기를 반영해 조정할 수 있습니다.' };
}

function instrumentsFor(model) {
  return model.nodes.filter((n) => n.role !== 'group' && n.role !== 'program').map((n) => ({
    name: n.name, role: n.label,
    candidates: n.scales.length ? n.scales : [{ name: `${n.name} 측정 척도`, ref: '선행연구에서 신뢰도·타당도가 검증된 도구로 선정' }],
  }));
}

/* ------------------------------------------------------------------ 일정 */
function addDays(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
export function fmtDate(d) { return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; }

export function buildSchedule({ design, typeId, start = new Date(), due = null }) {
  const type = typeById(typeId);
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let days = due ? Math.round((new Date(due) - s) / 86400000) : type.weeks * 7;
  const tight = due && days < type.weeks * 7 * 0.5;
  if (!days || days < 7) days = Math.max(days || 0, 7);
  const quant = !['qualitative', 'literature', 'development'].includes(design);
  const phases = design === 'literature'
    ? [['연구 설계·검색 전략 확정', 1], ['문헌 검색·선정', 2], ['자료 추출·질 평가', 2], ['결과 종합·작성', 2.5], ['검토·수정', 1.5]]
    : design === 'qualitative'
      ? [['연구 설계·면담 질문 확정', 1], ['이론적 배경 작성', 1.5], ['IRB·참여자 모집', 1.5], ['심층면담·전사', 2], ['자료 분석·결과 작성', 2], ['논의·검토·수정', 1.5]]
      : quant
        ? [['연구 설계 확정', 1], ['이론적 배경 작성', 2], ['측정도구·설문지 확정', 1], ['IRB·자료 수집', 2.2], ['통계 분석', 1], ['결과·논의 작성', 1.5], ['검토·수정', 1.3]]
        : [['요구 분석·설계', 1.5], ['개발', 3], ['타당성 검증', 1.2], ['적용·평가', 1.5], ['결과 작성·수정', 1.5]];
  const wsum = phases.reduce((a, p) => a + p[1], 0);
  let cur = s;
  const out = phases.map(([label, w], i) => {
    const len = i === phases.length - 1 ? Math.max(1, Math.round((addDays(s, days) - cur) / 86400000)) : Math.max(1, Math.round((days * w) / wsum));
    const st = cur, en = addDays(cur, len);
    cur = en;
    return { label, start: fmtDate(st), end: fmtDate(addDays(en, -1)), startOffset: Math.round((st - s) / 86400000), days: len };
  });
  return { phases: out, totalDays: days, tight: !!tight, startDate: fmtDate(s), endDate: fmtDate(addDays(s, days - 1)) };
}

/* ------------------------------------------------------------------ 종합 설계 */
export function buildDesign(input = {}) {
  const typeId = input.typeId || 'master';
  const type = typeById(typeId);
  const field = input.fieldId ? fieldById(input.fieldId) : (guessField(input.fieldText) || fieldById('other'));
  let parsed;
  let titleCandidates = [];
  let titleSource = 'given';
  if (input.title && String(input.title).trim().length >= 4) {
    parsed = parseTitle(input.title);
  } else {
    titleCandidates = suggestTitles({ keywords: input.keywords || [], fieldId: field.id, method: input.method || 'auto', population: input.population || '' });
    titleSource = 'suggested';
    parsed = parseTitle(titleCandidates[0] ? titleCandidates[0].title : '');
  }
  // 연구방법 선택이 명확하면 우선
  const userMethod = input.method && input.method !== 'auto' ? input.method : null;
  if (userMethod === 'qualitative' && parsed.design !== 'qualitative' && titleSource === 'given') parsed.design = parsed.design || 'qualitative';
  if (userMethod === 'literature' && titleSource === 'given' && !parsed.design) parsed.design = 'literature';
  if (!parsed.population) parsed.population = input.population || '';

  const model = buildModel(parsed, { method: userMethod });
  if (parsed.semRequested && model.quantitative) model.semRequested = true;
  const design = model.design || parsed.design || 'descriptive';
  const method = methodFor(design);
  const toc = buildTOC({ typeId, model, parsed });
  const sample = samplePlan(model, parsed);
  const analysis = (parsed.semRequested ? ANALYSIS_PLANS.sem : ANALYSIS_PLANS[design]) || ANALYSIS_PLANS.descriptive;
  const schedule = buildSchedule({ design, typeId, start: input.start ? new Date(input.start) : new Date(), due: input.due || null });
  const questions = researchQuestions(parsed, model, typeId);
  const needsIRB = ['survey', 'qualitative', 'experiment'].includes(method) && design !== 'development';
  const checks = [];
  if (needsIRB) checks.push('사람을 대상으로 자료를 모으므로 소속 기관의 IRB(기관생명윤리위원회) 심의 대상인지 먼저 확인하세요.');
  if (method === 'survey') checks.push('측정도구는 원척도 출처와 사용 허가, 국내 번안·타당화 여부를 확인한 뒤 확정합니다.');
  if (schedule.tight) checks.push('희망일까지 기간이 짧습니다. 범위를 나누거나 우선 처리를 검토해 주세요.');
  if (parsed.confidence < 0.5 && titleSource === 'given') checks.push('주제 문장에서 변인을 명확히 찾지 못했습니다. 작업 준비 단계에서 연구 질문을 함께 정리합니다.');
  checks.push('학교·학술지 양식과 표절 검사 기준(유사도 상한)을 미리 확인하면 수정 횟수를 줄일 수 있습니다.');

  const title = titleSource === 'given' ? cleanTitle(input.title) : (titleCandidates[0] ? titleCandidates[0].title : '');
  return {
    version: 1,
    title,
    titleSource,
    titleCandidates,
    type: { id: type.id, label: type.label },
    field: { id: field.id, label: field.label },
    parsed,
    model,
    design,
    designLabel: DESIGN_LABELS[design] || '연구 설계',
    method,
    methodLabel: { survey: '양적 연구(설문조사)', qualitative: '질적 연구(심층면담)', literature: '문헌연구', experiment: design === 'development' ? '개발 연구' : '유사실험 연구' }[method],
    questions,
    hypotheses: model.hypotheses || [],
    instruments: instrumentsFor(model),
    analysis,
    sample,
    toc,
    schedule,
    checks,
    tools: method === 'survey' ? (parsed.semRequested ? ['SPSS', 'AMOS 또는 R(lavaan)'] : ['SPSS', 'PROCESS Macro']) : method === 'qualitative' ? ['전사 자료 코딩(NVivo 또는 수기 코딩)'] : method === 'literature' ? ['문헌 관리(EndNote, Zotero)', 'PRISMA 2020 흐름도'] : ['설계 문서', '평가 도구'],
  };
}

export const ROLE_LABELS = ROLE_LABEL;
export { PAPER_TYPES, FIELDS };
