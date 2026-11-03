// '내 논문 작성 미리보기': 적은 주제로 목차와 서론이 써지다가, 나머지는 모자이크로 가려지고 결제 후 완성 안내가 뜬다
import { buildPreview } from '../core/preview.js';
import { esc } from './dom.js';

const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const AUTHORS = ['김지현 외', 'Lee et al.', '박서윤', 'Choi & Kim', '정민호 외', 'Park et al.', '이수진', 'Kang et al.'];
const IC = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>',
};

const STEPS = ['주제 분석', '실존 문헌 검증', '목차 설계', '본문 작성'];

function citeHtml(year, i, live = false) {
  return `<cite class="pv-cite${live ? ' is-pop' : ''}" title="실존 확인된 문헌(결제 후 공개)"><span class="pv-cite-a">${esc(AUTHORS[i % AUTHORS.length])}</span>, ${year}<i>${IC.check}</i></cite>`;
}
const sentenceHtml = (s, base = 0) => s.map((x, j) => (x.t != null ? esc(x.t) : citeHtml(x.cite, base + j))).join('');

function tocHtml(pv) {
  const p = pv.pages;
  const at = [1, Math.round(p * 0.12) || 3, Math.round(p * 0.36) || 6, Math.round(p * 0.52) || 8, Math.round(p * 0.78) || 10, Math.round(p * 0.92) || 12];
  return pv.toc.map(([ch, secs], i) => `<li class="pv-toc-i"><span class="pv-toc-c">${esc(ch)}</span><span class="pv-toc-dots" aria-hidden="true"></span><span class="pv-toc-p">${at[i] || ''}</span>${secs.length ? `<span class="pv-toc-s">${secs.slice(0, 3).map((x, k) => `${k + 1}. ${esc(x)}`).join('<br>')}</span>` : ''}</li>`).join('');
}

