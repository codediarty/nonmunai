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
const NAVY = '#0F1B3D', INK2 = '#2B3654', MUTED = '#5B6478', LINE = '#E3E7EF', GOLD = '#B8924A';
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
  if (p.unit) o.push([`추가 분량`, `기준 ${p.unit.base}${p.unit.label}를 넘으면 ${p.unit.size}${p.unit.label}마다 <b>${won(p.unit.price)}</b>`]);
  if (['T-INTERP', 'T-CHAPTER', 'T-BASIC', 'S-ANALYZE'].includes(p.code)) o.push(['심화 분석(매개·조절)', `<b>${won(find('T-ADV').price)}</b>`]);
  o.push(['우선 처리', `<b>${won(find('A-PRIORITY').price)}</b> · 작업 순서를 앞당겨 납기를 줄입니다`]);
  if (p.service === 'paper') o.push(['학교·학술지 양식 상세 적용', `<b>${won(find('A-FORMAT').price)}</b> · 여백, 글꼴, 표·그림, 목차 서식까지`]);
  o.push(['추가 수정', `<b>${won(find('A-REVISION').price)}</b> · 1회마다`]);
  return o;
};
const STEPS = [
  '<b>논문AI에서 주문서 작성</b><br>nonmunai.kr에서 주제와 필요한 작업을 고르고 자료를 올리면 연구 설계와 금액이 바로 계산됩니다.',
  '<b>이 상품으로 결제</b><br>주문서를 내면 결제 화면에서 이 상품이 바로 열립니다. 요청사항에 논문AI 주문번호를 적어 주세요.',
  '<b>작업 순서 배정과 진행 안내</b><br>결제가 확인되면 예상 전달일이 정해지고, 단계가 바뀔 때마다 주문 페이지와 메일로 알려 드립니다.',
  '<b>결과물 전달</b><br>주문 페이지에서 결과물을 내려받고, 포함된 범위 안에서 수정을 요청할 수 있습니다.',
];
const WHY = [
  ['주제 한 줄로 바로 나오는 연구 설계', '연구모형, 가설, 목차, 필요한 표본 수를 연구 설계 엔진이 즉시 계산해 작업의 뼈대를 먼저 보여 드립니다.'],
  ['석·박사 연구진의 검수', '원고와 분석 결과는 석·박사 연구진이 내용과 형식을 검토한 뒤 전달합니다.'],
  ['진행 상황을 숨기지 않습니다', '주문 페이지에서 지금 단계와 예상 전달일을 언제든 확인하고, 담당자와 메시지를 주고받습니다.'],
  ['자료 보안', '올린 자료는 주문자만 열 수 있고, 작업이 끝나면 정해진 기간 뒤 영구 삭제됩니다.'],
];
const whyHtml = `<table style="width:100%;border-collapse:separate;border-spacing:10px"><tr>${WHY.slice(0, 2).map(([h, t]) => `<td style="width:50%;vertical-align:top;padding:22px;border:1px solid ${LINE};border-radius:14px"><p style="margin:0 0 8px;font-size:17px;font-weight:800;color:${NAVY}">${esc(h)}</p><p style="margin:0;font-size:15px;line-height:1.7;color:${MUTED}">${esc(t)}</p></td>`).join('')}</tr><tr>${WHY.slice(2).map(([h, t]) => `<td style="width:50%;vertical-align:top;padding:22px;border:1px solid ${LINE};border-radius:14px"><p style="margin:0 0 8px;font-size:17px;font-weight:800;color:${NAVY}">${esc(h)}</p><p style="margin:0;font-size:15px;line-height:1.7;color:${MUTED}">${esc(t)}</p></td>`).join('')}</tr></table>`;
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
    const specRows = [['기본 납기', `영업일 ${p.days}일 <span style="color:${MUTED}">(결제 확인 다음 날부터)</span>`]];
    if (p.unit) specRows.unshift(['기준 분량', `${p.unit.base}${p.unit.label} 내외`]);
    if (p.includes.some((x) => x.includes('수정 1회'))) specRows.push(['수정', '전달 후 1회 포함']);
    specRows.push(['결과물 전달', '논문AI 주문 페이지에서 내려받기']);
    body = `<p style="margin:0;font-size:15px;font-weight:700;color:${GOLD};letter-spacing:.06em">${esc(p.family)}</p><h2 style="margin:10px 0 0;font-size:30px;line-height:1.35;font-weight:800;color:${NAVY};letter-spacing:-.03em">${esc(pt.head)}</h2><p style="margin:14px 0 0;font-size:17px;line-height:1.75;color:${INK2}">${esc(p.name.replace('[논문AI] ', ''))}. ${esc(p.meta)}.</p>`
      + (pt.who.length ? sec('이런 분께 맞습니다', checks(pt.who)) : '')
      + sec('받는 결과물', checks(p.includes)) + (SAMPLE[p.service] ? img(SAMPLE[p.service][0], SAMPLE[p.service][1]) : '')
      + (p.excludes.length ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.7;color:${MUTED}">${p.excludes.map(esc).join(' · ')}</p>` : '')
      + sec('기준과 납기', spec(specRows))
      + sec('함께 고를 수 있는 옵션', spec(optionRows(p)));
  }
  body += sec('진행 순서', cards(STEPS) + img('process.png', '논문AI 진행 순서'))
    + (p.kind === 'main' ? sec('논문AI가 다른 점', whyHtml) : '') + FOOT;
  p.html = `<div style="max-width:780px;margin:0 auto;padding:8px 4px 24px;font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:16px;color:${INK2}">${body}</div>`;
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
// 표지: 학위논문 양장 표지(천 질감, 금박 글씨)를 본뜬 정사각 이미지
const CLOTH = { paper: ['#16244D', '#0E1838'], survey: ['#123E36', '#0B2B25'], statistics: ['#3B1527', '#290D1A'], addon: ['#23272F', '#171A20'] };
const HANJA = { master: '碩士學位論文', doctor: '博士學位論文', journal: '學術誌 投稿論文', bachelor: '學士 卒業論文', report: '硏究 報告書', youth: '探究 論文', personal: '硏究 論文' };
const hanjaOf = (p) => p.service === 'paper' ? HANJA[p.code.split('-')[1].toLowerCase()] : p.service === 'survey' ? '設問 調査' : p.service === 'statistics' && p.kind === 'main' ? '統計 分析' : p.kind === 'extra' ? '追加 分量' : '追加 選擇';
const GOLD_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="38" height="38"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3E3AE"/><stop offset=".5" stop-color="#C9A55A"/><stop offset="1" stop-color="#E9D394"/></linearGradient></defs><rect x="5" y="3.5" width="19" height="25" rx="2.5" fill="none" stroke="url(#g)" stroke-width="2.2"/><path d="M9.5 10h10M9.5 14.5h10M9.5 19h6" stroke="url(#g)" stroke-width="2.2" stroke-linecap="round"/><circle cx="24.5" cy="23.5" r="5.5" fill="url(#g)"/><path d="M22.2 23.6l1.6 1.6 3-3.2" fill="none" stroke="#14224A" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const GCHECK = '<svg viewBox="0 0 20 20" width="24" height="24"><path d="M4.5 10.4l3.4 3.4 7.6-8" fill="none" stroke="#D9BC72" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const imgHtml = (p) => {
  const [c1, c2] = CLOTH[p.kind === 'main' ? p.service : 'addon'] || CLOTH.paper;
  const list = (p.kind === 'extra' ? ['주문서에 표시된 단위 수만큼 담기', '본 상품과 함께 한 번에 결제', '분량 확인 뒤에만 추가 안내'] : p.includes.slice(0, 4)).map((x) => x.replace(/\s*\(.*?\)\s*/g, ' ').trim()).slice(0, p.kind === 'main' ? 4 : 3);
  const priceTxt = won(p.price).replace('원', '');
  const metaTop = p.kind === 'main' ? p.meta : p.kind === 'extra' ? '기준 분량을 넘는 만큼 담는 상품' : p.meta;
  const longest = Math.max(...p.lines.map((l) => l.length));
  const fs = longest > 11 ? 58 : longest > 8 ? 66 : 76;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="${base}/assets/css/site.css"><style>
