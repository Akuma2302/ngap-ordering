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
  const fmtCode = (n) => 'SC-' + String(n).padStart(4, '0');
  // Accepts "1", "#1", "sc-1", "SC-0001" -> "SC-0001" (same as Code.gs).
  const normCode = (c) => {
    c = String(c || '').trim().toUpperCase().replace(/^#/, '').replace(/^SC-?/, '');
    if (/^\d+$/.test(c)) return fmtCode(Number(c));
    return c ? 'SC-' + c : '';
  };

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

  function findIdx(list, code) {
    code = normCode(code);
    const i = list.findIndex((o) => o.code === code);
    if (i < 0) throw new Error('Order ' + code + ' tidak dijumpai. Semak kod order.');
    return i;
  }

  const net = () => { try { return Object.assign({ agents: [], dists: [], pays: [], jsales: {}, aprof: {}, n: {} }, JSON.parse(localStorage.getItem(KEY + '-net')) || {}); } catch (e) { return { agents: [], dists: [], pays: [], jsales: {}, aprof: {}, n: {} }; } };
  const saveNet = (T) => { try { localStorage.setItem(KEY + '-net', JSON.stringify(T)); } catch (e) {} };
  const agentOf = (T, code) => {
    const a = T.agents.find((x) => x.code.toLowerCase() === String(code || '').trim().toLowerCase());
    if (!a) throw new Error('Kod agent tidak sah.');
    if (a.status !== 'Aktif') throw new Error('Kod agent ini tidak aktif. Hubungi salesperson anda.');
    return a;
  };
  function distItems(items) {
    const out = {}; let total = 0, value = 0;
    cfg.FLAVOURS.forEach((f) => { const it = (items || {})[f.id] || {}, q = Math.max(0, Math.floor(Number(it.qty)) || 0); if (!q) return;
      const p = Math.max(0, Number(it.price) || 0); out[f.id] = { qty: q, price: Math.round(p * 100) / 100 }; total += q; value += q * p; });
    if (total < 1) throw new Error('Sila pilih sekurang-kurangnya 1 biji untuk diagih.');
    return { items: out, total, value: Math.round(value * 100) / 100 };
  }

  // demo salesperson accounts: the 8 real codes plus salesDemo (owner of the sample orders)
  const SP_SEED = ['Akmal', 'Harris', 'Izz', 'Najman', 'Faiz', 'Nik', 'Adi', 'Khairul'];
  const sps = () => { try { const v = JSON.parse(localStorage.getItem(KEY + '-sps')); if (v && v.length) return v; } catch (e) {}
    const v = [{ code: 'salesDemo', name: 'Aina Demo', phone: '0123456789', status: 'Aktif' }].concat(SP_SEED.map((n) => ({ code: 'sales' + n, name: n, phone: '', status: 'Aktif' })));
    try { localStorage.setItem(KEY + '-sps', JSON.stringify(v)); } catch (e) {} return v; };
  const spFind = (code) => { const s = sps().find((x) => x.code.toLowerCase() === String(code || '').trim().toLowerCase()); if (!s) throw new Error('Kod salesperson tidak sah.'); return s; };
  function demoSpPhone(code, tok) { const s = spFind(code); if (s.status !== 'Aktif') throw new Error('Akaun salesperson ini tidak aktif.'); if (!s.token || s.token !== tok) throw new Error('Sesi tamat. Sila log masuk semula.'); if (!s.phone) throw new Error('Sila set nombor telefon anda di Profil dahulu.'); return s.phone; }
  function agentCodeFor(name, taken) {
    let base = 'agent' + String(name || '').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
    if (base === 'agent') base = 'agentBaru';
    let code = base, n = 2; const t = taken.map((c) => c.toLowerCase());
    while (t.includes(code.toLowerCase())) code = base + (n++);
    return code;
  }

  const demo = {
    spLogin({ code }) { const s = spFind(code); if (s.status !== 'Aktif') throw new Error('Akaun salesperson ini tidak aktif.'); return { ok: true, sp: s }; },
    spSetProfile({ code, name, phone }) {
      const all = sps(), s = all.find((x) => x.code.toLowerCase() === String(code || '').toLowerCase()); if (!s) throw new Error('Kod salesperson tidak sah.');
      if (phone !== undefined) { const p = normPhone(phone); if (p.length < 9 || p.length > 12) throw new Error('Nombor telefon tidak sah.'); s.phone = p; }
      if (name) s.name = String(name).trim();
      localStorage.setItem(KEY + '-sps', JSON.stringify(all)); return { ok: true, sp: s };
    },
    adminSalespersons({ password }) { adm(password); return { ok: true, salespersons: sps() }; },
    create({ order }) {
      const o = clean(order), list = load();
      let last = Number(localStorage.getItem(KEY + '-last')) || 0;
      list.forEach((x) => { const m = /^SC-(\d+)$/.exec(x.code); if (m) last = Math.max(last, Number(m[1])); });
      last++; try { localStorage.setItem(KEY + '-last', String(last)); } catch (e) {}
      const code = fmtCode(last);
      const now = stamp();
      const rec = Object.assign({ code, status: 'Baru', createdAt: now, updatedAt: now }, o);
      list.push(rec); save(list);
      return { ok: true, order: rec };
    },
    get({ code }) { const list = load(); return { ok: true, order: list[findIdx(list, code)] }; },
    update({ code, order }) {
      const o = clean(order), list = load(), i = findIdx(list, code);
      list[i] = Object.assign({}, list[i], o, { status: 'Dikemaskini', updatedAt: stamp() });
      save(list); return { ok: true, order: list[i] };
    },
    cancel({ code }) {
      const list = load(), i = findIdx(list, code);
      list[i].status = 'Dibatalkan'; list[i].updatedAt = stamp();
      save(list); return { ok: true, order: list[i] };
    },
    myOrders({ phone }) {
      const p = normPhone(phone);
      if (p.length < 9 || p.length > 12) throw new Error('Nombor telefon tidak sah.');
      return { ok: true, orders: load().filter((o) => o.phone === p) };
    },
    agentGet({ phone }) {
      const p = normPhone(phone), all = JSON.parse(localStorage.getItem(KEY + '-agent') || '{}');
      const a = all[p] || { profile: null, sales: {} };
      return { ok: true, profile: a.profile, sales: a.sales || {} };
    },
    agentSaveProfile({ phone, data }) {
      const p = normPhone(phone), all = JSON.parse(localStorage.getItem(KEY + '-agent') || '{}');
      all[p] = all[p] || { sales: {} }; all[p].profile = data; localStorage.setItem(KEY + '-agent', JSON.stringify(all)); return { ok: true };
    },
    agentSaveSales({ phone, code, data }) {
      const p = normPhone(phone), list = load(), o = list[findIdx(list, code)];
      if (o.phone !== p) throw new Error('Order ini bukan milik nombor telefon anda.');
      const all = JSON.parse(localStorage.getItem(KEY + '-agent') || '{}');
      all[p] = all[p] || { sales: {} }; all[p].sales = all[p].sales || {}; all[p].sales[o.code] = data;
      localStorage.setItem(KEY + '-agent', JSON.stringify(all)); return { ok: true };
    },
    /* --- salesperson -> agent network (demo) --- */
    spAgents({ phone }) {
      const sp = normPhone(phone), T = net();
      const dists = T.dists.filter((d) => d.sp === sp), codes = new Set(dists.map((d) => d.code));
      return { ok: true, agents: T.agents.filter((a) => a.sp === sp), dists, payments: T.pays.filter((x) => x.sp === sp),
               sales: Object.fromEntries(Object.entries(T.jsales).filter(([k]) => codes.has(k))) };
    },
    spAddAgent({ phone, name, agentPhone, note }) {
      const sp = normPhone(phone), T = net(); name = String(name || '').trim();
      if (!name) throw new Error('Sila isi nama agent.');
      const code = agentCodeFor(name, T.agents.map((a) => a.code));
      const a = { code, sp, name, phone: agentPhone ? normPhone(agentPhone) : '', status: 'Aktif', createdAt: stamp(), note: note || '' };
      T.agents.push(a); saveNet(T); return { ok: true, agent: a };
    },
    spUpdateAgent({ phone, code, name, agentPhone, status, note }) {
      const T = net(), a = T.agents.find((x) => x.code === code && x.sp === normPhone(phone));
      if (!a) throw new Error('Agent tidak dijumpai.');
      if (name) a.name = name; if (agentPhone !== undefined) a.phone = normPhone(agentPhone);
      if (status) a.status = status === 'Tidak aktif' ? 'Tidak aktif' : 'Aktif'; if (note !== undefined) a.note = note;
      saveNet(T); return { ok: true, agent: a };
    },
    spDistribute({ phone, agent, items, date, note, alloc }) {
      const sp = normPhone(phone), T = net(), a = T.agents.find((x) => x.code === agent && x.sp === sp);
      if (!a) throw new Error('Agent tidak dijumpai.');
      if (a.status !== 'Aktif') throw new Error('Agent ini tidak aktif.');
      const c = distItems(items); T.n.dist = (T.n.dist || 0) + 1;
      const d = Object.assign({ code: 'DS-' + String(T.n.dist).padStart(4, '0'), sp, agent, date: date || stamp().slice(0, 10), status: 'Dihantar', createdAt: stamp(), updatedAt: stamp(), note: note || '', alloc: alloc || {} }, c);
      T.dists.push(d); saveNet(T); return { ok: true, dist: d };
    },
    spUpdateDist({ phone, code, items, date, note, alloc }) {
      const T = net(), d = T.dists.find((x) => x.code === code && x.sp === normPhone(phone));
      if (!d) throw new Error('Agihan tidak dijumpai.');
      Object.assign(d, distItems(items), { date: date || d.date, note: note ?? d.note, alloc: alloc || {}, updatedAt: stamp() });
      saveNet(T); return { ok: true, dist: d };
    },
    spDeleteDist({ phone, code }) { const T = net(); T.dists = T.dists.filter((x) => !(x.code === code && x.sp === normPhone(phone))); saveNet(T); return { ok: true }; },
    spAddPayment({ phone, agent, amount, date, note }) {
      const sp = normPhone(phone), T = net(), amt = Math.round((Number(amount) || 0) * 100) / 100;
      if (amt <= 0) throw new Error('Sila isi jumlah bayaran.');
      if (!T.agents.some((x) => x.code === agent && x.sp === sp)) throw new Error('Agent tidak dijumpai.');
      T.n.pay = (T.n.pay || 0) + 1;
      const y = { id: 'PY-' + String(T.n.pay).padStart(4, '0'), sp, agent, date: date || stamp().slice(0, 10), amount: amt, note: note || '', createdAt: stamp() };
      T.pays.push(y); saveNet(T); return { ok: true, payment: y };
    },
    spDeletePayment({ phone, id }) { const T = net(); T.pays = T.pays.filter((x) => !(x.id === id && x.sp === normPhone(phone))); saveNet(T); return { ok: true }; },
    agLogin({ code }) {
      const T = net(), a = agentOf(T, code), sp = a.sp, spOrder = load().filter((o) => o.phone === sp).pop();
      const dists = T.dists.filter((d) => d.agent === a.code);
      return { ok: true, agent: { code: a.code, name: a.name, phone: a.phone }, sp: { phone: sp, name: spOrder ? spOrder.name : '' },
               dists, payments: T.pays.filter((x) => x.agent === a.code),
               sales: Object.fromEntries(dists.filter((d) => T.jsales[d.code]).map((d) => [d.code, T.jsales[d.code]])), profile: T.aprof[a.code] || null };
    },
    agReceive({ code, dist }) { const T = net(), a = agentOf(T, code), d = T.dists.find((x) => x.code === dist && x.agent === a.code); if (!d) throw new Error('Agihan tidak dijumpai.'); d.status = 'Diterima'; d.updatedAt = stamp(); saveNet(T); return { ok: true }; },
    agSaveSales({ code, dist, data }) { const T = net(), a = agentOf(T, code); if (!T.dists.some((x) => x.code === dist && x.agent === a.code)) throw new Error('Agihan tidak dijumpai.'); T.jsales[dist] = data; saveNet(T); return { ok: true }; },
    agSaveProfile({ code, data }) { const T = net(), a = agentOf(T, code); T.aprof[a.code] = data; saveNet(T); return { ok: true }; },
    adminTree({ password }) {
      adm(password);
      const T = net(); return { ok: true, agents: T.agents, dists: T.dists, payments: T.pays, sales: T.jsales };
    },
    getAnnouncement() { const a = JSON.parse(localStorage.getItem(KEY + '-ann') || 'null'); return { ok: true, announcement: a && a.text ? a : null }; },
    adminSetAnnouncement({ password, text }) {
      adm(password);
      text = String(text || '').trim();
      const a = text ? { text, updatedAt: stamp() } : null;
      localStorage.setItem(KEY + '-ann', JSON.stringify(a)); return { ok: true, announcement: a };
    },
    adminList({ password }) {
      adm(password);
      return { ok: true, orders: load() };
    },
    adminSetStatus({ password, code, status }) {
      adm(password);
      if (!cfg.STATUSES.includes(status)) throw new Error('Status tidak sah.');
      const list = load(), i = findIdx(list, code);
      list[i].status = status; save(list); return { ok: true, order: list[i] };
    },
    adminDelete({ password, code }) {
      adm(password);
      const list = load(), i = findIdx(list, code), c = list[i].code;
      list.splice(i, 1); save(list); return { ok: true, code: c };
    }
  };

  /* ---------- demo: HQ settings, invoices, PIN, log, targeted announcements ---------- */
  const DEF_SET = { hqPrice: { def: 3.5, items: { 'tiramisu': 4, 'matcha-strawberry': 4 } }, hqCost: { def: 1.6, items: {} }, capacity: 300, cutoffDays: 1, cutoffHour: '18:00', unavailable: [], stockAgeDays: 5, hqPhone: '0123000000', openingCash: { amount: '', date: '' }, invoiceTermDays: 14 };
  const getJ = (k, d) => { try { return JSON.parse(localStorage.getItem(KEY + k)) ?? d; } catch (e) { return d; } };
  const setJ = (k, v) => { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} };
  const dSet = () => Object.assign({}, DEF_SET, getJ('-set', {}));
  const pIn = (m, id) => { const it = (m.items || {})[id], v = it !== undefined && it !== '' && it !== null ? it : m.def; return v === '' || v === null || v === undefined ? null : Number(v); };
  const isoD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function dEarliest(s) { const now = new Date(); let add = Number(s.cutoffDays) || 0; const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (s.cutoffHour && hm >= s.cutoffHour) add++; const d = new Date(); d.setDate(d.getDate() + add); return isoD(d); }
  function dLoad(skip) { const t = isoD(new Date()), l = {}; load().forEach((o) => { if (o.code === skip || o.status === 'Dibatalkan' || o.date < t) return; l[o.date] = (l[o.date] || 0) + o.total; }); return l; }
  const dPublic = () => { const s = dSet(), pr = getJ('-products', null) || []; return { hqPrice: s.hqPrice, capacity: s.capacity, cutoffDays: s.cutoffDays, cutoffHour: s.cutoffHour,
    unavailable: s.unavailable.concat(pr.filter((p) => p.active === false).map((p) => p.id)), earliest: dEarliest(s), load: dLoad(''), hqPhone: s.hqPhone, invoiceTermDays: s.invoiceTermDays,
    products: (pr.length ? pr : cfg.FLAVOURS_SEED).map((p) => ({ id: p.id, name: p.name, desc: p.desc || '', img: pr.length ? p.img || '' : '', bg: pr.length ? p.bg || '' : '', active: p.active !== false })) }; };
  function dRules(o, prev, code) {
    const s = dSet(), pi = prev ? prev.items : {};
    const bad = cfg.FLAVOURS.filter((f) => (s.unavailable.includes(f.id) || f.active === false) && (o.items[f.id] || 0) > (pi[f.id] || 0));
    if (bad.length) throw new Error(bad.map((f) => f.name).join(', ') + ' sedang habis. Sila buang dari order.');
    if (!prev || prev.date !== o.date) { const e = dEarliest(s); if (o.date < e) throw new Error('Order ditutup untuk tarikh ini. Tarikh terawal: ' + e + '.'); }
    if (s.capacity) { const used = dLoad(code)[o.date] || 0; if (used + o.total > s.capacity) throw new Error(`Kapasiti ${o.date} penuh. Baki: ${Math.max(0, s.capacity - used)} biji.`); }
  }
  // invoice snapshot per order
  function dInvoices() {
    const s = dSet(), inv = getJ('-inv', {});
    load().forEach((o) => {
      const old = inv[o.code] || { prices: {} }, prices = {}; let amount = 0, missing = false;
      cfg.FLAVOURS.forEach((f) => { const q = o.items[f.id] || 0; if (!q) return; const keep = old.prices[f.id] !== undefined && old.prices[f.id] !== null;
        const p = keep ? old.prices[f.id] : pIn(s.hqPrice, f.id); if (p === null) missing = true; prices[f.id] = p; amount += q * (p || 0); });
      const disc = Math.min(Number(old.disc) || 0, amount);
      inv[o.code] = { code: o.code, phone: o.phone, date: o.date, status: o.status, total: o.total, amount: o.status === 'Dibatalkan' ? 0 : Math.round((amount - disc) * 100) / 100, prices, missing, disc };
    });
    Object.keys(inv).forEach((k) => { if (!load().some((o) => o.code === k)) delete inv[k]; });
    setJ('-inv', inv); return Object.values(inv);
  }
  // same rule as the server: once HQ is baking, the salesperson cannot change or cancel the order
  const dLocked = (o, what) => { if (['Dibakar', 'Siap', 'Selesai'].includes(o.status)) throw new Error(`Order ${o.code} dah ${o.status.toLowerCase()} dan tak boleh ${what}. Hubungi HQ.`); };
  const dLog = (who, action, ref, detail) => { const l = getJ('-log', []); l.unshift({ at: stamp(), who: who || '-', action, ref: ref || '', detail: detail || '' }); setJ('-log', l.slice(0, 400)); };
  const dSp = (code) => { const all = sps(), s = all.find((x) => x.code.toLowerCase() === String(code || '').trim().toLowerCase()); if (!s) throw new Error('Kod salesperson tidak sah.'); return { all, s }; };
  const pinH = (code, pin) => btoa(unescape(encodeURIComponent(String(code).toLowerCase() + ':' + pin)));
  const adm = (pw) => { if (pw !== (getJ('-pw', null) || DEMO_PASSWORD)) throw new Error('Kata laluan admin salah.'); };
  const anns = () => { let l = getJ('-anns', null); if (!l) { const old = getJ('-ann', null); l = old && old.text ? [{ id: 'AN-1', text: old.text, target: 'all', updatedAt: old.updatedAt }] : []; setJ('-anns', l); } return l; };

  Object.assign(demo, {
    spLogin({ code, pin, tok }) {
      const { all, s } = dSp(code); if (s.status !== 'Aktif') throw new Error('Akaun salesperson ini tidak aktif.');
      if (!(tok && s.token && tok === s.token)) {
        if (s.pin) { if (!pin) throw new Error('Sila masukkan PIN.'); if (pinH(s.code, pin) !== s.pin) throw new Error('PIN salah.'); }
        s.token = s.token || ('t' + Date.now()); dLog(s.code, 'Log masuk', '', '');
      }
      s.lastActive = stamp(); localStorage.setItem(KEY + '-sps', JSON.stringify(all));
      return { ok: true, sp: { code: s.code, name: s.name, phone: s.phone, status: s.status, hasPin: !!s.pin }, token: s.token, needPin: !s.pin };
    },
    spSetPin({ code, tok, pin }) {
      const { all, s } = dSp(code); if (!s.token || s.token !== tok) throw new Error('Sesi tamat. Sila log masuk semula.');
      if (!/^\d{4,6}$/.test(String(pin || ''))) throw new Error('PIN mesti 4 hingga 6 digit.');
      s.pin = pinH(s.code, pin); s.token = 't' + Date.now(); localStorage.setItem(KEY + '-sps', JSON.stringify(all)); dLog(s.code, 'Tukar PIN', '', '');
      return { ok: true, token: s.token };
    },
    spSetProfile({ code, tok, name, phone }) {
      const { all, s } = dSp(code); if (!s.token || s.token !== tok) throw new Error('Sesi tamat. Sila log masuk semula.');
      if (phone !== undefined) { const p = normPhone(phone); if (p.length < 9 || p.length > 12) throw new Error('Nombor telefon tidak sah.'); s.phone = p; }
      if (name) s.name = String(name).trim();
      localStorage.setItem(KEY + '-sps', JSON.stringify(all)); return { ok: true, sp: s };
    },
    adminSalespersons({ password }) { adm(password); return { ok: true, salespersons: sps().map((s) => ({ code: s.code, name: s.name, phone: s.phone, status: s.status, lastActive: s.lastActive || '', hasPin: !!s.pin })) }; },
    adminSaveSalesperson({ password, code, name, phone, status }) {
      adm(password); const all = sps();
      if (code) { const s = all.find((x) => x.code === code); if (!s) throw new Error('Kod salesperson tidak sah.');
        if (name) s.name = name; if (phone) s.phone = normPhone(phone); s.status = status === 'Tidak aktif' ? 'Tidak aktif' : 'Aktif'; if (s.status !== 'Aktif') s.token = '';
        localStorage.setItem(KEY + '-sps', JSON.stringify(all)); dLog('Admin', 'Edit salesperson', code, s.name + ' · ' + s.status); return { ok: true }; }
      if (!name) throw new Error('Sila isi nama salesperson.');
      let base = 'sales' + String(name).replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(''), c = base, n = 2;
      while (all.some((x) => x.code.toLowerCase() === c.toLowerCase())) c = base + (n++);
      all.push({ code: c, name, phone: phone ? normPhone(phone) : '', status: 'Aktif' }); localStorage.setItem(KEY + '-sps', JSON.stringify(all));
      dLog('Admin', 'Tambah salesperson', c, name); return { ok: true, code: c };
    },
    adminResetPin({ password, code }) { adm(password); const all = sps(), s = all.find((x) => x.code === code); s.pin = ''; s.token = ''; localStorage.setItem(KEY + '-sps', JSON.stringify(all)); dLog('Admin', 'Reset PIN', code, ''); return { ok: true }; },
    publicSettings() { return { ok: true, settings: dPublic() }; },
    adminGetSettings({ password }) { adm(password); const s = dSet(); return { ok: true, settings: Object.assign(s, { earliest: dEarliest(s), load: dLoad('') }) }; },
    adminSetSettings({ password, settings }) { adm(password); const next = Object.assign(dSet(), settings || {}); setJ('-set', next); dLog('Admin', 'Tetapan HQ', Object.keys(settings || {}).join(', '), ''); return { ok: true, settings: Object.assign(next, { earliest: dEarliest(next), load: dLoad('') }) }; },
    adminAddHQPayment({ password, sp, amount, date, note }) {
      adm(password); const s = dSp(sp).s; if (!s.phone) throw new Error('Salesperson ini belum ada nombor telefon.');
      const amt = Math.round((Number(amount) || 0) * 100) / 100; if (amt <= 0) throw new Error('Sila isi jumlah bayaran.');
      const l = getJ('-hqpay', []), n = (getJ('-hqn', 0) || 0) + 1; setJ('-hqn', n);
      l.push({ id: 'HP-' + String(n).padStart(4, '0'), phone: s.phone, date: date || stamp().slice(0, 10), amount: amt, note: note || '', createdAt: stamp() }); setJ('-hqpay', l);
      dLog('Admin', 'Bayaran HQ', 'HP-' + n, sp + ' · RM' + amt.toFixed(2)); return { ok: true };
    },
    adminDeleteHQPayment({ password, id }) { adm(password); setJ('-hqpay', getJ('-hqpay', []).filter((x) => x.id !== id)); dLog('Admin', 'Padam bayaran HQ', id, ''); return { ok: true }; },
    adminLog({ password }) { adm(password); return { ok: true, log: getJ('-log', []) }; },
    getAnnouncement({ role, sp, agent }) {
      let mine = role === 'agent' ? '' : String(sp || '');
      if (role === 'agent' && agent) { try { const T = net(), a = agentOf(T, agent), s = sps().find((x) => x.phone === a.sp); mine = s ? s.code : ''; } catch (e) {} }
      const list = anns().filter((a) => a.target === 'all' || (a.target === 'sales' && role !== 'agent') || (a.target === 'agents' && role === 'agent') ||
        (a.target.startsWith('sp:') && mine && a.target.slice(3).toLowerCase() === mine.toLowerCase()));
      return { ok: true, announcements: list, announcement: list[0] || null };
    },
    adminListAnnouncements({ password }) { adm(password); return { ok: true, announcements: anns() }; },
    adminAddAnnouncement({ password, text, target }) { adm(password); text = String(text || '').trim(); if (!text) throw new Error('Tulis pengumuman dahulu.');
      const l = anns(); l.unshift({ id: 'AN-' + Date.now(), text, target: target || 'all', updatedAt: stamp() }); setJ('-anns', l.slice(0, 20)); dLog('Admin', 'Pengumuman', target, text.slice(0, 80)); return { ok: true, announcements: l }; },
    adminDeleteAnnouncement({ password, id }) { adm(password); const l = anns().filter((a) => a.id !== id); setJ('-anns', l); return { ok: true, announcements: l }; },
    adminSetAnnouncement({ password, text }) { return text ? demo.adminAddAnnouncement({ password, text, target: 'all' }) : (adm(password), setJ('-anns', []), { ok: true, announcements: [] }); }
  });
  // order actions with the new rules + invoice + log
  const _create = demo.create, _update = demo.update, _cancel = demo.cancel, _myOrders = demo.myOrders, _get = demo.get;
  const _adminList = demo.adminList, _setStatus = demo.adminSetStatus, _del = demo.adminDelete, _tree = demo.adminTree;
  Object.assign(demo, {
    create(p) { const o = clean(Object.assign({}, p.order, { phone: p.phone })); dRules(o, null, null); const r = _create({ order: Object.assign({}, p.order, { phone: p.phone }) }); dInvoices(); dLog(p.sp, 'Order baru', r.order.code, r.order.total + ' biji · ' + r.order.date); return r; },
    get(p) { const r = _get(p); if (r.order.phone !== p.phone) throw new Error('Order ini bukan milik anda.'); return r; },
    update(p) { const list = load(), prev = list[findIdx(list, p.code)]; if (prev.phone !== p.phone) throw new Error('Order ini bukan milik anda.'); dLocked(prev, 'diubah');
      const o = clean(Object.assign({}, p.order, { phone: p.phone })); dRules(o, prev, prev.code); const r = _update(Object.assign({}, p, { order: Object.assign({}, p.order, { phone: p.phone }) })); dInvoices(); dLog(p.sp, 'Edit order', r.order.code, ''); return r; },
    cancel(p) { const list = load(), prev = list[findIdx(list, p.code)]; if (prev.phone !== p.phone) throw new Error('Order ini bukan milik anda.'); dLocked(prev, 'dibatalkan'); const r = _cancel(p); dInvoices(); dLog(p.sp, 'Batal order', p.code, ''); return r; },
    myOrders(p) { const r = _myOrders(p), ph = normPhone(p.phone); return Object.assign(r, { invoices: dInvoices().filter((v) => v.phone === ph), hqPayments: getJ('-hqpay', []).filter((y) => y.phone === ph), settings: dPublic() }); },
    adminList(p) { const r = _adminList(p); return Object.assign(r, { invoices: dInvoices(), hqPayments: getJ('-hqpay', []), settings: demo.adminGetSettings(p).settings }); },
    adminSetStatus(p) { const prev = load().find((o) => o.code === p.code); const r = _setStatus(p); dInvoices(); dLog('Admin', 'Status order', p.code, (prev ? prev.status : '') + ' → ' + p.status); return r; },
    adminDelete(p) { const r = _del(p); dInvoices(); dLog('Admin', 'Padam order', p.code, ''); return r; },
    adminTree(p) { const r = _tree(p), all = JSON.parse(localStorage.getItem(KEY + '-agent') || '{}'), spSales = {};
      Object.values(all).forEach((a) => Object.assign(spSales, a.sales || {})); return Object.assign(r, { spSales }); }
  });


  /* ---------- demo: HQ back office (products, finance, raw materials, suppliers, approvals) ---------- */
  const EXPENSE_CATS = ['Bahan mentah', 'Packaging', 'Penghantaran', 'Gaji & upah', 'Sewa & utiliti', 'Pemasaran', 'Peralatan', 'Lain-lain'];
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100, q4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
  const today = () => stamp().slice(0, 10), isoOr = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? d : today());
  const nextId = (k, pre) => { const n = (getJ('-n-' + k, 0) || 0) + 1; setJ('-n-' + k, n); return pre + String(n).padStart(4, '0'); };
  const dProducts = () => getJ('-products', null) || cfg.FLAVOURS_SEED.map((f) => ({ id: f.id, name: f.name, desc: '', img: '', bg: '', active: true, recipe: {} }));
  const pubProducts = () => dProducts().map(({ id, name, desc, img, bg, active }) => ({ id, name, desc, img, bg, active }));
  const dMats = () => getJ('-mats', []), dMoves = () => getJ('-moves', []);
  function dSummary(mv) {
    const s = {};
    mv.forEach((m) => { const x = s[m.mat] = s[m.mat] || { onHand: 0, cq: 0, cv: 0 }; x.onHand = q4(x.onHand + m.qty);
      if (m.cost !== null && (m.type === 'Masuk' || (m.type === 'Pembetulan' && /^PU-/.test(m.ref)))) { x.cq += m.qty; x.cv += m.qty * m.cost; } });
    Object.values(s).forEach((x) => { x.avgCost = x.cq > 0 ? Math.round(x.cv / x.cq * 10000) / 10000 : null; });
    return s;
  }
  const dMaterials = () => { const s = dSummary(dMoves()); return dMats().map((m) => { const x = s[m.id] || { onHand: 0, avgCost: null }; return Object.assign({}, m, { onHand: x.onHand, avgCost: x.avgCost, low: m.status === 'Aktif' && m.reorder > 0 && x.onHand <= m.reorder }); }); };
  function dPost(moves, who) {
    if (!moves.length) return [];
    const all = dMoves(), mats = Object.fromEntries(dMats().map((m) => [m.id, m])), sum = dSummary(all), after = {};
    moves.forEach((m) => { if (!mats[m.mat]) throw new Error('Bahan ' + m.mat + ' tidak dijumpai.'); if (!m.qty) throw new Error('Kuantiti tidak boleh 0.');
      after[m.mat] = q4((after[m.mat] ?? (sum[m.mat] || { onHand: 0 }).onHand) + m.qty); });
    if (!dSet().allowNegStock) Object.keys(after).forEach((id) => { if (after[id] < -0.00005) throw new Error(`Stok ${mats[id].name} tak cukup (ada ${(sum[id] || { onHand: 0 }).onHand} ${mats[id].unit}). Rekod belian atau pelarasan dahulu.`); });
    const out = moves.map((m) => ({ id: nextId('mv', 'MV-'), at: stamp(), date: isoOr(m.date), mat: m.mat, type: m.type, qty: q4(m.qty), cost: m.cost === null || m.cost === undefined ? null : q4(m.cost), ref: m.ref || '', reason: m.reason || '', by: who || 'Admin' }));
    setJ('-moves', all.concat(out)); return out;
  }
  const USED = ['Dibakar', 'Siap', 'Selesai'];
  function dBake(o, prev, next) {
    const was = USED.includes(prev), is = USED.includes(next); if (was === is || next === 'Dibatalkan') return;
    const net = {}; dMoves().forEach((m) => { if (m.ref === o.code && (m.type === 'Guna' || m.type === 'Pembetulan')) net[m.mat] = q4((net[m.mat] || 0) + m.qty); });
    if (is) { if (Object.values(net).some((v) => v < 0)) return; const need = {}, sum = dSummary(dMoves());
      dProducts().forEach((p) => { const q = o.items[p.id] || 0; if (!q) return; Object.entries(p.recipe || {}).forEach(([mid, per]) => { if (per > 0) need[mid] = (need[mid] || 0) + per * q; }); });
      dPost(Object.entries(need).map(([mid, n]) => ({ mat: mid, type: 'Guna', qty: -q4(n), cost: (sum[mid] || {}).avgCost ?? null, date: o.date, ref: o.code, reason: 'Bake ' + o.total + ' biji' })), 'Sistem');
    } else dPost(Object.entries(net).filter(([, v]) => v < 0).map(([mid, v]) => ({ mat: mid, type: 'Pembetulan', qty: -v, cost: null, date: o.date, ref: o.code, reason: `Status ${prev} → ${next}` })), 'Sistem');
  }
  const dReqs = () => getJ('-reqs', []);
  const REQ_TYPES = { batal: 'Batalkan order', diskaun: 'Diskaun invois', bayaran: 'Bukti bayaran', lain: 'Lain-lain' };
  const _setStatus2 = demo.adminSetStatus, _myOrders2 = demo.myOrders, _adminList2 = demo.adminList, _agLogin2 = demo.agLogin;
  const dSetStatus = (code, status, who) => { const list = load(), o = list[findIdx(list, code)], prev = o.status; if (prev === status) return o;
    dBake(Object.assign({}, o), prev, status); list[findIdx(list, code)].status = status; save(list); dInvoices(); dLog(who, 'Status order', o.code, prev + ' → ' + status); return list[findIdx(list, code)]; };
  Object.assign(demo, {
    publicSettings() { return { ok: true, settings: dPublic() } },
    adminSetStatus(p) { adm(p.password); if (!cfg.STATUSES.includes(p.status)) throw new Error('Status tidak sah.'); return { ok: true, order: dSetStatus(p.code, p.status, 'Admin') }; },
    myOrders(p) { const r = _myOrders2(p), s = dSet(), codes = new Set(r.orders.map((o) => o.code)), statusLog = {};
      getJ('-log', []).slice().reverse().forEach((x) => { if (!codes.has(x.ref)) return; const st = x.action === 'Order baru' ? 'Baru' : x.action === 'Edit order' ? 'Dikemaskini' : x.action === 'Batal order' ? 'Dibatalkan' : x.action === 'Status order' ? String(x.detail).split('→').pop().trim() : '';
        if (st) (statusLog[x.ref] = statusLog[x.ref] || []).push({ at: x.at, status: st }); });
      return Object.assign(r, { hqTarget: (s.targets || {})[p.sp] || 0, pendingRequests: dReqs().filter((x) => x.sp === p.sp && x.status === 'Menunggu').length, statusLog, requests: dReqs().filter((x) => x.sp === p.sp).slice(-20) }); },
    adminList(p) { const r = _adminList2(p); return Object.assign(r, { pwDefault: false, pending: dReqs().filter((x) => x.status === 'Menunggu').length }); },
    agLogin(p) { return Object.assign(_agLogin2(p), { products: pubProducts() }); },
    adminHQ({ password }) { adm(password); return { ok: true, products: dProducts(), materials: dMaterials(), moves: dMoves().slice(-500).reverse(), suppliers: getJ('-sups', []),
      purchases: getJ('-purs', []), expenses: getJ('-exps', []), requests: dReqs(), expenseCats: EXPENSE_CATS }; },
    adminSaveProduct({ password, product }) {
      adm(password); const list = dProducts(), x = product || {}, name = String(x.name || '').trim(), img = String(x.img || '').trim();
      if (img && !/^(https:\/\/|img\/)/.test(img)) throw new Error('Gambar mesti link https:// atau fail img/…');
      const recipe = {}; Object.entries(x.recipe || {}).forEach(([k, v]) => { if (Number(v) > 0) recipe[k] = q4(v); });
      let p;
      if (x.id) { p = list.find((y) => y.id === x.id); if (!p) throw new Error('Produk tidak dijumpai.');
        if (name) p.name = name; if (x.desc !== undefined) p.desc = x.desc; if (x.img !== undefined) p.img = img; if (x.active !== undefined) p.active = !!x.active; if (x.recipe !== undefined) p.recipe = recipe;
        dLog('Admin', 'Edit produk', p.id, p.name);
      } else { if (!name) throw new Error('Sila isi nama produk.'); if (list.some((y) => y.name.toLowerCase() === name.toLowerCase())) throw new Error('Nama produk sudah ada.');
        let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produk', id = base, n = 2; while (list.some((y) => y.id === id)) id = base + '-' + (n++);
        p = { id, name, desc: x.desc || '', img, bg: '', active: true, recipe }; list.push(p); dLog('Admin', 'Tambah produk', id, name); }
      setJ('-products', list); return { ok: true, product: p, products: list };
    },
    adminSaveExpense({ password, date, cat, amount, note, ref }) { adm(password); const amt = r2(amount); if (amt <= 0) throw new Error('Sila isi jumlah perbelanjaan.');
      const l = getJ('-exps', []), id = nextId('ex', 'EX-'); l.push({ id, date: isoOr(date), cat: EXPENSE_CATS.includes(cat) ? cat : 'Lain-lain', amount: amt, note: note || '', ref: ref || '', status: 'Aktif', createdAt: stamp(), by: 'Admin' });
      setJ('-exps', l); dLog('Admin', 'Perbelanjaan', id, cat + ' · RM' + amt.toFixed(2)); return { ok: true, id }; },
    adminVoidExpense({ password, id, reason }) { adm(password); const l = getJ('-exps', []), e = l.find((x) => x.id === id); if (!e) throw new Error('Perbelanjaan tidak dijumpai.'); e.status = 'Dibatalkan'; setJ('-exps', l); dLog('Admin', 'Batal perbelanjaan', id, reason || ''); return { ok: true }; },
    adminSaveMaterial({ password, material }) { adm(password); const l = dMats(), x = material || {}, name = String(x.name || '').trim(), unit = String(x.unit || '').trim() || 'unit', reorder = Math.max(0, q4(x.reorder));
      if (x.id) { const m = l.find((y) => y.id === x.id); if (!m) throw new Error('Bahan tidak dijumpai.'); Object.assign(m, { name: name || m.name, unit, reorder, status: x.status === 'Tidak aktif' ? 'Tidak aktif' : 'Aktif' }); setJ('-mats', l); return { ok: true }; }
      if (!name) throw new Error('Sila isi nama bahan.'); if (l.some((y) => y.name.toLowerCase() === name.toLowerCase())) throw new Error('Bahan ini sudah ada.');
      const id = nextId('mt', 'BH-'); l.push({ id, name, unit, reorder, status: 'Aktif', createdAt: stamp() }); setJ('-mats', l); dLog('Admin', 'Tambah bahan', id, name); return { ok: true, id }; },
    adminStockMove({ password, mat, type, qty, reason, date }) { adm(password); type = type === 'Rosak' ? 'Rosak' : 'Pelarasan'; qty = q4(qty); if (!String(reason || '').trim()) throw new Error('Sila tulis sebab pergerakan stok.');
      if (type === 'Rosak') qty = -Math.abs(qty); if (!qty) throw new Error('Kuantiti tidak boleh 0.'); const mv = dPost([{ mat, type, qty, cost: null, date, ref: 'MANUAL', reason }], 'Admin'); dLog('Admin', 'Stok ' + type, mv[0].id, mat + ' ' + qty); return { ok: true }; },
    adminSaveSupplier({ password, supplier }) { adm(password); const l = getJ('-sups', []), x = supplier || {}, name = String(x.name || '').trim();
      if (x.id) { const s = l.find((y) => y.id === x.id); if (!s) throw new Error('Pembekal tidak dijumpai.'); Object.assign(s, { name: name || s.name, phone: x.phone ? normPhone(x.phone) : '', note: x.note || '', status: x.status === 'Tidak aktif' ? 'Tidak aktif' : 'Aktif' }); setJ('-sups', l); return { ok: true }; }
      if (!name) throw new Error('Sila isi nama pembekal.'); const id = nextId('su', 'SU-'); l.push({ id, name, phone: x.phone ? normPhone(x.phone) : '', note: x.note || '', status: 'Aktif', createdAt: stamp() }); setJ('-sups', l); return { ok: true, id }; },
    adminAddPurchase({ password, sup, date, lines, note, paid }) { adm(password);
      lines = (lines || []).map((l) => ({ mat: String(l.mat || ''), qty: q4(l.qty), cost: q4(l.cost) })).filter((l) => l.mat && l.qty > 0); if (!lines.length) throw new Error('Tambah sekurang-kurangnya satu bahan.');
      const id = nextId('pu', 'PU-'), d = isoOr(date), total = r2(lines.reduce((a, l) => a + l.qty * l.cost, 0));
      dPost(lines.map((l) => ({ mat: l.mat, type: 'Masuk', qty: l.qty, cost: l.cost, date: d, ref: id, reason: 'Belian' })), 'Admin');
      const l = getJ('-purs', []); l.push({ id, date: d, sup: sup || '', amount: total, status: 'Diterima', pay: paid ? 'Dibayar' : 'Belum bayar', paidDate: paid ? d : '', note: note || '', lines, createdAt: stamp() }); setJ('-purs', l);
      dLog('Admin', 'Belian', id, 'RM' + total.toFixed(2)); return { ok: true, id }; },
    adminVoidPurchase({ password, id }) { adm(password); const l = getJ('-purs', []), p = l.find((x) => x.id === id); if (!p) throw new Error('Belian tidak dijumpai.'); if (p.status === 'Dibatalkan') return { ok: true };
      dPost(p.lines.map((x) => ({ mat: x.mat, type: 'Pembetulan', qty: -x.qty, cost: x.cost, date: p.date, ref: p.id, reason: 'Batal belian' })), 'Admin'); p.status = 'Dibatalkan'; setJ('-purs', l); dLog('Admin', 'Batal belian', id, ''); return { ok: true }; },
    adminPayPurchase({ password, id, paid, date }) { adm(password); const l = getJ('-purs', []), p = l.find((x) => x.id === id); if (!p) throw new Error('Belian tidak dijumpai.'); p.pay = paid === false ? 'Belum bayar' : 'Dibayar'; p.paidDate = paid === false ? '' : isoOr(date); setJ('-purs', l); return { ok: true }; },
    spRequests({ sp }) { return { ok: true, requests: dReqs().filter((r) => r.sp === sp).reverse() }; },
    spAddRequest({ sp, phone, type, ref, detail, amount, bankRef, date }) {
      type = REQ_TYPES[type] ? type : 'lain'; detail = String(detail || '').trim(); let code = '', amt = 0, bank = '', pdate = '';
      if (type === 'bayaran') { amt = r2(amount); bank = String(bankRef || '').trim(); pdate = isoOr(date); if (amt <= 0) throw new Error('Sila isi jumlah yang dibayar.'); if (!bank) throw new Error('Sila isi no. rujukan / transaksi bank.'); detail = detail || 'Bayaran ke HQ · ' + bank;
        if (dReqs().some((r) => r.type === 'bayaran' && r.status === 'Menunggu' && r.bankRef === bank)) throw new Error('Bukti bayaran dengan rujukan ini sedang disemak HQ.'); }
      else if (type !== 'lain') { const list = load(), o = list[findIdx(list, ref)]; if (o.phone !== phone) throw new Error('Order ini bukan milik anda.'); code = o.code;
        if (type === 'batal' && o.status === 'Dibatalkan') throw new Error('Order ini sudah dibatalkan.');
        if (type === 'diskaun') { amt = r2(amount); const v = dInvoices().find((x) => x.code === code); if (amt <= 0) throw new Error('Sila isi jumlah diskaun.'); if (!v || amt > v.amount + (v.disc || 0)) throw new Error('Diskaun melebihi jumlah invois.'); } }
      if (!detail) throw new Error('Sila tulis sebab permintaan.');
      const l = dReqs(); if (code && l.some((r) => r.ref === code && r.type === type && r.status === 'Menunggu')) throw new Error(`Permintaan untuk ${code} masih menunggu keputusan HQ.`);
      const id = nextId('rq', 'RQ-'); l.push({ id, at: stamp(), sp, type, ref: code, detail, amount: amt, bankRef: bank, date: pdate, status: 'Menunggu', by: '', decidedAt: '', reason: '' }); setJ('-reqs', l);
      dLog(sp, 'Permintaan', id, REQ_TYPES[type] + (code ? ' · ' + code : '')); return { ok: true, id };
    },
    spCancelRequest({ sp, id }) { const l = dReqs(), r = l.find((x) => x.id === id && x.sp === sp); if (!r) throw new Error('Permintaan tidak dijumpai.'); if (r.status !== 'Menunggu') throw new Error('Permintaan ini sudah diputuskan.');
      Object.assign(r, { status: 'Dibatalkan', by: sp, decidedAt: stamp(), reason: 'Dibatalkan oleh pemohon' }); setJ('-reqs', l); return { ok: true }; },
    adminDecide({ password, id, decision, reason }) { adm(password); const ok = decision === 'Diluluskan'; reason = String(reason || '').trim(); if (!ok && !reason) throw new Error('Sila tulis sebab permintaan ditolak.');
      const l = dReqs(), r = l.find((x) => x.id === id); if (!r) throw new Error('Permintaan tidak dijumpai.'); if (r.status !== 'Menunggu') throw new Error('Permintaan ini sudah diputuskan.');
      if (ok && r.type === 'batal') dSetStatus(r.ref, 'Dibatalkan', 'Admin (' + r.id + ')');
      if (ok && r.type === 'bayaran') { const s2 = dSp(r.sp).s; if (!s2.phone) throw new Error('Salesperson ini belum ada nombor telefon.'); const hl = getJ('-hqpay', []), n = (getJ('-hqn', 0) || 0) + 1; setJ('-hqn', n);
        hl.push({ id: 'HP-' + String(n).padStart(4, '0'), phone: s2.phone, date: r.date || today(), amount: r.amount, note: 'Bukti ' + r.bankRef + ' (' + r.id + ')', createdAt: stamp() }); setJ('-hqpay', hl); dLog('Admin', 'Bayaran HQ', 'HP-' + n, r.sp + ' · RM' + r.amount.toFixed(2)); }
      if (ok && r.type === 'diskaun') { const inv = getJ('-inv', {}); if (inv[r.ref]) { inv[r.ref].disc = r.amount; setJ('-inv', inv); dInvoices(); } }
      Object.assign(r, { status: ok ? 'Diluluskan' : 'Ditolak', by: 'Admin', decidedAt: stamp(), reason }); setJ('-reqs', l);
      dLog('Admin', ok ? 'Lulus permintaan' : 'Tolak permintaan', r.id, REQ_TYPES[r.type]); return { ok: true }; },
    adminChangePassword({ password, newPassword }) { adm(password); if (String(newPassword || '').length < 8) throw new Error('Kata laluan baru mesti sekurang-kurangnya 8 aksara.'); setJ('-pw', newPassword); dLog('Admin', 'Tukar kata laluan admin', '', ''); return { ok: true }; },
    adminEndSession({ password, code }) { adm(password); const { all, s } = dSp(code); s.token = ''; localStorage.setItem(KEY + '-sps', JSON.stringify(all)); dLog('Admin', 'Tamatkan sesi', code, ''); return { ok: true }; },
    spLogoutAll({ sp }) { const { all, s } = dSp(sp); s.token = 't' + Date.now(); localStorage.setItem(KEY + '-sps', JSON.stringify(all)); return { ok: true, token: s.token }; },
    adminBackup({ password }) { adm(password); const data = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(KEY)) data[k] = getJ(k.slice(KEY.length), null); }
      return { ok: true, backup: { app: 'ngap-ordering', demo: true, at: stamp(), data } }; }
  });


  /* ---------- demo: agent -> salesperson requests (stock, payment proof) ---------- */
  const _spAgents3 = demo.spAgents, _agLogin3 = demo.agLogin;
  Object.assign(demo, {
    spAgents(p) { const T = net(), sp = normPhone(p.phone); return Object.assign(_spAgents3(p), { agentRequests: (T.areqs || []).filter((r) => r.sp === sp).slice(-100) }); },
    agLogin(p) { const T = net(), r = _agLogin3(p); return Object.assign(r, { requests: (T.areqs || []).filter((x) => x.agent === r.agent.code).slice(-30) }); },
    agRequest({ code, type, items, amount, bankRef, date, note }) {
      const T = net(), a = agentOf(T, code); type = type === 'bayaran' ? 'bayaran' : 'stok';
      const x = { at: stamp(), agent: a.code, sp: a.sp, type, items: {}, total: 0, amount: 0, bankRef: '', date: '', note: String(note || '').trim(), status: 'Menunggu', decidedAt: '', reason: '', ref: '' };
      if (type === 'stok') { cfg.FLAVOURS.forEach((f) => { const q = Math.max(0, Math.floor(Number((items || {})[f.id]) || 0)); if (q) { x.items[f.id] = q; x.total += q; } }); if (!x.total) throw new Error('Pilih sekurang-kurangnya 1 perisa.'); }
      else { x.amount = r2(amount); x.bankRef = String(bankRef || '').trim(); x.date = isoOr(date); if (x.amount <= 0) throw new Error('Sila isi jumlah yang dibayar.'); if (!x.bankRef) throw new Error('Sila isi no. rujukan / cara bayaran (cth. tunai, DuitNow ref).');
        if ((T.areqs || []).some((r) => r.agent === a.code && r.type === 'bayaran' && r.status === 'Menunggu' && r.bankRef === x.bankRef)) throw new Error('Bukti bayaran ini sedang disemak salesperson.'); }
      T.n.areq = (T.n.areq || 0) + 1; x.id = 'AR-' + String(T.n.areq).padStart(4, '0'); T.areqs = (T.areqs || []).concat(x); saveNet(T); return { ok: true, request: x };
    },
    agCancelRequest({ code, id }) { const T = net(), a = agentOf(T, code), r = (T.areqs || []).find((x) => x.id === id && x.agent === a.code); if (!r) throw new Error('Permintaan tidak dijumpai.'); if (r.status !== 'Menunggu') throw new Error('Permintaan ini sudah diputuskan.');
      Object.assign(r, { status: 'Dibatalkan', decidedAt: stamp(), reason: 'Dibatalkan oleh agent' }); saveNet(T); return { ok: true }; },
    spDecideAgentReq({ phone, id, decision, reason, ref }) {
      const T = net(), sp = normPhone(phone), r = (T.areqs || []).find((x) => x.id === id && x.sp === sp), ok = decision === 'Diluluskan';
      if (!r) throw new Error('Permintaan tidak dijumpai.'); if (r.status !== 'Menunggu') throw new Error('Permintaan ini sudah diputuskan.');
      if (!ok && !String(reason || '').trim()) throw new Error('Sila tulis sebab permintaan ditolak.');
      let pref = ref || '';
      if (ok && r.type === 'bayaran') { T.n.pay = (T.n.pay || 0) + 1; pref = 'PY-' + String(T.n.pay).padStart(4, '0'); T.pays.push({ id: pref, sp, agent: r.agent, date: r.date, amount: r.amount, note: 'Bukti ' + r.bankRef + ' (' + r.id + ')', createdAt: stamp() }); }
      Object.assign(r, { status: ok ? 'Diluluskan' : 'Ditolak', decidedAt: stamp(), reason: String(reason || '').trim(), ref: pref }); saveNet(T); return { ok: true, ref: pref };
    }
  });

  /* ---------- demo: salesperson -> customer invoices ---------- */
  const ciAll = () => getJ('-cinv', []);
  function ciClean(d) {
    d = d || {}; const t = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200), bill = d.bill || {}, bank = d.bank || {};
    const items = (d.items || []).map((it) => ({ fid: t(it.fid, 40), name: t(it.name, 80), desc: t(it.desc, 120), qty: Math.max(0, Math.round(Number(it.qty) || 0)), rate: r2(it.rate) })).filter((it) => it.qty > 0);
    if (!items.length) throw new Error('Tambah sekurang-kurangnya satu produk.');
    if (!t(bill.name)) throw new Error('Sila isi nama pelanggan.');
    const sub = r2(items.reduce((a, it) => a + it.qty * it.rate, 0)), disc = Math.min(sub, Math.max(0, r2(d.discount)));
    return { bill: { name: t(bill.name, 100), addr: t(bill.addr, 300), email: t(bill.email, 100), phone: t(bill.phone, 30) },
      date: isoOr(d.date), terms: Math.max(0, Math.min(120, Math.round(Number(d.terms) || 0))), due: isoOr(d.due || d.date),
      items, sub, discount: disc, total: r2(sub - disc), note: t(d.note, 400),
      seller: { name: t((d.seller || {}).name, 100), phone: t((d.seller || {}).phone, 30) },
      bank: { name: t(bank.name, 100), bank: t(bank.bank, 60), acc: t(bank.acc, 40) }, alloc: d.alloc || {} };
  }
  Object.assign(demo, {
    spInvoices({ phone }) { const sp = normPhone(phone); return { ok: true, invoices: ciAll().filter((x) => x.phone === sp).reverse().map((x) => Object.assign({}, x.data, { no: x.no, date: x.date, total: x.total, status: x.status, updatedAt: x.updatedAt })) }; },
    spSaveInvoice({ phone, no, data }) {
      const sp = normPhone(phone), d = ciClean(data), l = ciAll();
      if (no) { const x = l.find((y) => y.no === no && y.phone === sp); if (!x) throw new Error('Invois tidak dijumpai.'); if (x.status === 'Batal') throw new Error('Invois yang dibatalkan tidak boleh diubah.');
        Object.assign(x, { date: d.date, total: d.total, data: d, updatedAt: stamp() }); setJ('-cinv', l); return { ok: true, invoice: Object.assign({}, d, { no, status: x.status }) }; }
      const n = (getJ('-cinvn', 0) || 0) + 1; setJ('-cinvn', n); no = 'NGAP-' + String(n).padStart(4, '0');
      l.push({ no, phone: sp, date: d.date, total: d.total, status: 'Belum bayar', updatedAt: stamp(), data: d }); setJ('-cinv', l);
      return { ok: true, invoice: Object.assign({}, d, { no, status: 'Belum bayar' }) };
    },
    spSetInvoiceStatus({ phone, no, status }) {
      if (!['Belum bayar', 'Dibayar', 'Batal'].includes(status)) throw new Error('Status tidak sah.');
      const sp = normPhone(phone), l = ciAll(), x = l.find((y) => y.no === no && y.phone === sp); if (!x) throw new Error('Invois tidak dijumpai.'); if (x.status === 'Batal') throw new Error('Invois ini sudah dibatalkan.');
      x.status = status; x.updatedAt = stamp(); setJ('-cinv', l); return { ok: true, invoice: Object.assign({}, x.data, { no, status }) };
    }
  });

  // Salesperson session: every salesperson request carries their code (e.g. salesAkmal) and session token.
  let spCode = '', spTok = '';
  const SP_ACTIONS = ['create', 'get', 'update', 'cancel', 'myOrders', 'agentGet', 'agentSaveProfile', 'agentSaveSales', 'spAgents', 'spAddAgent', 'spUpdateAgent',
                      'spDistribute', 'spUpdateDist', 'spDeleteDist', 'spAddPayment', 'spDeletePayment', 'spRequests', 'spAddRequest', 'spCancelRequest', 'spLogoutAll', 'spDecideAgentReq',
                      'spInvoices', 'spSaveInvoice', 'spSetInvoiceStatus'];
  async function call(action, payload) {
    payload = Object.assign({}, payload || {});
    if (SP_ACTIONS.includes(action)) { payload.sp = spCode; payload.tok = spTok; }
    let res;
    if (!DEMO) res = await remote(action, payload);
    else {
      await new Promise((r) => setTimeout(r, 250));
      if (SP_ACTIONS.includes(action)) payload.phone = demoSpPhone(payload.sp, payload.tok);
      res = demo[action](payload);
    }
    syncProducts(res && (res.products && !res.materials ? res.products : res.settings && res.settings.products));
    return res;
  }

  // Keep this device's product list in step with HQ. When it changes, reload once so every form is rebuilt.
  function syncProducts(list) {
    if (!Array.isArray(list) || !list.length) return;
    const json = JSON.stringify(list.map(({ id, name, desc, img, bg, active }) => ({ id, name, desc, img, bg, active })));
    let old = null; try { old = localStorage.getItem(cfg.PRODUCTS_KEY); } catch (e) {}
    if (json === old) return;
    try { localStorage.setItem(cfg.PRODUCTS_KEY, json); } catch (e) { return; }
    const sig = (arr) => JSON.stringify(arr.map((p) => [p.id, p.name, p.desc, p.img, p.active !== false]));
    if (sig(cfg.mergeProducts(JSON.parse(json))) === sig(cfg.FLAVOURS)) return;
    let done = ''; try { done = sessionStorage.getItem('sc-prod-reload'); } catch (e) {}
    if (done === json) return;
    try { sessionStorage.setItem('sc-prod-reload', json); } catch (e) {}
    location.reload();
  }

  window.SC_API = {
    DEMO, DEMO_PASSWORD, normPhone, normCode,
    create: (order) => call('create', { order }),
    get: (code) => call('get', { code }),
    update: (code, order) => call('update', { code, order }),
    cancel: (code) => call('cancel', { code }),
    myOrders: (phone) => call('myOrders', { phone }),
    agentGet: (phone) => call('agentGet', { phone }),
    agentSaveProfile: (phone, data) => call('agentSaveProfile', { phone, data }),
    agentSaveSales: (phone, code, data) => call('agentSaveSales', { phone, code, data }),
    getAnnouncement: () => call('getAnnouncement', {}),
    spAgents: (phone) => call('spAgents', { phone }),
    spAddAgent: (phone, a) => call('spAddAgent', Object.assign({ phone }, a)),
    spUpdateAgent: (phone, a) => call('spUpdateAgent', Object.assign({ phone }, a)),
    spDistribute: (phone, d) => call('spDistribute', Object.assign({ phone }, d)),
    spUpdateDist: (phone, d) => call('spUpdateDist', Object.assign({ phone }, d)),
    spDeleteDist: (phone, code) => call('spDeleteDist', { phone, code }),
    spAddPayment: (phone, y) => call('spAddPayment', Object.assign({ phone }, y)),
    spDeletePayment: (phone, id) => call('spDeletePayment', { phone, id }),
    agLogin: (code) => call('agLogin', { code }),
    agReceive: (code, dist) => call('agReceive', { code, dist }),
    agSaveSales: (code, dist, data) => call('agSaveSales', { code, dist, data }),
    agSaveProfile: (code, data) => call('agSaveProfile', { code, data }),
    adminTree: (password) => call('adminTree', { password }),
    spLogin: (code, pin, tok) => call('spLogin', { code, pin, tok }),
    spSetPin: (code, tok, pin) => call('spSetPin', { code, tok, pin }),
    spSetProfile: (code, p) => call('spSetProfile', Object.assign({ code, tok: spTok }, p)),
    setSP: (code, tok) => { spCode = code || ''; spTok = tok || ''; },
    getAnnouncements: (q) => call('getAnnouncement', q || {}),
    publicSettings: () => call('publicSettings', {}),
    adminSalespersons: (password) => call('adminSalespersons', { password }),
    adminSaveSalesperson: (password, x) => call('adminSaveSalesperson', Object.assign({ password }, x)),
    adminResetPin: (password, code) => call('adminResetPin', { password, code }),
    adminGetSettings: (password) => call('adminGetSettings', { password }),
    adminSetSettings: (password, settings) => call('adminSetSettings', { password, settings }),
    adminAddHQPayment: (password, y) => call('adminAddHQPayment', Object.assign({ password }, y)),
    adminDeleteHQPayment: (password, id) => call('adminDeleteHQPayment', { password, id }),
    adminLog: (password) => call('adminLog', { password }),
    adminListAnnouncements: (password) => call('adminListAnnouncements', { password }),
    adminAddAnnouncement: (password, text, target) => call('adminAddAnnouncement', { password, text, target }),
    adminDeleteAnnouncement: (password, id) => call('adminDeleteAnnouncement', { password, id }),
    adminSetAnnouncement: (password, text) => call('adminSetAnnouncement', { password, text }),
    adminList: (password) => call('adminList', { password }),
    adminSetStatus: (password, code, status) => call('adminSetStatus', { password, code, status }),
    adminDelete: (password, code) => call('adminDelete', { password, code }),
    adminHQ: (password) => call('adminHQ', { password }),
    adminSaveProduct: (password, product) => call('adminSaveProduct', { password, product }),
    adminSaveExpense: (password, x) => call('adminSaveExpense', Object.assign({ password }, x)),
    adminVoidExpense: (password, id, reason) => call('adminVoidExpense', { password, id, reason }),
    adminSaveMaterial: (password, material) => call('adminSaveMaterial', { password, material }),
    adminStockMove: (password, x) => call('adminStockMove', Object.assign({ password }, x)),
    adminSaveSupplier: (password, supplier) => call('adminSaveSupplier', { password, supplier }),
    adminAddPurchase: (password, x) => call('adminAddPurchase', Object.assign({ password }, x)),
    adminVoidPurchase: (password, id, reason) => call('adminVoidPurchase', { password, id, reason }),
    adminPayPurchase: (password, id, paid, date) => call('adminPayPurchase', { password, id, paid, date }),
    adminDecide: (password, id, decision, reason) => call('adminDecide', { password, id, decision, reason }),
    adminChangePassword: (password, newPassword) => call('adminChangePassword', { password, newPassword }),
    adminEndSession: (password, code) => call('adminEndSession', { password, code }),
    adminBackup: (password) => call('adminBackup', { password }),
    spRequests: () => call('spRequests', {}),
    spAddRequest: (x) => call('spAddRequest', x),
    spCancelRequest: (id) => call('spCancelRequest', { id }),
    spLogoutAll: () => call('spLogoutAll', {}),
    agRequest: (code, x) => call('agRequest', Object.assign({ code }, x)),
    agCancelRequest: (code, id) => call('agCancelRequest', { code, id }),
    spDecideAgentReq: (phone, id, decision, reason, ref) => call('spDecideAgentReq', { phone, id, decision, reason, ref }),
    spInvoices: () => call('spInvoices', {}),
    spSaveInvoice: (no, data) => call('spSaveInvoice', { no, data }),
    spSetInvoiceStatus: (no, status) => call('spSetInvoiceStatus', { no, status })
  };
})();