export function mountPreview(host, { label = '내 논문 작성 미리보기', cta = null } = {}) {
  host.innerHTML = `<div class="pv" data-state="idle">
<div class="pv-top"><span class="pv-live"><i aria-hidden="true"></i><span>${esc(label)}</span></span><span class="pv-meta" data-pv="meta">주제를 적으면 바로 시작합니다</span></div>
<ol class="pv-steps" aria-label="작성 단계">${STEPS.map((s, i) => `<li data-s="${i}"><i aria-hidden="true">${IC.check}</i>${s}</li>`).join('')}</ol>
<div class="pv-stage" data-pv="stage"><div class="pv-sheet" data-pv="sheet"></div></div>
<div class="pv-verify"><span class="pv-v-ic">${IC.shield}</span><span class="pv-v-t"><b>참고문헌 실존 검증</b><small>DOI·KCI·RISS 원문과 한 편씩 대조</small></span><b class="pv-v-n num" data-pv="n">0/0</b><span class="pv-v-bar" aria-hidden="true"><i data-pv="bar"></i></span></div>
</div>`;
  const root = host.firstElementChild;
  const $ = (k) => root.querySelector(`[data-pv="${k}"]`);
  const stage = $('stage');
  const sheet = $('sheet');
  let run = 0;
  let last = '';

  const setStep = (i, st) => {
    const li = root.querySelector(`.pv-steps li[data-s="${i}"]`);
    if (li) { li.classList.remove('is-run', 'is-done'); if (st) li.classList.add(`is-${st}`); }
  };
  const count = (n, ms, id) => new Promise((res) => {
    const t0 = performance.now();
    const tick = (t) => {
      if (id !== run) return res();
      const k = Math.min(1, (t - t0) / ms);
      $('n').textContent = `${Math.round(n * k)}/${n}`;
      $('bar').style.width = `${Math.round(k * 100)}%`;
      if (k < 1) requestAnimationFrame(tick); else res();
    };
    requestAnimationFrame(tick);
  });
  const follow = () => { stage.scrollTop = stage.scrollHeight; };

  function idle() {
    root.dataset.state = 'idle';
    $('meta').textContent = '주제를 적으면 바로 시작합니다';
    for (let i = 0; i < STEPS.length; i++) setStep(i, '');
    $('n').textContent = '0/0';
    $('bar').style.width = '0%';
    sheet.innerHTML = `<div class="pv-empty"><p class="pv-empty-t">관심 주제나 키워드를 적으면<br>논문AI가 여기에서 바로 쓰기 시작합니다</p><div class="pv-sk" aria-hidden="true"><i style="width:46%"></i><i style="width:92%"></i><i style="width:98%"></i><i style="width:88%"></i><i style="width:95%"></i><i style="width:60%"></i></div></div>`;
    stage.scrollTop = 0;
  }

  async function play(info) {
    const id = ++run;
    const alive = () => id === run;
    const pv = buildPreview(info);
    const remain = Math.max(1, pv.pages - 2);
    root.dataset.state = 'run';
    $('meta').textContent = [pv.typeLabel, pv.field, `${pv.pages}쪽`].filter(Boolean).join(' · ');
    const visible = pv.intro.slice(0, 2);
    const hidden = pv.intro.slice(2);
    sheet.innerHTML = `<p class="pv-kick">${esc(pv.typeLabel)} · 본문 ${pv.pages}쪽 · APA 7판</p>
<div class="pv-ttl"><span class="pv-ttl-t">${esc(pv.workTitle)}</span><em>제목은 연구진이 다듬어 확정합니다</em></div>
<p class="pv-toc-h">목차</p><ol class="pv-toc">${tocHtml(pv)}</ol>
<p class="pv-ch">${esc(pv.toc[0][0])}</p><p class="pv-sec">${pv.toc[0][1].length ? `1. ${esc(pv.toc[0][1][0])}` : '연구의 필요성'}</p>
<p class="pv-txt"><span data-pv="typed"></span><span class="pv-caret" aria-hidden="true"></span></p>
<div class="pv-lockzone" data-pv="zone"><div class="pv-mosaic"><div class="pv-mz-in">
<p class="pv-txt">${hidden.map((s, i) => sentenceHtml(s, 2 + i)).join('')}</p>
<p class="pv-sec">2. ${esc(pv.toc[0][1][1] || '연구 목적')}</p><p class="pv-txt">${pv.purpose.map((s) => sentenceHtml(s)).join('')}</p>
<p class="pv-ch">${esc((pv.toc[1] || ['제2장 이론적 배경'])[0])}</p><p class="pv-sec">1. ${esc(((pv.toc[1] || [0, []])[1] || [])[0] || '주요 개념')}</p><p class="pv-txt">${pv.theory.map((s, i) => sentenceHtml(s, 4 + i)).join('')}</p>
</div></div>
<div class="pv-lock"><span class="pv-lock-ic">${IC.lock}</span><b>나머지 ${remain}쪽은 결제 후 완성됩니다</b><small>실존 참고문헌 ${pv.refs}편 · 석·박사 연구진 검수 · 메일로 전달</small>${cta ? `<a class="btn btn-primary btn-sm pv-lock-go" href="${esc(cta.href)}">${esc(cta.label)}</a>` : ''}</div></div>`;
    const typed = $('typed');
    const zone = $('zone');
    if (reduce) {
      for (let i = 0; i < STEPS.length; i++) setStep(i, 'done');
      typed.innerHTML = visible.map((s, i) => sentenceHtml(s, i)).join('');
      $('n').textContent = `${pv.refs}/${pv.refs}`; $('bar').style.width = '100%';
      sheet.classList.add('is-toc-in'); zone.classList.add('is-on', 'is-locked');
      root.dataset.state = 'done';
      return;
    }
    for (let i = 0; i < STEPS.length; i++) setStep(i, '');
    $('n').textContent = `0/${pv.refs}`; $('bar').style.width = '0%';
    stage.scrollTop = 0;
    setStep(0, 'run'); await wait(380); if (!alive()) return; setStep(0, 'done');
    setStep(1, 'run'); await count(pv.refs, 900, id); if (!alive()) return; setStep(1, 'done');
    setStep(2, 'run'); sheet.classList.add('is-toc-in'); await wait(650); if (!alive()) return; setStep(2, 'done');
    setStep(3, 'run');
    // 서론 첫 두 문장을 한 글자씩 쓰고, 인용 자리에는 실존 확인 표시가 붙는다
    let html = '';
    let n = 0;
    for (const [si, s] of visible.entries()) {
      for (const [j, part] of s.entries()) {
        if (part.t != null) {
          for (const ch of part.t) {
            if (!alive()) return;
            html += esc(ch);
            typed.innerHTML = html;
            if (++n % 6 === 0) follow();
            await wait(ch === ' ' ? 22 : ch === ',' || ch === '.' ? 120 : 15 + Math.random() * 14);
          }
        } else {
          html += citeHtml(part.cite, si * 2 + j, true);
          typed.innerHTML = html;
          await wait(260);
        }
      }
    }
    if (!alive()) return;
    // 이어지는 문단은 써지는 듯 나타났다가 모자이크로 가려진다
    zone.classList.add('is-on');
    follow();
    await wait(700); if (!alive()) return;
    zone.classList.add('is-locked');
    await wait(500); if (!alive()) return;
    stage.scrollTo({ top: Math.max(0, zone.offsetTop - 140), behavior: 'smooth' });
    setStep(3, 'done');
    root.dataset.state = 'done';
  }

  return {
    // info: { typeId, task, major, fieldLabel, population, keywords, pages }
    update(info) {
      const ks = (info && info.keywords) || [];
      if (!ks.length) { run++; last = ''; idle(); return; }
      const key = JSON.stringify([info.typeId, info.task, info.major, info.fieldLabel, info.population, ks, info.pages]);
      if (key === last) return;
      last = key;
      play(info);
    },
    stop() { run++; },
  };
}
