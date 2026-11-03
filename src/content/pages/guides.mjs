import { faqBlock, ctaBand, crumbs } from '../../templates/parts.mjs';
import { esc } from '../../templates/layout.mjs';

const CATS = ['논문 작성', '연구 설계', '설문조사', '통계분석', '학술지·투고', '연구윤리·AI'];
const SERVICE_LABEL = { '/thesis-writing/': '논문 작성 지원', '/master-thesis/': '석사학위논문', '/dissertation/': '박사학위논문', '/research-proposal/': '연구계획서', '/tools/toc/': '논문 목차 생성기', '/survey/': '설문조사', '/tools/sample-size/': '표본 수 계산기', '/statistics/': '통계분석', '/professor-feedback/': '교수님 피드백 반영', '/thesis-editing/': '논문 첨삭·교정', '/tools/references/': '참고문헌 생성기', '/journal-paper/': '학술지 논문', '/ai-thesis/': 'AI 논문 작성' };

export default function guidePages({ T, guides }) {
  const sorted = guides.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const card = (g) => `<a class="g-card" href="${T.u(`/guide/${g.slug}/`)}"><b>${esc(g.title)}</b><span>${esc(g.description)}</span><small>${esc(g.category)} · ${g.minutes}분 · ${g.date.replace(/-/g, '.')}</small></a>`;
  const pages = [{
    path: '/guide/', kind: 'guide-index', navTitle: '논문 작성 가이드', h1: '논문 작성 가이드',
    title: '논문 작성 가이드 | 논문 작성법·설문·SPSS 통계 해설 논문AI',
    description: '처음 논문을 쓰는 분을 위한 실전 가이드입니다. 논문 작성법, 연구계획서, 목차 구성, 설문지 제작, 표본 수, SPSS 통계분석과 결과 해석, 학술지 투고, AI 연구윤리까지 정리했습니다.',
    keywords: ['논문 작성법', '논문 쓰는 법', 'SPSS 통계분석 방법', '설문지 만드는 법', '연구계획서 작성법'],
    crumbs: [['홈', '/'], ['가이드', '/guide/']], changefreq: 'daily', priority: '0.8',
    body: `<section class="phero phero-sm"><div class="wrap">${crumbs(T, [['홈', '/'], ['가이드', '/guide/']])}<h1 class="h-1" style="margin-top:20px">논문 작성 가이드</h1><p class="lead" style="max-width:40em">논문을 처음 쓰는 분들이 가장 많이 막히는 지점을 순서대로 정리했어요. 개념을 먼저 이해하고, 필요한 부분은 무료 도구로 바로 확인해 보세요.</p></div></section>
<section class="sec"><div class="wrap">
${CATS.map((c) => { const list = sorted.filter((g) => g.category === c); return list.length ? `<div class="page-sec"><h2 class="h-2" style="margin-bottom:18px">${esc(c)}</h2><div class="g-list">${list.map(card).join('')}</div></div>` : ''; }).join('')}
${sorted.filter((g) => !CATS.includes(g.category)).length ? `<div class="page-sec"><h2 class="h-2" style="margin-bottom:18px">기타</h2><div class="g-list">${sorted.filter((g) => !CATS.includes(g.category)).map(card).join('')}</div></div>` : ''}
${sorted.length ? '' : '<p class="muted">가이드를 준비하고 있어요.</p>'}
</div></section>
${ctaBand(T, { title: '읽는 것보다 빠른 방법', text: '관심 주제 한 줄만 적어 주세요. 논문AI가 본문과 참고문헌까지 집필하고, 석·박사 전문가가 최종 검토해서 메일로 보내 드려요.', topic: true })}`,
  }];
  for (const g of sorted) {
    const related = sorted.filter((x) => x.slug !== g.slug && x.category === g.category).slice(0, 3);
    const more = related.length < 3 ? sorted.filter((x) => x.slug !== g.slug && !related.includes(x)).slice(0, 3 - related.length) : [];
    const svc = g.service || '/thesis-writing/';
    const faq = (g.faq || []).map((f) => ({ q: f.q, a: f.a }));
    const path = `/guide/${g.slug}/`;
    pages.push({
      path, kind: 'guide', navTitle: g.title, h1: g.title, title: `${g.title} | 논문AI 가이드`, description: g.description, keywords: g.keywords,
      crumbs: [['홈', '/'], ['가이드', '/guide/'], [g.title, path]], faq, ogType: 'article', published: g.date, modified: g.updated || g.date,
      ogImage: `/assets/img/og/guide-${g.slug}.png`, priority: '0.7', changefreq: 'monthly',
      geo: `${(g.summary || []).join(' ')}`,
      schema: [{ '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, datePublished: `${g.date}T09:00:00+09:00`, dateModified: `${g.updated || g.date}T09:00:00+09:00`, inLanguage: 'ko-KR', articleSection: g.category, keywords: (g.keywords || []).join(', '), mainEntityOfPage: T.abs(path), image: T.abs(`/assets/img/og/guide-${g.slug}.png`), author: { '@type': 'Organization', name: '논문AI 연구진', url: T.abs('/about/') }, publisher: { '@id': T.abs('/#organization') } }],
      body: `<div class="wrap"><header class="g-head">${crumbs(T, [['홈', '/'], ['가이드', '/guide/'], [g.category, '/guide/']])}<h1 class="h-1">${esc(g.title)}</h1><div class="g-meta"><span>${esc(g.category)}</span><span>읽는 시간 ${g.minutes}분</span><span>${g.date.replace(/-/g, '.')} 작성</span><span>논문AI 연구진</span></div></header>
<div class="split">
<article class="prose">
${g.summary && g.summary.length ? `<div class="g-sum"><b>핵심 요약</b><ul>${g.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
${g.html}
</article>
<aside class="aside-sticky">
${g.toc && g.toc.length ? `<nav class="g-toc" aria-label="목차"><b>이 글의 목차</b><ol>${g.toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : ''}
<div class="g-cta"><b>${esc(SERVICE_LABEL[svc] || '논문AI')}</b><p>${svc.startsWith('/tools/') ? '읽은 내용을 무료 도구로 바로 적용해 보세요. 회원가입 없이 쓸 수 있어요.' : '읽은 내용을 바로 적용해 보세요. 혼자 하기 어려운 단계만 골라 맡기셔도 돼요.'}</p><a class="btn btn-primary" href="${T.u(svc)}">자세히 보기</a></div>
</aside></div></div>
${faq.length ? faqBlock(T, faq, { title: '자주 묻는 질문', id: 'gfaq' }) : ''}
<section class="sec-tight"><div class="wrap"><h2 class="h-3" style="margin-bottom:16px">함께 읽으면 좋은 글</h2><div class="related">${[...related, ...more].map(card).join('')}</div></div></section>
${ctaBand(T, { title: '내 주제로 바로 설계해 보기', text: '주제 한 줄이면 연구모형, 가설, 목차, 표본 수를 무료로 확인해 보실 수 있어요.', topic: 'free' })}`,
    });
  }
  return pages;
}
