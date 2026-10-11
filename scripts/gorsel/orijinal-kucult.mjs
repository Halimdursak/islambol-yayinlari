// Kapak orijinallerini (public/kapaklar) yerinde küçültür: uzun kenar en fazla 1600 px, JPEG kalite 85.
// Neden: kaynak dosyalar 96 MB'tı ve build hepsini dist/'e kopyalıyor (B4 raporu, 11 Ekim 2026).
// Dosya mtime'ı korunur ki `npm run gorsel` gereksiz yeniden üretim yapmasın. PNG'ler JPEG'e çevrilir ve
// data/catalog/books.json ile kapaklar-opt.json içindeki "orijinal" yolu güncellenir.
// Çalıştır: node scripts/gorsel/orijinal-kucult.mjs   (idempotent: 1600 px altı ve jpg olanlara dokunmaz)
import sharp from "sharp";
import { readdirSync, statSync, utimesSync, unlinkSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(KOK, "public", "kapaklar");
const MAX = 1600;
let once = 0, sonra = 0, degisen = 0;
const yeniden = new Map(); // eski göreli yol → yeni göreli yol

for (const f of readdirSync(DIR)) {
  const ext = extname(f).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(ext)) continue;
  const src = join(DIR, f);
  const st = statSync(src);
  once += st.size;
  const meta = await sharp(src).metadata();
  const buyuk = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (ext !== ".png" && buyuk <= MAX) { sonra += st.size; continue; }
  const hedef = join(DIR, basename(f, ext) + ".jpg");
  const buf = await sharp(src).rotate().resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }).jpeg({ quality: 85, progressive: true, mozjpeg: true }).toBuffer();
  writeFileSync(hedef, buf);
  if (hedef !== src) unlinkSync(src); // önce yaz, sonra kaynağı kaldır (Q3 M8)
  utimesSync(hedef, st.atime, st.mtime);
  sonra += buf.length; degisen++;
  if (hedef !== src) yeniden.set(`public/kapaklar/${f}`, `public/kapaklar/${basename(hedef)}`);
}

// Yol güncellemeleri (png → jpg)
for (const dosya of ["data/catalog/books.json", "data/catalog/kapaklar-opt.json"]) {
  const yol = join(KOK, dosya);
  let metin = readFileSync(yol, "utf8");
  let n = 0;
  for (const [eski, yeni] of yeniden) {
    const e1 = eski, y1 = yeni;
    const e2 = "/" + eski.replace(/^public\//, ""), y2 = "/" + yeni.replace(/^public\//, "");
    for (const [a, b] of [[e1, y1], [e2, y2]]) { const c = metin.split(a).length - 1; if (c) { metin = metin.split(a).join(b); n += c; } }
  }
  if (n) writeFileSync(yol, metin);
  console.log(`${dosya}: ${n} yol güncellendi`);
}
console.log(`kapak orijinalleri: ${degisen} dosya küçültüldü; ${(once / 1048576).toFixed(1)} MB → ${(sonra / 1048576).toFixed(1)} MB`);
