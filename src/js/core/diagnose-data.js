// 데이터 파일 사전 진단 (브라우저 안에서만 계산)
import { cronbachAlpha, describe } from './stats.js';

export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text).replace(/^﻿/, '');
  const delim = (s.split('\n')[0].match(/\t/g) || []).length > (s.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

const PII_HEAD = /(이름|성명|성함|name|전화|연락처|휴대|핸드폰|phone|mobile|tel|이메일|메일|e-?mail|주소|address|학번|사번|주민|생년월일|birth|계좌|카카오|아이디|\bid\b)/i;
const PHONE = /^0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function groupKey(name) {
  const n = String(name).trim();
  const m = n.match(/^(.*?)[_.\-\s]?(\d{1,3})(?:[_.\-\s]?[rR])?$/);
  if (m && m[1]) return m[1].replace(/[_.\-\s]+$/, '');
  return null;
}

export function diagnoseRows(rows) {
  if (!rows || rows.length < 2) return { ok: false, message: '데이터 행을 찾지 못했습니다. 첫 줄에 변수 이름이 있는지 확인해 주세요.' };
  const header = rows[0].map((h, i) => (String(h || '').trim() || `변수${i + 1}`));
  const data = rows.slice(1);
  const n = data.length;
  const cols = header.map((h, j) => {
    const vals = data.map((r) => r[j]);
    const nonEmpty = vals.filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
    const nums = nonEmpty.map(toNum).filter((v) => v !== null);
    const numeric = nonEmpty.length > 0 && nums.length / nonEmpty.length >= 0.95;
    const uniq = new Set(nonEmpty.map((v) => String(v).trim()));
    const ints = nums.every((v) => Number.isInteger(v));
    const min = nums.length ? Math.min(...nums) : null, max = nums.length ? Math.max(...nums) : null;
    const likert = numeric && ints && min !== null && min >= 0 && max <= 11 && max - min <= 10 && uniq.size <= 11 && uniq.size >= 2;
    const piiHead = PII_HEAD.test(h);
    const sample = nonEmpty.slice(0, 30).map((v) => String(v).trim());
    const piiVal = sample.some((v) => PHONE.test(v) || EMAIL.test(v));
    let type = numeric ? (likert ? '리커트 척도' : uniq.size <= 6 && ints ? '범주(숫자 코드)' : '연속형') : uniq.size <= Math.max(10, n * 0.2) ? '범주(문자)' : '문자';
    return { name: h, missing: n - nonEmpty.length, missingRate: (n - nonEmpty.length) / n, numeric, likert, type, unique: uniq.size, min, max, pii: piiHead || piiVal, stats: numeric ? describe(nums) : null };
  });
  // 문항 묶음 추정
  const groups = {};
  cols.forEach((c, j) => {
    if (!c.likert) return;
    const k = groupKey(c.name);
    if (!k) return;
    (groups[k] = groups[k] || []).push(j);
  });
  const scales = Object.entries(groups).filter(([, idx]) => idx.length >= 3).map(([k, idx]) => {
    const matrix = data.map((r) => idx.map((j) => toNum(r[j])));
    const a = cronbachAlpha(matrix);
    return { name: k, items: idx.length, alpha: a ? a.alpha : null, n: a ? a.n : 0, columns: idx.map((j) => cols[j].name) };
  });
  const likertCount = cols.filter((c) => c.likert).length;
  const missingCells = cols.reduce((a, c) => a + c.missing, 0);
  return {
    ok: true, n, vars: cols.length, columns: cols, scales, likertCount,
    missingRate: missingCells / (n * cols.length || 1),
    pii: cols.filter((c) => c.pii).map((c) => c.name),
    demographics: cols.filter((c) => /(성별|나이|연령|학년|학력|직위|직급|경력|근무|소득|결혼|종교|지역|부서|gender|age|sex)/i.test(c.name)).map((c) => c.name),
  };
}

export async function diagnoseFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    return { ...diagnoseRows(parseCSV(text)), source: ext };
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sh = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: '' });
    return { ...diagnoseRows(rows), source: ext, sheet: wb.SheetNames[0], sheets: wb.SheetNames.length };
  }
  if (ext === 'sav') return { ok: false, source: 'sav', message: 'SPSS 파일은 분석가가 직접 열어 확인합니다. 변수 설명이 있다면 함께 올려 주세요.' };
  return { ok: false, message: '자동 진단은 Excel·CSV 파일에서만 가능합니다.' };
}
