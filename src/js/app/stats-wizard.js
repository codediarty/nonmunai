// 통계분석 의뢰 신청서
import { createWizard, choice, textField, textArea, uploader, note, hasSlot, submitOrder, priceLinesHtml, ICON } from './wizard.js';
import { contactStep, reviewSummary, etaHtml, sideShell, deadlineMin, quickChecklist } from './common-steps.js';
import { loadConfig, peekConfig } from './api.js';
import { FIELDS } from '../core/kb.js';
import { computeQuote, findItem } from '../core/pricing.js';
import { statsPlan, METHOD_LABELS } from '../core/plans.js';
import { diagnoseFile } from '../core/diagnose-data.js';
import { classifyFeedback } from '../core/feedback.js';
import { esc, won } from '../core/render.js';
import { url } from '../ui/dom.js';

const PURPOSES = [['degree', '학위논문'], ['journal', '학술지 논문'], ['report', '보고서'], ['course', '과제'], ['study', '학습·연습']];
const OUTPUTS = [
  { v: 'table', t: '통계표만', d: 'APA 형식 통계표와 분석 출력 파일', code: 'T-BASIC' },
  { v: 'interp', t: '통계표 + 쉬운 해석', d: '표마다 결과를 읽는 방법과 해석 문장', code: 'T-INTERP', badge: '추천' },
  { v: 'chapter', t: '논문 결과장 작성', d: '논문 4장(연구결과)에 넣을 서술 초고까지', code: 'T-CHAPTER' },
  { v: 'revise', t: '기존 분석 수정·교수님 피드백 반영', d: '데이터, 기존 결과, 교수님 의견이 필요합니다', code: 'T-FB' },
];

const defaults = {
  v: 1, service: 'statistics',
  common: { purpose: '', fieldId: '', fieldText: '', title: '', due: '', request: '' },
  statistics: { hasData: '', noDataPath: '', methods: ['auto'], output: '', variables: '', feedbackText: '' },
  addons: { priority: false, revisions: 0 },
  files: [], links: [], contact: { name: '', email: '', phone: '' }, pin: '', pin2: '', consents: { privacy: false, ethics: false, withdrawal: false, marketing: false, simulation: false }, hp: '', dataInfo: null,
};
let CONFIG = { catalog: null, settings: {} };

const hasData = (s) => s.statistics.hasData === 'yes';
const isSim = (s) => s.statistics.hasData === 'no' && s.statistics.noDataPath === 'simulation';
const isSurveyPath = (s) => s.statistics.hasData === 'no' && s.statistics.noDataPath === 'survey';

function quoteInput(s) {
  const t = s.statistics;
  return {
    service: 'statistics',
    statistics: { hasData: t.hasData === 'yes' ? true : t.hasData === 'no' ? false : true, noDataPath: t.noDataPath, output: t.output || 'interp', advanced: (t.methods || []).includes('medmod'), sem: (t.methods || []).includes('sem'), messy: false },
    addons: { priority: s.addons.priority, revisions: Number(s.addons.revisions || 0) },
  };
}

function toInput(s) {
  const q = quoteInput(s);
  // 데이터 없음(시뮬레이션·조사부터)에서는 결과물 형태를 고르지 않으므로, 앞서 데이터 있음에서 골랐던 값(예: 논문 결과장)을 보내지 않는다
  const t = hasData(s) ? s.statistics : { ...s.statistics, output: '', feedbackText: '' };
  return {
    common: { ...s.common },
    statistics: { ...t, hasData: q.statistics.hasData, advanced: q.statistics.advanced, sem: q.statistics.sem, dataInfo: s.dataInfo ? JSON.stringify(compactInfo(s.dataInfo)).slice(0, 1900) : '' },
    addons: q.addons,
  };
}

function compactInfo(i) {
  if (!i || !i.ok) return i ? { ok: false, message: i.message } : null;
  return { n: i.n, vars: i.vars, likert: i.likertCount, missing: Math.round(i.missingRate * 1000) / 10, pii: i.pii, demo: i.demographics, scales: i.scales.map((x) => ({ name: x.name, items: x.items, alpha: x.alpha ? Math.round(x.alpha * 1000) / 1000 : null })) };
}

function normalizeMethods(vals, changed, checked) {
  if (changed === 'auto' && checked) return ['auto'];
  const out = vals.filter((v) => v !== 'auto');
  return out.length ? out : ['auto'];
}

