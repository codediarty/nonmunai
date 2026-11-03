// APA 참고문헌 생성기
import { formatReference } from '../core/apa.js';
import { $, $$, toast, store, esc } from '../ui/dom.js';

const form = $('#refForm');
const read = () => ({
  authors: $('#rAuthors').value, year: $('#rYear').value, title: $('#rTitle').value, source: $('#rSource').value, vol: $('#rVol').value, issue: $('#rIssue').value,
  pages: $('#rPages').value, publisher: $('#rPub').value, univ: $('#rUniv').value, degree: $('#rDegree').value, doi: $('#rDoi').value,
});
function preview() {
  const r = formatReference($('#rType').value, read());
  $('#refOut').innerHTML = r.html;
  $('#refCite').textContent = r.cite;
  return r;
}
function renderList() {
  const list = store.get('refs', []).sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));
  $('#refList').innerHTML = list.map((r, i) => `<li><span class="ref-item">${r.html}</span><button type="button" class="link-btn" data-del="${i}" aria-label="삭제">삭제</button></li>`).join('') || '<li class="muted">아직 추가한 항목이 없어요.</li>';
  $('#refCount').textContent = list.length ? `${list.length}건` : '';
  for (const b of $$('[data-del]')) b.addEventListener('click', () => { const l = store.get('refs', []).sort((a, c) => (a.sortKey < c.sortKey ? -1 : 1)); l.splice(Number(b.dataset.del), 1); store.set('refs', l); renderList(); });
}
function setType() {
  const t = $('#rType').value;
  for (const el of $$('[data-r]')) el.hidden = !el.dataset.r.split(' ').includes(t);
  $('label[for=rPub]').textContent = t === 'web' ? '사이트 이름' : t === 'report' ? '발행 기관' : '출판사';
  preview();
}
if (form) {
  $('#rType').addEventListener('change', setType);
  form.addEventListener('input', preview);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = preview();
    if (!$('#rTitle').value.trim()) { toast('제목을 입력해 주세요.', { error: true }); return; }
    const list = store.get('refs', []);
    if (!list.some((x) => x.text === r.text)) list.push({ html: r.html, text: r.text, sortKey: r.sortKey });
    store.set('refs', list);
    renderList();
    toast('목록에 추가했어요.');
  });
  $('#refCopyAll').addEventListener('click', async () => {
    const list = store.get('refs', []).sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));
    if (!list.length) { toast('목록이 비어 있어요.', { error: true }); return; }
    try { await navigator.clipboard.writeText(list.map((r) => r.text).join('\n')); toast(`${list.length}건을 복사했어요.`); } catch { toast('복사하지 못했어요.', { error: true }); }
  });
  $('#refClear').addEventListener('click', () => { store.set('refs', []); renderList(); });
  setType();
  renderList();
}
void esc;
