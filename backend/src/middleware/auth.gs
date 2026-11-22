/**
 * Authorisation: admin password and salesperson session tokens / PIN hashing.
 */

function hash_(s) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }

function pinHash_(code, pin) { return hash_(String(code).toLowerCase() + ':' + String(pin)); }

function spPhoneOf_(code, tok) {
  var r = spRow_(code);
  if (r.sp.status !== 'Aktif') throw new Error('Akaun salesperson ini tidak aktif.');
  if (!r.token || String(tok || '') !== r.token) throw new Error('Sesi tamat. Sila log masuk semula.');
  if (!r.sp.phone) throw new Error('Sila set nombor telefon anda di Profil dahulu.');
  return r.sp.phone;
}

function checkAdmin_(pw) {
  sheet_(); // make sure setup has run (it also creates the default password)
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!real || String(pw || '') !== real) throw new Error('Kata laluan admin salah.');
}
