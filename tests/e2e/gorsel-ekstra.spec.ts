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

// Beyaz Vitrin açık temayı her sistem ayarında kullanır (ADR-010): sistem koyu moddayken de sayfa açık kalmalı.
test.describe('sistem koyu moddayken', () => {
  test.use({ colorScheme: 'dark' });

  for (const { ad, url } of SAYFALAR.filter((s) => ['ana-sayfa', 'kitap-sen-neden-kor-edildin'].includes(s.ad))) {
    test(`açık tema korunur: ${ad}`, async ({ page }, testInfo) => {
      const genislik = testInfo.project.name === 'mobil' ? 390 : 1440;
      await hazirla(page, url);

      // Gövde ve ana metin rengi açık-tema değerlerinde kalmalı (koyu zemin / açık metin olmamalı).
      const renkler = await page.evaluate(() => {
        const parlaklik = (css: string) => {
          const m = css.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
          return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
        };
        const stil = getComputedStyle(document.body);
        return { zemin: parlaklik(stil.backgroundColor), metin: parlaklik(stil.color), seviye: getComputedStyle(document.documentElement).colorScheme };
      });

      const olcum = await yatayTasma(page);
      tasmaKaydet(genislik, ad, 'sistem-koyu', olcum);
      await page.screenshot({
        path: join(klasor(EKRAN, 'sistem-koyu', String(genislik)), `${ad}.png`),
        fullPage: true,
        animations: 'disabled',
      });
      expect(renkler.zemin, 'sistem koyuyken gövde zemini açık kalır').toBeGreaterThan(0.9);
      expect(renkler.metin, 'sistem koyuyken ana metin koyu kalır').toBeLessThan(0.2);
      expect(renkler.seviye).toBe('light');
      expect(olcum.scrollWidth).toBeLessThanOrEqual(olcum.innerWidth);
    });
  }
});
