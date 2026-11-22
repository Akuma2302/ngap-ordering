// Small SVG chart kit for the admin app (no external library).
// Brand series colours validated for colour-blind separation: revenue #A33447 · cost #D99A5B · profit #3F8F5E.
// Every chart has a hover / tap tooltip; multi-series charts always carry a legend.
(function () {
  const C = { rev: '#A33447', cost: '#D99A5B', profit: '#3F8F5E', grid: '#EADFD2', axis: '#8A6B5E', wash: 0.12 };
  const SEQ = ['#F6E7E2', '#EBC2BB', '#D68F92', '#B5505F', '#7A1E2C'];   // one hue, light -> dark (heatmap)
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const live = new Map();                       // element -> redraw fn, for resize

  /* ---------- tooltip ---------- */
  let tip = null;
  function tipEl() { if (!tip) { tip = document.createElement('div'); tip.className = 'ch-tip hidden'; document.body.appendChild(tip); } return tip; }
  function showTip(html, x, y) {
    const t = tipEl(); t.innerHTML = html; t.classList.remove('hidden');
    const w = t.offsetWidth, h = t.offsetHeight, vw = innerWidth;
    t.style.left = Math.max(8, Math.min(vw - w - 8, x - w / 2)) + 'px';
    t.style.top = Math.max(8, y - h - 14) + 'px';
  }
  const hideTip = () => tip && tip.classList.add('hidden');
  document.addEventListener('scroll', hideTip, true);
  function bindTips(el, getHtml) {
    const on = (e) => { const t = e.target.closest('[data-tip]'); if (!t || !el.contains(t)) return hideTip();
      const r = t.getBoundingClientRect(); showTip(getHtml(t.dataset.tip), r.left + r.width / 2, r.top); };
    el.onpointermove = on; el.onpointerdown = on; el.onpointerleave = hideTip;
  }

  /* ---------- helpers ---------- */
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  const compact = (n) => { const a = Math.abs(n); return (n < 0 ? '-' : '') + (a >= 1e6 ? (a / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : a >= 1e4 ? Math.round(a / 1e3) + 'K' : a >= 1e3 ? (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : Math.round(a)); };
  const legend = (series) => series.length < 2 ? '' : `<div class="ch-lg">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
  const empty = (msg) => `<div class="ch-empty">${esc(msg || 'Tiada data untuk tempoh ini.')}</div>`;
  function mount(el, draw) { live.set(el, draw); draw(); }
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => live.forEach((fn, el) => { if (el.isConnected) fn(); else live.delete(el); }), 150); });

  // rounded data-end, square at the baseline
  function barPath(x, y0, w, y1) {
    const up = y1 < y0, h = Math.abs(y0 - y1), r = Math.min(4, w / 2, h);
    if (h < 0.5) return '';
    return up ? `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`
              : `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
  }
  // clean ticks: a "nice" step, 0 always on a gridline, negatives get whole steps below 0
  function yScale(vals, H, padT, padB) {
    const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals);
    let step = niceMax((hi - lo) / 4 || 1);
    let max = Math.ceil(hi / step) * step, min = lo < 0 ? -Math.ceil(-lo / step) * step : 0;
    if ((max - min) / step > 6) { step = niceMax((max - min) / 4); max = Math.ceil(hi / step) * step; min = lo < 0 ? -Math.ceil(-lo / step) * step : 0; }
    if (max === min) max = min + step;
    const y = (v) => padT + (max - v) / (max - min) * (H - padT - padB);
    const ticks = []; for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 100) / 100);
    return { y, ticks, max, min };
  }
  function grid(sc, W, padL, padR, fmtAxis) {
    return sc.ticks.map((t) => `<line x1="${padL}" x2="${W - padR}" y1="${sc.y(t)}" y2="${sc.y(t)}" stroke="${t === 0 ? '#CDBBAA' : C.grid}" stroke-width="1"/>` +
      `<text x="${padL - 8}" y="${sc.y(t) + 4}" text-anchor="end" class="ch-ax">${esc(fmtAxis(t))}</text>`).join('');
  }

  /* ---------- grouped columns ---------- */
  function columns(el, o) {
    mount(el, () => {
      const W = Math.max(260, el.clientWidth), H = o.height || 220, padL = 44, padR = 8, padT = 12, padB = 28;
      const all = o.series.flatMap((s) => s.values);
      if (!all.some((v) => v)) { el.innerHTML = empty(o.empty); return; }
      const sc = yScale(all, H, padT, padB), n = o.labels.length, band = (W - padL - padR) / n, k = o.series.length;
      const bw = Math.min(24, (band * 0.7 - (k - 1) * 2) / k), gw = k * bw + (k - 1) * 2;
      let marks = '';
      o.labels.forEach((lb, i) => {
        const x0 = padL + band * i + (band - gw) / 2;
        o.series.forEach((s, j) => { const v = s.values[i] || 0, x = x0 + j * (bw + 2);
          marks += `<path d="${barPath(x, sc.y(0), bw, sc.y(v))}" fill="${s.color}"/>`; });
        marks += `<rect x="${padL + band * i}" y="${padT}" width="${band}" height="${H - padT - padB}" fill="transparent" data-tip="${i}"/>`;
        marks += `<text x="${padL + band * (i + 0.5)}" y="${H - 8}" text-anchor="middle" class="ch-ax">${esc(lb)}</text>`;
      });
      el.innerHTML = `${legend(o.series)}<svg class="ch" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.title || '')}">${grid(sc, W, padL, padR, o.axis || compact)}${marks}</svg>`;
      bindTips(el, (i) => `<b>${esc(o.tipTitle ? o.tipTitle(+i) : o.labels[i])}</b>` + o.series.map((s) => `<div><i style="background:${s.color}"></i>${esc(s.name)}<span>${esc((o.fmt || compact)(s.values[i] || 0))}</span></div>`).join('') + (o.tipExtra ? o.tipExtra(+i) : ''));
    });
  }

  /* ---------- lines (optional area wash) ---------- */
  function lines(el, o) {
    mount(el, () => {
      const W = Math.max(260, el.clientWidth), H = o.height || 220, padL = 44, padR = 14, padT = 14, padB = 28;
      const all = o.series.flatMap((s) => s.values);
      if (!all.some((v) => v)) { el.innerHTML = empty(o.empty); return; }
      const sc = yScale(all, H, padT, padB), n = o.labels.length, step = n > 1 ? (W - padL - padR) / (n - 1) : 0, x = (i) => padL + step * i;
      const every = Math.ceil(n / Math.max(2, Math.floor((W - padL) / 46)));
      let g = '';
      o.series.forEach((s) => {
        const pts = s.values.map((v, i) => `${x(i)},${sc.y(v || 0)}`).join(' ');
        if (o.area) g += `<polygon points="${x(0)},${sc.y(0)} ${pts} ${x(n - 1)},${sc.y(0)}" fill="${s.color}" opacity="${C.wash}"/>`;
        g += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
        const li = n - 1; g += `<circle cx="${x(li)}" cy="${sc.y(s.values[li] || 0)}" r="4.5" fill="${s.color}" stroke="#fff" stroke-width="2"/>`;
      });
      const labels = o.labels.map((lb, i) => (i % every === 0 || i === n - 1) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="ch-ax">${esc(lb)}</text>` : '').join('');
      const hits = o.labels.map((_, i) => `<rect x="${x(i) - Math.max(step, 20) / 2}" y="${padT}" width="${Math.max(step, 20)}" height="${H - padT - padB}" fill="transparent" data-tip="${i}"/>`).join('');
      el.innerHTML = `${legend(o.series)}<svg class="ch" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.title || '')}">${grid(sc, W, padL, padR, o.axis || compact)}${g}<line class="ch-x" x1="0" x2="0" y1="${padT}" y2="${H - padB}" stroke="#B9A595" stroke-width="1" visibility="hidden"/>${labels}${hits}</svg>`;
      const svg = el.querySelector('svg'), cross = svg.querySelector('.ch-x');
      bindTips(el, (i) => { cross.setAttribute('x1', x(+i)); cross.setAttribute('x2', x(+i)); cross.setAttribute('visibility', 'visible');
        return `<b>${esc(o.tipTitle ? o.tipTitle(+i) : o.labels[i])}</b>` + o.series.map((s) => `<div><i style="background:${s.color}"></i>${esc(s.name)}<span>${esc((o.fmt || compact)(s.values[i] || 0))}</span></div>`).join(''); });
      el.addEventListener('pointerleave', () => cross.setAttribute('visibility', 'hidden'));
    });
  }

  /* ---------- horizontal bars (ranking) ---------- */
  function hbars(el, o) {
    const rows = o.rows.filter((r) => r.value > 0);
    if (!rows.length) { el.innerHTML = empty(o.empty); return; }
    const max = Math.max(...rows.map((r) => r.value));
    el.innerHTML = `<div class="hb">${rows.map((r, i) => `<div class="hb-r" data-tip="${i}">
      <span class="hb-l">${r.img ? `<img src="${esc(r.img)}" alt="">` : `<b class="hb-n">${i + 1}</b>`}<span><b>${esc(r.label)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span></span>
      <span class="hb-t"><i style="width:${Math.max(2, r.value / max * 100)}%;background:${o.color || C.rev}"></i></span>
      <span class="hb-v">${esc((o.fmt || compact)(r.value))}</span></div>`).join('')}</div>`;
    bindTips(el, (i) => `<b>${esc(rows[i].label)}</b><div>${esc(o.name || 'Nilai')}<span>${esc((o.fmt || compact)(rows[i].value))}</span></div>${rows[i].tip ? `<div>${esc(rows[i].tip)}</div>` : ''}`);
  }

  /* ---------- ring gauge (a single percentage) ---------- */
  function ring(pct, label, sub, color) {
    const p = pct === null || isNaN(pct) ? null : Math.max(0, Math.min(100, pct)), R = 38, L = 2 * Math.PI * R;
    return `<div class="rg"><svg viewBox="0 0 96 96" role="img" aria-label="${esc(label)} ${p === null ? 'tiada data' : Math.round(pct) + '%'}"><circle cx="48" cy="48" r="${R}" fill="none" stroke="#F1E4D7" stroke-width="10"/>
      ${p === null ? '' : `<circle cx="48" cy="48" r="${R}" fill="none" stroke="${color || C.rev}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${L * p / 100} ${L}" transform="rotate(-90 48 48)"/>`}
      <text x="48" y="54" text-anchor="middle" class="rg-v">${p === null ? '–' : Math.round(p) + '%'}</text></svg><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  }

  /* ---------- sparkline for stat tiles (de-emphasised history, accent on the current point) ---------- */
  function spark(values, color) {
    if (!values || values.filter((v) => v).length < 2) return '';
    const W = 96, H = 28, max = Math.max(...values), min = Math.min(0, ...values), n = values.length;
    const x = (i) => 2 + i * (W - 6) / (n - 1), y = (v) => H - 3 - (v - min) / ((max - min) || 1) * (H - 6);
    const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    return `<svg class="spk" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#CDB8AA" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(n - 1)}" cy="${y(values[n - 1])}" r="3.5" fill="${color || C.rev}" stroke="#fff" stroke-width="1.5"/></svg>`;
  }

  /* ---------- heatmap: rows × columns, one sequential hue ---------- */
  function heat(el, o) {
    const max = Math.max(0, ...o.cells.flat());
    if (!max) { el.innerHTML = empty(o.empty); return; }
    const lvl = (v) => (v <= 0 ? -1 : Math.min(4, Math.floor(v / max * 4.999)));
    el.innerHTML = `<div class="hm" style="grid-template-columns:auto repeat(${o.cols.length},minmax(0,1fr))"><span></span>${o.cols.map((c) => `<small class="hm-c">${esc(c)}</small>`).join('')}
      ${o.rows.map((r, i) => `<small class="hm-r">${esc(r)}</small>${o.cells[i].map((v, j) => `<span class="hm-x" data-tip="${i}-${j}" style="background:${lvl(v) < 0 ? '#F5EEE6' : SEQ[lvl(v)]}"></span>`).join('')}`).join('')}</div>
      <div class="hm-lg"><small>Kurang</small>${SEQ.map((c) => `<i style="background:${c}"></i>`).join('')}<small>Lebih</small></div>`;
    bindTips(el, (k) => { const [i, j] = k.split('-').map(Number); return `<b>${esc(o.rows[i])} · ${esc(o.cols[j])}</b><div>${esc(o.name || 'Nilai')}<span>${esc((o.fmt || compact)(o.cells[i][j]))}</span></div>`; });
  }


  /* ---------- donut (few categories only; "Lain-lain" folds the rest) ---------- */
  const CAT = ['#A33447', '#D99A5B', '#4F6DB8', '#3F8F5E'], OTHER = '#BFB3AA';
  function donut(el, o) {
    let rows = o.rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
    if (!rows.length) { el.innerHTML = empty(o.empty); return; }
    if (rows.length > 5) { const rest = rows.slice(4); rows = rows.slice(0, 4).concat([{ label: 'Lain-lain', value: rest.reduce((a, r) => a + r.value, 0), other: rest.map((r) => r.label).join(', ') }]); }
    rows.forEach((r, i) => { r.color = r.label === 'Lain-lain' ? OTHER : CAT[i]; });
    const tot = rows.reduce((a, r) => a + r.value, 0), R = 42, L = 2 * Math.PI * R, gap = rows.length > 1 ? 1.2 : 0; let off = 0;
    const segs = rows.map((r, i) => { const len = Math.max(0, r.value / tot * L - gap), s2 = `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${r.color}" stroke-width="14" stroke-dasharray="${len} ${L - len}" stroke-dashoffset="${-off}" data-tip="${i}"/>`; off += r.value / tot * L; return s2; }).join('');
    el.innerHTML = `<div class="dn"><div class="dn-c"><svg viewBox="0 0 100 100" role="img" aria-label="${esc(o.title || '')}" style="transform:rotate(-90deg)"><circle cx="50" cy="50" r="${R}" fill="none" stroke="#F1E4D7" stroke-width="14"/>${segs}</svg>
      <span><b>${esc((o.fmt || compact)(tot))}</b><small>${esc(o.center || 'jumlah')}</small></span></div>
      <div class="dn-l">${rows.map((r, i) => `<div data-tip="${i}"><i style="background:${r.color}"></i><span>${esc(r.label)}</span><b>${esc((o.fmt || compact)(r.value))}</b><small>${Math.round(r.value / tot * 100)}%</small></div>`).join('')}</div></div>`;
    bindTips(el, (i) => `<b>${esc(rows[i].label)}</b><div>${esc(o.name || 'Nilai')}<span>${esc((o.fmt || compact)(rows[i].value))}</span></div><div>Bahagian<span>${Math.round(rows[i].value / tot * 100)}%</span></div>${rows[i].other ? `<div style="display:block;max-width:220px;font-size:11.5px;color:var(--muted)">${esc(rows[i].other)}</div>` : ''}`);
  }

  /* ---------- segmented bar: one whole split into ordered parts (e.g. receivables ageing) ---------- */
  function segbar(el, o) {
    const rows = o.rows, tot = rows.reduce((a, r) => a + r.value, 0);
    if (!tot) { el.innerHTML = empty(o.empty); return; }
    el.innerHTML = `<div class="sb">${rows.map((r, i) => r.value > 0 ? `<i style="flex:${r.value};background:${r.color}" data-tip="${i}"></i>` : '').join('')}</div>
      <div class="sb-l">${rows.map((r, i) => `<div data-tip="${i}"><i style="background:${r.color}"></i><span>${esc(r.label)}</span><b>${esc((o.fmt || compact)(r.value))}</b></div>`).join('')}</div>`;
    bindTips(el, (i) => `<b>${esc(rows[i].label)}</b><div>${esc(o.name || 'Nilai')}<span>${esc((o.fmt || compact)(rows[i].value))}</span></div><div>Bahagian<span>${Math.round(rows[i].value / tot * 100)}%</span></div>`);
  }

  /* ---------- "Jadual" toggle: an accessible table alternative for any chart panel ---------- */
  function tableToggle(panel, head, rows) {
    const h = panel.querySelector('.panel-h'); if (!h) return;
    let btn = h.querySelector('.ch-tbtn'); if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ch-tbtn'; btn.textContent = 'Jadual'; h.appendChild(btn); }
    let tb = panel.querySelector('.ch-table');
    if (!tb) { tb = document.createElement('div'); tb.className = 'ch-table hidden'; panel.appendChild(tb); }
    tb.innerHTML = `<table><thead><tr>${head.map((x, i) => `<th${i ? ' class="n"' : ''}>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}">Tiada data.</td></tr>`}</tbody></table>`;
    btn.onclick = () => { const on = tb.classList.toggle('hidden'); btn.textContent = on ? 'Jadual' : 'Carta'; panel.classList.toggle('show-table', !on); };
  }

  window.SC_CHART = { C, CAT, columns, lines, hbars, ring, spark, heat, donut, segbar, tableToggle, compact };
})();
