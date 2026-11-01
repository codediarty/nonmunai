// 연구 설계 리포트 HTML (브라우저·빌드 공용, DOM 불필요)
import { renderModelSVG } from '../core/model-svg.js';
import { esc, readLineHtml, factsHtml, tocHtml } from '../core/render.js';
import { tocToText } from '../core/engine.js';

export function ganttHtml(schedule) {
  if (!schedule || !schedule.phases) return '';
  const total = schedule.totalDays || schedule.phases.reduce((a, p) => a + p.days, 0) || 1;
  return `<div class="gantt" role="table" aria-label="연구 일정">${schedule.phases.map((p) => {
    const left = (p.startOffset / total) * 100;
    const width = Math.max(3, (p.days / total) * 100);
    return `<div class="gt-row" role="row"><span class="gt-lab" role="cell">${esc(p.label)}</span><span class="gt-track" role="cell"><i style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></i></span><span class="gt-date" role="cell">${esc(p.start.slice(5))}~${esc(p.end.slice(5))}</span></div>`;
  }).join('')}<div class="gt-foot"><span>${esc(schedule.startDate)}</span><span>${schedule.tight ? '<b class="pen-t">기간이 짧습니다</b>' : `총 ${total}일`}</span><span>${esc(schedule.endDate)}</span></div></div>`;
}

export function designReportHtml(d, { compactModel = false, titleChooser = false, showToc = true, showSchedule = true, heading = '연구 설계 리포트' } = {}) {
  const svg = renderModelSVG(d.model, { compact: compactModel });
  const hyp = d.hypotheses || [];
  const parts = [];
  parts.push(`<header class="rp-hd"><div class="rp-badges"><span class="badge badge-ink">${esc(d.type.label)}</span><span class="badge">${esc(d.field.label)}</span><span class="badge badge-blue">${esc(d.methodLabel || '')}</span></div><p class="rp-kicker">${esc(heading)}</p><h2 class="rp-title">${esc(d.title || '주제 확정 전')}</h2>${d.titleSource === 'suggested' ? '<p class="rp-note">입력하신 키워드로 만든 추천 주제입니다. 아래 후보 중 다른 주제를 고를 수도 있습니다.</p>' : ''}</header>`);
  if (titleChooser && d.titleCandidates && d.titleCandidates.length) {
    parts.push(`<section class="rp-sec"><h3 class="rp-h">추천 주제 후보</h3><ol class="rp-cands">${d.titleCandidates.map((c, i) => `<li><button type="button" class="rp-cand${i === 0 ? ' is-on' : ''}" data-title="${esc(c.title)}"><b>${esc(c.title)}</b><span>${esc(c.why)}</span></button></li>`).join('')}</ol></section>`);
  }
  parts.push(`<section class="rp-sec"><h3 class="rp-h">주제 구조 해석</h3><div class="demo-read">${readLineHtml(d)}</div></section>`);
  if (svg) parts.push(`<section class="rp-sec"><h3 class="rp-h">연구모형</h3><div class="rp-model">${svg}</div></section>`);
  parts.push(`<section class="rp-sec">${factsHtml(d)}</section>`);
  parts.push(`<section class="rp-sec rp-two"><div><h3 class="rp-h">연구 문제</h3><ol class="rp-list">${d.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol></div>${hyp.length ? `<div><h3 class="rp-h">연구 가설</h3><ul class="rp-hyp">${hyp.map((h) => `<li><b>${esc(h.id)}</b><span>${esc(h.text)}</span></li>`).join('')}</ul></div>` : ''}</section>`);
  if (d.instruments && d.instruments.length) {
    parts.push(`<section class="rp-sec"><h3 class="rp-h">측정도구 후보</h3><div class="table-wrap"><table class="rp-table"><thead><tr><th>변인</th><th>역할</th><th>측정도구 후보</th></tr></thead><tbody>${d.instruments.map((i) => `<tr><td><b>${esc(i.name)}</b></td><td>${esc(i.role)}</td><td>${i.candidates.map((c) => `${esc(c.name)} <span class="muted">(${esc(c.ref)})</span>`).join('<br>')}</td></tr>`).join('')}</tbody></table></div><p class="rp-foot">최종 측정도구는 원척도 출처, 사용 허가, 국내 번안·타당화 연구를 확인한 뒤 확정합니다.</p></section>`);
  }
  parts.push(`<section class="rp-sec rp-two"><div><h3 class="rp-h">분석 계획</h3><ol class="rp-list">${d.analysis.map((a) => `<li>${esc(a)}</li>`).join('')}</ol><p class="rp-foot">사용 도구: ${esc((d.tools || []).join(', '))}</p></div><div><h3 class="rp-h">표본 수</h3><p class="rp-sample">${esc(d.sample.text)}</p>${(d.sample.items || []).map((i) => `<p class="rp-foot">${esc(i.label)}: <b>${i.n}명</b>${i.assumptions ? ` · ${esc(i.assumptions)}` : ''}</p>`).join('')}${d.sample.note ? `<p class="rp-foot">${esc(d.sample.note)}</p>` : ''}</div></section>`);
  if (showSchedule) parts.push(`<section class="rp-sec"><h3 class="rp-h">연구 전체 일정</h3>${ganttHtml(d.schedule)}</section>`);
  if (showToc) parts.push(`<section class="rp-sec"><h3 class="rp-h">목차 <span class="muted rp-sub">본문 약 ${d.toc.totalPages}쪽 기준</span></h3><div class="rp-toc">${tocHtml(d.toc, { withSubs: true })}</div></section>`);
  if (d.checks && d.checks.length) parts.push(`<section class="rp-sec"><h3 class="rp-h">미리 확인할 점</h3><ul class="rp-checks">${d.checks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></section>`);
  return `<div class="report">${parts.join('')}</div>`;
}

export function designSnapshot(d) {
  const vars = { iv: [], dv: [], med: [], mod: [] };
  for (const n of d.model.nodes || []) {
    if (n.role === 'iv' || n.role === 'program' || n.role === 'group') vars.iv.push(n.name);
    else if (n.role === 'dv') vars.dv.push(n.name);
    else if (n.role === 'med') vars.med.push(n.name);
    else if (n.role === 'mod') vars.mod.push(n.name);
  }
  return {
    title: d.title, titleSource: d.titleSource, designLabel: d.designLabel, methodLabel: d.methodLabel, population: d.parsed.population,
    sampleText: d.sample.text, vars, hypotheses: (d.hypotheses || []).map((h) => `${h.id}. ${h.text}`), titleCandidates: (d.titleCandidates || []).map((c) => c.title),
  };
}

export { tocToText };
