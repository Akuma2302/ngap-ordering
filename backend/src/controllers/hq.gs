/**
 * HQ back office actions (admin): products, expenses, raw materials, suppliers, purchases,
 * approvals, password, sessions, backup. Plus the salesperson side of requests.
 */

function adminHQ_(req) {
  checkAdmin_(req.password);
  var mv = moves_(), sum = stockSummary_(mv);
  return { ok: true, products: FLAVOURS, materials: materials_(sum), moves: mv.slice(-500).reverse(), suppliers: suppliers_(),
           purchases: purchases_(), expenses: expenses_(), requests: requests_(), expenseCats: EXPENSE_CATS };
}

/* ---------- products ---------- */
function adminSaveProduct_(req) {
  checkAdmin_(req.password);
  return withLock_(function () {
    var list = products_(), x = req.product || {}, name = String(x.name || '').trim().slice(0, 60);
    var img = String(x.img || '').trim();
    if (img && !/^(https:\/\/|img\/)/.test(img)) throw new Error('Gambar mesti link https:// atau fail img/…');
    var recipe = {}; Object.keys(x.recipe || {}).forEach(function (k) { var v = Number(x.recipe[k]); if (v > 0) recipe[k] = q4_(v); });
    var p;
    if (x.id) {
      p = list.filter(function (y) { return y.id === x.id; })[0];
      if (!p) throw new Error('Produk tidak dijumpai.');
      if (name) p.name = name;
      if (x.desc !== undefined) p.desc = String(x.desc).slice(0, 120);
      if (x.img !== undefined) p.img = img;
      if (x.active !== undefined) p.active = !!x.active;
      if (x.recipe !== undefined) p.recipe = recipe;
      log_('Admin', 'Edit produk', p.id, p.name + (p.active ? '' : ' · diarkib'));
    } else {
      if (!name) throw new Error('Sila isi nama produk.');
      if (list.some(function (y) { return y.name.toLowerCase() === name.toLowerCase(); })) throw new Error('Nama produk sudah ada.');
      p = { id: productSlug_(name, list.map(function (y) { return y.id; })), name: name, desc: String(x.desc || '').slice(0, 120), img: img, bg: '', active: true, recipe: recipe };
      list.push(p);
      log_('Admin', 'Tambah produk', p.id, name);
    }
    saveProducts_(list);
    return { ok: true, product: p, products: list };
  });
}

/* ---------- expenses ---------- */
function adminSaveExpense_(req) {
  checkAdmin_(req.password);
  var amt = r2_(req.amount), cat = EXPENSE_CATS.indexOf(req.cat) >= 0 ? req.cat : 'Lain-lain';
  if (amt <= 0) throw new Error('Sila isi jumlah perbelanjaan.');
  return withLock_(function () {
    var t = table_('Perbelanjaan', EX_H), id = nextNo_('LAST_EXP_NO', 'EX-');
    appendRow_(t, EX_H, [id, isoDate_(req.date), cat, String(amt), String(req.note || '').slice(0, 200), String(req.ref || '').slice(0, 60), 'Aktif', stamp_(), 'Admin']);
    log_('Admin', 'Perbelanjaan', id, cat + ' · RM' + amt.toFixed(2));
    return { ok: true, id: id };
  });
}

function adminVoidExpense_(req) {
  checkAdmin_(req.password);
  return withLock_(function () {
    var t = table_('Perbelanjaan', EX_H), i = findRow_(t, 0, req.id);
    if (i < 0) throw new Error('Perbelanjaan tidak dijumpai.');
    if (t.rows[i][6] === 'Dibatalkan') return { ok: true };
    setCells_(t, i, 7, ['Dibatalkan']);
    log_('Admin', 'Batal perbelanjaan', req.id, String(req.reason || '').slice(0, 120));
    return { ok: true };
  });
}

