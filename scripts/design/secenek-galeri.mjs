// Tasarım seçenekleri galerisi için ekran görüntülerini sıkıştırır (PNG → JPG) ve özet JSON üretir.
// Girdi: docs/design/secenekler/secenek-N/{hero-1440,ana-1440,ana-390,kitap-1440}.png + NOT.md
// Çıktı: docs/design/secenekler/galeri/secenek-N-<ad>.jpg + docs/design/secenekler/galeri/ozet.json
import sharp from "sharp";
import { readdirSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SEC = join(KOK, "docs", "design", "secenekler");
const OUT = join(SEC, "galeri");
mkdirSync(OUT, { recursive: true });

const AYAR = {
  "hero-1440": { width: 1440, quality: 82 },
  "ana-1440": { width: 1100, quality: 74 },
  "ana-390": { width: 390, quality: 78 },
  "kitap-1440": { width: 1100, quality: 74 },
};
const ozet = [];
for (const klasor of readdirSync(SEC).filter((d) => /^secenek-\d+$/.test(d)).sort()) {
  const kayit = { klasor, not: null, gorseller: {} };
  const notYolu = join(SEC, klasor, "NOT.md");
  if (existsSync(notYolu)) kayit.not = readFileSync(notYolu, "utf8");
  for (const [ad, ayar] of Object.entries(AYAR)) {
    const src = join(SEC, klasor, `${ad}.png`);
    if (!existsSync(src)) { kayit.gorseller[ad] = null; continue; }
    const dst = join(OUT, `${klasor}-${ad}.jpg`);
    const meta = await sharp(src).metadata();
    await sharp(src).resize({ width: Math.min(ayar.width, meta.width ?? ayar.width), withoutEnlargement: true })
      .jpeg({ quality: ayar.quality, progressive: true, mozjpeg: true }).toFile(dst);
    const dmeta = await sharp(dst).metadata();
    kayit.gorseller[ad] = { dosya: `${klasor}-${ad}.jpg`, w: dmeta.width, h: dmeta.height, kb: Math.round(statSync(dst).size / 1024) };
  }
  ozet.push(kayit);
}
writeFileSync(join(OUT, "ozet.json"), JSON.stringify(ozet, null, 2));
for (const k of ozet) console.log(k.klasor, Object.entries(k.gorseller).map(([a, g]) => `${a}:${g ? g.kb + "KB" : "YOK"}`).join(" "));
