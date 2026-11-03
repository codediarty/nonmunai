// 논문 의뢰 신청서
import { createWizard, choice, textField, textArea, selectField, uploader, note, hasSlot, submitOrder, priceLinesHtml, ICON } from './wizard.js';
import { contactStep, reviewSummary, etaHtml, sideShell, deadlineMin, quickChecklist } from './common-steps.js';
import { loadConfig, peekConfig } from './api.js';
import { buildDesign, suggestTitles } from '../core/engine.js';
import { PAPER_TYPES, FIELDS } from '../core/kb.js';
import { computeQuote, findItem, paperItemCode } from '../core/pricing.js';
import { renderModelSVG } from '../core/model-svg.js';
import { readLineHtml, factsHtml, esc, won } from '../core/render.js';
import { classifyFeedback } from '../core/feedback.js';
import { analyzeDocument } from '../core/diagnose-doc.js';
import { designReportHtml, designSnapshot } from '../ui/report.js';
import { $, toast } from '../ui/dom.js';
// 가격표 분량 단위 '쪽'은 화면에서 'Page'로 보여 준다
const UL = (l) => (l === '쪽' ? ' Page' : (l || ''));

const TASKS = [
  { v: 'full', t: '논문 완성', d: '주제·설계부터 장별 본문까지 완성해 드려요. 기존 자료가 있으면 함께 올려 주세요.' },
  { v: 'edit', t: '논문 첨삭·교정', d: '이미 쓴 원고의 문장·논리·형식을 다듬습니다. 원고가 필요합니다.' },
  { v: 'feedback', t: '교수님 피드백 반영', d: '피드백을 항목별로 반영하고 수정 대조표를 작성하며, 반영 부분은 파란색으로 표시합니다. 원고와 피드백이 필요합니다.' },
  { v: 'proposal', t: '연구계획서 작성', d: '본 논문 전에 연구 목적·방법·분석 계획을 먼저 세웁니다.' },
];
const PROPOSAL_TYPES = ['master', 'doctor', 'bachelor'];

const defaults = {
  v: 1, service: 'paper',
  common: { fieldId: '', fieldText: '', school: '', dept: '', topicKnown: '', title: '', keywords: [], keywordsText: '', method: 'auto', due: '', outputFormat: 'docx', request: '' },
  paper: { typeId: '', task: '', hasToc: '', tocText: '', hasFormat: '', formatName: '', pagesMode: 'base', pages: null, feedbackText: '', editScope: '' },
  addons: { priority: false, format: false, revisions: 0, ppt: false, english: false, editing: false },
  files: [], links: [], contact: { name: '', email: '', phone: '' }, pin: '', consents: { privacy: true, ethics: true, withdrawal: true, marketing: false }, hp: '', docInfo: null,
};

let CONFIG = { catalog: null, settings: {} };

function design(s) {
  const c = s.common;
  const hasTopic = (c.title && c.title.trim().length >= 4) || (c.keywords && c.keywords.length);
  if (!hasTopic) return null;
  return buildDesign({ title: c.title, keywords: c.keywords, typeId: s.paper.typeId || 'master', fieldId: c.fieldId || 'other', fieldText: c.fieldText, method: c.method, due: c.due || null });
}

function quoteInput(s, d) {
  const p = s.paper;
  const fb = p.task === 'feedback' && p.feedbackText ? classifyFeedback(p.feedbackText).count : null;
  const pages = p.pagesMode === 'custom' && p.pages ? Number(p.pages) : p.pagesMode === 'base' ? (findItem(CONFIG.catalog, paperItemCode(p.typeId || 'master', p.task || 'full')) || {}).baseUnits || null : null;
  return {
    service: 'paper',
    paper: { typeId: p.typeId || 'master', task: p.task || 'full', pages, feedbackItems: fb, needsData: !!(d && d.method === 'survey' && p.task === 'full') },
    addons: {
      priority: s.addons.priority, format: s.addons.format, revisions: Number(s.addons.revisions || 0),
      ppt: !!s.addons.ppt, english: !!s.addons.english && (p.task || 'full') === 'full', editing: !!s.addons.editing && p.task === 'feedback',
    },
  };
}

function toInput(s, d) {
  const q = quoteInput(s, d);
  return {
    common: { ...s.common, keywords: s.common.keywords || [] },
    paper: { ...s.paper, pages: q.paper.pages, feedbackItems: q.paper.feedbackItems, needsData: q.paper.needsData },
    addons: q.addons,
  };
}

