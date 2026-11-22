// Admin back office modules: products, expenses, raw materials + stock ledger, suppliers & purchases,
// approvals, HQ targets, all customers, P&L, password and backup. Mounted by admin.html via SC_HQ.init(ctx).
(function () {
  let C = null;                 // context from admin.html
  let D = { products: [], materials: [], moves: [], suppliers: [], purchases: [], expenses: [], requests: [], expenseCats: [] };
  const $ = (id) => document.getElementById(id);
  const val = (id) => ($(id) ? $(id).value.trim() : '');
  const num = (v) => { v = String(v ?? '').replace(',', '.').trim(); return v === '' || !isFinite(Number(v)) ? null : Number(v); };
  const monthOf = (iso) => String(iso || '').slice(0, 7);
  const REQ = { batal: 'Batalkan order', diskaun: 'Diskaun invois', lain: 'Lain-lain' };
  const close = '<div class="acts one" style="margin-top:12px"><button class="btn btn-o" type="button" data-gclose>Tutup</button></div>';

  async function act(fn, msg, after) {
    try { await fn(); if (msg) C.toast(msg); await refresh(); if (after) after(); return true; }
    catch (err) { C.toast(err.message, true); return false; }
  }
  async function refresh() { try { D = Object.assign(D, await C.API.adminHQ(C.pw())); } catch (e) {} C.onData(); }
  const matName = (id) => { const m = D.materials.find((x) => x.id === id); return m ? m.name : id; };
  const matUnit = (id) => { const m = D.materials.find((x) => x.id === id); return m ? m.unit : ''; };
  const supName = (id) => { const s = D.suppliers.find((x) => x.id === id); return s ? s.name : id || 'Tanpa pembekal'; };
  const q = (n) => Number(n || 0).toLocaleString('ms-MY', { maximumFractionDigits: 3 });

  /* ---------- cost per cookie: recipe × weighted-average cost, else the HQ "kos bahan" setting ---------- */
  function costPer(fid) {
    const p = D.products.find((x) => x.id === fid), rec = (p && p.recipe) || {}, keys = Object.keys(rec);
    if (keys.length) { let c = 0, ok = true; keys.forEach((k) => { const m = D.materials.find((x) => x.id === k); if (!m || m.avgCost === null || m.avgCost === undefined) ok = false; else c += rec[k] * m.avgCost; });
      if (ok) return { cost: Math.round(c * 10000) / 10000, src: 'resipi' }; }
    const v = C.pIn(C.state().setts && C.state().setts.hqCost, fid);
    return { cost: v, src: v === null ? 'tiada' : 'tetapan' };
  }

  /* ---------- P&L for one month (operational view, by order date) ---------- */
  // P&L for one month — numbers come from the central metric dictionary (metrics.js).
  function pnl(m) {
    const r = window.SC_MET.monthRange(m), p = window.SC_MET.pnl(r);
    return Object.assign(p, { cashIn: window.SC_MET.cashIn(r), cashOut: window.SC_MET.cashOut(r), ap: window.SC_MET.payables(), ar: window.SC_MET.receivables().total });
  }
  function pnlHTML(m) {
    const p = pnl(m), RM = C.RM, row = (k, v, cls) => `<div class="payrow"><span>${k}</span><b class="${cls || ''}">${v}</b></div>`;
    const cats = Object.entries(p.byCat).filter(([k]) => k !== 'Bahan mentah').sort((a, b) => b[1] - a[1]);
    return `<section class="panel"><div class="panel-h"><h2>Untung rugi (P&amp;L)</h2><span class="r">ikut tarikh order</span></div>
      <div class="clist">${row('Revenue HQ (invois)' + (p.disc ? ` <small>selepas diskaun ${RM(p.disc)}</small>` : ''), RM(p.rev))}
      ${row('− Kos bahan' + (p.missing ? ' <small>(sebahagian kos belum diset)</small>' : ''), RM(p.cogs))}
      ${row('<b>Untung kasar</b>', RM(p.gross), p.gross < 0 ? 'neg' : '')}
      ${cats.map(([k, v]) => row('− ' + C.esc(k), RM(v))).join('') || row('− Perbelanjaan operasi', RM(0))}
      ${row('<b>Untung bersih</b>', RM(p.net), p.net < 0 ? 'neg' : 'pos')}
      ${row('Margin bersih', p.margin === null ? '–' : p.margin.toFixed(1) + '%')}</div>
      <div class="minis" style="margin-top:10px"><div class="mini"><b>${RM(p.cashIn)}</b><span>Tunai masuk</span></div><div class="mini"><b>${RM(p.cashOut)}</b><span>Tunai keluar</span></div><div class="mini"><b class="${p.ap > 0.004 ? 'neg' : ''}">${RM(p.ap)}</b><span>Hutang pembekal</span></div></div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">Kos bahan = resipi × kos purata bahan (atau "kos bahan" di tetapan harga). Belian bahan masuk ke stok, bukan perbelanjaan. Angka ini untuk pengurusan — sahkan dengan akauntan sebelum lapor cukai.</p></section>`;
  }

  /* ---------- Ringkasan alerts ---------- */
  function homeAlerts(extra) {
    const out = [], pend = D.requests.filter((r) => r.status === 'Menunggu').length, low = D.materials.filter((m) => m.low);
    if (extra.pwDefault) out.push(`<button class="hq-al bad" type="button" data-hq="security"><b>Kata laluan admin masih asal</b><small>Tukar sekarang di Lagi → Keselamatan</small></button>`);
    if (pend) out.push(`<button class="hq-al" type="button" data-hq="approvals"><b>${pend} permintaan menunggu kelulusan</b><small>Dari salesperson</small></button>`);
    if (low.length) out.push(`<button class="hq-al" type="button" data-hq="materials"><b>${low.length} bahan di bawah paras minimum</b><small>${low.slice(0, 3).map((m) => C.esc(m.name)).join(', ')}</small></button>`);
    return out.join('');
  }

  /* ---------- products ---------- */
  function productsSheet() {
    C.openG(`<h2>Produk</h2><p class="muted" style="margin:2px 0 10px">Produk baru terus muncul di app salesperson &amp; agent. Produk lama <b>diarkib</b>, bukan dipadam, supaya sejarah order kekal.</p>
      <div class="clist">${D.products.map((p) => { const f = (window.SC_CONFIG.FLAVOURS.find((x) => x.id === p.id) || {}); const c = costPer(p.id);
        return `<div class="payrow${p.active === false ? ' off' : ''}"><span style="flex-direction:row;align-items:center;gap:10px"><img src="${C.esc(f.img || p.img || window.SC_CONFIG.NO_IMG)}" alt="" style="width:36px;height:36px;object-fit:contain"><span style="display:flex;flex-direction:column"><b>${C.esc(p.name)}</b><small>${p.active === false ? 'Diarkib · ' : ''}${Object.keys(p.recipe || {}).length ? 'resipi ' + Object.keys(p.recipe).length + ' bahan' : 'tiada resipi'} · kos ${c.cost === null ? '–' : C.RM(c.cost)}</small></span></span><button class="btn btn-o btn-sm" type="button" data-pe="${C.esc(p.id)}">Edit</button></div>`; }).join('')}</div>
      <p class="sec-h">Tambah produk</p><div class="fields"><label class="f">Nama<input class="inp" id="pr-name" placeholder="cth. Red Velvet"></label>
      <label class="f">Penerangan<input class="inp" id="pr-desc" placeholder="cth. Red velvet dough, cream cheese"></label>
      <label class="f">Gambar <small>Link https:// (pilihan)</small><input class="inp" id="pr-img" placeholder="https://…"></label>
      <button class="btn btn-p btn-block" type="button" id="pr-add">Tambah produk</button></div>${close}`);
    $('pr-add').onclick = () => act(() => C.API.adminSaveProduct(C.pw(), { name: val('pr-name'), desc: val('pr-desc'), img: val('pr-img') }), 'Produk ditambah.', productsSheet);
    document.querySelectorAll('[data-pe]').forEach((b) => b.onclick = () => productEdit(b.dataset.pe));
  }
  function productEdit(id) {
    const p = D.products.find((x) => x.id === id), mats = D.materials.filter((m) => m.status === 'Aktif' || (p.recipe || {})[m.id]);
    C.openG(`<h2>${C.esc(p.name)}</h2><div class="fields" style="margin-top:10px">
      <label class="f">Nama<input class="inp" id="pe-name" value="${C.esc(p.name)}"></label>
      <label class="f">Penerangan<input class="inp" id="pe-desc" value="${C.esc(p.desc || '')}"></label>
      <label class="f">Gambar <small>Kosongkan untuk guna gambar asal</small><input class="inp" id="pe-img" value="${C.esc(p.img || '')}" placeholder="https://…"></label>
      <label class="f">Status<select class="inp" id="pe-act"><option value="1"${p.active !== false ? ' selected' : ''}>Aktif (boleh diorder)</option><option value="0"${p.active === false ? ' selected' : ''}>Diarkib (sembunyi dari borang order)</option></select></label></div>
      <p class="sec-h">Resipi (setiap biji)</p>
      ${mats.length ? `<div class="clist">${mats.map((m) => `<div class="prow" style="grid-template-columns:1fr 110px"><span>${C.esc(m.name)} <small class="muted">(${C.esc(m.unit)})</small></span><input class="inp" data-rc="${C.esc(m.id)}" inputmode="decimal" placeholder="0" value="${(p.recipe || {})[m.id] ?? ''}"></div>`).join('')}</div>
        <p class="muted" style="font-size:12px;margin:6px 0 0">Bila order ditanda <b>Dibakar</b>, bahan ditolak dari stok ikut resipi × bilangan biji.</p>` : '<p class="muted">Tambah bahan mentah dulu di <b>Bahan mentah &amp; stok</b> untuk set resipi.</p>'}
      <div class="acts"><button class="btn btn-o" type="button" data-gclose>Batal</button><button class="btn btn-p" type="button" id="pe-save">Simpan</button></div>`);
    $('pe-save').onclick = () => { const recipe = {}; document.querySelectorAll('[data-rc]').forEach((i) => { const v = num(i.value); if (v === null && i.value.trim()) return; if (v > 0) recipe[i.dataset.rc] = v; });
      act(() => C.API.adminSaveProduct(C.pw(), { id, name: val('pe-name'), desc: val('pe-desc'), img: val('pe-img'), active: $('pe-act').value === '1', recipe }), 'Produk disimpan.', productsSheet); };
  }

  /* ---------- expenses ---------- */
  let exMonth = monthOf(C_today());
  function C_today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function expensesSheet() {
    const list = D.expenses.filter((e) => monthOf(e.date) === exMonth).sort((a, b) => b.date.localeCompare(a.date));
    const tot = list.filter((e) => e.status !== 'Dibatalkan').reduce((a, e) => a + e.amount, 0);
    C.openG(`<h2>Perbelanjaan HQ</h2>
      <div class="fields" style="margin-top:8px"><div class="fields two"><label class="f">Tarikh<input class="inp" id="ex-date" type="date" value="${C_today()}"></label>
      <label class="f">Jumlah (RM)<input class="inp" id="ex-amt" inputmode="decimal" placeholder="0.00"></label></div>
      <label class="f">Kategori<select class="inp" id="ex-cat">${D.expenseCats.map((c) => `<option>${C.esc(c)}</option>`).join('')}</select></label>
      <div class="fields two"><label class="f">Nota<input class="inp" id="ex-note" placeholder="cth. kotak 200 pcs"></label><label class="f">No. resit<input class="inp" id="ex-ref" placeholder="pilihan"></label></div>
      <p class="muted" style="font-size:12px;margin:0">Bahan yang dijejak stok, rekod di <b>Pembekal &amp; belian</b> supaya masuk ke stok.</p>
      <button class="btn btn-p btn-block" type="button" id="ex-add">Rekod perbelanjaan</button></div>
      <div class="rp-month" style="margin-top:14px"><button class="ibtn2" type="button" data-exm="-1">‹</button><b>${C.esc(C.monthName(exMonth))} · ${C.RM(tot)}</b><button class="ibtn2" type="button" data-exm="1">›</button></div>
      <div class="clist">${list.map((e) => `<div class="payrow${e.status === 'Dibatalkan' ? ' off' : ''}"><span><b>${C.RM(e.amount)} · ${C.esc(e.cat)}</b><small>${C.esc(C.fmtDate(e.date))}${e.note ? ' · ' + C.esc(e.note) : ''}${e.ref ? ' · resit ' + C.esc(e.ref) : ''} · ${C.esc(e.id)}${e.status === 'Dibatalkan' ? ' · DIBATALKAN' : ''}</small></span>${e.status === 'Dibatalkan' ? '' : `<button class="linkbtn" type="button" data-exv="${C.esc(e.id)}">Batal</button>`}</div>`).join('') || '<p class="muted">Tiada perbelanjaan bulan ini.</p>'}</div>${close}`);
    $('ex-add').onclick = () => { const a = num(val('ex-amt')); if (!a) return C.toast('Isi jumlah.', true);
      act(() => C.API.adminSaveExpense(C.pw(), { date: val('ex-date'), cat: $('ex-cat').value, amount: a, note: val('ex-note'), ref: val('ex-ref') }), 'Perbelanjaan direkod.', expensesSheet); };
    document.querySelectorAll('[data-exm]').forEach((b) => b.onclick = () => { const [y, m] = exMonth.split('-').map(Number), d = new Date(y, m - 1 + Number(b.dataset.exm), 1); exMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; expensesSheet(); });
    document.querySelectorAll('[data-exv]').forEach((b) => b.onclick = () => { const r = prompt('Sebab batalkan ' + b.dataset.exv + '?'); if (r === null) return; act(() => C.API.adminVoidExpense(C.pw(), b.dataset.exv, r), 'Dibatalkan.', expensesSheet); });
  }

  /* ---------- raw materials + stock ledger ---------- */
  function materialsSheet() {
    const neg = !!(C.state().setts || {}).allowNegStock;
    C.openG(`<h2>Bahan mentah &amp; stok</h2><p class="muted" style="margin:2px 0 10px">Stok dikira dari lejar pergerakan. Untuk ubah stok, rekod <b>belian</b>, <b>rosak</b> atau <b>pelarasan</b> — bukan edit angka terus.</p>
      <div class="clist">${D.materials.map((m) => `<div class="payrow${m.status !== 'Aktif' ? ' off' : ''}"><span><b>${C.esc(m.name)} ${m.low ? '<span class="pill st-Baru">Rendah</span>' : ''}</b><small>Ada <b>${q(m.onHand)} ${C.esc(m.unit)}</b> · min ${q(m.reorder)} · kos purata ${m.avgCost === null ? '–' : C.RM(m.avgCost) + '/' + C.esc(m.unit)}</small></span><button class="btn btn-o btn-sm" type="button" data-mt="${C.esc(m.id)}">Buka</button></div>`).join('') || '<p class="muted">Belum ada bahan.</p>'}</div>
      <p class="sec-h">Tambah bahan</p><div class="fields"><div class="fields two"><label class="f">Nama<input class="inp" id="mt-name" placeholder="cth. Tepung gandum"></label><label class="f">Unit<input class="inp" id="mt-unit" placeholder="kg / g / pek"></label></div>
      <label class="f">Paras minimum <small>Amaran bila stok sama atau bawah</small><input class="inp" id="mt-min" inputmode="decimal" placeholder="0"></label>
      <button class="btn btn-p btn-block" type="button" id="mt-add">Tambah bahan</button></div>
      <label class="frow" style="margin-top:12px"><span>Benarkan stok negatif<br><small class="muted" style="font-weight:400">Biasanya tutup: bake disekat jika bahan tak cukup</small></span><input type="checkbox" id="mt-neg"${neg ? ' checked' : ''}><i class="sw"></i></label>${close}`);
    $('mt-add').onclick = () => act(() => C.API.adminSaveMaterial(C.pw(), { name: val('mt-name'), unit: val('mt-unit'), reorder: num(val('mt-min')) || 0 }), 'Bahan ditambah.', materialsSheet);
    $('mt-neg').onchange = () => C.saveSettings({ allowNegStock: $('mt-neg').checked }, 'Tetapan stok disimpan.');
    document.querySelectorAll('[data-mt]').forEach((b) => b.onclick = () => materialSheet(b.dataset.mt));
  }
  function materialSheet(id) {
    const m = D.materials.find((x) => x.id === id), mv = D.moves.filter((x) => x.mat === id).slice(0, 60);
    C.openG(`<h2>${C.esc(m.name)}</h2><p class="muted" style="margin:2px 0 10px">Ada <b>${q(m.onHand)} ${C.esc(m.unit)}</b> · kos purata ${m.avgCost === null ? '–' : C.RM(m.avgCost)}</p>
      <div class="fields"><div class="fields two"><label class="f">Jenis<select class="inp" id="mv-type"><option value="Rosak">Rosak / buang</option><option value="Pelarasan">Pelarasan (kiraan stok)</option></select></label>
      <label class="f">Kuantiti (${C.esc(m.unit)}) <small>Pelarasan: + tambah, − kurang</small><input class="inp" id="mv-qty" inputmode="decimal" placeholder="cth. -0.5"></label></div>
      <label class="f">Sebab<input class="inp" id="mv-why" placeholder="cth. kiraan stok akhir bulan"></label>
      <button class="btn btn-p btn-block" type="button" id="mv-go">Rekod pergerakan</button></div>
      <p class="sec-h">Edit bahan</p><div class="fields"><div class="fields two"><label class="f">Nama<input class="inp" id="me-name" value="${C.esc(m.name)}"></label><label class="f">Unit<input class="inp" id="me-unit" value="${C.esc(m.unit)}"></label></div>
      <div class="fields two"><label class="f">Paras minimum<input class="inp" id="me-min" inputmode="decimal" value="${m.reorder}"></label><label class="f">Status<select class="inp" id="me-st"><option${m.status === 'Aktif' ? ' selected' : ''}>Aktif</option><option${m.status !== 'Aktif' ? ' selected' : ''}>Tidak aktif</option></select></label></div>
      <button class="btn btn-o btn-block" type="button" id="me-save">Simpan bahan</button></div>
      <p class="sec-h">Lejar pergerakan</p><div class="clist lglist">${mv.map((x) => `<div class="payrow"><span><b>${C.esc(x.type)} ${x.qty > 0 ? '+' : ''}${q(x.qty)} ${C.esc(m.unit)}</b><small>${C.esc(C.fmtDate(x.date))} · ${C.esc(x.ref)}${x.reason ? ' · ' + C.esc(x.reason) : ''}${x.cost !== null ? ' · @' + C.RM(x.cost) : ''} · ${C.esc(x.by)}</small></span></div>`).join('') || '<p class="muted">Tiada pergerakan.</p>'}</div>
      <div class="acts one" style="margin-top:12px"><button class="btn btn-o" type="button" id="mt-back">Kembali</button></div>`);
    $('mt-back').onclick = materialsSheet;
    $('mv-go').onclick = () => { const n = num(val('mv-qty')); if (!n) return C.toast('Isi kuantiti.', true);
      act(() => C.API.adminStockMove(C.pw(), { mat: id, type: $('mv-type').value, qty: n, reason: val('mv-why') }), 'Pergerakan direkod.', () => materialSheet(id)); };
    $('me-save').onclick = () => act(() => C.API.adminSaveMaterial(C.pw(), { id, name: val('me-name'), unit: val('me-unit'), reorder: num(val('me-min')) || 0, status: $('me-st').value }), 'Bahan disimpan.', () => materialSheet(id));
  }

  /* ---------- suppliers + purchases ---------- */
  function purchasesSheet() {
    const list = D.purchases.slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 60);
    const ap = D.purchases.filter((p) => p.status !== 'Dibatalkan' && p.pay !== 'Dibayar').reduce((a, p) => a + p.amount, 0);
    C.openG(`<h2>Pembekal &amp; belian</h2><p class="muted" style="margin:2px 0 10px">Hutang kepada pembekal: <b class="${ap > 0.004 ? 'neg' : ''}">${C.RM(ap)}</b></p>
      <button class="btn btn-p btn-block" type="button" id="pu-new"${D.materials.length ? '' : ' disabled'}>+ Rekod belian baru</button>
      ${D.materials.length ? '' : '<p class="muted" style="font-size:12px">Tambah bahan mentah dahulu.</p>'}
      <p class="sec-h">Belian</p><div class="clist">${list.map((p) => `<div class="payrow${p.status === 'Dibatalkan' ? ' off' : ''}"><span><b>${C.esc(p.id)} · ${C.RM(p.amount)}</b><small>${C.esc(C.fmtDate(p.date))} · ${C.esc(supName(p.sup))} · ${p.lines.map((l) => C.esc(matName(l.mat)) + ' ' + q(l.qty) + C.esc(matUnit(l.mat))).join(', ')}${p.status === 'Dibatalkan' ? ' · DIBATALKAN' : ''}</small></span>
        ${p.status === 'Dibatalkan' ? '' : `<span class="sp-acts"><button class="btn btn-o btn-sm" type="button" data-pp="${C.esc(p.id)}">${p.pay === 'Dibayar' ? 'Dibayar ✓' : 'Tanda dibayar'}</button><button class="linkbtn" type="button" data-pv="${C.esc(p.id)}">Batal</button></span>`}</div>`).join('') || '<p class="muted">Belum ada belian.</p>'}</div>
      <p class="sec-h">Pembekal</p><div class="clist">${D.suppliers.map((s) => `<div class="payrow"><span><b>${C.esc(s.name)}</b><small>${C.esc(s.phone || 'tiada telefon')}${s.note ? ' · ' + C.esc(s.note) : ''}</small></span>${s.phone ? `<a class="btn btn-o btn-sm" href="https://wa.me/6${C.esc(s.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div>`).join('') || '<p class="muted">Belum ada pembekal.</p>'}</div>
      <div class="fields" style="margin-top:8px"><div class="fields two"><label class="f">Nama pembekal<input class="inp" id="su-name" placeholder="cth. Kedai Bakery ABC"></label><label class="f">Telefon<input class="inp" id="su-ph" type="tel" placeholder="pilihan"></label></div>
      <button class="btn btn-o btn-block" type="button" id="su-add">Tambah pembekal</button></div>${close}`);
    $('su-add').onclick = () => act(() => C.API.adminSaveSupplier(C.pw(), { name: val('su-name'), phone: val('su-ph') }), 'Pembekal ditambah.', purchasesSheet);
    if ($('pu-new')) $('pu-new').onclick = newPurchase;
    document.querySelectorAll('[data-pp]').forEach((b) => b.onclick = () => { const p = D.purchases.find((x) => x.id === b.dataset.pp);
      act(() => C.API.adminPayPurchase(C.pw(), p.id, p.pay !== 'Dibayar', C_today()), p.pay !== 'Dibayar' ? 'Ditanda dibayar.' : 'Ditanda belum bayar.', purchasesSheet); });
    document.querySelectorAll('[data-pv]').forEach((b) => b.onclick = () => { if (!confirm(`Batalkan ${b.dataset.pv}? Stok bahan akan ditolak semula.`)) return;
      act(() => C.API.adminVoidPurchase(C.pw(), b.dataset.pv, 'Batal oleh admin'), 'Belian dibatalkan.', purchasesSheet); });
  }
  function newPurchase() {
    const mats = D.materials.filter((m) => m.status === 'Aktif'), opt = mats.map((m) => `<option value="${C.esc(m.id)}">${C.esc(m.name)} (${C.esc(m.unit)})</option>`).join('');
    const line = () => `<div class="prow pl" style="grid-template-columns:1fr 70px 80px"><select class="inp" data-k="mat" style="text-align:left">${opt}</select><input class="inp" data-k="qty" inputmode="decimal" placeholder="kuantiti"><input class="inp" data-k="cost" inputmode="decimal" placeholder="RM/unit"></div>`;
    C.openG(`<h2>Belian baru</h2><div class="fields" style="margin-top:8px"><div class="fields two"><label class="f">Tarikh terima<input class="inp" id="pu-date" type="date" value="${C_today()}"></label>
      <label class="f">Pembekal<select class="inp" id="pu-sup"><option value="">— tiada —</option>${D.suppliers.filter((s) => s.status === 'Aktif').map((s) => `<option value="${C.esc(s.id)}">${C.esc(s.name)}</option>`).join('')}</select></label></div></div>
      <div class="prow hd" style="grid-template-columns:1fr 70px 80px"><span>Bahan</span><span>Kuantiti</span><span>RM seunit</span></div><div id="pu-lines">${line()}</div>
      <button class="linkbtn pk" type="button" id="pu-more">+ Tambah baris</button>
      <div class="fields" style="margin-top:8px"><label class="f">Nota<input class="inp" id="pu-note" placeholder="cth. invois pembekal #123"></label>
      <label class="frow"><span>Sudah dibayar</span><input type="checkbox" id="pu-paid"><i class="sw"></i></label>
      <p class="muted" style="margin:0" id="pu-tot">Jumlah: RM0.00</p></div>
      <div class="acts"><button class="btn btn-o" type="button" id="pu-back">Kembali</button><button class="btn btn-p" type="button" id="pu-save">Simpan &amp; masuk stok</button></div>`);
    const lines = () => [...document.querySelectorAll('#pu-lines .pl')].map((r) => ({ mat: r.querySelector('[data-k=mat]').value, qty: num(r.querySelector('[data-k=qty]').value) || 0, cost: num(r.querySelector('[data-k=cost]').value) || 0 }));
    const tot = () => { $('pu-tot').textContent = 'Jumlah: ' + C.RM(lines().reduce((a, l) => a + l.qty * l.cost, 0)); };
    $('pu-lines').addEventListener('input', tot);
    $('pu-more').onclick = () => $('pu-lines').insertAdjacentHTML('beforeend', line());
    $('pu-back').onclick = purchasesSheet;
    $('pu-save').onclick = () => act(() => C.API.adminAddPurchase(C.pw(), { date: val('pu-date'), sup: $('pu-sup').value, lines: lines().filter((l) => l.qty > 0), note: val('pu-note'), paid: $('pu-paid').checked }), 'Belian direkod, stok dikemas kini.', purchasesSheet);
  }

  /* ---------- approvals ---------- */
  function approvalsSheet() {
    const S = C.state(), pend = D.requests.filter((r) => r.status === 'Menunggu'), done = D.requests.filter((r) => r.status !== 'Menunggu').slice(-30).reverse();
    const who = (code) => { const s = S.sps.find((x) => x.code === code); return s ? `${s.name} (${s.code})` : code; };
    const card = (r) => { const o = r.ref ? S.orders.find((x) => x.code === r.ref) : null, v = r.ref ? S.invs.find((x) => x.code === r.ref) : null;
      return `<div class="oc" style="margin-bottom:10px"><div class="oc-top"><span class="oc-code">${C.esc(r.id)} · ${C.esc(REQ[r.type] || r.type)}</span><span class="pill ${r.status === 'Menunggu' ? 'st-Baru' : r.status === 'Diluluskan' ? 'st-Siap' : 'st-Dibatalkan'}">${C.esc(r.status)}</span></div>
        <div class="oc-when"><b>${C.esc(who(r.sp))}</b> · ${C.esc(r.at)}${r.ref ? ` · ${C.esc(r.ref)}${o ? ' (' + C.esc(o.status) + ', ' + o.total + ' biji)' : ''}` : ''}${r.type === 'diskaun' ? ` · diskaun <b>${C.RM(r.amount)}</b>${v ? ' daripada ' + C.RM(v.amount + (v.disc || 0)) : ''}` : ''}</div>
        <div class="oc-note">${C.esc(r.detail)}</div>
        ${r.status === 'Menunggu' ? `<div class="oc-foot"><button class="btn btn-o btn-sm" type="button" data-rj="${C.esc(r.id)}">Tolak</button><button class="btn btn-p btn-sm" type="button" data-ap="${C.esc(r.id)}">Lulus</button></div>` : `<div class="meta2">${C.esc(r.by || '')} · ${C.esc(r.decidedAt || '')}${r.reason ? ' · ' + C.esc(r.reason) : ''}</div>`}</div>`; };
    C.openG(`<h2>Kelulusan</h2><p class="muted" style="margin:2px 0 10px">Lulus <b>batal order</b> terus membatalkan order; lulus <b>diskaun</b> terus mengurangkan invois.</p>
      ${pend.map(card).join('') || '<p class="muted">Tiada permintaan menunggu. 👍</p>'}
      ${done.length ? `<p class="sec-h">Sejarah</p>${done.map(card).join('')}` : ''}${close}`);
    document.querySelectorAll('[data-ap]').forEach((b) => b.onclick = () => { if (!confirm('Luluskan ' + b.dataset.ap + '?')) return; act(() => C.API.adminDecide(C.pw(), b.dataset.ap, 'Diluluskan', ''), 'Diluluskan.', async () => { await C.reload(); approvalsSheet(); }); });
    document.querySelectorAll('[data-rj]').forEach((b) => b.onclick = () => { const r = prompt('Sebab tolak ' + b.dataset.rj + '?'); if (!r) return; act(() => C.API.adminDecide(C.pw(), b.dataset.rj, 'Ditolak', r), 'Ditolak.', approvalsSheet); });
  }

  /* ---------- HQ targets ---------- */
  function spMonthPcs(phone, m) { return C.state().orders.filter((o) => o.phone === phone && o.status !== 'Dibatalkan' && monthOf(o.date) === m).reduce((a, o) => a + o.total, 0); }
  function targetsSheet() {
    const S = C.state(), t = (S.setts && S.setts.targets) || {}, m = monthOf(C_today());
    C.openG(`<h2>Sasaran bulanan</h2><p class="muted" style="margin:2px 0 10px">Biji yang setiap salesperson patut order dari HQ sebulan. Mereka nampak sasaran ini di app.</p>
      <div class="clist">${S.sps.filter((s) => s.status === 'Aktif').map((s) => { const done = spMonthPcs(s.phone, m), tg = t[s.code] || 0;
        return `<div class="prow" style="grid-template-columns:1fr 100px"><span><b>${C.esc(s.name)}</b><br><small class="muted">${C.esc(s.code)} · bulan ini ${done}${tg ? '/' + tg + ' (' + Math.round(done / tg * 100) + '%)' : ''} biji</small></span><input class="inp" data-tg="${C.esc(s.code)}" inputmode="numeric" placeholder="0" value="${tg || ''}"></div>`; }).join('')}</div>
      <div class="acts"><button class="btn btn-o" type="button" data-gclose>Batal</button><button class="btn btn-p" type="button" id="tg-save">Simpan</button></div>`);
    $('tg-save').onclick = () => { const out = {}; document.querySelectorAll('[data-tg]').forEach((i) => { const v = Math.floor(num(i.value) || 0); if (v > 0) out[i.dataset.tg] = v; }); C.saveSettings({ targets: out }, 'Sasaran disimpan.'); };
  }
  function targetLine(phone) {
    const S = C.state(), s = S.sps.find((x) => x.phone === phone), tg = s && S.setts && S.setts.targets ? S.setts.targets[s.code] : 0;
    if (!tg) return ''; const done = spMonthPcs(phone, monthOf(C_today())), pct = Math.min(100, done / tg * 100);
    return `<div class="meta2" style="margin-top:8px">Sasaran HQ bulan ini: <b>${done}/${tg} biji</b> (${Math.round(done / tg * 100)}%)</div><span class="tg-bar" style="margin-top:4px"><i style="width:${pct}%"></i></span>`;
  }

  /* ---------- all customers in the network ---------- */
  function customersSheet() {
    const S = C.state(), T = S.tree, F = window.SC_CONFIG.FLAVOURS, out = [], who = {};
    S.orders.filter((o) => o.status !== 'Dibatalkan').forEach((o) => { const rec = (((T.spSales || {})[o.code]) || {}).items || {}, s = S.sps.find((x) => x.phone === o.phone);
      F.forEach((f) => ((rec[f.id] || {}).lines || []).forEach((l) => { out.push({ date: o.date, ref: o.code, fid: f.id, flavour: f.name, qty: l.qty, price: Number(l.price), cust: l.cust, cphone: l.cphone, tx: l.tx, by: s ? s.name : o.phone }); })); });
    T.dists.forEach((d) => { const rec = ((T.sales[d.code]) || {}).items || {}, a = T.agents.find((x) => x.code === d.agent);
      F.forEach((f) => ((rec[f.id] || {}).lines || []).forEach((l) => { out.push({ date: d.date, ref: d.code, fid: f.id, flavour: f.name, qty: l.qty, price: Number(l.price), cust: l.cust, cphone: l.cphone, tx: l.tx, by: (a ? a.name : d.agent) + ' (agent)' }); })); });
    const list = window.SC_CUST.build(out, C.API.normPhone, (p) => /^0\d{8,10}$/.test(p));
    list.forEach((c) => { const by = new Set(out.filter((p) => (c.phone && C.API.normPhone(p.cphone || '') === c.phone) || (!c.phone && String(p.cust || '').trim().toLowerCase() === c.name.toLowerCase())).map((p) => p.by)); who[c.key] = [...by].join(', '); });
    const draw = (q2) => { q2 = q2.toLowerCase(); $('cu-list').innerHTML = list.filter((c) => !q2 || [c.name, c.phone, who[c.key]].join(' ').toLowerCase().includes(q2)).slice(0, 150).map((c) =>
      `<div class="payrow"><span><b>${C.esc(c.name)}</b><small>${c.phone ? C.esc(c.phone) + ' · ' : ''}${c.visits}× beli · ${c.pcs} biji · terakhir ${C.esc(C.fmtDate(c.last))}</small><small>Penjual: ${C.esc(who[c.key])}</small></span><span style="text-align:right"><b>${C.RM(c.spent)}</b>${c.phone ? `<a class="linkbtn pk" href="https://wa.me/6${C.esc(c.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</span></div>`).join('') || '<p class="muted">Tiada pelanggan.</p>'; };
    C.openG(`<h2>Semua pelanggan</h2><p class="muted" style="margin:2px 0 8px">${list.length} pelanggan dari rekod jualan salesperson &amp; agent. Nilai ikut harga yang ditulis pada jualan.</p>
      <input class="inp" id="cu-q" type="search" placeholder="Cari nama, telefon, penjual…" style="margin-bottom:8px"><div class="clist lglist" id="cu-list"></div>${close}`);
    $('cu-q').oninput = () => draw($('cu-q').value); draw('');
  }

  /* ---------- security: password + backup ---------- */
  function securitySheet() {
    C.openG(`<h2>Keselamatan</h2><p class="sec-h">Tukar kata laluan admin</p><div class="fields">
      <label class="f">Kata laluan baru <small>Sekurang-kurangnya 8 aksara</small><input class="inp" id="pw-new" type="password" autocomplete="new-password"></label>
      <label class="f">Ulang kata laluan baru<input class="inp" id="pw-new2" type="password" autocomplete="new-password"></label>
      <button class="btn btn-p btn-block" type="button" id="pw-go">Tukar kata laluan</button></div>
      <p class="sec-h">Backup data</p><p class="muted" style="margin:0 0 8px;font-size:13px">Muat turun salinan semua tab Google Sheet + tetapan (tanpa kata laluan) sebagai fail JSON. Simpan di tempat selamat. Google Sheet juga ada <b>File → Version history</b>.</p>
      <button class="btn btn-o btn-block" type="button" id="bk-go">Muat turun backup</button>
      <p class="sec-h">Sesi salesperson</p><p class="muted" style="margin:0;font-size:13px">Untuk log keluar paksa seorang salesperson (cth. telefon hilang), buka <b>Salesperson</b> → <b>Tamat sesi</b>.</p>${close}`);
    $('pw-go').onclick = async () => { const a = $('pw-new').value, b = $('pw-new2').value; if (a !== b) return C.toast('Kata laluan tidak sama.', true);
      try { await C.API.adminChangePassword(C.pw(), a); C.setPw(a); C.toast('Kata laluan ditukar.'); C.closeG(); C.reload(); } catch (err) { C.toast(err.message, true); } };
    $('bk-go').onclick = async () => { try { const r = await C.API.adminBackup(C.pw()), blob = new Blob([JSON.stringify(r.backup, null, 1)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `ngap-backup-${C_today()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); C.toast('Backup dimuat turun.'); } catch (err) { C.toast(err.message, true); } };
  }

  window.SC_HQ = {
    init(ctx) { C = ctx; },
    set(d) { if (d) D = Object.assign(D, d); },
    data: () => D, refresh, costPer, pnl, pnlHTML, homeAlerts, targetLine,
    open: { products: productsSheet, expenses: expensesSheet, materials: materialsSheet, purchases: purchasesSheet, approvals: approvalsSheet,
            targets: targetsSheet, customers: customersSheet, security: securitySheet }
  };
})();