const steps = [
  {
    id: 'purpose', title: '분석 결과를 어디에 쓰실 건가요?', help: '목적에 따라 표 형식과 해석의 깊이를 맞춥니다.',
    render: (s) => choice('common.purpose', s.common.purpose, PURPOSES.map(([v, t]) => ({ v, t })), { cols: 2 }),
    valid: (s) => (s.common.purpose ? null : '목적을 골라 주세요.'),
  },
  {
    id: 'topic', title: '연구 분야와 주제를 알려 주세요', help: '가설에 맞는 분석 방법을 고르는 데 씁니다.',
    render: (s) => `${choice('common.fieldId', s.common.fieldId, FIELDS.map((f) => ({ v: f.id, t: f.label })), { cols: 3, compact: true })}<div style="margin-top:20px">${textArea('common.title', s.common.title, { label: '연구 주제 또는 연구 내용', rows: 3, required: true, placeholder: '예: 중학생의 학업스트레스가 학교적응에 미치는 영향에서 사회적 지지의 조절효과', cls: 'serif-in' })}</div>`,
    valid: (s) => (!s.common.fieldId ? '연구 분야를 골라 주세요.' : (s.common.title || '').trim().length < 4 ? '연구 주제를 적어 주세요.' : null),
  },
  {
    id: 'data', title: '분석할 데이터가 있나요?', help: '데이터 유무에 따라 진행 방법이 나뉩니다.',
    render: (s) => {
      let out = choice('statistics.hasData', s.statistics.hasData, [{ v: 'yes', t: '있어요', d: 'Excel, CSV, SPSS 파일을 올립니다' }, { v: 'no', t: '없어요', d: '조사부터 할지, 연습용으로 할지 고릅니다' }], { cols: 2 });
      if (hasData(s)) {
        out += `<div class="cond">${uploader(s, 'data', { label: '데이터 파일', required: true, hint: 'Excel(xlsx, xls), CSV, SPSS(sav). 올리면 바로 자동 진단합니다' })}<div id="diag">${diagHtml(s)}</div>${uploader(s, 'questionnaire', { label: '설문지' })}${uploader(s, 'codebook', { label: '변수 설명(코드북)' })}${note('<b>개인정보는 지우고 올려 주세요.</b> 이름, 연락처, 이메일, 학번처럼 응답자를 알아볼 수 있는 열은 분석에 필요하지 않습니다. 자동 진단이 의심되는 열을 찾아 알려 드립니다.', 'amber')}</div>`;
      } else if (s.statistics.hasData === 'no') {
        out += `<div class="cond">${choice('statistics.noDataPath', s.statistics.noDataPath, [
          { v: 'survey', t: '실제 응답 조사부터 의뢰', d: '설문 설계와 응답 수집, 분석을 통합 견적으로 진행합니다. 실제 연구라면 이 방법입니다' },
          { v: 'simulation', t: '연습·방법 확인용 시뮬레이션', d: `교육용 가상 데이터로 분석 절차를 익힙니다 (${won((findItem(CONFIG.catalog, 'T-SIM') || {}).price || 0)})` },
        ])}${isSim(s) ? note('<b>가상 데이터, 실제 연구 결과 아님</b><br>시뮬레이션 결과물에는 파일 이름과 모든 표에 이 표시가 붙습니다. 논문, 보고서, 과제에 실제로 수집한 결과처럼 제출하거나 실증 결과로 사용할 수 없습니다.', 'pen') : ''}${isSurveyPath(s) ? note(`설문 설계부터 응답 수집, 분석까지 이어서 진행합니다. 모집 비용을 포함한 확정 견적을 받은 뒤 결제합니다. <a href="${url('/survey/new/')}">설문조사 신청서로 바로 가기</a>도 가능합니다.`) : ''}</div>`;
      }
      return out;
    },
    valid: (s) => {
      if (!s.statistics.hasData) return '데이터가 있는지 골라 주세요.';
      if (hasData(s) && !hasSlot(s, 'data')) return '데이터 파일을 올려 주세요.';
      if (s.statistics.hasData === 'no' && !s.statistics.noDataPath) return '진행 방법을 골라 주세요.';
      return null;
    },
  },
  {
    id: 'methods', title: '어떤 분석이 필요하세요?', help: '모르시면 연구 주제와 가설에 맞게 추천합니다. 여러 개를 고를 수 있습니다.', when: (s) => !isSurveyPath(s),
    normalizeMulti: normalizeMethods,
    // 추가 금액·별도 견적 표시는 실제 견적에 반영되는 경우에만(데이터 있음, 매개·조절은 기존 분석 수정 제외). 학습용 시뮬레이션은 정액
    render: (s) => `${choice('statistics.methods', s.statistics.methods, Object.entries(METHOD_LABELS).map(([v, t]) => ({ v, t, rec: v === 'auto', d: { auto: '주제와 가설에 맞게 추천', basic: '빈도, 평균·표준편차', group: 't검정, 분산분석', correg: '상관, 다중·위계적 회귀', reliability: '신뢰도, 탐색적 요인분석', medmod: 'PROCESS Macro 매개·조절', sem: '확인적 요인분석, 구조모형', other: '요청 사항에 적어 주세요' }[v], side: v === 'medmod' && hasData(s) && s.statistics.output !== 'revise' ? `+${won((findItem(CONFIG.catalog, 'T-ADV') || {}).price || 0)}` : v === 'sem' && hasData(s) ? '별도 견적' : '' })), { multi: true, cols: 2, compact: true })}${hasData(s) && (s.statistics.methods || []).includes('sem') ? note('구조방정식은 모형과 데이터 구조를 확인한 뒤 확정 견적을 드리고, 확정 전에는 결제하지 않습니다.', 'amber') : ''}${isSim(s) ? note(`학습용 시뮬레이션은 고른 분석 방법과 관계없이 ${won((findItem(CONFIG.catalog, 'T-SIM') || {}).price || 0)}입니다.`) : ''}`,
    valid: () => null,
  },
  {
    id: 'output', title: '어떤 형태로 받고 싶으세요?', help: '결과를 설명해야 한다면 통계표와 쉬운 해석을 추천합니다.', when: hasData,
    render: (s) => {
      let out = choice('statistics.output', s.statistics.output, OUTPUTS.map((o) => { const it = findItem(CONFIG.catalog, o.code); return { v: o.v, t: o.t, d: o.d, badge: o.badge, side: it ? won(it.price) : '' }; }));
      if (s.statistics.output === 'revise') out += `<div class="cond">${uploader(s, 'prevResult', { label: '기존 분석 결과', required: true, hint: 'SPSS 출력(spv), 결과표 Word·한글·Excel 파일' })}${uploader(s, 'feedback', { label: '교수님 의견 파일' })}${textArea('statistics.feedbackText', s.statistics.feedbackText, { label: '또는 의견 붙여 넣기', rows: 4, hint: '파일과 붙여넣기 중 하나는 꼭 필요합니다.' })}</div>`;
      return out;
    },
    valid: (s) => {
      if (!s.statistics.output) return '결과물 형태를 골라 주세요.';
      if (s.statistics.output === 'revise') {
        if (!hasSlot(s, 'data')) return '기존 분석 수정에는 데이터 파일이 필요합니다.';
        if (!hasSlot(s, 'prevResult')) return '기존 분석 결과 파일을 올려 주세요.';
        if (!hasSlot(s, 'feedback') && !(s.statistics.feedbackText || '').trim()) return '교수님 의견을 파일로 올리거나 붙여 넣어 주세요.';
      }
      return null;
    },
  },
  {
    id: 'detail', title: '분석할 변수와 일정을 알려 주세요', help: '모르는 부분은 비워 두셔도 됩니다.',
    render: (s) => `${textArea('statistics.variables', s.statistics.variables, { label: '분석할 변수나 가설 (선택)', rows: 4, placeholder: '예: 독립변수 학업스트레스, 종속변수 학교적응, 조절변수 사회적 지지. 성별·학년을 통제' })}
<div class="row-2">${textField('common.due', s.common.due, { type: 'date', label: '희망 완료일 (선택)' })}</div>
<div class="addons" style="margin-top:14px"><label class="check addon"><input type="checkbox" data-bool="addons.priority"${s.addons.priority ? ' checked' : ''}><span><b>우선 처리 <em class="num">+${won((findItem(CONFIG.catalog, 'A-PRIORITY') || {}).price || 0)}</em></b><small>일정상 가능한 경우 작업 순서를 앞당깁니다.</small></span></label></div>
${textArea('common.request', s.common.request, { label: '요청 사항 (선택)', rows: 3 })}`,
    bind: (el) => { const d = el.querySelector('input[type=date]'); if (d) d.min = deadlineMin(); },
    valid: () => null,
  },
  {
    ...contactStep(),
    render: (s) => contactStep().render(s) + (isSim(s) ? `<label class="check" style="margin-top:12px"><input type="checkbox" data-bool="consents.simulation"${s.consents.simulation ? ' checked' : ''}><span><b>[필수] 가상 데이터 사용 제한 확인</b><small>시뮬레이션 결과는 교육용 가상 데이터이며, 실제 연구 결과로 제출하거나 사용하지 않겠습니다.</small></span></label>` : ''),
    valid: (s) => contactStep().valid(s) || (isSim(s) && !s.consents.simulation ? '가상 데이터 사용 제한을 확인해 주세요.' : null),
  },
  {
    id: 'review', title: '주문 내용을 확인해 주세요', help: '견적형 주문은 확정 견적을 받은 뒤 결제합니다.',
    render: (s, ctx) => {
      const q = computeQuote(CONFIG.catalog, quoteInput(s));
      const p = statsPlan({ methods: s.statistics.methods, title: s.common.title });
      const rows = [
        ['purpose', '목적', (PURPOSES.find((x) => x[0] === s.common.purpose) || [])[1]],
        ['topic', '주제', s.common.title],
        ['data', '데이터', hasData(s) ? `있음 (${(s.files || []).filter((f) => f.slot === 'data').map((f) => f.name).join(', ')})` : isSim(s) ? '없음, 학습용 시뮬레이션' : '없음, 조사부터 의뢰'],
      ];
      if (!isSurveyPath(s)) rows.push(['methods', '분석', (s.statistics.methods || []).map((m) => METHOD_LABELS[m]).join(', ')]);
      if (hasData(s)) rows.push(['output', '결과물', (OUTPUTS.find((o) => o.v === s.statistics.output) || {}).t]);
      return `${reviewSummary(s, ctx, rows)}<div class="rv-block"><h3 class="sub-q">견적</h3><div class="sheet rv-price">${priceLinesHtml(q)}${etaHtml(q, CONFIG.settings)}</div></div>
${!isSurveyPath(s) ? `<div class="rv-block"><h3 class="sub-q">분석 계획</h3><div class="sheet report"><ol class="rp-list">${p.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>${isSim(s) ? '<p style="margin-top:12px"><span class="sim-mark">가상 데이터, 실제 연구 결과 아님</span></p>' : ''}</div></div>` : ''}
${s.dataInfo && s.dataInfo.ok ? `<div class="rv-block"><h3 class="sub-q">데이터 자동 진단</h3>${diagHtml(s)}</div>` : ''}`;
    },
    submitLabel: (s) => (computeQuote(CONFIG.catalog, quoteInput(s)).quoteRequired ? '견적 요청하기' : '주문서 제출하기'),
    valid: () => null,
  },
];

function diagHtml(s) {
  const i = s.dataInfo;
  if (!i) return '';
  if (!i.ok) return `<p class="hint">${esc(i.message || '')}</p>`;
  const cols = (i.columns || []).slice(0, 40);
  return `<div class="auto-card data-diag"><div class="auto-hd">${ICON.spark}<b>데이터 자동 진단</b><span class="muted">${esc(i.fileName || '')}${i.sheets > 1 ? ` · 첫 번째 시트 기준(시트 ${i.sheets}개)` : ''}</span></div>
<dl class="auto-dl"><div><dt>응답 수</dt><dd>${i.n.toLocaleString('ko-KR')}명</dd></div><div><dt>변수</dt><dd>${i.vars}개</dd></div><div><dt>리커트 문항</dt><dd>${i.likertCount}개</dd></div><div><dt>결측</dt><dd>${(i.missingRate * 100).toFixed(1)}%</dd></div></dl>
${i.scales.length ? `<p class="small"><b>문항 묶음 추정</b> ${i.scales.map((x) => `${esc(x.name)} ${x.items}문항${x.alpha != null ? ` (α=${x.alpha.toFixed(2)})` : ''}`).join(', ')}</p>` : ''}
${i.pii.length ? `<p class="small" style="color:var(--pen)"><b>개인정보로 보이는 열</b> ${i.pii.map(esc).join(', ')}. 지운 뒤 다시 올리는 것을 권장합니다.</p>` : '<p class="small" style="color:var(--green)"><b>개인정보로 보이는 열이 없습니다.</b></p>'}
${cols.length ? `<details><summary class="small">변수 목록 보기</summary><div class="table-wrap"><table class="diag-table"><thead><tr><th>변수</th><th>형태</th><th>결측</th><th>범위</th></tr></thead><tbody>${cols.map((c) => `<tr><td class="${c.pii ? 'pii' : ''}">${esc(c.name)}</td><td>${esc(c.type)}</td><td>${(c.missingRate * 100).toFixed(0)}%</td><td>${c.numeric && c.min != null ? `${c.min}~${c.max}` : '-'}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
<p class="hint">브라우저 안에서 계산한 사전 진단입니다. 최종 분석은 분석가가 직접 실행하고 검수합니다.</p></div>`;
}

function sidePanel(s) {
  const q = s.statistics.hasData ? computeQuote(CONFIG.catalog, quoteInput(s)) : null;
  const tags = [(PURPOSES.find((x) => x[0] === s.common.purpose) || [])[1], (FIELDS.find((f) => f.id === s.common.fieldId) || {}).label, hasData(s) ? '데이터 있음' : isSim(s) ? '학습용 시뮬레이션' : isSurveyPath(s) ? '조사부터' : ''].filter(Boolean);
  const req = [];
  if (hasData(s)) req.push(['데이터 파일', hasSlot(s, 'data')]);
  if (s.statistics.output === 'revise') req.push(['기존 분석 결과', hasSlot(s, 'prevResult')], ['교수님 의견', hasSlot(s, 'feedback') || !!(s.statistics.feedbackText || '').trim()]);
  const p = statsPlan({ methods: s.statistics.methods, title: s.common.title });
  return sideShell({
    tags,
    price: q ? priceLinesHtml(q, { compact: true }) + etaHtml(q, CONFIG.settings) : '<p class="muted small">데이터 유무를 고르면 금액이 계산됩니다.</p>',
    checklist: quickChecklist(s, req),
    design: `<div class="side-sec"><h3>분석 계획 미리보기</h3><ol class="rp-list">${p.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>${s.dataInfo && s.dataInfo.ok ? `<p class="small" style="margin-top:10px">데이터: 응답 ${s.dataInfo.n}명 · 변수 ${s.dataInfo.vars}개${s.dataInfo.pii.length ? ' · <b style="color:var(--pen)">개인정보 열 확인 필요</b>' : ''}</p>` : ''}${isSim(s) ? '<p style="margin-top:10px"><span class="sim-mark">가상 데이터</span></p>' : ''}</div>`,
  });
}

function mobileSummary(s) {
  if (!s.statistics.hasData) return '<span class="mb-price muted">데이터 유무를 고르면 금액이 나옵니다</span>';
  const q = computeQuote(CONFIG.catalog, quoteInput(s));
  return `<span class="mb-price"><b class="num">${won(q.total)}</b><small>${q.quoteRequired ? '견적 후 확정' : `기본 납기 ${q.days}일`}</small></span>`;
}

export async function startStatsWizard(root) {
  // 서버 설정을 기다리지 않고 바로 그린 뒤, 설정이 오면 견적만 다시 계산한다
  CONFIG = peekConfig();
  const wctx = createWizard({
    root, key: 'statistics', title: '통계분석 의뢰하기', steps, defaults, sidePanel, mobileSummary, settings: () => CONFIG.settings || {},
    onFileAdded: async (slot, file, s) => {
      if (slot === 'data') {
        const info = await diagnoseFile(file);
        s.dataInfo = { ...info, fileName: file.name, columns: info.columns ? info.columns.slice(0, 60).map((c) => ({ name: c.name, type: c.type, missingRate: c.missingRate, numeric: c.numeric, min: c.min, max: c.max, pii: c.pii })) : [] };
      }
    },
    onSubmit: (s) => submitOrder({ service: 'statistics', state: s, input: toInput(s), design: { title: s.common.title, designLabel: isSim(s) ? '학습용 시뮬레이션' : '통계분석', methodLabel: (s.statistics.methods || []).map((m) => METHOD_LABELS[m]).join(', '), population: '', sampleText: s.dataInfo && s.dataInfo.ok ? `응답 ${s.dataInfo.n}명` : '', vars: {}, hypotheses: [], titleCandidates: [] }, quote: computeQuote(CONFIG.catalog, quoteInput(s)), draftKey: 'draft:statistics' }),
  });
  loadConfig().then((c) => { if (c && c.catalog) { CONFIG = c; wctx.refreshSide(); } });
}
void classifyFeedback;
