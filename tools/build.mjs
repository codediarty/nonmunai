// 논문AI 정적 사이트 빌드: node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import * as esbuild from 'esbuild';
import { createTemplates } from '../src/templates/layout.mjs';
import { loadGuides } from './guides.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.env.OUT_DIR || 'docs');
const site = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
// Pages가 도메인 연결 직후 http 주소를 알려 주더라도 대표 주소는 항상 https로 쓴다
if (process.env.SITE_URL) site.siteUrl = process.env.SITE_URL.replace(/^http:\/\/(?!localhost|127\.0\.0\.1)/, 'https://').replace(/\/+$/, '');
if (process.env.API_URL !== undefined) site.apiUrl = process.env.API_URL;
if (process.env.BASE_PATH !== undefined) site.basePath = process.env.BASE_PATH;
const assetVersion = process.env.ASSET_VERSION || crypto.createHash('md5').update(String(Date.now())).digest('hex').slice(0, 8);

const T = createTemplates({ site, root, assetVersion });
const write = (rel, content) => {
  const file = path.join(out, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const copyDir = (from, to, filter = () => true) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const s = path.join(from, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, path.join(to, f), filter);
    else if (filter(f)) fs.copyFileSync(s, path.join(to, f));
  }
};

// 0) 출력 폴더 정리 (CNAME 유지)
const keep = ['CNAME'];
if (fs.existsSync(out)) {
  for (const f of fs.readdirSync(out)) if (!keep.includes(f)) fs.rmSync(path.join(out, f), { recursive: true, force: true });
} else fs.mkdirSync(out, { recursive: true });

// 1) 글꼴
const fontsOut = path.join(out, 'assets/fonts');
copyDir(path.join(root, 'node_modules/pretendard/dist/web/variable/woff2-dynamic-subset'), path.join(fontsOut, 'pretendard'));
const serifFiles = path.join(root, 'node_modules/@fontsource/noto-serif-kr/files');
copyDir(serifFiles, path.join(fontsOut, 'noto-serif-kr'), (f) => /-(400|700)-normal\.woff2$/.test(f));
fs.copyFileSync(path.join(root, 'node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-italic.woff2'), path.join(fontsOut, 'source-serif-4-italic.woff2'));
const pretendardCss = fs.readFileSync(path.join(root, 'node_modules/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\(\.\/woff2-dynamic-subset\//g, `url(${site.basePath}/assets/fonts/pretendard/`);
const serifCss = ['400', '700'].map((w) => fs.readFileSync(path.join(root, `node_modules/@fontsource/noto-serif-kr/${w}.css`), 'utf8'))
  .join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/src: url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\), url\([^)]+\) format\('woff'\);/g, `src: url(${site.basePath}/assets/fonts/noto-serif-kr/$1) format('woff2');`);
const statCss = `@font-face{font-family:'Source Serif 4';font-style:italic;font-display:swap;font-weight:400;src:url(${site.basePath}/assets/fonts/source-serif-4-italic.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+03B1-03C9}`;
const fontsCss = pretendardCss + serifCss + statCss;

// 2) CSS 묶기
const css = (names) => fontsCss + names.map((n) => fs.readFileSync(path.join(root, `src/styles/${n}.css`), 'utf8')).join('\n');
const cssBundles = { site: ['base', 'pages'], app: ['base', 'pages', 'app'], admin: ['base', 'app', 'admin'] };
for (const [name, parts] of Object.entries(cssBundles)) {
  const r = await esbuild.transform(css(parts), { loader: 'css', minify: true });
  write(`assets/css/${name}.css`, r.code);
}

// 3) JS 묶기
const entryDir = path.join(root, 'src/js/entries');
const entries = fs.readdirSync(entryDir).filter((f) => f.endsWith('.js')).map((f) => path.join(entryDir, f));
await esbuild.build({
  entryPoints: entries, bundle: true, splitting: true, format: 'esm', minify: true, target: ['es2020', 'chrome90', 'safari15', 'firefox90'],
  outdir: path.join(out, 'assets/js'), chunkNames: 'chunks/[name]-[hash]', sourcemap: false, legalComments: 'none', logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"' },
});

// 4) 정적 자산
if (fs.existsSync(path.join(root, 'src/assets/img'))) copyDir(path.join(root, 'src/assets/img'), path.join(out, 'assets/img'));
for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'favicon.ico']) {
  const p = path.join(root, 'src/assets', f);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(out, f));
}

