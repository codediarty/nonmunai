// 논문 주문: 기본은 한 화면 주문(빠른 주문), ?detail=1이면 단계별 신청서
import { startPaperWizard } from '../app/paper-wizard.js';
import { startQuickOrder } from '../app/quick-order.js';

const root = document.getElementById('app');
if (new URLSearchParams(location.search).get('detail') === '1') startPaperWizard(root);
else startQuickOrder(root);
