// 설문조사 의뢰 신청서
import { createWizard, choice, textField, textArea, uploader, note, hasSlot, submitOrder, priceLinesHtml, ICON } from './wizard.js';
import { contactStep, reviewSummary, etaHtml, sideShell, deadlineMin, quickChecklist } from './common-steps.js';
import { loadConfig, peekConfig } from './api.js';
import { FIELDS } from '../core/kb.js';
import { computeQuote, findItem, paperItemCode } from '../core/pricing.js';
import { surveyPlan } from '../core/plans.js';
import { classifyFeedback } from '../core/feedback.js';
import { esc, won, readLineHtml } from '../core/render.js';

const PURPOSES = [['master', '석사학위논문'], ['doctor', '박사학위논문'], ['journal', '학술지 논문'], ['course', '졸업논문·과제'], ['org', '기업·기관 조사'], ['personal', '개인 연구']];
const MODES = [
  { v: 'full', t: '설문지 작성부터 설문 결과·통계 해석까지', badge: '추천', d: '설문지 작성, 온라인 설문 진행, 설문 결과 정리, 논문 맞춤 통계 분석과 해석까지 한 번에', code: 'S-FULL' },
  { v: 'new', t: '설문지 작성', d: '연구 변인에 맞는 검증된 척도로 문항을 구성하고 배포용 링크까지 만듭니다', code: 'S-NEW' },
  { v: 'edit', t: '설문지 점검·수정', d: '이미 만든 설문지의 문항과 척도를 점검하고 고칩니다', code: 'S-EDIT' },
  { v: 'feedback', t: '교수님 피드백 반영', d: '설문지 의견을 항목별로 반영해 수정표를 작성하고, 반영 부분은 파란색으로 표시합니다', code: 'S-FB' },
  { v: 'analyze', t: '설문 응답 통계 분석·해석', d: '이미 모은 응답 데이터를 연구 가설에 맞게 분석하고 해석합니다', code: 'S-ANALYZE' },
];
const TARGETS = [['auto', '잘 모르겠어요 (추천)'], ['student', '대학생'], ['worker', '직장인'], ['teacher', '교사'], ['parent', '학부모'], ['adult', '성인'], ['other', '기타']];
const NS = [['auto', '잘 모르겠어요 (추천)'], ['50', '50명'], ['100', '100명'], ['200', '200명'], ['300', '300명'], ['custom', '직접 입력']];

const defaults = {
  v: 1, service: 'survey',
  common: { purpose: '', fieldId: '', fieldText: '', topicKnown: '', title: '', keywords: [], keywordsText: '', due: '', request: '' },
  survey: { mode: '', hasPlan: '', hasQuestionnaire: '', target: 'auto', targetOther: '', targetN: 'auto', targetNCustom: '', recruit: '', analysis: 'auto', feedbackText: '' },
  addons: { priority: false, format: false, revisions: 0, ppt: false, editing: false },
  files: [], links: [], contact: { name: '', email: '', phone: '' }, pin: '', consents: { privacy: true, ethics: true, withdrawal: true, marketing: false, irb: false }, hp: '',
};
let CONFIG = { catalog: null, settings: {} };

// 논문 첨삭을 더할 때 쓸 논문 유형(조사 목적에서)
const EDIT_TYPE = { master: 'master', doctor: 'doctor', journal: 'journal', course: 'bachelor', org: 'report', personal: 'personal' };

const needsAnalysis = (s) => ['full', 'analyze'].includes(s.survey.mode);
const needsRecruitQ = (s) => ['full', 'new', 'edit', 'feedback'].includes(s.survey.mode);
const needsTarget = (s) => s.survey.mode && s.survey.mode !== 'analyze';

function quoteInput(s) {
  return {
    service: 'survey',
    survey: { mode: s.survey.mode || 'full', recruit: needsRecruitQ(s) ? s.survey.recruit : 'none', advanced: s.survey.analysis === 'advanced', sem: false },
    addons: { priority: s.addons.priority, revisions: Number(s.addons.revisions || 0), ppt: !!s.addons.ppt, editing: !!s.addons.editing, editingType: EDIT_TYPE[s.common.purpose] || 'master' },
  };
}

