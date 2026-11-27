// 전 페이지 공통 동작: 모바일 메뉴, 탭, 외부 링크
import { $, $$ } from '../ui/dom.js';

const burger = $('.hd-burger');
const mnav = $('#mnav');
if (burger && mnav) {
  burger.addEventListener('click', () => {
    const open = mnav.hidden;
    mnav.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  });
}

for (const tabs of $$('[data-tabs]')) {
  const btns = $$('[role=tab]', tabs);
  const select = (b, focus) => {
    for (const x of btns) {
      const on = x === b;
      x.setAttribute('aria-selected', String(on));
      x.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(x.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    }
    if (focus) b.focus();
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => select(b));
    b.addEventListener('keydown', (e) => {
      const next = e.key === 'ArrowRight' || e.key === 'ArrowDown';
      if (next || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        select(btns[(i + (next ? 1 : btns.length - 1)) % btns.length], true);
      }
    });
  });
}

// 가격표: 빌드 때 넣은 기본 가격을 운영자가 바꾼 현재 가격으로 고친다
if (document.querySelector('[data-price]')) {
  Promise.all([import('../app/api.js'), import('../core/pricing.js')]).then(async ([A, P]) => {
    if (!A.apiReady()) return;
    const c = await A.loadConfig();
    if (!c || c.offline || !c.catalog) return;
    const find = (code) => (c.catalog.items || []).find((i) => i.code === code);
    for (const el of $$('[data-price]')) { const it = find(el.dataset.price); if (it) el.textContent = it.quoteOnly ? '별도 견적' : P.won(it.price); }
    for (const el of $$('[data-days]')) { const it = find(el.dataset.days); if (it) el.textContent = it.days ? `영업일 ${it.days}일` : '견적 후 안내'; }
  }).catch(() => { /* 기본 가격 그대로 둔다 */ });
}

/* 실시간 현황판 신호(2026.11.27 논문AI, 형제 사이트와 같은 코드 · 대표 '오늘부터 바로'): 들어옴 · 화면을 보는 동안 30초마다 머묾 · 나감.
   글 · 이름 · 메일 · 토큰 코드는 보내지 않음(이 브라우저의 무작위 번호 · 본 쪽 주소 · 들어온 사이트 이름만). 검색 로봇은 보내지 않음. 실패해도 화면에 영향 없음 */
(function () {
  try {
    if (window.__lvOn) return; window.__lvOn = 1;
    if (Date.now() < Date.UTC(2026, 10, 26, 15, 0)) return;   // 2026.11.27 00:00(한국)부터 셈(대표 11.27 결정, 개인정보처리방침 11.26 알림 · 처음엔 12.03)
    var U = "https://script.google.com/macros/s/AKfycbynqa4gSpMjYlnOHPH6xaM3d2vys7aVMJHLuxQL_9osna0026p-Z6uywH2d4d0fzUbK_w/exec";
    var d = document, l = location, nav = navigator, S = null;
    if (nav.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|facebookexternalhit|yeti|daumoa/i.test(nav.userAgent || "")) return;
    var host = l.hostname.replace(/^www\./, "");
    if (!/\./.test(host) || /localhost|127\.0\.0\.1|github\.io$/.test(host)) return;
    try { S = window.localStorage; } catch (e0) { S = null; }
    var gt = function (k) { try { return S ? S.getItem(k) : null; } catch (e) { return null; } };
    var st = function (k, v) { try { if (S) S.setItem(k, v); } catch (e) { /* 무시 */ } };
    var v = gt("lv_id"), f = 0;
    if (!v) { v = (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)).slice(0, 16); f = 1; }   // 1.1: 저장은 들어옴을 보낼 때
    var day = new Date(Date.now() + 324e5).toISOString().slice(0, 10), n = gt("lv_day") !== day ? 1 : 0;
    var rf = ""; try { rf = d.referrer ? new URL(d.referrer).hostname.replace(/^www\./, "") : ""; } catch (e1) { rf = ""; }
    if (rf === host) rf = "";
    var send = function (t, x) {
      var q = U + "?a=h&t=" + t + "&s=" + encodeURIComponent(host) + "&v=" + v + "&p=" + encodeURIComponent(l.pathname.slice(0, 80)) + (x || "");
      try { if (nav.sendBeacon && nav.sendBeacon(q)) return; } catch (e2) { /* 아래로 */ }
      try { fetch(q, { method: "POST", mode: "no-cors", keepalive: true }); } catch (e3) { /* 무시 */ }
    };
    var c = 0, timer = 0, on = false;
    var beat = function () { if (d.visibilityState !== "visible") return; if (++c > 120) { clearInterval(timer); return; } send("h"); };
    var start = function () { if (on) return; on = true; if (f) st("lv_id", v); if (n) st("lv_day", day); send("v", "&n=" + n + "&f=" + f + "&r=" + encodeURIComponent(rf)); timer = setInterval(beat, 30000); };
    d.addEventListener("visibilitychange", function () { if (!on) return; send(d.visibilityState === "visible" ? "h" : "x"); });
    addEventListener("pagehide", function () { if (!on && !d.prerendering) start(); if (on) send("x"); });   // 1.1: 다 뜨기 전에 나가도 들어옴은 보냄
    var go = function () { setTimeout(start, 300); };
    var ready = function () { if (d.prerendering) d.addEventListener("prerenderingchange", go, { once: true }); else go(); };   // 1.1: 미리 열어 둔 쪽은 실제로 볼 때부터
    if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", ready); else ready();   // 1.1: 쪽이 다 뜨기(load)를 기다리지 않음
  } catch (e) { /* 신호 실패는 무시 */ }
})();
