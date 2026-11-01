// 공통 섹션 조각
import { buildDesign, tocToText } from '../js/core/engine.js';
import { renderModelSVG } from '../js/core/model-svg.js';
import { DEFAULT_CATALOG, won, computeQuote } from '../js/core/pricing.js';
import { esc, readLineHtml, factsHtml, tocHtml } from '../js/core/render.js';

export function faqBlock(T, faq, { id = 'faq', title = '자주 묻는 질문', lead = '' } = {}) {
  return `<section class="sec" id="${id}" aria-labelledby="${id}-h"><div class="wrap-narrow">
<div class="sec-head"><h2 class="h-2" id="${id}-h">${esc(title)}</h2>${lead ? `<p>${lead}</p>` : ''}</div>
<div class="faq">${faq.map((f) => `<details><summary>${esc(f.q)}${T.icon('plus')}</summary><div class="ans">${f.html || esc(f.a)}</div></details>`).join('')}</div>
</div></section>`;
}

export function crumbs(T, list) {
  return `<nav class="crumbs" aria-label="현재 위치"><ol>${list.map((c, i) => i < list.length - 1 ? `<li><a href="${T.u(c[1])}">${esc(c[0])}</a></li>` : `<li aria-current="page">${esc(c[0])}</li>`).join('')}</ol></nav>`;
}

export function ctaBand(T, { title, text, primary, secondary, topic = false }) {
  return `<section class="cta-band"><div class="wrap cta-in">
<div class="cta-copy"><h2 class="h-2">${title}</h2>${text ? `<p>${text}</p>` : ''}</div>
${topic ? `<form class="cta-form" action="${T.u('/paper/new/')}" method="get"><label class="sr" for="ctaTopic">논문 주제 또는 관심 키워드</label><input class="input" id="ctaTopic" name="title" placeholder="예: 대학생의 SNS 이용과 우울의 관계" autocomplete="off"><button class="btn btn-primary btn-lg" type="submit">무료 설계 시작</button></form>`
    : `<div class="cta-actions">${primary ? `<a class="btn btn-primary btn-lg" href="${T.u(primary[1])}">${esc(primary[0])}</a>` : ''}${secondary ? `<a class="btn btn-ghost-inv btn-lg" href="${T.u(secondary[1])}">${esc(secondary[0])}</a>` : ''}</div>`}
</div></section>`;
}

export function item(code) { return DEFAULT_CATALOG.items.find((i) => i.code === code); }
export function price(code) { const it = item(code); return it ? won(it.price) : ''; }

