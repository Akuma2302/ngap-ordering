/**
 * Salesperson login, PIN and profile.
 */

function spLogin_(req) {
  var r = spRow_(req.code), cache = CacheService.getScriptCache(), key = 'pinfail:' + r.sp.code.toLowerCase();
  if (r.sp.status !== 'Aktif') throw new Error('Akaun salesperson ini tidak aktif.');
  if (req.tok && r.token && req.tok === r.token) return spSession_(r, r.token);            // resume a saved session
  if (r.pin) {
    var fails = Number(cache.get(key)) || 0;
    if (fails >= 5) throw new Error('Terlalu banyak cubaan PIN salah. Cuba lagi selepas 15 minit.');
    if (!req.pin) throw new Error('Sila masukkan PIN.');
    if (pinHash_(r.sp.code, req.pin) !== r.pin) { cache.put(key, String(fails + 1), 900); throw new Error('PIN salah.'); }
    cache.remove(key);
  }
  return withLock_(function () {
    var tok = r.token || Utilities.getUuid();
    r.t.sh.getRange(r.i + 2, 6, 1, 3).setNumberFormat('@').setValues([[stamp_(), r.pin || '', tok]]);
    log_(r.sp.code, 'Log masuk', '', '');
    return { ok: true, sp: r.sp, token: tok, needPin: !r.pin };
  });
}

function spSession_(r, tok) {
  r.t.sh.getRange(r.i + 2, 6).setNumberFormat('@').setValue(stamp_());
  return { ok: true, sp: r.sp, token: tok, needPin: !r.pin };
}

function spSetPin_(req) {
  var r = spRow_(req.code);
  if (!r.token || req.tok !== r.token) throw new Error('Sesi tamat. Sila log masuk semula.');
  var pin = String(req.pin || '');
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN mesti 4 hingga 6 digit.');
  return withLock_(function () {
    var tok = Utilities.getUuid();          // new PIN = new session; other devices must log in again
    r.t.sh.getRange(r.i + 2, 7, 1, 2).setNumberFormat('@').setValues([[pinHash_(r.sp.code, pin), tok]]);
    log_(r.sp.code, 'Tukar PIN', '', '');
    return { ok: true, token: tok };
  });
}

function spSetProfile_(req) {
  return withLock_(function () {
    var r = spRow_(req.code), row = r.t.rows[r.i];
    if (!r.token || req.tok !== r.token) throw new Error('Sesi tamat. Sila log masuk semula.');
    var phone = req.phone !== undefined ? agentPhone_(req.phone) : row[2];
    var name = String(req.name || row[1]).trim().slice(0, 80) || row[1];
    r.t.sh.getRange(r.i + 2, 2, 1, 2).setNumberFormat('@').setValues([[name, phone]]);
    log_(row[0], 'Kemas kini profil', '', name + ' · ' + phone);
    return { ok: true, sp: { code: row[0], name: name, phone: phone, status: row[3] || 'Aktif', hasPin: !!row[6] } };
  });
}
