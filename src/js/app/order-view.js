// 주문 화면 공통 조각
import { esc, won } from '../core/render.js';
import { ICON } from './wizard.js';
import { api } from './api.js';
import { base64ToBlob, saveBlob, fmtSize } from './files.js';
import { toast } from '../ui/dom.js';
import { PAPER_TYPES, FIELDS } from '../core/kb.js';

export const STEP_LABEL = { received: '접수 완료', checking: '자료 확인', preparing: '작업 준비', in_progress: '작성·분석 진행', review: '박사 검수', delivered: '전달 완료' };
export const STEP_ORDER = ['received', 'checking', 'preparing', 'in_progress', 'review', 'delivered'];
export const STEP_DESC = {
  received: '결제가 확인되어 주문이 접수되었습니다.', checking: '올려 주신 자료를 확인합니다.', preparing: '연구 설계와 작업 범위를 확정합니다.',
  in_progress: '원고 작성과 분석을 진행합니다.', review: '같은 전공 분야 박사가 설계·문헌·수치·형식을 검수합니다.', delivered: '결과물을 내려받을 수 있습니다.',
};

export function pillClass(status) {
  if (['quote_requested', 'pending_payment', 'payment_review', 'draft'].includes(status)) return 'st-wait';
  if (['delivered', 'completed'].includes(status)) return 'st-done';
  if (status === 'cancelled') return 'st-stop';
  if (status === 'needs_materials') return 'st-need';
  return '';
}

// 서버의 상태 이름 가운데 화면에서는 다르게 부르는 것(review: 품질 검토 → 박사 검수)
export const statusName = (o) => (o.status === 'pending_payment' ? '결제 전' : o.status === 'review' ? '박사 검수' : o.statusLabel);
export function statusPill(o) { return `<span class="status-pill ${pillClass(o.status)}"><i></i>${esc(statusName(o))}</span>`; }

function fmtAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export { fmtAt };

// 사람이 따로 기록하지 않아도 시스템이 이미 끝낸 단계(주문서 제출 때 자동 검사·설계)
// 박사 검수처럼 사람이 해야 하는 단계는 기록이 없으면 완료했다고 적지 않고 단계 설명만 보여 준다
function autoDone(o, s) {
  if (s === 'checking') return '필수 자료 자동 확인 완료';
  if (s === 'preparing') return o.service === 'paper' ? '연구 설계안 자동 생성 완료' : '작업 범위 자동 확정';
  return '';
}

export function timelineHtml(o) {
  const reached = {};
  for (const t of o.timeline || []) if (STEP_ORDER.includes(t.status)) reached[t.status] = reached[t.status] || t;
  let curIdx = STEP_ORDER.indexOf(o.status);
  if (o.status === 'revision' || o.status === 'completed') curIdx = 5;
  if (o.status === 'needs_materials') curIdx = Math.max(1, ...STEP_ORDER.map((s, i) => (reached[s] ? i : -1)));
  const pre = ['quote_requested', 'pending_payment', 'payment_review', 'draft', 'cancelled'].includes(o.status);
  const msgs = (o.timeline || []).filter((t) => t.message);
  const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
  return `<ol class="timeline">${STEP_ORDER.map((s, i) => {
    const r = reached[s];
    const cls = pre ? 'todo' : i < curIdx ? 'done' : i === curIdx ? (o.status === 'delivered' || o.status === 'completed' || o.status === 'revision' ? 'done' : 'now') : 'todo';
    const isNow = !pre && i === curIdx;
    return `<li class="${cls}"><span class="tl-dot" aria-hidden="true">${cls === 'done' ? ICON.check.replace('class="i"', 'class="i" style="width:15px;height:15px;color:#fff"') : ''}</span><span class="tl-txt"><b>${STEP_LABEL[s]}${o.status === 'needs_materials' && isNow ? ' · 자료 보완 필요' : ''}</b><small>${r ? fmtAt(r.at) : cls === 'done' ? (autoDone(o, s) || STEP_DESC[s]) : STEP_DESC[s]}</small>${isNow && lastMsg ? `<p>${esc(lastMsg.message)}</p>` : ''}</span></li>`;
  }).join('')}</ol>`;
}

export async function downloadFile(orderNo, f, { admin = false, adminToken = '' } = {}) {
  try {
    toast(`${f.name} 내려받는 중입니다.`);
    const r = admin ? await api('adminDownloadFile', { adminToken, orderNo, fileId: f.id }, { timeoutMs: 180000 }) : await api('downloadFile', { orderNo, fileId: f.id, ticket: f.ticket }, { timeoutMs: 180000 });
    saveBlob(base64ToBlob(r.data, r.mime), r.name || f.name);
  } catch (e) {
    toast(e.message || '내려받지 못했습니다.', { error: true });
  }
}

export function fileRows(files, { results = false, canDelete = false } = {}) {
  if (!files.length) return '';
  return `<ul class="file-rows${results ? ' results' : ''}">${files.map((f) => `<li><span class="up-ic">${ICON.file}</span><span class="fn">${esc(f.name)}</span><span class="fm">${fmtSize(f.size)}${f.expiresAt ? ` · ${esc(f.expiresAt.slice(0, 10))}까지` : ''}</span><button type="button" class="btn btn-soft btn-sm" data-dl="${esc(f.id)}">내려받기</button>${canDelete ? `<button type="button" class="up-del" data-rm="${esc(f.id)}" aria-label="삭제">${ICON.x}</button>` : ''}</li>`).join('')}</ul>`;
}

