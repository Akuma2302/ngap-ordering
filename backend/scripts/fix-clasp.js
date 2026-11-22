// clasp 2.x writes .clasp.json inside rootDir; move it next to package.json (backend/) where clasp looks for it.
const fs = require('fs');
if (fs.existsSync('src/.clasp.json')) fs.renameSync('src/.clasp.json', '.clasp.json');
