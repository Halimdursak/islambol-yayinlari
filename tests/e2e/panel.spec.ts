// Yönetim paneli (ADR-020): kullanıcı adı + şifre girişi, Kitaplık, resim/PDF'ten yeni kitap, taslak, gizle/göster, sil, Yayınla çubuğu, hesap.
// Gerçek CMS sunucusu tek kullanımlık klasörde çalışır; "Yayınla" sahtedir (git'e ve internete dokunmaz).
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { kapakPdf, kapakPng, KULLANICI, panelBaslat, SIFRE, sahteYayin } from '../yardimci/panel';
import { yatayTasma } from '../yardimci/sayfa';

test.describe.configure({ mode: 'serial' });

let sunucu: Awaited<ReturnType<typeof panelBaslat>>;
const yayin = sahteYayin();
const gecici = mkdtempSync(join(tmpdir(), 'islambol-panel-dosya-'));

test.beforeAll(async () => { sunucu = await panelBaslat(yayin); });
test.afterAll(async () => { await sunucu.kapat(); });

const kitaplar = (): Array<Record<string, any>> => JSON.parse(readFileSync(join(sunucu.kok, 'data/catalog/books.json'), 'utf8'));

async function giris(page: Page): Promise<void> {
  await page.goto(`${sunucu.adres}/yonetim/`);
  await page.getByLabel('Kullanıcı adı').fill(KULLANICI);
  await page.getByLabel('Şifre', { exact: true }).fill(SIFRE);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('heading', { name: 'Kitaplar', level: 1, exact: true })).toBeVisible();
}

/** Dar ekranda yan menü "Menü" düğmesinin arkasındadır. */
async function menuAc(page: Page): Promise<void> {
  const dugme = page.locator('.menu-toggle');
  if (await dugme.isVisible()) await dugme.click();
}

async function yeniKitapAc(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Yeni kitap/ }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
}

test('giriş kullanıcı adı ve şifre ister; yanlış bilgi sade hata verir, doğrusu Kitaplık\'ı açar', async ({ page }) => {
  await page.goto(`${sunucu.adres}/yonetim/`);
  await expect(page.getByLabel('Kullanıcı adı')).toBeVisible();
  await page.getByLabel('Kullanıcı adı').fill('baska');
  await page.getByLabel('Şifre', { exact: true }).fill(SIFRE);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('alert')).toContainText('Kullanıcı adı veya şifre yanlış');
  await page.getByLabel('Kullanıcı adı').fill(KULLANICI.toUpperCase());      // büyük/küçük harf fark etmez
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('heading', { name: 'Kitaplar', level: 1, exact: true })).toBeVisible();
  const olcum = await yatayTasma(page);
  expect(olcum.scrollWidth).toBeLessThanOrEqual(olcum.innerWidth);
});

test('Kitaplık: kapaklı kitap kartı, "Yeni kitap" kartı ve "Site güncel" çubuğu görünür', async ({ page }) => {
  await giris(page);
  await expect(page.locator('.book-card', { hasText: 'İlk Kitap' }).locator('img')).toBeVisible();
  await expect(page.getByRole('button', { name: /Yeni kitap/ })).toBeVisible();
  await expect(page.locator('[data-publish-bar]')).toContainText('Site güncel');
  await expect(page.getByRole('button', { name: 'Yayınla', exact: true })).toBeDisabled();
  await menuAc(page);
  await expect(page.getByRole('button', { name: 'Hesap (yayinevi)' })).toBeVisible();
  const olcum = await yatayTasma(page);
  expect(olcum.scrollWidth).toBeLessThanOrEqual(olcum.innerWidth);
});

