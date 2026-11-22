# database/

Pangkalan data sistem ini ialah **Google Sheet "Ngap Ordering"**. Setiap jadual = satu tab.

| Fail | Isi |
|---|---|
| `schema.sql` | Struktur setiap tab (lajur, jenis, hubungan) dalam bentuk SQL sebagai rujukan |
| `migrations/` | Sejarah perubahan struktur ikut versi |
| `seeds/salespersons.csv` | 8 kod salesperson asal (dicipta automatik kali pertama) |
| `seeds/flavours.csv` | Senarai perisa (mesti sama dengan `backend/src/config.gs` dan `frontend/src/config.js`) |

**Tiada langkah migrasi manual.** Backend mencipta tab dan header yang tiada secara automatik bila tab itu mula digunakan.

## Tambah perisa baru
1. Tambah di **hujung** `FLAVOURS` dalam `backend/src/config.gs` dan `frontend/src/config.js` (id sama).
2. Letak gambar di `frontend/public/img/<id>.webp`.
3. Di Apps Script editor, jalankan fungsi `setup` sekali (kemas kini header tab Orders).
4. `cd backend && npm run redeploy`, kemudian push frontend (Netlify build automatik).

## Backup
Google Sheets → **File → Make a copy** atau **File → Version history**.
