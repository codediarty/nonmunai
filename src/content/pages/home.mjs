import { heroDemo, faqBlock, ctaBand, statusTimeline, price } from '../../templates/parts.mjs';
import { esc } from '../../templates/layout.mjs';

export const HOME_FAQ = [
  { q: '논문AI는 어떤 서비스인가요?', a: '논문AI(논문 AI)는 논문, 설문조사, 통계분석을 잘 몰라도 간편하게 맡길 수 있는 원스톱 논문 작성 사이트입니다. 주제나 키워드를 입력하면 연구모형, 가설, 목차, 분석 방법, 표본 수를 바로 설계해 보여 드리고, AI 논문 작성 도구로 속도를 내되 원고 작성과 논문 통계분석은 석·박사 연구진이 진행하고 검수해 전달합니다.' },
  { q: '논문 주제도 정하지 못했는데 신청할 수 있나요?', a: '네. 주제를 모른다고 선택하고 관심 키워드만 적으시면 전공 분야에 맞는 추천 주제를 만들어 드립니다. 목차, 학교 양식, 연구방법, 분량도 모두 "잘 모르겠어요"로 진행할 수 있습니다.' },
  { q: 'AI가 자동으로 논문을 써 주는 건가요?', a: '연구 설계(연구모형, 가설, 목차, 분석 계획, 표본 수, 일정)는 입력하는 즉시 자동으로 산출됩니다. 원고 작성과 통계분석은 AI 도구를 활용하되 석·박사 연구진이 직접 작업하고 문헌·수치·형식을 검수한 뒤 전달합니다. 자동 결과를 그대로 넘기지 않는 것이 논문AI의 원칙입니다.' },
  { q: '결과물은 얼마나 걸려서 받나요?', a: '부분 첨삭과 피드백 반영은 영업일 기준 1~3일, 석사학위논문 전체 초안은 5일 안팎이 기본 납기입니다. 결제가 확인되면 실제 작업 순서를 반영한 예상 전달일을 바로 알려 드리고, 우선 처리를 선택하면 가능한 범위에서 앞당겨 드립니다.' },
  { q: '결제는 어떻게 하나요?', a: '주문서를 제출하면 총액, 포함·제외 사항, 예상 납기를 먼저 확인하신 뒤 운영사 성균관컨설팅의 안전결제(카드, 간편결제, 계좌이체)로 결제합니다. 응답자 모집처럼 조건에 따라 비용이 달라지는 작업은 확정 견적을 받은 뒤에만 결제합니다.' },
  { q: '수정은 몇 번 받을 수 있나요?', a: '전체 초안·연구계획서·설문 원스톱 상품에는 수정 1회가 포함되어 있고, 필요하면 추가 수정을 1회 단위로 더할 수 있습니다. 전달 후 주문 페이지에서 수정 내용을 적어 바로 요청하시면 됩니다.' },
  { q: '설문 응답자도 모아 주나요?', a: '네. "응답자 모집·배포까지 의뢰"를 선택하시면 대상, 응답 수, 모집 경로, 일정, 동의 절차를 확인해 별도 견적을 드립니다. 응답 수는 대상과 기간에 따라 달라지므로 특정 인원 확보를 미리 보장하지 않습니다.' },
  { q: '데이터가 없는데 통계분석을 맡길 수 있나요?', a: '실제 연구라면 설문조사부터 진행하는 통합 견적으로 안내해 드립니다. 분석 방법을 익히는 것이 목적이라면 학습용 시뮬레이션을 신청할 수 있으며, 이때 결과물에는 "가상 데이터, 실제 연구 결과 아님"이 표시되어 실제 연구 결과로 쓸 수 없습니다.' },
  { q: '올린 자료는 안전하게 관리되나요?', a: '자료는 주문별 비공개 폴더에 보관되며 주문번호와 조회 비밀번호가 있어야 볼 수 있습니다. 결과물 전달 후 90일이 지나면 자동으로 삭제되고, 그 전에도 주문 페이지에서 삭제를 요청할 수 있습니다.' },
  { q: '연구윤리에 문제가 되지는 않나요?', a: '논문AI의 결과물은 연구자가 자신의 연구를 완성하도록 돕는 참고 자료입니다. 허위 문헌이나 데이터를 만들지 않고, 합격이나 게재를 보장하지 않습니다. 최종 제출물은 연구자 본인이 확인하고 소속 기관의 연구윤리 규정에 맞게 사용해 주세요.' },
];

