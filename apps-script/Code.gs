/**
 * @OnlyCurrentDoc
 * Soft Cookies — Ordering backend (Google Apps Script + Google Sheets)
 *
 * Pushed with clasp (see README.md). The "Orders" sheet and a default
 * ADMIN_PASSWORD are created automatically on the first request.
 */

// Keep this list in sync with ordering/config.js (same ids, same order).
var FLAVOURS = [
  { id: 'chocolate-chip',    name: 'Chocolate Chip' },
  { id: 'chochocunk',        name: 'Chochocunk' },
  { id: 'seasalt',           name: 'Seasalt' },
  { id: 'dark-seasalt',      name: 'Dark Seasalt' },
  { id: 'matcha-white',      name: 'Matcha White' },
  { id: 'choco-duo',         name: 'Choco Duo' },
  { id: 'tiramisu',          name: 'Tiramisu' },
  { id: 'dark-choc-chips',   name: 'Dark Choco Chips' },
  { id: 'matcha-strawberry', name: 'Matcha Strawberry' },
  { id: 'smores',            name: "Choco S'mores" },
  { id: 'matcha-smores',     name: "Matcha S'mores" }
];

var SHEET_NAME = 'Orders';
var BASE_HEADERS = ['Kod Order', 'Status', 'Dicipta', 'Dikemaskini', 'Nama Agent', 'Telefon',
                    'Kaedah', 'Tarikh', 'Masa', 'Alamat', 'Nota', 'Jumlah'];
var STATUSES = ['Baru', 'Dikemaskini', 'Dibatalkan', 'Siap', 'Selesai'];
var TZ = 'Asia/Kuala_Lumpur';

/* ---------- one-time setup ---------- */

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

/* ---------- HTTP entry points ---------- */

function doGet() {
  return json_({ ok: true, service: 'soft-cookies-ordering', flavours: FLAVOURS.length });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var handlers = {
      create: create_, get: get_, update: update_, cancel: cancel_,
      adminList: adminList_, adminSetStatus: adminSetStatus_
    };
    var fn = handlers[req.action];
    if (!fn) throw new Error('Tindakan tidak dikenali.');
    return json_(fn(req));
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- agent actions ---------- */

function create_(req) {
  var o = cleanOrder_(req.order);
  return withLock_(function () {
    var sh = sheet_();
    var code = newCode_(sh);
    var now = stamp_();
    var row = toRow_(code, 'Baru', now, now, o);
    var r = sh.getLastRow() + 1;
    // Text format first, so phone keeps its leading 0 and dates stay as yyyy-mm-dd.
    sh.getRange(r, 1, 1, 11).setNumberFormat('@');
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    return { ok: true, order: fromRow_(r, row) };
  });
}

function get_(req) {
  var found = find_(req.code, req.phone);
  return { ok: true, order: found.order };
}

function update_(req) {
  var o = cleanOrder_(req.order);
  return withLock_(function () {
    var found = find_(req.code, req.phone);
    var row = toRow_(found.order.code, 'Dikemaskini', found.order.createdAt, stamp_(), o);
    found.sheet.getRange(found.row, 1, 1, row.length).setValues([row]);
    return { ok: true, order: fromRow_(found.row, row) };
  });
}

function cancel_(req) {
  return withLock_(function () {
    var found = find_(req.code, req.phone);
    found.sheet.getRange(found.row, 2, 1, 3).setValues([['Dibatalkan', found.order.createdAt, stamp_()]]);
    found.order.status = 'Dibatalkan';
    return { ok: true, order: found.order };
  });
}

/* ---------- admin actions ---------- */

function adminList_(req) {
  checkAdmin_(req.password);
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true, orders: [] };
  var values = sh.getRange(2, 1, n, headerRow_().length).getDisplayValues();
  var orders = values.map(function (r, i) { return fromRow_(i + 2, r); })
                     .filter(function (o) { return o.code; });
  return { ok: true, orders: orders };
}

function adminSetStatus_(req) {
  checkAdmin_(req.password);
  if (STATUSES.indexOf(req.status) < 0) throw new Error('Status tidak sah.');
  return withLock_(function () {
    var found = find_(req.code, null);
    found.sheet.getRange(found.row, 2).setValue(req.status);
    found.order.status = req.status;
    return { ok: true, order: found.order };
  });
}

function checkAdmin_(pw) {
  sheet_(); // make sure setup has run (it also creates the default password)
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!real || String(pw || '') !== real) throw new Error('Kata laluan admin salah.');
}

/* ---------- helpers ---------- */

function sheet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh) { setup(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME); }
  return sh;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
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

function newCode_(sh) {
  var abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var n = sh.getLastRow() - 1;
  var existing = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(function (r) { return r[0]; }) : [];
  for (var t = 0; t < 50; t++) {
    var c = 'SC-';
    for (var i = 0; i < 5; i++) c += abc.charAt(Math.floor(Math.random() * abc.length));
    if (existing.indexOf(c) < 0) return c;
  }
  throw new Error('Gagal jana kod order, cuba lagi.');
}

function cleanOrder_(o) {
  o = o || {};
  var name = String(o.name || '').trim();
  var phone = normPhone_(o.phone);
  var method = o.method === 'Hantar' ? 'Hantar' : 'Ambil';
  var date = String(o.date || '').trim();
  if (!name) throw new Error('Sila isi nama agent.');
  if (phone.length < 9 || phone.length > 12) throw new Error('Nombor telefon tidak sah.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Sila pilih tarikh ' + method.toLowerCase() + '.');
  if (method === 'Hantar' && !String(o.address || '').trim()) throw new Error('Sila isi alamat penghantaran.');
  var items = {}, total = 0;
  FLAVOURS.forEach(function (f) {
    var q = Math.max(0, Math.min(9999, Math.floor(Number((o.items || {})[f.id]) || 0)));
    items[f.id] = q; total += q;
  });
  if (total < 1) throw new Error('Sila pilih sekurang-kurangnya 1 cookie.');
  return {
    name: name.slice(0, 80), phone: phone, method: method, date: date,
    time: String(o.time || '').slice(0, 10), address: String(o.address || '').trim().slice(0, 300),
    notes: String(o.notes || '').trim().slice(0, 500), items: items, total: total
  };
}

function toRow_(code, status, created, updated, o) {
  return [code, status, created, updated, o.name, o.phone, o.method, o.date, o.time, o.address, o.notes, o.total]
    .concat(FLAVOURS.map(function (f) { return o.items[f.id] || 0; }));
}

function fromRow_(rowNum, r) {
  var items = {};
  FLAVOURS.forEach(function (f, i) { items[f.id] = Number(r[BASE_HEADERS.length + i]) || 0; });
  return {
    row: rowNum, code: String(r[0]), status: String(r[1]), createdAt: String(r[2]), updatedAt: String(r[3]),
    name: String(r[4]), phone: String(r[5]), method: String(r[6]), date: String(r[7]), time: String(r[8]),
    address: String(r[9]), notes: String(r[10]), total: Number(r[11]) || 0, items: items
  };
}

function find_(code, phone) {
  code = String(code || '').trim().toUpperCase();
  if (code && code.indexOf('SC-') !== 0) code = 'SC-' + code;
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n > 0) {
    var values = sh.getRange(2, 1, n, headerRow_().length).getDisplayValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === code) {
        if (phone !== null && normPhone_(values[i][5]) !== normPhone_(phone)) break;
        return { sheet: sh, row: i + 2, order: fromRow_(i + 2, values[i]) };
      }
    }
  }
  throw new Error('Order tidak dijumpai. Semak kod order dan nombor telefon.');
}
