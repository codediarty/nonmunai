// 운영 설정과 가격표 편집
import { aapi, esc, won, toast, busy, confirmBox, authLost } from './core.js';

const GROUPS = [
  { title: '알림', keys: ['operatorEmails', 'replyTo', 'ntfyTopic', 'digestHour', 'notifyStatusMail'] },
  { title: '결제 연결', keys: ['skkcEnabled', 'skkcProducts', 'skkcCustomUrl', 'skkcLinks', 'bankEnabled', 'bankName', 'bankAccount', 'bankHolder', 'tossEnabled', 'tossClientKey'] },
  { title: '작업 운영', keys: ['advanceOnPayment', 'advanceOnClaim', 'dailyCapacity', 'holidays', 'maxFileMB', 'noticeBanner'] },
  { title: '보관·정리', keys: ['retentionDays', 'revisionDays', 'draftExpireDays', 'unpaidExpireDays'] },
  { title: '후속 서비스', keys: ['addonServices'] },
  { title: '사이트·사업자 정보', keys: ['siteName', 'siteUrl', 'bizName', 'bizCeo', 'bizNo', 'bizMailOrder', 'bizAddress', 'bizPhone', 'bizEmail'] },
];
const BOOL = ['skkcEnabled', 'bankEnabled', 'tossEnabled', 'notifyStatusMail'];
const NUM = ['digestHour', 'dailyCapacity', 'maxFileMB', 'retentionDays', 'revisionDays', 'draftExpireDays', 'unpaidExpireDays'];

const LABEL = {
  advanceOnPayment: '결제가 확인되면 고객 화면에 표시할 단계',
  advanceOnClaim: '고객이 "결제를 마쳤어요"를 누르면 확인 전에도 작업 순서에 넣을 결제 수단',
  ntfyTopic: '휴대폰 푸시 알림(ntfy 앱) 토픽 이름',
  skkcCustomUrl: '금액이 맞는 결제 링크가 없을 때 열 결제 페이지',
};

function fieldHtml(s0) {
  const s = { ...s0, label: LABEL[s0.key] || s0.label };
  const id = `s_${s.key}`;
  if (BOOL.includes(s.key)) {
    return `<label class="ad-switch"><input type="checkbox" data-key="${s.key}"${String(s.value) === 'true' ? ' checked' : ''}><span>${esc(s.label)}</span></label>`;
  }
  if (s.key === 'advanceOnPayment') {
    return `<div class="field"><label class="label" for="${id}">${esc(s.label)}</label><select class="select" id="${id}" data-key="${s.key}"><option value="in_progress"${s.value !== 'received' ? ' selected' : ''}>작성·분석 진행 (바로 작업 순서에 표시)</option><option value="received"${s.value === 'received' ? ' selected' : ''}>접수 완료 (직접 진행 단계로 바꿈)</option></select></div>`;
  }
  if (s.key === 'advanceOnClaim') {
    const v = String(s.value || '').split(/[,\s]+/);
    return `<div class="field"><span class="label">${esc(s.label)}</span><div class="ad-checks"><label class="check"><input type="checkbox" data-claim="skkc"${v.includes('skkc') ? ' checked' : ''}><span>성균관컨설팅 결제</span></label><label class="check"><input type="checkbox" data-claim="bank"${v.includes('bank') ? ' checked' : ''}><span>무통장입금</span></label></div><input type="hidden" data-key="advanceOnClaim" value="${esc(s.value || '')}"></div>`;
  }
  if (s.key === 'skkcLinks') {
    let rows = [];
    try { rows = JSON.parse(s.value || '[]'); } catch { rows = []; }
    return `<div class="field"><span class="label">금액별 결제 링크 <small>금액이 정확히 같은 주문에 이 링크를 엽니다</small></span><div class="ad-mini" data-json="skkcLinks">${rows.map((r) => linkRow(r)).join('')}</div><button type="button" class="btn btn-ghost btn-xs" data-add="skkcLinks">링크 추가</button></div>`;
  }
  if (s.key === 'skkcProducts') {
    let map = {};
    try { map = JSON.parse(s.value || '{}') || {}; } catch { map = {}; }
    const text = Object.entries(map).map(([k, v]) => `${k} ${v}`).join('\n');
    return `<div class="field"><label class="label" for="${id}">아임웹 상품 링크 <small>한 줄에 '상품코드 링크'. 주문 금액 줄마다 이 상품을 안내합니다(${Object.keys(map).length}개)</small></label><textarea class="textarea" rows="6" id="${id}" data-products placeholder="P-MASTER-FULL https://skkc.co.kr/shop_view?idx=...">${esc(text)}</textarea></div>`;
  }
  if (s.key === 'addonServices') {
    let rows = [];
    try { rows = JSON.parse(s.value || '[]'); } catch { rows = []; }
    return `<div class="field"><span class="label">결과물 전달 후 함께 안내할 서비스 <small>휴머나이징 등 제휴 서비스를 켜고 끕니다</small></span><div class="ad-mini" data-json="addonServices">${rows.map((r) => addonRow(r)).join('')}</div><button type="button" class="btn btn-ghost btn-xs" data-add="addonServices">서비스 추가</button></div>`;
  }
  const long = ['noticeBanner', 'holidays', 'bizAddress'].includes(s.key);
  return `<div class="field"><label class="label" for="${id}">${esc(s.label)}</label>${long ? `<textarea class="textarea" rows="2" id="${id}" data-key="${s.key}">${esc(s.value || '')}</textarea>` : `<input class="input" id="${id}" data-key="${s.key}" value="${esc(s.value || '')}"${NUM.includes(s.key) ? ' inputmode="numeric"' : ''}>`}</div>`;
}

