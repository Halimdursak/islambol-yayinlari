#!/usr/bin/env node
/**
 * tile-screenshot.mjs — docs/design/style-tile.html'in tam sayfa ekran görüntülerini alır.
 * Çıktı: docs/design/style-tile.png (1440) ve docs/design/style-tile-mobile.png (390).
 * Not: Bu makinede Playwright yalnızca sistem Edge'i ile çalışır (channel: 'msedge').
 * Kullanım: node scripts/design/tile-screenshot.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TILE = resolve(ROOT, 'docs/design/style-tile.html');
const TARGETS = [
  { width: 1440, height: 900, out: 'docs/design/style-tile.png' },
  { width: 390, height: 844, out: 'docs/design/style-tile-mobile.png' },
];

const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const { width, height, out } of TARGETS) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: 'light' });
    const failed = [];
    page.on('requestfailed', (req) => failed.push(req.url()));
    await page.goto(pathToFileURL(TILE).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // loading="lazy" görseller tam sayfa çekimde de görünsün
    await page.evaluate(() => Promise.all([...document.images].map((img) => {
      img.loading = 'eager';
      return img.complete && img.naturalWidth ? null : new Promise((ok) => { img.onload = ok; img.onerror = ok; });
    })));

    const report = await page.evaluate(() => ({
      fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.style}`),
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      brokenImages: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')),
    }));

    await page.screenshot({ path: resolve(ROOT, out), fullPage: true });
    const uniqueFonts = [...new Set(report.fonts)];
    console.log(`${out}: yüklü fontlar=${JSON.stringify(uniqueFonts)} yatay taşma=${report.overflowX} kırık görsel=${report.brokenImages.length}`);
    // Kök-göreli /assets/fonts URL'leri file:// altında beklenen şekilde başarısız olur; diğerleri raporlanır.
    const unexpected = failed.filter((u) => !u.includes('/assets/fonts/') || u.includes('src/assets/fonts'));
    if (unexpected.length) console.log('  beklenmeyen başarısız istekler:', unexpected);
    await page.close();
  }
} finally {
  await browser.close();
}
