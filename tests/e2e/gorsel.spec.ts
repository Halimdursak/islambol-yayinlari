import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { yatayTasma } from '../yardimci/sayfa';
import { EKRAN, hazirla, klasor, SAYFALAR, tasmaKaydet } from '../yardimci/gorsel';

const GENISLIKLER = [320, 768, 1024, 1440] as const;
test.describe('görsel regresyon: 4 genişlik x 11 sayfa (açık tema)', () => {
  for (const genislik of GENISLIKLER) {
    for (const { ad, url } of SAYFALAR) {
      test(`${genislik}px ${ad}`, async ({ page }) => {
        await page.setViewportSize({ width: genislik, height: genislik < 768 ? 800 : 900 });
        await hazirla(page, url);

        const olcum = await yatayTasma(page);
        tasmaKaydet(genislik, ad, 'acik', olcum);

        await page.screenshot({
          path: join(klasor(EKRAN, String(genislik)), `${ad}.png`),
          fullPage: true,
          animations: 'disabled',
        });
        expect(olcum.scrollWidth, `yatay kaydırma yok (scrollWidth ${olcum.scrollWidth} <= innerWidth ${olcum.innerWidth})`).toBeLessThanOrEqual(
          olcum.innerWidth,
        );
      });
    }
  }
});

