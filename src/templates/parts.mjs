// 공통 섹션 조각
import { buildDesign, tocToText } from '../js/core/engine.js';
import { renderModelSVG } from '../js/core/model-svg.js';
import { DEFAULT_CATALOG, won, computeQuote, listPriceFor, offText } from '../js/core/pricing.js';
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
${topic ? `<form class="cta-form" action="${T.u(topic === 'free' ? '/free/' : '/paper/new/')}" method="get"><label class="sr" for="ctaTopic">관심 주제나 키워드</label><input class="input" id="ctaTopic" name="${topic === 'free' ? 'title' : 'prompt'}" placeholder="관심 주제나 키워드를 입력하세요" autocomplete="off"><button class="btn btn-primary btn-lg" type="submit">${topic === 'free' ? '무료 설계 보기' : '논문 의뢰하기'}</button></form>`
    : `<div class="cta-actions">${primary ? `<a class="btn btn-primary btn-lg" href="${T.u(primary[1])}">${esc(primary[0])}</a>` : ''}${secondary ? `<a class="btn btn-ghost-inv btn-lg" href="${T.u(secondary[1])}">${esc(secondary[0])}</a>` : ''}</div>`}
</div></section>`;
}

export function item(code) { return DEFAULT_CATALOG.items.find((i) => i.code === code); }
export function price(code) { const it = item(code); return it ? won(it.price) : ''; }
// 소논문 추가 분량 문구(가격표로 계산): 예) "4쪽 추가마다 9,000원"
export function shortExtra() { const s = item('P-SHORT-FULL'); return s ? `${s.unitSize} Page 추가마다 ${won(s.unitPrice)}` : ''; }

export function priceTable(T, codes, { caption = '' } = {}) {
  const rows = codes.map((c) => {
    const it = item(c);
    if (!it) return '';
    const ul = it.unitLabel === '쪽' ? ' Page' : (it.unitLabel || '');
    const unit = it.baseUnits ? `기준 ${it.baseUnits}${ul}` : '';
    const list = listPriceFor(c, it.price);
    return `<tr><th scope="row"><span class="pt-name">${esc(it.name)}</span>${it.unitLabel === '항목' ? '<span class="pt-unit">수정 대조표 · 반영 부분 파란색 표시본 포함</span>' : unit ? `<span class="pt-unit">${unit} · 추가 ${it.unitSize}${ul}당 ${won(it.unitPrice)}</span>` : ''}</th><td class="pt-days" data-days="${esc(c)}">${it.days ? `영업일 ${it.days}일` : '견적 후 안내'}</td><td class="pt-price num" data-price="${esc(c)}">${list ? `<s class="pt-list">${won(list)}</s>` : ''}${it.quoteOnly ? '별도 견적' : won(it.price)}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="price-table">${caption ? `<caption>${esc(caption)}</caption>` : ''}<thead><tr><th scope="col">상품</th><th scope="col">기본 납기</th><th scope="col">가격(부가세 포함)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export const STATUS_STEPS = [
  ['접수 완료', '결제가 확인되면 주문이 접수되고 예상 전달일이 정해져요.'],
  ['자료 확인', '올려 주신 원고·양식·데이터를 확인하고, 빠진 자료가 있으면 바로 말씀드려요.'],
  ['작업 준비', '연구 설계와 작업 범위를 확정해요.'],
  ['작성·분석 진행', 'AI 집필과 통계분석을 진행해요.'],
  ['박사 검수', '같은 전공 분야의 박사가 설계, 문헌, 수치, 형식을 검수하고 바로잡아요.'],
  ['전달 완료', '주문 페이지에서 결과물을 내려받고 수정을 요청할 수 있어요.'],
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
<div class="demo-foot"><a class="btn btn-primary btn-block" id="demoGo" href="${T.u('/paper/new/')}?title=${encodeURIComponent(examples[0])}">이 설계로 의뢰하기</a><p class="tiny muted">설계 미리보기는 무료예요. 의뢰하기 전까지는 비용이 전혀 들지 않아요.</p></div>
</div>`;
}

export const readLine = readLineHtml;

export { tocToText };

// 논문 완성 가격 카드(소논문 15 Page·학사 30 Page·석사 80 Page·박사 130 Page): 정가와 할인 이름(온라인 단독가)을 함께 보여 준다(동작은 js/app/tiers.js)
export const fullQuote = (typeId, pages) => computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId, task: 'full', pages } });
const wonNum = (n) => Math.round(Number(n) || 0).toLocaleString('ko-KR');
export const TIERS = [
  { kind: '소논문', pages: 15, typeId: 'short', desc: '수업 과제와 학회 발표용 한 편', inc: ['주제와 연구 질문 정리', '본문 15 Page', '실존 참고문헌과 본문 인용', '전공 분야 박사 최종 검수, 수정 1회'], cta: '소논문 의뢰하기' },
  { kind: '학사 졸업논문', pages: 30, typeId: 'bachelor', desc: '졸업 요건에 맞춘 학부 논문', inc: ['주제·목차 구성', '장별 본문 30 Page', '실존 참고문헌과 본문 인용', '전공 분야 박사 최종 검수, 수정 1회'], cta: '졸업논문 의뢰하기' },
  { kind: '석사학위논문', pages: 80, typeId: 'master', featured: true, desc: '연구 설계부터 결론까지 학위논문 한 편', inc: ['연구모형·가설·분석 계획 연구 설계서', '서론부터 결론까지 장별 본문 80 Page', '실존 참고문헌과 본문 인용(APA 7판)', '전공 분야 박사 최종 검수, 수정 1회'], cta: '석사논문 의뢰하기' },
  { kind: '박사학위논문', pages: 130, typeId: 'doctor', desc: '장별 집필 계획으로 끝까지 일관되게', inc: ['연구모형과 장별 집필 계획', '장별 본문 130 Page', '실존 참고문헌과 본문 인용(APA 7판)', '전공 분야 박사 최종 검수, 수정 1회'], cta: '박사논문 의뢰하기' },
];

function tierCard(T, { kind, pages, typeId, desc, inc, featured = false, cta }) {
  const q = fullQuote(typeId, pages);
  const code = q.lines[0] ? q.lines[0].code : '';
  const list = listPriceFor(code, q.total);
  const href = `${T.u('/paper/new/')}?${new URLSearchParams({ type: typeId, task: 'full' })}`;
  return `<article class="tier${featured ? ' is-featured' : ''}" data-tier="${typeId}" data-pages="${pages}">
<div class="tier-hd"><h3 class="tier-name">${esc(kind)}<span class="tier-pg num">${pages} Page</span></h3>${featured ? '<span class="tier-flag">가장 많이 선택</span>' : ''}</div>
<p class="tier-desc">${esc(desc)}</p>
<p class="tier-was"${list ? '' : ' hidden'}><s class="num" data-tier-list>${list ? `${wonNum(list)}원` : ''}</s><em class="num" data-tier-off>${list ? offText(list, q.total, { short: true }) : ''}</em></p>
<p class="tier-price"><b class="num" data-tier-total>${wonNum(q.total)}</b>원</p>
<p class="tier-meta"><span>실존 참고문헌</span><span>전공 박사 최종 검수</span></p>
<a class="btn ${featured ? 'btn-primary' : 'btn-dark'} btn-block" href="${href}">${esc(cta)}</a>
<ul class="tier-inc">${inc.map((x) => `<li>${T.icon('check')}<span>${esc(x)}</span></li>`).join('')}</ul>
</article>`;
}

export function pageTiers(T) {
  return `<div class="tiers">
${TIERS.map((t) => tierCard(T, t)).join('\n')}
</div>
<ul class="tier-trust">
<li>${T.icon('credit-card')}카드·간편결제·계좌이체</li>
<li>${T.icon('lock-keyhole')}안전결제</li>
<li>${T.icon('file-text')}한글·워드·PDF로 전달</li>
<li>${T.icon('receipt-text')}부가세 포함</li>
</ul>`;
}

// 참고문헌 실존 검증 배지: 파란 인증 마크(가장자리가 물결진 원 + 흰 체크)
export function verifiedBadge({ size = 40, color = '#2346E8', cls = 'vbadge' } = {}) {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const a = (Math.PI * 2 * i) / 24 - Math.PI / 2;
    const r = i % 2 ? 15.4 : 18.2;
    pts.push(`${(20 + r * Math.cos(a)).toFixed(2)},${(20 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><polygon points="${pts.join(' ')}" fill="${color}" stroke="${color}" stroke-width="2.6" stroke-linejoin="round"/><path d="M13.2 20.4l4.6 4.6 9-9.4" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
export function verifiedCard({ title = '참고문헌 100% 실존 검증', sub = 'DOI · KCI · RISS 원문과 한 편씩 대조', cls = '' } = {}) {
  return `<div class="vcard${cls ? ` ${cls}` : ''}">${verifiedBadge({ size: 40 })}<span><b>${esc(title)}</b><small>${esc(sub)}</small></span></div>`;
}
