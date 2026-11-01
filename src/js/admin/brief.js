// 운영자용 작업지시문·AI 작업 프롬프트·고객 안내 문구 자동 생성
// 개인정보(이름·연락처)는 넣지 않고 주문번호로만 식별한다.
import { buildDesign, tocToText, ROLE_LABELS } from '../core/engine.js';
import { surveyPlan, statsPlan, METHOD_LABELS } from '../core/plans.js';
import { classifyFeedback } from '../core/feedback.js';
import { PAPER_TYPES, FIELDS } from '../core/kb.js';
import { won } from '../core/render.js';

const TASK = { full: '전체 구성·초고 완성', edit: '논문 첨삭·교정', feedback: '교수님 피드백 반영', proposal: '연구계획서 작성' };
const SURVEY_MODE = { full: '설문지 작성부터 통계 해석까지(작성·제작·조사·분석)', new: '설문지 작성', edit: '설문지 점검·수정', feedback: '설문지 피드백 반영(수정표, 파란색 표시)', analyze: '설문 응답 통계 분석·해석' };
const TARGET = { auto: '추천 필요', student: '대학생', worker: '직장인', teacher: '교사', parent: '학부모', adult: '성인' };
const OUTPUT = { table: '논문 맞춤 통계분석 기본형(분석·APA 통계표·핵심 해석)', interp: '논문 맞춤 통계분석 표준형(가설별 분석 설계·통계표·표별 해석)', chapter: '통계분석과 연구결과(4장) 본문 작성', revise: '통계 재분석·피드백 반영(수정표, 파란색 표시)' };
const SLOT = { manuscript: '기존 원고', materials: '참고 자료', toc: '목차', format: '양식', feedback: '피드백', questionnaire: '설문지', proposal: '연구계획서', data: '데이터', prevResult: '기존 분석 결과', codebook: '변수 설명', other: '기타', result: '결과물' };

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

export function designOf(o) {
  const i = o.input || {};
  const c = i.common || {};
  const title = (o.design && o.design.title) || c.title || '';
  if (!title && !(c.keywords || []).length) return null;
  try {
    return buildDesign({ title, keywords: c.keywords || [], typeId: (i.paper || {}).typeId || 'master', fieldId: c.fieldId || 'other', fieldText: c.fieldText, method: c.method || 'auto', due: c.due || null });
  } catch { return null; }
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
    line('심사 발표 PPT', i.addons && i.addons.ppt ? '예(발표 자료 15~20장, 발표 스크립트)' : ''),
    line('영문 논문 작성', i.addons && i.addons.english ? '예(원고 전체를 학술 영어로)' : ''),
    line('논문 첨삭 추가', i.addons && i.addons.editing ? '예(고객 원고 전체 문장·논리 첨삭)' : ''),
    line('포함 수정', o.revisions ? `${o.revisions.allowed}회 (사용 ${o.revisions.used}회)` : ''),
    line('연구 분야', field ? `${field.label}${c.fieldText ? ` (${c.fieldText})` : ''}` : c.fieldText),
    line('연구 주제', c.title),
    line('관심 키워드', (c.keywords || []).join(', ')),
    line('학교·학과', [c.school, c.dept].filter(Boolean).join(' ')),
    line('목적', c.purpose),
  ]));
  parts.push(`■ 견적 내역\n${quoteText(o)}`);

  if (o.service === 'paper') parts.push(...paperBrief(o));
  else if (o.service === 'survey') parts.push(...surveyBrief(o));
  else if (o.service === 'statistics') parts.push(...statsBrief(o));

  parts.push(`■ 고객 자료\n${filesText(o)}`);
  if (c.request) parts.push(`■ 고객 요청 사항(원문)\n${c.request}`);
  if (q.includes && q.includes.length) parts.push(`■ 전달할 결과물(포함 범위)\n${q.includes.map((x) => `  · ${x}`).join('\n')}`);
  if (q.excludes && q.excludes.length) parts.push(`■ 포함하지 않는 것\n${q.excludes.map((x) => `  · ${x}`).join('\n')}`);
  parts.push(`■ 전달 전 점검\n${checklist(o).map((x) => `  [ ] ${x}`).join('\n')}`);
  parts.push(`■ 결과물 파일 이름\n  ${o.orderNo}_${o.service === 'paper' ? '원고' : o.service === 'survey' ? '설문' : '분석결과'}_v1.docx (고객 이름을 파일명에 넣지 않음)`);
  return parts.filter(Boolean).join('\n\n');
}

