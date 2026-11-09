// 논문AI 페이지 레이아웃 템플릿 (빌드 시 사용)
import fs from 'node:fs';
import { brandMark } from './brand.mjs';
import path from 'node:path';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const NAV = [
  {
    label: '논문 자동작성', href: '/ai-thesis/', children: [
      { label: '논문 자동작성', href: '/ai-thesis/', desc: '관심 주제 한 줄로 논문 완성' },
      { label: '논문 작성 지원', href: '/thesis-writing/', desc: '주제부터 장별 원고까지' },
      { label: '석사학위논문', href: '/master-thesis/', desc: '80 Page · 전공 박사 최종 검수' },
      { label: '박사학위논문', href: '/dissertation/', desc: '130 Page · 전공 박사 최종 검수' },
      { label: '학술지 논문', href: '/journal-paper/', desc: '20 Page · 투고 규정 맞춤과 박사 검수' },
      { label: '연구계획서', href: '/research-proposal/', desc: '심사 전 첫 단계' },
      { label: '논문 첨삭·교정', href: '/thesis-editing/', desc: '문장·논리·형식 점검' },
      { label: '교수님 피드백 반영', href: '/professor-feedback/', desc: '수정표와 파란색 반영 표시' },
      { label: '논문 컨설팅', href: '/consulting/', desc: '단계별 1:1 지원' },
    ],
  },
  { label: '설문조사', href: '/survey/' },
  { label: '통계분석', href: '/statistics/' },
  {
    label: '무료 도구', href: '/tools/', children: [
      { label: '무료 논문 설계', href: '/free/', desc: '주제를 넣으면 연구모형까지' },
      { label: '논문 목차 생성기', href: '/tools/toc/', desc: '유형·방법별 표준 목차' },
      { label: '표본 수 계산기', href: '/tools/sample-size/', desc: 'G*Power와 같은 계산' },
      { label: '참고문헌 생성기', href: '/tools/references/', desc: 'APA 7판 형식 변환' },
    ],
  },
  { label: '가격', href: '/pricing/' },
  { label: '가이드', href: '/guide/' },
];

