// Apps Script 백엔드 묶기: backend/src/*.gs + 공용 가격 모듈 → backend/dist/
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'backend/src');
const outDir = path.join(root, 'backend/dist');
mkdirSync(outDir, { recursive: true });

const pricing = readFileSync(path.join(root, 'src/js/core/pricing.js'), 'utf8')
  .replace(/^export\s+/gm, '')
  .replace(/^\/\/ Apps Script에 넣을 때는.*$/m, '');
// 사이트 주소(메일 속 링크)는 site.config.json에서 가져온다
const site = JSON.parse(readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const siteFull = ((process.env.SITE_URL || site.siteUrl) + (process.env.BASE_PATH !== undefined ? process.env.BASE_PATH : (site.basePath || ''))).replace(/\/+$/, '');
const files = readdirSync(srcDir).filter((f) => f.endsWith('.gs')).sort();
const parts = [];
for (const f of files) {
  let code = readFileSync(path.join(srcDir, f), 'utf8');
  if (f.startsWith('00_')) code = code.replace(/siteUrl: \['[^']*'/, `siteUrl: ['${siteFull}'`);
  parts.push({ name: f, code });
  if (f.startsWith('00_')) parts.push({ name: '05_pricing.gs', code: '/**\n * 05_pricing: 가격 계산 (src/js/core/pricing.js에서 자동 생성, 직접 수정 금지)\n */\n' + pricing });
}
for (const p of parts) writeFileSync(path.join(outDir, p.name), p.code);
writeFileSync(path.join(outDir, 'Code.gs'), parts.map((p) => `// ===== ${p.name} =====\n${p.code}`).join('\n\n'));
const manifest = {
  timeZone: 'Asia/Seoul',
  dependencies: {},
  exceptionLogging: 'STACKDRIVER',
  runtimeVersion: 'V8',
  webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' },
  oauthScopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.send_mail',
    'https://www.googleapis.com/auth/script.external_request',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};
writeFileSync(path.join(outDir, 'appsscript.json'), JSON.stringify(manifest, null, 2));
const size = parts.reduce((a, p) => a + p.code.length, 0);
console.log(`backend: ${parts.length} files, ${(size / 1024).toFixed(1)} KB → backend/dist`);
