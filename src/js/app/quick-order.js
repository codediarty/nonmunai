// 한 화면 논문 주문: 관심 주제와 논문 종류만 받고 바로 결제 화면으로 잇는다(전공은 선택, 양식·연구 방법 단계 없음)
// 처음 화면은 '논문 완성' 한 가지 길만 보여 주고, 첨삭·피드백 반영·연구계획서는 아래쪽 작은 링크로 고른다
// 논문 완성·연구계획서는 연락처를 받지 않는다(결제 화면에서 받음). 상품이 하나로 맞으면 결제 화면을 바로 연다.
// 원고 첨삭·피드백 반영은 원고 파일이 필요해 기존처럼 주문서를 먼저 접수한다.
import { submitOrder, uploader, ICON } from './wizard.js';
import { loadConfig, peekConfig } from './api.js';
import { computeQuote, findItem, paperItemCode, etaDate, includesFor, listPriceFor, offText, PROMO_NAME, pageLabel } from '../core/pricing.js';
import { readPrompt, TYPE_LABEL, DEMO_PROMPTS } from '../core/preview.js';
import { PAPER_TYPES, FIELDS, guessField } from '../core/kb.js';
import { classifyFeedback } from '../core/feedback.js';
import { analyzeDocument } from '../core/diagnose-doc.js';
import { mountPreview } from '../ui/paper-preview.js';
import { $, $$, esc, store, debounce, url, toast } from '../ui/dom.js';
import { won } from '../core/render.js';
import { putBlob, delBlob, checkFile, MAX_FILES, extOf } from './files.js';
import { productLinks } from './pay-plan.js';
import { shopUrl } from './shop-link.js';

const KEY = 'draft:quick';
const TASKS = [
  ['full', '논문 완성', '주제만 있으면 돼요'],
  ['proposal', '연구계획서', '심사용 계획서'],
  ['edit', '원고 첨삭', '이미 쓴 원고'],
  ['feedback', '교수님 피드백 반영', '수정표까지 포함'],
];
const PKG = {
  full: [
    { id: 'short15', typeId: 'short', pages: 15, t: '소논문', note: '과제·학회 발표' },
    { id: 'bachelor30', typeId: 'bachelor', pages: 30, t: '학사 졸업논문', note: '학부 졸업용' },
    { id: 'journal20', typeId: 'journal', pages: 20, t: '학술지 투고논문', note: 'KCI 투고 형식' },
    { id: 'master80', typeId: 'master', pages: 80, t: '석사학위논문', note: '가장 많이 선택', badge: true },
    { id: 'doctor130', typeId: 'doctor', pages: 130, t: '박사학위논문', note: '장별 집필 계획 포함' },
  ],
  proposal: [
    { id: 'pmaster', typeId: 'master', pages: 15, t: '석사 연구계획서', note: '가장 많이 선택', badge: true },
    { id: 'pdoctor', typeId: 'doctor', pages: 25, t: '박사 연구계획서', note: '장별 집필 계획 포함' },
    { id: 'pbachelor', typeId: 'bachelor', pages: 8, t: '학사 연구계획서', note: '졸업논문 준비' },
  ],
};
const EDIT_TYPES = ['master', 'doctor', 'journal', 'bachelor', 'report', 'youth', 'personal'];
const MAJORS = ['간호학', '사회복지학', '상담심리학', '교육학', '유아교육', '경영학', '행정학', '체육학', '관광경영학', '호텔경영학', '보건학', '물리치료학', '심리학', '신학', '컴퓨터공학', '미디어커뮤니케이션', '디자인', '음악', '경제학', '법학'];

// 연구 방법: 기본은 연구진이 알아서, 원하면 한 번 눌러 바꾼다(가격은 그대로)
const METHODS = [['auto', '알아서 정해 주세요'], ['survey', '설문·통계'], ['literature', '문헌연구'], ['qualitative', '면담·사례'], ['experiment', '실험·개발']];

const DEF = {
  v: 4, task: 'full', topic: '', major: '', pkg: 'master80',
  etype: 'master', epages: null, editScope: '', feedbackText: '',
  format: 'general', formatName: '',
  addons: { priority: false, ppt: false, english: false, format: false, revisions: 0 },
  outputFormat: 'docx', due: '', request: '', method: 'auto',
  files: [], links: [], contact: { name: '', email: '', phone: '' }, hp: '',
  touched: { pkg: false, major: false, epages: false }, docInfo: null,
};

let CONFIG = { catalog: null, settings: {} };
let S = null;
let PV = null;

const clone = (o) => JSON.parse(JSON.stringify(o));
const save = debounce(() => store.set(KEY, { ...S, saved: Date.now() }), 250);
const pkgList = () => PKG[S.task] || [];
const curPkg = () => pkgList().find((p) => p.id === S.pkg) || null;
const writeLike = () => S.task === 'full' || S.task === 'proposal';

// 지금 고른 논문 종류와 분량
function selection() {
  if (writeLike()) {
    const p = curPkg() || pkgList()[0];
    return { typeId: p.typeId, pages: p.pages };
  }
  const it = findItem(CONFIG.catalog, paperItemCode(S.etype, S.task));
  return { typeId: S.etype, pages: S.task === 'edit' ? (Number(S.epages) || (it ? it.baseUnits : null)) : null };
}

function quoteInput() {
  const { typeId, pages } = selection();
  const fb = S.task === 'feedback' && S.feedbackText ? classifyFeedback(S.feedbackText).count : null;
  const direct = isDirect();
  return {
    service: 'paper',
    paper: { typeId, task: S.task, pages, feedbackItems: fb },
    // 바로 결제(상품 하나)일 때는 유료 옵션을 붙이지 않는다
    addons: direct ? { priority: false, format: false, revisions: 0, ppt: false, english: false, editing: false } : {
      priority: !!S.addons.priority, format: !!S.addons.format, revisions: Number(S.addons.revisions || 0),
      ppt: !!S.addons.ppt, english: !!S.addons.english && S.task === 'full', editing: false,
    },
  };
}
const quote = () => computeQuote(CONFIG.catalog, quoteInput());
const pkgQuote = (p, task = S.task) => computeQuote(CONFIG.catalog, { service: 'paper', paper: { typeId: p.typeId, task, pages: p.pages } });

