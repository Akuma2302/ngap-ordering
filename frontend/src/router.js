// Clean URLs for each tab: /sales/stok, /sales/order/SC-0001, /admin/laporan, /agent/stok/DS-0001 ...
// The page decides what a path means; this only reads/writes the URL and reports Back/Forward.
(function () {
  window.SC_ROUTER = function (base, onRoute) {
    const clean = () => location.pathname.replace(/\/+$/, '');
    const parse = () => {
      const p = clean();
      if (p !== base && !p.startsWith(base + '/')) return [];
      return p.slice(base.length).split('/').filter(Boolean).map(decodeURIComponent);
    };
    let silent = false, first = true;
    window.addEventListener('popstate', () => { silent = true; try { onRoute(parse()); } finally { silent = false; } });
    return {
      parts: parse,
      // replace=true for the first sync after load, so Back leaves the app instead of looping
      set(parts, replace) {
        if (silent) return;
        const target = base + (parts.length ? '/' + parts.map(encodeURIComponent).join('/') : '');
        if (target !== clean()) history[replace || first ? 'replaceState' : 'pushState'](null, '', target + location.search + location.hash);
        first = false;
      }
    };
  };
})();
