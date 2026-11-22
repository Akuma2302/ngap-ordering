// Local server that behaves like Netlify (see netlify.toml): node scripts/serve.js [port]
//   /                      -> 302 /sales
//   /sales.html, /order    -> 301 /sales   (same for agent/admin)
//   /sales, /sales/stok... -> dist/sales/index.html  (the page picks the tab from the URL)
const http = require('http');
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const port = Number(process.argv[2] || process.env.PORT || 8001);
const APPS = ['sales', 'agent', 'admin'];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png',
                '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml' };

function redirect(res, code, to) { res.writeHead(code, { Location: to }); res.end(); }

http.createServer((req, res) => {
  const [rawPath, query = ''] = req.url.split('?');
  const p = decodeURIComponent(rawPath), qs = query ? '?' + query : '';
  if (p === '/' || p === '/order' || p === '/order.html') return redirect(res, p === '/' ? 302 : 301, '/sales' + qs);
  const html = /^\/(sales|agent|admin)\.html$/.exec(p);
  if (html) return redirect(res, 301, '/' + html[1] + qs);
  const app = APPS.find((a) => p === '/' + a || p.startsWith('/' + a + '/'));
  let file = app ? path.join(dist, app, 'index.html') : path.normalize(path.join(dist, p));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${dist} at http://localhost:${port}/sales`));
