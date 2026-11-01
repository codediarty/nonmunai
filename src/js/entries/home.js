// 홈 히어로: 입력한 주제로 연구 설계를 즉시 계산
import { buildDesign } from '../core/engine.js';
import { renderModelSVG } from '../core/model-svg.js';
import { readLineHtml, factsHtml, tocHtml } from '../core/render.js';
import { $, $$, debounce, url } from '../ui/dom.js';

const box = $('#heroDemo');
if (box) {
  const input = $('#demoTitle', box);
  const model = $('#demoModel', box);
  const read = $('#demoRead', box);
  const facts = $('#demoFacts', box);
  const toc = $('#demoToc', box);
  const go = $('#demoGo', box);
  let last = '';
  const run = (animate) => {
    const title = input.value.trim();
    if (title === last) return;
    last = title;
    if (title.length < 4) {
      read.innerHTML = '<span><em>안내</em>주제를 조금 더 적어 주세요</span>';
      return;
    }
    const d = buildDesign({ title, typeId: 'master' });
    read.innerHTML = readLineHtml(d);
    const svg = renderModelSVG(d.model, { compact: true });
    model.innerHTML = svg || `<div class="demo-noq">${d.methodLabel} 주제입니다. 연구모형 대신 연구 질문과 절차로 설계합니다.<br><b>${d.questions[0] || ''}</b></div>`;
    model.classList.toggle('model-draw', !!animate);
    if (animate) { void model.offsetWidth; }
    facts.innerHTML = factsHtml(d);
    toc.innerHTML = tocHtml(d.toc, { limit: 9 });
    go.href = `${url('/paper/new/')}?title=${encodeURIComponent(title)}`;
  };
  input.addEventListener('input', debounce(() => run(false), 220));
  for (const c of $$('[data-example]', box)) {
    c.addEventListener('click', () => { input.value = c.dataset.example; run(true); });
  }
  // 첫 화면: 연구모형이 그려지는 한 번의 동작
  model.classList.add('model-draw');
  last = input.value.trim();
}
