// 아임웹(skkc.co.kr) 결제 상품 자료 만들기: 상품 목록(JSON)·정사각 상품 이미지·상세 설명 HTML·구매 안내 이미지
// 사용: node tools/imweb-products.mjs [출력 폴더]   (docs/ 빌드가 있어야 사이트 글꼴을 씀)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CATALOG, won } from '../src/js/core/pricing.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'tmp/imweb'));
fs.mkdirSync(path.join(out, 'img'), { recursive: true });
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }

const TYPE = { master: '석사학위논문', doctor: '박사학위논문', journal: '학술지 투고논문', bachelor: '학사·졸업논문', report: '일반 연구보고서', youth: '청소년 탐구논문', personal: '개인 관심연구', short: '소논문' };
const TASK = { full: '전체 구성·초고 완성', edit: '논문 첨삭·교정', feedback: '피드백 반영', proposal: '연구계획서 작성' };
const FEEDBACK_TASK = { journal: '심사 의견 반영', report: '검토 의견 반영', youth: '선생님 피드백 반영', master: '교수님 피드백 반영', doctor: '교수님 피드백 반영', bachelor: '교수님 피드백 반영', personal: '피드백 반영' };
const items = DEFAULT_CATALOG.items;
const find = (c) => items.find((i) => i.code === c);

// 추가 분량 단가별 상품: 같은 단가를 쓰는 본 상품을 묶는다
const unitUsers = {};
for (const it of items) if (it.unitPrice && !it.addon) (unitUsers[it.unitPrice] = unitUsers[it.unitPrice] || []).push(it);

function paperTitle(it) {
  return [TYPE[it.type], it.task === 'feedback' ? FEEDBACK_TASK[it.type] : TASK[it.task]];
}

const products = [];
for (const it of items) {
  if (it.quoteOnly || !it.price) continue;
  let family, lines, meta, applies = '';
  if (it.service === 'paper') {
    family = '논문 · ' + TYPE[it.type];
    lines = paperTitle(it);
    meta = `기준 ${it.baseUnits}${it.unitLabel} · 기본 납기 영업일 ${it.days}일`;
  } else if (it.service === 'survey') {
    family = '설문조사';
    lines = { 'S-FULL': ['설문지 작성부터', '통계 해석까지'], 'S-NEW': ['설문지', '작성'], 'S-EDIT': ['설문지', '점검·수정'], 'S-FB': ['설문지', '교수님 피드백 반영'], 'S-ANALYZE': ['설문 응답', '통계 분석·해석'] }[it.code];
    meta = `기본 납기 영업일 ${it.days}일`;
  } else if (it.service === 'statistics') {
    family = it.addon ? '추가 옵션 · 통계분석' : '통계분석';
    lines = { 'T-BASIC': ['논문 맞춤', '통계분석 기본형'], 'T-INTERP': ['논문 맞춤', '통계분석 표준형'], 'T-CHAPTER': ['통계분석과', '연구결과 작성'], 'T-FB': ['통계 재분석·', '교수님 피드백 반영'], 'T-SIM': ['학습용 시뮬레이션', '데이터 분석'], 'T-ADV': ['심화 분석', '매개·조절효과'] }[it.code];
    meta = it.addon ? '통계분석·응답 분석 주문에 더하는 옵션' : `기본 납기 영업일 ${it.days}일`;
  } else {
    family = '추가 옵션';
    lines = { 'A-PPT': ['심사 발표', 'PPT 제작'], 'A-ENGLISH': ['영문 논문', '작성'], 'A-PRIORITY': ['우선 처리', '작업 순서 앞당김'], 'A-FORMAT': ['학교·학술지', '양식 상세 적용'], 'A-REVISION': ['추가 수정', '1회'] }[it.code];
    meta = it.code === 'A-ENGLISH' ? `전체 구성·초고 완성 주문에 ${it.unitSize}쪽 단위로 더하는 옵션` : '논문AI 주문에 더하는 옵션';
  }
  if (it.addon) applies = { 'T-ADV': '논문 맞춤 통계분석과 설문 응답 분석 주문', 'A-FORMAT': '논문 작성·첨삭 주문', 'A-ENGLISH': '논문 전체 구성·초고 완성 주문' }[it.code] || '논문·설문조사·통계분석 주문 전체';
  products.push({ code: it.code, kind: it.addon ? 'addon' : 'main', service: it.service, family, lines, name: `[논문AI] ${it.name}`, price: it.price, days: it.days || 0, meta, includes: it.includes || [], excludes: it.excludes || [], unit: it.unitPrice ? { size: it.unitSize, label: it.unitLabel, price: it.unitPrice, base: it.baseUnits } : null, applies });
}
for (const price of Object.keys(unitUsers).map(Number).sort((a, b) => a - b)) {
  const users = unitUsers[price];
  products.push({
    code: `X-${price}`, kind: 'extra', service: 'addon', family: '추가 분량', lines: ['추가 분량', `1단위 ${won(price)}`],
    name: `[논문AI] 추가 분량 1단위 (${won(price)})`, price, days: 0,
    meta: '기준 분량을 넘는 만큼 단위 수대로 담는 상품',
    includes: users.map((u) => `${u.name}: ${u.unitSize}${u.unitLabel}마다 1단위`), excludes: [], unit: null, applies: users.map((u) => u.name).join(', '),
    users: users.map((u) => u.code),
  });
}

