import { faqBlock, ctaBand, price, item, pageTiers, verifiedBadge, verifiedCard } from '../../templates/parts.mjs';
import { esc } from '../../templates/layout.mjs';
import { computeQuote, DEFAULT_CATALOG, won, listPriceFor, discountRate } from '../../js/core/pricing.js';
import { readPrompt, TYPE_LABEL, DEMO_PROMPT, DEMO_TITLE } from '../../js/core/preview.js';
import { HOME_FAQ as FAQ_TOP, ALL_FAQ } from '../faq.mjs';

// 대표 가격: 가격표(pricing.js)로 계산해 늘 같은 값을 쓴다
const quote = (typeId, pages) => computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId, task: 'full', pages } });
const Q15 = quote('short', 15);
const Q30 = quote('bachelor', 30);
const Q20 = quote('journal', 20);
const Q80 = quote('master', 80);
const Q130 = quote('doctor', 130);
const L80 = listPriceFor('P-MASTER-FULL', Q80.total);
const L130 = listPriceFor('P-DOCTOR-FULL', Q130.total);

export const HOME_FAQ = FAQ_TOP;
// 예전 이름으로 가져가는 곳을 위해 남겨 둔다(자주 묻는 질문 페이지는 faq.mjs를 직접 쓴다)
export const SUPPORT_FAQ = ALL_FAQ.filter((f) => /수정은 몇 번|자료와 개인정보/.test(f.q));
export { DEMO_PROMPT, DEMO_TITLE };

// 히어로 예시 논문의 참고문헌: 모두 실존 문헌(Crossref에서 저자·연도·권호·쪽·DOI 확인), APA 7판 목록 순서
const REFS = [
  { id: 'r1', cite: 'Bakker et al., 2023', html: 'Bakker, A. B., Demerouti, E., &amp; Sanz-Vergel, A. (2023). Job demands–resources theory: Ten years later. <i>Annual Review of Organizational Psychology and Organizational Behavior, 10</i>(1), 25–53.', doi: '10.1146/annurev-orgpsych-120920-053933', n: 3 },
  { id: 'r2', cite: 'Hom et al., 2017', html: 'Hom, P. W., Lee, T. W., Shaw, J. D., &amp; Hausknecht, J. P. (2017). One hundred years of employee turnover theory and research. <i>Journal of Applied Psychology, 102</i>(3), 530–545.', doi: '10.1037/apl0000103', n: 4 },
  { id: 'r3', cite: 'Kelliher et al., 2019', html: 'Kelliher, C., Richardson, J., &amp; Boiarintseva, G. (2019). All of work? All of life? Reconceptualising work-life balance for the 21st century. <i>Human Resource Management Journal, 29</i>(2), 97–112.', doi: '10.1111/1748-8583.12215', n: 3 },
  { id: 'r4', cite: 'Rudolph et al., 2021', html: 'Rudolph, C. W., Rauvola, R. S., Costanza, D. P., &amp; Zacher, H. (2021). Generations and generational differences: Debunking myths in organizational science and practice and paving new paths forward. <i>Journal of Business and Psychology, 36</i>(6), 945–967.', doi: '10.1007/s10869-020-09715-2', n: 2 },
];
const DEMO_READ = readPrompt(DEMO_PROMPT);
const ref = (id) => REFS.find((r) => r.id === id);
const cite = (id) => `<cite class="hx-cite" data-ref="${id}" tabindex="0">(${ref(id).cite})</cite>`;

// 프롬프트에서 읽어 낸 내용(종류·전공·키워드) 칩
export function readChips(r) {
  const chips = [];
  if (r.typeId) chips.push(TYPE_LABEL[r.typeId]);
  if (r.pages) chips.push(`${r.pages} Page`);
  if (r.major) chips.push(r.major);
  for (const k of r.keywords) chips.push(`#${k}`);
  return chips.map((c) => `<span class="hx-chip">${esc(c)}</span>`).join('');
}

const wasPrice = (list, total) => (list ? `<s class="num">${won(list)}</s><em>${discountRate(list, total)}%</em>` : '');

