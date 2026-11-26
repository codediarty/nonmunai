// 운영자용 작업지시문·AI 작업 프롬프트·고객 안내 문구 자동 생성
// 개인정보(이름·연락처)는 넣지 않고 주문번호로만 식별한다.
import { buildDesign, buildTOC, tocToText, josa, ROLE_LABELS } from '../core/engine.js';
import { surveyPlan, statsPlan, METHOD_LABELS } from '../core/plans.js';
import { classifyFeedback } from '../core/feedback.js';
import { PAPER_TYPES, FIELDS } from '../core/kb.js';
import { won } from '../core/render.js';
import { includesFor, editLevelOf, editLevelOfCode } from '../core/pricing.js';
import { EXTRA_WORK } from '../app/edit-scope.js';

const TASK = { full: '전체 구성·초고 완성', edit: '논문 첨삭·교정', feedback: '교수님 피드백 반영', proposal: '연구계획서 작성' };
const SURVEY_MODE = { full: '설문지 작성부터 설문 결과·통계 해석까지(작성·제작·조사·결과 정리·분석)', new: '설문지 작성', edit: '설문지 점검·수정', feedback: '설문지 피드백 반영(수정표, 파란색 표시)', analyze: '설문 응답 통계 분석·해석' };
const TARGET = { auto: '추천 필요', student: '대학생', worker: '직장인', teacher: '교사', parent: '학부모', adult: '성인' };
const OUTPUT = { table: '논문 맞춤 통계분석 기본형(분석·APA 통계표·핵심 해석)', interp: '논문 맞춤 통계분석 표준형(가설별 분석 설계·통계표·표별 해석)', chapter: '통계분석과 연구결과(4장) 본문 작성', revise: '통계 재분석·피드백 반영(수정표, 파란색 표시)' };
const SLOT = { manuscript: '기존 원고', materials: '참고 자료', toc: '목차', format: '양식', feedback: '피드백', questionnaire: '설문지', proposal: '연구계획서', data: '데이터', prevResult: '기존 분석 결과', codebook: '변수 설명', other: '기타', result: '결과물' };
const OUT_FMT = { docx: '워드(docx)', hwp: '한글(hwp)', pdf: 'PDF' };
const MSG_TYPE = { revision: '수정 요청', materials_done: '보완 제출', question: '문의', deletion: '삭제 요청' };
// 사람에게서 자료(설문·면담·실험)를 모아야 결과 장을 쓸 수 있는 연구 방법
const PEOPLE_METHODS = ['survey', 'qualitative', 'experiment'];
const DATA_SLOTS = ['data', 'prevResult', 'codebook'];
// 학위논문 본문 1쪽은 보통 공백 포함 1,000자를 넘는다(분량 기준 점검용, 보수적으로 잡음)
const CHARS_PER_PAGE = 1000;

const line = (k, v) => (v === undefined || v === null || v === '' ? '' : `- ${k}: ${v}`);
const block = (title, rows) => {
  const body = rows.filter(Boolean);
  return body.length ? `■ ${title}\n${body.join('\n')}` : '';
};
const korDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T09:00:00+09:00' : iso);
  return isNaN(d) ? iso : `${d.getMonth() + 1}월 ${d.getDate()}일(${'일월화수목금토'[d.getDay()]})`;
};

// 고객이 편하게 적은 관심 주제가 이미 논문 제목처럼 정리된 문장인지(대화체 부탁이 아닌지)
const CHATTY = /(해\s?줘|해\s?주세요|주세요|부탁|관련해서|인데|싶어요|싶습니다|써\s?줘|완성|논문을|\?)/;
const TOPIC_WORD = /(영향|관계|효과|차이|요인|인식|경험|분석|연구|비교|탐색|고찰|매개|조절|역할|실태|현황|방안)/;
export function titleLike(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length >= 8 && t.length <= 120 && !CHATTY.test(t) && TOPIC_WORD.test(t);
}

// 주문의 연구 설계. 관심 주제(free) 주문은 고객이 설계를 본 적이 없으므로 '자동 초안'(draft)으로 만든다:
// 주제가 제목처럼 정리돼 있으면 그대로, 대화체면 키워드로 제목 후보를 추천받는다.
export function designOf(o) {
  const i = o.input || {};
  const c = i.common || {};
  const opts = { keywords: c.keywords || [], typeId: (i.paper || {}).typeId || 'master', fieldId: c.fieldId || 'other', fieldText: c.fieldText, method: c.method || 'auto', due: c.due || null };
  try {
    if (c.topicKnown === 'free' && !(o.design && o.design.title)) {
      const given = titleLike(c.title);
      if (!given && !opts.keywords.length) return null;
      const d = buildDesign({ ...opts, title: given ? c.title : '' });
      return d && d.title ? { ...d, draft: true } : null;
    }
    const title = (o.design && o.design.title) || c.title || '';
    if (!title && !opts.keywords.length) return null;
    return buildDesign({ ...opts, title });
  } catch { return null; }
}

const andList = (names) => (names.length === 2 ? `${josa(names[0], '과/와')} ${names[1]}` : names.join(', '));

