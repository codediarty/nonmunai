// 한 화면 설문조사·통계분석 주문(2026-11-27)
// 단계별 신청서(설문 10단계, 통계 6단계)를 대신해 기본으로 여는 짧은 주문서. 예전 신청서는 ?detail=1로 그대로 열린다.
// 주제와 필요한 작업만 고르면 금액이 바로 나오고, 필요한 파일을 받은 뒤 결제 화면으로 잇는다.
// 응답 대상·문항 수·분석 방법은 고르지 않고 요청 사항에 편하게 적는다. 기본 금액에 없는 일(응답자 모집, 매개·조절효과,
// 구조방정식)은 고르게 하지 않고 '확인한 뒤 추가 금액을 먼저 알려 드린다'고만 미리 알려 준다(첨삭과 같은 방식).
// 결제할 상품은 늘 하나라서 결제 화면이 바로 열린다. 조회 비밀번호는 따로 받지 않고 휴대전화 뒤 4자리를 쓴다.
import { submitOrder, uploader, ICON } from './wizard.js';
import { loadConfig, peekConfig } from './api.js';
import { computeQuote, findItem, etaDate, includesFor } from '../core/pricing.js';
import { surveyPlan, statsPlan } from '../core/plans.js';
import { classifyFeedback } from '../core/feedback.js';
import { readPrompt } from '../core/preview.js';
import { guessField } from '../core/kb.js';
import { $, $$, esc, store, debounce, url, toast } from '../ui/dom.js';
import { won } from '../core/render.js';
import { putBlob, delBlob, checkFile, MAX_FILES, extOf } from './files.js';
import { statExtras } from './stat-extras.js';
import { diagnoseData, compactInfo, diagHtml } from './data-diag.js';

const MAJORS = ['간호학', '사회복지학', '상담심리학', '교육학', '유아교육', '경영학', '행정학', '체육학', '관광경영학', '호텔경영학', '보건학', '물리치료학', '심리학', '신학', '컴퓨터공학', '미디어커뮤니케이션', '디자인', '음악', '경제학', '법학'];
const REQ_MAX = 3000;

// 고를 작업: main은 카드, fix는 '이미 만든 것이 있다면' 아래 작은 단추. name·sub는 결제 금액 상자에 쓴다
const SVC = {
  survey: {
    key: 'draft:survey-quick',
    h1: '주제만 알려 주세요.<br>설문부터 해석까지 해 드려요.',
    lead: '주제를 적고 필요한 작업만 고르면 금액이 바로 나와요. 응답 대상, 문항 수, 분석 방법은 몰라도 괜찮아요. 주제에 맞게 정해 드려요.',
    pickTitle: '무엇이 필요하세요?',
    fixLabel: '이미 만든 설문지가 있다면',
    def: 'full',
    modes: [
      { v: 'full', code: 'S-FULL', t: '원스톱', sub: '작성부터 해석까지', d: '설문지 작성, 온라인 설문, 결과 정리, 통계 분석과 해석', pop: true, name: '설문조사 원스톱', what: '설문지 작성부터 통계 해석까지', flow: [['설문 설계', '검증된 척도'], ['조사·정리', '응답 수집 관리'], ['분석·해석', '논문 맞춤']] },
      { v: 'new', code: 'S-NEW', t: '설문지 작성', sub: '척도·문항', d: '검증된 척도로 문항을 만들고 배포용 링크까지', name: '설문지 작성', what: '척도 선정, 문항 구성, 배포용 링크', flow: [['변인 정리', '주제 분석'], ['척도 선정', '검증된 척도'], ['설문지 전달', 'Word와 링크']] },
      { v: 'analyze', code: 'S-ANALYZE', t: '응답 분석', sub: '모은 응답으로', d: '모은 응답 파일로 가설에 맞게 분석하고 해석', name: '설문 응답 분석·해석', what: '통계표와 결과 해석', flow: [['데이터 점검', '결측·역문항'], ['가설 분석', 'SPSS·PROCESS'], ['표·해석 전달', 'APA 7판']] },
      { v: 'edit', code: 'S-EDIT', t: '설문지 점검·수정', fix: true, name: '설문지 점검·수정', what: '문항과 척도 점검, 수정본' },
      { v: 'feedback', code: 'S-FB', t: '교수님 피드백 반영', fix: true, name: '설문지 피드백 반영', what: '의견 전체 반영, 수정표 포함' },
    ],
  },
  statistics: {
    key: 'draft:statistics-quick',
    h1: '데이터만 올려 주세요.<br>통계표와 해석까지 드려요.',
    lead: 'SPSS를 몰라도 괜찮아요. 연구 주제에 맞는 분석 방법을 정해 APA 통계표와 결과 해석으로 보내 드려요.',
    pickTitle: '어떤 결과가 필요하세요?',
    fixLabel: '교수님이 분석을 다시 하라고 하셨다면',
    def: 'interp',
    modes: [
      { v: 'interp', code: 'T-INTERP', t: '표준형', sub: '표마다 해석', d: '가설별 분석 설계, APA 통계표, 표마다 결과 해석', pop: true, name: '통계분석 표준형', what: '분석 설계, 통계표, 표별 해석' },
      { v: 'table', code: 'T-BASIC', t: '기본형', sub: '핵심 해석', d: '주제에 맞는 분석, APA 통계표, 핵심 결과 해석', name: '통계분석 기본형', what: '통계표와 핵심 해석' },
      { v: 'chapter', code: 'T-CHAPTER', t: '연구결과 작성', sub: '4장 본문까지', d: '표준형 분석에 논문 4장(연구결과) 본문까지', name: '통계분석과 연구결과 작성', what: '표준형 분석과 4장 본문' },
      { v: 'revise', code: 'T-FB', t: '재분석·교수님 의견 반영', fix: true, name: '통계 재분석·의견 반영', what: '수정된 통계표와 수정표' },
    ],
    flow: [['데이터 점검', '결측·이상치'], ['분석 실행', 'SPSS·PROCESS'], ['표·해석 전달', 'APA 7판']],
  },
};

