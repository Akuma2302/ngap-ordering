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
    adminSalespersons({ password }) { if (password !== DEMO_PASSWORD) throw new Error('Kata laluan admin salah.'); return { ok: true, salespersons: sps() }; },
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
      if (password !== DEMO_PASSWORD) throw new Error('Kata laluan admin salah.');
      const T = net(); return { ok: true, agents: T.agents, dists: T.dists, payments: T.pays, sales: T.jsales };
    },
    getAnnouncement() { const a = JSON.parse(localStorage.getItem(KEY + '-ann') || 'null'); return { ok: true, announcement: a && a.text ? a : null }; },
    adminSetAnnouncement({ password, text }) {
      if (password !== DEMO_PASSWORD) throw new Error('Kata laluan admin salah.');
      text = String(text || '').trim();
      const a = text ? { text, updatedAt: stamp() } : null;
      localStorage.setItem(KEY + '-ann', JSON.stringify(a)); return { ok: true, announcement: a };
    },
    adminList({ password }) {
      if (password !== DEMO_PASSWORD) throw new Error('Kata laluan admin salah.');
      return { ok: true, orders: load() };
    },
    adminSetStatus({ password, code, status }) {
      if (password !== DEMO_PASSWORD) throw new Error('Kata laluan admin salah.');
      if (!cfg.STATUSES.includes(status)) throw new Error('Status tidak sah.');
      const list = load(), i = findIdx(list, code);
      list[i].status = status; save(list); return { ok: true, order: list[i] };
    },
    adminDelete({ password, code }) {
      if (password !== DEMO_PASSWORD) throw new Error('Kata laluan admin salah.');
      const list = load(), i = findIdx(list, code), c = list[i].code;
      list.splice(i, 1); save(list); return { ok: true, code: c };
    }
  };

  /* ---------- demo: HQ settings, invoices, PIN, log, targeted announcements ---------- */
  const DEF_SET = { hqPrice: { def: 3.5, items: { 'tiramisu': 4, 'matcha-strawberry': 4 } }, hqCost: { def: 1.6, items: {} }, capacity: 300, cutoffDays: 1, cutoffHour: '18:00', unavailable: [], stockAgeDays: 5 };
  const getJ = (k, d) => { try { return JSON.parse(localStorage.getItem(KEY + k)) ?? d; } catch (e) { return d; } };
  const setJ = (k, v) => { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} };
  const dSet = () => Object.assign({}, DEF_SET, getJ('-set', {}));
  const pIn = (m, id) => { const it = (m.items || {})[id], v = it !== undefined && it !== '' && it !== null ? it : m.def; return v === '' || v === null || v === undefined ? null : Number(v); };
  const isoD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function dEarliest(s) { const now = new Date(); let add = Number(s.cutoffDays) || 0; const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (s.cutoffHour && hm >= s.cutoffHour) add++; const d = new Date(); d.setDate(d.getDate() + add); return isoD(d); }
  function dLoad(skip) { const t = isoD(new Date()), l = {}; load().forEach((o) => { if (o.code === skip || o.status === 'Dibatalkan' || o.date < t) return; l[o.date] = (l[o.date] || 0) + o.total; }); return l; }
  const dPublic = () => { const s = dSet(); return { hqPrice: s.hqPrice, capacity: s.capacity, cutoffDays: s.cutoffDays, cutoffHour: s.cutoffHour, unavailable: s.unavailable, earliest: dEarliest(s), load: dLoad('') }; };
  function dRules(o, prev, code) {
    const s = dSet(), pi = prev ? prev.items : {};
    const bad = cfg.FLAVOURS.filter((f) => s.unavailable.includes(f.id) && (o.items[f.id] || 0) > (pi[f.id] || 0));
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
      inv[o.code] = { code: o.code, phone: o.phone, date: o.date, status: o.status, total: o.total, amount: o.status === 'Dibatalkan' ? 0 : Math.round(amount * 100) / 100, prices, missing };
    });
    Object.keys(inv).forEach((k) => { if (!load().some((o) => o.code === k)) delete inv[k]; });
    setJ('-inv', inv); return Object.values(inv);
  }
  const dLog = (who, action, ref, detail) => { const l = getJ('-log', []); l.unshift({ at: stamp(), who: who || '-', action, ref: ref || '', detail: detail || '' }); setJ('-log', l.slice(0, 400)); };
  const dSp = (code) => { const all = sps(), s = all.find((x) => x.code.toLowerCase() === String(code || '').trim().toLowerCase()); if (!s) throw new Error('Kod salesperson tidak sah.'); return { all, s }; };
  const pinH = (code, pin) => btoa(unescape(encodeURIComponent(String(code).toLowerCase() + ':' + pin)));
  const adm = (pw) => { if (pw !== DEMO_PASSWORD) throw new Error('Kata laluan admin salah.'); };
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
    update(p) { const list = load(), prev = list[findIdx(list, p.code)]; if (prev.phone !== p.phone) throw new Error('Order ini bukan milik anda.');
      const o = clean(Object.assign({}, p.order, { phone: p.phone })); dRules(o, prev, prev.code); const r = _update(Object.assign({}, p, { order: Object.assign({}, p.order, { phone: p.phone }) })); dInvoices(); dLog(p.sp, 'Edit order', r.order.code, ''); return r; },
    cancel(p) { const list = load(), prev = list[findIdx(list, p.code)]; if (prev.phone !== p.phone) throw new Error('Order ini bukan milik anda.'); const r = _cancel(p); dInvoices(); dLog(p.sp, 'Batal order', p.code, ''); return r; },
    myOrders(p) { const r = _myOrders(p), ph = normPhone(p.phone); return Object.assign(r, { invoices: dInvoices().filter((v) => v.phone === ph), hqPayments: getJ('-hqpay', []).filter((y) => y.phone === ph), settings: dPublic() }); },
    adminList(p) { const r = _adminList(p); return Object.assign(r, { invoices: dInvoices(), hqPayments: getJ('-hqpay', []), settings: demo.adminGetSettings(p).settings }); },
    adminSetStatus(p) { const prev = load().find((o) => o.code === p.code); const r = _setStatus(p); dInvoices(); dLog('Admin', 'Status order', p.code, (prev ? prev.status : '') + ' → ' + p.status); return r; },
    adminDelete(p) { const r = _del(p); dInvoices(); dLog('Admin', 'Padam order', p.code, ''); return r; },
    adminTree(p) { const r = _tree(p), all = JSON.parse(localStorage.getItem(KEY + '-agent') || '{}'), spSales = {};
      Object.values(all).forEach((a) => Object.assign(spSales, a.sales || {})); return Object.assign(r, { spSales }); }
  });

  // Salesperson session: every salesperson request carries their code (e.g. salesAkmal) and session token.
  let spCode = '', spTok = '';
  const SP_ACTIONS = ['create', 'get', 'update', 'cancel', 'myOrders', 'agentGet', 'agentSaveProfile', 'agentSaveSales', 'spAgents', 'spAddAgent', 'spUpdateAgent',
                      'spDistribute', 'spUpdateDist', 'spDeleteDist', 'spAddPayment', 'spDeletePayment'];
  async function call(action, payload) {
    payload = Object.assign({}, payload || {});
    if (SP_ACTIONS.includes(action)) { payload.sp = spCode; payload.tok = spTok; }
    if (!DEMO) return remote(action, payload);
    await new Promise((r) => setTimeout(r, 250));
    if (SP_ACTIONS.includes(action)) payload.phone = demoSpPhone(payload.sp, payload.tok);
    return demo[action](payload);
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
    adminDelete: (password, code) => call('adminDelete', { password, code })
  };
})();