export function priceSummary(o) {
  const q = o.quote || {};
  const lines = (q.lines || []).map((l) => `<li><span>${esc(l.name)}${l.note ? `<small>${esc(l.note)}</small>` : ''}</span><b class="num">${l.pending ? '견적 후 안내' : won(l.amount)}</b></li>`).join('');
  return `<ul class="pl">${lines}</ul><div class="pl-total"><span>${o.quoteRequired ? '확정 전 금액' : '주문 금액'}</span><b class="num">${won(o.amount)}</b></div>`;
}

export function isSimulation(o) {
  const t = o.input && o.input.statistics;
  // 자료가 삭제되면 입력 내용은 지워지고 견적만 남으므로 견적의 상품 코드로도 판별한다
  return !!(t && t.hasData === false && t.noDataPath === 'simulation') || (!o.input && !!o.quote && o.quote.mainCode === 'T-SIM');
}

const TASK_LABEL = { full: '논문 완성(전체 구성·본문)', edit: '논문 첨삭·교정', feedback: '교수님 피드백 반영', proposal: '연구계획서 작성' };
const SURVEY_MODE = { full: '설문지 작성부터 설문 결과·통계 해석까지', new: '설문지 작성', edit: '설문지 점검·수정', feedback: '설문지 피드백 반영', analyze: '설문 응답 통계 분석·해석' };
const SURVEY_TARGET = { auto: '추천 받기', student: '대학생', worker: '직장인', teacher: '교사', parent: '학부모', adult: '성인', nurse: '간호사' };
const STAT_OUTPUT = { table: '논문 맞춤 통계분석 기본형', interp: '논문 맞춤 통계분석 표준형', chapter: '통계분석과 연구결과 작성', revise: '통계 재분석·피드백 반영' };
const RECRUIT = { us: '모집·배포 의뢰', self: '직접 수집', none: '설문지만' };

// 주문 내용 요약 표(고객·관리자 공용). 개인정보는 넣지 않는다.
export function orderFacts(o) {
  const i = o.input || {};
  const c = i.common || {};
  const rows = [];
  const field = FIELDS.find((f) => f.id === c.fieldId);
  if (o.service === 'paper' && i.paper) {
    const pt = PAPER_TYPES.find((t) => t.id === i.paper.typeId);
    if (c.topicKnown === 'free' && c.title) rows.push(['관심 주제', c.title]);
    rows.push(['논문 유형', pt ? pt.label : i.paper.typeId], ['요청 작업', TASK_LABEL[i.paper.task] || i.paper.task]);
    if (i.paper.pages) rows.push(['분량', `약 ${i.paper.pages} Page`]);
    if (i.paper.feedbackItems) rows.push(['피드백 항목', `${i.paper.feedbackItems}개`]);
    const mt = { survey: '설문·통계', literature: '문헌연구', qualitative: '면담·사례', experiment: '실험·개발' }[c.method];
    if (c.topicKnown === 'free' && mt) rows.push(['연구 방법', mt]);
  } else if (o.service === 'survey' && i.survey) {
    rows.push(['의뢰 유형', SURVEY_MODE[i.survey.mode] || i.survey.mode]);
    if (i.survey.target) rows.push(['응답 대상', i.survey.target === 'other' ? i.survey.targetOther : (SURVEY_TARGET[i.survey.target] || i.survey.target)]);
    if (i.survey.targetN) rows.push(['목표 응답 수', /^\d+$/.test(i.survey.targetN) ? `${i.survey.targetN}명` : '추천 받기']);
    if (i.survey.recruit) rows.push(['응답 수집', RECRUIT[i.survey.recruit] || i.survey.recruit]);
  } else if (o.service === 'statistics' && i.statistics) {
    const t = i.statistics;
    rows.push(['데이터', t.hasData === false ? (t.noDataPath === 'survey' ? '없음, 조사부터 진행' : '없음, 학습용 시뮬레이션') : '있음']);
    if (o.design && o.design.methodLabel) rows.push(['분석', o.design.methodLabel]);
    if (t.hasData !== false) rows.push(['결과물', STAT_OUTPUT[t.output] || t.output]);
  }
  if (field && field.id !== 'other') rows.push(['연구 분야', c.fieldText ? `${field.label} (${c.fieldText})` : field.label]);
  else if (c.fieldText) rows.push(['전공·분야', c.fieldText]);
  if (c.due) rows.push(['희망 마감일', c.due]);
  if (o.design && o.design.designLabel && o.service === 'paper') rows.push(['연구 설계', o.design.designLabel]);
  const files = (o.files && o.files.customer) || [];
  rows.push(['올린 자료', files.length ? `${files.length}개` : '없음']);
  if (c.request) rows.push(['요청 사항', c.request.length > 160 ? c.request.slice(0, 160) + '…' : c.request]);
  return rows;
}

export function factsTable(rows) {
  return `<dl class="facts-dl">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || '-')}</dd></div>`).join('')}</dl>`;
}

export function orderTitle(o) {
  const c = (o.input && o.input.common) || {};
  // 관심 주제만 적은 주문은 제목이 정해지지 않았으므로 상품 이름을 제목으로 쓴다
  if (c.topicKnown === 'free') return (o.design && o.design.title) || o.productName || '논문AI 주문';
  return (o.design && o.design.title) || c.title || o.productName || '논문AI 주문';
}
