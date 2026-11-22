-- ngap soft cookies — database schema
--
-- The database is the Google Sheet "Ngap Ordering". Each table below is one tab.
-- The backend (backend/src/models/*.gs) creates every tab automatically with these headers
-- the first time it is used, so this file is documentation and a reference for reports.
-- Every cell is stored as plain text so phone numbers keep their leading 0 and dates stay yyyy-mm-dd.

-- Orders placed by salespersons to HQ (tab "Orders")
CREATE TABLE Orders (
  "Kod Order"      TEXT PRIMARY KEY,      -- SC-0001, SC-0002 ... (counter LAST_ORDER_NO)
  "Status"         TEXT NOT NULL,         -- Baru | Disahkan | Dibakar | Siap | Selesai | Dikemaskini | Dibatalkan
  "Dicipta"        TEXT NOT NULL,         -- yyyy-MM-dd HH:mm (Asia/Kuala_Lumpur)
  "Dikemaskini"    TEXT NOT NULL,
  "Nama Agent"     TEXT NOT NULL,         -- salesperson name (column name kept from v1)
  "Telefon"        TEXT NOT NULL,         -- salesperson phone, links to Salesperson.Telefon
  "Kaedah"         TEXT NOT NULL,         -- Ambil | Hantar
  "Tarikh"         TEXT NOT NULL,         -- pickup / delivery date yyyy-mm-dd
  "Masa"           TEXT,
  "Alamat"         TEXT,
  "Nota"           TEXT,
  "Jumlah"         INTEGER NOT NULL,      -- total pieces
  -- one INTEGER column per flavour, in this order (see backend/src/config.gs FLAVOURS):
  "Chocolate Chip" INTEGER, "Chochocunk" INTEGER, "Seasalt" INTEGER, "Dark Seasalt" INTEGER,
  "Matcha White" INTEGER, "Choco Duo" INTEGER, "Tiramisu" INTEGER, "Dark Choco Chips" INTEGER,
  "Matcha Strawberry" INTEGER, "Choco S'mores" INTEGER, "Matcha S'mores" INTEGER
);

-- Salesperson accounts (tab "Salesperson")
CREATE TABLE Salesperson (
  "Kod"            TEXT PRIMARY KEY,      -- salesAkmal (case-insensitive login code)
  "Nama"           TEXT NOT NULL,
  "Telefon"        TEXT,                  -- set by the salesperson on first login
  "Status"         TEXT NOT NULL,         -- Aktif | Tidak aktif
  "Dicipta"        TEXT,
  "Terakhir Aktif" TEXT,
  "PIN"            TEXT,                  -- SHA-256 hash of "code:pin", never the PIN itself
  "Token"          TEXT                   -- current session token (cleared on PIN reset / deactivate)
);

-- HQ invoice per order, with the HQ price locked when the order was made (tab "Invois")
CREATE TABLE Invois (
  "Kod Order"      TEXT PRIMARY KEY REFERENCES Orders("Kod Order"),
  "Telefon"        TEXT NOT NULL,
  "Tarikh"         TEXT,
  "Status"         TEXT,
  "Jumlah Biji"    INTEGER,
  "Jumlah (RM)"    NUMERIC,               -- 0 when the order is cancelled
  "Dikemaskini"    TEXT,
  "Data"           JSON                   -- { prices: { flavourId: RM }, missing: bool }
);

-- Payments from a salesperson to HQ (tab "BayaranHQ")
CREATE TABLE BayaranHQ (
  "ID"             TEXT PRIMARY KEY,      -- HP-0001 (counter LAST_HQPAY_NO)
  "Telefon"        TEXT NOT NULL,         -- salesperson phone
  "Tarikh"         TEXT NOT NULL,
  "Jumlah (RM)"    NUMERIC NOT NULL,
  "Nota"           TEXT,
  "Dicipta"        TEXT
);

-- Salesperson's own sales record for each of their orders (tab "Jualan")
CREATE TABLE Jualan (
  "Kod Order"      TEXT PRIMARY KEY REFERENCES Orders("Kod Order"),
  "Telefon"        TEXT NOT NULL,
  "Dikemaskini"    TEXT,
  "Data"           JSON                   -- { items: { flavourId: { cost, lines: [{qty, price, cust, cphone, tx}] } }, extras: [{name, amount}], updatedAt }
);

-- Device data synced per person: default prices, monthly target (tab "AgentData")
CREATE TABLE AgentData (
  "Telefon"        TEXT PRIMARY KEY,      -- salesperson phone, or agent code (agentAli)
  "Dikemaskini"    TEXT,
  "Data"           JSON                   -- { prices, target, updatedAt }
);

-- Agents registered by a salesperson (tab "Agents")
CREATE TABLE Agents (
  "Kod Agent"      TEXT PRIMARY KEY,      -- agentAli, agentSitiAminah, agentAli2 ...
  "Salesperson"    TEXT NOT NULL,         -- salesperson phone
  "Nama"           TEXT NOT NULL,
  "Telefon"        TEXT,
  "Status"         TEXT NOT NULL,         -- Aktif | Tidak aktif
  "Dicipta"        TEXT,
  "Nota"           TEXT
);

-- Stock a salesperson gives to an agent (tab "Agihan")
CREATE TABLE Agihan (
  "Kod Agihan"     TEXT PRIMARY KEY,      -- DS-0001 (counter LAST_DIST_NO)
  "Salesperson"    TEXT NOT NULL,
  "Kod Agent"      TEXT NOT NULL REFERENCES Agents("Kod Agent"),
  "Tarikh"         TEXT NOT NULL,
  "Status"         TEXT NOT NULL,         -- Dihantar | Diterima
  "Dicipta"        TEXT,
  "Dikemaskini"    TEXT,
  "Nota"           TEXT,
  "Jumlah Biji"    INTEGER,
  "Nilai (RM)"     NUMERIC,               -- what the agent owes the salesperson
  "Data"           JSON                   -- { items: { flavourId: {qty, price} }, alloc: { orderCode: { flavourId: qty } } }
);

-- Payments from an agent to their salesperson (tab "Bayaran")
CREATE TABLE Bayaran (
  "ID"             TEXT PRIMARY KEY,      -- PY-0001 (counter LAST_PAY_NO)
  "Salesperson"    TEXT NOT NULL,
  "Kod Agent"      TEXT NOT NULL REFERENCES Agents("Kod Agent"),
  "Tarikh"         TEXT NOT NULL,
  "Jumlah (RM)"    NUMERIC NOT NULL,
  "Nota"           TEXT,
  "Dicipta"        TEXT
);

-- Agent's sales record for each Agihan (tab "JualanAgent")
CREATE TABLE JualanAgent (
  "Kod Agihan"     TEXT PRIMARY KEY REFERENCES Agihan("Kod Agihan"),
  "Kod Agent"      TEXT NOT NULL,
  "Dikemaskini"    TEXT,
  "Data"           JSON                   -- same shape as Jualan.Data (without cost; cost comes from Agihan)
);

-- Activity log (tab "Log")
CREATE TABLE Log (
  "Masa"           TEXT NOT NULL,
  "Pelaku"         TEXT,                  -- Admin | salesAkmal | agentAli
  "Tindakan"       TEXT NOT NULL,
  "Rujukan"        TEXT,
  "Butiran"        TEXT
);

-- Script Properties (key/value, not a tab):
--   ADMIN_PASSWORD, SETTINGS (JSON), ANNOUNCEMENTS (JSON list),
--   LAST_ORDER_NO, LAST_DIST_NO, LAST_PAY_NO, LAST_HQPAY_NO
