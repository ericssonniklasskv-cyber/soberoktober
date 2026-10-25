import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.DERBY_PORT || 3001);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw Error('Välj en giltig lokal port med DERBY_PORT.');
}

const allowed = /^\/(derby\/[a-z-]+\.(?:html|css|js)|derby\/audio\/(?:squats|pushups|pullups|running)-\d+\.m4a|styles\/design-system\.css)$/;
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const route = pathname === '/' || pathname === '/derby/' ? '/derby/index.html' : pathname;
    if (!['GET', 'HEAD'].includes(req.method) || !allowed.test(route)) throw Error('Not found');
    const file = path.resolve(root, '.' + route);
    if (!file.startsWith(root + path.sep)) throw Error('Not found');
    const body = await fs.readFile(file);
    const isAudio = route.endsWith('.m4a');
    res.setHeader('Content-Type', isAudio ? 'audio/mp4' : route.endsWith('.html') ? 'text/html; charset=utf-8' : route.endsWith('.css') ? 'text/css' : 'text/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (isAudio) {
      // Safari requests byte ranges even for short voice recordings.
      res.setHeader('Accept-Ranges', 'bytes');
      if (req.headers.range && req.method === 'GET') {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        let start = 0, end = body.length - 1;
        if (range && (range[1] || range[2])) {
          if (range[1]) {
            start = Number(range[1]);
            if (range[2]) end = Math.min(Number(range[2]), end);
          } else start = Math.max(0, body.length - Number(range[2]));
        }
        if (!range || !(range[1] || range[2]) || !Number.isSafeInteger(start) || start > end || start >= body.length) {
          res.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end();
          return;
        }
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': end - start + 1 });
        res.end(body.subarray(start, end + 1));
        return;
      }
    }
    res.setHeader('Content-Length', body.length);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Finns inte i den lokala Derby-prototypen.');
  }
});
server.on('error', err => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${port} används redan. Välj annan med DERBY_PORT=3002 npm run dev:derby.` : err.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`Oktoberderbyt: http://localhost:${port}/ · Lokal demo utan databasanslutning. Ctrl+C stoppar.`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close());
