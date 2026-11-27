// 아임웹(skkc.co.kr) '맞춤 견적 결제' 상품: 금액 → 상품 주소(진열 안 함, 논문AI 결제 전용). 2026-11-26
// 설정 skkcLinks([{amount, url}])나 skkcProducts의 "Q-금액"이 있으면 그쪽이 먼저다(pay-plan.js amountLinks).
// tools/imweb/links.json의 Q- 항목과 같게 둔다(tools/test/payplan.test.mjs가 확인).
export const AMOUNT_PRODUCTS = {
  100000: 'https://skkc.co.kr/shop_view/?idx=174',
  200000: 'https://skkc.co.kr/shop_view/?idx=175',
  300000: 'https://skkc.co.kr/shop_view/?idx=176',
  400000: 'https://skkc.co.kr/shop_view/?idx=177',
  500000: 'https://skkc.co.kr/shop_view/?idx=178',
  600000: 'https://skkc.co.kr/shop_view/?idx=179',
  700000: 'https://skkc.co.kr/shop_view/?idx=180',
  800000: 'https://skkc.co.kr/shop_view/?idx=181',
  900000: 'https://skkc.co.kr/shop_view/?idx=182',
  1000000: 'https://skkc.co.kr/shop_view/?idx=183',
};

// 1,000원 단위 결제 상품(2026-11-27): 결제할 상품이 둘 이상이거나 수량이 있는 주문(첨삭 추가 분량, 옵션 등)을
// 이 상품 하나와 수량(금액 ÷ 1,000)으로 결제한다. skkc.co.kr 공통 코드가 상품 페이지에서 수량을 맞춰 결제 화면을 연다.
// 설정 skkcUnitUrl·skkcUnitPrice가 있으면 그쪽이 먼저다(pay-plan.js unitLink). 주소가 비어 있으면 쓰지 않는다.
// 아임웹 상품 #184 '[논문AI] 주문 결제 (1,000원 단위)'(2026-11-27 만듦, 진열·검색 노출 안 함). tools/imweb/links.json의 U-1000과 같게 둔다.
export const UNIT_PRODUCT = { price: 1000, url: 'https://skkc.co.kr/shop_view/?idx=184' };
// 한 번에 담을 수 있는 최대 수량(1,000원 × 3,000 = 300만 원)
export const UNIT_MAX_QTY = 3000;
