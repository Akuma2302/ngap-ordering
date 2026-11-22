// Tiny static server for local testing: node scripts/serve.js [port]  (serves frontend/dist)
const http = require('http');
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const port = Number(process.argv[2] || process.env.PORT || 8001);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png',
                '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/sales.html';
  const file = path.normalize(path.join(dist, p));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${dist} at http://localhost:${port}`));