/* ---------- raw materials ---------- */
function adminSaveMaterial_(req) {
  checkAdmin_(req.password);
  return withLock_(function () {
    var t = table_('Bahan', MT_H), x = req.material || {}, name = String(x.name || '').trim().slice(0, 60), unit = String(x.unit || '').trim().slice(0, 12) || 'unit';
    var reorder = Math.max(0, q4_(x.reorder));
    if (x.id) {
      var i = findRow_(t, 0, x.id); if (i < 0) throw new Error('Bahan tidak dijumpai.');
      setCells_(t, i, 2, [name || t.rows[i][1], unit, String(reorder), x.status === 'Tidak aktif' ? 'Tidak aktif' : 'Aktif']);
      log_('Admin', 'Edit bahan', x.id, name);
      return { ok: true };
    }
    if (!name) throw new Error('Sila isi nama bahan.');
    if (t.rows.some(function (r) { return String(r[1]).toLowerCase() === name.toLowerCase(); })) throw new Error('Bahan ini sudah ada.');
    var id = nextNo_('LAST_MAT_NO', 'BH-');
    appendRow_(t, MT_H, [id, name, unit, String(reorder), 'Aktif', stamp_()]);
    log_('Admin', 'Tambah bahan', id, name + ' (' + unit + ')');
    return { ok: true, id: id };
  });
}

// Manual movements: damage / write-off, stock count adjustment. A reason is always required.
function adminStockMove_(req) {
  checkAdmin_(req.password);
  var type = req.type === 'Rosak' ? 'Rosak' : 'Pelarasan', qty = q4_(req.qty), reason = String(req.reason || '').trim();
  if (!reason) throw new Error('Sila tulis sebab pergerakan stok.');
  if (type === 'Rosak') qty = -Math.abs(qty);
  if (!qty) throw new Error('Kuantiti tidak boleh 0.');
  return withLock_(function () {
    var mv = postMoves_([{ mat: req.mat, type: type, qty: qty, cost: null, date: req.date, ref: 'MANUAL', reason: reason }], 'Admin');
    log_('Admin', 'Stok ' + type, mv[0].id, req.mat + ' ' + qty + ' · ' + reason);
    return { ok: true };
  });
}

/* ---------- suppliers + purchases ---------- */
function adminSaveSupplier_(req) {
  checkAdmin_(req.password);
  return withLock_(function () {
    var t = table_('Pembekal', SU_H), x = req.supplier || {}, name = String(x.name || '').trim().slice(0, 80);
    var phone = x.phone ? normPhone_(x.phone) : '';
    if (x.id) {
      var i = findRow_(t, 0, x.id); if (i < 0) throw new Error('Pembekal tidak dijumpai.');
      setCells_(t, i, 2, [name || t.rows[i][1], phone, String(x.note || '').slice(0, 200), x.status === 'Tidak aktif' ? 'Tidak aktif' : 'Aktif']);
      return { ok: true };
    }
    if (!name) throw new Error('Sila isi nama pembekal.');
    var id = nextNo_('LAST_SUP_NO', 'SU-');
    appendRow_(t, SU_H, [id, name, phone, String(x.note || '').slice(0, 200), 'Aktif', stamp_()]);
    log_('Admin', 'Tambah pembekal', id, name);
    return { ok: true, id: id };
  });
}

// lines: [{ mat, qty, cost (RM per unit) }]. Stock goes in at the purchase cost (weighted average).
function adminAddPurchase_(req) {
  checkAdmin_(req.password);
  var lines = (req.lines || []).map(function (l) { return { mat: String(l.mat || ''), qty: q4_(l.qty), cost: q4_(l.cost) }; }).filter(function (l) { return l.mat && l.qty > 0; });
  if (!lines.length) throw new Error('Tambah sekurang-kurangnya satu bahan.');
  if (lines.some(function (l) { return l.cost < 0; })) throw new Error('Harga seunit tidak sah.');
  var total = r2_(lines.reduce(function (a, l) { return a + l.qty * l.cost; }, 0)), date = isoDate_(req.date);
  return withLock_(function () {
    var sups = suppliers_(); if (req.sup && !sups.some(function (s) { return s.id === req.sup; })) throw new Error('Pembekal tidak dijumpai.');
    var id = nextNo_('LAST_PUR_NO', 'PU-');
    postMoves_(lines.map(function (l) { return { mat: l.mat, type: 'Masuk', qty: l.qty, cost: l.cost, date: date, ref: id, reason: 'Belian' }; }), 'Admin');
    var t = table_('Belian', PU_H), paid = !!req.paid;
    appendRow_(t, PU_H, [id, date, String(req.sup || ''), String(total), 'Diterima', paid ? 'Dibayar' : 'Belum bayar', paid ? date : '', String(req.note || '').slice(0, 200), json64_({ lines: lines }), stamp_()]);
    log_('Admin', 'Belian', id, 'RM' + total.toFixed(2) + ' · ' + lines.length + ' bahan');
    return { ok: true, id: id };
  });
}

