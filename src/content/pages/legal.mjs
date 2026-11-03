import fs from 'node:fs';
import path from 'node:path';
import { crumbs } from '../../templates/parts.mjs';
import { esc } from '../../templates/layout.mjs';
import { renderMarkdown } from '../../../tools/guides.mjs';

const DOCS = [
  ['terms', '/terms/', '이용약관', '논문AI 이용약관', '논문AI 서비스 이용 조건과 주문, 결제, 납기, 수정, 결과물의 성격, 책임 범위를 정한 이용약관입니다.'],
  ['privacy', '/privacy/', '개인정보처리방침', '논문AI 개인정보처리방침', '논문AI가 수집하는 개인정보 항목과 이용 목적, 보유 기간, 처리 위탁과 국외 이전, 정보주체의 권리를 안내합니다.'],
  ['refund', '/refund/', '환불 규정', '논문AI 환불 규정', '논문AI 주문 취소와 환불 기준을 작업 진행 단계별로 안내합니다. 작업 시작 전 전액 환불, 시작 후 진행 정도에 따른 환불 금액과 신청 방법을 확인하세요.'],
];

export default function legal({ T, root }) {
  return DOCS.map(([key, p, label, h1, desc]) => {
    const file = path.join(root, `src/content/legal/${key}.md`);
    const md = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : `${label}을 준비하고 있습니다. 문의: contact@skkc.co.kr`;
    const { html } = renderMarkdown(md);
    return {
      path: p, kind: 'legal', navTitle: label, h1, title: `${label} | 논문AI`, description: desc, crumbs: [['홈', '/'], [label, p]], priority: '0.3', changefreq: 'yearly',
      body: `<section class="phero phero-sm"><div class="wrap">${crumbs(T, [['홈', '/'], [label, p]])}<h1 class="h-1" style="margin-top:20px">${esc(h1)}</h1><p class="muted">시행일 2026년 11월 1일</p></div></section><section class="sec"><div class="wrap-narrow prose legal">${html}</div></section>`,
    };
  });
}