// 쇼핑몰 진열 순서: 본 상품, 옵션(발표 PPT·영문 작성 먼저), 추가 분량
const ADDON_ORDER = ['A-PPT', 'A-ENGLISH', 'T-ADV', 'A-FORMAT', 'A-REVISION', 'A-PRIORITY'];
products.sort((a, b) => {
  const rank = (p) => (p.kind === 'main' ? 0 : p.kind === 'addon' ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a.kind === 'addon') return ADDON_ORDER.indexOf(a.code) - ADDON_ORDER.indexOf(b.code);
  return 0;
});

// 요약 설명(아임웹 메타 설명): 160자 안팎
for (const p of products) {
  const inc = p.includes.slice(0, 4).map((x) => x.replace(/\(.*?\)/g, '').trim()).join(', ');
  p.summary = p.kind === 'extra'
    ? `논문AI 주문서에 '추가 분량 N단위'가 표시되면 그 단위 수만큼 담아 결제하는 상품입니다. 1단위 ${won(p.price)}.`
    : p.kind === 'addon'
      ? `${p.lines.join(' ')} · ${p.code === 'A-ENGLISH' ? `${p.unit.size}쪽마다 ${won(p.price)}` : won(p.price)} · ${p.applies}에 더할 수 있습니다. 논문AI(nonmunai.kr) 주문과 함께 결제하세요.`
      : `${p.name.replace('[논문AI] ', '')} · ${p.meta} · ${inc} 포함. 논문AI(nonmunai.kr)에서 주문서를 내면 연구 설계와 금액이 바로 나옵니다.`;
}

// 상세 설명 HTML(아임웹 에디터용, 인라인 스타일만 사용). 판매 페이지라 환불·면책 같은 애매한 문구는 넣지 않는다
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SHOP_IMG = 'https://nonmunai.kr/assets/img/shop';
const NAVY = '#0F1B3D', INK2 = '#2B3654', MUTED = '#5B6478', LINE = '#E3E7EF', GOLD = '#2346E8';
const sec = (title, inner, kicker = '') => `<div style="margin:56px 0 0">${kicker ? `<p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;color:${GOLD}">${esc(kicker)}</p>` : ''}<h3 style="margin:0 0 18px;font-size:24px;line-height:1.4;font-weight:800;color:${NAVY};letter-spacing:-.02em">${esc(title)}</h3>${inner}</div>`;
const cards = (arr) => `<table style="width:100%;border-collapse:separate;border-spacing:0 10px">${arr.map((x, i) => `<tr><td style="width:44px;vertical-align:top;padding:16px 0 16px 16px;background:#F5F7FB;border-radius:12px 0 0 12px"><span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:${NAVY};color:#fff;font-weight:800;font-size:14px;line-height:28px;text-align:center">${i + 1}</span></td><td style="padding:16px 18px 16px 6px;background:#F5F7FB;border-radius:0 12px 12px 0;font-size:16px;line-height:1.7;color:${INK2}">${x}</td></tr>`).join('')}</table>`;
const checks = (arr) => `<ul style="list-style:none;margin:0;padding:0">${arr.map((x) => `<li style="position:relative;padding:12px 0 12px 32px;border-bottom:1px solid ${LINE};font-size:16px;line-height:1.65;color:${INK2}"><span style="position:absolute;left:0;top:12px;color:#2346E8;font-weight:800">✓</span>${esc(x)}</li>`).join('')}</ul>`;
const spec = (rows) => `<table style="width:100%;border-collapse:collapse;border-top:2px solid ${NAVY}">${rows.map(([k, v]) => `<tr><th style="width:34%;text-align:left;padding:15px 16px;background:#F5F7FB;border-bottom:1px solid ${LINE};font-size:15px;color:${NAVY};font-weight:700">${esc(k)}</th><td style="padding:15px 16px;border-bottom:1px solid ${LINE};font-size:15px;color:${INK2};line-height:1.6">${v}</td></tr>`).join('')}</table>`;
const img = (file, alt) => `<p style="margin:18px 0 0;text-align:center"><img src="${SHOP_IMG}/${file}" alt="${esc(alt)}" style="max-width:100%;height:auto;border-radius:14px"></p>`;