// 요청 사항에 한 줄씩 넣는 단추
const REQ_CHIPS = {
  survey: ['응답 대상', '목표 응답 수', '넣고 싶은 변인·척도', '문항 수', '학교·학과', '지도교수님 의견'],
  analyze: ['연구 가설', '원하는 분석', '학교·학과', '지도교수님 의견'],
  fix: ['고칠 부분', '학교·학과', '지도교수님 의견'],
  statistics: ['독립변수', '종속변수', '매개·조절변수', '연구 가설', '원하는 분석', '학교·학과', '지도교수님 의견'],
};
const REQ_PH = {
  survey: '예: 종합병원 간호사 200명에게 받을 거예요. 직무스트레스, 소진, 이직의도를 넣어 주시고 문항은 60개 이내로 부탁드려요.',
  analyze: '예: 직무스트레스가 이직의도에 영향을 준다는 가설이에요. 성별과 경력에 따른 차이도 봐 주세요.',
  fix: '예: 교수님이 척도 출처를 밝히고 역문항을 표시하라고 하셨어요.',
  statistics: '예: 독립변수는 직무스트레스, 종속변수는 이직의도예요. 회복탄력성의 매개효과도 보고 싶어요.',
};

const DEF = { v: 1, mode: '', topic: '', major: '', recruit: false, feedbackText: '', request: '', due: '', files: [], links: [], contact: { name: '', email: '', phone: '' }, hp: '', dataInfo: null };

let KIND = 'survey';
let C = SVC.survey;
let CONFIG = { catalog: null, settings: {} };
let S = null;
let ROOT = null;

