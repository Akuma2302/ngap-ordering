// clasp 2.x writes .clasp.json inside rootDir; move it to the repo root where clasp looks for it.
const fs = require('fs');
if (fs.existsSync('apps-script/.clasp.json')) fs.renameSync('apps-script/.clasp.json', '.clasp.json');
