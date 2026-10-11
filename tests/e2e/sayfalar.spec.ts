import { expect, test } from '@playwright/test';
import { distSayfalari, sitemapYollari } from '../yardimci/dist';
import { kirikGorseller, konsolToplayici, sonunaKaydir } from '../yardimci/sayfa';

const sayfalar = distSayfalari();

test.describe('sitemap.xml', () => {
  test('sitemap içindeki her URL 200 döner', async ({ request }) => {
    const yollar = sitemapYollari();
    expect(yollar.length).toBeGreaterThan(0);
    const basarisiz: string[] = [];
    for (const yol of yollar) {
      const yanit = await request.get(yol);
      if (yanit.status() !== 200) basarisiz.push(`${yol} -> ${yanit.status()}`);
    }
    expect(basarisiz, 'sitemap URL durumları').toEqual([]);
  });

  test('sitemap, dist içindeki tüm indekslenebilir sayfaları kapsar', () => {
    const sitemap = new Set(sitemapYollari());
    const eksik = sayfalar.map((s) => s.url).filter((u) => u !== '/404.html' && !sitemap.has(u));
    expect(eksik, `sitemap'te olmayan ${eksik.length} sayfa (ilk 10: ${eksik.slice(0, 10).join(', ')})`).toEqual([]);
  });
});

test.describe('404', () => {
  test('olmayan yol 404 durumu ve 404 sayfası döner', async ({ page }) => {
    const yanit = await page.goto('/boyle-bir-sayfa-yok/');
    expect(yanit?.status()).toBe(404);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main a[href]').first()).toBeVisible();
  });
});

for (const { url } of sayfalar) {
  test(`sayfa sağlığı: ${url}`, async ({ page }) => {
    const kayit = konsolToplayici(page);
    const yanit = await page.goto(url);
    // 404.html dosyası doğrudan istendiğinde statik sunucu 200 verir (404 yalnız olmayan yollarda).
    expect(yanit?.status(), 'HTTP durumu').toBe(200);

    await expect(page.locator('h1'), 'tek <h1>').toHaveCount(1);
    expect((await page.title()).trim(), '<title> boş değil').not.toBe('');

    await sonunaKaydir(page);
    expect(await kirikGorseller(page), 'kırık görseller').toEqual([]);
    expect(kayit, 'konsol/istek hataları').toEqual([]);
  });
}
