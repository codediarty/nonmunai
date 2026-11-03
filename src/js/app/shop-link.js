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
