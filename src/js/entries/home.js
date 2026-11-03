// 홈: 프롬프트 한 줄 → 논문이 써지다가 모자이크로 가려지는 작성 화면, 분량별 요금 계산
import { readPrompt, TYPE_LABEL } from '../core/preview.js';
import { $, $$, url, esc, debounce } from '../ui/dom.js';
import { initTiers } from '../app/tiers.js';
import { keystrokes, createIme } from '../ui/hangul-typing.js';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 프롬프트에서 읽은 내용 칩(서버에서 그린 것과 같은 모양)
function chipsHtml(text) {
  const r = readPrompt(text);
  const chips = [];
  if (r.typeId) chips.push(TYPE_LABEL[r.typeId]);
  if (r.pages) chips.push(`${r.pages}쪽`);
  if (r.major) chips.push(r.major);
  for (const k of r.keywords) chips.push(`#${k}`);
  return chips.map((c) => `<span class="hx-chip">${esc(c)}</span>`).join('');
}

/* ------------------------------------------------------------ 히어로 작성 화면 */
const win = $('#hxWin');
if (win) {
  const form = $('#hxPrompt', win);
  const text = $('#hxText', win);
  const send = $('.hx-send', win);
  const stepsEl = $('#hxSteps', win);
  const doc = $('#hxDoc', win);
  const page = $('#hxPage', win);
  const refList = $('#hxRefList', win);
  const verifyN = $('#hxVerifyN', win);
  const meter = $('.hx-meter i', win);
  const ghost = $('#hxGhost', win);
  const read = $('#hxRead', win);
  const chips = $('#hxChips', win);
  const lock = $('#hxLock', win);
  const moreBar = $('#hxMore', win);
  // 모자이크와 자물쇠 안내가 아래쪽 결제 막대에 가리지 않도록 지면을 올릴 거리
  const liftBy = () => Math.max(0, lock.offsetTop - Math.max(36, doc.clientHeight - (moreBar ? moreBar.offsetHeight : 80) - 196));
  const promptText = text.value;
  let typing = null;
  let cycleTimer = null;
  let cycleIdx = 0;
  let paused = false;
  let demo = true;

  const setChips = (t) => {
    const h = chipsHtml(t);
    chips.innerHTML = h;
    read.classList.toggle('is-empty', !h);
  };

  // 본문 인용과 참고문헌을 함께 밝힌다
  const activate = (id) => {
    for (const c of $$('.hx-cite', page)) c.classList.toggle('is-active', c.dataset.ref === id);
    for (const li of $$('li[data-ref]', refList)) li.classList.toggle('is-active', li.dataset.ref === id);
  };
  const stopCycle = () => { clearInterval(cycleTimer); cycleTimer = null; };
  const startCycle = () => {
    stopCycle();
    if (reduce) return;
    const order = ['r1', 'r2', 'r4', 'r3'];
    const step = () => { if (!paused) activate(order[cycleIdx++ % order.length]); };
    step();
    cycleTimer = setInterval(step, 2600);
  };
  const pick = (e) => {
    const el = e.target.closest('[data-ref]');
    if (el) activate(el.dataset.ref);
  };
  for (const box of [doc, refList]) {
    box.addEventListener('mouseenter', () => { paused = true; });
    box.addEventListener('mouseleave', () => { paused = false; });
    box.addEventListener('mouseover', pick);
    box.addEventListener('focusin', pick);
    box.addEventListener('click', pick);
  }

  const setStep = (i, state) => {
    const li = $(`li[data-step="${i}"]`, stepsEl);
    if (!li) return;
    li.classList.remove('is-run', 'is-done', 'is-wait');
    if (state) li.classList.add(`is-${state}`);
  };
  const reveal = (els) => els.forEach((el) => el.classList.add('is-in'));
  const countTo = (n, ms) => new Promise((res) => {
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      verifyN.textContent = `${Math.round(n * k)}/${n}`;
      if (k < 1) requestAnimationFrame(tick); else res();
    };
    requestAnimationFrame(tick);
  });

  // 프롬프트 입력 연출: 두벌식으로 칠 때처럼 자모가 조합되며 글자가 써진다(칸을 누르면 바로 멈춤)
  const escT = (t) => esc(t).replace(/\n/g, '<br>');
  const paint = (done, comp, ph = false) => {
    ghost.innerHTML = ph
      ? '<span class="hx-caret"></span><span class="hx-ph">관심 주제나 키워드를 편하게 적어 주세요</span>'
      : `${escT(done)}${comp ? `<u>${escT(comp)}</u>` : ''}<span class="hx-caret"></span>`;
  };
  const endTyping = () => {
    if (typing) { typing.stopped = true; typing = null; }
    if (!form.classList.contains('is-typing')) return;
    form.classList.remove('is-typing', 'is-keying');
    text.value = promptText;
    setChips(text.value);
  };
  const typePrompt = async () => {
    const run = { stopped: false };
    typing = run;
    const ime = createIme();
    form.classList.add('is-keying');
    for (const k of keystrokes(promptText)) {
      if (run.stopped) return false;
      const st = ime.key(k);
      paint(st.done, st.comp);
      let d = 30 + Math.random() * 34;
      if (k === ' ') d += 50 + Math.random() * 90;
      if (k === ',' || k === '.') d += 200 + Math.random() * 120;
      await wait(d);
    }
    if (run.stopped) return false;
    paint(ime.end(), '');
    form.classList.remove('is-keying');
    await wait(420);
    return !run.stopped;
  };
  // 보내기 전 상태: 빈 프롬프트 칸에 깜박이는 커서, 빈 지면, 읽은 내용 칩은 비움
  const prime = () => {
    win.classList.add('is-anim', 'is-idle');
    meter.style.width = '0%';
    verifyN.textContent = '0/42';
    form.classList.add('is-typing');
    chips.innerHTML = '';
    read.classList.add('is-empty');
    paint('', '', true);
  };

  // 첫 화면 연출: 프롬프트를 치면 AI가 내용을 읽고, 문헌을 검증하고, 서론이 써진 뒤 나머지는 모자이크로 가려진다
  const alive = () => demo;
  const playDemo = async () => {
    if (reduce) {
      lock.classList.add('is-on', 'is-locked');
      page.style.transform = `translateY(-${liftBy()}px)`;
      startCycle();
      return;
    }
    const blk = (sel, root = page) => $$(sel, root);
    await wait(650);
    if (!alive()) return;
    const typed = form.classList.contains('is-typing') ? await typePrompt() : false;
    if (!alive()) return;
    if (typed) {
      setChips(promptText);
      await wait(520);
      send.classList.add('is-press');
      await wait(130);
      send.classList.remove('is-press');
    }
    endTyping();
    form.classList.add('is-sent');
    setTimeout(() => form.classList.remove('is-sent'), 900);
    win.classList.remove('is-idle');
    send.classList.add('is-pulse');
    setStep(0, 'run'); await wait(650); if (!alive()) return; setStep(0, 'done');
    setStep(1, 'run');
    const refs = blk('li[data-ref]', refList);
    meter.style.width = '100%';
    const counting = countTo(42, 1300);
    for (const li of refs) { reveal([li]); await wait(220); if (!alive()) return; li.classList.add('is-ok'); }
    await counting;
    if (!alive()) return;
    setStep(1, 'done');
    setStep(2, 'run'); reveal(blk('.hx-meta, .hx-ttl')); await wait(420); if (!alive()) return; reveal(blk('.hx-ch, .hx-sec').filter((el) => !lock.contains(el))); await wait(300); if (!alive()) return; setStep(2, 'done');
    setStep(3, 'run'); reveal(blk('.hx-p')); await wait(1700); if (!alive()) return; setStep(3, 'done');
    setStep(4, 'run');
    for (const c of $$('.hx-cite', page)) { c.classList.add('is-lit'); activate(c.dataset.ref); await wait(330); if (!alive()) return; }
    setStep(4, 'done');
    // 이어지는 문단이 나타났다가 모자이크로 가려지고, 결제 후 완성 안내가 뜬다
    lock.classList.add('is-on');
    await wait(500); if (!alive()) return;
    // 지면을 위로 밀어 올린다(아래쪽 결제 안내 막대는 그대로 두기 위해 스크롤 대신 이동)
    const lift = liftBy();
    page.style.transition = 'transform .9s cubic-bezier(.3, .7, .2, 1)';
    page.style.transform = `translateY(-${lift}px)`;
    await wait(800); if (!alive()) return;
    lock.classList.add('is-locked');
    await wait(700); if (!alive()) return;
    win.classList.add('is-ready');
    startCycle();
  };

  // 보내기: 적은 내용 그대로 주문서로(내 논문 미리보기가 거기서 바로 써진다)
  const goOrder = () => {
    endTyping();
    const raw = text.value.trim();
    if (raw.length < 2) {
      text.focus();
      win.classList.add('is-warn'); setTimeout(() => win.classList.remove('is-warn'), 900);
      return;
    }
    location.href = `${url('/paper/new/')}?${new URLSearchParams({ prompt: raw.slice(0, 200) })}`;
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); goOrder(); });
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); goOrder(); } });
  text.addEventListener('focus', () => { paused = true; endTyping(); });
  text.addEventListener('blur', () => { paused = false; });
  text.addEventListener('input', debounce(() => setChips(text.value), 250));

  // 왼쪽 버튼: 프롬프트 칸으로 바로 이동
  for (const a of $$('[data-focus-prompt]')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      paused = true;
      const r = win.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight) win.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      endTyping();
      text.focus({ preventScroll: true });
      text.select();
    });
  }

  // 작성 화면이 화면에 들어올 때 연출을 시작한다(모바일에서 아래에 있어도 놓치지 않게)
  if (reduce) playDemo();
  else {
    prime();
    let started = false;
    const go = () => { if (!started) { started = true; playDemo(); } };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { threshold: 0.3 });
      io.observe(win);
    } else go();
  }
}

/* ------------------------------------------------------------ 분량별 요금 */
initTiers({});
