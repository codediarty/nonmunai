/**
 * 05_pricing: 가격 계산 (src/js/core/pricing.js에서 자동 생성, 직접 수정 금지)
 */
// 논문AI 가격표와 견적 계산 (브라우저·Apps Script 공용)


var DEFAULT_CATALOG = {
  version: '2026-11-01b',
  currency: 'KRW',
  items: [
    // 논문: 유형별 4개 작업. unit = 추가 분량 과금 단위
    { code: 'P-MASTER-FULL', service: 'paper', type: 'master', task: 'full', name: '석사학위논문 전체 구성·초고 완성', price: 159000, baseUnits: 60, unitLabel: '쪽', unitSize: 10, unitPrice: 19000, days: 5, includes: ['연구 설계서(연구모형·가설·분석 계획)', '목차 확정본', '서론부터 결론까지 장별 초고(기준 60쪽 내외)', 'APA 7판 참고문헌 정리', '수정 1회'] },
    { code: 'P-MASTER-EDIT', service: 'paper', type: 'master', task: 'edit', name: '석사학위논문 첨삭·교정', price: 49000, baseUnits: 30, unitLabel: '쪽', unitSize: 10, unitPrice: 19000, days: 2, includes: ['요청 범위 문장·논리 첨삭(기준 30쪽)', '수정 내역 표시본과 정리본', '형식·인용 점검'] },
    { code: 'P-MASTER-FB', service: 'paper', type: 'master', task: 'feedback', name: '석사학위논문 교수님 피드백 반영', price: 59000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 19000, days: 2, includes: ['피드백 항목별 수정(기준 10개 항목)', '수정 대조표 작성(의견·수정 내용·쪽)', '반영 부분 파란색 표시본', '최종 정리본'] },
    { code: 'P-MASTER-PROP', service: 'paper', type: 'master', task: 'proposal', name: '석사학위논문 연구계획서 작성', price: 69000, baseUnits: 15, unitLabel: '쪽', unitSize: 5, unitPrice: 19000, days: 3, includes: ['연구 주제·제목 확정안', '연구 목적과 필요성', '이론적 배경 요약과 연구모형', '연구 방법·분석 계획', '참고문헌'] },
    { code: 'P-DOCTOR-FULL', service: 'paper', type: 'doctor', task: 'full', name: '박사학위논문 전체 구성·초고 완성', price: 299000, baseUnits: 120, unitLabel: '쪽', unitSize: 10, unitPrice: 29000, days: 10, includes: ['연구 설계서와 연구모형', '목차 확정본', '장별 초고(기준 120쪽 내외)', 'APA 7판 참고문헌 정리', '수정 1회'] },
    { code: 'P-DOCTOR-EDIT', service: 'paper', type: 'doctor', task: 'edit', name: '박사학위논문 첨삭·교정', price: 69000, baseUnits: 40, unitLabel: '쪽', unitSize: 10, unitPrice: 19000, days: 3, includes: ['요청 범위 문장·논리 첨삭(기준 40쪽)', '수정 내역 표시본과 정리본', '형식·인용 점검'] },
    { code: 'P-DOCTOR-FB', service: 'paper', type: 'doctor', task: 'feedback', name: '박사학위논문 교수님 피드백 반영', price: 89000, baseUnits: 15, unitLabel: '항목', unitSize: 5, unitPrice: 19000, days: 3, includes: ['피드백 항목별 수정(기준 15개 항목)', '수정 대조표 작성(의견·수정 내용·쪽)', '반영 부분 파란색 표시본', '최종 정리본'] },
    { code: 'P-DOCTOR-PROP', service: 'paper', type: 'doctor', task: 'proposal', name: '박사학위논문 연구계획서 작성', price: 99000, baseUnits: 25, unitLabel: '쪽', unitSize: 5, unitPrice: 19000, days: 4, includes: ['연구 주제·제목 확정안', '연구 목적과 독창성', '이론적 배경과 연구모형', '연구 방법·분석 계획', '참고문헌'] },
    { code: 'P-JOURNAL-FULL', service: 'paper', type: 'journal', task: 'full', name: '학술지 투고논문 전체 구성·초고 완성', price: 99000, baseUnits: 20, unitLabel: '쪽', unitSize: 5, unitPrice: 19000, days: 4, includes: ['투고 학술지 형식 기준 원고 초고(기준 20쪽)', '국문·영문 초록', '참고문헌 정리', '수정 1회'] },
    { code: 'P-JOURNAL-EDIT', service: 'paper', type: 'journal', task: 'edit', name: '학술지 투고논문 첨삭·교정', price: 39000, baseUnits: 20, unitLabel: '쪽', unitSize: 5, unitPrice: 9000, days: 2, includes: ['원고 첨삭(기준 20쪽)', '투고 규정 형식 점검', '수정 내역 표시본'] },
    { code: 'P-JOURNAL-FB', service: 'paper', type: 'journal', task: 'feedback', name: '학술지 심사 의견 반영(수정 보완)', price: 49000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 19000, days: 2, includes: ['심사 의견별 수정', '심사 의견 답변서(Response letter) 작성', '반영 부분 파란색 표시본', '최종 정리본'] },
    { code: 'P-BACHELOR-FULL', service: 'paper', type: 'bachelor', task: 'full', name: '학사·졸업논문 전체 구성·초고 완성', price: 79000, baseUnits: 30, unitLabel: '쪽', unitSize: 10, unitPrice: 19000, days: 3, includes: ['주제·목차 구성', '장별 초고(기준 30쪽)', '참고문헌 정리', '수정 1회'] },
    { code: 'P-BACHELOR-EDIT', service: 'paper', type: 'bachelor', task: 'edit', name: '학사·졸업논문 첨삭·교정', price: 29000, baseUnits: 20, unitLabel: '쪽', unitSize: 10, unitPrice: 9000, days: 2, includes: ['원고 첨삭(기준 20쪽)', '수정 내역 표시본'] },
    { code: 'P-BACHELOR-FB', service: 'paper', type: 'bachelor', task: 'feedback', name: '학사·졸업논문 교수님 피드백 반영', price: 39000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 9000, days: 2, includes: ['피드백 항목별 수정', '수정 대조표 작성', '반영 부분 파란색 표시본'] },
    { code: 'P-BACHELOR-PROP', service: 'paper', type: 'bachelor', task: 'proposal', name: '학사·졸업논문 연구계획서 작성', price: 29000, baseUnits: 8, unitLabel: '쪽', unitSize: 4, unitPrice: 9000, days: 2, includes: ['주제·제목 확정안', '연구 목적과 방법', '목차안', '참고문헌'] },
    { code: 'P-REPORT-FULL', service: 'paper', type: 'report', task: 'full', name: '일반 연구보고서 전체 구성·초고 완성', price: 59000, baseUnits: 20, unitLabel: '쪽', unitSize: 10, unitPrice: 19000, days: 3, includes: ['보고서 구성안', '본문 초고(기준 20쪽)', '참고자료 정리', '수정 1회'] },
    { code: 'P-REPORT-EDIT', service: 'paper', type: 'report', task: 'edit', name: '일반 연구보고서 첨삭·교정', price: 29000, baseUnits: 20, unitLabel: '쪽', unitSize: 10, unitPrice: 9000, days: 2, includes: ['원고 첨삭(기준 20쪽)', '수정 내역 표시본'] },
    { code: 'P-REPORT-FB', service: 'paper', type: 'report', task: 'feedback', name: '일반 연구보고서 검토 의견 반영', price: 29000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 9000, days: 2, includes: ['의견 항목별 수정', '수정 대조표 작성', '반영 부분 파란색 표시본'] },
    { code: 'P-YOUTH-FULL', service: 'paper', type: 'youth', task: 'full', name: '청소년 탐구논문 구성·초고 완성', price: 39000, baseUnits: 10, unitLabel: '쪽', unitSize: 5, unitPrice: 9000, days: 2, includes: ['탐구 주제·질문 정리', '탐구 보고서 초고(기준 10쪽)', '참고자료 정리', '수정 1회'] },
    { code: 'P-YOUTH-EDIT', service: 'paper', type: 'youth', task: 'edit', name: '청소년 탐구논문 첨삭·교정', price: 19000, baseUnits: 10, unitLabel: '쪽', unitSize: 5, unitPrice: 9000, days: 1, includes: ['원고 첨삭(기준 10쪽)', '수정 내역 표시본'] },
    { code: 'P-YOUTH-FB', service: 'paper', type: 'youth', task: 'feedback', name: '청소년 탐구논문 선생님 피드백 반영', price: 19000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 9000, days: 1, includes: ['피드백 항목별 수정', '수정 대조표 작성', '반영 부분 파란색 표시본'] },
    { code: 'P-PERSONAL-FULL', service: 'paper', type: 'personal', task: 'full', name: '개인 관심연구 구성·초고 완성', price: 49000, baseUnits: 15, unitLabel: '쪽', unitSize: 5, unitPrice: 9000, days: 3, includes: ['연구 질문 정리', '연구 원고 초고(기준 15쪽)', '참고문헌 정리', '수정 1회'] },
    { code: 'P-PERSONAL-EDIT', service: 'paper', type: 'personal', task: 'edit', name: '개인 관심연구 첨삭·교정', price: 19000, baseUnits: 15, unitLabel: '쪽', unitSize: 5, unitPrice: 9000, days: 2, includes: ['원고 첨삭(기준 15쪽)', '수정 내역 표시본'] },
    { code: 'P-SHORT-FULL', service: 'paper', type: 'short', task: 'full', name: '소논문 8쪽 구성·초고 완성', price: 29000, baseUnits: 8, unitLabel: '쪽', unitSize: 4, unitPrice: 9000, days: 2, includes: ['주제와 연구 질문 정리', '소논문 원고 초고(기준 8쪽)', '실존 참고문헌과 본문 인용', '수정 1회'] },
    { code: 'P-PERSONAL-FB', service: 'paper', type: 'personal', task: 'feedback', name: '개인 관심연구 피드백 반영', price: 19000, baseUnits: 10, unitLabel: '항목', unitSize: 5, unitPrice: 9000, days: 2, includes: ['의견 항목별 수정', '수정 대조표 작성', '반영 부분 파란색 표시본'] },
    // 묶음 상품: 가장 많이 찾는 분량을 상품 하나로 결제(본 상품 + 추가 분량과 금액이 같을 때만 결제 화면에서 씀)
    { code: 'P-MASTER-FULL-80', service: 'paper', type: 'master', task: 'full', name: '석사학위논문 80쪽 전체 구성·초고 완성', price: 197000, baseUnits: 80, unitLabel: '쪽', days: 6, includes: ['연구 설계서(연구모형·가설·분석 계획)', '목차 확정본', '서론부터 결론까지 장별 초고(80쪽)', 'APA 7판 참고문헌 정리', '수정 1회'] },
    { code: 'P-DOCTOR-FULL-130', service: 'paper', type: 'doctor', task: 'full', name: '박사학위논문 130쪽 전체 구성·초고 완성', price: 328000, baseUnits: 130, unitLabel: '쪽', days: 11, includes: ['연구 설계서와 연구모형', '목차 확정본', '장별 초고(130쪽)', 'APA 7판 참고문헌 정리', '수정 1회'] },
    // 설문조사
    { code: 'S-FULL', service: 'survey', task: 'full', name: '설문조사 원스톱: 설문지 작성부터 통계 해석까지', price: 129000, days: 4, includes: ['연구 목적에 맞는 설문지 작성(검증된 척도)', '온라인 설문 제작과 설문조사 진행 관리', '응답 데이터 정리·익명화', '논문 맞춤 통계 분석과 결과 해석', '연구결과 정리'], excludes: ['응답자 모집·사례비(모집 의뢰 시 별도 견적)'] },
    { code: 'S-NEW', service: 'survey', task: 'new', name: '설문지 작성', price: 39000, days: 2, includes: ['연구 변인별 검증된 척도 선정과 문항 구성', '인구통계 문항 구성', '설문지 파일(Word)', '배포용 온라인 설문 링크'] },
    { code: 'S-EDIT', service: 'survey', task: 'edit', name: '설문지 점검·수정', price: 29000, days: 1, includes: ['문항 구성·표현 점검과 수정', '척도 구성 점검', '수정본과 수정 내역'] },
    { code: 'S-FB', service: 'survey', task: 'feedback', name: '설문지 교수님 피드백 반영', price: 29000, days: 1, includes: ['피드백 항목별 수정', '수정 대조표 작성', '반영 부분 파란색 표시본'] },
    { code: 'S-ANALYZE', service: 'survey', task: 'analyze', name: '설문 응답 통계 분석·해석', price: 69000, days: 3, includes: ['응답 데이터 정리·결측 점검', '연구 가설에 맞는 분석(신뢰도·기술통계·가설 검증)', 'APA 형식 통계표와 결과 해석'] },
    { code: 'S-RECRUIT', service: 'survey', task: 'recruit', name: '응답자 모집·배포 대행', price: 0, quoteOnly: true, days: 0, includes: ['모집 경로·일정·표본 계획 수립', '참여 동의 절차와 개인정보 보호 안내', '모집 진행 현황 공유'], excludes: ['IRB 심의 비용'] },
    // 통계분석
    { code: 'T-BASIC', service: 'statistics', task: 'table', name: '논문 맞춤 통계분석 기본형', price: 49000, days: 2, includes: ['데이터 점검·정리', '주제와 데이터에 맞는 분석 실행', 'APA 형식 통계표', '핵심 결과 해석'] },
    { code: 'T-INTERP', service: 'statistics', task: 'interp', name: '논문 맞춤 통계분석 표준형', price: 69000, days: 3, includes: ['연구 주제·가설에 맞는 분석 설계', '데이터 점검·정리', '분석 실행(SPSS·PROCESS 등)', 'APA 형식 통계표', '표별 결과 해석과 설명'] },
    { code: 'T-CHAPTER', service: 'statistics', task: 'chapter', name: '논문 맞춤 통계분석과 연구결과 작성', price: 99000, days: 4, includes: ['표준형 분석 전체(분석 설계·통계표·해석)', '연구결과(4장) 본문 작성', '표·그림 번호 정리'] },
    { code: 'T-FB', service: 'statistics', task: 'revise', name: '통계 재분석·교수님 피드백 반영', price: 39000, days: 2, includes: ['피드백 항목별 재분석·수정', '수정된 통계표', '수정 대조표 작성', '반영 부분 파란색 표시'] },
    { code: 'T-SIM', service: 'statistics', task: 'simulation', name: '학습용 시뮬레이션 데이터 분석', price: 19000, days: 2, includes: ['교육용 가상 데이터 생성', '분석 절차 실습 결과와 해설'], excludes: ['실제 연구 결과로 사용 불가(가상 데이터 표시)'] },
    { code: 'T-ADV', service: 'statistics', task: 'advanced', name: '심화 분석(매개·조절효과)', price: 19000, days: 1, addon: true, includes: ['PROCESS Macro 매개·조절효과 분석'] },
    // 공통 추가 옵션: 심사 발표 PPT, 영문 논문 작성(10쪽 단위)이 앞, 일정·형식 옵션이 뒤
    { code: 'A-PPT', service: 'addon', name: '심사 발표 PPT 제작', price: 39000, days: 1, addon: true, includes: ['논문 핵심을 담은 발표 자료(15~20장)', '장표별 발표 스크립트', '표·그림을 살린 학술 발표 디자인'] },
    { code: 'A-ENGLISH', service: 'addon', name: '영문 논문 작성(10쪽 단위)', price: 29000, baseUnits: 0, unitLabel: '쪽', unitSize: 10, unitPrice: 29000, days: 3, addon: true, includes: ['학술 영어로 원고 작성', '영문 초록과 주제어', '영문 참고문헌 형식 정리'] },
    { code: 'A-PRIORITY', service: 'addon', name: '우선 처리', price: 29000, addon: true, includes: ['작업 순서를 앞당겨 납기 단축(가능한 경우에만 선택 가능)'] },
    { code: 'A-FORMAT', service: 'addon', name: '학교·학술지 양식 상세 적용', price: 19000, addon: true, includes: ['제출 양식(여백·글꼴·표·그림·목차 서식) 상세 적용'] },
    { code: 'A-REVISION', service: 'addon', name: '추가 수정 1회', price: 19000, addon: true, includes: ['전달 후 수정 요청 1회 추가'] },
  ],
  settings: {
    priorityEnabled: true,
    vatIncluded: true,
    payInFullDiscountRate: 0,
  },
};