// 5) 페이지 생성
const ctx = { site, T, root, assetVersion, guides: loadGuides(root) };
const pageDir = path.join(root, 'src/content/pages');
const pages = [];
for (const f of fs.readdirSync(pageDir).filter((f) => f.endsWith('.mjs')).sort()) {
  const mod = await import(pathToFileURL(path.join(pageDir, f)).href + `?v=${assetVersion}`);
  const list = await mod.default(ctx);
  for (const p of list) pages.push(p);
}
// 하위 경로(basePath)에 배포할 때 본문 속 절대 링크(/x/)에 경로를 붙인다
function withBase(html) {
  const b = site.basePath;
  if (!b) return html;
  return html.replace(/(\s(?:href|src|action|poster)=")(\/[^"]*)"/g, (m, a, u) => (u.startsWith('//') || u === b || u.startsWith(b + '/') ? m : `${a}${b}${u}"`));
}
const seen = new Set();
for (const p of pages) {
  if (seen.has(p.path)) throw new Error('중복 경로: ' + p.path);
  seen.add(p.path);
  const html = withBase(T.layout(p));
  const rel = p.path === '/404.html' ? '404.html' : path.join(p.path.replace(/^\//, ''), 'index.html');
  write(rel, html);
}

// 6) 사이트맵·robots·RSS·llms.txt·매니페스트
const today = new Date().toISOString().slice(0, 10);
const indexable = pages.filter((p) => !p.noindex && p.path !== '/404.html');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((p) => `  <url><loc>${T.abs(p.path)}</loc><lastmod>${p.modified || p.published || today}</lastmod><changefreq>${p.changefreq || 'weekly'}</changefreq><priority>${p.priority || (p.path === '/' ? '1.0' : '0.7')}</priority></url>`).join('\n')}\n</urlset>\n`);
// 검색·AI 답변 엔진은 모두 허용하되, 주문·결제·운영자 화면은 어느 봇에게도 열지 않는다
const BOTS = ['Yeti', 'Daumoa', 'Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot'];
const PRIVATE = ['/admin/', '/orders/', '/checkout/'].map((p) => `Disallow: ${site.basePath}${p}`).join('\n');
// 다음 웹마스터도구 소유 확인: PIN 발급 때 받은 '#DaumWebMasterTool:...' 줄을 site.config.json verification.daum에 넣으면 robots.txt 맨 아래에 붙는다
const daumLine = String((site.verification || {}).daum || '').trim();
write('robots.txt', `User-agent: *\nAllow: /\n${PRIVATE}\n\n# 검색엔진·AI 검색·답변 엔진 허용\n${BOTS.map((b) => `User-agent: ${b}\nAllow: /\n${PRIVATE}\n`).join('\n')}\nSitemap: ${T.abs('/sitemap.xml')}\n${daumLine ? `\n${daumLine.startsWith('#') ? daumLine : `#${daumLine}`}\n` : ''}`);
const guides = ctx.guides.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
const rssItems = guides.map((g) => `<item><title>${T.esc(g.title)}</title><link>${T.abs(`/guide/${g.slug}/`)}</link><guid>${T.abs(`/guide/${g.slug}/`)}</guid><pubDate>${new Date(g.date + 'T09:00:00+09:00').toUTCString()}</pubDate><description>${T.esc(g.description)}</description><category>${T.esc(g.category)}</category></item>`).join('');
write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>논문AI 가이드</title><link>${T.abs('/guide/')}</link><description>논문 작성, 설문조사, 통계분석을 처음 하는 분을 위한 실전 가이드</description><language>ko</language>${rssItems}</channel></rss>\n`);
const llms = await import(pathToFileURL(path.join(root, 'tools/llms.mjs')).href);
write('llms.txt', llms.llmsTxt(ctx, pages));
write('llms-full.txt', llms.llmsFull(ctx, pages));
write('site.webmanifest', JSON.stringify({ name: '논문AI', short_name: '논문AI', start_url: site.basePath + '/', display: 'standalone', background_color: '#FFFFFF', theme_color: '#0F1B3D', icons: [{ src: site.basePath + '/assets/img/logo-192.png', sizes: '192x192', type: 'image/png' }, { src: site.basePath + '/assets/img/logo-512.png', sizes: '512x512', type: 'image/png' }] }));
write('.nojekyll', '');
write('assets/config.json', JSON.stringify({ apiUrl: site.apiUrl, version: assetVersion }));
if (site.indexNowKey) write(`${site.indexNowKey}.txt`, site.indexNowKey);
console.log(`site: ${pages.length} pages, ${indexable.length} indexable, assets v=${assetVersion} → ${path.relative(root, out)}/`);