// 바로 결제: 논문 완성·연구계획서이고, 결제할 상품이 하나이며 상품 주소가 있을 때
function directLink() {
  if (!S || !writeLike()) return '';
  const s = CONFIG.settings || {};
  if (String(s.skkcEnabled) === 'false') return '';
  if (String(s.tossEnabled) === 'true' && s.tossClientKey) return '';
  // skkc.co.kr에 바로 결제 연결 코드를 넣은 뒤에만 켠다(설정 skkcProducts의 "_direct": "on")
  const links = productLinks(s);
  if (links._direct !== 'on') return '';
  const { typeId, pages } = selection();
  const q = computeQuote(CONFIG.catalog, { service: 'paper', paper: { typeId, task: S.task, pages } });
  if (q.quoteRequired || q.lines.length !== 1) return '';
  const code = q.lines[0].code;
  const it = findItem(CONFIG.catalog, code);
  const link = (it && it.payUrl) || links[code] || '';
  return /^https?:\/\//.test(link) ? link : '';
}
const isDirect = () => !!directLink();

/* ------------------------------------------------------------------ 화면 */
function shell(root) {
  root.innerHTML = `<div class="qo">
<div class="qo-hero"><div class="wrap qo-hero-in">
<h1 class="qo-h1">주제만 알려 주세요.<br>완성본으로 보내 드려요.</h1>
<p class="qo-lead">관심 주제를 적고 논문 종류만 고르면 결제 화면이 바로 열려요. 제목과 목차, 연구 방법은 같은 전공 박사가 정해 드려요.</p>
</div></div>
<div class="wrap qo-grid">
<form class="qo-form" id="qoForm" novalidate autocomplete="off">
<div class="qo-tabs" role="tablist" aria-label="필요한 작업" hidden>${TASKS.map(([v, t, d]) => `<button type="button" role="tab" class="qo-tab" data-task="${v}" aria-selected="false"><b>${t}</b><small>${d}</small></button>`).join('')}</div>
<section class="qo-sec" id="qoS1"></section>
<section class="qo-sec" id="qoS2"></section>
<section class="qo-sec qo-sec-more" id="qoMore"></section>
<section class="qo-sec" id="qoS4"></section>
<input type="text" name="hp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" data-k="hp">
<div class="qo-go"><p class="qo-err" id="qoErr" role="alert"></p>
<button class="btn btn-primary btn-lg btn-block qo-submit" type="submit" id="qoSubmit">결제하고 의뢰하기</button>
<p class="qo-safe">${ICON.check}<span>회원가입 없이 카드·간편결제·계좌이체 · 결제가 확인되면 바로 집필을 시작해요</span></p>
<p class="qo-safe qo-secret">${ICON.shield}<span>작업은 이름 대신 주문번호로 하고, 전달 후 90일이 지나면 자료를 모두 지워요.</span></p></div>
<p class="qo-other" id="qoOther"><span>다른 작업이 필요하세요?</span>${TASKS.filter(([v]) => v !== 'full').map(([v, t]) => `<button type="button" data-task="${v}">${t}</button>`).join('')}</p>
<section class="qo-mobile-pv" id="qoPvM" aria-label="내 논문 작성 미리보기"></section>
</form>
<aside class="qo-side" aria-label="내 논문 미리보기와 결제 금액"><div class="qo-side-in"><div id="qoPv"></div><div class="qo-sum" id="qoSum"></div></div></aside>
</div>
<div class="qo-mbar" id="qoBar"></div>
</div>`;
}

function taskTabs(root) {
  const tabs = $('.qo-tabs', root);
  if (tabs) tabs.hidden = S.task === 'full';
  const other = $('#qoOther', root);
  if (other) other.hidden = S.task !== 'full';
  for (const b of $$('.qo-tab', root)) {
    const on = b.dataset.task === S.task;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', String(on));
  }
}

function parseChips() {
  const r = readPrompt(S.topic);
  const chips = [];
  if (r.typeId) chips.push(TYPE_LABEL[r.typeId]);
  if (r.pages) chips.push(pageLabel(r.pages));
  if (r.major || S.major) chips.push(S.major || r.major);
  for (const k of r.keywords) chips.push(`#${k}`);
  return chips.length ? `<div class="qo-read"><span class="qo-read-l">${ICON.spark}AI가 읽은 내용</span>${chips.map((c) => `<span class="qo-chip">${esc(c)}</span>`).join('')}</div>` : '<div class="qo-read is-empty"><span class="qo-read-l">' + ICON.spark + '적은 내용에서 논문 종류, 분량, 키워드를 자동으로 읽어 드려요</span></div>';
}