// 고객 데이터 없이 바로 완성할 수 있는 문헌연구안: 같은 변인으로 선행연구를 체계적으로 종합한다
export function literatureVariant(d) {
  if (!d) return null;
  const nodes = (d.model.nodes || []).filter((n) => n.role !== 'group');
  const names = (...roles) => nodes.filter((n) => roles.includes(n.role)).map((n) => n.name);
  const ivs = names('iv', 'program');
  const dvs = names('dv');
  const meds = names('med');
  const mods = names('mod');
  const model = { ...d.model, design: 'literature', quantitative: false, hypotheses: [] };
  const stem = String(d.title || '').replace(/\s*[:：].*$/, '').replace(/\s*(에\s*관한|에\s*대한)?\s*(연구|분석|탐색)$/, '').trim();
  const questions = [`${(nodes.length ? nodes.map((n) => n.name).join(', ') : stem)} 관련 선행연구의 동향(발표 연도, 연구 대상, 연구 방법)은 어떠한가?`];
  if (ivs.length && dvs.length) questions.push(`선행연구에서 ${josa(andList(ivs), '이/가')} ${dvs.join(' 및 ')}에 미치는 영향은 어떻게 보고되었는가?`);
  else questions.push('선행연구에서 확인된 주요 결과와 효과는 무엇인가?');
  if (meds.length) questions.push(`${andList(meds)}의 매개 역할을 뒷받침하는 근거는 어떠한가?`);
  if (mods.length) questions.push(`${andList(mods)}에 따라 효과가 달라진다는 근거는 어떠한가?`);
  questions.push('선행연구를 종합할 때 도출되는 연구 명제와 실무 시사점, 후속 연구 과제는 무엇인가?');
  return {
    ...d,
    variant: 'literature',
    title: `${stem}에 관한 체계적 문헌고찰`,
    titleSource: 'variant',
    titleCandidates: [],
    model,
    design: 'literature',
    designLabel: '문헌연구·체계적 문헌고찰',
    method: 'literature',
    methodLabel: '문헌연구',
    questions,
    hypotheses: [],
    instruments: [],
    analysis: ['문헌 검색(RISS, KCI, DBpia, Google Scholar 등, 검색어와 검색식 기록)', '선정·배제 기준 적용과 PRISMA 2020 흐름도', '자료 추출표 작성(저자·연도·대상·방법·주요 결과)', '변인별 결과의 서술적 종합과 연구 명제 도출'],
    sample: { text: '선정 기준을 충족한 문헌 전수(일반적으로 15~40편 내외)', n: null, items: [], note: '검색 결과에 따라 PRISMA 흐름도로 최종 편수를 확정합니다.' },
    toc: buildTOC({ typeId: d.type.id, model, parsed: d.parsed }),
    checks: ['검색 건수, 중복 제거, 최종 선정 편수(PRISMA)는 실제로 검색한 결과로만 적습니다.', '선행연구의 결과 수치는 원문에 있는 값만 옮기고 출처를 밝힙니다.', '학교·학술지 양식과 표절 검사 기준(유사도 상한)을 미리 확인하면 수정 횟수를 줄일 수 있습니다.'],
    tools: ['문헌 관리(EndNote, Zotero)', 'PRISMA 2020 흐름도'],
  };
}

function hasCustomerData(o) {
  return ((o.files && o.files.customer) || []).some((f) => DATA_SLOTS.includes(f.slot)) || (o.links || []).some((l) => DATA_SLOTS.includes(l.slot));
}

// 전체 작성 주문인데 설계상 사람에게서 자료를 모아야 하고, 고객이 데이터를 보내지 않은 경우
export function needsCollectedData(o, d) {
  const p = ((o.input || {}).paper) || {};
  return !!d && p.task === 'full' && PEOPLE_METHODS.includes(d.method) && d.design !== 'development' && !hasCustomerData(o);
}

// 고객이 설문·면담·실험을 직접 골랐거나(주문서의 연구 방법), 주문할 때 '결과 장은 실제 데이터 분석 후 작성' 안내를 받은 경우
function customerWantsCollected(o) {
  const i = o.input || {};
  return PEOPLE_METHODS.includes((i.common || {}).method) || !!(i.paper || {}).needsData;
}

// 작업지시문과 AI 프롬프트가 따를 설계: 데이터 없는 실증 주제는 기본을 문헌연구안(A안)으로 둔다
export function workingDesign(o) {
  const d = o.service === 'paper' ? designOf(o) : null;
  if (!d) return null;
  return needsCollectedData(o, d) && !customerWantsCollected(o) ? literatureVariant(d) : d;
}

// 요청 사항에 적힌 분량 기준(공백 포함 글자 수, 원고지 매수)을 글자 수로 읽는다
export function charsRequired(text) {
  const s = String(text || '').replace(/(\d),(\d{3})/g, '$1$2');
  let need = 0;
  for (const m of s.matchAll(/(\d{3,6})\s*자/g)) need = Math.max(need, Number(m[1]));
  for (const m of s.matchAll(/원고지\s*(\d{1,4})\s*매/g)) need = Math.max(need, Number(m[1]) * 200);
  return need >= 1000 ? need : 0;
}

// 고객 메시지를 작업지시문에 넣을 때 이름·연락처·이메일은 가린다
function scrub(text, o) {
  let t = String(text || '');
  for (const v of [o.name, o.email, o.phone]) if (v && String(v).trim().length >= 2) t = t.split(String(v).trim()).join('○○');
  return t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '○○').replace(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, '○○');
}

