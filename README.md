# ngap-ordering

Sistem order & jualan **ngap soft cookies** untuk HQ, salesperson dan agent.

```
ngap-ordering/
├── frontend/            Laman web (Netlify)
│   ├── public/          admin.html, sales.html, agent.html, img/, manifest
│   ├── src/             config.js, api.js, txsales.js, CSS
│   ├── scripts/         build.js, serve.js
│   ├── package.json
│   └── .env.example     SCRIPT_URL
├── backend/             Google Apps Script (clasp)
│   ├── src/
│   │   ├── routes/      main.gs (doPost)
│   │   ├── controllers/ orders, salesperson, network, agent, admin, settings, announcements
│   │   ├── models/      sheets, orders, salesperson, network, invoices, settings, log
│   │   ├── middleware/  auth, lock
│   │   ├── config.gs
│   │   └── appsscript.json
│   ├── scripts/         redeploy.js, fix-clasp.js
│   ├── package.json
│   └── .env.example     (Script properties)
├── database/            schema.sql, migrations/, seeds/, README.md
├── docs/                README.md (seni bina), NETLIFY.md (hosting)
├── netlify.toml
├── .gitignore
└── README.md
```

## Mula cepat

| Tugas | Arahan |
|---|---|
| Cuba secara tempatan | `cd frontend && npm run dev` → http://localhost:8001/sales?demo=1 |
| Kemas kini backend | `cd backend && npm install && npm run redeploy` |
| Terbit frontend | `git push` (Netlify build automatik) — lihat [docs/NETLIFY.md](docs/NETLIFY.md) |

## Link

- Salesperson: `/sales` — log masuk `salesNama` + PIN (`salesAkmal`, `salesHarris`, `salesIzz`, `salesNajman`, `salesFaiz`, `salesNik`, `salesAdi`, `salesKhairul`, `salesUmar`)
- Agent: `/agent` — kod daripada salesperson (`agentNama`)
- Admin / director: `/admin`
- Demo tanpa data sebenar: tambah `?demo=1` (salesperson `salesDemo`, agent `agentAli`, admin `admin`)

Butiran lanjut: [docs/README.md](docs/README.md) · Pangkalan data: [database/README.md](database/README.md)