function s1Html() {
  const majors = `<datalist id="qoMajors">${MAJORS.map((m) => `<option value="${m}">`).join('')}</datalist>`;
  if (!writeLike()) {
    const fb = S.task === 'feedback';
    return `<h2 class="qo-h"><span class="qo-n">1</span>원고를 올려 주세요</h2>
<p class="qo-help">${fb ? '원고와 교수님 의견을 주시면 의견 수와 관계없이 한 번에 모두 반영하고, 부족한 내용은 수정 보완, 고친 문장은 첨삭까지 해 드려요. 무엇을 어디서 고쳤는지 정리한 수정표도 함께 드려요.' : '문장과 논리, 인용과 형식을 다듬고 수정 내역을 표시한 파일과 깨끗한 정리본을 함께 드려요.'}</p>
${uploader(S, 'manuscript', { label: '기존 원고', required: true, hint: '한글·워드·PDF 모두 괜찮아요. 올리면 분량을 자동으로 계산해 드려요' })}
<div id="qoDoc">${docInfoHtml()}</div>
${fb ? `<div class="field"><label class="label" for="qoFb">교수님 의견<span class="req">*</span></label><textarea class="textarea" id="qoFb" rows="5" data-k="feedbackText" maxlength="8000" placeholder="받은 의견을 그대로 붙여 넣어 주세요.\n예: 1. 연구의 필요성에 최근 자료를 보완할 것">${esc(S.feedbackText)}</textarea><p class="hint" id="qoFbCount">${fbCountText()}</p></div>
${uploader(S, 'feedback', { label: '의견이 담긴 파일', hint: '메모가 적힌 원고, 메일 캡처, 사진 모두 괜찮아요(붙여넣기와 둘 중 하나면 돼요)' })}`
    : `<div class="field"><label class="label" for="qoScope">고칠 부분</label><input class="input" id="qoScope" data-k="editScope" maxlength="300" value="${esc(S.editScope)}" placeholder="비워 두시면 원고 전체의 문장·논리·형식을 다듬어 드려요"></div>`}
<div class="field"><label class="label" for="qoMajor">전공 분야</label><input class="input" id="qoMajor" data-k="major" list="qoMajors" maxlength="60" value="${esc(S.major)}" placeholder="나의 전공 분야를 입력하세요 (선택)">${majors}</div>`;
  }
  return `<h2 class="qo-h"><span class="qo-n">1</span>어떤 논문을 쓸까요?</h2>
<div class="field qo-topic"><label class="label" for="qoTopic">관심 주제나 키워드<span class="req">*</span></label>
<textarea class="textarea qo-ta" id="qoTopic" rows="3" data-k="topic" maxlength="200" placeholder="관심 주제나 키워드를 입력하세요">${esc(S.topic)}</textarea>
<p class="hint">예: 직장인 워라밸이랑 이직 관련해서 · 제목은 정하지 않아도 돼요.</p>
<div id="qoRead">${parseChips()}</div></div>
<div class="field"><label class="label" for="qoMajor">전공 분야 <span class="qo-opt">(선택)</span></label><input class="input" id="qoMajor" data-k="major" list="qoMajors" maxlength="60" value="${esc(S.major)}" placeholder="예: 간호학, 경영학, 사회복지학">${majors}<p class="hint">비워 두셔도 주제에 맞는 전공 박사가 맡아요.</p></div>`;
}

function priceTag(code, total) {
  const list = listPriceFor(code, total);
  return list ? `<s class="num">${won(list)}</s><em class="num">${offText(list, total, { short: true })}</em>` : '';
}

function pkgCard(p) {
  const q = pkgQuote(p);
  const on = S.pkg === p.id;
  const code = q.lines[0] ? q.lines[0].code : '';
  return `<label class="qo-pkg${on ? ' is-on' : ''}${p.badge ? ' is-pop' : ''}"><input type="radio" name="qoPkg" value="${p.id}"${on ? ' checked' : ''}><span class="qo-pkg-hd"><b>${esc(p.t)}</b><span class="qo-pkg-pg">${pageLabel(p.pages)}</span></span><span class="qo-pkg-w"><span class="qo-pkg-was">${priceTag(code, q.total)}</span><b class="num">${won(q.total)}</b></span><span class="qo-pkg-d">${p.badge ? `<em>${esc(p.note)}</em>` : esc(p.note)}</span><span class="qo-pkg-mk" aria-hidden="true">${ICON.check}</span></label>`;
}

function s2Html() {
  if (!writeLike()) {
    const opts = EDIT_TYPES.filter((t) => findItem(CONFIG.catalog, paperItemCode(t, S.task)));
    const it = findItem(CONFIG.catalog, paperItemCode(S.etype, S.task));
    const unitName = (u) => (u === '쪽' ? ' Page' : u);
    const unit = it && S.task === 'feedback' ? `피드백 전체 일괄 반영·수정표 포함 ${won(it.price)}, 항목 수와 관계없이 한 가격이에요` : it ? `${it.baseUnits}${unitName(it.unitLabel)} 기준 ${won(it.price)}${it.unitPrice ? `, ${it.unitSize}${unitName(it.unitLabel)}마다 ${won(it.unitPrice)}` : ''}` : '';
    return `<h2 class="qo-h"><span class="qo-n">2</span>어떤 논문인가요?</h2>
<div class="qo-seg" role="radiogroup" aria-label="논문 종류">${opts.map((t) => `<label class="qo-seg-i${S.etype === t ? ' is-on' : ''}"><input type="radio" name="qoEtype" value="${t}"${S.etype === t ? ' checked' : ''}>${esc((PAPER_TYPES.find((x) => x.id === t) || {}).short || t)}</label>`).join('')}</div>
<p class="hint">${esc(unit)}</p>
${S.task === 'edit' ? `<div class="field qo-pages"><label class="label" for="qoEpages">원고 분량(Page)</label><input class="input" id="qoEpages" type="number" inputmode="numeric" min="1" max="999" data-k="epages" value="${S.epages ?? ''}" placeholder="원고를 올리면 자동으로 채워집니다"></div>` : ''}`;
  }
  return `<h2 class="qo-h"><span class="qo-n">2</span>${S.task === 'proposal' ? '어떤 계획서가 필요하세요?' : '어떤 논문이 필요하세요?'}<span class="qo-h-tag">${PROMO_NAME}</span></h2>
<div class="qo-pkgs">${pkgList().map(pkgCard).join('')}</div>
<p class="hint qo-pkg-note">학교 기준 분량이 다르면 요청 사항에 적어 주세요. 확인하고 맞춰 드려요.</p>`;
}

