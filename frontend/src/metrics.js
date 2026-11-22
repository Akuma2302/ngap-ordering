// Central metric dictionary for the admin app. Dashboard, Laporan, PDF and P&L all call these,
// so one number is never calculated two different ways.
//
//  Revenue (invois HQ) : HQ invoice amount after approved discount, orders not cancelled      · date basis: order date
//  Kos bahan           : pieces × (recipe × weighted-average material cost, else "kos bahan")  · order date
//  Perbelanjaan operasi: HQ expenses not cancelled, excluding "Bahan mentah" (stock purchases)  · expense date
//  Perbelanjaan        : kos bahan + perbelanjaan operasi                                       · as above
//  Untung bersih       : revenue − kos bahan − perbelanjaan operasi
//  Tunai masuk         : payments received from salespersons (BayaranHQ)                        · payment date
//  Tunai keluar        : expenses (all categories) + supplier purchases marked paid             · payment date
//  Baki tunai          : opening balance + tunai masuk − tunai keluar since the opening date    · as of date
//  Invois belum bayar  : invoice − payments allocated oldest-first (FIFO), per salesperson      · as of today
//  Tertunggak          : unpaid and older than the payment term (Maklumat HQ, default 14 days)
(function () {
  let C = null;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const days = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const inR = (d, r) => !!d && d >= r[0] && d <= r[1];
  const r2 = (n) => Math.round(n * 100) / 100;

  /* ---------- periods ---------- */
  const PERIODS = { today: 'Hari ini', week: 'Minggu ini', month: 'Bulan ini', quarter: 'Suku ini', year: 'Tahun ini', custom: 'Julat sendiri' };
  function period(key, from, to) {
    const n = new Date(), t = iso(n), y = n.getFullYear(), m = n.getMonth();
    switch (key) {
      case 'today': return { key, label: PERIODS.today, range: [t, t], prev: [addDays(t, -1), addDays(t, -1)], prevLabel: 'semalam' };
      case 'week': { const mon = addDays(t, -((n.getDay() + 6) % 7)); return { key, label: PERIODS.week, range: [mon, addDays(mon, 6)], prev: [addDays(mon, -7), addDays(mon, -1)], prevLabel: 'minggu lepas' }; }
      case 'quarter': { const q = Math.floor(m / 3); return { key, label: PERIODS.quarter, range: [iso(new Date(y, q * 3, 1)), iso(new Date(y, q * 3 + 3, 0))], prev: [iso(new Date(y, q * 3 - 3, 1)), iso(new Date(y, q * 3, 0))], prevLabel: 'suku lepas' }; }
      case 'year': return { key, label: PERIODS.year, range: [`${y}-01-01`, `${y}-12-31`], prev: [`${y - 1}-01-01`, `${y - 1}-12-31`], prevLabel: 'tahun lepas' };
      case 'custom': { const a = from || t, b = to && to >= a ? to : a, len = days(a, b) + 1; return { key, label: `${a} – ${b}`, range: [a, b], prev: [addDays(a, -len), addDays(a, -1)], prevLabel: `${len} hari sebelumnya` }; }
      default: return { key: 'month', label: PERIODS.month, range: [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))], prev: [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))], prevLabel: 'bulan lepas' };
    }
  }
  const monthRange = (mo) => { const [y, m] = mo.split('-').map(Number); return [`${mo}-01`, iso(new Date(y, m, 0))]; };

  /* ---------- core metrics ---------- */
  const S = () => C.state(), H = () => C.hq();
  const liveOrders = (r) => S().orders.filter((o) => o.status !== 'Dibatalkan' && inR(o.date, r));
  function revenue(r) { const inv = S().invs; return r2(liveOrders(r).reduce((a, o) => { const v = inv.find((x) => x.code === o.code); return a + (v ? v.amount : 0); }, 0)); }
  function discount(r) { const inv = S().invs; return r2(liveOrders(r).reduce((a, o) => { const v = inv.find((x) => x.code === o.code); return a + (v ? v.disc || 0 : 0); }, 0)); }
  function cogs(r) {
    let c = 0, missing = false;
    liveOrders(r).forEach((o) => Object.keys(o.items).forEach((fid) => { const q = o.items[fid] || 0; if (!q) return; const k = C.costPer(fid).cost; if (k === null) missing = true; c += q * (k || 0); }));
    return { value: r2(c), missing };
  }
  const expList = (r) => H().expenses.filter((e) => e.status !== 'Dibatalkan' && inR(e.date, r));
  function opexByCat(r) { const o = {}; expList(r).forEach((e) => { if (e.cat !== 'Bahan mentah') o[e.cat] = r2((o[e.cat] || 0) + e.amount); }); return o; }
  const opex = (r) => r2(Object.values(opexByCat(r)).reduce((a, v) => a + v, 0));
  function pnl(r) {
    const rev = revenue(r), cg = cogs(r), op = opex(r), byCat = opexByCat(r), exp = r2(cg.value + op), net = r2(rev - exp);
    return { rev, disc: discount(r), cogs: cg.value, missing: cg.missing, gross: r2(rev - cg.value), opex: op, byCat, rawCash: r2(expList(r).filter((e) => e.cat === 'Bahan mentah').reduce((a, e) => a + e.amount, 0)),
             expenses: exp, net, margin: rev ? net / rev * 100 : null, pcs: liveOrders(r).reduce((a, o) => a + o.total, 0), orders: liveOrders(r).length };
  }
  const paidPurchases = (r) => H().purchases.filter((p) => p.status !== 'Dibatalkan' && p.pay === 'Dibayar' && inR(p.paidDate || p.date, r));
  const cashIn = (r) => r2(S().hqp.filter((y) => inR(y.date, r)).reduce((a, y) => a + y.amount, 0));
  const cashOut = (r) => r2(expList(r).reduce((a, e) => a + e.amount, 0) + paidPurchases(r).reduce((a, p) => a + p.amount, 0));
  function cashBalance(asOf) {
    const oc = (S().setts && S().setts.openingCash) || {}, set = oc.amount !== '' && oc.amount !== undefined && oc.amount !== null && !!oc.date;
    const from = set ? oc.date : '0000-01-01', r = [from, asOf];
    return { value: r2((set ? Number(oc.amount) : 0) + cashIn(r) - cashOut(r)), set, from: set ? oc.date : '' };
  }
  const payables = () => r2(H().purchases.filter((p) => p.status !== 'Dibatalkan' && p.pay !== 'Dibayar').reduce((a, p) => a + p.amount, 0));

  /* ---------- receivables: FIFO allocation + ageing ---------- */
  const term = () => { const t = S().setts && S().setts.invoiceTermDays; return t === undefined || t === null || t === '' ? 14 : Number(t); };
  function receivables(asOf) {
    asOf = asOf || iso(new Date());
    const st = S(), al = window.SC_FIN.allocate(st.invs, st.hqp), T = term();
    const B = [['Belum tempoh', 0], ['Lewat 1–7 hari', 0], ['Lewat 8–30 hari', 0], ['Lewat > 30 hari', 0]];
    const open = [], bySp = {};
    st.invs.forEach((v) => {
      const a = al[v.code]; if (!a || a.due <= 0.004) return;
      const late = days(addDays(v.date, T), asOf), b = late <= 0 ? 0 : late <= 7 ? 1 : late <= 30 ? 2 : 3;
      B[b][1] = r2(B[b][1] + a.due);
      const row = { code: v.code, phone: v.phone, date: v.date, due: addDays(v.date, T), balance: a.due, late: Math.max(0, late), status: a.status };
      open.push(row);
      const s = bySp[v.phone] = bySp[v.phone] || { phone: v.phone, balance: 0, overdue: 0, n: 0, oldest: 0 };
      s.balance = r2(s.balance + a.due); s.n++; if (late > 0) { s.overdue = r2(s.overdue + a.due); s.oldest = Math.max(s.oldest, late); }
    });
    return { term: T, buckets: B, open: open.sort((x, y) => y.late - x.late || y.balance - x.balance), bySp: Object.values(bySp).sort((x, y) => y.overdue - x.overdue || y.balance - x.balance),
             total: r2(open.reduce((a, x) => a + x.balance, 0)), count: open.length, overdue: r2(open.filter((x) => x.late > 0).reduce((a, x) => a + x.balance, 0)), overdueCount: open.filter((x) => x.late > 0).length };
  }

  /* ---------- time buckets for charts (day / week / month by period length) ---------- */
  function buckets(r) {
    const len = days(r[0], r[1]) + 1, out = [];
    if (len <= 1) return buckets([addDays(r[1], -13), r[1]]);
    if (len <= 35) { for (let d = r[0]; d <= r[1]; d = addDays(d, 1)) { const x = parse(d); out.push({ label: `${x.getDate()}/${x.getMonth() + 1}`, long: x.toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric', month: 'short' }), range: [d, d] }); } return { unit: 'hari', list: out }; }
    if (len <= 120) { for (let d = r[0]; d <= r[1]; d = addDays(d, 7)) { const e = addDays(d, 6) > r[1] ? r[1] : addDays(d, 6), x = parse(d); out.push({ label: `${x.getDate()}/${x.getMonth() + 1}`, long: `Minggu ${x.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })}`, range: [d, e] }); } return { unit: 'minggu', list: out }; }
    let d = r[0].slice(0, 7) + '-01';
    while (d <= r[1]) { const x = parse(d), e = iso(new Date(x.getFullYear(), x.getMonth() + 1, 0)); out.push({ label: x.toLocaleDateString('ms-MY', { month: 'short' }), long: x.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' }), range: [d < r[0] ? r[0] : d, e > r[1] ? r[1] : e] }); d = iso(new Date(x.getFullYear(), x.getMonth() + 1, 1)); }
    return { unit: 'bulan', list: out };
  }

  window.SC_MET = { init(ctx) { C = ctx; }, PERIODS, period, monthRange, revenue, cogs, opex, opexByCat, pnl, cashIn, cashOut, cashBalance, payables, receivables, buckets, term, iso, addDays, days };
})();
