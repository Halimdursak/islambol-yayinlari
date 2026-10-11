import { expect, test } from '@playwright/test';
import { distSayfalari, htmlOku } from '../yardimci/dist';

const sayfalar = distSayfalari();

interface LdDugum {
  '@type'?: string | string[];
  '@graph'?: LdDugum[];
}

function ldTurleri(dugum: LdDugum): string[] {
  const t = dugum['@type'];
  const kendi = Array.isArray(t) ? t : t ? [t] : [];
  const alt = (dugum['@graph'] ?? []).flatMap(ldTurleri);
  return [...kendi, ...alt];
}

for (const { url, dosya } of sayfalar) {
  test(`SEO etiketleri: ${url}`, () => {
    const html = htmlOku(dosya);

    const canonical = [...html.matchAll(/<link\b[^>]*\brel="canonical"[^>]*>/gi)];
    const aciklama = [...html.matchAll(/<meta\b[^>]*\bname="description"[^>]*>/gi)];
    expect(canonical, 'canonical sayısı').toHaveLength(1);
    expect(aciklama, 'description sayısı').toHaveLength(1);
    expect(aciklama[0][0], 'description içeriği dolu').toMatch(/content="[^"]{20,}"/);

    // Kendine işaret eden canonical (yol karşılaştırması; alt dizin öneki düşülür)
    const href = canonical[0][0].match(/href="([^"]+)"/)?.[1] ?? '';
    const yol = new URL(href).pathname.replace(/^\/islambol-yayinlari(?=\/)/, '');
    expect(yol, 'canonical yolu sayfa yoluyla aynı').toBe(url);

    const bloklar = [...html.matchAll(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    expect(bloklar.length, 'JSON-LD blok sayısı').toBeGreaterThanOrEqual(1);
    const turler: string[] = [];
    for (const blok of bloklar) {
      const veri = JSON.parse(blok) as LdDugum;
      turler.push(...ldTurleri(veri));
    }
    if (url.startsWith('/kitap/')) expect(turler, 'kitap sayfasında Book').toContain('Book');
  });
}

test.describe('sitemap.xml ve robots.txt', () => {
  test('sitemap.xml geçerli XML ve urlset', async ({ page, request }) => {
    const yanit = await request.get('/sitemap.xml');
    expect(yanit.status()).toBe(200);
    const govde = await yanit.text();
    await page.goto('/');
    const ozet = await page.evaluate((xml) => {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      return {
        hata: doc.getElementsByTagName('parsererror').length,
        kok: doc.documentElement.localName,
        url: doc.getElementsByTagName('url').length,
        loc: doc.getElementsByTagName('loc').length,
      };
    }, govde);
    expect(ozet.hata).toBe(0);
    expect(ozet.kok).toBe('urlset');
    expect(ozet.url).toBeGreaterThan(0);
    expect(ozet.loc).toBe(ozet.url);
  });

  test('robots.txt 200 ve sitemap satırı içerir', async ({ request }) => {
    const yanit = await request.get('/robots.txt');
    expect(yanit.status()).toBe(200);
    expect(await yanit.text()).toMatch(/^Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/im);
  });
});