function heroWindow(T) {
  const go = T.u('/paper/new/');
  return `<div class="hx-stage">
${verifiedCard({ cls: 'hx-vcard' })}
<div class="hx-win" id="hxWin" data-mode="demo">
<div class="hx-bar"><span class="hx-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="hx-bar-t">논문AI 집필 화면</span><span class="hx-tag" id="hxTag">예시</span></div>
<form class="hx-prompt" id="hxPrompt" action="${T.u('/paper/new/')}" method="get" autocomplete="off">
<label class="sr" for="hxText">관심 주제와 전공을 편하게 적어 주세요</label>
<textarea class="hx-text" id="hxText" name="prompt" rows="2" spellcheck="false" maxlength="200" placeholder="관심 주제나 키워드를 입력하세요">${DEMO_PROMPT}</textarea>
<div class="hx-ghost" id="hxGhost" aria-hidden="true"></div>
<div class="hx-opts">
<div class="hx-read" id="hxRead" aria-live="polite"><span class="hx-read-l">${T.icon('sparkles')}<span>AI가 읽은 내용</span></span><span class="hx-chips" id="hxChips">${readChips(DEMO_READ)}</span></div>
<button class="hx-send" type="submit" aria-label="이 주제로 논문 의뢰하기">${T.icon('arrow-up')}</button>
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
<article class="hx-doc" id="hxDoc" aria-label="작성 중인 논문 예시">
<div class="hx-page" id="hxPage">
<p class="hx-meta" data-blk>석사학위논문 · 본문 80 Page · APA 7판</p>
<p class="hx-ttl" data-blk>${DEMO_TITLE}</p>
<p class="hx-ch" data-blk>제1장 서론</p>
<p class="hx-sec" data-blk>1. 연구의 필요성</p>
<p class="hx-p" data-blk>일과 삶의 균형, 이른바 워라밸은 MZ세대 직장인이 일터를 고르고 머무는 핵심 기준이 되었다${cite('r3')}. 직원의 이직은 숙련 인력의 손실과 채용·교육 비용으로 이어져 조직의 지속가능성을 위협한다${cite('r2')}. 직무요구-자원 이론에 따르면 과도한 업무 요구는 소진을 거쳐 이탈로 이어지지만, 일과 삶을 스스로 조율할 수 있는 자원은 이를 완화한다${cite('r1')}. 다만 세대 차이는 고정관념이 아니라 실증 자료로 확인해야 한다는 지적이 있어${cite('r4')}, MZ세대 직장인을 대상으로 워라밸이 이직의도에 미치는 영향을 살펴볼 필요가 있다.</p>
<div class="pv-lockzone hx-lock" id="hxLock" aria-hidden="true"><div class="pv-mosaic"><div class="pv-mz-in">
<p class="hx-sec">2. 연구의 목적</p>
<p class="hx-p2">본 연구의 목적은 MZ세대 직장인이 인식하는 워라밸이 이직의도에 미치는 영향을 확인하고, 성별과 직급에 따른 차이를 살펴보는 데 있다. 이를 위한 구체적인 연구 문제는 다음과 같다.</p>
<p class="hx-ch">제2장 이론적 배경</p>
<p class="hx-sec">1. 워라밸의 개념과 선행연구</p>
<p class="hx-p2">워라밸은 일과 개인 생활에 쓰는 시간과 에너지를 스스로 조율하며 두 영역에서 만족을 느끼는 상태를 말한다. 국내에서는 주 52시간 근무제 시행 이후 직장 선택의 주요 기준으로 자리 잡았다.</p>
<p class="hx-p2">선행연구는 워라밸 인식이 높을수록 직무만족이 높아지고 이직의도는 낮아진다고 보고하며, 이 관계가 세대에 따라 어떻게 다른지에 주목한다.</p>
</div></div>
<div class="pv-lock"><span class="pv-lock-ic">${T.icon('lock')}</span><b>결제하시면 나머지 78 Page를 완성해 드려요</b><small>실존 참고문헌 42편 · 석·박사 전문가 최종 검토 · 메일로 전달</small></div></div>
</div>
<div class="hx-more" id="hxMore"><span class="hx-more-t" id="hxMoreT">${T.icon('mail-check')}<span>석사 80 Page ${L80 ? `<s>${won(L80)}</s> ` : ''}<b>${won(Q80.total)}</b> · AI 집필 하루 완성</span></span><a class="btn btn-primary btn-sm" id="hxGo" href="${go}">내 논문 의뢰하기</a></div>
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
  const oneDay = [['master', '석사논문'], ['doctor', '박사논문'], ['journal', '학술지 논문']];
  const body = `
<section class="hx" aria-labelledby="hx-h">
<div class="wrap hx-in">
<div class="hx-copy">
<h1 class="hx-h1" id="hx-h"><span class="eyebrow">AI 논문 완성 서비스</span><span class="h-display hx-h">관심 주제 한 줄로<br>논문을 완성합니다</span></h1>
<p class="lead hx-lead">관심 주제와 전공만 알려 주세요. 제목과 목차, 본문, 참고문헌까지 논문AI가 집필하고, 석·박사 전문가가 최종 검토해서 메일로 보내 드려요.</p>
<ul class="hx-oneday" aria-label="하루 완성 논문">${oneDay.map(([t, n]) => `<li><a href="${T.u('/paper/new/')}?type=${t}&amp;task=full">${T.icon('timer')}<span><b>하루 완성</b> ${n}</span></a></li>`).join('')}</ul>
<p class="hx-deal"><span class="hx-deal-k">석사학위논문 80 Page</span><span class="hx-deal-v">${wasPrice(L80, Q80.total)}<b class="num">${won(Q80.total)}</b></span><small>런칭 특가</small></p>
<div class="hx-cta"><a class="btn btn-primary btn-lg" href="${T.u('/paper/new/')}">논문 의뢰하기</a><a class="btn btn-ghost btn-lg" href="#pricing">가격표 보기</a></div>
<ul class="hx-proof2"><li>${T.icon('book-check')}참고문헌 100% 실존 검증</li><li>${T.icon('user-check')}석·박사 전문가 최종 검토</li><li>${T.icon('credit-card')}회원가입 없이 바로 결제</li></ul>
<p class="hx-trust">${T.icon('building-2')}<span>운영 <b>성균관컨설팅</b> · 성균관대학교 RISE사업 지원 기업</span></p>
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
<div class="rv-hd">${verifiedBadge({ size: 48, cls: 'vbadge rv-badge' })}<p class="eyebrow">참고문헌 100% 실존 검증</p></div>
<h2 class="h-2" id="rv-h">AI가 지어낸 참고문헌은<br>한 편도 넣지 않아요</h2>
<p class="rv-lead">일반 AI 채팅은 그럴듯한 가짜 논문을 지어내기도 해요. 논문AI는 실제로 존재하는 문헌만 쓰고, 문장마다 근거가 된 문헌을 본문 인용으로 이어 드려요.</p>
<ol class="rv-steps">
<li><b>실존 문헌만 찾아요</b><span>국내외 학술 데이터베이스에서 주제에 맞는 문헌을 찾고, 원문을 확인할 수 있는 문헌만 후보로 둬요.</span></li>
<li><b>서지 정보를 한 편씩 대조해요</b><span>저자, 연도, 제목, 학술지, 권호, 쪽, DOI를 원문 기록과 하나하나 맞춰요.</span></li>
<li><b>본문 인용과 목록을 1:1로 맞춰요</b><span>본문에 인용한 문헌은 모두 참고문헌에 있고, 참고문헌의 문헌은 모두 본문에 인용돼요.</span></li>
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
<tr><td><b>국내 학술지 논문 24편</b><small class="ko">KCI 등재·등재후보 학술지</small></td><td><span class="rv-src">KCI</span></td><td><span class="rv-ok">${T.icon('check')}확인</span></td><td class="r num">80곳</td></tr>
<tr><td><b>학위논문·단행본 14편</b><small class="ko">국내외 학위논문과 전문 서적</small></td><td><span class="rv-src">RISS</span></td><td><span class="rv-ok">${T.icon('check')}확인</span></td><td class="r num">34곳</td></tr>
</tbody>
</table>
</div>
</div>
</div>
</section>

<section class="sec" id="pricing" aria-labelledby="tier-h">
<div class="wrap">
<div class="sec-head is-center"><p class="eyebrow eyebrow-sale">런칭 특가</p><h2 class="h-2 price-h" id="tier-h">석사논문 <span class="nowrap">80 Page</span>, <span class="num nowrap" data-q="master:80">${won(Q80.total).replace('원', '')}</span>원</h2><p>정가 ${won(L80)}인 석사학위논문을 런칭 특가로 맡겨 보세요. 박사학위논문 130 Page는 정가 ${won(L130)}에서 <span data-q="doctor:130">${won(Q130.total).replace('원', '')}</span>원이에요. 실존 참고문헌과 본문 인용, <span class="nowrap">석·박사 전문가</span> 최종 검토까지 모두 들어 있어요.</p></div>
${pageTiers(T)}
<p class="tiers-foot">학술지 투고논문 20 Page는 ${won(Q20.total)}이에요. 논문 첨삭, 교수님 피드백 반영, 통계분석 가격은 <a href="${T.u('/pricing/')}">전체 가격표</a>에서 확인해 보세요.</p>
</div>
</section>

<section class="sec sec-alt" aria-labelledby="oneday-h">
<div class="wrap oneday">
<div class="sec-head"><p class="eyebrow">하루 완성</p><h2 class="h-2" id="oneday-h">오늘 의뢰하면, 하루 만에 집필을 끝내요</h2><p>결제가 확인되면 AI가 하루 안에 논문 본문을 완성하고, 석·박사 전문가가 실존 문헌과 수치, 형식을 꼼꼼히 검토해서 보내 드려요.</p></div>
<ol class="flow4">
<li><span class="flow4-n">1</span><b>관심 주제 적기</b><p>관심 주제나 키워드, 전공을 편하게 적고 논문 종류를 골라 주세요. 제목은 정하지 않아도 괜찮아요.</p></li>
<li><span class="flow4-n">2</span><b>바로 결제</b><p>주문서를 내면 결제 화면이 바로 열려요. 회원가입 없이 카드, 간편결제, 계좌이체로 결제할 수 있어요.</p></li>
<li><span class="flow4-n">3</span><b>AI 집필 하루 완성</b><p>주제를 다듬어 제목을 정하고, 실존 문헌으로 장별 본문을 쓰면서 인용을 하나하나 연결해요.</p></li>
<li><span class="flow4-n">4</span><b>전문가 최종 검토 후 전달</b><p>석·박사 전문가가 문헌, 수치, 형식을 검토한 완성본을 메일로 보내 드려요.</p></li>
</ol>
<ul class="oneday-list">
<li><a href="${T.u('/paper/new/')}?type=master&amp;task=full"><b>하루 완성 석사논문</b><span>80 Page · 전문가 검토 포함 영업일 ${Q80.days}일 이내 전달</span></a></li>
<li><a href="${T.u('/paper/new/')}?type=doctor&amp;task=full"><b>하루 완성 박사논문</b><span>130 Page · 전문가 검토 포함 영업일 ${Q130.days}일 이내 전달</span></a></li>
<li><a href="${T.u('/paper/new/')}?type=journal&amp;task=full"><b>하루 완성 학술지 논문</b><span>20 Page · 전문가 검토 포함 영업일 ${Q20.days}일 이내 전달</span></a></li>
<li><a href="${T.u('/paper/new/')}?type=bachelor&amp;task=full"><b>하루 완성 졸업논문</b><span>30 Page · 전문가 검토 포함 영업일 ${Q30.days}일 이내 전달</span></a></li>
</ul>
</div>
</section>

<section class="sec" aria-labelledby="cmp-h">
<div class="wrap cmp">
<div class="sec-head"><h2 class="h-2" id="cmp-h">일반 AI 채팅과 무엇이 다를까요</h2><p>문장을 만들어 주는 것과 제출할 수 있는 논문을 완성하는 것은 전혀 다른 일이에요.</p></div>
<div class="table-wrap"><table class="cmp-table">
<thead><tr><th scope="col">항목</th><th scope="col">일반 AI 채팅</th><th scope="col" class="is-us">논문AI</th></tr></thead>
<tbody>
<tr><th scope="row">참고문헌</th><td data-label="일반 AI 채팅">그럴듯한 가짜 문헌이 섞일 수 있음</td><td class="is-us" data-label="논문AI">${T.icon('check')}실존 문헌만, DOI·KCI·RISS 대조</td></tr>
<tr><th scope="row">본문 인용</th><td data-label="일반 AI 채팅">근거를 직접 찾아 달아야 함</td><td class="is-us" data-label="논문AI">${T.icon('check')}문장마다 연결, 목록과 1:1</td></tr>
<tr><th scope="row">분량</th><td data-label="일반 AI 채팅">한 번에 몇 쪽 남짓</td><td class="is-us" data-label="논문AI">${T.icon('check')}15 Page부터 130 Page까지 장별 완성</td></tr>
<tr><th scope="row">연구 설계</th><td data-label="일반 AI 채팅">물어볼 때마다 답이 달라짐</td><td class="is-us" data-label="논문AI">${T.icon('check')}연구모형·가설·분석 계획까지 일관된 설계</td></tr>
<tr><th scope="row">통계분석</th><td data-label="일반 AI 채팅">실제 데이터 분석이 어려움</td><td class="is-us" data-label="논문AI">${T.icon('check')}실제 데이터로 SPSS 분석과 해석</td></tr>
<tr><th scope="row">양식</th><td data-label="일반 AI 채팅">형식은 직접 맞춰야 함</td><td class="is-us" data-label="논문AI">${T.icon('check')}APA 7판, 학교·학술지 양식 적용</td></tr>
<tr><th scope="row">검토</th><td data-label="일반 AI 채팅">없음</td><td class="is-us" data-label="논문AI">${T.icon('check')}석·박사 전문가 최종 검토</td></tr>
</tbody></table></div>
</div>
</section>

<section class="sec sec-alt" aria-labelledby="svc-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="svc-h">논문 완성 말고도, 필요한 것만 맡기세요</h2><p>이미 쓴 원고가 있거나 한 단계만 막혔다면 그 부분만 따로 맡길 수 있어요.</p></div>
<div class="svc2">
${[
    ['file-pen-line', '논문 첨삭·교정', '문장과 논리, 형식을 다듬고 수정 내역을 표시해 드려요.', `석사 30 Page ${price('P-MASTER-EDIT')}`, '/thesis-editing/'],
    ['message-square-text', '교수님 피드백 반영', '수정 대조표를 만들고 반영한 부분을 파란색으로 표시해 드려요.', `석사 10개 항목 ${price('P-MASTER-FB')}`, '/professor-feedback/'],
    ['clipboard-list', '연구계획서', '연구 목적과 이론, 방법, 참고문헌까지 심사용으로 써 드려요.', `석사 ${price('P-MASTER-PROP')}`, '/research-proposal/'],
    ['list-checks', '설문조사 원스톱', '설문지 작성부터 설문조사 진행, 통계 해석까지 한 번에 맡길 수 있어요.', price('S-FULL'), '/survey/'],
    ['chart-column', '논문 맞춤 통계분석', '주제와 가설에 맞는 분석을 설계하고 APA 통계표와 해석을 드려요.', `표준형 ${price('T-INTERP')}`, '/statistics/'],
    ['presentation', '심사 발표 PPT', '논문 핵심을 담은 발표 자료와 장표별 스크립트를 만들어 드려요.', `${price('A-PPT')}`, '/pricing/'],
  ].map(([ic, t, d, p, h]) => `<a class="svc2-item" href="${T.u(h)}"><span class="svc2-ic">${T.icon(ic)}</span><b>${esc(t)}</b><span class="svc2-d">${esc(d)}</span><span class="svc2-p">${esc(p)}</span></a>`).join('')}
</div>
<div class="svc svc-quick"><span class="svc-quick-t">바로 신청하기</span><a class="btn btn-dark" href="${T.u('/paper/new/')}">논문 의뢰하기</a><a class="btn btn-ghost" href="${T.u('/survey/new/')}">설문조사 의뢰하기</a><a class="btn btn-ghost" href="${T.u('/statistics/new/')}">통계분석 의뢰하기</a></div>
</div>
</section>

<section class="sec" aria-labelledby="out-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="out-h">받아 보시는 결과물</h2><p>논문 심사에서 실제로 쓰는 형식 그대로 보내 드려요. 아래는 결과물 형식을 보여 드리기 위한 예시예요.</p></div>
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
<dl class="art-dl"><div><dt>연구 제목</dt><dd>${DEMO_TITLE}</dd></div><div><dt>연구 유형</dt><dd>양적 연구(설문조사) · 영향 관계 검증</dd></div><div><dt>연구 가설</dt><dd>H1 워라밸 인식은 이직의도에 부(-)의 영향을 미칠 것이다.<br>H2 일-여가, 일-가족, 일-성장 균형은 이직의도에 각각 부(-)의 영향을 미칠 것이다.<br>H3 성별과 직급에 따라 워라밸 인식과 이직의도에 차이가 있을 것이다.</dd></div><div><dt>분석 계획</dt><dd>신뢰도 분석, 기술통계, t검정·분산분석, 상관분석, 다중회귀분석</dd></div><div><dt>표본</dt><dd>최소 77명, 탈락률 15% 고려 91명 이상</dd></div></dl>
</div></div></div>
<div class="tab-panel" role="tabpanel" id="out-2" aria-labelledby="tab-2" hidden>
<div class="art sheet art-page"><div class="art-in">
<p class="pg-ch">제1장 서론</p><p class="pg-sec">1. 연구의 필요성</p>
<p class="pg-body">일과 삶의 균형은 MZ세대 직장인이 직장을 고르고 머무는 핵심 기준이 되었다<span class="pg-cite">(Kelliher et al., 2019)</span>. 직원의 이직은 숙련 인력의 손실과 채용·교육 비용으로 이어져 조직의 지속가능성을 위협한다<span class="pg-cite">(Hom et al., 2017)</span>. 직무요구-자원 이론은 과도한 업무 요구가 소진을 거쳐 이탈로 이어진다고 설명한다<span class="pg-cite">(Bakker et al., 2023)</span>.</p>
<p class="pg-body pg-fade">특히 워라밸을 중시하는 MZ세대는 일과 삶의 균형이 무너질 때 이직을 고려하는 경향이 크다고 알려져 있으나, 세대 차이를 실증 자료로 확인한 연구<span class="pg-cite">(Rudolph et al., 2021)</span>는 아직 충분하지 않다.</p>
<p class="art-cap">예시 문단이에요. 실제 원고는 주문하신 주제와 자료를 바탕으로 쓰고, 인용 문헌은 모두 실제로 확인되는 문헌만 사용해요.</p>
</div></div></div>
<div class="tab-panel" role="tabpanel" id="out-3" aria-labelledby="tab-3" hidden>
<div class="art sheet"><div class="art-in art-grid">
<table class="apa"><caption><b>표 6</b><i>워라밸이 이직의도에 미치는 영향</i></caption><thead><tr><th>변인</th><th><span class="st">B</span></th><th><span class="st">SE</span></th><th>β</th><th><span class="st">t</span></th></tr></thead><tbody><tr><td>일-여가 균형</td><td>-0.31</td><td>0.08</td><td>-.29</td><td>-3.88***</td></tr><tr><td>일-가족 균형</td><td>-0.22</td><td>0.07</td><td>-.21</td><td>-3.14**</td></tr><tr><td>일-성장 균형</td><td>-0.18</td><td>0.07</td><td>-.17</td><td>-2.57*</td></tr></tbody><tfoot><tr><td colspan="5"><span class="st">R</span>² = .34, <span class="st">F</span> = 27.41***. 예시 수치입니다.</td></tr></tfoot></table>
<div class="easy"><p class="easy-h">결과 해석</p><p>일과 여가, 가족, 성장의 균형을 높게 인식할수록 이직의도가 낮았습니다. 세 요인이 이직의도를 34% 설명했고, 그중 일-여가 균형의 영향이 가장 컸습니다.</p></div>
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
<div class="sec-head"><h2 class="h-2" id="tools-h">가입 없이 써 보는 무료 도구</h2><p>로그인 없이 바로 쓰는 연구 도구예요. 결과는 브라우저 안에서 계산되고 저장되지 않아요.</p></div>
<div class="tools">
<a class="tool" href="${T.u('/free/')}"><span class="tool-ic">${T.icon('workflow')}</span><b>무료 논문 설계</b><span>주제 한 줄로 연구모형과 가설, 분석 계획을 받아 보세요.</span></a>
<a class="tool" href="${T.u('/tools/toc/')}"><span class="tool-ic">${T.icon('list-tree')}</span><b>논문 목차 생성기</b><span>제목과 연구방법을 넣으면 장·절·항 목차를 만들어 드려요.</span></a>
<a class="tool" href="${T.u('/tools/references/')}"><span class="tool-ic">${T.icon('book-open-text')}</span><b>참고문헌 생성기</b><span>학술지, 단행본, 학위논문을 APA 7판 형식으로 바꿔 드려요.</span></a>
<a class="tool" href="${T.u('/tools/sample-size/')}"><span class="tool-ic">${T.icon('calculator')}</span><b>표본 수 계산기</b><span>회귀, t검정, 분산분석, 상관, 카이제곱 표본 수를 계산해 보세요.</span></a>
</div>
</div>
</section>

<section class="sec" aria-labelledby="trust-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="trust-h">믿고 맡길 수 있도록</h2><p>논문은 연구자의 이름으로 남아요. 그래서 지키는 원칙이 분명해요.</p></div>
<ul class="trust4">
<li>${T.icon('book-check')}<b>실존 문헌만 인용</b><span>존재하지 않는 논문이나 출처는 쓰지 않아요.</span></li>
<li>${T.icon('database')}<b>실제 데이터만 분석</b><span>학습용 시뮬레이션에는 가상 데이터 표시가 붙어요.</span></li>
<li>${T.icon('lock-keyhole')}<b>주문별 비공개 보관</b><span>주문번호와 조회 비밀번호가 있어야 열람할 수 있어요.</span></li>
<li>${T.icon('timer-reset')}<b>90일 뒤 자동 삭제</b><span>전달 후 보관 기간이 지나면 파일을 자동으로 지워요.</span></li>
</ul>
<p class="trust-more"><a href="${T.u('/ethics/')}">연구윤리 원칙 자세히 보기</a></p>
</div>
</section>

${faqBlock(T, HOME_FAQ, { lead: `하루 완성, 석사논문 작성 비용, 실존 참고문헌까지 가장 많이 물어보시는 질문을 모았어요. 더 많은 답은 <a href="${T.u('/faq/')}">자주 묻는 질문</a>에서 볼 수 있어요.` })}

${ctaBand(T, { title: '관심 주제 한 줄이면 시작돼요', text: '주제와 전공만 적으면 논문AI가 집필하고 전문가가 검토해서 메일로 보내 드려요. 참고문헌은 모두 실존 검증된 문헌이에요.', topic: true })}
`;
  return [{
    path: '/',
    body,
    kind: 'home',
    title: '논문AI | 하루 완성 석사·박사논문, 실존 참고문헌 AI 논문 작성',
    h1: '논문AI',
    description: `관심 주제 한 줄로 석사·박사논문을 완성하는 AI 논문 작성 서비스. AI 집필 하루 완성, 석·박사 전문가 최종 검토, 참고문헌 100% 실존 검증. 석사 80 Page ${won(Q80.total)}(정가 ${won(L80)}), 박사 130 Page ${won(Q130.total)}, 학사 ${won(Q30.total)}, 소논문 ${won(Q15.total)}.`,
    keywords: ['논문AI', '논문 AI', '하루 완성 논문', '하루 완성 석사논문', '하루 완성 박사논문', '논문 하루 완성', '논문 자동작성', '논문 작성 AI', 'AI 논문 작성', '석사논문 작성', '박사논문 작성', '학위논문 작성', '학술지 논문 작성', '졸업논문 작성', '소논문 작성', '논문 작성 사이트', '논문 작성 비용', '석사논문 비용', '논문 첨삭', '논문 컨설팅', '논문 통계분석', '논문 참고문헌'],
    ogImage: '/assets/img/og/home.png',
    faq: HOME_FAQ,
    styles: ['site', 'home'],
    scripts: ['home'],
    priority: '1.0',
    changefreq: 'weekly',
    geo: `논문AI는 관심 주제 한 줄(전공·주제)로 논문을 완성하는 AI 논문 작성 서비스이다. 결제가 확인되면 AI 집필로 하루 안에 본문을 완성하고, 석·박사 전문가가 실존 문헌과 수치, 형식을 최종 검토해 완성본을 메일로 보낸다. 참고문헌은 DOI·KCI·RISS 원문 기록과 대조한 실존 문헌만 쓰고 본문 인용과 참고문헌 목록을 1:1로 연결한다. 가격(런칭 특가)은 석사학위논문 80 Page ${won(Q80.total)}(정가 ${won(L80)}), 박사학위논문 130 Page ${won(Q130.total)}(정가 ${won(L130)}), 학술지 투고논문 20 Page ${won(Q20.total)}, 학사 졸업논문 30 Page ${won(Q30.total)}, 소논문 15 Page ${won(Q15.total)}이다. 전문가 검토를 포함한 전달은 석사 영업일 ${Q80.days}일, 박사 ${Q130.days}일 이내이다. 논문 첨삭·교정(석사 30 Page ${price('P-MASTER-EDIT')}), 교수님 피드백 반영(${price('P-MASTER-FB')}), 연구계획서(${price('P-MASTER-PROP')}), 설문조사 원스톱(${price('S-FULL')}), 논문 통계분석(${price('T-BASIC')}부터)도 주문할 수 있다.`,
    schema: [{
      '@context': 'https://schema.org', '@type': 'Service', name: '논문AI 논문 완성', serviceType: 'AI 논문 작성, 논문 첨삭, 설문조사, 통계분석', provider: { '@id': T.abs('/#organization') }, areaServed: { '@type': 'Country', name: 'KR' },
      description: '관심 주제 한 줄로 논문을 완성하고 실존 참고문헌과 본문 인용을 연결하는 AI 논문 작성 서비스(AI 집필 하루 완성, 전문가 최종 검토)',
      hasOfferCatalog: { '@type': 'OfferCatalog', name: '논문AI 서비스', itemListElement: [
        { '@type': 'Offer', name: '소논문 15 Page 완성', price: Q15.total, priceCurrency: 'KRW', url: T.abs('/ai-thesis/') },
        { '@type': 'Offer', name: '학사 졸업논문 30 Page 완성', price: Q30.total, priceCurrency: 'KRW', url: T.abs('/thesis-writing/') },
        { '@type': 'Offer', name: '석사학위논문 80 Page 완성', price: Q80.total, priceCurrency: 'KRW', url: T.abs('/master-thesis/') },
        { '@type': 'Offer', name: '박사학위논문 130 Page 완성', price: Q130.total, priceCurrency: 'KRW', url: T.abs('/dissertation/') },
        { '@type': 'Offer', name: '학술지 투고논문 20 Page 완성', price: Q20.total, priceCurrency: 'KRW', url: T.abs('/journal-paper/') },
        { '@type': 'Offer', name: '논문 첨삭·교정', price: item('P-MASTER-EDIT').price, priceCurrency: 'KRW', url: T.abs('/thesis-editing/') },
        { '@type': 'Offer', name: '교수님 피드백 반영', price: item('P-MASTER-FB').price, priceCurrency: 'KRW', url: T.abs('/professor-feedback/') },
        { '@type': 'Offer', name: '설문조사 원스톱(설문지 작성부터 통계 해석까지)', price: item('S-FULL').price, priceCurrency: 'KRW', url: T.abs('/survey/') },
        { '@type': 'Offer', name: '논문 맞춤 통계분석 표준형', price: item('T-INTERP').price, priceCurrency: 'KRW', url: T.abs('/statistics/') },
      ] },
    }],
  }];
}