// 양식 단계는 두지 않는다: 기본은 일반 학위논문 양식(APA 7판), 학교 양식은 결제 후 주문 페이지나 요청 사항으로 받는다
function moreHtml() {
  const direct = isDirect();
  const cat = CONFIG.catalog;
  const ppt = findItem(cat, 'A-PPT'), en = findItem(cat, 'A-ENGLISH'), pr = findItem(cat, 'A-PRIORITY'), fm = findItem(cat, 'A-FORMAT'), rv = findItem(cat, 'A-REVISION');
  const { pages } = selection();
  const enBlocks = en ? Math.max(1, Math.ceil((Number(pages) || 20) / (Number(en.unitSize) || 10))) : 0;
  const prOff = CONFIG.settings && String(CONFIG.settings.priorityEnabled) === 'false';
  const box = (key, title, price, desc, off = false) => `<label class="qo-add${S.addons[key] ? ' is-on' : ''}${off ? ' is-off' : ''}"><input type="checkbox" data-add="${key}"${S.addons[key] ? ' checked' : ''}${off ? ' disabled' : ''}><span class="qo-add-mk" aria-hidden="true">${ICON.check}</span><span class="qo-add-t"><b>${title}</b><small>${desc}</small></span><span class="qo-add-p num">+${won(price)}</span></label>`;
  const paid = direct ? 0 : Object.entries(S.addons).filter(([k, v]) => v && k !== 'revisions').length + (Number(S.addons.revisions) ? 1 : 0);
  const on = paid + (S.files || []).filter((f) => f.slot === 'materials').length + (S.request.trim() ? 1 : 0);
  const sub = direct ? '학교 양식, 원하는 연구 방법, 받을 파일, 제출 일정' : '심사 발표 PPT, 우선 처리, 참고 자료, 요청 사항';
  return `<details class="qo-more"${on ? ' open' : ''}><summary><span><b>더 알려 주실 것이 있나요?</b><small>${sub}</small></span><em>선택</em></summary>
<div class="qo-more-in">
${direct ? '' : `<div class="qo-adds">
${ppt ? box('ppt', '심사 발표 PPT·PDF', ppt.price, '발표 자료 15~20장(PPT·PDF)과 장표별 스크립트') : ''}
${pr ? box('priority', '우선 처리', pr.price, prOff ? '지금은 작업 일정상 받을 수 없어요' : '작업 순서를 앞당겨 더 빨리 보내 드려요', prOff) : ''}
${en && S.task === 'full' ? box('english', '영문 논문으로 작성', en.unitPrice * enBlocks, `${en.unitSize} Page마다 ${won(en.unitPrice)}, 지금 분량 기준 ${enBlocks}단위`) : ''}
${fm && S.task !== 'feedback' ? box('format', '학교 양식 상세 적용', fm.price, '여백, 글꼴, 표·그림, 목차 서식까지 제출 양식에 맞춰 드려요') : ''}
${rv ? `<label class="qo-add qo-add-sel"><span class="qo-add-t"><b>추가 수정</b><small>기본 포함 수정 1회 외에 더 받을 횟수</small></span><select class="select" data-k="addons.revisions"><option value="0"${!Number(S.addons.revisions) ? ' selected' : ''}>추가 안 함</option><option value="1"${Number(S.addons.revisions) === 1 ? ' selected' : ''}>1회 +${won(rv.price)}</option><option value="2"${Number(S.addons.revisions) === 2 ? ' selected' : ''}>2회 +${won(rv.price * 2)}</option></select></label>` : ''}
</div>`}
<div class="row-2 qo-row"><div class="field"><label class="label" for="qoOut">받을 파일</label><select class="select" id="qoOut" data-k="outputFormat"><option value="docx"${S.outputFormat === 'docx' ? ' selected' : ''}>워드(docx)</option><option value="hwp"${S.outputFormat === 'hwp' ? ' selected' : ''}>한글(hwp)</option><option value="pdf"${S.outputFormat === 'pdf' ? ' selected' : ''}>PDF</option></select></div>
<div class="field"><label class="label" for="qoDue">제출 일정 (선택)</label><input class="input" id="qoDue" type="date" data-k="due" value="${esc(S.due)}"></div></div>
${!direct && writeLike() ? uploader(S, 'materials', { label: '참고할 자료', hint: '선행연구, 메모, 설문지, 데이터 등이 있으면 올려 주세요' }) : ''}
<div class="field"><label class="label" for="qoReq">요청 사항</label><textarea class="textarea" id="qoReq" rows="3" data-k="request" maxlength="1500" placeholder="예: 설문 연구로 해 주세요. ○○대학교 양식이에요. 최근 5년 국내 논문 위주로 부탁드려요.">${esc(S.request)}</textarea>${writeLike() ? `<p class="hint">원하는 연구 방법이나 학교 이름을 적어 주세요. 비워 두시면 주제에 맞춰 정해 드려요.${direct ? ' 학교 양식 파일과 참고 자료는 결제 후 주문 페이지에서 올리시면 돼요.' : ''}</p>` : ''}</div>
</div></details>`;
}

function s4Html() {
  const terms = `<p class="consent-note">의뢰하면 <a href="${url('/terms/')}" target="_blank">이용약관</a>, <a href="${url('/privacy/')}" target="_blank">개인정보 처리방침</a>, <a href="${url('/refund/')}" target="_blank">환불 규정</a>에 동의한 것으로 봐요. 나만을 위한 맞춤 제작이라 결제가 확인되면 바로 작업이 시작되고, 완성본 발송 전 취소는 결제 금액의 20%를 환불하며 발송 후에는 환불되지 않아요.</p>`;
  if (isDirect()) return terms;
  return `<h2 class="qo-h"><span class="qo-n">3</span>결과물은 어디로 보내 드릴까요?</h2>
<div class="qo-contact">
<div class="field"><label class="label" for="qoName">이름<span class="req">*</span></label><input class="input" id="qoName" data-k="contact.name" maxlength="40" autocomplete="name" value="${esc(S.contact.name)}" placeholder="홍길동"></div>
<div class="field"><label class="label" for="qoPhone">휴대전화<span class="req">*</span></label><input class="input" id="qoPhone" data-k="contact.phone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" value="${esc(S.contact.phone)}" placeholder="010-0000-0000"></div>
<div class="field qo-mail"><label class="label" for="qoEmail">이메일<span class="req">*</span></label><input class="input" id="qoEmail" data-k="contact.email" type="email" maxlength="120" autocomplete="email" value="${esc(S.contact.email)}" placeholder="you@example.com"></div>
</div>
<p class="qo-note">진행 안내와 결과물을 이 메일로 보내 드려요. 다른 기기에서 주문을 조회할 때 비밀번호는 휴대전화 뒤 4자리예요.</p>
${terms}`;
}