// 추가 옵션: 심사 발표 PPT, 논문 첨삭·교정, 우선 처리
function extraAddonsHtml(s) {
  const cat = CONFIG.catalog;
  const ppt = findItem(cat, 'A-PPT'), pr = findItem(cat, 'A-PRIORITY');
  const ed = findItem(cat, paperItemCode(EDIT_TYPE[s.common.purpose] || 'master', 'edit'));
  const box = (key, title, price, desc) => `<label class="check addon"><input type="checkbox" data-bool="addons.${key}"${s.addons[key] ? ' checked' : ''}><span><b>${title} <em class="num">+${won(price)}</em></b><small>${desc}</small></span></label>`;
  return `<div class="addons">
${ppt ? box('ppt', '심사 발표 PPT·PDF 제작', ppt.price, '조사 결과와 논문 핵심을 담은 발표 자료 15~20장(PPT·PDF)과 발표 스크립트를 드립니다.') : ''}
${ed ? box('editing', '논문 첨삭·교정', ed.price, `직접 쓰신 논문 원고의 문장·논리를 다듬습니다(${esc(ed.name)}, 기준 ${ed.baseUnits}${ed.unitLabel}). 원고는 주문 뒤 올려 주셔도 됩니다.`) : ''}
${pr ? box('priority', '우선 처리', pr.price, '가능한 경우 작업 순서를 앞당깁니다. 응답 수집 기간은 줄어들지 않습니다.') : ''}
</div>`;
}

function plan(s) {
  const c = s.common;
  return surveyPlan({ title: c.title, keywords: c.keywords, fieldId: c.fieldId || 'other', target: s.survey.target, targetN: s.survey.targetN === 'custom' ? (s.survey.targetNCustom || 'auto') : s.survey.targetN, mode: s.survey.mode, analysis: s.survey.analysis });
}

function deliverables(s) {
  const m = s.survey.mode;
  const out = [];
  if (['full', 'new', 'edit', 'feedback'].includes(m)) out.push('설문지(Word)');
  if (['full', 'new'].includes(m) || (needsRecruitQ(s) && s.survey.recruit !== 'none')) out.push('배포용 온라인 설문 링크와 참여 안내문');
  if (m === 'feedback') out.push('수정 대조표와 반영 부분 파란색 표시본');
  if (m === 'full' || s.survey.recruit === 'us') out.push('익명화 응답 데이터');
  if (needsAnalysis(s)) out.push('APA 형식 통계표', '논문 맞춤 결과 해석');
  if (m === 'full') out.push('연구결과 정리');
  return out;
}

function toInput(s) {
  const q = quoteInput(s);
  return {
    common: { ...s.common, purpose: s.common.purpose },
    survey: { ...s.survey, targetN: s.survey.targetN === 'custom' ? s.survey.targetNCustom : s.survey.targetN, recruit: q.survey.recruit, advanced: q.survey.advanced, deliverables: deliverables(s) },
    addons: q.addons,
  };
}

