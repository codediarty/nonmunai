import { faqBlock, ctaBand, price, item, pageTiers, shortExtra } from '../../templates/parts.mjs';
import { esc } from '../../templates/layout.mjs';
import { computeQuote, DEFAULT_CATALOG, won } from '../../js/core/pricing.js';
import { FIELDS } from '../../js/core/kb.js';

// 대표 가격: 가격표(pricing.js)로 계산해 늘 같은 값을 쓴다
const quote = (typeId, pages) => computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId, task: 'full', pages } });
const Q8 = quote('short', 8);
const Q80 = quote('master', 80);
const Q130 = quote('doctor', 130);
const unit = (code) => won(item(code).unitPrice);

// 자주 묻는 질문: 많이 찾는 검색어(석사논문 작성, 논문 자동작성, 논문 작성 AI, 논문 첨삭, 논문 컨설팅, 논문 통계분석, 비용 등)로 묻고 숫자로 답한다
export const HOME_FAQ = [
  { q: '논문AI는 어떤 논문 작성 사이트인가요?', a: `논문AI(논문 AI)는 프롬프트 한 줄로 논문을 자동작성하는 AI 논문 작성 사이트입니다. 전공과 주제, 분량을 적으면 연구 설계부터 본문과 참고문헌까지 작성하고, 참고문헌은 모두 실제로 존재하는 문헌만 써서 본문 인용까지 연결합니다. 석사논문 작성, 박사논문 작성 같은 학위논문 작성부터 논문 첨삭·교정, 학위논문 컨설팅, 논문 통계분석, 논문 설문조사까지 한곳에서 맡길 수 있습니다.` },
  { q: '논문 작성 AI로 정말 논문 한 편이 자동작성되나요?', a: `네. 전공과 주제, 분량을 한 줄로 적으면 제목, 연구모형, 가설, 목차가 바로 설계됩니다. 주문하시면 실존 문헌을 바탕으로 서론, 이론적 배경(선행연구 정리), 연구방법, 연구결과, 결론까지 장별 초고를 자동으로 작성하고, 석·박사 연구진이 문헌과 수치, 형식을 검수해 전달합니다. 문장 몇 줄을 만들어 주는 AI 논문 생성기와 달리 논문 한 편을 끝까지 완성합니다.` },
  { q: '석사논문 작성 비용은 얼마인가요?', a: `석사학위논문 80쪽은 ${won(Q80.total)}이고, 결제 후 영업일 ${Q80.days}일이면 받아 볼 수 있습니다. 기준 60쪽은 ${price('P-MASTER-FULL')}이며 10쪽을 늘릴 때마다 ${unit('P-MASTER-FULL')}이 더해집니다. 실존 참고문헌과 본문 인용, 석·박사 연구진 검수, 수정 1회가 모두 포함된 금액입니다.` },
  { q: '박사논문 작성도 맡길 수 있나요?', a: `네. 박사학위논문 130쪽은 ${won(Q130.total)}(기준 120쪽 ${price('P-DOCTOR-FULL')}, 10쪽마다 ${unit('P-DOCTOR-FULL')})입니다. 연구모형과 장별 집필 계획을 먼저 세운 뒤 장별 본문을 일관되게 작성합니다. 구조방정식(AMOS, PLS-SEM) 같은 심화 분석은 데이터를 확인한 뒤 견적을 드리고, 박사논문 컨설팅이 필요한 장만 따로 맡길 수도 있습니다.` },
  { q: '소논문이나 과제 논문도 맡길 수 있나요?', a: `네. 소논문 8쪽은 ${won(Q8.total)}이고 ${shortExtra()}이 더해집니다. 수업 과제, 학회 발표용 소논문, 청소년 탐구논문(10쪽 ${price('P-YOUTH-FULL')})도 실존 참고문헌과 본문 인용을 갖춘 형식으로 작성합니다.` },
  { q: '참고문헌은 정말 실제로 있는 논문인가요?', a: '네. 논문AI는 실제로 존재하는 문헌만 참고문헌에 넣습니다. 저자, 연도, 제목, 학술지, 권호, 쪽, DOI를 DOI와 KCI, RISS 같은 학술 데이터베이스의 원문 기록과 한 편씩 대조하고, AI가 만들어 낸 가짜 문헌은 한 편도 넣지 않습니다. 논문 참고문헌 정리도 APA 7판 형식으로 맞춰 드립니다.' },
  { q: '본문 인용과 APA 양식도 맞춰 주나요?', a: '네. 문장마다 근거가 된 문헌을 (저자, 연도) 형식의 본문 인용으로 연결하고, 본문에 인용한 문헌과 참고문헌 목록이 1:1로 맞도록 정리합니다. 기본은 APA 7판이며 학교 학위논문 양식이나 학술지 투고 규정이 있으면 그대로 맞춰 드립니다.' },
  { q: '논문 첨삭·교정 비용은 얼마인가요?', a: `석사논문 첨삭은 30쪽 기준 ${price('P-MASTER-EDIT')}, 박사학위논문은 40쪽 기준 ${price('P-DOCTOR-EDIT')}, 학술지 논문 첨삭은 20쪽 기준 ${price('P-JOURNAL-EDIT')}입니다. 문장 다듬기와 문체 교정, 논리 흐름, 인용과 형식 수정까지 교정·교열을 한 번에 하고, 수정 내역을 표시한 파일과 깨끗한 정리본을 함께 드립니다.` },
  { q: '교수님 피드백 반영이나 논문 수정만 맡길 수 있나요?', a: `네. 교수님 의견이나 심사 피드백을 항목별로 반영하고, 수정 대조표와 반영 부분을 파란색으로 표시한 파일로 무엇을 어디서 고쳤는지 한눈에 보여 드립니다. 석사학위논문은 10개 항목 기준 ${price('P-MASTER-FB')}, 학술지 심사 의견 반영은 ${price('P-JOURNAL-FB')}입니다.` },
  { q: '연구계획서 작성도 해 주나요?', a: `네. 석사 연구계획서는 15쪽 기준 ${price('P-MASTER-PROP')}, 박사 연구계획서는 25쪽 기준 ${price('P-DOCTOR-PROP')}입니다. 연구 주제와 제목, 연구 목적과 필요성, 이론적 배경과 연구모형, 연구방법과 분석 계획, 참고문헌까지 심사에 바로 낼 수 있는 논문 연구계획서(프로포절)로 작성합니다.` },
  { q: '논문 컨설팅은 어떻게 받나요? 비용은요?', a: `필요한 단계만 골라 맡기면 됩니다. 주제를 적으면 연구모형 설계, 가설 설정, 변수 설정, 연구방법론까지 담은 연구 설계를 주문서에서 무료로 먼저 받아 볼 수 있고, 그다음 연구계획서(${price('P-MASTER-PROP')}부터), 논문 작성, 첨삭, 통계분석 가운데 지금 막힌 단계만 신청합니다. 석사논문 컨설팅과 학위논문 컨설팅 모두 같은 방식입니다.` },
  { q: '논문 통계분석(SPSS·AMOS)도 맡길 수 있나요?', a: `네. 가지고 있는 데이터로 SPSS 통계분석, 회귀분석, 매개효과·조절효과 분석(PROCESS Macro)을 진행하고 APA 형식 결과표와 해석을 드립니다. 논문 맞춤 통계분석 기본형은 ${price('T-BASIC')}, 표준형은 ${price('T-INTERP')}, 연구결과(4장) 작성까지는 ${price('T-CHAPTER')}입니다. AMOS 구조방정식처럼 모형이 복잡한 분석은 데이터를 확인한 뒤 견적을 드리고, 필요한 표본 수는 무료 계산기로 먼저 확인할 수 있습니다.` },
  { q: '논문 설문조사와 설문지 작성 대행도 되나요?', a: `네. 연구 변인에 맞는 검증된 척도로 논문 설문 문항을 구성하는 설문지 작성(${price('S-NEW')})부터, 온라인 설문조사 제작과 진행, 응답 분석과 해석까지 한 번에 맡기는 설문조사 원스톱(${price('S-FULL')})이 있습니다. 응답자 모집은 대상과 인원에 따라 견적을 드립니다.` },
  { q: 'KCI·SCI 학술지 논문 작성도 되나요?', a: `네. 학술지 투고논문은 투고 규정에 맞춘 20쪽 원고와 국문·영문 초록까지 ${price('P-JOURNAL-FULL')}부터 작성합니다. KCI 등재지 투고 준비와 심사 의견 반영도 맡길 수 있고, SCI·SCIE 학술지는 영문 논문 작성 옵션(10쪽마다 ${unit('A-ENGLISH')})으로 원고를 학술 영어로 작성합니다.` },
  { q: '영문 논문 교정이나 논문 번역도 가능한가요?', a: `영문 논문 작성 옵션을 고르면 원고를 처음부터 학술 영어로 작성하고 영문 초록과 참고문헌 형식까지 맞춥니다(10쪽마다 ${unit('A-ENGLISH')}). 이미 쓴 영문 원고의 교정이나 국문 논문의 영문 번역은 주문서 요청 사항에 적어 주시면 분량을 확인해 안내해 드립니다.` },
  { q: '논문 작성 방법을 몰라도, 주제가 없어도 시작할 수 있나요?', a: '네. 관심 키워드와 전공만 적으면 연구할 만한 제목을 먼저 만들어 드립니다. 목차, 학교 양식, 연구방법, 분량도 모두 "잘 모르겠어요"로 진행할 수 있습니다. 석사논문 작성 방법과 일정은 가이드에서, 논문 목차 작성과 참고문헌 정리는 무료 도구에서 바로 해 볼 수 있습니다.' },
  { q: '논문 표절 검사나 AI 탐지는 어떻게 하나요?', a: '논문AI는 실존 문헌만 인용하고 모든 인용에 출처를 밝히며, 원문을 그대로 옮기지 않고 연구 주제에 맞게 새로 씁니다. 제출 전에는 학교에서 쓰는 표절 검사(유사도 검사)로 직접 확인하고, 고칠 부분이 있으면 수정 요청으로 반영합니다. AI 활용 기준은 학교와 학술지마다 다르니 제출처의 규정을 먼저 확인하세요.' },
  { q: '논문 심사 발표 PPT도 만들어 주나요?', a: `네. 논문 핵심을 담은 15~20장 발표 자료와 장표별 스크립트를 ${price('A-PPT')}에 만들어 드립니다. 논문 주문에 옵션으로 더하면 되고, 교수님 피드백 반영과 함께 신청하면 논문 심사 준비를 한 번에 마칠 수 있습니다.` },
  { q: '결제는 어떻게 하나요?', a: '주문서를 내면 결제 화면에서 운영사 성균관컨설팅의 안전결제(카드, 간편결제, 계좌이체)로 바로 결제합니다. 응답자 모집처럼 조건에 따라 비용이 달라지는 작업만 견적을 확정한 뒤 결제합니다.' },
];