function adminVoidPurchase_(req) {
  checkAdmin_(req.password);
  return withLock_(function () {
    var t = table_('Belian', PU_H), i = findRow_(t, 0, req.id); if (i < 0) throw new Error('Belian tidak dijumpai.');
    var p = purObj_(t.rows[i]); if (p.status === 'Dibatalkan') return { ok: true };
    postMoves_(p.lines.map(function (l) { return { mat: l.mat, type: 'Pembetulan', qty: -l.qty, cost: l.cost, date: p.date, ref: p.id, reason: 'Batal belian' }; }), 'Admin');
    setCells_(t, i, 5, ['Dibatalkan']);
    log_('Admin', 'Batal belian', p.id, String(req.reason || ''));
    return { ok: true };
  });
}

function adminPayPurchase_(req) {
  checkAdmin_(req.password);
  return withLock_(function () {
    var t = table_('Belian', PU_H), i = findRow_(t, 0, req.id); if (i < 0) throw new Error('Belian tidak dijumpai.');
    var paid = req.paid !== false;
    setCells_(t, i, 6, [paid ? 'Dibayar' : 'Belum bayar', paid ? isoDate_(req.date) : '']);
    log_('Admin', paid ? 'Bayar pembekal' : 'Belian belum bayar', req.id, '');
    return { ok: true };
  });
}

/* ---------- approvals ---------- */
var REQ_TYPES = { batal: 'Batalkan order', diskaun: 'Diskaun invois', lain: 'Lain-lain' };

function spRequests_(req) {
  var me = String(req.sp || '').toLowerCase();
  return { ok: true, requests: requests_().filter(function (r) { return r.sp.toLowerCase() === me; }).reverse() };
}

function spAddRequest_(req) {
  var type = REQ_TYPES[req.type] ? req.type : 'lain', detail = String(req.detail || '').trim().slice(0, 500), ref = '', amount = 0;
  if (type !== 'lain') {
    var found = find_(req.ref);
    if (normPhone_(found.order.phone) !== req.phone) throw new Error('Order ini bukan milik anda.');
    ref = found.order.code;
    if (type === 'batal' && found.order.status === 'Dibatalkan') throw new Error('Order ini sudah dibatalkan.');
    if (type === 'diskaun') {
      amount = r2_(req.amount);
      var inv = invoices_().filter(function (v) { return v.code === ref; })[0];
      if (amount <= 0) throw new Error('Sila isi jumlah diskaun.');
      if (!inv || amount > inv.amount + (inv.disc || 0)) throw new Error('Diskaun melebihi jumlah invois.');
    }
  }
  if (!detail) throw new Error('Sila tulis sebab permintaan.');
  return withLock_(function () {
    var t = table_('Permintaan', RQ_H);
    if (ref && t.rows.some(function (r) { return r[4] === ref && r[3] === type && r[7] === 'Menunggu'; })) throw new Error('Permintaan untuk ' + ref + ' masih menunggu keputusan HQ.');
    var id = nextNo_('LAST_REQ_NO', 'RQ-');
    appendRow_(t, RQ_H, [id, stamp_(), String(req.sp), type, ref, detail, json64_({ amount: amount }), 'Menunggu', '', '', '']);
    log_(req.sp, 'Permintaan', id, REQ_TYPES[type] + (ref ? ' · ' + ref : ''));
    return { ok: true, id: id };
  });
}

