/**
 * Salesperson tab: accounts that log in with codes such as salesAkmal.
 */

var SP_H = ['Kod', 'Nama', 'Telefon', 'Status', 'Dicipta', 'Terakhir Aktif', 'PIN', 'Token'];

function spTable_() {
  var t = table_('Salesperson', SP_H);
  if (t.sh.getRange(1, SP_H.length).getValue() !== SP_H[SP_H.length - 1]) {   // older sheet: add the new header columns
    t.sh.getRange(1, 1, 1, SP_H.length).setValues([SP_H]).setFontWeight('bold').setBackground('#7A1E2C').setFontColor('#ffffff');
    t.sh.getRange(2, 1, t.sh.getMaxRows() - 1, SP_H.length).setNumberFormat('@');
  }
  if (!t.rows.length) {
    // first use: create the 8 salesperson codes, taking each phone from their latest order (if any)
    var sh = sheet_(), n = sh.getLastRow() - 1, phones = {};
    if (n > 0) sh.getRange(2, 5, n, 2).getDisplayValues().forEach(function (r) { phones[String(r[0]).trim().toLowerCase()] = normPhone_(r[1]); });
    var rows = SP_SEED.map(function (nm) { return ['sales' + nm, nm, phones[nm.toLowerCase()] || '', 'Aktif', stamp_(), '', '', '']; });
    t.sh.getRange(2, 1, rows.length, SP_H.length).setNumberFormat('@').setValues(rows);
    t = table_('Salesperson', SP_H);
  } else {
    // codes added to SP_SEED later (e.g. salesUmar) are appended once; existing rows are never changed
    var have = {}; t.rows.forEach(function (r) { have[String(r[0]).toLowerCase()] = 1; });
    var add = SP_SEED.filter(function (nm) { return !have[('sales' + nm).toLowerCase()]; })
                     .map(function (nm) { return ['sales' + nm, nm, '', 'Aktif', stamp_(), '', '', '']; });
    if (add.length) {
      t.sh.getRange(t.sh.getLastRow() + 1, 1, add.length, SP_H.length).setNumberFormat('@').setValues(add);
      t = table_('Salesperson', SP_H);
    }
  }
  return t;
}

function spRow_(code) {
  var t = spTable_(), key = String(code || '').trim().toLowerCase();
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i][0] && t.rows[i][0].toLowerCase() === key) return { t: t, i: i, pin: t.rows[i][6], token: t.rows[i][7], sp: spObj_(t.rows[i]) };
  throw new Error('Kod salesperson tidak sah.');
}

function spObj_(r) { return { code: r[0], name: r[1], phone: r[2], status: r[3] || 'Aktif', lastActive: r[5] || '', hasPin: !!r[6] }; }

function spCodeByPhone_(phone) {
  var r = spTable_().rows.filter(function (x) { return x[2] && normPhone_(x[2]) === phone; })[0];
  return r ? r[0] : '';
}
