// 주문 화면(앱) 껍데기: 내용은 JS가 그림
const APP = [
  { path: '/paper/new/', script: 'paper', title: '논문 의뢰하기 | 논문AI', h1: '논문 의뢰하기', description: '관심 주제와 전공을 적고 논문 종류를 고르면 결제 화면이 바로 열려요. 회원가입 없이 카드, 간편결제, 계좌이체로 결제할 수 있어요.' },
  { path: '/survey/new/', script: 'survey', title: '설문조사 의뢰하기 | 논문AI', h1: '설문조사 의뢰하기', description: '설문 목적과 대상, 의뢰 유형을 고르시면 필요한 자료와 견적을 바로 계산해 드려요.' },
  { path: '/statistics/new/', script: 'statistics', title: '통계분석 의뢰하기 | 논문AI', h1: '통계분석 의뢰하기', description: '데이터가 있는지와 분석 목적을 고르시면 분석 계획과 견적을 바로 계산해 드려요.' },
  { path: '/checkout/', script: 'checkout', title: '결제 | 논문AI', h1: '주문 확인과 결제', description: '주문 내용과 금액을 확인하고 결제해 주세요.' },
  { path: '/orders/', script: 'orders', title: '주문 조회 | 논문AI', h1: '주문 조회', description: '주문번호와 조회 비밀번호로 진행 상황을 확인하고 결과물을 내려받을 수 있어요.' },
];

export default function app({ T }) {
  const pages = APP.map((a) => ({
    path: a.path, kind: 'app', chrome: 'app', noindex: true, title: a.title, description: a.description, styles: ['app'], scripts: [a.script],
    body: `<div class="app-root" id="app" data-app="${a.script}"><div class="app-loading"><span class="spin spin-dark"></span><span>불러오는 중이에요</span></div></div><noscript><div class="wrap" style="padding:40px 0"><p>이 화면은 자바스크립트가 필요해요. 브라우저 설정에서 자바스크립트를 켜 주세요.</p></div></noscript>`,
  }));
  for (const [path, title] of [['/admin/', '논문AI 운영자 화면'], ['/admin/settings/', '논문AI 운영 설정']]) {
    pages.push({
      path, kind: 'admin', chrome: 'admin', noindex: true, title, description: title, styles: ['admin'], scripts: ['admin'],
      body: `<div class="admin-root" id="admin"><div class="app-loading"><span class="spin spin-dark"></span><span>불러오는 중입니다</span></div></div>`,
    });
  }
  return pages;
}
