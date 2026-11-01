import { faqBlock, ctaBand, crumbs, priceTable, price, statusTimeline, STATUS_STEPS } from '../../templates/parts.mjs';
import { esc } from '../../templates/layout.mjs';
import { HOME_FAQ } from './home.mjs';

function pageHead(T, title, lead, path, label) {
  return `<section class="phero phero-sm"><div class="wrap">${crumbs(T, [['홈', '/'], [label, path]])}<h1 class="h-1" style="margin-top:20px">${esc(title)}</h1><p class="lead" style="max-width:40em">${lead}</p></div></section>`;
}

export default function info({ T }) {
  const pages = [];

  // 가격
  const pricingFaq = [
    { q: '표시된 가격에 부가세가 포함되어 있나요?', a: '네. 모든 가격은 부가세를 포함한 금액입니다.' },
    { q: '견적형 주문은 언제 결제하나요?', a: '응답자 모집, 구조방정식 같은 심화 분석처럼 조건에 따라 비용이 달라지는 작업은 자료를 확인해 확정 견적을 드린 뒤에 결제합니다. 확정되지 않은 금액은 결제할 수 없습니다.' },
    { q: '분량이 늘어나면 추가 비용이 있나요?', a: '상품마다 기준 분량이 있고, 초과분은 정해진 단위로 계산됩니다. 신청 화면에서 분량을 입력하면 총액에 바로 반영되고, 분량을 모르면 기준 분량으로 먼저 진행한 뒤 초과분이 있을 때만 안내합니다.' },
    { q: '환불은 어떻게 되나요?', a: '작업 시작 전에는 전액 환불됩니다. 작업이 시작된 뒤에는 진행 단계에 따라 환불 기준이 달라지며 자세한 내용은 환불 규정에서 확인할 수 있습니다.' },
  ];
  const groups = [
    ['석사학위논문', ['P-MASTER-FULL', 'P-MASTER-PROP', 'P-MASTER-EDIT', 'P-MASTER-FB']],
    ['박사학위논문', ['P-DOCTOR-FULL', 'P-DOCTOR-PROP', 'P-DOCTOR-EDIT', 'P-DOCTOR-FB']],
    ['학술지 투고논문', ['P-JOURNAL-FULL', 'P-JOURNAL-EDIT', 'P-JOURNAL-FB']],
    ['학사·졸업논문', ['P-BACHELOR-FULL', 'P-BACHELOR-PROP', 'P-BACHELOR-EDIT', 'P-BACHELOR-FB']],
    ['일반 연구보고서', ['P-REPORT-FULL', 'P-REPORT-EDIT', 'P-REPORT-FB']],
    ['청소년 탐구논문', ['P-YOUTH-FULL', 'P-YOUTH-EDIT', 'P-YOUTH-FB']],
    ['개인 관심연구', ['P-PERSONAL-FULL', 'P-PERSONAL-EDIT', 'P-PERSONAL-FB']],
    ['설문조사', ['S-FULL', 'S-NEW', 'S-EDIT', 'S-FB', 'S-ANALYZE', 'S-RECRUIT']],
    ['통계분석', ['T-BASIC', 'T-INTERP', 'T-CHAPTER', 'T-FB', 'T-ADV', 'T-SIM']],
    ['공통 추가 옵션', ['A-PRIORITY', 'A-FORMAT', 'A-REVISION']],
  ];
  pages.push({
    path: '/pricing/', kind: 'info', navTitle: '가격 안내', h1: '논문AI 가격 안내',
    title: '논문AI 가격 | 논문 작성·첨삭·통계분석·설문조사 비용 안내',
    description: '논문 작성 지원, 첨삭, 교수님 피드백 반영, 연구계획서, 설문조사, 통계분석의 가격과 기본 납기를 한눈에 확인하세요. 결제 전에 총액과 포함 사항을 먼저 보여 드립니다.',
    keywords: ['논문 작성 비용', '논문 첨삭 비용', '통계분석 비용', '설문조사 비용', '논문 컨설팅 가격'],
    crumbs: [['홈', '/'], ['가격 안내', '/pricing/']], faq: pricingFaq, priority: '0.9',
    body: `${pageHead(T, '가격은 결제 전에 전부 보여 드립니다', '선택한 조건에 따라 총액이 자동으로 계산됩니다. 포함·제외 사항과 예상 납기를 확인한 뒤 결제하고, 조건에 따라 달라지는 작업은 확정 견적 후에만 결제합니다.', '/pricing/', '가격 안내')}
<section class="sec"><div class="wrap">
<div class="note" style="margin-bottom:36px">${T.icon('info')}<div><b>모든 가격은 부가세 포함입니다.</b> 기본 납기는 영업일(주말·공휴일 제외) 기준이며, 자료 보완을 기다리는 기간은 납기에서 제외됩니다. 기준 분량을 넘는 부분은 표에 적힌 단위로 추가됩니다.</div></div>
${groups.map(([g, codes]) => `<div class="page-sec">${priceTable(T, codes, { caption: g })}</div>`).join('')}
</div></section>
${faqBlock(T, pricingFaq, { title: '가격 관련 자주 묻는 질문' })}
${ctaBand(T, { title: '내 조건의 총액을 바로 확인하세요', text: '신청 화면에서 조건을 고르면 금액과 예상 납기가 즉시 계산됩니다.', primary: ['논문 의뢰 시작', '/paper/new/'], secondary: ['통계분석 의뢰', '/statistics/new/'] })}`,
  });
  pages[pages.length - 1].geo = groups.map(([g, codes]) => `${g}: ${codes.map((c) => `${c} ${price(c) || '별도 견적'}`).join(', ')}`).join('\n');

  // 진행 방식
  pages.push({
    path: '/process/', kind: 'info', navTitle: '진행 방식', h1: '논문AI 진행 방식',
    title: '진행 방식 | 신청부터 결과물 전달까지 논문AI',
    description: '논문AI는 신청서 작성, 설계 리포트와 견적 확인, 결제, 작업 진행, 품질 검토, 결과물 전달 순서로 진행됩니다. 진행 단계는 담당 연구진이 실제로 처리한 시점에만 바뀝니다.',
    crumbs: [['홈', '/'], ['진행 방식', '/process/']],
    geo: `진행 단계: ${STATUS_STEPS.map((s) => `${s[0]}(${s[1]})`).join(' → ')}`,
    body: `${pageHead(T, '신청부터 전달까지, 실제 단계 그대로', '논문AI는 진행률을 꾸며 보여 주지 않습니다. 담당 연구진이 실제로 처리한 단계와 예상 전달일만 주문 페이지에 표시합니다.', '/process/', '진행 방식')}
<section class="sec"><div class="wrap flow">
<div class="flow-copy">
<h2 class="h-2">네 단계로 끝납니다</h2>
<ol class="steps">
<li><b>신청서 작성(약 3~5분)</b><span>한 화면에 한 질문씩 답합니다. 모르는 항목은 "잘 모르겠어요"를 고르면 됩니다. 선택에 따라 필요한 파일 칸과 가격이 자동으로 바뀝니다.</span></li>
<li><b>설계 리포트와 견적 확인</b><span>연구모형, 가설, 목차, 분석 계획, 표본 수와 총액, 포함 사항, 예상 납기를 결제 전에 확인합니다.</span></li>
<li><b>결제와 작업 순서 배정</b><span>성균관컨설팅 안전결제로 결제하면 작업 순서가 배정되고 예상 전달일이 정해집니다.</span></li>
<li><b>진행 확인과 결과물 전달</b><span>주문 페이지에서 단계별 진행을 확인하고, 완료되면 결과물을 내려받아 필요한 수정을 요청합니다.</span></li>
</ol></div>
<div class="flow-panel sheet"><div class="sheet-label"><strong>주문 페이지 진행 단계</strong><span>예시</span></div><div class="flow-panel-in">${statusTimeline(T, 4)}</div></div>
</div></section>
<section class="sec sec-alt"><div class="wrap">
<div class="sec-head"><h2 class="h-2">준비하면 좋은 자료</h2><p>필수 자료는 선택에 따라 신청 화면에서 정확히 안내합니다. 아래는 있으면 결과물이 더 정확해지는 자료입니다.</p></div>
<div class="table-wrap"><table class="g-table"><thead><tr><th>의뢰</th><th>필수 자료</th><th>있으면 좋은 자료</th></tr></thead><tbody>
<tr><td>논문 전체 초안</td><td>없음</td><td>연구계획서, 기존 자료, 학교 양식, 목차</td></tr>
<tr><td>부분 첨삭</td><td>기존 원고</td><td>수정할 범위 메모, 학교 양식</td></tr>
<tr><td>교수님 피드백 반영</td><td>기존 원고, 피드백(파일 또는 붙여넣기)</td><td>면담 메모</td></tr>
<tr><td>설문지 수정·피드백 반영</td><td>기존 설문지(피드백 반영은 피드백 포함)</td><td>연구계획서</td></tr>
<tr><td>응답 분석·통계분석</td><td>실제 데이터 파일</td><td>설문지, 변수 설명, 연구 가설</td></tr>
<tr><td>기존 분석 수정</td><td>데이터, 기존 결과, 교수님 의견</td><td>원고의 결과 장</td></tr>
</tbody></table></div>
</div></section>
<section class="sec"><div class="wrap">
<div class="sec-head"><h2 class="h-2">납기와 연락 방식</h2></div>
<div class="inc-grid">
<div class="inc"><h3>예상 전달일</h3><p>결제가 확인되면 상품별 기본 납기와 현재 작업 순서를 반영해 예상 전달일이 정해집니다. 자료 보완을 기다리는 기간은 납기에서 제외되고, 일정이 바뀌면 주문 페이지와 메일로 바로 알려 드립니다.</p></div>
<div class="inc"><h3>연락은 주문 페이지로</h3><p>자료 요청, 질문, 수정 요청, 결과물 전달이 모두 주문 페이지에 기록됩니다. 중요한 변화가 있을 때는 입력하신 메일로도 알려 드립니다.</p></div>
</div></div></section>
${ctaBand(T, { title: '지금 신청서를 열어 보세요', text: '제출 전까지 비용은 발생하지 않습니다.', primary: ['논문 의뢰 시작', '/paper/new/'], secondary: ['주문 조회', '/orders/'] })}`,
  });

  // FAQ
  const extraFaq = [
    { q: '회원가입이 필요한가요?', a: '아니요. 신청서에 이름, 이메일, 연락처와 주문 조회 비밀번호만 입력하면 됩니다. 이후에는 주문번호와 조회 비밀번호, 또는 메일로 받은 링크로 주문을 확인합니다.' },
    { q: '주문 조회 비밀번호를 잊어버렸어요.', a: '주문 조회 화면에서 이메일 주소를 입력하면 주문 링크를 메일로 다시 보내 드립니다.' },
    { q: '결제 후 자료를 더 올릴 수 있나요?', a: '네. 주문 페이지에서 언제든 자료를 추가할 수 있고, 자료 보완 요청을 받은 경우 올린 뒤 "보완 자료 제출 완료"를 누르면 이어서 진행됩니다.' },
    { q: '청소년 탐구논문도 신청할 수 있나요?', a: '네. 청소년 탐구논문 유형을 고르면 탐구 동기, 탐구 방법, 결과, 결론 구성으로 진행합니다. 만 14세 미만은 보호자 동의가 필요합니다.' },
    { q: '세금계산서나 영수증을 받을 수 있나요?', a: '결제는 운영사 성균관컨설팅을 통해 이루어지며, 결제 수단에 따른 영수증과 증빙을 발급받을 수 있습니다. 필요한 증빙은 주문 페이지 메시지로 요청해 주세요.' },
  ];
  const allFaq = [...HOME_FAQ, ...extraFaq];
  pages.push({
    path: '/faq/', kind: 'info', navTitle: '자주 묻는 질문', h1: '자주 묻는 질문',
    title: '자주 묻는 질문 | 논문AI', description: '논문AI 이용 방법, 결제와 환불, 진행 기간, 수정, 자료 보안, 연구윤리에 대해 자주 묻는 질문을 모았습니다.',
    crumbs: [['홈', '/'], ['자주 묻는 질문', '/faq/']], faq: allFaq,
    body: `${pageHead(T, '자주 묻는 질문', '찾는 답이 없다면 신청서의 요청 사항이나 주문 페이지 메시지로 남겨 주세요.', '/faq/', '자주 묻는 질문')}
${faqBlock(T, allFaq, { title: '전체 질문', id: 'all' })}
${ctaBand(T, { title: '궁금한 점이 풀렸다면 시작해 보세요', primary: ['무료 설계 시작', '/paper/new/'], secondary: ['가격 보기', '/pricing/'] })}`,
  });

  // 소개
  pages.push({
    path: '/about/', kind: 'info', navTitle: '서비스 소개', h1: '논문AI 소개',
    title: '논문AI 소개 | 원스톱 논문 지원 서비스', description: '논문AI는 논문, 설문, 통계를 잘 몰라도 시작할 수 있도록 연구 설계를 자동으로 산출하고, 석·박사 연구진이 작성과 분석을 검수해 전달하는 원스톱 논문 지원 서비스입니다.',
    crumbs: [['홈', '/'], ['서비스 소개', '/about/']],
    geo: '논문AI는 성균관컨설팅(성균관대학교 RISE사업 지원 기업)이 운영한다. 연구 설계 엔진은 규칙 기반으로 같은 입력에 같은 결과를 내며, 원고와 통계는 연구진이 작업하고 검수한다.',
    body: `${pageHead(T, '논문을 처음 쓰는 사람의 첫 번째 동료', '논문AI는 "어디서부터 시작해야 하나요?"라는 질문에 답하기 위해 만들었습니다. 막막함의 대부분은 연구 절차를 모르는 데서 오고, 절차는 설계할 수 있기 때문입니다.', '/about/', '서비스 소개')}
<section class="sec"><div class="wrap split"><article class="prose">
<h2 style="margin-top:0">우리가 만든 것</h2>
<p>논문AI의 중심에는 <strong>연구 설계 엔진</strong>이 있습니다. 주제 문장에서 연구 대상과 변인, 관계를 읽어 연구모형을 그리고, 그에 맞는 가설, 목차, 분석 방법, 필요한 표본 수, 일정을 산출합니다. 방법론 규칙을 그대로 적용하는 엔진이라 같은 주제를 넣으면 늘 같은 설계가 나오고, 왜 그런 설계인지 설명할 수 있습니다.</p>
<p>설계 다음의 일, 즉 원고 작성과 설문, 통계분석은 석·박사 연구진이 맡습니다. AI 도구로 속도를 내되 문헌 출처와 수치, 형식을 사람이 확인한 뒤에만 전달합니다.</p>
<h2>우리가 지키는 것</h2>
<ul><li>꾸며 낸 진행률이 아니라 실제 처리 단계를 보여 줍니다.</li><li>확인할 수 없는 문헌과 데이터를 쓰지 않습니다.</li><li>합격, 게재, 유의한 결과를 약속하지 않습니다.</li><li>가격과 포함 사항을 결제 전에 모두 보여 줍니다.</li><li>자료는 비공개로 보관하고 보관 기간이 지나면 자동으로 삭제합니다.</li></ul>
<h2>운영사</h2>
<p>논문AI는 논문 컨설팅 전문 기업 <a href="https://www.skkc.co.kr" rel="noopener" target="_blank">성균관컨설팅</a>이 운영합니다. 성균관컨설팅은 성균관대학교 RISE사업 지원 기업으로 논문·학위 과제 지원, 데이터 통계 분석, 문서 분석 서비스를 제공하고 있으며, 결제와 증빙 발급도 성균관컨설팅을 통해 이루어집니다.</p>
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
    body: `${pageHead(T, '논문은 연구자의 이름으로 남습니다', '그래서 논문AI는 무엇을 하지 않는지부터 분명히 정해 두었습니다.', '/ethics/', '연구윤리 원칙')}
<section class="sec"><div class="wrap-narrow prose">
<h2 style="margin-top:0">하지 않는 것</h2>
<ul><li><strong>존재하지 않는 문헌을 인용하지 않습니다.</strong> 참고문헌은 서지 정보를 원문과 대조한 자료만 사용합니다.</li>
<li><strong>데이터를 만들거나 고치지 않습니다.</strong> 통계분석은 고객이 실제로 수집한 데이터로만 진행합니다.</li>
<li><strong>가상 데이터를 실제 결과처럼 내보내지 않습니다.</strong> 학습용 시뮬레이션은 파일 이름, 표, 보고서마다 "가상 데이터, 실제 연구 결과 아님"을 표시합니다.</li>
<li><strong>결과를 약속하지 않습니다.</strong> 심사 통과, 학술지 게재, 통계적 유의성은 보장할 수 없고 보장하지 않습니다.</li>
<li><strong>특정 검사 결과를 조작하지 않습니다.</strong> 표절 검사는 인용 표기와 출처 표시를 바로잡는 방향으로 점검합니다.</li></ul>
<h2>하는 것</h2>
<ul><li>사람을 대상으로 하는 설문과 면담은 IRB 심의 필요 여부를 먼저 확인하도록 안내하고, 연구 참여 동의 문구를 함께 준비합니다.</li>
<li>작업 지시와 내부 문서에는 이름과 연락처 대신 주문번호만 사용해 개인정보를 분리합니다.</li>
<li>응답 데이터는 개인을 알아볼 수 있는 정보를 지운 익명 데이터로 정리합니다.</li>
<li>결과물이 연구자의 연구를 돕는 참고 자료임을 알리고, 소속 기관의 연구윤리 규정과 생성형 AI 사용 지침을 확인하도록 안내합니다.</li></ul>
<h2>연구자께 부탁드리는 것</h2>
<p>전달받은 결과물은 반드시 직접 읽고 이해한 뒤 지도교수와 논의하며 완성해 주세요. 최종 제출물의 작성과 연구윤리 준수 책임은 연구자 본인에게 있습니다. 생성형 AI를 활용할 때 지켜야 할 내용은 <a href="/guide/ai-thesis-ethics/">AI로 논문 쓸 때 꼭 알아야 할 연구윤리</a>에 정리했습니다.</p>
</div></section>`,
  });

  // 404
  pages.push({
    path: '/404.html', kind: 'info', noindex: true, title: '페이지를 찾을 수 없습니다 | 논문AI', description: '요청하신 페이지를 찾을 수 없습니다.',
    body: `<section class="sec"><div class="wrap-narrow" style="text-align:center"><p class="h-display" style="font-size:72px;margin-bottom:12px">404</p><h1 class="h-2" style="margin-bottom:14px">페이지를 찾을 수 없습니다</h1><p class="lead" style="margin:0 auto 28px;max-width:30em">주소가 바뀌었거나 삭제된 페이지입니다. 아래에서 필요한 곳으로 이동해 주세요.</p><p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn btn-primary" href="${T.u('/')}">홈으로</a><a class="btn btn-ghost" href="${T.u('/orders/')}">주문 조회</a><a class="btn btn-ghost" href="${T.u('/guide/')}">가이드</a></p></div></section>`,
  });
  return pages;
}
