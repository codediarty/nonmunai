// 첨삭 요청 사항에서 기본 교정에 없는 작업 읽기
import assert from 'node:assert/strict';
import { scopeHits, neededLevel, extraWork, EXTRA_WORK } from '../../src/js/app/edit-scope.js';

export const tests = [];
const t = (name, fn) => tests.push({ name, fn });

t('29,000원(기본 교정)으로 들어온 학위논문 첨삭 요청은 추가 작업(내용 보완·구성까지)으로 읽음', () => {
  const req = '졸업논문 초안이에요. AI 톤 문체교정, 흐름 및 구조 검토, 내용 보완 코멘트, 참고문헌·인용 일관성, 논리·사실 확인까지 해서 졸업 제출 가능한 수준으로 만들어 주세요.';
  assert.equal(neededLevel(req), 'complete');
  const labels = scopeHits(req).map((h) => h.label);
  for (const l of ['내용 보완', '구조·목차 재구성', '논리·사실 확인', '제출 수준 완성', 'AI 문체 교정', '흐름·논리 다듬기', '인용·참고문헌 점검']) assert.ok(labels.includes(l), l);
  const extra = extraWork(req);
  assert.equal(extra[0], '내용 보완', '일이 많은 작업부터');
  assert.ok(extra.includes('AI 문체 교정'));
});

t('문장만 다듬는 요청은 추가 작업 없음, AI 문체·인용·내용 보완은 추가 작업', () => {
  assert.equal(neededLevel('맞춤법이랑 띄어쓰기, 어색한 문장만 봐 주세요'), 'basic');
  assert.deepEqual(extraWork('맞춤법이랑 띄어쓰기, 어색한 문장만 봐 주세요'), []);
  assert.deepEqual(extraWork(''), []);
  assert.equal(neededLevel('GPT로 쓴 티가 나서 자연스럽게 고쳐 주세요'), 'deep');
  assert.equal(neededLevel('참고문헌을 APA 7판으로 맞춰 주세요'), 'deep');
  assert.equal(neededLevel('번역투 문장이 많아요'), 'deep');
  assert.equal(neededLevel('2장 내용이 부족하다는 의견을 받았어요'), 'complete');
  assert.equal(neededLevel('목차 구성을 다시 잡아 주세요'), 'complete');
  assert.deepEqual(extraWork('흐름이 어색해요'), ['흐름·논리 다듬기']);
});

t('운영자 추가 작업 단추는 두 가지(가격표 EDIT2·EDIT3 기준), 고객에게 보일 작업과 이유가 있음', () => {
  assert.deepEqual(EXTRA_WORK.map((x) => x.level), ['deep', 'complete']);
  for (const x of EXTRA_WORK) {
    assert.ok(x.label && x.reason && x.work.length >= 3, x.level);
    assert.ok(!/심화 첨삭|완성도 보완/.test(x.label + x.reason + x.work.join('')), '단계 이름 대신 하는 일로 적음');
  }
});
