/**
 * Salesperson manages agents, stock given to agents and agent payments.
 */

function spAgents_(req) {
  var sp = agentPhone_(req.phone);
  var agents = table_('Agents', AG_H).rows.filter(function (r) { return normPhone_(r[1]) === sp; }).map(agentObj_);
  var dists = table_('Agihan', DS_H).rows.filter(function (r) { return r[0] && normPhone_(r[1]) === sp; }).map(distObj_);
  var pays = table_('Bayaran', PY_H).rows.filter(function (r) { return r[0] && normPhone_(r[1]) === sp; }).map(payObj_);
  var codes = {}; dists.forEach(function (d) { codes[d.code] = 1; });
  var sales = {};
  table_('JualanAgent', JA_H).rows.forEach(function (r) { if (codes[r[0]]) sales[r[0]] = parse_(r[3]); });
  return { ok: true, agents: agents, dists: dists, payments: pays, sales: sales,
           agentRequests: agentReqs_(function (r) { return normPhone_(r[3]) === sp; }).slice(-100) };
}

function spAddAgent_(req) {
  var sp = agentPhone_(req.phone), name = String(req.name || '').trim().slice(0, 80);
  if (!name) throw new Error('Sila isi nama agent.');
  var ph = req.agentPhone ? normPhone_(req.agentPhone) : '';
  return withLock_(function () {
    var t = table_('Agents', AG_H), code = agentCode_(name, t.rows.map(function (r) { return r[0]; }));
    var row = [code, sp, name, ph, 'Aktif', stamp_(), String(req.note || '').slice(0, 200)];
    var r = t.sh.getLastRow() + 1;
    t.sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
    log_(req.sp, 'Daftar agent', code, name);
    return { ok: true, agent: agentObj_(row) };
  });
}

function spUpdateAgent_(req) {
  var sp = agentPhone_(req.phone);
  return withLock_(function () {
    var a = myAgent_(sp, req.code), r = a.t.rows[a.i];
    var row = [r[0], r[1], String(req.name || r[2]).trim().slice(0, 80), req.agentPhone !== undefined ? normPhone_(req.agentPhone) : r[3],
               req.status === 'Tidak aktif' ? 'Tidak aktif' : 'Aktif', r[5], req.note !== undefined ? String(req.note).slice(0, 200) : r[6]];
    a.t.sh.getRange(a.i + 2, 1, 1, row.length).setNumberFormat('@').setValues([row]);
    log_(req.sp, 'Edit agent', row[0], row[2] + ' · ' + row[4]);
    return { ok: true, agent: agentObj_(row) };
  });
}

function spDistribute_(req) {
  var sp = agentPhone_(req.phone);
  return withLock_(function () {
    var a = myAgent_(sp, req.agent);
    if (a.agent.status !== 'Aktif') throw new Error('Agent ini tidak aktif.');
    var c = cleanDistItems_(req.items), date = String(req.date || '').trim() || Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    var t = table_('Agihan', DS_H), code = nextNo_('LAST_DIST_NO', 'DS-'), now = stamp_();
    var row = [code, sp, a.agent.code, date, 'Dihantar', now, now, String(req.note || '').slice(0, 300), c.total, c.value, json64_({ items: c.items, alloc: req.alloc || {} })];
    var r = t.sh.getLastRow() + 1;
    t.sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
    log_(req.sp, 'Agih stok', code, a.agent.code + ' · ' + c.total + ' biji · RM' + c.value.toFixed(2));
    return { ok: true, dist: distObj_(row) };
  });
}