const TYPE_SHORT = { master: '석사학위논문', doctor: '박사학위논문', journal: '학술지 논문', bachelor: '졸업논문', report: '연구보고서', youth: '탐구논문', personal: '연구 원고', short: '소논문' };
const teacher = (t) => (t === 'youth' ? '선생님' : t === 'journal' ? '심사위원' : t === 'report' ? '검토자' : '교수님');
function pitch(p) {
  if (p.service === 'paper') {
    const t = p.code.split('-')[1].toLowerCase(), task = { FULL: 'full', EDIT: 'edit', FB: 'feedback', PROP: 'proposal' }[p.code.split('-')[2]];
    const n = TYPE_SHORT[t];
    return {
      full: { head: `주제 한 줄에서 장별 초고까지, ${n}을 처음부터 함께 완성합니다`, who: [`주제는 정했지만 어디서부터 써야 할지 막막한 분`, `연구모형, 가설, 목차를 한 번에 제대로 잡고 싶은 분`, `일정이 빠듯해 탄탄한 초고가 빨리 필요한 분`] },
      edit: { head: `${n}의 문장과 논리를 다듬어 제출할 수 있는 원고로 만듭니다`, who: [`원고는 있지만 문장과 흐름이 매끄럽지 않은 분`, `인용과 형식을 꼼꼼하게 점검받고 싶은 분`, `제출 전에 전문가의 눈으로 마지막 점검을 받고 싶은 분`] },
      feedback: { head: `${teacher(t)} 의견을 항목별로 반영하고, 수정표와 파란색 표시로 한눈에 보여 드립니다`, who: [`${teacher(t)} 의견을 받았는데 어떻게 고쳐야 할지 막막한 분`, `정해진 일정 안에 수정본을 내야 하는 분`, `무엇을 어디서 고쳤는지 한눈에 보여 드려야 하는 분`] },
      proposal: { head: `연구 목적부터 분석 계획까지, 설득력 있는 연구계획서를 세웁니다`, who: [`연구계획서 심사를 앞둔 분`, `주제는 있지만 연구 방법을 정하지 못한 분`, `선행연구와 연구모형을 체계적으로 정리해야 하는 분`] },
    }[task];
  }
  const M = {
    'S-FULL': { head: '설문지 작성부터 설문조사 진행, 통계 분석과 해석까지 한 번에 끝냅니다', who: ['설문조사가 처음이라 무엇부터 해야 할지 모르는 분', '척도 선정과 문항 구성에 자신이 없는 분', '응답을 모은 뒤 분석과 결과 정리까지 이어서 맡기고 싶은 분'] },
    'S-NEW': { head: '연구 변인에 맞는 검증된 척도로 설문지를 작성합니다', who: ['연구 변인은 정했지만 척도를 고르지 못한 분', '문항 수와 구성을 어떻게 잡을지 막막한 분', '바로 배포할 수 있는 온라인 설문이 필요한 분'] },
    'S-EDIT': { head: '기존 설문지의 문항과 척도를 점검하고 완성도를 높입니다', who: ['설문지는 있지만 문항 표현이 어색한 분', '척도 구성과 문항 순서가 맞는지 확인하고 싶은 분', '배포 전에 마지막 점검이 필요한 분'] },
    'S-FB': { head: '설문지 의견을 항목별로 반영하고, 수정표와 파란색 표시로 보여 드립니다', who: ['설문지 수정 의견을 받고 방향을 잡지 못한 분', '심사 일정에 맞춰 수정본이 필요한 분', '수정 내용을 정리해 보여 드려야 하는 분'] },
    'S-ANALYZE': { head: '모은 응답을 연구 가설에 맞게 분석하고 통계표와 해석으로 정리합니다', who: ['응답은 모았지만 분석을 어떻게 할지 막막한 분', '가설 검증 결과를 논문 형식으로 정리하고 싶은 분', '통계표를 읽고 해석하는 데 도움이 필요한 분'] },
    'T-BASIC': { head: '논문 주제와 데이터에 맞는 분석을 실행하고 APA 통계표로 정리합니다', who: ['분석 방향은 정했고 실행과 표 작성이 필요한 분', 'SPSS를 다루기 어려운 분', '논문 형식에 맞는 통계표가 필요한 분'] },
    'T-INTERP': { head: '논문 주제와 가설, 데이터에 맞는 분석을 설계하고 결과 해석까지 드립니다', who: ['어떤 분석을 해야 할지부터 막막한 분', '결과표를 받아도 읽고 설명하기 어려운 분', '지도교수님께 결과를 자신 있게 설명하고 싶은 분'] },
    'T-CHAPTER': { head: '논문 맞춤 통계분석에 연구결과(4장) 본문 작성까지 완성합니다', who: ['데이터는 있고 연구결과 장을 써야 하는 분', '통계표와 본문 서술을 함께 맞춰야 하는 분', '표·그림 번호와 형식까지 정리하고 싶은 분'] },
    'T-FB': { head: '교수님 의견대로 다시 분석하고, 수정표와 파란색 표시로 보여 드립니다', who: ['분석 방법을 바꾸라는 의견을 받은 분', '표 형식이나 수치 보고를 고쳐야 하는 분', '수정 내용을 대조표로 정리해 보여 드려야 하는 분'] },
    'A-PPT': { head: '심사장에서 자신 있게 발표하도록, 논문 핵심을 발표 자료로 만듭니다', who: ['심사 발표가 다가오는데 PPT를 만들 시간이 없는 분', '논문 내용을 몇 장으로 줄여야 할지 막막한 분', '발표 흐름과 스크립트까지 준비하고 싶은 분'] },
    'A-ENGLISH': { head: '해외 학술지와 영문 학위논문에 맞게, 원고를 학술 영어로 작성합니다', who: ['해외 학술지(SCI·SSCI·Scopus) 투고를 준비하는 분', '영문으로 학위논문을 써야 하는 분', '영어 표현과 형식까지 한 번에 맞추고 싶은 분'] },
    'T-SIM': { head: '가상 데이터로 분석 절차를 직접 익히는 학습용 실습입니다', who: ['데이터를 모으기 전에 분석 흐름을 미리 익히고 싶은 분', '분석 방법이 연구에 맞는지 먼저 확인하고 싶은 분', '통계 수업 과제나 연습이 필요한 분'] },
  };
  return M[p.code] || { head: p.lines.join(' '), who: [] };
}
const optionRows = (p) => {
  const o = [];
  const ppt = find('A-PPT'), en = find('A-ENGLISH');
  if (ppt) o.push(['심사 발표 PPT 제작', `<b>${won(ppt.price)}</b> · 논문 핵심을 담은 발표 자료와 스크립트`]);
  if (en && p.service === 'paper' && /-FULL$/.test(p.code)) o.push(['영문 논문 작성', `<b>${en.unitSize}쪽마다 ${won(en.unitPrice)}</b> · 원고를 학술 영어로 작성`]);
  const edCode = p.service === 'paper' ? (/-FB$/.test(p.code) ? p.code.replace(/-FB$/, '-EDIT') : '') : p.code === 'T-SIM' ? '' : 'P-MASTER-EDIT';
  const ed = edCode && find(edCode);
  if (ed) o.push(['논문 첨삭·교정', `<b>${won(ed.price)}</b>${p.service === 'paper' ? '' : '(석사 기준)'} · 직접 쓰신 원고 전체의 문장·논리를 다듬습니다`]);
  if (['T-INTERP', 'T-CHAPTER', 'T-BASIC', 'S-ANALYZE'].includes(p.code)) o.push(['심화 분석(매개·조절효과)', `<b>${won(find('T-ADV').price)}</b>`]);
  if (p.service === 'paper') o.push(['학교·학술지 양식 상세 적용', `<b>${won(find('A-FORMAT').price)}</b> · 여백, 글꼴, 표·그림, 목차 서식까지`]);
  o.push(['추가 수정', `<b>${won(find('A-REVISION').price)}</b> · 결과물을 한 번 더 다듬습니다`]);
  o.push(['우선 처리', `<b>${won(find('A-PRIORITY').price)}</b> · 작업 순서를 앞당겨 납기를 줄입니다`]);
  return o;
};
const STEPS = [
  '<b>논문AI에서 주문서 작성</b><br>nonmunai.kr에서 주제와 필요한 작업을 고르고 자료를 올리면 연구 설계와 금액이 바로 계산됩니다.',
  '<b>이 상품으로 결제</b><br>주문서를 내면 결제 화면에서 이 상품이 바로 열립니다. 요청사항에 논문AI 주문번호를 적어 주세요.',
  '<b>작업 순서 배정과 진행 안내</b><br>결제가 확인되면 예상 전달일이 정해지고, 단계가 바뀔 때마다 주문 페이지와 메일로 알려 드립니다.',
  '<b>결과물 전달</b><br>완성된 결과물을 주문 페이지에서 바로 내려받습니다.',
];
const WHY = [
  ['주제 한 줄로 바로 나오는 연구 설계', '연구모형, 가설, 목차, 필요한 표본 수를 연구 설계 엔진이 즉시 계산해 작업의 뼈대를 먼저 보여 드립니다.'],
  ['석·박사 연구진의 검수', '원고와 분석 결과는 석·박사 연구진이 내용과 형식을 검토한 뒤 전달합니다.'],
  ['진행 상황을 숨기지 않습니다', '주문 페이지에서 지금 단계와 예상 전달일을 언제든 확인하고, 담당자와 메시지를 주고받습니다.'],
  ['안심할 수 있는 자료 관리', '올린 자료와 결과물은 주문자만 열람할 수 있도록 안전하게 관리합니다.'],
];
const whyHtml = `<table style="width:100%;border-collapse:separate;border-spacing:10px"><tr>${WHY.slice(0, 2).map(([h, t]) => `<td style="width:50%;vertical-align:top;padding:22px;border:1px solid ${LINE};border-radius:14px"><p style="margin:0 0 8px;font-size:17px;font-weight:800;color:${NAVY}">${esc(h)}</p><p style="margin:0;font-size:15px;line-height:1.7;color:${MUTED}">${esc(t)}</p></td>`).join('')}</tr><tr>${WHY.slice(2).map(([h, t]) => `<td style="width:50%;vertical-align:top;padding:22px;border:1px solid ${LINE};border-radius:14px"><p style="margin:0 0 8px;font-size:17px;font-weight:800;color:${NAVY}">${esc(h)}</p><p style="margin:0;font-size:15px;line-height:1.7;color:${MUTED}">${esc(t)}</p></td>`).join('')}</tr></table>`;
const TRUST = `<div style="margin:0;padding:24px 26px;border-radius:16px;background:#F5F7FB;border:1px solid ${LINE}"><p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#2346E8">논문AI 결제 안내</p><p style="margin:0;font-size:17px;line-height:1.75;color:${NAVY};font-weight:600">논문AI는 성균관컨설팅이 운영하는 논문 전문 서비스입니다. 결제와 영수증, 카드 명세서는 운영사인 <b>성균관컨설팅</b> 이름으로 안전하게 처리됩니다.</p><table style="margin:16px 0 0;border-collapse:separate;border-spacing:0 0"><tr>${['성균관대학교 RISE사업 지원 기업', '석·박사 연구진 검수', '통신판매업 신고 사업자'].map((t) => `<td style="padding:0 8px 0 0"><span style="display:inline-block;padding:7px 12px;border-radius:999px;background:#fff;border:1px solid #C9D3FB;font-size:13px;font-weight:700;color:#2346E8;white-space:nowrap">${t}</span></td>`).join('')}</tr></table></div>`;
const FOOT = `<p style="margin:56px 0 0;padding-top:20px;border-top:1px solid ${LINE};font-size:13px;line-height:1.7;color:#8A93A6">논문AI는 성균관컨설팅이 운영합니다 · 성균관대학교 RISE사업 지원 기업 · 사업자등록번호 272-32-01885 · contact@skkc.co.kr</p>`;
const SAMPLE = { paper: ['sample-paper.png', '논문AI 연구 설계서와 목차 결과물 예시'], survey: ['sample-survey.png', '논문AI 설문지와 응답 분석 결과물 예시'], statistics: ['sample-stats.png', '논문AI 통계표와 해석 결과물 예시'] };
// 상세 맨 위: 표지와 같은 남색 머리(구분, 한 줄 소개, 상품 기본 정보)
const hero = (kicker, head, sub) => `<div style="margin:0 0 28px;padding:46px 30px 42px;border-radius:18px;background:${NAVY};text-align:center"><p style="margin:0;font-size:15px;font-weight:700;letter-spacing:.06em;color:#9DB0FF">${esc(kicker)}</p><h2 style="margin:14px 0 0;font-size:30px;line-height:1.42;font-weight:800;color:#FFFFFF;letter-spacing:-.03em">${head}</h2>${sub ? `<p style="margin:16px 0 0;font-size:16px;line-height:1.6;color:#C6CEE6">${esc(sub)}</p>` : ''}</div>`;
const KICK = (p) => (p.service === 'paper' ? TYPE[p.code.split('-')[1].toLowerCase()] : p.kind === 'extra' ? '추가 옵션' : p.kind === 'addon' ? (p.service === 'statistics' ? '통계분석 옵션' : '추가 옵션') : p.code === 'S-FULL' ? '설문조사 원스톱' : p.service === 'survey' ? '설문조사' : '논문 맞춤 통계분석');
for (const p of products) {
  let body = '';
  if (p.kind === 'extra') {
    body = hero(KICK(p), '기준 분량을 넘는 만큼만,<br>단위로 정확하게', `추가 분량 1단위 ${won(p.price)}`) + TRUST
      + sec('이렇게 담아 주세요', `<p style="margin:0;font-size:16px;line-height:1.8;color:${INK2}">논문AI 주문서의 금액 안내에 <b>추가 분량 N단위</b>가 있으면, 이 상품을 <b>N개</b> 담아 본 상품과 함께 한 번에 결제해 주세요. 1단위는 <b>${won(p.price)}</b>입니다.</p>`)
      + sec('이 단가를 쓰는 상품', checks(p.includes));
  } else if (p.kind === 'addon') {
    const pt = pitch(p);
    const isEn = p.code === 'A-ENGLISH';
    const priceText = isEn ? `${p.unit.size}쪽마다 ${won(p.price)}` : won(p.price);
    const howTo = isEn
      ? `${esc(p.applies)}에 더할 수 있습니다. 논문AI 주문서에서 영문 논문 작성을 고르면 원고 분량에 맞춰 단위 수가 계산됩니다. 결제 화면에 나온 단위 수만큼 이 상품을 담아 본 상품과 함께 한 번에 결제해 주세요.`
      : `${esc(p.applies)}에 더할 수 있습니다. 논문AI 주문서에서 이 옵션을 고르면 결제 화면에 본 상품과 함께 안내되니, 장바구니에 함께 담아 한 번에 결제해 주세요.`;
    body = hero(KICK(p), pt.who.length ? esc(pt.head).replace(/, /, ',<br>') : esc(p.lines.join(' ')), `${p.name.replace('[논문AI] ', '')} · ${priceText}`) + TRUST
      + (pt.who.length ? sec('이런 분께 맞습니다', checks(pt.who)) : '')
      + sec(pt.who.length ? '받는 결과물' : '무엇이 달라지나요', checks(p.includes))
      + sec('함께 결제하는 법', `<p style="margin:0;font-size:16px;line-height:1.8;color:${INK2}">${howTo}</p>`);
  } else {
    const pt = pitch(p);
    const inc = p.includes.filter((x) => !/수정 \d+회/.test(x)).map((x) => x.replace(/\s*\(.*?\)\s*/g, ' ').trim());
    body = hero(KICK(p), esc(pt.head).replace(/, /, ',<br>'), `${p.name.replace('[논문AI] ', '')} · ${p.meta}`) + TRUST
      + (pt.who.length ? sec('이런 분께 맞습니다', checks(pt.who)) : '')
      + sec('받는 결과물', checks(inc)) + (SAMPLE[p.service] ? img(SAMPLE[p.service][0], SAMPLE[p.service][1]) : '')
      + (p.code === 'T-SIM' ? `<p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:${MUTED}">교육과 연습을 위한 가상 데이터로 진행합니다.</p>` : '')
      + sec('함께 고르면 좋은 옵션', spec(optionRows(p)))
      + sec('진행 순서', cards(STEPS))
      + sec('논문AI가 다른 점', whyHtml);
  }
  p.html = `<div style="max-width:780px;margin:0 auto;padding:8px 4px 24px;font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;line-height:1.7;color:${INK2};word-break:keep-all">${body}${FOOT}</div>`;
}

