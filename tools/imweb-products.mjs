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

const TYPE = { master: '석사학위논문', doctor: '박사학위논문', journal: '학술지 투고논문', bachelor: '학사·졸업논문', report: '일반 연구보고서', youth: '청소년 탐구논문', personal: '개인 관심연구' };
const TASK = { full: '전체 구성·초안 작성', edit: '부분 첨삭·수정', feedback: '피드백 반영', proposal: '연구계획서 작성' };
const FEEDBACK_TASK = { journal: '심사 의견 반영', report: '검토 의견 반영', youth: '선생님 피드백 반영', master: '교수님 피드백 반영', doctor: '교수님 피드백 반영', bachelor: '교수님 피드백 반영', personal: '피드백 반영' };
const items = DEFAULT_CATALOG.items;
const find = (c) => items.find((i) => i.code === c);

// 추가 분량 단가별 상품: 같은 단가를 쓰는 본 상품을 묶는다
const unitUsers = {};
for (const it of items) if (it.unitPrice) (unitUsers[it.unitPrice] = unitUsers[it.unitPrice] || []).push(it);

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
    lines = it.name === '설문조사 처음부터 끝까지' ? ['설문조사', '처음부터 끝까지'] : it.code === 'S-ANALYZE' ? ['모은 응답', '분석·해석'] : it.code === 'S-NEW' ? ['설문지', '새로 만들기'] : it.code === 'S-EDIT' ? ['기존 설문지', '수정'] : ['설문지', '교수님 피드백 반영'];
    meta = `기본 납기 영업일 ${it.days}일`;
  } else if (it.service === 'statistics') {
    family = it.addon ? '추가 옵션 · 통계분석' : '통계분석';
    lines = { 'T-BASIC': ['기초 통계', '분석과 통계표'], 'T-INTERP': ['통계표와', '쉬운 해석'], 'T-CHAPTER': ['논문 결과장', '정리 지원'], 'T-FB': ['기존 분석 수정', '교수님 피드백 반영'], 'T-SIM': ['학습용 시뮬레이션', '데이터 분석'], 'T-ADV': ['심화 분석 가산', '매개·조절효과'] }[it.code];
    meta = it.addon ? '통계분석·응답 분석 주문에 더하는 옵션' : `기본 납기 영업일 ${it.days}일`;
  } else {
    family = '추가 옵션';
    lines = { 'A-PRIORITY': ['우선 처리', '작업 순서 앞당김'], 'A-FORMAT': ['학교·학술지', '양식 상세 적용'], 'A-REVISION': ['추가 수정', '1회'] }[it.code];
    meta = '논문AI 주문에 더하는 옵션';
  }
  if (it.addon) applies = it.code === 'T-ADV' ? '통계분석(통계표+해석, 결과장 정리)과 설문 응답 분석 주문' : it.code === 'A-FORMAT' ? '논문 작성·첨삭 주문' : '논문·설문조사·통계분석 주문 전체';
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

