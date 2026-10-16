import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DIST, distSayfalari } from '../yardimci/dist';
import { kirikGorseller, konsolToplayici, sonunaKaydir } from '../yardimci/sayfa';
import { kitaplar, onizlemeliIdler, ornekKitaplar, yazarlar } from '../yardimci/veri';

// WhatsApp numarası tek kaynaktan (data/site/site.json); yönetim panelinden değişince testler de izler.
const WA = (JSON.parse(readFileSync(join(process.cwd(), 'data/site/site.json'), 'utf8')) as { whatsapp_url: string }).whatsapp_url.replace(/^https?:\/\//, '');
const FIYAT = /\d+\s*TL\b/i;
const normal = (s: string): string => (s.replace(/\s+/g, ' ').trim()).replace(/[’‘]/g, "'").replace(/…/g, "...");

test.describe('JSON ile sayfa eşleşmesi', () => {
  test('her kitap kaydının sayfası var ve fazladan kitap sayfası yok', () => {
    const idler = kitaplar().map((k) => k.id);
    const eksik = idler.filter((id) => !existsSync(join(DIST, 'kitap', id, 'index.html')));
    const dist = distSayfalari()
      .filter((s) => s.url.startsWith('/kitap/'))
      .map((s) => s.url.split('/')[2]);
    const fazla = dist.filter((id) => !idler.includes(id));
    expect({ eksik, fazla }).toEqual({ eksik: [], fazla: [] });
    expect(dist).toHaveLength(idler.length);
  });

  test('her yazar kaydının sayfası var', () => {
    const eksik = yazarlar()
      .map((y) => y.slug)
      .filter((slug) => !existsSync(join(DIST, 'yazar', slug, 'index.html')));
    expect(eksik).toEqual([]);
  });
});

const onizlemeli = new Set(onizlemeliIdler());

for (const kitap of ornekKitaplar()) {
  test(`kitap sayfası: ${kitap.id}`, async ({ page }) => {
    const kayit = konsolToplayici(page);
    const yanit = await page.goto(`/kitap/${kitap.id}/`);
    expect(yanit?.status()).toBe(200);

    // H1 = başlık
    const h1 = normal(await page.locator('h1').innerText());
    expect(h1).toBe(normal(kitap.title));

    // Yazar bağlantısı
    const yazarBaglantilari = page.locator('.kitap-detay__yazar a');
    if (kitap.authors.length > 0) {
      await expect(yazarBaglantilari.first()).toBeVisible();
      await expect(yazarBaglantilari.first()).toHaveAttribute('href', /\/yazar\/[^/]+\/$/);
    } else {
      await expect(yazarBaglantilari).toHaveCount(0);
    }

    // Kapak yüklü
    const kapak = page.locator('.kitap-detay__kapak img');
    await expect(kapak).toBeVisible();
    await expect
      .poll(() => kapak.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
      .toBe(true);

    // Nereden alınır: WhatsApp + dolu kitapçı bağlantıları
    const siparis = page.locator('.siparis');
    await expect(siparis).toBeVisible();
    await expect(siparis.locator(`a[href*="${WA}"]`)).toHaveCount(1);
    const dolu = [kitap.sources.kitapyurdu, kitap.sources.nobelkitap, kitap.sources.kureselkitap].filter(
      (u): u is string => Boolean(u),
    );
    for (const url of dolu) {
      await expect(siparis.locator(`a[href="${url}"]`), `kitapçı bağlantısı ${url}`).toHaveCount(1);
    }
    // Boş kaynak için bağlantı üretilmemeli
    const kitapciSayisi = await siparis.locator('a[href^="http"]:not([href*="wa.me"])').count();
    expect(kitapciSayisi).toBe(dolu.length);

    // Fiyat yok
    const metin = await page.locator('body').innerText();
    expect(metin.match(FIYAT), 'sayfa metninde fiyat').toBeNull();

    // Önizleme tetikleyicisi
    const tetik = page.locator('[data-onizleme]');
    if (onizlemeli.has(kitap.id)) expect(await tetik.count()).toBeGreaterThan(0);
    else await expect(tetik).toHaveCount(0);

    await sonunaKaydir(page);
    expect(await kirikGorseller(page)).toEqual([]);
    expect(kayit).toEqual([]);
  });
}

test('hiçbir kitap sayfasının görünür HTML metninde fiyat deseni yok (78 sayfa)', () => {
  const ihlal: string[] = [];
  for (const s of distSayfalari().filter((x) => x.url.startsWith('/kitap/'))) {
    const html = readFileSync(s.dosya, 'utf8');
    const govde = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<template[\s\S]*?<\/template>/g, ' ');
    const m = govde.replace(/<[^>]+>/g, ' ').match(FIYAT);
    if (m) ihlal.push(`${s.url} -> "${m[0]}"`);
  }
  expect(ihlal, 'fiyat içeren kitap sayfaları').toEqual([]);
});
