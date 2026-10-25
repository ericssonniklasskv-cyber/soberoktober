import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.ADVENTURE_PORT || 3002);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Välj en giltig lokal port med ADVENTURE_PORT.');
const allowed = /^\/adventure\/(?:[a-z-]+\.(?:html|css|js)|assets\/(?:[a-z-]+\.(?:png|webp)|players\/[a-z-]+\.(?:png|webp))|audio\/(?:beer-orc|wine-gnome|shots-dragon|prosecco-witch|nightclub-gollum|hangover-baron|final-fanfare)\.m4a)$/;
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const route = pathname === '/' || pathname === '/adventure/' ? '/adventure/index.html' : pathname;
    if (!['GET', 'HEAD'].includes(req.method) || !(allowed.test(route) || route === '/aktivitet/activity-logic.js')) throw Error('Not found');
    const file = path.resolve(root, '.' + route);
    if (!file.startsWith(root + path.sep)) throw Error('Not found');
    const content = await fs.readFile(file);
    const isAudio = route.endsWith('.m4a');
    res.setHeader('Content-Type', isAudio ? 'audio/mp4' : route.endsWith('.html') ? 'text/html; charset=utf-8' : route.endsWith('.css') ? 'text/css' : route.endsWith('.webp') ? 'image/webp' : route.endsWith('.png') ? 'image/png' : 'text/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    if (isAudio) {
      // Safari asks for byte ranges when playing MPEG-4 audio.
      res.setHeader('Accept-Ranges', 'bytes');
      if (req.headers.range && req.method === 'GET') {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        let start = 0, end = content.length - 1;
        if (range && (range[1] || range[2])) {
          if (range[1]) {
            start = Number(range[1]);
            if (range[2]) end = Math.min(Number(range[2]), end);
          } else start = Math.max(0, content.length - Number(range[2]));
        }
        if (!range || !(range[1] || range[2]) || !Number.isSafeInteger(start) || start > end || start >= content.length) {
          res.writeHead(416, { 'Content-Range': `bytes */${content.length}` }).end();
          return;
        }
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${content.length}`, 'Content-Length': end - start + 1 });
        res.end(content.subarray(start, end + 1));
        return;
      }
    }
    res.setHeader('Content-Length', content.length);
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Finns inte i den lokala äventyrsskissen.');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} används redan. Öppna http://localhost:${port}/ eller välj ADVENTURE_PORT=3003 npm run dev:adventure.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`Finaläventyret: http://localhost:${port}/ · Lokal skiss, inga riktiga poäng. Ctrl+C stoppar.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
