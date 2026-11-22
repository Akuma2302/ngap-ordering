/**
 * Agents, Agihan (stock given to agents), Bayaran (agent payments), JualanAgent.
 */

// Agents:      Kod Agent | Salesperson | Nama | Telefon | Status | Dicipta | Nota
// Agihan:      stock a salesperson gives to one agent (items: {flavour: {qty, price}}, alloc: {orderCode: {flavour: qty}})
// Bayaran:     payments from an agent to their salesperson
// JualanAgent: the agent's own sales record for each Agihan (same JSON shape as Jualan)
var AG_H = ['Kod Agent', 'Salesperson', 'Nama', 'Telefon', 'Status', 'Dicipta', 'Nota'];

var DS_H = ['Kod Agihan', 'Salesperson', 'Kod Agent', 'Tarikh', 'Status', 'Dicipta', 'Dikemaskini', 'Nota', 'Jumlah Biji', 'Nilai (RM)', 'Data'];

var PY_H = ['ID', 'Salesperson', 'Kod Agent', 'Tarikh', 'Jumlah (RM)', 'Nota', 'Dicipta'];

var JA_H = ['Kod Agihan', 'Kod Agent', 'Dikemaskini', 'Data'];

function agentObj_(r) { return { code: r[0], sp: r[1], name: r[2], phone: r[3], status: r[4] || 'Aktif', createdAt: r[5], note: r[6] }; }

function distObj_(r) { var d = parse_(r[10]); return { code: r[0], sp: r[1], agent: r[2], date: r[3], status: r[4], createdAt: r[5], updatedAt: r[6], note: r[7], total: Number(r[8]) || 0, value: Number(r[9]) || 0, items: d.items || {}, alloc: d.alloc || {} }; }

function payObj_(r) { return { id: r[0], sp: r[1], agent: r[2], date: r[3], amount: Number(r[4]) || 0, note: r[5], createdAt: r[6] }; }

// Agent codes look like agentAli / agentSitiAminah (a number is added when the name is taken).
function agentCode_(name, existing) {
  var base = 'agent' + String(name || '').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(String).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join('');
  if (base === 'agent') base = 'agentBaru';
  var taken = existing.map(function (c) { return String(c).toLowerCase(); }), code = base, n = 2;
  while (taken.indexOf(code.toLowerCase()) >= 0) code = base + (n++);
  return code;
}

function myAgent_(sp, code) {
  var t = table_('Agents', AG_H), i = findCodeRow_(t, code);
  if (i < 0 || normPhone_(t.rows[i][1]) !== sp) throw new Error('Agent tidak dijumpai.');
  return { t: t, i: i, agent: agentObj_(t.rows[i]) };
}

function cleanDistItems_(items) {
  var out = {}, total = 0, value = 0;
  FLAVOURS.forEach(function (f) {
    var it = (items || {})[f.id] || {};
    var q = Math.max(0, Math.min(9999, Math.floor(Number(it.qty)) || 0)); if (!q) return;
    var p = Math.max(0, Number(it.price) || 0);
    out[f.id] = { qty: q, price: Math.round(p * 100) / 100 }; total += q; value += q * p;
  });
  if (total < 1) throw new Error('Sila pilih sekurang-kurangnya 1 biji untuk diagih.');
  return { items: out, total: total, value: Math.round(value * 100) / 100 };
}

function spName_(sp) {
  var sh = sheet_(), n = sh.getLastRow() - 1, name = '';
  if (n > 0) sh.getRange(2, 5, n, 2).getDisplayValues().forEach(function (r) { if (normPhone_(r[1]) === sp) name = r[0]; });
  return name;
}

function agentByCode_(code) {
  var t = table_('Agents', AG_H), i = findCodeRow_(t, code);
  if (i < 0) throw new Error('Kod agent tidak sah.');
  var a = agentObj_(t.rows[i]);
  if (a.status !== 'Aktif') throw new Error('Kod agent ini tidak aktif. Hubungi salesperson anda.');
  return a;
}

function agDist_(a, distCode) {
  var t = table_('Agihan', DS_H), i = findRow_(t, 0, distCode);
  if (i < 0 || t.rows[i][2] !== a.code) throw new Error('Agihan tidak dijumpai.');
  return { t: t, i: i };
}
