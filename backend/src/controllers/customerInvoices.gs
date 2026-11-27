/**
 * Customer invoices a salesperson issues to their own customers (InvoisPelanggan tab).
 *
 * The salesperson picks products from the stock they ordered from HQ and sets their own price.
 * The sale lines that take the stock out are saved by the app in the Jualan tab (tagged with the invoice no),
 * this tab keeps the invoice document itself so it can be reprinted or resent.
 */

var CI_H = ['No', 'Telefon', 'Tarikh', 'Pelanggan', 'Jumlah (RM)', 'Status', 'Dikemaskini', 'Data'];
var CI_STATUSES = ['Belum bayar', 'Dibayar', 'Batal'];

function ciObj_(r) {
  var d = parse_(r[7]);
  d.no = r[0]; d.date = r[2]; d.total = Number(r[4]) || 0; d.status = r[5] || 'Belum bayar'; d.updatedAt = r[6];
  return d;
}

function ciClean_(d) {
  d = d || {};
  var s = function (v, n) { return String(v === undefined || v === null ? '' : v).trim().slice(0, n || 200); };
  var bill = d.bill || {};
  var items = (d.items || []).map(function (it) {
    return { fid: s(it.fid, 40), name: s(it.name, 80), desc: s(it.desc, 120), qty: Math.max(0, Math.round(Number(it.qty) || 0)), rate: r2_(it.rate) };
  }).filter(function (it) { return it.qty > 0; });
  if (!items.length) throw new Error('Tambah sekurang-kurangnya satu produk.');
  if (!s(bill.name)) throw new Error('Sila isi nama pelanggan.');
  var sub = r2_(items.reduce(function (a, it) { return a + it.qty * it.rate; }, 0));
  var disc = Math.min(sub, Math.max(0, r2_(d.discount)));
  var bank = d.bank || {};
  return {
    bill: { name: s(bill.name, 100), addr: s(bill.addr, 300), email: s(bill.email, 100), phone: s(bill.phone, 30) },
    date: isoDate_(d.date), terms: Math.max(0, Math.min(120, Math.round(Number(d.terms) || 0))), due: isoDate_(d.due || d.date),
    items: items, sub: sub, discount: disc, total: r2_(sub - disc), note: s(d.note, 400),
    seller: { name: s((d.seller || {}).name, 100), phone: s((d.seller || {}).phone, 30) },
    bank: { name: s(bank.name, 100), bank: s(bank.bank, 60), acc: s(bank.acc, 40) },
    alloc: d.alloc || {}
  };
}

function spInvoices_(req) {
  var phone = agentPhone_(req.phone);
  var list = table_('InvoisPelanggan', CI_H).rows.filter(function (r) { return r[0] && normPhone_(r[1]) === phone; }).map(ciObj_);
  return { ok: true, invoices: list.reverse() };
}

function spSaveInvoice_(req) {
  var phone = agentPhone_(req.phone), d = ciClean_(req.data);
  return withLock_(function () {
    var t = table_('InvoisPelanggan', CI_H), no = String(req.no || ''), i = no ? findRow_(t, 0, no) : -1;
    if (no) {
      if (i < 0 || normPhone_(t.rows[i][1]) !== phone) throw new Error('Invois tidak dijumpai.');
      if (t.rows[i][5] === 'Batal') throw new Error('Invois yang dibatalkan tidak boleh diubah.');
      var row = [no, phone, d.date, d.bill.name, String(d.total), t.rows[i][5] || 'Belum bayar', stamp_(), json64_(d)];
      t.sh.getRange(i + 2, 1, 1, CI_H.length).setNumberFormat('@').setValues([row]);
      log_(req.sp, 'Kemaskini invois pelanggan', no, d.bill.name + ' · RM' + d.total);
      return { ok: true, invoice: ciObj_(row) };
    }
    no = nextNo_('LAST_CINV_NO', 'NGAP-');
    var nrow = [no, phone, d.date, d.bill.name, String(d.total), 'Belum bayar', stamp_(), json64_(d)];
    appendRow_(t, CI_H, nrow);
    log_(req.sp, 'Invois pelanggan baru', no, d.bill.name + ' · RM' + d.total);
    return { ok: true, invoice: ciObj_(nrow) };
  });
}

function spSetInvoiceStatus_(req) {
  var phone = agentPhone_(req.phone), st = String(req.status || '');
  if (CI_STATUSES.indexOf(st) < 0) throw new Error('Status tidak sah.');
  return withLock_(function () {
    var t = table_('InvoisPelanggan', CI_H), i = findRow_(t, 0, String(req.no || ''));
    if (i < 0 || normPhone_(t.rows[i][1]) !== phone) throw new Error('Invois tidak dijumpai.');
    if (t.rows[i][5] === 'Batal') throw new Error('Invois ini sudah dibatalkan.');
    setCells_(t, i, 6, [st, stamp_()]);
    log_(req.sp, 'Status invois pelanggan', req.no, st);
    return { ok: true, invoice: ciObj_(t.rows[i]) };
  });
}
