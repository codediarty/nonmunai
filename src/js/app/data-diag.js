// 데이터 파일 사전 진단(통계분석·설문 응답 분석 주문서 공용). 2026-11-27 stats-wizard.js에서 옮김
// 브라우저 안에서만 계산한다(파일 내용은 주문을 접수할 때만 서버로 간다)
import { diagnoseFile } from '../core/diagnose-data.js';
import { esc } from '../core/render.js';
import { ICON } from './wizard.js';

// 화면에 보여 줄 진단 결과(열 목록은 60개까지만 남긴다)
export async function diagnoseData(file) {
  const info = await diagnoseFile(file);
  return { ...info, fileName: file.name, columns: info.columns ? info.columns.slice(0, 60).map((c) => ({ name: c.name, type: c.type, missingRate: c.missingRate, numeric: c.numeric, min: c.min, max: c.max, pii: c.pii })) : [] };
}

// 주문서에 함께 보내는 짧은 진단 요약(input.statistics.dataInfo)
export function compactInfo(i) {
  if (!i || !i.ok) return i ? { ok: false, message: i.message } : null;
  return { n: i.n, vars: i.vars, likert: i.likertCount, missing: Math.round(i.missingRate * 1000) / 10, pii: i.pii, demo: i.demographics, scales: i.scales.map((x) => ({ name: x.name, items: x.items, alpha: x.alpha ? Math.round(x.alpha * 1000) / 1000 : null })) };
}

export function diagHtml(i) {
  if (!i) return '';
  if (!i.ok) return `<p class="hint">${esc(i.message || '')}</p>`;
  const cols = (i.columns || []).slice(0, 40);
  return `<div class="auto-card data-diag"><div class="auto-hd">${ICON.spark}<b>데이터 자동 진단</b><span class="muted">${esc(i.fileName || '')}${i.sheets > 1 ? ` · 첫 번째 시트 기준(시트 ${i.sheets}개)` : ''}</span></div>
<dl class="auto-dl"><div><dt>응답 수</dt><dd>${i.n.toLocaleString('ko-KR')}명</dd></div><div><dt>변수</dt><dd>${i.vars}개</dd></div><div><dt>리커트 문항</dt><dd>${i.likertCount}개</dd></div><div><dt>결측</dt><dd>${(i.missingRate * 100).toFixed(1)}%</dd></div></dl>
${i.scales.length ? `<p class="small"><b>문항 묶음 추정</b> ${i.scales.map((x) => `${esc(x.name)} ${x.items}문항${x.alpha != null ? ` (α=${x.alpha.toFixed(2)})` : ''}`).join(', ')}</p>` : ''}
${i.pii.length ? `<p class="small" style="color:var(--pen)"><b>개인정보로 보이는 열</b> ${i.pii.map(esc).join(', ')}. 지운 뒤 다시 올리는 것을 권장합니다.</p>` : '<p class="small" style="color:var(--green)"><b>개인정보로 보이는 열이 없습니다.</b></p>'}
${cols.length ? `<details><summary class="small">변수 목록 보기</summary><div class="table-wrap"><table class="diag-table"><thead><tr><th>변수</th><th>형태</th><th>결측</th><th>범위</th></tr></thead><tbody>${cols.map((c) => `<tr><td class="${c.pii ? 'pii' : ''}">${esc(c.name)}</td><td>${esc(c.type)}</td><td>${(c.missingRate * 100).toFixed(0)}%</td><td>${c.numeric && c.min != null ? `${c.min}~${c.max}` : '-'}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
<p class="hint">브라우저 안에서 계산한 사전 진단입니다. 최종 분석은 분석가가 직접 실행하고 검수합니다.</p></div>`;
}