const clone = (o) => JSON.parse(JSON.stringify(o));
const save = debounce(() => store.set(C.key, { ...S, saved: Date.now() }), 250);
const mode = () => C.modes.find((m) => m.v === S.mode) || C.modes[0];
const isSurvey = () => KIND === 'survey';
const hasFile = (slot) => (S.files || []).some((f) => f.slot === slot) || (S.links || []).some((l) => l.slot === slot && /^https?:\/\//.test(l.url || ''));
const itemOf = (m) => findItem(CONFIG.catalog, m.code);

/* ------------------------------------------------------------------ 금액 */
// 결제 금액은 고른 작업 하나로만 정한다(모집·심화 분석·구조방정식은 확인 뒤 추가 결제)
function quoteInput() {
  if (isSurvey()) return { service: 'survey', survey: { mode: S.mode, recruit: surveyRecruit(), advanced: false, sem: false }, addons: {} };
  return { service: 'statistics', statistics: { hasData: true, output: S.mode, advanced: false, sem: false, messy: false }, addons: {} };
}
const quote = () => computeQuote(CONFIG.catalog, quoteInput());
// 응답 수집: 원스톱은 직접 수집, 설문지 작성은 설문지만. '모집도 맡길게요'는 ask(금액은 따로 안내, 기본 금액 결제는 그대로)
function surveyRecruit() {
  if (!['full', 'new'].includes(S.mode)) return S.mode === 'analyze' ? '' : 'none';
  return S.recruit ? 'ask' : S.mode === 'full' ? 'self' : 'none';
}

// 기본 금액에 없는 분석: 설문은 응답 분석만(원스톱은 심화 분석이 기본 금액에 들어 있음), 통계는 재분석을 뺀 전부
function extras() {
  if (isSurvey() ? S.mode !== 'analyze' : S.mode === 'revise') return [];
  return statExtras(`${S.topic}\n${S.request}`);
}

/* ------------------------------------------------------------------ 화면 */
function shell(root) {
  root.innerHTML = `<div class="qo so so-${KIND}">
<div class="qo-hero"><div class="wrap qo-hero-in"><h1 class="qo-h1">${C.h1}</h1><p class="qo-lead">${C.lead}</p></div></div>
<div class="wrap qo-grid">
<form class="qo-form" id="soForm" novalidate autocomplete="off">
${(isSurvey() ? ['topic', 'pick', 'files', 'req', 'more', 'who'] : ['data', 'topic', 'pick', 'req', 'more', 'who']).map((k) => `<section class="qo-sec so-sec-${k}${k === 'req' ? ' qo-sec-req' : k === 'more' ? ' qo-sec-more' : ''}" data-sec="${k}"></section>`).join('\n')}
<input type="text" name="hp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" data-k="hp">
<div class="qo-go"><p class="qo-err" id="soErr" role="alert"></p>
<button class="btn btn-primary btn-lg btn-block qo-submit" type="submit" id="soSubmit">결제하고 의뢰하기</button>
<p class="qo-safe">${ICON.check}<span>회원가입 없이 카드·간편결제·계좌이체 · 결제가 확인되면 바로 작업을 시작해요</span></p>
<p class="qo-safe qo-secret">${ICON.shield}<span>작업은 이름 대신 주문번호로 하고, 전달 후 90일이 지나면 자료를 모두 지워요.</span></p></div>
<p class="qo-other so-detail"><span>심사 발표 PPT나 우선 처리도 함께 맡기려면</span><a href="${url(isSurvey() ? '/survey/new/' : '/statistics/new/')}?detail=1">상세 신청서로 신청하기</a></p>
</form>
<aside class="qo-side" aria-label="결제 금액"><div class="qo-side-in"><div class="qo-sum" id="soSum"></div><div id="soPlan"></div></div></aside>
</div>
<div class="qo-mbar" id="soBar"></div>
</div>`;
}

const sec = (k) => $(`[data-sec="${k}"]`, ROOT);
const head = (title, opt = '') => `<h2 class="qo-h"><span class="qo-n"></span>${title}${opt ? `<span class="qo-h-opt">${opt}</span>` : ''}</h2>`;

function topicHtml() {
  const majors = `<datalist id="soMajors">${MAJORS.map((m) => `<option value="${m}">`).join('')}</datalist>`;
  const sv = isSurvey();
  return `${head('어떤 연구인가요?')}
<div class="field"><label class="label" for="soTopic">${sv ? '연구 주제나 키워드' : '연구 주제'}<span class="req">*</span></label>
<textarea class="textarea qo-ta so-ta" id="soTopic" rows="2" data-k="topic" maxlength="200" placeholder="${sv ? '예: 간호사의 직무스트레스와 이직의도' : '예: 직무스트레스가 이직의도에 미치는 영향'}">${esc(S.topic)}</textarea>
<p class="hint">${sv ? '정해진 제목이 없어도 괜찮아요. 관심 있는 주제만 적어 주세요.' : '가설이나 변수는 아래 요청 사항에 편하게 적어 주시면 돼요.'}</p></div>
<div class="field"><label class="label" for="soMajor">전공 분야 <span class="qo-opt">(선택)</span></label><input class="input" id="soMajor" data-k="major" list="soMajors" maxlength="60" value="${esc(S.major)}" placeholder="예: 간호학, 경영학, 교육학">${majors}</div>`;
}

function card(m) {
  const it = itemOf(m);
  const on = S.mode === m.v;
  return `<label class="qo-pkg${on ? ' is-on' : ''}${m.pop ? ' is-pop' : ''}"><input type="radio" name="soMode" value="${m.v}"${on ? ' checked' : ''}><span class="qo-pkg-hd"><b>${esc(m.t)}</b><span class="qo-pkg-pg">${esc(m.sub)}</span></span><span class="qo-pkg-w"><b class="num">${it ? won(it.price) : '-'}</b></span><span class="qo-pkg-d">${esc(m.d)}</span><span class="qo-pkg-mk" aria-hidden="true">${ICON.check}</span></label>`;
}
function fixItem(m) {
  const it = itemOf(m);
  const on = S.mode === m.v;
  return `<label class="qo-seg-i so-fix-i${on ? ' is-on' : ''}"><input type="radio" name="soMode" value="${m.v}"${on ? ' checked' : ''}>${esc(m.t)}${it ? ` <em class="num">${won(it.price)}</em>` : ''}</label>`;
}

function pickHtml() {
  const main = C.modes.filter((m) => !m.fix);
  const fix = C.modes.filter((m) => m.fix);
  let out = `${head(C.pickTitle)}
<div class="qo-pkgs so-pkgs" role="radiogroup" aria-label="필요한 작업">${main.map(card).join('')}</div>`;
  if (isSurvey() && ['full', 'new'].includes(S.mode)) {
    out += `<label class="qo-add so-recruit${S.recruit ? ' is-on' : ''}"><input type="checkbox" id="soRecruit"${S.recruit ? ' checked' : ''}><span class="qo-add-mk" aria-hidden="true">${ICON.check}</span><span class="qo-add-t"><b>응답자 모집도 맡길게요</b><small>${S.recruit ? '대상과 인원, 기간을 확인하고 모집 비용을 먼저 알려 드려요. 금액을 보고 맡길지 정하시면 되고, 맡기지 않으면 배포용 링크로 직접 모으시면 돼요.' : '응답을 모을 곳이 마땅치 않을 때 골라 주세요. 모집 비용은 따로 알려 드려요.'}</small></span><span class="qo-add-p">따로 안내</span></label>`;
  }
  out += `<div class="so-fix"><p class="so-fix-l">${C.fixLabel}</p><div class="qo-seg">${fix.map(fixItem).join('')}</div></div>`;
  // 통계 재분석은 고른 자리 바로 아래에서 기존 결과와 교수님 의견을 받는다
  if (!isSurvey() && S.mode === 'revise') {
    out += `<div class="so-cond">${uploader(S, 'prevResult', { label: '기존 분석 결과', required: true, hint: 'SPSS 출력(spv), 결과표 Word·한글·Excel 파일' })}
${fbField('교수님 의견', '받은 의견을 그대로 붙여 넣어 주세요.\n예: 1. 회귀분석 전에 다중공선성을 확인할 것')}
${uploader(S, 'feedback', { label: '의견이 담긴 파일', hint: '메모가 적힌 원고, 메일 캡처, 사진 모두 괜찮아요(붙여넣기와 둘 중 하나면 돼요)' })}</div>`;
  }
  return out;
}

function fbField(label, ph) {
  const n = S.feedbackText ? classifyFeedback(S.feedbackText).count : 0;
  return `<div class="field"><label class="label" for="soFb">${label}<span class="req">*</span></label><textarea class="textarea" id="soFb" rows="5" data-k="feedbackText" maxlength="8000" placeholder="${esc(ph)}">${esc(S.feedbackText)}</textarea><p class="hint" id="soFbN">${fbCount(n)}</p></div>`;
}
const fbCount = (n) => (n ? `의견 ${n}개 항목을 모두 반영해 드려요. 항목 수와 관계없이 금액은 같아요.` : '붙여 넣으면 의견을 항목별로 나눠 빠짐없이 반영해 드려요.');

const piiNote = '<p class="hint so-pii">이름, 연락처, 학번처럼 응답자를 알아볼 수 있는 열은 지우고 올려 주세요. 올리면 개인정보로 보이는 열을 찾아 알려 드려요.</p>';

// 설문: 고른 작업에 꼭 필요한 파일
function filesHtml() {
  const m = S.mode;
  if (m === 'analyze') {
    return `${head('모은 응답 파일을 올려 주세요')}
${uploader(S, 'data', { label: '응답 데이터', required: true, hint: 'Excel, CSV, SPSS(sav) 파일. 올리면 응답 수와 문항 묶음을 바로 확인해 드려요' })}
<div id="soDiag">${diagHtml(S.dataInfo)}</div>${piiNote}
${uploader(S, 'questionnaire', { label: '사용한 설문지', hint: '함께 주시면 문항 묶음을 더 정확하게 맞춰요' })}`;
  }
  if (m === 'edit') {
    return `${head('만든 설문지를 올려 주세요')}
<p class="qo-help">문항 표현과 척도 구성을 점검하고, 고친 수정본과 수정 내역을 함께 드려요.</p>
${uploader(S, 'questionnaire', { label: '만든 설문지', required: true, hint: '한글·워드·PDF, 온라인 설문 화면 캡처도 괜찮아요' })}`;
  }
  if (m === 'feedback') {
    return `${head('설문지와 교수님 의견을 주세요')}
<p class="qo-help">의견 수와 관계없이 한 번에 모두 반영하고, 무엇을 어디서 고쳤는지 정리한 수정표도 함께 드려요.</p>
${uploader(S, 'questionnaire', { label: '만든 설문지', required: true, hint: '한글·워드·PDF, 온라인 설문 화면 캡처도 괜찮아요' })}
${fbField('교수님 의견', '받은 의견을 그대로 붙여 넣어 주세요.\n예: 1. 척도 출처를 밝히고 역문항을 표시할 것')}
${uploader(S, 'feedback', { label: '의견이 담긴 파일', hint: '메모가 적힌 설문지, 메일 캡처, 사진 모두 괜찮아요(붙여넣기와 둘 중 하나면 돼요)' })}`;
  }
  return '';
}

// 통계: 맨 위에서 데이터부터 받는다
function dataHtml() {
  return `${head('분석할 데이터를 올려 주세요')}
${uploader(S, 'data', { label: '데이터 파일', required: true, hint: 'Excel(xlsx, xls), CSV, SPSS(sav). 올리면 응답 수와 변수를 바로 확인해 드려요' })}
<div id="soDiag">${diagHtml(S.dataInfo)}</div>${piiNote}
<p class="so-nodata">데이터가 아직 없으세요? <a href="${url('/survey/new/')}">설문조사부터 맡기기</a><a href="${url('/statistics/new/')}?detail=1">분석 연습용 시뮬레이션</a></p>`;
}

function reqKind() {
  if (!isSurvey()) return 'statistics';
  if (S.mode === 'analyze') return 'analyze';
  return ['edit', 'feedback'].includes(S.mode) ? 'fix' : 'survey';
}
function reqHtml() {
  const k = reqKind();
  const help = {
    survey: '응답 대상, 원하는 인원, 꼭 넣고 싶은 변인처럼 알려 주실 것을 말하듯 적어 주세요. 모르는 것은 비워 두시면 주제에 맞게 정해 드려요.',
    analyze: '연구 가설이나 보고 싶은 분석을 말하듯 적어 주세요. 모르시면 비워 두셔도 가설에 맞는 분석을 정해 드려요.',
    fix: '특히 봐 줬으면 하는 부분이나 학교 기준을 말하듯 적어 주세요.',
    statistics: '변수와 가설, 보고 싶은 분석을 말하듯 적어 주세요. 분석 방법을 몰라도 괜찮아요. 주제와 데이터에 맞게 정해 드려요.',
  }[k];
  return `${head('원하시는 내용을 편하게 적어 주세요', '선택')}
<p class="qo-help">${help} 적은 내용은 주문서와 함께 담당자에게 그대로 전달돼요.</p>
<div class="qo-req-chips" role="group" aria-label="자주 적는 내용 한 줄 넣기">${REQ_CHIPS[k].map((c) => `<button type="button" class="qo-req-chip${S.request.includes(`${c}:`) ? ' is-on' : ''}" data-req="${esc(c)}">${esc(c)}</button>`).join('')}</div>
<div class="field qo-req"><textarea class="textarea qo-req-ta" id="soReq" rows="5" data-k="request" maxlength="${REQ_MAX}" aria-label="요청 사항" placeholder="${esc(REQ_PH[k])}">${esc(S.request)}</textarea>
<p class="qo-req-foot"><span>결제 뒤에 생각난 내용은 주문 페이지 메시지나 안내 메일 답장으로 보내 주세요.</span><span class="qo-req-n num${S.request.length > REQ_MAX * 0.9 ? ' is-near' : ''}" id="soReqN">${reqCount()}</span></p></div>
<div id="soNote" aria-live="polite">${noteHtml()}</div>`;
}
const reqCount = () => `${S.request.length.toLocaleString('ko-KR')} / ${REQ_MAX.toLocaleString('ko-KR')}자`;

// 기본 금액에 없는 분석을 적었을 때의 안내(고르게 하지 않고, 확인 뒤 추가 결제)
function noteHtml() {
  const xs = extras();
  if (!xs.length) return '';
  const adv = xs.find((x) => x.key === 'adv');
  const sem = xs.find((x) => x.key === 'sem');
  const advIt = findItem(CONFIG.catalog, 'T-ADV');
  const parts = [];
  if (adv) parts.push(`<p><b>매개·조절효과 분석은 ${advIt ? won(advIt.price) : '추가 금액'}이 더해져요.</b> 데이터를 확인하고 꼭 필요한 분석이면 추가 결제를 안내해 드릴게요.</p>`);
  if (sem) parts.push('<p><b>구조방정식처럼 모형이 복잡한 분석은 금액이 더 들어요.</b> 데이터와 모형을 확인하고 추가 금액을 먼저 알려 드릴게요. 금액을 보고 하실지 정하시면 돼요.</p>');
  parts.push('<p>지금은 기본 금액만 결제하시면 돼요.</p>');
  return `<div class="qo-nudge" role="status">${parts.join('')}</div>`;
}

function moreHtml() {
  const min = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  let up = '';
  if (isSurvey() && ['full', 'new'].includes(S.mode)) up = uploader(S, 'materials', { label: '연구계획서나 참고할 설문지', hint: '있으면 올려 주세요. 연구 설계와 문항을 거기에 맞춰요' });
  if (!isSurvey()) up = uploader(S, 'questionnaire', { label: '설문지나 변수 설명', hint: '있으면 변수 묶음과 역문항을 더 정확하게 맞춰요' });
  const on = (S.due ? 1 : 0) + (S.files || []).filter((f) => ['materials', 'questionnaire'].includes(f.slot) && !(isSurvey() && S.mode === 'analyze')).length;
  return `<details class="qo-more"${on ? ' open' : ''}><summary><span><b>더 알려 주실 것이 있나요?</b><small>${up ? '희망 완료일, 참고 자료' : '희망 완료일'}</small></span><em>선택</em></summary>
<div class="qo-more-in"><div class="field so-due"><label class="label" for="soDue">희망 완료일</label><input class="input" id="soDue" type="date" min="${min}" data-k="due" value="${esc(S.due)}"></div>
${up}</div></details>`;
}

function whoHtml() {
  const terms = `<p class="consent-note">의뢰하면 <a href="${url('/terms/')}" target="_blank">이용약관</a>, <a href="${url('/privacy/')}" target="_blank">개인정보 처리방침</a>, <a href="${url('/refund/')}" target="_blank">환불 규정</a>에 동의한 것으로 봐요. 나만을 위한 맞춤 작업이라 결제가 확인되면 바로 작업이 시작되고, 결과물 발송 전 취소는 결제 금액의 20%를 환불하며 발송 후에는 환불되지 않아요.${isSurvey() && S.mode !== 'analyze' ? ' 사람을 대상으로 하는 조사라 응답자 동의를 받고 응답 데이터는 익명으로 정리해요. 소속 기관의 IRB 심의가 필요한지도 함께 확인해 드려요.' : ''}</p>`;
  return `${head('결과물은 어디로 보내 드릴까요?')}
<div class="qo-contact">
<div class="field"><label class="label" for="soName">이름<span class="req">*</span></label><input class="input" id="soName" data-k="contact.name" maxlength="40" autocomplete="name" value="${esc(S.contact.name)}" placeholder="홍길동"></div>
<div class="field"><label class="label" for="soPhone">휴대전화<span class="req">*</span></label><input class="input" id="soPhone" data-k="contact.phone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" value="${esc(S.contact.phone)}" placeholder="010-0000-0000"></div>
<div class="field qo-mail"><label class="label" for="soEmail">이메일<span class="req">*</span></label><input class="input" id="soEmail" data-k="contact.email" type="email" maxlength="120" autocomplete="email" value="${esc(S.contact.email)}" placeholder="you@example.com"></div>
</div>
<p class="qo-note">진행 안내와 결과물을 이 메일로 보내 드려요. 결제 화면에는 이 연락처가 미리 채워져요. 다른 기기에서 주문을 조회할 때 비밀번호는 휴대전화 뒤 4자리예요.</p>
${terms}`;
}

function summaryHtml(q) {
  const m = mode();
  const flow = m.flow || (!isSurvey() && !m.fix ? C.flow : null);
  const hol = String((CONFIG.settings || {}).holidays || '').split(/[,\s]+/).filter(Boolean);
  const eta = q.days ? etaDate(new Date(), q.days, hol) : null;
  const when = S.mode === 'full' && isSurvey()
    ? `작업 기간은 영업일 ${q.days}일이에요. 응답을 모으는 기간은 따로 셈해요`
    : eta ? `영업일 ${q.days}일 이내 · 오늘 결제하면 <b>${eta.getMonth() + 1}월 ${eta.getDate()}일(${'일월화수목금토'[eta.getDay()]})</b>까지 전달` : '';
  const inc = includesFor(q.includes || []);
  return `<div class="qo-sum-hd"><span>결제 금액</span><span class="qo-sum-price"><b class="num">${won(q.total)}</b></span></div>
<p class="qo-sum-name"><b>${esc(m.name)}</b><span>${esc(m.what)}</span></p>
${flow ? `<ol class="qo-sum-flow">${flow.map(([b, s]) => `<li><b>${esc(b)}</b><span>${esc(s)}</span></li>`).join('')}</ol>` : ''}
${when ? `<p class="qo-sum-eta">${ICON.check}<span>${when}</span></p>` : ''}
${inc.length ? `<p class="qo-sum-inc"><b>포함</b>${inc.map((x) => esc(x)).join(' · ')}</p>` : ''}
${isSurvey() && S.recruit && ['full', 'new'].includes(S.mode) ? '<p class="qo-sum-inc"><b>따로 안내</b>응답자 모집 비용(확인 뒤 결정)</p>' : ''}
<button class="btn btn-primary btn-lg btn-block" type="submit" form="soForm">${won(q.total)} 결제하고 의뢰하기</button>
<p class="qo-sum-pay"><span>카드</span><span>간편결제</span><span>계좌이체</span></p>`;
}

// 오른쪽 미리보기: 설문은 설문 구성, 통계는 분석 순서
function planHtml() {
  const topic = S.topic.trim();
  if (isSurvey()) {
    if (!['full', 'new'].includes(S.mode) || topic.length < 2) return '';
    const r = readPrompt(topic);
    const fieldId = (guessField(S.major) || guessField(topic) || {}).id || 'other';
    let p;
    try { p = surveyPlan({ title: topic, keywords: r.keywords, fieldId, mode: S.mode }); } catch { return ''; }
    return `<div class="so-plan"><p class="so-plan-h">${ICON.spark}<b>설문 구성 미리보기</b><span>약 ${p.totalItems}문항 · 응답 약 ${p.minutes}분</span></p>
<ul>${p.sections.slice(1).map((x) => `<li><span>${esc(x.name)}</span><em>${x.items}문항</em></li>`).join('')}</ul>
<p class="so-plan-f">권장 표본 ${esc(p.nLabel)} · 최종 구성은 주제와 요청을 보고 정해요</p></div>`;
  }
  if (S.mode === 'revise') return '';
  const p = statsPlan({ methods: ['auto'], title: topic });
  const d = S.dataInfo && S.dataInfo.ok ? S.dataInfo : null;
  return `<div class="so-plan"><p class="so-plan-h">${ICON.spark}<b>분석 순서 미리보기</b>${d ? `<span>응답 ${d.n.toLocaleString('ko-KR')}명 · 변수 ${d.vars}개</span>` : ''}</p>
<ol>${p.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
<p class="so-plan-f">${topic ? '최종 분석은 데이터와 가설을 보고 정해요' : '연구 주제를 적으면 주제에 맞는 분석이 보여요'}</p></div>`;
}

/* ------------------------------------------------------------------ 갱신 */
function number() {
  let n = 0;
  for (const s of $$('.qo-sec', ROOT)) {
    const el = s.querySelector('.qo-n');
    const vis = !s.hidden && s.innerHTML.trim();
    if (el && vis) el.textContent = String(++n);
  }
}

function renderAll() {
  const keys = $$('[data-sec]', ROOT).map((s) => s.dataset.sec);
  const open = $('.qo-more', ROOT) && $('.qo-more', ROOT).open;
  for (const k of keys) {
    const el = sec(k);
    const html = { topic: topicHtml, pick: pickHtml, files: filesHtml, data: dataHtml, req: reqHtml, more: moreHtml, who: whoHtml }[k]();
    el.innerHTML = html;
    el.hidden = !html;
  }
  if (open && $('.qo-more', ROOT)) $('.qo-more', ROOT).open = true;
  number();
  refreshPrice();
}

function refreshPrice() {
  const q = quote();
  $('#soSum', ROOT).innerHTML = summaryHtml(q);
  $('#soSubmit', ROOT).textContent = `${won(q.total)} 결제하고 의뢰하기`;
  $('#soBar', ROOT).innerHTML = `<span class="qo-bar-p"><b class="num">${won(q.total)}</b><small>${esc(mode().name)}</small></span><button class="btn btn-primary" type="submit" form="soForm">결제하고 의뢰하기</button>`;
  refreshPlan();
}
const refreshPlan = debounce(() => { const el = $('#soPlan', ROOT); if (el) el.innerHTML = planHtml(); }, 300);
const refreshNote = debounce(() => { const el = $('#soNote', ROOT); if (el) el.innerHTML = noteHtml(); }, 350);

function reqMeta() {
  const n = $('#soReqN', ROOT);
  if (n) { n.textContent = reqCount(); n.classList.toggle('is-near', S.request.length > REQ_MAX * 0.9); }
  for (const b of $$('.qo-req-chip', ROOT)) b.classList.toggle('is-on', S.request.includes(`${b.dataset.req}:`));
}
// 항목 단추: 그 항목 줄이 없으면 맨 끝에 '항목: '을 새 줄로 넣고, 있으면 그 줄 끝으로 커서를 옮긴다
function addReqLine(label) {
  const ta = $('#soReq', ROOT);
  if (!ta) return;
  let v = ta.value;
  const at = v.indexOf(`${label}:`);
  let pos;
  if (at >= 0) {
    const end = v.indexOf('\n', at);
    pos = end < 0 ? v.length : end;
  } else {
    const base = v.replace(/\s+$/, '');
    const next = `${base ? `${base}\n` : ''}${label}: `;
    if (next.length > REQ_MAX) { toast(`요청 사항은 ${REQ_MAX.toLocaleString('ko-KR')}자까지 적을 수 있어요.`, { error: true }); return; }
    v = next;
    ta.value = v;
    pos = v.length;
    S.request = v;
    save();
  }
  ta.focus();
  try { ta.setSelectionRange(pos, pos); } catch { /* 무시 */ }
  reqMeta();
  refreshNote();
}

/* ------------------------------------------------------------------ 파일 */
async function addFiles(slot, list) {
  const maxMB = Number((CONFIG.settings && CONFIG.settings.maxFileMB) || 20);
  const errs = [];
  for (const file of list) {
    if ((S.files || []).length >= MAX_FILES) { errs.push(`한 주문에 ${MAX_FILES}개까지 올릴 수 있어요.`); break; }
    const er = checkFile(file, slot, maxMB);
    if (er) { errs.push(`${file.name}: ${er}`); continue; }
    if ((S.files || []).some((f) => f.slot === slot && f.name === file.name && f.size === file.size)) continue;
    const id = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await putBlob(id, file);
    S.files = [...(S.files || []), { id, slot, name: file.name, size: file.size, type: file.type || '', ext: extOf(file.name) }];
    if (slot === 'data') {
      try { S.dataInfo = await diagnoseData(file); } catch { S.dataInfo = null; }
    }
  }
  save();
  renderAll();
  if (errs.length) { const el = ROOT.querySelector(`[data-err="${slot}"]`); if (el) el.textContent = errs.join(' '); }
}
// 지금 고른 작업에서 쓰는 파일 칸
function activeSlots() {
  const s = new Set();
  if (isSurvey()) {
    if (S.mode === 'analyze') { s.add('data'); s.add('questionnaire'); }
    if (S.mode === 'edit') s.add('questionnaire');
    if (S.mode === 'feedback') { s.add('questionnaire'); s.add('feedback'); }
    if (['full', 'new'].includes(S.mode)) s.add('materials');
  } else {
    s.add('data'); s.add('questionnaire');
    if (S.mode === 'revise') { s.add('prevResult'); s.add('feedback'); }
  }
  return s;
}

/* ------------------------------------------------------------------ 검사·제출 */
// [눈에 띄게 할 칸(선택자), 안내 문구]
function validate() {
  const c = S.contact;
  const fbMode = (isSurvey() && S.mode === 'feedback') || (!isSurvey() && S.mode === 'revise');
  if (!isSurvey() && !hasFile('data')) return ['[data-up="data"] .drop', '분석할 데이터 파일을 올려 주세요.'];
  if (S.topic.trim().length < 2) return ['#soTopic', '연구 주제를 적어 주세요.'];
  if (isSurvey() && S.mode === 'analyze' && !hasFile('data')) return ['[data-up="data"] .drop', '모은 응답 파일을 올려 주세요.'];
  if (isSurvey() && ['edit', 'feedback'].includes(S.mode) && !hasFile('questionnaire')) return ['[data-up="questionnaire"] .drop', '만든 설문지 파일을 올려 주세요.'];
  if (!isSurvey() && S.mode === 'revise' && !hasFile('prevResult')) return ['[data-up="prevResult"] .drop', '기존 분석 결과 파일을 올려 주세요.'];
  if (fbMode && !hasFile('feedback') && !S.feedbackText.trim()) return ['#soFb', '교수님 의견을 붙여 넣거나 파일로 올려 주세요.'];
  if (!(c.name || '').trim()) return ['#soName', '이름을 적어 주세요.'];
  if ((c.phone || '').replace(/\D/g, '').length < 9) return ['#soPhone', '휴대전화 번호를 확인해 주세요.'];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((c.email || '').trim())) return ['#soEmail', '결과물을 받을 이메일 주소를 확인해 주세요.'];
  return null;
}