function docInfoHtml() {
  const i = S.docInfo;
  if (!i) return '';
  if (!i.ok) return `<p class="hint">${esc(i.message || '')}</p>`;
  return `<p class="qo-docinfo">${ICON.spark}<span><b>${esc(i.name || '원고')}</b> · 약 ${pageLabel(i.pages)}${i.references ? ` · 참고문헌 ${i.references}건` : ''}</span></p>`;
}
function fbCountText() {
  const n = S.feedbackText ? classifyFeedback(S.feedbackText).count : 0;
  return n ? `의견 ${n}개 항목을 모두 반영해 드려요. 항목 수와 관계없이 금액은 같아요.` : '붙여 넣으면 의견을 항목별로 나눠 빠짐없이 반영해 드려요.';
}

function orderLabel() {
  const { typeId, pages } = selection();
  const p = curPkg();
  return writeLike()
    ? `${p ? p.t : (TYPE_LABEL[typeId] || '논문')} ${pageLabel(pages)}`.trim()
    : `${(PAPER_TYPES.find((t) => t.id === typeId) || {}).short || ''} ${S.task === 'edit' ? '원고 첨삭·교정' : '피드백 반영·수정 보완·첨삭'}`.trim();
}
const verb = () => ({ edit: '첨삭 의뢰하기', feedback: '반영 의뢰하기', proposal: '의뢰하기', full: '의뢰하기' }[S.task]);

function summaryHtml(q) {
  const { pages } = selection();
  const code = q.lines[0] ? q.lines[0].code : '';
  const list = listPriceFor(code, q.total);
  const task = { full: '전체 구성·본문 완성', proposal: '연구계획서 작성', edit: '문장·논리·형식 교정', feedback: '피드백 일괄 반영·수정표 포함' }[S.task];
  const extras = q.lines.filter((l) => /^A-/.test(l.code));
  const eta = q.days ? etaDate(new Date(), q.days, String((CONFIG.settings || {}).holidays || '').split(/[,\s]+/).filter(Boolean)) : null;
  const inc = includesFor(q.includes, pages);
  return `<div class="qo-sum-hd"><span>결제 금액</span><span class="qo-sum-price">${list ? `<s class="num">${won(list)}</s><em>${offText(list, q.total)}</em>` : ''}<b class="num">${won(q.total)}</b></span></div>
<p class="qo-sum-name"><b>${esc(orderLabel())}</b><span>${list ? `${PROMO_NAME} · ` : ''}${esc(task)}</span></p>
${extras.length ? `<ul class="qo-sum-x">${extras.map((l) => `<li><span>${esc(l.name)}</span><b class="num">+${won(l.amount)}</b></li>`).join('')}</ul>` : ''}
${writeLike() ? '<ol class="qo-sum-flow"><li><b>AI 집필</b><span>실존 문헌 인용</span></li><li><b>전공 박사 검수</b><span>설계·문헌·수치·형식</span></li><li><b>메일 전달</b><span>검수 완료본</span></li></ol>' : ''}
${eta ? `<p class="qo-sum-eta">${ICON.check}<span>박사 검수까지 영업일 ${q.days}일 이내 · 오늘 결제하면 <b>${eta.getMonth() + 1}월 ${eta.getDate()}일(${'일월화수목금토'[eta.getDay()]})</b>까지 전달</span></p>` : ''}
${inc.length ? `<p class="qo-sum-inc"><b>포함</b>${inc.map((x) => esc(x)).join(' · ')}</p>` : ''}
<button class="btn btn-primary btn-lg btn-block" type="submit" form="qoForm">${won(q.total)} 결제하고 ${verb()}</button>
<p class="qo-sum-pay"><span>카드</span><span>간편결제</span><span>계좌이체</span></p>`;
}

/* ------------------------------------------------------------------ 갱신 */
let ROOT = null;
const previewInfo = () => {
  const r = readPrompt(S.topic);
  const { typeId, pages } = selection();
  return { ...r, typeId, pages, task: S.task, major: S.major.trim() || r.major };
};
const refreshPreview = debounce(() => {
  if (!PV) return;
  if (!writeLike()) return;
  PV.forEach((p) => p.update(previewInfo()));
}, 650);

function refreshPrice() {
  const q = quote();
  const code = q.lines[0] ? q.lines[0].code : '';
  const list = listPriceFor(code, q.total);
  $('#qoSum', ROOT).innerHTML = summaryHtml(q);
  $('#qoSubmit', ROOT).textContent = `${won(q.total)} 결제하고 ${verb()}`;
  $('#qoBar', ROOT).innerHTML = `<span class="qo-bar-p">${list ? `<s class="num">${won(list)}</s>` : ''}<b class="num">${won(q.total)}</b></span><button class="btn btn-primary" type="submit" form="qoForm">결제하고 ${verb()}</button>`;
  for (const lab of $$('.qo-pkg', ROOT)) lab.classList.toggle('is-on', lab.querySelector('input').checked);
}