// 자주 묻는 질문 페이지에만 싣는 이용 안내
export const SUPPORT_FAQ = [
  { q: '수정은 몇 번 받을 수 있나요?', a: '논문 자동작성, 연구계획서, 설문 원스톱 상품에는 수정 1회가 포함되어 있고, 필요하면 추가 수정을 1회 단위로 더할 수 있습니다. 전달 후 주문 페이지에서 수정 내용을 적어 바로 요청하시면 됩니다.' },
  { q: '올린 자료는 안전하게 관리되나요?', a: '자료는 주문별 비공개 폴더에 보관되며 주문번호와 조회 비밀번호가 있어야 볼 수 있습니다. 결과물 전달 후 90일이 지나면 자동으로 삭제되고, 그 전에도 주문 페이지에서 삭제를 요청할 수 있습니다.' },
];

// 히어로 예시 논문의 참고문헌: 모두 최근 실존 문헌(Crossref에서 저자·연도·권호·쪽·DOI 확인), APA 7판 목록 순서
const REFS = [
  { id: 'r1', cite: 'Bae, 2022', html: 'Bae, S.-H. (2022). Noneconomic and economic impacts of nurse turnover in hospitals: A systematic review. <i>International Nursing Review, 69</i>(3), 392–404.', doi: '10.1111/inr.12769', n: 3 },
  { id: 'r2', cite: 'Bakker et al., 2023', html: 'Bakker, A. B., Demerouti, E., &amp; Sanz-Vergel, A. (2023). Job demands–resources theory: Ten years later. <i>Annual Review of Organizational Psychology and Organizational Behavior, 10</i>(1), 25–53.', doi: '10.1146/annurev-orgpsych-120920-053933', n: 4 },
  { id: 'r3', cite: 'Cooper et al., 2020', html: 'Cooper, A. L., Brown, J. A., Rees, C. S., &amp; Leslie, G. D. (2020). Nurse resilience: A concept analysis. <i>International Journal of Mental Health Nursing, 29</i>(4), 553–575.', doi: '10.1111/inm.12721', n: 3 },
  { id: 'r4', cite: 'Shah et al., 2021', html: 'Shah, M. K., Gandrakota, N., Cimiotti, J. P., Ghose, N., Moore, M., &amp; Ali, M. K. (2021). Prevalence of and factors associated with nurse burnout in the US. <i>JAMA Network Open, 4</i>(2), Article e2036469.', doi: '10.1001/jamanetworkopen.2020.36469', n: 2 },
];
// 예시 프롬프트와 논문 제목: 쉬운 말로
export const DEMO_PROMPT = '간호학 석사 80쪽, 직무스트레스와 회복탄력성이 이직의도에 미치는 영향';
export const DEMO_TITLE = '간호사의 직무스트레스와 회복탄력성이 이직의도에 미치는 영향';
const ref = (id) => REFS.find((r) => r.id === id);
const cite = (id) => `<cite class="hx-cite" data-ref="${id}" tabindex="0">(${ref(id).cite})</cite>`;

