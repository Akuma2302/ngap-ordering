/**
 * Salesperson's own sales records per order (Jualan tab) and profile data (AgentData tab).
 */

function agentGet_(req) {
  var phone = agentPhone_(req.phone), out = { ok: true, profile: null, sales: {} };
  var a = dataSheet_('AgentData', ['Telefon', 'Dikemaskini', 'Data']), n = a.getLastRow() - 1;
  if (n > 0) a.getRange(2, 1, n, 3).getDisplayValues().forEach(function (r) {
    if (normPhone_(r[0]) === phone) { try { out.profile = JSON.parse(r[2]); } catch (e) {} }
  });
  var j = dataSheet_('Jualan', ['Kod Order', 'Telefon', 'Dikemaskini', 'Data']), m = j.getLastRow() - 1;
  if (m > 0) j.getRange(2, 1, m, 4).getDisplayValues().forEach(function (r) {
    if (r[0] && normPhone_(r[1]) === phone) { try { out.sales[r[0]] = JSON.parse(r[3]); } catch (e) {} }
  });
  return out;
}

function agentSaveProfile_(req) {
  var phone = agentPhone_(req.phone);
  return withLock_(function () {
    upsert_(dataSheet_('AgentData', ['Telefon', 'Dikemaskini', 'Data']), 1, phone, [phone, stamp_(), json64_(req.data)]);
    return { ok: true };
  });
}

function agentSaveSales_(req) {
  var phone = agentPhone_(req.phone);
  var found = find_(req.code);
  if (normPhone_(found.order.phone) !== phone) throw new Error('Order ini bukan milik nombor telefon anda.');
  return withLock_(function () {
    upsert_(dataSheet_('Jualan', ['Kod Order', 'Telefon', 'Dikemaskini', 'Data']), 1, found.order.code, [found.order.code, phone, stamp_(), json64_(req.data)]);
    return { ok: true };
  });
}