// 바로 결제 여부가 바뀌면(설정을 늦게 받는 경우 등) 양식·더 알려 주실 것·연락처 칸을 다시 그린다
let LAST_DIRECT = null;
function refreshFlow(force = false) {
  const d = isDirect();
  if (!force && d === LAST_DIRECT) return;
  LAST_DIRECT = d;
  const open = $('.qo-more', ROOT) && $('.qo-more', ROOT).open;
  $('#qoMore', ROOT).innerHTML = moreHtml();
  if (open && $('.qo-more', ROOT)) $('.qo-more', ROOT).open = true;
  $('#qoS4', ROOT).innerHTML = s4Html();
  ROOT.classList.toggle('is-direct', d);
}

function editSample() {
  return `<div class="pv pv-edit"><div class="pv-top"><span class="pv-live"><i aria-hidden="true"></i><span>${S.task === 'edit' ? '첨삭 결과 미리보기' : '피드백 반영 미리보기'}</span></span><span class="pv-meta">예시</span></div>
<div class="pv-stage"><div class="pv-sheet"><p class="pv-kick">수정 내역 표시본</p>
<p class="pv-txt">MZ세대 직장인의 이직은 <del>회사에 큰 손해다</del><ins>숙련 인력의 손실과 남은 구성원의 업무 부담으로 이어진다</ins><cite class="pv-cite"><span class="pv-cite-a">Hom</span> et al., 2017<i>${ICON.check}</i></cite>. <del>그래서</del><ins>이에 따라</ins> 이직의도에 영향을 미치는 요인을 <ins>체계적으로</ins> 살펴볼 필요가 있다.</p>
${S.task === 'feedback' ? '<table class="pv-rev"><thead><tr><th>교수님 의견</th><th>반영 내용</th><th>위치</th></tr></thead><tbody><tr><td>최근 자료 보완</td><td>최근 5년 국내 실태 자료 추가</td><td>1장 1절</td></tr><tr><td>표 형식 통일</td><td>APA 7판 형식으로 정리</td><td>4장</td></tr></tbody></table>' : ''}
<div class="pv-lockzone is-on is-locked"><div class="pv-mosaic"><div class="pv-mz-in"><p class="pv-txt">원고 전체의 문장과 논리 흐름, 인용과 참고문헌 형식을 함께 다듬고, 고친 부분은 색으로 표시해 한눈에 확인할 수 있게 정리해 드려요. 수정 내역 표시본과 깨끗한 정리본을 함께 드려요.</p><p class="pv-txt">제2장 이론적 배경의 문단 순서를 바로잡고 중복 서술을 줄였으며, 연구 가설과 분석 방법의 용어를 통일했습니다.</p></div></div>
<div class="pv-lock"><span class="pv-lock-ic">${ICON.check}</span>${S.task === 'feedback' ? '<b>받은 의견을 하나하나 이렇게 반영해 드려요</b><small>수정표 + 반영 표시본 + 최종 정리본 · 메일로 전달</small>' : '<b>원고 전체를 이렇게 다듬어 드려요</b><small>수정 표시본 + 깨끗한 정리본 · 메일로 전달</small>'}</div></div>
</div></div></div>`;
}

function renderTask() {
  taskTabs(ROOT);
  $('#qoS1', ROOT).innerHTML = s1Html();
  $('#qoS2', ROOT).innerHTML = s2Html();
  refreshFlow(true);
  const editLike = !writeLike();
  ROOT.classList.toggle('is-edit', editLike);
  if (editLike) {
    $('#qoPv', ROOT).innerHTML = editSample();
    $('#qoPvM', ROOT).innerHTML = '';
    PV = null;
  } else if (!PV) {
    PV = [mountPreview($('#qoPv', ROOT)), mountPreview($('#qoPvM', ROOT))];
  }
  refreshPrice();
  refreshPreview();
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
    if (slot === 'manuscript' && /\.(docx|hwpx|pdf|txt)$/i.test(file.name)) {
      try {
        const info = await analyzeDocument(file);
        S.docInfo = { ...info, name: file.name };
        if (info && info.ok && info.pages && !S.touched.epages) S.epages = info.pages;
      } catch { /* 분석 실패는 무시 */ }
    }
  }
  save();
  rerenderUploads();
  if (errs.length) { const el = ROOT.querySelector(`[data-err="${slot}"]`); if (el) el.textContent = errs.join(' '); }
}
function rerenderUploads() {
  // 파일 칸이 있는 구역만 다시 그린다(입력 중인 글자는 그대로)
  const openMore = $('.qo-more', ROOT) && $('.qo-more', ROOT).open;
  $('#qoS1', ROOT).innerHTML = s1Html();
  $('#qoS2', ROOT).innerHTML = s2Html();
  $('#qoMore', ROOT).innerHTML = moreHtml();
  if (openMore && $('.qo-more', ROOT)) $('.qo-more', ROOT).open = true;
  refreshPrice();
}
const activeSlots = () => {
  const s = new Set();
  if (!writeLike()) s.add('manuscript');
  if (S.task === 'feedback') s.add('feedback');
  if (writeLike()) s.add('materials');
  return s;
};
const hasFile = (slot) => (S.files || []).some((f) => f.slot === slot) || (S.links || []).some((l) => l.slot === slot && /^https?:\/\//.test(l.url || ''));

/* ------------------------------------------------------------------ 검사·제출 */
function validate() {
  const c = S.contact;
  if (writeLike()) {
    if (S.topic.trim().length < 2) return ['qoTopic', '관심 주제나 키워드를 한 가지 이상 적어 주세요.'];
    if (isDirect()) return null;
  } else {
    if (!hasFile('manuscript')) return ['qoS1', '기존 원고 파일을 올려 주세요.'];
    if (S.task === 'feedback' && !hasFile('feedback') && !S.feedbackText.trim()) return ['qoFb', '교수님 의견을 붙여 넣거나 파일로 올려 주세요.'];
  }
  if (!(c.name || '').trim()) return ['qoName', '이름을 적어 주세요.'];
  if ((c.phone || '').replace(/\D/g, '').length < 9) return ['qoPhone', '휴대전화 번호를 확인해 주세요.'];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((c.email || '').trim())) return ['qoEmail', '결과물을 받을 이메일 주소를 확인해 주세요.'];
  return null;
}