export function priceTable(T, codes, { caption = '' } = {}) {
  const rows = codes.map((c) => {
    const it = item(c);
    if (!it) return '';
    const unit = it.baseUnits ? `기준 ${it.baseUnits}${it.unitLabel}` : '';
    return `<tr><th scope="row"><span class="pt-name">${esc(it.name)}</span>${unit ? `<span class="pt-unit">${unit} · 추가 ${it.unitSize}${it.unitLabel}당 ${won(it.unitPrice)}</span>` : ''}</th><td class="pt-days" data-days="${esc(c)}">${it.days ? `영업일 ${it.days}일` : '견적 후 안내'}</td><td class="pt-price num" data-price="${esc(c)}">${it.quoteOnly ? '별도 견적' : won(it.price)}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="price-table">${caption ? `<caption>${esc(caption)}</caption>` : ''}<thead><tr><th scope="col">상품</th><th scope="col">기본 납기</th><th scope="col">가격(부가세 포함)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export const STATUS_STEPS = [
  ['접수 완료', '결제가 확인되면 주문이 접수되고 예상 전달일이 정해집니다.'],
  ['자료 확인', '올려 주신 원고·양식·데이터를 확인하고 빠진 자료가 있으면 바로 요청합니다.'],
  ['작업 준비', '연구 설계와 작업 범위를 확정합니다.'],
  ['작성·분석 진행', '원고 작성과 통계분석을 진행합니다.'],
  ['품질 검토', '문헌·수치·형식을 검토하고 다듬습니다.'],
  ['전달 완료', '주문 페이지에서 결과물을 내려받고 수정을 요청할 수 있습니다.'],
];

export function statusTimeline(T, active = 3) {
  return `<ol class="tl" aria-label="주문 진행 단계">${STATUS_STEPS.map((s, i) => `<li class="tl-step${i < active ? ' is-done' : i === active ? ' is-now' : ''}"><span class="tl-dot" aria-hidden="true">${i < active ? T.icon('check') : ''}</span><span class="tl-txt"><b>${esc(s[0])}</b><small>${esc(s[1])}</small></span></li>`).join('')}</ol>`;
}

export const tocList = tocHtml;

export function demoDesign(title = '간호사의 직무스트레스가 이직의도에 미치는 영향: 회복탄력성의 매개효과') {
  return buildDesign({ title, typeId: 'master', start: '2026-11-02' });
}

export const demoFacts = factsHtml;

export function heroDemo(T) {
  const d = demoDesign();
  const examples = [
    '간호사의 직무스트레스가 이직의도에 미치는 영향: 회복탄력성의 매개효과',
    '대학생의 SNS 이용과 우울의 관계에서 자기효능감의 조절효과',
    '웃음치료 프로그램이 요양시설 노인의 우울에 미치는 효과',
    '호텔 종사원의 서비스품질이 고객만족과 재방문의도에 미치는 영향',
  ];
  const chip = ['간호사 직무스트레스', '대학생 SNS 이용', '웃음치료 프로그램', '호텔 서비스품질'];
  return `<div class="demo sheet sheet-stack" id="heroDemo" data-default="${esc(examples[0])}">
<div class="sheet-label"><strong>논문 설계 미리보기</strong><span class="demo-live"><i aria-hidden="true"></i>입력하는 즉시 계산</span></div>
<div class="demo-in">
<label class="demo-lab" for="demoTitle">논문 주제나 제목을 적어 보세요</label>
<textarea class="demo-input" id="demoTitle" rows="2" spellcheck="false">${esc(examples[0])}</textarea>
<div class="demo-chips" role="group" aria-label="예시 주제">${examples.map((e, i) => `<button type="button" class="chip" data-example="${esc(e)}">${esc(chip[i])}</button>`).join('')}</div>
</div>
<div class="demo-out" aria-live="polite">
<div class="demo-read" id="demoRead">${readLine(d)}</div>
<div class="demo-model" id="demoModel">${renderModelSVG(d.model, { compact: true })}</div>
<div id="demoFacts">${demoFacts(d)}</div>
<div class="demo-toc" id="demoToc">${tocList(d.toc, { limit: 9 })}</div>
</div>
<div class="demo-foot"><a class="btn btn-primary btn-block" id="demoGo" href="${T.u('/paper/new/')}?title=${encodeURIComponent(examples[0])}">이 설계로 시작하기</a><p class="tiny muted">설계 미리보기는 무료이며, 신청 전까지 어떤 비용도 발생하지 않습니다.</p></div>
</div>`;
}

export const readLine = readLineHtml;

export { tocToText };

// 분량별 요금: 소논문 8쪽·석사 80쪽·박사 130쪽 카드와 분량 계산기(동작은 js/app/tiers.js)
export const fullQuote = (typeId, pages) => computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId, task: 'full', pages } });
const wonNum = (n) => Math.round(Number(n) || 0).toLocaleString('ko-KR');

function tierCard(T, { kind, pages, typeId, sub, inc, featured = false, cta }) {
  const q = fullQuote(typeId, pages);
  const href = `${T.u('/paper/new/')}?${new URLSearchParams({ type: typeId, task: 'full', pages: String(pages) })}`;
  return `<article class="tier${featured ? ' is-featured' : ''}" data-tier="${typeId}" data-pages="${pages}">
<div class="tier-hd"><span class="tier-kind">${esc(kind)}</span>${featured ? '<span class="tier-flag">석사 표준 분량</span>' : ''}</div>
<p class="tier-pages"><b class="num">${pages}</b>쪽</p>
<p class="tier-price"><b class="num" data-tier-total>${wonNum(q.total)}</b>원</p>
<p class="tier-sub"><span>${esc(sub)}</span><span class="tier-days" data-tier-days>영업일 ${q.days}일</span></p>
<ul class="tier-inc">${inc.map((x) => `<li>${T.icon('check')}<span>${esc(x)}</span></li>`).join('')}</ul>
<a class="btn ${featured ? 'btn-primary' : 'btn-ghost'} btn-block" href="${href}">${esc(cta)}</a>
</article>`;
}

export function pageTiers(T) {
  const q80 = fullQuote('master', 80);
  return `<div class="tiers">
${tierCard(T, { kind: '소논문', pages: 8, typeId: 'personal', sub: '과제 소논문·개인 연구, 15쪽까지 같은 금액', inc: ['주제와 연구 질문 정리', '본문 원고 8쪽', '실존 참고문헌과 본문 인용', '수정 1회'], cta: '8쪽 소논문 시작하기' })}
${tierCard(T, { kind: '석사학위논문', pages: 80, typeId: 'master', featured: true, sub: '기준 60쪽에 추가 20쪽 포함', inc: ['연구 설계서(연구모형·가설·분석 계획)', '서론부터 결론까지 장별 본문 80쪽', '실존 참고문헌과 본문 인용', 'APA 7판·학교 양식 적용', '수정 1회'], cta: '80쪽 석사논문 시작하기' })}
${tierCard(T, { kind: '박사학위논문', pages: 130, typeId: 'doctor', sub: '기준 120쪽에 추가 10쪽 포함', inc: ['연구 설계서와 연구모형', '장별 본문 130쪽', '실존 참고문헌과 본문 인용', '학교 양식 적용', '수정 1회'], cta: '130쪽 박사논문 시작하기' })}
</div>
<div class="calc" id="tierCalc">
<div class="calc-l">
<p class="calc-h">다른 분량이 필요하세요?</p>
<div class="calc-seg" role="radiogroup" aria-label="논문 종류">${[['personal', '소논문'], ['bachelor', '학사'], ['journal', '학술지'], ['master', '석사'], ['doctor', '박사']].map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === 'master'}" data-type="${v}">${t}</button>`).join('')}</div>
<label class="sr" for="calcRange">쪽수</label>
<input class="calc-range" id="calcRange" type="range" min="40" max="130" step="1" value="80">
<div class="calc-scale"><span id="calcMin">40쪽</span><span id="calcMax">130쪽</span></div>
</div>
<div class="calc-r" aria-live="polite">
<p class="calc-pages"><b class="num" id="calcPages">80</b>쪽</p>
<p class="calc-total"><b class="num" id="calcTotal">${wonNum(q80.total)}</b>원</p>
<p class="calc-note" id="calcNote">기준 60쪽 + 추가 20쪽 · 영업일 ${q80.days}일</p>
<a class="btn btn-dark" id="calcGo" href="${T.u('/paper/new/')}?type=master&amp;task=full&amp;pages=80">이 분량으로 시작하기</a>
</div>
</div>`;
}