function varsText(d) {
  const by = {};
  for (const n of d.model.nodes || []) (by[n.role] = by[n.role] || []).push(n.name);
  return Object.entries(by).map(([r, names]) => `${ROLE_LABELS[r] || r} ${names.join(', ')}`).join(' / ');
}

function filesText(o) {
  const fs = ((o.files && o.files.customer) || []);
  const links = o.links || [];
  const rows = fs.map((f) => `  · [${SLOT[f.slot] || f.slot}] ${f.name}`);
  for (const l of links) rows.push(`  · [${SLOT[l.slot] || l.slot} 링크] ${l.url}`);
  return rows.length ? rows.join('\n') : '  · 없음';
}

function quoteText(o) {
  const q = o.quote || {};
  const lines = (q.lines || []).map((l) => `  · ${l.name}${l.note ? ` (${l.note})` : ''}: ${l.pending ? '견적' : won(l.amount)}`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ 작업지시문 */
export function workBrief(o) {
  const i = o.input || {};
  const c = i.common || {};
  const field = FIELDS.find((f) => f.id === c.fieldId);
  const q = o.quote || {};
  const parts = [];
  parts.push(`[논문AI 작업지시문] ${o.orderNo}`);
  parts.push(block('주문', [
    line('상품', `${o.productName}${q.mainCode ? ` (${q.mainCode})` : ''}`),
    line('금액', `${won(o.amount)} / 결제 ${won(o.paidAmount || 0)}${o.amountDue ? ` / 미결제 ${won(o.amountDue)}` : ''}`),
    line('예상 전달일', o.etaLabel || o.eta || '미정'),
    line('희망 마감일', c.due),
    line('우선 처리', i.addons && i.addons.priority ? '예(우선 순서)' : ''),
    line('양식 상세 적용', i.addons && i.addons.format ? '예' : ''),
    line('심사 발표 PPT·PDF', i.addons && i.addons.ppt ? '예(발표 자료 15~20장 PPT 원본과 PDF, 발표 스크립트)' : ''),
    line('영문 논문 작성', i.addons && i.addons.english ? '예(원고 전체를 학술 영어로)' : ''),
    line('논문 첨삭 추가', i.addons && i.addons.editing ? '예(고객 원고 전체 문장·논리 첨삭)' : ''),
    line('포함 수정', o.revisions ? `${o.revisions.allowed}회 (사용 ${o.revisions.used}회)` : ''),
    line('연구 분야', field ? `${field.label}${c.fieldText ? ` (${c.fieldText})` : ''}` : c.fieldText),
    line(c.topicKnown === 'free' ? '관심 주제(고객이 편하게 적은 말, 제목 아님)' : '연구 주제', c.title),
    line('관심 키워드', (c.keywords || []).join(', ')),
    line('희망 연구 방법', c.topicKnown === 'free' ? ({ auto: '연구진이 정함', survey: '설문·통계', literature: '문헌연구', qualitative: '면담·사례', experiment: '실험·개발' }[c.method || 'auto'] || c.method) : ''),
    line('학교·학과', [c.school, c.dept].filter(Boolean).join(' ')),
    line('목적', c.purpose),
    line('받을 파일', OUT_FMT[c.outputFormat] || c.outputFormat),
  ]));
  // 고객이 직접 적은 말을 먼저 본다
  if (c.request) parts.push(`■ 고객 요청 사항(원문)\n${c.request}`);
  const msgs = (o.messagesAll || o.messages || []).filter((m) => m && m.from === 'customer' && String(m.text || '').trim());
  if (msgs.length) parts.push(`■ 고객이 보낸 메시지(${msgs.length}건)\n${msgs.map((m) => `  · ${korDate(String(m.at || '').slice(0, 10))} [${MSG_TYPE[m.type] || m.type || '메시지'}] ${scrub(m.text, o).replace(/\s*\n\s*/g, ' / ')}`).join('\n')}`);
  parts.push(gapsBlock(o));
  if (c.topicKnown === 'free') parts.push('■ 주제 다듬기\n  고객은 관심 주제와 키워드만 적었습니다. 고객에게 제목을 정해 달라고 하지 말고, 적은 키워드로 선행연구가 충분하고 검증 가능한 연구 주제를 연구진이 골라 제목을 확정합니다.\n  제목 후보는 2~3개를 검토해 가장 완성도가 높은 것으로 쓰고, 고른 이유를 작업 기록에 남깁니다. 아래 연구 설계의 제목은 관심 주제로 만든 자동 초안입니다.');
  parts.push(`■ 견적 내역\n${quoteText(o)}`);

  if (o.service === 'paper') parts.push(...paperBrief(o));
  else if (o.service === 'survey') parts.push(...surveyBrief(o));
  else if (o.service === 'statistics') parts.push(...statsBrief(o));

  parts.push(`■ 고객 자료\n${filesText(o)}`);
  const inc = includesFor(q.includes, o.input && o.input.paper && o.input.paper.pages);
  if (inc.length) parts.push(`■ 전달할 결과물(포함 범위)\n${inc.map((x) => `  · ${x}`).join('\n')}`);
  if (q.excludes && q.excludes.length) parts.push(`■ 포함하지 않는 것\n${q.excludes.map((x) => `  · ${x}`).join('\n')}`);
  parts.push(`■ 전달 전 점검\n${checklist(o).map((x) => `  [ ] ${x}`).join('\n')}`);
  parts.push(`■ 결과물 파일 이름\n  ${o.orderNo}_${o.service === 'paper' ? '원고' : o.service === 'survey' ? '설문' : '분석결과'}_v1.docx (고객 이름을 파일명에 넣지 않음)`);
  return parts.filter(Boolean).join('\n\n');
}

// 고객이 안 알려 준 것은 무엇으로 정하는지, 고객이 적은 분량 기준을 채우는지
function gapsBlock(o) {
  const i = o.input || {};
  const c = i.common || {};
  const p = i.paper || {};
  const eta = o.etaLabel || korDate(o.eta);
  const rows = [];
  if (o.service === 'paper') {
    const formatFile = p.hasFormat === 'yes' || ((o.files && o.files.customer) || []).some((f) => f.slot === 'format');
    if (!c.school && !c.dept) rows.push(`- 학교·학과${formatFile ? '' : '와 양식 파일'}: 안 알려 줌 → 일반 학위논문 형식(APA 7판)으로 쓰고, 학교 양식을 받으면 그때 맞춥니다.`);
    else if (!formatFile) rows.push(`- 양식 파일: 없음 → ${[c.school, c.dept].filter(Boolean).join(' ')} 양식을 받기 전까지 일반 학위논문 형식(APA 7판)으로 씁니다.`);
    if (c.topicKnown === 'free' && !PEOPLE_METHODS.concat(['literature']).includes(c.method)) rows.push('- 연구 방법: 연구진이 정함 → 아래 연구 설계대로 정합니다.');
    const need = charsRequired(c.request);
    if (need && p.pages) {
      const est = p.pages * CHARS_PER_PAGE;
      rows.push(est >= need
        ? `- 분량 기준: 고객 요청은 공백 포함 ${need.toLocaleString('ko-KR')}자 이상 → 본문 ${p.pages}쪽은 보통 공백 포함 ${est.toLocaleString('ko-KR')}자를 넘어 기준을 채웁니다. 전달 전에 본문 글자 수(공백 포함)를 세어 기록합니다.`
        : `- 분량 기준: 고객 요청은 공백 포함 ${need.toLocaleString('ko-KR')}자 이상 → 본문 ${p.pages}쪽(약 ${est.toLocaleString('ko-KR')}자)으로는 모자랄 수 있습니다. 분량을 늘리거나 고객과 추가 분량을 협의합니다.`);
    }
  }
  if (!c.due) rows.push(`- 희망 마감일: 안 적음 → 예상 전달일${eta ? ` ${eta}` : ''}까지 전달합니다.`);
  return block('확인할 것과 기본 처리', rows);
}

function designBlocks(d, p, label) {
  const out = [];
  const cands = d.titleSource === 'suggested' && (d.titleCandidates || []).length > 1 ? d.titleCandidates.slice(0, 3).map((x, k) => `${k + 1}) ${x.title}`).join('  ') : '';
  const head = label || (d.draft ? '연구 설계(관심 주제로 만든 자동 초안, 착수 전 연구진 확정)' : '연구 설계(자동 생성안, 착수 전 확정)');
  out.push(block(head, [
    line('제목', `${d.title}${d.titleSource === 'suggested' ? ' (키워드 기반 추천안)' : d.draft && d.titleSource === 'given' ? ' (고객이 적은 관심 주제를 제목 초안으로 씀)' : ''}`),
    line('제목 후보', cands),
    line('설계', `${d.designLabel} / ${d.methodLabel || ''}`),
    line(d.variant === 'literature' ? '검토 개념' : '변인', d.variant === 'literature' ? (d.model.nodes || []).filter((n) => n.role !== 'group').map((n) => n.name).join(', ') : varsText(d)),
    line(d.variant === 'literature' ? '분석 자료' : '연구 대상', d.variant === 'literature' ? '' : d.parsed.population),
    line(d.variant === 'literature' ? '분석 자료' : '표본', d.sample.text),
    line('분석', d.analysis.join(' → ')),
    line('도구', (d.tools || []).join(', ')),
  ]));
  if (d.questions.length) out.push(`■ 연구 문제\n${d.questions.map((x, k) => `  ${k + 1}. ${x}`).join('\n')}`);
  if (d.hypotheses.length) out.push(`■ 연구 가설\n${d.hypotheses.map((h) => `  ${h.id}. ${h.text}`).join('\n')}`);
  if (d.instruments.length) out.push(`■ 측정도구 후보(원척도·타당화 연구 확인 필수)\n${d.instruments.map((x) => `  · ${x.name}(${x.role}): ${x.candidates.map((cd) => `${cd.name} [${cd.ref}]`).join(' / ')}`).join('\n')}`);
  out.push(`■ 목차안 (본문 약 ${d.toc.totalPages}쪽)\n${p.tocText ? `[고객 목차]\n${p.tocText}\n\n[자동 목차안 참고]\n` : ''}${tocToText(d.toc)}`);
  if (d.checks.length) out.push(`■ 설계 점검\n${d.checks.map((x) => `  · ${x}`).join('\n')}`);
  return out;
}

// 첨삭 범위(결제한 범위 그대로): 기본 교정에 운영자가 '추가 결제 요청'으로 더한 작업(포함 작업 줄)을 합쳐 읽는다.
// 예전에 단계를 골라 들어온 주문(editLevel, EDIT2·EDIT3 상품)도 그대로 읽는다
const EDIT_RANK = { basic: 0, deep: 1, complete: 2 };
function editTier(o) {
  const p = (o.input && o.input.paper) || {};
  const inc = (o.quote && o.quote.includes) || [];
  const [deep, complete] = EXTRA_WORK;
  const onlyComplete = complete.work.filter((w) => !deep.work.includes(w));
  const fromInc = onlyComplete.some((w) => inc.includes(w)) ? 'complete' : deep.work.some((w) => inc.includes(w)) ? 'deep' : 'basic';
  const fromCode = p.editLevel || ((o.quote && editLevelOfCode(o.quote.mainCode)) || {}).id || 'basic';
  return editLevelOf(EDIT_RANK[fromInc] > (EDIT_RANK[fromCode] || 0) ? fromInc : fromCode);
}
const editScopeName = (lv) => (lv.id === 'basic' ? '기본 교정' : `기본 교정 + ${(EXTRA_WORK.find((x) => x.level === lv.id) || {}).label}`);
function editTierText(o) {
  const lv = editTier(o);
  return lv.id === 'basic' ? '기본 교정(문장 교정) · 문장만 다듬고 흐름·인용·내용은 손대지 않아요' : `${editScopeName(lv)}(추가 작업 결제 포함)`;
}

function paperBrief(o) {
  const i = o.input || {};
  const p = i.paper || {};
  const out = [];
  const type = PAPER_TYPES.find((t) => t.id === p.typeId);
  out.push(block('작업', [
    line('논문 유형', type ? type.label : p.typeId),
    line('요청 작업', TASK[p.task] || p.task),
    line('첨삭 범위', p.task === 'edit' ? editTierText(o) : ''),
    line('분량', p.pages ? `${p.pages}쪽` : '기준 분량'),
    line('목차', p.hasToc === 'yes' ? (p.tocText ? '고객 목차 있음(아래)' : '고객 목차 파일 있음') : '목차 새로 구성'),
    line('양식', p.hasFormat === 'yes' ? `있음${p.formatName ? ` (${p.formatName})` : ''}` : '없음(일반 학위논문 형식)'),
    line('수정 범위', p.editScope),
    line('데이터 분석 필요', p.needsData ? '예' : ''),
  ]));
  const d = designOf(o);
  if (d && p.task !== 'edit') {
    if (needsCollectedData(o, d)) {
      // 데이터 없는 실증 주제: 결과 수치를 지어내지 않도록 A안(문헌연구)·B안(데이터 수집)을 나눠 보여 준다
      const wantsB = customerWantsCollected(o);
      const lit = literatureVariant(d);
      out.push([
        '■ 연구 방법 정하기(고객 데이터 없음)',
        `  고객이 설문·면담·실험 데이터를 보내지 않았습니다. 설문 결과나 통계 수치를 만들어 넣지 않습니다(연구윤리 위반이고 실존 근거 약속과도 맞지 않습니다).`,
        `  · A안 문헌연구(바로 완성): 같은 주제를 선행연구 체계적 고찰로 씁니다. 결과 장은 선행연구 결과를 변인별로 종합하고 연구 명제를 도출합니다.`,
        `  · B안 ${d.methodLabel}: 실제 데이터가 있어야 결과 장을 쓸 수 있습니다. 고객에게 데이터가 있는지 묻고, 없으면 설문조사·통계분석 주문으로 연결합니다(결과 장은 실제 분석 뒤 작성).`,
        `  · 기본: ${wantsB ? 'B안(고객이 이 방법을 골랐거나 데이터 분석 뒤 결과를 쓴다는 안내를 받았습니다). 착수 전에 고객에게 데이터 여부를 꼭 확인합니다.' : 'A안. 고객 학과에서 설문·실험 결과를 꼭 요구하면 B안으로 바꿉니다.'}`,
        '  · 고객 확인 메시지 예시: "주문하신 주제는 설문이나 실험 데이터가 있어야 결과를 쓸 수 있는 주제예요. 따로 모으신 데이터가 없으시면 선행연구를 종합하는 문헌연구 형식으로 완성해 드릴게요. 학과에서 설문·실험 결과가 꼭 필요하다면 알려 주세요."',
      ].join('\n'));
      const main = wantsB ? d : lit;
      const alt = wantsB ? lit : d;
      out.push(...designBlocks(main, p, wantsB ? `연구 설계 B안: ${d.methodLabel}(기본, 착수 전 확정)` : '연구 설계 A안: 문헌연구(기본, 바로 완성)'));
      out.push(block(wantsB ? '연구 설계 A안 요약: 문헌연구(데이터가 없을 때)' : `연구 설계 B안 요약: ${d.methodLabel}(고객 데이터가 있을 때)`, [
        line('제목', alt.title),
        line('설계', `${alt.designLabel} / ${alt.methodLabel || ''}`),
        line(alt.variant === 'literature' ? '검토 개념' : '변인', alt.variant === 'literature' ? (alt.model.nodes || []).filter((n) => n.role !== 'group').map((n) => n.name).join(', ') : varsText(alt)),
        line(alt.variant === 'literature' ? '분석 자료' : '표본', alt.sample.text),
        line('분석', alt.analysis.join(' → ')),
        line('가설', alt.hypotheses.length ? alt.hypotheses.map((h) => `${h.id}. ${h.text}`).join(' / ') : ''),
        '- 목차는 운영자 화면 \'연구 설계\' 탭 참고',
      ]));
    } else {
      out.push(...designBlocks(d, p));
    }
  }
  if (p.task === 'feedback' && p.feedbackText) {
    const fb = classifyFeedback(p.feedbackText);
    out.push(`■ 피드백 항목(${fb.items.length}개, 자동 분류)\n${fb.items.map((x, k) => `  ${k + 1}. [${x.category}] ${x.text}`).join('\n')}\n  → 수정 대조표(피드백 / 수정 내용 / 쪽) 작성, 본문에서 반영한 부분은 파란색 글자로 표시한 수정본과 최종 정리본을 함께 전달`);
  }
  return out;
}

function surveyBrief(o) {
  const i = o.input || {};
  const s = i.survey || {};
  const c = i.common || {};
  const out = [];
  out.push(block('작업', [
    line('의뢰 유형', SURVEY_MODE[s.mode] || s.mode),
    line('응답 대상', s.target === 'other' ? s.targetOther : (TARGET[s.target] || s.target)),
    line('목표 응답 수', s.targetN && /^\d+$/.test(s.targetN) ? `${s.targetN}명` : '추천 필요'),
    line('응답 수집', { us: '모집·배포 대행(견적 확정분)', self: '고객 직접 수집', none: '설문지만' }[s.recruit] || s.recruit),
    line('분석 수준', s.advanced ? '심화(매개·조절)' : s.sem ? '구조방정식' : '기본'),
    line('연구계획서', s.hasPlan === 'yes' ? '있음(자료 참고)' : ''),
  ]));
  if (s.deliverables && s.deliverables.length) out.push(`■ 약속한 결과물\n${s.deliverables.map((x) => `  · ${x}`).join('\n')}`);
  if (c.title || (c.keywords || []).length) {
    try {
      const plan = surveyPlan({ title: c.title, keywords: c.keywords || [], fieldId: c.fieldId || 'other', target: s.target || 'auto', targetN: /^\d+$/.test(s.targetN || '') ? s.targetN : 'auto', mode: s.mode || 'full', analysis: s.advanced ? 'advanced' : 'auto' });
      out.push(`■ 설문 구성안(자동, 약 ${plan.totalItems}문항 · ${plan.minutes}분)\n${plan.sections.map((x) => `  · ${x.name} ${x.items}문항: ${x.note}`).join('\n')}\n  · 권장 표본: ${plan.nLabel}\n  · 분석: ${plan.analyses.join(' → ')}`);
    } catch { /* 설계 불가 시 생략 */ }
  }
  if (s.feedbackText) {
    const fb = classifyFeedback(s.feedbackText);
    out.push(`■ 피드백 항목(${fb.items.length}개)\n${fb.items.map((x, k) => `  ${k + 1}. [${x.category}] ${x.text}`).join('\n')}\n  → 수정 대조표 작성, 반영한 문항은 파란색 글자로 표시`);
  }
  if (s.recruit === 'us') out.push('■ 모집 대행 확인\n  · 모집 경로·일정·사례비 집행 내역 기록(이용약관 제28조 제2항)\n  · 참여 동의 문구와 개인정보 최소 수집, IRB 필요 여부 확인');
  return out;
}

function statsBrief(o) {
  const i = o.input || {};
  const t = i.statistics || {};
  const c = i.common || {};
  const out = [];
  const sim = t.hasData === false && t.noDataPath === 'simulation';
  out.push(block('작업', [
    line('데이터', t.hasData === false ? (t.noDataPath === 'survey' ? '없음: 설문 조사부터 진행' : '없음: 학습용 시뮬레이션') : '고객 데이터 있음'),
    line('결과물', sim ? '학습용 분석 실습 결과와 해설(모든 표·파일에 가상 데이터 표시)' : t.hasData === false ? '설문 조사 후 분석(응답 수집 포함 통합 견적)' : (OUTPUT[t.output] || t.output)),
    line('분석 방법', (t.methods || []).map((m) => METHOD_LABELS[m] || m).join(', ') || (o.design && o.design.methodLabel)),
    line('변수 설명', t.variables),
    line('데이터 정보', t.dataInfo),
    line('심화 분석', t.advanced ? '매개·조절(PROCESS)' : ''),
    line('구조방정식', t.sem ? '예(견적 확인)' : ''),
  ]));
  const plan = statsPlan({ methods: t.methods && t.methods.length ? t.methods : ['auto'], title: c.title || '' });
  out.push(`■ 분석 순서(자동)\n${plan.steps.map((x, k) => `  ${k + 1}. ${x}`).join('\n')}`);
  if (sim) out.push('■ 시뮬레이션 주의\n  · 모든 결과물 첫 쪽과 표 제목에 "가상 데이터, 실제 연구 결과 아님" 표시\n  · 결과 파일 이름 앞에 [가상데이터_실제연구결과아님] 자동 표시됨\n  · 실제 논문 결과로 쓰도록 돕는 문구 금지');
  if (t.feedbackText) {
    const fb = classifyFeedback(t.feedbackText);
    out.push(`■ 교수님 의견(${fb.items.length}개)\n${fb.items.map((x, k) => `  ${k + 1}. [${x.category}] ${x.text}`).join('\n')}\n  → 수정 대조표 작성, 고친 표와 수치는 파란색으로 표시`);
  }
  return out;
}

function checklist(o) {
  const list = ['요청 범위와 포함 내역을 모두 반영했는지', '인용 문헌이 실제로 존재하고(DOI·KCI·RISS 대조) 본문 인용과 참고문헌 목록이 1:1로 일치하는지(APA 7판)', '수치·표 번호·그림 번호가 본문과 맞는지', '파일 이름과 문서 속에 고객 개인정보가 없는지'];
  const t = (o.input || {}).statistics;
  if (t && t.hasData === false && t.noDataPath === 'simulation') list.unshift('가상 데이터 표시가 모든 결과물에 있는지');
  if (o.service === 'paper') list.push('양식(여백·글꼴·목차 서식) 적용 여부', '맞춤법·띄어쓰기 점검');
  if (o.service === 'statistics' || o.service === 'survey') list.push('결측·역문항 처리 기준을 결과물에 적었는지', '신뢰도(α)와 표본 수를 보고했는지');
  return list;
}

/* ------------------------------------------------------------------ AI 작업 프롬프트(장별) */
const RULES = [
  '학술적 문어체(~이다)로 쓰고, 절 제목을 그대로 유지한다.',
  '인용은 실제로 존재하는 문헌만 쓴다. 확인할 수 없는 문헌은 만들지 말고 [문헌 확인 필요]로 표시한다.',
  '참고문헌은 한 편씩 DOI·KCI·RISS 원문 기록과 대조해 저자·연도·제목·학술지·권호·쪽·DOI를 맞춘다(사이트에 실존 참고문헌을 약속함).',
  '문장마다 근거 문헌을 (저자, 연도) 본문 인용으로 달고, 본문 인용과 참고문헌 목록을 1:1로 맞춘다(목록에만 있거나 본문에만 있는 문헌이 없게).',
  '통계 수치와 분석 결과를 지어내지 않는다. 결과가 들어갈 자리는 [표 4-1 삽입]처럼 표시한다.',
  '선행연구의 결과 수치(평균, 계수, 유의확률 등)를 옮길 때는 원문에 있는 값만 쓴다.',
  '개인을 알아볼 수 있는 정보는 쓰지 않는다.',
];
const LIT_RULE = '검색 건수, 중복 제거, 최종 선정 편수(PRISMA)는 실제로 검색한 결과만 쓰고, 아직 모르는 숫자는 [검색 건수 입력]처럼 표시한다.';

export function aiPrompts(o) {
  const i = o.input || {};
  const c = i.common || {};
  const p = i.paper || {};
  const field = FIELDS.find((f) => f.id === c.fieldId);
  const type = PAPER_TYPES.find((t) => t.id === p.typeId);
  const d = o.service === 'paper' ? workingDesign(o) : null;
  const lit = !!d && d.variant === 'literature';
  const ctx = d ? [
    `- 제목: ${d.title}`,
    `- 연구 설계: ${d.designLabel} / ${d.methodLabel || ''}`,
    lit ? `- 검토 개념: ${(d.model.nodes || []).filter((n) => n.role !== 'group').map((n) => n.name).join(', ')}` : `- 변인: ${varsText(d)}`,
    lit ? `- 분석 자료: ${d.sample.text}` : d.parsed.population ? `- 연구 대상: ${d.parsed.population} (${d.sample.text})` : '',
    d.questions.length ? `- 연구 문제:\n${d.questions.map((x, k) => `  ${k + 1}. ${x}`).join('\n')}` : '',
    d.hypotheses.length ? `- 연구 가설:\n${d.hypotheses.map((h) => `  ${h.id}. ${h.text}`).join('\n')}` : '',
    `- 분석 방법: ${d.analysis.join(', ')}`,
  ].filter(Boolean).join('\n') : '';
  const role = `당신은 ${field ? field.label : '사회과학'} 분야 ${type ? type.label : '학술 논문'} 작성을 돕는 연구 보조원입니다.`;
  const req = c.request ? `\n[고객 요청 사항]\n${c.request}` : '';
  const rules = `[작성 원칙]\n${(lit ? [...RULES, LIT_RULE] : RULES).map((r, k) => `${k + 1}. ${r}`).join('\n')}`;
  const out = [];
  if (o.service === 'paper' && d && ['full', 'proposal'].includes(p.task)) {
    const chapters = p.task === 'proposal' ? [{ no: '', title: '연구계획서 전체', pages: Math.max(8, Math.round(d.toc.totalPages * 0.2)), sections: [{ title: '연구 주제와 제목' }, { title: '연구의 필요성과 목적' }, { title: '이론적 배경 요약과 연구모형' }, { title: '연구 방법(대상·도구·절차·분석)' }, { title: '연구 일정' }, { title: '참고문헌' }] }] : d.toc.chapters;
    for (const ch of chapters) {
      const secs = ch.sections.map((s) => `  ${s.no || '-'} ${s.title}${s.subs && s.subs.length ? `\n${s.subs.map((x) => `     ${x}`).join('\n')}` : ''}`).join('\n');
      out.push({
        title: `${ch.no} ${ch.title}`.trim(),
        text: `${role}\n\n[연구 정보]\n${ctx}\n\n[작성할 부분] ${ch.no} ${ch.title} (약 ${ch.pages}쪽)\n${secs}${req}\n\n${rules}\n\n먼저 절별 핵심 내용을 3줄씩 개요로 제시한 뒤, 개요에 맞춰 본문을 작성하세요.`,
      });
    }
  } else if (o.service === 'paper' && p.task === 'feedback') {
    const fb = classifyFeedback(p.feedbackText || '');
    out.push({ title: '피드백 반영 계획', text: `${role}\n\n아래 지도교수 피드백을 항목별로 반영하려고 합니다. 각 항목에 대해 (1) 요구 사항 해석, (2) 원고에서 고칠 위치, (3) 수정 문안 예시를 표로 정리하세요.${ctx ? `\n\n[연구 정보]\n${ctx}` : ''}\n\n[피드백]\n${fb.items.map((x, k) => `${k + 1}. ${x.text}`).join('\n') || '(피드백 파일 참고)'}${req}\n\n${rules}` });
  } else if (o.service === 'paper' && p.task === 'edit') {
    const lv = editTier(o);
    const how = {
      basic: '의미와 흐름은 바꾸지 말고 (1) 맞춤법·띄어쓰기·비문, (2) 어색하거나 긴 문장, (3) 용어·표기 통일만 고치세요.',
      deep: '의미는 바꾸지 말고 (1) AI 문체·번역투를 자연스러운 학술 문장으로 고쳐 쓰기, (2) 문단 흐름과 논리 연결, (3) 용어 통일, (4) 본문 인용과 참고문헌 목록 대조(APA 7판)를 하고, 장마다 보완할 점을 코멘트로 남기세요.',
      complete: '(1) 심화 첨삭(AI 문체, 흐름, 인용 대조) 전부, (2) 목차·장 구성 점검과 재배치 제안, (3) 부족한 근거·선행연구 보완 집필(실존 문헌만), (4) 논리 비약과 사실·수치 확인, (5) 참고문헌 실존 여부 확인을 하세요. 보완해 쓴 부분은 표시하세요.',
    }[lv.id];
    out.push({ title: `첨삭 기준(${editScopeName(lv)})`, text: `${role}\n\n아래 원고 일부를 ${editScopeName(lv)} 범위로 첨삭합니다. ${how} 고친 이유를 짧게 덧붙이세요.\n[첨삭 범위] ${p.editScope || '원고 전체'}${req}\n\n${rules}\n\n[원고]\n(여기에 원고 일부 붙여넣기)` });
  } else if (o.service === 'statistics') {
    const t = i.statistics || {};
    out.push({ title: '결과 해석 문안', text: `당신은 ${field ? field.label : '사회과학'} 분야 통계 결과를 논문 문체로 해석하는 연구 보조원입니다.\n\n아래 SPSS 결과표를 APA 7판 형식 표와 해석 문단으로 정리하세요. 수치는 표에 있는 값만 쓰고, 유의확률은 p < .05처럼 표기하세요.${t.hasData === false && t.noDataPath === 'simulation' ? '\n모든 표 제목과 첫 문단에 "가상 데이터, 실제 연구 결과 아님"을 표시하세요.' : ''}${req}\n\n[결과표]\n(여기에 출력 결과 붙여넣기)` });
  } else if (o.service === 'survey') {
    out.push({ title: '설문 문항 다듬기', text: `당신은 설문지 설계 전문가입니다. 아래 문항 초안을 (1) 이중 질문 제거, (2) 유도 표현 제거, (3) 응답 척도 일관화(5점 리커트) 기준으로 다듬고, 원척도 출처를 밝혀야 할 문항을 표시하세요.${req}\n\n[문항 초안]\n(여기에 붙여넣기)` });
  }
  return out;
}

/* ------------------------------------------------------------------ 고객 안내 문구 */
export function customerTemplates(o) {
  const eta = o.etaLabel || korDate(o.eta);
  return [
    { label: '착수 안내', text: `주문하신 작업을 시작했습니다. 연구 설계를 먼저 확정한 뒤 본 작업에 들어가며, 예상 전달일은 ${eta || '확정되는 대로 알려 드리는 날짜'}입니다. 진행 중 확인이 필요한 부분이 생기면 이 페이지로 바로 여쭙겠습니다.` },
    { label: '설계 확인 요청', text: '작업에 앞서 연구 설계(제목, 변인, 가설, 목차)를 정리했습니다. 주문 페이지의 연구 설계 리포트를 확인하시고, 바꾸고 싶은 부분이 있으면 메시지로 알려 주세요. 별도 의견이 없으면 이 설계로 진행합니다.' },
    { label: '중간 진행 안내', text: `현재 본문 작성과 분석을 진행하고 있습니다. 예정대로 ${eta || '예상 전달일'}에 전달드릴 수 있도록 하겠습니다.` },
    { label: '전달 안내', text: '결과물을 주문 페이지에 올려 두었습니다. 내용을 확인하시고 고칠 부분은 한 번에 모아 수정 요청으로 보내 주세요. 문헌과 수치는 제출 전에 한 번 더 확인해 주시기 바랍니다.' },
    { label: '일정 조정 안내', text: '자료 검토 결과 작업 범위가 예상보다 넓어 예상 전달일을 조정해야 할 것 같습니다. 조정된 날짜는 주문 페이지에 바로 반영하겠습니다. 일정이 급하시면 메시지로 알려 주세요.' },
  ];
}