function buildInput() {
  const r = readPrompt(S.topic);
  const { typeId, pages } = selection();
  const q = quoteInput();
  const fieldId = (guessField(S.major) || guessField(S.topic) || {}).id || 'other';
  const school = S.task !== 'feedback' && S.format === 'school';
  const formatSent = school && hasFile('format') && !isDirect();
  const notes = [];
  if (school && !formatSent) notes.push('[양식] 학교 양식은 나중에 따로 보낼 예정');
  const request = [S.request.trim(), ...notes].filter(Boolean).join('\n');
  return {
    common: {
      fieldId, fieldText: S.major.trim(), school: school ? S.formatName.trim() : '', topicKnown: writeLike() ? 'free' : '',
      title: writeLike() ? S.topic.trim().slice(0, 200) : '', keywords: r.keywords.slice(0, 5),
      method: writeLike() && METHODS.some(([v]) => v === S.method) ? S.method : 'auto', due: S.due || '', outputFormat: S.outputFormat, request,
    },
    paper: {
      typeId, task: S.task, pages, feedbackItems: q.paper.feedbackItems, hasToc: 'no', tocText: '',
      hasFormat: formatSent ? 'yes' : 'no', formatName: formatSent ? S.formatName.trim() : '',
      feedbackText: S.task === 'feedback' ? S.feedbackText : '', editScope: S.task === 'edit' ? (S.editScope.trim() || '원고 전체 문장·논리·형식') : '', needsData: false,
    },
    addons: q.addons,
  };
}

// 바로 결제: 진행 순서를 보여 주며 결제 화면을 연다(연락처는 결제 화면에서 받는다)
function goPay(href, q) {
  const code = q.lines[0] ? q.lines[0].code : '';
  const list = listPriceFor(code, q.total);
  const host = document.createElement('div');
  host.className = 'modal-back';
  host.innerHTML = `<div class="modal go-modal" role="dialog" aria-modal="true" aria-label="논문 의뢰 접수">
<div class="go-hd"><p class="go-kick">논문 의뢰 접수</p><h2>${esc(orderLabel())}</h2><p class="go-price">${list ? `<s class="num">${won(list)}</s><em>${offText(list, q.total, { short: true })}</em>` : ''}<b class="num">${won(q.total)}</b></p></div>
<ol class="go-steps">
<li><b>주제 분석과 연구 설계</b><span>결제가 확인되면 바로 시작해요</span></li>
<li><b>실존 문헌 검증과 AI 집필</b><span>장별 본문을 쓰고 인용을 하나하나 연결해요</span></li>
<li><b>전공 분야 박사 최종 검수</b><span>설계, 문헌, 수치, 형식을 한 줄씩 확인해요</span></li>
<li><b>검수 완료본 메일 전달</b><span>결제할 때 적으신 이메일로 보내 드려요</span></li>
</ol>
<p class="go-foot" role="status"><span class="spin" aria-hidden="true"></span><span>결제 화면을 여는 중이에요</span></p>
</div>`;
  document.body.appendChild(host);
  setTimeout(() => { location.href = href; }, 1000);
  // 결제 화면에서 뒤로 오면 창을 닫는다
  window.addEventListener('pageshow', () => host.remove(), { once: true });
}

