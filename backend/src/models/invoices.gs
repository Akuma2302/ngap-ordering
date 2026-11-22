/**
 * Invois tab (HQ price snapshot per order) and BayaranHQ tab (salesperson -> HQ payments).
 */

var IV_H = ['Kod Order', 'Telefon', 'Tarikh', 'Status', 'Jumlah Biji', 'Jumlah (RM)', 'Dikemaskini', 'Data'];

var HP_H = ['ID', 'Telefon', 'Tarikh', 'Jumlah (RM)', 'Nota', 'Dicipta'];

function invObj_(r) { var d = parse_(r[7]); return { code: r[0], phone: r[1], date: r[2], status: r[3], total: Number(r[4]) || 0, amount: Number(r[5]) || 0, updatedAt: r[6], prices: d.prices || {}, missing: !!d.missing, disc: Number(d.disc) || 0 }; }

function invoices_() { return table_('Invois', IV_H).rows.filter(function (r) { return r[0]; }).map(invObj_); }

function hqPays_() { return table_('BayaranHQ', HP_H).rows.filter(function (r) { return r[0]; }).map(function (r) { return { id: r[0], phone: r[1], date: r[2], amount: Number(r[3]) || 0, note: r[4], createdAt: r[5] }; }); }

function syncInvoice_(order, t) {
  t = t || table_('Invois', IV_H);
  var s = settings_(), i = findRow_(t, 0, order.code), old = i >= 0 ? parse_(t.rows[i][7]) : {}, prices = {}, amount = 0, missing = false;
  FLAVOURS.forEach(function (f) {
    var q = order.items[f.id] || 0; if (!q) return;
    var keep = old.prices && old.prices[f.id] !== undefined && old.prices[f.id] !== null;   // price is locked once the order has one
    var p = keep ? old.prices[f.id] : priceIn_(s.hqPrice, f.id);
    if (p === null) missing = true;
    prices[f.id] = p; amount += q * (p || 0);
  });
  var disc = Math.min(Number(old.disc) || 0, amount);              // HQ-approved discount (Permintaan)
  amount -= disc;
  if (order.status === 'Dibatalkan') amount = 0;
  var row = [order.code, normPhone_(order.phone), order.date, order.status, String(order.total), String(Math.round(amount * 100) / 100), stamp_(), json64_({ prices: prices, missing: missing, disc: disc })];
  if (i >= 0) { t.sh.getRange(i + 2, 1, 1, row.length).setNumberFormat('@').setValues([row]); t.rows[i] = row; }
  else { var r = t.sh.getLastRow() + 1; t.sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]); t.rows.push(row); }
}

function ensureInvoices_(orders) {
  var t = table_('Invois', IV_H), s = settings_(), priced = s.hqPrice.def !== '' || Object.keys(s.hqPrice.items || {}).length;
  orders.forEach(function (o) {
    var i = findRow_(t, 0, o.code), d = i >= 0 ? parse_(t.rows[i][7]) : null;
    // create missing invoices, fill prices that were not set yet, and follow status changes
    if (i < 0 || t.rows[i][3] !== o.status || (d.missing && priced)) syncInvoice_(o, t);
  });
}

// Approved discount on one invoice (replaces any earlier discount). Call inside withLock_.
function setInvoiceDisc_(code, disc) {
  var t = table_('Invois', IV_H), i = findRow_(t, 0, code); if (i < 0) throw new Error('Invois ' + code + ' tidak dijumpai.');
  var d = parse_(t.rows[i][7]); d.disc = Math.max(0, Math.round((Number(disc) || 0) * 100) / 100);
  t.sh.getRange(i + 2, 8).setNumberFormat('@').setValue(json64_(d)); t.rows[i][7] = json64_(d);
  syncInvoice_(find_(code).order, t);
}