const linkRow = (r = {}) => `<div class="ad-mini-row"><input class="input" data-f="amount" type="number" placeholder="금액" value="${esc(r.amount || '')}"><input class="input" data-f="url" placeholder="https://skkc.co.kr/... 상품 결제 링크" value="${esc(r.url || '')}"><button type="button" class="btn btn-ghost btn-xs" data-del>삭제</button></div>`;
const addonRow = (r = {}) => `<div class="ad-mini-row ad-mini-addon"><label class="check"><input type="checkbox" data-f="enabled"${r.enabled ? ' checked' : ''}><span>사용</span></label><input class="input" data-f="name" placeholder="서비스 이름" value="${esc(r.name || '')}"><input class="input" data-f="url" placeholder="https://..." value="${esc(r.url || '')}"><input class="input" data-f="desc" placeholder="짧은 설명(선택)" value="${esc(r.desc || '')}"><input type="hidden" data-f="key" value="${esc(r.key || '')}"><button type="button" class="btn btn-ghost btn-xs" data-del>삭제</button></div>`;

export async function renderSettings(root) {
  root.innerHTML = '<div class="ad-loading"><span class="spin spin-dark"></span> 설정을 불러오는 중입니다</div>';
  let r;
  try { r = await aapi('adminGetSettings'); } catch (e) { if (!authLost(e)) root.innerHTML = `<div class="ad-empty">${esc(e.message)}</div>`; return; }
  const byKey = Object.fromEntries(r.settings.map((s) => [s.key, s]));
  root.innerHTML = `<div class="ad-page ad-settings"><div class="ad-head"><div><h1>설정</h1><p class="muted">서버 v${esc(r.version)} · <a href="${esc(r.spreadsheetUrl)}" target="_blank" rel="noopener">운영 시트</a> · <a href="${esc(r.folderUrl)}" target="_blank" rel="noopener">자료 폴더</a></p></div><div class="ad-head-act"><button class="btn btn-ghost btn-sm" type="button" id="testNotify">알림 테스트</button><button class="btn btn-primary btn-sm" type="button" id="saveAll">설정 저장</button></div></div>
<div class="ad-set-grid">${GROUPS.map((g) => `<section class="ad-card"><h2>${esc(g.title)}</h2>${g.keys.filter((k) => byKey[k]).map((k) => fieldHtml(byKey[k])).join('')}${g.title === '결제 연결' ? `<div class="field"><label class="label" for="tossSecret">토스페이먼츠 시크릿 키 <small>${r.secrets.tossSecretKey ? '저장되어 있음' : '없음'}</small></label><input class="input" id="tossSecret" type="password" autocomplete="off" placeholder="${r.secrets.tossSecretKey ? '바꿀 때만 입력' : 'test_gsk_ 또는 live_gsk_로 시작'}">${r.secrets.tossSecretKey ? '<label class="check"><input type="checkbox" id="tossClear"><span>저장된 키 지우기</span></label>' : ''}<p class="hint">시크릿 키는 서버(스크립트 속성)에만 저장되고 화면이나 시트에는 보이지 않습니다.</p></div>` : ''}</section>`).join('')}
<section class="ad-card"><h2>관리자 비밀번호</h2><div class="field"><label class="label" for="pwCur">현재 비밀번호</label><input class="input" id="pwCur" type="password" autocomplete="current-password"></div><div class="field"><label class="label" for="pwNew">새 비밀번호 <small>10자 이상</small></label><input class="input" id="pwNew" type="password" autocomplete="new-password"></div><button class="btn btn-dark btn-sm" type="button" id="pwSave">비밀번호 바꾸기</button></section>
<section class="ad-card"><h2>서버 정보</h2><dl class="ad-kv"><div><dt>웹 앱 주소</dt><dd class="ad-break">${esc(r.webAppUrl || '-')}</dd></div><div><dt>서버 버전</dt><dd>${esc(r.version)}</dd></div></dl><p class="hint">사이트 주소(siteUrl)는 고객 메일 속 주문 링크에 쓰입니다. 도메인을 바꾸면 함께 바꿔 주세요.</p></section>
</div></div>`;

  root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const box = root.querySelector(`[data-json="${b.dataset.add}"]`);
    box.insertAdjacentHTML('beforeend', b.dataset.add === 'skkcLinks' ? linkRow() : addonRow({ enabled: true }));
  }));
  root.addEventListener('click', (e) => { const d = e.target.closest('[data-del]'); if (d) d.closest('.ad-mini-row').remove(); });
  root.querySelectorAll('[data-claim]').forEach((c) => c.addEventListener('change', () => {
    root.querySelector('[data-key="advanceOnClaim"]').value = Array.from(root.querySelectorAll('[data-claim]:checked')).map((x) => x.dataset.claim).join(',');
  }));
  root.querySelector('#saveAll').addEventListener('click', async (e) => {
    const out = {};
    root.querySelectorAll('[data-key]').forEach((el) => { out[el.dataset.key] = el.type === 'checkbox' ? String(el.checked) : el.value.trim(); });
    const links = Array.from(root.querySelectorAll('[data-json="skkcLinks"] .ad-mini-row')).map((row) => ({ amount: Number(row.querySelector('[data-f="amount"]').value), url: row.querySelector('[data-f="url"]').value.trim() })).filter((x) => x.amount > 0 && /^https?:\/\//.test(x.url));
    out.skkcLinks = JSON.stringify(links);
    const addons = Array.from(root.querySelectorAll('[data-json="addonServices"] .ad-mini-row')).map((row, k) => ({ key: row.querySelector('[data-f="key"]').value || `svc${k + 1}`, name: row.querySelector('[data-f="name"]').value.trim(), url: row.querySelector('[data-f="url"]').value.trim(), desc: row.querySelector('[data-f="desc"]').value.trim(), enabled: row.querySelector('[data-f="enabled"]').checked })).filter((x) => x.name);
    out.addonServices = JSON.stringify(addons);
    const prodEl = root.querySelector('[data-products]');
    if (prodEl) {
      const map = {};
      for (const line of prodEl.value.split('\n')) { const m = line.trim().match(/^([A-Z0-9-]+)\s+(https?:\/\/\S+)$/); if (m) map[m[1]] = m[2]; }
      out.skkcProducts = JSON.stringify(map);
    }
    for (const k of NUM) if (out[k] !== undefined && out[k] !== '' && !/^\d+$/.test(out[k])) { toast(`${(byKey[k] || {}).label || k}: 숫자로 입력해 주세요.`, { error: true }); return; }
    if (out.tossEnabled === 'true' && !out.tossClientKey) { toast('토스페이먼츠를 켜려면 클라이언트 키가 필요합니다.', { error: true }); return; }
    const payload = { settings: out };
    const sec = root.querySelector('#tossSecret').value.trim();
    if (sec) payload.tossSecretKey = sec;
    const clr = root.querySelector('#tossClear');
    if (clr && clr.checked) payload.tossSecretKey = '';
    busy(e.currentTarget, true, '저장 중');
    try { await aapi('adminSaveSettings', payload); try { sessionStorage.removeItem('nm:config'); } catch { /* 무시 */ } toast('설정을 저장했습니다.'); renderSettings(root); } catch (ex) { toast(ex.message, { error: true }); busy(e.currentTarget, false); }
  });
  root.querySelector('#testNotify').addEventListener('click', async (e) => {
    busy(e.currentTarget, true);
    try { await aapi('adminTestNotify'); toast('운영 메일과 휴대폰 푸시로 테스트 알림을 보냈습니다.'); } catch (ex) { toast(ex.message, { error: true }); }
    busy(e.currentTarget, false);
  });
  root.querySelector('#pwSave').addEventListener('click', async (e) => {
    const cur = root.querySelector('#pwCur').value;
    const next = root.querySelector('#pwNew').value;
    if (next.length < 10) { toast('새 비밀번호는 10자 이상으로 정해 주세요.', { error: true }); return; }
    busy(e.currentTarget, true);
    try {
      const res = await aapi('adminChangePassword', { current: cur, next });
      const { auth } = await import('./core.js');
      auth.set(res.adminToken);
      toast('비밀번호를 바꿨습니다. 다른 기기의 로그인은 풀립니다.');
      root.querySelector('#pwCur').value = ''; root.querySelector('#pwNew').value = '';
    } catch (ex) { toast(ex.message, { error: true }); }
    busy(e.currentTarget, false);
  });
}

