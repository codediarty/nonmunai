// 홈: 프롬프트 한 줄 → 논문 자동작성 화면, 분량별 요금 계산
import { buildDesign, suggestTitles } from '../core/engine.js';
import { CONSTRUCTS, POPULATIONS, guessField } from '../core/kb.js';
import { computeQuote, DEFAULT_CATALOG } from '../core/pricing.js';
import { tocHtml } from '../core/render.js';
import { $, $$, url, esc } from '../ui/dom.js';
import { initTiers, RANGES } from '../app/tiers.js';

let CATALOG = DEFAULT_CATALOG;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const wonNum = (n) => Math.round(Number(n) || 0).toLocaleString('ko-KR');
const quote = (typeId, pages) => computeQuote(CATALOG, { service: 'paper', paper: { typeId, task: 'full', pages } });
const TYPE_LABEL = { personal: '소논문', bachelor: '학사 졸업논문', journal: '학술지 논문', master: '석사학위논문', doctor: '박사학위논문' };
const orderUrl = (o) => `${url('/paper/new/')}?${new URLSearchParams(o)}`;

/* ------------------------------------------------------------ 프롬프트 해석 */
// 결과·매개 성격이 뚜렷한 변인: 제목의 '무엇이 무엇에' 순서를 정하는 데만 쓴다
const DV = new Set(['이직의도', '직무만족', '삶의만족', '행복감', '심리적안녕감', '학업성취', '학교적응', '소진', '조직몰입', '직무성과', '고객만족', '구매의도', '재방문의도', '충성도', '사용의도', '수업만족', '운동몰입', '삶의질', '건강증진행위', '혁신행동', '조직시민행동', '구전', '외상후성장', '수면의질', '우울']);
const MED = new Set(['회복탄력성', '자기효능감', '학업적자기효능감', '진로결정자기효능감', '교사효능감', '사회적지지', '마음챙김', '정서조절', '정서조절곤란', '자아존중감', '그릿', '정서지능', '자기자비', '낙관성', '직무열의', '심리적안전감', '신뢰', '지각된가치', '정신화', '공감', '학업동기', '자기조절학습', '지각된유용성', '지각된용이성']);

function readPrompt(text) {
  const t = text.replace(/\s+/g, ' ');
  const population = POPULATIONS.filter((p) => t.includes(p)).sort((a, b) => b.length - a.length)[0] || '';
  let hits = [];
  for (const c of CONSTRUCTS) {
    let best = null;
    for (const n of c.names) {
      const at = t.indexOf(n);
      if (at >= 0 && (!best || at < best.at || (at === best.at && n.length > best.len))) best = { at, len: n.length, name: n };
    }
    if (best) hits.push({ key: c.key, ...best });
  }
  // 더 긴 이름 안에 들어 있는 짧은 이름은 버린다(예: '스트레스'와 '직무스트레스')
  hits = hits.filter((h) => !hits.some((o) => o !== h && o.len > h.len && o.at <= h.at && o.at + o.len >= h.at + h.len));
  hits.sort((a, b) => a.at - b.at);
  const keys = [...new Map(hits.map((h) => [h.key, h])).values()];
  const dv = keys.filter((h) => DV.has(h.key));
  const med = keys.filter((h) => MED.has(h.key) && !dv.includes(h));
  const iv = keys.filter((h) => !dv.includes(h) && !med.includes(h));
  let order = keys;
  if (keys.length >= 3) {
    const D = dv[dv.length - 1] || keys[keys.length - 1];
    const I = iv.find((h) => h !== D) || keys.find((h) => h !== D);
    const M = med.find((h) => h !== D && h !== I) || keys.find((h) => h !== D && h !== I);
    order = [I, M, D];
  } else if (keys.length === 2) {
    const D = dv.length ? dv[dv.length - 1] : keys[1];
    order = [keys.find((h) => h !== D), D];
  }
  return { population, keywords: order.filter(Boolean).map((h) => h.name) };
}

function cleanAsTitle(text) {
  return text.replace(/[.!?。]+$/, '')
    .replace(/\d+\s*쪽(으로|짜리|분량)?/g, ' ')
    .replace(/(써\s*주세요|써\s*줘요?|작성해\s*주세요|작성해\s*줘요?|부탁(해요|합니다|드립니다)?|만들어\s*주세요)/g, ' ')
    .replace(/(석사|박사|학사|졸업|학위|소)?\s*논문(이에요|입니다|이고)?[.,]?/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 90);
}

// 프롬프트 속 전공·논문 종류·쪽수를 읽어 선택 칸을 맞춘다
function readOptions(text) {
  const t = text.replace(/\s+/g, ' ');
  const f = guessField(t);
  const type = /박사/.test(t) ? 'doctor' : /석사/.test(t) ? 'master' : /학술지|KCI|투고/.test(t) ? 'journal' : /학사|졸업\s*논문/.test(t) ? 'bachelor' : /소논문|리포트|레포트|과제/.test(t) ? 'personal' : '';
  const m = t.match(/(\d{1,3})\s*(쪽|페이지|p\b)/);
  return { fieldId: f ? f.id : '', typeId: type, pages: m ? Number(m[1]) : 0 };
}

