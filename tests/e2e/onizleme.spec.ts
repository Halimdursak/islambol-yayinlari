import { expect, test, type Page } from '@playwright/test';
import { konsolToplayici } from '../yardimci/sayfa';

const KITAP = '/kitap/sen-neden-kor-edildin/';
const SAYAC_ILK = '1 / 10';

function pageFlipIstekleri(page: Page): string[] {
  const istekler: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('page-flip.module.js')) istekler.push(r.url());
  });
  return istekler;
}

test.describe('önizleme (hareket serbest)', () => {
  test('açılır, sayaç 1 / 10, page-flip tıklamadan sonra yüklenir', async ({ page }) => {
    const kayit = konsolToplayici(page);
    const flip = pageFlipIstekleri(page);
    await page.goto(KITAP);
    await page.waitForLoadState('networkidle');
    expect(flip, 'page-flip tıklamadan ÖNCE yüklenmemeli').toHaveLength(0);

    await page.locator('button[data-onizleme]').click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await expect(page.locator('[data-onizleme-sayac]')).toHaveText(SAYAC_ILK);
    expect(flip.length, 'page-flip tıklamadan SONRA yüklenmeli').toBeGreaterThan(0);
    expect(kayit).toEqual([]);
  });

  test('masaüstü: ArrowRight sayacı değiştirir, Escape kapatır, odak tetikleyiciye döner', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'masaustu', 'Klavye gezintisi masaüstü projesinde sınanır');
    await page.goto(KITAP);
    const tetik = page.locator('button[data-onizleme]');
    await tetik.click();
    await expect(page.locator('[data-onizleme-sayac]')).toHaveText(SAYAC_ILK);

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-onizleme-sayac]')).not.toHaveText(SAYAC_ILK);
    const ikinci = (await page.locator('[data-onizleme-sayac]').innerText()).trim();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-onizleme-sayac]')).not.toHaveText(ikinci);

    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(tetik).toBeFocused();
  });

  test('mobil: Sonraki sayfa düğmesine dokunmak 2 / 10 yapar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobil', 'Dokunma mobil projesinde sınanır');
    await page.goto(KITAP);
    await page.locator('button[data-onizleme]').tap();
    await expect(page.locator('[data-onizleme-sayac]')).toHaveText(SAYAC_ILK);
    await page.locator('[data-onizleme-sonraki]').tap();
    await expect(page.locator('[data-onizleme-sayac]')).toHaveText('2 / 10');
    await page.locator('[data-onizleme-kapat]').tap();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('kapat düğmesi kapatır, odak tetikleyiciye döner', async ({ page }) => {
    await page.goto(KITAP);
    const tetik = page.locator('button[data-onizleme]');
    await tetik.click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await page.locator('[data-onizleme-kapat]').click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(tetik).toBeFocused();
  });

  test('ana sayfa hero kapağı önizlemeyi açar', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-onizleme]').first().click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await expect(page.locator('[data-onizleme-baslik]')).not.toBeEmpty();
    await expect(page.locator('[data-onizleme-sayac]')).toHaveText(SAYAC_ILK);
  });
});

test.describe('önizleme (hareket azaltma)', () => {
  test.use({ reducedMotion: 'reduce' });

  test('galeri moduna düşer: 10 görsel, canvas yok, page-flip yüklenmez', async ({ page }) => {
    const flip = pageFlipIstekleri(page);
    await page.goto(KITAP);
    await page.locator('button[data-onizleme]').click();
    const dlg = page.locator('dialog[open]');
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute('data-galeri', '');
    await expect(dlg.locator('[data-onizleme-galeri] img')).toHaveCount(10);
    await expect(dlg.locator('[data-onizleme-galeri]')).toBeVisible();
    await expect(dlg.locator('canvas')).toHaveCount(0);
    expect(flip).toHaveLength(0);
  });
});
