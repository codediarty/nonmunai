// 가이드(.md) 읽기: YAML 머리말 + 마크다운 본문
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

function slugifyHeading(text, used) {
  let s = text.replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 40) || 'sec';
  let k = s, i = 2;
  while (used.has(k)) k = `${s}-${i++}`;
  used.add(k);
  return k;
}

export function renderMarkdown(md) {
  const toc = [];
  const used = new Set();
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const id = slugifyHeading(text, used);
    if (depth === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, '') });
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  renderer.table = function (token) {
    const head = token.header.map((c) => `<th${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</th>`).join('');
    const body = token.rows.map((r) => `<tr>${r.map((c) => `<td${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table class="g-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>\n`;
  };
  renderer.link = function ({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const ext = /^https?:\/\//.test(href);
    return `<a href="${href}"${title ? ` title="${title}"` : ''}${ext ? ' rel="noopener" target="_blank"' : ''}>${text}</a>`;
  };
  const html = marked.parse(md, { renderer });
  return { html, toc };
}

export function loadGuides(root) {
  const dir = path.join(root, 'src/content/guides');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!m) { console.warn('guide frontmatter missing:', f); continue; }
    let meta;
    try { meta = yaml.load(m[1]); } catch (e) { console.warn('guide yaml error:', f, e.message); continue; }
    const body = m[2].trim();
    const { html, toc } = renderMarkdown(body);
    const plain = body.replace(/[#>*_`|\-\[\]()]/g, ' ').replace(/\s+/g, ' ');
    out.push({ ...meta, slug: meta.slug || f.replace(/\.md$/, ''), html, toc, chars: plain.length, minutes: Math.max(3, Math.round(plain.length / 650)), file: f, date: String(meta.date || '2026-10-20') });
  }
  return out;
}
