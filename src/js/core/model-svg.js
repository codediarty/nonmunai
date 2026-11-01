// 연구모형 SVG 생성 (문자열 반환, DOM 불필요)
// 색상은 CSS 변수(--nm-*)를 우선 사용하고, 없으면 기본색을 씁니다.

let W = 660;
let BW = 156, BH = 62;
let FS = { cap: 10.5, name: 14.5, wrap: 9 };

const ROLE_STYLE = {
  iv: { fill: 'var(--nm-iv-bg,#EEF2FF)', stroke: 'var(--nm-iv,#3D5AFE)', cap: '독립변수' },
  program: { fill: 'var(--nm-iv-bg,#EEF2FF)', stroke: 'var(--nm-iv,#3D5AFE)', cap: '처치(프로그램)' },
  group: { fill: 'var(--nm-iv-bg,#EEF2FF)', stroke: 'var(--nm-iv,#3D5AFE)', cap: '집단 구분' },
  med: { fill: 'var(--nm-med-bg,#ECFDF5)', stroke: 'var(--nm-med,#0E9F6E)', cap: '매개변수' },
  mod: { fill: 'var(--nm-mod-bg,#FFF7ED)', stroke: 'var(--nm-mod,#E07B12)', cap: '조절변수' },
  dv: { fill: 'var(--nm-dv-bg,#F1F5F9)', stroke: 'var(--nm-dv,#0F1B3D)', cap: '종속변수' },
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function wrap(name, max = FS.wrap) {
  const s = String(name);
  if (s.length <= max) return [s];
  const words = s.split(' ');
  if (words.length > 1) {
    const lines = [''];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if ((cur + ' ' + w).trim().length > max && cur) lines.push(w); else lines[lines.length - 1] = (cur + ' ' + w).trim();
    }
    if (lines.length <= 2) return lines;
    return [lines[0], lines.slice(1).join(' ').slice(0, max) + '…'];
  }
  return [s.slice(0, max), s.length > max * 2 ? s.slice(max, max * 2 - 1) + '…' : s.slice(max)];
}

function box(n, x, y, capOverride) {
  const base = ROLE_STYLE[n.role] || ROLE_STYLE.dv;
  const st = capOverride ? { ...base, cap: capOverride } : base;
  const lines = wrap(n.name);
  const cy = y + BH / 2;
  const nameY = lines.length === 1 ? cy + FS.name * 0.66 : cy + 3;
  let t = `<g class="nm-node nm-${n.role}">`;
  t += `<rect x="${x}" y="${y}" width="${BW}" height="${BH}" rx="12" style="fill:${st.fill};stroke:${st.stroke}" stroke-width="1.6"/>`;
  t += `<text x="${x + BW / 2}" y="${y + 18}" text-anchor="middle" style="fill:${st.stroke}" font-size="${FS.cap}" font-weight="600" letter-spacing=".02em">${esc(st.cap)}</text>`;
  lines.forEach((ln, i) => {
    t += `<text x="${x + BW / 2}" y="${nameY + i * 16}" text-anchor="middle" style="fill:var(--nm-ink,#0F1B3D)" font-size="${FS.name}" font-weight="700">${esc(ln)}</text>`;
  });
  return t + '</g>';
}

function anchor(p, toward) {
  // 상자 경계에서 시작·끝점 계산
  const cx = p.x + BW / 2, cy = p.y + BH / 2;
  const dx = toward.x - cx, dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = (BW / 2) / Math.abs(dx || 1e-9), sy = (BH / 2) / Math.abs(dy || 1e-9);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

function center(p) { return { x: p.x + BW / 2, y: p.y + BH / 2 }; }

function arrow(a, b, { dashed = false, both = false, label = '', labelPos = 0.5, cls = '' } = {}) {
  const A = anchor(a, center(b)), B = anchor(b, center(a));
  const pad = 4;
  const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  const ux = (B.x - A.x) / len, uy = (B.y - A.y) / len;
  const x1 = A.x + ux * (both ? pad + 6 : pad), y1 = A.y + uy * (both ? pad + 6 : pad);
  const x2 = B.x - ux * (pad + 6), y2 = B.y - uy * (pad + 6);
  let t = `<line class="nm-edge ${cls}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" style="stroke:var(--nm-line,#41506B)" stroke-width="1.8" ${dashed ? 'stroke-dasharray="6 5"' : ''} marker-end="url(#nmArrow)" ${both ? 'marker-start="url(#nmArrowStart)"' : ''}/>`;
  if (label) {
    const lx = x1 + (x2 - x1) * labelPos, ly = y1 + (y2 - y1) * labelPos - (Math.hypot(x2 - x1, y2 - y1) < 80 ? 17 : 0);
    t += pill(lx, ly, label);
  }
  return { svg: t, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } };
}

