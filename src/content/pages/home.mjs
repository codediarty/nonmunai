import { faqBlock, ctaBand, price, item, pageTiers, verifiedBadge, verifiedCard } from '../../templates/parts.mjs';
import { esc } from '../../templates/layout.mjs';
import { computeQuote, DEFAULT_CATALOG, won, listPriceFor, offText, PROMO_NAME, PROMO_SHORT } from '../../js/core/pricing.js';
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

// 히어로 예시 논문의 참고문헌: 모두 실존 문헌(Crossref에서 저자·연도·제목·학술지·권호·쪽·DOI 확인), APA 7판 목록 순서
// 본문 문장은 각 문헌이 실제로 다룬 내용(초록·결론)과 맞게 썼다. 예시를 바꿀 때도 확인한 문헌만 넣는다.
const REFS = [
  { id: 'r1', cite: 'Bakker et al., 2023', html: 'Bakker, A. B., Demerouti, E., &amp; Sanz-Vergel, A. (2023). Job demands–resources theory: Ten years later. <i>Annual Review of Organizational Psychology and Organizational Behavior, 10</i>(1), 25–53.', doi: '10.1146/annurev-orgpsych-120920-053933', n: 3 },
  { id: 'r8', cite: 'Greenhaus et al., 2003', html: 'Greenhaus, J. H., Collins, K. M., &amp; Shaw, J. D. (2003). The relation between work–family balance and quality of life. <i>Journal of Vocational Behavior, 63</i>(3), 510–531.', doi: '10.1016/S0001-8791(02)00042-8', n: 2 },
  { id: 'r5', cite: 'Griffeth et al., 2000', html: 'Griffeth, R. W., Hom, P. W., &amp; Gaertner, S. (2000). A meta-analysis of antecedents and correlates of employee turnover: Update, moderator tests, and research implications for the next millennium. <i>Journal of Management, 26</i>(3), 463–488.', doi: '10.1177/014920630002600305', n: 2 },
  { id: 'r6', cite: 'Haar et al., 2014', html: 'Haar, J. M., Russo, M., Suñe, A., &amp; Ollier-Malaterre, A. (2014). Outcomes of work–life balance on job satisfaction, life satisfaction and mental health: A study across seven cultures. <i>Journal of Vocational Behavior, 85</i>(3), 361–373.', doi: '10.1016/j.jvb.2014.08.010', n: 2 },
  { id: 'r2', cite: 'Hom et al., 2017', html: 'Hom, P. W., Lee, T. W., Shaw, J. D., &amp; Hausknecht, J. P. (2017). One hundred years of employee turnover theory and research. <i>Journal of Applied Psychology, 102</i>(3), 530–545.', doi: '10.1037/apl0000103', n: 4 },
  { id: 'r3', cite: 'Kelliher et al., 2019', html: 'Kelliher, C., Richardson, J., &amp; Boiarintseva, G. (2019). All of work? All of life? Reconceptualising work-life balance for the 21st century. <i>Human Resource Management Journal, 29</i>(2), 97–112.', doi: '10.1111/1748-8583.12215', n: 3 },
  { id: 'r4', cite: 'Rudolph et al., 2021', html: 'Rudolph, C. W., Rauvola, R. S., Costanza, D. P., &amp; Zacher, H. (2021). Generations and generational differences: Debunking myths in organizational science and practice and paving new paths forward. <i>Journal of Business and Psychology, 36</i>(6), 945–967.', doi: '10.1007/s10869-020-09715-2', n: 2 },
  { id: 'r7', cite: 'Twenge et al., 2010', html: 'Twenge, J. M., Campbell, S. M., Hoffman, B. J., &amp; Lance, C. E. (2010). Generational differences in work values: Leisure and extrinsic values increasing, social and intrinsic values decreasing. <i>Journal of Management, 36</i>(5), 1117–1142.', doi: '10.1177/0149206309352246', n: 2 },
];
const DEMO_READ = readPrompt(DEMO_PROMPT);
const ref = (id) => REFS.find((r) => r.id === id);
const cite = (id) => `<cite class="hx-cite" data-ref="${id}" tabindex="0">(${ref(id).cite})</cite>`;