function spCancelRequest_(req) {
  return withLock_(function () {
    var t = table_('Permintaan', RQ_H), i = findRow_(t, 0, req.id);
    if (i < 0 || t.rows[i][2].toLowerCase() !== String(req.sp).toLowerCase()) throw new Error('Permintaan tidak dijumpai.');
    if (t.rows[i][7] !== 'Menunggu') throw new Error('Permintaan ini sudah diputuskan.');
    setCells_(t, i, 8, ['Dibatalkan', String(req.sp), stamp_(), 'Dibatalkan oleh pemohon']);
    return { ok: true };
  });
}

// Only HQ decides (a salesperson can never approve). Decisions are final and kept with who/when/why.
function adminDecide_(req) {
  checkAdmin_(req.password);
  var ok = req.decision === 'Diluluskan', reason = String(req.reason || '').trim().slice(0, 200);
  if (!ok && !reason) throw new Error('Sila tulis sebab permintaan ditolak.');
  return withLock_(function () {
    var t = table_('Permintaan', RQ_H), i = findRow_(t, 0, req.id); if (i < 0) throw new Error('Permintaan tidak dijumpai.');
    var r = reqObj_(t.rows[i]); if (r.status !== 'Menunggu') throw new Error('Permintaan ini sudah diputuskan.');
    if (ok && r.type === 'batal') setOrderStatus_(r.ref, 'Dibatalkan', 'Admin (' + r.id + ')');
    if (ok && r.type === 'diskaun') setInvoiceDisc_(r.ref, r.amount);
    setCells_(t, i, 8, [ok ? 'Diluluskan' : 'Ditolak', 'Admin', stamp_(), reason]);
    log_('Admin', ok ? 'Lulus permintaan' : 'Tolak permintaan', r.id, REQ_TYPES[r.type] + (r.ref ? ' · ' + r.ref : '') + (reason ? ' · ' + reason : ''));
    return { ok: true };
  });
}

/* ---------- security ---------- */
function adminChangePassword_(req) {
  checkAdmin_(req.password);
  var np = String(req.newPassword || '');
  if (np.length < 8) throw new Error('Kata laluan baru mesti sekurang-kurangnya 8 aksara.');
  if (np === 'tukar-saya' || np === req.password) throw new Error('Pilih kata laluan baru yang lain.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', np);
  log_('Admin', 'Tukar kata laluan admin', '', '');
  return { ok: true };
}

function adminEndSession_(req) {
  checkAdmin_(req.password);
  return withLock_(function () {
    var r = spRow_(req.code);
    r.t.sh.getRange(r.i + 2, 8).setValue('');
    log_('Admin', 'Tamatkan sesi', r.sp.code, '');
    return { ok: true };
  });
}

// Salesperson: sign out every other device, keep this one with a fresh token.
function spLogoutAll_(req) {
  return withLock_(function () {
    var r = spRow_(req.sp), tok = Utilities.getUuid();
    r.t.sh.getRange(r.i + 2, 8).setNumberFormat('@').setValue(tok);
    log_(r.sp.code, 'Log keluar peranti lain', '', '');
    return { ok: true, token: tok };
  });
}

// Full copy of every tab plus settings (never the admin password) for an offline backup file.
function adminBackup_(req) {
  checkAdmin_(req.password);
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheets = {}, props = PropertiesService.getScriptProperties();
  ss.getSheets().forEach(function (sh) { sheets[sh.getName()] = sh.getDataRange().getDisplayValues(); });
  log_('Admin', 'Muat turun backup', '', Object.keys(sheets).length + ' tab');
  return { ok: true, backup: { app: 'ngap-ordering', at: stamp_(), spreadsheet: ss.getName(), sheets: sheets,
    settings: parse_(props.getProperty('SETTINGS') || '{}'), products: parse_(props.getProperty('PRODUCTS') || '[]'), announcements: parse_(props.getProperty('ANNOUNCEMENTS') || '[]') } };
}