function paperBrief(o) {
  const i = o.input || {};
  const p = i.paper || {};
  const out = [];
  const type = PAPER_TYPES.find((t) => t.id === p.typeId);
  out.push(block('작업', [
    line('논문 유형', type ? type.label : p.typeId),
    line('요청 작업', TASK[p.task] || p.task),
    line('분량', p.pages ? `${p.pages}쪽` : '기준 분량'),
    line('목차', p.hasToc === 'yes' ? (p.tocText ? '고객 목차 있음(아래)' : '고객 목차 파일 있음') : '목차 새로 구성'),
    line('양식', p.hasFormat === 'yes' ? `있음${p.formatName ? ` (${p.formatName})` : ''}` : '없음(일반 학위논문 형식)'),
    line('수정 범위', p.editScope),
    line('데이터 분석 필요', p.needsData ? '예' : ''),
  ]));
  const d = designOf(o);
  if (d && p.task !== 'edit') {
    out.push(block('연구 설계(자동 생성안, 착수 전 확정)', [
      line('제목', `${d.title}${d.titleSource === 'suggested' ? ' (키워드 기반 추천안)' : ''}`),
      line('설계', `${d.designLabel} / ${d.methodLabel || ''}`),
      line('변인', varsText(d)),
      line('연구 대상', d.parsed.population),
      line('표본', d.sample.text),
      line('분석', d.analysis.join(' → ')),
      line('도구', (d.tools || []).join(', ')),
    ]));
    if (d.questions.length) out.push(`■ 연구 문제\n${d.questions.map((x, k) => `  ${k + 1}. ${x}`).join('\n')}`);
    if (d.hypotheses.length) out.push(`■ 연구 가설\n${d.hypotheses.map((h) => `  ${h.id}. ${h.text}`).join('\n')}`);
    if (d.instruments.length) out.push(`■ 측정도구 후보(원척도·타당화 연구 확인 필수)\n${d.instruments.map((x) => `  · ${x.name}(${x.role}): ${x.candidates.map((cd) => `${cd.name} [${cd.ref}]`).join(' / ')}`).join('\n')}`);
    out.push(`■ 목차안 (본문 약 ${d.toc.totalPages}쪽)\n${p.tocText ? `[고객 목차]\n${p.tocText}\n\n[자동 목차안 참고]\n` : ''}${tocToText(d.toc)}`);
    if (d.checks.length) out.push(`■ 설계 점검\n${d.checks.map((x) => `  · ${x}`).join('\n')}`);
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
  if (s.recruit === 'us') out.push('■ 모집 대행 확인\n  · 모집 경로·일정·사례비 집행 내역 기록(환불 규정 제6조)\n  · 참여 동의 문구와 개인정보 최소 수집, IRB 필요 여부 확인');
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
  '개인을 알아볼 수 있는 정보는 쓰지 않는다.',
];

export function aiPrompts(o) {
  const i = o.input || {};
  const c = i.common || {};
  const p = i.paper || {};
  const field = FIELDS.find((f) => f.id === c.fieldId);
  const type = PAPER_TYPES.find((t) => t.id === p.typeId);
  const d = o.service === 'paper' ? designOf(o) : null;
  const ctx = d ? [
    `- 제목: ${d.title}`,
    `- 연구 설계: ${d.designLabel} / ${d.methodLabel || ''}`,
    `- 변인: ${varsText(d)}`,
    d.parsed.population ? `- 연구 대상: ${d.parsed.population} (${d.sample.text})` : '',
    d.questions.length ? `- 연구 문제:\n${d.questions.map((x, k) => `  ${k + 1}. ${x}`).join('\n')}` : '',
    d.hypotheses.length ? `- 연구 가설:\n${d.hypotheses.map((h) => `  ${h.id}. ${h.text}`).join('\n')}` : '',
    `- 분석 방법: ${d.analysis.join(', ')}`,
  ].filter(Boolean).join('\n') : '';
  const role = `당신은 ${field ? field.label : '사회과학'} 분야 ${type ? type.label : '학술 논문'} 작성을 돕는 연구 보조원입니다.`;
  const req = c.request ? `\n[고객 요청 사항]\n${c.request}` : '';
  const rules = `[작성 원칙]\n${RULES.map((r, k) => `${k + 1}. ${r}`).join('\n')}`;
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
    out.push({ title: '첨삭 기준', text: `${role}\n\n아래 원고 일부를 첨삭합니다. 의미는 바꾸지 말고 (1) 문장 다듬기, (2) 논리 연결, (3) 용어 통일, (4) 인용 형식(APA 7판)을 고치고, 고친 이유를 짧게 덧붙이세요.\n[첨삭 범위] ${p.editScope || '원고 전체'}${req}\n\n${rules}\n\n[원고]\n(여기에 원고 일부 붙여넣기)` });
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
