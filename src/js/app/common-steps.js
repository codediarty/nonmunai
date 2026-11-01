// 신청서 공통 단계·조각
import { textField, ICON } from './wizard.js';
import { esc, won } from '../core/render.js';
import { etaDate } from '../core/pricing.js';
import { modal, url } from '../ui/dom.js';

export function deadlineMin() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function korDate(d) { return `${d.getMonth() + 1}월 ${d.getDate()}일(${'일월화수목금토'[d.getDay()]})`; }

export function etaHtml(q, settings = {}) {
  if (!q || q.quoteRequired || !q.days) return '';
  const hol = String(settings.holidays || '').split(/[,\s]+/).filter(Boolean);
  const d = etaDate(new Date(), q.days, hol);
  return `<p class="eta-line"><span>기본 납기 영업일 ${q.days}일</span><b>오늘 결제하면 ${korDate(d)} 전달 예상</b></p><p class="hint">실제 예상일은 결제 시점의 작업 순서로 확정됩니다.</p>`;
}

export function sideShell({ tags = [], price = '', design = '', checklist = '' }) {
  return `<div class="side-card sheet">
<div class="side-sec side-top">${tags.length ? `<div class="side-tags">${tags.map((t) => `<span class="badge">${esc(t)}</span>`).join('')}</div>` : '<p class="small muted">선택한 내용이 여기에 정리됩니다.</p>'}</div>
<div class="side-sec"><h3>예상 금액</h3>${price}</div>
${checklist}
${design}
</div>`;
}

