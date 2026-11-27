/**
 * LIBRARY ENGAGE - central database (Google Sheet + Apps Script)
 * ---------------------------------------------------------------
 * Version 2 (November 2026) - adds privacy and evaluation support.
 *
 * What this does
 *   - Records every attempt from every device, once (duplicates are ignored).
 *   - Records optional evaluation responses (knowledge check before/after,
 *     System Usability Scale, per-challenge feedback) in an "Evaluation" tab.
 *   - The public page can read ONLY the leaderboard: a SHORTENED name (or
 *     "Anonymous participant" if the participant chose that), department,
 *     challenge and score. Full names and roll numbers are never sent to
 *     the public.
 *   - Full records (with roll numbers) and evaluation data are released ONLY
 *     to the Admin screen, and only when the correct ADMIN_KEY is supplied.
 *     The key is stored here in Script Properties, never in the web page.
 *
 * Upgrading from version 1 (existing "Participation" tab)
 *   Paste this whole file over the old one, Save, then
 *   Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.
 *   The Web app URL does not change. Existing rows are kept; two new columns
 *   (Hide Name, Consent At) are added to the header row automatically.
 *
 * First-time setup (about 5 minutes)
 *   1. Create a NEW Google Sheet (keep it private - do not share it publicly).
 *   2. Extensions > Apps Script. Delete the sample code, paste this file, Save.
 *   3. Project Settings (gear icon) > Script properties > Add script property:
 *        Property: ADMIN_KEY      Value: (a strong password of your choice)
 *   4. Deploy > New deployment > type "Web app".
 *        Execute as: Me            Who has access: Anyone
 *      Authorise when asked, then copy the Web app URL (ends with /exec).
 *   5. In index.html set  sheetEndpoint: 'PASTE-THE-URL-HERE'  in CONFIG.
 */

var SHEET_NAME = 'Participation';
var HEADERS = ['Received At', 'Attempt Time', 'Attempt ID', 'Name', 'Roll Number', 'Department', 'Category',
               'Game ID', 'Game', 'Score', 'Total Questions', 'Percentage', 'Seconds', 'Certificate ID',
               'Hide Name', 'Consent At'];
var COL = { RECEIVED:1, TS:2, UID:3, NAME:4, ROLL:5, DEPT:6, CAT:7, GAMEID:8, GAME:9, SCORE:10, TOTAL:11, PCT:12, SECS:13, CERT:14,
            HIDE:15, CONSENT:16 };

var EVAL_SHEET = 'Evaluation';
var EVAL_HEADERS = ['Received At', 'Response Time', 'Response ID', 'Name', 'Roll Number', 'Department', 'Category',
                    'Instrument', 'Game ID', 'Score', 'Out Of', 'Item Responses', 'Comment'];
var EV = { RECEIVED:1, TS:2, UID:3, NAME:4, ROLL:5, DEPT:6, CAT:7, TYPE:8, GAMEID:9, SCORE:10, TOTAL:11, ANSWERS:12, COMMENT:13 };
var EVAL_TYPES = ['pre', 'post', 'sus', 'feedback'];

var MAX_FAILED_LOGINS = 10;      // then admin login is paused for 10 minutes
var LEADERBOARD_NAMES = 'short'; // 'full', 'short' (first name + initial) or 'initials' - keep in step with index.html

