// Liste fiyatı (ADR-018): yalnızca veride (price_list_try) varsa, tek biçimde ("1.200 ₺"), yalnızca [data-fiyat] öğelerinde görünür.
// Kampanya/indirim metni sızmaz (kitap.spec.ts "TL" desenini ayrıca denetler); JSON-LD'de offers yoktur (scripts/seo/dogrula.mjs).
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { distSayfalari, DIST } from '../yardimci/dist';
import { kitaplar } from '../yardimci/veri';

type FiyatliKitap = ReturnType<typeof kitaplar>[number] & { price_list_try?: number | null; status?: string };

const bicim = (n: number): string => `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;
const liste = (): FiyatliKitap[] => (kitaplar() as FiyatliKitap[]).filter((k) => k.status !== 'draft');
const html = (yol: string): string => readFileSync(`${DIST}/${yol}/index.html`, 'utf8');
const gorunenMetin = (h: string): string => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<template[\s\S]*?<\/template>|<noscript[\s\S]*?<\/noscript>/g, ' ').replace(/<[^>]+>/g, ' ');

test('kitap sayfası: liste fiyatı veriyle birebir aynı; fiyatı olmayan kitapta fiyat öğesi yok', () => {
  const sorunlar: string[] = [];
  for (const k of liste()) {
    const h = html(`kitap/${k.id}`);
    const blok = h.match(/<p class="kitap-detay__fiyat" data-fiyat>([\s\S]*?)<\/p>/);
    const fiyat = k.price_list_try ?? null;
    if (fiyat === null) {
      if (blok) sorunlar.push(`${k.id}: veride fiyat yok ama sayfada var`);
      continue;
    }
    if (!blok) { sorunlar.push(`${k.id}: veride ${fiyat} var ama sayfada fiyat yok`); continue; }
    if (!blok[1].includes(`>${bicim(fiyat)}<`)) sorunlar.push(`${k.id}: sayfa "${blok[1].replace(/<[^>]+>/g, ' ').trim().slice(0, 60)}" ≠ ${bicim(fiyat)}`);
  }
  expect(sorunlar).toEqual([]);
});

test('"₺" işareti yalnızca [data-fiyat] öğelerinde geçer (açıklama/kampanya metninde sızıntı yok)', () => {
  const ihlal: string[] = [];
  for (const s of distSayfalari()) {
    const h = readFileSync(s.dosya, 'utf8');
    const fiyatsiz = h.replace(/<p class="kitap-(?:detay|karti)__fiyat"[^>]*data-fiyat>[\s\S]*?<\/p>/g, ' ');
    if (gorunenMetin(fiyatsiz).includes('₺')) ihlal.push(s.url);
  }
  expect(ihlal, '₺ içeren sayfa (fiyat dışı yerde)').toEqual([]);
});

test('katalog: fiyatı olan her kitabın kartında fiyat var, diğerlerinde yok', () => {
  const h = html('kitaplar');
  const beklenen = liste().filter((k) => (k.price_list_try ?? null) !== null).length;
  const kartFiyati = (h.match(/class="kitap-karti__fiyat"/g) ?? []).length;
  expect(kartFiyati).toBe(beklenen);
  expect(beklenen, 'katalogda hiç fiyat yok: veri bağlanmamış olabilir').toBeGreaterThan(40);
});

test('JSON-LD Book.offers yok (fiyat yalnızca görünür metindir)', () => {
  const ihlal: string[] = [];
  for (const k of liste()) if (/"offers"\s*:/.test(html(`kitap/${k.id}`))) ihlal.push(k.id);
  expect(ihlal).toEqual([]);
});
