/**
 * HQ settings (Script Properties "SETTINGS"): prices, cost, capacity, cut-off, flavours out of stock.
 */

function settings_() {
  var s = {}; try { s = JSON.parse(PropertiesService.getScriptProperties().getProperty('SETTINGS') || '{}'); } catch (e) {}
  return { hqPrice: s.hqPrice || { def: '', items: {} }, hqCost: s.hqCost || { def: '', items: {} }, capacity: Number(s.capacity) || 0,
           cutoffDays: s.cutoffDays === undefined ? 1 : Number(s.cutoffDays) || 0, cutoffHour: s.cutoffHour || '', unavailable: s.unavailable || [],
           stockAgeDays: Number(s.stockAgeDays) || 5, hqPhone: s.hqPhone || '' };
}

function priceIn_(map, id) {
  var it = (map.items || {})[id], v = it !== undefined && it !== '' && it !== null ? it : map.def;
  return v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v);
}

function earliest_(s) {
  var now = new Date(), add = Number(s.cutoffDays) || 0;
  if (s.cutoffHour && Utilities.formatDate(now, TZ, 'HH:mm') >= s.cutoffHour) add++;
  return Utilities.formatDate(new Date(now.getTime() + add * 864e5), TZ, 'yyyy-MM-dd');
}

function loadByDate_(skipCode) {
  var sh = sheet_(), n = sh.getLastRow() - 1, load = {}, today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  if (n > 0) sh.getRange(2, 1, n, 12).getDisplayValues().forEach(function (r) {
    if (!r[0] || r[0] === skipCode || r[1] === 'Dibatalkan' || r[7] < today) return;
    load[r[7]] = (load[r[7]] || 0) + (Number(r[11]) || 0);
  });
  return load;
}