function prepareSheet_(name, headers, textCols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  } else {
    // upgrade an older header row in place (new columns are only ever added at the end)
    var have = sh.getLastColumn();
    if (have < headers.length) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  // Store text columns as plain text so nothing typed by a participant can act as a formula.
  textCols.forEach(function (c) { sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'); });
  return sh;
}
function getSheet_() {
  return prepareSheet_(SHEET_NAME, HEADERS, [COL.TS, COL.UID, COL.NAME, COL.ROLL, COL.DEPT, COL.CAT, COL.GAMEID, COL.GAME, COL.CERT, COL.HIDE, COL.CONSENT]);
}
function getEvalSheet_() {
  return prepareSheet_(EVAL_SHEET, EVAL_HEADERS, [EV.TS, EV.UID, EV.NAME, EV.ROLL, EV.DEPT, EV.CAT, EV.TYPE, EV.GAMEID, EV.ANSWERS, EV.COMMENT]);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function clean_(v, max) {
  return String(v === null || v === undefined ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 120);
}
function num_(v, lo, hi) {
  var n = Number(v);
  if (v === '' || v === null || v === undefined || isNaN(n)) return null;
  n = Math.round(n * 100) / 100;
  return (n < lo || n > hi) ? null : n;
}
function hash_(s) {
  // salted with the private admin key so roll numbers cannot be guessed back from the public leaderboard
  var salt = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '';
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, salt + '|' + String(s)).map(function (b) {
    return ('0' + (b & 255).toString(16)).slice(-2);
  }).join('').slice(0, 12);
}
function publicName_(name, hide) {
  if (String(hide).toLowerCase() === 'yes' || hide === true) return 'Anonymous participant';
  var parts = String(name || '').trim().split(/\s+/).filter(function (p) { return p; });
  if (!parts.length) return 'Participant';
  if (LEADERBOARD_NAMES === 'full') return parts.join(' ');
  if (LEADERBOARD_NAMES === 'initials') return parts.map(function (p) { return p.charAt(0).toUpperCase() + '.'; }).join(' ');
  return parts.length > 1 ? parts[0] + ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.' : parts[0];
}
function readRows_(sh, width) {
  var last = sh.getLastRow();
  return last > 1 ? sh.getRange(2, 1, last - 1, width).getValues() : [];
}

/* ---- admin password check (with a simple lock-out after repeated failures) ---- */
function checkAdmin_(key) {
  var admin = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('admin_fails') || 0);
  if (fails >= MAX_FAILED_LOGINS) return 'locked';
  if (admin && key && String(key) === admin) { cache.remove('admin_fails'); return 'ok'; }
  cache.put('admin_fails', String(fails + 1), 600);
  return 'bad';
}

/* ---- PUBLIC read: leaderboard only (best score per person per challenge, no full names, no roll numbers) ---- */
function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  if (action !== 'leaderboard') return json_({ ok: true, service: 'Library Engage', version: 2 });
  var best = {};
  readRows_(getSheet_(), HEADERS.length).forEach(function (r) {
    var k = r[COL.ROLL - 1] + '|' + r[COL.GAMEID - 1];
    var pct = Number(r[COL.PCT - 1]) || 0;
    if (!best[k] || pct > best[k].percentage) {
      best[k] = { roll: hash_(r[COL.ROLL - 1]), display_name: publicName_(r[COL.NAME - 1], r[COL.HIDE - 1]),
                  department: r[COL.DEPT - 1], game_id: r[COL.GAMEID - 1], game_title: r[COL.GAME - 1],
                  score: r[COL.SCORE - 1], total_questions: r[COL.TOTAL - 1], percentage: pct,
                  seconds: Number(r[COL.SECS - 1]) || 0, ts: String(r[COL.TS - 1]) };
    }
  });
  var rows = Object.keys(best).map(function (k) { return best[k]; });
  rows.sort(function (a, b) { return b.percentage - a.percentage; });
  return json_({ ok: true, rows: rows.slice(0, 300) });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  if (req.action === 'admin') return adminRead_(req);
  if (req.action === 'eval') return recordEval_(req);
  return record_(req);
}

