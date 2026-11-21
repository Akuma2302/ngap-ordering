// Soft Cookies ordering — API client.
// Talks to the Apps Script web app, or to a localStorage mock when SCRIPT_URL is empty (demo mode).
(function () {
  const cfg = window.SC_CONFIG;
  const DEMO = !cfg.SCRIPT_URL;

  async function remote(action, payload) {
    let res;
    try {
      // text/plain avoids a CORS preflight, which Apps Script cannot answer.
      res = await fetch(cfg.SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action }, payload))
      });
    } catch (e) {
      throw new Error('Tiada sambungan internet. Cuba lagi.');
    }
    let data;
    try { data = await res.json(); } catch (e) { throw new Error('Server tidak memberi jawapan yang sah.'); }
    if (!data.ok) throw new Error(data.error || 'Ralat tidak diketahui.');
    return data;
  }

  /* ---------- demo backend (mirrors Code.gs) ---------- */
  const KEY = 'sc-demo-orders';
  const DEMO_PASSWORD = 'admin';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const save = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} };
  const stamp = () => {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const normPhone = (p) => {
    let d = String(p || '').replace(/\D/g, '');
    if (d.startsWith('60')) d = d.slice(1);
    if (d && d[0] !== '0') d = '0' + d;
    return d;
  };
  const normCode = (c) => { c = String(c || '').trim().toUpperCase(); return c && !c.startsWith('SC-') ? 'SC-' + c : c; };

  function clean(o) {
    o = o || {};
    const name = String(o.name || '').trim(), phone = normPhone(o.phone);
    const method = o.method === 'Hantar' ? 'Hantar' : 'Ambil', date = String(o.date || '').trim();
    if (!name) throw new Error('Sila isi nama agent.');
    if (phone.length < 9 || phone.length > 12) throw new Error('Nombor telefon tidak sah.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Sila pilih tarikh ' + method.toLowerCase() + '.');
    if (method === 'Hantar' && !String(o.address || '').trim()) throw new Error('Sila isi alamat penghantaran.');
    const items = {}; let total = 0;
    cfg.FLAVOURS.forEach((f) => {
      const q = Math.max(0, Math.min(9999, Math.floor(Number((o.items || {})[f.id]) || 0)));
      items[f.id] = q; total += q;
    });
    if (total < 1) throw new Error('Sila pilih sekurang-kurangnya 1 cookie.');
    return { name, phone, method, date, time: String(o.time || ''), address: String(o.address || '').trim(),
             notes: String(o.notes || '').trim(), items, total };
  }

  function findIdx(list, code, phone) {
    code = normCode(code);
    const i = list.findIndex((o) => o.code === code && (phone === null || o.phone === normPhone(phone)));
    if (i < 0) throw new Error('Order tidak dijumpai. Semak kod order dan nombor telefon.');
    return i;
  }

  const demo = {
    create({ order }) {
      const o = clean(order), list = load();
      const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      let code;
      do { code = 'SC-' + Array.from({ length: 5 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''); }
      while (list.some((x) => x.code === code));
      const now = stamp();
      const rec = Object.assign({ code, status: 'Baru', createdAt: now, updatedAt: now }, o);
      list.push(rec); save(list);
      return { ok: true, order: rec };
    },
    get({ code, phone }) { const list = load(); return { ok: true, order: list[findIdx(list, code, phone)] }; },
    update({ code, phone, order }) {
      const o = clean(order), list = load(), i = findIdx(list, code, phone);
      list[i] = Object.assign({}, list[i], o, { status: 'Dikemaskini', updatedAt: stamp() });
      save(list); return { ok: true, order: list[i] };
    },
    cancel({ code, phone }) {
      const list = load(), i = findIdx(list, code, phone);
      list[i].status = 'Dibatalkan'; list[i].updatedAt = stamp();
      save(list); return { ok: true, order: list[i] };
    },
    adminList({ password }) {
      if (password !== DEMO_PASSWORD) throw new Error('Kata laluan admin salah.');
      return { ok: true, orders: load() };
    },
    adminSetStatus({ password, code, status }) {
      if (password !== DEMO_PASSWORD) throw new Error('Kata laluan admin salah.');
      if (!cfg.STATUSES.includes(status)) throw new Error('Status tidak sah.');
      const list = load(), i = findIdx(list, code, null);
      list[i].status = status; save(list); return { ok: true, order: list[i] };
    }
  };

  async function call(action, payload) {
    if (!DEMO) return remote(action, payload);
    await new Promise((r) => setTimeout(r, 250));
    return demo[action](payload || {});
  }

  window.SC_API = {
    DEMO, DEMO_PASSWORD, normPhone, normCode,
    create: (order) => call('create', { order }),
    get: (code, phone) => call('get', { code, phone }),
    update: (code, phone, order) => call('update', { code, phone, order }),
    cancel: (code, phone) => call('cancel', { code, phone }),
    adminList: (password) => call('adminList', { password }),
    adminSetStatus: (password, code, status) => call('adminSetStatus', { password, code, status })
  };
})();
