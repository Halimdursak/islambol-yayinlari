// Ön / arka kapak (ADR-019): arka kapağı olan kitapta seçici vardır, yüzler yer değiştirirken sayfa düzeni oynamaz;
// arka kapağı olmayan kitapta seçici yoktur. Resmî iç sayfalı önizleme (Son Halifenin Dramı) açılır.
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { DIST, KOK } from '../yardimci/dist';
import { kitaplar } from '../yardimci/veri';
import { yatayTasma } from '../yardimci/sayfa';

type ArkaKapakli = ReturnType<typeof kitaplar>[number] & { status?: string; back_cover?: { local_path: string; webp_path?: string; width: number; height: number } };

const yayinda = (): ArkaKapakli[] => (kitaplar() as ArkaKapakli[]).filter((k) => k.status !== 'draft');
const html = (id: string): string => readFileSync(`${DIST}/kitap/${id}/index.html`, 'utf8');

test('veri ↔ sayfa: arka kapağı olan her kitapta seçici ve var olan görsel; olmayanda seçici yok', () => {
  const sorunlar: string[] = [];
  for (const k of yayinda()) {
    const h = html(k.id);
    const seciciVar = h.includes('data-kapak-secici');
    if (!k.back_cover) { if (seciciVar) sorunlar.push(`${k.id}: arka kapak yok ama seçici var`); continue; }
    if (!seciciVar) sorunlar.push(`${k.id}: arka kapak var ama seçici yok`);
    for (const yol of [k.back_cover.local_path, k.back_cover.webp_path].filter(Boolean) as string[]) {
      if (!existsSync(`${KOK}/${yol}`)) sorunlar.push(`${k.id}: dosya yok ${yol}`);
      if (!existsSync(`${DIST}/${yol.replace(/^public\//, '')}`)) sorunlar.push(`${k.id}: dist'te yok ${yol}`);
    }
    if (!h.includes(`alt="${k.title.replace(/'/g, '&#39;')} arka kapağı"`) && !h.includes(' arka kapağı"')) sorunlar.push(`${k.id}: arka kapak alt metni yok`);
  }
  expect(sorunlar).toEqual([]);
  expect(yayinda().filter((k) => k.back_cover).length, 'arka kapaklı kitap sayısı').toBeGreaterThanOrEqual(20);
});

test('seçici: arka kapağa geçince yüz değişir, düğme durumu ve büyüt bağlantısı güncellenir, yükseklik oynamaz', async ({ page }) => {
  await page.goto('/kitap/haim-nahum/');
  const secici = page.locator('[data-kapak-secici]');
  await expect(secici).toBeVisible();
  const on = page.locator('[data-kapak-yuzu="on"]');
  const arka = page.locator('[data-kapak-yuzu="arka"]');
  const sahne = page.locator('.kitap-detay__kapak');
  await expect(on).toBeVisible();
  await expect(arka).toBeHidden();
  await expect(page.locator('[data-buyut]')).toBeHidden();
  const yuksekOnce = (await sahne.boundingBox())!.height;

  await page.getByRole('button', { name: 'Arka kapak' }).click();
  await expect(arka).toBeVisible();
  await expect(on).toBeHidden();
  await expect(page.getByRole('button', { name: 'Arka kapak' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Ön kapak' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-buyut]')).toBeVisible();
  await expect(page.locator('[data-buyut]')).toHaveAttribute('href', /\/kapaklar-arka\/haim-nahum\.jpg$/);
  const yuksekSonra = (await sahne.boundingBox())!.height;
  expect(Math.abs(yuksekSonra - yuksekOnce), 'yüz değişince sahne yüksekliği').toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: 'Ön kapak' }).click();
  await expect(on).toBeVisible();
  await expect(arka).toBeHidden();
  const olcum = await yatayTasma(page);
  expect(olcum.scrollWidth).toBeLessThanOrEqual(olcum.innerWidth);
});

test('arka kapak görseli gerçekten yüklenir (kırık görsel yok)', async ({ page }) => {
  await page.goto('/kitap/devlet-i-osmaniye-ve-siyonistler/');
  await page.getByRole('button', { name: 'Arka kapak' }).click();
  const img = page.locator('[data-kapak-yuzu="arka"] img');
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(300);
});

test('Son Halifenin Dramı: yayınevi iç sayfalarından 10 sayfalık önizleme açılır', async ({ page }) => {
  await page.goto('/kitap/son-halifenin-drami/');
  await page.locator('button[data-onizleme]').click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  await expect(page.locator('[data-onizleme-sayac]')).toHaveText('1 / 10');
  const kaynaklar = await page.evaluate(() => {
    const sablon = document.querySelector('template[data-onizleme-kitap="son-halifenin-drami"]') as HTMLTemplateElement | null;
    return [...(sablon?.content.querySelectorAll('li') ?? [])].map((li) => (li as HTMLElement).dataset.src ?? '');
  });
  expect(kaynaklar).toHaveLength(10);
  expect(kaynaklar.every((s) => /^\/uploads\/son-halifenin-drami-onizleme-\d{2}\.jpg$/.test(s))).toBe(true);
});
