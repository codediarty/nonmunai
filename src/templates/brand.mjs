// 논문AI 브랜드 심볼: 둥근 사각 타일 위에 펼친 책 한 권(논문을 펼쳐 읽고 검수한다는 뜻)
// 타일은 로열 블루에서 네이비로 흐르는 그라데이션, 책은 흰 두 면과 그 아래 겹친 종이 결
// 사이트 머리·바닥, 파비콘, 앱 아이콘, OG 이미지, 아임웹 상품 이미지가 모두 이 모양을 쓴다
export const BRAND = {
  navy: '#0B1633',
  blue: '#2346E8',
  blueLight: '#8EA2FF',
  // 심볼 타일: 밝은 바탕용(기본)과 어두운 바탕용(밝은 변형)
  tile: ['#1340B8', '#081C55'],
  tileBright: ['#3159F2', '#1834A8'],
};

// 40×40 기준 좌표: 왼쪽·오른쪽 면, 그 아래 겹친 종이
export const BOOK = {
  pages: [
    'M19.25 14.2C17.5 11.9 13.6 10.9 9.6 11.2L7 26.4C11.3 25.3 16.4 25.8 19.25 28.6Z',
    'M20.75 14.2C22.5 11.9 26.4 10.9 30.4 11.2L33 26.4C28.7 25.3 23.6 25.8 20.75 28.6Z',
  ],
  edges: [
    'M7.3 27.6C11.5 26.6 16.4 27.1 19.25 29.8C16 28.5 11.2 28.2 6.8 29.25Z',
    'M32.7 27.6C28.5 26.6 23.6 27.1 20.75 29.8C24 28.5 28.8 28.2 33.2 29.25Z',
  ],
};

// 책 모양(흰색): 모서리를 살짝 둥글게(stroke)
export function bookShape(ink = '#FFFFFF') {
  return `<g transform="translate(20 20) scale(1.08) translate(-20 -20.5)" fill="${ink}" stroke="${ink}" stroke-width="0.7" stroke-linejoin="round">${BOOK.pages.map((d) => `<path d="${d}"/>`).join('')}<g opacity="0.6" stroke-width="0.3">${BOOK.edges.map((d) => `<path d="${d}"/>`).join('')}</g></g>`;
}

const tileFill = (id, [a, b]) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;

// 인라인 심볼: 한 페이지에 여러 번 들어가도 그라데이션 id가 겹치지 않게 번호를 붙인다
let seq = 0;
export function brandMark({ size = 32, bright = false, square = false, cls = 'bm' } = {}) {
  const id = `bmg${++seq}`;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">${tileFill(id, bright ? BRAND.tileBright : BRAND.tile)}<rect width="40" height="40" rx="${square ? 0 : 9.5}" fill="url(#${id})"/>${bookShape()}</svg>`;
}

// 파비콘(SVG): 둥근 타일 그대로
export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${tileFill('g', BRAND.tile)}<rect width="40" height="40" rx="9.5" fill="url(#g)"/>${bookShape()}</svg>`;

// 앱 아이콘(PNG용): 기기가 모서리를 직접 둥글게 깎으므로 꽉 찬 사각형
export const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${tileFill('g', BRAND.tile)}<rect width="40" height="40" fill="url(#g)"/>${bookShape()}</svg>`;
