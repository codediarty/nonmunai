// 주문 화면(앱) 껍데기: 내용은 JS가 그림
const APP = [
  { path: '/paper/new/', script: 'paper', title: '논문 의뢰하기 | 논문AI', h1: '논문 의뢰하기', description: '논문 유형과 주제, 필요한 작업을 고르면 연구 설계와 견적이 자동으로 계산됩니다.' },
  { path: '/survey/new/', script: 'survey', title: '설문조사 의뢰하기 | 논문AI', h1: '설문조사 의뢰하기', description: '설문 목적과 대상, 의뢰 유형을 고르면 필요한 자료와 견적이 자동으로 계산됩니다.' },
  { path: '/statistics/new/', script: 'statistics', title: '통계분석 의뢰하기 | 논문AI', h1: '통계분석 의뢰하기', description: '데이터 유무와 분석 목적을 고르면 분석 계획과 견적이 자동으로 계산됩니다.' },
  { path: '/checkout/', script: 'checkout', title: '결제 | 논문AI', h1: '주문 확인과 결제', description: '주문 내용과 금액을 확인하고 결제합니다.' },
  { path: '/orders/', script: 'orders', title: '주문 조회 | 논문AI', h1: '주문 조회', description: '주문번호와 조회 비밀번호로 진행 상황을 확인하고 결과물을 내려받습니다.' },
];

export default function app({ T }) {
  const pages = APP.map((a) => ({
    path: a.path, kind: 'app', chrome: 'app', noindex: true, title: a.title, description: a.description, styles: ['app'], scripts: [a.script],
    body: `<div class="app-root" id="app" data-app="${a.script}"><div class="app-loading"><span class="spin spin-dark"></span><span>불러오는 중입니다</span></div></div><noscript><div class="wrap" style="padding:40px 0"><p>이 화면은 자바스크립트가 필요합니다. 브라우저 설정에서 자바스크립트를 켜 주세요.</p></div></noscript>`,
  }));
  for (const [path, title] of [['/admin/', '논문AI 운영자 화면'], ['/admin/settings/', '논문AI 운영 설정']]) {
    pages.push({
      path, kind: 'admin', chrome: 'admin', noindex: true, title, description: title, styles: ['admin'], scripts: ['admin'],
      body: `<div class="admin-root" id="admin"><div class="app-loading"><span class="spin spin-dark"></span><span>불러오는 중입니다</span></div></div>`,
    });
  }
  return pages;
}
