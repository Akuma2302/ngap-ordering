// Build the static site into frontend/dist:
//   public/*  -> dist/            (pages, images, icons, manifests)
//   src/*     -> dist/ordering/   (shared JS + CSS used by every page)
// SCRIPT_URL (Apps Script web app URL) comes from the environment (Netlify) or frontend/.env.
// Every ?v=N cache-buster in the HTML is replaced with this build's id so phones never keep old files.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

function loadEnv() {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
}

loadEnv();
fs.rmSync(dist, { recursive: true, force: true });
copyDir(path.join(root, 'public'), dist);
copyDir(path.join(root, 'src'), path.join(dist, 'ordering'));

// Clean URLs: sales.html -> /sales/index.html (served at /sales, /sales/stok, ...). Old *.html links are redirected.
const APPS = ['sales', 'agent', 'admin'];
const build = Date.now().toString(36);
for (const app of APPS) {
  const from = path.join(dist, app + '.html');
  const html = fs.readFileSync(from, 'utf8').replace(/(ordering\/[\w.-]+\.(?:js|css))\?v=\w+/g, `$1?v=${build}`);
  fs.mkdirSync(path.join(dist, app), { recursive: true });
  fs.writeFileSync(path.join(dist, app, 'index.html'), html);
  fs.unlinkSync(from);
}
fs.rmSync(path.join(dist, 'order.html'), { force: true });   // replaced by a redirect (netlify.toml)

const url = (process.env.SCRIPT_URL || '').trim();
const cfg = path.join(dist, 'ordering', 'config.js');
if (url) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
    console.error('SCRIPT_URL does not look like an Apps Script /exec URL:', url);
    process.exit(1);
  }
  const src = fs.readFileSync(cfg, 'utf8');
  fs.writeFileSync(cfg, src.replace(/SCRIPT_URL:\s*'[^']*'/, `SCRIPT_URL: '${url}'`));
  console.log('SCRIPT_URL set from environment.');
} else {
  console.log('SCRIPT_URL not set: using the value in src/config.js.');
}
console.log(`Built ${path.relative(process.cwd(), dist) || 'dist'} (build ${build}).`);
