import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { KOK } from './dist';
import { sonunaKaydir } from './sayfa';

export const SAYFALAR: ReadonlyArray<{ ad: string; url: string }> = [
  { ad: 'ana-sayfa', url: '/' },
  { ad: 'kitaplar', url: '/kitaplar/' },
  { ad: 'kitap-sen-neden-kor-edildin', url: '/kitap/sen-neden-kor-edildin/' },
  { ad: 'kitap-hayat-ve-hatiratim', url: '/kitap/hayat-ve-hatiratim/' },
  { ad: 'yazarlar', url: '/yazarlar/' },
  { ad: 'yazar-cevat-rifat-atilhan', url: '/yazar/cevat-rifat-atilhan/' },
  { ad: 'diziler', url: '/diziler/' },
  { ad: 'hakkimizda', url: '/hakkimizda/' },
  { ad: 'nereden-alinir', url: '/nereden-alinir/' },
  { ad: 'iletisim', url: '/iletisim/' },
  { ad: '404', url: '/404.html' },
];

export const EKRAN = join(KOK, 'docs', 'qa', 'screenshots');
const VERI = join(KOK, 'test-results', 'qa-veri');

export function klasor(...parcalar: string[]): string {
  const yol = join(...parcalar);
  mkdirSync(yol, { recursive: true });
  return yol;
}

/** Sayfayı açar, tembel görselleri tetikler, yazı tiplerinin yüklenmesini bekler. */
export async function hazirla(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await sonunaKaydir(page);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Ölçümü rapor tablosu için diske yazar (paralel koşuya güvenli: test başına bir dosya). */
export function tasmaKaydet(
  genislik: number,
  ad: string,
  tema: string,
  olcum: { scrollWidth: number; innerWidth: number },
): void {
  writeFileSync(
    join(klasor(VERI), `tasma-${tema}-${genislik}-${ad}.json`),
    JSON.stringify({ genislik, ad, tema, ...olcum, tasiyor: olcum.scrollWidth > olcum.innerWidth }),
    'utf8',
  );
}