function baseItem(s) { return findItem(CONFIG.catalog, paperItemCode(s.paper.typeId || 'master', s.paper.task || 'full')); }

const steps = [
  {
    id: 'type', title: '어떤 논문을 준비하고 계신가요?', help: '논문 유형에 따라 목차 구성과 기준 분량, 가격이 달라집니다.',
    render: (s) => choice('paper.typeId', s.paper.typeId, PAPER_TYPES.map((t) => ({ v: t.id, t: t.label, side: `${t.pages} Page 내외` }))),
    valid: (s) => (s.paper.typeId ? null : '논문 유형을 골라 주세요.'),
  },
  {
    id: 'field', title: '전공이나 관심 분야를 알려 주세요', help: '분야에 맞는 연구 대상과 변인, 분석 방법을 추천하는 데 씁니다.',
    render: (s) => `${choice('common.fieldId', s.common.fieldId, FIELDS.map((f) => ({ v: f.id, t: f.label, d: f.hint })), { cols: 3, compact: true })}
<div class="row-2" style="margin-top:20px">${textField('common.fieldText', s.common.fieldText, { label: '전공·학과명', placeholder: '예: 간호학과, 상담심리학' })}
${['master', 'doctor', 'bachelor'].includes(s.paper.typeId) ? textField('common.school', s.common.school, { label: '학교 이름', placeholder: '예: 성균관대학교 (선택)' }) : s.paper.typeId === 'journal' ? textField('common.school', s.common.school, { label: '투고 예정 학술지', placeholder: '정해졌다면 적어 주세요 (선택)' }) : ''}</div>`,
    valid: (s) => (s.common.fieldId || s.common.fieldText.trim() ? null : '전공 분야를 고르거나 전공명을 적어 주세요.'),
  },
  {
    id: 'topic', title: '연구 주제가 정해져 있나요?', help: '정하지 못했다면 관심 키워드만 적어 주세요. 추천 주제를 만들어 드립니다.',
    render: (s) => {
      let out = choice('common.topicKnown', s.common.topicKnown, [{ v: 'yes', t: '있어요', d: '제목이나 주제 문장을 적어 주세요' }, { v: 'no', t: '잘 모르겠어요', d: '관심 키워드로 추천 주제를 받아요' }], { cols: 2 });
      if (s.common.topicKnown === 'yes') {
        out += `<div style="margin-top:20px">${textArea('common.title', s.common.title, { label: '논문 제목 또는 주제', placeholder: '예: 간호사의 직무스트레스와 회복탄력성이 이직의도에 미치는 영향', rows: 3, max: 200, required: true, cls: 'serif-in' })}<div class="parse-live" id="parseLive"></div></div>`;
      } else if (s.common.topicKnown === 'no') {
        out += `<div style="margin-top:20px">${textField('common.keywordsText', s.common.keywordsText, { label: '관심 키워드', placeholder: '예: 직무스트레스, 회복탄력성', hint: '쉼표로 1~3개를 적으면 아래에 추천 주제가 나타납니다. 마음에 드는 주제를 고르거나, 고르지 않으면 담당 연구진이 함께 정합니다.' })}<div id="suggestLive"></div></div>`;
      }
      return out;
    },
    bind: (el, s, ctx) => { liveTopic(el, s, ctx); },
    onInput: (t, s, ctx) => {
      if (t.dataset.path === 'common.keywordsText') s.common.keywords = t.value.split(/[,，、\n]+/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
      liveTopic(document, s, ctx);
    },
    onChoice: (path, v, s) => { if (path === 'common.topicKnown' && v === 'yes' && s.common.chosenFromSuggest) { s.common.title = ''; s.common.chosenFromSuggest = false; } },
    valid: (s) => {
      if (!s.common.topicKnown) return '주제가 있는지 골라 주세요.';
      if (s.common.topicKnown === 'yes' && (s.common.title || '').trim().length < 4) return '제목이나 주제를 조금 더 구체적으로 적어 주세요.';
      if (s.common.topicKnown === 'no' && !(s.common.keywords || []).length) return '관심 키워드를 하나 이상 적어 주세요.';
      return null;
    },
  },
  {
    id: 'toc', title: '목차가 있나요?', help: '학교나 지도교수가 정해 준 목차가 있다면 그대로 따릅니다.',
    render: (s) => `${choice('paper.hasToc', s.paper.hasToc, [{ v: 'yes', t: '있어요', d: '파일로 올리거나 직접 적어 주세요' }, { v: 'no', t: '없어요 (주제에 맞게 정해 주세요)', d: '논문 유형과 연구방법에 맞는 표준 목차로 구성합니다' }], { cols: 2 })}
${s.paper.hasToc === 'yes' ? `<div class="cond">${uploader(s, 'toc', { label: '목차 파일', hint: 'Word, 한글, PDF, 사진 모두 됩니다' })}${textArea('paper.tocText', s.paper.tocText, { label: '또는 목차를 직접 입력', placeholder: '제1장 서론\n  1. 연구의 필요성 ...', rows: 6 })}</div>` : ''}`,
    valid: (s) => {
      if (!s.paper.hasToc) return '목차가 있는지 골라 주세요.';
      if (s.paper.hasToc === 'yes' && !hasSlot(s, 'toc') && !(s.paper.tocText || '').trim()) return '목차 파일을 올리거나 목차를 직접 입력해 주세요.';
      return null;
    },
  },
  {
    id: 'format', title: '학교·학술지 양식이 있나요?', help: '양식이 있으면 여백, 글꼴, 제목 위계, 표 형식을 그대로 맞춥니다.',
    render: (s) => `${choice('paper.hasFormat', s.paper.hasFormat, [{ v: 'yes', t: '있어요', d: '양식 파일과 학교·학술지 이름을 알려 주세요' }, { v: 'no', t: '잘 모르겠어요 (일반적인 논문 양식으로 해 주세요)', d: '일반적인 학위논문 양식으로 작성하고 나중에 맞출 수 있습니다' }], { cols: 2 })}
${s.paper.hasFormat === 'yes' ? `<div class="cond">${textField('paper.formatName', s.paper.formatName, { label: '학교·학술지 이름', placeholder: '예: ○○대학교 대학원 학위논문 작성 지침', required: true })}${uploader(s, 'format', { label: '양식 파일', required: true, hint: '작성 지침, 서식 파일(hwp, docx), PDF 모두 됩니다' })}</div>` : ''}`,
    valid: (s) => {
      if (!s.paper.hasFormat) return '양식이 있는지 골라 주세요.';
      if (s.paper.hasFormat === 'yes') {
        if (!(s.paper.formatName || '').trim()) return '학교 또는 학술지 이름을 적어 주세요.';
        if (!hasSlot(s, 'format')) return '양식 파일을 올려 주세요.';
      }
      return null;
    },
  },
  {
    id: 'method', title: '어떤 연구방법을 생각하세요?', help: '모르시면 그대로 두세요. 주제 구조를 분석해 맞는 방법을 추천합니다.',
    render: (s) => {
      const d = design(s);
      const rec = d ? `${d.methodLabel} · ${d.designLabel}` : '';
      return `${choice('common.method', s.common.method, [
        { v: 'auto', t: '잘 모르겠어요 (추천해 주세요)', d: rec ? `지금 주제라면 ${rec}을(를) 추천합니다` : '주제에 맞는 방법을 추천합니다', rec: true },
        { v: 'literature', t: '문헌연구·선행연구 분석', d: '자료 수집 없이 선행연구를 체계적으로 정리합니다' },
        { v: 'survey', t: '설문·통계', d: '설문으로 자료를 모아 변인 간 관계를 검증합니다' },
        { v: 'qualitative', t: '면담·사례', d: '심층면담이나 사례로 경험과 의미를 탐구합니다' },
        { v: 'experiment', t: '실험·기술', d: '프로그램 효과, 실험, 시스템 개발을 다룹니다' },
        { v: 'other', t: '기타', d: '혼합연구, 정책 분석 등은 요청 사항에 적어 주세요' },
      ])}`;
    },
    valid: () => null,
  },
  {
    id: 'task', title: '어떤 작업이 필요하세요?', help: '선택에 따라 필요한 자료 칸이 바뀝니다.',
    render: (s) => {
      const tasks = TASKS.filter((t) => (t.v !== 'proposal' || PROPOSAL_TYPES.includes(s.paper.typeId)) && findItem(CONFIG.catalog, paperItemCode(s.paper.typeId || 'master', t.v))).map((t) => {
        const it = findItem(CONFIG.catalog, paperItemCode(s.paper.typeId || 'master', t.v));
        return { ...t, side: it ? `${won(it.price)}부터` : '' };
      });
      let out = choice('paper.task', s.paper.task, tasks);
      const t = s.paper.task;
      if (t === 'full' || t === 'proposal') {
        out += `<div class="cond">${uploader(s, 'materials', { label: '기존 자료', hint: '연구계획서, 선행연구, 메모, 설문지 등 있는 자료를 모두 올려 주세요' })}</div>`;
      } else if (t === 'edit') {
        out += `<div class="cond">${uploader(s, 'manuscript', { label: '기존 원고', required: true, hint: 'Word·한글 파일을 권장합니다. 올리면 분량을 자동으로 계산합니다' })}<div id="docInfo">${docInfoHtml(s)}</div>${textArea('paper.editScope', s.paper.editScope, { label: '수정할 부분', required: true, rows: 3, placeholder: '예: 2장 이론적 배경 전체와 5장 논의의 문장 다듬기, 표 형식 통일' })}</div>`;
      } else if (t === 'feedback') {
        out += `<div class="cond">${uploader(s, 'manuscript', { label: '기존 원고', required: true })}<div id="docInfo">${docInfoHtml(s)}</div>${uploader(s, 'feedback', { label: '교수님 피드백 파일', hint: '메모가 적힌 원고, 메일 캡처, 사진 모두 됩니다' })}${textArea('paper.feedbackText', s.paper.feedbackText, { label: '또는 피드백을 붙여 넣기', rows: 5, placeholder: '1. 연구의 필요성에 최근 자료를 보완할 것\n2. 통제변수 선정 근거를 추가할 것', hint: '붙여 넣으면 항목별로 자동 분류해 가격에 반영합니다. 파일과 붙여넣기 중 하나는 꼭 필요합니다.' })}<div id="fbLive">${feedbackHtml(s)}</div></div>`;
      }
      return out;
    },
    onInput: (t, s) => {
      if (t.dataset.path === 'paper.feedbackText') { const el = document.getElementById('fbLive'); if (el) el.innerHTML = feedbackHtml(s); }
    },
    valid: (s) => {
      const t = s.paper.task;
      if (!t) return '필요한 작업을 골라 주세요.';
      if (!findItem(CONFIG.catalog, paperItemCode(s.paper.typeId || 'master', t))) return '이 논문 유형에서 고를 수 있는 작업을 골라 주세요.';
      if ((t === 'edit' || t === 'feedback') && !hasSlot(s, 'manuscript')) return '기존 원고 파일을 올려 주세요.';
      if (t === 'edit' && !(s.paper.editScope || '').trim()) return '수정할 부분을 적어 주세요. 전체라면 "전체"라고 적어 주세요.';
      if (t === 'feedback' && !hasSlot(s, 'feedback') && !(s.paper.feedbackText || '').trim()) return '교수님 피드백을 파일로 올리거나 붙여 넣어 주세요.';
      return null;
    },
  },
  {
    id: 'volume', title: '분량과 일정을 정해 주세요', help: '모르는 항목은 그대로 두셔도 됩니다.',
    render: (s) => {
      const it = baseItem(s);
      const base = it && it.baseUnits ? `${it.baseUnits}${UL(it.unitLabel)}` : '기준 분량';
      const unitIsItem = it && it.unitLabel === '항목';
      const opts = unitIsItem
        ? [{ v: 'base', t: `기준 범위 이내 (${base})`, d: '붙여 넣은 피드백이 있으면 항목 수로 자동 계산합니다' }, { v: 'unknown', t: '잘 모르겠어요', d: '확인 후 초과분이 있을 때만 안내합니다' }]
        : [{ v: 'base', t: `기준 분량 이내 (${base})`, d: '대부분의 경우 여기에 해당합니다' }, { v: 'custom', t: '분량을 알고 있어요', d: '분량(Page)을 적으면 추가 분량이 바로 계산돼요' }, { v: 'unknown', t: '잘 모르겠어요', d: '기준 분량으로 먼저 진행하고 초과분만 나중에 안내합니다' }];
      return `<h3 class="sub-q">분량</h3>${choice('paper.pagesMode', s.paper.pagesMode, opts, { cols: unitIsItem ? 2 : 3, compact: true })}
${s.paper.pagesMode === 'custom' ? `<div class="cond row-2">${textField('paper.pages', s.paper.pages ?? '', { label: '예상 분량(Page)', type: 'number', inputmode: 'numeric', placeholder: it ? String(it.baseUnits) : '80', hint: it && it.unitPrice ? `기준 ${base}를 넘는 부분은 ${it.unitSize}${UL(it.unitLabel)}마다 ${won(it.unitPrice)}이 더해져요.` : '' })}</div>` : ''}
<h3 class="sub-q">희망 완료일과 결과 파일</h3>
<div class="row-2">${textField('common.due', s.common.due, { label: '희망 완료일 (선택)', type: 'date', hint: '심사·제출 일정이 있다면 알려 주세요. 연구 전체 일정표에 반영됩니다.' })}${selectField('common.outputFormat', s.common.outputFormat, [{ v: 'docx', t: 'Word (docx)' }, { v: 'hwp', t: '한글 (hwp)' }, { v: 'pdf', t: 'PDF' }], { label: '결과 파일 형식' })}</div>
<h3 class="sub-q">추가 옵션</h3>${addonsHtml(s)}`;
    },
    bind: (el) => { const d = el.querySelector('input[type=date]'); if (d) d.min = deadlineMin(); },
    valid: (s) => {
      if (s.paper.pagesMode === 'custom' && !(Number(s.paper.pages) > 0)) return '예상 분량(Page)을 숫자로 적어 주세요.';
      return null;
    },
  },
  {
    id: 'request', title: '더 알려 주실 내용이 있나요?', help: '지도교수 요청, 꼭 넣어야 할 내용, 피하고 싶은 표현 등 무엇이든 적어 주세요. 없으면 넘어가셔도 됩니다.', autofocus: true,
    render: (s) => `${textArea('common.request', s.common.request, { label: '요청 사항 (선택)', rows: 6, placeholder: '예: 선행연구는 최근 5년 국내 논문 위주로 부탁드립니다.' })}${uploader(s, 'other', { label: '그 밖의 참고 파일' })}`,
    valid: () => null,
  },
  contactStep(),
  {
    id: 'review', title: '주문 내용을 확인해 주세요', help: '제출 후 결제가 확인되면 작업 순서에 배정됩니다. 견적형 주문은 확정 견적을 받은 뒤 결제합니다.',
    render: (s, ctx) => {
      const d = design(s);
      const q = computeQuote(CONFIG.catalog, quoteInput(s, d));
      return `${reviewSummary(s, ctx, summaryRows(s))}
<div class="rv-block"><h3 class="sub-q">견적</h3><div class="sheet rv-price">${priceLinesHtml(q)}${etaHtml(q, CONFIG.settings)}</div>
<div class="inc-grid rv-inc"><div class="inc inc-yes"><h3>포함</h3><ul>${(q.includes || []).map((x) => `<li>${ICON.check}<span>${esc(x)}</span></li>`).join('')}</ul></div><div class="inc inc-no"><h3>포함되지 않음</h3><ul>${(q.excludes && q.excludes.length ? q.excludes : ['실제 데이터 수집(설문 응답자 모집)', '통계분석(별도 상품)', '학교 제출·업로드 대행']).map((x) => `<li>${ICON.x}<span>${esc(x)}</span></li>`).join('')}</ul></div></div></div>
${d ? `<div class="rv-block"><h3 class="sub-q">자동 연구 설계 리포트</h3><p class="hint" style="margin-bottom:12px">입력하신 주제로 계산한 설계입니다. 작업 준비 단계에서 연구진이 확인해 확정합니다.</p><div class="sheet">${designReportHtml(d, { compactModel: false })}</div></div>` : ''}`;
    },
    submitLabel: (s) => (computeQuote(CONFIG.catalog, quoteInput(s, design(s))).quoteRequired ? '견적 요청하기' : '주문서 제출하기'),
    valid: () => null,
  },
];

function addonsHtml(s) {
  const cat = CONFIG.catalog;
  const pr = findItem(cat, 'A-PRIORITY'), fm = findItem(cat, 'A-FORMAT'), rv = findItem(cat, 'A-REVISION');
  const ppt = findItem(cat, 'A-PPT'), en = findItem(cat, 'A-ENGLISH');
  const task = s.paper.task || 'full';
  const ed = task === 'feedback' ? findItem(cat, paperItemCode(s.paper.typeId || 'master', 'edit')) : null;
  const main = baseItem(s);
  const enPages = Math.max((main && main.baseUnits) || 0, Number(quoteInput(s, null).paper.pages) || 0);
  const enBlocks = en ? Math.max(1, Math.ceil(enPages / (Number(en.unitSize) || 10))) : 0;
  const prOff = CONFIG.settings && String(CONFIG.settings.priorityEnabled) === 'false';
  const box = (key, title, price, desc, extra = '') => `<label class="check addon${extra}"><input type="checkbox" data-bool="addons.${key}"${s.addons[key] ? ' checked' : ''}${extra.includes('is-off') ? ' disabled' : ''}><span><b>${title} <em class="num">+${won(price)}</em></b><small>${desc}</small></span></label>`;
  return `<div class="addons">
${ppt ? box('ppt', '심사 발표 PPT 제작', ppt.price, '논문 핵심을 담은 발표 자료 15~20장과 장표별 발표 스크립트를 함께 드립니다.') : ''}
${en && task === 'full' ? box('english', '영문 논문 작성', en.unitPrice * enBlocks, `원고를 학술 영어로 작성해 드려요. ${en.unitSize} Page마다 ${won(en.unitPrice)}, 지금 분량 기준 ${enBlocks}단위입니다.`) : ''}
${ed ? box('editing', '논문 전체 첨삭·교정', ed.price, `피드백 반영과 함께 원고 전체의 문장·논리를 다듬습니다(기준 ${ed.baseUnits}${ed.unitLabel}).`) : ''}
${fm ? box('format', '학교·학술지 양식 상세 적용', fm.price, '여백, 글꼴, 제목 위계, 표·그림 서식, 목차 서식까지 제출 양식에 맞춥니다.') : ''}
${pr ? box('priority', '우선 처리', pr.price, prOff ? '현재 작업 일정상 우선 처리를 받을 수 없습니다.' : '작업 순서를 앞당겨 기본 납기를 줄입니다. 일정상 가능한 경우에만 선택할 수 있습니다.', prOff ? ' is-off' : '') : ''}
${rv ? `<div class="addon addon-row"><span><b>추가 수정</b><small>기본 포함 수정 외에 1회 ${won(rv.price)}씩 더할 수 있습니다.</small></span>${selectField('addons.revisions', s.addons.revisions, [{ v: 0, t: '추가 안 함' }, { v: 1, t: '1회 추가' }, { v: 2, t: '2회 추가' }])}</div>` : ''}
</div>`;
}

function docInfoHtml(s) {
  const i = s.docInfo;
  if (!i) return '';
  if (!i.ok) return `<p class="hint doc-info">${esc(i.message || '')}</p>`;
  const it = baseItem(s);
  return `<div class="auto-card"><div class="auto-hd">${ICON.spark}<b>원고 자동 분석</b><span class="muted">${esc(i.name || '')}</span></div><dl class="auto-dl"><div><dt>예상 분량</dt><dd>약 ${i.pages} Page</dd></div>${i.withSpaces ? `<div><dt>글자 수</dt><dd>${i.withSpaces.toLocaleString('ko-KR')}자</dd></div>` : ''}${i.chapters && i.chapters.length ? `<div><dt>장 구성</dt><dd>${i.chapters.length}개 장</dd></div>` : ''}${i.references ? `<div><dt>참고문헌</dt><dd>${i.references}건</dd></div>` : ''}${i.citeStyle ? `<div><dt>인용 형식</dt><dd>${esc(i.citeStyle)}</dd></div>` : ''}</dl>${it && it.unitLabel === '쪽' ? `<button type="button" class="btn btn-soft btn-sm" id="usePages">이 분량(약 ${i.pages}쪽)으로 견적 계산</button>` : ''}<p class="hint">쪽수는 한 쪽에 약 1,600자를 기준으로 추정했습니다. 최종 분량은 담당자가 확인합니다.</p></div>`;
}

function feedbackHtml(s) {
  const r = classifyFeedback(s.paper.feedbackText || '');
  if (!r.count) return '';
  const it = baseItem(s);
  const extra = it && it.unitLabel === '항목' && r.count > it.baseUnits ? ` · 기준 ${it.baseUnits}항목을 넘는 ${r.count - it.baseUnits}항목은 추가 금액이 계산됩니다` : '';
  return `<div class="auto-card"><div class="auto-hd">${ICON.spark}<b>피드백 ${r.count}개 항목으로 분류</b><span class="muted">${Object.entries(r.counts).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}${extra}</span></div><ol class="fb-items">${r.items.slice(0, 12).map((i) => `<li><em class="fb-cat">${esc(i.category)}</em><span>${esc(i.text)}</span></li>`).join('')}</ol>${r.count > 12 ? `<p class="hint">외 ${r.count - 12}개 항목</p>` : ''}</div>`;
}

function liveTopic(scope, s, ctx) {
  const pl = document.getElementById('parseLive');
  if (pl && s.common.topicKnown === 'yes') {
    const t = (s.common.title || '').trim();
    if (t.length < 4) { pl.innerHTML = ''; return; }
    const d = buildDesign({ title: t, typeId: s.paper.typeId || 'master', fieldId: s.common.fieldId || 'other' });
    pl.innerHTML = `<div class="auto-card"><div class="auto-hd">${ICON.spark}<b>주제 구조를 이렇게 이해했어요</b><span class="muted">${esc(d.designLabel)}</span></div><div class="demo-read">${readLineHtml(d)}</div></div>`;
  }
  const sl = document.getElementById('suggestLive');
  if (sl && s.common.topicKnown === 'no') {
    const kws = s.common.keywords || [];
    if (!kws.length) { sl.innerHTML = ''; return; }
    const list = suggestTitles({ keywords: kws, fieldId: s.common.fieldId || 'other', method: s.common.method || 'auto', population: '' });
    sl.innerHTML = `<div class="auto-card"><div class="auto-hd">${ICON.spark}<b>추천 주제</b><span class="muted">하나를 고르면 그 주제로 설계합니다</span></div><ol class="rp-cands">${list.map((c) => `<li><button type="button" class="rp-cand${s.common.title === c.title ? ' is-on' : ''}" data-pick="${esc(c.title)}"><b>${esc(c.title)}</b><span>${esc(c.why)}</span></button></li>`).join('')}</ol></div>`;
    sl.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      const on = s.common.title === b.dataset.pick;
      s.common.title = on ? '' : b.dataset.pick;
      s.common.chosenFromSuggest = !on;
      ctx.set('common.title', s.common.title);
      liveTopic(scope, s, ctx);
    }));
  }
}

