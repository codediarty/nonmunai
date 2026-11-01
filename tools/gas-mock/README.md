# gas-mock

A Google Apps Script (V8 runtime) emulator for Node.js 22. It runs a web-app backend
(`Code.gs`, plain JS, no imports) locally, with no network and no dependencies (Node built-ins only).

```js
import { createGasEnv } from './tools/gas-mock/index.mjs';
import fs from 'node:fs';

const env = createGasEnv({
  now: new Date('2026-11-01T09:00:00+09:00'), // fake clock start (default: real now)
  timeZone: 'Asia/Seoul',                     // script time zone (default 'Asia/Seoul')
  ownerEmail: 'owner@example.com',
  mailQuota: 100,                             // recipients per rolling day (fake clock)
  fetchHandler: (url, params) => ({ code: 200, body: '{}', headers: {} }),
  webAppUrl: 'https://script.google.com/macros/s/MOCK/exec',
});
env.load(fs.readFileSync('backend/Code.gs', 'utf8'), 'Code.gs');
env.call('setup');
const res = env.doPost({ action: 'ping' });   // { raw, text, json, mimeType, contentType }
```

Self-tests: `node tools/gas-mock/test.mjs` (prints PASS/FAIL, exit code 1 on failure).

## Options

| option | default | meaning |
| --- | --- | --- |
| `now` | real time | start of the fake clock (Date, ms or ISO string) |
| `timeZone` | `'Asia/Seoul'` | `Session.getScriptTimeZone()`, new spreadsheets, triggers, sandbox local time |
| `ownerEmail` / `activeUserEmail` | `owner@example.com` / ownerEmail | `Session.getEffectiveUser()` / `getActiveUser()` |
| `mailQuota` | `100` | daily recipient quota for MailApp |
| `fetchHandler(url, params)` | none | answers UrlFetchApp; must return `{ code, body, headers }` synchronously. `params` is normalized (`method` lowercase, `headers`, `contentType`, `payload` as a string or Buffer) |
| `webAppUrl`, `scriptId`, `locale` | mock values | `ScriptApp.getService().getUrl()`, `getScriptId()`, `Session.getActiveUserLocale()` |
| `verbose` | `false` | also print Logger/console output to stdout |
| `isolateExecutions` | `false` | every `call`/`doGet`/`doPost`/trigger gets a fresh global scope with all files re-run (like a new GAS execution); service state is kept |
| `patchProcessTz` | `true` | set `process.env.TZ` to the script time zone while script code runs |

## env API

- `env.load(code, filename = 'Code.gs')`: runs a file in the shared sandbox. Files share one global
  scope like project files: function declarations and top-level `const`/`let` of earlier files are
  visible to later ones (each file runs once, immediately, in load order). A `*.html` filename stores
  the text for `HtmlService.createHtmlOutputFromFile(name)` instead.
- `env.call(name, ...args)`: calls a global function (declared or top-level `const fn = () => {}`).
  Plain arrays/objects returned are deep-copied into the host realm (Dates become plain host Dates)
  so `assert.deepStrictEqual` works; GAS objects are returned as-is. Script errors propagate.
- `env.doPost(body, { parameter, contentType })`: `body` object is JSON-stringified, string is sent
  as-is. Builds `e = { postData: { contents, type, length, name }, parameter, parameters, queryString,
  contextPath, contentLength }`; a form-urlencoded body is also merged into `e.parameter(s)`.
  Returns `{ raw, text, json, mimeType, contentType }` (`json` is `null` when the text is not JSON).
- `env.doGet(params)`: same shape; array values become repeated parameters.
- `env.clock.now() / set(date) / advance(ms)`: fake time used by `new Date()`, `Date.now()`,
  CacheService TTL, mail quota window, triggers. `Utilities.sleep(ms)` advances it.
- `env.runTriggers()`: runs each due time-based trigger once and returns the handler names. If any
  handler throws, the others still run and an Error with `.errors` and `.ran` is thrown at the end.
- `env.restart()`: fresh global scope, files re-run, state kept.
- `env.lockBusy = true`: `tryLock()` returns false and `waitLock()` throws a lock timeout.
- `env.state`: `{ spreadsheets, drive: { files, folders, rootId }, mails, mailQuota, properties,
  cache, triggers, fetches, logs }` (plain Maps/arrays). `properties` and `cache` map a scope
  (`'script'`, `'user'`, `'document'`) to a Map.
- `env.sheetValues(spreadsheetId, sheetName)`: 2D array of the used area (host realm).
- `env.findSpreadsheetByName(name)`: Spreadsheet object or `null`.
- `env.globals`: the service objects (use from tests directly); `env.toHost(value)` copies sandbox values.

## What is emulated

SpreadsheetApp (Spreadsheet, Sheet, Range incl. A1 notation and GAS dimension errors), DriveApp
(Folder, File, iterators, trash, sharing record), Blob and `Utilities` (base64, digests, HMAC,
`formatDate`, `parseCsv`, `getUuid`, `sleep`, `newBlob`), MailApp (plus `GmailApp.sendEmail`),
CacheService, LockService, PropertiesService, ContentService, HtmlService (basic HtmlOutput),
ScriptApp (time-based triggers), UrlFetchApp, Session, Logger and console. Any other method, and
services such as CalendarApp or DocumentApp, throw `Not implemented in gas-mock: X.method`.

Byte arrays are Java-style signed bytes (`-128..127`), so byte 255 is `-1`, as in real GAS.

## Intentional simplifications

- Cell values are stored as written: no formulas, no string-to-number/date coercion, number formats
  are ignored. `getDisplayValues()` uses `String(n)`, `TRUE`/`FALSE`, and `yyyy-MM-dd[ HH:mm:ss]`.
- Sheets grow when written past their size (real GAS throws for `getRange` beyond the grid).
  `insertSheet()` appends at the end; formatting methods are no-ops returning `this`.
- `getActiveSpreadsheet()` returns `null` (standalone web app). Spreadsheet files appear in Drive
  with the Google Sheets MIME type but have no blob.
- `Utilities.formatDate` supports the common SimpleDateFormat letters (`y M d H h k K m s S a E u D Z X`)
  with English names; other letters throw. `parseDate`, `formatString`, `zip`, RSA are not emulated.
- CacheService coerces numbers/booleans to strings (objects throw); TTL is clamped to 1..21600 s.
  No eviction or item-count limits. Properties enforce the 9 KB value and 500 KB store limits.
- Locks never block (single thread). Mail is only recorded; address validation is a simple regex.
- Triggers: `runTriggers()` runs a due trigger once even if several periods were missed;
  `nearMinute` is exact; daily/weekly triggers without `atHour` use the creation hour.
  Only time-based triggers exist (no `forSpreadsheet`, `onEdit`, etc.).
- UrlFetchApp payload objects are form-encoded (no multipart for blobs); the handler sees the
  request after GAS-style normalization. Responses with code >= 400 throw unless muted.
- Script errors cross realms: inside scripts `e instanceof Error` works, but in host tests check
  `err.message` (or use `assert.throws(fn, /regex/)`) rather than `instanceof Error`.
- `patchProcessTz` changes `process.env.TZ` only while script code runs and restores it after.
