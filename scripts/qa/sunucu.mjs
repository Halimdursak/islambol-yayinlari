// Basit statik sunucu (QA için). Bağımlılık yok. Kullanım: node scripts/qa/sunucu.mjs [--dir dist] [--port 8090] [--prefix /]
// Doğru MIME türleri (webp, woff2, mjs) verir; dizin isteklerinde index.html; bulunamayanda 404.html.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize, resolve } from "node:path";

const arg = (ad, varsayilan) => { const i = process.argv.indexOf(ad); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : varsayilan; };
const DIR = resolve(arg("--dir", "dist"));
const PORT = Number(arg("--port", "8090"));
const PREFIX = arg("--prefix", "/").replace(/\/?$/, "/");

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
  ".webmanifest": "application/manifest+json", ".map": "application/json",
};

async function dosyaBul(yol) {
  const tam = normalize(join(DIR, yol));
  if (!tam.startsWith(DIR)) return null;
  try {
    const s = await stat(tam);
    if (s.isDirectory()) return dosyaBul(join(yol, "index.html"));
    return tam;
  } catch { return null; }
}

createServer(async (req, res) => {
  let yol = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (PREFIX !== "/" && yol.startsWith(PREFIX)) yol = "/" + yol.slice(PREFIX.length);
  let dosya = await dosyaBul(yol);
  let durum = 200;
  if (!dosya) { dosya = await dosyaBul("/404.html"); durum = 404; }
  if (!dosya) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("404"); }
  const govde = await readFile(dosya);
  res.writeHead(durum, { "content-type": MIME[extname(dosya).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" });
  res.end(govde);
}).listen(PORT, "127.0.0.1", () => console.log(`QA sunucusu: http://127.0.0.1:${PORT}${PREFIX}  (dizin: ${DIR})`));
