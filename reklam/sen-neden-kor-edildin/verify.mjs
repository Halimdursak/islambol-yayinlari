/* MP4 doğrulama: kutu yapısı (node) + Edge'de gerçek oynatma, kare örnekleri ve ses seviyeleri. */
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.join(here, 'out');
const file = process.argv[2] || 'sen-neden-kor-edildin-reels.mp4';
const buf = fs.readFileSync(path.join(out, file));
// --- kutu ayrıştırma
const u32 = (o) => buf.readUInt32BE(o), tag = (o) => buf.toString('latin1', o, o + 4);
function boxes(start, end, depth = 0, acc = []) {
  let o = start;
  while (o + 8 <= end) {
    let size = u32(o); const type = tag(o + 4); let hdr = 8;
    if (size === 1) { size = Number(buf.readBigUInt64BE(o + 8)); hdr = 16; } else if (size === 0) size = end - o;
    acc.push({ type, size, off: o, depth });
    if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) boxes(o + hdr, o + size, depth + 1, acc);
    o += size;
  }
  return acc;
}
const bx = boxes(0, buf.length);
const top = bx.filter(b => b.depth === 0).map(b => `${b.type}(${b.size})`).join(' ');
console.log('üst kutular:', top);
console.log('faststart (moov mdat\'tan önce):', bx.findIndex(b => b.type === 'moov') < bx.findIndex(b => b.type === 'mdat'));
for (const b of bx.filter(b => b.type === 'hdlr')) console.log('hdlr', buf.toString('latin1', b.off + 16, b.off + 20));
for (const b of bx.filter(b => b.type === 'mdhd')) { const v = buf[b.off + 8]; const ts = u32(b.off + (v ? 28 : 20)); const dur = v ? Number(buf.readBigUInt64BE(b.off + 32)) : u32(b.off + 24); console.log('mdhd timescale', ts, 'süre', (dur / ts).toFixed(3), 'sn'); }
for (const b of bx.filter(b => b.type === 'stsd')) { const fmt = tag(b.off + 20); console.log('stsd codec', fmt); }
const avcC = buf.indexOf('avcC'); if (avcC > 0) console.log('avcC profil', buf[avcC + 5], 'uyumluluk', buf[avcC + 6], 'seviye', buf[avcC + 7], '(100=High, 40=4.0)');
const stsz = bx.filter(b => b.type === 'stsz'); console.log('örnek sayıları (stsz):', stsz.map(b => u32(b.off + 16)).join(', '));

// --- tarayıcıda oynatma
const MIME = { '.mp4': 'video/mp4', '.html': 'text/html' };
const srv = http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]).slice(1);
  if (name === '') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><title>v</title><body>'); }
  const p = path.join(out, name); if (!p.startsWith(out) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  const size = fs.statSync(p).size, range = req.headers.range;
  if (range) { const [a, b] = range.replace('bytes=', '').split('-'); const s = +a, e = b ? +b : size - 1; res.writeHead(206, { 'content-type': MIME[path.extname(p)], 'content-range': `bytes ${s}-${e}/${size}`, 'accept-ranges': 'bytes', 'content-length': e - s + 1 }); fs.createReadStream(p, { start: s, end: e }).pipe(res); }
  else { res.writeHead(200, { 'content-type': MIME[path.extname(p)], 'content-length': size, 'accept-ranges': 'bytes' }); fs.createReadStream(p).pipe(res); }
}).listen(0, '127.0.0.1'); await new Promise(r => srv.on('listening', r));
const b = await chromium.launch({ channel: 'msedge', headless: true });
const pg = await b.newPage(); await pg.goto(`http://127.0.0.1:${srv.address().port}/`);
const times = (process.argv[3] || '0.5,3.05,5,9,13,17,19.9,21,23.7').split(',').map(Number);
const tlFile = path.join(out, 'timeline.json'); const tl0 = fs.existsSync(tlFile) ? JSON.parse(fs.readFileSync(tlFile, 'utf8')) : null;
const res = await pg.evaluate(async ([f, times, tl]) => {
  const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = '/' + f; document.body.appendChild(v);
  await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = () => j(new Error('video error ' + (v.error && v.error.message))); });
  const info = { duration: v.duration, w: v.videoWidth, h: v.videoHeight };
  const s = document.createElement('canvas'), cw = 270, ch = 480; s.width = times.length * (cw + 6) + 6; s.height = ch + 30;
  const sc = s.getContext('2d'); sc.fillStyle = '#333'; sc.fillRect(0, 0, s.width, s.height);
  for (let i = 0; i < times.length; i++) {
    v.currentTime = times[i]; await new Promise(r => v.onseeked = r);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    sc.drawImage(v, 6 + i * (cw + 6), 24, cw, ch); sc.fillStyle = '#fff'; sc.font = '16px monospace'; sc.fillText('t=' + times[i], 8 + i * (cw + 6), 17);
  }
  // ses çözme
  let audio = null;
  try {
    const ab = await (await fetch('/' + f)).arrayBuffer(); const ac = new AudioContext(); const d = await ac.decodeAudioData(ab);
    const L = d.getChannelData(0), R = d.getChannelData(1); const per = [];
    for (let sec = 0; sec < Math.ceil(d.duration); sec++) { let ss = 0, n = 0, pk = 0; for (let i = sec * d.sampleRate; i < Math.min(L.length, (sec + 1) * d.sampleRate); i++) { const x = (L[i] + R[i]) / 2; ss += x * x; n++; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); } per.push([+(20 * Math.log10(Math.sqrt(ss / n) + 1e-9)).toFixed(1), +(20 * Math.log10(pk + 1e-9)).toFixed(1)]); }
    audio = { channels: d.numberOfChannels, sr: d.sampleRate, duration: d.duration, perSecRmsPeakDb: per };
    if (tl) {   // seslendirme pencereleri: konuşma penceresi ile hemen öncesindeki 0,3 sn karşılaştırılır
      const rms = (a, b) => { let ss = 0, n = 0; for (let i = Math.max(0, Math.floor(a * d.sampleRate)); i < Math.min(L.length, Math.floor(b * d.sampleRate)); i++) { const x = (L[i] + R[i]) / 2; ss += x * x; n++; } return +(10 * Math.log10(ss / Math.max(1, n) + 1e-12)).toFixed(1); };
      audio.vo = Object.fromEntries(Object.entries(tl.T.vo).map(([k, t0]) => [k, { start: +t0.toFixed(2), dur: tl.vo[k], rmsDbIn: rms(t0, t0 + tl.vo[k]), rmsDbBefore: rms(t0 - 0.3, t0 - 0.05) }]));
    }
  } catch (e) { audio = 'çözülemedi: ' + e.message; }
  return { info, audio, sheet: s.toDataURL('image/png') };
}, [file, times, tl0]);
fs.writeFileSync(path.join(out, 'verify-' + file.replace('.mp4', '.png')), Buffer.from(res.sheet.split(',')[1], 'base64'));
console.log('video öğesi:', JSON.stringify(res.info));
console.log('ses:', JSON.stringify(res.audio));
await b.close(); srv.close();
