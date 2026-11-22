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
  return { ok: true, agents: agents, dists: dists, payments: pays, sales: sales };
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
