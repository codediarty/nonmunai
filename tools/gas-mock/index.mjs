// gas-mock: a Google Apps Script (V8 runtime) emulator for Node.js 22, built-ins only.
// Usage and the list of intentional simplifications: see README.md.
//
// * Scripts run in one node:vm context. Each load() runs its file at once and the realm's global
//   lexical scope is shared, so top-level const/let from one file are visible to files loaded
//   later, as in a GAS project (a duplicate top-level const is a SyntaxError in both).
// * Services live in the host realm. Arrays/objects they hand to scripts are created in the
//   sandbox realm and their errors use the sandbox Error, so `instanceof Array/Error` work.
// * Every service object is a Proxy: a GAS method that is not emulated throws
//   "Not implemented in gas-mock: Service.method" when called.
// * Time comes from a fake clock. While script code runs, process.env.TZ is the script time
//   zone, so local-time Date methods (getHours(), new Date(y, m, d)) behave as in the project.

import vm from 'node:vm';
import crypto from 'node:crypto';
import util from 'node:util';

const DAY_MS = 86400000;
const MIME_FOLDER = 'application/vnd.google-apps.folder';
const MIME_SHEET = 'application/vnd.google-apps.spreadsheet';

// ---------------------------------------------------------------------------- small helpers

const isDate = (v) => Object.prototype.toString.call(v) === '[object Date]';
const timeOf = (d) => Date.prototype.getTime.call(d);
const pad = (v, n) => String(v).padStart(n, '0');
const enumOf = (names) => Object.freeze(Object.fromEntries(names.map((n) => [n, n])));
/** Drive-style id: a fixed prefix plus base64url characters (Drive files 33 chars, Sheets 44). */
const randomId = (len, prefix = '1') =>
  prefix + crypto.randomBytes(len).toString('base64url').slice(0, len - prefix.length);

function toMs(d) {
  const ms = isDate(d) ? timeOf(d) : typeof d === 'string' ? Date.parse(d) : Number(d);
  if (!Number.isFinite(ms)) throw new TypeError(`gas-mock: invalid date/time value: ${d}`);
  return ms;
}

// Property names that generic JS/Node code probes on objects; never reported as GAS methods.
const PROBES = new Set(['then', 'inspect', 'nodeType', 'asymmetricMatch', '$$typeof', 'prototype']);
const STRICT = new WeakSet(); // every object produced by strict(), so env.toHost() leaves it alone

/**
 * Wraps a service object so that a GAS method which is not emulated throws a clear error when
 * it is called. Like real GAS objects, wrapped objects stringify to their type name ("Sheet")
 * and serialize to {} with JSON.stringify.
 */
function strict(target, label, rt) {
  Object.defineProperty(target, util.inspect.custom, { value: () => `[${label}]`, configurable: true });
  const proxy = new Proxy(target, {
    get(t, key, receiver) {
      if (key === 'toString' && t.toString === Object.prototype.toString) return () => label;
      if (typeof key === 'symbol' || key in t || PROBES.has(key) || key.startsWith('_')) {
        return Reflect.get(t, key, receiver);
      }
      if (key === 'toJSON') return () => ({});
      return () => {
        throw rt.error(`Not implemented in gas-mock: ${label}.${key}`);
      };
    },
  });
  STRICT.add(proxy);
  return proxy;
}

// ---------------------------------------------------------------------------- bytes and charsets
// GAS byte arrays are Java byte[]: plain arrays of signed integers in -128..127.

const CHARSETS = {
  'UTF-8': 'utf8', UTF8: 'utf8', 'US-ASCII': 'ascii', ASCII: 'ascii',
  'ISO-8859-1': 'latin1', LATIN1: 'latin1', 'UTF-16LE': 'utf16le',
};

function nodeCharset(cs, rt) {
  if (cs == null) return 'utf8';
  const enc = CHARSETS[String(cs).toUpperCase()];
  if (!enc) throw rt.error(`Not implemented in gas-mock: charset ${cs}`);
  return enc;
}

function encodeString(str, cs, rt) {
  const enc = nodeCharset(cs, rt);
  // Java's US-ASCII encoder replaces every unmappable code point with '?'.
  if (enc === 'ascii') return Buffer.from(String(str).replace(/[^\x00-\x7f]/gu, '?'), 'latin1');
  return Buffer.from(String(str), enc);
}

function decodeBytes(buf, cs, rt) {
  const enc = nodeCharset(cs, rt);
  if (enc === 'ascii') return buf.toString('latin1').replace(/[\x80-\xff]/g, '�');
  return buf.toString(enc);
}

/** Returns the Blob behind a Blob or BlobSource (File, HTTPResponse, outputs), else null. */
function blobOf(x) {
  if (x instanceof GasBlob) return x;
  if (x && typeof x === 'object' && typeof x.getBlob === 'function') return x.getBlob();
  return null;
}

/** Anything byte-like (string, signed or unsigned array, typed array, Blob) -> Buffer copy. */
function toBuffer(data, cs, rt) {
  if (data == null) return Buffer.alloc(0);
  if (typeof data === 'string') return encodeString(data, cs, rt);
  if (ArrayBuffer.isView(data)) return Buffer.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  if (Array.isArray(data)) return Buffer.from(data.map((b) => Number(b) & 0xff));
  const blob = blobOf(data);
  if (blob) return Buffer.from(blob._bytes);
  throw rt.error(`Invalid argument: expected a string, byte array or Blob, got ${typeof data}`);
}

/** Buffer -> GAS signed byte array, created in the sandbox realm. */
const signed = (rt, buf) => rt.realm.arr(Array.from(buf, (b) => (b > 127 ? b - 256 : b)));

// ---------------------------------------------------------------------------- Blob

class GasBlob {
  constructor(rt, bytes, contentType = null, name = null) {
    Object.assign(this, { _rt: rt, _bytes: bytes, _type: contentType, _name: name });
    return strict(this, 'Blob', rt);
  }
  getBytes() { return signed(this._rt, this._bytes); }
  setBytes(data) { this._bytes = toBuffer(data, null, this._rt); return this; }
  getDataAsString(charset) { return decodeBytes(this._bytes, charset, this._rt); }
  setDataFromString(str, charset) { this._bytes = encodeString(str, charset, this._rt); return this; }
  getContentType() { return this._type; }
  setContentType(type) { this._type = type == null ? null : String(type); return this; }
  getName() { return this._name; }
  setName(name) { this._name = name == null ? null : String(name); return this; }
  copyBlob() { return new GasBlob(this._rt, Buffer.from(this._bytes), this._type, this._name); }
  getAs(contentType) { return this.copyBlob().setContentType(contentType); }
  getBlob() { return this; }
}

// ---------------------------------------------------------------------------- fake clock and Date

function makeClock(start) {
  const clock = {
    ms: toMs(start),
    now: () => new Date(clock.ms),
    set: (d) => { clock.ms = toMs(d); return clock.now(); },
    advance: (ms) => { clock.ms += Number(ms); return clock.now(); },
  };
  return clock;
}

/**
 * Date replacement for the sandbox: `new Date()`, `Date()` and `Date.now()` read the fake clock,
 * every other form behaves normally. Instances are real host Date objects (so `instanceof Date`
 * holds in host code) and Symbol.hasInstance lets any Date pass `instanceof Date` in scripts.
 */
function makeFakeDate(clock) {
  const RealDate = Date;
  function FakeDate(...args) {
    if (!new.target) return new RealDate(clock.ms).toString();
    const d = args.length ? new RealDate(...args) : new RealDate(clock.ms);
    Object.setPrototypeOf(d, new.target.prototype);
    return d;
  }
  Object.setPrototypeOf(FakeDate, RealDate); // inherits Date.parse and Date.UTC
  FakeDate.prototype = Object.create(RealDate.prototype, {
    constructor: { value: FakeDate, writable: true, configurable: true },
  });
  FakeDate.now = () => clock.ms;
  Object.defineProperty(FakeDate, Symbol.hasInstance, { value: (v) => isDate(v) });
  return FakeDate;
}

// ---------------------------------------------------------------------------- time zones

const FIXED_TZ = /^(?:GMT|UTC)?\s*([+-])(\d{1,2})(?::?(\d{2}))?$/i;
const dtfCache = new Map();

/** Wall-clock fields of instant `ms` in `tz` (IANA name, 'UTC', or Java-style 'GMT+9'). */
function zoneParts(ms, tz) {
  let off = 0;
  const fixed = FIXED_TZ.exec(tz);
  if (fixed) {
    off = (fixed[1] === '-' ? -1 : 1) * (Number(fixed[2]) * 60 + Number(fixed[3] || 0));
  } else if (!/^(GMT|UTC|Z)$/i.test(tz)) {
    let f = dtfCache.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
      });
      dtfCache.set(tz, f);
    }
    const p = {};
    for (const { type, value } of f.formatToParts(new Date(ms))) p[type] = Number(value);
    const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    off = Math.round((wall - (ms - (((ms % 1000) + 1000) % 1000))) / 60000);
  }
  const d = new Date(ms + off * 60000);
  return {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(),
    minute: d.getUTCMinutes(), second: d.getUTCSeconds(), ms: d.getUTCMilliseconds(),
    weekday: d.getUTCDay(), offsetMin: off,
  };
}