const TYPE_OPTS = [['short', '소논문'], ['bachelor', '학사 졸업논문'], ['journal', '학술지 논문'], ['master', '석사학위논문'], ['doctor', '박사학위논문']];
const PAGE_OPTS = [8, 10, 15, 20, 30, 40, 60, 80, 100, 120, 130, 150, 200];

function heroWindow(T) {
  const fieldOpts = `<option value="auto">자동 인식</option>${FIELDS.filter((f) => f.id !== 'other').map((f) => `<option value="${f.id}"${f.id === 'nursing' ? ' selected' : ''}>${esc(f.label)}</option>`).join('')}<option value="other">기타·융합</option>`;
  const typeOpts = TYPE_OPTS.map(([v, t]) => `<option value="${v}"${v === 'master' ? ' selected' : ''}>${t}</option>`).join('');
  const pageOpts = PAGE_OPTS.map((n) => `<option value="${n}"${n === 80 ? ' selected' : ''}>${n}쪽</option>`).join('');
  const go = `${T.u('/paper/new/')}?${new URLSearchParams({ title: DEMO_TITLE, type: 'master', field: 'nursing', task: 'full', pages: '80' })}`;
  return `<div class="hx-stage">
<div class="hx-win" id="hxWin" data-mode="demo">
<div class="hx-bar"><span class="hx-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="hx-bar-t">논문AI 자동작성</span><span class="hx-tag" id="hxTag">예시</span></div>
<form class="hx-prompt" id="hxPrompt" action="${T.u('/paper/new/')}" method="get" autocomplete="off">
<label class="sr" for="hxText">논문 프롬프트: 전공, 주제, 분량을 적어 주세요</label>
<textarea class="hx-text" id="hxText" name="prompt" rows="2" spellcheck="false" maxlength="300" placeholder="전공, 주제, 분량을 한 줄로 적어 주세요">${DEMO_PROMPT}</textarea>
<div class="hx-ghost" id="hxGhost" aria-hidden="true"></div>
<div class="hx-opts">
<label class="hx-pill"><span>전공</span><select id="hxField" name="field">${fieldOpts}</select></label>
<label class="hx-pill"><span>종류</span><select id="hxType" name="type">${typeOpts}</select></label>
<label class="hx-pill"><span>분량</span><select id="hxPages" name="pages">${pageOpts}</select></label>
<button class="hx-send" type="submit" aria-label="이 프롬프트로 논문 작성">${T.icon('arrow-up')}</button>
</div>
</form>
<ol class="hx-steps" id="hxSteps" aria-label="작성 진행 단계">
<li data-step="0"><i aria-hidden="true"></i>주제 분석</li>
<li data-step="1"><i aria-hidden="true"></i>실존 문헌 검색</li>
<li data-step="2"><i aria-hidden="true"></i>목차 설계</li>
<li data-step="3"><i aria-hidden="true"></i>본문 작성</li>
<li data-step="4"><i aria-hidden="true"></i>인용 연결</li>
</ol>
<div class="hx-body">
<article class="hx-doc" id="hxDoc" aria-label="자동작성 중인 논문 예시">
<div class="hx-page" id="hxPage">
<p class="hx-meta" data-blk>석사학위논문 · 본문 80쪽 · APA 7판</p>
<p class="hx-ttl" data-blk>${DEMO_TITLE}</p>
<p class="hx-ch" data-blk>제1장 서론</p>
<p class="hx-sec" data-blk>1. 연구의 필요성</p>
<p class="hx-p" data-blk>간호 인력의 이직은 숙련 인력의 손실에 그치지 않고 남은 구성원의 업무 부담과 병원의 비용을 함께 키운다${cite('r1')}. 직무요구-자원 이론은 과도한 직무요구가 소진을 거쳐 부정적 결과로 이어진다고 설명하며${cite('r2')}, 실제로 소진과 업무 스트레스는 간호사가 일을 그만두는 주요 이유로 보고되었다${cite('r4')}. 한편 회복탄력성은 어려운 상황에서도 간호사가 잘 적응하도록 돕는 개인의 힘으로 주목받고 있어${cite('r3')}, 직무스트레스와 회복탄력성이 이직의도에 미치는 영향을 함께 살펴볼 필요가 있다.</p>
</div>
<div class="hx-more" id="hxMore"><span class="hx-more-t" id="hxMoreT">${T.icon('lock')}<span>전체 80쪽 원고는 주문 후 완성됩니다</span></span><a class="btn btn-primary btn-sm" id="hxGo" href="${go}">이 논문 완성하기</a></div>
</article>
<aside class="hx-refpane" id="hxRefs" aria-label="참고문헌 실존 확인">
<div class="hx-rp-hd"><span id="hxVerifyLabel">참고문헌 실존 확인</span><b class="num" id="hxVerifyN">42/42</b></div>
<div class="hx-meter" aria-hidden="true"><i></i></div>
<p class="hx-rp-note" id="hxVerifyNote">후보 248편 중 42편 채택 · DOI·KCI·RISS 대조</p>
<ol class="hx-refs" id="hxRefList">${REFS.map((r) => `<li id="hx-${r.id}" data-ref="${r.id}" data-blk><b class="hx-ra">${r.cite.replace(/, (\d{4})$/, ' ($1)')}</b><span class="hx-rt">${r.html.replace(/^[^)]*\)\. /, '').replace(/<i>([^,<]+)[^<]*<\/i>.*$/, '<i>$1</i>')}</span><span class="hx-doi">doi.org/${r.doi}</span><span class="hx-badges"><span class="hx-ok">${T.icon('check')}DOI 확인</span><span class="hx-n">본문 인용 ${r.n}곳</span></span></li>`).join('')}</ol>
</aside>
</div>
</div>
</div>`;
}