const steps = [
  {
    id: 'purpose', title: '설문조사를 어디에 쓰실 건가요?', help: '목적에 따라 설문 구성과 분석 수준이 달라집니다.',
    render: (s) => choice('common.purpose', s.common.purpose, PURPOSES.map(([v, t]) => ({ v, t })), { cols: 2 }),
    valid: (s) => (s.common.purpose ? null : '설문 목적을 골라 주세요.'),
  },
  {
    id: 'topic', title: '전공과 연구 주제를 알려 주세요', help: '주제가 없다면 관심 분야만 적어 주세요. 설문 설계부터 함께 합니다.',
    render: (s) => `${choice('common.fieldId', s.common.fieldId, FIELDS.map((f) => ({ v: f.id, t: f.label })), { cols: 3, compact: true })}
<div style="margin-top:20px">${choice('common.topicKnown', s.common.topicKnown, [{ v: 'yes', t: '주제가 있어요' }, { v: 'no', t: '주제는 아직 없어요', d: '관심 분야를 적으면 설계를 요청합니다' }], { cols: 2 })}</div>
${s.common.topicKnown === 'yes' ? `<div class="cond">${textArea('common.title', s.common.title, { label: '연구 주제', rows: 3, required: true, placeholder: '예: 대학생의 SNS 이용과 우울의 관계에서 자기효능감의 조절효과', cls: 'serif-in' })}<div id="parseLive"></div></div>` : ''}
${s.common.topicKnown === 'no' ? `<div class="cond">${textField('common.keywordsText', s.common.keywordsText, { label: '관심 분야·키워드', placeholder: '예: 직장인 번아웃, 조직문화', required: true })}</div>` : ''}`,
    bind: () => live(),
    onInput: (t, s) => { if (t.dataset.path === 'common.keywordsText') s.common.keywords = t.value.split(/[,，、\n]+/).map((x) => x.trim()).filter(Boolean).slice(0, 3); live(); },
    valid: (s) => {
      if (!s.common.fieldId) return '전공 분야를 골라 주세요.';
      if (!s.common.topicKnown) return '주제가 있는지 골라 주세요.';
      if (s.common.topicKnown === 'yes' && (s.common.title || '').trim().length < 4) return '연구 주제를 적어 주세요.';
      if (s.common.topicKnown === 'no' && !(s.common.keywords || []).length) return '관심 분야나 키워드를 적어 주세요.';
      return null;
    },
  },
  {
    id: 'mode', title: '무엇을 맡기시겠어요?', help: '처음이라면 설문지 작성부터 설문 결과·통계 해석까지 맡기기를 추천합니다.',
    render: (s) => {
      let out = choice('survey.mode', s.survey.mode, MODES.map((m) => { const it = findItem(CONFIG.catalog, m.code); return { v: m.v, t: m.t, d: m.d, badge: m.badge, side: it ? `${won(it.price)}부터` : '' }; }));
      if (s.survey.mode === 'full') out += note('<b>설문지 작성부터 설문 결과·통계 해석까지 범위</b><br>① 연구 목적에 맞는 설문지 작성과 척도 선정 ② 온라인 설문 제작과 참여 안내문 ③ 설문조사 진행과 응답 수집 관리(직접 수집 또는 모집 의뢰) ④ 설문 결과 정리(문항별 응답 결과 표·그래프)와 응답 데이터 정리·익명화 ⑤ 논문 맞춤 통계분석과 결과 해석 ⑥ 연구결과 정리. 응답자 모집을 맡기실 경우 모집 비용은 확정 견적 후 결제합니다.');
      return out;
    },
    valid: (s) => (s.survey.mode ? null : '의뢰 유형을 골라 주세요.'),
  },
  {
    id: 'materials', title: '가지고 계신 자료를 알려 주세요', help: '선택한 의뢰 유형에 필요한 자료만 표시됩니다.',
    render: (s) => {
      const m = s.survey.mode;
      let out = '';
      if (m === 'full' || m === 'new') {
        out += `<h3 class="sub-q">연구계획서가 있나요?</h3>${choice('survey.hasPlan', s.survey.hasPlan, [{ v: 'yes', t: '있어요' }, { v: 'no', t: '없어요, 논문AI가 설계해 주세요' }], { cols: 2 })}`;
        if (s.survey.hasPlan === 'yes') out += `<div class="cond">${uploader(s, 'proposal', { label: '연구계획서', required: true })}</div>`;
        out += `<h3 class="sub-q">참고할 기존 설문지가 있나요?</h3>${choice('survey.hasQuestionnaire', s.survey.hasQuestionnaire, [{ v: 'yes', t: '있어요' }, { v: 'no', t: '없어요' }], { cols: 2 })}`;
        if (s.survey.hasQuestionnaire === 'yes') out += `<div class="cond">${uploader(s, 'questionnaire', { label: '참고 설문지', required: true })}</div>`;
      }
      if (m === 'edit' || m === 'feedback') out += uploader(s, 'questionnaire', { label: '기존 설문지', required: true });
      if (m === 'feedback') out += `<div style="margin-top:14px">${uploader(s, 'feedback', { label: '교수님 피드백 파일' })}${textArea('survey.feedbackText', s.survey.feedbackText, { label: '또는 피드백을 붙여 넣기', rows: 5, hint: '파일과 붙여넣기 중 하나는 꼭 필요합니다.' })}<div id="fbLive">${fbHtml(s)}</div></div>`;
      if (m === 'analyze') out += `${uploader(s, 'data', { label: '실제 응답 데이터', required: true, hint: 'Excel, CSV, SPSS(sav) 파일' })}${uploader(s, 'questionnaire', { label: '사용한 설문지', hint: '함께 올리면 문항 묶음을 정확히 확인합니다' })}${note('이름, 연락처처럼 응답자를 알아볼 수 있는 열은 지운 뒤 올려 주세요.', 'amber')}`;
      return out || note('필요한 자료가 없습니다. 다음으로 넘어가세요.');
    },
    onInput: (t, s) => { if (t.dataset.path === 'survey.feedbackText') { const el = document.getElementById('fbLive'); if (el) el.innerHTML = fbHtml(s); } },
    valid: (s) => {
      const m = s.survey.mode;
      if (m === 'full' || m === 'new') {
        if (!s.survey.hasPlan) return '연구계획서가 있는지 골라 주세요.';
        if (s.survey.hasPlan === 'yes' && !hasSlot(s, 'proposal')) return '연구계획서 파일을 올려 주세요.';
        if (!s.survey.hasQuestionnaire) return '기존 설문지가 있는지 골라 주세요.';
        if (s.survey.hasQuestionnaire === 'yes' && !hasSlot(s, 'questionnaire')) return '참고 설문지 파일을 올려 주세요.';
      }
      if ((m === 'edit' || m === 'feedback') && !hasSlot(s, 'questionnaire')) return '기존 설문지 파일을 올려 주세요.';
      if (m === 'feedback' && !hasSlot(s, 'feedback') && !(s.survey.feedbackText || '').trim()) return '교수님 피드백을 파일로 올리거나 붙여 넣어 주세요.';
      if (m === 'analyze' && !hasSlot(s, 'data')) return '실제 응답 데이터 파일을 올려 주세요.';
      return null;
    },
  },
  {
    id: 'target', title: '누구에게 응답을 받나요?', help: '모르시면 연구 주제에 맞는 대상을 추천합니다.', when: needsTarget,
    render: (s) => `${choice('survey.target', s.survey.target, TARGETS.map(([v, t]) => ({ v, t, rec: v === 'auto' })), { cols: 2, compact: true })}${s.survey.target === 'other' ? `<div class="cond">${textField('survey.targetOther', s.survey.targetOther, { label: '응답 대상', placeholder: '예: 종합병원 간호사, 중학교 교사', required: true })}</div>` : ''}`,
    valid: (s) => (s.survey.target === 'other' && !(s.survey.targetOther || '').trim() ? '응답 대상을 적어 주세요.' : null),
  },
  {
    id: 'targetN', title: '몇 명에게 응답을 받을까요?', help: '모르셔도 됩니다. 분석 방법에 맞는 표본 수를 계산해 추천합니다.', when: needsTarget,
    render: (s) => {
      const p = plan(s);
      return `${choice('survey.targetN', s.survey.targetN, NS.map(([v, t]) => ({ v, t, rec: v === 'auto', d: v === 'auto' && p.recommendedN ? `지금 주제라면 ${p.recommendedN}명 이상을 추천합니다` : '' })), { cols: 2, compact: true })}
${s.survey.targetN === 'custom' ? `<div class="cond">${textField('survey.targetNCustom', s.survey.targetNCustom, { label: '목표 응답 수', type: 'number', inputmode: 'numeric', required: true })}</div>` : ''}
${note('응답 수는 대상과 모집 기간에 따라 달라지므로 특정 인원 확보를 미리 보장하지 않습니다. 진행 현황은 주문 페이지에서 확인할 수 있습니다.')}`;
    },
    valid: (s) => (s.survey.targetN === 'custom' && !(Number(s.survey.targetNCustom) > 0) ? '목표 응답 수를 숫자로 적어 주세요.' : null),
  },
  {
    id: 'recruit', title: '응답은 어떻게 모을까요?', help: '응답자 모집까지 맡기시면 조건을 확인해 별도 견적을 드립니다.', when: needsRecruitQ,
    render: (s) => `${choice('survey.recruit', s.survey.recruit, [
      { v: 'us', t: '응답자 모집·배포까지 의뢰', d: '모집 경로, 일정, 표본, 동의 절차를 확인해 확정 견적을 드립니다' },
      { v: 'self', t: '내가 직접 응답을 모을게요', d: '배포용 링크와 참여 안내문을 드립니다' },
      { v: 'none', t: '설문지만 필요해요', d: '응답 수집은 진행하지 않습니다' },
    ])}${s.survey.recruit === 'us' ? note('<b>모집 의뢰 전에 함께 확인합니다</b><br>모집 경로(온라인 패널, 커뮤니티, 기관 협조), 일정, 목표 표본, 응답자 동의와 개인정보 처리 방법, IRB 심의 필요 여부, 응답자 사례비 등 모집 비용. 확정 견적을 확인하기 전에는 결제하지 않습니다.', 'amber') : ''}`,
    valid: (s) => (s.survey.recruit ? null : '응답 수집 방법을 골라 주세요.'),
  },
  {
    id: 'analysis', title: '어떤 분석이 필요하세요?', help: '모르시면 연구 가설에 맞는 분석을 추천합니다.', when: needsAnalysis,
    render: (s) => choice('survey.analysis', s.survey.analysis, [
      { v: 'auto', t: '잘 모르겠어요 (추천)', d: '주제에 맞는 분석을 추천합니다', rec: true },
      { v: 'basic', t: '기초 통계', d: '응답 분포, 평균·표준편차, 신뢰도' },
      { v: 'relation', t: '관계·차이 분석', d: '상관, t검정·분산분석, 회귀분석' },
      // 심화 분석 가산은 '모은 응답 분석'에만 붙는다(처음부터 끝까지는 기본 금액에 포함)
      { v: 'advanced', t: '심화 분석', d: '매개·조절효과(PROCESS), 필요 시 구조방정식', side: s.survey.mode === 'analyze' ? `+${won((findItem(CONFIG.catalog, 'T-ADV') || {}).price || 0)}` : '' },
    ]),
    valid: () => null,
  },
  {
    id: 'deliver', title: '받으실 결과물과 일정입니다', help: '선택하신 범위에 맞게 결과물이 자동으로 정해졌습니다.',
    render: (s) => `<ul class="chk chk-lg">${deliverables(s).map((d) => `<li class="ok">${ICON.check}<span>${esc(d)}</span></li>`).join('')}</ul>
<h3 class="sub-q">희망 완료일</h3><div class="row-2">${textField('common.due', s.common.due, { type: 'date', label: '희망일 (선택)' })}</div>
<h3 class="sub-q">추가 옵션</h3>${extraAddonsHtml(s)}
${textArea('common.request', s.common.request, { label: '요청 사항 (선택)', rows: 4, placeholder: '예: 문항 수는 50개 이내로 해 주세요.' })}`,
    bind: (el) => { const d = el.querySelector('input[type=date]'); if (d) d.min = deadlineMin(); },
    valid: () => null,
  },
  {
    ...contactStep(),
    render: (s) => contactStep().render(s) + `<p class="consent-note">사람을 대상으로 하는 조사라 응답자 동의를 받고 응답 데이터는 익명화합니다. 소속 기관의 IRB 심의가 필요한지는 함께 확인해 드립니다.</p>`,
    valid: (s) => contactStep().valid(s),
  },
  {
    id: 'review', title: '주문 내용을 확인해 주세요', help: '견적형 주문은 확정 견적을 받은 뒤 결제합니다.',
    render: (s, ctx) => {
      const q = computeQuote(CONFIG.catalog, quoteInput(s));
      const p = plan(s);
      const mode = MODES.find((m) => m.v === s.survey.mode);
      const rows = [
        ['purpose', '목적', (PURPOSES.find((x) => x[0] === s.common.purpose) || [])[1]],
        ['topic', '주제', s.common.topicKnown === 'yes' ? s.common.title : `설계 요청 (${(s.common.keywords || []).join(', ')})`],
        ['mode', '의뢰 유형', mode ? mode.t : '-'],
        ['materials', '올린 자료', (s.files || []).length ? `${s.files.length}개 파일` : '없음'],
      ];
      if (needsTarget(s)) rows.push(['target', '응답 대상', s.survey.target === 'other' ? s.survey.targetOther : (TARGETS.find((t) => t[0] === s.survey.target) || [])[1]], ['targetN', '목표 응답 수', s.survey.targetN === 'custom' ? `${s.survey.targetNCustom}명` : (NS.find((n) => n[0] === s.survey.targetN) || [])[1]]);
      if (needsRecruitQ(s)) rows.push(['recruit', '응답 수집', { us: '모집·배포 의뢰(견적)', self: '직접 수집', none: '설문지만' }[s.survey.recruit]]);
      if (needsAnalysis(s)) rows.push(['analysis', '분석', { auto: '추천받기', basic: '기초 통계', relation: '관계·차이 분석', advanced: '심화 분석' }[s.survey.analysis]]);
      return `${reviewSummary(s, ctx, rows)}<div class="rv-block"><h3 class="sub-q">견적</h3><div class="sheet rv-price">${priceLinesHtml(q)}${etaHtml(q, CONFIG.settings)}</div></div>
<div class="rv-block"><h3 class="sub-q">설문 구성 미리보기</h3><div class="sheet report">${planHtml(p)}</div></div>`;
    },
    submitLabel: (s) => (computeQuote(CONFIG.catalog, quoteInput(s)).quoteRequired ? '견적 요청하기' : '주문서 제출하기'),
    valid: () => null,
  },
];

