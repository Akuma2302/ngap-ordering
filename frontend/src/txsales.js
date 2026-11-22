// Sales recorded per customer: each sale = one customer + several rows of (flavour, qty, price).
// Stored as per-flavour lines tagged with the sale id (tx), so all existing profit maths keeps working.
(function () {
  let seq = 0;
  const newId = () => 't' + Date.now().toString(36) + (seq++).toString(36);

  window.SC_TX = {
    /**
     * @param root     element to render into
     * @param o.flavours [{ id, name }] flavours available in this order/stock
     * @param o.qty      { id: total pieces }
     * @param o.reserved (id) => pieces already used elsewhere (e.g. given to agents)
     * @param o.getLines (id) => [{ qty, price, cust, cphone, tx }]
     * @param o.setLines (id, lines) => void
     * @param o.defPrice (id) => default selling price (NaN when not set)
     * @param o.onChange () => void   called after every change (save + refresh totals)
     */
    mount(root, o) {
      const { esc, RM, money, num, validPhone, normPhone, toast } = o.h;
      const dis = o.disabled ? 'disabled' : '';
      let txs = [];

      function build() {
        const map = new Map();
        o.flavours.forEach((f) => (o.getLines(f.id) || []).forEach((l) => {
          // older records have no sale id: group them by customer so they still read naturally
          const k = l.tx || `old|${l.cust || ''}|${l.cphone || ''}`;
          if (!map.has(k)) map.set(k, { id: l.tx || newId(), cust: l.cust || '', cphone: l.cphone || '', items: [] });
          map.get(k).items.push({ fid: f.id, qty: Math.floor(Number(l.qty)) || 0, price: money(l.price) });
        }));
        txs = [...map.values()];
      }
      function flush() {
        o.flavours.forEach((f) => o.setLines(f.id, []));
        const by = {};
        txs.forEach((t) => t.items.forEach((it) => {
          if (!it.fid) return;
          (by[it.fid] = by[it.fid] || []).push({ qty: Math.floor(Number(it.qty)) || 0, price: num(it.price) ?? '', cust: t.cust, cphone: t.cphone, tx: t.id });
        }));
        Object.entries(by).forEach(([fid, ls]) => o.setLines(fid, ls));
        o.onChange();
      }
      const usedBy = (fid, skip) => txs.reduce((a, t) => a + t.items.reduce((b, it) => b + (it.fid === fid && it !== skip ? (Math.floor(Number(it.qty)) || 0) : 0), 0), 0);
      const leftOf = (fid, skip) => (o.qty[fid] || 0) - o.reserved(fid) - usedBy(fid, skip);
      const priceOf = (it) => (it.price !== '' && it.price !== null && it.price !== undefined ? Number(it.price) : o.defPrice(it.fid));
      const name = (fid) => (o.flavours.find((f) => f.id === fid) || {}).name || '';
      const txTotal = (t) => t.items.reduce((a, it) => { const p = priceOf(it); return a + (isNaN(p) ? 0 : (Number(it.qty) || 0) * p); }, 0);
      const receipt = (t) => `Terima kasih${t.cust ? ', ' + t.cust : ''}! 🍪\n` +
        t.items.filter((it) => it.fid && Number(it.qty)).map((it) => { const p = priceOf(it); return `• ${it.qty} × ${name(it.fid)}${isNaN(p) ? '' : ` @ RM${p.toFixed(2)} = RM${(it.qty * p).toFixed(2)}`}`; }).join('\n') +
        `\nJumlah: RM${txTotal(t).toFixed(2)}\n— ${o.sender()}`;

      function rowHTML(t, it, j) {
        const opts = o.flavours.map((f) => { const left = leftOf(f.id, it);
          return `<option value="${f.id}"${f.id === it.fid ? ' selected' : ''}${left <= 0 && f.id !== it.fid ? ' disabled' : ''}>${esc(f.name)} (baki ${Math.max(0, left)})</option>`; }).join('');
        return `<div class="tx-row" data-r="${j}">
          <select class="inp" data-f="fid" ${dis} aria-label="Perisa"><option value="">Pilih perisa…</option>${opts}</select>
          <input class="inp" data-f="qty" type="number" inputmode="numeric" min="0" value="${esc(it.qty || '')}" placeholder="Bil." ${dis} aria-label="Bilangan">
          <span class="x">×</span>
          <input class="inp" data-f="price" inputmode="decimal" value="${esc(it.price)}" placeholder="${esc(money(o.defPrice(it.fid)) || 'RM')}" ${dis} aria-label="Harga seunit">
          ${o.disabled ? '' : '<button class="ldel" type="button" data-del-row aria-label="Buang perisa">×</button>'}
          <span class="st"></span>
        </div>`;
      }
      function render() {
        const custs = (o.customers() || []).filter((c) => c.name);
        root.innerHTML = `<datalist id="tx-custs">${custs.map((c) => `<option value="${esc(c.name)}">${esc(c.phone || '')}</option>`).join('')}</datalist>
          ${txs.map((t, i) => `<div class="tx-card" data-t="${i}">
            <div class="tx-h">
              <span class="tx-no">${i + 1}</span>
              <input class="inp" data-c="cust" list="tx-custs" placeholder="Nama pelanggan" value="${esc(t.cust)}" ${dis}>
              <input class="inp" data-c="cphone" type="tel" inputmode="tel" placeholder="No. telefon" value="${esc(t.cphone)}" ${dis}>
              ${o.disabled ? '' : '<button class="ldel" type="button" data-del-tx aria-label="Buang jualan ini">×</button>'}
            </div>
            <div class="tx-rows">${t.items.map((it, j) => rowHTML(t, it, j)).join('')}</div>
            <div class="tx-f">
              ${o.disabled ? '<span></span>' : '<button class="linkbtn add" type="button" data-add-row>+ Tambah perisa</button>'}
              <span class="tx-tot"></span>
              <a class="wa hidden" target="_blank" rel="noopener">Resit</a>
            </div>
          </div>`).join('') || '<p class="none">Belum ada jualan. Tekan <b>+ Jualan baru</b> bila pelanggan beli.</p>'}
          ${o.disabled ? '' : '<button class="btn btn-p btn-sm addline" type="button" data-add-tx>+ Jualan baru (pelanggan)</button>'}`;
        totals();
      }
      function totals() {
        root.querySelectorAll('.tx-card').forEach((card) => {
          const t = txs[card.dataset.t];
          card.querySelectorAll('.tx-row').forEach((row) => { const it = t.items[row.dataset.r], p = priceOf(it), n = Number(it.qty) || 0;
            row.querySelector('.st').textContent = it.fid && n && !isNaN(p) ? '= ' + RM(n * p) : ''; });
          card.querySelector('.tx-tot').innerHTML = `<b>${RM(txTotal(t))}</b> · ${t.items.reduce((a, it) => a + (Number(it.qty) || 0), 0)} biji`;
          const wa = card.querySelector('.wa'), ok = validPhone(t.cphone);
          wa.classList.toggle('hidden', !ok);
          if (ok) wa.href = `https://wa.me/6${normPhone(t.cphone)}?text=${encodeURIComponent(receipt(t))}`;
        });
        const add = root.querySelector('[data-add-tx]');
        if (add) add.disabled = o.flavours.every((f) => leftOf(f.id) <= 0);
      }
      const firstWithStock = (skip) => (o.flavours.find((f) => leftOf(f.id, skip) > 0) || {}).id || '';

      root.addEventListener('click', (e) => {
        if (o.disabled) return;
        if (e.target.closest('[data-add-tx]')) {
          const fid = firstWithStock(); if (!fid) return toast('Semua stok dah terjual.', true);
          txs.push({ id: newId(), cust: '', cphone: '', items: [{ fid, qty: 1, price: money(o.defPrice(fid)) }] });
          render(); flush();
          const last = root.querySelector('.tx-card:last-of-type [data-c=cust]'); if (last) last.focus();
          return;
        }
        const card = e.target.closest('.tx-card'); if (!card) return;
        const t = txs[card.dataset.t];
        if (e.target.closest('[data-del-tx]')) {
          if (t.items.some((it) => Number(it.qty)) && !confirm(`Buang jualan ${t.cust || 'ini'}?`)) return;
          txs.splice(Number(card.dataset.t), 1); render(); flush();
        } else if (e.target.closest('[data-add-row]')) {
          const fid = o.flavours.find((f) => leftOf(f.id) > 0 && !t.items.some((it) => it.fid === f.id))?.id || firstWithStock();
          if (!fid) return toast('Semua stok dah terjual.', true);
          t.items.push({ fid, qty: 1, price: money(o.defPrice(fid)) }); render(); flush();
        } else if (e.target.closest('[data-del-row]')) {
          t.items.splice(Number(e.target.closest('.tx-row').dataset.r), 1);
          if (!t.items.length) txs.splice(Number(card.dataset.t), 1);
          render(); flush();
        }
      });
      root.addEventListener('change', (e) => {
        const card = e.target.closest('.tx-card'); if (!card) return;
        const t = txs[card.dataset.t];
        if (e.target.dataset.c) {
          t[e.target.dataset.c] = e.target.value.trim();
          if (e.target.dataset.c === 'cust' && !t.cphone) {   // known customer: fill in the phone
            const c = (o.customers() || []).find((x) => x.name && x.name.toLowerCase() === t.cust.toLowerCase());
            if (c && c.phone) { t.cphone = c.phone; card.querySelector('[data-c=cphone]').value = c.phone; }
          }
          flush(); totals(); return;
        }
        const row = e.target.closest('.tx-row'); if (!row) return;
        const it = t.items[row.dataset.r], f = e.target.dataset.f;
        if (f === 'fid') {
          it.fid = e.target.value; if (!it.price) it.price = money(o.defPrice(it.fid));
          it.qty = Math.min(Number(it.qty) || 1, Math.max(0, leftOf(it.fid, it)));
          render(); flush(); return;
        }
        if (f === 'qty') {
          const max = it.fid ? leftOf(it.fid, it) : 0, n = Math.max(0, Math.floor(Number(e.target.value)) || 0);
          if (n > max) toast(`Baki ${name(it.fid)} hanya ${max} biji.`, true);
          it.qty = Math.min(n, max); e.target.value = it.qty;
        } else if (f === 'price') {
          const v = num(e.target.value); if (v === null) toast('Harga tidak sah.', true);
          it.price = v === null ? '' : money(v); e.target.value = it.price;
        }
        flush();
        // option labels show stock left, refresh them without losing focus order
        root.querySelectorAll('.tx-card').forEach((c2) => c2.querySelectorAll('.tx-row').forEach((r2) => {
          const it2 = txs[c2.dataset.t].items[r2.dataset.r];
          r2.querySelectorAll('option[value]').forEach((op) => { if (!op.value) return; const left = leftOf(op.value, it2);
            op.textContent = `${name(op.value)} (baki ${Math.max(0, left)})`; op.disabled = left <= 0 && op.value !== it2.fid; });
        }));
        totals();
      });
      root.addEventListener('focusin', (e) => { if (e.target.matches('input[data-f]')) e.target.select(); });

      build(); render();
      return { refresh() { build(); render(); }, count: () => txs.length };
    }
  };
})();
