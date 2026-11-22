// Shared help sheets: "Pasang app di skrin utama" and "Cara guna" (per role).
(function () {
  let deferred = null;   // Android/Chrome install prompt, captured when the browser offers it
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua), isAndroid = /Android/i.test(ua);
  const installed = () => window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

  const GUIDES = {
    sales: [
      ['Order stok dari HQ', 'Tab <b>Stok</b> → <b>+ Order stok baru</b>. Pilih perisa, tarikh ambil/hantar, kemudian <b>Semak &amp; hantar</b>. Order boleh diedit atau dibatalkan selagi HQ belum mula bake.'],
      ['Daftar agent', 'Tab <b>Agent</b> → <b>+ Daftar agent baru</b>. Sistem beri kod (cth. <b>agentAli</b>). Tekan <b>Hantar kod (WhatsApp)</b> supaya agent boleh log masuk.'],
      ['Agih stok ke agent', 'Buka agent → <b>+ Agih stok</b>. Pilih kuantiti dan harga seunit untuk agent. Stok diambil daripada order paling lama dahulu.'],
      ['Rekod jualan sendiri', 'Buka order → <b>Jualan ikut pelanggan</b> → <b>+ Jualan baru</b>. Isi nama pelanggan, perisa, bilangan dan harga. Tekan <b>Resit</b> untuk hantar resit WhatsApp.'],
      ['Bayaran', 'Rekod bayaran agent di halaman agent. Hutang kepada HQ dan status setiap invois (Lunas / Separa / Belum bayar) ada di <b>Profil → Invois &amp; bayaran HQ</b>.'],
      ['Permintaan ke HQ', 'Order dah dibakar tapi perlu dibatalkan, atau perlu diskaun invois? <b>Profil → Permintaan ke HQ</b>. HQ akan lulus atau tolak.'],
      ['Untung', 'Tekan kad untung di <b>Utama</b> atau <b>Profil → Laporan &amp; sasaran</b>. Set harga kos/jual di <b>Harga saya</b> supaya untung dikira tepat.']
    ],
    agent: [
      ['Terima stok', 'Bila salesperson agih stok, notis keluar di <b>Utama</b>. Tekan dan <b>Sahkan stok diterima</b>.'],
      ['Rekod jualan', 'Tab <b>Stok</b> → buka stok → <b>+ Jualan baru (pelanggan)</b>. Isi nama, perisa, bilangan dan harga jual. Tekan <b>Resit</b> untuk WhatsApp pelanggan.'],
      ['Minta stok', 'Tab <b>Stok</b> → <b>Minta stok dari salesperson</b>. Permintaan dihantar melalui WhatsApp.'],
      ['Hutang', 'Kad <b>Perlu bayar kepada salesperson</b> di Utama dan Profil. Bayaran direkod oleh salesperson.'],
      ['Pelanggan', 'Tab <b>Pelanggan</b>: tapis ikut tarikh, hari dan perisa. Buka pelanggan untuk sejarah pembelian dan mesej pantas.']
    ],
    admin: [
      ['Order baru', 'Tab <b>Order</b>: tukar status Baru → Disahkan → Dibakar → Siap → Selesai. Order yang dah Dibakar dikunci untuk salesperson.'],
      ['PDF kilang', '<b>Order → Pilih order untuk PDF</b> → tanda order → <b>PDF kilang</b>. Selepas itu boleh tanda semua sebagai Dibakar.'],
      ['Kalendar', 'Ringkasan: berapa biji perlu dibake setiap hari berbanding kapasiti. Tekan hari untuk lihat order.'],
      ['Kewangan', 'Tab <b>Sales</b>: invois, bayaran dan baki setiap salesperson. Tab <b>Laporan</b>: revenue, untung HQ, sell-through dan amaran stok lama.'],
      ['Produk &amp; stok', '<b>Lagi → Produk</b>: tambah / arkib produk dan set resipi. <b>Bahan mentah</b>: stok dikira dari lejar; bila order ditanda Dibakar, bahan ditolak ikut resipi. <b>Pembekal &amp; belian</b>: belian masuk ke stok.'],
      ['Kewangan', '<b>Perbelanjaan HQ</b> direkod di Lagi. Tab <b>Laporan</b> tunjuk P&amp;L bulanan (revenue − kos bahan − perbelanjaan) dan status bayaran setiap invois (FIFO).'],
      ['Kelulusan &amp; sasaran', 'Salesperson hantar permintaan (batal order dikunci, diskaun invois). Lulus / tolak di <b>Lagi → Kelulusan</b>. Set <b>Sasaran bulanan</b> biji setiap salesperson.'],
      ['Tetapan &amp; keselamatan', '<b>Lagi</b>: harga, kapasiti, perisa habis, telefon HQ, salesperson, pengumuman. <b>Keselamatan</b>: tukar kata laluan admin dan muat turun backup.']
    ]
  };

  window.SC_HELP = {
    installSheet(openModal, toast, appName) {
      if (installed()) return toast('App ini sudah dipasang di skrin utama.');
      const steps = isIOS
        ? '<ol class="hp-steps"><li>Buka link ini dalam <b>Safari</b>.</li><li>Tekan butang <b>Share</b> (kotak dengan anak panah ke atas).</li><li>Pilih <b>Add to Home Screen</b> / <b>Tambah ke Skrin Utama</b>.</li><li>Tekan <b>Add</b>.</li></ol>'
        : '<ol class="hp-steps"><li>Buka link ini dalam <b>Chrome</b>.</li><li>Tekan menu <b>⋮</b> di penjuru atas.</li><li>Pilih <b>Install app</b> atau <b>Add to Home screen</b>.</li><li>Tekan <b>Install</b>.</li></ol>';
      openModal(`<span class="kicker">Pasang app</span><h2>${appName} di skrin utama</h2>
        <p class="muted" style="margin:4px 0 10px">Lepas dipasang, app dibuka penuh skrin seperti app biasa, tanpa perlu cari link.</p>
        ${deferred ? '<button class="btn btn-p btn-block" type="button" id="hp-install">Pasang sekarang</button><p class="muted" style="margin:12px 0 4px;font-size:12px">Atau secara manual:</p>' : ''}
        ${steps}
        <div class="acts one" style="margin-top:12px"><button class="btn btn-o" type="button" data-close>Tutup</button></div>`);
      const b = document.getElementById('hp-install');
      if (b) b.onclick = async () => { deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; if (r && r.outcome === 'accepted') toast('App dipasang.'); const c = document.querySelector('[data-close],[data-gclose]'); if (c) c.click(); };
    },
    guideSheet(openModal, role) {
      const g = GUIDES[role] || [];
      openModal(`<span class="kicker">Cara guna</span><h2>Panduan ringkas</h2>
        <div class="hp-guide">${g.map(([t, d], i) => `<div class="hp-g"><span class="hp-n">${i + 1}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}</div>
        <p class="muted" style="font-size:12px;margin:10px 0 0">Tip: tambah <b>?demo=1</b> pada link untuk cuba tanpa menyentuh data sebenar.</p>
        <div class="acts one" style="margin-top:12px"><button class="btn btn-o" type="button" data-close>Tutup</button></div>`);
    },
    isAndroid, isIOS
  };
})();