// 요청 사항 원문에 모집 희망을 한 줄 붙여 담당자가 바로 보게 한다
function requestText() {
  const lines = [S.request.trim()];
  if (isSurvey() && surveyRecruit() === 'ask') lines.push('[모집] 응답자 모집도 맡기고 싶어요(모집 비용은 확인 뒤 따로 안내)');
  return lines.filter(Boolean).join('\n');
}

function buildInput() {
  const topic = S.topic.trim().slice(0, 200);
  const r = readPrompt(topic);
  const fieldId = (guessField(S.major) || guessField(topic) || {}).id || 'other';
  const common = { purpose: '', fieldId, fieldText: S.major.trim(), topicKnown: 'yes', title: topic, keywords: r.keywords.slice(0, 5), due: S.due || '', request: requestText() };
  if (isSurvey()) {
    const m = S.mode;
    const deliver = [];
    if (['full', 'new', 'edit', 'feedback'].includes(m)) deliver.push('설문지(Word)');
    if (['full', 'new'].includes(m)) deliver.push('배포용 온라인 설문 링크와 참여 안내문');
    if (m === 'feedback') deliver.push('수정표와 반영 부분 파란색 표시본');
    if (m === 'full') deliver.push('익명화 응답 데이터');
    if (['full', 'analyze'].includes(m)) deliver.push('APA 형식 통계표', '논문 맞춤 결과 해석');
    if (m === 'full') deliver.push('연구결과 정리');
    return {
      common,
      survey: { mode: m, hasPlan: '', hasQuestionnaire: '', target: 'auto', targetOther: '', targetN: 'auto', recruit: surveyRecruit(), analysis: 'auto', feedbackText: m === 'feedback' ? S.feedbackText : '', advanced: false, sem: false, deliverables: deliver },
      addons: { priority: false, format: false, revisions: 0, ppt: false, editing: false },
    };
  }
  return {
    common,
    statistics: { hasData: true, noDataPath: '', methods: ['auto'], output: S.mode, variables: '', feedbackText: S.mode === 'revise' ? S.feedbackText : '', advanced: false, sem: false, messy: false, dataInfo: S.dataInfo ? JSON.stringify(compactInfo(S.dataInfo)).slice(0, 1900) : '' },
    addons: { priority: false, revisions: 0, ppt: false, editing: false },
  };
}

