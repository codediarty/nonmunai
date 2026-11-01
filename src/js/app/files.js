// 업로드 전 파일 임시 보관(IndexedDB)과 검사
const DB = 'nonmunai';
const STORE = 'files';

function open() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no-idb')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const mem = new Map();
async function tx(mode, fn) {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const s = t.objectStore(STORE);
      const r = fn(s);
      t.oncomplete = () => resolve(r && r.result !== undefined ? r.result : undefined);
      t.onerror = () => reject(t.error);
    });
  } catch {
    return null;
  }
}
export async function putBlob(id, blob) { mem.set(id, blob); await tx('readwrite', (s) => s.put(blob, id)); }
export async function getBlob(id) {
  if (mem.has(id)) return mem.get(id);
  const db = await open().catch(() => null);
  if (!db) return null;
  return new Promise((resolve) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => resolve(null);
  });
}
export async function delBlob(id) { mem.delete(id); await tx('readwrite', (s) => s.delete(id)); }

export const RULES = {
  common: ['docx', 'doc', 'hwp', 'hwpx', 'pdf', 'txt', 'rtf', 'pptx', 'ppt', 'xlsx', 'xls', 'csv', 'png', 'jpg', 'jpeg', 'zip'],
  data: ['xlsx', 'xls', 'csv', 'sav', 'txt', 'zip', 'sps', 'spv'],
  prevResult: ['docx', 'doc', 'hwp', 'hwpx', 'pdf', 'txt', 'xlsx', 'xls', 'csv', 'spv', 'sav', 'sps', 'png', 'jpg', 'jpeg', 'zip'],
};
export const MAX_FILES = 40;

export function extOf(name) { return (String(name).split('.').pop() || '').toLowerCase(); }

export function checkFile(file, slot, maxMB = 20) {
  const ext = extOf(file.name);
  const allowed = RULES[slot] || RULES.common;
  if (!allowed.includes(ext)) return `허용되지 않는 형식입니다(.${ext}). ${allowed.map((x) => '.' + x).join(', ')} 파일을 올려 주세요.`;
  if (file.size > maxMB * 1024 * 1024) return `${maxMB}MB를 넘는 파일입니다. 압축하거나 나누어 올리시고, 어렵다면 아래 대용량 링크 칸을 이용해 주세요.`;
  if (file.size === 0) return '빈 파일입니다.';
  return null;
}

export function fmtSize(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function base64ToBlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

export function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
