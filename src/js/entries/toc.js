// 논문 목차 생성기
import { buildDesign, tocToText } from '../core/engine.js';
import { tocHtml } from '../core/render.js';
import { $, toast, debounce } from '../ui/dom.js';

const form = $('#tocForm');
let current = null;
function render() {
  const title = $('#tTitle').value.trim();
  const d = buildDesign({ title, typeId: $('#tType').value, method: $('#tMethod').value });
  current = d;
  $('#tocOut').innerHTML = tocHtml(d.toc, { withSubs: true });
  $('#tocTitle').textContent = `${d.type.label} 목차 · ${d.designLabel}`;
}
if (form) {
  form.addEventListener('submit', (e) => { e.preventDefault(); render(); });
  form.addEventListener('input', debounce(render, 300));
  form.addEventListener('change', render);
  render();
  $('#tocCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(tocToText(current.toc)); toast('목차를 복사했습니다.'); } catch { toast('복사하지 못했습니다. 직접 선택해 복사해 주세요.', { error: true }); }
  });
  $('#tocDoc').addEventListener('click', () => {
    const lines = tocToText(current.toc).split('\n').map((l) => `<p style="margin:0 0 4pt ${(l.match(/^ */)[0].length / 2) * 14}pt;font-family:바탕">${l.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('');
    const html = `<html><head><meta charset="utf-8"><title>목차</title></head><body><h2 style="font-family:바탕">${current.title || '목차'}</h2>${lines}</body></html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '논문AI_목차.doc';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}
