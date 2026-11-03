// 한 화면 논문 주문: 관심 주제와 전공, 논문 종류, 받을 곳만 받고 바로 성균관컨설팅 결제로 잇는다
// 제목은 확정하지 않는다(연구진이 다듬음). 양식·자료·옵션은 모두 보조 선택으로 둔다.
import { submitOrder, uploader, ICON } from './wizard.js';
import { loadConfig, peekConfig } from './api.js';
import { computeQuote, findItem, paperItemCode, etaDate, includesFor } from '../core/pricing.js';
import { readPrompt, TYPE_LABEL } from '../core/preview.js';
import { PAPER_TYPES, FIELDS, guessField } from '../core/kb.js';
import { classifyFeedback } from '../core/feedback.js';
import { analyzeDocument } from '../core/diagnose-doc.js';
import { mountPreview } from '../ui/paper-preview.js';
import { $, $$, esc, store, debounce, url, toast } from '../ui/dom.js';
import { won } from '../core/render.js';
import { putBlob, delBlob, checkFile, MAX_FILES, extOf } from './files.js';

const KEY = 'draft:quick';
const TASKS = [
  ['full', '논문 완성', '주제만 정해도 됩니다'],
  ['proposal', '연구계획서', '심사용 계획서'],
  ['edit', '원고 첨삭', '이미 쓴 원고'],
  ['feedback', '교수님 피드백 반영', '수정 대조표 포함'],
];
const PKG = {
  full: [
    { id: 'short8', typeId: 'short', pages: 8, t: '소논문', note: '과제·학회 발표' },
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
const RANGE = { short: [8, 40], personal: [8, 60], bachelor: [20, 80], journal: [10, 40], master: [40, 200], doctor: [80, 300], youth: [6, 30], report: [10, 80] };
const MAJORS = ['간호학', '사회복지학', '상담심리학', '교육학', '유아교육', '경영학', '행정학', '체육학', '관광경영학', '호텔경영학', '보건학', '물리치료학', '심리학', '신학', '컴퓨터공학', '미디어커뮤니케이션', '디자인', '음악', '경제학', '법학'];

// 연구 방법: 기본은 연구진이 알아서, 원하면 한 번 눌러 바꾼다(가격은 그대로)
const METHODS = [['auto', '알아서 정해 주세요'], ['survey', '설문·통계'], ['literature', '문헌연구'], ['qualitative', '면담·사례'], ['experiment', '실험·개발']];

const DEF = {
  v: 3, task: 'full', topic: '', major: '', pkg: 'master80', ctype: 'master', cpages: 80,
  etype: 'master', epages: null, editScope: '', feedbackText: '',
  format: 'general', formatName: '',
  addons: { priority: false, ppt: false, english: false, format: false, revisions: 0 },
  outputFormat: 'docx', due: '', request: '', method: 'auto',
  files: [], links: [], contact: { name: '', email: '', phone: '' }, marketing: false, hp: '',
  touched: { pkg: false, major: false, epages: false }, docInfo: null,
};

let CONFIG = { catalog: null, settings: {} };
let S = null;
let PV = null;

const clone = (o) => JSON.parse(JSON.stringify(o));
const save = debounce(() => store.set(KEY, { ...S, saved: Date.now() }), 250);
const pkgList = () => PKG[S.task] || [];
const curPkg = () => pkgList().find((p) => p.id === S.pkg) || null;

// 지금 고른 논문 종류와 쪽수
function selection() {
  if (S.task === 'full' || S.task === 'proposal') {
    const p = curPkg();
    if (p) return { typeId: p.typeId, pages: p.pages };
    if (S.task === 'full' && S.pkg === 'custom') return { typeId: S.ctype, pages: Number(S.cpages) || null };
    const first = pkgList()[0];
    return { typeId: first.typeId, pages: first.pages };
  }
  const it = findItem(CONFIG.catalog, paperItemCode(S.etype, S.task));
  return { typeId: S.etype, pages: S.task === 'edit' ? (Number(S.epages) || (it ? it.baseUnits : null)) : null };
}

function quoteInput() {
  const { typeId, pages } = selection();
  const fb = S.task === 'feedback' && S.feedbackText ? classifyFeedback(S.feedbackText).count : null;
  return {
    service: 'paper',
    paper: { typeId, task: S.task, pages, feedbackItems: fb },
    addons: {
      priority: !!S.addons.priority, format: !!S.addons.format, revisions: Number(S.addons.revisions || 0),
      ppt: !!S.addons.ppt, english: !!S.addons.english && S.task === 'full', editing: false,
    },
  };
}
const quote = () => computeQuote(CONFIG.catalog, quoteInput());
const pkgQuote = (p, task = S.task) => computeQuote(CONFIG.catalog, { service: 'paper', paper: { typeId: p.typeId, task, pages: p.pages } });

/* ------------------------------------------------------------------ 화면 */
function shell(root) {
  root.innerHTML = `<div class="qo">
<div class="qo-hero"><div class="wrap qo-hero-in">
<p class="qo-eyebrow">${ICON.spark}<span>논문AI 주문</span></p>
<h1 class="qo-h1">주제만 알려 주세요.<br>완성본은 메일로 보내 드립니다.</h1>
<p class="qo-lead">관심 주제와 전공, 논문 종류만 고르면 끝입니다. 제목과 목차, 연구 방법은 논문AI와 석·박사 연구진이 알아서 정해 완성합니다.</p>
<ul class="qo-proof"><li>${ICON.check}<span>참고문헌 100% 실존 검증</span></li><li>${ICON.check}<span>석·박사 연구진 검수</span></li><li>${ICON.check}<span>회원가입 없이 1분 주문</span></li></ul>
</div></div>
<div class="wrap qo-grid">
<form class="qo-form" id="qoForm" novalidate autocomplete="off">
<div class="qo-tabs" role="tablist" aria-label="필요한 작업">${TASKS.map(([v, t, d]) => `<button type="button" role="tab" class="qo-tab" data-task="${v}" aria-selected="false"><b>${t}</b><small>${d}</small></button>`).join('')}</div>
<section class="qo-sec" id="qoS1"></section>
<section class="qo-mobile-pv" id="qoPvM" aria-label="내 논문 작성 미리보기"></section>
<section class="qo-sec" id="qoS2"></section>
<section class="qo-sec" id="qoS3"></section>
<section class="qo-sec qo-sec-more" id="qoMore"></section>
<section class="qo-sec" id="qoS4"></section>
<input type="text" name="hp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" data-k="hp">
<div class="qo-go"><p class="qo-err" id="qoErr" role="alert"></p>
<button class="btn btn-primary btn-lg btn-block qo-submit" type="submit" id="qoSubmit">결제하고 논문 받기</button>
<p class="qo-safe">${ICON.check}<span>주문서를 내면 <b>성균관컨설팅 안전결제</b>로 바로 이어집니다 · 카드·간편결제·계좌이체</span></p></div>
</form>
<aside class="qo-side" aria-label="내 논문 미리보기와 결제 금액"><div class="qo-side-in"><div id="qoPv"></div><div class="qo-sum" id="qoSum"></div></div></aside>
</div>
<div class="qo-mbar" id="qoBar"></div>
</div>`;
}

function taskTabs(root) {
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
  if (r.pages) chips.push(`${r.pages}쪽`);
  if (r.major || S.major) chips.push(S.major || r.major);
  for (const k of r.keywords) chips.push(`#${k}`);
  return chips.length ? `<div class="qo-read"><span class="qo-read-l">${ICON.spark}AI가 읽은 내용</span>${chips.map((c) => `<span class="qo-chip">${esc(c)}</span>`).join('')}</div>` : '<div class="qo-read is-empty"><span class="qo-read-l">' + ICON.spark + '적은 내용에서 논문 종류, 분량, 키워드를 자동으로 읽어 냅니다</span></div>';
}

function s1Html() {
  const majors = `<datalist id="qoMajors">${MAJORS.map((m) => `<option value="${m}">`).join('')}</datalist>`;
  if (S.task === 'edit' || S.task === 'feedback') {
    const fb = S.task === 'feedback';
    return `<h2 class="qo-h"><span class="qo-n">1</span>원고를 올려 주세요</h2>
<p class="qo-help">${fb ? '원고와 교수님 의견을 주시면 항목별로 반영하고, 무엇을 어디서 고쳤는지 수정 대조표로 정리해 드립니다.' : '문장과 논리, 인용과 형식을 다듬고 수정 내역을 표시한 파일과 깨끗한 정리본을 함께 드립니다.'}</p>
${uploader(S, 'manuscript', { label: '기존 원고', required: true, hint: '한글·워드·PDF 모두 됩니다. 올리면 분량을 자동으로 계산합니다' })}
<div id="qoDoc">${docInfoHtml()}</div>
${fb ? `<div class="field"><label class="label" for="qoFb">교수님 의견<span class="req">*</span></label><textarea class="textarea" id="qoFb" rows="5" data-k="feedbackText" maxlength="8000" placeholder="받은 의견을 그대로 붙여 넣어 주세요.\n예: 1. 연구의 필요성에 최근 자료를 보완할 것">${esc(S.feedbackText)}</textarea><p class="hint" id="qoFbCount">${fbCountText()}</p></div>
${uploader(S, 'feedback', { label: '의견이 담긴 파일', hint: '메모가 적힌 원고, 메일 캡처, 사진 모두 됩니다(붙여넣기와 둘 중 하나면 됩니다)' })}`
    : `<div class="field"><label class="label" for="qoScope">고칠 부분</label><input class="input" id="qoScope" data-k="editScope" maxlength="300" value="${esc(S.editScope)}" placeholder="비워 두면 원고 전체의 문장·논리·형식을 다듬습니다"></div>`}
<div class="field"><label class="label" for="qoMajor">전공·분야</label><input class="input" id="qoMajor" data-k="major" list="qoMajors" maxlength="60" value="${esc(S.major)}" placeholder="예: 간호학, 경영학 (선택)">${majors}</div>`;
  }
  return `<h2 class="qo-h"><span class="qo-n">1</span>어떤 논문을 쓸까요?</h2>
<div class="field qo-topic"><label class="label" for="qoTopic">관심 주제나 키워드<span class="req">*</span></label>
<textarea class="textarea qo-ta" id="qoTopic" rows="3" data-k="topic" maxlength="200" placeholder="예: 간호사 이직이랑 번아웃 관련해서 써 주세요">${esc(S.topic)}</textarea>
<p class="hint">제목은 정하지 않아도 됩니다. 적어 주신 관심 주제를 연구진이 다듬어 가장 좋은 제목으로 씁니다.</p>
<div id="qoRead">${parseChips()}</div></div>
<div class="field"><label class="label" for="qoMajor">전공·분야<span class="req">*</span></label><input class="input" id="qoMajor" data-k="major" list="qoMajors" maxlength="60" value="${esc(S.major)}" placeholder="예: 간호학, 경영학, 사회복지학">${majors}<p class="hint">목록에 없어도 그대로 적어 주세요.</p></div>`;
}

function pkgCard(p) {
  const q = pkgQuote(p);
  const on = S.pkg === p.id;
  return `<label class="qo-pkg${on ? ' is-on' : ''}${p.badge ? ' is-pop' : ''}"><input type="radio" name="qoPkg" value="${p.id}"${on ? ' checked' : ''}><span class="qo-pkg-hd"><b>${esc(p.t)}</b><span class="qo-pkg-pg">${p.pages}쪽</span></span><span class="qo-pkg-w num">${won(q.total)}</span><span class="qo-pkg-d">${p.badge ? `<em>${esc(p.note)}</em>` : esc(p.note)} · 영업일 ${q.days}일</span><span class="qo-pkg-mk" aria-hidden="true">${ICON.check}</span></label>`;
}

function s2Html() {
  if (S.task === 'edit' || S.task === 'feedback') {
    const opts = EDIT_TYPES.filter((t) => findItem(CONFIG.catalog, paperItemCode(t, S.task)));
    const it = findItem(CONFIG.catalog, paperItemCode(S.etype, S.task));
    const unit = it ? `${it.baseUnits}${it.unitLabel} 기준 ${won(it.price)}${it.unitPrice ? `, ${it.unitSize}${it.unitLabel}마다 ${won(it.unitPrice)}` : ''}` : '';
    return `<h2 class="qo-h"><span class="qo-n">2</span>어떤 논문인가요?</h2>
<div class="qo-seg" role="radiogroup" aria-label="논문 종류">${opts.map((t) => `<label class="qo-seg-i${S.etype === t ? ' is-on' : ''}"><input type="radio" name="qoEtype" value="${t}"${S.etype === t ? ' checked' : ''}>${esc((PAPER_TYPES.find((x) => x.id === t) || {}).short || t)}</label>`).join('')}</div>
<p class="hint">${esc(unit)}</p>
${S.task === 'edit' ? `<div class="field qo-pages"><label class="label" for="qoEpages">원고 분량(쪽)</label><input class="input" id="qoEpages" type="number" inputmode="numeric" min="1" max="999" data-k="epages" value="${S.epages ?? ''}" placeholder="원고를 올리면 자동으로 채워집니다"></div>` : ''}`;
  }
  const custom = S.task === 'full';
  const r = RANGE[S.ctype] || [8, 200];
  return `<h2 class="qo-h"><span class="qo-n">2</span>${S.task === 'proposal' ? '어떤 계획서가 필요하세요?' : '어떤 논문이 필요하세요?'}</h2>
<div class="qo-pkgs">${pkgList().map(pkgCard).join('')}</div>
${custom ? `<details class="qo-custom"${S.pkg === 'custom' ? ' open' : ''}><summary>다른 분량이나 종류가 필요해요</summary>
<div class="qo-custom-in"><div class="field"><label class="label" for="qoCtype">논문 종류</label><select class="select" id="qoCtype" data-k="ctype">${PAPER_TYPES.filter((t) => findItem(CONFIG.catalog, paperItemCode(t.id, 'full'))).map((t) => `<option value="${t.id}"${S.ctype === t.id ? ' selected' : ''}>${esc(t.label.replace('(8쪽)', ''))}</option>`).join('')}</select></div>
<div class="field"><label class="label" for="qoCpages">본문 쪽수</label><input class="input" id="qoCpages" type="number" inputmode="numeric" min="${r[0]}" max="${r[1]}" data-k="cpages" value="${S.cpages ?? ''}"></div>
<button type="button" class="btn btn-soft" id="qoUseCustom">이 분량으로 주문</button></div></details>` : ''}`;
}

function s3Html() {
  if (S.task === 'feedback') return '';
  const school = S.format === 'school';
  return `<h2 class="qo-h"><span class="qo-n">3</span>양식은 어떻게 할까요?</h2>
<div class="qo-fmt" role="radiogroup" aria-label="양식">
<label class="qo-fmt-main${!school ? ' is-on' : ''}"><input type="radio" name="qoFmt" value="general"${!school ? ' checked' : ''}><span class="qo-fmt-mk" aria-hidden="true">${ICON.check}</span><span><b>일반적인 논문 양식으로 해 주세요</b><small>APA 7판 학위논문 형식 · 나중에 학교 양식으로 바꿀 수 있어요</small></span></label>
<label class="qo-fmt-sub${school ? ' is-on' : ''}"><input type="radio" name="qoFmt" value="school"${school ? ' checked' : ''}><span><b>학교 양식 첨부</b><small>파일이 있다면</small></span></label>
</div>
${school ? `<div class="qo-fmt-up">${uploader(S, 'format', { label: '양식 파일', hint: '작성 지침, 서식 파일(hwp, docx), PDF 모두 됩니다. 지금 없으면 나중에 주문 페이지에서 보내도 됩니다' })}<div class="field"><label class="label" for="qoFname">학교·학술지 이름</label><input class="input" id="qoFname" data-k="formatName" maxlength="100" value="${esc(S.formatName)}" placeholder="예: ○○대학교 대학원 (선택)"></div></div>` : ''}`;
}

function moreHtml() {
  const cat = CONFIG.catalog;
  const ppt = findItem(cat, 'A-PPT'), en = findItem(cat, 'A-ENGLISH'), pr = findItem(cat, 'A-PRIORITY'), fm = findItem(cat, 'A-FORMAT'), rv = findItem(cat, 'A-REVISION');
  const { pages } = selection();
  const enBlocks = en ? Math.max(1, Math.ceil((Number(pages) || 20) / (Number(en.unitSize) || 10))) : 0;
  const prOff = CONFIG.settings && String(CONFIG.settings.priorityEnabled) === 'false';
  const box = (key, title, price, desc, off = false) => `<label class="qo-add${S.addons[key] ? ' is-on' : ''}${off ? ' is-off' : ''}"><input type="checkbox" data-add="${key}"${S.addons[key] ? ' checked' : ''}${off ? ' disabled' : ''}><span class="qo-add-mk" aria-hidden="true">${ICON.check}</span><span class="qo-add-t"><b>${title}</b><small>${desc}</small></span><span class="qo-add-p num">+${won(price)}</span></label>`;
  const on = Object.entries(S.addons).filter(([k, v]) => v && k !== 'revisions').length + (Number(S.addons.revisions) ? 1 : 0) + (S.files || []).filter((f) => f.slot === 'materials').length + (S.request.trim() ? 1 : 0);
  const wantsMethod = S.task === 'full' || S.task === 'proposal';
  const curMethod = METHODS.some(([v]) => v === S.method) ? S.method : 'auto';
  const methodOn = wantsMethod && curMethod !== 'auto';
  return `<details class="qo-more"${on || methodOn ? ' open' : ''}><summary><span><b>더 맡길 것이 있나요?</b><small>${wantsMethod ? '연구 방법, ' : ''}심사 발표 PPT, 우선 처리, 참고 자료, 요청 사항</small></span><em>선택</em></summary>
<div class="qo-more-in">
${wantsMethod ? `<div class="field qo-method"><span class="label" id="qoMethodL">연구 방법</span><div class="qo-seg" role="radiogroup" aria-labelledby="qoMethodL">${METHODS.map(([v, t]) => `<label class="qo-seg-i${curMethod === v ? ' is-on' : ''}"><input type="radio" name="qoMethod" value="${v}"${curMethod === v ? ' checked' : ''}>${t}</label>`).join('')}</div><p class="hint">바꿔도 금액은 같습니다. 설문 응답 수집과 실제 통계 돌리기는 통계분석 주문으로 따로 맡길 수 있습니다.</p></div>` : ''}
<div class="qo-adds">
${ppt ? box('ppt', '심사 발표 PPT', ppt.price, '발표 자료 15~20장과 장표별 스크립트') : ''}
${pr ? box('priority', '우선 처리', pr.price, prOff ? '지금은 작업 일정상 받을 수 없습니다' : '작업 순서를 앞당겨 납기를 줄입니다', prOff) : ''}
${en && S.task === 'full' ? box('english', '영문 논문으로 작성', en.unitPrice * enBlocks, `${en.unitSize}쪽마다 ${won(en.unitPrice)}, 지금 분량 기준 ${enBlocks}단위`) : ''}
${fm && S.task !== 'feedback' ? box('format', '학교 양식 상세 적용', fm.price, '여백, 글꼴, 표·그림, 목차 서식까지 제출 양식에 맞춥니다') : ''}
${rv ? `<label class="qo-add qo-add-sel"><span class="qo-add-t"><b>추가 수정</b><small>기본 포함 수정 1회 외에 더 받을 횟수</small></span><select class="select" data-k="addons.revisions"><option value="0"${!Number(S.addons.revisions) ? ' selected' : ''}>추가 안 함</option><option value="1"${Number(S.addons.revisions) === 1 ? ' selected' : ''}>1회 +${won(rv.price)}</option><option value="2"${Number(S.addons.revisions) === 2 ? ' selected' : ''}>2회 +${won(rv.price * 2)}</option></select></label>` : ''}
</div>
<div class="row-2 qo-row"><div class="field"><label class="label" for="qoOut">받을 파일</label><select class="select" id="qoOut" data-k="outputFormat"><option value="docx"${S.outputFormat === 'docx' ? ' selected' : ''}>워드(docx)</option><option value="hwp"${S.outputFormat === 'hwp' ? ' selected' : ''}>한글(hwp)</option><option value="pdf"${S.outputFormat === 'pdf' ? ' selected' : ''}>PDF</option></select></div>
<div class="field"><label class="label" for="qoDue">제출 일정 (선택)</label><input class="input" id="qoDue" type="date" data-k="due" value="${esc(S.due)}"></div></div>
${S.task === 'full' || S.task === 'proposal' ? uploader(S, 'materials', { label: '참고할 자료', hint: '선행연구, 메모, 설문지, 데이터 등 있으면 올려 주세요' }) : ''}
<div class="field"><label class="label" for="qoReq">요청 사항</label><textarea class="textarea" id="qoReq" rows="3" data-k="request" maxlength="3000" placeholder="예: 최근 5년 국내 논문 위주로 부탁드려요">${esc(S.request)}</textarea></div>
</div></details>`;
}

function s4Html() {
  const n = S.task === 'feedback' ? 3 : 4;
  return `<h2 class="qo-h"><span class="qo-n">${n}</span>완성본은 어디로 보내 드릴까요?</h2>
<div class="qo-contact">
<div class="field"><label class="label" for="qoName">이름<span class="req">*</span></label><input class="input" id="qoName" data-k="contact.name" maxlength="40" autocomplete="name" value="${esc(S.contact.name)}" placeholder="홍길동"></div>
<div class="field"><label class="label" for="qoPhone">휴대전화<span class="req">*</span></label><input class="input" id="qoPhone" data-k="contact.phone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" value="${esc(S.contact.phone)}" placeholder="010-0000-0000"></div>
<div class="field qo-mail"><label class="label" for="qoEmail">이메일 (완성본 받을 곳)<span class="req">*</span></label><input class="input" id="qoEmail" data-k="contact.email" type="email" maxlength="120" autocomplete="email" value="${esc(S.contact.email)}" placeholder="you@example.com"></div>
</div>
<p class="qo-note">진행 안내와 완성본을 이 메일로 보내 드립니다. 다른 기기에서 주문을 조회할 때 비밀번호는 휴대전화 뒤 4자리입니다.</p>
<p class="consent-note">주문서를 내면 <a href="${url('/terms/')}" target="_blank">이용약관</a>, <a href="${url('/privacy/')}" target="_blank">개인정보 처리방침</a>, <a href="${url('/refund/')}" target="_blank">환불 규정</a>이 적용됩니다. 주문 진행에 필요한 정보만 받습니다.</p>
<label class="check check-sm"><input type="checkbox" data-k="marketing"${S.marketing ? ' checked' : ''}><span>할인·새 서비스 소식 받기 (선택)</span></label>`;
}

function docInfoHtml() {
  const i = S.docInfo;
  if (!i) return '';
  if (!i.ok) return `<p class="hint">${esc(i.message || '')}</p>`;
  return `<p class="qo-docinfo">${ICON.spark}<span><b>${esc(i.name || '원고')}</b> · 약 ${i.pages}쪽${i.references ? ` · 참고문헌 ${i.references}건` : ''}</span></p>`;
}
function fbCountText() {
  const n = S.feedbackText ? classifyFeedback(S.feedbackText).count : 0;
  return n ? `의견 ${n}개 항목으로 나눠 반영합니다.` : '붙여 넣으면 항목 수를 자동으로 세어 금액에 반영합니다.';
}

function summaryHtml(q) {
  const { typeId, pages } = selection();
  const p = curPkg();
  const name = S.task === 'full' || S.task === 'proposal'
    ? `${p ? p.t : (TYPE_LABEL[typeId] || '논문')}${pages ? ` ${pages}쪽` : ''}`
    : `${(PAPER_TYPES.find((t) => t.id === typeId) || {}).short || ''} ${S.task === 'edit' ? '원고 첨삭·교정' : '교수님 피드백 반영'}`;
  const task = { full: '전체 구성·초고 완성', proposal: '연구계획서 작성', edit: '문장·논리·형식 교정', feedback: '의견별 반영과 수정 대조표' }[S.task];
  const extras = q.lines.filter((l) => /^A-/.test(l.code));
  const eta = q.days ? etaDate(new Date(), q.days, String((CONFIG.settings || {}).holidays || '').split(/[,\s]+/).filter(Boolean)) : null;
  const inc = includesFor(q.includes, pages);
  return `<div class="qo-sum-hd"><span>결제 금액</span><b class="num">${won(q.total)}</b></div>
<p class="qo-sum-name"><b>${esc(name.trim())}</b><span>${esc(task)}</span></p>
${extras.length ? `<ul class="qo-sum-x">${extras.map((l) => `<li><span>${esc(l.name)}</span><b class="num">+${won(l.amount)}</b></li>`).join('')}</ul>` : ''}
${eta ? `<p class="qo-sum-eta">${ICON.check}<span>영업일 ${q.days}일 · 오늘 결제하면 <b>${eta.getMonth() + 1}월 ${eta.getDate()}일(${'일월화수목금토'[eta.getDay()]})</b> 전달 예상</span></p>` : ''}
${inc.length ? `<p class="qo-sum-inc"><b>포함</b>${inc.map((x) => esc(x)).join(' · ')}</p>` : ''}
<button class="btn btn-primary btn-lg btn-block" type="submit" form="qoForm">${won(q.total)} 결제하고 받기</button>
<p class="qo-sum-pay"><span>성균관컨설팅 안전결제</span><span>카드</span><span>간편결제</span><span>계좌이체</span></p>`;
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
  if (S.task === 'edit' || S.task === 'feedback') return;
  PV.forEach((p) => p.update(previewInfo()));
}, 650);

function refreshPrice() {
  const q = quote();
  $('#qoSum', ROOT).innerHTML = summaryHtml(q);
  $('#qoSubmit', ROOT).textContent = `${won(q.total)} 결제하고 ${S.task === 'edit' ? '첨삭' : S.task === 'feedback' ? '반영본' : S.task === 'proposal' ? '계획서' : '논문'} 받기`;
  $('#qoBar', ROOT).innerHTML = `<span class="qo-bar-p"><b class="num">${won(q.total)}</b><small>${q.days ? `영업일 ${q.days}일` : ''}</small></span><button class="btn btn-primary" type="submit" form="qoForm">결제하고 받기</button>`;
  for (const lab of $$('.qo-pkg', ROOT)) lab.classList.toggle('is-on', lab.querySelector('input').checked);
}

function renderTask() {
  taskTabs(ROOT);
  $('#qoS1', ROOT).innerHTML = s1Html();
  $('#qoS2', ROOT).innerHTML = s2Html();
  $('#qoS3', ROOT).innerHTML = s3Html();
  $('#qoS3', ROOT).hidden = S.task === 'feedback';
  $('#qoMore', ROOT).innerHTML = moreHtml();
  $('#qoS4', ROOT).innerHTML = s4Html();
  const editLike = S.task === 'edit' || S.task === 'feedback';
  ROOT.classList.toggle('is-edit', editLike);
  if (editLike) {
    const sample = `<div class="pv pv-edit"><div class="pv-top"><span class="pv-live"><i aria-hidden="true"></i><span>${S.task === 'edit' ? '첨삭 결과 미리보기' : '피드백 반영 미리보기'}</span></span><span class="pv-meta">예시</span></div>
<div class="pv-stage"><div class="pv-sheet"><p class="pv-kick">수정 내역 표시본</p>
<p class="pv-txt">간호사의 이직은 <del>병원에 많은 손실을 준다</del><ins>숙련 인력의 손실과 남은 구성원의 업무 부담으로 이어진다</ins><cite class="pv-cite"><span class="pv-cite-a">Bae</span>, 2022<i>${ICON.check}</i></cite>. <del>그래서</del><ins>이에 따라</ins> 이직의도에 영향을 미치는 요인을 <ins>체계적으로</ins> 살펴볼 필요가 있다.</p>
${S.task === 'feedback' ? '<table class="pv-rev"><thead><tr><th>교수님 의견</th><th>반영 내용</th><th>위치</th></tr></thead><tbody><tr><td>최근 자료 보완</td><td>최근 5년 국내 실태 자료 추가</td><td>1장 1절</td></tr><tr><td>표 형식 통일</td><td>APA 7판 형식으로 정리</td><td>4장</td></tr></tbody></table>' : ''}
<div class="pv-lockzone is-on is-locked"><div class="pv-mosaic"><div class="pv-mz-in"><p class="pv-txt">원고 전체의 문장과 논리 흐름, 인용과 참고문헌 형식을 함께 다듬고, 고친 부분은 색으로 표시해 한눈에 확인할 수 있게 정리합니다. 수정 내역 표시본과 깨끗한 정리본을 함께 드립니다.</p><p class="pv-txt">제2장 이론적 배경의 문단 순서를 바로잡고 중복 서술을 줄였으며, 연구 가설과 분석 방법의 용어를 통일했습니다.</p></div></div>
<div class="pv-lock"><span class="pv-lock-ic">${ICON.check}</span>${S.task === 'feedback' ? '<b>받은 의견을 하나하나 이렇게 반영합니다</b><small>수정 대조표 + 반영 표시본 + 최종 정리본 · 메일로 전달</small>' : '<b>원고 전체를 이렇게 다듬어 드립니다</b><small>수정 표시본 + 깨끗한 정리본 · 메일로 전달</small>'}</div></div>
</div></div></div>`;
    $('#qoPv', ROOT).innerHTML = sample;
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
    if ((S.files || []).length >= MAX_FILES) { errs.push(`한 주문에 ${MAX_FILES}개까지 올릴 수 있습니다.`); break; }
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
  if (S.task !== 'feedback') $('#qoS3', ROOT).innerHTML = s3Html();
  $('#qoMore', ROOT).innerHTML = moreHtml();
  if (openMore && $('.qo-more', ROOT)) $('.qo-more', ROOT).open = true;
  refreshPrice();
}
const activeSlots = () => {
  const s = new Set();
  if (S.task === 'edit' || S.task === 'feedback') s.add('manuscript');
  if (S.task === 'feedback') s.add('feedback');
  if (S.task !== 'feedback' && S.format === 'school') s.add('format');
  if (S.task === 'full' || S.task === 'proposal') s.add('materials');
  return s;
};
const hasFile = (slot) => (S.files || []).some((f) => f.slot === slot) || (S.links || []).some((l) => l.slot === slot && /^https?:\/\//.test(l.url || ''));

/* ------------------------------------------------------------------ 검사·제출 */
function validate() {
  const c = S.contact;
  if (S.task === 'full' || S.task === 'proposal') {
    if (S.topic.trim().length < 2) return ['qoTopic', '관심 주제나 키워드를 한 가지 이상 적어 주세요.'];
    if (S.major.trim().length < 2) return ['qoMajor', '전공이나 분야를 적어 주세요. 목록에 없어도 그대로 적으면 됩니다.'];
    if (S.task === 'full' && S.pkg === 'custom') {
      const r = RANGE[S.ctype] || [4, 400];
      const n = Number(S.cpages);
      if (!(n >= r[0] && n <= r[1])) return ['qoCpages', `${TYPE_LABEL[S.ctype] || '논문'} 분량은 ${r[0]}~${r[1]}쪽 사이로 적어 주세요.`];
    }
  } else {
    if (!hasFile('manuscript')) return ['qoS1', '기존 원고 파일을 올려 주세요.'];
    if (S.task === 'feedback' && !hasFile('feedback') && !S.feedbackText.trim()) return ['qoFb', '교수님 의견을 붙여 넣거나 파일로 올려 주세요.'];
  }
  if (!(c.name || '').trim()) return ['qoName', '이름을 적어 주세요.'];
  if ((c.phone || '').replace(/\D/g, '').length < 9) return ['qoPhone', '휴대전화 번호를 확인해 주세요.'];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((c.email || '').trim())) return ['qoEmail', '완성본을 받을 이메일 주소를 확인해 주세요.'];
  return null;
}

function buildInput() {
  const r = readPrompt(S.topic);
  const { typeId, pages } = selection();
  const q = quoteInput();
  const fieldId = (guessField(S.major) || guessField(S.topic) || {}).id || 'other';
  const school = S.task !== 'feedback' && S.format === 'school';
  const formatSent = school && hasFile('format');
  const notes = [];
  if (school && !formatSent) notes.push('[양식] 학교 양식은 나중에 따로 보낼 예정');
  const request = [S.request.trim(), ...notes].filter(Boolean).join('\n');
  return {
    common: {
      fieldId, fieldText: S.major.trim(), school: school ? S.formatName.trim() : '', topicKnown: S.task === 'full' || S.task === 'proposal' ? 'free' : '',
      title: S.task === 'full' || S.task === 'proposal' ? S.topic.trim().slice(0, 200) : '', keywords: r.keywords.slice(0, 5),
      method: (S.task === 'full' || S.task === 'proposal') && METHODS.some(([v]) => v === S.method) ? S.method : 'auto', due: S.due || '', outputFormat: S.outputFormat, request,
    },
    paper: {
      typeId, task: S.task, pages, feedbackItems: q.paper.feedbackItems, hasToc: 'no', tocText: '',
      hasFormat: formatSent ? 'yes' : 'no', formatName: formatSent ? S.formatName.trim() : '',
      feedbackText: S.task === 'feedback' ? S.feedbackText : '', editScope: S.task === 'edit' ? (S.editScope.trim() || '원고 전체 문장·논리·형식') : '', needsData: false,
    },
    addons: q.addons,
  };
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
  const slots = activeSlots();
  const keep = (f) => slots.has(f.slot);
  const digits = S.contact.phone.replace(/\D/g, '');
  const sub = S;
  sub.pin = digits.slice(-4);
  sub.consents = { privacy: true, ethics: true, withdrawal: true, marketing: !!S.marketing };
  const view = { files: (S.files || []).filter(keep), links: (S.links || []).filter(keep), dropped: (S.files || []).filter((f) => !keep(f)).map((f) => f.id) };
  const state = new Proxy(sub, { get: (t, k) => (k in view ? view[k] : t[k]) });
  submitOrder({ service: 'paper', state, input: buildInput(), design: null, quote: quote(), draftKey: KEY, payNow: true });
}

/* ------------------------------------------------------------------ 시작 */
export async function startQuickOrder(root) {
  ROOT = root;
  CONFIG = peekConfig();
  const params = new URLSearchParams(location.search);
  const fromLink = ['prompt', 'title', 'type', 'pages', 'task', 'field', 'major'].some((k) => params.get(k));
  const saved = store.get(KEY);
  S = clone(DEF);
  if (!fromLink && saved && saved.v === DEF.v) S = { ...S, ...saved, addons: { ...DEF.addons, ...(saved.addons || {}) }, contact: { ...DEF.contact, ...(saved.contact || {}) }, touched: { ...DEF.touched, ...(saved.touched || {}) } };
  else if (saved && saved.v === DEF.v) S.contact = { ...DEF.contact, ...(saved.contact || {}) };
  // 홈 프롬프트·가격 카드·서비스 페이지에서 넘어온 값
  const task = params.get('task');
  if (task && TASKS.some(([v]) => v === task)) S.task = task;
  const topic = (params.get('prompt') || params.get('title') || '').slice(0, 200);
  if (topic) S.topic = topic;
  const methodP = params.get('method');
  if (methodP && METHODS.some(([v]) => v === methodP)) S.method = methodP;
  const r = readPrompt(S.topic);
  const field = params.get('field');
  const major = params.get('major') || (field && (FIELDS.find((f) => f.id === field) || {}).label) || r.major;
  if (major && !S.major) S.major = major.replace(/·.*$/, '');
  const typeP = params.get('type') || r.typeId;
  const pagesP = Math.round(Number(params.get('pages'))) || r.pages;
  if (S.task === 'full' && (typeP || pagesP)) {
    const t = typeP || 'master';
    const hit = PKG.full.find((p) => p.typeId === t && (!pagesP || p.pages === pagesP));
    if (hit) S.pkg = hit.id;
    else if (PAPER_TYPES.some((x) => x.id === t)) { S.pkg = 'custom'; S.ctype = t; S.cpages = pagesP || (RANGE[t] || [30])[0]; }
    S.touched.pkg = true;
  } else if (S.task === 'proposal' && typeP) {
    const hit = PKG.proposal.find((p) => p.typeId === typeP);
    if (hit) S.pkg = hit.id;
  } else if ((S.task === 'edit' || S.task === 'feedback') && typeP && EDIT_TYPES.includes(typeP)) S.etype = typeP;
  if ((S.task === 'full' || S.task === 'proposal') && !pkgList().some((p) => p.id === S.pkg) && S.pkg !== 'custom') S.pkg = S.task === 'proposal' ? 'pmaster' : 'master80';

  shell(root);
  renderTask();
  bind();
  loadConfig().then((c) => { if (c && c.catalog) { CONFIG = c; const open = $('.qo-more', ROOT) && $('.qo-more', ROOT).open; $('#qoS2', ROOT).innerHTML = s2Html(); $('#qoMore', ROOT).innerHTML = moreHtml(); if (open) $('.qo-more', ROOT).open = true; refreshPrice(); } });
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
      if (hit && hit.id !== S.pkg) { S.pkg = hit.id; $('#qoS2', ROOT).innerHTML = s2Html(); refreshPrice(); }
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
    if (k === 'epages' || k === 'cpages') refreshPrice();
  });
  form.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.name === 'qoPkg') {
      S.pkg = t.value; S.touched.pkg = true;
      const det = $('.qo-custom', ROOT); if (det) det.open = false;
      save(); refreshPrice(); refreshPreview();
      const more = $('#qoMore', ROOT); const open = $('.qo-more', ROOT) && $('.qo-more', ROOT).open; more.innerHTML = moreHtml(); if (open) $('.qo-more', ROOT).open = true;
    } else if (t.name === 'qoEtype') {
      S.etype = t.value; save(); $('#qoS2', ROOT).innerHTML = s2Html(); refreshPrice();
    } else if (t.name === 'qoMethod') {
      S.method = t.value; save();
      for (const x of $$('input[name="qoMethod"]', ROOT)) x.closest('.qo-seg-i').classList.toggle('is-on', x.checked);
    } else if (t.name === 'qoFmt') {
      S.format = t.value; save(); $('#qoS3', ROOT).innerHTML = s3Html();
    } else if (t.dataset.add) {
      S.addons[t.dataset.add] = t.checked; t.closest('.qo-add').classList.toggle('is-on', t.checked); save(); refreshPrice();
    } else if (t.dataset.k === 'marketing') {
      S.marketing = t.checked; save();
    } else if (t.tagName === 'SELECT' && t.dataset.k) {
      setPath(t.dataset.k, t.dataset.k === 'addons.revisions' ? Number(t.value) : t.value);
      save();
      if (t.dataset.k === 'ctype') {
        const r = RANGE[S.ctype] || [8, 200];
        const n = Number(S.cpages);
        if (!(n >= r[0] && n <= r[1])) { S.cpages = Math.max(r[0], Math.min(r[1], (PAPER_TYPES.find((x) => x.id === S.ctype) || {}).pages || r[0])); const el = $('#qoCpages', ROOT); if (el) { el.value = S.cpages; el.min = r[0]; el.max = r[1]; } }
        if (S.pkg === 'custom') refreshPreview();
      }
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
      if (S.task === 'full' && !PKG.full.some((p) => p.id === S.pkg) && S.pkg !== 'custom') S.pkg = 'master80';
      if (S.task === 'proposal' && !PKG.proposal.some((p) => p.id === S.pkg)) S.pkg = 'pmaster';
      save(); renderTask();
      return;
    }
    if (e.target.id === 'qoUseCustom') {
      const r = RANGE[S.ctype] || [8, 200];
      const n = Number(S.cpages);
      if (!(n >= r[0] && n <= r[1])) { toast(`${TYPE_LABEL[S.ctype] || '논문'} 분량은 ${r[0]}~${r[1]}쪽 사이로 적어 주세요.`, { error: true }); return; }
      S.pkg = 'custom'; S.touched.pkg = true; save();
      for (const x of $$('input[name="qoPkg"]', ROOT)) x.checked = false;
      refreshPrice(); refreshPreview();
      toast(`${TYPE_LABEL[S.ctype] || '논문'} ${n}쪽으로 계산했습니다.`);
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
