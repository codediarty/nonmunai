// 검색엔진 색인 알림(IndexNow: 네이버·빙 등): node tools/indexnow.mjs https://nonmunai.kr [--all]
// 배포된 사이트의 sitemap.xml을 읽어, 최근에 내용이 바뀐 주소(lastmod가 어제 이후)만 보낸다. --all이면 전체를 보낸다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const base = (process.argv[2] || site.siteUrl).replace(/^http:\/\/(?!localhost|127\.0\.0\.1)/, 'https://').replace(/\/+$/, '');
const host = new URL(base).host;
const key = site.indexNowKey;
if (!key) { console.log('indexNowKey 없음: 건너뜀'); process.exit(0); }
if (/github\.io$/.test(host)) { console.log('도메인 연결 전(github.io): 건너뜀'); process.exit(0); }

// 인증서 발급 직후에는 https가 늦게 열릴 수 있어 http로 한 번 더 읽는다
let xml = '';
for (const u of [`${base}/sitemap.xml`, `${base.replace(/^https:/, 'http:')}/sitemap.xml`]) {
  try { const r = await fetch(u, { headers: { 'Cache-Control': 'no-cache' } }); if (r.ok) { xml = await r.text(); break; } } catch (e) { console.log(`${u} 읽기 실패: ${e.message}`); }
}
const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => ({ loc: m[1], lastmod: m[2] || '' })).filter((e) => e.loc.startsWith(base));
if (!entries.length) { console.log('sitemap에 주소가 없습니다'); process.exit(0); }
// 한국 날짜 기준 어제 이후에 바뀐 주소만(배포 직후 실행되므로 이번 배포에서 바뀐 주소가 들어간다)
const since = new Date(Date.now() + 9 * 3600e3 - 24 * 3600e3).toISOString().slice(0, 10);
const sendAll = process.argv.includes('--all') || process.env.INDEXNOW_ALL === '1';
const urlList = (sendAll ? entries : entries.filter((e) => !e.lastmod || e.lastmod >= since)).map((e) => e.loc);
if (!urlList.length) { console.log(`바뀐 주소 없음(기준 ${since} 이후): 건너뜀`); process.exit(0); }
console.log(`${sendAll ? '전체' : `${since} 이후 바뀐`} 주소 ${urlList.length}개 / sitemap ${entries.length}개`);
const keyLocation = `${base}/${key}.txt`;
const body = JSON.stringify({ host, key, keyLocation, urlList });
const brief = async (r) => { try { return (await r.text()).replace(/\s+/g, ' ').trim().slice(0, 300); } catch { return ''; } };
for (const ep of ['https://api.indexnow.org/indexnow', 'https://searchadvisor.naver.com/indexnow']) {
  try {
    const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body });
    const ok = r.status === 200 || r.status === 202;
    console.log(`${ep} → ${r.status} (${urlList.length}개)${ok ? '' : ` 응답: ${await brief(r)}`}`);
    // 묶음 전송이 거절되면 주소마다 GET으로 한 번씩 다시 보내 어느 주소가 왜 막혔는지 남긴다(과다 전송을 피해 10개까지)
    if (!ok && r.status !== 429) {
      const tried = urlList.slice(0, 10);
      // 보낸 주소가 홈 하나뿐이면, 사이트 전체가 막힌 것인지 홈만의 문제인지 가르기 위해 최근에 바뀐 하위 주소 하나를 함께 확인한다
      const canary = [...entries].sort((x, y) => (y.lastmod || '').localeCompare(x.lastmod || '')).map((e) => e.loc).find((u) => u !== `${base}/` && !tried.includes(u));
      if (tried.every((u) => u === `${base}/`) && canary) tried.push(canary);
      for (const u of tried) {
        try {
          const g = await fetch(`${ep}?url=${encodeURIComponent(u)}&key=${key}&keyLocation=${encodeURIComponent(keyLocation)}`);
          const gok = g.status === 200 || g.status === 202;
          console.log(`  GET ${u} → ${g.status}${gok ? '' : ` 응답: ${await brief(g)}`}`);
        } catch (e) { console.log(`  GET ${u} 실패: ${e.message}`); }
      }
    }
  } catch (e) { console.log(`${ep} 실패: ${e.message}`); }
}
