// 한글 입력 연출(두벌식 조합) 단위 테스트
import assert from 'node:assert/strict';
import { keystrokes, createIme } from '../../src/js/ui/hangul-typing.js';

const typeAll = (text) => {
  const ime = createIme();
  const states = keystrokes(text).map((k) => { const s = ime.key(k); return s.done + s.comp; });
  return { states, text: ime.end() };
};

export const tests = [
  { name: '자판을 끝까지 치면 원래 문장이 그대로 나옴', fn() {
    for (const t of ['간호학 석사 80쪽, 직무스트레스와 회복탄력성이 이직의도에 미치는 영향', '닭갈비 값, 괜찮아요? 읽었습니다.', 'APA 7판 의 뷁 쀍']) {
      assert.equal(typeAll(t).text, t);
    }
  } },
  { name: '실제 입력기처럼 자모가 조합되고 받침이 다음 글자로 넘어감', fn() {
    assert.deepEqual(typeAll('간호').states, ['ㄱ', '가', '간', '갆', '간호']);
    assert.deepEqual(typeAll('석사').states, ['ㅅ', '서', '석', '섟', '석사']);
    assert.deepEqual(typeAll('과').states, ['ㄱ', '고', '과']);
    assert.deepEqual(keystrokes('닭'), ['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ']);
  } },
];
