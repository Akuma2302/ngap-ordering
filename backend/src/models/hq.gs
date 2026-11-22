/**
 * HQ back office tabs: expenses, raw materials + stock ledger, suppliers, purchases, requests (approvals).
 *
 * Perbelanjaan    — HQ expenses. Never deleted: a wrong entry is marked Dibatalkan.
 * Bahan           — raw material master (tepung, butter…), with unit and reorder level.
 * PergerakanStok  — append-only stock ledger. On-hand = sum of signed quantities; nobody edits a balance directly.
 * Pembekal        — suppliers.
 * Belian          — purchases from suppliers. Recording one adds stock (Masuk); voiding it posts a reversal.
 * Permintaan      — salesperson requests that HQ approves or rejects (cancel a locked order, invoice discount, other).
 */

var EX_H = ['ID', 'Tarikh', 'Kategori', 'Jumlah (RM)', 'Nota', 'Rujukan', 'Status', 'Dicipta', 'Oleh'];
var MT_H = ['ID', 'Nama', 'Unit', 'Paras minimum', 'Status', 'Dicipta'];
var MV_H = ['ID', 'Masa', 'Tarikh', 'Bahan', 'Jenis', 'Kuantiti', 'Kos seunit', 'Rujukan', 'Sebab', 'Oleh'];
var SU_H = ['ID', 'Nama', 'Telefon', 'Nota', 'Status', 'Dicipta'];
var PU_H = ['ID', 'Tarikh', 'Pembekal', 'Jumlah (RM)', 'Status', 'Bayaran', 'Tarikh bayar', 'Nota', 'Data', 'Dicipta'];
var RQ_H = ['ID', 'Masa', 'Salesperson', 'Jenis', 'Rujukan', 'Butiran', 'Data', 'Status', 'Diputus oleh', 'Masa keputusan', 'Sebab'];

var EXPENSE_CATS = ['Bahan mentah', 'Packaging', 'Penghantaran', 'Gaji & upah', 'Sewa & utiliti', 'Pemasaran', 'Peralatan', 'Lain-lain'];
var MOVE_TYPES = ['Masuk', 'Guna', 'Rosak', 'Pelarasan', 'Pembetulan'];
var USED_STATUSES = ['Dibakar', 'Siap', 'Selesai'];        // ingredients are used once HQ starts baking

var r2_ = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
var q4_ = function (n) { return Math.round((Number(n) || 0) * 10000) / 10000; };
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function isoDate_(d) { d = String(d || ''); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today_(); }

function appendRow_(t, H, row) {
  var r = t.sh.getLastRow() + 1;
  t.sh.getRange(r, 1, 1, H.length).setNumberFormat('@').setValues([row]);
  t.rows.push(row);
}

function setCells_(t, i, col, vals) { t.sh.getRange(i + 2, col, 1, vals.length).setNumberFormat('@').setValues([vals]); for (var k = 0; k < vals.length; k++) t.rows[i][col - 1 + k] = vals[k]; }

/* ---------- expenses ---------- */
function expObj_(r) { return { id: r[0], date: r[1], cat: r[2], amount: Number(r[3]) || 0, note: r[4], ref: r[5], status: r[6] || 'Aktif', createdAt: r[7], by: r[8] }; }
function expenses_() { return table_('Perbelanjaan', EX_H).rows.filter(function (r) { return r[0]; }).map(expObj_); }

/* ---------- materials + stock ledger ---------- */
function matObj_(r) { return { id: r[0], name: r[1], unit: r[2], reorder: Number(r[3]) || 0, status: r[4] || 'Aktif', createdAt: r[5] }; }
function moveObj_(r) { return { id: r[0], at: r[1], date: r[2], mat: r[3], type: r[4], qty: Number(r[5]) || 0, cost: r[6] === '' ? null : Number(r[6]), ref: r[7], reason: r[8], by: r[9] }; }
function moves_() { return table_('PergerakanStok', MV_H).rows.filter(function (r) { return r[0]; }).map(moveObj_); }

// Balance and weighted-average cost per material, rebuilt from the ledger every time.
function stockSummary_(moves) {
  var s = {};
  moves.forEach(function (m) {
    var x = s[m.mat] = s[m.mat] || { onHand: 0, costQty: 0, costVal: 0 };
    x.onHand = q4_(x.onHand + m.qty);
    if (m.cost !== null && (m.type === 'Masuk' || (m.type === 'Pembetulan' && /^PU-/.test(m.ref)))) { x.costQty += m.qty; x.costVal += m.qty * m.cost; }
  });
  Object.keys(s).forEach(function (k) { var x = s[k]; x.avgCost = x.costQty > 0 ? Math.round(x.costVal / x.costQty * 10000) / 10000 : null; });
  return s;
}

function materials_(summary) {
  summary = summary || stockSummary_(moves_());
  return table_('Bahan', MT_H).rows.filter(function (r) { return r[0]; }).map(function (r) {
    var m = matObj_(r), x = summary[m.id] || { onHand: 0, avgCost: null };
    m.onHand = x.onHand; m.avgCost = x.avgCost; m.low = m.status === 'Aktif' && m.reorder > 0 && x.onHand <= m.reorder;
    return m;
  });
}

