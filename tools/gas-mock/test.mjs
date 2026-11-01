// Self-tests for gas-mock. Run: node tools/gas-mock/test.mjs (exit code 1 on failure).
import assert from 'node:assert/strict';
import { createGasEnv } from './index.mjs';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const NOW = '2026-11-01T09:00:00+09:00'; // a Sunday
const mk = (opts = {}) => createGasEnv({ now: new Date(NOW), timeZone: 'Asia/Seoul', ownerEmail: 'owner@example.com', ...opts });
const HOUR = 3600 * 1000;

test('sheets: appendRow, getDataRange, getRange, lastRow, growth, delete/insert rows', () => {
  const env = mk();
  env.load(`
    function setup() {
      const ss = SpreadsheetApp.create('DB');
      const sh = ss.insertSheet('Users');
      sh.appendRow(['id', 'name', 'joined']).appendRow([1, 'Kim', new Date()]);
      sh.appendRow([2, 'Lee', true]);
      return ss.getId();
    }
    function read(id) {
      const ss = SpreadsheetApp.openById(id), sh = ss.getSheetByName('Users');
      const values = sh.getDataRange().getValues();
      return { lastRow: sh.getLastRow(), lastCol: sh.getLastColumn(), values, isArray: values instanceof Array,
        isDate: values[1][2] instanceof Date, missing: ss.getSheetByName('Nope'), sheets: ss.getSheets().map((s) => s.getName()),
        empty: sh.getRange(3, 4).getValue(), block: sh.getRange(2, 2, 2, 3).getValues() };
    }
  `);
  const id = env.call('setup');
  const r = env.call('read', id);
  assert.equal(r.lastRow, 3);
  assert.equal(r.lastCol, 3);
  assert.equal(r.values[1][1], 'Kim');
  assert.ok(r.isArray && r.isDate);
  assert.ok(r.values[1][2] instanceof Date);
  assert.equal(r.values[1][2].getTime(), Date.parse(NOW));
  assert.equal(r.missing, null);
  assert.deepEqual(r.sheets, ['Sheet1', 'Users']);
  assert.equal(r.empty, '');
  assert.deepEqual(r.block, [['Kim', r.values[1][2], ''], ['Lee', true, '']]);

  const sh = env.globals.SpreadsheetApp.openById(id).getSheetByName('Users');
  sh.getRange(1200, 30).setValue(0); // writing past the sheet extends it; 0 counts as content
  assert.equal(sh.getMaxRows(), 1200);
  assert.equal(sh.getMaxColumns(), 30);
  assert.equal(sh.getLastRow(), 1200);
  sh.deleteRow(1200);
  assert.equal(sh.getLastRow(), 3);
  sh.insertRowAfter(1);
  assert.deepEqual(env.sheetValues(id, 'Users').map((row) => row[1]), ['name', '', 'Kim', 'Lee']);
  sh.deleteRows(2, 1);
  sh.getRange('A2:C2').clearContent();
  assert.deepEqual(env.sheetValues(id, 'Users'), [['id', 'name', 'joined'], ['', '', ''], [2, 'Lee', true]]);
  sh.setFrozenRows(1);
  assert.equal(sh.getFrozenRows(), 1);
  sh.clearContents();
  assert.equal(sh.getLastRow(), 0);
  assert.equal(sh.getDataRange().getA1Notation(), 'A1');
  assert.throws(() => sh.deleteRows(1, sh.getMaxRows()), /not possible to delete all non-frozen rows/);
  assert.throws(() => sh.getRange(0, 1), /starting row of the range is too small/);
  assert.throws(() => sh.getRange(2, 1, 0, 3), /number of rows in the range must be at least 1/);
  assert.throws(() => env.globals.SpreadsheetApp.openById(id).insertSheet('Users'), /already exists/);
  assert.equal(sh.setColumnWidth(1, 100).setTabColor('#f00').getRange('A1').setFontWeight('bold').getA1Notation(), 'A1');
});

