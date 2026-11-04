// '내 논문 작성 미리보기': 적은 주제로 목차와 서론이 써지다가, 나머지는 모자이크로 가려지고 결제 후 완성 안내가 뜬다
import { buildPreview } from '../core/preview.js';
import { esc } from './dom.js';

const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const AUTHORS = ['김지현 외', 'Lee et al.', '박서윤', 'Choi & Kim', '정민호 외', 'Park et al.', '이수진', 'Kang et al.'];
const IC = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>',
  // 실존 검증 배지(파란 인증 마크)
  seal: '<svg viewBox="0 0 40 40" aria-hidden="true"><polygon points="20.00,1.80 23.99,5.12 29.10,4.24 30.89,9.11 35.76,10.90 34.88,16.01 38.20,20.00 34.88,23.99 35.76,29.10 30.89,30.89 29.10,35.76 23.99,34.88 20.00,38.20 16.01,34.88 10.90,35.76 9.11,30.89 4.24,29.10 5.12,23.99 1.80,20.00 5.12,16.01 4.24,10.90 9.11,9.11 10.90,4.24 16.01,5.12" fill="currentColor" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M13.2 20.4l4.6 4.6 9-9.4" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const STEPS = ['주제 분석', '실존 문헌 검증', '목차 설계', '본문 작성'];

function citeHtml(year, i, live = false) {
  return `<cite class="pv-cite${live ? ' is-pop' : ''}" title="실존 확인된 문헌(결제 후 공개)"><span class="pv-cite-a">${esc(AUTHORS[i % AUTHORS.length])}</span>, ${year}<i>${IC.check}</i></cite>`;
}

function tocHtml(pv) {
  const p = pv.pages;
  const at = [1, Math.round(p * 0.12) || 3, Math.round(p * 0.36) || 6, Math.round(p * 0.52) || 8, Math.round(p * 0.78) || 10, Math.round(p * 0.92) || 12];
  return pv.toc.map(([ch, secs], i) => `<li class="pv-toc-i"><span class="pv-toc-c">${esc(ch)}</span><span class="pv-toc-dots" aria-hidden="true"></span><span class="pv-toc-p">${at[i] || ''}</span>${secs.length ? `<span class="pv-toc-s">${secs.slice(0, 3).map((x, k) => `${k + 1}. ${esc(x)}`).join('<br>')}</span>` : ''}</li>`).join('');
}

