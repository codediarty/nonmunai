// 결제 화면 바로 열기 주소: skkc.co.kr(CloudFront) 주소 한도 8,192바이트 안에 들게 만든다(긴 요청 사항은 앞부분만)
import assert from 'node:assert/strict';
import { shopUrl, fitShopUrl, decodeOrder, SHOP_URL_MAX } from '../../src/js/app/shop-link.js';

export const tests = [];
const t = (name, fn) => tests.push({ name, fn });

const LINK = 'https://skkc.co.kr/shop_view/?idx=100';
const TOPIC = '숏폼 콘텐츠의 협찬 고지 방식과 연출 특성이 수용자의 반발 심리 및 브랜드 진정성 인식에 미치는 영향: 설득지식 활성화의 매개효과와 광고 회의주의의 조절효과를 중심으로 한 대학생 대상 실증 연구와 시사점 탐색';
const payload = (request, extra = {}) => ({
  kind: 'new', service: 'paper', code: 'P-MASTER-FULL', price: 99000, list: 249000, label: '석사학위논문 80 Page', topic: TOPIC.slice(0, 120),
  input: {
    common: { fieldId: 'media', fieldText: '미디어커뮤니케이션 전공 광고홍보 세부전공', school: '', topicKnown: 'free', title: TOPIC.slice(0, 200), keywords: ['숏폼 콘텐츠', '협찬 고지', '반발 심리', '브랜드 진정성', '설득지식'], method: 'auto', due: '2026-12-20', outputFormat: 'hwp', request, ...extra },
    paper: { typeId: 'master', task: 'full', pages: 80, feedbackItems: null, hasToc: 'no', tocText: '', hasFormat: 'no', formatName: '', feedbackText: '', editScope: '', needsData: false },
    addons: { priority: false, format: false, revisions: 0, ppt: false, english: false, editing: false },
  },
});
const nmOf = (href) => decodeOrder(new URL(href).searchParams.get('nm'));
const LONG = Array.from({ length: 200 }, (_, i) => `${i + 1}. 학교 기준은 공백 포함 16,000자 이상이에요.`).join('\n').slice(0, 3000);

t('짧은 요청 사항은 그대로 주소에 담김', () => {
  const r = fitShopUrl(LINK, payload('설문 연구로 해 주세요.\n학교 양식은 결제 후에 보낼게요.'));
  assert.equal(r.cut, false);
  assert.equal(r.href, shopUrl(LINK, payload('설문 연구로 해 주세요.\n학교 양식은 결제 후에 보낼게요.')));
  assert.equal(nmOf(r.href).input.common.request, '설문 연구로 해 주세요.\n학교 양식은 결제 후에 보낼게요.');
});

t('3,000자 요청 사항: 주소가 한도를 넘지 않게 앞부분만 담고 잘렸다고 표시', () => {
  assert.equal(LONG.length, 3000);
  assert.ok(shopUrl(LINK, payload(LONG)).length > 8192, '시험용 요청 사항이 충분히 길지 않음');
  const r = fitShopUrl(LINK, payload(LONG));
  assert.equal(r.cut, true);
  assert.ok(r.href.length <= SHOP_URL_MAX && SHOP_URL_MAX < 8192, `주소 길이 ${r.href.length}`);
  const c = nmOf(r.href).input.common;
  assert.equal(c.requestCut, true);
  assert.ok(c.request.endsWith('…'));
  assert.ok(LONG.startsWith(c.request.slice(0, -1).trimEnd()), '앞부분이 원문과 다름');
  assert.ok(r.kept > 500, `담긴 글자 수가 너무 적음: ${r.kept}`);
  // 한 글자만 더 담아도 한도를 넘는다(가장 길게 담음)
  const more = shopUrl(LINK, payload(`${LONG.slice(0, r.kept + 1).replace(/\s+$/, '')}…`, { requestCut: true }));
  assert.ok(more.length > SHOP_URL_MAX || LONG.slice(0, r.kept + 1).trim() === LONG.slice(0, r.kept).trim(), '더 담을 수 있는데 덜 담음');
  // 전문을 맡긴 열쇠를 더해도 한도 안
  const k = fitShopUrl(LINK, payload(LONG, { requestKey: 'ABCDEFGHJKLMNPQRSTUVWXYZ' }));
  assert.ok(k.href.length <= SHOP_URL_MAX);
  assert.equal(nmOf(k.href).input.common.requestKey, 'ABCDEFGHJKLMNPQRSTUVWXYZ');
});
