// 브라우저·빌드 공용 HTML 조각 (DOM 의존성 없음)
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function readLineHtml(d) {
  const p = d.parsed;
  const parts = [];
  if (p.population) parts.push(`<span><em>대상</em>${esc(p.population)}</span>`);
  if (p.ivs.length) parts.push(`<span><em>${p.design === 'program' ? '처치' : p.design === 'difference' ? '집단' : '원인'}</em>${esc(p.ivs.join(', '))}</span>`);
  if (p.mediators.length) parts.push(`<span><em>매개</em>${esc(p.mediators.join(', '))}</span>`);
  if (p.moderators.length) parts.push(`<span><em>조절</em>${esc(p.moderators.join(', '))}</span>`);
  if (p.dvs.length) parts.push(`<span><em>결과</em>${esc(p.dvs.join(', '))}</span>`);
  if (!parts.length && p.topic) parts.push(`<span><em>주제</em>${esc(p.topic)}</span>`);
  return parts.join('');
}

export function factsHtml(d) {
  const facts = [
    ['연구 유형', d.designLabel],
    ['권장 표본', d.sample.recommended ? `${d.sample.recommended}명` : d.method === 'qualitative' ? '6~12명' : '해당 없음'],
    ['핵심 분석', (d.analysis[d.analysis.length - 1] || '').replace(/\(.*$/, '').replace('PROCESS Macro ', 'PROCESS ')],
  ];
  return `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}

export function tocHtml(toc, { limit = 99, withSubs = false } = {}) {
  const lis = [];
  let page = 1;
  for (const c of toc.chapters) {
    lis.push(`<li class="ch"><span class="t">${esc(c.no)} ${esc(c.title)}</span><span class="lead-dots"></span><span class="pg">${page}</span></li>`);
    let p2 = page;
    for (const s of c.sections) {
      lis.push(`<li class="sec2"><span class="t">${esc(s.no)} ${esc(s.title)}</span><span class="lead-dots"></span><span class="pg">${p2}</span></li>`);
      if (withSubs) for (const sub of s.subs) lis.push(`<li class="sec3"><span class="t">${esc(sub)}</span><span class="lead-dots"></span><span class="pg">${p2}</span></li>`);
      p2 += Math.max(1, Math.round(c.pages / Math.max(1, c.sections.length)));
    }
    page += c.pages;
    if (lis.length >= limit) break;
  }
  return `<ol class="toc">${lis.slice(0, limit).join('')}</ol>`;
}

export function won(n) { return `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`; }
