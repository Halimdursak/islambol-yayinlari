// Ekran görüntüleri + yatay kaydırma denetimi (Playwright, msedge).
// Çalıştır: node docs/design/secenekler/secenek-1/ekran.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:8096/docs/design/secenekler/secenek-1/';

async function hazirla(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Lazy görseller ve scroll-reveal için sayfayı sonuna kadar kaydır.
  await page.evaluate(async () => {
    const step = Math.max(300, window.innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
}

const olc = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bw: document.body.scrollWidth }));

const browser = await chromium.launch({ channel: 'msedge' });
const sonuc = {};
try {
  for (const [sayfa, dosya] of [['index.html', 'ana'], ['kitap.html', 'kitap']]) {
    for (const w of [390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width: w, height: w < 500 ? 844 : 900 }, deviceScaleFactor: 1 });
      await hazirla(page, BASE + sayfa);
      const m = await olc(page);
      sonuc[`${sayfa}@${w}`] = m;
      if (dosya === 'ana' && (w === 1440 || w === 390)) {
        await page.screenshot({ path: path.join(HERE, `ana-${w}.png`), fullPage: true });
      }
      if (dosya === 'ana' && w === 1440) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(HERE, 'hero-1440.png'), fullPage: false });
      }
      if (dosya === 'kitap' && w === 1440) {
        await page.screenshot({ path: path.join(HERE, 'kitap-1440.png'), fullPage: true });
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
for (const [k, v] of Object.entries(sonuc)) {
  console.log(`${k}: scrollWidth=${v.sw} innerWidth=${v.iw} ${v.sw <= v.iw ? 'OK' : 'TASMA!'}`);
}