/* ------------------------------------------------------------------ 가격표 */
const SVC = { paper: '논문', survey: '설문', statistics: '통계', addon: '옵션' };

export async function renderCatalog(root) {
  root.innerHTML = '<div class="ad-loading"><span class="spin spin-dark"></span> 가격표를 불러오는 중입니다</div>';
  let cat;
  try { cat = (await aapi('adminGetCatalog')).catalog; } catch (e) { if (!authLost(e)) root.innerHTML = `<div class="ad-empty">${esc(e.message)}</div>`; return; }
  const items = cat.items;
  root.innerHTML = `<div class="ad-page"><div class="ad-head"><div><h1>가격표</h1><p class="muted">저장하면 신청 화면 견적과 서버 결제 금액에 바로 반영됩니다. 이미 접수된 주문 금액은 바뀌지 않습니다.</p></div><div class="ad-head-act"><button class="btn btn-ghost btn-sm" type="button" id="catReset">기본값으로 되돌리기</button><button class="btn btn-primary btn-sm" type="button" id="catSave">가격표 저장</button></div></div>
<div class="ad-card ad-table-wrap"><table class="ad-table ad-cat"><thead><tr><th>사용</th><th>코드</th><th>구분</th><th>상품명</th><th class="r">가격</th><th>납기(영업일)</th><th>기준 분량</th><th>추가 단위·단가</th><th>결제 링크(같은 금액일 때)</th></tr></thead><tbody>
${items.map((it, k) => `<tr data-k="${k}"><td><input type="checkbox" data-f="active"${it.active === false ? '' : ' checked'} aria-label="사용"></td><td class="ad-code">${esc(it.code)}${it.quoteOnly ? '<small>견적형</small>' : ''}</td><td>${esc(SVC[it.service] || it.service)}</td>
<td><input class="input input-sm" data-f="name" value="${esc(it.name)}"></td><td class="r"><input class="input input-sm num" data-f="price" type="number" step="1000" value="${it.price}"${it.quoteOnly ? ' disabled' : ''}></td><td><input class="input input-sm" data-f="days" type="number" value="${it.days || 0}"></td>
<td>${it.baseUnits !== undefined ? `<span class="ad-inline"><input class="input input-sm" data-f="baseUnits" type="number" value="${it.baseUnits}">${esc(it.unitLabel || '')}</span>` : '-'}</td>
<td>${it.baseUnits !== undefined ? `<span class="ad-inline"><input class="input input-sm" data-f="unitSize" type="number" value="${it.unitSize}">${esc(it.unitLabel || '')}당 <input class="input input-sm" data-f="unitPrice" type="number" step="1000" value="${it.unitPrice}"></span>` : '-'}</td>
<td><input class="input input-sm" data-f="payUrl" placeholder="https://" value="${esc(it.payUrl || '')}"></td></tr>`).join('')}</tbody></table></div></div>`;
  root.querySelector('#catSave').addEventListener('click', async (e) => {
    const next = items.map((it, k) => {
      const tr = root.querySelector(`tr[data-k="${k}"]`);
      const v = (f) => { const el = tr.querySelector(`[data-f="${f}"]`); return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined; };
      const out = { ...it, name: v('name').trim() || it.name, price: it.quoteOnly ? it.price : Math.max(0, Number(v('price')) || 0), days: Math.max(0, Number(v('days')) || 0), active: v('active'), payUrl: (v('payUrl') || '').trim() };
      if (it.baseUnits !== undefined) { out.baseUnits = Number(v('baseUnits')) || it.baseUnits; out.unitSize = Number(v('unitSize')) || it.unitSize; out.unitPrice = Number(v('unitPrice')) || 0; }
      return out;
    });
    const bad = next.find((x) => x.payUrl && !/^https?:\/\//.test(x.payUrl));
    if (bad) { toast(`${bad.code}: 결제 링크는 https://로 시작해야 합니다.`, { error: true }); return; }
    busy(e.currentTarget, true, '저장 중');
    try { await aapi('adminSaveCatalog', { catalog: { items: next } }); try { sessionStorage.removeItem('nm:config'); } catch { /* 무시 */ } toast('가격표를 저장했습니다.'); renderCatalog(root); } catch (ex) { toast(ex.message, { error: true }); busy(e.currentTarget, false); }
  });
  root.querySelector('#catReset').addEventListener('click', async (e) => {
    const v = await confirmBox({ title: '기본 가격표로 되돌리기', html: '<p>지금 가격표를 출시 기본 가격으로 되돌립니다. 입력해 둔 결제 링크도 지워집니다.</p>', ok: '되돌리기', danger: true });
    if (!v) return;
    busy(e.currentTarget, true);
    try { await aapi('adminResetCatalog'); toast('기본 가격표로 되돌렸습니다.'); renderCatalog(root); } catch (ex) { toast(ex.message, { error: true }); busy(e.currentTarget, false); }
  });
}