/* ---- ADMIN read: everything, only with the correct key ---- */
function adminRead_(req) {
  var status = checkAdmin_(req.key);
  if (status === 'locked') return json_({ ok: false, error: 'locked' });
  if (status !== 'ok') return json_({ ok: false, error: 'unauthorized' });
  var rows = readRows_(getSheet_(), HEADERS.length).map(function (r) {
    return { ts: String(r[COL.TS - 1]), name: r[COL.NAME - 1], roll: String(r[COL.ROLL - 1]),
             department: r[COL.DEPT - 1], category: r[COL.CAT - 1], game_id: r[COL.GAMEID - 1],
             game_title: r[COL.GAME - 1], score: r[COL.SCORE - 1], total_questions: r[COL.TOTAL - 1],
             percentage: r[COL.PCT - 1], seconds: r[COL.SECS - 1], certificate_id: String(r[COL.CERT - 1] || ''),
             hide_name: String(r[COL.HIDE - 1] || '') === 'yes' };
  });
  var evals = readRows_(getEvalSheet_(), EVAL_HEADERS.length).map(function (r) {
    return { ts: String(r[EV.TS - 1]), name: r[EV.NAME - 1], roll: String(r[EV.ROLL - 1]), department: r[EV.DEPT - 1],
             category: r[EV.CAT - 1], type: String(r[EV.TYPE - 1]), game_id: String(r[EV.GAMEID - 1] || ''),
             score: r[EV.SCORE - 1], total: r[EV.TOTAL - 1], answers: String(r[EV.ANSWERS - 1] || ''),
             comment: String(r[EV.COMMENT - 1] || '') };
  });
  return json_({ ok: true, rows: rows, evals: evals });
}

function appendUnique_(sh, uidCol, uid, row) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return json_({ ok: false, error: 'busy' }); }
  try {
    var last = sh.getLastRow();
    if (last > 1) {
      var hit = sh.getRange(2, uidCol, last - 1, 1).createTextFinder(uid).matchEntireCell(true).findNext();
      if (hit) return json_({ ok: true, duplicate: true });          // already recorded: safe to drop from the device queue
    }
    sh.appendRow(row);
    SpreadsheetApp.flush();
    return json_({ ok: true });
  } finally { lock.releaseLock(); }
}

/* ---- WRITE: record one attempt (validated, de-duplicated) ---- */
function record_(r) {
  var uid = clean_(r.uid, 160), name = clean_(r.name, 100), roll = clean_(r.roll, 40),
      dept = clean_(r.department, 120), cat = clean_(r.category, 20);
  var total = num_(r.total_questions, 1, 200), score = total === null ? null : num_(r.score, 0, total),
      pct = num_(r.percentage, 0, 100), secs = num_(r.seconds, 0, 86400);
  if (!uid || name.length < 2 || roll.length < 3 || dept.length < 2 || score === null || pct === null || secs === null) {
    return json_({ ok: false, error: 'invalid' });
  }
  var hide = String(r.hide_name).toLowerCase() === 'yes' ? 'yes' : '';
  return appendUnique_(getSheet_(), COL.UID, uid,
    [new Date(), clean_(r.ts, 40), uid, name, roll, dept, cat, clean_(r.game_id, 60), clean_(r.game_title, 120),
     score, total, pct, secs, clean_(r.certificate_id, 60), hide, clean_(r.consent_at, 40)]);
}

/* ---- WRITE: record one evaluation response (validated, de-duplicated) ---- */
function recordEval_(r) {
  var uid = clean_(r.uid, 200), name = clean_(r.name, 100), roll = clean_(r.roll, 40),
      dept = clean_(r.department, 120), cat = clean_(r.category, 20), type = clean_(r.type, 20);
  if (!uid || name.length < 2 || roll.length < 3 || EVAL_TYPES.indexOf(type) < 0) return json_({ ok: false, error: 'invalid' });
  var total = num_(r.total, 1, 100), score = num_(r.score, 0, 100);
  if (score === null || total === null) return json_({ ok: false, error: 'invalid' });
  var answers = clean_(r.answers, 120);
  if (!/^[0-9 ]*$/.test(answers)) return json_({ ok: false, error: 'invalid' });
  return appendUnique_(getEvalSheet_(), EV.UID, uid,
    [new Date(), clean_(r.ts, 40), uid, name, roll, dept, cat, type, clean_(r.game_id, 60), score, total, answers, clean_(r.comment, 300)]);
}
