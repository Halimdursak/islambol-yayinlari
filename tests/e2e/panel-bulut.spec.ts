// Bulut yönetim paneli (ADR-021): giriş, GitHub'dan okunan katalog, tarayıcıda küçültülen kapak, tek commit'le Yayınla, çakışma.
// Worker kodunun aynısı Node içinde çalışır; GitHub sahtedir. Gerçek Cloudflare'e ve GitHub'a dokunulmaz.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { bulutPanelBaslat, KULLANICI, SIFRE, type BulutPanel } from '../yardimci/bulut-panel';
import { kapakPdf, kapakPng } from '../yardimci/panel';

test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'Bulut paneli yolları masaüstü projesinde doğrulanır; telefon düzeni panel.spec.ts\'te.');

let bulut: BulutPanel;
const gecici = mkdtempSync(join(tmpdir(), 'islambol-bulut-dosya-'));

test.beforeAll(async () => { bulut = await bulutPanelBaslat(); });
test.afterAll(async () => { await bulut.kapat(); });

const depoKitaplari = (): Array<Record<string, any>> => JSON.parse(bulut.github.fileText('data/catalog/books.json'));

async function giris(page: Page): Promise<void> {
  await page.goto(`${bulut.adres}/yonetim/`);
  await page.getByLabel('Kullanıcı adı').fill(KULLANICI);
  await page.getByLabel('Şifre', { exact: true }).fill(SIFRE);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('heading', { name: 'Kitaplar', level: 1, exact: true })).toBeVisible();
}

test('giriş sayfası bulut kipinde açılır; katalog GitHub\'dan gelir, kapaklar görünür, yayın çubuğu temizdir', async ({ page }) => {
  await page.goto(`${bulut.adres}/yonetim/`);
  await expect(page.locator('.local-note')).toContainText('internet olan her yerden');
  await expect(page.locator('.local-note')).not.toContainText('yonetim-sifre-sifirla');
  await giris(page);
  expect(await page.locator('.book-card').count()).toBeGreaterThan(20);
  await expect(page.locator('.book-card img').first()).toBeVisible();
  await expect(page.locator('[data-publish-bar]')).toContainText('Site güncel');
});

test('büyük kapak resmi tarayıcıda küçültülür; kitap kaydedilince GitHub\'a tek commit gider ve dağıtım izlenir', async ({ page }) => {
  await giris(page);
  const resim = join(gecici, 'buyuk-kapak.png');
  await kapakPng(resim, '#2b5fa8', 2400, 3600);
  await page.getByRole('button', { name: /Yeni kitap/ }).click();
  await page.locator('[data-cover-file]').setInputFiles(resim);
  await expect(page.locator('[data-cover-status]')).toContainText('Kapak yüklendi');
  await page.locator('dialog[open] input[name="title"]').fill('Bulut Kitabı');
  await page.locator('dialog[open] input[name="authors"]').fill('Bulut Yazarı');
  await page.locator('#book-description').fill('Bulut panelinden eklenen deneme kaydı. Konusu kısaca anlatılır.');
  await page.locator('dialog[open] input[name="price_list_try"]').fill('199');
  await page.getByRole('checkbox', { name: 'Tarih' }).check();
  const once = bulut.github.head();
  await page.locator('dialog[open]').getByRole('button', { name: 'Kaydet ve yayınla' }).click();
  await expect(page.locator('.book-card', { hasText: 'Bulut Kitabı' })).toBeVisible();
  await expect(page.locator('[data-publish-bar]')).toContainText(/GitHub|Yayınlan|Site güncelleniyor/, { timeout: 20_000 });
  await expect.poll(() => bulut.github.head(), { timeout: 20_000 }).not.toBe(once);
  const kayit = depoKitaplari().find((kitap) => kitap.id === 'bulut-kitabi')!;
  expect(kayit.price_list_try).toBe(199);
  expect(kayit.cover.local_path).toMatch(/^public\/uploads\/.+\.jpg$/);
  const bayt = bulut.github.fileBytes(kayit.cover.local_path)!;
  const boyut = await sharp(bayt).metadata();
  expect(boyut.width, 'kapak 1200 pikselden geniş yüklenmemeli').toBeLessThanOrEqual(1200);
  expect(bayt.length).toBeLessThan(1_900_000);
  expect(bulut.github.commits.get(bulut.github.head()).message).toContain('içerik: panelden güncelleme');
  expect(bulut.github.commits.get(bulut.github.head()).parents[0]).toBe(once);
  // Dağıtım tamamlanınca çubuk "Yayında" der.
  bulut.github.setRuns(bulut.github.head(), [{ name: "Pages'e yayınla", status: 'completed', conclusion: 'success' }, { name: 'CI', status: 'completed', conclusion: 'success' }]);
  await expect(page.locator('[data-publish-bar]')).toContainText('Yayında', { timeout: 30_000 });
});