// 이미지 그리기: docs/ 글꼴을 잠깐 서비스한다
const docs = path.join(root, 'docs');
if (!fs.existsSync(path.join(docs, 'assets/css/site.css'))) { console.error('docs/ 빌드가 필요합니다: node tools/build.mjs'); process.exit(1); }
const server = http.createServer((req, res) => {
  const file = path.join(docs, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(docs) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', { '.css': 'text/css', '.woff2': 'font/woff2' }[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const mark = (doc, dot, size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}"><rect x="5" y="3.5" width="19" height="25" rx="2.5" fill="none" stroke="${doc}" stroke-width="2.2"/><path d="M9.5 10h10M9.5 14.5h10M9.5 19h6" stroke="${doc}" stroke-width="2.2" stroke-linecap="round"/><circle cx="24.5" cy="23.5" r="5.5" fill="${dot}"/><path d="M22.2 23.6l1.6 1.6 3-3.2" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const MARK = mark('#0F1B3D', '#2346E8', 44);
// 상품 이미지: 논문 표지처럼 위에 구분(학위·서비스), 가운데 제목, 아래 논문AI. 남색 바탕에 글자만 쓰고 그림은 넣지 않는다
const TASK_TITLE = { full: ['전체 구성·', '초고 완성'], edit: ['논문', '첨삭·교정'], proposal: ['연구계획서', '작성'] };
const FB_TITLE = { journal: ['심사 의견', '반영'], report: ['검토 의견', '반영'], youth: ['선생님 피드백', '반영'], personal: ['피드백', '반영'] };
const BLUE_TAG = '수정표 작성, 반영 부분은 파란색 표시';
const TAG = {
  full: '주제 한 줄에서 장별 초고까지', edit: '문장과 논리를 제출 수준으로', proposal: '목적부터 분석 계획까지 탄탄하게',
  'S-FULL': '설문 진행과 응답 정리까지 한 번에', 'S-NEW': '검증된 척도로 문항 구성', 'S-EDIT': '문항과 척도를 정교하게', 'S-FB': BLUE_TAG, 'S-ANALYZE': '연구 가설에 맞는 분석과 해석',
  'T-BASIC': '주제와 데이터에 맞는 분석과 통계표', 'T-INTERP': '가설별 분석 설계부터 결과 해석까지', 'T-CHAPTER': '분석부터 논문 4장 본문까지', 'T-FB': BLUE_TAG, 'T-SIM': '분석 흐름을 미리 익히는 실습', 'T-ADV': 'PROCESS Macro로 깊이 있게',
  'A-PPT': '논문 핵심을 담은 발표 자료와 스크립트', 'A-ENGLISH': '', 'A-PRIORITY': '작업 순서를 앞당겨 더 빠르게', 'A-FORMAT': '제출 양식까지 빈틈없이', 'A-REVISION': '결과물을 한 번 더 다듬습니다',
};
const STITLE = { 'S-FULL': ['설문지 작성부터', '통계 해석까지'], 'S-NEW': ['설문지', '작성'], 'S-EDIT': ['설문지', '점검·수정'], 'S-FB': ['설문지', '피드백 반영'], 'S-ANALYZE': ['설문 응답', '통계 분석·해석'],
  'T-BASIC': ['논문 맞춤', '통계분석 기본형'], 'T-INTERP': ['논문 맞춤', '통계분석 표준형'], 'T-CHAPTER': ['통계분석과', '연구결과 작성'], 'T-FB': ['통계 재분석·', '피드백 반영'], 'T-SIM': ['학습용', '시뮬레이션'], 'T-ADV': ['심화 분석', '매개·조절효과'],
  'A-PPT': ['심사 발표', 'PPT 제작'], 'A-ENGLISH': ['영문 논문', '작성'], 'A-PRIORITY': ['우선 처리'], 'A-FORMAT': ['양식', '상세 적용'], 'A-REVISION': ['추가 수정'] };
function cover(p) {
  if (p.code === 'P-SHORT-FULL') return { kicker: '소논문', title: ['8쪽 소논문', '초고 완성'], tag: '실존 참고문헌과 본문 인용까지' };
  if (p.service === 'paper') {
    const [, t, k] = p.code.split('-'); const type = t.toLowerCase(), task = { FULL: 'full', EDIT: 'edit', FB: 'feedback', PROP: 'proposal' }[k];
    const title = task === 'feedback' ? (FB_TITLE[type] || ['교수님 피드백', '반영']) : TASK_TITLE[task];
    const tag = task === 'feedback' ? (type === 'journal' ? '답변서 작성, 반영 부분은 파란색 표시' : BLUE_TAG) : TAG[task];
    return { kicker: TYPE[type], title, tag };
  }
  if (p.kind === 'extra') return { kicker: '추가 옵션', title: ['추가 분량'], tag: `1단위 ${won(p.price)}` };
  if (p.code === 'A-ENGLISH') return { kicker: '추가 옵션', title: STITLE[p.code], tag: `${p.unit.size}쪽마다 ${won(p.price)}` };
  const kicker = p.kind === 'addon' ? (p.service === 'statistics' ? '통계분석 옵션' : '추가 옵션') : p.code === 'S-FULL' ? '설문조사 원스톱' : p.service === 'survey' ? '설문조사' : '통계분석';
  return { kicker, title: STITLE[p.code], tag: TAG[p.code] };
}
const imgHtml = (p) => {
  const c = cover(p);
  const longest = Math.max(...c.title.map((l) => l.replace(/\s/g, '').length));
  const size = longest >= 6 ? 112 : longest === 5 ? 124 : 132;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="${base}/assets/css/site.css"><style>
html,body{margin:0;width:1000px;height:1000px;overflow:hidden;background:#0F1B3D}
.c{position:relative;width:1000px;height:1000px;box-sizing:border-box;font-family:var(--sans);color:#FFFFFF;overflow:hidden;background:radial-gradient(90% 75% at 50% 0%,#1E3170 0,#0F1B3D 66%);text-align:center}
.frame{position:absolute;inset:36px;border:1.5px solid rgba(157,176,255,.26);border-radius:4px}
.k{position:absolute;left:0;right:0;top:128px;margin:0;font-size:40px;font-weight:700;letter-spacing:.06em;color:#9DB0FF}
.mid{position:absolute;left:80px;right:80px;top:210px;bottom:250px;display:flex;flex-direction:column;align-items:center;justify-content:center}
h1{margin:0;font-family:var(--serif);font-weight:700;font-size:${size}px;line-height:1.17;letter-spacing:-.05em;word-break:keep-all}
h1 span{display:block}
.rule{width:56px;height:4px;border-radius:2px;background:#9DB0FF;margin:50px 0 0}
.g{margin:32px 0 0;font-size:35px;font-weight:500;letter-spacing:-.02em;color:#C6CEE6;word-break:keep-all}
.brand{position:absolute;left:0;right:0;bottom:116px;display:flex;align-items:center;justify-content:center;gap:12px;font-weight:800;font-size:40px;letter-spacing:-.02em}
.brand b{color:#9DB0FF}
.url{position:absolute;left:0;right:0;bottom:76px;font-size:22px;font-weight:600;letter-spacing:.05em;color:#8592BA}
</style></head><body><div class="c"><div class="frame"></div>
<p class="k">${esc(c.kicker)}</p>
<div class="mid"><h1>${c.title.map((l) => `<span>${esc(l)}</span>`).join('')}</h1><div class="rule"></div><p class="g">${esc(c.tag)}</p></div>
<div class="brand">${mark('#FFFFFF', '#4D6BFF', 50)}<span>논문<b>AI</b></span></div>
<span class="url">nonmunai.kr</span>
</div></body></html>`;
};

// 디지털 상품 파일(결제 뒤 내려받는 안내 이미지): 표지와 같은 남색 머리, 본문은 밝게
const guideHtml = () => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="${base}/assets/css/site.css"><style>
html,body{margin:0;width:1000px;height:1400px;overflow:hidden;background:#F5F7FB}
.c{box-sizing:border-box;width:1000px;height:1400px;font-family:var(--sans);color:#0F1B3D;display:flex;flex-direction:column}
.hd{background:radial-gradient(90% 120% at 50% 0%,#1E3170 0,#0F1B3D 70%);color:#fff;padding:76px 84px 70px;text-align:center}
.brand{display:flex;align-items:center;justify-content:center;gap:12px;font-weight:800;font-size:36px;letter-spacing:-.02em}.brand b{color:#9DB0FF}
h1{font-family:var(--serif);font-weight:700;font-size:66px;line-height:1.25;letter-spacing:-.045em;margin:52px 0 0}
.lead{font-size:28px;line-height:1.6;color:#C6CEE6;margin:22px auto 0;max-width:720px;word-break:keep-all}
.bd{flex:1;display:flex;flex-direction:column;padding:56px 84px 64px}
ol{list-style:none;margin:0;padding:0;display:grid;gap:20px;counter-reset:s}
li{counter-increment:s;background:#fff;border:1px solid #DDE3EE;border-radius:16px;padding:30px 34px 30px 108px;position:relative;font-size:26px;line-height:1.6;color:#2B3654;word-break:keep-all}
li:before{content:counter(s);position:absolute;left:34px;top:30px;width:48px;height:48px;border-radius:50%;background:#0F1B3D;color:#fff;font-weight:800;font-size:25px;display:flex;align-items:center;justify-content:center}
li b{display:block;color:#0F1B3D;font-size:30px;margin-bottom:8px;letter-spacing:-.02em}
.foot{margin-top:auto;padding-top:28px;border-top:1px solid #DDE3EE;font-size:22px;line-height:1.7;color:#5B6478;text-align:center}
.foot b{color:#0F1B3D}
</style></head><body><div class="c"><div class="hd"><div class="brand">${mark('#FFFFFF', '#4D6BFF', 46)}<span>논문<b>AI</b></span></div>
<h1>결제해 주셔서 감사합니다</h1><p class="lead">진행 상황과 결과물은 논문AI 주문 페이지에서 확인합니다.</p></div>
<div class="bd"><ol><li><b>결제 화면으로 돌아가 알려 주세요</b>nonmunai.kr 결제 화면에서 '결제를 마쳤어요'를 누르면 바로 작업 순서에 배정되고, 예상 전달일을 알려 드립니다.</li>
<li><b>아직 주문서를 내지 않았다면</b>nonmunai.kr에서 주문서를 작성해 주세요. 요청 사항에 결제한 상품 이름과 결제자 이름을 적으면 이 결제와 연결해 드립니다.</li>
<li><b>진행 상황과 결과물</b>단계가 바뀔 때마다 메일로 알려 드리고, 결과물은 주문 페이지에서 내려받습니다. 주문 조회는 nonmunai.kr/orders에서 주문번호와 조회 비밀번호로 할 수 있습니다.</li></ol>
<p class="foot"><b>문의</b> contact@skkc.co.kr · 성균관컨설팅 상담 채널<br>논문AI 운영 성균관컨설팅 · 사업자등록번호 272-32-01885</p></div></div></body></html>`;

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1 });
const loadFonts = (txt) => page.evaluate(async (t) => { await Promise.all([document.fonts.load('700 60px "Noto Serif KR"', t), document.fonts.load('700 26px "Pretendard Variable"', t), document.fonts.load('500 26px "Pretendard Variable"', t)]); await document.fonts.ready; }, txt);
for (const p of products) {
  await page.setContent(imgHtml(p), { waitUntil: 'networkidle' });
  { const c = cover(p); await loadFonts(c.kicker + c.title.join('') + c.tag + '논문AI nonmunai.kr 0123456789,원'); }
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(out, 'img', `${p.code}.jpg`), type: 'jpeg', quality: 86 });
  p.image = `img/${p.code}.jpg`;
}
await page.setViewportSize({ width: 1000, height: 1400 });
await page.setContent(guideHtml(), { waitUntil: 'networkidle' });
await loadFonts('결제해 주셔서 감사합니다 논문AI 결제 화면으로 돌아가 알려 주세요 아직 주문서를 내지 않았다면 진행 상황과 결과물 문의 운영 성균관컨설팅');
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(out, '논문AI-주문-안내.png'), type: 'png' });
await browser.close();
server.close();
fs.writeFileSync(path.join(out, 'products.json'), JSON.stringify(products, null, 1));
console.log(`imweb: 상품 ${products.length}개 (본 ${products.filter((p) => p.kind === 'main').length}, 옵션 ${products.filter((p) => p.kind === 'addon').length}, 추가 분량 ${products.filter((p) => p.kind === 'extra').length}) → ${out}`);