function summaryRows(s) {
  const type = PAPER_TYPES.find((t) => t.id === s.paper.typeId);
  const field = FIELDS.find((f) => f.id === s.common.fieldId);
  const task = TASKS.find((t) => t.v === s.paper.task);
  const files = (slot) => (s.files || []).filter((f) => f.slot === slot).map((f) => f.name).join(', ');
  return [
    ['type', '논문 유형', type ? type.label : '-'],
    ['field', '전공 분야', [field ? field.label : '', s.common.fieldText, s.common.school].filter(Boolean).join(' · ') || '-'],
    ['topic', '주제', s.common.topicKnown === 'yes' ? s.common.title : `${s.common.title ? `추천 주제 선택: ${s.common.title}` : '추천 주제 요청'} (키워드: ${(s.common.keywords || []).join(', ')})`],
    ['toc', '목차', s.paper.hasToc === 'yes' ? `있음 ${files('toc') ? `(${files('toc')})` : '(직접 입력)'}` : '없음, 주제에 맞게 구성'],
    ['format', '양식', s.paper.hasFormat === 'yes' ? `${s.paper.formatName} ${files('format') ? `(${files('format')})` : ''}` : '일반적인 논문 양식'],
    ['method', '연구방법', { auto: '추천받기', literature: '문헌연구·선행연구 분석', survey: '설문·통계', qualitative: '면담·사례', experiment: '실험·기술', other: '기타' }[s.common.method] || '-'],
    ['task', '요청 작업', task ? task.t : '-'],
    ['task', '올린 자료', (s.files || []).length ? `${s.files.length}개 파일` : '없음'],
    ['volume', '분량·일정', `${s.paper.pagesMode === 'custom' ? `${s.paper.pages} Page` : s.paper.pagesMode === 'base' ? '기준 분량 이내' : '확인 후 결정'} · ${s.common.due ? `희망일 ${s.common.due}` : '희망일 없음'} · ${({ docx: 'Word', hwp: '한글', pdf: 'PDF' })[s.common.outputFormat]}`],
  ];
}

