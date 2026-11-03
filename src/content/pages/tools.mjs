import { faqBlock, ctaBand, crumbs } from '../../templates/parts.mjs';
import { esc } from '../../templates/layout.mjs';
import { buildDesign, PAPER_TYPES, FIELDS, tocToText } from '../../js/core/engine.js';
import { METHODS } from '../../js/core/kb.js';
import { designReportHtml } from '../../js/ui/report.js';
import { tocHtml } from '../../js/core/render.js';

const typeOptions = (sel = 'master') => PAPER_TYPES.map((t) => `<option value="${t.id}"${t.id === sel ? ' selected' : ''}>${esc(t.label)}</option>`).join('');
const fieldOptions = (sel = '') => `<option value="">전공 분야 선택(선택)</option>` + FIELDS.map((f) => `<option value="${f.id}"${f.id === sel ? ' selected' : ''}>${esc(f.label)}</option>`).join('');
const methodOptions = () => METHODS.filter((m) => m.id !== 'other').map((m) => `<option value="${m.id}">${esc(m.label)}</option>`).join('');

function head(T, path, label, h1, lead) {
  return `<section class="phero phero-sm"><div class="wrap">${crumbs(T, [['홈', '/'], ['무료 도구', '/tools/'], [label, path]])}<h1 class="h-1" style="margin-top:20px">${esc(h1)}</h1><p class="lead" style="max-width:42em">${lead}</p></div></section>`;
}

