// Rakip ekran görüntülerini depoya sığacak boyuta indirir (tam sayfa PNG → 1280 px genişlik JPG).
// Tek seferlik; R2 Rakip Analisti çıktısı (docs/research/screenshots) için. Çalıştır: node scripts/arastirma/ss-kucult.mjs
import sharp from "sharp";
import { readdirSync, statSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "research", "screenshots");
let once = 0;
let sonra = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".png"))) {
  const src = join(dir, f);
  const dst = join(dir, f.replace(/\.png$/, ".jpg"));
  once += statSync(src).size;
  await sharp(src).resize({ width: 1280, withoutEnlargement: true }).jpeg({ quality: 72, progressive: true }).toFile(dst);
  sonra += statSync(dst).size;
  unlinkSync(src);
}
console.log(`ekran görüntüleri: önce ${(once / 1048576).toFixed(1)} MB → sonra ${(sonra / 1048576).toFixed(1)} MB`);
