# Setup Netlify

Frontend ialah laman statik (HTML + JS + CSS). Netlify bina daripada folder `frontend/` dan terbitkan `frontend/dist`.
Semua tetapan ini sudah ada dalam `netlify.toml` di root repo, jadi Netlify akan membacanya secara automatik.

## 1. Sambung repo (kali pertama)
1. Log masuk https://app.netlify.com → **Add new site → Import an existing project**.
2. Pilih **GitHub** → repo **Akuma2302/ngap-ordering** → branch `main`.
3. Di skrin **Build settings**, isi (atau biarkan, kerana `netlify.toml` akan mengatasi):

   | Medan | Nilai |
   |---|---|
   | Base directory | `frontend` |
   | Build command | `npm run build` |
   | Publish directory | `frontend/dist` |
   | Functions directory | *(kosongkan)* |

4. **Environment variables → Add variable**
   - Key: `SCRIPT_URL`
   - Value: URL web app Apps Script (berakhir dengan `/exec`). Rujuk `frontend/.env.example`.
5. Tekan **Deploy**.

## 2. Sudah ada site Netlify dari versi lama?
Struktur repo telah berubah (fail tidak lagi di root). Kemas kini tetapan:
1. **Site configuration → Build & deploy → Build settings → Edit settings**
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
2. **Site configuration → Environment variables** → tambah `SCRIPT_URL`.
3. **Deploys → Trigger deploy → Clear cache and deploy site**.

## 3. Link yang perlu dikongsi
| Untuk | Link |
|---|---|
| Salesperson | `https://<nama-site>.netlify.app/sales` (juga `/`) |
| Agent | `https://<nama-site>.netlify.app/agent` |
| Admin / director | `https://<nama-site>.netlify.app/admin` |
| Cuba tanpa data sebenar | tambah `?demo=1` pada mana-mana link |

Link lama (`order.html`, `sales.html`, `agent.html`, `admin.html`) akan terus ke link baru tanpa `.html`.

## 4. Selepas setiap perubahan
- **Frontend** (`frontend/`): `git push` ke `main` → Netlify build & terbit sendiri (±30 saat).
- **Backend** (`backend/`): Netlify tidak terlibat. Jalankan `cd backend && npm run redeploy`. URL `/exec` kekal sama, jadi `SCRIPT_URL` tidak perlu ditukar.

## 5. Domain sendiri (pilihan)
**Domain management → Add a domain** → ikut arahan DNS. HTTPS diberi automatik.

## Semak jika ada masalah
- Build gagal "SCRIPT_URL does not look like…" → nilai `SCRIPT_URL` salah; mesti `https://script.google.com/macros/s/.../exec`.
- Halaman kosong / 404 → semak Publish directory = `frontend/dist` (atau `dist` jika Base directory = `frontend`).
- Data tak keluar → buka link dengan `?demo=1`; jika demo berfungsi, masalah pada `SCRIPT_URL` atau deployment Apps Script.

## Peta link (tanpa .html)

| App | Tab | Link |
|---|---|---|
| Salesperson | Utama | `/sales` |
| | Stok & order | `/sales/stok` |
| | Order baru | `/sales/order-baru` |
| | Butiran order | `/sales/order/SC-0001` |
| | Edit order | `/sales/order/SC-0001/edit` |
| | Agent saya | `/sales/agent` |
| | Satu agent | `/sales/agent/agentAli` |
| | Untung | `/sales/untung` |
| | Pelanggan | `/sales/pelanggan` |
| | Satu pelanggan | `/sales/pelanggan/0123456789` |
| | Profil | `/sales/profil` |
| | Harga · Invois HQ · Permintaan · Cara guna | `/sales/harga` · `/sales/invois` · `/sales/permintaan` · `/sales/panduan` |
| Agent | Utama | `/agent` |
| | Stok | `/agent/stok` |
| | Butiran stok | `/agent/stok/DS-0001` |
| | Pelanggan | `/agent/pelanggan` |
| | Satu pelanggan | `/agent/pelanggan/0123456789` |
| | Untung | `/agent/untung` |
| | Profil | `/agent/profil` |
| | Harga jual · Cara guna | `/agent/harga` · `/agent/panduan` |
| | Log masuk terus | `/agent?code=agentAli` |
| Admin | Ringkasan | `/admin` |
| | Order | `/admin/order` |
| | Salesperson & agent | `/admin/sales` |
| | Laporan director | `/admin/laporan` |
| | Lagi (tetapan) | `/admin/lagi` |
| | Papan order (kanban) | `/admin/papan` |
| | Produk · Bahan & stok · Pembekal & belian | `/admin/produk` · `/admin/bahan` · `/admin/belian` |
| | Perbelanjaan · Kelulusan · Sasaran | `/admin/perbelanjaan` · `/admin/kelulusan` · `/admin/sasaran` |
| | Pelanggan · Akaun salesperson · Keselamatan | `/admin/pelanggan` · `/admin/salesperson` · `/admin/keselamatan` |
| | Harga HQ · Kapasiti · Perisa · Maklumat HQ | `/admin/harga` · `/admin/kapasiti` · `/admin/perisa` · `/admin/maklumat-hq` |
| | Pengumuman · Log aktiviti · Notifikasi | `/admin/pengumuman` · `/admin/log` · `/admin/notifikasi` |
| | Invois & bayaran · Jadual pengeluaran | `/admin/invois` · `/admin/jadual` |

Tambah `?demo=1` pada mana-mana link untuk mod demo. Peraturan ini ada dalam `netlify.toml` (rewrite `/sales/*` → `/sales/index.html`).