var TASK_LABELS = { full: '전체 구성·초고 완성', edit: '논문 첨삭·교정', feedback: '교수님 피드백 반영', proposal: '연구계획서 작성' };

// 논문 첨삭 추가 옵션이 쓸 수 있는 논문 유형
var EDIT_TYPES = ['master', 'doctor', 'journal', 'bachelor', 'report', 'youth', 'personal'];

function findItem(catalog, code) {
  var items = (catalog && catalog.items) || [];
  for (var i = 0; i < items.length; i++) if (items[i].code === code && items[i].active !== false) return items[i];
  return null;
}

function paperItemCode(typeId, task) {
  return 'P-' + String(typeId || 'master').toUpperCase() + '-' + ({ full: 'FULL', edit: 'EDIT', feedback: 'FB', proposal: 'PROP' }[task] || 'FULL');
}

// 포함 항목의 '기준 N쪽(내외)' 표기를 실제 주문 분량으로 바꾼다(주문한 쪽수가 있을 때만)
function includesFor(list, pages) {
  const n = Number(pages) || 0;
  return (list || []).map((x) => (n > 0 ? String(x).replace(/\(기준\s*\d+쪽(\s*내외)?\)/, `(${n}쪽)`) : x));
}

function won(n) {
  return (Math.round(Number(n) || 0)).toLocaleString('ko-KR') + '원';
}