test('yeni kitap: resim + ad + yazar + açıklama + fiyat → "Kaydet ve yayınla" kartı ekler ve yayını başlatır', async ({ page }) => {
  await giris(page);
  const resim = join(gecici, 'kapak.png');
  await kapakPng(resim, '#2b5fa8', 600, 900);
  await yeniKitapAc(page);
  await expect(page.locator('.guide')).toContainText('Açıklamaya ne yazmalı?');
  await page.locator('[data-cover-file]').setInputFiles(resim);
  await expect(page.locator('[data-cover-status]')).toContainText('Kapak yüklendi');
  await expect(page.locator('[data-mockup-card] img')).toBeVisible();                      // kitap şeklinde görsel
  await expect(page.locator('[data-mockup-card] a[download]')).toHaveAttribute('download', /-kitap-gorseli\.png$/);
  const tasma = await page.locator('dialog[open]').evaluate((d) => ({ kaydirma: d.scrollWidth, gorunen: d.clientWidth }));
  expect(tasma.kaydirma, 'kitap formu yatay taşmamalı').toBeLessThanOrEqual(tasma.gorunen);
  await page.locator('dialog[open] input[name="title"]').fill('Deneme Kitabı');
  await expect(page.locator('dialog[open] input[name="id"]')).toHaveValue('deneme-kitabi');
  await page.locator('dialog[open] input[name="authors"]').fill('Deneme Yazarı');
  await page.locator('#book-description').fill('Bu kitap, panelden eklenen deneme kaydıdır. Konusu kısaca anlatılır.');
  await page.locator('dialog[open] input[name="price_list_try"]').fill('325');
  await page.getByRole('checkbox', { name: 'Tarih' }).check();
  const once = yayin.calls.start;
  await page.locator('dialog[open]').getByRole('button', { name: 'Kaydet ve yayınla' }).click();
  await expect(page.locator('.book-card', { hasText: 'Deneme Kitabı' })).toBeVisible();
  await expect(page.locator('[data-publish-bar]')).toContainText(/Yayınlan|GitHub|Yayında/);
  expect(yayin.calls.start).toBe(once + 1);
  const kayit = kitaplar().find((k) => k.id === 'deneme-kitabi')!;
  expect(kayit.title).toBe('Deneme Kitabı');
  expect(kayit.authors).toEqual(['Deneme Yazarı']);
  expect(kayit.price_list_try).toBe(325);
  expect(kayit.status).toBe('published');
  expect(kayit.categories).toContain('Tarih');
  expect(kayit.cover.local_path).toMatch(/^public\/uploads\/.+\.png$/);
  expect(existsSync(join(sunucu.kok, kayit.cover.local_path))).toBe(true);
  expect(kayit.publish_date).toMatch(/^\d{4}-\d{2}$/);
});

test('kapaksız kitap "Kaydet ve yayınla" ile kaydedilmez ve nedenini söyler; taslak olarak kaydedilir ve gizli görünür', async ({ page }) => {
  await giris(page);
  await yeniKitapAc(page);
  await page.locator('dialog[open] input[name="title"]').fill('Taslak Kitap');
  await page.locator('dialog[open] input[name="authors"]').fill('Taslak Yazar');
  await page.locator('#book-description').fill('Henüz kapağı yok.');
  const once = yayin.calls.start;
  await page.locator('dialog[open]').getByRole('button', { name: 'Kaydet ve yayınla' }).click();
  await expect(page.locator('dialog[open] [data-form-error]')).toContainText('kapak resmi gerekli');
  await page.locator('dialog[open]').getByRole('button', { name: 'Taslak olarak kaydet' }).click();
  const kart = page.locator('.book-card', { hasText: 'Taslak Kitap' });
  await expect(kart).toBeVisible();
  await expect(kart).toContainText('Sitede gizli');
  expect(yayin.calls.start).toBe(once);
  expect(kitaplar().find((k) => k.id === 'taslak-kitap')?.status).toBe('draft');
});