export default function tools({ T }) {
  const pages = [];
  const ex = '대학생의 SNS 이용과 우울의 관계에서 자기효능감의 조절효과';
  const exDesign = buildDesign({ title: ex, typeId: 'master', fieldId: 'counsel', start: '2026-11-02' });

  // 도구 모음
  pages.push({
    path: '/tools/', kind: 'tools', navTitle: '무료 도구', h1: '논문 무료 도구',
    title: '논문 무료 도구 | 목차 생성기·표본 수 계산기·참고문헌 생성기 논문AI',
    description: '회원가입 없이 바로 쓰는 논문 무료 도구입니다. 주제로 연구 설계를 만드는 무료 논문 설계, 논문 목차 생성기, G*Power 방식 표본 수 계산기, APA 7판 참고문헌 생성기를 제공합니다.',
    keywords: ['논문 무료 도구', '논문 작성 AI 무료', '논문 목차 생성기', '표본 수 계산기', '참고문헌 생성기'],
    crumbs: [['홈', '/'], ['무료 도구', '/tools/']],
    body: `<section class="phero phero-sm"><div class="wrap">${crumbs(T, [['홈', '/'], ['무료 도구', '/tools/']])}<h1 class="h-1" style="margin-top:20px">논문 무료 도구</h1><p class="lead" style="max-width:40em">로그인 없이 바로 쓰는 연구 도구예요. 계산은 모두 브라우저 안에서 이루어지고, 입력하신 내용은 서버로 전송되거나 저장되지 않아요.</p></div></section>
<section class="sec"><div class="wrap"><div class="tools">
<a class="tool" href="${T.u('/free/')}"><span class="tool-ic">${T.icon('workflow')}</span><b>무료 논문 설계</b><span>주제 한 줄로 연구모형, 가설, 분석 계획, 표본 수, 일정을 받아 보세요.</span></a>
<a class="tool" href="${T.u('/tools/toc/')}"><span class="tool-ic">${T.icon('list-tree')}</span><b>논문 목차 생성기</b><span>논문 유형과 연구방법에 맞는 장·절·항 목차를 만들어 드려요.</span></a>
<a class="tool" href="${T.u('/tools/sample-size/')}"><span class="tool-ic">${T.icon('calculator')}</span><b>표본 수 계산기</b><span>회귀, t검정, 분산분석, 상관, 카이제곱 표본 수를 계산해 보세요.</span></a>
<a class="tool" href="${T.u('/tools/references/')}"><span class="tool-ic">${T.icon('book-open-text')}</span><b>참고문헌 생성기</b><span>학술지, 단행본, 학위논문, 웹 자료를 APA 7판 형식으로 바꿔 드려요.</span></a>
</div></div></section>`,
  });

  // 무료 논문 설계
  const freeFaq = [
    { q: '논문 작성 AI를 정말 무료로 쓸 수 있나요?', a: '네, 무료 논문 설계는 회원가입이나 결제 없이 쓰실 수 있어요. 주제나 키워드를 입력하시면 연구모형, 가설, 목차, 분석 계획, 표본 수, 일정을 바로 산출해 드려요. 논문 본문 작성과 통계분석은 유료 서비스로 의뢰하실 수 있어요.' },
    { q: '설계 결과는 어떻게 만들어지나요?', a: '주제 문장에서 대상, 원인 변인, 결과 변인, 매개·조절 변인을 읽어 내고, 연구 설계 유형별 방법론 규칙과 변인 지식베이스를 적용해 산출해요. 그래서 같은 내용을 입력하시면 늘 같은 결과가 나와요.' },
    { q: '입력한 주제가 저장되나요?', a: '아니요, 저장되지 않아요. 무료 설계는 브라우저 안에서만 계산되고 서버로 전송되지도 않으니 안심하고 써 보세요.' },
    { q: '설계 결과를 그대로 써도 되나요?', a: '연구 방향을 잡는 출발점으로 활용해 주세요. 측정도구 후보와 분석 방법은 선행연구와 지도교수님 의견을 바탕으로 최종 확정하시는 것이 좋아요.' },
  ];
  pages.push({
    path: '/free/', kind: 'tool', navTitle: '무료 논문 설계', h1: '무료 논문 설계',
    title: '논문 작성 AI 무료 설계 | 연구모형·가설·목차·표본 수 자동 설계 논문AI',
    description: '논문 주제나 관심 키워드를 입력하면 연구모형, 가설, 연구 문제, 측정도구 후보, 분석 계획, 표본 수, 일정, 목차를 무료로 바로 설계합니다. 회원가입 없이 이용하세요.',
    keywords: ['논문 작성 AI 무료', '무료 논문 설계', '연구모형 만들기', '논문 가설 만들기', '논문 주제 추천'],
    crumbs: [['홈', '/'], ['무료 도구', '/tools/'], ['무료 논문 설계', '/free/']], faq: freeFaq, scripts: ['free'], priority: '0.9',
    geo: '무료 논문 설계는 주제 문장 또는 키워드로 연구모형, 가설, 연구 문제, 측정도구 후보, 분석 계획(예: PROCESS Macro Model 4), G*Power 방식 표본 수, 일정, 목차를 브라우저에서 즉시 산출하는 무료 도구이다.',
    schema: [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: '논문AI 무료 논문 설계', applicationCategory: 'EducationalApplication', operatingSystem: 'Web', inLanguage: 'ko-KR', url: T.abs('/free/'), offers: { '@type': 'Offer', price: 0, priceCurrency: 'KRW' }, provider: { '@id': T.abs('/#organization') } }],
    body: `${head(T, '/free/', '무료 논문 설계', '무료 논문 설계', '주제를 정했다면 제목을, 아직이라면 관심 키워드를 적어 보세요. 연구모형과 가설, 분석 계획, 필요한 표본 수까지 바로 설계해 드려요.')}
<section class="sec"><div class="wrap toolbox">
<form class="toolbox-form" id="freeForm" autocomplete="off">
<div class="field"><span class="label">주제가 있나요?</span><div class="seg" role="radiogroup"><label><input type="radio" name="known" value="yes" checked><span>제목이 있어요</span></label><label><input type="radio" name="known" value="no"><span>키워드만 있어요</span></label></div></div>
<div class="field" data-when="yes"><label class="label" for="fTitle">논문 제목·주제</label><textarea class="textarea" id="fTitle" rows="3">${esc(ex)}</textarea></div>
<div class="field" data-when="no" hidden><label class="label" for="fKw">관심 키워드 <small>쉼표로 2~3개</small></label><input class="input" id="fKw" placeholder="예: 감정노동, 직무만족"></div>
<div class="field"><label class="label" for="fType">논문 유형</label><select class="select" id="fType">${typeOptions('master')}</select></div>
<div class="field"><label class="label" for="fField">전공 분야</label><select class="select" id="fField">${fieldOptions('counsel')}</select></div>
<div class="field"><label class="label" for="fMethod">연구방법</label><select class="select" id="fMethod">${methodOptions()}</select></div>
<div class="field"><label class="label" for="fDue">희망 완료일 <small>선택</small></label><input class="input" type="date" id="fDue"></div>
<button class="btn btn-primary btn-block" type="submit" style="margin-top:18px">설계 다시 계산</button>
<p class="hint" style="margin-top:10px">입력하신 내용은 저장되지 않고 브라우저 안에서만 계산돼요.</p>
</form>
<div class="toolbox-out"><div class="sheet out-sheet" id="freeOut">${designReportHtml(exDesign, { titleChooser: true })}</div>
<div class="free-go"><a class="btn btn-primary btn-lg" id="freeGo" href="${T.u('/paper/new/')}?title=${encodeURIComponent(ex)}">이 설계로 논문 의뢰하기</a><span class="muted small">결제하기 전까지는 비용이 전혀 들지 않아요.</span></div></div>
</div></section>
${faqBlock(T, freeFaq, { title: '무료 논문 설계 자주 묻는 질문' })}`,
  });

  // 목차 생성기
  const tocFaq = [
    { q: '논문 목차는 어떻게 구성하나요?', a: '양적 연구 학위논문은 보통 서론, 이론적 배경, 연구방법, 연구결과, 논의 및 결론의 5장 구조예요. 박사논문은 연구모형과 가설을 별도 장으로 두는 경우가 많고, 질적 연구는 연구방법 장에 참여자, 자료 수집, 분석, 엄밀성 절이 들어가요.' },
    { q: '생성된 목차를 그대로 써도 되나요?', a: '표준 구성을 바탕으로 만든 초안이에요. 학교나 학과에서 정한 목차 양식이 있다면 그 양식을 먼저 따르고, 지도교수님과 상의해 절 제목을 다듬어 주세요.' },
    { q: '목차를 Word로 저장할 수 있나요?', a: '네. 만든 목차를 텍스트로 복사하거나, Word에서 열 수 있는 파일로 내려받으실 수 있어요.' },
  ];
  const exToc = buildDesign({ title: '간호사의 직무스트레스가 이직의도에 미치는 영향: 회복탄력성의 매개효과', typeId: 'master' }).toc;
  pages.push({
    path: '/tools/toc/', kind: 'tool', navTitle: '논문 목차 생성기', h1: '논문 목차 생성기',
    title: '논문 목차 생성기 | 논문 목차 작성·예시 자동 생성 논문AI',
    description: '논문 제목과 연구방법을 넣으면 석사·박사·학술지·졸업논문 유형에 맞는 장·절·항 목차를 자동으로 만들어 줍니다. 양적·질적·문헌연구별 논문 목차 예시를 바로 확인하세요.',
    keywords: ['논문 목차 작성', '논문 목차', '논문 목차 예시', '석사논문 목차', '목차 생성기'],
    crumbs: [['홈', '/'], ['무료 도구', '/tools/'], ['논문 목차 생성기', '/tools/toc/']], faq: tocFaq, scripts: ['toc'], priority: '0.8',
    geo: `논문 목차 생성기 예시(석사, 매개효과 연구):\n${tocToText(exToc)}`,
    schema: [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: '논문 목차 생성기', applicationCategory: 'EducationalApplication', operatingSystem: 'Web', inLanguage: 'ko-KR', url: T.abs('/tools/toc/'), offers: { '@type': 'Offer', price: 0, priceCurrency: 'KRW' } }],
    body: `${head(T, '/tools/toc/', '논문 목차 생성기', '논문 목차 생성기', '논문 목차 작성이 막막하다면 제목부터 넣어 보세요. 논문 제목을 입력하고 유형을 고르시면 연구 구조에 맞는 목차를 장·절·항까지 만들어 드려요. 제목 속 변인 이름이 이론적 배경과 측정도구 절에 그대로 들어가요.')}
<section class="sec"><div class="wrap toolbox">
<form class="toolbox-form" id="tocForm" autocomplete="off">
<div class="field"><label class="label" for="tTitle">논문 제목</label><textarea class="textarea" id="tTitle" rows="3">간호사의 직무스트레스가 이직의도에 미치는 영향: 회복탄력성의 매개효과</textarea></div>
<div class="field"><label class="label" for="tType">논문 유형</label><select class="select" id="tType">${typeOptions('master')}</select></div>
<div class="field"><label class="label" for="tMethod">연구방법</label><select class="select" id="tMethod">${methodOptions()}</select></div>
<button class="btn btn-primary btn-block" type="submit" style="margin-top:18px">목차 만들기</button>
</form>
<div class="toolbox-out"><div class="sheet out-sheet"><div class="out-hd"><b id="tocTitle">목차</b><span><button class="btn btn-soft btn-sm" type="button" id="tocCopy">텍스트 복사</button> <button class="btn btn-ghost btn-sm" type="button" id="tocDoc">Word로 저장</button></span></div><div class="rp-toc" id="tocOut">${tocHtml(exToc, { withSubs: true })}</div></div>
<p class="hint" style="margin-top:12px">이 목차로 본문까지 맡기고 싶으시면 <a href="${T.u('/thesis-writing/')}">논문 작성 지원</a>을 확인해 보세요.</p></div>
</div></section>
<section class="sec sec-alt"><div class="wrap-narrow prose"><h2 style="margin-top:0">연구방법별 목차 구성의 차이</h2>
<table class="g-table"><thead><tr><th>연구방법</th><th>3장 연구방법에 들어가는 절</th><th>4장 결과의 구성</th></tr></thead><tbody>
<tr><td>설문·통계(양적)</td><td>연구 모형, 연구 가설, 연구 대상 및 자료 수집, 측정 도구, 자료 분석 방법</td><td>일반적 특성, 신뢰도, 기술통계, 상관, 가설 검증</td></tr>
<tr><td>면담·사례(질적)</td><td>연구 설계, 연구 참여자, 자료 수집, 자료 분석, 연구의 엄밀성, 윤리적 고려</td><td>참여자 특성, 주제 모음과 주제, 경험의 구조</td></tr>
<tr><td>문헌연구</td><td>검색 전략, 선정·배제 기준, PRISMA 선정 과정, 질 평가와 자료 추출</td><td>선정 문헌 특성, 연구 동향, 결과 종합</td></tr>
<tr><td>프로그램 효과</td><td>연구 설계, 대상, 프로그램 구성, 측정 도구, 자료 수집, 분석</td><td>동질성 검증, 가설 검증</td></tr>
</tbody></table>
<p>목차를 정하는 원리는 <a href="/guide/thesis-table-of-contents/">논문 목차 구성법</a>에서 더 자세히 설명해 드려요.</p></div></section>
${faqBlock(T, tocFaq, { title: '논문 목차 자주 묻는 질문' })}`,
  });

  // 표본 수 계산기
  const ssFaq = [
    { q: '논문 표본 수는 어떻게 정하나요?', a: '분석 방법, 효과크기, 유의수준(보통 .05), 검정력(보통 .80)을 정한 뒤 검정력 분석으로 계산해요. 예를 들어 다중회귀분석에서 중간 효과크기 f²=.15, 예측변수 5개라면 최소 92명이 필요해요.' },
    { q: '이 계산기는 G*Power와 결과가 같나요?', a: '네. 비중심 F 분포와 카이제곱 분포, 상관계수의 정확 분포를 G*Power와 같은 방식으로 계산해서, 같은 조건이면 같은 값이 나와요. 예를 들어 독립표본 t검정 d=.5는 집단당 64명, 상관 r=.3은 84명이에요.' },
    { q: '탈락률은 어떻게 반영하나요?', a: '최소 표본 수를 (1 - 탈락률)로 나눠 모집 인원을 정해요. 온라인 설문은 불성실 응답을 고려해 10~20%를 더하는 경우가 많아요.' },
    { q: '매개효과 분석은 몇 명이 필요한가요?', a: '부트스트래핑으로 매개효과를 검증할 때 경로 a와 b가 중간 효과(.39)라면 약 78명이 필요하다는 기준이 널리 인용돼요(Fritz & MacKinnon, 2007). 회귀분석 기준 표본 수와 비교해 더 큰 값을 쓰시는 것이 안전해요.' },
  ];
  pages.push({
    path: '/tools/sample-size/', kind: 'tool', navTitle: '표본 수 계산기', h1: '표본 수 계산기',
    title: '표본 수 계산기 | G*Power 방식 논문 표본 크기 계산 논문AI',
    description: '다중회귀, 독립·대응표본 t검정, 분산분석, 상관분석, 카이제곱, 비율 추정의 표본 수를 G*Power와 같은 방식으로 계산합니다. 탈락률을 고려한 모집 인원과 논문에 쓸 근거 문장도 함께 제공합니다.',
    keywords: ['표본 수 계산', '표본 크기 계산', 'G*Power 표본 수', '논문 표본 수', '설문 표본 수'],
    crumbs: [['홈', '/'], ['무료 도구', '/tools/'], ['표본 수 계산기', '/tools/sample-size/']], faq: ssFaq, scripts: ['sample'], priority: '0.8',
    geo: '표본 수 계산기 기준값(유의수준 .05, 검정력 .80): 다중회귀 f²=.15에서 예측변수 1개 55명, 2개 68명, 3개 77명, 4개 85명, 5개 92명; 독립표본 t검정 d=.5 집단당 64명; 대응표본 t검정 dz=.5 34명; 일원분산분석 f=.25 3집단 159명, 4집단 180명; 상관분석 r=.3 84명; 카이제곱 w=.3 자유도 1 88명; 비율 추정 허용오차 ±5%p 385명.',
    schema: [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: '표본 수 계산기', applicationCategory: 'EducationalApplication', operatingSystem: 'Web', inLanguage: 'ko-KR', url: T.abs('/tools/sample-size/'), offers: { '@type': 'Offer', price: 0, priceCurrency: 'KRW' } }],
    body: `${head(T, '/tools/sample-size/', '표본 수 계산기', '표본 수 계산기', '분석 방법과 효과크기를 고르시면 필요한 최소 표본 수와 탈락률을 고려한 모집 인원을 바로 계산해 드려요. 계산 방식이 G*Power와 같아서 같은 조건이면 같은 값이 나와요.')}
<section class="sec"><div class="wrap toolbox">
<form class="toolbox-form" id="ssForm" autocomplete="off">
<div class="field"><label class="label" for="ssTest">분석 방법</label><select class="select" id="ssTest">
<option value="reg">다중회귀분석</option><option value="t">독립표본 t검정</option><option value="paired">대응표본 t검정</option><option value="anova">일원분산분석</option><option value="corr">상관분석</option><option value="chi">카이제곱 검정</option><option value="prop">비율 추정(실태 조사)</option></select></div>
<div class="field" data-ss="es"><label class="label" for="ssEs">효과크기</label><select class="select" id="ssEs"></select><p class="hint" id="ssEsHint"></p></div>
<div class="field" data-ss="k"><label class="label" for="ssK" id="ssKLabel">예측변수 수</label><input class="input" type="number" id="ssK" min="1" max="30" value="5"></div>
<div class="field" data-ss="e" hidden><label class="label" for="ssE">허용 오차</label><select class="select" id="ssE"><option value="0.03">±3%p</option><option value="0.05" selected>±5%p</option><option value="0.07">±7%p</option><option value="0.1">±10%p</option></select></div>
<div class="field" data-ss="pop" hidden><label class="label" for="ssPop">모집단 크기 <small>모르면 비워 두세요</small></label><input class="input" type="number" id="ssPop" min="10" placeholder="예: 1200"></div>
<div class="field" data-ss="ap"><label class="label">유의수준·검정력</label><div class="ss-two"><select class="select" id="ssAlpha"><option value="0.05" selected>α = .05</option><option value="0.01">α = .01</option></select><select class="select" id="ssPower"><option value="0.8" selected>검정력 .80</option><option value="0.9">검정력 .90</option><option value="0.95">검정력 .95</option></select></div></div>
<div class="field"><label class="label" for="ssDrop">탈락률</label><select class="select" id="ssDrop"><option value="0">고려 안 함</option><option value="0.1">10%</option><option value="0.15" selected>15%</option><option value="0.2">20%</option></select></div>
</form>
<div class="toolbox-out" aria-live="polite">
<div class="out-card"><p class="muted small" id="ssMethod">다중회귀분석</p><div class="result-big"><b class="num" id="ssN">92</b><span>명 이상</span></div><p style="margin:14px 0 0">탈락률을 고려한 모집 인원 <b class="num" id="ssRecruit">109명</b></p><p class="hint" id="ssAssume" style="margin-top:6px"></p></div>
<div class="out-card"><b style="display:block;margin-bottom:8px">논문에 쓸 근거 문장 예시</b><p class="ss-sentence" id="ssSentence"></p><button class="btn btn-soft btn-sm" type="button" id="ssCopy">문장 복사</button></div>
<div class="out-card"><b style="display:block;margin-bottom:8px">효과크기 기준(Cohen, 1988)</b><div class="table-wrap"><table class="g-table" style="min-width:0"><thead><tr><th>분석</th><th>작은</th><th>중간</th><th>큰</th></tr></thead><tbody><tr><td>회귀 f²</td><td>.02</td><td>.15</td><td>.35</td></tr><tr><td>t검정 d</td><td>.20</td><td>.50</td><td>.80</td></tr><tr><td>분산분석 f</td><td>.10</td><td>.25</td><td>.40</td></tr><tr><td>상관 r</td><td>.10</td><td>.30</td><td>.50</td></tr><tr><td>카이제곱 w</td><td>.10</td><td>.30</td><td>.50</td></tr></tbody></table></div></div>
</div></div></section>
${faqBlock(T, ssFaq, { title: '표본 수 자주 묻는 질문' })}`,
  });

  // 참고문헌 생성기
  const refFaq = [
    { q: 'APA 7판 참고문헌은 어떻게 쓰나요?', a: '학술지 논문은 저자. (연도). 논문 제목. 학술지명, 권(호), 쪽수. https://doi.org/... 순서로 써요. 저자는 20명까지 모두 적고, 마지막 저자 앞에 &를 붙여요.' },
    { q: '국내 문헌도 같은 형식인가요?', a: '국내 학위논문은 대부분 APA 형식을 따르되, 한글 문헌을 먼저 쓰고 외국 문헌을 나중에 정렬해요. 학교마다 세부 규칙이 조금씩 다르니 학과 양식을 꼭 확인해 주세요.' },
    { q: 'DOI가 없으면 어떻게 하나요?', a: 'DOI가 없으면 생략하셔도 돼요. 온라인에서만 볼 수 있는 자료라면 접속할 수 있는 URL을 적어 주세요.' },
  ];
  pages.push({
    path: '/tools/references/', kind: 'tool', navTitle: '참고문헌 생성기', h1: 'APA 참고문헌 생성기',
    title: 'APA 참고문헌 생성기 | 논문 참고문헌 정리 APA 7판 논문AI',
    description: '학술지 논문, 단행본, 학위논문, 보고서, 웹 자료 정보를 입력하면 APA 7판 참고문헌 형식으로 바꿔 줍니다. 국내·해외 문헌 모두 지원하며 본문 인용 형식도 함께 보여 줍니다.',
    keywords: ['논문 참고문헌 정리', 'APA 참고문헌', '참고문헌 생성기', 'APA 7판', '참고문헌 작성법'],
    crumbs: [['홈', '/'], ['무료 도구', '/tools/'], ['참고문헌 생성기', '/tools/references/']], faq: refFaq, scripts: ['refs'], priority: '0.8',
    geo: 'APA 7판 학술지 논문 형식 예: Kim, J., & Lee, S. (2023). Title of the article. Journal Name, 12(3), 45-67. https://doi.org/10.xxxx. 국내 문헌 예: 김철수, 이영희 (2023). 논문 제목. 학술지명, 12(3), 45-67.',
    schema: [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'APA 참고문헌 생성기', applicationCategory: 'EducationalApplication', operatingSystem: 'Web', inLanguage: 'ko-KR', url: T.abs('/tools/references/'), offers: { '@type': 'Offer', price: 0, priceCurrency: 'KRW' } }],
    body: `${head(T, '/tools/references/', '참고문헌 생성기', 'APA 참고문헌 생성기', '논문 참고문헌 정리를 한 번에 끝내 보세요. 서지 정보를 칸에 맞춰 넣으시면 APA 7판 형식의 참고문헌과 본문 인용을 만들어 드려요. 만든 항목은 목록에 모아 두었다가 한 번에 복사할 수 있어요.')}
<section class="sec"><div class="wrap toolbox">
<form class="toolbox-form" id="refForm" autocomplete="off">
<div class="field"><label class="label" for="rType">자료 유형</label><select class="select" id="rType"><option value="journal">학술지 논문</option><option value="book">단행본</option><option value="thesis">학위논문</option><option value="report">보고서</option><option value="web">웹 자료</option></select></div>
<div class="field"><label class="label" for="rAuthors">저자 <small>한 줄에 한 명</small></label><textarea class="textarea" id="rAuthors" rows="3" placeholder="예: 홍길동&#10;또는 Smith, John A.">김민지
이준호</textarea></div>
<div class="field"><label class="label" for="rYear">연도</label><input class="input" id="rYear" value="2024" inputmode="numeric"></div>
<div class="field"><label class="label" for="rTitle">제목</label><input class="input" id="rTitle" value="간호사의 직무스트레스와 이직의도의 관계"></div>
<div class="field" data-r="journal"><label class="label" for="rSource">학술지명</label><input class="input" id="rSource" value="한국간호학회지"></div>
<div class="field" data-r="journal"><span class="label">권(호), 쪽</span><div class="ss-three"><input class="input" id="rVol" placeholder="권" value="54"><input class="input" id="rIssue" placeholder="호" value="2"><input class="input" id="rPages" placeholder="쪽" value="123-135"></div></div>
<div class="field" data-r="book report" hidden><label class="label" for="rPub">출판사·발행 기관</label><input class="input" id="rPub"></div>
<div class="field" data-r="thesis" hidden><label class="label" for="rUniv">학교명</label><input class="input" id="rUniv" placeholder="예: 성균관대학교"></div>
<div class="field" data-r="thesis" hidden><label class="label" for="rDegree">학위</label><select class="select" id="rDegree"><option value="master">석사학위논문</option><option value="doctor">박사학위논문</option></select></div>
<div class="field"><label class="label" for="rDoi">DOI 또는 URL <small>선택</small></label><input class="input" id="rDoi" placeholder="10.xxxx/xxxxx 또는 https://..."></div>
<button class="btn btn-primary btn-block" type="submit" style="margin-top:18px">목록에 추가</button>
</form>
<div class="toolbox-out" aria-live="polite">
<div class="out-card"><b style="display:block;margin-bottom:10px">참고문헌</b><div class="ref-out" id="refOut"></div><p class="hint" style="margin-top:10px">본문 인용: <span id="refCite"></span></p></div>
<div class="out-card"><div class="out-hd"><b>내 참고문헌 목록 <span class="muted" id="refCount"></span></b><span><button class="btn btn-soft btn-sm" type="button" id="refCopyAll">전체 복사</button> <button class="btn btn-ghost btn-sm" type="button" id="refClear">비우기</button></span></div><ol class="ref-list" id="refList"></ol><p class="hint">목록은 이 브라우저에만 임시로 저장돼요. 한글 문헌을 먼저, 외국 문헌을 나중에 가나다·알파벳 순으로 정렬해 드려요.</p></div>
</div></div></section>
${faqBlock(T, refFaq, { title: '참고문헌 자주 묻는 질문' })}`,
  });
  return pages;
}
