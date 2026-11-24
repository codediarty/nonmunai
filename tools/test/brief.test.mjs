// 운영자 작업지시문(관심 주제 주문의 자동 설계, 데이터 없는 실증 주제의 A안·B안, 빠진 정보 안내)
import assert from 'node:assert/strict';
import { workBrief, aiPrompts, designOf, workingDesign, titleLike, charsRequired } from '../../src/js/admin/brief.js';

export const tests = [];
const t = (name, fn) => tests.push({ name, fn });

const TOPIC = '숏폼 콘텐츠의 협찬 고지 방식과 연출 특성이 수용자의 반발 심리 및 브랜드 진정성 인식에 미치는 영향';
const order = (over = {}) => ({
  orderNo: 'NA261124-TEST', service: 'paper', productName: '학사 졸업논문 30 Page 완성', amount: 59000, paidAmount: 0, eta: '2026-11-27', etaLabel: '11월 27일(금)',
  name: '추테스트', email: 'cust@example.com', phone: '010-5555-6666',
  input: {
    service: 'paper',
    common: { fieldId: 'media', fieldText: '미디어커뮤니케이션', school: '', dept: '', purpose: '', topicKnown: 'free', title: TOPIC, keywords: ['숏폼 콘텐츠의 협찬 고지 방식', '연출 특성'], due: '', outputFormat: 'docx', request: '졸업 논문은 원고지 80매 이상, 공백 포함 16,000자 이상입니다.', method: 'auto', ...(over.common || {}) },
    addons: {},
    paper: { typeId: 'bachelor', task: 'full', hasToc: 'no', tocText: '', hasFormat: 'no', formatName: '', pages: 30, feedbackText: '', editScope: '', needsData: false, ...(over.paper || {}) },
  },
  design: null,
  quote: { mainCode: 'P-BACHELOR-FULL', lines: [{ code: 'P-BACHELOR-FULL', name: '학사 졸업논문 30 Page 완성', qty: 1, amount: 59000 }], total: 59000, includes: ['주제·목차 구성', '장별 본문 30 Page'] },
  files: { customer: over.files || [], results: [] }, links: [], messagesAll: over.messages || [], revisions: { allowed: 1, used: 0 },
});

t('관심 주제가 제목 형태인지 판별(대화체 부탁은 제외)', () => {
  assert.equal(titleLike(TOPIC), true);
  assert.equal(titleLike('간호학과 석사인데, 간호사 이직이랑 번아웃 관련해서 논문 완성해 주세요'), false);
  assert.equal(titleLike('MZ세대 워라밸 논문 써줘'), false);
  assert.equal(titleLike('번아웃'), false);
});

t('요청 사항의 분량 기준을 글자 수로 읽음(공백 포함 N자, 원고지 N매)', () => {
  assert.equal(charsRequired('원고지 80매 이상, 공백 포함 16,000자 이상'), 16000);
  assert.equal(charsRequired('원고지 100매'), 20000);
  assert.equal(charsRequired('표는 APA 7판으로'), 0);
});

t('관심 주제 주문도 자동 설계 초안이 나오고 AI 프롬프트가 생김', () => {
  const d = designOf(order());
  assert.ok(d && d.draft, '관심 주제 주문의 설계 초안 없음');
  assert.equal(d.title, TOPIC);
  assert.ok(aiPrompts(order()).length >= 4, '장별 AI 프롬프트가 없음');
  const chatty = designOf(order({ common: { title: '간호학과 석사인데, 간호사 이직이랑 번아웃 관련해서 논문 완성해 주세요', keywords: ['간호사 이직', '번아웃'], fieldId: 'nursing', fieldText: '간호학' }, paper: { typeId: 'master', pages: 80 } }));
  assert.ok(chatty && chatty.titleSource === 'suggested' && chatty.title, '대화체 주제는 키워드로 제목을 추천해야 함');
});

t('데이터 없는 실증 주제: 기본은 문헌연구 A안, 결과 수치를 만들지 않는다는 지시', () => {
  const o = order();
  const w = workingDesign(o);
  assert.equal(w.variant, 'literature');
  assert.ok(/체계적 문헌고찰$/.test(w.title));
  const b = workBrief(o);
  for (const s of ['■ 연구 방법 정하기(고객 데이터 없음)', '설문 결과나 통계 수치를 만들어 넣지 않습니다', '연구 설계 A안: 문헌연구(기본, 바로 완성)', '연구 설계 B안 요약', '고객 확인 메시지 예시']) assert.ok(b.includes(s), `작업지시문에 '${s}' 없음`);
  const p = aiPrompts(o).map((x) => x.text).join('\n');
  assert.ok(p.includes('검토 개념') && p.includes('[검색 건수 입력]'), '문헌연구 프롬프트 지시 없음');
});

t('고객 데이터가 있거나 고객이 설문을 고르면 설문 설계를 따름', () => {
  const withData = order({ files: [{ slot: 'data', name: 'data.xlsx' }] });
  assert.notEqual(workingDesign(withData).variant, 'literature');
  assert.ok(!workBrief(withData).includes('연구 방법 정하기(고객 데이터 없음)'));
  const picked = order({ common: { method: 'survey' } });
  assert.notEqual(workingDesign(picked).variant, 'literature');
  assert.ok(workBrief(picked).includes('기본: B안'));
});

t('작업지시문: 요청 원문을 위에, 빠진 정보와 분량 기준 점검, 받을 파일, 고객 메시지는 개인정보를 가림', () => {
  const o = order({ messages: [{ from: 'customer', type: 'question', at: '2026-11-24T15:00:00+09:00', text: '추테스트입니다. 010-5555-6666, cust@example.com 으로 연락 주세요. 목차는 5장으로요' }] });
  const b = workBrief(o);
  assert.ok(b.indexOf('■ 고객 요청 사항(원문)') < b.indexOf('■ 견적 내역'), '요청 원문이 위쪽에 없음');
  for (const s of ['받을 파일: 워드(docx)', '■ 확인할 것과 기본 처리', '일반 학위논문 형식(APA 7판)', '공백 포함 16,000자 이상', '11월 27일(금)까지', '목차는 5장으로요']) assert.ok(b.includes(s), `작업지시문에 '${s}' 없음`);
  for (const s of ['추테스트', '010-5555-6666', 'cust@example.com']) assert.ok(!b.includes(s), `작업지시문에 개인정보 '${s}'가 들어감`);
});
