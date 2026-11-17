// 가격 안내: 분량별 요금 계산기
import { initTiers } from '../app/tiers.js';

initTiers();

// 다른 페이지의 '전체 가격표 보기'(#all-prices)로 들어오면 접어 둔 전체 가격표를 펼쳐 보여 준다
function openAll() {
  if (location.hash !== '#all-prices') return;
  const d = document.querySelector('#all-prices details');
  if (d && !d.open) d.open = true;
}
openAll();
window.addEventListener('hashchange', openAll);
