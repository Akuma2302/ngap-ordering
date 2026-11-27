/**
 * Customer invoice document (salesperson -> their customer), A4, in the Ngap Cookies invoice style:
 * burgundy band, round "N" logo, bill-to + dates, item table, totals with a Balance Due band, payment details.
 * SC_CINV.doc(inv)       -> HTML of the invoice page
 * SC_CINV.preview(el, inv) -> scaled live preview that fits the container width
 * SC_CINV.print(inv)     -> opens the print dialog (choose "Save as PDF" to get the PDF file)
 */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n2 = (v) => (Number(v) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const DESC = 'Soft cookies, individually wrapped';
  const W = 794;   // A4 width at 96 dpi

  function totals(inv) {
    const items = inv.items || [], pcs = items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
    const sub = Math.round(items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0) * 100) / 100;
    const disc = Math.min(sub, Math.max(0, Number(inv.discount) || 0)), total = Math.round((sub - disc) * 100) / 100;
    return { pcs, sub, disc, total, due: inv.status === 'Dibayar' || inv.status === 'Batal' ? 0 : total };
  }

  function doc(inv) {
    const t = totals(inv), b = inv.bill || {}, k = inv.bank || {}, s = inv.seller || {};
    const terms = Number(inv.terms) || 0;
    const stamp = inv.status === 'Dibayar' ? '<div class="ci-stamp">PAID</div>' : inv.status === 'Batal' ? '<div class="ci-stamp void">VOID</div>' : '';
    const row = (it, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(it.name)}</b>${it.desc ? `<small>${esc(it.desc)}</small>` : ''}</td>
      <td class="r">${Number(it.qty) || 0}</td><td class="r">${n2(it.rate)}</td><td class="r">${n2((Number(it.qty) || 0) * (Number(it.rate) || 0))}</td></tr>`;
    return `<article class="ci-doc">
      <div class="ci-band"></div>${stamp}
      <header class="ci-head">
        <div class="ci-brand"><span class="ci-logo">N</span><span><b>Ngap Cookies</b><small>Malaysia</small>${s.name ? `<small>${esc(s.name)}${s.phone ? ' · ' + esc(s.phone) : ''}</small>` : ''}</span></div>
        <div class="ci-title"><h1>INVOICE</h1><p># ${esc(inv.no || 'DRAF')}</p><small>BALANCE DUE</small><strong>MYR ${n2(t.due)}</strong></div>
      </header>
      <section class="ci-meta">
        <div class="ci-bill"><small>BILL TO</small><b>${esc(b.name || '-')}</b>${b.addr ? `<p>${esc(b.addr).replace(/\n/g, '<br>')}</p>` : ''}${b.email ? `<p>${esc(b.email)}</p>` : ''}${b.phone ? `<p>${esc(b.phone)}</p>` : ''}</div>
        <dl class="ci-dates"><dt>Invoice Date :</dt><dd>${dmy(inv.date)}</dd><dt>Terms :</dt><dd>${terms ? 'Net ' + terms : 'Due on receipt'}</dd><dt>Due Date :</dt><dd>${dmy(inv.due || inv.date)}</dd></dl>
      </section>
      <table class="ci-tbl"><thead><tr><th class="c">#</th><th>DESCRIPTION</th><th class="r">QTY</th><th class="r">RATE (RM)</th><th class="r">AMOUNT (RM)</th></tr></thead>
        <tbody>${(inv.items || []).map(row).join('')}</tbody></table>
      <section class="ci-sum">
        <dl><dt>Sub Total <small>(${t.pcs} pcs)</small></dt><dd>${n2(t.sub)}</dd>
        ${t.disc ? `<dt>Discount</dt><dd>(-) ${n2(t.disc)}</dd>` : ''}
        <dt class="tot">Total</dt><dd class="tot">MYR ${n2(t.total)}</dd></dl>
        <div class="ci-due"><span>Balance Due</span><b>MYR ${n2(t.due)}</b></div>
      </section>
      ${k.acc || k.bank || k.name ? `<section class="ci-pay"><small>PAYMENT DETAILS</small><p>Please make payment to the account below and share the receipt once paid.</p>
        <div class="ci-acc"><div><small>ACCOUNT NAME</small><b>${esc(k.name || '-')}</b></div><div><small>BANK</small><b>${esc(k.bank || '-')}</b></div><div><small>ACCOUNT NUMBER</small><b>${esc(k.acc || '-')}</b></div></div></section>` : ''}
      ${inv.note ? `<section class="ci-note"><small>NOTES</small><p>${esc(inv.note).replace(/\n/g, '<br>')}</p></section>` : ''}
      <footer class="ci-foot"><p>We sincerely hope to build a long-term business relationship with you. Please do not hesitate to contact us if you need any clarification.</p><span class="ci-ty">thank you</span></footer>
    </article>`;
  }

  // Fit the A4 page into the container (keeps exact layout, just scaled).
  function preview(el, inv) {
    el.classList.add('ci-prev');
    el.innerHTML = `<div class="ci-scale">${doc(inv)}</div>`;
    const fit = () => {
      const sc = Math.min(1, el.clientWidth / W), d = el.firstElementChild;
      d.style.transform = `scale(${sc})`; el.style.height = Math.ceil(d.firstElementChild.offsetHeight * sc) + 'px';
    };
    fit(); requestAnimationFrame(fit);
    if (!el._ro && window.ResizeObserver) { el._ro = new ResizeObserver(fit); el._ro.observe(el); }
  }

  function print(inv) {
    let box = document.getElementById('cinv-print');
    if (!box) { box = document.createElement('div'); box.id = 'cinv-print'; document.body.appendChild(box); }
    box.innerHTML = doc(inv);
    const title = document.title, name = String((inv.bill || {}).name || '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '');
    document.title = `Invoice-${inv.no || 'DRAF'}${name ? '-' + name : ''}`;
    document.body.classList.add('cinv-printing');
    const done = () => { document.body.classList.remove('cinv-printing'); document.title = title; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);   // print-only CSS: the screen is not affected if afterprint never fires
  }

  window.SC_CINV = { doc, preview, print, totals, DESC };
})();