export default function home({ T }) {
  const body = `
<section class="hx" aria-labelledby="hx-h">
<div class="wrap hx-in">
<div class="hx-copy">
<h1 class="hx-h1" id="hx-h"><span class="eyebrow">${T.icon('sparkles')}논문 자동작성 AI</span><span class="h-display hx-h">프롬프트 한 줄로<br>논문을 완성합니다</span></h1>
<p class="lead hx-lead">전공과 주제, 분량만 적으세요. 연구 설계부터 본문과 참고문헌까지 논문AI가 자동으로 작성합니다. 참고문헌은 모두 실제로 존재하는 문헌이고, 본문 인용까지 하나하나 연결됩니다.</p>
<ul class="hx-proof">
<li>${T.icon('badge-check')}<span><b>참고문헌 100% 실존</b><small>DOI·KCI·RISS로 한 편씩 대조</small></span></li>
<li>${T.icon('quote')}<span><b>본문 인용 자동 연결</b><small>APA 7판, 학교·학술지 양식</small></span></li>
<li>${T.icon('file-text')}<span><b>8쪽부터 130쪽까지</b><small>소논문부터 박사학위논문까지</small></span></li>
</ul>
<div class="hx-cta"><a class="btn btn-primary btn-lg" href="#hxPrompt" data-focus-prompt>내 주제로 논문 써 보기</a><a class="btn btn-ghost btn-lg" href="#pricing">가격 보기</a></div>
<p class="hx-trust">${T.icon('building-2')}<span>운영 <b>성균관컨설팅</b> · 성균관대학교 RISE사업 지원 기업 · 석·박사 연구진 최종 검수</span></p>
</div>
<div class="hx-visual">${heroWindow(T)}</div>
</div>
<div class="wrap"><dl class="spec">
<div><dt>작성하는 논문</dt><dd>석사·박사학위논문, 학술지 투고논문(KCI), 학사 졸업논문, 소논문, 연구계획서</dd></div>
<div><dt>인용·양식</dt><dd>APA 7판 기본, 학교 학위논문 양식과 학술지 투고 규정 적용</dd></div>
<div><dt>받는 파일</dt><dd>한글(HWP), 워드(DOCX), PDF 중 원하는 형식</dd></div>
</dl></div>
</section>

<section class="sec sec-ink rv" id="references" aria-labelledby="rv-h">
<div class="wrap rv-in">
<div class="rv-copy">
<p class="eyebrow eyebrow-inv">${T.icon('shield-check')}참고문헌 실존 보증</p>
<h2 class="h-2" id="rv-h">AI가 지어낸 참고문헌은<br>한 편도 넣지 않습니다</h2>
<p class="rv-lead">일반 AI 채팅은 그럴듯한 가짜 논문을 만들어 내곤 합니다. 논문AI는 실제로 존재하는 문헌만 쓰고, 문장마다 근거가 된 문헌을 본문 인용으로 연결합니다.</p>
<ol class="rv-steps">
<li><b>실존 문헌만 검색</b><span>국내외 학술 데이터베이스에서 주제에 맞는 문헌을 찾고, 원문을 확인할 수 있는 문헌만 후보로 둡니다.</span></li>
<li><b>서지 정보를 한 편씩 대조</b><span>저자, 연도, 제목, 학술지, 권호, 쪽, DOI를 원문 기록과 맞춰 틀린 곳 없이 정리합니다.</span></li>
<li><b>본문 인용과 목록을 1:1로</b><span>본문에 인용한 문헌은 모두 참고문헌에 있고, 참고문헌의 문헌은 모두 본문에 인용되도록 맞춥니다.</span></li>
</ol>
</div>
<div class="rv-viz" aria-label="참고문헌 대조표 예시">
<div class="rv-card">
<div class="rv-card-hd"><b>참고문헌 대조표</b><span class="rv-tag">예시</span></div>
<div class="rv-sum">
<div><span>참고문헌</span><b class="num">42편</b></div>
<div class="is-ok"><span>실존 확인</span><b class="num">42편</b></div>
<div><span>본문 인용</span><b class="num">126곳</b></div>
<div><span>누락·불일치</span><b class="num">0</b></div>
</div>
<table class="rv-table">
<thead><tr><th scope="col">문헌</th><th scope="col">확인 경로</th><th scope="col">상태</th><th scope="col" class="r">본문 인용</th></tr></thead>
<tbody>
${REFS.map((r) => `<tr><td><b>${r.cite.replace(/, (\d{4})$/, ' ($1)')}</b><small>${r.html.match(/<i>([^,<]+)/)[1]}</small></td><td><span class="rv-src">DOI</span></td><td><span class="rv-ok">${T.icon('check')}확인</span></td><td class="r num">${r.n}곳</td></tr>`).join('')}
<tr><td><b>국내 학술지 논문 24편</b><small class="ko">KCI 등재·등재후보 학술지</small></td><td><span class="rv-src">KCI</span></td><td><span class="rv-ok">${T.icon('check')}확인</span></td><td class="r num">79곳</td></tr>
<tr><td><b>학위논문·단행본 14편</b><small class="ko">국내외 학위논문과 전문 서적</small></td><td><span class="rv-src">RISS</span></td><td><span class="rv-ok">${T.icon('check')}확인</span></td><td class="r num">36곳</td></tr>
</tbody>
</table>
</div>
</div>
</div>
</section>

<section class="sec" id="pricing" aria-labelledby="tier-h">
<div class="wrap">
<div class="sec-head is-center"><h2 class="h-2 price-h" id="tier-h">석사논문 80쪽, <span class="num" data-q="master:80">${won(Q80.total).replace('원', '')}</span>원이면 됩니다</h2><p>소논문 8쪽은 <span data-q="short:8">${won(Q8.total).replace('원', '')}</span>원, 박사학위논문 130쪽도 <span data-q="doctor:130">${won(Q130.total).replace('원', '')}</span>원. 실존 참고문헌과 본문 인용, <span class="nowrap">석·박사 연구진</span> 검수까지 모두 들어 있는 가격입니다.</p></div>
${pageTiers(T)}
<p class="tiers-foot">학술지 투고논문은 ${price('P-JOURNAL-FULL')}부터, 학사 졸업논문은 ${price('P-BACHELOR-FULL')}부터 맡길 수 있습니다. 논문 첨삭, 교수님 피드백 반영, 통계분석 가격은 <a href="${T.u('/pricing/')}">전체 가격표</a>에서 볼 수 있습니다.</p>
</div>
</section>

<section class="sec sec-alt" aria-labelledby="flow-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="flow-h">논문 자동작성, 이렇게 진행됩니다</h2><p>프롬프트를 적는 순간 설계가 나오고, 결제하면 실존 문헌으로 본문을 작성해 연구진 검수까지 마친 원고를 드립니다.</p></div>
<ol class="flow4">
<li><span class="flow4-n">1</span><b>프롬프트 입력</b><p>전공, 주제, 분량을 한 줄로 적습니다. 주제가 없으면 관심 키워드만 적어도 됩니다.</p></li>
<li><span class="flow4-n">2</span><b>설계 받아 보고 결제</b><p>제목, 연구모형, 가설, 목차를 먼저 받아 보고, 마음에 들면 바로 결제합니다.</p></li>
<li><span class="flow4-n">3</span><b>자동작성과 인용 연결</b><p>실존 문헌을 바탕으로 장별 본문을 쓰고, 문장마다 본문 인용을 연결합니다.</p></li>
<li><span class="flow4-n">4</span><b>검수 후 전달</b><p>석·박사 연구진이 문헌, 수치, 형식을 검수해 원하는 파일 형식으로 전달합니다.</p></li>
</ol>
</div>
</section>

<section class="sec" aria-labelledby="cmp-h">
<div class="wrap cmp">
<div class="sec-head"><h2 class="h-2" id="cmp-h">일반 AI 채팅과 무엇이 다를까요</h2><p>문장을 만들어 주는 것과 제출할 수 있는 논문을 완성하는 것은 다른 일입니다.</p></div>
<div class="table-wrap"><table class="cmp-table">
<thead><tr><th scope="col">항목</th><th scope="col">일반 AI 채팅</th><th scope="col" class="is-us">논문AI 자동작성</th></tr></thead>
<tbody>
<tr><th scope="row">참고문헌</th><td data-label="일반 AI 채팅">그럴듯한 가짜 문헌이 섞일 수 있음</td><td class="is-us" data-label="논문AI 자동작성">${T.icon('check')}실존 문헌만, DOI·KCI·RISS 대조</td></tr>
<tr><th scope="row">본문 인용</th><td data-label="일반 AI 채팅">근거를 직접 찾아 달아야 함</td><td class="is-us" data-label="논문AI 자동작성">${T.icon('check')}문장마다 자동 연결, 목록과 1:1</td></tr>
<tr><th scope="row">분량</th><td data-label="일반 AI 채팅">한 번에 몇 쪽 남짓</td><td class="is-us" data-label="논문AI 자동작성">${T.icon('check')}8쪽부터 130쪽까지 장별 완성</td></tr>
<tr><th scope="row">연구 설계</th><td data-label="일반 AI 채팅">물어볼 때마다 답이 달라짐</td><td class="is-us" data-label="논문AI 자동작성">${T.icon('check')}연구모형·가설·분석 계획까지 일관된 설계</td></tr>
<tr><th scope="row">통계분석</th><td data-label="일반 AI 채팅">실제 데이터 분석이 어려움</td><td class="is-us" data-label="논문AI 자동작성">${T.icon('check')}실제 데이터로 SPSS 분석과 해석</td></tr>
<tr><th scope="row">양식</th><td data-label="일반 AI 채팅">형식은 직접 맞춰야 함</td><td class="is-us" data-label="논문AI 자동작성">${T.icon('check')}APA 7판, 학교·학술지 양식 적용</td></tr>
<tr><th scope="row">검수</th><td data-label="일반 AI 채팅">없음</td><td class="is-us" data-label="논문AI 자동작성">${T.icon('check')}석·박사 연구진 최종 검수</td></tr>
</tbody></table></div>
</div>
</section>

<section class="sec sec-alt" aria-labelledby="svc-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="svc-h">논문 자동작성 말고도, 필요한 것만 맡기세요</h2><p>이미 쓴 원고가 있거나 한 단계만 막혔다면 그 부분만 따로 신청할 수 있습니다.</p></div>
<div class="svc2">
${[
    ['file-pen-line', '논문 첨삭·교정', '문장과 논리, 형식을 다듬고 수정 내역을 표시해 드립니다.', `석사 30쪽 ${price('P-MASTER-EDIT')}`, '/thesis-editing/'],
    ['message-square-text', '교수님 피드백 반영', '수정 대조표를 만들고 반영한 부분을 파란색으로 표시합니다.', `석사 10개 항목 ${price('P-MASTER-FB')}`, '/professor-feedback/'],
    ['clipboard-list', '연구계획서', '연구 목적과 이론, 방법, 참고문헌까지 심사용으로 작성합니다.', `석사 ${price('P-MASTER-PROP')}`, '/research-proposal/'],
    ['list-checks', '설문조사 원스톱', '설문지 작성부터 설문조사 진행, 통계 해석까지 한 번에 맡깁니다.', price('S-FULL'), '/survey/'],
    ['chart-column', '논문 맞춤 통계분석', '주제와 가설에 맞는 분석을 설계하고 APA 통계표와 해석을 드립니다.', `표준형 ${price('T-INTERP')}`, '/statistics/'],
    ['presentation', '심사 발표 PPT', '논문 핵심을 담은 발표 자료와 장표별 스크립트를 만듭니다.', `${price('A-PPT')} (논문 주문에 추가)`, '/pricing/'],
  ].map(([ic, t, d, p, h]) => `<a class="svc2-item" href="${T.u(h)}"><span class="svc2-ic">${T.icon(ic)}</span><b>${esc(t)}</b><span class="svc2-d">${esc(d)}</span><span class="svc2-p">${esc(p)}</span></a>`).join('')}
</div>
<div class="svc svc-quick"><span class="svc-quick-t">바로 신청하기</span><a class="btn btn-dark" href="${T.u('/paper/new/')}">논문 의뢰하기</a><a class="btn btn-ghost" href="${T.u('/survey/new/')}">설문조사 의뢰하기</a><a class="btn btn-ghost" href="${T.u('/statistics/new/')}">통계분석 의뢰하기</a></div>
</div>
</section>

<section class="sec" aria-labelledby="out-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="out-h">받아 보시는 결과물</h2><p>논문 심사에서 실제로 쓰는 형식 그대로 전달합니다. 아래는 결과물 형식을 보여 드리기 위한 예시입니다.</p></div>
<div class="tabs out2" data-tabs>
<div class="tab-list out2-list" role="tablist" aria-label="결과물 예시" aria-orientation="vertical">
<button role="tab" aria-selected="true" aria-controls="out-1" id="tab-1"><b>연구 설계서</b><span>연구모형, 가설, 분석 계획, 표본 수</span></button>
<button role="tab" aria-selected="false" aria-controls="out-2" id="tab-2" tabindex="-1"><b>장별 원고</b><span>실존 문헌 인용이 달린 본문</span></button>
<button role="tab" aria-selected="false" aria-controls="out-3" id="tab-3" tabindex="-1"><b>통계표와 해석</b><span>APA 형식 표와 결과 해석</span></button>
<button role="tab" aria-selected="false" aria-controls="out-4" id="tab-4" tabindex="-1"><b>수정 대조표</b><span>교수님 의견별 수정 내용과 위치</span></button>
</div>
<div class="out2-panels">
<div class="tab-panel" role="tabpanel" id="out-1" aria-labelledby="tab-1">
<div class="art sheet"><div class="art-in">
<p class="art-title">연구 설계서</p>
<dl class="art-dl"><div><dt>연구 제목</dt><dd>${DEMO_TITLE}</dd></div><div><dt>연구 유형</dt><dd>양적 연구(설문조사) · 영향 관계와 매개효과 검증</dd></div><div><dt>연구 가설</dt><dd>H1 직무스트레스는 이직의도에 정(+)의 영향을 미칠 것이다.<br>H2 회복탄력성은 이직의도에 부(-)의 영향을 미칠 것이다.<br>H3 회복탄력성은 직무스트레스와 이직의도의 관계를 매개할 것이다.</dd></div><div><dt>분석 계획</dt><dd>신뢰도 분석, 상관분석, 위계적 회귀분석, PROCESS Macro Model 4(부트스트래핑 5,000회)</dd></div><div><dt>표본</dt><dd>최소 92명, 탈락률 15% 고려 109명 이상</dd></div></dl>
</div></div></div>
<div class="tab-panel" role="tabpanel" id="out-2" aria-labelledby="tab-2" hidden>
<div class="art sheet art-page"><div class="art-in">
<p class="pg-ch">제1장 서론</p><p class="pg-sec">1. 연구의 필요성</p>
<p class="pg-body">의료 현장에서 간호 인력의 안정적 확보는 환자 안전과 의료 서비스의 질을 좌우하는 핵심 과제이다. 간호사의 이직은 숙련 인력의 손실뿐 아니라 남은 구성원의 업무 부담을 키운다<span class="pg-cite">(Bae, 2022)</span>. 직무요구-자원 이론은 과도한 직무요구가 소진을 거쳐 부정적 결과로 이어진다고 설명한다<span class="pg-cite">(Bakker et al., 2023)</span>.</p>
<p class="pg-body pg-fade">특히 직무스트레스는 이직의도를 높이는 대표 요인으로 보고되어 왔으나, 같은 스트레스 속에서도 어려움에 잘 적응하도록 돕는 회복탄력성<span class="pg-cite">(Cooper et al., 2020)</span>이 이직의도를 얼마나 낮출 수 있는지는 충분히 검토되지 않았다.</p>
<p class="art-cap">예시 문단입니다. 실제 원고는 주문하신 주제와 자료를 바탕으로 작성되며, 인용 문헌은 모두 실제로 확인되는 문헌만 사용합니다.</p>
</div></div></div>
<div class="tab-panel" role="tabpanel" id="out-3" aria-labelledby="tab-3" hidden>
<div class="art sheet"><div class="art-in art-grid">
<table class="apa"><caption><b>표 6</b><i>회복탄력성의 매개효과 검증</i></caption><thead><tr><th>경로</th><th><span class="st">B</span></th><th><span class="st">SE</span></th><th>95% CI</th></tr></thead><tbody><tr><td>직무스트레스 → 회복탄력성</td><td>-0.38</td><td>0.07</td><td>[-0.52, -0.24]</td></tr><tr><td>회복탄력성 → 이직의도</td><td>-0.44</td><td>0.09</td><td>[-0.62, -0.26]</td></tr><tr><td>간접효과</td><td>0.17</td><td>0.05</td><td>[0.08, 0.27]</td></tr></tbody><tfoot><tr><td colspan="4">부트스트래핑 5,000회. 예시 수치입니다.</td></tr></tfoot></table>
<div class="easy"><p class="easy-h">결과 해석</p><p>직무스트레스가 높을수록 회복탄력성이 낮아지고, 회복탄력성이 낮을수록 이직의도가 높아졌습니다. 간접효과의 신뢰구간에 0이 없으므로 회복탄력성이 두 변인의 관계를 부분적으로 설명한다고 해석합니다.</p></div>
</div></div></div>
<div class="tab-panel" role="tabpanel" id="out-4" aria-labelledby="tab-4" hidden>
<div class="art sheet"><div class="art-in">
<table class="rev"><thead><tr><th>교수님 의견</th><th>수정 내용</th><th>위치</th></tr></thead><tbody>
<tr><td><span class="pen">연구의 필요성에 최근 국내 자료를 보완할 것</span></td><td>최근 5년 국내 실태 자료와 선행연구를 보완해 문단을 재구성</td><td>1장 1절</td></tr>
<tr><td><span class="pen">통제변수 선정 근거가 부족함</span></td><td>선행연구 근거와 함께 통제변수 선정 이유를 3장에 추가</td><td>3장 4절</td></tr>
<tr><td><span class="pen">표 형식을 APA로 통일할 것</span></td><td>모든 표를 APA 7판 형식으로 정리하고 번호 재부여</td><td>4장 전체</td></tr>
</tbody></table>
</div></div></div>
</div>
</div>
</div>
</section>

<section class="sec sec-alt" aria-labelledby="tools-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="tools-h">가입 없이 써 보는 무료 도구</h2><p>로그인 없이 바로 쓰는 연구 도구입니다. 결과는 브라우저 안에서 계산되고 저장되지 않습니다.</p></div>
<div class="tools">
<a class="tool" href="${T.u('/free/')}"><span class="tool-ic">${T.icon('workflow')}</span><b>무료 논문 설계</b><span>주제 한 줄로 연구모형과 가설, 분석 계획을 받아 봅니다.</span></a>
<a class="tool" href="${T.u('/tools/toc/')}"><span class="tool-ic">${T.icon('list-tree')}</span><b>논문 목차 생성기</b><span>제목과 연구방법을 넣으면 장·절·항 목차를 만듭니다.</span></a>
<a class="tool" href="${T.u('/tools/references/')}"><span class="tool-ic">${T.icon('book-open-text')}</span><b>참고문헌 생성기</b><span>학술지, 단행본, 학위논문을 APA 7판 형식으로 바꿉니다.</span></a>
<a class="tool" href="${T.u('/tools/sample-size/')}"><span class="tool-ic">${T.icon('calculator')}</span><b>표본 수 계산기</b><span>회귀, t검정, 분산분석, 상관, 카이제곱 표본 수를 계산합니다.</span></a>
</div>
</div>
</section>

<section class="sec" aria-labelledby="trust-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="trust-h">믿고 맡길 수 있도록</h2><p>논문은 연구자의 이름으로 남습니다. 그래서 지키는 원칙이 분명합니다.</p></div>
<ul class="trust4">
<li>${T.icon('book-check')}<b>실존 문헌만 인용</b><span>존재하지 않는 논문이나 출처는 쓰지 않습니다.</span></li>
<li>${T.icon('database')}<b>실제 데이터만 분석</b><span>학습용 시뮬레이션에는 가상 데이터 표시가 붙습니다.</span></li>
<li>${T.icon('lock-keyhole')}<b>주문별 비공개 보관</b><span>주문번호와 조회 비밀번호가 있어야 열람할 수 있습니다.</span></li>
<li>${T.icon('timer-reset')}<b>90일 뒤 자동 삭제</b><span>전달 후 보관 기간이 지나면 파일을 자동으로 지웁니다.</span></li>
</ul>
<p class="trust-more"><a href="${T.u('/ethics/')}">연구윤리 원칙 자세히 보기</a></p>
</div>
</section>

${faqBlock(T, HOME_FAQ, { lead: '석사논문 작성부터 논문 첨삭, 통계분석, 비용까지 가장 많이 묻는 질문을 모았습니다.' })}

${ctaBand(T, { title: '주제 한 줄이면 지금 바로 시작됩니다', text: '적어 주신 주제로 제목과 연구모형, 목차를 바로 설계해 드립니다. 설계는 무료입니다.', topic: true })}
`;
  return [{
    path: '/',
    body,
    kind: 'home',
    title: '논문AI | 논문 자동작성 AI, 프롬프트 한 줄로 석사·박사논문 완성',
    h1: '논문AI',
    description: `논문 작성 AI 논문AI는 프롬프트 한 줄로 석사논문·박사논문을 자동작성합니다. 참고문헌은 모두 실존 문헌이고 본문 인용까지 연결됩니다. 석사 80쪽 ${won(Q80.total)}, 박사 130쪽 ${won(Q130.total)}, 소논문 8쪽 ${won(Q8.total)}. 논문 첨삭, 논문 컨설팅, 통계분석까지.`,
    keywords: ['논문AI', '논문 AI', '논문 자동작성', '논문 작성 AI', 'AI 논문 작성', '석사논문 작성', '학위논문 작성', '박사논문 작성', '논문 작성', '논문 작성 사이트', '논문 자동작성 사이트', '논문 작성 프로그램', '논문 첨삭', '논문 교정', '논문 컨설팅', '학위논문 컨설팅', '석사논문 컨설팅', '논문 통계분석', '논문 작성 비용', 'AI 논문 생성기', '논문 작성 도우미', '논문 참고문헌 정리'],
    ogImage: '/assets/img/og/home.png',
    faq: HOME_FAQ,
    styles: ['site', 'home'],
    scripts: ['home'],
    priority: '1.0',
    changefreq: 'weekly',
    geo: `논문AI는 프롬프트 한 줄(전공·주제·분량)로 논문을 자동작성하는 AI 논문 작성 서비스이다. 참고문헌은 DOI·KCI·RISS 원문 기록과 대조한 실존 문헌만 쓰고, 본문 인용과 참고문헌 목록을 1:1로 연결한다. 분량은 소논문 8쪽부터 박사 130쪽까지이며 소논문 8쪽 ${won(Q8.total)}, 석사학위논문 80쪽 ${won(Q80.total)}(영업일 ${Q80.days}일), 박사학위논문 130쪽 ${won(Q130.total)}(영업일 ${Q130.days}일)이다. 석·박사 연구진이 최종 검수하고, 논문 첨삭·교정(석사 30쪽 ${price('P-MASTER-EDIT')}), 교수님 피드백 반영(${price('P-MASTER-FB')}), 연구계획서(${price('P-MASTER-PROP')}), 설문조사 원스톱(${price('S-FULL')}), 논문 통계분석(${price('T-BASIC')}부터)도 주문할 수 있다. 석사논문 작성, 박사논문 작성, 학술지(KCI·SCI) 논문 작성, 학위논문 컨설팅을 한곳에서 맡길 수 있는 논문 작성 사이트이다.`,
    schema: [{
      '@context': 'https://schema.org', '@type': 'Service', name: '논문AI 논문 자동작성', serviceType: '논문 자동작성, AI 논문 작성, 논문 첨삭, 설문조사, 통계분석', provider: { '@id': T.abs('/#organization') }, areaServed: { '@type': 'Country', name: 'KR' },
      description: '프롬프트 한 줄로 논문을 자동작성하고 실존 참고문헌과 본문 인용을 연결하는 논문 작성 서비스',
      hasOfferCatalog: { '@type': 'OfferCatalog', name: '논문AI 서비스', itemListElement: [
        { '@type': 'Offer', name: '소논문 8쪽 자동작성', price: Q8.total, priceCurrency: 'KRW', url: T.abs('/ai-thesis/') },
        { '@type': 'Offer', name: '석사학위논문 자동작성 80쪽', price: Q80.total, priceCurrency: 'KRW', url: T.abs('/master-thesis/') },
        { '@type': 'Offer', name: '박사학위논문 자동작성 130쪽', price: Q130.total, priceCurrency: 'KRW', url: T.abs('/dissertation/') },
        { '@type': 'Offer', name: '논문 첨삭·교정', price: item('P-MASTER-EDIT').price, priceCurrency: 'KRW', url: T.abs('/thesis-editing/') },
        { '@type': 'Offer', name: '교수님 피드백 반영', price: item('P-MASTER-FB').price, priceCurrency: 'KRW', url: T.abs('/professor-feedback/') },
        { '@type': 'Offer', name: '설문조사 원스톱(설문지 작성부터 통계 해석까지)', price: item('S-FULL').price, priceCurrency: 'KRW', url: T.abs('/survey/') },
        { '@type': 'Offer', name: '논문 맞춤 통계분석 표준형', price: item('T-INTERP').price, priceCurrency: 'KRW', url: T.abs('/statistics/') },
      ] },
    }],
  }];
}