/** Instant of wall-clock time `f` ({year, month(1-12), day, hour, minute, second, ms}) in `tz`. */
function wallToMs(f, tz) {
  const wall = Date.UTC(f.year, f.month - 1, f.day, f.hour || 0, f.minute || 0, f.second || 0, f.ms || 0);
  const guess = wall - zoneParts(wall, tz).offsetMin * 60000;
  return wall - zoneParts(guess, tz).offsetMin * 60000;
}

const offsetStr = (min, sep = '') =>
  (min < 0 ? '-' : '+') + pad(Math.floor(Math.abs(min) / 60), 2) + sep + pad(Math.abs(min) % 60, 2);

// ---------------------------------------------------------------------------- date patterns
// Java SimpleDateFormat subset used by Utilities.formatDate.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Splits a pattern into letter runs ({ch, n}) and literals ({lit}); 'quoted' text and '' work. */
function tokenize(pattern) {
  const out = [];
  for (let i = 0; i < pattern.length;) {
    const ch = pattern[i];
    if (ch === "'") {
      if (pattern[i + 1] === "'") { out.push({ lit: "'" }); i += 2; continue; }
      let j = i + 1, lit = '';
      for (; j < pattern.length; j++) {
        if (pattern[j] === "'") {
          if (pattern[j + 1] === "'") { lit += "'"; j++; continue; }
          break;
        }
        lit += pattern[j];
      }
      out.push({ lit });
      i = j + 1;
    } else if (/[A-Za-z]/.test(ch)) {
      let n = 1;
      while (pattern[i + n] === ch) n++;
      out.push({ ch, n });
      i += n;
    } else {
      out.push({ lit: ch });
      i++;
    }
  }
  return out;
}

function formatDate(ms, tz, pattern, rt) {
  const p = zoneParts(ms, tz);
  return tokenize(String(pattern)).map((t) => {
    if ('lit' in t) return t.lit;
    const { ch, n } = t;
    switch (ch) {
      case 'y': case 'Y': return n === 2 ? pad(p.year % 100, 2) : pad(p.year, n);
      case 'M': case 'L': return n >= 4 ? MONTHS[p.month - 1] : n === 3 ? MONTHS[p.month - 1].slice(0, 3) : pad(p.month, n);
      case 'd': return pad(p.day, n);
      case 'D': return pad((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(p.year, 0, 1)) / DAY_MS + 1, n);
      case 'E': return n >= 4 ? DAYS[p.weekday] : DAYS[p.weekday].slice(0, 3);
      case 'u': return pad(p.weekday || 7, n);
      case 'a': return p.hour < 12 ? 'AM' : 'PM';
      case 'H': return pad(p.hour, n);
      case 'k': return pad(p.hour || 24, n);
      case 'K': return pad(p.hour % 12, n);
      case 'h': return pad(p.hour % 12 || 12, n);
      case 'm': return pad(p.minute, n);
      case 's': return pad(p.second, n);
      case 'S': return pad(p.ms, n);
      case 'Z': return offsetStr(p.offsetMin);
      case 'X':
        if (p.offsetMin === 0) return 'Z';
        return n === 1 ? offsetStr(p.offsetMin).slice(0, 3) : offsetStr(p.offsetMin, n >= 3 ? ':' : '');
      default: throw rt.error(`Not implemented in gas-mock: date pattern letter '${ch}'`);
    }
  }).join('');
}

/** Utilities.parseCsv: RFC 4180 quoting, CRLF or LF rows, no trailing empty row. */
function parseCsv(text, delim) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** ISO-8601 week number of a Date (UTC), as in the GAS time-driven event object. */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY_MS + 1) / 7);
}

// ---------------------------------------------------------------------------- SpreadsheetApp

