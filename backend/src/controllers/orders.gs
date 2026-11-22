/**
 * Salesperson order actions: create, get, update, cancel, list mine.
 */

function create_(req) {
  var o = cleanOrder_(req.order);
  o.phone = req.phone;                    // always the logged-in salesperson
  return withLock_(function () {
    checkOrderRules_(o, null, null);
    var sh = sheet_();
    var code = newCode_(sh);
    var now = stamp_();
    var row = toRow_(code, 'Baru', now, now, o);
    var r = sh.getLastRow() + 1;
    // Text format first, so phone keeps its leading 0 and dates stay as yyyy-mm-dd.
    sh.getRange(r, 1, 1, 11).setNumberFormat('@');
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    var order = fromRow_(r, row);
    syncInvoice_(order, null);
    log_(req.sp, 'Order baru', code, o.total + ' biji · ' + o.date);
    return { ok: true, order: order };
  });
}

function get_(req) {
  var found = find_(req.code);
  if (normPhone_(found.order.phone) !== req.phone) throw new Error('Order ini bukan milik anda.');
  return { ok: true, order: found.order };
}

function update_(req) {
  var o = cleanOrder_(req.order);
  o.phone = req.phone;
  return withLock_(function () {
    var found = find_(req.code);
    if (normPhone_(found.order.phone) !== req.phone) throw new Error('Order ini bukan milik anda.');
    notLocked_(found.order, 'diubah');
    checkOrderRules_(o, found.order, found.order.code);
    var row = toRow_(found.order.code, 'Dikemaskini', found.order.createdAt, stamp_(), o);
    found.sheet.getRange(found.row, 1, 1, row.length).setValues([row]);
    var order = fromRow_(found.row, row);
    syncInvoice_(order, null);
    log_(req.sp, 'Edit order', order.code, o.total + ' biji · ' + o.date);
    return { ok: true, order: order };
  });
}

function cancel_(req) {
  return withLock_(function () {
    var found = find_(req.code);
    if (normPhone_(found.order.phone) !== req.phone) throw new Error('Order ini bukan milik anda.');
    notLocked_(found.order, 'dibatalkan');
    if (found.order.status === 'Dibatalkan') return { ok: true, order: found.order };
    found.sheet.getRange(found.row, 2, 1, 3).setValues([['Dibatalkan', found.order.createdAt, stamp_()]]);
    found.order.status = 'Dibatalkan';
    syncInvoice_(found.order, null);
    log_(req.sp, 'Batal order', found.order.code, '');
    return { ok: true, order: found.order };
  });
}

// Once HQ starts baking, the salesperson can no longer change or cancel the order (admin still can).
var LOCKED_STATUSES = ['Dibakar', 'Siap', 'Selesai'];
function notLocked_(order, what) {
  if (LOCKED_STATUSES.indexOf(order.status) >= 0) throw new Error('Order ' + order.code + ' dah ' + order.status.toLowerCase() + ' dan tak boleh ' + what + '. Hubungi HQ.');
}

// All orders placed with this phone number (for the agent's own history and profit tracking).
function myOrders_(req) {
  var phone = normPhone_(req.phone);
  if (phone.length < 9 || phone.length > 12) throw new Error('Nombor telefon tidak sah.');
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true, orders: [] };
  var values = sh.getRange(2, 1, n, headerRow_().length).getDisplayValues();
  var orders = [];
  values.forEach(function (r, i) {
    if (r[0] && normPhone_(r[5]) === phone) orders.push(fromRow_(i + 2, r));
  });
  ensureInvoices_(orders);
  return { ok: true, orders: orders,
           invoices: invoices_().filter(function (v) { return v.phone === phone; }),
           hqPayments: hqPays_().filter(function (y) { return y.phone === phone; }),
           settings: publicSettings_().settings };
}

// Flavours out of stock, earliest date and daily capacity are enforced here, not only in the form.
function checkOrderRules_(o, prev, code) {
  var s = settings_(), prevItems = prev ? prev.items : {};
  var bad = FLAVOURS.filter(function (f) { return s.unavailable.indexOf(f.id) >= 0 && (o.items[f.id] || 0) > (prevItems[f.id] || 0); });
  if (bad.length) throw new Error(bad.map(function (f) { return f.name; }).join(', ') + ' sedang habis. Sila buang dari order.');
  if (!prev || prev.date !== o.date) {
    var e = earliest_(s); if (o.date < e) throw new Error('Order ditutup untuk tarikh ini. Tarikh terawal: ' + e + '.');
  }
  if (s.capacity) {
    var used = loadByDate_(code)[o.date] || 0;
    if (used + o.total > s.capacity) throw new Error('Kapasiti ' + o.date + ' penuh. Baki: ' + Math.max(0, s.capacity - used) + ' biji.');
  }
}