function pill(x, y, label) {
  const w = 12 + label.length * 7.2;
  return `<g class="nm-h"><rect x="${(x - w / 2).toFixed(1)}" y="${(y - 10).toFixed(1)}" width="${w.toFixed(1)}" height="20" rx="10" style="fill:var(--nm-pill,#FFFFFF);stroke:var(--nm-pill-line,#CBD3E1)"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--nm-ink,#0F1B3D)">${esc(label)}</text></g>`;
}

function defs() {
  return `<defs><marker id="nmArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--nm-line,#41506B)"/></marker><marker id="nmArrowStart" viewBox="0 0 10 10" refX="1.5" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto"><path d="M10 0L0 5L10 10z" style="fill:var(--nm-line,#41506B)"/></marker></defs>`;
}

function stack(nodes, x, height) {
  const gap = 22;
  const total = nodes.length * BH + (nodes.length - 1) * gap;
  const y0 = (height - total) / 2;
  return nodes.map((n, i) => ({ n, x, y: y0 + i * (BH + gap) }));
}

export function renderModelSVG(model, { title = '연구모형', showControls = true, compact = false } = {}) {
  if (!model || !model.quantitative || !model.nodes.length) return '';
  if (compact) { W = 540; BW = 138; BH = 62; FS = { cap: 11.5, name: 15.5, wrap: 8 }; }
  else { W = 660; BW = 156; BH = 62; FS = { cap: 10.5, name: 14.5, wrap: 9 }; }
  const by = (r) => model.nodes.filter((n) => n.role === r);
  const left = [...by('iv'), ...by('program'), ...by('group')];
  const meds = by('med'), mods = by('mod'), dvs = by('dv');
  const pos = {};
  const parts = [];
  let height;

  const rowsOf = (arr) => Math.max(arr.length, 1);
  if (meds.length && model.design !== 'serial') {
    // 매개모형: 매개변수는 위 가운데, 독립·종속은 아래 양쪽
    const topY = 26;
    const rowY = topY + BH + 72;
    const rows = Math.max(rowsOf(left), rowsOf(dvs));
    height = rowY + rows * BH + (rows - 1) * 22 + 24;
    left.forEach((n, i) => (pos[n.id] = { n, x: 24, y: rowY + i * (BH + 22) }));
    dvs.forEach((n, i) => (pos[n.id] = { n, x: W - BW - 24, y: rowY + i * (BH + 22) }));
    const mw = meds.length * BW + (meds.length - 1) * 24;
    meds.forEach((m, i) => (pos[m.id] = { n: m, x: (W - mw) / 2 + i * (BW + 24), y: topY }));
    mods.forEach((m, i) => (pos[m.id] = { n: m, x: 24, y: topY - 4 + i * (BH + 10) }));
  } else if (model.design === 'serial' && meds.length >= 2) {
    // 순차 매개: 매개변수들을 위쪽에 좌→우로 배치
    const topY = 26;
    const rowY = topY + BH + 72;
    const rows = Math.max(rowsOf(left), rowsOf(dvs));
    height = rowY + rows * BH + (rows - 1) * 22 + 24;
    left.forEach((n, i) => (pos[n.id] = { n, x: 24, y: rowY + i * (BH + 22) }));
    dvs.forEach((n, i) => (pos[n.id] = { n, x: W - BW - 24, y: rowY + i * (BH + 22) }));
    const gap = meds.length > 2 ? 18 : 44;
    const mw = meds.length * BW + (meds.length - 1) * gap;
    meds.forEach((m, i) => (pos[m.id] = { n: m, x: (W - mw) / 2 + i * (BW + gap), y: topY }));
  } else {
    // 기본·조절·차이·상관 모형
    const hasMod = mods.length > 0;
    const top = hasMod ? 26 + BH + 56 : 22;
    const rows = Math.max(rowsOf(left), rowsOf(dvs));
    height = top + rows * BH + (rows - 1) * 22 + 22;
    const colY = (arr, i) => top + ((rows - arr.length) * (BH + 22)) / 2 + i * (BH + 22);
    left.forEach((n, i) => (pos[n.id] = { n, x: 24, y: colY(left, i) }));
    dvs.forEach((n, i) => (pos[n.id] = { n, x: W - BW - 24, y: colY(dvs, i) }));
    const mw = mods.length * BW + (mods.length - 1) * 16;
    mods.forEach((m, i) => (pos[m.id] = { n: m, x: (W - mw) / 2 + i * (BW + 16), y: 22 }));
  }

  if (showControls && model.design !== 'program' && model.design !== 'difference') height += 26;

  // 경로
  const edgeMid = {};
  const targeted = new Set(model.edges.filter((x) => x.kind === 'mod').map((x) => x.toEdge));
  for (const e of model.edges) {
    if (e.kind === 'mod') continue;
    const a = pos[e.from], b = pos[e.to];
    if (!a || !b) continue;
    const r = arrow(a, b, { dashed: e.kind === 'direct', both: e.kind === 'corr', label: e.h, labelPos: targeted.has(`${e.from}>${e.to}`) ? 0.24 : 0.5, cls: e.kind });
    edgeMid[`${e.from}>${e.to}`] = r.mid;
    parts.push(r.svg);
  }
  for (const e of model.edges.filter((x) => x.kind === 'mod')) {
    const m = pos[e.from];
    const mid = edgeMid[e.toEdge];
    if (!m || !mid) continue;
    const start = anchor(m, mid);
    const len = Math.hypot(mid.x - start.x, mid.y - start.y) || 1;
    const ux = (mid.x - start.x) / len, uy = (mid.y - start.y) / len;
    const x2 = mid.x - ux * 4, y2 = mid.y - uy * 4;
    parts.push(`<line class="nm-edge mod" x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" style="stroke:var(--nm-mod,#E07B12)" stroke-width="1.8" marker-end="url(#nmArrow)"/>`);
    parts.push(`<circle cx="${mid.x.toFixed(1)}" cy="${mid.y.toFixed(1)}" r="3.6" style="fill:var(--nm-mod,#E07B12)"/>`);
    parts.push(pill(start.x + (x2 - start.x) * 0.42 + (Math.abs(x2 - start.x) < 30 ? 20 : 0), start.y + (y2 - start.y) * 0.42 - (Math.abs(x2 - start.x) < 30 ? 0 : 12), e.h));
  }
  for (const id of Object.keys(pos)) parts.push(box(pos[id].n, pos[id].x, pos[id].y, model.design === 'relation' ? '주요 변인' : ''));
  if (showControls && model.design !== 'program' && model.design !== 'difference') {
    parts.push(`<text x="${W - 24}" y="${height - 10}" text-anchor="end" font-size="11" style="fill:var(--nm-muted,#6B7487)">통제변수: 성별, 연령 등 일반적 특성 · 점선은 직접효과</text>`);
  }
  if (model.design === 'program') {
    parts.push(`<text x="${W / 2}" y="${height - 6}" text-anchor="middle" font-size="11" style="fill:var(--nm-muted,#6B7487)">실험군·대조군 사전-사후 측정</text>`);
  }
  return `<svg class="nm-model" viewBox="0 0 ${W} ${Math.ceil(height)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}" font-family="Pretendard Variable, Pretendard, -apple-system, 'Noto Sans KR', sans-serif">${defs()}${parts.join('')}</svg>`;
}
