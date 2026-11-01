// 원고 파일 사전 분석: 글자 수·예상 쪽수·장 구성·참고문헌 (브라우저 안에서만 계산)
const CHARS_PER_PAGE = 1600;

function analyzeText(paragraphs) {
  const text = paragraphs.join('\n');
  const chars = text.replace(/\s/g, '').length;
  const withSpaces = text.replace(/\n/g, ' ').length;
  const headings = paragraphs.filter((p) => /^(제\s*\d+\s*장|[IVX]+\.|[Ⅰ-Ⅹ]\.|\d+\.\s|chapter\s*\d)/i.test(p.trim()) && p.length < 60);
  const chapters = paragraphs.filter((p) => /^(제\s*\d+\s*장|[Ⅰ-Ⅹ]\.|[IVX]+\.\s)/.test(p.trim()) && p.length < 50).map((p) => p.trim());
  const refIdx = paragraphs.findIndex((p) => /^(참\s*고\s*문\s*헌|references|bibliography)\s*$/i.test(p.trim()));
  let refs = 0;
  if (refIdx >= 0) refs = paragraphs.slice(refIdx + 1).filter((p) => /\(\d{4}[a-z]?\)|\d{4}\)\.|\b(19|20)\d{2}\b/.test(p) && p.length > 20).length;
  const apaCites = (text.match(/\([^()]{2,60},\s*(19|20)\d{2}[a-z]?\)/g) || []).length;
  const numCites = (text.match(/\[\d{1,3}(?:[,-]\s?\d{1,3})*\]/g) || []).length;
  return {
    chars, withSpaces, pages: Math.max(1, Math.round(withSpaces / CHARS_PER_PAGE)), paragraphs: paragraphs.length,
    headings: headings.length, chapters: chapters.slice(0, 12), references: refs,
    citeStyle: apaCites > numCites * 2 ? 'APA(저자, 연도)' : numCites > apaCites ? '번호식 [1]' : apaCites ? '혼합' : '확인 어려움',
  };
}

function xmlParas(xml, paraTag, textTag) {
  const out = [];
  const paraRe = new RegExp(`<${paraTag}[\\s>][\\s\\S]*?<\\/${paraTag}>`, 'g');
  const textRe = new RegExp(`<${textTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${textTag}>`, 'g');
  for (const p of xml.match(paraRe) || []) {
    let t = '', m;
    while ((m = textRe.exec(p))) t += m[1];
    t = t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
    if (t) out.push(t);
  }
  return out;
}

export async function analyzeDocument(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  try {
    if (ext === 'docx' || ext === 'hwpx') {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      let paras = [];
      if (ext === 'docx') {
        const xml = await zip.file('word/document.xml').async('string');
        paras = xmlParas(xml, 'w:p', 'w:t');
      } else {
        const names = Object.keys(zip.files).filter((n) => /^Contents\/section\d+\.xml$/i.test(n)).sort();
        for (const n of names) paras = paras.concat(xmlParas(await zip.file(n).async('string'), 'hp:p', 'hp:t'));
      }
      if (!paras.length) return { ok: false, message: '본문 텍스트를 찾지 못했습니다.' };
      return { ok: true, kind: ext, ...analyzeText(paras) };
    }
    if (ext === 'pdf') {
      const buf = new Uint8Array(await file.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 65536) s += String.fromCharCode.apply(null, buf.subarray(i, i + 65536));
      const m = s.match(/\/Type\s*\/Page(?!s)/g);
      const pages = m ? m.length : 0;
      return pages ? { ok: true, kind: 'pdf', pages, estimatedOnly: true } : { ok: false, message: 'PDF 쪽수를 읽지 못했습니다.' };
    }
    if (ext === 'txt') {
      const t = await file.text();
      return { ok: true, kind: 'txt', ...analyzeText(t.split(/\n+/).map((x) => x.trim()).filter(Boolean)) };
    }
  } catch (e) {
    return { ok: false, message: '파일을 분석하지 못했습니다. 파일은 그대로 제출됩니다.' };
  }
  return { ok: false, message: '한글(hwp) 파일은 분석가가 직접 열어 분량을 확인합니다.' };
}
