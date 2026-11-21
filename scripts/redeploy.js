// Push the latest Code.gs and update the existing web-app deployment in place,
// so the /exec URL in ordering/config.js never changes.
const { execSync } = require('child_process');
const run = (c) => execSync(c, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
run('npx clasp push --force');
const ids = [...run('npx clasp deployments').matchAll(/^- (\S+) @(\d+|HEAD)/gm)].filter((m) => m[2] !== 'HEAD').map((m) => m[1]);
if (!ids.length) { console.log(run('npx clasp deploy --description "web app"')); process.exit(0); }
console.log(run(`npx clasp deploy -i ${ids[ids.length - 1]} --description "web app"`));