function buildDesign() {
  const topic = S.topic.trim().slice(0, 200);
  if (isSurvey()) {
    try {
      const r = readPrompt(topic);
      const p = surveyPlan({ title: topic, keywords: r.keywords, fieldId: (guessField(S.major) || guessField(topic) || {}).id || 'other', mode: S.mode });
      return { title: topic, designLabel: p.design.designLabel, methodLabel: '설문조사', population: p.design.parsed.population, sampleText: p.nLabel, vars: {}, hypotheses: [], titleCandidates: [] };
    } catch { return { title: topic, designLabel: '', methodLabel: '설문조사', population: '', sampleText: '', vars: {}, hypotheses: [], titleCandidates: [] }; }
  }
  const d = S.dataInfo && S.dataInfo.ok ? S.dataInfo : null;
  return { title: topic, designLabel: '통계분석', methodLabel: '연구 목적에 맞는 분석 추천', population: '', sampleText: d ? `응답 ${d.n}명` : '', vars: {}, hypotheses: [], titleCandidates: [] };
}

function submit() {
  const er = validate();
  const errEl = $('#soErr', ROOT);
  errEl.textContent = '';
  for (const x of $$('.is-invalid', ROOT)) x.classList.remove('is-invalid');
  if (er) {
    const [sel, msg] = er;
    const el = ROOT.querySelector(sel);
    errEl.textContent = msg;
    if (el) {
      el.classList.add('is-invalid');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el.focus && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) setTimeout(() => el.focus({ preventScroll: true }), 350);
    }
    toast(msg, { error: true });
    return;
  }
  if (S.hp) return;
  const q = quote();
  const slots = activeSlots();
  const keep = (f) => slots.has(f.slot);
  S.pin = S.contact.phone.replace(/\D/g, '').slice(-4);
  S.consents = { privacy: true, ethics: true, withdrawal: true, marketing: false };
  const view = { files: (S.files || []).filter(keep), links: (S.links || []).filter(keep), dropped: (S.files || []).filter((f) => !keep(f)).map((f) => f.id) };
  const state = new Proxy(S, { get: (t, k) => (k in view ? view[k] : t[k]) });
  submitOrder({ service: KIND, state, input: buildInput(), design: buildDesign(), quote: q, draftKey: C.key, payNow: true });
}

