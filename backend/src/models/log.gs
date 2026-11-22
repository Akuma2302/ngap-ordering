/**
 * Log tab: activity log.
 */

var LG_H = ['Masa', 'Pelaku', 'Tindakan', 'Rujukan', 'Butiran'];

function log_(who, action, ref, detail) {
  try {
    var sh = dataSheet_('Log', LG_H), r = sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, 5).setNumberFormat('@').setValues([[stamp_(), String(who || '-'), action, String(ref || ''), String(detail || '').slice(0, 300)]]);
  } catch (e) {}
}
