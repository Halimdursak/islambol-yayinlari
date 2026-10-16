import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DIST, distSayfalari, htmlOku, KOK } from '../yardimci/dist';

const sayfalar = distSayfalari();

/** Site içi hedef dist'te var mı? ("/a/b/" -> a/b/index.html, "/x.css" -> x.css) */
function hedefVarMi(yol: string): boolean {
  const temiz = decodeURIComponent(yol.split('#')[0].split('?')[0]);
  const rel = temiz.replace(/^\/+/, '');
  const aday = join(DIST, rel);
  if (existsSync(aday) && statSync(aday).isFile()) return true;
  return existsSync(join(aday, 'index.html'));
}

function nitelikler(html: string, etiket: string, nitelik: string): string[] {
  const sonuc: string[] = [];
  const re = new RegExp(`<${etiket}\\b[^>]*?\\s${nitelik}="([^"]*)"`, 'gi');
  for (const m of html.matchAll(re)) sonuc.push(m[1].replace(/&amp;/g, '&'));
  return sonuc;
}

const siteIci = (h: string): boolean => h.startsWith('/') && !h.startsWith('//');

test('iç bağlantıların (href) tamamı dist içinde karşılık bulur', () => {
  const kirik: string[] = [];
  let toplam = 0;
  for (const s of sayfalar) {
    const html = htmlOku(s.dosya);
    const hrefler = [...nitelikler(html, 'a', 'href'), ...nitelikler(html, 'link', 'href')].filter(siteIci);
    for (const h of hrefler) {
      toplam += 1;
      if (!hedefVarMi(h)) kirik.push(`${s.url} -> ${h}`);
    }
  }
  expect(toplam, 'denetlenen iç bağlantı sayısı').toBeGreaterThan(500);
  expect(kirik, `${kirik.length} kırık iç bağlantı`).toEqual([]);
});

test('iç kaynakların (img/script src, srcset) tamamı dist içinde karşılık bulur', () => {
  const kirik: string[] = [];
  for (const s of sayfalar) {
    const html = htmlOku(s.dosya);
    const srclar = [...nitelikler(html, 'img', 'src'), ...nitelikler(html, 'script', 'src'), ...nitelikler(html, 'source', 'src')];
    const srcsetler = [...nitelikler(html, 'img', 'srcset'), ...nitelikler(html, 'source', 'srcset')].flatMap((v) =>
      v.split(',').map((p) => p.trim().split(/\s+/)[0]),
    );
    for (const k of [...srclar, ...srcsetler].filter(siteIci)) {
      if (!hedefVarMi(k)) kirik.push(`${s.url} -> ${k}`);
    }
  }
  expect(kirik, `${kirik.length} kırık iç kaynak`).toEqual([]);
});

test('sayfa içi çapalar (#kimlik) aynı sayfada karşılık bulur', () => {
  const kirik: string[] = [];
  for (const s of sayfalar) {
    const html = htmlOku(s.dosya);
    const kimlikler = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const h of nitelikler(html, 'a', 'href').filter((x) => x.startsWith('#') && x.length > 1)) {
      if (!kimlikler.has(decodeURIComponent(h.slice(1)))) kirik.push(`${s.url} -> ${h}`);
    }
  }
  expect(kirik).toEqual([]);
});

test('dış bağlantılar: her alan adından birer örnek (HEAD) — doğrulanamayanlar raporlanır', async () => {
  test.setTimeout(120_000);
  const ornek = new Map<string, { url: string; sayfa: string }>();
  const toplamHedef = new Set<string>();
  for (const s of sayfalar) {
    for (const h of nitelikler(htmlOku(s.dosya), 'a', 'href').filter((x) => /^https?:\/\//.test(x))) {
      toplamHedef.add(h);
      const alan = new URL(h).hostname.replace(/^www\./, '');
      if (!ornek.has(alan)) ornek.set(alan, { url: h, sayfa: s.url });
    }
  }
  // Site kendi alan adı (canonical, özel alan adı ve eski GitHub Pages adresi) dış denetime girmez.
  ornek.delete('islambol.org');
  ornek.delete('halimdursak.github.io');
  ornek.delete('adursak63.github.io');

  type Sonuc = { alan: string; url: string; sayfa: string; durum: number | string; sonuc: 'ok' | 'dogrulanamadi' | 'kirik' };
  const sonuclar: Sonuc[] = [];
  for (const [alan, { url, sayfa }] of ornek) {
    let durum: number | string = 'ag-hatasi';
    try {
      const baslik = { 'user-agent': 'Mozilla/5.0 (QA-link-check)' };
      let r = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: baslik, signal: AbortSignal.timeout(12_000) });
      if (r.status === 405 || r.status === 501) r = await fetch(url, { method: 'GET', redirect: 'follow', headers: baslik, signal: AbortSignal.timeout(12_000) });
      durum = r.status;
    } catch (e) {
      durum = e instanceof Error ? e.name : 'ag-hatasi';
    }
    const sayi = typeof durum === 'number' ? durum : 0;
    const sonuc: Sonuc['sonuc'] = sayi >= 200 && sayi < 400 ? 'ok' : sayi === 404 || sayi === 410 ? 'kirik' : 'dogrulanamadi';
    sonuclar.push({ alan, url, sayfa, durum, sonuc });
  }

  mkdirSync(join(KOK, 'test-results'), { recursive: true });
  writeFileSync(
    join(KOK, 'test-results', 'dis-baglantilar.json'),
    JSON.stringify({ benzersizDisBaglanti: toplamHedef.size, sonuclar }, null, 2),
    'utf8',
  );
  for (const s of sonuclar.filter((x) => x.sonuc === 'dogrulanamadi')) {
    test.info().annotations.push({ type: 'doğrulanamadı', description: `${s.alan} (${s.durum}) ${s.url}` });
  }
  const kirik = sonuclar.filter((s) => s.sonuc === 'kirik');
  expect(kirik, 'HTTP 404/410 dönen dış bağlantılar').toEqual([]);
});
