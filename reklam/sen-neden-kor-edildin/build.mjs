/* Kullanım:
     node build.mjs sheet 0.5,1,2,3.05,...   → out/sheet.png (kare özeti)
     node build.mjs frame 5.2                  → out/frame-5.20.png (tam çözünürlük)
     node build.mjs export                     → out/sen-neden-kor-edildin-reels.mp4 (+ -sessiz.mp4)
   Tarayıcı: Edge (msedge kanalı). Sebep: bu makinede Windows Uygulama Denetimi ffmpeg/Chromium'u engelliyor;
   H.264 + AAC kodlaması Edge'in WebCodecs'iyle, MP4 paketleme vendor/mp4-muxer.mjs ile yapılır. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out');
fs.mkdirSync(out, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const p = path.join(here, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'reel.html');
  if (!p.startsWith(here) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise(r => srv.on('listening', r));
const url = `http://127.0.0.1:${srv.address().port}/reel.html`;

const [mode, arg] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('response', r => { if (r.status() >= 400) console.log('[404]', r.url()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(url);
await page.waitForFunction(() => window.reelReady === true, null, { timeout: 60000 });

const save = (dataUrl, name) => { fs.writeFileSync(path.join(out, name), Buffer.from(dataUrl.split(',')[1], 'base64')); console.log('yazıldı', name); };

if (mode === 'sheet') {
  const times = (arg || '0.5,1.5,2.5,3.02,3.1,3.3').split(',').map(Number);
  const cols = Number(process.argv[4] || 6), scale = Number(process.argv[5] || 0.25);
  save(await page.evaluate(([t, c, s]) => window.reel.sheet(t, c, s), [times, cols, scale]), process.argv[6] || 'sheet.png');
} else if (mode === 'frame') {
  const t = Number(arg);
  save(await page.evaluate(t => window.reel.pngAt(t), t), `frame-${t.toFixed(2)}.png`);
} else if (mode === 'export') {
  for (const audio of [true, false]) {
    const t0 = Date.now();
    const info = await page.evaluate(a => window.reel.exportMp4({ audio: a }), audio);
    const parts = [];
    for (let off = 0; off < info.bytes; off += 3_000_000) parts.push(Buffer.from(await page.evaluate(([o, l]) => window.reel.b64Chunk(o, l), [off, 3_000_000]), 'base64'));
    const file = path.join(out, audio ? 'sen-neden-kor-edildin-reels.mp4' : 'sen-neden-kor-edildin-reels-sessiz.mp4');
    fs.writeFileSync(file, Buffer.concat(parts));
    console.log(path.basename(file), (info.bytes / 1e6).toFixed(2) + ' MB', info.frames + ' kare', ((Date.now() - t0) / 1000).toFixed(1) + ' sn', JSON.stringify(info.audio));
  }
} else {
  console.log('mod: sheet | frame | export');
}
await browser.close(); srv.close();