export function quickChecklist(s, list) {
  if (!list.length) return '';
  return `<div class="side-sec"><h3>필수 자료</h3><ul class="chk">${list.map(([label, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? ICON.check : '<i></i>'}<span>${esc(label)}</span></li>`).join('')}</ul></div>`;
}

export function reviewSummary(s, ctx, rows) {
  return `<div class="rv-block"><h3 class="sub-q">입력한 내용</h3><dl class="rv-dl">${rows.map(([step, k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || '-')}</dd><button type="button" class="link-btn" data-goto="${step}">수정</button></div>`).join('')}
<div><dt>연락처</dt><dd>${esc(s.contact.name)} · ${esc(s.contact.email)} · ${esc(s.contact.phone)}</dd><button type="button" class="link-btn" data-goto="contact">수정</button></div></dl></div>`;
}

const PRIVACY_HTML = `<table class="g-table" style="min-width:0"><thead><tr><th>항목</th><th>목적</th><th>보유 기간</th></tr></thead><tbody>
<tr><td>이름, 이메일, 휴대전화, 조회 비밀번호(암호화 저장)</td><td>주문 접수, 진행 안내, 결과물 전달, 문의 응대</td><td>거래 기록은 전자상거래법에 따라 5년</td></tr>
<tr><td>주문 내용, 올린 파일, 결과물</td><td>요청 작업 수행</td><td>전달 완료 후 90일 뒤 자동 삭제(요청 시 즉시)</td></tr></tbody></table>
<p class="small">주문 자료는 Google 클라우드(Google Drive·Sheets)에 저장되며 해외 데이터센터에 보관될 수 있습니다. 동의를 거부할 수 있으나 이 경우 주문할 수 없습니다. 자세한 내용은 <a href="${url('/privacy/')}" target="_blank">개인정보처리방침</a>을 확인해 주세요.</p>`;

export function contactStep() {
  return {
    id: 'contact', title: '결과를 받을 연락처를 알려 주세요', help: '회원가입은 필요 없습니다. 주문번호와 조회 비밀번호로 언제든 진행 상황을 확인할 수 있습니다.',
    render: (s) => `<div class="row-2">${textField('contact.name', s.contact.name, { label: '이름', required: true, max: 40, autocomplete: 'name' })}${textField('contact.phone', s.contact.phone, { label: '휴대전화', required: true, type: 'tel', inputmode: 'tel', placeholder: '010-0000-0000', max: 20, autocomplete: 'tel' })}</div>
${textField('contact.email', s.contact.email, { label: '이메일', required: true, type: 'email', placeholder: '진행 안내와 결과물 알림을 받을 주소', max: 120, autocomplete: 'email' })}
<div class="row-2">${textField('pin', s.pin, { label: '주문 조회 비밀번호', required: true, type: 'password', inputmode: 'numeric', placeholder: '숫자 4~8자리', max: 8, autocomplete: 'new-password', hint: '다른 기기에서 주문을 확인할 때 씁니다.' })}${textField('pin2', s.pin2, { label: '비밀번호 확인', required: true, type: 'password', inputmode: 'numeric', max: 8, autocomplete: 'new-password' })}</div>
<div class="consents">
<label class="check"><input type="checkbox" data-bool="consents.all"${s.consents.privacy && s.consents.ethics && s.consents.withdrawal && s.consents.marketing ? ' checked' : ''}><span><b>전체 동의</b></span></label>
<label class="check"><input type="checkbox" data-bool="consents.privacy"${s.consents.privacy ? ' checked' : ''}><span><b>[필수] 개인정보 수집·이용 동의</b> <button type="button" class="link-btn" data-terms="privacy">내용 보기</button></span></label>
<label class="check"><input type="checkbox" data-bool="consents.ethics"${s.consents.ethics ? ' checked' : ''}><span><b>[필수] 연구윤리 안내 확인</b><small>결과물은 연구를 돕는 참고 자료이며, 최종 제출물의 확인과 소속 기관 연구윤리 준수 책임이 본인에게 있음을 확인합니다. 허위 데이터·문헌 작성은 요청할 수 없습니다.</small></span></label>
<label class="check"><input type="checkbox" data-bool="consents.withdrawal"${s.consents.withdrawal ? ' checked' : ''}><span><b>[필수] 주문 제작 서비스 안내 확인</b><small>요청에 따라 개별 제작되는 서비스로, 작업이 시작된 뒤에는 진행 단계에 따라 청약철회와 환불이 제한될 수 있습니다. <a href="${url('/refund/')}" target="_blank">환불 규정</a></small></span></label>
<label class="check"><input type="checkbox" data-bool="consents.marketing"${s.consents.marketing ? ' checked' : ''}><span><b>[선택] 할인·새 서비스 소식 받기</b></span></label>
</div>
<input type="text" class="hp" tabindex="-1" autocomplete="off" data-path="hp" aria-hidden="true" value="">`,
    bind: (el, s, ctx) => {
      el.querySelector('[data-bool="consents.all"]').addEventListener('change', (e) => {
        ['privacy', 'ethics', 'withdrawal', 'marketing'].forEach((k) => { s.consents[k] = e.target.checked; });
        ctx.rerender();
      });
      el.querySelectorAll('[data-terms]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); modal({ title: '개인정보 수집·이용 안내', html: PRIVACY_HTML }); }));
      const ph = el.querySelector('[data-path="contact.phone"]');
      ph.addEventListener('blur', () => {
        const d = ph.value.replace(/[^0-9]/g, '');
        if (d.length === 11) ph.value = `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
        else if (d.length === 10) ph.value = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
        ctx.set('contact.phone', ph.value);
      });
    },
    valid: (s) => {
      if (!(s.contact.name || '').trim()) return '이름을 입력해 주세요.';
      if ((s.contact.phone || '').replace(/[^0-9]/g, '').length < 10) return '휴대전화 번호를 확인해 주세요.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.contact.email || '')) return '이메일 주소를 확인해 주세요.';
      if (!/^\d{4,8}$/.test(s.pin || '')) return '주문 조회 비밀번호는 숫자 4~8자리로 정해 주세요.';
      if (s.pin !== s.pin2) return '비밀번호 확인이 일치하지 않습니다.';
      if (!s.consents.privacy) return '개인정보 수집·이용에 동의해 주세요.';
      if (!s.consents.ethics) return '연구윤리 안내를 확인해 주세요.';
      if (!s.consents.withdrawal) return '주문 제작 서비스 안내를 확인해 주세요.';
      return null;
    },
  };
}
export { won };