html,body{margin:0;width:1000px;height:1000px;overflow:hidden}
body{background:radial-gradient(120% 90% at 30% 15%,#F4F6FA 0,#E3E7EF 60%,#D9DEE8 100%)}
.book{position:absolute;left:70px;top:46px;width:860px;height:908px;border-radius:6px 14px 14px 6px;background:
 repeating-linear-gradient(0deg,rgba(255,255,255,.028) 0 1px,transparent 1px 3px),
 repeating-linear-gradient(90deg,rgba(0,0,0,.06) 0 1px,transparent 1px 3px),
 linear-gradient(160deg,${c1} 0%,${c2} 100%);
 box-shadow:0 40px 60px -30px rgba(10,16,35,.55),0 2px 0 rgba(255,255,255,.08) inset,-2px 0 0 rgba(0,0,0,.35) inset;overflow:hidden;font-family:var(--sans)}
.spine{position:absolute;left:0;top:0;bottom:0;width:58px;background:linear-gradient(90deg,rgba(0,0,0,.42),rgba(0,0,0,.18) 70%,rgba(255,255,255,.06));box-shadow:1px 0 0 rgba(0,0,0,.4)}
.spine:before,.spine:after{content:"";position:absolute;left:12px;right:12px;height:7px;border-top:2px solid #C9A55A;border-bottom:2px solid #C9A55A;opacity:.85}
.spine:before{top:70px}.spine:after{bottom:70px}
.frame{position:absolute;left:96px;right:44px;top:40px;bottom:40px;border:2px solid rgba(214,186,112,.55);border-radius:4px}
.frame:after{content:"";position:absolute;inset:8px;border:1px solid rgba(214,186,112,.35);border-radius:2px}
.in{position:absolute;left:146px;right:94px;top:92px;bottom:86px;display:flex;flex-direction:column}
.gold{background:linear-gradient(100deg,#F6E7B4 0%,#D6B46A 28%,#F2DFA3 52%,#BE9645 76%,#EBD69A 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.hanja{font-family:var(--serif);font-size:30px;letter-spacing:.42em;font-weight:700;text-align:center;margin:0}
.rule{height:2px;margin:26px auto 0;width:180px;background:linear-gradient(90deg,transparent,#C9A55A,transparent)}
h1{font-family:var(--serif);font-weight:800;font-size:${fs}px;line-height:1.2;letter-spacing:-.035em;margin:44px 0 0;text-align:center;word-break:keep-all;text-shadow:0 1px 0 rgba(0,0,0,.25)}
h1 span{display:block}
.cv-sub{display:block;margin:24px 0 0;text-align:center;font-size:25px;font-weight:600;color:#E7E0CC;letter-spacing:-.01em}
ul{list-style:none;margin:40px auto 0;padding:0;display:grid;gap:12px;width:100%;max-width:560px}
li{display:flex;gap:12px;align-items:flex-start;font-size:24px;line-height:1.38;color:#EFE9D8;font-weight:500;letter-spacing:-.015em;word-break:keep-all}
li svg{flex:none;margin-top:3px}
.bottom{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;border-top:1px solid rgba(214,186,112,.45);padding-top:24px}
.price{font-family:var(--serif);font-weight:800;font-size:72px;letter-spacing:-.03em;line-height:1}
.price small{font-size:32px;margin-left:4px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:28px;letter-spacing:-.02em;color:#EADBA8}
.brand em{font-style:normal;font-size:17px;font-weight:600;color:#BFB59C;display:block;letter-spacing:0}
</style></head><body><div class="book"><div class="spine"></div><div class="frame"></div><div class="in">
<p class="hanja gold">${esc(hanjaOf(p))}</p><div class="rule"></div>
<h1 class="gold">${p.lines.map((l) => `<span>${esc(l)}</span>`).join('')}</h1>
<p class="cv-sub">${esc(metaTop)}</p>
<ul>${list.map((x) => `<li>${GCHECK}<span>${esc(x)}</span></li>`).join('')}</ul>
<div class="bottom"><div class="price gold">${priceTxt}<small>원</small></div><div class="brand">${GOLD_MARK}<span>논문AI<em>nonmunai.kr</em></span></div></div>
</div></div></body></html>`;
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
  await loadFonts(p.lines.join('') + p.includes.join('') + p.family + p.meta + '0123456789,원논문AI단위 수만큼 담기주문에 더하는 옵션nonmunai.kr 성균관컨설팅');
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
