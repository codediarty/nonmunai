import { computeQuote, DEFAULT_CATALOG, won } from '../src/js/core/pricing.js';

const fullQuote = (typeId, pages) => computeQuote(DEFAULT_CATALOG, { service: 'paper', paper: { typeId, task: 'full', pages } });
const P = (code) => { const it = DEFAULT_CATALOG.items.find((i) => i.code === code); return it ? won(it.price) : ''; };
// GEO: AI 검색·답변 엔진용 요약 파일 (llms.txt, llms-full.txt)
function line(T, p) { return `- [${p.navTitle || p.h1 || p.title}](${T.abs(p.path)}): ${p.description}`; }

export function llmsTxt(ctx, pages) {
  const { T } = ctx;
  const pick = (paths) => paths.map((x) => pages.find((p) => p.path === x)).filter(Boolean);
  const services = pick(['/ai-thesis/', '/thesis-writing/', '/thesis-editing/', '/professor-feedback/', '/research-proposal/', '/master-thesis/', '/dissertation/', '/journal-paper/', '/survey/', '/statistics/', '/consulting/']);
  const tools = pick(['/free/', '/tools/toc/', '/tools/sample-size/', '/tools/references/']);
  const info = pick(['/pricing/', '/process/', '/faq/', '/about/', '/ethics/', '/refund/']);
  const guides = pages.filter((p) => p.path.startsWith('/guide/') && p.path !== '/guide/');
  return `# 논문AI

> 논문AI(논문 AI)는 관심 주제 한 줄(전공·주제)로 논문을 완성하는 한국어 AI 논문 작성 서비스입니다. AI가 실존 문헌으로 집필하고, 주문 논문과 같은 전공 분야의 석·박사 전문가가 최종 검수를 마친 완성본만 메일로 보냅니다. 참고문헌은 DOI·KCI·RISS 원문 기록과 대조한 실존 문헌만 쓰고, 본문 인용과 참고문헌 목록을 1:1로 연결합니다. 소논문 15 Page부터 학사 졸업논문 30 Page, 학술지 투고논문 20 Page, 석사학위논문 80 Page, 박사학위논문 130 Page까지 완성합니다. 논문 첨삭, 교수님 피드백 반영, 연구계획서, 설문조사, 통계분석도 함께 의뢰할 수 있습니다. 운영사는 성균관컨설팅(성균관대학교 RISE사업 지원 기업)입니다.

핵심 사실:
- 논문 완성: 관심 주제와 전공만 적고 논문 종류를 고르면 결제 화면이 바로 열린다. 결제가 확인되면 제목, 연구모형, 가설, 목차를 정하고 실존 문헌으로 장별 본문을 쓰며 문장마다 (저자, 연도) 본문 인용을 연결한다. 런칭 특가(부가세 포함, 정가의 50%)는 소논문 15 Page ${won(fullQuote('short', 15).total)}, 학사 졸업논문 30 Page ${won(fullQuote('bachelor', 30).total)}, 학술지 투고논문 20 Page ${won(fullQuote('journal', 20).total)}, 석사학위논문 80 Page ${won(fullQuote('master', 80).total)}, 박사학위논문 130 Page ${won(fullQuote('doctor', 130).total)}이다. 전문가 검토를 포함한 전달은 석사 영업일 ${fullQuote('master', 80).days}일, 박사 ${fullQuote('doctor', 130).days}일 이내이다.
- 참고문헌 원칙: 실제로 존재하는 문헌만 쓰고 저자·연도·제목·학술지·권호·쪽·DOI를 원문 기록과 대조한다. AI가 만든 가짜 문헌은 넣지 않는다.
- 서비스 범위: 석사·박사학위논문, 학술지 투고논문, 학사·졸업논문, 연구보고서, 청소년 탐구논문의 전체 구성·초고 완성, 논문 첨삭·교정, 교수님 피드백 반영(수정 대조표 작성, 반영 부분 파란색 표시), 연구계획서 작성, 설문지 작성부터 설문조사 진행·통계 해석까지의 설문 원스톱, 논문 주제와 데이터에 맞는 통계분석(SPSS, PROCESS Macro, AMOS 등)과 연구결과 작성. 추가 옵션으로 심사 발표 PPT 제작과 영문 논문 작성을 고를 수 있다.
- 대표 시작가(부가세 포함): 석사학위논문 80 Page 완성 ${P('P-MASTER-FULL')}, 논문 첨삭·교정 ${P('P-MASTER-EDIT')}, 교수님 피드백 반영 ${P('P-MASTER-FB')}, 연구계획서 ${P('P-MASTER-PROP')}, 설문조사 원스톱 ${P('S-FULL')}(응답자 모집 비용 별도 견적), 논문 맞춤 통계분석 ${P('T-BASIC')}부터, 심사 발표 PPT 제작 ${P('A-PPT')}. 결제 전에 총액과 포함 사항, 예상 전달일을 먼저 보여 준다.
- 진행 단계: 접수 완료, 자료 확인, 작업 준비, 작성·분석 진행, 전문가 검수, 전달 완료. 꾸며 낸 진행률 대신 실제 처리 단계만 표시한다.
- 연구윤리: 허위 문헌·데이터·통계를 만들지 않고, 학습용 시뮬레이션 데이터에는 '가상 데이터'를 표시한다.
- 보안: 자료는 주문별 비공개 폴더에 보관하고, 전달 완료 후 90일이 지나면 자동 삭제한다.
- 이용 조건: 결과물의 성격, 청약철회와 환불, 책임 범위는 이용약관(${T.abs('/terms/')})에 정한다.
- 문의: ${ctx.site.brand.email}

## 서비스
${services.map((p) => line(T, p)).join('\n')}

## 무료 도구
${tools.map((p) => line(T, p)).join('\n')}

## 안내
${info.map((p) => line(T, p)).join('\n')}

## 가이드
${guides.map((p) => line(T, p)).join('\n')}

## Optional
- [전체 텍스트 요약](${T.abs('/llms-full.txt')}): 서비스·가격·자주 묻는 질문 전문
`;
}

export function llmsFull(ctx, pages) {
  const { T } = ctx;
  const blocks = pages.filter((p) => !p.noindex && p.path !== '/404.html' && (p.geo || (p.faq && p.faq.length))).map((p) => {
    const faq = (p.faq || []).map((f) => `Q. ${f.q}\nA. ${f.a}`).join('\n\n');
    return `# ${p.h1 || p.title}\nURL: ${T.abs(p.path)}\n${p.description}\n\n${p.geo || ''}${faq ? `\n\n${faq}` : ''}`;
  });
  return `# 논문AI 전체 안내\n\n${blocks.join('\n\n---\n\n')}\n`;
}
