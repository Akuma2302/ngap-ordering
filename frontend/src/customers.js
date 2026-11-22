// Customers built from sales lines (name / phone typed when recording a sale).
// Used by the salesperson and agent apps: a searchable list page and a detail page per customer.
(function () {
  const DAY = 864e5;
  const daysSince = (iso) => { if (!iso) return null; const [y, m, d] = iso.split('-'); const t = new Date(+y, m - 1, +d), n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((n - t) / DAY); };
  const agoTxt = (n) => n === null ? '-' : n <= 0 ? 'hari ini' : n === 1 ? 'semalam' : n < 30 ? `${n} hari lepas` : n < 365 ? `${Math.round(n / 30)} bulan lepas` : `${Math.round(n / 365)} tahun lepas`;

  window.SC_CUST = {
    /**
     * purchases: [{ date, ref, fid, flavour, qty, price, cust, cphone, tx }]
     * returns customers sorted by spend: { key, name, phone, spent, pcs, visits, first, last, fav: [[flavour, pcs]], txs: [{ id, date, ref, items, total }] }
     */
    build(purchases, normPhone, validPhone) {
      const map = new Map();
      purchases.forEach((p) => {
        const name = String(p.cust || '').trim(), ph = normPhone(p.cphone || '');
        if (!name && !validPhone(ph)) return;
        const key = validPhone(ph) ? ph : 'n-' + name.toLowerCase().replace(/\s+/g, '-');
        const c = map.get(key) || { key, name: '', phone: validPhone(ph) ? ph : '', spent: 0, pcs: 0, first: '', last: '', favMap: {}, txMap: new Map() };
        if (name && !c.name) c.name = name;
        const qty = Math.floor(Number(p.qty)) || 0, val = isNaN(p.price) ? 0 : qty * p.price;
        c.pcs += qty; c.spent += val; c.favMap[p.flavour] = (c.favMap[p.flavour] || 0) + qty;
        if (!c.first || p.date < c.first) c.first = p.date;
        if (!c.last || p.date > c.last) c.last = p.date;
        const tk = p.tx || `${p.ref}|${p.fid}`;
        const t = c.txMap.get(tk) || { id: tk, date: p.date, ref: p.ref, items: [], total: 0 };
        t.items.push({ flavour: p.flavour, qty, price: p.price }); t.total += val; c.txMap.set(tk, t);
        map.set(key, c);
      });
      return [...map.values()].map((c) => {
        const txs = [...c.txMap.values()].sort((a, b) => b.date.localeCompare(a.date));
        return { key: c.key, name: c.name || c.phone, phone: c.phone, spent: c.spent, pcs: c.pcs, visits: txs.length, first: c.first, last: c.last,
                 days: daysSince(c.last), fav: Object.entries(c.favMap).sort((a, b) => b[1] - a[1]), txs };
      }).sort((a, b) => b.spent - a.spent || b.pcs - a.pcs);
    },

    tags(c, all) {
      const t = [];
      const top = all.length >= 5 ? all[Math.max(0, Math.ceil(all.length * 0.2) - 1)].spent : Infinity;
      if (c.spent >= top && c.spent > 0) t.push(['vip', 'VIP']);
      if (c.visits >= 3) t.push(['tetap', 'Pelanggan tetap']);
      else if (c.visits === 1) t.push(['baru', 'Sekali beli']);
      if (c.days !== null && c.days > 30) t.push(['lama', 'Lama tak beli']);
      return t;
    },

    // Keep only purchases inside the chosen date range / weekday / flavour.
    range(st) {
      const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const now = new Date(), y = now.getFullYear(), m = now.getMonth(), back = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
      switch (st.period) {
        case 'today': return [iso(now), iso(now)];
        case '7d': return [back(6), iso(now)];
        case '30d': return [back(29), iso(now)];
        case 'month': return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
        case 'lastmonth': return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
        case 'custom': return [st.from || '', st.to || ''];
        default: return ['', ''];
      }
    },
    filter(purchases, st) {
      const [from, to] = this.range(st);
      return purchases.filter((p) => {
        if (from && p.date < from) return false;
        if (to && p.date > to) return false;
        if (st.dow !== undefined && st.dow !== '') { const [y, m, d] = p.date.split('-'); if (new Date(+y, m - 1, +d).getDay() !== Number(st.dow)) return false; }
        if (st.flavour && p.fid !== st.flavour) return false;
        return true;
      });
    },

    /** purchases: all sales lines; st: filter state (mutated here); rerender(): called after any filter change */
    renderList(el, purchases, st, h, rerender) {
      const { esc, RM, initials, flavours, normPhone, validPhone } = h;
      st.sort = st.sort || 'spend'; st.period = st.period || 'all';
      const all = this.build(purchases, normPhone, validPhone);
      // flavour filter keeps the customers who bought it, but shows their full spend in the period
      const inPeriod = this.filter(purchases, Object.assign({}, st, { flavour: '' }));
      const buyers = st.flavour ? new Set(this.build(this.filter(purchases, st), normPhone, validPhone).map((c) => c.key)) : null;
      const customers = this.build(inPeriod, normPhone, validPhone).filter((c) => !buyers || buyers.has(c.key)).map((c) => {
        const full = all.find((x) => x.key === c.key); return Object.assign(c, { days: full ? full.days : c.days, everVisits: full ? full.visits : c.visits });
      });
      const q = (st.q || '').trim().toLowerCase();
      let list = customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, '') || '~'));
      if (st.tag) list = list.filter((c) => this.tags(c, customers).some(([k]) => k === st.tag));
      if (st.sort === 'recent') list = [...list].sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));
      else if (st.sort === 'idle') list = [...list].filter((c) => c.days !== null && c.days > 30).sort((a, b) => b.days - a.days);
      else if (st.sort === 'often') list = [...list].sort((a, b) => b.visits - a.visits || b.spent - a.spent);
      const repeat = customers.filter((c) => c.visits >= 2).length, total = customers.reduce((a, c) => a + c.spent, 0), avg = customers.length ? total / customers.length : 0;
      const PERIODS = [['all', 'Semua'], ['today', 'Hari ini'], ['7d', '7 hari'], ['30d', '30 hari'], ['month', 'Bulan ini'], ['lastmonth', 'Bulan lepas'], ['custom', 'Pilih tarikh']];
      const DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
      const active = (st.period !== 'all') + (st.dow !== undefined && st.dow !== '') + !!st.flavour + !!st.tag;
      el.innerHTML = `
        <div class="minis">
          <div class="mini"><b>${customers.length}</b><span>Pelanggan</span></div>
          <div class="mini"><b>${RM(total).replace('.00', '')}</b><span>Jualan</span></div>
          <div class="mini"><b>${customers.length ? Math.round(repeat / customers.length * 100) : 0}%</b><span>Beli semula</span></div>
        </div>
        <div class="cu-tools">
          <input class="inp" type="search" id="cu-q" placeholder="Cari nama atau telefon…" value="${esc(st.q || '')}" enterkeyhint="search">
          <div class="cu-sort" aria-label="Tempoh">${PERIODS.map(([k, l]) => `<button type="button" class="fchip${st.period === k ? ' on' : ''}" data-period="${k}">${l}</button>`).join('')}</div>
          ${st.period === 'custom' ? `<div class="cu-dates"><label>Dari<input class="inp" type="date" data-f="from" value="${esc(st.from || '')}"></label><label>Hingga<input class="inp" type="date" data-f="to" value="${esc(st.to || '')}"></label></div>` : ''}
          <div class="cu-sel">
            <select class="inp" data-f="dow" aria-label="Hari"><option value="">Semua hari</option>${DAYS.map((d, i) => `<option value="${i}"${String(st.dow) === String(i) ? ' selected' : ''}>${d}</option>`).join('')}</select>
            <select class="inp" data-f="flavour" aria-label="Perisa"><option value="">Semua perisa</option>${flavours.map((f) => `<option value="${esc(f.id)}"${st.flavour === f.id ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select>
            <select class="inp" data-f="tag" aria-label="Label"><option value="">Semua label</option>${[['vip', 'VIP'], ['tetap', 'Pelanggan tetap'], ['baru', 'Sekali beli'], ['lama', 'Lama tak beli']].map(([k, l]) => `<option value="${k}"${st.tag === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
          </div>
          <div class="cu-sortrow"><span>Susun:</span>${[['spend', 'Belanja'], ['recent', 'Terkini'], ['often', 'Kerap'], ['idle', 'Lama tak beli']].map(([k, l]) => `<button type="button" class="linkchip${st.sort === k ? ' on' : ''}" data-sort="${k}">${l}</button>`).join('')}
            ${active ? `<button type="button" class="linkbtn cu-reset" data-reset>Reset tapisan (${active})</button>` : ''}</div>
          <p class="cu-count">${list.length} pelanggan${st.period !== 'all' || st.dow !== undefined && st.dow !== '' || st.flavour ? ' · ' + this.summary(st, PERIODS, DAYS, flavours) : ''} · purata ${RM(avg)}</p>
        </div>
        <div class="cu-list">${list.map((c, i) => `
          <button type="button" class="cu-card" data-cust="${esc(c.key)}">
            <span class="av av-lg">${esc(initials(c.name))}</span>
            <span class="cu-main">
              <b>${esc(c.name)}</b>
              <small>${c.phone ? esc(c.phone) + ' · ' : ''}${c.visits} kali beli · ${agoTxt(c.days)}</small>
              <span class="cu-tags">${this.tags(c, customers).map(([k, l]) => `<i class="tg-${k}">${l}</i>`).join('')}</span>
            </span>
            <span class="cu-amt"><b>${RM(c.spent)}</b><small>${c.pcs} biji</small></span>
          </button>`).join('') || `<div class="gcard empty2">${all.length ? 'Tiada pelanggan untuk tapisan ini.' : 'Belum ada rekod pelanggan. Isi nama pelanggan semasa rekod jualan.'}</div>`}</div>`;

      // filter controls (they re-render the list; search keeps its cursor)
      const again = () => rerender && rerender();
      el.querySelectorAll('[data-period]').forEach((b) => b.onclick = () => { st.period = b.dataset.period; again(); });
      el.querySelectorAll('[data-sort]').forEach((b) => b.onclick = () => { st.sort = b.dataset.sort; again(); });
      el.querySelectorAll('select[data-f], input[type=date][data-f]').forEach((x) => x.onchange = () => { st[x.dataset.f] = x.value; again(); });
      const r = el.querySelector('[data-reset]'); if (r) r.onclick = () => { Object.assign(st, { period: 'all', from: '', to: '', dow: '', flavour: '', tag: '' }); again(); };
      const qi = el.querySelector('#cu-q');
      qi.oninput = () => { st.q = qi.value; const pos = qi.selectionStart; again(); const n = el.querySelector('#cu-q'); n.focus(); n.setSelectionRange(pos, pos); };
    },

    summary(st, PERIODS, DAYS, flavours) {
      const out = [];
      if (st.period === 'custom') out.push(st.from || st.to ? `${st.from || '…'} – ${st.to || '…'}` : 'semua tarikh');
      else if (st.period !== 'all') out.push((PERIODS.find(([k]) => k === st.period) || [, ''])[1].toLowerCase());
      if (st.dow !== undefined && st.dow !== '') out.push('hari ' + DAYS[st.dow]);
      if (st.flavour) out.push('beli ' + ((flavours.find((f) => f.id === st.flavour) || {}).name || ''));
      return out.join(' · ');
    },

    renderDetail(el, c, all, h) {
      const { esc, RM, initials, fmtDate, sender } = h;
      if (!c) { el.innerHTML = '<div class="gcard empty2">Pelanggan tidak dijumpai.</div>'; return; }
      const fav = c.fav[0], maxFav = fav ? fav[1] : 1, first = (c.name || '').split(' ')[0];
      const msgs = [
        ['Stok baru', `Hai ${first}! ngap soft cookies ada stok baru minggu ni 🍪 ${fav ? fav[0] + ' kegemaran awak pun ada.' : ''} Nak saya simpankan?`],
        ['Terima kasih', `Terima kasih ${first} sebab beli ngap soft cookies! 🍪 Kalau suka, boleh share dengan kawan-kawan ya.`],
        ['Lama tak jumpa', `Hai ${first}, lama tak order! 🍪 Minggu ni ada perisa baru. Nak cuba?`]
      ];
      el.innerHTML = `
        <div class="gcard cu-head">
          <span class="av cu-av">${esc(initials(c.name))}</span>
          <div class="cu-id"><b>${esc(c.name)}</b><small>${c.phone ? esc(c.phone) : 'Tiada nombor telefon'}</small>
            <span class="cu-tags">${this.tags(c, all).map(([k, l]) => `<i class="tg-${k}">${l}</i>`).join('')}</span></div>
          ${c.phone ? `<div class="cu-acts">
            <a class="btn btn-p btn-sm" target="_blank" rel="noopener" href="https://wa.me/6${esc(c.phone)}">WhatsApp</a>
            <a class="btn btn-o btn-sm" href="tel:${esc(c.phone)}">Telefon</a>
            <button class="btn btn-o btn-sm" type="button" data-copy="${esc(c.phone)}">Salin no.</button></div>` : ''}
        </div>
        <div class="kpis">
          <div class="kpi hl"><span>Jumlah belanja</span><b>${RM(c.spent)}</b><small>${c.pcs} biji · ${c.visits} kali beli</small></div>
          <div class="kpi"><span>Purata setiap beli</span><b>${RM(c.visits ? c.spent / c.visits : 0)}</b><small>${c.visits ? (c.pcs / c.visits).toFixed(1) : 0} biji</small></div>
          <div class="kpi"><span>Terakhir beli</span><b style="font-size:15px">${esc(agoTxt(c.days))}</b><small>${esc(fmtDate(c.last))}</small></div>
          <div class="kpi"><span>Pelanggan sejak</span><b style="font-size:15px">${esc(fmtDate(c.first))}</b><small>${c.visits >= 2 ? 'beli semula' : 'sekali beli'}</small></div>
          <div class="kpi"><span>Kegemaran</span><b style="font-size:15px">${fav ? esc(fav[0]) : '-'}</b><small>${fav ? fav[1] + ' biji' : ''}</small></div>
        </div>
        <p class="sec-h">Perisa dibeli</p>
        <div class="gcard best">${c.fav.map(([n, q], i) => `<div class="best-r"><span class="rk">${i + 1}</span><span class="bn"><b>${esc(n)}</b><i style="width:${q / maxFav * 100}%"></i></span><b class="bq">${q}</b></div>`).join('')}</div>
        ${c.phone ? `<p class="sec-h">Mesej pantas</p>
        <div class="cu-msgs">${msgs.map(([l, m]) => `<a class="fchip" target="_blank" rel="noopener" href="https://wa.me/6${esc(c.phone)}?text=${encodeURIComponent(m)}">${esc(l)}</a>`).join('')}</div>` : ''}
        <p class="sec-h">Sejarah pembelian (${c.txs.length})</p>
        <div class="cu-hist">${c.txs.map((t) => `
          <div role="button" tabindex="0" class="gcard cu-tx" data-ref="${esc(t.ref)}">
            <span class="cu-tx-h"><b>${esc(fmtDate(t.date))}</b><small>${esc(t.ref)}</small><b class="cu-tx-t">${RM(t.total)}</b></span>
            <span class="cu-tx-i">${t.items.map((it) => `<span>${it.qty} × ${esc(it.flavour)}${isNaN(it.price) ? '' : ' @ ' + RM(it.price)}</span>`).join('')}</span>
            ${c.phone ? `<a class="wa" target="_blank" rel="noopener" href="https://wa.me/6${esc(c.phone)}?text=${encodeURIComponent(`Resit ngap soft cookies 🍪\n${fmtDate(t.date)}\n${t.items.map((it) => `• ${it.qty} × ${it.flavour}${isNaN(it.price) ? '' : ` @ RM${it.price.toFixed(2)}`}`).join('\n')}\nJumlah: RM${t.total.toFixed(2)}\n— ${sender()}`)}">Hantar resit</a>` : ''}
          </div>`).join('')}</div>`;
      const cp = el.querySelector('[data-copy]');
      if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(cp.dataset.copy); h.toast('Nombor disalin.'); } catch (e) { h.toast('Tak dapat salin.', true); } };
    }
  };
})();
