/**
 * Low-level Google Sheets helpers shared by every model.
 */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  var headers = headerRow_();
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#7A1E2C').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  // Store everything up to "Nota" as plain text so dates/phones are not reformatted.
  sh.getRange(2, 1, sh.getMaxRows() - 1, 11).setNumberFormat('@');
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PASSWORD')) props.setProperty('ADMIN_PASSWORD', 'tukar-saya');
  Logger.log('Setup siap. Tukar ADMIN_PASSWORD di Project Settings → Script properties.');
}

function headerRow_() {
  return BASE_HEADERS.concat(FLAVOURS.map(function (f) { return f.name; }));
}

// Sheet "AgentData": Telefon | Dikemaskini | Data (JSON: prices, target)
// Sheet "Jualan":    Kod Order | Telefon | Dikemaskini | Data (JSON: items with cost + sales lines, extra costs)
function dataSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#7A1E2C').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, sh.getMaxRows() - 1, headers.length).setNumberFormat('@');
  }
  return sh;
}

function agentPhone_(p) {
  var phone = normPhone_(p);
  if (phone.length < 9 || phone.length > 12) throw new Error('Nombor telefon tidak sah.');
  return phone;
}

function json64_(v) {
  var s = JSON.stringify(v || {});
  if (s.length > 45000) throw new Error('Data terlalu besar untuk disimpan.');
  return s;
}

function upsert_(sh, keyCol, key, row) {
  var n = sh.getLastRow() - 1;
  if (n > 0) {
    var keys = sh.getRange(2, keyCol, n, 1).getDisplayValues();
    for (var i = 0; i < keys.length; i++) if (keys[i][0] === key) { sh.getRange(i + 2, 1, 1, row.length).setValues([row]); return; }
  }
  var r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
}

function table_(name, H) {
  var sh = dataSheet_(name, H), n = sh.getLastRow() - 1;
  return { sh: sh, rows: n > 0 ? sh.getRange(2, 1, n, H.length).getDisplayValues() : [] };
}

function parse_(s) { try { return JSON.parse(s); } catch (e) { return {}; } }

function nextNo_(prop, prefix) {
  var props = PropertiesService.getScriptProperties(), n = (Number(props.getProperty(prop)) || 0) + 1;
  props.setProperty(prop, String(n));
  var s = String(n); while (s.length < 4) s = '0' + s;
  return prefix + s;
}

function findCodeRow_(t, code) {
  var key = String(code || '').trim().toLowerCase();
  for (var i = 0; i < t.rows.length; i++) if (String(t.rows[i][0]).toLowerCase() === key) return i;
  return -1;
}

function findRow_(t, col, key) { for (var i = 0; i < t.rows.length; i++) if (t.rows[i][col] === key) return i; return -1; }

function sheet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh) { setup(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME); }
  return sh;
}

function stamp_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
}

function normPhone_(p) {
  var d = String(p || '').replace(/\D/g, '');
  if (d.indexOf('60') === 0) d = d.slice(1);   // 60123456789 -> 0123456789
  if (d && d.charAt(0) !== '0') d = '0' + d;
  return d;
}
