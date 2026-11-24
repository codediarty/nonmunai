// 아임웹(skkc.co.kr) 결제 화면으로 바로 잇는 주소 만들기
// 상품 주소 뒤에 nm=(주문 내용)을 붙이면, skkc.co.kr 공통 코드(tools/imweb/skkc-connect.html)가
// 상품 페이지를 건너뛰고 결제 화면을 연 뒤, 결제 화면 위에 논문AI 주문 요약을 보여 준다.
// 주문 내용에는 연락처·조회 키를 넣지 않는다(연락처는 결제 화면에서 받는다).

export function encodeOrder(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeOrder(s) {
  let t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

// 결제 화면 바로 열기 주소(상품 주소가 http(s)일 때만)
export function shopUrl(link, payload) {
  if (!/^https?:\/\//.test(link || '')) return '';
  const u = new URL(link);
  u.searchParams.set('nm', encodeOrder({ v: 1, ...payload }));
  return u.toString();
}

// skkc.co.kr(CloudFront)는 주소가 8,192바이트를 넘으면 414 오류를 낸다(2026-11-24 확인: 8,021자 통과, 8,321자 414).
// 결제 화면 주소는 이 한도보다 넉넉히 짧게 만든다.
export const SHOP_URL_MAX = 7600;

// 요청 사항이 길어 주소에 다 담지 못하면 담을 수 있는 앞부분만 남긴다(requestCut 표시).
// 전문은 서버에 6시간 맡겨 두고 requestKey로 찾아 쓴다(quick-order.js payHref).
export function fitShopUrl(link, payload, max = SHOP_URL_MAX) {
  const href = shopUrl(link, payload);
  const common = (payload && payload.input && payload.input.common) || null;
  const text = common ? String(common.request || '') : '';
  if (!href || href.length <= max || !text) return { href, cut: false, kept: text.length };
  const at = (n) => shopUrl(link, { ...payload, input: { ...payload.input, common: { ...common, request: text.slice(0, n).replace(/\s+$/, '') + '…', requestCut: true } } });
  let lo = 0, hi = text.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (at(mid).length <= max) lo = mid; else hi = mid - 1;
  }
  return { href: at(lo), cut: true, kept: lo };
}