test('metin kutusunda Enter tuşu eksik kitabı sessizce taslak kaydetmez', async ({ page }) => {
  await giris(page);
  await yeniKitapAc(page);
  await page.locator('dialog[open] input[name="title"]').fill('Enter Denemesi');
  await page.locator('dialog[open] input[name="title"]').press('Enter');
  await expect(page.locator('dialog[open]')).toBeVisible();                     // zorunlu alanlar boş: form gönderilmedi
  expect(kitaplar().some((k) => k.id === 'enter-denemesi')).toBe(false);
});

test('kart menüsü: sitede göster / gizle ve silme onayı', async ({ page }) => {
  await giris(page);
  const kart = page.locator('.book-card', { hasText: 'Taslak Kitap' });
  await kart.locator('summary').click();
  await kart.getByRole('button', { name: 'Sitede göster' }).click();
  await expect(kart).not.toContainText('Sitede gizli');
  expect(kitaplar().find((k) => k.id === 'taslak-kitap')?.status).toBe('published');
  await kart.locator('summary').click();
  await kart.getByRole('button', { name: /Sil/ }).click();
  await expect(page.locator('dialog[open]')).toContainText('silinsin mi');
  await page.locator('dialog[open]').getByRole('button', { name: 'Evet, sil' }).click();
  await expect(page.locator('.book-card', { hasText: 'Taslak Kitap' })).toHaveCount(0);
  expect(kitaplar().some((k) => k.id === 'taslak-kitap')).toBe(false);
});

test('baskı PDF\'i: ön ve arka kapak kendiliğinden ayrılır, yüklenir ve kitaba kaydedilir', async ({ page }) => {
  await giris(page);
  const pdf = join(gecici, 'baski.pdf');
  writeFileSync(pdf, kapakPdf());
  await yeniKitapAc(page);
  await page.locator('[data-cover-file]').setInputFiles(pdf);
  await expect(page.locator('[data-cover-status]')).toContainText('Ön ve arka kapak hazır', { timeout: 60_000 });
  await expect(page.locator('.extra-card img[alt="Arka kapak"]')).toBeVisible();
  await expect(page.locator('.dropzone-image')).toBeVisible();
  await page.locator('dialog[open] input[name="title"]').fill('PDF Kitabı');
  await page.locator('dialog[open] input[name="authors"]').fill('PDF Yazarı');
  await page.locator('#book-description').fill('Kapağı PDF dosyasından çıkarıldı.');
  await page.locator('dialog[open]').getByRole('button', { name: 'Kaydet ve yayınla' }).click();
  await expect(page.locator('.book-card', { hasText: 'PDF Kitabı' })).toBeVisible();
  const kayit = kitaplar().find((k) => k.id === 'pdf-kitabi')!;
  expect(kayit.back_cover.local_path).toMatch(/^public\/uploads\/.+\.jpg$/);
  expect(kayit.back_cover.webp_path).toMatch(/^public\/uploads\/.+\.webp$/);
  expect(existsSync(join(sunucu.kok, kayit.back_cover.webp_path))).toBe(true);
  expect(kayit.cover.width).toBeGreaterThan(500);
  // ön kapak mavi panel, boyut oranı kitap oranına yakın (13,5 × 19,5 ≈ 0,69)
  expect(kayit.cover.width / kayit.cover.height).toBeGreaterThan(0.6);
  expect(kayit.cover.width / kayit.cover.height).toBeLessThan(0.8);
});