/**
 * Append stock movements in one go. moves: [{ mat, type, qty (signed), cost, date, ref, reason }].
 * Blocks any movement that would take a material below zero unless HQ allowed negative stock.
 * Call inside withLock_.
 */
function postMoves_(moves, who) {
  if (!moves.length) return [];
  var t = table_('PergerakanStok', MV_H), all = t.rows.filter(function (r) { return r[0]; }).map(moveObj_);
  var mats = {}; table_('Bahan', MT_H).rows.forEach(function (r) { if (r[0]) mats[r[0]] = matObj_(r); });
  var sum = stockSummary_(all), after = {};
  moves.forEach(function (m) {
    if (!mats[m.mat]) throw new Error('Bahan ' + m.mat + ' tidak dijumpai.');
    if (MOVE_TYPES.indexOf(m.type) < 0) throw new Error('Jenis pergerakan tidak sah.');
    if (!m.qty) throw new Error('Kuantiti tidak boleh 0.');
    after[m.mat] = q4_((after[m.mat] !== undefined ? after[m.mat] : (sum[m.mat] || { onHand: 0 }).onHand) + m.qty);
  });
  if (!settings_().allowNegStock) Object.keys(after).forEach(function (id) {
    if (after[id] < -0.00005) { var have = (sum[id] || { onHand: 0 }).onHand; throw new Error('Stok ' + mats[id].name + ' tak cukup (ada ' + have + ' ' + mats[id].unit + '). Rekod belian atau pelarasan dahulu.'); }
  });
  var out = [];
  moves.forEach(function (m) {
    var id = nextNo_('LAST_MOVE_NO', 'MV-');
    var row = [id, stamp_(), isoDate_(m.date), m.mat, m.type, String(q4_(m.qty)), m.cost === null || m.cost === undefined ? '' : String(q4_(m.cost)),
               String(m.ref || ''), String(m.reason || '').slice(0, 200), String(who || 'Admin')];
    appendRow_(t, MV_H, row); out.push(moveObj_(row));
  });
  return out;
}

// Net quantity already posted against one reference (e.g. an order code), per material.
function netByRef_(ref, types) {
  var net = {};
  moves_().forEach(function (m) { if (m.ref === ref && types.indexOf(m.type) >= 0) net[m.mat] = q4_((net[m.mat] || 0) + m.qty); });
  return net;
}

/**
 * Ingredients follow the order status: moving into Dibakar/Siap/Selesai uses the recipe once;
 * moving back to Baru/Disahkan/Dikemaskini posts a correction. Cancelling after baking keeps the usage (it was used).
 */
function bakeStock_(order, prev, next) {
  var wasUsed = USED_STATUSES.indexOf(prev) >= 0, isUsed = USED_STATUSES.indexOf(next) >= 0;
  if (isUsed === wasUsed || next === 'Dibatalkan') return;
  var net = netByRef_(order.code, ['Guna', 'Pembetulan']), moves = [];
  if (isUsed) {
    if (Object.keys(net).some(function (k) { return net[k] < 0; })) return;      // already used (idempotent)
    var need = {}, sum = stockSummary_(moves_());
    FLAVOURS.forEach(function (p) {
      var q = order.items[p.id] || 0; if (!q) return;
      Object.keys(p.recipe || {}).forEach(function (mid) { var per = Number(p.recipe[mid]) || 0; if (per > 0) need[mid] = (need[mid] || 0) + per * q; });
    });
    Object.keys(need).forEach(function (mid) { moves.push({ mat: mid, type: 'Guna', qty: -q4_(need[mid]), cost: (sum[mid] || {}).avgCost, date: order.date, ref: order.code, reason: 'Bake ' + order.total + ' biji' }); });
  } else {
    Object.keys(net).forEach(function (mid) { if (net[mid] < 0) moves.push({ mat: mid, type: 'Pembetulan', qty: -net[mid], cost: null, date: order.date, ref: order.code, reason: 'Status ' + prev + ' → ' + next }); });
  }
  postMoves_(moves, 'Sistem');
}

/* ---------- suppliers + purchases ---------- */
function supObj_(r) { return { id: r[0], name: r[1], phone: r[2], note: r[3], status: r[4] || 'Aktif', createdAt: r[5] }; }
function suppliers_() { return table_('Pembekal', SU_H).rows.filter(function (r) { return r[0]; }).map(supObj_); }
function purObj_(r) { var d = parse_(r[8]); return { id: r[0], date: r[1], sup: r[2], amount: Number(r[3]) || 0, status: r[4] || 'Diterima', pay: r[5] || 'Belum bayar', paidDate: r[6], note: r[7], lines: d.lines || [], createdAt: r[9] }; }
function purchases_() { return table_('Belian', PU_H).rows.filter(function (r) { return r[0]; }).map(purObj_); }

/* ---------- requests ---------- */
function reqObj_(r) { var d = parse_(r[6]); return { id: r[0], at: r[1], sp: r[2], type: r[3], ref: r[4], detail: r[5], amount: Number(d.amount) || 0, bankRef: d.bankRef || '', date: d.date || '', status: r[7] || 'Menunggu', by: r[8], decidedAt: r[9], reason: r[10] }; }
function requests_() { return table_('Permintaan', RQ_H).rows.filter(function (r) { return r[0]; }).map(reqObj_); }