const colToA1 = (n) => {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const a1ToCol = (s) => [...s.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

/**
 * Parses A1 notation: 'B2', 'A1:C3', 'A:C' (whole columns), '2:5' (whole rows), 'A2:C' (open
 * ended), with an optional "Sheet name!" prefix and $ anchors. Returns null when invalid.
 */
function parseA1(text, maxRows, maxCols) {
  let ref = String(text).trim(), sheetName = null;
  const bang = ref.lastIndexOf('!');
  if (bang >= 0) {
    sheetName = ref.slice(0, bang).replace(/^'(.*)'$/, '$1').replace(/''/g, "'");
    ref = ref.slice(bang + 1);
  }
  const m = /^([A-Z]*)(\d*)(?::([A-Z]*)(\d*))?$/i.exec(ref.replace(/\$/g, ''));
  if (!m) return null;
  const [, c1, r1, c2, r2] = m;
  if (c2 === undefined) {
    if (!c1 || !r1 || Number(r1) < 1) return null;
    return { sheetName, row: Number(r1), col: a1ToCol(c1), numRows: 1, numCols: 1 };
  }
  if (!!c1 !== !!c2 || (!c1 && (!r1 || !r2))) return null;
  const rowA = r1 ? Number(r1) : 1, rowB = r2 ? Number(r2) : maxRows;
  const colA = c1 ? a1ToCol(c1) : 1, colB = c2 ? a1ToCol(c2) : maxCols;
  if (rowA < 1 || rowB < 1) return null;
  return {
    sheetName, row: Math.min(rowA, rowB), col: Math.min(colA, colB),
    numRows: Math.abs(rowB - rowA) + 1, numCols: Math.abs(colB - colA) + 1,
  };
}

// Cell storage: rec.rows is a ragged array of arrays; a missing cell reads as ''.
const EMPTY = '';
const cellGet = (rec, r, c) => rec.rows[r - 1]?.[c - 1] ?? EMPTY;
function cellSet(rec, r, c, v) {
  if (v === EMPTY && (r > rec.rows.length || c > rec.rows[r - 1].length)) return; // nothing to clear
  while (rec.rows.length < r) rec.rows.push([]);
  const row = rec.rows[r - 1];
  while (row.length < c - 1) row.push(EMPTY);
  row[c - 1] = v;
  rec.maxRows = Math.max(rec.maxRows, r); // sheets grow when written past their size
  rec.maxCols = Math.max(rec.maxCols, c);
}
function lastRowOf(rec) {
  for (let r = rec.rows.length; r > 0; r--) if (rec.rows[r - 1].some((v) => v !== EMPTY)) return r;
  return 0;
}
function lastColOf(rec) {
  let max = 0;
  for (const row of rec.rows) for (let c = row.length; c > max; c--) if (row[c - 1] !== EMPTY) { max = c; break; }
  return max;
}

/** Normalizes a written value: Dates are copied, primitives kept, null/undefined become ''. */
function storeValue(v) {
  if (v === null || v === undefined) return EMPTY;
  if (isDate(v)) return new Date(timeOf(v));
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
  return String(v);
}
const readValue = (rt, v) => (isDate(v) ? new rt.realm.Date(timeOf(v)) : v);
function displayValue(v, tz) {
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (!isDate(v)) return String(v);
  const p = zoneParts(timeOf(v), tz);
  return formatDate(timeOf(v), tz, p.hour || p.minute || p.second ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
}

const newSheetRec = (name, id, maxRows = 1000, maxCols = 26) => ({
  id, name, rows: [], maxRows, maxCols, frozenRows: 0, frozenCols: 0, hidden: false, tabColor: null,
});
const duplicateSheet = (name) => `A sheet with the name "${name}" already exists. Please enter another name.`;

class Spreadsheet {
  constructor(rt, rec) { Object.assign(this, { _rt: rt, _rec: rec }); return strict(this, 'Spreadsheet', rt); }
  _wrap(s) { return new Sheet(this._rt, this._rec, s); }
  getId() { return this._rec.id; }
  getName() { return this._rec.file.name; }
  rename(name) { this._rec.file.name = String(name); this._rec.file.updated = new Date(this._rt.clock.ms); }
  getUrl() { return `https://docs.google.com/spreadsheets/d/${this._rec.id}/edit`; }
  getSpreadsheetTimeZone() { return this._rec.timeZone; }
  setSpreadsheetTimeZone(tz) { this._rec.timeZone = String(tz); }
  getOwner() { return makeUser(this._rt, this._rt.options.ownerEmail); }
  getSheets() { return this._rt.realm.arr(this._rec.sheets.map((s) => this._wrap(s))); }
  getNumSheets() { return this._rec.sheets.length; }
  getActiveSheet() { return this._wrap(this._rec.sheets[0]); }
  getSheetByName(name) {
    const s = this._rec.sheets.find((x) => x.name === String(name));
    return s ? this._wrap(s) : null;
  }
  getSheetById(id) {
    const s = this._rec.sheets.find((x) => x.id === Number(id));
    return s ? this._wrap(s) : null;
  }
  /** insertSheet(), insertSheet(name), insertSheet(index), insertSheet(name, index). */
  insertSheet(a, b) {
    const sheets = this._rec.sheets;
    let name = typeof a === 'string' ? a : null;
    const index = typeof a === 'number' ? a : typeof b === 'number' ? b : sheets.length;
    if (name === null) {
      let i = sheets.length + 1;
      while (sheets.some((s) => s.name === `Sheet${i}`)) i++;
      name = `Sheet${i}`;
    }
    if (sheets.some((s) => s.name === name)) throw this._rt.error(duplicateSheet(name));
    const rec = newSheetRec(name, crypto.randomInt(1, 2 ** 31 - 1));
    sheets.splice(Math.max(0, Math.min(index, sheets.length)), 0, rec);
    return this._wrap(rec);
  }
  deleteSheet(sheet) {
    const sheets = this._rec.sheets, i = sheets.indexOf(sheet?._rec);
    if (i < 0) throw this._rt.error('Invalid argument: sheet');
    if (sheets.length === 1) throw this._rt.error("You can't remove all the sheets in a document.");
    sheets.splice(i, 1);
  }
  /** getRange('Sheet1!A1:B2'); without a sheet prefix the first sheet is used. */
  getRange(a1) {
    const ref = parseA1(a1, 1, 1);
    const sheet = ref?.sheetName ? this.getSheetByName(ref.sheetName) : this.getActiveSheet();
    if (!ref || !sheet) throw this._rt.error(`Range not found: ${a1}`);
    return sheet.getRange(String(a1).slice(String(a1).lastIndexOf('!') + 1));
  }
}

class Sheet {
  constructor(rt, ss, rec) { Object.assign(this, { _rt: rt, _ss: ss, _rec: rec }); return strict(this, 'Sheet', rt); }
  getName() { return this._rec.name; }
  setName(name) {
    name = String(name);
    if (this._ss.sheets.some((s) => s !== this._rec && s.name === name)) throw this._rt.error(duplicateSheet(name));
    this._rec.name = name;
    return this;
  }
  getSheetId() { return this._rec.id; }
  getIndex() { return this._ss.sheets.indexOf(this._rec) + 1; }
  getParent() { return new Spreadsheet(this._rt, this._ss); }
  activate() { return this; }
  getLastRow() { return lastRowOf(this._rec); }
  getLastColumn() { return lastColOf(this._rec); }
  getMaxRows() { return this._rec.maxRows; }
  getMaxColumns() { return this._rec.maxCols; }

  /** getRange(row, col, numRows = 1, numCols = 1) or getRange('A1:C3'). */
  getRange(a, col, numRows = 1, numCols = 1) {
    const rt = this._rt;
    if (typeof a === 'string' && col === undefined) {
      const ref = parseA1(a.slice(a.lastIndexOf('!') + 1), this._rec.maxRows, this._rec.maxCols);
      if (!ref) throw rt.error(`Range not found: ${a}`);
      return new Range(rt, this._ss, this._rec, ref.row, ref.col, ref.numRows, ref.numCols);
    }
    const args = [a, col, numRows, numCols];
    if (!args.every(Number.isInteger)) {
      throw rt.error(`The parameters (${args.map((x) => typeof x).join(',')}) don't match the method signature for SpreadsheetApp.Sheet.getRange.`);
    }
    if (a < 1) throw rt.error('The starting row of the range is too small.');
    if (col < 1) throw rt.error('The starting column of the range is too small.');
    if (numRows < 1) throw rt.error('The number of rows in the range must be at least 1.');
    if (numCols < 1) throw rt.error('The number of columns in the range must be at least 1.');
    return new Range(rt, this._ss, this._rec, a, col, numRows, numCols);
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(1, lastRowOf(this._rec)), Math.max(1, lastColOf(this._rec)));
  }
  appendRow(values) {
    if (!Array.isArray(values)) {
      throw this._rt.error(`The parameters (${typeof values}) don't match the method signature for SpreadsheetApp.Sheet.appendRow.`);
    }
    const r = lastRowOf(this._rec) + 1;
    values.forEach((v, i) => cellSet(this._rec, r, i + 1, storeValue(v)));
    return this;
  }

  deleteRow(row) { return this.deleteRows(row, 1); }
  deleteRows(start, count) {
    const rec = this._rec;
    if (!Number.isInteger(start) || !Number.isInteger(count) || start < 1 || count < 1 || start + count - 1 > rec.maxRows) {
      throw this._rt.error('Those rows are out of bounds.');
    }
    if (rec.maxRows - count <= rec.frozenRows) throw this._rt.error('Sorry, it is not possible to delete all non-frozen rows.');
    rec.rows.splice(start - 1, count);
    rec.maxRows -= count;
    return this;
  }
  insertRowAfter(row) { return this.insertRowsAfter(row, 1); }
  insertRowBefore(row) { return this.insertRowsBefore(row, 1); }
  insertRowsAfter(row, count) { return this._insertRows(row, row, count); }
  insertRowsBefore(row, count) { return this._insertRows(row, row - 1, count); }
  _insertRows(pos, after, count) {
    const rec = this._rec;
    if (!Number.isInteger(pos) || pos < 1 || pos > rec.maxRows || !(count >= 1)) throw this._rt.error('Those rows are out of bounds.');
    if (after < rec.rows.length) rec.rows.splice(after, 0, ...Array.from({ length: count }, () => []));
    rec.maxRows += count;
    return this;
  }

  clear() { this._rec.rows = []; return this; }
  clearContents() { this._rec.rows = []; return this; }
  clearFormats() { return this; }
  setFrozenRows(n) { this._rec.frozenRows = Number(n); }
  getFrozenRows() { return this._rec.frozenRows; }
  setFrozenColumns(n) { this._rec.frozenCols = Number(n); }
  getFrozenColumns() { return this._rec.frozenCols; }
  hideSheet() {
    if (!this._ss.sheets.some((s) => s !== this._rec && !s.hidden)) throw this._rt.error("You can't hide all the sheets in a document.");
    this._rec.hidden = true;
    return this;
  }
  showSheet() { this._rec.hidden = false; return this; }
  isSheetHidden() { return this._rec.hidden; }
  setTabColor(color) { this._rec.tabColor = color; return this; }
}
for (const m of ['setColumnWidth', 'setColumnWidths', 'autoResizeColumn', 'autoResizeColumns', 'autoResizeRows',
  'setRowHeight', 'setRowHeights', 'hideColumns', 'showColumns', 'hideRows', 'showRows']) {
  Sheet.prototype[m] = function noop() { return this; };
}

class Range {
  constructor(rt, ss, rec, row, col, numRows, numCols) {
    Object.assign(this, { _rt: rt, _ss: ss, _rec: rec, _r: row, _c: col, _nr: numRows, _nc: numCols });
    return strict(this, 'Range', rt);
  }
  _grid(fn) {
    return Array.from({ length: this._nr }, (_, i) => Array.from({ length: this._nc }, (_, j) => fn(this._r + i, this._c + j)));
  }
  getValues() { return this._rt.realm.arr(this._grid((r, c) => readValue(this._rt, cellGet(this._rec, r, c)))); }
  getValue() { return readValue(this._rt, cellGet(this._rec, this._r, this._c)); }
  getDisplayValues() { return this._rt.realm.arr(this._grid((r, c) => displayValue(cellGet(this._rec, r, c), this._ss.timeZone))); }
  getDisplayValue() { return displayValue(cellGet(this._rec, this._r, this._c), this._ss.timeZone); }
  setValues(values) {
    const rt = this._rt;
    if (!Array.isArray(values) || !values.every((row) => Array.isArray(row))) {
      throw rt.error("The parameters (number[]) don't match the method signature for SpreadsheetApp.Range.setValues.");
    }
    if (values.length !== this._nr) {
      throw rt.error(`The number of rows in the data does not match the number of rows in the range. The data has ${values.length} but the range has ${this._nr}.`);
    }
    const bad = values.find((row) => row.length !== this._nc);
    if (bad) {
      throw rt.error(`The number of columns in the data does not match the number of columns in the range. The data has ${bad.length} but the range has ${this._nc}.`);
    }
    values.forEach((row, i) => row.forEach((v, j) => cellSet(this._rec, this._r + i, this._c + j, storeValue(v))));
    return this;
  }
  /** Like GAS, setValue() writes the value into every cell of the range. */
  setValue(value) { this._grid((r, c) => cellSet(this._rec, r, c, storeValue(value))); return this; }
  clearContent() { this._grid((r, c) => cellSet(this._rec, r, c, EMPTY)); return this; }
  clear() { return this.clearContent(); }
  clearFormat() { return this; }
  getRow() { return this._r; }
  getColumn() { return this._c; }
  getNumRows() { return this._nr; }
  getNumColumns() { return this._nc; }
  getLastRow() { return this._r + this._nr - 1; }
  getLastColumn() { return this._c + this._nc - 1; }
  getSheet() { return new Sheet(this._rt, this._ss, this._rec); }
  getA1Notation() {
    const start = colToA1(this._c) + this._r;
    return this._nr === 1 && this._nc === 1 ? start : `${start}:${colToA1(this.getLastColumn())}${this.getLastRow()}`;
  }
  offset(rowOffset, colOffset, numRows = this._nr, numCols = this._nc) {
    return this.getSheet().getRange(this._r + rowOffset, this._c + colOffset, numRows, numCols);
  }
  getCell(row, col) {
    if (row < 1 || col < 1 || row > this._nr || col > this._nc) throw this._rt.error('Cell reference out of range');
    return this.getSheet().getRange(this._r + row - 1, this._c + col - 1);
  }
}
for (const m of ['setNumberFormat', 'setNumberFormats', 'setFontWeight', 'setFontWeights', 'setBackground',
  'setBackgrounds', 'setFontColor', 'setFontColors', 'setWrap', 'setWrapStrategy', 'setHorizontalAlignment',
  'setVerticalAlignment', 'setBorder', 'setFontSize', 'setFontFamily', 'setFontStyle', 'setNote', 'setNotes',
  'merge', 'breakApart', 'setDataValidation', 'activate']) {
  Range.prototype[m] = function noop() { return this; };
}

function makeSpreadsheetApp(rt) {
  const { state } = rt;
  function createRec(name, rows, cols, parentId) {
    const id = randomId(44);
    const file = rt.drive.addFile({ id, name: String(name), mimeType: MIME_SHEET }, parentId);
    const rec = {
      id, file, timeZone: rt.options.timeZone, sheets: [newSheetRec('Sheet1', 0, rows, cols)],
      get name() { return this.file.name; },
    };
    state.spreadsheets.set(id, rec);
    return rec;
  }
  const openById = (id) => {
    const rec = state.spreadsheets.get(String(id));
    if (!rec) throw rt.error('Unexpected error while getting the method or property openById on object SpreadsheetApp.');
    return new Spreadsheet(rt, rec);
  };
  return strict({
    create: (name, rows, cols) => new Spreadsheet(rt, createRec(name, rows, cols)),
    openById,
    openByUrl: (url) => {
      const m = /\/d\/([\w-]+)/.exec(String(url));
      if (!m) throw rt.error('Invalid argument: url');
      return openById(m[1]);
    },
    getActiveSpreadsheet: () => null, // standalone web-app scripts have no container spreadsheet
    getActive: () => null,
    flush: () => {},
  }, 'SpreadsheetApp', rt);
}

// ---------------------------------------------------------------------------- DriveApp

const ACCESS = ['ANYONE', 'ANYONE_WITH_LINK', 'DOMAIN', 'DOMAIN_WITH_LINK', 'PRIVATE'];
const PERMISSION = ['VIEW', 'EDIT', 'COMMENT', 'OWNER', 'ORGANIZER', 'FILE_ORGANIZER', 'NONE'];
const MIME_BY_EXT = {
  txt: 'text/plain', json: 'application/json', csv: 'text/csv', html: 'text/html', pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', zip: 'application/zip',
};
const guessMime = (name) => MIME_BY_EXT[/\.([^.]+)$/.exec(name || '')?.[1].toLowerCase()] || 'application/octet-stream';
const NOT_FOUND = 'No item with the given ID could be found. Possibly because you have not edited this item or you do not have permission to access it.';

const makeUser = (rt, email) => strict({
  getEmail: () => email,
  getName: () => String(email).split('@')[0],
  getDomain: () => String(email).split('@')[1] || '',
  getPhotoUrl: () => '',
}, 'User', rt);

/** Shared File/Folder behaviour over a plain record kept in env.state.drive. */
class DriveItem {
  constructor(rt, rec) {
    Object.assign(this, { _rt: rt, _rec: rec });
    return strict(this, new.target.name, rt);
  }
  _touch() { this._rec.updated = new Date(this._rt.clock.ms); return this; }
  getId() { return this._rec.id; }
  getName() { return this._rec.name; }
  setName(name) { this._rec.name = String(name); return this._touch(); }
  getDescription() { return this._rec.description; }
  setDescription(text) { this._rec.description = text == null ? null : String(text); return this._touch(); }
  getDateCreated() { return new this._rt.realm.Date(timeOf(this._rec.created)); }
  getLastUpdated() { return new this._rt.realm.Date(timeOf(this._rec.updated)); }
  /** True when the item or any ancestor folder is trashed (Drive trashes folder contents too). */
  isTrashed() { return this._rt.drive.isTrashed(this._rec); }
  setTrashed(trashed) { this._rec.trashed = !!trashed; return this._touch(); }
  getParents() {
    const folders = this._rt.state.drive.folders;
    return this._rt.drive.iter('Folder', this._rec.parents.map((id) => folders.get(id)).filter(Boolean));
  }
  moveTo(folder) {
    const dest = this._rt.state.drive.folders.get(folder?.getId?.());
    if (!dest) throw this._rt.error('Invalid argument: destination');
    this._rec.parents = [dest.id];
    return this._touch();
  }
  getOwner() { return makeUser(this._rt, this._rec.owner); }
  setSharing(access, permission) {
    if (!ACCESS.includes(String(access)) || !PERMISSION.includes(String(permission))) {
      throw this._rt.error(`Invalid argument: setSharing(${access}, ${permission})`);
    }
    this._rec.sharing = { access: String(access), permission: String(permission) };
    return this;
  }
  getSharingAccess() { return this._rec.sharing.access; }
  getSharingPermission() { return this._rec.sharing.permission; }
}

class Folder extends DriveItem {
  _children(kind, pred = () => true) {
    return this._rt.drive.list(kind, (r) => r.parents.includes(this._rec.id) && pred(r));
  }
  getUrl() { return `https://drive.google.com/drive/folders/${this._rec.id}`; }
  createFolder(name) { return this._rt.drive.createFolder(name, this._rec.id); }
  /** createFile(blob) or createFile(name, content, mimeType = 'text/plain'). */
  createFile(...args) { return this._rt.drive.createFile(this._rec.id, ...args); }
  getFiles() { return this._children('File'); }
  getFolders() { return this._children('Folder'); }
  getFilesByName(name) { return this._children('File', (r) => r.name === String(name)); }
  getFoldersByName(name) { return this._children('Folder', (r) => r.name === String(name)); }
  getFilesByType(mimeType) { return this._children('File', (r) => r.mimeType === String(mimeType)); }
}

class File extends DriveItem {
  _isSheet() { return this._rec.mimeType === MIME_SHEET; }
  getUrl() {
    return this._isSheet() ? `https://docs.google.com/spreadsheets/d/${this._rec.id}/edit?usp=drivesdk`
      : `https://drive.google.com/file/d/${this._rec.id}/view?usp=drivesdk`;
  }
  getDownloadUrl() { return `https://drive.google.com/uc?id=${this._rec.id}&export=download`; }
  getMimeType() { return this._rec.mimeType; }
  getSize() { return this._isSheet() ? 0 : this._rec.bytes.length; }
  getBlob() {
    if (this._isSheet()) throw this._rt.error('Not implemented in gas-mock: File.getBlob for Google Sheets files');
    return new GasBlob(this._rt, Buffer.from(this._rec.bytes), this._rec.mimeType, this._rec.name);
  }
  getAs(contentType) { return this.getBlob().setContentType(contentType); }
  setContent(content) { this._rec.bytes = encodeString(content, null, this._rt); return this._touch(); }
}

class DriveIterator {
  constructor(rt, kind, recs) {
    Object.assign(this, { _rt: rt, _kind: kind, _recs: recs, _i: 0 });
    return strict(this, `${kind}Iterator`, rt);
  }
  hasNext() { return this._i < this._recs.length; }
  next() {
    if (!this.hasNext()) throw this._rt.error('Cannot retrieve the next object: iterator has reached the end.');
    const rec = this._recs[this._i++];
    return this._kind === 'File' ? new File(this._rt, rec) : new Folder(this._rt, rec);
  }
}

function makeDrive(rt) {
  const { files, folders } = rt.state.drive;
  const base = (meta, parentId) => ({
    id: meta.id || randomId(33), name: String(meta.name), parents: parentId ? [parentId] : [],
    trashed: false, description: null, created: new Date(rt.clock.ms), updated: new Date(rt.clock.ms),
    owner: rt.options.ownerEmail, sharing: { access: 'PRIVATE', permission: 'NONE' },
  });
  const root = { ...base({ id: randomId(28, '0A'), name: 'My Drive' }, null), mimeType: MIME_FOLDER };
  folders.set(root.id, root);
  rt.state.drive.rootId = root.id;

  const d = (rt.drive = {
    isTrashed(rec, depth = 0) {
      if (rec.trashed) return true;
      return depth < 100 && rec.parents.some((p) => folders.has(p) && d.isTrashed(folders.get(p), depth + 1));
    },
    iter: (kind, recs) => new DriveIterator(rt, kind, recs),
    /** Search-style listing: like DriveApp searches, trashed items are excluded. */
    list(kind, pred) {
      const src = kind === 'File' ? files : folders;
      return d.iter(kind, [...src.values()].filter((r) => r !== root && !d.isTrashed(r) && pred(r)));
    },
    addFile(meta, parentId = root.id) {
      const rec = { ...base(meta, parentId), mimeType: meta.mimeType || 'application/octet-stream', bytes: meta.bytes || Buffer.alloc(0) };
      files.set(rec.id, rec);
      return rec;
    },
    createFolder(name, parentId) {
      const rec = { ...base({ name }, parentId), mimeType: MIME_FOLDER };
      folders.set(rec.id, rec);
      return new Folder(rt, rec);
    },
    createFile(parentId, a, content, mimeType) {
      if (typeof a === 'string') {
        const type = mimeType == null ? 'text/plain' : String(mimeType);
        if (type.startsWith('application/vnd.google-apps.')) throw rt.error('Invalid argument: file.contentType');
        return new File(rt, d.addFile({ name: a, mimeType: type, bytes: encodeString(content ?? '', null, rt) }, parentId));
      }
      const blob = blobOf(a);
      if (!blob) throw rt.error("The parameters don't match the method signature for DriveApp.Folder.createFile.");
      const name = blob.getName() || 'Untitled';
      const meta = { name, mimeType: blob.getContentType() || guessMime(name), bytes: Buffer.from(blob._bytes) };
      return new File(rt, d.addFile(meta, parentId));
    },
    get(kind, id) {
      const rec = (kind === 'File' ? files : folders).get(String(id));
      if (!rec) throw rt.error(NOT_FOUND);
      return kind === 'File' ? new File(rt, rec) : new Folder(rt, rec);
    },
  });

  return strict({
    Access: enumOf(ACCESS),
    Permission: enumOf(PERMISSION),
    getRootFolder: () => new Folder(rt, root),
    createFolder: (name) => d.createFolder(name, root.id),
    createFile: (...args) => d.createFile(root.id, ...args),
    getFileById: (id) => d.get('File', id), // trashed files are still returned, as in GAS
    getFolderById: (id) => (id === 'root' ? new Folder(rt, root) : d.get('Folder', id)),
    getFiles: () => d.list('File', () => true),
    getFolders: () => d.list('Folder', () => true),
    getFilesByName: (name) => d.list('File', (r) => r.name === String(name)),
    getFoldersByName: (name) => d.list('Folder', (r) => r.name === String(name)),
    getFilesByType: (mimeType) => d.list('File', (r) => r.mimeType === String(mimeType)),
  }, 'DriveApp', rt);
}

// ---------------------------------------------------------------------------- Utilities

const DIGEST = { MD5: 'md5', SHA_1: 'sha1', SHA_256: 'sha256', SHA_384: 'sha384', SHA_512: 'sha512' };
const MAC = { HMAC_MD5: 'md5', HMAC_SHA_1: 'sha1', HMAC_SHA_256: 'sha256', HMAC_SHA_384: 'sha384', HMAC_SHA_512: 'sha512' };

function makeUtilities(rt) {
  const bytes = (v, cs) => toBuffer(v, cs, rt);
  const algo = (table, name, what) => {
    if (!table[name]) throw rt.error(`Not implemented in gas-mock: ${what} ${name}`);
    return table[name];
  };
  const b64decode = (str, webSafe) => {
    const s = String(str).replace(/\s+/g, '');
    if (!(webSafe ? /^[A-Za-z0-9_-]*={0,2}$/ : /^[A-Za-z0-9+/]*={0,2}$/).test(s)) throw rt.error('Could not decode string.');
    return signed(rt, Buffer.from(s, webSafe ? 'base64url' : 'base64'));
  };
  const hmac = (alg, value, key, cs) => signed(rt, crypto.createHmac(alg, bytes(key, cs)).update(bytes(value, cs)).digest());
  return strict({
    Charset: Object.freeze({ US_ASCII: 'US-ASCII', UTF_8: 'UTF-8' }),
    DigestAlgorithm: enumOf(['MD2', ...Object.keys(DIGEST)]),
    MacAlgorithm: enumOf(Object.keys(MAC)),
    base64Encode: (data, cs) => bytes(data, cs).toString('base64'),
    base64EncodeWebSafe: (data, cs) => bytes(data, cs).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    base64Decode: (str) => b64decode(str, false),
    base64DecodeWebSafe: (str) => b64decode(str, true),
    computeDigest: (alg, value, cs) => signed(rt, crypto.createHash(algo(DIGEST, alg, 'digest')).update(bytes(value, cs)).digest()),
    computeHmacSignature: (alg, value, key, cs) => hmac(algo(MAC, alg, 'MAC'), value, key, cs),
    computeHmacSha256Signature: (value, key, cs) => hmac('sha256', value, key, cs),
    getUuid: () => crypto.randomUUID(),
    newBlob: (data, contentType, name) => new GasBlob(rt, bytes(data), contentType ?? null, name ?? null),
    formatDate: (date, tz, pattern) => {
      if (!isDate(date) || Number.isNaN(timeOf(date))) throw rt.error('Invalid argument: date');
      return formatDate(timeOf(date), String(tz), pattern, rt);
    },
    /** Does not block: advances the fake clock instead. */
    sleep: (ms) => {
      if (!(Number(ms) >= 0 && Number(ms) <= 300000)) throw rt.error('Invalid argument: milliseconds (0..300000)');
      rt.clock.ms += Number(ms);
    },
    parseCsv: (csv, delimiter = ',') => rt.realm.arr(parseCsv(String(csv), String(delimiter))),
    jsonStringify: (obj) => JSON.stringify(obj),
    jsonParse: (str) => rt.realm.parse(str),
  }, 'Utilities', rt);
}

// ---------------------------------------------------------------------------- MailApp

const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

function makeMail(rt) {
  const q = rt.state.mailQuota;
  // The quota window opens with the first send and resets 24h later (fake clock).
  const refresh = () => {
    if (q.windowStart !== null && rt.clock.ms >= q.windowStart + DAY_MS) Object.assign(q, { windowStart: null, used: 0 });
  };
  const split = (v) => (v == null ? [] : String(v).split(',').map((s) => s.trim()).filter(Boolean));
  const address = (a) => {
    const addr = /<([^>]*)>\s*$/.exec(a)?.[1].trim() ?? a;
    if (!EMAIL_RE.test(addr)) throw rt.error(`Invalid email: ${a}`);
    return addr;
  };
  const blobInfo = (x) => {
    const b = blobOf(x);
    if (!b) throw rt.error('Invalid argument: attachments');
    return { name: b.getName(), contentType: b.getContentType(), size: b._bytes.length, data: Buffer.from(b._bytes) };
  };
  const str = (v) => (v == null ? '' : String(v));

  function send(msg) {
    const recipients = [...split(msg.to), ...split(msg.cc), ...split(msg.bcc)].map(address);
    if (!recipients.length) throw rt.error('Failed to send email: no recipient');
    refresh();
    if (q.used + recipients.length > rt.options.mailQuota) throw rt.error('Service invoked too many times for one day: email.');
    if (q.windowStart === null) q.windowStart = rt.clock.ms;
    q.used += recipients.length;
    rt.state.mails.push({
      to: str(msg.to), cc: str(msg.cc), bcc: str(msg.bcc), subject: str(msg.subject), body: str(msg.body),
      htmlBody: msg.htmlBody == null ? null : String(msg.htmlBody), name: msg.name ?? null,
      replyTo: msg.replyTo ?? null, from: msg.from ?? null, noReply: !!msg.noReply,
      attachments: [...(msg.attachments || [])].map(blobInfo),
      inlineImages: Object.fromEntries(Object.entries(msg.inlineImages || {}).map(([k, v]) => [k, blobInfo(v)])),
      recipients, timestamp: new Date(rt.clock.ms),
    });
  }
  /** sendEmail(message) | (to, subject, body, options?) | (to, replyTo, subject, body). */
  function sendEmail(a, b, c, d) {
    if (a && typeof a === 'object') return send(a);
    if (typeof d === 'string') return send({ to: a, replyTo: b, subject: c, body: d });
    return send({ ...(d || {}), to: a, subject: b, body: c });
  }
  const getRemainingDailyQuota = () => { refresh(); return Math.max(0, rt.options.mailQuota - q.used); };
  return {
    MailApp: strict({ sendEmail, getRemainingDailyQuota }, 'MailApp', rt),
    GmailApp: strict({ sendEmail }, 'GmailApp', rt), // only sendEmail is emulated
  };
}

// ---------------------------------------------------------------------------- Cache, Lock, Properties

const scoped = (rt, stores, scope, Cls) => {
  if (!stores.has(scope)) stores.set(scope, new Map());
  return new Cls(rt, stores.get(scope));
};

class Cache {
  constructor(rt, map) { Object.assign(this, { _rt: rt, _map: map }); return strict(this, 'Cache', rt); }
  _key(key) {
    key = String(key);
    if (key.length > 250) throw this._rt.error('Argument too large: key');
    return key;
  }
  get(key) {
    key = this._key(key);
    const e = this._map.get(key);
    if (!e) return null;
    if (this._rt.clock.ms >= e.expiresAt) { this._map.delete(key); return null; }
    return e.value;
  }
  getAll(keys) {
    const out = {};
    for (const k of keys) { const v = this.get(k); if (v !== null) out[k] = v; }
    return this._rt.realm.obj(out);
  }
  /** ttl in seconds: default 600, capped at 21600 (6h); value at most 100KB. */
  put(key, value, ttl = 600) {
    key = this._key(key);
    if (value == null || typeof value === 'object' || typeof value === 'function') {
      throw this._rt.error("The parameters (String,Object) don't match the method signature for CacheService.Cache.put.");
    }
    value = String(value);
    if (Buffer.byteLength(value) > 100 * 1024) throw this._rt.error('Argument too large: value');
    const sec = Math.min(21600, Math.max(1, Number.isFinite(Number(ttl)) ? Number(ttl) : 600));
    this._map.set(key, { value, expiresAt: this._rt.clock.ms + sec * 1000 });
  }
  putAll(values, ttl) { for (const [k, v] of Object.entries(values)) this.put(k, v, ttl); }
  remove(key) { this._map.delete(this._key(key)); }
  removeAll(keys) { for (const k of keys) this.remove(k); }
}

/** Single-threaded lock. Set env.lockBusy = true to simulate another execution holding it. */
class Lock {
  constructor(rt) { Object.assign(this, { _rt: rt, _held: false }); return strict(this, 'Lock', rt); }
  tryLock() {
    if (this._rt.env.lockBusy) return false;
    this._held = true;
    return true;
  }
  waitLock() {
    if (this._rt.env.lockBusy) throw this._rt.error('Lock timeout: another process was holding the lock for too long.');
    this._held = true;
  }
  releaseLock() { this._held = false; }
  hasLock() { return this._held; }
}

class Properties {
  constructor(rt, map) { Object.assign(this, { _rt: rt, _map: map }); return strict(this, 'Properties', rt); }
  getProperty(key) { return this._map.get(String(key)) ?? null; }
  /** Values are stringified like GAS; limits: 9KB per value, 500KB per store. */
  setProperty(key, value) {
    key = String(key);
    value = String(value);
    if (Buffer.byteLength(value) > 9 * 1024) throw this._rt.error('Argument too large: value');
    let total = Buffer.byteLength(key) + Buffer.byteLength(value);
    for (const [k, v] of this._map) if (k !== key) total += Buffer.byteLength(k) + Buffer.byteLength(v);
    if (total > 500 * 1024) throw this._rt.error('You have exceeded the property storage quota. Please remove some properties and try again.');
    this._map.set(key, value);
    return this;
  }
  getProperties() { return this._rt.realm.obj(Object.fromEntries(this._map)); }
  setProperties(props, deleteAllOthers = false) {
    if (deleteAllOthers) this._map.clear();
    for (const [k, v] of Object.entries(props)) this.setProperty(k, v);
    return this;
  }
  deleteProperty(key) { this._map.delete(String(key)); return this; }
  deleteAllProperties() { this._map.clear(); return this; }
  getKeys() { return this._rt.realm.arr([...this._map.keys()]); }
}

// ---------------------------------------------------------------------------- ContentService, HtmlService

const TEXT_MIME = {
  ATOM: 'application/atom+xml', CSV: 'text/csv', ICAL: 'text/calendar', JAVASCRIPT: 'application/javascript',
  JSON: 'application/json', RSS: 'application/rss+xml', TEXT: 'text/plain', VCARD: 'text/vcard', XML: 'text/xml',
};
const asText = (v) => (v == null ? '' : String(v));

class TextOutput {
  constructor(rt, content) {
    Object.assign(this, { _rt: rt, _content: asText(content), _mime: 'TEXT', _file: null });
    return strict(this, 'TextOutput', rt);
  }
  getContent() { return this._content; }
  setContent(content) { this._content = asText(content); return this; }
  append(content) { this._content += asText(content); return this; }
  clear() { this._content = ''; return this; }
  setMimeType(mimeType) {
    if (!Object.hasOwn(TEXT_MIME, String(mimeType))) throw this._rt.error(`Invalid argument: mimeType (${mimeType})`);
    this._mime = String(mimeType);
    return this;
  }
  getMimeType() { return this._mime; }
  downloadAsFile(filename) { this._file = String(filename); return this; }
  getFileName() { return this._file; }
}

class HtmlOutput {
  constructor(rt, html) {
    Object.assign(this, { _rt: rt, _content: asText(html), _title: '', _xfo: 'DEFAULT', _meta: [] });
    return strict(this, 'HtmlOutput', rt);
  }
  getContent() { return this._content; }
  setContent(html) { this._content = asText(html); return this; }
  append(html) { this._content += asText(html); return this; }
  setTitle(title) { this._title = asText(title); return this; }
  getTitle() { return this._title; }
  setXFrameOptionsMode(mode) {
    if (!['ALLOWALL', 'DEFAULT'].includes(String(mode))) throw this._rt.error(`Invalid argument: mode (${mode})`);
    this._xfo = String(mode);
    return this;
  }
  addMetaTag(name, content) { this._meta.push({ name: String(name), content: String(content) }); return this; }
  setFaviconUrl() { return this; }
  setSandboxMode() { return this; }
}

function makeHtmlService(rt) {
  return strict({
    XFrameOptionsMode: enumOf(['ALLOWALL', 'DEFAULT']),
    SandboxMode: enumOf(['EMULATED', 'IFRAME', 'NATIVE']),
    createHtmlOutput: (html) => new HtmlOutput(rt, blobOf(html)?.getDataAsString() ?? html),
    /** Serves files registered with env.load(html, 'Name.html'). Templates are not emulated. */
    createHtmlOutputFromFile: (name) => {
      const html = rt.htmlFiles.get(String(name).replace(/\.html$/i, ''));
      if (html === undefined) throw rt.error(`No HTML file named ${name} was found.`);
      return new HtmlOutput(rt, html);
    },
  }, 'HtmlService', rt);
}

// ---------------------------------------------------------------------------- ScriptApp and triggers

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

class Trigger {
  constructor(rt, rec) { Object.assign(this, { _rt: rt, _rec: rec }); return strict(this, 'Trigger', rt); }
  getHandlerFunction() { return this._rec.handler; }
  getUniqueId() { return this._rec.id; }
  getEventType() { return 'CLOCK'; }
  getTriggerSource() { return 'CLOCK'; }
  getTriggerSourceId() { return null; }
}

class TriggerBuilder {
  constructor(rt, handler) { Object.assign(this, { _rt: rt, _handler: handler }); return strict(this, 'TriggerBuilder', rt); }
  timeBased() { return new ClockTriggerBuilder(this._rt, this._handler); }
}

class ClockTriggerBuilder {
  constructor(rt, handler) {
    const s = { kind: null, interval: 1, atHour: null, nearMinute: null, weekDay: null, monthDay: null, timeZone: null, at: null };
    Object.assign(this, { _rt: rt, _handler: handler, _s: s });
    return strict(this, 'ClockTriggerBuilder', rt);
  }
  _set(ok, what, patch) {
    if (!ok) throw this._rt.error(`Invalid argument: ${what}`);
    Object.assign(this._s, patch);
    return this;
  }
  everyMinutes(n) { return this._set([1, 5, 10, 15, 30].includes(n), `everyMinutes(${n}); valid values are 1, 5, 10, 15 or 30`, { kind: 'minutes', interval: n }); }
  everyHours(n) { return this._set([1, 2, 4, 6, 8, 12].includes(n), `everyHours(${n}); valid values are 1, 2, 4, 6, 8 or 12`, { kind: 'hours', interval: n }); }
  everyDays(n) { return this._set(Number.isInteger(n) && n >= 1, `everyDays(${n})`, { kind: 'days', interval: n }); }
  everyWeeks(n) { return this._set(Number.isInteger(n) && n >= 1, `everyWeeks(${n})`, { kind: 'weeks', interval: n }); }
  atHour(h) { return this._set(Number.isInteger(h) && h >= 0 && h <= 23, `atHour(${h})`, { atHour: h }); }
  nearMinute(m) { return this._set(Number.isInteger(m) && m >= 0 && m <= 59, `nearMinute(${m})`, { nearMinute: m }); }
  onWeekDay(day) { return this._set(WEEKDAYS.includes(String(day)), `onWeekDay(${day})`, { kind: 'weeks', weekDay: String(day) }); }
  onMonthDay(d) { return this._set(Number.isInteger(d) && d >= 1 && d <= 31, `onMonthDay(${d})`, { kind: 'months', monthDay: d }); }
  inTimezone(tz) { return this._set(true, '', { timeZone: String(tz) }); }
  after(ms) { return this._set(Number(ms) >= 0, `after(${ms})`, { kind: 'at', at: this._rt.clock.ms + Number(ms) }); }
  at(date) { return this._set(isDate(date), 'at(date)', { kind: 'at', at: isDate(date) ? timeOf(date) : null }); }
  create() {
    const rt = this._rt, s = { ...this._s };
    if (!s.kind) throw rt.error('Missing schedule: call everyMinutes/everyHours/everyDays/everyWeeks/onWeekDay/onMonthDay/at/after before create().');
    if (rt.state.triggers.length >= 20) {
      throw rt.error('This script has too many triggers. Triggers must be deleted from the script before more can be added.');
    }
    const rec = { id: String(crypto.randomInt(1e9, 9e9)), handler: this._handler, eventType: 'CLOCK', schedule: s,
      createdAt: rt.clock.ms, lastRun: null, runCount: 0 };
    rt.state.triggers.push(rec);
    return new Trigger(rt, rec);
  }
}

/** Most recent wall-clock slot <= now of a daily/weekly/monthly schedule (null if none in 62 days). */
function lastSlot(s, now, tz, createdAt) {
  const p = zoneParts(now, tz), created = zoneParts(createdAt, tz);
  const hour = s.atHour ?? created.hour, minute = s.nearMinute ?? 0;
  const weekDay = s.weekDay ? WEEKDAYS.indexOf(s.weekDay) : created.weekday;
  for (let back = 0; back <= 62; back++) {
    const day = new Date(Date.UTC(p.year, p.month - 1, p.day - back));
    if (s.kind === 'weeks' && day.getUTCDay() !== weekDay) continue;
    if (s.kind === 'months' && day.getUTCDate() !== s.monthDay) continue;
    const slot = wallToMs({ year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate(), hour, minute }, tz);
    if (slot <= now) return slot;
  }
  return null;
}

/**
 * Due rules: everyMinutes/everyHours when the interval has elapsed since the last run (or since
 * creation); daily/weekly/monthly when a scheduled slot passed after the last run (or creation);
 * at()/after() exactly once.
 */
function isDue(rt, t, now) {
  const s = t.schedule, since = t.lastRun ?? t.createdAt;
  if (s.kind === 'minutes') return now - since >= s.interval * 60000;
  if (s.kind === 'hours') return now - since >= s.interval * 3600000;
  if (s.kind === 'at') return t.runCount === 0 && now >= s.at;
  const slot = lastSlot(s, now, s.timeZone || rt.options.timeZone, t.createdAt);
  if (slot === null || slot <= since) return false;
  if (t.lastRun === null || s.interval <= 1 || s.kind === 'months') return true;
  return slot - t.lastRun >= s.interval * (s.kind === 'weeks' ? 7 : 1) * DAY_MS - 3600000; // 1h DST slack
}

/** Event object passed to a time-driven trigger (GAS reports these fields in UTC). */
function clockEvent(t, ms) {
  const d = new Date(ms);
  return {
    authMode: 'FULL', triggerUid: t.id, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1,
    'day-of-month': d.getUTCDate(), 'day-of-week': d.getUTCDay() || 7, 'week-of-year': isoWeek(d),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(), timezone: 'UTC',
  };
}

function makeScriptApp(rt) {
  const all = () => rt.realm.arr(rt.state.triggers.map((t) => new Trigger(rt, t)));
  return strict({
    AuthMode: enumOf(['NONE', 'CUSTOM_FUNCTION', 'LIMITED', 'FULL']),
    EventType: enumOf(['CLOCK', 'ON_OPEN', 'ON_EDIT', 'ON_FORM_SUBMIT', 'ON_CHANGE', 'ON_EVENT_UPDATED']),
    TriggerSource: enumOf(['SPREADSHEETS', 'CLOCK', 'FORMS', 'DOCUMENTS', 'CALENDAR']),
    WeekDay: enumOf(WEEKDAYS),
    newTrigger: (fn) => new TriggerBuilder(rt, typeof fn === 'function' ? fn.name : String(fn)),
    getProjectTriggers: all,
    getUserTriggers: all,
    deleteTrigger: (trigger) => {
      const i = rt.state.triggers.findIndex((t) => t.id === trigger?.getUniqueId());
      if (i >= 0) rt.state.triggers.splice(i, 1);
    },
    getService: () => strict({ getUrl: () => rt.options.webAppUrl, isEnabled: () => true }, 'Service', rt),
    getOAuthToken: () => rt.oauthToken,
    getScriptId: () => rt.options.scriptId,
  }, 'ScriptApp', rt);
}

// ---------------------------------------------------------------------------- UrlFetchApp

class HTTPResponse {
  constructor(rt, code, bytes, headers) {
    Object.assign(this, { _rt: rt, _code: code, _bytes: bytes, _headers: headers });
    return strict(this, 'HTTPResponse', rt);
  }
  _map(fn) { return this._rt.realm.obj(Object.fromEntries(Object.entries(this._headers).map(([k, v]) => [k, fn(v)]))); }
  getResponseCode() { return this._code; }
  getContentText(charset) { return decodeBytes(this._bytes, charset, this._rt); }
  getContent() { return signed(this._rt, this._bytes); }
  getHeaders() { return this._map((v) => [].concat(v).map(String).join(', ')); }
  /** Multi-valued headers come back as arrays, as in GAS. */
  getAllHeaders() { return this._map((v) => (Array.isArray(v) ? this._rt.realm.arr(v.map(String)) : String(v))); }
  getBlob() {
    const type = Object.entries(this._headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1];
    return new GasBlob(this._rt, Buffer.from(this._bytes), type == null ? null : String([].concat(type)[0]));
  }
}

function makeUrlFetchApp(rt) {
  /** Normalizes fetch params the way GAS does before sending (method, payload, contentType). */
  function request(url, params = {}) {
    url = String(url);
    let parsed = null;
    try { parsed = new URL(url); } catch { /* reported below */ }
    if (!parsed || !/^https?:$/.test(parsed.protocol)) throw rt.error(`Invalid argument: ${url}`);
    let payload = params.payload ?? null, contentType = params.contentType ?? null;
    if (payload !== null) {
      const blob = typeof payload === 'object' ? blobOf(payload) : null;
      if (blob) { contentType ??= blob.getContentType(); payload = Buffer.from(blob._bytes); }
      else if (Array.isArray(payload) || ArrayBuffer.isView(payload)) payload = toBuffer(payload, null, rt);
      else if (typeof payload === 'object') payload = new URLSearchParams(Object.entries(payload).map(([k, v]) => [k, String(v)])).toString();
      else payload = String(payload);
      contentType ??= 'application/x-www-form-urlencoded';
    }
    return { ...params, url, method: String(params.method || 'get').toLowerCase(), headers: { ...(params.headers || {}) },
      contentType, payload, muteHttpExceptions: !!params.muteHttpExceptions };
  }

  function fetch(url, params) {
    const req = request(url, params);
    const handler = rt.options.fetchHandler;
    if (typeof handler !== 'function') throw rt.error(`gas-mock: UrlFetchApp.fetch("${req.url}") was called but no fetchHandler option was given`);
    const res = handler(req.url, req) ?? {};
    if (typeof res.then === 'function') throw rt.error('gas-mock: fetchHandler must return synchronously (UrlFetchApp.fetch is synchronous)');
    const code = Number(res.code ?? res.status ?? 200);
    const headers = { ...(res.headers || {}) };
    let body = res.body ?? '';
    if (body && typeof body === 'object' && !Array.isArray(body) && !ArrayBuffer.isView(body) && !blobOf(body)) {
      body = JSON.stringify(body); // convenience: object bodies are sent as JSON
      if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
    }
    const bytes = toBuffer(body, null, rt), text = bytes.toString('utf8');
    rt.state.fetches.push({ url: req.url, method: req.method, headers: req.headers, contentType: req.contentType,
      payload: req.payload, params: req, timestamp: new Date(rt.clock.ms), response: { code, headers, body: text } });
    if (code >= 400 && !req.muteHttpExceptions) {
      const shown = text.length > 100 ? `${text.slice(0, 100)}...` : text;
      throw rt.error(`Request failed for ${new URL(req.url).origin} returned code ${code}. Truncated server response: ${shown} (use muteHttpExceptions option to examine full response)`);
    }
    return new HTTPResponse(rt, code, bytes, headers);
  }

  return strict({
    fetch,
    fetchAll: (requests) => rt.realm.arr([...requests].map((r) => (typeof r === 'string' ? fetch(r) : fetch(r.url, r)))),
  }, 'UrlFetchApp', rt);
}

// ---------------------------------------------------------------------------- Session, Logger, console

const makeSession = (rt) => strict({
  getScriptTimeZone: () => rt.options.timeZone,
  getActiveUser: () => makeUser(rt, rt.options.activeUserEmail),
  getEffectiveUser: () => makeUser(rt, rt.options.ownerEmail),
  getTemporaryActiveUserKey: () => rt.tempUserKey,
  getActiveUserLocale: () => rt.options.locale,
}, 'Session', rt);

function makeLogging(rt) {
  const show = (v) => {
    if (typeof v === 'string') return v;
    if (v === null || typeof v !== 'object' || isDate(v)) return String(v);
    try { return JSON.stringify(v); } catch { return String(v); }
  };
  const add = (level, source, message) => {
    rt.state.logs.push({ level, source, message, timestamp: new Date(rt.clock.ms) });
    if (rt.options.verbose) console[level](`[gas ${source}] ${message}`);
  };
  let lines = [];
  const Logger = strict({
    /** Logger.log(value) or Logger.log('format %s', value...). */
    log(first, ...rest) {
      let i = 0;
      const msg = typeof first === 'string' && rest.length && first.includes('%s')
        ? first.replace(/%s/g, () => (i < rest.length ? show(rest[i++]) : '%s'))
        : [first, ...rest].map(show).join(' ');
      lines.push(msg);
      add('info', 'Logger', msg);
      return Logger;
    },
    getLog: () => lines.join('\n'),
    clear: () => { lines = []; },
  }, 'Logger', rt);
  const timers = new Map();
  const level = (lvl) => (...args) => add(lvl, 'console', util.format(...args));
  const sandboxConsole = strict({
    log: level('log'), info: level('info'), warn: level('warn'), error: level('error'), debug: level('debug'),
    time: (label = 'default') => { timers.set(label, rt.clock.ms); },
    timeEnd: (label = 'default') => {
      add('log', 'console', `${label}: ${rt.clock.ms - (timers.get(label) ?? rt.clock.ms)}ms`);
      timers.delete(label);
    },
  }, 'console', rt);
  return { Logger, console: sandboxConsole };
}

// ---------------------------------------------------------------------------- the environment

// Common services that are not emulated: any call reports "Not implemented in gas-mock: X.method".
const UNEMULATED = ['CalendarApp', 'DocumentApp', 'FormApp', 'SlidesApp', 'GroupsApp', 'ContactsApp', 'XmlService',
  'LanguageApp', 'Charts', 'Maps', 'Browser', 'CardService', 'Jdbc', 'SitesApp'];

// Compiled inside each sandbox so that the values it builds belong to the sandbox realm.
const REALM_HELPERS = `({
  Error: Error, objProto: Object.prototype, parse: JSON.parse,
  obj: function (o) { return Object.assign({}, o); },
  arr: function conv(a) { return Array.prototype.map.call(a, function (x) { return Array.isArray(x) ? conv(x) : x; }); }
})`;

/** process.env.TZ value for a GAS time zone (Java 'GMT+9' means POSIX 'Etc/GMT-9'). */
function posixTz(tz) {
  const m = FIXED_TZ.exec(tz);
  if (!m) return /^(GMT|UTC|Z)$/i.test(tz) ? 'UTC' : tz;
  return m[3] && Number(m[3]) ? null : `Etc/GMT${m[1] === '+' ? '-' : '+'}${Number(m[2])}`;
}

export function createGasEnv(options = {}) {
  const opts = {
    timeZone: 'Asia/Seoul', ownerEmail: 'owner@example.com', mailQuota: 100, fetchHandler: null,
    webAppUrl: 'https://script.google.com/macros/s/MOCK/exec', locale: 'en', verbose: false,
    isolateExecutions: false, patchProcessTz: true, scriptId: randomId(57),
    ...options,
  };
  opts.activeUserEmail ??= opts.ownerEmail;
  const clock = makeClock(options.now ?? Date.now());
  const state = {
    spreadsheets: new Map(), drive: { files: new Map(), folders: new Map(), rootId: null },
    mails: [], mailQuota: { windowStart: null, used: 0 }, properties: new Map(), cache: new Map(),
    triggers: [], fetches: [], logs: [],
  };
  const realm = {}; // sandbox-realm helpers, refreshed whenever a new context is created
  const rt = {
    options: opts, clock, state, realm, env: null, htmlFiles: new Map(),
    oauthToken: `ya29.mock-${crypto.randomBytes(12).toString('hex')}`,
    tempUserKey: crypto.randomBytes(24).toString('base64url'),
    /** Errors thrown by services: sandbox-realm Error named 'Exception', like GAS. */
    error(message) {
      const e = new (realm.Error || Error)(message);
      e.name = 'Exception';
      return e;
    },
  };

  const DriveApp = makeDrive(rt); // first: SpreadsheetApp registers its files in Drive
  const { Logger, console: sandboxConsole } = makeLogging(rt);
  const prop = (scope) => () => scoped(rt, state.properties, scope, Properties);
  const cache = (scope) => () => scoped(rt, state.cache, scope, Cache);
  const globals = {
    SpreadsheetApp: makeSpreadsheetApp(rt), DriveApp, Utilities: makeUtilities(rt), ...makeMail(rt),
    CacheService: strict({ getScriptCache: cache('script'), getUserCache: cache('user'), getDocumentCache: cache('document') }, 'CacheService', rt),
    LockService: strict({ getScriptLock: () => new Lock(rt), getUserLock: () => new Lock(rt), getDocumentLock: () => new Lock(rt) }, 'LockService', rt),
    PropertiesService: strict({ getScriptProperties: prop('script'), getUserProperties: prop('user'), getDocumentProperties: prop('document') }, 'PropertiesService', rt),
    ContentService: strict({ MimeType: enumOf(Object.keys(TEXT_MIME)), createTextOutput: (c) => new TextOutput(rt, c) }, 'ContentService', rt),
    HtmlService: makeHtmlService(rt), ScriptApp: makeScriptApp(rt), UrlFetchApp: makeUrlFetchApp(rt),
    Session: makeSession(rt), Logger, console: sandboxConsole,
    ...Object.fromEntries(UNEMULATED.map((name) => [name, strict({}, name, rt)])),
  };

  // ---- sandbox context
  const sources = []; // compiled vm.Script of every loaded .gs file, in load order
  let context = null;
  function newContext() {
    context = vm.createContext({}, { name: 'gas-mock' });
    Object.assign(realm, vm.runInContext(REALM_HELPERS, context));
    realm.Date = makeFakeDate(clock);
    Object.assign(context, globals, { Date: realm.Date });
  }
  function restart() {
    newContext();
    for (const script of sources) script.runInContext(context);
  }
  newContext();

  /** Runs script code: script time zone in process.env.TZ, fresh globals if isolateExecutions. */
  let depth = 0;
  function execute(fn, fresh = true) {
    if (depth > 0) return fn(); // nested (e.g. env.call from inside a fetchHandler)
    const tz = opts.patchProcessTz ? posixTz(opts.timeZone) : null;
    const prevTz = process.env.TZ;
    depth++;
    try {
      if (tz) process.env.TZ = tz;
      if (fresh && opts.isolateExecutions) restart();
      return fn();
    } finally {
      depth--;
      if (tz) { if (prevTz === undefined) delete process.env.TZ; else process.env.TZ = prevTz; }
    }
  }

  function getFn(name) {
    let fn = context[name]; // function declarations are properties of the global object
    if (typeof fn !== 'function' && /^[A-Za-z_$][\w$]*$/.test(name)) {
      // top-level `const doPost = (e) => ...` lives in the global lexical scope instead
      fn = vm.runInContext(`typeof ${name} === 'function' ? ${name} : undefined`, context);
    }
    if (typeof fn !== 'function') throw new Error(`Script function not found: ${name}`);
    return fn;
  }

  /**
   * Deep-copies plain arrays/objects into the host realm (toHost: also turns Dates into plain
   * host Dates, so assert.deepStrictEqual works) or into the sandbox realm. GAS objects, class
   * instances and Buffers are passed through untouched.
   */
  function copyRealm(v, toHost, seen = new Map()) {
    if (isDate(v)) return toHost ? new Date(timeOf(v)) : v;
    if (v === null || typeof v !== 'object' || STRICT.has(v)) return v;
    if (seen.has(v)) return seen.get(v);
    const isArray = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (!isArray && proto !== null && proto !== Object.prototype && proto !== realm.objProto) return v;
    const out = isArray ? (toHost ? [] : realm.arr([])) : (toHost ? {} : realm.obj({}));
    seen.set(v, out);
    for (const k of Object.keys(v)) out[k] = copyRealm(v[k], toHost, seen);
    return out;
  }
  const toHost = (v) => copyRealm(v, true);
  const toSandbox = (v) => copyRealm(v, false);

  /** Builds the web-app event object shared by doGet and doPost. */
  function webEvent(query = {}, bodyPairs = []) {
    const pairs = Object.entries(query || {}).flatMap(([k, v]) => [].concat(v).map((x) => [k, String(x)]));
    const parameter = {}, parameters = {};
    for (const [k, v] of [...pairs, ...bodyPairs]) {
      (parameters[k] ||= []).push(v);
      if (!(k in parameter)) parameter[k] = v;
    }
    return { parameter, parameters, queryString: new URLSearchParams(pairs).toString(), contextPath: '', contentLength: -1 };
  }

  /** Converts what doGet/doPost returned into what an HTTP client would receive. */
  function webResponse(raw) {
    let text, mimeType = 'HTML', contentType = 'text/html';
    if (raw instanceof TextOutput) {
      text = raw.getContent();
      mimeType = raw.getMimeType();
      contentType = TEXT_MIME[mimeType];
    } else if (raw instanceof HtmlOutput) text = raw.getContent();
    else if (raw === undefined) text = 'The script completed but did not return anything.';
    else text = 'The script completed but the returned value is not a supported return type.';
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { raw, text, json, mimeType, contentType };
  }

  const env = {
    options: opts,
    state,
    globals,
    clock: { now: clock.now, set: clock.set, advance: clock.advance },
    /** When true, Lock.tryLock() returns false and Lock.waitLock() throws (simulated contention). */
    lockBusy: false,
    get context() { return context; },
    toHost,

    /** Runs a .gs file in the shared global scope; '*.html' files are kept for HtmlService. */
    load(code, filename = 'Code.gs') {
      if (/\.html$/i.test(filename)) {
        rt.htmlFiles.set(filename.replace(/\.html$/i, ''), String(code));
        return env;
      }
      const script = new vm.Script(String(code), { filename });
      sources.push(script);
      execute(() => script.runInContext(context), false);
      return env;
    },
    /** Calls a global function. Returned arrays/plain objects are copied into the host realm. */
    call(name, ...args) {
      return execute(() => toHost(getFn(name)(...args.map(toSandbox))));
    },
    doPost(body, o = {}) {
      const contents = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
      const type = o.contentType || 'text/plain';
      const form = /^application\/x-www-form-urlencoded/i.test(type) ? [...new URLSearchParams(contents)] : [];
      const e = webEvent(o.parameter, form);
      const length = Buffer.byteLength(contents);
      Object.assign(e, { postData: { contents, type, length, name: 'postData' }, contentLength: length });
      return execute(() => webResponse(getFn('doPost')(toSandbox(e))));
    },
    doGet(params = {}) {
      const e = webEvent(params);
      return execute(() => webResponse(getFn('doGet')(toSandbox(e))));
    },
    /** Runs every time-based trigger that is due on the fake clock once; returns handler names. */
    runTriggers() {
      const ran = [], errors = [];
      for (const t of [...state.triggers]) {
        if (!state.triggers.includes(t) || !isDue(rt, t, clock.ms)) continue;
        t.lastRun = clock.ms;
        t.runCount++;
        ran.push(t.handler);
        try {
          execute(() => getFn(t.handler)(toSandbox(clockEvent(t, clock.ms))));
        } catch (err) {
          errors.push(err);
        }
      }
      if (errors.length) {
        const err = new Error(`gas-mock: ${errors.length} trigger run(s) failed: ${errors.map((x) => x?.message ?? x).join(' | ')}`);
        throw Object.assign(err, { errors, ran });
      }
      return ran;
    },
    /** Simulates a new GAS execution: fresh global scope, loaded files re-run, state kept. */
    restart() { execute(restart, false); return env; },

    sheetValues(spreadsheetId, sheetName) {
      const sheet = state.spreadsheets.get(spreadsheetId)?.sheets.find((s) => s.name === sheetName);
      if (!sheet) throw new Error(`gas-mock: no sheet "${sheetName}" in spreadsheet ${spreadsheetId}`);
      const rows = lastRowOf(sheet), cols = lastColOf(sheet);
      return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
        const v = cellGet(sheet, r + 1, c + 1);
        return isDate(v) ? new Date(timeOf(v)) : v;
      }));
    },
    findSpreadsheetByName(name) {
      const rec = [...state.spreadsheets.values()].find((s) => s.name === name && !rt.drive.isTrashed(s.file));
      return rec ? new Spreadsheet(rt, rec) : null;
    },
  };
  rt.env = env;
  return env;
}
