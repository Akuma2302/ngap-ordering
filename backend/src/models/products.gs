/**
 * Product master (Script Property "PRODUCTS"). Admin adds, renames or archives products here.
 * Products are never deleted: each one owns a column in the Orders tab, and old orders keep pointing at it.
 * The built-in FLAVOURS list in config.gs is only the starting seed.
 */

function products_() {
  var list = null;
  try { list = JSON.parse(PropertiesService.getScriptProperties().getProperty('PRODUCTS') || 'null'); } catch (e) {}
  if (!list || !list.length) list = FLAVOURS_SEED.map(function (f) { return { id: f.id, name: f.name, desc: '', img: '', bg: '', active: true, recipe: {} }; });
  return list.map(function (p) {
    return { id: p.id, name: p.name, desc: p.desc || '', img: p.img || '', bg: p.bg || '', active: p.active !== false, recipe: p.recipe || {} };
  });
}

function saveProducts_(list) {
  PropertiesService.getScriptProperties().setProperty('PRODUCTS', JSON.stringify(list));
  FLAVOURS = list;
  ensureOrderHeader_();
}

// Keep the Orders header in step with the product list (renamed products, new columns at the end).
function ensureOrderHeader_() {
  var sh = sheet_(), h = headerRow_();
  if (sh.getMaxColumns() < h.length) sh.insertColumnsAfter(sh.getMaxColumns(), h.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#7A1E2C').setFontColor('#ffffff');
}

function productSlug_(name, taken) {
  var base = String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produk';
  var id = base, n = 2;
  while (taken.indexOf(id) >= 0) id = base + '-' + (n++);
  return id;
}

// Public view for the salesperson / agent apps (no recipe).
function publicProducts_() {
  return FLAVOURS.map(function (p) { return { id: p.id, name: p.name, desc: p.desc || '', img: p.img || '', bg: p.bg || '', active: p.active !== false }; });
}