test('sheets: setValues validates dimensions like GAS', () => {
  const env = mk();
  env.load(`
    function write(kind) {
      const r = SpreadsheetApp.create('X').getSheets()[0].getRange('A1:B2');
      if (kind === 'rows') r.setValues([[1, 2]]);
      if (kind === 'cols') r.setValues([[1, 2], [3]]);
      if (kind === 'flat') r.setValues([1, 2]);
      return r.setValues([[1, 'b'], [null, false]]).getValues();
    }`);
  assert.throws(() => env.call('write', 'rows'), /number of rows in the data does not match the number of rows in the range\. The data has 1 but the range has 2\./);
  assert.throws(() => env.call('write', 'cols'), /number of columns in the data does not match .* The data has 1 but the range has 2\./);
  assert.throws(() => env.call('write', 'flat'), /don't match the method signature for SpreadsheetApp\.Range\.setValues/);
  assert.deepEqual(env.call('write', 'ok'), [[1, 'b'], ['', false]]);
});

test('sheets: A1 notation parsing, getA1Notation, offset, display values', () => {
  const env = mk();
  const ss = env.globals.SpreadsheetApp.create('A1');
  const sh = ss.getSheets()[0];
  const r = sh.getRange('B2:D5');
  assert.deepEqual([r.getRow(), r.getColumn(), r.getNumRows(), r.getNumColumns()], [2, 2, 4, 3]);
  assert.equal(r.getA1Notation(), 'B2:D5');
  assert.equal(sh.getRange('$AA$10').getColumn(), 27);
  assert.equal(sh.getRange('d4:b2').getA1Notation(), 'B2:D4');
  assert.equal(sh.getRange(1, 28).getA1Notation(), 'AB1');
  assert.equal(sh.getRange('C:C').getNumRows(), 1000);
  assert.equal(sh.getRange('2:3').getNumColumns(), 26);
  assert.equal(sh.getRange('A2:B').getNumRows(), 999);
  assert.equal(r.offset(1, 1).getA1Notation(), 'C3:E6');
  assert.equal(r.offset(0, 0, 1, 1).getA1Notation(), 'B2');
  assert.equal(r.getCell(2, 3).getA1Notation(), 'D3');
  assert.equal(ss.getRange("'Sheet1'!B3").getA1Notation(), 'B3');
  assert.throws(() => sh.getRange('nonsense!!'), /Range not found/);
  sh.getRange('A1:C2').setValues([[1.5, 'x', new Date('2026-01-02T00:00:00+09:00')], [new Date(0), false, '']]);
  assert.deepEqual(env.toHost(sh.getRange('A1:C2').getDisplayValues()), [['1.5', 'x', '2026-01-02'], ['1970-01-01 09:00:00', 'FALSE', '']]);
});

test('drive: folders, files, iterators, parents, trash, spreadsheet files', () => {
  const env = mk();
  env.load(`
    function drive() {
      const f = DriveApp.createFolder('Reports');
      const sub = f.createFolder('2026');
      const a = f.createFile('a.txt', 'hello', 'text/plain');
      const b = sub.createFile(Utilities.newBlob('{"x":1}', 'application/json', 'b.json'));
      const ss = SpreadsheetApp.create('Sheet file');
      DriveApp.getFileById(ss.getId()).moveTo(f);
      const names = []; const it = f.getFiles(); while (it.hasNext()) names.push(it.next().getName());
      let endError = null; try { it.next(); } catch (e) { endError = e.message; }
      const out = { names, endError, sub: f.getFolders().next().getName(), aSize: a.getSize(), aMime: a.getMimeType(),
        bText: DriveApp.getFileById(b.getId()).getBlob().getDataAsString(), idLen: a.getId().length,
        found: DriveApp.getFilesByName('b.json').next().getId() === b.getId(),
        parent: b.getParents().next().getId() === sub.getId(),
        inRoot: DriveApp.getRootFolder().getFoldersByName('Reports').hasNext(),
        sheetMime: DriveApp.getFileById(ss.getId()).getMimeType(), url: f.getUrl() };
      a.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      out.sharing = a.getSharingAccess() + '/' + a.getSharingPermission();
      f.setTrashed(true);
      Object.assign(out, { childTrashed: b.isTrashed(), byNameAfterTrash: DriveApp.getFilesByName('b.json').hasNext(),
        stillById: DriveApp.getFileById(a.getId()).getName(), folderGone: DriveApp.getFoldersByName('Reports').hasNext() });
      f.setTrashed(false);
      out.restored = DriveApp.getFilesByName('b.json').hasNext();
      return out;
    }
    function missing() { return DriveApp.getFileById('nope'); }`);
  const r = env.call('drive');
  assert.deepEqual(r.names, ['a.txt', 'Sheet file']);
  assert.match(r.endError, /iterator has reached the end/);
  assert.equal(r.sub, '2026');
  assert.equal(r.aSize, 5);
  assert.equal(r.aMime, 'text/plain');
  assert.equal(r.bText, '{"x":1}');
  assert.equal(r.idLen, 33);
  assert.ok(r.found && r.parent && r.inRoot);
  assert.equal(r.sheetMime, 'application/vnd.google-apps.spreadsheet');
  assert.match(r.url, /^https:\/\/drive\.google\.com\/drive\/folders\//);
  assert.equal(r.sharing, 'ANYONE_WITH_LINK/VIEW');
  assert.equal(r.childTrashed, true);
  assert.equal(r.byNameAfterTrash, false);
  assert.equal(r.stillById, 'a.txt');
  assert.equal(r.folderGone, false);
  assert.equal(r.restored, true);
  assert.throws(() => env.call('missing'), /No item with the given ID could be found/);
  assert.equal(env.state.drive.files.size, 3);
});

test('bytes: binary blob roundtrip with Java-style signed bytes', () => {
  const env = mk();
  env.load(`
    function bytesTest() {
      const raw = []; for (let i = 0; i < 256; i++) raw.push(i);
      const blob = Utilities.newBlob(raw, 'application/octet-stream', 'bin.dat');
      const bytes = blob.getBytes();
      const b64 = Utilities.base64Encode(bytes);
      const file = DriveApp.createFile(blob);
      return { bytes, b64, back: Utilities.base64Decode(b64), isArray: bytes instanceof Array,
        fromDrive: DriveApp.getFileById(file.getId()).getBlob().getBytes(), size: file.getSize(), mime: file.getMimeType(),
        web: Utilities.base64EncodeWebSafe([251, 255]), webBack: Utilities.base64DecodeWebSafe('-_8='),
        str: Utilities.base64Encode('한글'), strBack: Utilities.newBlob(Utilities.base64Decode('7ZWc6riA')).getDataAsString(),
        copy: blob.copyBlob().setName('c.bin').getName(), orig: blob.getName() };
    }`);
  const r = env.call('bytesTest');
  assert.equal(r.bytes.length, 256);
  assert.equal(r.bytes[255], -1);
  assert.equal(r.bytes[128], -128);
  assert.equal(r.bytes[127], 127);
  assert.ok(r.bytes.every((b) => Number.isInteger(b) && b >= -128 && b <= 127));
  assert.ok(r.isArray);
  assert.equal(r.b64, Buffer.from(Array.from({ length: 256 }, (_, i) => i)).toString('base64'));
  assert.deepEqual(r.back, r.bytes);
  assert.deepEqual(r.fromDrive, r.bytes);
  assert.equal(r.size, 256);
  assert.equal(r.mime, 'application/octet-stream');
  assert.equal(r.web, '-_8=');
  assert.deepEqual(r.webBack, [-5, -1]);
  assert.equal(r.str, '7ZWc6riA');
  assert.equal(r.strBack, '한글');
  assert.deepEqual([r.copy, r.orig], ['c.bin', 'bin.dat']);
  assert.throws(() => env.globals.Utilities.base64Decode('not base64!'), /Could not decode string/);
});

test('crypto: HMAC-SHA256 and digests match known vectors', () => {
  const env = mk();
  env.load(`
    const hex = (b) => b.map((x) => ((x + 256) % 256).toString(16).padStart(2, '0')).join('');
    function crypt() {
      const msg = 'The quick brown fox jumps over the lazy dog';
      const h = Utilities.computeHmacSha256Signature(msg, 'key');
      return { h: hex(h), first: h[0],
        generic: hex(Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, msg, 'key')),
        fromBytes: hex(Utilities.computeHmacSha256Signature(Utilities.newBlob(msg).getBytes(), Utilities.newBlob('key').getBytes())),
        sha256: hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'abc')),
        md5: hex(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, 'abc')),
        sha1: hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, 'abc')) };
    }`);
  const r = env.call('crypt');
  const vector = 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8';
  assert.equal(r.h, vector);
  assert.equal(r.generic, vector);
  assert.equal(r.fromBytes, vector);
  assert.equal(r.first, 0xf7 - 256);
  assert.equal(r.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(r.md5, '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(r.sha1, 'a9993e364706816aba3e25717850c26c9cd0d89d');
});

test('Utilities.formatDate with Asia/Seoul and other zones', () => {
  const U = mk().globals.Utilities;
  const d = new Date('2026-11-01T00:05:09.007Z'); // 09:05:09 KST, Sunday
  assert.equal(U.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss.SSS'), '2026-11-01 09:05:09.007');
  assert.equal(U.formatDate(d, 'Asia/Seoul', 'yy/M/d h:mm a E EEEE Z XXX'), '26/11/1 9:05 AM Sun Sunday +0900 +09:00');
  assert.equal(U.formatDate(d, 'Asia/Seoul', "yyyy'년' M'월' d'일' '('EEE')' 'o''clock'"), "2026년 11월 1일 (Sun) o'clock");
  assert.equal(U.formatDate(d, 'Asia/Seoul', 'MMM MMMM dd H'), 'Nov November 01 9');
  assert.equal(U.formatDate(new Date('2026-11-01T15:30:00Z'), 'Asia/Seoul', 'yyyy-MM-dd hh:mm a'), '2026-11-02 12:30 AM');
  assert.equal(U.formatDate(d, 'UTC', "yyyy-MM-dd'T'HH:mm:ssXXX"), '2026-11-01T00:05:09Z');
  assert.equal(U.formatDate(d, 'GMT+9', 'HH:mm Z'), '09:05 +0900');
  assert.equal(U.formatDate(d, 'America/New_York', 'yyyy-MM-dd HH:mm Z'), '2026-10-31 20:05 -0400');
  assert.throws(() => U.formatDate(d, 'Asia/Seoul', 'yyyy-ww'), /Not implemented in gas-mock: date pattern letter 'w'/);
});

test('CacheService TTL follows the fake clock', () => {
  const env = mk();
  env.load(`
    function put() { const c = CacheService.getScriptCache(); c.put('a', 'A', 60); c.put('b', 'B'); c.putAll({ c: 'C', d: 'D' }, 99999); }
    function get() { const c = CacheService.getScriptCache(); return { a: c.get('a'), b: c.get('b'), all: c.getAll(['c', 'd', 'zz']) }; }
    function tooBig() { CacheService.getScriptCache().put('big', 'x'.repeat(100 * 1024 + 1)); }
    function notString() { CacheService.getScriptCache().put('o', { a: 1 }); }
    function scopes() { CacheService.getUserCache().put('a', 'user'); return [CacheService.getScriptCache().get('a'), CacheService.getUserCache().get('a')]; }`);
  env.call('put');
  assert.deepEqual(env.call('get'), { a: 'A', b: 'B', all: { c: 'C', d: 'D' } });
  env.clock.advance(61 * 1000);
  assert.deepEqual(env.call('get'), { a: null, b: 'B', all: { c: 'C', d: 'D' } });
  env.clock.advance(600 * 1000); // default TTL is 600 s
  assert.equal(env.call('get').b, null);
  env.clock.advance(6 * HOUR); // TTL is capped at 21600 s
  assert.deepEqual(env.call('get').all, {});
  assert.throws(() => env.call('tooBig'), /Argument too large: value/);
  assert.throws(() => env.call('notString'), /don't match the method signature for CacheService\.Cache\.put/);
  assert.deepEqual(env.call('scopes'), [null, 'user']);
});

test('MailApp: recording, quota exhaustion and 24h reset', () => {
  const env = mk({ mailQuota: 3 });
  env.load(`
    function send(to) { MailApp.sendEmail(to, 'Hi', 'Body', { name: 'Bot', htmlBody: '<b>Body</b>' }); return MailApp.getRemainingDailyQuota(); }
    function sendObj() {
      MailApp.sendEmail({ to: 'a@x.com', cc: 'Bee <b@x.com>', subject: 'S', body: 'B',
        attachments: [Utilities.newBlob('pdf-bytes', 'application/pdf', 'f.pdf')] });
    }
    function quota() { return MailApp.getRemainingDailyQuota(); }`);
  assert.equal(env.call('send', 'one@x.com'), 2);
  env.clock.advance(HOUR);
  assert.equal(env.call('send', 'two@x.com'), 1);
  assert.throws(() => env.call('sendObj'), /Service invoked too many times for one day: email\./); // needs 2
  assert.equal(env.state.mails.length, 2);
  assert.deepEqual([env.state.mails[0].to, env.state.mails[0].subject, env.state.mails[0].htmlBody, env.state.mails[0].name], ['one@x.com', 'Hi', '<b>Body</b>', 'Bot']);
  assert.equal(env.state.mails[1].timestamp.getTime(), Date.parse(NOW) + HOUR);
  env.clock.advance(23 * HOUR - 1); // 1 ms before 24h after the first send
  assert.equal(env.call('quota'), 1);
  env.clock.advance(1);
  assert.equal(env.call('quota'), 3);
  env.call('sendObj');
  assert.equal(env.call('quota'), 1);
  const last = env.state.mails.at(-1);
  assert.deepEqual(last.recipients, ['a@x.com', 'b@x.com']);
  assert.deepEqual([last.attachments[0].name, last.attachments[0].contentType, last.attachments[0].data.toString()], ['f.pdf', 'application/pdf', 'pdf-bytes']);
  assert.throws(() => env.call('send', 'not-an-email'), /Invalid email: not-an-email/);
});

test('ScriptApp: time-based triggers run on the fake clock', () => {
  const env = mk(); // Sunday 2026-11-01 09:00 KST
  env.load(`
    function bump(name, e) { const p = PropertiesService.getScriptProperties(); p.setProperty(name, String(Number(p.getProperty(name) || 0) + 1)); if (e) p.setProperty('lastUid', e.triggerUid); }
    function tick(e) { bump('tick', e); }
    function daily() { bump('daily'); }
    function weekly() { bump('weekly'); }
    function once() { bump('once'); }
    function install() {
      ScriptApp.newTrigger('tick').timeBased().everyMinutes(5).create();
      ScriptApp.newTrigger('daily').timeBased().everyDays(1).atHour(10).create();
      ScriptApp.newTrigger('weekly').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
      ScriptApp.newTrigger('once').timeBased().after(90 * 60 * 1000).create();
      return ScriptApp.getProjectTriggers().map((t) => t.getHandlerFunction() + ':' + t.getEventType());
    }
    function removeTick() { ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'tick').forEach((t) => ScriptApp.deleteTrigger(t)); }
    function badInterval() { ScriptApp.newTrigger('tick').timeBased().everyMinutes(7).create(); }`);
  assert.deepEqual(env.call('install'), ['tick:CLOCK', 'daily:CLOCK', 'weekly:CLOCK', 'once:CLOCK']);
  assert.deepEqual(env.runTriggers(), []);
  env.clock.advance(5 * 60e3); // 09:05
  assert.deepEqual(env.runTriggers(), ['tick']);
  env.clock.advance(60e3); // 09:06
  assert.deepEqual(env.runTriggers(), []);
  env.clock.advance(59 * 60e3); // 10:05
  assert.deepEqual(env.runTriggers(), ['tick', 'daily']);
  env.clock.advance(30 * 60e3); // 10:35
  assert.deepEqual(env.runTriggers(), ['tick', 'once']);
  env.clock.advance(24 * HOUR); // Monday 10:35
  assert.deepEqual(env.runTriggers(), ['tick', 'daily', 'weekly']);
  const props = env.state.properties.get('script');
  assert.deepEqual(['tick', 'daily', 'weekly', 'once'].map((k) => props.get(k)), ['4', '2', '1', '1']);
  assert.equal(props.get('lastUid'), env.state.triggers[0].id);
  env.call('removeTick');
  env.clock.advance(10 * 60e3);
  assert.deepEqual(env.runTriggers(), []);
  assert.equal(env.state.triggers.length, 3);
  assert.throws(() => env.call('badInterval'), /everyMinutes\(7\)/);
});

test('web app: doPost / doGet roundtrip and event object shape', () => {
  const env = mk();
  env.load(`
    function doPost(e) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, echo: JSON.parse(e.postData.contents) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    function doGet(e) {
      if (e.parameter.page === 'html') return HtmlService.createHtmlOutput('<h1>Hi ' + e.parameter.name + '</h1>').setTitle('T');
      return ContentService.createTextOutput(JSON.stringify({ p: e.parameter, tags: e.parameters.tag, qs: e.queryString }))
        .setMimeType(ContentService.MimeType.JSON);
    }`);
  const res = env.doPost({ action: 'ping', n: 1 });
  assert.deepEqual(res.json, { ok: true, echo: { action: 'ping', n: 1 } });
  assert.equal(res.text, '{"ok":true,"echo":{"action":"ping","n":1}}');
  assert.deepEqual([res.mimeType, res.contentType, res.raw.getMimeType()], ['JSON', 'application/json', 'JSON']);
  const g = env.doGet({ name: 'Kim', tag: ['a', 'b'] });
  assert.deepEqual(g.json, { p: { name: 'Kim', tag: 'a' }, tags: ['a', 'b'], qs: 'name=Kim&tag=a&tag=b' });
  const h = env.doGet({ page: 'html', name: 'Lee' });
  assert.deepEqual([h.text, h.json, h.mimeType, h.raw.getTitle()], ['<h1>Hi Lee</h1>', null, 'HTML', 'T']);

  env.load(`function doPost(e) { return ContentService.createTextOutput(JSON.stringify(e)); }`, 'Echo.gs');
  const raw = env.doPost('hello', { parameter: { a: '1' } });
  assert.deepEqual(raw.json.postData, { contents: 'hello', type: 'text/plain', length: 5, name: 'postData' });
  assert.deepEqual([raw.json.contentLength, raw.json.parameter, raw.json.parameters, raw.mimeType], [5, { a: '1' }, { a: ['1'] }, 'TEXT']);
  const form = env.doPost('x=1&y=%ED%95%9C', { contentType: 'application/x-www-form-urlencoded' });
  assert.deepEqual(form.json.parameter, { x: '1', y: '한' });
  env.load(`function doGet() {}`, 'Empty.gs');
  assert.match(env.doGet().text, /did not return anything/);
});

test('fake Date in the sandbox follows the clock and the script time zone', () => {
  const env = mk();
  env.load(`
    function info() {
      const d = new Date();
      return { iso: d.toISOString(), now: Date.now(), hours: d.getHours(), isDate: d instanceof Date, ctor: d.constructor === Date,
        parsed: new Date('2020-01-02T03:04:05Z').getTime(), local: new Date(2026, 0, 1).toISOString(),
        call: typeof Date(), utc: Date.UTC(2020, 0, 1), copy: new Date(d).getTime() === d.getTime() };
    }
    function isDate(x) { return x instanceof Date; }
    function sleepy() { const a = Date.now(); Utilities.sleep(1500); return Date.now() - a; }`);
  const before = process.env.TZ;
  const r = env.call('info');
  assert.equal(r.iso, '2026-11-01T00:00:00.000Z');
  assert.equal(r.now, Date.parse(NOW));
  assert.equal(r.hours, 9);
  assert.ok(r.isDate && r.ctor && r.copy);
  assert.equal(r.parsed, Date.UTC(2020, 0, 2, 3, 4, 5));
  assert.equal(r.local, '2025-12-31T15:00:00.000Z'); // local midnight in Asia/Seoul
  assert.equal(r.call, 'string');
  assert.equal(r.utc, Date.UTC(2020, 0, 1));
  assert.equal(env.call('isDate', new Date()), true); // host Dates pass instanceof inside the sandbox
  assert.equal(process.env.TZ, before); // restored after the call
  env.clock.advance(60e3);
  assert.equal(env.call('info').iso, '2026-11-01T00:01:00.000Z');
  env.clock.set('2027-01-01T00:00:00Z');
  assert.equal(env.call('info').now, Date.parse('2027-01-01T00:00:00Z'));
  assert.equal(env.call('sleepy'), 1500);
  assert.equal(env.clock.now().toISOString(), '2027-01-01T00:00:01.500Z');

  const ny = createGasEnv({ now: new Date('2026-07-01T12:00:00Z'), timeZone: 'America/New_York' });
  ny.load(`function h() { return [new Date().getHours(), Session.getScriptTimeZone()]; }`);
  assert.deepEqual(ny.call('h'), [8, 'America/New_York']);
});

test('UrlFetchApp: fetchHandler, payloads, headers, muteHttpExceptions', () => {
  const env = mk({
    fetchHandler: (url, params) => {
      if (url.endsWith('/missing')) return { code: 404, body: 'not here', headers: { 'Content-Type': 'text/plain' } };
      return { code: 200, body: { url, method: params.method, payload: params.payload, ct: params.contentType, auth: params.headers.Authorization },
        headers: { 'X-Test': ['a', 'b'] } };
    },
  });
  env.load(`
    function post() {
      const res = UrlFetchApp.fetch('https://api.example.com/v1', { method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ a: 1 }), headers: { Authorization: 'Bearer t' } });
      return { code: res.getResponseCode(), json: JSON.parse(res.getContentText()), headers: res.getHeaders(),
        all: res.getAllHeaders(), type: res.getBlob().getContentType(), first: res.getContent()[0] };
    }
    function muted() { const r = UrlFetchApp.fetch('https://api.example.com/missing', { muteHttpExceptions: true }); return [r.getResponseCode(), r.getContentText()]; }
    function unmuted() { UrlFetchApp.fetch('https://api.example.com/missing'); }
    function form() { return JSON.parse(UrlFetchApp.fetch('https://api.example.com/form', { method: 'post', payload: { q: 'a b', n: 2 } }).getContentText()); }
    function all() { return UrlFetchApp.fetchAll(['https://api.example.com/1', { url: 'https://api.example.com/missing', muteHttpExceptions: true }]).map((r) => r.getResponseCode()); }
    function bad() { UrlFetchApp.fetch('ftp://example.com'); }`);
  const r = env.call('post');
  assert.equal(r.code, 200);
  assert.deepEqual(r.json, { url: 'https://api.example.com/v1', method: 'post', payload: '{"a":1}', ct: 'application/json', auth: 'Bearer t' });
  assert.equal(r.headers['X-Test'], 'a, b');
  assert.deepEqual(r.all['X-Test'], ['a', 'b']);
  assert.equal(r.type, 'application/json');
  assert.equal(r.first, '{'.charCodeAt(0));
  assert.deepEqual(env.call('muted'), [404, 'not here']);
  assert.throws(() => env.call('unmuted'), /Request failed for https:\/\/api\.example\.com returned code 404\. Truncated server response: not here \(use muteHttpExceptions/);
  assert.deepEqual(env.call('form'), { url: 'https://api.example.com/form', method: 'post', payload: 'q=a+b&n=2', ct: 'application/x-www-form-urlencoded' });
  assert.deepEqual(env.call('all'), [200, 404]);
  assert.throws(() => env.call('bad'), /Invalid argument: ftp:\/\/example\.com/);
  assert.equal(env.state.fetches.length, 6);
  assert.deepEqual([env.state.fetches[0].method, env.state.fetches[0].response.code, env.state.fetches[2].response.code], ['post', 200, 404]);
  const bare = mk();
  bare.load(`function f() { return UrlFetchApp.fetch('https://x.example.com'); }`);
  assert.throws(() => bare.call('f'), /no fetchHandler/);
});

test('properties, locks, logging, multi-file scope, errors, not-implemented methods', () => {
  const env = mk();
  env.load(`const CONFIG = { sheet: 'Main' }; let counter = 0;`, 'Config.gs');
  env.load(`
    function useConfig() { counter++; return CONFIG.sheet + counter; }
    function props() {
      const p = PropertiesService.getScriptProperties();
      p.setProperty('n', 5).setProperties({ a: 'x', b: true });
      const all = p.getProperties();
      p.deleteProperty('a');
      return { n: p.getProperty('n'), b: all.b, keys: p.getKeys().sort(), missing: p.getProperty('zz'),
        user: PropertiesService.getUserProperties().getProperty('n') };
    }
    function bigProp() { PropertiesService.getScriptProperties().setProperty('big', 'x'.repeat(9 * 1024 + 1)); }
    function locks() { const l = LockService.getScriptLock(); const ok = l.tryLock(1000); const has = l.hasLock(); l.releaseLock(); return [ok, has, l.hasLock()]; }
    function busy() { const l = LockService.getScriptLock(); if (l.tryLock(10)) return 'got it'; l.waitLock(1000); }
    function logs() { Logger.log('hello %s', 'world'); Logger.log({ a: 1 }); console.log('n=%d', 3); return Logger.getLog(); }
    function who() { return [Session.getActiveUser().getEmail(), Session.getEffectiveUser().getEmail(), Session.getScriptTimeZone(), ScriptApp.getService().getUrl()]; }
    function errorInfo() { try { DriveApp.getFolderById('x'); } catch (e) { return [e instanceof Error, e.name]; } }
    function boom() { throw new Error('kaboom'); }
    function notImpl() { SpreadsheetApp.getUi(); }
    function notImpl2() { CalendarApp.getDefaultCalendar(); }
    function json() { const ss = SpreadsheetApp.create('J'); return JSON.stringify({ s: ss }) + ' ' + ss.getSheets()[0] + ' ' + SpreadsheetApp; }`, 'Code.gs');
  assert.equal(env.call('useConfig'), 'Main1');
  assert.equal(env.call('useConfig'), 'Main2');
  assert.deepEqual(env.call('props'), { n: '5', b: 'true', keys: ['b', 'n'], missing: null, user: null });
  assert.throws(() => env.call('bigProp'), /Argument too large: value/);
  assert.deepEqual(env.call('locks'), [true, true, false]);
  env.lockBusy = true;
  assert.throws(() => env.call('busy'), /Lock timeout/);
  env.lockBusy = false;
  assert.equal(env.call('busy'), 'got it');
  assert.equal(env.call('logs'), 'hello world\n{"a":1}');
  assert.ok(env.state.logs.some((l) => l.source === 'console' && l.message === 'n=3'));
  assert.deepEqual(env.call('who'), ['owner@example.com', 'owner@example.com', 'Asia/Seoul', 'https://script.google.com/macros/s/MOCK/exec']);
  assert.deepEqual(env.call('errorInfo'), [true, 'Exception']);
  assert.throws(() => env.call('boom'), /kaboom/);
  assert.throws(() => env.call('notImpl'), /Not implemented in gas-mock: SpreadsheetApp\.getUi/);
  assert.throws(() => env.call('notImpl2'), /Not implemented in gas-mock: CalendarApp\.getDefaultCalendar/);
  assert.throws(() => env.call('noSuchFn'), /Script function not found: noSuchFn/);
  assert.equal(env.call('json'), '{"s":{}} Sheet SpreadsheetApp');
  assert.throws(() => env.load('const CONFIG = 1;', 'Dup.gs'), /already been declared/);
});

test('isolateExecutions re-runs the files per execution (globals reset, state kept)', () => {
  const env = mk({ isolateExecutions: true });
  env.load(`let hits = 0;
    const doPost = (e) => { hits++; const p = PropertiesService.getScriptProperties();
      p.setProperty('total', String(Number(p.getProperty('total') || 0) + 1));
      return ContentService.createTextOutput(JSON.stringify({ hits, total: p.getProperty('total') })); };`);
  assert.deepEqual(env.doPost({}).json, { hits: 1, total: '1' });
  assert.deepEqual(env.doPost({}).json, { hits: 1, total: '2' });
});

test('env helpers, parseCsv, HtmlService files', () => {
  const env = mk();
  env.load(`function make() { const ss = SpreadsheetApp.create('Orders'); ss.getSheets()[0].setName('Data').appendRow(['a', 1]).appendRow(['b', 2]); return ss.getId(); }`);
  env.load('<p>page</p>', 'Index.html');
  env.load(`function page() { return HtmlService.createHtmlOutputFromFile('Index').getContent(); }`, 'Page.gs');
  const id = env.call('make');
  assert.equal(env.findSpreadsheetByName('Orders').getId(), id);
  assert.equal(env.findSpreadsheetByName('Nope'), null);
  assert.deepEqual(env.sheetValues(id, 'Data'), [['a', 1], ['b', 2]]);
  assert.equal(env.call('page'), '<p>page</p>');
  assert.deepEqual(env.toHost(env.globals.Utilities.parseCsv('a,"b,c"\r\n"say ""hi""",2\n')), [['a', 'b,c'], ['say "hi"', '2']]);
  assert.deepEqual(env.toHost(env.globals.Utilities.parseCsv('x;y', ';')), [['x', 'y']]);
});

// ---- runner
let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}\n      ${String(err?.stack || err).split('\n').slice(0, 6).join('\n      ')}`);
  }
}
console.log(`\n${tests.length - failed} passed, ${failed} failed (${tests.length} tests)`);
process.exit(failed ? 1 : 0);