function line(item, opts) {
  opts = opts || {};
  var qty = opts.qty || 1;
  var unit = opts.unitPrice != null ? opts.unitPrice : item.price;
  return { code: item.code, name: opts.name || item.name, qty: qty, unitPrice: unit, amount: unit * qty, note: opts.note || '' };
}

// 주문 입력(정규화된 형태)으로 견적 계산
function computeQuote(catalog, input) {
  catalog = catalog || DEFAULT_CATALOG;
  input = input || {};
  var lines = [];
  var reasons = [];
  var notes = [];
  var includes = [];
  var excludes = [];
  var days = 0;
  var main = null;
  var service = input.service;

  if (service === 'paper') {
    var p = input.paper || {};
    main = findItem(catalog, paperItemCode(p.typeId, p.task));
    if (!main) main = findItem(catalog, paperItemCode(p.typeId, 'full'));
    if (main) {
      lines.push(line(main));
      days = main.days || 0;
      includes = (main.includes || []).slice();
      // 추가 분량
      var units = null;
      if (main.unitLabel === '항목') units = p.feedbackItems != null ? Number(p.feedbackItems) : null;
      else units = p.pages != null && p.pages !== '' ? Number(p.pages) : null;
      if (units != null && units > main.baseUnits) {
        var extraBlocks = Math.ceil((units - main.baseUnits) / main.unitSize);
        lines.push({ code: main.code + '-X', name: '추가 분량 (' + main.unitSize + main.unitLabel + ' 단위 × ' + extraBlocks + ')', qty: extraBlocks, unitPrice: main.unitPrice, amount: main.unitPrice * extraBlocks, note: '기준 ' + main.baseUnits + main.unitLabel + ' 초과 ' + (units - main.baseUnits) + main.unitLabel });
        days += Math.min(5, Math.ceil(extraBlocks / 2));
      }
      if (units == null) notes.push('분량을 모르셔도 기준 분량(' + main.baseUnits + main.unitLabel + ')으로 먼저 진행하고, 자료 확인 후 초과분이 있을 때만 추가 결제를 안내드립니다.');
      if (p.needsData) notes.push('결과 장은 실제 데이터 분석 후 작성됩니다. 데이터가 없으면 설문조사·통계분석 서비스와 연결해 드립니다.');
    }
  } else if (service === 'survey') {
    var s = input.survey || {};
    main = findItem(catalog, { full: 'S-FULL', new: 'S-NEW', edit: 'S-EDIT', feedback: 'S-FB', analyze: 'S-ANALYZE' }[s.mode] || 'S-FULL');
    if (main) { lines.push(line(main)); days = main.days || 0; includes = (main.includes || []).slice(); excludes = (main.excludes || []).slice(); }
    if (s.recruit === 'us') {
      reasons.push('응답자 모집·배포는 대상, 응답 수, 모집 경로, 기간에 따라 비용이 달라 확정 견적 후 결제합니다.');
      var r = findItem(catalog, 'S-RECRUIT');
      if (r) { lines.push({ code: r.code, name: r.name, qty: 1, unitPrice: 0, amount: 0, note: '견적 확정 후 안내', pending: true }); includes = includes.concat(r.includes || []); }
    }
    if (s.mode === 'analyze' && s.advanced) {
      var adv = findItem(catalog, 'T-ADV');
      if (adv) lines.push(line(adv));
    }
    if (s.sem) reasons.push('구조방정식 분석은 모형 복잡도에 따라 별도 견적입니다.');
  } else if (service === 'statistics') {
    var t = input.statistics || {};
    if (t.hasData === false && t.noDataPath === 'survey') {
      main = findItem(catalog, 'S-FULL');
      if (main) { lines.push(line(main)); days = main.days || 0; includes = (main.includes || []).slice(); excludes = (main.excludes || []).slice(); }
      reasons.push('실제 응답 조사부터 진행하는 경우 모집 비용을 포함한 통합 견적을 드립니다.');
    } else if (t.hasData === false) {
      main = findItem(catalog, 'T-SIM');
      if (main) { lines.push(line(main)); days = main.days || 0; includes = (main.includes || []).slice(); excludes = (main.excludes || []).slice(); }
    } else {
      main = findItem(catalog, { table: 'T-BASIC', interp: 'T-INTERP', chapter: 'T-CHAPTER', revise: 'T-FB' }[t.output] || 'T-INTERP');
      if (main) { lines.push(line(main)); days = main.days || 0; includes = (main.includes || []).slice(); }
      if (t.advanced && t.output !== 'revise') {
        var adv2 = findItem(catalog, 'T-ADV');
        if (adv2) { lines.push(line(adv2)); days += adv2.days || 0; }
      }
      if (t.sem) reasons.push('구조방정식·다층모형 등 심화 분석은 모형과 데이터 구조를 확인한 뒤 견적을 확정합니다.');
      if (t.messy) reasons.push('여러 파일 병합·대규모 정리 등 복잡한 데이터 정리는 분량 확인 후 견적을 확정합니다.');
    }
  }

  // 공통 추가 옵션
  var a = input.addons || {};
  var settings = catalog.settings || {};
  if (a.priority && settings.priorityEnabled !== false) {
    var pr = findItem(catalog, 'A-PRIORITY');
    if (pr) { lines.push(line(pr)); days = Math.max(1, Math.ceil(days / 2)); }
  }
  if (a.format && service === 'paper') {
    var fm = findItem(catalog, 'A-FORMAT');
    if (fm) lines.push(line(fm));
  }
  if (a.revisions && Number(a.revisions) > 0) {
    var rv = findItem(catalog, 'A-REVISION');
    if (rv) lines.push(line(rv, { qty: Math.min(5, Number(a.revisions)) }));
  }
  // 심사 발표 PPT: 모든 서비스
  if (a.ppt && main) {
    var ppt = findItem(catalog, 'A-PPT');
    if (ppt) { lines.push(line(ppt)); days += ppt.days || 0; includes = includes.concat(ppt.includes || []); }
  }
  // 영문 논문 작성: 전체 구성·초고 완성에만, 원고 분량 10쪽마다 1단위
  if (a.english && service === 'paper' && main && main.task === 'full') {
    var en = findItem(catalog, 'A-ENGLISH');
    if (en) {
      var enSize = Number(en.unitSize) || 10;
      var enPages = Math.max(Number(main.baseUnits) || 0, Number((input.paper || {}).pages) || 0);
      var enBlocks = Math.max(1, Math.ceil(enPages / enSize));
      var enUnit = Number(en.unitPrice) || Number(en.price) || 0;
      lines.push(line(en, { qty: enBlocks, unitPrice: enUnit, name: '영문 논문 작성 (' + enSize + '쪽 단위 × ' + enBlocks + ')' }));
      days += en.days || 0;
      includes = includes.concat(en.includes || []);
    }
  }
  // 논문 첨삭·교정 추가: 직접 쓴 원고가 있는 주문(통계·설문, 피드백 반영)에 그 유형의 첨삭 상품을 더한다
  if (a.editing && main && (service === 'statistics' || service === 'survey' || (service === 'paper' && main.task === 'feedback'))) {
    var edType = service === 'paper' ? main.type : (EDIT_TYPES.indexOf(a.editingType) >= 0 ? a.editingType : 'master');
    var ed = findItem(catalog, paperItemCode(edType, 'edit'));
    if (ed) {
      lines.push(line(ed, { name: ed.name + ' (추가)', note: '기준 ' + ed.baseUnits + ed.unitLabel }));
      days += 1;
      includes = includes.concat(['논문 원고 문장·논리 첨삭(기준 ' + ed.baseUnits + ed.unitLabel + ')']);
      notes.push('논문 첨삭은 기준 ' + ed.baseUnits + ed.unitLabel + '으로 계산했습니다. 원고가 더 길면 확인한 뒤 추가 금액을 안내드립니다.');
    }
  }

  var total = 0;
  for (var i = 0; i < lines.length; i++) total += lines[i].amount;
  var quoteRequired = reasons.length > 0 || (main && main.quoteOnly) || !main;
  if (!main) reasons.push('선택하신 조건에 맞는 상품을 찾지 못해 견적 확인이 필요합니다.');
  return {
    catalogVersion: catalog.version,
    lines: lines,
    total: total,
    quoteRequired: !!quoteRequired,
    quoteReasons: reasons,
    payableNow: !quoteRequired && total > 0,
    days: days,
    includes: includes,
    excludes: excludes,
    notes: notes,
    mainCode: main ? main.code : null,
    mainName: main ? main.name : '',
  };
}

// 영업일 계산 (주말·지정 휴일 제외)
function addBusinessDays(start, n, holidays) {
  var d = new Date(start.getTime());
  var hs = holidays || [];
  var added = 0;
  var guard = 0;
  while (added < n && guard < 400) {
    d.setDate(d.getDate() + 1);
    guard++;
    var dow = d.getDay();
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (dow === 0 || dow === 6 || hs.indexOf(key) >= 0) continue;
    added++;
  }
  return d;
}

function etaDate(fromDate, days, holidays) {
  return addBusinessDays(fromDate, Math.max(1, days || 1), holidays);
}
