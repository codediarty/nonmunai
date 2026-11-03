// 논문AI 브랜드 심볼: 오른쪽 위 모서리가 접힌 종이 같은 N(접힌 면은 브랜드 블루)
// 사이트 머리·바닥, 파비콘, OG 이미지, 아임웹 상품 이미지가 모두 이 모양을 쓴다
export const BRAND = { navy: '#0B1633', blue: '#2346E8', blueLight: '#8EA2FF' };
export const MARK_N = 'M5 35V5h8.2l13.4 18.6V13.4H35V35h-8.2L13.4 16.4V35z';
export const MARK_FOLD = 'M26.6 5L35 13.4h-8.4z';

// 인라인 심볼(CSS로 색을 바꿀 수 있게 class를 단다)
export function brandMark({ size = 32, ink = BRAND.navy, fold = BRAND.blue, cls = 'bm' } = {}) {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path class="bm-n" d="${MARK_N}" fill="${ink}"/><path class="bm-f" d="${MARK_FOLD}" fill="${fold}"/></svg>`;
}

// 파비콘(SVG): 어두운 탭에서는 흰색으로
export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><style>.n{fill:${BRAND.navy}}.f{fill:${BRAND.blue}}@media (prefers-color-scheme:dark){.n{fill:#fff}.f{fill:${BRAND.blueLight}}}</style><path class="n" d="${MARK_N}"/><path class="f" d="${MARK_FOLD}"/></svg>`;

// 앱 아이콘(PNG용): 남색 바탕에 흰 N
export const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${BRAND.navy}"/><g transform="translate(14 14) scale(0.9)"><path d="${MARK_N}" fill="#fff"/><path d="${MARK_FOLD}" fill="${BRAND.blueLight}"/></g></svg>`;
