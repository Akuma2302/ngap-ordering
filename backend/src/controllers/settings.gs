/**
 * Read and change HQ settings.
 */

function publicSettings_() {
  var s = settings_();
  return { ok: true, settings: { hqPrice: s.hqPrice, capacity: s.capacity, cutoffDays: s.cutoffDays, cutoffHour: s.cutoffHour,
           unavailable: s.unavailable, earliest: earliest_(s), load: loadByDate_('') } };
}

function adminGetSettings_(req) { checkAdmin_(req.password); var s = settings_(); s.earliest = earliest_(s); s.load = loadByDate_(''); return { ok: true, settings: s }; }

function adminSetSettings_(req) {
  checkAdmin_(req.password);
  var cur = settings_(), x = req.settings || {};
  var clean = function (m) {
    m = m || {}; var out = { def: m.def === '' || m.def === null || m.def === undefined ? '' : Math.max(0, Number(m.def) || 0), items: {} };
    FLAVOURS.forEach(function (f) { var v = (m.items || {})[f.id]; if (v !== '' && v !== null && v !== undefined && !isNaN(Number(v))) out.items[f.id] = Math.max(0, Number(v)); });
    return out;
  };
  var next = {
    hqPrice: x.hqPrice ? clean(x.hqPrice) : cur.hqPrice, hqCost: x.hqCost ? clean(x.hqCost) : cur.hqCost,
    capacity: x.capacity !== undefined ? Math.max(0, Math.floor(Number(x.capacity)) || 0) : cur.capacity,
    cutoffDays: x.cutoffDays !== undefined ? Math.max(0, Math.min(30, Math.floor(Number(x.cutoffDays)) || 0)) : cur.cutoffDays,
    cutoffHour: x.cutoffHour !== undefined ? (/^\d{2}:\d{2}$/.test(x.cutoffHour) ? x.cutoffHour : '') : cur.cutoffHour,
    unavailable: x.unavailable ? x.unavailable.filter(function (id) { return FLAVOURS.some(function (f) { return f.id === id; }); }) : cur.unavailable,
    stockAgeDays: x.stockAgeDays !== undefined ? Math.max(1, Math.min(60, Math.floor(Number(x.stockAgeDays)) || 5)) : cur.stockAgeDays
  };
  PropertiesService.getScriptProperties().setProperty('SETTINGS', JSON.stringify(next));
  log_('Admin', 'Tetapan HQ', Object.keys(x).join(', '), '');
  next.earliest = earliest_(next); next.load = loadByDate_('');
  return { ok: true, settings: next };
}
