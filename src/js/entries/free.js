// 무료 논문 설계
import { buildDesign } from '../core/engine.js';
import { designReportHtml } from '../ui/report.js';
import { $, $$, url, debounce } from '../ui/dom.js';

const form = $('#freeForm');
const out = $('#freeOut');
const go = $('#freeGo');
let forcedTitle = '';

function params() {
  const known = form.querySelector('input[name=known]:checked').value;
  return {
    known,
    title: forcedTitle || (known === 'yes' ? $('#fTitle').value.trim() : ''),
    keywords: known === 'no' ? $('#fKw').value.split(/[,，、\n]+/).map((s) => s.trim()).filter(Boolean) : [],
    typeId: $('#fType').value, fieldId: $('#fField').value || 'other', method: $('#fMethod').value, due: $('#fDue').value || null,
  };
}

function render() {
  const p = params();
  const d = buildDesign({ title: p.title, keywords: p.keywords, typeId: p.typeId, fieldId: p.fieldId, method: p.method, due: p.due });
  out.innerHTML = designReportHtml(d, { titleChooser: p.known === 'no' });
  const q = new URLSearchParams({ title: d.title || '', type: p.typeId, field: p.fieldId, method: p.method });
  go.href = `${url('/paper/new/')}?${q.toString()}`;
  for (const b of $$('.rp-cand', out)) {
    b.addEventListener('click', () => {
      forcedTitle = b.dataset.title;
      const d2 = buildDesign({ title: forcedTitle, typeId: p.typeId, fieldId: p.fieldId, method: p.method, due: p.due });
      const cands = d.titleCandidates;
      out.innerHTML = designReportHtml({ ...d2, titleCandidates: cands, titleSource: 'suggested' }, { titleChooser: true });
      for (const x of $$('.rp-cand', out)) x.classList.toggle('is-on', x.dataset.title === forcedTitle);
      go.href = `${url('/paper/new/')}?${new URLSearchParams({ title: forcedTitle, type: p.typeId, field: p.fieldId, method: p.method })}`;
      bindCands(cands, p);
      forcedTitle = '';
    });
  }
}
function bindCands(cands, p) {
  for (const b of $$('.rp-cand', out)) b.addEventListener('click', () => { forcedTitle = b.dataset.title; render(); forcedTitle = ''; });
}

if (form) {
  for (const r of $$('input[name=known]', form)) {
    r.addEventListener('change', () => {
      const v = form.querySelector('input[name=known]:checked').value;
      for (const el of $$('[data-when]', form)) el.hidden = el.dataset.when !== v;
      render();
    });
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); render(); });
  form.addEventListener('input', debounce(render, 300));
  form.addEventListener('change', debounce(render, 50));
}
