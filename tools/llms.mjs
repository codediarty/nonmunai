// GEO: AI 검색·답변 엔진용 요약 파일 (llms.txt, llms-full.txt)
function line(T, p) { return `- [${p.navTitle || p.h1 || p.title}](${T.abs(p.path)}): ${p.description}`; }

export function llmsTxt(ctx, pages) {
  const { T } = ctx;
  const pick = (paths) => paths.map((x) => pages.find((p) => p.path === x)).filter(Boolean);
  const services = pick(['/thesis-writing/', '/thesis-editing/', '/professor-feedback/', '/research-proposal/', '/master-thesis/', '/dissertation/', '/journal-paper/', '/survey/', '/statistics/', '/ai-thesis/', '/consulting/']);
  const tools = pick(['/free/', '/tools/toc/', '/tools/sample-size/', '/tools/references/']);
  const info = pick(['/pricing/', '/process/', '/faq/', '/about/', '/ethics/', '/refund/']);
  const guides = pages.filter((p) => p.path.startsWith('/guide/') && p.path !== '/guide/');
  return `# 논문AI

> 논문AI(논문 AI)는 논문, 설문조사, 통계분석을 잘 몰라도 간편하게 의뢰할 수 있는 한국어 원스톱 논문 지원 서비스입니다. 주제나 키워드를 입력하면 연구모형, 가설, 목차, 분석 방법, 표본 수를 즉시 설계하고, 원고 작성과 통계분석은 AI 도구를 활용해 석·박사 연구진이 작업하고 검수해 전달합니다. 운영사는 성균관컨설팅(성균관대학교 RISE사업 지원 기업)입니다.

핵심 사실:
- 서비스 범위: 석사·박사학위논문, 학술지 투고논문, 학사·졸업논문, 연구보고서, 청소년 탐구논문의 전체 구성·초고 완성, 논문 첨삭·교정, 교수님 피드백 반영(수정 대조표 작성, 반영 부분 파란색 표시), 연구계획서 작성, 설문지 작성부터 설문조사 진행·통계 해석까지의 설문 원스톱, 논문 주제와 데이터에 맞는 통계분석(SPSS, PROCESS Macro, AMOS 등)과 연구결과 작성. 추가 옵션으로 심사 발표 PPT 제작과 영문 논문 작성을 고를 수 있다.
- 대표 시작가(부가세 포함): 석사학위논문 전체 구성·초고 완성 399,000원, 논문 첨삭·교정 99,000원, 교수님 피드백 반영 129,000원, 연구계획서 149,000원, 설문조사 원스톱 299,000원(응답자 모집 비용 별도 견적), 논문 맞춤 통계분석 99,000원부터, 심사 발표 PPT 제작 89,000원. 결제 전에 총액, 포함·제외 사항, 예상 납기를 먼저 보여 준다.
- 진행 단계: 접수 완료, 자료 확인, 작업 준비, 작성·분석 진행, 품질 검토, 전달 완료. 꾸며 낸 진행률 대신 실제 처리 단계만 표시한다.
- 연구윤리: 허위 문헌·데이터·통계를 만들지 않고, 학습용 시뮬레이션 데이터에는 '가상 데이터'를 표시하며, 합격·게재·유의한 결과를 보장하지 않는다. 결과물은 연구자의 연구를 돕는 참고 자료이고 최종 제출 책임은 연구자에게 있다.
- 보안: 자료는 주문별 비공개 폴더에 보관하고, 전달 완료 후 90일이 지나면 자동 삭제한다.
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