export default function home({ T }) {
  const body = `
<section class="hero">
<div class="wrap hero-in">
<div class="hero-copy">
<h1 class="h-display"><span class="nowrap">논문도, 설문도, 통계도.</span><br>잘 몰라도 괜찮습니다.</h1>
<p class="lead">전공과 관심 분야만 알려 주세요. 필요한 연구 절차는 논문AI가 함께 정리합니다. 주제를 적으면 연구모형과 목차, 분석 방법, 필요한 표본 수까지 바로 설계하고, 작성과 분석은 석·박사 연구진이 검수해 전달합니다.</p>
<div class="hero-cta"><a class="btn btn-primary btn-lg" href="${T.u('/paper/new/')}">내 논문 무료 설계 받기</a><a class="btn btn-ghost btn-lg" href="${T.u('/pricing/')}">가격 보기</a></div>
<ul class="hero-proof">
<li>${T.icon('git-commit-horizontal')}<span>꾸민 진행률 대신 <b>실제 처리 단계</b>를 보여 드립니다</span></li>
<li>${T.icon('shield-check')}<span>자료는 비공개 보관, 전달 후 <b>90일 뒤 자동 삭제</b></span></li>
<li>${T.icon('building-2')}<span>운영 <b>성균관컨설팅</b> · 성균관대학교 RISE사업 지원 기업</span></li>
</ul>
</div>
<div class="hero-demo">${heroDemo(T)}</div>
</div>
</section>

<section class="sec" aria-labelledby="svc-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="svc-h">무엇을 맡기시겠어요?</h2><p>필요한 것만 고르면 됩니다. 선택에 따라 질문과 필요한 자료, 가격이 자동으로 바뀝니다.</p></div>
<div class="svc">
<article class="svc-item">
<div class="svc-art" aria-hidden="true"><ol class="toc mini"><li class="ch"><span class="t">제1장 서론</span><span class="lead-dots"></span><span class="pg">1</span></li><li class="sec2"><span class="t">1. 연구의 필요성</span><span class="lead-dots"></span><span class="pg">1</span></li><li class="sec2"><span class="t">2. 연구의 목적</span><span class="lead-dots"></span><span class="pg">4</span></li><li class="ch"><span class="t">제2장 이론적 배경</span><span class="lead-dots"></span><span class="pg">7</span></li><li class="ch"><span class="t">제3장 연구 방법</span><span class="lead-dots"></span><span class="pg">24</span></li></ol></div>
<h3 class="h-3">내 논문 만들기</h3>
<p>석사·박사학위논문, 학술지 논문, 졸업논문까지. 주제가 없으면 추천 주제부터, 원고가 있으면 첨삭과 교수님 피드백 반영부터 시작합니다.</p>
<p class="svc-price">부분 첨삭 ${price('P-YOUTH-EDIT')}부터 · 석사 전체 초안 ${price('P-MASTER-FULL')}</p>
<a class="btn btn-dark" href="${T.u('/paper/new/')}">논문 의뢰하기</a>
</article>
<article class="svc-item">
<div class="svc-art" aria-hidden="true"><div class="likert"><p>나는 업무 중 충분한 휴식을 취한다.</p><div class="lk-row"><span>전혀 아니다</span><i></i><i></i><i class="on"></i><i></i><i></i><span>매우 그렇다</span></div><p>동료에게 도움을 요청하기 어렵다.</p><div class="lk-row"><span>전혀 아니다</span><i></i><i class="on"></i><i></i><i></i><i></i><span>매우 그렇다</span></div></div></div>
<h3 class="h-3">설문조사 전부 맡기기</h3>
<p>설문지 제작부터 실제 조사, 통계표와 결과 해석까지 처음부터 맡기세요. 기존 설문지 수정이나 모은 응답 분석만 따로 맡길 수도 있습니다.</p>
<p class="svc-price">설문지 제작 ${price('S-NEW')}부터 · 처음부터 끝까지 ${price('S-FULL')}</p>
<a class="btn btn-dark" href="${T.u('/survey/new/')}">설문조사 의뢰하기</a>
</article>
<article class="svc-item">
<div class="svc-art" aria-hidden="true"><table class="apa mini"><caption><b>표 3</b><i>주요 변인의 기술통계</i></caption><thead><tr><th>변인</th><th><span class="st">M</span></th><th><span class="st">SD</span></th><th>α</th></tr></thead><tbody><tr><td>직무스트레스</td><td>3.42</td><td>0.61</td><td>.87</td></tr><tr><td>회복탄력성</td><td>3.18</td><td>0.54</td><td>.91</td></tr><tr><td>이직의도</td><td>2.97</td><td>0.83</td><td>.89</td></tr></tbody></table></div>
<h3 class="h-3">통계분석 맡기기</h3>
<p>SPSS를 몰라도 됩니다. 데이터가 있다면 분석부터, 없다면 준비부터 안내합니다. 통계표와 쉬운 해석, 논문 결과장 정리까지 고를 수 있습니다.</p>
<p class="svc-price">기초 통계·표 ${price('T-BASIC')}부터 · 통계표+해석 ${price('T-INTERP')}</p>
<a class="btn btn-dark" href="${T.u('/statistics/new/')}">통계분석 의뢰하기</a>
</article>
</div>
</div>
</section>

<section class="sec sec-alt" aria-labelledby="unknown-h">
<div class="wrap unknown">
<div class="sec-head"><h2 class="h-2" id="unknown-h">모르는 칸은 비워 두셔도 됩니다</h2><p>신청서의 모든 질문에는 "잘 모르겠어요"가 있습니다. 고르시면 그 부분은 논문AI가 정해서 진행합니다.</p></div>
<div class="table-wrap"><table class="unknown-table">
<thead><tr><th scope="col">이렇게 고르시면</th><th scope="col">논문AI가 이렇게 정합니다</th></tr></thead>
<tbody>
<tr><td><span class="pick">주제가 아직 없어요</span></td><td>관심 키워드와 전공으로 추천 주제 3~5개를 만들고, 각 주제의 연구 구조를 함께 보여 드립니다.</td></tr>
<tr><td><span class="pick">목차가 없어요</span></td><td>논문 유형과 연구방법에 맞는 표준 목차를 장·절·항까지 구성합니다.</td></tr>
<tr><td><span class="pick">학교 양식을 몰라요</span></td><td>일반적인 학위논문 양식으로 작성하고, 양식 파일을 받으면 그대로 맞춰 드립니다.</td></tr>
<tr><td><span class="pick">연구방법을 모르겠어요</span></td><td>주제 문장을 분석해 설문·통계, 면담, 문헌연구, 프로그램 효과 검증 중 맞는 방법을 추천합니다.</td></tr>
<tr><td><span class="pick">표본은 몇 명이 필요해요?</span></td><td>G*Power와 같은 계산 방식으로 최소 표본과 탈락률을 고려한 모집 인원을 산출합니다.</td></tr>
<tr><td><span class="pick">분량을 모르겠어요</span></td><td>기준 분량으로 먼저 진행하고, 자료 확인 결과 초과분이 있을 때만 추가 결제를 안내합니다.</td></tr>
</tbody></table></div>
</div>
</section>

<section class="sec" aria-labelledby="flow-h">
<div class="wrap flow">
<div class="flow-copy">
<h2 class="h-2" id="flow-h">신청은 몇 분, 진행은 눈으로 확인하세요</h2>
<ol class="steps">
<li><b>질문에 답하고 자료 올리기</b><span>한 화면에 한 질문씩. 선택에 따라 필요한 파일 칸이 자동으로 나타납니다.</span></li>
<li><b>설계 리포트와 견적 확인</b><span>연구모형, 목차, 분석 계획과 총액, 포함 사항, 예상 납기를 결제 전에 먼저 봅니다.</span></li>
<li><b>결제하면 작업 순서 배정</b><span>실제 작업 순서와 예상 전달일이 주문 페이지에 표시됩니다.</span></li>
<li><b>결과물 받고 수정 요청</b><span>주문 페이지에서 내려받고, 필요한 수정은 바로 요청합니다.</span></li>
</ol>
</div>
<div class="flow-panel sheet">
<div class="sheet-label"><strong>주문 NA261103-K7Q3</strong><span>석사 · 전체 초안 · 매개효과</span></div>
<div class="flow-panel-in">${statusTimeline(T, 3)}
<div class="flow-eta"><span>예상 전달일</span><b>11월 10일(화)</b><small>작업 순서 2번째</small></div></div>
</div>
</div>
<p class="wrap tiny muted flow-note">위 화면은 주문 페이지 예시입니다. 진행 단계는 담당 연구진이 실제로 처리한 시점에만 바뀝니다.</p>
</section>

<section class="sec sec-alt" aria-labelledby="out-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="out-h">받아 보시는 결과물</h2><p>논문 심사에서 실제로 쓰이는 형식 그대로 전달합니다. 아래는 결과물 형식을 보여 드리기 위한 예시입니다.</p></div>
<div class="tabs" data-tabs>
<div class="tab-list" role="tablist" aria-label="결과물 예시">
<button role="tab" aria-selected="true" aria-controls="out-1" id="tab-1">연구 설계서</button>
<button role="tab" aria-selected="false" aria-controls="out-2" id="tab-2" tabindex="-1">장별 초안</button>
<button role="tab" aria-selected="false" aria-controls="out-3" id="tab-3" tabindex="-1">통계표와 해석</button>
<button role="tab" aria-selected="false" aria-controls="out-4" id="tab-4" tabindex="-1">수정 대조표</button>
</div>
<div class="tab-panel" role="tabpanel" id="out-1" aria-labelledby="tab-1">
<div class="art sheet"><div class="art-in">
<p class="art-title">연구 설계서</p>
<dl class="art-dl"><div><dt>연구 제목</dt><dd>간호사의 직무스트레스가 이직의도에 미치는 영향: 회복탄력성의 매개효과</dd></div><div><dt>연구 유형</dt><dd>양적 연구(설문조사) · 매개효과 검증</dd></div><div><dt>연구 가설</dt><dd>H1 직무스트레스는 이직의도에 정(+)의 영향을 미칠 것이다.<br>H2 직무스트레스는 회복탄력성에 부(-)의 영향을 미칠 것이다.<br>H4 회복탄력성은 직무스트레스와 이직의도의 관계를 매개할 것이다.</dd></div><div><dt>분석 계획</dt><dd>신뢰도 분석, 상관분석, PROCESS Macro Model 4(부트스트래핑 5,000회)</dd></div><div><dt>표본</dt><dd>최소 92명, 탈락률 15% 고려 109명 이상</dd></div></dl>
</div></div></div>
<div class="tab-panel" role="tabpanel" id="out-2" aria-labelledby="tab-2" hidden>
<div class="art sheet art-page"><div class="art-in">
<p class="pg-ch">제1장 서론</p><p class="pg-sec">1. 연구의 필요성</p>
<p class="pg-body">의료 현장에서 간호 인력의 안정적 확보는 환자 안전과 의료 서비스의 질을 좌우하는 핵심 과제이다. 간호사의 이직은 숙련 인력의 손실뿐 아니라 남은 구성원의 업무 부담을 키워 다시 이직을 부르는 악순환으로 이어진다. 따라서 이직의도를 높이는 요인과 이를 완화하는 보호 요인을 함께 규명할 필요가 있다.</p>
<p class="pg-body pg-fade">특히 직무스트레스는 이직의도를 예측하는 대표 변인으로 보고되어 왔으나, 같은 수준의 스트레스에서도 개인의 회복탄력성에 따라 반응이 달라질 수 있다는 점은 충분히 검토되지 않았다.</p>
<p class="art-cap">예시 문단입니다. 실제 원고는 주문하신 주제와 자료를 바탕으로 작성되며, 인용 문헌은 실제로 확인 가능한 자료만 사용합니다.</p>
</div></div></div>
<div class="tab-panel" role="tabpanel" id="out-3" aria-labelledby="tab-3" hidden>
<div class="art sheet"><div class="art-in art-grid">
<table class="apa"><caption><b>표 6</b><i>회복탄력성의 매개효과 검증</i></caption><thead><tr><th>경로</th><th><span class="st">B</span></th><th><span class="st">SE</span></th><th>95% CI</th></tr></thead><tbody><tr><td>직무스트레스 → 회복탄력성</td><td>-0.38</td><td>0.07</td><td>[-0.52, -0.24]</td></tr><tr><td>회복탄력성 → 이직의도</td><td>-0.44</td><td>0.09</td><td>[-0.62, -0.26]</td></tr><tr><td>간접효과</td><td>0.17</td><td>0.05</td><td>[0.08, 0.27]</td></tr></tbody><tfoot><tr><td colspan="4">부트스트래핑 5,000회. 예시 수치입니다.</td></tr></tfoot></table>
<div class="easy"><p class="easy-h">쉬운 해석</p><p>직무스트레스가 높을수록 회복탄력성이 낮아지고, 회복탄력성이 낮을수록 이직의도가 높아졌습니다. 간접효과의 신뢰구간에 0이 없으므로 회복탄력성이 두 변인의 관계를 부분적으로 설명한다고 해석합니다.</p></div>
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
</section>

<section class="sec" aria-labelledby="why-h">
<div class="wrap why">
<div class="sec-head"><h2 class="h-2" id="why-h">AI의 속도에 연구자의 검수를 더했습니다</h2></div>
<div class="why-cols">
<div><h3 class="h-3">설계는 즉시</h3><p>주제 문장에서 변인과 관계를 읽어 연구모형, 가설, 목차, 분석 방법, 표본 수를 바로 계산합니다. 같은 입력이면 늘 같은 결과가 나오는 규칙 기반 설계 엔진입니다.</p></div>
<div><h3 class="h-3">작성과 분석은 연구진이</h3><p>원고와 통계는 AI 도구를 활용하되 석·박사 연구진이 직접 작업하고, 문헌 출처와 수치, 형식을 확인한 뒤 전달합니다.</p></div>
<div><h3 class="h-3">실제 자료만 씁니다</h3><p>확인할 수 없는 문헌이나 꾸며 낸 데이터는 쓰지 않습니다. 학습용 시뮬레이션은 결과물마다 가상 데이터임을 표시합니다.</p></div>
</div>
</div>
</section>

<section class="sec sec-alt" aria-labelledby="tools-h">
<div class="wrap">
<div class="sec-head"><h2 class="h-2" id="tools-h">신청 전에 써 보는 무료 도구</h2><p>로그인 없이 바로 쓰는 연구 도구입니다. 결과는 브라우저 안에서 계산되고 저장되지 않습니다.</p></div>
<div class="tools">
<a class="tool" href="${T.u('/tools/toc/')}"><span class="tool-ic">${T.icon('list-tree')}</span><b>논문 목차 생성기</b><span>제목과 연구방법을 넣으면 장·절·항 목차를 만듭니다.</span></a>
<a class="tool" href="${T.u('/tools/sample-size/')}"><span class="tool-ic">${T.icon('calculator')}</span><b>표본 수 계산기</b><span>회귀, t검정, 분산분석, 상관, 카이제곱 표본 수를 계산합니다.</span></a>
<a class="tool" href="${T.u('/tools/references/')}"><span class="tool-ic">${T.icon('book-open-text')}</span><b>참고문헌 생성기</b><span>학술지, 단행본, 학위논문을 APA 7판 형식으로 바꿉니다.</span></a>
<a class="tool" href="${T.u('/free/')}"><span class="tool-ic">${T.icon('workflow')}</span><b>무료 논문 설계</b><span>주제 한 줄로 연구모형과 가설, 분석 계획을 받아 봅니다.</span></a>
</div>
</div>
</section>

<section class="sec" aria-labelledby="price-h">
<div class="wrap price-sum">
<div class="sec-head"><h2 class="h-2" id="price-h">가격은 결제 전에 전부 보여 드립니다</h2><p>선택한 조건에 따라 총액이 바로 계산되고, 포함·제외 사항과 예상 납기를 확인한 뒤 결제합니다. 할인율을 부풀리거나 마감 시간을 재촉하지 않습니다.</p></div>
<div class="price-grid">
${[['석사 전체 구성·초안', 'P-MASTER-FULL', '연구 설계서, 장별 초안 60쪽, 수정 1회'], ['부분 첨삭·수정', 'P-MASTER-EDIT', '석사 기준 30쪽, 수정 내역 표시본'], ['교수님 피드백 반영', 'P-MASTER-FB', '피드백 10개 항목, 수정 대조표'], ['연구계획서', 'P-MASTER-PROP', '목적·이론·방법·참고문헌'], ['설문조사 처음부터 끝까지', 'S-FULL', '설계·온라인 설문·통계·해석'], ['통계표+쉬운 해석', 'T-INTERP', '분석 추천과 실행, APA 표']].map(([n, c, d]) => `<div class="pg-item"><span class="pg-n">${esc(n)}</span><span class="pg-d">${esc(d)}</span><b class="num">${price(c)}</b></div>`).join('')}
</div>
<p class="price-more"><a class="btn btn-ghost" href="${T.u('/pricing/')}">전체 가격표 보기</a></p>
</div>
</section>

<section class="sec sec-alt" aria-labelledby="trust-h">
<div class="wrap trust">
<div class="sec-head"><h2 class="h-2" id="trust-h">연구윤리와 보안 원칙</h2><p>논문은 연구자의 이름으로 남습니다. 그래서 지키는 원칙이 분명해야 합니다.</p></div>
<ul class="trust-list">
<li>${T.icon('book-check')}<div><b>확인 가능한 문헌만 인용</b><span>존재하지 않는 논문이나 출처를 만들지 않습니다.</span></div></li>
<li>${T.icon('database')}<div><b>실제 데이터만 분석</b><span>학습용 시뮬레이션에는 가상 데이터 표시가 항상 붙습니다.</span></div></li>
<li>${T.icon('scale')}<div><b>보장하지 않는 약속은 하지 않음</b><span>합격, 게재, 유의한 결과를 약속하지 않습니다.</span></div></li>
<li>${T.icon('lock-keyhole')}<div><b>주문별 비공개 보관</b><span>주문번호와 조회 비밀번호가 있어야 열람할 수 있습니다.</span></div></li>
<li>${T.icon('timer-reset')}<div><b>90일 뒤 자동 삭제</b><span>전달 후 보관 기간이 지나면 파일을 자동으로 지웁니다.</span></div></li>
<li>${T.icon('user-round-check')}<div><b>개인정보 분리 관리</b><span>작업 지시에는 이름과 연락처를 넣지 않고 주문번호로만 다룹니다.</span></div></li>
</ul>
<p class="trust-more"><a href="${T.u('/ethics/')}">연구윤리 원칙 자세히 보기</a></p>
</div>
</section>

${faqBlock(T, HOME_FAQ, { lead: '신청 전에 가장 많이 묻는 내용을 정리했습니다.' })}

${ctaBand(T, { title: '주제 한 줄이면 시작할 수 있습니다', text: '적어 주신 주제로 연구모형과 목차를 바로 설계해 드립니다. 신청서는 그다음 단계에서 천천히 채우셔도 됩니다.', topic: true })}
`;
  return [{
    path: '/',
    body,
    kind: 'home',
    title: '논문AI | 논문 작성·첨삭·통계분석·설문조사 지원',
    h1: '논문AI',
    description: '논문이 처음이어도 괜찮습니다. 원스톱 논문 작성 사이트 논문AI에서 석사·박사학위논문, 학술지 논문 작성 지원부터 첨삭, 교수님 피드백 반영, 설문조사, 통계분석까지 간편하게 신청하세요.',
    keywords: ['논문AI', '논문 AI', 'AI 논문 작성', '논문 작성', '논문 첨삭', '석사 논문 작성', '논문 컨설팅', '논문 통계분석', '논문 설문조사', '학위논문 작성'],
    ogImage: '/assets/img/og/home.png',
    faq: HOME_FAQ,
    scripts: ['home'],
    priority: '1.0',
    changefreq: 'weekly',
    geo: '논문AI는 주제 한 줄로 연구모형, 가설, 목차, 분석 방법, 표본 수를 즉시 설계하는 무료 미리보기를 제공하고, 논문 작성 지원, 첨삭, 교수님 피드백 반영, 연구계획서, 설문조사 원스톱, 통계분석을 주문받아 석·박사 연구진이 작업·검수해 전달하는 서비스이다. 모든 질문에 "잘 모르겠어요" 선택지가 있고, 선택하면 논문AI가 추천·설계한다.',
    schema: [{
      '@context': 'https://schema.org', '@type': 'Service', name: '논문AI 원스톱 논문 지원', serviceType: '논문 작성 지원, 논문 첨삭, 설문조사, 통계분석', provider: { '@id': T.abs('/#organization') }, areaServed: { '@type': 'Country', name: 'KR' },
      hasOfferCatalog: { '@type': 'OfferCatalog', name: '논문AI 서비스', itemListElement: [
        { '@type': 'Offer', name: '석사학위논문 전체 구성·초안 작성 지원', price: 399000, priceCurrency: 'KRW', url: T.abs('/master-thesis/') },
        { '@type': 'Offer', name: '논문 부분 첨삭·수정', price: 99000, priceCurrency: 'KRW', url: T.abs('/thesis-editing/') },
        { '@type': 'Offer', name: '교수님 피드백 반영', price: 129000, priceCurrency: 'KRW', url: T.abs('/professor-feedback/') },
        { '@type': 'Offer', name: '설문조사 처음부터 끝까지', price: 299000, priceCurrency: 'KRW', url: T.abs('/survey/') },
        { '@type': 'Offer', name: '통계분석 통계표+해석', price: 149000, priceCurrency: 'KRW', url: T.abs('/statistics/') },
      ] },
    }],
  }];
}