// 히어로 작성 화면의 서론 '연구의 필요성': 화면에서 한 덩어리씩 써 내려가다가 마지막 문단 중간에서 끊기고,
// 나머지(CUT 뒤)는 모자이크로 가려진다. 인용은 [r번호]로 적는다.
const NEED = [
  '최근 기업에서는 1980년대 초반부터 2000년대 초반 사이에 태어난 이른바 MZ세대가 조직의 핵심 구성원으로 자리 잡으면서, 일하는 방식과 조직문화에도 적지 않은 변화가 나타나고 있다. 1976년, 1991년, 2006년의 미국 고등학교 졸업반을 비교한 연구에 따르면, 젊은 세대로 갈수록 여가를 중시하는 가치는 꾸준히 높아진 반면 삶에서 일이 차지하는 비중은 줄어들었다[r7]. 이처럼 일 못지않게 개인의 삶을 중시하는 흐름 속에서 일과 삶의 균형, 이른바 워라밸은 MZ세대 직장인이 직장을 고르고 머무는 중요한 기준이 되었다.',
  '워라밸은 개인이 일과 가정의 역할에 고르게 참여하고 두 역할 모두에서 고르게 만족하는 정도로 정의되어 왔다[r8]. 다만 기존 연구는 삶을 주로 자녀 돌봄으로, 일을 한 직장에서의 전일제 근무로 좁게 이해해 왔다는 한계가 있어, 최근에는 다양한 삶의 영역과 근무 형태를 아우르는 개념으로 넓혀 보아야 한다는 주장이 힘을 얻고 있다[r3]. 실제로 일곱 개 문화권의 근로자를 분석한 연구에서 워라밸은 직무만족과 삶의 만족을 높이고 불안과 우울은 낮추는 것으로 나타나[r6], 개인의 안녕과 조직의 성과를 함께 좌우하는 요인으로 주목받고 있다.',
  '한편 직원의 자발적 이직은 숙련 인력의 손실과 대체 인력의 채용·교육 비용으로 이어져 조직의 경쟁력을 떨어뜨리기 때문에, 지난 한 세기 동안 조직 연구의 핵심 주제로 다루어져 왔다[r2]. 특히 이직의도는 실제 이직을 예측하는 가장 강력한 선행 변인 가운데 하나로 확인되어[r5], 이직의도를 높이는 요인을 미리 파악하는 일은 인적자원관리의 중요한 과제가 되었다. 직무요구-자원 이론은 과도한 직무요구가 소진을, 충분한 직무자원이 직무열의를 이끈다고 설명하며, 최근에는 일과 가정의 자원이 서로 이어진다는 일-가정 자원 모델로 그 범위를 넓혔다[r1].',
  '그러나 워라밸과 이직의도의 관계를 다룬 연구가 꾸준히 이루어져 왔음에도, MZ세대 직장인을 대상으로 그 영향을 직접 검증한 연구는 아직 충분하지 않다. 더욱이 세대 차이에 관한 주장 가운데 상당수는 방법론적 한계를 지닌 통념에 기대고 있어, 세대의 특성을 미리 전제하기보다 실증 자료로 확인해야 한다는 비판이 제기되어 왔다[r4]. 이에 본 연구는 MZ세대 직장인을 대상으로 워라밸이 이직의도에 미치는 영향을 실증적으로 분석하고, 일-여가, 일-가족, 일-성장 균형 가운데 CUT어떤 요인이 이직의도를 가장 크게 낮추는지 확인하고자 한다. 아울러 성별과 직급에 따른 차이를 함께 살펴봄으로써, MZ세대 인재의 이탈을 줄이기 위한 인적자원관리 방안을 제시하고자 한다.',
];
const withCites = (s) => s.replace(/\[(r\d)\]/g, (_, id) => cite(id));
const NEED_SHOWN = NEED.map((p) => p.split('CUT')[0].trimEnd());
const NEED_REST = NEED[NEED.length - 1].split('CUT')[1];
// 작성 화면의 실존 확인 목록은 본문에 처음 인용되는 순서로
const CITE_ORDER = [...NEED.join('').matchAll(/\[(r\d)\]/g)].map((m) => m[1]);
const PANE_REFS = [...CITE_ORDER, ...REFS.map((r) => r.id).filter((id) => !CITE_ORDER.includes(id))].map(ref);
export { CITE_ORDER };

