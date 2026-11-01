// 한글 입력 연출: 두벌식 자판으로 실제로 칠 때처럼 자모가 조합되는 과정을 그대로 재현한다.
// 받침이 다음 글자의 첫소리로 넘어가는 모습(간 → 갆 → 간호)까지 실제 입력기와 같게 보인다.

const L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const T = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
// 두 번 눌러 만드는 모음·겹받침
const V2 = { 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };
const T2 = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ' };
const flip = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
const VJ = flip(V2);
const TJ = flip(T2);

// 글자를 자판 입력 순서로: '과' → ['ㄱ', 'ㅗ', 'ㅏ'], '닭' → ['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ']
export function keystrokes(text) {
  const keys = [];
  for (const ch of String(text)) {
    const c = ch.charCodeAt(0) - 0xAC00;
    if (c < 0 || c > 11171) { keys.push(ch); continue; }
    const l = L[Math.floor(c / 588)];
    const v = V[Math.floor((c % 588) / 28)];
    const t = T[c % 28];
    keys.push(l, ...(V2[v] || v), ...(t ? (T2[t] || t) : ''));
  }
  return keys;
}

// 두벌식 입력기: 자판을 하나씩 넣으면 확정된 글자(done)와 조합 중인 글자(comp)를 돌려준다
export function createIme() {
  let done = '';
  let s = null; // 조합 중인 글자 { l, v, t }
  const syl = (l, v, t) => String.fromCharCode(0xAC00 + (L.indexOf(l) * 21 + V.indexOf(v)) * 28 + T.indexOf(t || ''));
  const show = () => (!s ? '' : s.l && s.v ? syl(s.l, s.v, s.t) : (s.l || s.v));
  const commit = () => { done += show(); s = null; };
  return {
    key(k) {
      if (V.includes(k)) {
        if (s && s.l && !s.v) s.v = k;
        else if (s && s.v && !s.t && VJ[s.v + k]) s.v = VJ[s.v + k];
        else if (s && s.t) {
          // 받침이 다음 글자 첫소리로 넘어간다(겹받침이면 뒤쪽 자음만)
          const sp = T2[s.t];
          const move = sp ? sp[1] : s.t;
          s.t = sp ? sp[0] : '';
          commit();
          s = { l: move, v: k, t: '' };
        } else { commit(); s = { l: '', v: k, t: '' }; }
      } else if (L.includes(k)) {
        if (s && s.l && s.v && !s.t && T.includes(k)) s.t = k;
        else if (s && s.t && TJ[s.t + k]) s.t = TJ[s.t + k];
        else { commit(); s = { l: k, v: '', t: '' }; }
      } else { commit(); done += k; }
      return { done, comp: show() };
    },
    end() { commit(); return done; },
  };
}