function spUpdateDist_(req) {
  var sp = agentPhone_(req.phone);
  return withLock_(function () {
    var t = table_('Agihan', DS_H), i = findRow_(t, 0, req.code);
    if (i < 0 || normPhone_(t.rows[i][1]) !== sp) throw new Error('Agihan tidak dijumpai.');
    var r = t.rows[i], c = cleanDistItems_(req.items);
    var row = [r[0], r[1], r[2], String(req.date || r[3]), r[4], r[5], stamp_(), req.note !== undefined ? String(req.note).slice(0, 300) : r[7], c.total, c.value, json64_({ items: c.items, alloc: req.alloc || {} })];
    t.sh.getRange(i + 2, 1, 1, row.length).setNumberFormat('@').setValues([row]);
    return { ok: true, dist: distObj_(row) };
  });
}

function spDeleteDist_(req) {
  var sp = agentPhone_(req.phone);
  return withLock_(function () {
    var t = table_('Agihan', DS_H), i = findRow_(t, 0, req.code);
    if (i < 0 || normPhone_(t.rows[i][1]) !== sp) throw new Error('Agihan tidak dijumpai.');
    log_(req.sp, 'Padam agihan', req.code, t.rows[i][2] + ' · ' + t.rows[i][8] + ' biji');
    t.sh.deleteRow(i + 2);
    return { ok: true };
  });
}

function spAddPayment_(req) {
  var sp = agentPhone_(req.phone), amt = Math.round((Number(req.amount) || 0) * 100) / 100;
  if (amt <= 0) throw new Error('Sila isi jumlah bayaran.');
  return withLock_(function () {
    var a = myAgent_(sp, req.agent), t = table_('Bayaran', PY_H), id = nextNo_('LAST_PAY_NO', 'PY-');
    var row = [id, sp, a.agent.code, String(req.date || Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')), String(amt), String(req.note || '').slice(0, 200), stamp_()];
    var r = t.sh.getLastRow() + 1;
    t.sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
    log_(req.sp, 'Bayaran agent', id, a.agent.code + ' · RM' + amt.toFixed(2));
    return { ok: true, payment: payObj_(row) };
  });
}

function spDeletePayment_(req) {
  var sp = agentPhone_(req.phone);
  return withLock_(function () {
    var t = table_('Bayaran', PY_H), i = findRow_(t, 0, req.id);
    if (i < 0 || normPhone_(t.rows[i][1]) !== sp) throw new Error('Bayaran tidak dijumpai.');
    log_(req.sp, 'Padam bayaran agent', req.id, t.rows[i][2] + ' · RM' + t.rows[i][4]);
    t.sh.deleteRow(i + 2);
    return { ok: true };
  });
}

/* ---------- agent -> salesperson requests: stock and payment proof ----------
 * PermintaanAgent: ID | Masa | Kod Agent | Salesperson | Jenis (stok|bayaran) | Data | Status | Masa keputusan | Sebab | Rujukan
 * The agent asks; only their own salesperson decides. Approving a payment proof records the agent payment;
 * approving a stock request links the distribution that fulfilled it.
 */
var AR_H = ['ID', 'Masa', 'Kod Agent', 'Salesperson', 'Jenis', 'Data', 'Status', 'Masa keputusan', 'Sebab', 'Rujukan'];

function arObj_(r) { var d = parse_(r[5]); return { id: r[0], at: r[1], agent: r[2], sp: r[3], type: r[4], items: d.items || {}, total: Number(d.total) || 0, amount: Number(d.amount) || 0,
  bankRef: d.bankRef || '', date: d.date || '', note: d.note || '', status: r[6] || 'Menunggu', decidedAt: r[7], reason: r[8], ref: r[9] }; }
function agentReqs_(filter) { return table_('PermintaanAgent', AR_H).rows.filter(function (r) { return r[0] && filter(r); }).map(arObj_); }

function agRequest_(req) {
  var a = agentByCode_(req.code), type = req.type === 'bayaran' ? 'bayaran' : 'stok', data = { note: String(req.note || '').trim().slice(0, 300) };
  if (type === 'stok') {
    var items = {}, total = 0;
    FLAVOURS.forEach(function (f) { var q = Math.max(0, Math.min(9999, Math.floor(Number((req.items || {})[f.id]) || 0))); if (q) { items[f.id] = q; total += q; } });
    if (!total) throw new Error('Pilih sekurang-kurangnya 1 perisa.');
    data.items = items; data.total = total;
  } else {
    data.amount = Math.round((Number(req.amount) || 0) * 100) / 100; data.bankRef = String(req.bankRef || '').trim().slice(0, 60);
    data.date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.date || '')) ? req.date : Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    if (data.amount <= 0) throw new Error('Sila isi jumlah yang dibayar.');
    if (!data.bankRef) throw new Error('Sila isi no. rujukan / cara bayaran (cth. tunai, DuitNow ref).');
  }
  return withLock_(function () {
    var t = table_('PermintaanAgent', AR_H);
    if (type === 'bayaran' && t.rows.some(function (r) { return r[2] === a.code && r[4] === 'bayaran' && r[6] === 'Menunggu' && parse_(r[5]).bankRef === data.bankRef; })) throw new Error('Bukti bayaran ini sedang disemak salesperson.');
    var id = nextNo_('LAST_AREQ_NO', 'AR-'), row = [id, stamp_(), a.code, a.sp, type, json64_(data), 'Menunggu', '', '', ''];
    var r = t.sh.getLastRow() + 1; t.sh.getRange(r, 1, 1, AR_H.length).setNumberFormat('@').setValues([row]);
    log_(a.code, type === 'stok' ? 'Minta stok' : 'Bukti bayaran agent', id, type === 'stok' ? data.total + ' biji' : 'RM' + data.amount.toFixed(2));
    return { ok: true, request: arObj_(row) };
  });
}