// 프롬프트에서 읽어 낸 내용(종류·전공·키워드) 칩
export function readChips(r) {
  const chips = [];
  if (r.typeId) chips.push(TYPE_LABEL[r.typeId]);
  if (r.pages) chips.push(`${r.pages} Page`);
  if (r.major) chips.push(r.major);
  for (const k of r.keywords) chips.push(`#${k}`);
  return chips.map((c) => `<span class="hx-chip">${esc(c)}</span>`).join('');
}

// 히어로 작성 화면: 지면 목차와 집필 현황 표시
const TOC = [['제1장 서론', 1], ['제2장 이론적 배경', 9], ['제3장 연구 방법', 29], ['제4장 연구 결과', 44], ['제5장 결론', 71]];

const wasPrice = (list, total) => (list ? `<s class="num">${won(list)}</s><em>${offText(list, total, { short: true })}</em>` : '');

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
<li data-step="5"><i aria-hidden="true"></i>박사 검수</li>
</ol>
<div class="hx-body">
<article class="hx-doc" id="hxDoc" aria-label="작성 중인 논문 예시">
<div class="hx-scroll" id="hxScroll">
<div class="hx-page" id="hxPage">
<p class="hx-meta" data-blk>석사학위논문 · 본문 80 Page · APA 7판</p>
<p class="hx-ttl" data-blk>${DEMO_TITLE}</p>
<div class="hx-tocx" data-blk><p class="hx-tocx-h">목차</p><ol>${TOC.map(([t, pg]) => `<li data-blk><span>${t}</span><i aria-hidden="true"></i><b class="num">${pg}</b></li>`).join('')}</ol></div>
<p class="hx-ch" data-blk>제1장 서론</p>
<p class="hx-sec" data-blk>1. 연구의 필요성</p>
<div class="hx-flow" id="hxFlow">${NEED_SHOWN.map((p) => `<p class="hx-p">${withCites(p)}</p>`).join('')}</div>
<div class="pv-lockzone hx-lock" id="hxLock" aria-hidden="true"><div class="pv-mosaic"><div class="pv-mz-in">
<p class="hx-p2 hx-cont">${NEED_REST}</p>
<p class="hx-sec">2. 연구의 목적</p>
<p class="hx-p2">본 연구의 목적은 MZ세대 직장인이 인식하는 워라밸이 이직의도에 미치는 영향을 확인하고, 그 결과를 바탕으로 조직이 MZ세대 인재를 붙잡기 위해 무엇을 지원해야 하는지 제시하는 데 있다. 이를 위한 구체적인 연구 문제는 다음과 같다.</p>
<p class="hx-p2 hx-q">연구 문제 1. MZ세대 직장인이 인식하는 워라밸은 이직의도에 어떠한 영향을 미치는가?</p>
<p class="hx-p2 hx-q">연구 문제 2. 워라밸의 하위 요인인 일-여가, 일-가족, 일-성장 균형은 이직의도에 각각 어떠한 영향을 미치는가?</p>
<p class="hx-p2 hx-q">연구 문제 3. 성별과 직급에 따라 워라밸 인식과 이직의도에 차이가 있는가?</p>
<p class="hx-ch">제2장 이론적 배경</p>
<p class="hx-sec">1. 워라밸의 개념과 선행연구</p>
<p class="hx-p2">국내에서는 근로시간 단축과 유연근무 확산을 계기로 워라밸이 직장 선택의 주요 기준으로 자리 잡았으며, 이를 일-여가, 일-가족, 일-성장의 균형으로 나누어 측정하는 연구가 이어져 왔다.</p>
<p class="hx-p2">선행연구는 워라밸 인식이 높을수록 직무만족이 높아지고 이직의도는 낮아진다고 보고하며, 이 관계가 세대에 따라 어떻게 다른지에 주목한다.</p>
</div></div>
<div class="pv-lock"><span class="pv-lock-ic">${T.icon('lock')}</span><b>결제하시면 나머지 78 Page를 완성해 드려요</b><small>실존 참고문헌 42편 · 전공 분야 박사 최종 검수 후 메일로 전달</small></div></div>
</div>
</div>
<div class="hx-hud" id="hxHud" aria-hidden="true"><i class="hx-hud-dot"></i><b id="hxHudT">AI 집필 중</b><span class="num" id="hxHudN">0자</span><span id="hxHudC">인용 0곳</span></div>
<div class="hx-more" id="hxMore"><span class="hx-more-t" id="hxMoreT">${T.icon('mail-check')}<span>석사 80 Page ${L80 ? `<s>${won(L80)}</s> ` : ''}<b>${won(Q80.total)}</b> · 전공 박사 검수 후 전달</span></span><a class="btn btn-primary btn-sm" id="hxGo" href="${go}">내 논문 의뢰하기</a></div>
</article>
<aside class="hx-refpane" id="hxRefs" aria-label="참고문헌 실존 확인">
<div class="hx-rp-hd"><span id="hxVerifyLabel">참고문헌 실존 확인</span><b class="num" id="hxVerifyN">42/42</b></div>
<div class="hx-meter" aria-hidden="true"><i></i></div>
<p class="hx-rp-note" id="hxVerifyNote">후보 248편 중 42편 채택 · DOI·KCI·RISS 대조</p>
<ol class="hx-refs" id="hxRefList">${PANE_REFS.map((r) => `<li id="hx-${r.id}" data-ref="${r.id}" data-blk><b class="hx-ra">${r.cite.replace(/, (\d{4})$/, ' ($1)')}</b><span class="hx-rt">${r.html.replace(/^[^)]*\)\. /, '').replace(/<i>([^,<]+)[^<]*<\/i>.*$/, '<i>$1</i>')}</span><span class="hx-doi">doi.org/${r.doi}</span><span class="hx-badges"><span class="hx-ok">${T.icon('check')}DOI 확인</span><span class="hx-n">본문 인용 ${r.n}곳</span></span></li>`).join('')}</ol>
</aside>
</div>
</div>
</div>`;
}

// 홈 가이드 묶음: 무료 도구와 논문을 쓰는 단계별로 많이 찾는 가이드(제목의 쌍점 앞은 링크 글, 뒤는 보조 설명)
const GUIDE_GROUPS = [
  ['주제와 설계', ['choosing-thesis-topic', 'research-proposal-guide', 'how-to-write-thesis', 'thesis-table-of-contents']],
  ['설문과 통계', ['how-to-make-questionnaire', 'survey-sample-size', 'cronbach-alpha', 'spss-analysis-guide']],
  ['문헌, 심사, 투고', ['literature-review-prisma', 'apa7-references', 'professor-feedback-revision', 'journal-submission']],
];
const TOOL_LINKS = [
  ['/free/', '무료 논문 설계', '주제 한 줄로 연구모형과 가설'],
  ['/tools/toc/', '논문 목차 생성기', '장·절·항 목차 자동 구성'],
  ['/tools/sample-size/', '표본 수 계산기', '회귀, t검정, 분산분석'],
  ['/tools/references/', '참고문헌 생성기', 'APA 7판 형식으로 변환'],
];
function guideBlock(T, guides) {
  const bySlug = new Map((guides || []).map((g) => [g.slug, g]));
  const li = (href, head, sub) => `<li><a href="${href}"><b>${esc(head)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</a></li>`;
  const cols = GUIDE_GROUPS.map(([label, slugs]) => {
    const items = slugs.map((s) => bySlug.get(s)).filter(Boolean).map((g) => {
      const [head, ...rest] = g.title.split(':');
      return li(T.u(`/guide/${g.slug}/`), head.trim(), rest.join(':').trim());
    }).join('');
    return items ? `<div class="gd3-col"><p class="gd3-t">${esc(label)}</p><ul>${items}</ul></div>` : '';
  }).join('');
  const tools = `<div class="gd3-col"><p class="gd3-t"><a href="${T.u('/tools/')}">무료 도구</a></p><ul>${TOOL_LINKS.map(([h, t, s]) => li(T.u(h), t, s)).join('')}</ul></div>`;
  return `<div class="gd3 gd3-solo"><div class="gd3-hd"><h2 class="h-3" id="gd-h">논문 쓰다 막힐 때 보는 무료 가이드와 도구</h2><a href="${T.u('/guide/')}">논문 작성 가이드 전체 보기</a></div><div class="gd3-cols gd3-4">${tools}${cols}</div></div>`;
}

// 홈은 짧게: 첫 화면(주제 한 줄) → 논문 종류 고르기(가격) → 진행 순서 → 세 가지 약속 → 따로 맡기기 → 자주 묻는 질문 → 가이드 → 마지막 안내
export default function home({ T, guides }) {
  const go = T.u('/paper/new/');
  const body = `
<section class="hx" aria-labelledby="hx-h">
<div class="wrap hx-in">
<div class="hx-copy">
<h1 class="hx-h1" id="hx-h"><span class="eyebrow">논문AI · AI 논문 작성, 전공 박사 최종 검수</span><span class="h-display hx-h">관심 주제 한 줄로<br>논문을 완성합니다</span></h1>
<p class="lead hx-lead">주제만 적고 논문 종류를 고르면 끝이에요. 논문AI가 실존 참고문헌으로 본문을 쓰고, 같은 전공 분야 박사가 최종 검수한 완성본을 메일로 보내 드려요.</p>
<p class="hx-deal"><span class="hx-deal-k">석사학위논문 80 Page</span><span class="hx-deal-v">${wasPrice(L80, Q80.total)}<b class="num">${won(Q80.total)}</b></span><small>${PROMO_SHORT}</small></p>
<div class="hx-cta"><a class="btn btn-primary btn-lg" href="${go}">논문 의뢰하기</a><a class="hx-cta-sub" href="#pricing">논문 종류별 가격 보기</a></div>
<ul class="hx-proof2"><li>${T.icon('book-check')}참고문헌 100% 실존 검증</li><li>${T.icon('user-check')}전공 분야 박사 최종 검수</li><li>${T.icon('shield-check')}철저한 보안 관리 · 회원가입 없이 주문</li></ul>
<p class="hx-trust">${T.icon('building-2')}<span>운영 <b>성균관컨설팅</b> · 성균관대학교 RISE사업 지원 기업</span></p>
</div>
<div class="hx-visual">${heroWindow(T)}</div>
</div>
</section>

<section class="sec" id="pricing" aria-labelledby="tier-h">
<div class="wrap">
<div class="sec-head is-center"><p class="eyebrow eyebrow-sale">${PROMO_NAME}</p><h2 class="h-2" id="tier-h">논문 종류만 고르면 바로 시작해요</h2><p>고르신 종류로 주문서가 바로 열려요. 석사학위논문 80 Page는 정가 ${won(L80)}에서 <span class="num" data-q="master:80">${won(Q80.total).replace('원', '')}</span>원, 박사학위논문 130 Page는 <span class="num" data-q="doctor:130">${won(Q130.total).replace('원', '')}</span>원이에요.</p></div>
${pageTiers(T)}
</div>
</section>

<section class="sec sec-alt" id="how" aria-labelledby="how-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="how-h">주문은 1분, 나머지는 논문AI가 해요</h2><p>제목이나 목차, 연구 방법을 정해 오지 않으셔도 돼요. 회원가입도 필요 없어요.</p></div>
<ol class="flow4 flow3">
<li><span class="flow4-n">1</span><b>관심 주제 적기</b><p>"직장인 워라밸이랑 이직 관련해서"처럼 편하게 적고 논문 종류를 골라 주세요.</p></li>
<li><span class="flow4-n">2</span><b>바로 결제</b><p>결제 화면이 바로 열려요. 카드, 간편결제, 계좌이체로 결제하시면 바로 집필이 시작돼요.</p></li>
<li><span class="flow4-n">3</span><b>검수 완료본 받기</b><p>AI가 쓰고 같은 전공 박사가 검수한 완성본을 메일로 보내 드려요. 석사학위논문은 영업일 ${Q80.days}일 이내예요.</p></li>
</ol>
</div>
</section>

<section class="sec" id="trust" aria-labelledby="trust-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="trust-h">믿고 맡길 수 있는 세 가지 약속</h2><p>문장만 만들어 주는 AI 채팅과 달리, 심사에 낼 수 있는 논문으로 끝까지 책임져요.</p></div>
<div class="why3">
<article class="why" id="references">${verifiedBadge({ size: 40, cls: 'vbadge why-ic' })}<h3>참고문헌 100% 실존 검증</h3><p>AI가 지어낸 가짜 논문은 한 편도 넣지 않아요. 저자, 연도, 제목, 권호, DOI를 DOI·KCI·RISS 원문 기록과 한 편씩 대조하고, 본문 인용과 참고문헌 목록을 1:1로 맞춰요.</p><a href="${T.u('/ai-thesis/')}">AI 논문 자동작성과 실존 문헌 검증</a></article>
<article class="why"><span class="why-ic why-ic-ink">${T.icon('user-check')}</span><h3>전공 분야 박사 최종 검수</h3><p>같은 전공 박사가 연구 설계와 논리, 참고문헌, 통계 수치, 전공 용어, 학교 양식을 한 줄씩 확인해요. 검수를 모두 통과한 완성본만 보내 드려요.</p><a href="${T.u('/process/')}">신청부터 전달까지 진행 방식</a></article>
<article class="why" id="secure"><span class="why-ic why-ic-ink">${T.icon('shield-check')}</span><h3>철저한 보안 관리</h3><p>집필과 검수는 이름 대신 주문번호로 진행하고, 모든 담당자는 비밀유지 의무를 지켜요. 전달 후 90일이 지나면 올리신 자료와 완성본을 모두 자동으로 영구 삭제해요.</p><a href="${T.u('/privacy/')}">자료 보관과 삭제 기준</a></article>
</div>
</div>
</section>

<section class="sec sec-alt" aria-labelledby="svc-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="svc-h">필요한 것만 따로 맡길 수도 있어요</h2><p>이미 쓴 원고가 있거나 한 단계만 막혔다면 그 부분만 맡기세요. 어디서부터 맡길지 모르겠다면 <a href="${T.u('/consulting/')}">논문 컨설팅</a>으로 막힌 단계부터 정리해 드려요.</p></div>
<div class="svc2">
${[
    ['file-pen-line', '논문 첨삭·교정', '문장, 논리, 인용, 형식을 다듬고 수정 내역을 표시해 드려요.', `석사 30 Page ${price('P-MASTER-EDIT')}`, '/thesis-editing/'],
    ['message-square-text', '교수님 피드백 반영', '피드백 항목 수와 관계없이 한 번에 반영하고 수정표까지 드려요.', `석사·박사 ${price('P-MASTER-FB')}`, '/professor-feedback/'],
    ['clipboard-list', '연구계획서 작성', '연구 목적, 이론, 방법, 참고문헌까지 심사용으로 써 드려요.', `석사 ${price('P-MASTER-PROP')}`, '/research-proposal/'],
    ['list-checks', '설문조사 원스톱', '설문지 작성부터 설문 진행, 결과 정리와 통계 해석까지 맡겨요.', price('S-FULL'), '/survey/'],
    ['chart-column', '논문 통계분석', 'SPSS 분석과 APA 통계표, 결과 해석까지 드려요.', `표준형 ${price('T-INTERP')}`, '/statistics/'],
    ['compass', '논문 컨설팅', '주제 선정부터 심사 준비까지 막힌 단계를 함께 정리해요.', '필요한 단계만 선택', '/consulting/'],
  ].map(([ic, t, d, p, h]) => `<a class="svc2-item" href="${T.u(h)}"><span class="svc2-ic">${T.icon(ic)}</span><b>${esc(t)}</b><span class="svc2-d">${esc(d)}</span><span class="svc2-p">${esc(p)}</span></a>`).join('')}
</div>
<div class="svc svc-quick"><span class="svc-quick-t">바로 신청하기</span><a class="btn btn-dark" href="${T.u('/paper/new/')}">논문 의뢰하기</a><a class="btn btn-ghost" href="${T.u('/survey/new/')}">설문조사 의뢰하기</a><a class="btn btn-ghost" href="${T.u('/statistics/new/')}">통계분석 의뢰하기</a></div>
</div>
</section>

${faqBlock(T, HOME_FAQ, { lead: `AI 논문 작성, 석사논문·박사논문 비용, 실존 참고문헌, 박사 검수까지 가장 많이 물어보시는 질문이에요. 더 많은 답은 <a href="${T.u('/faq/')}">자주 묻는 질문</a>에서 볼 수 있어요.` })}

<section class="sec sec-alt" aria-labelledby="gd-h">
<div class="wrap">
${guideBlock(T, guides)}
</div>
</section>

${ctaBand(T, { title: '관심 주제 한 줄이면 시작돼요', text: '주제만 적으면 논문AI가 쓰고, 같은 전공 분야 박사가 최종 검수까지 마친 완성본을 메일로 보내 드려요.', topic: true })}
`;
  return [{
    path: '/',
    body,
    kind: 'home',
    title: '논문AI | AI 논문 작성, 전공 박사가 검수하는 석사논문·박사논문',
    h1: '논문AI',
    description: `논문AI는 관심 주제 한 줄로 석사·박사논문을 완성하는 AI 논문 작성 서비스예요. AI가 실존 참고문헌으로 집필하고 같은 전공 분야 박사가 최종 검수까지 마친 뒤 보내 드려요. 석사 80 Page ${won(Q80.total)}(정가 ${won(L80)}), 박사 130 Page ${won(Q130.total)}, 학사 ${won(Q30.total)}, 소논문 ${won(Q15.total)}.`,
    keywords: ['논문AI', '논문 AI', 'AI 논문', 'AI 논문 작성', '논문 작성 AI', '논문 써주는 AI', '논문 자동작성', '논문 작성', '논문 작성 사이트', '석사논문', '석사논문 작성', '석사논문 비용', '박사논문 작성', '학위논문 작성', '학술지 논문 작성', '졸업논문 작성', '소논문 작성', '논문 작성 비용', '논문 박사 검수', '논문 참고문헌', '논문 첨삭', '논문 통계분석', '논문 컨설팅'],
    ogImage: '/assets/img/og/home.png',
    faq: HOME_FAQ,
    styles: ['site', 'home'],
    scripts: ['home'],
    priority: '1.0',
    changefreq: 'weekly',
    geo: `논문AI는 관심 주제 한 줄(전공·주제)로 논문을 완성하는 AI 논문 작성 서비스이다. 주문은 관심 주제를 적고 논문 종류(소논문, 학사 졸업논문, 학술지 투고논문, 석사학위논문, 박사학위논문)를 고른 뒤 결제하면 끝나며 회원가입이 필요 없다. 결제가 확인되면 AI가 실존 문헌으로 본문을 집필하고, 주문 논문과 같은 전공 분야의 박사가 연구 설계와 논리, 참고문헌, 통계 수치, 형식을 최종 검수한 뒤 완성본을 메일로 보낸다. 참고문헌은 DOI·KCI·RISS 원문 기록과 대조한 실존 문헌만 쓰고 본문 인용과 참고문헌 목록을 1:1로 연결한다. 일반 AI 채팅과 달리 가짜 참고문헌을 쓰지 않고, 15 Page부터 130 Page까지 장별로 논문 한 편을 끝까지 완성한다. 가격(${PROMO_NAME})은 석사학위논문 80 Page ${won(Q80.total)}(정가 ${won(L80)}), 박사학위논문 130 Page ${won(Q130.total)}(정가 ${won(L130)}), 학술지 투고논문 20 Page ${won(Q20.total)}, 학사 졸업논문 30 Page ${won(Q30.total)}, 소논문 15 Page ${won(Q15.total)}이다. 박사 검수를 포함한 전달은 석사 영업일 ${Q80.days}일, 박사 ${Q130.days}일 이내이다. 논문 첨삭·교정(석사 30 Page ${price('P-MASTER-EDIT')}), 교수님 피드백 반영(${price('P-MASTER-FB')}), 연구계획서(${price('P-MASTER-PROP')}), 설문조사 원스톱(${price('S-FULL')}), 논문 통계분석(${price('T-BASIC')}부터), 논문 컨설팅도 주문할 수 있다. 결제와 영수증은 운영사 성균관컨설팅 이름으로 처리된다.`,
    schema: [{
      '@context': 'https://schema.org', '@type': 'Service', name: '논문AI 논문 완성', serviceType: 'AI 논문 작성, 논문 첨삭, 설문조사, 통계분석', provider: { '@id': T.abs('/#organization') }, areaServed: { '@type': 'Country', name: 'KR' },
      description: '관심 주제 한 줄로 논문을 완성하고 실존 참고문헌과 본문 인용을 연결하는 AI 논문 작성 서비스(AI 집필, 같은 전공 박사 최종 검수)',
      hasOfferCatalog: { '@type': 'OfferCatalog', name: '논문AI 서비스', itemListElement: [
        { '@type': 'Offer', name: '소논문 15 Page 완성', price: Q15.total, priceCurrency: 'KRW', url: T.abs('/ai-thesis/') },
        { '@type': 'Offer', name: '학사 졸업논문 30 Page 완성', price: Q30.total, priceCurrency: 'KRW', url: T.abs('/thesis-writing/') },
        { '@type': 'Offer', name: '석사학위논문 80 Page 완성', price: Q80.total, priceCurrency: 'KRW', url: T.abs('/master-thesis/') },
        { '@type': 'Offer', name: '박사학위논문 130 Page 완성', price: Q130.total, priceCurrency: 'KRW', url: T.abs('/dissertation/') },
        { '@type': 'Offer', name: '학술지 투고논문 20 Page 완성', price: Q20.total, priceCurrency: 'KRW', url: T.abs('/journal-paper/') },
        { '@type': 'Offer', name: '논문 첨삭·교정', price: item('P-MASTER-EDIT').price, priceCurrency: 'KRW', url: T.abs('/thesis-editing/') },
        { '@type': 'Offer', name: '교수님 피드백 반영', price: item('P-MASTER-FB').price, priceCurrency: 'KRW', url: T.abs('/professor-feedback/') },
        { '@type': 'Offer', name: '설문조사 원스톱(설문지 작성부터 설문 결과·통계 해석까지)', price: item('S-FULL').price, priceCurrency: 'KRW', url: T.abs('/survey/') },
        { '@type': 'Offer', name: '논문 맞춤 통계분석 표준형', price: item('T-INTERP').price, priceCurrency: 'KRW', url: T.abs('/statistics/') },
      ] },
    }],
  }];
}
