/**
 * Admin (HQ / director) actions.
 */

function adminSalespersons_(req) {
  checkAdmin_(req.password);
  return { ok: true, salespersons: spTable_().rows.filter(function (r) { return r[0]; }).map(spObj_) };
}

function adminSaveSalesperson_(req) {
  checkAdmin_(req.password);
  return withLock_(function () {
    var t = spTable_(), name = String(req.name || '').trim().slice(0, 80);
    var phone = req.phone ? agentPhone_(req.phone) : '', status = req.status === 'Tidak aktif' ? 'Tidak aktif' : 'Aktif';
    if (req.code) {
      var r = spRow_(req.code), row = r.t.rows[r.i];
      r.t.sh.getRange(r.i + 2, 2, 1, 3).setNumberFormat('@').setValues([[name || row[1], phone || row[2], status]]);
      if (status !== 'Aktif') r.t.sh.getRange(r.i + 2, 8).setValue('');       // deactivated: end their session
      log_('Admin', 'Edit salesperson', row[0], (name || row[1]) + ' · ' + status);
      return { ok: true };
    }
    if (!name) throw new Error('Sila isi nama salesperson.');
    var base = 'sales' + name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(String).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join('');
    var taken = t.rows.map(function (x) { return String(x[0]).toLowerCase(); }), code = base, n = 2;
    while (taken.indexOf(code.toLowerCase()) >= 0) code = base + (n++);
    var nr = t.sh.getLastRow() + 1;
    t.sh.getRange(nr, 1, 1, SP_H.length).setNumberFormat('@').setValues([[code, name, phone, 'Aktif', stamp_(), '', '', '']]);
    log_('Admin', 'Tambah salesperson', code, name);
    return { ok: true, code: code };
  });
}

function adminResetPin_(req) {
  checkAdmin_(req.password);
  return withLock_(function () {
    var r = spRow_(req.code);
    r.t.sh.getRange(r.i + 2, 7, 1, 2).setValues([['', '']]);
    log_('Admin', 'Reset PIN', r.sp.code, '');
    return { ok: true };
  });
}

function adminTree_(req) {
  checkAdmin_(req.password);
  var sales = {};
  table_('JualanAgent', JA_H).rows.forEach(function (r) { if (r[0]) sales[r[0]] = parse_(r[3]); });
  var spSales = {};
  table_('Jualan', ['Kod Order', 'Telefon', 'Dikemaskini', 'Data']).rows.forEach(function (r) { if (r[0]) spSales[r[0]] = parse_(r[3]); });
  return { ok: true, spSales: spSales,
    agents: table_('Agents', AG_H).rows.filter(function (r) { return r[0]; }).map(agentObj_),
    dists: table_('Agihan', DS_H).rows.filter(function (r) { return r[0]; }).map(distObj_),
    payments: table_('Bayaran', PY_H).rows.filter(function (r) { return r[0]; }).map(payObj_),
    sales: sales };
}

function adminAddHQPayment_(req) {
  checkAdmin_(req.password);
  var phone = req.sp ? spRow_(req.sp).sp.phone : agentPhone_(req.phone), amt = Math.round((Number(req.amount) || 0) * 100) / 100;
  if (!phone) throw new Error('Salesperson ini belum ada nombor telefon.');
  if (amt <= 0) throw new Error('Sila isi jumlah bayaran.');
  return withLock_(function () {
    var t = table_('BayaranHQ', HP_H), id = nextNo_('LAST_HQPAY_NO', 'HP-');
    var row = [id, phone, String(req.date || Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')), String(amt), String(req.note || '').slice(0, 200), stamp_()];
    var r = t.sh.getLastRow() + 1; t.sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
    log_('Admin', 'Bayaran HQ', id, (req.sp || phone) + ' · RM' + amt.toFixed(2));
    return { ok: true };
  });
}

function adminDeleteHQPayment_(req) {
  checkAdmin_(req.password);
  return withLock_(function () {
    var t = table_('BayaranHQ', HP_H), i = findRow_(t, 0, req.id); if (i < 0) throw new Error('Bayaran tidak dijumpai.');
    log_('Admin', 'Padam bayaran HQ', req.id, t.rows[i][1] + ' · RM' + t.rows[i][3]);
    t.sh.deleteRow(i + 2); return { ok: true };
  });
}

function adminLog_(req) {
  checkAdmin_(req.password);
  var t = table_('Log', LG_H);
  return { ok: true, log: t.rows.slice(-400).reverse().map(function (r) { return { at: r[0], who: r[1], action: r[2], ref: r[3], detail: r[4] }; }) };
}

function adminList_(req) {
  checkAdmin_(req.password);
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  var orders = n < 1 ? [] : sh.getRange(2, 1, n, headerRow_().length).getDisplayValues().map(function (r, i) { return fromRow_(i + 2, r); })
                     .filter(function (o) { return o.code; });
  ensureInvoices_(orders);
  return { ok: true, orders: orders, invoices: invoices_(), hqPayments: hqPays_(), settings: adminGetSettings_(req).settings };
}

function adminSetStatus_(req) {
  checkAdmin_(req.password);
  if (STATUSES.indexOf(req.status) < 0) throw new Error('Status tidak sah.');
  return withLock_(function () {
    var found = find_(req.code);
    var prev = found.order.status;
    found.sheet.getRange(found.row, 2, 1, 3).setValues([[req.status, found.order.createdAt, stamp_()]]);
    found.order.status = req.status;
    syncInvoice_(found.order, null);
    log_('Admin', 'Status order', found.order.code, prev + ' → ' + req.status);
    return { ok: true, order: found.order };
  });
}

function adminDelete_(req) {
  checkAdmin_(req.password);
  return withLock_(function () {
    var found = find_(req.code);
    found.sheet.deleteRow(found.row);
    var t = table_('Invois', IV_H), i = findRow_(t, 0, found.order.code); if (i >= 0) t.sh.deleteRow(i + 2);
    log_('Admin', 'Padam order', found.order.code, found.order.name + ' · ' + found.order.total + ' biji');
    return { ok: true, code: found.order.code };
  });
}
