// 웹 업로드용 소스 묶음: node tools/pack-upload.mjs [--only=a,b,s]
//  a: 이미지 묶음을 뺀 소스 전체, b: OG 이미지(src/assets/img/og), s: 아임웹 상품 표지(src/assets/img/shop/products, 1.3MB씩 나눔)
//  결과: upload/nonmunai-a.zip(.b64.txt), upload/nonmunai-b.zip(.b64.txt), upload/manifest.json
// .github/workflows는 넣지 않는다(Actions 토큰으로는 워크플로를 고칠 수 없음)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'docs', 'docs-dev', 'upload', 'tmp', '.github', '.git']);
const OG = 'src/assets/img/og/';
const SHOP = 'src/assets/img/shop/products/';
const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '--only=a,b').slice(7).split(',');
const list = [];
const walk = (dir, rel = '') => {
  for (const name of fs.readdirSync(dir)) {
    if (!rel && SKIP.has(name)) continue;
    if (name === '.DS_Store' || name.endsWith('.log')) continue;
    const abs = path.join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    if (fs.statSync(abs).isDirectory()) walk(abs, r); else list.push(r);
  }
};
walk(root);
const groups = { a: list.filter((f) => !f.startsWith(OG) && !f.startsWith(SHOP)), b: list.filter((f) => f.startsWith(OG)) };
// 상품 표지는 주소창 길이 제한(약 2MB) 안에 들도록 나눠 묶는다
const shopFiles = list.filter((f) => f.startsWith(SHOP)).sort();
let part = [], size = 0, n = 0;
for (const f of shopFiles) {
  const sz = fs.statSync(path.join(root, f)).size;
  if (part.length && size + sz > 1300 * 1024) { groups['s' + (++n)] = part; part = []; size = 0; }
  part.push(f); size += sz;
}
if (part.length) groups['s' + (++n)] = part;
const outDir = path.join(root, 'upload');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const manifest = { builtAt: new Date().toISOString(), bundles: [] };
const only = onlyArg.flatMap((k) => (k === 's' ? Object.keys(groups).filter((g) => /^s\d+$/.test(g)) : [k]));
for (const key of only) {
  const zip = new JSZip();
  for (const f of groups[key]) zip.file(f, fs.readFileSync(path.join(root, f)), { date: new Date('2026-11-01T00:00:00Z') });
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const name = `nonmunai-${key}.zip`;
  fs.writeFileSync(path.join(outDir, name), buf);
  const b64 = buf.toString('base64');
  fs.writeFileSync(path.join(outDir, `${name}.b64.txt`), b64);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  manifest.bundles.push({ key, name, files: groups[key].length, bytes: buf.length, b64: b64.length, sha256: sha });
  console.log(`${name}: 파일 ${groups[key].length}개, ${(buf.length / 1024).toFixed(0)}KB, base64 ${(b64.length / 1024).toFixed(0)}KB`);
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// 배포 묶음 전달 페이지(아티팩트로 올려 GitHub 업로드 화면에 넘김)
const kb = (n) => Math.round(n / 1024).toLocaleString('en-US');
const rows = manifest.bundles.map((b) => `<li><div class="b-main"><b>${b.key === 'a' ? '소스 전체' : b.key === 'b' ? 'OG 이미지' : '상품 표지 ' + b.key.slice(1)}</b><span class="mono">${b.name}</span><small>파일 ${b.files}개 · ${kb(b.bytes)}KB · SHA-256 ${b.sha256.slice(0, 16)}…</small></div><button type="button" data-name="${b.name}" data-sha="${b.sha256}">GitHub로 보내기</button></li>`).join('');
fs.writeFileSync(path.join(outDir, 'index.html'), `<title>논문AI 배포 묶음</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* 한 칸짜리 운영 도구: 묶음 목록과 보내기 단추 */
:root { --bg:#F5F7FB; --card:#FFFFFF; --fg:#0F1B3D; --muted:#5B6478; --line:#DDE3EE; --accent:#2346E8; --accent-fg:#FFFFFF; --ok:#0E7A55; --bad:#B42318;
  --sans:"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif; --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#0D1222; --card:#151B2E; --fg:#E8ECF6; --muted:#9AA3B8; --line:#283049; --accent:#7D95FF; --accent-fg:#0D1222; --ok:#4CC38A; --bad:#FF8F85; color-scheme:dark; } }
:root[data-theme="dark"] { --bg:#0D1222; --card:#151B2E; --fg:#E8ECF6; --muted:#9AA3B8; --line:#283049; --accent:#7D95FF; --accent-fg:#0D1222; --ok:#4CC38A; --bad:#FF8F85; color-scheme:dark; }
body { background:var(--bg); color:var(--fg); font:15px/1.65 var(--sans); padding-block:40px; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); }
main { max-width:600px; margin:0 auto; display:grid; gap:16px; }
h1 { font-size:22px; margin:0; text-wrap:balance; }
p { margin:0; color:var(--muted); }
ul { list-style:none; margin:0; padding:0; display:grid; gap:10px; }
li { display:flex; gap:14px; align-items:center; justify-content:space-between; flex-wrap:wrap; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
.b-main { display:grid; gap:2px; min-width:0; }
.b-main small { color:var(--muted); font-size:12.5px; overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }
.mono { font-family:var(--mono); font-size:13px; color:var(--muted); }
button { font:inherit; font-weight:700; border-radius:10px; padding:10px 16px; border:1px solid var(--accent); background:var(--accent); color:var(--accent-fg); cursor:pointer; }
button:disabled { opacity:.5; cursor:default; }
button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
#msg { font-weight:700; min-height:1.6em; color:var(--fg); }
#msg.ok { color:var(--ok); } #msg.bad { color:var(--bad); }
</style>
<main>
  <h1>논문AI 배포 묶음</h1>
  <p>codediarty/nonmunai 저장소에 올릴 소스 묶음입니다. 단추를 누르면 GitHub 업로드 화면(_upload 폴더)이 열리고, 그 화면에서 zip 파일로 풀려 올라갑니다. 올린 뒤에는 GitHub Actions가 압축을 풀어 테스트, 빌드, 배포까지 이어서 합니다.</p>
  <ul>${rows}</ul>
  <p id="msg" role="status"></p>
</main>
<script>
  var msg = document.getElementById('msg');
  function say(t, c) { msg.textContent = t; msg.className = c || ''; }
  document.querySelectorAll('button[data-name]').forEach(function (b) {
    b.addEventListener('click', function () {
      b.disabled = true; say('묶음을 불러오는 중입니다');
      fetch(b.dataset.name + '.b64.txt').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (t) {
        var w = window.open('https://github.com/codediarty/nonmunai/upload/main/_upload#nmup.' + b.dataset.name + '.' + b.dataset.sha + '.' + t.trim(), '_blank');
        say(w ? b.dataset.name + ' 업로드 화면을 열었습니다' : '새 창을 열지 못했습니다', w ? 'ok' : 'bad');
        b.disabled = false;
      }).catch(function (e) { say('묶음을 불러오지 못했습니다: ' + e.message, 'bad'); b.disabled = false; });
    });
  });
</script>
`);
console.log('upload/index.html 작성');