export function mountPreview(host, { label = '내 논문 작성 미리보기', cta = null } = {}) {
  host.innerHTML = `<div class="pv" data-state="idle">
<div class="pv-top"><span class="pv-live"><i aria-hidden="true"></i><span>${esc(label)}</span></span><span class="pv-meta" data-pv="meta">주제를 적으면 바로 시작해요</span></div>
<ol class="pv-steps" aria-label="작성 단계">${STEPS.map((s, i) => `<li data-s="${i}"><i aria-hidden="true">${IC.check}</i>${s}</li>`).join('')}</ol>
<div class="pv-stage" data-pv="stage"><div class="pv-sheet" data-pv="sheet"></div></div>
<div class="pv-verify"><span class="pv-v-ic">${IC.seal}</span><span class="pv-v-t"><b>참고문헌 실존 검증</b><small>DOI·KCI·RISS 원문과 한 편씩 대조</small></span><b class="pv-v-n num" data-pv="n">0/0</b><span class="pv-v-bar" aria-hidden="true"><i data-pv="bar"></i></span></div>
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

  function idle() {
    root.dataset.state = 'idle';
    $('meta').textContent = '주제를 적으면 바로 시작해요';
    for (let i = 0; i < STEPS.length; i++) setStep(i, '');
    $('n').textContent = '0/0';
    $('bar').style.width = '0%';
    sheet.innerHTML = `<div class="pv-empty"><p class="pv-empty-t">관심 주제나 키워드를 적으면<br>논문AI가 여기에서 바로 쓰기 시작해요</p><div class="pv-sk" aria-hidden="true"><i style="width:46%"></i><i style="width:92%"></i><i style="width:98%"></i><i style="width:88%"></i><i style="width:95%"></i><i style="width:60%"></i></div></div>`;
    stage.scrollTop = 0;
  }

  async function play(info) {
    const id = ++run;
    const alive = () => id === run;
    const pv = buildPreview(info);
    const remain = Math.max(1, pv.pages - 2);
    root.dataset.state = 'run';
    $('meta').textContent = [pv.typeLabel, pv.field, `${pv.pages} Page`].filter(Boolean).join(' · ');
    // 인용 번호: 문단을 넘어 이어서 센다(저자 표시가 문장마다 달라지게)
    let ci = 0;
    const partsHtml = (parts) => parts.map((x) => (x.t != null ? esc(x.t) : citeHtml(x.cite, ci++))).join('');
    sheet.innerHTML = `<p class="pv-kick">${esc(pv.typeLabel)} · 본문 ${pv.pages} Page · APA 7판</p>
<div class="pv-ttl"><span class="pv-ttl-t">${esc(pv.workTitle)}</span><em>제목은 전문가가 다듬어 확정해 드려요</em></div>
<p class="pv-toc-h">목차</p><ol class="pv-toc">${tocHtml(pv)}</ol>
<p class="pv-ch">${esc(pv.toc[0][0])}</p><p class="pv-sec">${pv.toc[0][1].length ? `1. ${esc(pv.toc[0][1][0])}` : '연구의 필요성'}</p>
<div class="pv-flow" data-pv="flow"></div>
<div class="pv-lockzone" data-pv="zone"><div class="pv-mosaic"><div class="pv-mz-in">
<p class="pv-txt pv-cont">${partsHtml(pv.needRest)}</p>
<p class="pv-sec">2. ${esc(pv.toc[0][1][1] || '연구 목적')}</p><p class="pv-txt">${pv.purpose.map(partsHtml).join('')}</p>
<p class="pv-ch">${esc((pv.toc[1] || ['제2장 이론적 배경'])[0])}</p><p class="pv-sec">1. ${esc(((pv.toc[1] || [0, []])[1] || [])[0] || '주요 개념')}</p><p class="pv-txt">${pv.theory.map(partsHtml).join('')}</p>
</div></div>
<div class="pv-lock"><span class="pv-lock-ic">${IC.lock}</span><b>결제하시면 나머지 ${remain} Page를 완성해 드려요</b><small>실존 참고문헌 ${pv.refs}편 · 전공 분야 전문가 최종 검수 후 메일로 전달</small>${cta ? `<a class="btn btn-primary btn-sm pv-lock-go" href="${esc(cta.href)}">${esc(cta.label)}</a>` : ''}</div></div>`;
    const flow = $('flow');
    const zone = $('zone');
    // 화면 안 위치(지면 스크롤 칸 기준)
    const topIn = (el) => { let y = 0; for (let n = el; n && n !== stage; n = n.offsetParent) y += n.offsetTop; return y; };
    const scrollTo = (top, smooth = true) => {
      const y = Math.max(0, Math.round(top));
      if (Math.abs(stage.scrollTop - y) < 2) return;
      stage.scrollTo({ top: y, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    };
    // 끝난 화면: 끊긴 문장 위로 몇 줄을 남기고, 자물쇠 안내 전체가 지면 안에 들어오게
    const lockView = () => {
      const card = zone.querySelector('.pv-lock');
      const room = stage.clientHeight - 10 - (card ? card.offsetTop + card.offsetHeight : 220);
      scrollTo(topIn(zone) - Math.max(56, room));
    };
    if (reduce) {
      for (let i = 0; i < STEPS.length; i++) setStep(i, 'done');
      ci = 0;
      flow.innerHTML = pv.need.map((p) => `<p class="pv-txt">${partsHtml(p)}</p>`).join('');
      $('n').textContent = `${pv.refs}/${pv.refs}`; $('bar').style.width = '100%';
      sheet.classList.add('is-toc-in'); zone.classList.add('is-on', 'is-locked');
      root.dataset.state = 'done';
      lockView();
      return;
    }
    for (let i = 0; i < STEPS.length; i++) setStep(i, '');
    $('n').textContent = `0/${pv.refs}`; $('bar').style.width = '0%';
    stage.scrollTop = 0;
    setStep(0, 'run'); await wait(380); if (!alive()) return; setStep(0, 'done');
    setStep(1, 'run'); await count(pv.refs, 900, id); if (!alive()) return; setStep(1, 'done');
    setStep(2, 'run'); sheet.classList.add('is-toc-in'); await wait(650); if (!alive()) return; setStep(2, 'done');
    setStep(3, 'run');
    // 서론을 2~5글자씩 이어 쓴다. 인용 자리에는 실존 확인 표시가 붙고, 쓰는 줄이 아래에 닿으면 지면을 올린다
    const caret = document.createElement('span');
    caret.className = 'pv-caret';
    caret.setAttribute('aria-hidden', 'true');
    const follow = () => {
      const need = topIn(caret) + caret.offsetHeight - stage.clientHeight * 0.72;
      if (need > stage.scrollTop + 2) scrollTo(need);
    };
    let k = 0;
    for (const para of pv.need) {
      const p = document.createElement('p');
      p.className = 'pv-txt';
      p.append(caret);
      flow.append(p);
      for (const part of para) {
        if (!alive()) return;
        if (part.t == null) {
          caret.insertAdjacentHTML('beforebegin', citeHtml(part.cite, k++, true));
          follow();
          await wait(260);
          continue;
        }
        const node = document.createTextNode('');
        caret.before(node);
        for (let i = 0; i < part.t.length;) {
          if (!alive()) return;
          const n = 3 + Math.floor(Math.random() * 4);
          const chunk = part.t.slice(i, i + n);
          node.data += chunk;
          i += n;
          follow();
          let d = 16 + Math.random() * 12;
          if (/[.?!]\s*$/.test(chunk)) d += 110;
          else if (/,\s*$/.test(chunk)) d += 30;
          await wait(d);
        }
      }
      await wait(180);
    }
    if (!alive()) return;
    // 문장 중간에서 끊기고, 이어지는 원고는 모자이크로 가려진다
    await wait(320); if (!alive()) return;
    zone.classList.add('is-on');
    await wait(140); if (!alive()) return;
    zone.classList.add('is-locked');
    caret.remove();
    lockView();
    await wait(600); if (!alive()) return;
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
