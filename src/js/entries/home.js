// 홈: 프롬프트 한 줄 → 논문이 써지다가 모자이크로 가려지는 작성 화면, 논문 완성 가격 카드
import { readPrompt, TYPE_LABEL, DEMO_PROMPTS } from '../core/preview.js';
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
  if (r.pages) chips.push(`${r.pages} Page`);
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
  const scroller = $('#hxScroll', win);
  const page = $('#hxPage', win);
  const flow = $('#hxFlow', win);
  const refList = $('#hxRefList', win);
  const verifyN = $('#hxVerifyN', win);
  const meter = $('.hx-meter i', win);
  const ghost = $('#hxGhost', win);
  const read = $('#hxRead', win);
  const chips = $('#hxChips', win);
  const lock = $('#hxLock', win);
  const moreBar = $('#hxMore', win);
  const promptText = text.value;
  let typing = null;
  let cycleTimer = null;
  let cycleIdx = 0;
  let paused = false;
  let demo = true;

  // 서론 문단: 글자 조각과 인용 요소로 나눠 두었다가 화면에서 한 덩어리씩 다시 써 내려간다
  const paras = $$('.hx-p', flow).map((p) => ({ p, parts: [...p.childNodes].map((n) => (n.nodeType === 3 ? { t: n.textContent } : { el: n })) }));
  const wcaret = document.createElement('span');
  wcaret.className = 'hx-wcaret';
  wcaret.setAttribute('aria-hidden', 'true');

  // 지면 이동: 쓰는 동안은 지면을 위로 밀어 올리고(transform), 다 쓰면 실제 스크롤로 바꿔 직접 읽어 볼 수 있게 한다
  const topIn = (el) => { let y = 0; for (let n = el; n && n !== scroller; n = n.offsetParent) y += n.offsetTop; return y; };
  let lift = 0;
  const setLift = (y, ms = 0) => {
    lift = Math.max(0, Math.round(y));
    page.style.transition = ms ? `transform ${ms}ms cubic-bezier(.3, .6, .3, 1)` : 'none';
    page.style.transform = lift ? `translateY(-${lift}px)` : '';
  };
  // 마지막: 모자이크와 자물쇠 안내가 아래쪽 결제 막대에 가리지 않는 높이
  const finalLift = () => Math.max(lift, topIn(lock) - Math.max(36, scroller.clientHeight - (moreBar ? moreBar.offsetHeight : 80) - 176));
  const freeScroll = () => {
    const y = lift;
    setLift(0);
    scroller.scrollTop = y;
    scroller.classList.add('is-free');
  };

  const setChips = (t) => {
    const h = chipsHtml(t);
    chips.innerHTML = h;
    read.classList.toggle('is-empty', !h);
  };

  // 참고문헌 목록에서 해당 문헌이 보이도록 목록만 굴린다(페이지는 움직이지 않음)
  const showRef = (id, smooth = true) => {
    const li = $(`li[data-ref="${id}"]`, refList);
    if (!li || refList.scrollHeight <= refList.clientHeight + 2) return;
    const max = refList.scrollHeight - refList.clientHeight;
    const top = Math.max(0, Math.min(max, li.offsetTop - 6));
    if (Math.abs(refList.scrollTop - top) > 2) refList.scrollTo({ top, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  };
  // 본문 인용과 참고문헌을 함께 밝힌다
  const activate = (id, scrollList = false) => {
    for (const c of $$('.hx-cite', page)) c.classList.toggle('is-active', c.dataset.ref === id);
    for (const li of $$('li[data-ref]', refList)) li.classList.toggle('is-active', li.dataset.ref === id);
    if (scrollList) showRef(id);
  };
  const citeOrder = () => [...new Set($$('.hx-cite', flow).map((c) => c.dataset.ref))];
  const stopCycle = () => { clearInterval(cycleTimer); cycleTimer = null; };
  const startCycle = () => {
    stopCycle();
    if (reduce) return;
    const order = citeOrder();
    if (!order.length) return;
    const step = () => { if (!paused) activate(order[cycleIdx++ % order.length], true); };
    step();
    cycleTimer = setInterval(step, 2600);
  };
  const pickIn = (scrollList) => (e) => {
    const el = e.target.closest('[data-ref]');
    if (el) activate(el.dataset.ref, scrollList);
  };
  for (const [box, scrollList] of [[doc, true], [refList, false]]) {
    const pick = pickIn(scrollList);
    box.addEventListener('mouseenter', () => { paused = true; });
    box.addEventListener('mouseleave', () => { paused = false; });
    box.addEventListener('mouseover', pick);
    box.addEventListener('focusin', pick);
    box.addEventListener('click', pick);
  }
  scroller.addEventListener('touchstart', () => { paused = true; }, { passive: true });

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
    for (const { p } of paras) p.textContent = '';
  };

  // 서론 쓰기: 2~5글자씩 이어 쓰고(문장 끝에서는 잠깐 쉼), 인용이 나오면 참고문헌 목록의 같은 문헌을 밝힌다.
  // 쓰는 줄이 지면 아래쪽에 닿으면 지면을 그만큼 밀어 올린다.
  const alive = () => demo;
  const follow = () => {
    const need = topIn(wcaret) + wcaret.offsetHeight - scroller.clientHeight * 0.7;
    if (need > lift + 1) setLift(need, 380);
  };
  const stream = async () => {
    let cited = false;
    for (const { p, parts } of paras) {
      p.append(wcaret);
      p.classList.add('is-on');
      for (const part of parts) {
        if (part.el) {
          wcaret.before(part.el);
          part.el.classList.add('is-lit', 'is-pop');
          activate(part.el.dataset.ref, true);
          if (!cited) { cited = true; setStep(4, 'run'); }
          follow();
          await wait(260);
          if (!alive()) return false;
          continue;
        }
        const node = document.createTextNode('');
        wcaret.before(node);
        const t = part.t;
        for (let i = 0; i < t.length;) {
          const n = 3 + Math.floor(Math.random() * 4);
          const chunk = t.slice(i, i + n);
          node.data += chunk;
          i += n;
          follow();
          let d = 16 + Math.random() * 12;
          if (/[.?!]\s*$/.test(chunk)) d += 110;
          else if (/,\s*$/.test(chunk)) d += 30;
          await wait(d);
          if (!alive()) return false;
        }
      }
      await wait(200);
    }
    return true;
  };

  // 첫 화면 연출: 프롬프트를 치면 AI가 내용을 읽고, 문헌을 검증하고, 서론을 길게 써 내려가다가
  // 마지막 문단 중간에서 끊기며 나머지는 모자이크로 가려진다
  const playDemo = async () => {
    if (reduce) {
      setStep(5, 'wait');
      lock.classList.add('is-on', 'is-locked');
      setLift(finalLift());
      freeScroll();
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
    const counting = countTo(42, 1400);
    for (const li of refs) { reveal([li]); showRef(li.dataset.ref); await wait(170); if (!alive()) return; li.classList.add('is-ok'); }
    await counting;
    if (!alive()) return;
    if (refs[0]) showRef(refs[0].dataset.ref);
    setStep(1, 'done');
    setStep(2, 'run'); reveal(blk('.hx-meta, .hx-ttl')); await wait(420); if (!alive()) return; reveal(blk('.hx-ch, .hx-sec').filter((el) => !lock.contains(el))); await wait(300); if (!alive()) return; setStep(2, 'done');
    setStep(3, 'run');
    if (!(await stream())) return;
    // 문장 중간에서 끊기고, 이어지는 원고는 모자이크로 가려진다
    await wait(380); if (!alive()) return;
    setStep(3, 'done');
    lock.classList.add('is-on');
    await wait(140); if (!alive()) return;
    lock.classList.add('is-locked');
    setLift(finalLift(), 900);
    await wait(500); if (!alive()) return;
    setStep(4, 'done');
    // 마지막 단계(전공 박사 검수)는 결제 뒤에 사람이 하는 일이라 '대기'로 둔다
    setStep(5, 'wait');
    wcaret.remove();
    await wait(700); if (!alive()) return;
    freeScroll();
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
    // 예시 문장을 그대로 보냈다면 빈 주문서로(예시는 예시일 뿐, 주문서는 내 주제로 채운다)
    location.href = DEMO_PROMPTS.includes(raw) ? url('/paper/new/') : `${url('/paper/new/')}?${new URLSearchParams({ prompt: raw.slice(0, 200) })}`;
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

/* ------------------------------------------------------------ 가격 카드: 운영 가격표로 다시 계산 */
initTiers({});
