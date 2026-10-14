// Tasarım seçenekleri canvas'ı için görselleri hazırlar.
// - Mobil görünümü 390 px genişlikte, retina (2×) olarak yeniden çeker (lazy/reveal için sayfayı kaydırarak).
// - Masaüstü görüntülerini (hero/ana/kitap) PNG'den JPG'ye çevirir.
// Girdi:  docs/design/secenekler/secenek-N/{hero-1440,ana-1440,kitap-1440}.png ve canlı sayfa (QA sunucusu :8096)
// Çıktı:  docs/design/secenekler/kanvas/sN-{hero,ana,kitap,mobil}.jpg + olcu.json (CSS px boyutları)
// Çalıştır: node scripts/design/secenek-kanvas-gorselleri.mjs   (önce: node scripts/qa/sunucu.mjs --dir . --port 8096)
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SEC = join(KOK, "docs", "design", "secenekler");
const OUT = join(SEC, "kanvas");
const PORT = process.env.QA_PORT || "8096";
mkdirSync(OUT, { recursive: true });

const olcu = {};
const browser = await chromium.launch({ channel: "msedge" });
for (const n of [1, 2, 3, 4]) {
  const dir = join(SEC, `secenek-${n}`);
  const kayit = (olcu[`s${n}`] = {});

  // Mobil: 390 × tam sayfa, DPR 2
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/docs/design/secenekler/secenek-${n}/index.html`, { waitUntil: "networkidle" });
  const yukseklik = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < yukseklik; y += 420) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(110); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const yatay = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const buf = await page.screenshot({ fullPage: true });
  await ctx.close();
  const mm = await sharp(buf).metadata();
  await sharp(buf).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(join(OUT, `s${n}-mobil.jpg`));
  kayit.mobil = { w: mm.width / 2, h: Math.round(mm.height / 2), yatay_kaydirma_yok: yatay };

  // Masaüstü
  for (const [ad, dosya, q] of [["hero", "hero-1440", 86], ["ana", "ana-1440", 82], ["kitap", "kitap-1440", 82]]) {
    const src = join(dir, `${dosya}.png`);
    const m = await sharp(src).metadata();
    await sharp(src).jpeg({ quality: q, progressive: true, mozjpeg: true }).toFile(join(OUT, `s${n}-${ad}.jpg`));
    kayit[ad] = { w: m.width, h: m.height };
  }
}
await browser.close();
writeFileSync(join(OUT, "olcu.json"), JSON.stringify(olcu, null, 2));
console.log(JSON.stringify(olcu));