test('baskı PDF\'i: ön ve arka kapak ayrılır, arka kapağın WebP eşi de yüklenir ve yayınlanır', async ({ page }) => {
  await giris(page);
  const pdf = join(gecici, 'baski.pdf');
  writeFileSync(pdf, kapakPdf());
  await page.getByRole('button', { name: /Yeni kitap/ }).click();
  await page.locator('[data-cover-file]').setInputFiles(pdf);
  await expect(page.locator('[data-cover-status]')).toContainText('Ön ve arka kapak hazır', { timeout: 60_000 });
  await page.locator('dialog[open] input[name="title"]').fill('Bulut PDF Kitabı');
  await page.locator('dialog[open] input[name="authors"]').fill('PDF Yazarı');
  await page.locator('#book-description').fill('Kapağı PDF dosyasından çıkarıldı.');
  const once = bulut.github.head();
  await page.locator('dialog[open]').getByRole('button', { name: 'Kaydet ve yayınla' }).click();
  await expect.poll(() => bulut.github.head(), { timeout: 30_000 }).not.toBe(once);
  const kayit = depoKitaplari().find((kitap) => kitap.id === 'bulut-pdf-kitabi')!;
  expect(kayit.back_cover.local_path).toMatch(/^public\/uploads\/.+\.jpg$/);
  expect(kayit.back_cover.webp_path).toMatch(/^public\/uploads\/.+\.webp$/);
  expect(bulut.github.fileBytes(kayit.back_cover.webp_path)).not.toBeNull();
  expect(bulut.github.fileBytes(kayit.back_cover.local_path)).not.toBeNull();
  bulut.github.setRuns(bulut.github.head(), [{ name: "Pages'e yayınla", status: 'completed', conclusion: 'success' }]);   // sonraki test temiz başlasın
  await expect(page.locator('[data-publish-bar]')).toContainText('Yayında', { timeout: 30_000 });
});

test('taslak kayıt GitHub\'a gitmez; arada başkası aynı dosyayı değiştirirse yayın çubuğu çakışmayı söyler ve "Geri al" temizler', async ({ page }) => {
  await giris(page);
  await page.getByRole('button', { name: /Yeni kitap/ }).click();
  await page.locator('dialog[open] input[name="title"]').fill('Çakışma Kitabı');
  await page.locator('dialog[open] input[name="authors"]').fill('Çakışma Yazarı');
  await page.locator('#book-description').fill('Henüz kapağı yok.');
  const once = bulut.github.head();
  await page.locator('dialog[open]').getByRole('button', { name: 'Taslak olarak kaydet' }).click();
  await expect(page.locator('.book-card', { hasText: 'Çakışma Kitabı' })).toBeVisible();
  expect(bulut.github.head(), 'kayıt GitHub\'a commit atmaz').toBe(once);
  await expect(page.locator('[data-publish-bar]')).toContainText('Yayınlanmayı bekleyen');
  const kitaplar = depoKitaplari();
  kitaplar[0].title = 'Başkası değiştirdi';
  bulut.github.pushExternal({ 'data/catalog/books.json': JSON.stringify(kitaplar, null, 2) + '\n' });
  bulut.ilerlet(5 * 60 * 1000);
  await page.reload();
  await expect(page.locator('[data-publish-bar]')).toContainText('içerik başka yerden değişmiş');
  await page.getByRole('button', { name: 'Geri al' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Evet, geri al' }).click();
  await expect(page.locator('[data-publish-bar]')).toContainText('Site güncel');
  await expect(page.locator('.book-card', { hasText: 'Çakışma Kitabı' })).toHaveCount(0);
  await expect(page.locator('.book-card', { hasText: 'Başkası değiştirdi' })).toBeVisible();
});

test('oturum çıkışı: "Oturumu kapat" giriş ekranına döner; çıkıştan sonra API oturumsuz 401 verir', async ({ page }) => {
  await giris(page);
  await page.getByRole('button', { name: 'Oturumu kapat' }).click();
  await expect(page.getByLabel('Kullanıcı adı')).toBeVisible();
  expect(await page.evaluate(async () => (await fetch('/api/admin/content')).status)).toBe(401);
  await page.reload();
  await expect(page.getByLabel('Kullanıcı adı')).toBeVisible();
});
