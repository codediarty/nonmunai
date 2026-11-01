// 전체 단위·API 테스트 실행기: node tools/test/run-all.mjs
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
let pass = 0, fail = 0;
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(dir, f)).href);
  for (const { name, fn } of mod.tests) {
    try { await fn(); pass++; console.log(`  ✓ [${f.replace('.test.mjs', '')}] ${name}`); }
    catch (e) { fail++; console.log(`  ✗ [${f.replace('.test.mjs', '')}] ${name}\n     ${e && e.message}`); }
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