// 요약 설명(아임웹 메타 설명): 160자 안팎
for (const p of products) {
  const inc = p.includes.slice(0, 4).map((x) => x.replace(/\(.*?\)/g, '').trim()).join(', ');
  p.summary = p.kind === 'extra'
    ? `논문AI 주문서에 '추가 분량 N단위'가 표시되면 그 단위 수만큼 담아 결제하는 상품입니다. 1단위 ${won(p.price)}.`
    : p.kind === 'addon'
      ? `${p.lines.join(' ')} · ${won(p.price)} · ${p.applies}에 더할 수 있습니다. 논문AI(nonmunai.kr) 주문과 함께 결제하세요.`
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

const TYPE_SHORT = { master: '석사학위논문', doctor: '박사학위논문', journal: '학술지 논문', bachelor: '졸업논문', report: '연구보고서', youth: '탐구논문', personal: '연구 원고' };
const teacher = (t) => (t === 'youth' ? '선생님' : t === 'journal' ? '심사위원' : t === 'report' ? '검토자' : '교수님');
function pitch(p) {
  if (p.service === 'paper') {
    const t = p.code.split('-')[1].toLowerCase(), task = { FULL: 'full', EDIT: 'edit', FB: 'feedback', PROP: 'proposal' }[p.code.split('-')[2]];
    const n = TYPE_SHORT[t];
    return {
      full: { head: `주제 한 줄에서 장별 초안까지, ${n}을 처음부터 함께 완성합니다`, who: [`주제는 정했지만 어디서부터 써야 할지 막막한 분`, `연구모형, 가설, 목차를 한 번에 제대로 잡고 싶은 분`, `일정이 빠듯해 탄탄한 초안이 빨리 필요한 분`] },
      edit: { head: `${n}의 문장과 논리를 다듬어 제출할 수 있는 원고로 만듭니다`, who: [`초안은 있지만 문장과 흐름이 매끄럽지 않은 분`, `인용과 형식을 꼼꼼하게 점검받고 싶은 분`, `제출 전에 전문가의 눈으로 마지막 점검을 받고 싶은 분`] },
      feedback: { head: `${teacher(t)} 의견을 항목별로 정확하게 반영합니다`, who: [`${teacher(t)} 의견을 받았는데 어떻게 고쳐야 할지 막막한 분`, `정해진 일정 안에 수정본을 내야 하는 분`, `무엇을 어디서 고쳤는지 한눈에 정리해 보여 드려야 하는 분`] },
      proposal: { head: `연구 목적부터 분석 계획까지, 설득력 있는 연구계획서를 세웁니다`, who: [`연구계획서 심사를 앞둔 분`, `주제는 있지만 연구 방법을 정하지 못한 분`, `선행연구와 연구모형을 체계적으로 정리해야 하는 분`] },
    }[task];
  }
  const M = {
    'S-FULL': { head: '설문지 설계부터 응답 정리, 통계와 해석까지 한 번에 끝냅니다', who: ['설문조사가 처음이라 무엇부터 해야 할지 모르는 분', '척도 선정과 문항 구성에 자신이 없는 분', '응답을 모은 뒤 분석과 결과 정리까지 이어서 맡기고 싶은 분'] },
    'S-NEW': { head: '연구 변인에 맞는 검증된 척도로 설문지를 새로 만듭니다', who: ['연구 변인은 정했지만 척도를 고르지 못한 분', '문항 수와 구성을 어떻게 잡을지 막막한 분', '바로 배포할 수 있는 온라인 설문이 필요한 분'] },
    'S-EDIT': { head: '기존 설문지의 문항과 척도를 점검하고 완성도를 높입니다', who: ['설문지는 있지만 문항 표현이 어색한 분', '척도 구성과 문항 순서가 맞는지 확인하고 싶은 분', '배포 전에 마지막 점검이 필요한 분'] },
    'S-FB': { head: '설문지에 대한 교수님 의견을 항목별로 반영합니다', who: ['설문지 수정 의견을 받고 방향을 잡지 못한 분', '심사 일정에 맞춰 수정본이 필요한 분', '수정 내용을 정리해 보여 드려야 하는 분'] },
    'S-ANALYZE': { head: '모은 응답으로 신뢰도부터 가설 검증까지 분석합니다', who: ['응답은 모았지만 분석을 어떻게 할지 막막한 분', '가설 검증 결과를 논문 형식으로 정리하고 싶은 분', '통계표를 읽고 해석하는 데 도움이 필요한 분'] },
    'T-BASIC': { head: '데이터를 정리하고 요청하신 분석을 APA 통계표로 드립니다', who: ['분석 방법은 정했고 실행과 표 작성이 필요한 분', 'SPSS를 다루기 어려운 분', '논문 형식에 맞는 통계표가 필요한 분'] },
    'T-INTERP': { head: 'SPSS를 몰라도 됩니다. 통계표와 쉬운 해석까지 드립니다', who: ['어떤 분석을 해야 할지부터 막막한 분', '결과표를 받아도 읽고 설명하기 어려운 분', '지도교수님께 결과를 자신 있게 설명하고 싶은 분'] },
    'T-CHAPTER': { head: '분석부터 논문 결과장(4장) 서술 초안까지 완성합니다', who: ['데이터는 있고 결과장을 써야 하는 분', '통계표와 본문 서술을 함께 맞춰야 하는 분', '표·그림 번호와 형식까지 정리하고 싶은 분'] },
    'T-FB': { head: '교수님 의견대로 다시 분석하고 통계표를 고칩니다', who: ['분석 방법을 바꾸라는 의견을 받은 분', '표 형식이나 수치 보고를 고쳐야 하는 분', '수정 내용을 대조표로 정리해 보여 드려야 하는 분'] },
    'T-SIM': { head: '가상 데이터로 분석 절차를 직접 익히는 학습용 실습입니다', who: ['데이터를 모으기 전에 분석 흐름을 미리 익히고 싶은 분', '분석 방법이 연구에 맞는지 먼저 확인하고 싶은 분', '통계 수업 과제나 연습이 필요한 분'] },
  };
  return M[p.code] || { head: p.lines.join(' '), who: [] };
}
const optionRows = (p) => {
  const o = [];
  if (['T-INTERP', 'T-CHAPTER', 'T-BASIC', 'S-ANALYZE'].includes(p.code)) o.push(['심화 분석(매개·조절)', `<b>${won(find('T-ADV').price)}</b>`]);
  o.push(['우선 처리', `<b>${won(find('A-PRIORITY').price)}</b> · 작업 순서를 앞당겨 납기를 줄입니다`]);
  if (p.service === 'paper') o.push(['학교·학술지 양식 상세 적용', `<b>${won(find('A-FORMAT').price)}</b> · 여백, 글꼴, 표·그림, 목차 서식까지`]);
  o.push(['추가 수정', `<b>${won(find('A-REVISION').price)}</b> · 결과물을 한 번 더 다듬습니다`]);
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
const TRUST = `<div style="margin:0 0 40px;padding:24px 26px;border-radius:16px;background:#F5F7FB;border:1px solid ${LINE}"><p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#2346E8">논문AI 결제 안내</p><p style="margin:0;font-size:17px;line-height:1.75;color:${NAVY};font-weight:600">논문AI는 성균관컨설팅이 운영하는 논문 전문 서비스입니다. 결제와 영수증, 카드 명세서는 운영사인 <b>성균관컨설팅</b> 이름으로 안전하게 처리됩니다.</p><table style="margin:16px 0 0;border-collapse:separate;border-spacing:0 0"><tr>${['성균관대학교 RISE사업 지원 기업', '석·박사 연구진 검수', '통신판매업 신고 사업자'].map((t) => `<td style="padding:0 8px 0 0"><span style="display:inline-block;padding:7px 12px;border-radius:999px;background:#fff;border:1px solid #C9D3FB;font-size:13px;font-weight:700;color:#2346E8;white-space:nowrap">${t}</span></td>`).join('')}</tr></table></div>`;
const FOOT = `<p style="margin:56px 0 0;padding-top:20px;border-top:1px solid ${LINE};font-size:13px;line-height:1.7;color:#8A93A6">논문AI는 성균관컨설팅이 운영합니다 · 성균관대학교 RISE사업 지원 기업 · 사업자등록번호 272-32-01885 · contact@skkc.co.kr</p>`;
const SAMPLE = { paper: ['sample-paper.png', '논문AI 연구 설계서와 목차 결과물 예시'], survey: ['sample-survey.png', '논문AI 설문지와 응답 분석 결과물 예시'], statistics: ['sample-stats.png', '논문AI 통계표와 해석 결과물 예시'] };
for (const p of products) {
  let body = '';
  if (p.kind === 'extra') {
    body = `<p style="margin:0;font-size:15px;font-weight:700;color:${GOLD};letter-spacing:.06em">논문AI 추가 분량</p><h2 style="margin:10px 0 0;font-size:30px;line-height:1.35;font-weight:800;color:${NAVY};letter-spacing:-.03em">기준 분량을 넘는 만큼만, 단위로 정확하게</h2>`
      + sec('이렇게 담아 주세요', `<p style="margin:0;font-size:16px;line-height:1.8;color:${INK2}">논문AI 주문서의 금액 안내에 <b>추가 분량 N단위</b>가 있으면, 이 상품을 <b>N개</b> 담아 본 상품과 함께 한 번에 결제해 주세요. 1단위는 <b>${won(p.price)}</b>입니다.</p>`)
      + sec('이 단가를 쓰는 상품', checks(p.includes));
  } else if (p.kind === 'addon') {
    body = `<p style="margin:0;font-size:15px;font-weight:700;color:${GOLD};letter-spacing:.06em">논문AI 추가 옵션</p><h2 style="margin:10px 0 0;font-size:30px;line-height:1.35;font-weight:800;color:${NAVY};letter-spacing:-.03em">${esc(p.lines.join(' '))}</h2>`
      + sec('무엇이 달라지나요', checks(p.includes))
      + sec('함께 결제하는 법', `<p style="margin:0;font-size:16px;line-height:1.8;color:${INK2}">${esc(p.applies)}에 더할 수 있습니다. 논문AI 주문서에서 이 옵션을 고르면 결제 화면에 본 상품과 함께 안내되니, 장바구니에 함께 담아 한 번에 결제해 주세요.</p>`);
  } else {
    const pt = pitch(p);
    const inc = p.includes.filter((x) => !/수정 \d+회/.test(x)).map((x) => x.replace(/\s*\(.*?\)\s*/g, ' ').trim());
    body = `<p style="margin:0;font-size:15px;font-weight:700;color:${GOLD};letter-spacing:.02em">${esc(p.family)}</p><h2 style="margin:10px 0 0;font-size:30px;line-height:1.35;font-weight:800;color:${NAVY};letter-spacing:-.03em">${esc(pt.head)}</h2><p style="margin:14px 0 0;font-size:17px;line-height:1.75;color:${INK2}">${esc(p.name.replace('[논문AI] ', ''))}</p>`
      + (pt.who.length ? sec('이런 분께 맞습니다', checks(pt.who)) : '')
      + sec('받는 결과물', checks(inc)) + (SAMPLE[p.service] ? img(SAMPLE[p.service][0], SAMPLE[p.service][1]) : '')
      + (p.code === 'T-SIM' ? `<p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:${MUTED}">교육과 연습을 위한 가상 데이터로 진행합니다.</p>` : '')
      + sec('함께 고르면 좋은 옵션', spec(optionRows(p)));
  }
  body += sec('진행 순서', cards(STEPS) + img('process.png', '논문AI 진행 순서'))
    + (p.kind === 'main' ? sec('논문AI가 다른 점', whyHtml) : '') + FOOT;
  p.html = `<div style="max-width:780px;margin:0 auto;padding:8px 4px 24px;font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;color:${INK2}">${TRUST}${body}</div>`;
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
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="44" height="44"><rect x="5" y="3.5" width="19" height="25" rx="2.5" fill="none" stroke="#0F1B3D" stroke-width="2.2"/><path d="M9.5 10h10M9.5 14.5h10M9.5 19h6" stroke="#0F1B3D" stroke-width="2.2" stroke-linecap="round"/><circle cx="24.5" cy="23.5" r="5.5" fill="#2346E8"/><path d="M22.2 23.6l1.6 1.6 3-3.2" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHECK = '<svg viewBox="0 0 20 20" width="26" height="26"><circle cx="10" cy="10" r="10" fill="#EEF2FF"/><path d="M5.6 10.3l2.9 2.9 5.9-6.3" fill="none" stroke="#2346E8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// 상품 이미지: 논문AI 사이트와 같은 디자인(밝은 바탕, 로고, 파란 포인트, 연구 설계 시트). 글자는 최소로
const ACCENT = { paper: '#2346E8', survey: '#0E8A5F', statistics: '#4B3BD1', addon: '#0F1B3D' };
const TASK_TITLE = { full: ['전체 구성·', '초안 작성'], edit: ['부분 첨삭·', '수정'], proposal: ['연구계획서', '작성'] };
const FB_TITLE = { journal: ['심사 의견', '반영'], report: ['검토 의견', '반영'], youth: ['선생님 피드백', '반영'], personal: ['피드백', '반영'] };
const TAG = {
  full: '주제 한 줄에서 장별 초안까지', edit: '문장과 논리를 제출 수준으로', proposal: '목적부터 분석 계획까지 탄탄하게',
  'S-FULL': '설계부터 해석까지 한 번에', 'S-NEW': '검증된 척도로 새로 구성', 'S-EDIT': '문항과 척도를 정교하게', 'S-FB': '의견을 항목별로 정확하게', 'S-ANALYZE': '신뢰도부터 가설 검증까지',
  'T-BASIC': 'APA 통계표로 깔끔하게', 'T-INTERP': '통계표에 쉬운 해석까지', 'T-CHAPTER': '분석부터 결과장 초안까지', 'T-FB': '의견대로 다시 분석', 'T-SIM': '분석 흐름을 미리 익히는 실습', 'T-ADV': '매개·조절효과까지 깊이 있게',
  'A-PRIORITY': '작업 순서를 앞당겨 더 빠르게', 'A-FORMAT': '제출 양식까지 빈틈없이', 'A-REVISION': '한 번 더 다듬는 수정',
};
const STITLE = { 'S-FULL': ['처음부터', '끝까지'], 'S-NEW': ['설문지', '새로 만들기'], 'S-EDIT': ['기존 설문지', '수정'], 'S-FB': ['설문지', '피드백 반영'], 'S-ANALYZE': ['모은 응답', '분석·해석'],
  'T-BASIC': ['기초 통계와', '통계표'], 'T-INTERP': ['통계표와', '쉬운 해석'], 'T-CHAPTER': ['논문 결과장', '정리'], 'T-FB': ['기존 분석', '수정'], 'T-SIM': ['학습용', '시뮬레이션'], 'T-ADV': ['심화 분석', '매개·조절'],
  'A-PRIORITY': ['우선 처리'], 'A-FORMAT': ['양식', '상세 적용'], 'A-REVISION': ['추가 수정'] };
function cover(p) {
  if (p.service === 'paper') {
    const [, t, k] = p.code.split('-'); const type = t.toLowerCase(), task = { FULL: 'full', EDIT: 'edit', FB: 'feedback', PROP: 'proposal' }[k];
    const title = task === 'feedback' ? (FB_TITLE[type] || ['교수님 피드백', '반영']) : TASK_TITLE[task];
    const tag = task === 'feedback' ? `${type === 'journal' ? '심사' : type === 'report' ? '검토' : type === 'youth' ? '선생님' : type === 'personal' ? '받은' : '교수님'} 의견을 항목별로 정확하게` : TAG[task];
    return { kicker: TYPE[type], title, tag, art: 'paper' };
  }
  if (p.kind === 'extra') return { kicker: '추가 분량', title: ['추가 분량'], tag: `1단위 ${won(p.price)}`, art: 'extra' };
  return { kicker: p.kind === 'addon' ? '추가 옵션' : p.service === 'survey' ? '설문조사' : '통계분석', title: STITLE[p.code], tag: TAG[p.code], art: p.kind === 'addon' ? 'addon' : p.service };
}
const ART = {
  paper: (a) => `<svg viewBox="0 0 390 170" width="372" height="162"><defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#41506B"/></marker></defs><rect x="0" y="95" width="104" height="46" rx="23" fill="#EEF2FF" stroke="${a}" stroke-width="2"/><rect x="143" y="10" width="104" height="46" rx="23" fill="#E8F7F1" stroke="#0E9F6E" stroke-width="2"/><rect x="286" y="95" width="104" height="46" rx="23" fill="#F1F4F9" stroke="#0F1B3D" stroke-width="2"/><path d="M60 95L170 58" stroke="#41506B" stroke-width="2.2" marker-end="url(#ar)"/><path d="M222 58L330 95" stroke="#41506B" stroke-width="2.2" marker-end="url(#ar)"/><path d="M106 118H282" stroke="#41506B" stroke-width="2.2" stroke-dasharray="6 6" marker-end="url(#ar)"/></svg>`,
  survey: (a) => `<svg viewBox="0 0 372 170" width="372" height="170">${[0, 1, 2, 3].map((r) => `<rect x="0" y="${r * 42 + 10}" width="${[150, 128, 160, 118][r]}" height="10" rx="5" fill="#E3E8F1"/>${[0, 1, 2, 3, 4].map((c) => `<circle cx="${200 + c * 36}" cy="${r * 42 + 15}" r="11" fill="${c === [3, 4, 2, 3][r] ? a : '#fff'}" stroke="${c === [3, 4, 2, 3][r] ? a : '#C9D3E3'}" stroke-width="2"/>`).join('')}`).join('')}</svg>`,
  statistics: (a) => `<svg viewBox="0 0 372 170" width="372" height="170"><path d="M0 2H372M0 34H372M0 168H372" stroke="#0F1B3D" stroke-width="2.4"/>${[0, 1, 2].map((r) => `<rect x="6" y="${r * 40 + 52}" width="${[96, 120, 84][r]}" height="10" rx="5" fill="#E3E8F1"/><rect x="170" y="${r * 40 + 52}" width="46" height="10" rx="5" fill="#E3E8F1"/><rect x="246" y="${r * 40 + 52}" width="40" height="10" rx="5" fill="${r === 1 ? a : '#E3E8F1'}"/><rect x="316" y="${r * 40 + 52}" width="44" height="10" rx="5" fill="#E3E8F1"/>`).join('')}<rect x="6" y="14" width="64" height="10" rx="5" fill="#C9D3E3"/><rect x="170" y="14" width="30" height="10" rx="5" fill="#C9D3E3"/><rect x="246" y="14" width="22" height="10" rx="5" fill="#C9D3E3"/><rect x="316" y="14" width="22" height="10" rx="5" fill="#C9D3E3"/></svg>`,
  addon: (a, code) => {
    const icon = { 'A-PRIORITY': '<circle cx="60" cy="60" r="34" fill="none" stroke="#2346E8" stroke-width="6"/><path d="M60 40v22l14 9" fill="none" stroke="#2346E8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>', 'A-FORMAT': '<rect x="30" y="26" width="60" height="70" rx="6" fill="none" stroke="#2346E8" stroke-width="6"/><path d="M42 46h36M42 60h36M42 74h22" stroke="#2346E8" stroke-width="6" stroke-linecap="round"/>', 'A-REVISION': '<path d="M36 84l8-22 34-34 14 14-34 34z" fill="none" stroke="#2346E8" stroke-width="6" stroke-linejoin="round"/><path d="M36 92h50" stroke="#2346E8" stroke-width="6" stroke-linecap="round"/>', 'T-ADV': '<rect x="22" y="70" width="18" height="24" rx="3" fill="#2346E8"/><rect x="51" y="50" width="18" height="44" rx="3" fill="#2346E8" opacity=".75"/><rect x="80" y="30" width="18" height="64" rx="3" fill="#2346E8" opacity=".5"/>' }[code] || '';
    return `<svg viewBox="0 0 120 120" width="210" height="210"><circle cx="60" cy="60" r="58" fill="#EEF2FF"/>${icon}</svg>`;
  },
  extra: () => `<svg viewBox="0 0 120 120" width="210" height="210"><circle cx="60" cy="60" r="58" fill="#EEF2FF"/><rect x="40" y="24" width="46" height="60" rx="5" fill="#fff" stroke="#C9D3E3" stroke-width="4"/><rect x="32" y="34" width="46" height="60" rx="5" fill="#fff" stroke="#2346E8" stroke-width="5"/><path d="M55 52v24M43 64h24" stroke="#2346E8" stroke-width="5" stroke-linecap="round"/></svg>`,
};
const imgHtml = (p) => {
  const c = cover(p);
  const a = ACCENT[p.kind === 'main' ? p.service : 'addon'];
  const longest = Math.max(...c.title.map((l) => l.length));
  const fs = longest > 7 ? 84 : 96;
  const isSheet = c.art === 'paper' || c.art === 'survey' || c.art === 'statistics';
  const art = isSheet ? `<div class="sheet">${[50, 78].map((y, i) => `<span class="ln" style="top:${y}px;width:${[230, 290][i]}px"></span>`).join('')}<div class="art">${ART[c.art](a)}</div>${[380, 408].map((y, i) => `<span class="ln" style="top:${y}px;width:${[280, 230][i]}px"></span>`).join('')}</div>` : `<div class="badge">${ART[c.art](a, p.code)}</div>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="${base}/assets/css/site.css"><style>
html,body{margin:0;width:1000px;height:1000px;overflow:hidden;background:#F5F7FB}
.c{position:relative;width:1000px;height:1000px;box-sizing:border-box;padding:78px 80px;font-family:var(--sans);color:#0F1B3D;overflow:hidden;background:radial-gradient(90% 70% at 0% 0%,#FFFFFF 0,#F5F7FB 55%,#EDF1F8 100%)}
.top{position:relative;z-index:2;display:flex;align-items:center;gap:14px;font-weight:800;font-size:40px;letter-spacing:-.02em}.top b{color:#2346E8}
.k{position:relative;z-index:2;margin:118px 0 0;font-size:32px;font-weight:700;color:${a};letter-spacing:-.01em}
h1{position:relative;z-index:2;font-family:var(--serif);font-weight:700;font-size:${fs}px;line-height:1.16;letter-spacing:-.045em;margin:20px 0 0;word-break:keep-all}
h1 span{display:block}
.tag{position:relative;z-index:2;margin:30px 0 0;font-size:31px;font-weight:600;color:#41506B;letter-spacing:-.02em;max-width:560px;word-break:keep-all}
.sheet{position:absolute;right:-50px;bottom:-200px;width:540px;height:640px;background:#fff;border:1px solid #DDE3EE;border-radius:12px;box-shadow:0 50px 90px -40px rgba(15,27,61,.42),0 2px 6px rgba(15,27,61,.05);transform:rotate(-5deg);z-index:1}
.sheet .ln{position:absolute;left:56px;height:12px;border-radius:6px;background:#E7EBF3}
.sheet .art{position:absolute;left:46px;top:150px;transform:scale(1.18);transform-origin:0 0}
.badge{position:absolute;right:70px;bottom:74px;z-index:1;width:330px;height:330px;background:#fff;border:1px solid #DDE3EE;border-radius:28px;box-shadow:0 50px 90px -40px rgba(15,27,61,.42);transform:rotate(-5deg);display:flex;align-items:center;justify-content:center}
.url{position:absolute;left:80px;bottom:70px;z-index:2;font-size:22px;font-weight:600;color:#7A8499;letter-spacing:.01em}
</style></head><body><div class="c">
<div class="top">${MARK.replace('width="44" height="44"', 'width="52" height="52"')}<span>논문<b>AI</b></span></div>
<p class="k">${esc(c.kicker)}</p>
<h1>${c.title.map((l) => `<span>${esc(l)}</span>`).join('')}</h1>
<p class="tag">${esc(c.tag)}</p>
${art}
<span class="url">nonmunai.kr</span>
</div></body></html>`;
};

const guideHtml = () => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="${base}/assets/css/site.css"><style>
html,body{margin:0;width:1000px;height:1400px;overflow:hidden;background:#F5F7FB}
.c{box-sizing:border-box;width:1000px;height:1400px;padding:80px 84px;font-family:var(--sans);color:#0F1B3D;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:34px}.brand b{color:#2346E8}
h1{font-family:var(--serif);font-size:62px;line-height:1.25;letter-spacing:-.04em;margin:56px 0 18px}
.lead{font-size:28px;line-height:1.6;color:#2B3654;margin:0 0 44px;word-break:keep-all}
ol{list-style:none;margin:0;padding:0;display:grid;gap:22px;counter-reset:s}
li{counter-increment:s;background:#fff;border:1px solid #DDE3EE;border-radius:16px;padding:28px 32px 28px 104px;position:relative;font-size:26px;line-height:1.55;color:#2B3654;word-break:keep-all}
li:before{content:counter(s);position:absolute;left:32px;top:26px;width:48px;height:48px;border-radius:50%;background:#2346E8;color:#fff;font-weight:800;font-size:26px;display:flex;align-items:center;justify-content:center}
li b{display:block;color:#0F1B3D;font-size:29px;margin-bottom:6px}
.foot{margin-top:auto;font-size:22px;line-height:1.6;color:#5B6478}
.foot b{color:#0F1B3D}
</style></head><body><div class="c"><div class="brand">${MARK}<span>논문<b>AI</b></span></div>
<h1>결제해 주셔서<br>감사합니다</h1><p class="lead">논문AI 주문은 주문 페이지에서 진행 상황을 확인하고 결과물을 받습니다. 아래 순서대로 이어 가 주세요.</p>
<ol><li><b>주문 화면으로 돌아가기</b>nonmunai.kr 결제 화면에서 '결제를 마쳤어요'를 눌러 주세요. 담당자가 결제를 확인하면 작업 순서에 배정됩니다.</li>
<li><b>아직 주문서를 내지 않았다면</b>nonmunai.kr 에서 주문서를 작성해 주세요. 결제한 상품 이름과 결제자 이름을 요청 사항에 적으면 이 결제와 연결해 드립니다.</li>
<li><b>진행 상황과 결과물</b>단계가 바뀔 때마다 메일로 알려 드리고, 결과물은 주문 페이지에서 내려받습니다. 주문 조회는 nonmunai.kr/orders 에서 주문번호와 조회 비밀번호로 할 수 있습니다.</li></ol>
<p class="foot"><b>문의</b> contact@skkc.co.kr · 성균관컨설팅 상담 채널<br>운영 성균관컨설팅 · 사업자등록번호 272-32-01885</p></div></body></html>`;

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
await loadFonts('결제해 주셔서 감사합니다 논문AI 주문 화면으로 돌아가기 아직 주문서를 내지 않았다면 진행 상황과 결과물 문의 운영 성균관컨설팅');
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(out, '논문AI-주문-안내.png'), type: 'png' });
await browser.close();
server.close();
fs.writeFileSync(path.join(out, 'products.json'), JSON.stringify(products, null, 1));
console.log(`imweb: 상품 ${products.length}개 (본 ${products.filter((p) => p.kind === 'main').length}, 옵션 ${products.filter((p) => p.kind === 'addon').length}, 추가 분량 ${products.filter((p) => p.kind === 'extra').length}) → ${out}`);
