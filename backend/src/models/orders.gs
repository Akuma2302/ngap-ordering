/**
 * Orders tab: row <-> object mapping, order codes, validation.
 */

// Sequential codes: SC-0001, SC-0002, ... The counter lives in Script Properties,
// so a deleted order's number is never reused.
function newCode_(sh) {
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('LAST_ORDER_NO')) || 0;
  var n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, 1).getDisplayValues().forEach(function (r) {
    var m = /^SC-(\d+)$/.exec(r[0]);
    if (m) last = Math.max(last, Number(m[1]));
  });
  last++;
  props.setProperty('LAST_ORDER_NO', String(last));
  return fmtCode_(last);
}

function fmtCode_(num) {
  var s = String(num);
  while (s.length < 4) s = '0' + s;
  return 'SC-' + s;
}

// Accepts "1", "#1", "sc-1", "SC-0001" -> "SC-0001".
function normCode_(c) {
  c = String(c || '').trim().toUpperCase().replace(/^#/, '').replace(/^SC-?/, '');
  if (/^\d+$/.test(c)) return fmtCode_(Number(c));
  return c ? 'SC-' + c : '';
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

function find_(code) {
  code = normCode_(code);
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n > 0 && code) {
    var values = sh.getRange(2, 1, n, headerRow_().length).getDisplayValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === code) return { sheet: sh, row: i + 2, order: fromRow_(i + 2, values[i]) };
    }
  }
  throw new Error('Order ' + code + ' tidak dijumpai. Semak kod order.');
}
