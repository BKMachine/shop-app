// Minimal static file server for local development. Production is served by nginx
// (see nginx.conf and Dockerfile.bkmachine.net at the repo root); this only exists so `pnpm dev`
// can preview the site without Docker.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 8090;
const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  let filePath = path.join(siteDir, path.normalize(decodeURIComponent(pathname)));
  if (!filePath.startsWith(siteDir)) {
    res.writeHead(403).end();
    return;
  }

  try {
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, 'index.html');
    await stat(filePath);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }

  const type = contentTypes[path.extname(filePath)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  createReadStream(filePath).pipe(res);
}).listen(PORT, () => {
  console.log(`bkmachine.net: http://localhost:${PORT}`);
});
