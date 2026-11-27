// 통계분석 주문: 기본은 한 화면 주문서(2026-11-27), ?detail=1이면 단계별 신청서
import { startStatsWizard } from '../app/stats-wizard.js';
import { startSimpleOrder } from '../app/simple-order.js';

const root = document.getElementById('app');
if (new URLSearchParams(location.search).get('detail') === '1') startStatsWizard(root);
else startSimpleOrder(root, 'statistics');
