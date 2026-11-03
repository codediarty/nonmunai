import { faqBlock, ctaBand, crumbs, priceTable, price, item, statusTimeline, STATUS_STEPS, pageTiers, fullQuote, shortExtra } from '../../templates/parts.mjs';
import { esc } from '../../templates/layout.mjs';
import { won, listPriceFor } from '../../js/core/pricing.js';
import { FAQ_GROUPS, ALL_FAQ } from '../faq.mjs';

function pageHead(T, title, lead, path, label) {
  return `<section class="phero phero-sm"><div class="wrap">${crumbs(T, [['홈', '/'], [label, path]])}<h1 class="h-1" style="margin-top:20px">${esc(title)}</h1><p class="lead" style="max-width:40em">${lead}</p></div></section>`;
}

export default function info({ T }) {
  const pages = [];

  // 가격
  const W = (t, p) => won(fullQuote(t, p).total);
  const U = (code) => won(item(code).unitPrice);
  const qn = (t, p) => `<span data-q="${t}:${p}">${W(t, p).replace('원', '')}</span>원`;
  const LP = (code, t, pg) => won(listPriceFor(code, fullQuote(t, pg).total));
  const B = (code) => item(code).baseUnits;
  const pricingFaq = [
    { q: '논문 작성 비용은 얼마인가요?', a: `지금은 런칭 특가로 소논문 15 Page ${W('short', 15)}, 학사 졸업논문 30 Page ${W('bachelor', 30)}, 학술지 투고논문 20 Page ${W('journal', 20)}, 석사학위논문 80 Page ${W('master', 80)}(정가 ${LP('P-MASTER-FULL', 'master', 80)}), 박사학위논문 130 Page ${W('doctor', 130)}(정가 ${LP('P-DOCTOR-FULL', 'doctor', 130)})에 맡기실 수 있어요. 실존 참고문헌과 본문 인용, 석·박사 전문가 최종 검토, 수정 1회까지 모두 포함된 금액이에요.` },
    { q: '석사논문 작성 비용은 얼마인가요?', a: `석사학위논문 80 Page는 정가 ${LP('P-MASTER-FULL', 'master', 80)}인데, 지금은 런칭 특가 ${W('master', 80)}에 맡기실 수 있어요. AI 집필은 하루 안에 끝나고, 석·박사 전문가 최종 검토까지 마친 완성본은 영업일 ${fullQuote('master', 80).days}일 이내에 메일로 보내 드려요.` },
    { q: '논문 첨삭 비용은 얼마인가요?', a: `논문 첨삭·교정은 석사학위논문 ${B('P-MASTER-EDIT')} Page 기준 ${price('P-MASTER-EDIT')}, 박사학위논문 ${B('P-DOCTOR-EDIT')} Page 기준 ${price('P-DOCTOR-EDIT')}, 학술지 논문 ${B('P-JOURNAL-EDIT')} Page 기준 ${price('P-JOURNAL-EDIT')}, 학사 졸업논문 ${B('P-BACHELOR-EDIT')} Page 기준 ${price('P-BACHELOR-EDIT')}이에요. 교수님 피드백 반영은 석사학위논문 ${B('P-MASTER-FB')}개 항목 기준 ${price('P-MASTER-FB')}이에요.` },
    { q: '논문 컨설팅 비용은 얼마인가요?', a: `연구 설계(연구모형, 가설, 목차, 표본 수)는 무료 논문 설계에서 먼저 받아 보실 수 있어요. 연구계획서 작성은 석사 ${price('P-MASTER-PROP')}, 박사 ${price('P-DOCTOR-PROP')}이고, 필요한 단계만 골라 맡기실 수 있어서 막힌 단계의 비용만 내시면 돼요.` },
    { q: '논문 통계분석 비용은 얼마인가요?', a: `논문 맞춤 통계분석은 기본형 ${price('T-BASIC')}, 표준형 ${price('T-INTERP')}이고, 연구결과(4장) 작성까지 맡기시면 ${price('T-CHAPTER')}이에요. 매개·조절효과 같은 심화 분석은 ${price('T-ADV')}이 더해지고, 설문지 작성부터 통계 해석까지 한 번에 맡기는 설문조사 원스톱은 ${price('S-FULL')}이에요.` },
    { q: '표시된 가격에 부가세가 포함되어 있나요?', a: '네, 모든 가격은 부가세를 포함한 금액이에요.' },
    { q: '응답자 모집 같은 작업은 어떻게 결제하나요?', a: '응답자 모집이나 구조방정식 같은 심화 분석처럼 조건에 따라 비용이 달라지는 작업은, 자료를 먼저 확인하고 견적을 확정해 드린 뒤에 결제하시면 돼요.' },
  ];
  const groups = [
    ['석사학위논문', ['P-MASTER-FULL', 'P-MASTER-PROP', 'P-MASTER-EDIT', 'P-MASTER-FB']],
    ['박사학위논문', ['P-DOCTOR-FULL', 'P-DOCTOR-PROP', 'P-DOCTOR-EDIT', 'P-DOCTOR-FB']],
    ['학술지 투고논문', ['P-JOURNAL-FULL', 'P-JOURNAL-EDIT', 'P-JOURNAL-FB']],
    ['학사·졸업논문', ['P-BACHELOR-FULL', 'P-BACHELOR-PROP', 'P-BACHELOR-EDIT', 'P-BACHELOR-FB']],
    ['일반 연구보고서', ['P-REPORT-FULL', 'P-REPORT-EDIT', 'P-REPORT-FB']],
    ['청소년 탐구논문', ['P-YOUTH-FULL', 'P-YOUTH-EDIT', 'P-YOUTH-FB']],
    ['개인 관심연구', ['P-PERSONAL-FULL', 'P-PERSONAL-EDIT', 'P-PERSONAL-FB']],
    ['소논문(15 Page)', ['P-SHORT-FULL']],
    ['설문조사', ['S-FULL', 'S-NEW', 'S-EDIT', 'S-FB', 'S-ANALYZE', 'S-RECRUIT']],
    ['통계분석', ['T-BASIC', 'T-INTERP', 'T-CHAPTER', 'T-FB', 'T-ADV', 'T-SIM']],
    ['추가 옵션', ['A-PPT', 'A-ENGLISH', 'A-FORMAT', 'A-REVISION', 'A-PRIORITY']],
  ];
  pages.push({
    path: '/pricing/', kind: 'info', navTitle: '가격 안내', h1: '논문AI 가격 안내',
    title: '논문AI 가격 | 논문 작성 비용, 논문 첨삭·컨설팅·통계분석 비용',
    description: `논문 작성 비용(런칭 특가): 석사논문 80 Page ${W('master', 80)}, 박사논문 130 Page ${W('doctor', 130)}, 학사 졸업논문 30 Page ${W('bachelor', 30)}, 소논문 15 Page ${W('short', 15)}. 실존 참고문헌과 본문 인용, 석·박사 전문가 최종 검토 포함. 논문 첨삭, 컨설팅, 통계분석·설문조사 가격까지 한눈에 보세요.`,
    keywords: ['논문 작성 비용', '논문 첨삭 비용', '논문 컨설팅 비용', '석사논문 작성 비용', '박사논문 작성 비용', '논문 자동작성 가격', '논문 교정 비용', '논문 통계분석 비용', '설문조사 비용'],
    crumbs: [['홈', '/'], ['가격 안내', '/pricing/']], faq: pricingFaq, priority: '0.9', styles: ['site', 'home'], scripts: ['pricing'],
    body: `${pageHead(T, '논문 한 편, 런칭 특가로 가볍게', `석사학위논문 80 Page는 정가 ${LP('P-MASTER-FULL', 'master', 80)}에서 런칭 특가 ${qn('master', 80)}, 박사학위논문 130 Page는 정가 ${LP('P-DOCTOR-FULL', 'doctor', 130)}에서 ${qn('doctor', 130)}이에요. 실존 참고문헌과 본문 인용, 석·박사 전문가 최종 검토까지 모두 기본으로 들어 있어요.`, '/pricing/', '가격 안내')}
<section class="sec sec-tight" id="tiers" aria-labelledby="tiers-h"><div class="wrap">
<div class="sec-head is-center"><h2 class="h-2" id="tiers-h">논문 완성</h2><p>관심 주제와 전공을 적고 논문 종류만 고르시면 바로 시작해요. AI 집필은 하루 안에 끝나고, 석·박사 전문가 최종 검토를 마친 완성본은 상품별 기본 납기 안에 메일로 보내 드려요.</p></div>
${pageTiers(T)}
</div></section>
<section class="sec sec-alt"><div class="wrap">
<div class="note" style="margin-bottom:36px;background:#fff">${T.icon('info')}<div><b>모든 가격은 부가세 포함이에요.</b> 기본 납기는 주말과 공휴일을 뺀 영업일 기준이고, 자료 보완을 기다리는 기간은 납기에 넣지 않아요. 기준 분량을 넘는 부분은 표에 적힌 단위로 추가돼요.</div></div>
${groups.map(([g, codes]) => `<div class="page-sec">${priceTable(T, codes, { caption: g })}</div>`).join('')}
</div></section>
${faqBlock(T, pricingFaq, { title: '가격 관련 자주 묻는 질문' })}
${ctaBand(T, { title: '관심 주제 한 줄이면 오늘 바로 시작할 수 있어요', text: '관심 주제와 전공만 적고 결제하시면 돼요. 석·박사 전문가 최종 검토를 마친 완성본을 메일로 보내 드려요.', primary: ['논문 의뢰하기', '/paper/new/'], secondary: ['통계분석 의뢰하기', '/statistics/new/'] })}`,
  });
  pages[pages.length - 1].geo = groups.map(([g, codes]) => `${g}: ${codes.map((c) => `${c} ${price(c) || '별도 견적'}`).join(', ')}`).join('\n');

  // 진행 방식
  pages.push({
    path: '/process/', kind: 'info', navTitle: '진행 방식', h1: '논문AI 진행 방식',
    title: '진행 방식 | 신청부터 결과물 전달까지 논문AI',
    description: '논문AI는 주문서 작성(약 1분), 바로 결제, AI 집필 하루 완성, 석·박사 전문가 최종 검토, 완성본 메일 전달 순서로 진행됩니다. 진행 단계는 담당 연구진이 실제로 처리한 시점에만 바뀝니다.',
    crumbs: [['홈', '/'], ['진행 방식', '/process/']],
    geo: `진행 단계: ${STATUS_STEPS.map((s) => `${s[0]}(${s[1]})`).join(' → ')}`,
    body: `${pageHead(T, '신청부터 전달까지, 실제 단계 그대로', '논문AI는 진행률을 그럴듯하게 꾸며 보여 드리지 않아요. 담당 연구진이 실제로 처리한 단계와 예상 전달일만 주문 페이지에 표시해요.', '/process/', '진행 방식')}
<section class="sec"><div class="wrap flow">
<div class="flow-copy">
<h2 class="h-2">네 단계면 끝나요</h2>
<ol class="steps">
<li><b>주문서 작성(약 1분)</b><span>관심 주제나 키워드와 전공을 적고 논문 종류를 골라 주세요. 제목은 정하지 않아도 괜찮고, 학교 양식과 참고 자료는 결제한 뒤에 보내 주셔도 돼요.</span></li>
<li><b>바로 결제</b><span>주문서를 내시면 결제 화면이 바로 열려요. 회원가입 없이 카드, 간편결제, 계좌이체로 결제하실 수 있어요.</span></li>
<li><b>AI 집필 하루 완성</b><span>결제가 확인되면 연구진이 주제를 다듬어 제목을 정하고, AI가 실존 문헌을 바탕으로 하루 안에 본문을 완성해요.</span></li>
<li><b>전문가 최종 검토와 전달</b><span>석·박사 전문가가 문헌, 수치, 형식을 꼼꼼히 검토한 완성본을 메일로 보내 드려요. 석사학위논문 80 Page는 영업일 ${fullQuote('master', 80).days}일 이내에 받아 보실 수 있고, 고치고 싶은 부분은 바로 수정을 요청하실 수 있어요.</span></li>
</ol></div>
<div class="flow-panel sheet"><div class="sheet-label"><strong>주문 페이지 진행 단계</strong><span>예시</span></div><div class="flow-panel-in">${statusTimeline(T, 4)}</div></div>
</div></section>
<section class="sec sec-alt"><div class="wrap">
<div class="sec-head"><h2 class="h-2">준비하면 좋은 자료</h2><p>꼭 필요한 자료는 고르신 작업에 맞춰 의뢰 화면에서 정확히 안내해 드려요. 아래는 있으면 결과물이 더 정확해지는 자료예요.</p></div>
<div class="table-wrap"><table class="g-table"><thead><tr><th>의뢰</th><th>필수 자료</th><th>있으면 좋은 자료</th></tr></thead><tbody>
<tr><td>논문 완성(전체 구성·초고)</td><td>없음</td><td>연구계획서, 기존 자료, 학교 양식, 목차</td></tr>
<tr><td>논문 첨삭·교정</td><td>기존 원고</td><td>수정할 범위 메모, 학교 양식</td></tr>
<tr><td>교수님 피드백 반영</td><td>기존 원고, 피드백(파일 또는 붙여넣기)</td><td>면담 메모</td></tr>
<tr><td>설문지 수정·피드백 반영</td><td>기존 설문지(피드백 반영은 피드백 포함)</td><td>연구계획서</td></tr>
<tr><td>응답 분석·통계분석</td><td>실제 데이터 파일</td><td>설문지, 변수 설명, 연구 가설</td></tr>
<tr><td>통계 재분석·피드백 반영</td><td>데이터, 기존 결과, 교수님 의견</td><td>원고의 연구결과 장</td></tr>
</tbody></table></div>
</div></section>
<section class="sec"><div class="wrap">
<div class="sec-head"><h2 class="h-2">납기와 연락 방식</h2></div>
<div class="inc-grid">
<div class="inc"><h3>예상 전달일</h3><p>결제가 확인되면 상품별 기본 납기와 현재 작업 순서를 반영해 예상 전달일을 정해 드려요. 자료 보완을 기다리는 기간은 납기에 넣지 않고, 일정이 바뀌면 주문 페이지와 메일로 바로 알려 드려요.</p></div>
<div class="inc"><h3>연락은 주문 페이지로</h3><p>자료 요청, 질문, 수정 요청, 결과물 전달까지 모두 주문 페이지에 기록돼요. 중요한 변화가 있을 때는 적어 주신 메일로도 알려 드려요.</p></div>
</div></div></section>
${ctaBand(T, { title: '지금 주문서를 열어 보세요', text: '관심 주제와 전공만 적으면 돼요. 1분이면 충분해요.', primary: ['논문 의뢰하기', '/paper/new/'], secondary: ['주문 조회', '/orders/'] })}`,
  });

  // FAQ
  const allFaq = ALL_FAQ;
  pages.push({
    path: '/faq/', kind: 'info', navTitle: '자주 묻는 질문', h1: '자주 묻는 질문',
    title: '자주 묻는 질문 | 하루 완성 논문, 석사논문 비용 | 논문AI', description: '석사논문 하루 완성, 석사·박사논문 작성 비용, 실존 참고문헌, 논문 첨삭·교정, 통계분석, 설문조사, 결제와 환불, 수정까지 논문AI에 자주 묻는 질문을 모두 모았습니다.',
    crumbs: [['홈', '/'], ['자주 묻는 질문', '/faq/']], faq: allFaq,
    body: `${pageHead(T, '자주 묻는 질문', '찾으시는 답이 없다면 주문서의 요청 사항이나 주문 페이지 메시지로 편하게 남겨 주세요.', '/faq/', '자주 묻는 질문')}
${FAQ_GROUPS.map(([g, list], i) => faqBlock(T, list, { title: g, id: `faq-${i + 1}` })).join('\n')}
${ctaBand(T, { title: '궁금한 점이 풀리셨다면 바로 시작해 보세요', primary: ['논문 의뢰하기', '/paper/new/'], secondary: ['가격표 보기', '/pricing/'] })}`,
  });

  // 소개
  pages.push({
    path: '/about/', kind: 'info', navTitle: '서비스 소개', h1: '논문AI 소개',
    title: '논문AI 소개 | 원스톱 논문 지원 서비스', description: '논문AI는 논문, 설문, 통계를 잘 몰라도 시작할 수 있는 원스톱 논문 지원 서비스입니다. 연구 설계를 자동으로 산출하고, AI가 실존 문헌으로 집필한 원고를 석·박사 전문가가 최종 검토해 전달합니다.',
    crumbs: [['홈', '/'], ['서비스 소개', '/about/']],
    geo: '논문AI는 성균관컨설팅(성균관대학교 RISE사업 지원 기업)이 운영한다. 연구 설계 엔진은 규칙 기반으로 같은 입력에 같은 결과를 내며, 원고는 AI가 실존 문헌으로 집필하고 석·박사 전문가가 최종 검토한다. 통계분석은 실제 데이터로만 진행한다.',
    body: `${pageHead(T, '논문을 처음 쓰는 사람의 첫 번째 동료', '논문AI는 "어디서부터 시작해야 하나요?"라는 질문에 답하려고 만들었어요. 막막함은 대부분 연구 절차를 몰라서 생기고, 절차는 얼마든지 설계할 수 있기 때문이에요.', '/about/', '서비스 소개')}
<section class="sec"><div class="wrap split"><article class="prose">
<h2 style="margin-top:0">우리가 만든 것</h2>
<p>논문AI의 중심에는 <strong>연구 설계 엔진</strong>이 있어요. 주제 문장에서 연구 대상과 변인, 관계를 읽어 연구모형을 그리고, 그에 맞는 가설, 목차, 분석 방법, 필요한 표본 수, 일정을 산출해요. 방법론 규칙을 그대로 적용하는 엔진이라 같은 주제를 넣으면 늘 같은 설계가 나오고, 왜 그런 설계인지도 설명할 수 있어요.</p>
<p>설계가 끝나면 AI가 실존 문헌을 바탕으로 원고를 집필하고, 석·박사 전문가가 문헌 출처와 수치, 형식을 최종 검토해요. 설문과 통계분석은 석·박사 연구진이 직접 맡고, 통계는 실제 데이터로만 분석해요. 어떤 결과물이든 사람이 직접 확인한 뒤에만 보내 드려요.</p>
<h2>우리가 지키는 것</h2>
<ul><li>꾸며 낸 진행률이 아니라 실제 처리 단계를 보여 드려요.</li><li>확인할 수 없는 문헌과 데이터는 쓰지 않아요.</li><li>합격, 게재, 유의한 결과는 약속하지 않아요.</li><li>가격과 포함 사항은 결제 전에 모두 보여 드려요.</li><li>자료는 주문별 비공개 폴더에 보관하고, 결과물을 전달한 뒤 90일이 지나면 자동으로 삭제해요.</li></ul>
<h2>운영사</h2>
<p>논문AI는 논문 컨설팅 전문 기업 <a href="https://www.skkc.co.kr" rel="noopener" target="_blank">성균관컨설팅</a>이 운영해요. 성균관컨설팅은 성균관대학교 RISE사업 지원 기업으로 논문·학위 과제 지원, 데이터 통계 분석, 문서 분석 서비스를 제공하고 있고, 결제와 증빙 발급도 성균관컨설팅을 통해 이루어져요.</p>
</article>
<aside class="aside-sticky"><div class="keybox"><h3>사업자 정보</h3><ul class="biz-list">
<li><span>상호</span><b>성균관컨설팅</b></li><li><span>대표</span><b>이채연</b></li><li><span>사업자등록번호</span><b>272-32-01885</b></li><li><span>통신판매업</span><b>제 2026-경기송탄-0622 호</b></li><li><span>연구실</span><b>경기도 수원시 장안구 서부로 2066 성균관대학교 브릿지팩토리</b></li><li><span>이메일</span><b>contact@skkc.co.kr</b></li></ul></div></aside>
</div></section>
${ctaBand(T, { title: '주제 한 줄로 시작해 보세요', topic: true })}`,
  });

  // 연구윤리
  pages.push({
    path: '/ethics/', kind: 'info', navTitle: '연구윤리 원칙', h1: '연구윤리 원칙',
    title: '연구윤리 원칙 | 논문AI', description: '논문AI는 실제 문헌과 실제 데이터만 사용하고, 학습용 시뮬레이션 데이터에는 가상 데이터임을 표시하며, 합격·게재·유의한 결과를 보장하지 않습니다.',
    crumbs: [['홈', '/'], ['연구윤리 원칙', '/ethics/']],
    geo: '논문AI 연구윤리 원칙: 실제 문헌만 인용, 실제 데이터만 분석, 시뮬레이션은 가상 데이터 표시, 결과 보장 금지, 개인정보 분리, IRB 확인 안내, 연구자 책임 고지.',
    body: `${pageHead(T, '논문은 연구자의 이름으로 남아요', '그래서 논문AI는 무엇을 하지 않을지부터 분명히 정해 두었어요.', '/ethics/', '연구윤리 원칙')}
<section class="sec"><div class="wrap-narrow prose">
<h2 style="margin-top:0">하지 않는 것</h2>
<ul><li><strong>존재하지 않는 문헌은 인용하지 않아요.</strong> 참고문헌은 서지 정보를 원문과 대조해 확인한 자료만 써요.</li>
<li><strong>데이터를 만들거나 고치지 않아요.</strong> 통계분석은 의뢰하신 분이 실제로 수집한 데이터로만 진행해요.</li>
<li><strong>가상 데이터를 실제 결과처럼 내보내지 않아요.</strong> 학습용 시뮬레이션은 파일 이름, 표, 보고서마다 "가상 데이터, 실제 연구 결과 아님"을 표시해요.</li>
<li><strong>결과를 약속하지 않아요.</strong> 심사 통과, 학술지 게재, 통계적 유의성은 누구도 미리 보장할 수 없기 때문에 보장하지 않아요.</li>
<li><strong>특정 검사 결과를 조작하지 않아요.</strong> 표절 검사는 인용 표기와 출처 표시를 바로잡는 방향으로 점검해요.</li></ul>
<h2>하는 것</h2>
<ul><li>사람을 대상으로 하는 설문과 면담은 IRB 심의가 필요한지 먼저 확인하시도록 안내하고, 연구 참여 동의 문구도 함께 준비해 드려요.</li>
<li>작업 지시와 내부 문서에는 이름과 연락처 대신 주문번호만 써서 개인정보를 분리해요.</li>
<li>응답 데이터는 개인을 알아볼 수 있는 정보를 지운 익명 데이터로 정리해요.</li>
<li>결과물은 연구자의 연구를 돕는 참고 자료라는 점을 알려 드리고, 소속 기관의 연구윤리 규정과 생성형 AI 사용 지침을 확인하시도록 안내해요.</li></ul>
<h2>연구자께 부탁드리는 것</h2>
<p>전달받은 결과물은 꼭 직접 읽고 이해한 뒤, 지도교수님과 논의하며 완성해 주세요. 최종 제출물의 작성과 연구윤리 준수 책임은 연구자 본인에게 있어요. 생성형 AI를 활용할 때 지켜야 할 내용은 <a href="/guide/ai-thesis-ethics/">AI로 논문 쓸 때 꼭 알아야 할 연구윤리</a>에 정리해 두었어요.</p>
</div></section>`,
  });

  // 404
  pages.push({
    path: '/404.html', kind: 'info', noindex: true, title: '페이지를 찾을 수 없습니다 | 논문AI', description: '요청하신 페이지를 찾을 수 없습니다.',
    body: `<section class="sec"><div class="wrap-narrow" style="text-align:center"><p class="h-display" style="font-size:72px;margin-bottom:12px">404</p><h1 class="h-2" style="margin-bottom:14px">페이지를 찾을 수 없어요</h1><p class="lead" style="margin:0 auto 28px;max-width:30em">주소가 바뀌었거나 삭제된 페이지예요. 아래에서 필요한 곳으로 이동해 주세요.</p><p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn btn-primary" href="${T.u('/')}">홈으로</a><a class="btn btn-ghost" href="${T.u('/orders/')}">주문 조회</a><a class="btn btn-ghost" href="${T.u('/guide/')}">가이드</a></p></div></section>`,
  });
  return pages;
}