test('yayın çubuğu: bekleyen değişiklik görünür, Yayınla ilerlemeyi gösterir ve "Yayında" ile biter; Geri al onay ister', async ({ page }) => {
  await expect.poll(() => yayin.durum.running).toBe(false);          // önceki testin sahte yayını bitsin
  yayin.durum.pending = true;
  yayin.durum.files = 2;
  yayin.durum.text = '2 yeni kitap';
  yayin.durum.job = { phase: 'idle', message: '' };
  await giris(page);
  await expect(page.locator('[data-publish-bar]')).toContainText('2 yeni kitap');
  await menuAc(page);
  await page.getByRole('button', { name: 'Site ayarları' }).first().click();
  await expect(page.getByRole('heading', { name: 'Site ayarları', level: 1, exact: true })).toBeVisible();
  await expect(page.locator('[data-publish-bar]')).toContainText('2 yeni kitap');            // sayfa değişince çubuk metni kaybolmamalı
  await expect(page.locator('[data-publish-bar]')).toContainText('Henüz internetteki sitede görünmüyor');
  const once = yayin.calls.start;
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.locator('[data-publish-bar]')).toContainText('GitHub');
  await expect(page.locator('[data-publish-bar]')).toContainText('Yayında', { timeout: 15_000 });
  expect(yayin.calls.start).toBe(once + 1);
  yayin.durum.pending = true;
  yayin.durum.files = 1;
  yayin.durum.job = { phase: 'idle', message: '' };
  await page.reload();
  await page.getByRole('button', { name: 'Geri al' }).click();
  await expect(page.locator('dialog[open]')).toContainText('geri alınsın mı');
  await page.locator('dialog[open]').getByRole('button', { name: 'Evet, geri al' }).click();
  await expect(page.locator('[data-publish-bar]')).toContainText('Site güncel');
  expect(yayin.calls.discard).toBe(1);
});

test('bu bilgisayarda başka (panelle ilgisiz) gönderilmemiş değişiklik varsa Yayınla önce onay ister', async ({ page }) => {
  await expect.poll(() => yayin.durum.running).toBe(false);
  yayin.durum.pending = true;
  yayin.durum.text = '1 yeni kitap';
  yayin.durum.job = { phase: 'idle', message: '' };
  yayin.durum.foreign = ['feat: reklam videosu kaynağı'];
  yayin.durum.foreignCount = 1;
  await giris(page);
  await expect(page.locator('[data-publish-bar]')).toContainText('panelle ilgisiz 1 gönderilmemiş değişiklik');
  const once = yayin.calls.start;
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await expect(page.locator('dialog[open]')).toContainText('feat: reklam videosu kaynağı');
  await page.locator('dialog[open]').getByRole('button', { name: 'Vazgeç' }).click();
  expect(yayin.calls.start).toBe(once);                                         // onaysız hiçbir şey gönderilmez
  await page.getByRole('button', { name: 'Yayınla', exact: true }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Evet, hepsini yayınla' }).click();
  await expect(page.locator('[data-publish-bar]')).toContainText('Yayında', { timeout: 15_000 });
  expect(yayin.calls.start).toBe(once + 1);
  yayin.durum.foreign = [];
  yayin.durum.foreignCount = 0;
});

test('yayınlama kurulu değilse çubuk bunu açıkça söyler ve panel çalışmaya devam eder', async ({ page }) => {
  yayin.durum.configured = false;
  yayin.durum.reason = 'Bu klasör bir git deposu değil.';
  await giris(page);
  await expect(page.locator('[data-publish-bar]')).toContainText('kurulu değil');
  await expect(page.getByRole('button', { name: 'Yayınla', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Yeni kitap/ })).toBeVisible();
  yayin.durum.configured = true;
});

test('hesap: kullanıcı adı değiştirilir, yeni adla girilir', async ({ page }) => {
  await giris(page);
  await menuAc(page);
  await page.getByRole('button', { name: /^Hesap/ }).click();
  await page.getByLabel('Kullanıcı adı').fill('kutuphane');
  await page.getByLabel('Şu anki şifre').fill(SIFRE);
  await page.locator('dialog[open]').getByRole('button', { name: 'Kaydet' }).click();
  await menuAc(page);
  await expect(page.getByRole('button', { name: 'Hesap (kutuphane)' })).toBeVisible();
  await page.getByRole('button', { name: 'Oturumu kapat' }).click();
  await page.locator('#login-form input[name="username"]').fill('kutuphane');
  await page.locator('#login-form input[name="password"]').fill(SIFRE);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('heading', { name: 'Kitaplar', level: 1, exact: true })).toBeVisible();
});