function agCancelRequest_(req) {
  var a = agentByCode_(req.code);
  return withLock_(function () {
    var t = table_('PermintaanAgent', AR_H), i = findRow_(t, 0, req.id);
    if (i < 0 || t.rows[i][2] !== a.code) throw new Error('Permintaan tidak dijumpai.');
    if (t.rows[i][6] !== 'Menunggu') throw new Error('Permintaan ini sudah diputuskan.');
    t.sh.getRange(i + 2, 7, 1, 3).setNumberFormat('@').setValues([['Dibatalkan', stamp_(), 'Dibatalkan oleh agent']]);
    return { ok: true };
  });
}

function spDecideAgentReq_(req) {
  var sp = agentPhone_(req.phone), ok = req.decision === 'Diluluskan', reason = String(req.reason || '').trim().slice(0, 200);
  if (!ok && !reason) throw new Error('Sila tulis sebab permintaan ditolak.');
  return withLock_(function () {
    var t = table_('PermintaanAgent', AR_H), i = findRow_(t, 0, req.id);
    if (i < 0 || normPhone_(t.rows[i][3]) !== sp) throw new Error('Permintaan tidak dijumpai.');
    var r = arObj_(t.rows[i]); if (r.status !== 'Menunggu') throw new Error('Permintaan ini sudah diputuskan.');
    var ref = String(req.ref || '');
    if (ok && r.type === 'bayaran') {
      var pt = table_('Bayaran', PY_H), pid = nextNo_('LAST_PAY_NO', 'PY-');
      var prow = [pid, sp, r.agent, r.date, String(r.amount), ('Bukti ' + r.bankRef + ' (' + r.id + ')').slice(0, 200), stamp_()];
      pt.sh.getRange(pt.sh.getLastRow() + 1, 1, 1, PY_H.length).setNumberFormat('@').setValues([prow]); ref = pid;
    }
    t.sh.getRange(i + 2, 7, 1, 4).setNumberFormat('@').setValues([[ok ? 'Diluluskan' : 'Ditolak', stamp_(), reason, ref]]);
    log_(req.sp, ok ? 'Lulus permintaan agent' : 'Tolak permintaan agent', r.id, r.agent + (ref ? ' · ' + ref : '') + (reason ? ' · ' + reason : ''));
    return { ok: true, ref: ref };
  });
}
