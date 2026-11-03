import fs from 'node:fs';
import path from 'node:path';
import { crumbs } from '../../templates/parts.mjs';
import { esc } from '../../templates/layout.mjs';
import { renderMarkdown } from '../../../tools/guides.mjs';

const DOCS = [
  ['terms', '/terms/', '이용약관', '논문AI 이용약관', '논문AI 서비스 이용 조건과 주문, 결제, 인공지능 활용, 결과물의 성격과 책임, 청약철회와 환불, 손해배상의 범위를 정한 이용약관입니다.'],
  ['privacy', '/privacy/', '개인정보처리방침', '논문AI 개인정보처리방침', '논문AI가 수집하는 개인정보 항목과 이용 목적, 보유 기간, 처리 위탁과 국외 이전, 정보주체의 권리를 안내합니다.'],
  ['refund', '/refund/', '환불 규정', '논문AI 환불 규정', '논문AI 이용약관 제5장(청약철회와 환불)의 주문 취소와 환불 기준입니다.'],
];
// 환불 규정은 이용약관 제5장을 그대로 보여 준다(한 곳에서만 고치도록)
const REFUND_RE = /<!-- refund:start -->([\s\S]*?)<!-- refund:end -->/;

export default function legal({ T, root }) {
  return DOCS.map(([key, p, label, h1, desc]) => {
    const termsMd = fs.readFileSync(path.join(root, 'src/content/legal/terms.md'), 'utf8');
    let md;
    if (key === 'refund') {
      const m = termsMd.match(REFUND_RE);
      md = `이 환불 규정은 [이용약관](/terms/) 제5장(청약철회와 환불)과 같은 내용이며, 이용약관의 일부를 이룹니다.\n\n${m ? m[1].trim() : ''}`;
    } else {
      const file = path.join(root, `src/content/legal/${key}.md`);
      md = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : `${label}을 준비하고 있습니다. 문의: contact@skkc.co.kr`;
    }
    const { html } = renderMarkdown(md.replace(/<!--[\s\S]*?-->/g, ''));
    const since = key === 'privacy' ? '2026년 11월 1일' : '2026년 11월 4일';
    return {
      path: p, kind: 'legal', navTitle: label, h1, title: `${label} | 논문AI`, description: desc, crumbs: [['홈', '/'], [label, p]], priority: '0.3', changefreq: 'yearly', noindex: key !== 'privacy',
      body: `<section class="phero phero-sm"><div class="wrap">${crumbs(T, [['홈', '/'], [label, p]])}<h1 class="h-1" style="margin-top:20px">${esc(h1)}</h1><p class="muted">시행일 ${since}</p></div></section><section class="sec"><div class="wrap-narrow prose legal">${html}</div></section>`,
    };
  });
}