function sidePanel(s) {
  const d = design(s);
  const ready = s.paper.typeId;
  const q = ready ? computeQuote(CONFIG.catalog, quoteInput(s, d)) : null;
  const svg = d ? renderModelSVG(d.model, { compact: true }) : '';
  const tags = [PAPER_TYPES.find((t) => t.id === s.paper.typeId), FIELDS.find((f) => f.id === s.common.fieldId)].filter(Boolean).map((x) => x.label);
  const task = TASKS.find((t) => t.v === s.paper.task);
  if (task) tags.push(task.t);
  return sideShell({
    tags,
    price: q ? priceLinesHtml(q, { compact: true }) + etaHtml(q, CONFIG.settings) : '<p class="muted small">논문 유형을 고르면 금액이 계산됩니다.</p>',
    design: d ? `<div class="side-sec"><h3>실시간 연구 설계</h3><div class="demo-read">${readLineHtml(d)}</div>${svg ? `<div class="side-model">${svg}</div>` : `<p class="small muted">${esc(d.methodLabel)}: ${esc(d.questions[0] || '')}</p>`}${factsHtml(d)}<p class="hint">전체 설계 리포트는 마지막 단계에서 확인할 수 있습니다.</p></div>` : '<div class="side-sec"><h3>실시간 연구 설계</h3><p class="small muted">주제나 키워드를 입력하면 연구모형과 분석 계획이 여기에 바로 나타납니다.</p></div>',
    checklist: quickChecklist(s, requiredList(s)),
  });
}