function promptDesign(text, fieldSel, typeId) {
  const fieldId = fieldSel && fieldSel !== 'auto' ? fieldSel : ((guessField(text) || {}).id || 'other');
  const r = readPrompt(text);
  let title = '';
  if (r.keywords.length) {
    const cands = suggestTitles({ keywords: r.keywords, fieldId, population: r.population });
    const want = /조절|완충|따라 달라/.test(text) ? 'moderation' : /매개|거쳐|통해|경로/.test(text) ? 'mediation' : '';
    const pick = (want && cands.find((c) => c.design === want)) || cands[0];
    title = pick ? pick.title : '';
  }
  if (!title) title = cleanAsTitle(text);
  const d = buildDesign({ title: title.length >= 4 ? title : '', typeId, fieldId, keywords: r.keywords });
  return { d, fieldId };
}

/* ------------------------------------------------------------ 히어로 작성 화면 */
const win = $('#hxWin');
if (win) {
  const form = $('#hxPrompt', win);
  const text = $('#hxText', win);
  const selField = $('#hxField', win);
  const selType = $('#hxType', win);
  const selPages = $('#hxPages', win);
  const send = $('.hx-send', win);
  const stepsEl = $('#hxSteps', win);
  const doc = $('#hxDoc', win);
  const page = $('#hxPage', win);
  const refList = $('#hxRefList', win);
  const more = $('#hxMoreT', win);
  const go = $('#hxGo', win);
  const tag = $('#hxTag', win);
  const verifyN = $('#hxVerifyN', win);
  const verifyLabel = $('#hxVerifyLabel', win);
  const verifyNote = $('#hxVerifyNote', win);
  const meter = $('.hx-meter i', win);
  let mode = 'demo';
  let cycleTimer = null;
  let cycleIdx = 0;
  let paused = false;

  const lockIcon = more.querySelector('svg') ? more.querySelector('svg').outerHTML : '';
  const demoTitle = $('.hx-ttl', page).textContent;

  // 본문 인용과 참고문헌을 함께 밝힌다
  const activate = (id) => {
    for (const c of $$('.hx-cite', page)) c.classList.toggle('is-active', c.dataset.ref === id);
    for (const li of $$('li[data-ref]', refList)) li.classList.toggle('is-active', li.dataset.ref === id);
  };
  const stopCycle = () => { clearInterval(cycleTimer); cycleTimer = null; };
  const startCycle = () => {
    stopCycle();
    if (reduce || mode !== 'demo') return;
    const order = ['r1', 'r4', 'r3', 'r2'];
    const step = () => { if (!paused && mode === 'demo') activate(order[cycleIdx++ % order.length]); };
    step();
    cycleTimer = setInterval(step, 2600);
  };
  const pick = (e) => {
    if (mode !== 'demo') return;
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

  // 첫 화면 연출: 단계가 차례로 끝나며 문헌이 확인되고, 지면이 채워진 뒤 인용이 문헌과 이어진다
  const playDemo = async () => {
    if (reduce) { startCycle(); return; }
    win.classList.add('is-anim');
    const blk = (sel, root = page) => $$(sel, root);
    meter.style.width = '0%';
    verifyN.textContent = '0/42';
    await wait(450);
    send.classList.add('is-pulse');
    setStep(0, 'run'); await wait(650); setStep(0, 'done');
    setStep(1, 'run');
    const refs = blk('li[data-ref]', refList);
    meter.style.width = '100%';
    const counting = countTo(42, 1300);
    for (const li of refs) { reveal([li]); await wait(220); li.classList.add('is-ok'); }
    await counting;
    setStep(1, 'done');
    setStep(2, 'run'); reveal(blk('.hx-meta, .hx-ttl')); await wait(420); reveal(blk('.hx-ch, .hx-sec')); await wait(300); setStep(2, 'done');
    setStep(3, 'run'); reveal(blk('.hx-p')); await wait(1700); setStep(3, 'done');
    setStep(4, 'run');
    for (const c of $$('.hx-cite', page)) { c.classList.add('is-lit'); activate(c.dataset.ref); await wait(330); }
    setStep(4, 'done');
    win.classList.add('is-ready');
    await wait(400);
    startCycle();
  };

  const syncLink = (title) => {
    const typeId = selType.value;
    const pages = Number(selPages.value);
    const field = selField.value === 'auto' ? ((guessField(text.value) || {}).id || '') : selField.value;
    go.href = orderUrl({ title: title || demoTitle, type: typeId, ...(field ? { field } : {}), task: 'full', pages: String(pages) });
    return quote(typeId, pages);
  };

  // 내 프롬프트로 작성: 설계(제목·목차)는 바로 보여 주고, 문헌·본문·인용은 주문 후 단계로 표시
  const runUser = async (fromPrompt = false) => {
    const raw = text.value.trim();
    if (raw.length < 4) {
      text.focus(); tag.textContent = '주제를 조금 더 적어 주세요';
      win.classList.add('is-warn'); setTimeout(() => win.classList.remove('is-warn'), 900);
      return;
    }
    // 프롬프트를 보낼 때만: 적은 전공·종류·쪽수가 있으면 선택 칸을 그에 맞춘다
    const o = fromPrompt ? readOptions(raw) : {};
    if (o.fieldId && [...selField.options].some((x) => x.value === o.fieldId)) selField.value = o.fieldId;
    if (o.typeId) selType.value = o.typeId;
    if (o.pages) {
      const opts = [...selPages.options].map((x) => Number(x.value));
      if (!opts.includes(o.pages) && o.pages >= 4 && o.pages <= 400) { const op = document.createElement('option'); op.value = String(o.pages); op.textContent = `${o.pages}쪽`; selPages.append(op); }
      if (o.pages >= 4 && o.pages <= 400) selPages.value = String(o.pages);
    } else if (o.typeId) {
      const r = RANGES[o.typeId];
      selPages.value = String([...selPages.options].map((x) => Number(x.value)).reduce((a, b) => (Math.abs(b - r[2]) < Math.abs(a - r[2]) ? b : a)));
    }
    mode = 'user';
    stopCycle();
    win.dataset.mode = 'user';
    win.classList.remove('is-ready');
    tag.textContent = '내 프롬프트';
    const typeId = selType.value;
    const pages = Number(selPages.value);
    const { d } = promptDesign(raw, selField.value, typeId);
    const q = syncLink(d.title);
    const refsN = Math.max(10, Math.round(pages * 0.5));
    send.classList.remove('is-pulse'); void send.offsetWidth; send.classList.add('is-pulse');
    for (let i = 0; i < 5; i++) setStep(i, 'wait');
    setStep(0, 'run');
    page.innerHTML = `<p class="hx-meta" data-blk>${esc(TYPE_LABEL[typeId] || '논문')} · 본문 ${pages}쪽 · APA 7판</p>
<p class="hx-ttl" data-blk>${esc(d.title)}</p>
<div class="hx-toc" data-blk>${tocHtml(d.toc, { limit: 9 })}</div>
<p class="hx-ch" data-blk>제1장 서론</p>
<div class="hx-sk" data-blk aria-hidden="true"><i style="width:94%"></i><i style="width:99%"><b></b></i><i style="width:90%"></i><i style="width:97%"><b class="r"></b></i><i style="width:62%"></i></div>`;
    refList.innerHTML = Array.from({ length: 4 }, (_, i) => `<li class="hx-ref-sk" data-blk aria-hidden="true"><i style="width:${[58, 66, 52, 61][i]}%"></i><i style="width:96%"></i><i style="width:${[82, 74, 88, 70][i]}%"></i><em>주문 후 원문 대조</em></li>`).join('');
    verifyLabel.textContent = '예상 참고문헌';
    verifyN.textContent = `${refsN}편 안팎`;
    verifyNote.textContent = '주문 후 실존 문헌만으로 구성하고 DOI·KCI·RISS와 대조';
    meter.style.width = '0%';
    const blks = [...$$('[data-blk]', page), ...$$('[data-blk]', refList)];
    if (reduce) reveal(blks); else win.classList.add('is-anim');
    await wait(reduce ? 0 : 420);
    setStep(0, 'done');
    reveal($$('.hx-meta, .hx-ttl', page));
    setStep(2, 'run');
    await wait(reduce ? 0 : 520);
    reveal(blks);
    setStep(2, 'done');
    more.innerHTML = `${lockIcon}<span>${pages}쪽 · <b>${wonNum(q.total)}원</b> · 영업일 ${q.days}일</span>`;
    go.textContent = '이 주제로 논문 완성하기';
    win.classList.add('is-ready');
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); runUser(true); });
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); runUser(true); } });
  text.addEventListener('focus', () => { paused = true; });
  text.addEventListener('blur', () => { paused = false; });
  selType.addEventListener('change', () => {
    const r = RANGES[selType.value];
    if (r) selPages.value = String([...selPages.options].map((o) => Number(o.value)).reduce((a, b) => (Math.abs(b - r[2]) < Math.abs(a - r[2]) ? b : a)));
    if (mode === 'user') runUser(); else syncLink();
  });
  selPages.addEventListener('change', () => { if (mode === 'user') runUser(); else syncLink(); });
  selField.addEventListener('change', () => { if (mode === 'user') runUser(); else syncLink(); });

  // 왼쪽 버튼: 프롬프트 칸으로 바로 이동
  for (const a of $$('[data-focus-prompt]')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      paused = true;
      const r = win.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight) win.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      text.focus({ preventScroll: true });
      text.select();
    });
  }

  playDemo();
}

/* ------------------------------------------------------------ 분량별 요금 */
initTiers({ onCatalog: (c) => { CATALOG = c; } });