/* ------------------------------------------------------------------ 시작 */
export function startSimpleOrder(root, kind) {
  KIND = kind === 'statistics' ? 'statistics' : 'survey';
  C = SVC[KIND];
  ROOT = root;
  CONFIG = peekConfig();
  const params = new URLSearchParams(location.search);
  const saved = store.get(C.key);
  S = clone(DEF);
  const fromLink = ['title', 'mode', 'output'].some((k) => params.get(k));
  if (saved && saved.v === DEF.v) {
    if (!fromLink) S = { ...S, ...saved, contact: { ...DEF.contact, ...(saved.contact || {}) } };
    else S.contact = { ...DEF.contact, ...(saved.contact || {}) };
  }
  // 서비스 페이지·가격표에서 넘어온 값
  const m = params.get(KIND === 'survey' ? 'mode' : 'output');
  if (m && C.modes.some((x) => x.v === m)) S.mode = m;
  const title = (params.get('title') || '').trim().slice(0, 200);
  if (title) S.topic = title;
  if (!C.modes.some((x) => x.v === S.mode)) S.mode = C.def;
  shell(root);
  renderAll();
  bind();
  // 서버 가격표가 오면 카드 금액과 결제 금액만 다시 그린다(적고 있는 칸은 건드리지 않음)
  loadConfig().then((c) => {
    if (!(c && c.catalog)) return;
    CONFIG = c;
    const pick = sec('pick');
    if (pick && !pick.contains(document.activeElement)) { pick.innerHTML = pickHtml(); number(); }
    refreshPrice();
    refreshNote();
  });
  // 결제 화면에서 뒤로 돌아오면(bfcache) 금액 상자를 새로 그린다
  window.addEventListener('pageshow', (e) => { if (e.persisted) refreshPrice(); });
}

