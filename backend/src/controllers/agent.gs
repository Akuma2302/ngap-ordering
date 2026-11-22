/**
 * Agent app: login with agent code, confirm stock, save sales.
 */

function agLogin_(req) {
  var a = agentByCode_(req.code);
  var dists = table_('Agihan', DS_H).rows.filter(function (r) { return r[2] === a.code; }).map(distObj_);
  var pays = table_('Bayaran', PY_H).rows.filter(function (r) { return r[2] === a.code; }).map(payObj_);
  var sales = {};
  table_('JualanAgent', JA_H).rows.forEach(function (r) { if (r[1] === a.code) sales[r[0]] = parse_(r[3]); });
  var profile = null;
  table_('AgentData', ['Telefon', 'Dikemaskini', 'Data']).rows.forEach(function (r) { if (r[0] === a.code) profile = parse_(r[2]); });
  return { ok: true, agent: { code: a.code, name: a.name, phone: a.phone }, sp: { phone: a.sp, name: spName_(a.sp), code: spCodeByPhone_(a.sp) },
           dists: dists, payments: pays, sales: sales, profile: profile, products: publicProducts_() };
}

function agReceive_(req) {
  var a = agentByCode_(req.code);
  return withLock_(function () {
    var d = agDist_(a, req.dist);
    d.t.sh.getRange(d.i + 2, 5, 1, 3).setValues([['Diterima', d.t.rows[d.i][5], stamp_()]]);
    log_(a.code, 'Terima stok', req.dist, '');
    return { ok: true };
  });
}

function agSaveSales_(req) {
  var a = agentByCode_(req.code);
  return withLock_(function () {
    agDist_(a, req.dist);
    upsert_(dataSheet_('JualanAgent', JA_H), 1, req.dist, [req.dist, a.code, stamp_(), json64_(req.data)]);
    return { ok: true };
  });
}

function agSaveProfile_(req) {
  var a = agentByCode_(req.code);
  return withLock_(function () {
    upsert_(dataSheet_('AgentData', ['Telefon', 'Dikemaskini', 'Data']), 1, a.code, [a.code, stamp_(), json64_(req.data)]);
    return { ok: true };
  });
}