function fbHtml(s) {
  const r = classifyFeedback(s.survey.feedbackText || '');
  return r.count ? `<div class="auto-card"><div class="auto-hd">${ICON.spark}<b>피드백 ${r.count}개 항목</b><span class="muted">${Object.entries(r.counts).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}</span></div></div>` : '';
}

function planHtml(p) {
  return `<div class="rp-sec" style="padding-top:0"><h3 class="rp-h">설문 구성 <span class="muted rp-sub">약 ${p.totalItems}문항 · 응답 시간 약 ${p.minutes}분</span></h3><div class="table-wrap"><table class="rp-table"><thead><tr><th>구성</th><th>문항 수</th><th>내용</th></tr></thead><tbody>${p.sections.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${x.items}</td><td>${esc(x.note)}</td></tr>`).join('')}</tbody></table></div></div>
<div class="rp-sec rp-two"><div><h3 class="rp-h">표본</h3><p class="rp-sample">${esc(p.nLabel)}</p><p class="rp-foot">${esc(p.targetLabel)} 대상</p></div><div><h3 class="rp-h">분석 계획</h3><ol class="rp-list">${p.analyses.map((a) => `<li>${esc(a)}</li>`).join('')}</ol></div></div>`;
}

function live() {
  const el = document.getElementById('parseLive');
  if (!el || !CUR) return;
  const s = CUR.state;
  if ((s.common.title || '').trim().length < 4) { el.innerHTML = ''; return; }
  const p = plan(s);
  el.innerHTML = `<div class="auto-card"><div class="auto-hd">${ICON.spark}<b>측정할 변인</b><span class="muted">${esc(p.design.designLabel)}</span></div><div class="demo-read">${readLineHtml(p.design)}</div></div>`;
}

function sidePanel(s) {
  const q = s.survey.mode ? computeQuote(CONFIG.catalog, quoteInput(s)) : null;
  const p = (s.common.title || (s.common.keywords || []).length) ? plan(s) : null;
  const tags = [(PURPOSES.find((x) => x[0] === s.common.purpose) || [])[1], (FIELDS.find((f) => f.id === s.common.fieldId) || {}).label, (MODES.find((m) => m.v === s.survey.mode) || {}).t].filter(Boolean);
  const req = [];
  if (['edit', 'feedback'].includes(s.survey.mode)) req.push(['기존 설문지', hasSlot(s, 'questionnaire')]);
  if (s.survey.mode === 'feedback') req.push(['교수님 피드백', hasSlot(s, 'feedback') || !!(s.survey.feedbackText || '').trim()]);
  if (s.survey.mode === 'analyze') req.push(['응답 데이터', hasSlot(s, 'data')]);
  return sideShell({
    tags,
    price: q ? priceLinesHtml(q, { compact: true }) + etaHtml(q, CONFIG.settings) : '<p class="muted small">의뢰 유형을 고르면 금액이 계산됩니다.</p>',
    checklist: quickChecklist(s, req),
    design: p ? `<div class="side-sec"><h3>설문 구성 미리보기</h3><p class="small"><b>약 ${p.totalItems}문항</b> · 응답 약 ${p.minutes}분 · 표본 ${esc(p.nLabel)}</p><ul class="chk">${p.sections.slice(1, -1).map((x) => `<li class="ok">${ICON.check}<span>${esc(x.name)} ${x.items}문항</span></li>`).join('')}</ul></div>` : '<div class="side-sec"><h3>설문 구성 미리보기</h3><p class="small muted">주제를 입력하면 측정할 변인과 문항 구성이 나타납니다.</p></div>',
  });
}

function mobileSummary(s) {
  if (!s.survey.mode) return '<span class="mb-price muted">유형을 고르면 금액이 나옵니다</span>';
  const q = computeQuote(CONFIG.catalog, quoteInput(s));
  return `<span class="mb-price"><b class="num">${won(q.total)}</b><small>${q.quoteRequired ? '견적 후 확정' : `기본 납기 ${q.days}일`}</small></span>`;
}

let CUR = null;
export async function startSurveyWizard(root) {
  // 서버 설정을 기다리지 않고 바로 그린 뒤, 설정이 오면 견적만 다시 계산한다
  CONFIG = peekConfig();
  const params = new URLSearchParams(location.search);
  CUR = createWizard({
    root, key: 'survey', title: '설문조사 의뢰하기', steps, defaults, sidePanel, mobileSummary, settings: () => CONFIG.settings || {},
    prefill: (s) => { if (params.get('title')) { s.common.topicKnown = 'yes'; s.common.title = params.get('title').slice(0, 200); } if (params.get('mode')) s.survey.mode = params.get('mode'); },
    onSubmit: (s) => submitOrder({ service: 'survey', state: s, input: toInput(s), design: (() => { const p = plan(s); return { title: s.common.title || (s.common.keywords || []).join(', '), designLabel: p.design.designLabel, methodLabel: '설문조사', population: p.design.parsed.population, sampleText: p.nLabel, vars: {}, hypotheses: [], titleCandidates: [] }; })(), quote: computeQuote(CONFIG.catalog, quoteInput(s)), draftKey: 'draft:survey' }),
  });
  loadConfig().then((c) => { if (c && c.catalog) { CONFIG = c; CUR.refreshSide(); } });
}
