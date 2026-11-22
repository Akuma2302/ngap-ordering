// Soft Cookies ordering — configuration
// 1) Paste the Web app URL from Apps Script (Deploy → Manage deployments) below.
// 2) Leave it empty to run in DEMO mode (orders are saved only in this browser).
window.SC_CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzkF0l9_bibFiGXbDkV5bQ5qm3JJnK2LpBnuHEmdsOd34epz-3gG6LXhRldcam_J5u3/exec',

  // Keep in sync with apps-script/Code.gs (same ids, same order).
  FLAVOURS: [
    { id: 'chocolate-chip',    name: 'Chocolate Chip',    desc: 'Butter dough, chocolate buttons',   img: 'img/chocolate-chip.webp',    bg: '#D99A5B' },
    { id: 'chochocunk',        name: 'Chochocunk',        desc: 'Big chocolate chunks',              img: 'img/chochocunk.webp',        bg: '#A8653A' },
    { id: 'seasalt',           name: 'Seasalt',           desc: 'Chocolate chips, sea salt',         img: 'img/seasalt.webp',           bg: '#7FAFC4' },
    { id: 'dark-seasalt',      name: 'Dark Seasalt',      desc: 'Dark chocolate dough, sea salt',    img: 'img/dark-seasalt.webp',      bg: '#3F5F70' },
    { id: 'matcha-white',      name: 'Matcha White',      desc: 'Matcha dough, white chocolate',     img: 'img/matcha-white.webp',      bg: '#8DB45E' },
    { id: 'choco-duo',         name: 'Choco Duo',         desc: 'Milk & white chocolate',            img: 'img/choco-duo.webp',         bg: '#C9845A' },
    { id: 'tiramisu',          name: 'Tiramisu',          desc: 'Butter dough, coffee dusting',      img: 'img/tiramisu.webp',          bg: '#9C7556' },
    { id: 'dark-choc-chips',   name: 'Dark Choco Chips',  desc: 'Dark dough, chocolate buttons',     img: 'img/dark-choc-chips.webp',   bg: '#4A2E25' },
    { id: 'matcha-strawberry', name: 'Matcha Strawberry', desc: 'Matcha dough, strawberry pieces',   img: 'img/matcha-strawberry.webp', bg: '#E07F78' },
    { id: 'smores',            name: "Choco S'mores",     desc: 'Toasted marshmallow',               img: 'img/smores.webp',            bg: '#D58A45' },
    { id: 'matcha-smores',     name: "Matcha S'mores",    desc: 'Matcha dough, toasted marshmallow', img: 'img/matcha-smores.webp',     bg: '#6E9A45' }
  ],

  STATUSES: ['Baru', 'Disahkan', 'Dibakar', 'Siap', 'Selesai', 'Dikemaskini', 'Dibatalkan']
};

// Open any page with ?demo=1 to try the app with sample data. Nothing is sent to the real Google Sheet.
if (/[?&]demo=1(&|$)/.test(location.search)) { window.SC_CONFIG.SCRIPT_URL = ''; window.SC_CONFIG.DEMO_RUN = true; }

// Products are managed by HQ (admin → Produk). The last list the server sent is cached on this device and
// applied here, before any page builds its forms, so new / renamed / archived products show up everywhere.
(function (C) {
  C.FLAVOURS_SEED = C.FLAVOURS.map((f) => Object.assign({}, f));
  C.PRODUCTS_KEY = C.DEMO_RUN || !C.SCRIPT_URL ? 'sc-demo-products' : 'sc-products';
  C.NO_IMG = 'img/logo-ngap-mark.webp';
  C.mergeProducts = (list) => {
    const seed = Object.fromEntries(C.FLAVOURS_SEED.map((f) => [f.id, f]));
    return list.map((p) => { const b = seed[p.id] || {};
      return { id: p.id, name: p.name || b.name || p.id, desc: p.desc || b.desc || '', img: p.img || b.img || C.NO_IMG, bg: p.bg || b.bg || '#C9845A', active: p.active !== false }; });
  };
  let cached = null; try { cached = JSON.parse(localStorage.getItem(C.PRODUCTS_KEY) || 'null'); } catch (e) {}
  if (Array.isArray(cached) && cached.length && cached.every((p) => p && p.id)) C.FLAVOURS.splice(0, C.FLAVOURS.length, ...C.mergeProducts(cached));
  else C.FLAVOURS.forEach((f) => { f.active = true; });
})(window.SC_CONFIG);