export function createTemplates({ site, root, assetVersion }) {
  const base = site.basePath || '';
  const u = (p) => (/^https?:/.test(p) ? p : base + p);
  const abs = (p) => site.siteUrl.replace(/\/$/, '') + base + p;
  const v = (p) => `${u(p)}?v=${assetVersion}`;
  const iconCache = {};

  function icon(name, cls = 'i') {
    if (!iconCache[name]) {
      const file = path.join(root, 'node_modules/lucide-static/icons', `${name}.svg`);
      let svg = fs.readFileSync(file, 'utf8');
      // 크기·클래스는 바깥 svg 태그에서만 지운다(안쪽 rect의 width·height는 남겨야 자물쇠·계산기 등이 온전히 그려짐)
      svg = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(width|height)="[^"]*"/g, '').replace(/\sclass="[^"]*"/, '')).replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><').replace(/\s+\/>/g, '/>').trim();
      iconCache[name] = svg;
    }
    return iconCache[name].replace('<svg', `<svg class="${cls}" aria-hidden="true" focusable="false"`);
  }

  function logo(cls = 'logo') {
    const ft = /logo-ft/.test(cls);
    return `<a class="${cls}" href="${u('/')}" aria-label="논문AI 홈"><span class="logo-mark" aria-hidden="true">${brandMark({ size: 30, bright: ft })}</span><span class="logo-word">논문AI</span>${ft ? '<span class="logo-en">NONMUN AI</span>' : ''}</a>`;
  }


  function header(page) {
    if (page.chrome === 'app') {
      return `<header class="hd hd-app"><div class="wrap hd-in">${logo()}<nav class="hd-app-nav" aria-label="주요 링크"><a href="${u('/orders/')}">주문 조회</a><a class="hd-help" href="${u('/faq/')}">도움말</a></nav></div></header>`;
    }
    if (page.chrome === 'admin') {
      return `<header class="hd hd-admin"><div class="wrap-wide hd-in">${logo()}<span class="hd-admin-tag">운영자 화면</span><div class="hd-admin-slot" id="adminHeaderSlot"></div></div></header>`;
    }
    const items = NAV.map((n) => {
      const active = page.path === n.href || (n.children || []).some((c) => c.href === page.path) ? ' aria-current="page"' : '';
      if (!n.children) return `<li><a class="nav-a" href="${u(n.href)}"${active}>${esc(n.label)}</a></li>`;
      const kids = n.children.map((c) => `<li><a href="${u(c.href)}"${page.path === c.href ? ' aria-current="page"' : ''}><span>${esc(c.label)}</span><small>${esc(c.desc)}</small></a></li>`).join('');
      return `<li class="has-sub"><a class="nav-a" href="${u(n.href)}"${active}>${esc(n.label)}${icon('chevron-down', 'i i-chev')}</a><div class="sub"><ul>${kids}</ul></div></li>`;
    }).join('');
    return `<header class="hd"><div class="wrap hd-in">${logo()}
<nav class="nav" aria-label="주 메뉴"><ul class="nav-ul">${items}</ul></nav>
<div class="hd-right"><a class="hd-link" href="${u('/orders/')}">주문 조회</a><a class="btn btn-dark btn-sm hd-cta" href="${u('/paper/new/')}">논문 의뢰하기</a>
<button class="hd-burger" type="button" aria-label="메뉴 열기" aria-expanded="false" aria-controls="mnav">${icon('menu')}</button></div></div>
<div class="mnav" id="mnav" hidden><div class="mnav-in">${NAV.map((n) => `<div class="mnav-group"><a class="mnav-top" href="${u(n.href)}">${esc(n.label)}</a>${n.children ? `<div class="mnav-kids">${n.children.map((c) => `<a href="${u(c.href)}">${esc(c.label)}</a>`).join('')}</div>` : ''}</div>`).join('')}
<div class="mnav-cta"><a class="btn btn-primary btn-block" href="${u('/paper/new/')}">논문 의뢰하기</a><a class="btn btn-ghost btn-block" href="${u('/orders/')}">주문 조회</a></div></div></div></header>`;
  }

  function footer(page) {
    const b = site.brand;
    if (page.chrome === 'admin') return '';
    const col = (title, links) => `<div class="ft-col"><h2 class="ft-h">${esc(title)}</h2><ul>${links.map(([l, h]) => `<li><a href="${u(h)}">${esc(l)}</a></li>`).join('')}</ul></div>`;
    return `<footer class="ft"><div class="wrap">
<div class="ft-top"><div class="ft-brand">${logo('logo logo-ft')}<p>관심 주제 한 줄로 논문을 완성하고, 같은 전공 분야의 박사가 최종 검수까지 마친 뒤 보내 드리는 AI 논문 서비스예요. 첨삭, 설문조사, 통계분석도 한 번에 맡길 수 있어요.</p><p class="ft-secure">${icon('shield-check')}<span>철저한 보안 관리 · 전달 후 자료 자동 삭제</span></p></div>
<div class="ft-cols">${col('논문 작성', [['AI 논문 자동작성', '/ai-thesis/'], ['석사학위논문', '/master-thesis/'], ['박사학위논문', '/dissertation/'], ['학술지 논문', '/journal-paper/'], ['연구계획서', '/research-proposal/'], ['논문 작성 지원', '/thesis-writing/']])}
${col('논문 지원', [['논문 첨삭·교정', '/thesis-editing/'], ['교수님 피드백 반영', '/professor-feedback/'], ['논문 컨설팅', '/consulting/'], ['설문조사', '/survey/'], ['통계분석', '/statistics/'], ['가격 안내', '/pricing/']])}
${col('무료 도구·가이드', [['무료 도구 모음', '/tools/'], ['무료 논문 설계', '/free/'], ['논문 목차 생성기', '/tools/toc/'], ['표본 수 계산기', '/tools/sample-size/'], ['참고문헌 생성기', '/tools/references/'], ['논문 작성 가이드', '/guide/']])}
${col('고객 지원', [['주문 조회', '/orders/'], ['진행 방식', '/process/'], ['자주 묻는 질문', '/faq/'], ['서비스 소개', '/about/'], ['연구윤리 원칙', '/ethics/']])}</div></div>
<p class="ft-legal"><a href="${u('/terms/')}">이용약관</a><a href="${u('/privacy/')}"><b>개인정보처리방침</b></a><a href="${u('/refund/')}">환불 규정</a></p>
<div class="ft-biz"><p><b>논문AI</b> 운영 ${esc(b.operator)} (성균관대학교 RISE사업 지원 기업) · 대표 ${esc(b.ceo)} · 사업자등록번호 ${esc(b.bizNo)} · 통신판매업신고 ${esc(b.mailOrderNo)}</p>
<p>${esc(b.address)} · 전화 ${esc(b.phone)} · 이메일 ${esc(b.email)}</p>
<p class="ft-copy">© ${new Date().getFullYear()} 논문AI. All rights reserved. 서비스 이용에는 <a href="${u('/terms/')}">이용약관</a>이 적용됩니다.</p></div>
</div></footer>`;
  }

  function jsonld(obj) {
    return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
  }

  function breadcrumbLd(crumbs) {
    return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: abs(c[1]) })) };
  }

  function faqLd(faq) {
    return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  }

  const orgLd = {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': abs('/#organization'), name: '논문AI', alternateName: ['논문 AI', 'NonmunAI'],
    url: abs('/'), logo: abs('/assets/img/logo-512.png'), email: site.brand.email, telephone: site.brand.phone,
    address: { '@type': 'PostalAddress', streetAddress: '서부로 2066 성균관대학교 브릿지팩토리', addressLocality: '수원시 장안구', addressRegion: '경기도', postalCode: '16419', addressCountry: 'KR' },
    parentOrganization: { '@type': 'Organization', name: site.brand.operator, url: site.brand.operatorUrl },
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: site.brand.email, telephone: site.brand.phone, areaServed: 'KR', availableLanguage: ['ko'] },
  };

  function layout(page) {
    const title = page.title;
    const desc = page.description || '';
    const canonical = abs(page.path);
    const ogImage = abs(page.ogImage || '/assets/img/og/default.png');
    const ld = [];
    if (page.path === '/') ld.push(orgLd, { '@context': 'https://schema.org', '@type': 'WebSite', '@id': abs('/#website'), name: '논문AI', alternateName: '논문 AI', url: abs('/'), inLanguage: 'ko-KR', publisher: { '@id': abs('/#organization') } });
    if (page.crumbs && page.crumbs.length > 1) ld.push(breadcrumbLd(page.crumbs));
    if (page.faq && page.faq.length) ld.push(faqLd(page.faq));
    (page.schema || []).forEach((s) => ld.push(s));
    const cfg = { siteUrl: site.siteUrl, basePath: base, apiUrl: site.apiUrl || '', version: assetVersion, brand: site.brand };
    const styles = (page.styles || ['site']).map((s) => `<link rel="stylesheet" href="${v(`/assets/css/${s}.css`)}">`).join('');
    const scripts = ['site', ...(page.scripts || [])].map((s) => `<script type="module" src="${v(`/assets/js/${s}.js`)}"></script>`).join('');
    const verify = [site.verification.naver ? `<meta name="naver-site-verification" content="${esc(site.verification.naver)}">` : '', site.verification.google ? `<meta name="google-site-verification" content="${esc(site.verification.google)}">` : ''].join('');
    const robots = page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
    return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${page.keywords ? `<meta name="keywords" content="${esc(page.keywords.join(', '))}">` : ''}
<meta name="robots" content="${robots}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:site_name" content="논문AI">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(page.ogTitle || title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(page.ogTitle || title)}">
${page.published ? `<meta property="article:published_time" content="${page.published}T09:00:00+09:00">` : ''}
${page.modified ? `<meta property="article:modified_time" content="${page.modified}T09:00:00+09:00">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.ogTitle || title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ogImage}">
<meta name="theme-color" content="#0F1B3D">
<meta name="format-detection" content="telephone=no">
${verify}
<link rel="icon" href="${u('/favicon.svg')}" type="image/svg+xml">
<link rel="icon" href="${u('/favicon-32.png')}" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${u('/apple-touch-icon.png')}">
<link rel="manifest" href="${u('/site.webmanifest')}">
<link rel="alternate" type="application/rss+xml" title="논문AI 가이드" href="${u('/rss.xml')}">
${styles}
<script>window.NONMUN=${JSON.stringify(cfg)};</script>
${ld.map(jsonld).join('\n')}
</head>
<body class="pg-${page.kind || 'page'}${page.chrome ? ' chrome-' + page.chrome : ''}">
<a class="skip" href="#main">본문 바로가기</a>
${header(page)}
<main id="main">${page.body}</main>
${footer(page)}
${scripts}
</body>
</html>
`;
  }

  return { u, abs, v, icon, logo, layout, esc, breadcrumbLd, faqLd, orgLd, jsonld };
}
