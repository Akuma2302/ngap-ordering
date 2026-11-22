# Dokumentasi — ngap soft cookies ordering

## Seni bina

```
 Telefon salesperson / agent / admin
        │  (HTML + JS, dihoskan di Netlify — frontend/)
        ▼
 Google Apps Script web app  ──►  Google Sheet "Ngap Ordering"
 (backend/, satu URL /exec)        (database/ — satu tab = satu jadual)
```

- Semua permintaan ialah `POST` JSON ke URL `/exec` dengan medan `action` (lihat `backend/src/routes/main.gs`).
- Tiada server lain dan tiada kos hosting selain Netlify (percuma) dan Google (percuma).

## Peranan

| Peranan | Halaman | Log masuk | Boleh |
|---|---|---|---|
| Admin / director | `/admin` | Kata laluan admin | Semua order, status, PDF kilang, harga HQ, invois & bayaran, salesperson, laporan, pengumuman, log |
| Salesperson | `/sales` | Kod (`salesAkmal`) + PIN | Order stok dari HQ, rekod jualan, daftar agent, agih stok, terima bayaran agent, lihat hutang HQ |
| Agent | `/agent` | Kod agent (`agentAli`) | Sahkan stok diterima, rekod jualan ikut pelanggan, lihat hutang kepada salesperson |

## Aliran stok & wang

```
HQ ──order (invois HQ)──► Salesperson ──agihan (harga SP)──► Agent ──jualan──► Pelanggan
HQ ◄──── BayaranHQ ────── Salesperson ◄───── Bayaran ────────  Agent
```

- Invois HQ = biji × harga HQ, dikunci bila order dibuat.
- Agihan diambil daripada order salesperson yang paling lama dahulu (FIFO) dan dikira sebagai jualan salesperson.
- Status order: **Baru → Disahkan → Dibakar → Siap → Selesai** (atau Dikemaskini / Dibatalkan).

## Struktur kod

| Folder | Isi |
|---|---|
| `frontend/public/` | Halaman (`admin.html`, `sales.html`, `agent.html`), gambar, ikon, manifest PWA |
| `frontend/src/` | JS & CSS dikongsi: `config.js` (URL + perisa), `api.js` (klien API + mod demo), `txsales.js` (jualan ikut pelanggan), CSS |
| `frontend/scripts/` | `build.js` (hasilkan `dist/`), `serve.js` (server ujian tempatan) |
| `backend/src/routes/` | `doPost` → peta tindakan |
| `backend/src/middleware/` | Pengesahan admin, sesi & PIN salesperson, kunci tulis |
| `backend/src/models/` | Akses tab Sheet (orders, salesperson, network, invoices, settings, log) |
| `backend/src/controllers/` | Logik setiap tindakan (orders, salesperson, network, agent, admin, settings, announcements) |
| `database/` | Skema, sejarah migrasi, data asal |

## Pembangunan tempatan

```
cd frontend
cp .env.example .env        # isi SCRIPT_URL (pilihan; jika kosong guna nilai dalam src/config.js)
npm run dev                 # build + http://localhost:8001
```
Buka `http://localhost:8001/sales?demo=1` untuk cuba tanpa menyentuh data sebenar.

Backend:
```
cd backend
npm install
npm run login               # sekali sahaja
npm run redeploy            # push + kemas kini deployment (URL /exec kekal)
```

## Keselamatan
- Tukar `ADMIN_PASSWORD` di Apps Script → Project Settings → Script properties.
- PIN salesperson disimpan sebagai hash; 5 kali salah = dikunci 15 minit. Admin boleh reset PIN.
- Kod agent boleh dinyahaktif oleh salesperson; kod salesperson oleh admin.

Panduan hosting: [NETLIFY.md](NETLIFY.md).
