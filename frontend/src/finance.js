// Shared money helpers for the admin and salesperson apps.
(function () {
  window.SC_FIN = {
    /**
     * Payment status per HQ invoice. A salesperson's payments settle their oldest invoices first (FIFO).
     * invoices: [{ code, phone, date, amount }], payments: [{ phone, amount }]
     * returns { [code]: { paid, due, status: 'Lunas' | 'Separa' | 'Belum bayar' | 'Batal' } } plus .credit[phone] (overpaid)
     */
    allocate(invoices, payments) {
      const out = { credit: {} }, byPhone = {};
      payments.forEach((y) => { byPhone[y.phone] = (byPhone[y.phone] || 0) + (Number(y.amount) || 0); });
      const groups = {};
      invoices.forEach((v) => (groups[v.phone] = groups[v.phone] || []).push(v));
      Object.entries(groups).forEach(([phone, list]) => {
        let pool = byPhone[phone] || 0;
        list.slice().sort((a, b) => (a.date + a.code).localeCompare(b.date + b.code)).forEach((v) => {
          const amt = Math.round((Number(v.amount) || 0) * 100) / 100;
          if (amt <= 0) { out[v.code] = { paid: 0, due: 0, status: v.status === 'Dibatalkan' ? 'Batal' : 'Lunas' }; return; }
          const paid = Math.min(amt, Math.max(0, pool)); pool = Math.round((pool - paid) * 100) / 100;
          const due = Math.round((amt - paid) * 100) / 100;
          out[v.code] = { paid, due, status: due <= 0.004 ? 'Lunas' : paid > 0.004 ? 'Separa' : 'Belum bayar' };
        });
        if (pool > 0.004) out.credit[phone] = pool;
      });
      Object.keys(byPhone).forEach((p) => { if (!groups[p] && byPhone[p] > 0) out.credit[p] = byPhone[p]; });
      return out;
    },
    payPill(status) {
      const cls = { 'Lunas': 'st-Siap', 'Separa': 'st-Dikemaskini', 'Belum bayar': 'st-Baru', 'Batal': 'st-Dibatalkan' }[status] || 'st-Baru';
      return `<span class="pill ${cls}">${status}</span>`;
    }
  };
})();
