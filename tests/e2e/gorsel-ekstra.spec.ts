import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { yatayTasma } from '../yardimci/sayfa';
import { EKRAN, hazirla, klasor, SAYFALAR, tasmaKaydet } from '../yardimci/gorsel';

test.describe('önizleme açıkken', () => {
  test('önizleme diyaloğu ekran görüntüsü', async ({ page }, testInfo) => {
    const genislik = testInfo.project.name === 'mobil' ? 390 : 1440;
    await hazirla(page, '/kitap/sen-neden-kor-edildin/');
    await page.locator('button[data-onizleme]').click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await expect(page.locator('[data-onizleme-sayac]')).toHaveText('1 / 10');
    // Sayfa görselleri çözülsün
    await expect
      .poll(() => page.evaluate(() => [...document.querySelectorAll('dialog[open] img')].every((i) => (i as HTMLImageElement).complete)))
      .toBe(true);
    await page.waitForLoadState('networkidle');
    const olcum = await yatayTasma(page);
    tasmaKaydet(genislik, 'onizleme-acik', 'acik', olcum);
    await page.screenshot({
      path: join(klasor(EKRAN, 'onizleme'), `${genislik}-sen-neden-kor-edildin.png`),
      animations: 'disabled',
    });
    expect(olcum.scrollWidth).toBeLessThanOrEqual(olcum.innerWidth);
  });
});

test.describe('koyu tema', () => {
  test.use({ colorScheme: 'dark' });

  for (const { ad, url } of SAYFALAR.filter((s) => ['ana-sayfa', 'kitap-sen-neden-kor-edildin'].includes(s.ad))) {
    test(`koyu ${ad}`, async ({ page }, testInfo) => {
      const genislik = testInfo.project.name === 'mobil' ? 390 : 1440;
      await hazirla(page, url);

      // Koyu tema gerçekten uygulanmış mı? Gövde arka planı koyu olmalı.
      const parlaklik = await page.evaluate(() => {
        const m = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)?.map(Number) ?? [255, 255, 255];
        return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
      });

      const olcum = await yatayTasma(page);
      tasmaKaydet(genislik, ad, 'koyu', olcum);
      await page.screenshot({
        path: join(klasor(EKRAN, 'koyu', String(genislik)), `${ad}.png`),
        fullPage: true,
        animations: 'disabled',
      });
      expect(parlaklik, 'koyu temada gövde arka planı koyu').toBeLessThan(0.35);
      expect(olcum.scrollWidth).toBeLessThanOrEqual(olcum.innerWidth);
    });
  }
});
