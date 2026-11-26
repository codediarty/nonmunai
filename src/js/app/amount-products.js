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
