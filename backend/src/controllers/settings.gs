/**
 * Read and change HQ settings.
 */

function publicSettings_() {
  var s = settings_();
  return { ok: true, settings: { hqPrice: s.hqPrice, capacity: s.capacity, cutoffDays: s.cutoffDays, cutoffHour: s.cutoffHour,
           unavailable: s.unavailable.concat(FLAVOURS.filter(function (p) { return p.active === false; }).map(function (p) { return p.id; })),
           earliest: earliest_(s), load: loadByDate_(''), hqPhone: s.hqPhone, products: publicProducts_() } };
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
    allowNegStock: x.allowNegStock !== undefined ? !!x.allowNegStock : cur.allowNegStock,
    openingCash: x.openingCash ? { amount: x.openingCash.amount === '' || x.openingCash.amount === null ? '' : Math.round((Number(x.openingCash.amount) || 0) * 100) / 100,
                                   date: /^\d{4}-\d{2}-\d{2}$/.test(String(x.openingCash.date || '')) ? x.openingCash.date : '' } : cur.openingCash,
    invoiceTermDays: x.invoiceTermDays !== undefined ? Math.max(0, Math.min(120, Math.floor(Number(x.invoiceTermDays)) || 0)) : cur.invoiceTermDays,
    targets: x.targets ? cleanTargets_(x.targets) : cur.targets,
    unavailable: x.unavailable ? x.unavailable.filter(function (id) { return FLAVOURS.some(function (f) { return f.id === id; }); }) : cur.unavailable,
    stockAgeDays: x.stockAgeDays !== undefined ? Math.max(1, Math.min(60, Math.floor(Number(x.stockAgeDays)) || 5)) : cur.stockAgeDays,
    hqPhone: x.hqPhone !== undefined ? (String(x.hqPhone).trim() ? agentPhone_(x.hqPhone) : '') : cur.hqPhone   // WhatsApp number for "Hubungi HQ"
  };
  PropertiesService.getScriptProperties().setProperty('SETTINGS', JSON.stringify(next));
  log_('Admin', 'Tetapan HQ', Object.keys(x).join(', '), '');
  next.earliest = earliest_(next); next.load = loadByDate_('');
  return { ok: true, settings: next };
}

// Monthly HQ targets per salesperson code, in pieces (biji) ordered from HQ.
function cleanTargets_(m) {
  var out = {}; Object.keys(m || {}).forEach(function (k) { var v = Math.floor(Number(m[k]) || 0); if (v > 0 && /^sales/i.test(k)) out[k] = v; });
  return out;
}
