// 신청서 공통 단계·조각
import { textField, ICON } from './wizard.js';
import { esc, won } from '../core/render.js';
import { etaDate } from '../core/pricing.js';
import { url } from '../ui/dom.js';

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

// 연락처 단계: 동의 체크 없이 안내 한 줄로(필수 정보는 계약 이행에 필요한 범위만 받음, 개인정보 보호법 제15조 제1항 제4호)
export function contactStep() {
  return {
    id: 'contact', title: '결과를 받을 연락처를 알려 주세요', help: '회원가입은 필요 없습니다. 주문번호와 조회 비밀번호로 언제든 진행 상황을 확인할 수 있습니다.',
    render: (s) => `<div class="row-2">${textField('contact.name', s.contact.name, { label: '이름', required: true, max: 40, autocomplete: 'name' })}${textField('contact.phone', s.contact.phone, { label: '휴대전화', required: true, type: 'tel', inputmode: 'tel', placeholder: '010-0000-0000', max: 20, autocomplete: 'tel' })}</div>
<div class="row-2">${textField('contact.email', s.contact.email, { label: '이메일', required: true, type: 'email', placeholder: '진행 안내와 결과물을 받을 주소', max: 120, autocomplete: 'email' })}${textField('pin', s.pin, { label: '주문 조회 비밀번호', required: true, type: 'text', inputmode: 'numeric', placeholder: '숫자 4~8자리', max: 8, autocomplete: 'off', hint: '다른 기기에서 주문을 확인할 때 씁니다.' })}</div>
<p class="consent-note">주문서를 내면 <a href="${url('/terms/')}" target="_blank">이용약관</a>, <a href="${url('/privacy/')}" target="_blank">개인정보 처리방침</a>, <a href="${url('/refund/')}" target="_blank">환불 규정</a>이 적용됩니다. 주문 진행에 필요한 정보만 받습니다.</p>
<label class="check check-sm"><input type="checkbox" data-bool="consents.marketing"${s.consents.marketing ? ' checked' : ''}><span>할인·새 서비스 소식 받기 (선택)</span></label>
<input type="text" class="hp" tabindex="-1" autocomplete="off" data-path="hp" aria-hidden="true" value="">`,
    bind: (el, s, ctx) => {
      const ph = el.querySelector('[data-path="contact.phone"]');
      ph.addEventListener('blur', () => {
        const d = ph.value.replace(/[^0-9]/g, '');
        if (d.length === 11) ph.value = `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
        else if (d.length === 10) ph.value = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
        ctx.set('contact.phone', ph.value);
      });
      const pin = el.querySelector('[data-path="pin"]');
      pin.addEventListener('input', () => { const v = pin.value.replace(/[^0-9]/g, '').slice(0, 8); if (v !== pin.value) { pin.value = v; ctx.set('pin', v); } });
    },
    valid: (s) => {
      if (!(s.contact.name || '').trim()) return '이름을 입력해 주세요.';
      if ((s.contact.phone || '').replace(/[^0-9]/g, '').length < 10) return '휴대전화 번호를 확인해 주세요.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.contact.email || '')) return '이메일 주소를 확인해 주세요.';
      if (!/^\d{4,8}$/.test(s.pin || '')) return '주문 조회 비밀번호는 숫자 4~8자리로 정해 주세요.';
      return null;
    },
  };
}
export { won };