function setPath(path, v) {
  const ks = path.split('.');
  let o = S;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = v;
}

function bind() {
  const form = $('#soForm', ROOT);
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.link) {
      S.links = (S.links || []).filter((l) => l.slot !== t.dataset.link);
      if (t.value.trim()) S.links.push({ slot: t.dataset.link, url: t.value.trim() });
      save();
      return;
    }
    const k = t.dataset.k;
    if (!k || t.type === 'checkbox' || t.type === 'radio') return;
    setPath(k, t.value);
    t.classList.remove('is-invalid');
    save();
    if (k === 'topic') { refreshPlan(); refreshNote(); }
    if (k === 'request') { reqMeta(); refreshNote(); }
    if (k === 'feedbackText') { const h = $('#soFbN', ROOT); if (h) h.textContent = fbCount(S.feedbackText ? classifyFeedback(S.feedbackText).count : 0); }
  });
  form.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.name === 'soMode') {
      S.mode = t.value;
      save();
      renderAll();
    } else if (t.id === 'soRecruit') {
      S.recruit = t.checked;
      save();
      const pick = sec('pick');
      pick.innerHTML = pickHtml();
      number();
      refreshPrice();
    } else if (t.dataset.file) {
      await addFiles(t.dataset.file, Array.from(t.files || []));
      t.value = '';
    }
  });
  form.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-req]');
    if (chip) { e.preventDefault(); addReqLine(chip.dataset.req); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      e.preventDefault();
      const id = del.dataset.del;
      const f = (S.files || []).find((x) => x.id === id);
      S.files = (S.files || []).filter((x) => x.id !== id);
      if (f && f.slot === 'data' && !(S.files || []).some((x) => x.slot === 'data')) S.dataInfo = null;
      await delBlob(id);
      save();
      renderAll();
    }
  });
  form.addEventListener('dragover', (e) => { const d = e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('is-over'); } });
  form.addEventListener('dragleave', (e) => { const d = e.target.closest('[data-drop]'); if (d) d.classList.remove('is-over'); });
  form.addEventListener('drop', async (e) => {
    const d = e.target.closest('[data-drop]');
    if (!d) return;
    e.preventDefault(); d.classList.remove('is-over');
    await addFiles(d.dataset.drop, Array.from(e.dataTransfer.files || []));
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  // 휴대전화는 칸을 나올 때 하이픈을 넣어 보여 준다
  form.addEventListener('focusout', (e) => {
    const t = e.target;
    if (t.id !== 'soPhone') return;
    const d = t.value.replace(/[^0-9]/g, '');
    const v = d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : t.value;
    if (v !== t.value) { t.value = v; S.contact.phone = v; save(); }
  });
}
