// APA 7판 참고문헌 형식 변환
import { esc } from './render.js';

export function parseAuthor(line) {
  const s = String(line || '').trim();
  if (!s) return null;
  if (/[가-힣]/.test(s)) return { korean: true, last: s.replace(/\s+/g, ''), full: s.replace(/\s+/g, '') };
  let last, given;
  if (s.includes(',')) { const i = s.indexOf(','); last = s.slice(0, i).trim(); given = s.slice(i + 1).trim(); }
  else { const parts = s.split(/\s+/); last = parts.pop(); given = parts.join(' '); }
  const initials = given.split(/\s+/).filter(Boolean).map((g) => g.split('-').map((h) => (h[0] ? h[0].toUpperCase() + '.' : '')).join('-')).join(' ');
  return { korean: false, last, initials, full: initials ? `${last}, ${initials}` : last };
}

export function authorsText(authors) {
  const list = authors.filter(Boolean);
  if (!list.length) return '';
  const names = list.map((a) => a.full);
  if (list.every((a) => a.korean)) return names.join(', ');
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  if (names.length <= 20) return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
  return `${names.slice(0, 19).join(', ')}, . . . ${names[names.length - 1]}`;
}

export function citeText(authors, year) {
  const list = authors.filter(Boolean);
  const y = year || 'n.d.';
  if (!list.length) return `(${y})`;
  const k = list.every((a) => a.korean);
  if (list.length === 1) return `(${list[0].last}, ${y})`;
  if (list.length === 2) return k ? `(${list[0].last}, ${list[1].last}, ${y})` : `(${list[0].last} & ${list[1].last}, ${y})`;
  return k ? `(${list[0].last} 외, ${y})` : `(${list[0].last} et al., ${y})`;
}

export function normDoi(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  const d = s.replace(/^doi:\s*/i, '');
  if (/^10\.\d{3,}/.test(d)) return `https://doi.org/${d}`;
  return s;
}

const endDot = (s) => (/[.?!]$/.test(s) ? s : `${s}.`);

export function formatReference(type, f) {
  const authors = String(f.authors || '').split(/\n+/).map(parseAuthor).filter(Boolean);
  const korean = /[가-힣]/.test(`${f.title}${f.source}${f.authors}`);
  const A = authorsText(authors) || esc(f.title || '');
  const y = String(f.year || '').trim() || 'n.d.';
  const it = (s) => (korean ? esc(s) : `<i>${esc(s)}</i>`);
  const doi = normDoi(f.doi);
  const tail = doi ? ` ${esc(doi)}` : '';
  const pages = String(f.pages || '').trim().replace(/\s*[–—~]\s*/g, '-');
  let html = '';
  if (type === 'journal') {
    const vol = f.vol ? `${it(f.vol)}${f.issue ? `(${esc(f.issue)})` : ''}` : '';
    html = `${esc(A)} (${esc(y)}). ${esc(endDot(f.title || ''))} ${it(f.source || '')}${vol ? `, ${vol}` : ''}${pages ? `, ${esc(pages)}` : ''}.${tail}`;
  } else if (type === 'book') {
    html = `${esc(A)} (${esc(y)}). ${it(endDot(f.title || ''))} ${esc(f.publisher ? endDot(f.publisher) : '')}${tail}`;
  } else if (type === 'thesis') {
    const deg = f.degree === 'doctor' ? (korean ? '박사학위논문' : 'Doctoral dissertation') : (korean ? '석사학위논문' : "Master's thesis");
    html = `${esc(A)} (${esc(y)}). ${it(f.title || '')} [${esc(deg)}, ${esc(f.univ || '')}].${tail}`;
  } else if (type === 'report') {
    html = `${esc(A)} (${esc(y)}). ${it(endDot(f.title || ''))} ${esc(f.publisher ? endDot(f.publisher) : '')}${tail}`;
  } else {
    html = `${esc(A)} (${esc(y)}). ${it(endDot(f.title || ''))} ${esc(f.publisher ? endDot(f.publisher) : '')}${tail}`;
  }
  html = html.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();
  const text = html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return { html, text, cite: citeText(authors, y), korean, sortKey: (korean ? '0' : '1') + text.toLowerCase() };
}
