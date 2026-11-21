# ngap-ordering

Sistem order agent Soft Cookies.

| Fail | Fungsi |
|---|---|
| `order.html` | Halaman agent: tab **Order Baru** dan **Edit Order** (edit, tambah, batal guna kod order + telefon) |
| `admin.html` | Halaman team operation: jumlah perlu bake ikut perisa, order ikut order/agent, status, export CSV |
| `ordering/config.js` | `SCRIPT_URL` (URL Web App) dan senarai perisa |
| `ordering/api.js` | Client API. Bila `SCRIPT_URL` kosong, sistem jadi mod demo yang simpan data dalam localStorage |
| `apps-script/` | Backend Google Apps Script, di-push dengan [clasp](https://github.com/google/clasp) |

## Setup kali pertama

1. **Hidupkan Apps Script API**: buka https://script.google.com/home/usersettings dan tukar **Google Apps Script API** kepada **On**.
2. Pasang dependency dan log masuk Google (browser akan terbuka):
   ```
   npm install
   npm run login
   ```
3. Cipta Google Sheet berserta script yang terikat padanya (ini menghasilkan `.clasp.json`):
   ```
   npm run create
   ```
4. Push kod dan deploy Web App:
   ```
   npm run push
   npm run deploy
   ```
5. Buka URL `/exec` yang keluar sekali dalam browser dan **benarkan akses** (Authorize).
   Tab `Orders` akan dicipta secara automatik pada request pertama.
6. Masukkan URL `/exec` tu ke dalam `ordering/config.js` → `SCRIPT_URL`.
7. Tukar kata laluan admin: `npm run open`, pergi ke **Project Settings → Script properties**, dan ubah `ADMIN_PASSWORD` (nilai asal `tukar-saya`).

## Bila ubah `Code.gs`

```
npm run redeploy
```
Arahan ini push kod dan kemas kini deployment yang sama, jadi URL `/exec` tak berubah.

## Uji secara local

```
npm run serve
```
Lepas tu buka http://localhost:8000/order.html dan http://localhost:8000/admin.html.

## Tambah atau tukar perisa

Kemas kini `FLAVOURS` dalam **dua** fail, dengan id dan susunan yang sama:
- `ordering/config.js`
- `apps-script/Code.gs`

Perisa baru mesti ditambah **di hujung senarai**. Lepas tu jalankan fungsi `setup` sekali dari editor (untuk kemas kini header) dan `npm run redeploy`.

## Status order

**Baru**, **Dikemaskini** (agent ubah order), **Dibatalkan** (tidak dikira dalam bake), **Siap**, **Selesai** (dah diambil/dihantar).