function requiredList(s) {
  const r = [];
  if (s.paper.hasToc === 'yes') r.push(['목차', hasSlot(s, 'toc') || !!(s.paper.tocText || '').trim()]);
  if (s.paper.hasFormat === 'yes') r.push(['양식 파일', hasSlot(s, 'format')]);
  if (s.paper.task === 'edit' || s.paper.task === 'feedback') r.push(['기존 원고', hasSlot(s, 'manuscript')]);
  if (s.paper.task === 'feedback') r.push(['교수님 피드백', hasSlot(s, 'feedback') || !!(s.paper.feedbackText || '').trim()]);
  return r;
}

function mobileSummary(s) {
  if (!s.paper.typeId) return '<span class="mb-price muted">유형을 고르면 금액이 나옵니다</span>';
  const q = computeQuote(CONFIG.catalog, quoteInput(s, design(s)));
  return `<span class="mb-price"><b class="num">${won(q.total)}</b><small>${q.quoteRequired ? '견적 후 확정' : `기본 납기 ${q.days}일`}</small></span>`;
}

export async function startPaperWizard(root) {
  // 서버 설정을 기다리지 않고 바로 그린 뒤, 설정이 오면 견적만 다시 계산한다
  CONFIG = peekConfig();
  const params = new URLSearchParams(location.search);
  const wctx = createWizard({
    root, key: 'paper', title: '논문 의뢰하기', steps, defaults, sidePanel, mobileSummary,
    settings: () => CONFIG.settings || {},
    prefill: (s) => {
      if (params.get('title')) { s.common.topicKnown = 'yes'; s.common.title = params.get('title').slice(0, 200); }
      if (params.get('type') && PAPER_TYPES.some((t) => t.id === params.get('type'))) s.paper.typeId = params.get('type');
      if (params.get('field') && FIELDS.some((f) => f.id === params.get('field'))) s.common.fieldId = params.get('field');
      if (params.get('method')) s.common.method = params.get('method');
      if (params.get('task') && TASKS.some((t) => t.v === params.get('task'))) s.paper.task = params.get('task');
      // 홈 프롬프트·분량별 요금에서 넘어온 분량과 프롬프트
      const pg = Math.round(Number(params.get('pages')));
      if (pg > 0) { s.paper.pagesMode = 'custom'; s.paper.pages = Math.min(400, pg); }
      if (!params.get('title') && params.get('prompt')) { s.common.topicKnown = 'yes'; s.common.title = params.get('prompt').slice(0, 200); }
    },
    onFileAdded: async (slot, file, s, ctx) => {
      if (slot === 'manuscript' && /\.(docx|hwpx|pdf|txt)$/i.test(file.name)) {
        const info = await analyzeDocument(file);
        s.docInfo = { ...info, name: file.name };
      }
    },
    afterSide: () => {},
    onSubmit: (s) => {
      const d = design(s);
      const q = computeQuote(CONFIG.catalog, quoteInput(s, d));
      submitOrder({ service: 'paper', state: s, input: toInput(s, d), design: d ? designSnapshot(d) : null, quote: q, draftKey: 'draft:paper' });
    },
  });
  // 원고 분석 결과로 분량 반영
  root.addEventListener('click', (e) => {
    if (e.target.id === 'usePages' && wctx.state.docInfo && wctx.state.docInfo.pages) {
      wctx.set('paper.pagesMode', 'custom');
      wctx.set('paper.pages', wctx.state.docInfo.pages, { rerender: true });
      toast(`분량을 약 ${wctx.state.docInfo.pages} Page로 반영했어요.`);
    }
  });
  loadConfig().then((c) => { if (c && c.catalog) { CONFIG = c; wctx.refreshSide(); } });
}

export { design as paperDesign, quoteInput as paperQuoteInput, CONFIG as PAPER_CONFIG };
void $;
