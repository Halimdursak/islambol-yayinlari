import { expect, test } from '@playwright/test';
import { kitaplar } from '../yardimci/veri';
import { kirikGorseller, sonunaKaydir } from '../yardimci/sayfa';

const TOPLAM = kitaplar().length;

test.describe('katalog (JS açık)', () => {
  test('kart sayısı books.json ile eşit', async ({ page }) => {
    await page.goto('/kitaplar/');
    await expect(page.locator('.kitap-karti')).toHaveCount(TOPLAM);
    await expect(page.locator('.katalog__sayi')).toContainText(String(TOPLAM));
    await sonunaKaydir(page);
    expect(await kirikGorseller(page)).toEqual([]);
  });

  test('kategori süzgeci kart sayısını düşürür ve URL güncellenir', async ({ page }) => {
    await page.goto('/kitaplar/');
    await expect(page.locator('form[data-filtre]')).toBeVisible();
    const cip = page.locator('[data-kategori-cip="tarih"]');
    const beklenen = Number(await cip.locator('.cip__sayi').innerText());
    await cip.click();
    await expect(page).toHaveURL(/[?&]kategori=tarih(&|$)/);
    const gorunen = page.locator('.kitap-karti:not([hidden])');
    await expect(gorunen).toHaveCount(beklenen);
    expect(beklenen).toBeGreaterThan(0);
    expect(beklenen).toBeLessThan(TOPLAM);
  });

  test('?kategori=tarih adresi doğrudan açıldığında süzgeç uygulanır', async ({ page }) => {
    await page.goto('/kitaplar/?kategori=tarih');
    await expect(page.locator('[data-kategori-cip="tarih"]')).toHaveAttribute('aria-pressed', 'true');
    const n = await page.locator('.kitap-karti:not([hidden])').count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(TOPLAM);
  });

  test('arama "halife" en az bir sonuç verir', async ({ page }) => {
    await page.goto('/kitaplar/');
    await page.locator('[data-alan="q"]').fill('halife');
    const gorunen = page.locator('.kitap-karti:not([hidden])');
    // Süzgeç gecikmeli (debounce) uygulanır: sayı TOPLAM'dan düşene kadar otomatik bekle.
    await expect(gorunen).not.toHaveCount(TOPLAM);
    expect(await gorunen.count()).toBeGreaterThanOrEqual(1);
  });

  test('sonuçsuz arama boş durum metnini gösterir', async ({ page }) => {
    await page.goto('/kitaplar/');
    await page.locator('[data-alan="q"]').fill('zzqxyvw');
    const bos = page.locator('[data-bos]');
    await expect(bos).toBeVisible();
    await expect(bos).toContainText('Bu süzgece uyan kayıt yok');
    await expect(page.locator('.kitap-karti:not([hidden])')).toHaveCount(0);
  });

  test('süzgeçleri temizle tüm kartları geri getirir', async ({ page }) => {
    await page.goto('/kitaplar/?kategori=tarih');
    await page.locator('form[data-filtre] [data-temizle]').click();
    await expect(page.locator('.kitap-karti:not([hidden])')).toHaveCount(TOPLAM);
    await expect(page).not.toHaveURL(/kategori=/);
  });
});

test.describe('katalog (JS kapalı)', () => {
  test.use({ javaScriptEnabled: false });

  test('tüm kartlar görünür', async ({ page }) => {
    await page.goto('/kitaplar/');
    const kartlar = page.locator('.kitap-karti');
    await expect(kartlar).toHaveCount(TOPLAM);
    // hidden niteliği olmayan ve ekranda yer kaplayan kart sayısı
    const gorunen = await kartlar.evaluateAll(
      (els) => els.filter((e) => !(e as HTMLElement).hidden && (e as HTMLElement).getClientRects().length > 0).length,
    );
    expect(gorunen).toBe(TOPLAM);
  });
});
