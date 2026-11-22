/**
 * @OnlyCurrentDoc
 * ngap soft cookies — ordering backend (Google Apps Script + Google Sheets).
 * Shared constants: flavour list, sheet layout, statuses, time zone.
 */

// Keep this list in sync with frontend/src/config.js (same ids, same order).
var FLAVOURS = [
  { id: 'chocolate-chip',    name: 'Chocolate Chip' },
  { id: 'chochocunk',        name: 'Chochocunk' },
  { id: 'seasalt',           name: 'Seasalt' },
  { id: 'dark-seasalt',      name: 'Dark Seasalt' },
  { id: 'matcha-white',      name: 'Matcha White' },
  { id: 'choco-duo',         name: 'Choco Duo' },
  { id: 'tiramisu',          name: 'Tiramisu' },
  { id: 'dark-choc-chips',   name: 'Dark Choco Chips' },
  { id: 'matcha-strawberry', name: 'Matcha Strawberry' },
  { id: 'smores',            name: "Choco S'mores" },
  { id: 'matcha-smores',     name: "Matcha S'mores" }
];

var SHEET_NAME = 'Orders';

var BASE_HEADERS = ['Kod Order', 'Status', 'Dicipta', 'Dikemaskini', 'Nama Agent', 'Telefon',
                    'Kaedah', 'Tarikh', 'Masa', 'Alamat', 'Nota', 'Jumlah'];

var STATUSES = ['Baru', 'Disahkan', 'Dibakar', 'Siap', 'Selesai', 'Dikemaskini', 'Dibatalkan'];

var TZ = 'Asia/Kuala_Lumpur';

var SP_SEED = ['Akmal', 'Harris', 'Izz', 'Najman', 'Faiz', 'Nik', 'Adi', 'Khairul'];
