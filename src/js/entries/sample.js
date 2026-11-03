// 표본 수 계산기
import { nRegression, nTTest, nPairedT, nAnova, nCorrelation, nChiSquare, nProportion, withDropout } from '../core/stats.js';
import { $, $$, toast } from '../ui/dom.js';

const ES = {
  reg: { label: '효과크기 f²', opts: [['0.02', '작은 효과 (.02)'], ['0.15', '중간 효과 (.15)'], ['0.35', '큰 효과 (.35)']], def: '0.15', k: '예측변수 수', kDef: 5 },
  t: { label: '효과크기 d', opts: [['0.2', '작은 효과 (.20)'], ['0.5', '중간 효과 (.50)'], ['0.8', '큰 효과 (.80)']], def: '0.5' },
  paired: { label: '효과크기 dz', opts: [['0.2', '작은 효과 (.20)'], ['0.5', '중간 효과 (.50)'], ['0.8', '큰 효과 (.80)']], def: '0.5' },
  anova: { label: '효과크기 f', opts: [['0.1', '작은 효과 (.10)'], ['0.25', '중간 효과 (.25)'], ['0.4', '큰 효과 (.40)']], def: '0.25', k: '집단 수', kDef: 3 },
  corr: { label: '상관계수 r', opts: [['0.1', '작은 효과 (.10)'], ['0.3', '중간 효과 (.30)'], ['0.5', '큰 효과 (.50)']], def: '0.3' },
  chi: { label: '효과크기 w', opts: [['0.1', '작은 효과 (.10)'], ['0.3', '중간 효과 (.30)'], ['0.5', '큰 효과 (.50)']], def: '0.3', k: '자유도', kDef: 1 },
  prop: {},
};
const NAMES = { reg: '다중회귀분석', t: '독립표본 t검정', paired: '대응표본 t검정', anova: '일원분산분석', corr: '상관분석', chi: '카이제곱 검정', prop: '비율 추정 조사' };

function setTest() {
  const t = $('#ssTest').value;
  const cfg = ES[t];
  for (const el of $$('[data-ss]')) {
    const key = el.dataset.ss;
    el.hidden = t === 'prop' ? !['e', 'pop'].includes(key) : key === 'e' || key === 'pop' || (key === 'k' && !cfg.k);
  }
  if (cfg.opts) {
    $('#ssEs').innerHTML = cfg.opts.map(([v, l]) => `<option value="${v}"${v === cfg.def ? ' selected' : ''}>${l}</option>`).join('');
    $('#ssEs').previousElementSibling.textContent = cfg.label;
  }
  if (cfg.k) { $('#ssKLabel').textContent = cfg.k; $('#ssK').value = cfg.kDef; }
  calc();
}

function calc() {
  const t = $('#ssTest').value;
  const es = Number($('#ssEs').value);
  const alpha = Number($('#ssAlpha').value), power = Number($('#ssPower').value);
  const k = Math.max(1, Math.min(30, Number($('#ssK').value) || 1));
  const drop = Number($('#ssDrop').value);
  let r;
  if (t === 'reg') r = nRegression({ f2: es, predictors: k, alpha, power });
  else if (t === 't') r = nTTest({ d: es, alpha, power });
  else if (t === 'paired') r = nPairedT({ dz: es, alpha, power });
  else if (t === 'anova') r = nAnova({ f: es, groups: Math.max(2, k), alpha, power });
  else if (t === 'corr') r = nCorrelation({ r: es, alpha, power });
  else if (t === 'chi') r = nChiSquare({ w: es, df: k, alpha, power });
  else r = nProportion({ e: Number($('#ssE').value), confidence: 0.95, population: Number($('#ssPop').value) || null });
  const n = r.n;
  const recruit = drop ? withDropout(n, drop) : n;
  $('#ssMethod').textContent = r.method;
  $('#ssN').textContent = n.toLocaleString('ko-KR');
  $('#ssRecruit').textContent = `${recruit.toLocaleString('ko-KR')}명${r.perGroup ? ` (집단당 ${Math.ceil(recruit / (r.n / r.perGroup)).toLocaleString('ko-KR')}명)` : ''}`;
  $('#ssAssume').textContent = r.assumptions + (r.perGroup ? ` · 집단당 최소 ${r.perGroup}명` : '');
  const per = r.perGroup ? `(집단당 ${r.perGroup}명) ` : '';
  const dropTxt = drop ? `, 탈락률 ${Math.round(drop * 100)}%를 고려하여 ${recruit}명을 모집하였다` : '';
  $('#ssSentence').textContent = t === 'prop'
    ? `${r.assumptions}을(를) 기준으로 산출한 표본 수는 ${n}명이며${dropTxt ? dropTxt.replace(/^,/, '') : ', 이를 충족하도록 자료를 수집하였다'}.`
    : `${NAMES[t]}을 위한 표본 수는 ${r.assumptions.replace(/, /g, ', ')}를 기준으로 산출하였으며, 최소 표본 수는 ${n}명${per}으로 나타났다${dropTxt}.`;
}

if ($('#ssForm')) {
  $('#ssTest').addEventListener('change', setTest);
  $('#ssForm').addEventListener('input', calc);
  $('#ssForm').addEventListener('change', (e) => { if (e.target.id !== 'ssTest') calc(); });
  $('#ssCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#ssSentence').textContent); toast('문장을 복사했어요.'); } catch { toast('복사하지 못했어요.', { error: true }); }
  });
  setTest();
}