function submit() {
  const er = validate();
  const errEl = $('#qoErr', ROOT);
  errEl.textContent = '';
  for (const x of $$('.is-invalid', ROOT)) x.classList.remove('is-invalid');
  if (er) {
    const [id, msg] = er;
    const el = document.getElementById(id);
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
  const link = directLink();
  if (link) {
    const code = q.lines[0] ? q.lines[0].code : '';
    const href = shopUrl(link, {
      kind: 'new', service: 'paper', input: buildInput(), code, price: q.total, list: listPriceFor(code, q.total),
      label: orderLabel(), topic: S.topic.trim().slice(0, 120),
    });
    store.set(KEY, { ...S, sentAt: Date.now() });
    goPay(href, q);
    return;
  }
  const slots = activeSlots();
  const keep = (f) => slots.has(f.slot);
  const digits = S.contact.phone.replace(/\D/g, '');
  const sub = S;
  sub.pin = digits.slice(-4);
  sub.consents = { privacy: true, ethics: true, withdrawal: true, marketing: false };
  const view = { files: (S.files || []).filter(keep), links: (S.links || []).filter(keep), dropped: (S.files || []).filter((f) => !keep(f)).map((f) => f.id) };
  const state = new Proxy(sub, { get: (t, k) => (k in view ? view[k] : t[k]) });
  submitOrder({ service: 'paper', state, input: buildInput(), design: null, quote: q, draftKey: KEY, payNow: true });
}

/* ------------------------------------------------------------------ 시작 */
export async function startQuickOrder(root) {
  ROOT = root;
  CONFIG = peekConfig();
  const params = new URLSearchParams(location.search);
  // 홈 예시 문장을 그대로 들고 오면 빈 칸으로 시작한다(예시는 예시일 뿐)
  const promptP = (params.get('prompt') || '').trim();
  const promptOwn = promptP && !DEMO_PROMPTS.includes(promptP) ? promptP : '';
  const fromLink = !!promptOwn || ['title', 'type', 'pages', 'task', 'field', 'major'].some((k) => params.get(k));
  const saved = store.get(KEY);
  S = clone(DEF);
  if (!fromLink && saved && saved.v === DEF.v) S = { ...S, ...saved, addons: { ...DEF.addons, ...(saved.addons || {}) }, contact: { ...DEF.contact, ...(saved.contact || {}) }, touched: { ...DEF.touched, ...(saved.touched || {}) } };
  else if (saved && saved.v === DEF.v) S.contact = { ...DEF.contact, ...(saved.contact || {}) };
  if (DEMO_PROMPTS.includes(S.topic)) S.topic = '';
  // 양식은 고르는 단계가 없어졌다(예전에 저장된 '학교 양식' 선택은 쓰지 않는다)
  S.format = 'general';
  // 홈 프롬프트·가격 카드·서비스 페이지에서 넘어온 값
  const task = params.get('task');
  if (task && TASKS.some(([v]) => v === task)) S.task = task;
  const topic = (promptOwn || params.get('title') || '').slice(0, 200);
  if (topic) S.topic = topic;
  const methodP = params.get('method');
  if (methodP && METHODS.some(([v]) => v === methodP)) S.method = methodP;
  const r = readPrompt(S.topic);
  const field = params.get('field');
  const major = params.get('major') || (field && field !== 'other' && (FIELDS.find((f) => f.id === field) || {}).label) || r.major;
  if (major && !S.major) S.major = major.replace(/·.*$/, '');
  const typeP = params.get('type') || r.typeId;
  const pagesP = Math.round(Number(params.get('pages'))) || r.pages;
  if (S.task === 'full' && (typeP || pagesP)) {
    const t = typeP || 'master';
    const hit = PKG.full.find((p) => p.typeId === t && (!pagesP || p.pages === pagesP)) || PKG.full.find((p) => p.typeId === t);
    if (hit) S.pkg = hit.id;
    S.touched.pkg = true;
  } else if (S.task === 'proposal' && typeP) {
    const hit = PKG.proposal.find((p) => p.typeId === typeP);
    if (hit) S.pkg = hit.id;
  } else if ((S.task === 'edit' || S.task === 'feedback') && typeP && EDIT_TYPES.includes(typeP)) S.etype = typeP;
  if (writeLike() && !pkgList().some((p) => p.id === S.pkg)) S.pkg = S.task === 'proposal' ? 'pmaster' : 'master80';

  shell(root);
  renderTask();
  bind();
  loadConfig().then((c) => {
    if (!(c && c.catalog)) return;
    CONFIG = c;
    $('#qoS2', ROOT).innerHTML = s2Html();
    refreshFlow(true);
    refreshPrice();
  });
  // 결제 화면에서 뒤로 돌아오면(bfcache) 버튼 상태를 새로 그린다
  window.addEventListener('pageshow', (e) => { if (e.persisted) refreshPrice(); });
}

function setPath(path, v) {
  const ks = path.split('.');
  let o = S;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = v;
}

function bind() {
  const form = $('#qoForm', ROOT);
  const onTopic = () => {
    const r = readPrompt(S.topic);
    const read = $('#qoRead', ROOT);
    if (read) read.innerHTML = parseChips();
    // 적은 내용에 종류·분량이 있으면 고르기 전까지 그에 맞춘다
    if (!S.touched.pkg && S.task === 'full' && (r.typeId || r.pages)) {
      const hit = PKG.full.find((p) => p.typeId === (r.typeId || 'master') && (!r.pages || p.pages === r.pages)) || PKG.full.find((p) => p.typeId === r.typeId);
      if (hit && hit.id !== S.pkg) { S.pkg = hit.id; $('#qoS2', ROOT).innerHTML = s2Html(); refreshFlow(); refreshPrice(); }
    }
    if (!S.touched.major && r.major && !S.major.trim()) { S.major = r.major; const m = $('#qoMajor', ROOT); if (m) m.value = r.major; }
  };
  form.addEventListener('input', (e) => {
    const t = e.target;
    const k = t.dataset.k;
    if (!k) return;
    if (t.type === 'checkbox') return;
    let v = t.value;
    if (t.type === 'number') v = t.value === '' ? null : Number(t.value);
    setPath(k, v);
    if (k === 'major') S.touched.major = true;
    if (k === 'epages') S.touched.epages = true;
    t.classList.remove('is-invalid');
    save();
    if (k === 'topic') { onTopic(); refreshPreview(); }
    if (k === 'major') refreshPreview();
    if (k === 'feedbackText') { const h = $('#qoFbCount', ROOT); if (h) h.textContent = fbCountText(); refreshPrice(); }
    if (k === 'epages') refreshPrice();
  });
  form.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.name === 'qoPkg') {
      S.pkg = t.value; S.touched.pkg = true;
      save(); refreshFlow(); refreshPrice(); refreshPreview();
    } else if (t.name === 'qoEtype') {
      S.etype = t.value; save(); $('#qoS2', ROOT).innerHTML = s2Html(); refreshPrice();
    } else if (t.dataset.add) {
      S.addons[t.dataset.add] = t.checked; t.closest('.qo-add').classList.toggle('is-on', t.checked); save(); refreshPrice();
    } else if (t.tagName === 'SELECT' && t.dataset.k) {
      setPath(t.dataset.k, t.dataset.k === 'addons.revisions' ? Number(t.value) : t.value);
      save();
      refreshPrice();
    } else if (t.dataset.file) {
      await addFiles(t.dataset.file, Array.from(t.files || []));
      t.value = '';
    }
  });
  form.addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-task]');
    if (tab) {
      if (tab.dataset.task === S.task) return;
      S.task = tab.dataset.task;
      if (S.task === 'full' && !PKG.full.some((p) => p.id === S.pkg)) S.pkg = 'master80';
      if (S.task === 'proposal' && !PKG.proposal.some((p) => p.id === S.pkg)) S.pkg = 'pmaster';
      save(); renderTask();
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      e.preventDefault();
      const id = del.dataset.del;
      S.files = (S.files || []).filter((f) => f.id !== id);
      if (!(S.files || []).some((f) => f.slot === 'manuscript')) S.docInfo = null;
      await delBlob(id);
      save(); rerenderUploads();
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
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.dataset.link) return;
    S.links = (S.links || []).filter((l) => l.slot !== t.dataset.link);
    if (t.value.trim()) S.links.push({ slot: t.dataset.link, url: t.value.trim() });
    save();
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  // 사이드·하단 막대의 버튼은 form 속성으로 같은 주문서를 제출한다
}
