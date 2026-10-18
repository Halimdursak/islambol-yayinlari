// Mobil sözleşmesi (ADR-017): gerçek telefon koşullarında taşma, büyük yazı, dokunma hedefi, yazı boyutu, yerleşim kayması,
// yatay önizleme ve kitap sayfası eylemleri. Kendi bağlamlarını açar; yalnız masaüstü projesinde koşar (playwright.config: mobil projesi yok sayar).
import { devices, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const SAYFALAR = [
  '/', '/kitaplar/', '/kitaplar/?kategori=tarih', '/kitap/sen-neden-kor-edildin/', '/kitap/hayat-ve-hatiratim/',
  '/yazarlar/', '/yazar/cevat-rifat-atilhan/', '/diziler/', '/hakkimizda/', '/nereden-alinir/', '/iletisim/', '/404.html',
];
// [genişlik, yazı ölçeği]: küçük telefon, yaygın Android ve iPhone; sistem yazı tipi %150–200
const KOSULLAR: Array<[number, number]> = [[320, 1], [320, 1.5], [360, 1], [360, 1.5], [390, 1], [390, 2], [412, 1]];

async function baglam(browser: Browser, secenek: Parameters<Browser['newContext']>[0] = {}): Promise<BrowserContext> {
  return browser.newContext({ locale: 'tr-TR', ...secenek });
}

async function ac(ctx: BrowserContext, yol: string, olcek = 1): Promise<Page> {
  const sayfa = await ctx.newPage();
  if (olcek !== 1) {
    await sayfa.addInitScript((o) => {
      document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${o * 100}%`; });
    }, olcek);
  }
  await sayfa.goto(yol, { waitUntil: 'networkidle' });
  return sayfa;
}

test.describe('mobil: yatay taşma yok (yazı ölçeği dahil)', () => {
  for (const [genislik, olcek] of KOSULLAR) {
    test(`${genislik}px · yazı %${Math.round(olcek * 100)}: ${SAYFALAR.length} sayfa taşmaz`, async ({ browser }) => {
      const ctx = await baglam(browser, { viewport: { width: genislik, height: 800 }, deviceScaleFactor: 2, hasTouch: true });
      const tasanlar: string[] = [];
      for (const yol of SAYFALAR) {
        const sayfa = await ac(ctx, yol, olcek);
        const m = await sayfa.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        if (m.sw > m.cw) tasanlar.push(`${yol} → ${m.sw}px > ${m.cw}px`);
        await sayfa.close();
      }
      await ctx.close();
      expect(tasanlar, 'Yatay taşan sayfa: dar telefonda sayfa küçülüp "kötü" görünür').toEqual([]);
    });
  }
});

test.describe('mobil: dokunma hedefleri ve yazı boyutu', () => {
  const telefon = devices['iPhone 13'];

  test('denetimler ve gezinme bağlantıları en az 44×44 px', async ({ browser }) => {
    const ctx = await baglam(browser, { ...telefon });
    const ihlaller: string[] = [];
    for (const yol of ['/', '/kitaplar/', '/kitap/sen-neden-kor-edildin/', '/yazarlar/', '/iletisim/']) {
      const sayfa = await ac(ctx, yol);
      const bulunan = await sayfa.evaluate(() => {
        const px = (v: string) => (v.endsWith('px') ? parseFloat(v) : 0);
        const ad = (e: Element) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''} "${((e as HTMLElement).innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24)}"`;
        const cikti: string[] = [];
        for (const e of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, summary, [role=button]')) {
          if (e.closest('.atla, .sr-only, [hidden], noscript')) continue;
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          if (!r.width || !r.height || s.visibility === 'hidden' || s.display === 'none') continue;
          // Paragraf içi bağlantı: WCAG 2.5.8 satır içi istisnası
          if (e.tagName === 'A' && s.display === 'inline' && e.closest('p, dd')) continue;
          // Tüm kartı kaplayan (::after) ya da genişletilmiş dokunma alanı: pseudo-eleman kutusu da sayılır
          const p = getComputedStyle(e, '::after');
          const pw = p.position === 'absolute' ? px(p.width) : 0;
          const ph = p.position === 'absolute' ? px(p.height) : 0;
          const w = Math.max(r.width, pw), h = Math.max(r.height, ph);
          if (Math.min(w, h) < 43.5) cikti.push(`${ad(e)} ${Math.round(w)}×${Math.round(h)}`);
        }
        return cikti;
      });
      for (const b of bulunan) ihlaller.push(`${yol}: ${b}`);
      await sayfa.close();
    }
    await ctx.close();
    expect(ihlaller).toEqual([]);
  });

  test('görünen hiçbir metin 13 px altında değil', async ({ browser }) => {
    const ctx = await baglam(browser, { ...telefon });
    const kucukler: string[] = [];
    for (const yol of SAYFALAR) {
      const sayfa = await ac(ctx, yol);
      const bulunan = await sayfa.evaluate(() => {
        const cikti = new Set<string>();
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) {
          const t = w.currentNode as Text;
          const e = t.parentElement;
          if (!e || !t.textContent?.trim() || e.closest('.sr-only, noscript, script, style, [hidden]')) continue;
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          if (!r.width || !r.height || s.visibility === 'hidden' || s.display === 'none') continue;
          if (parseFloat(s.fontSize) < 13) cikti.add(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${s.fontSize}`);
        }
        return [...cikti];
      });
      for (const b of bulunan) kucukler.push(`${yol}: ${b}`);
      await sayfa.close();
    }
    await ctx.close();
    expect(kucukler).toEqual([]);
  });
});

test.describe('mobil: yerleşim kayması (CLS) ve ilk ekran', () => {
  const telefon = devices['iPhone 13'];

  for (const yol of ['/', '/kitaplar/', '/kitap/sen-neden-kor-edildin/', '/yazarlar/']) {
    test(`${yol}: CLS < 0,05 (4× yavaş işlemci)`, async ({ browser }) => {
      const ctx = await baglam(browser, { ...telefon });
      const sayfa = await ctx.newPage();
      const cdp = await ctx.newCDPSession(sayfa);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await sayfa.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((liste) => {
          for (const e of liste.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await sayfa.goto(yol, { waitUntil: 'load' });
      await sayfa.waitForTimeout(3000);
      const cls = await sayfa.evaluate(() => (window as unknown as { __cls: number }).__cls);
      await ctx.close();
      expect(cls, `CLS ${cls.toFixed(3)}: süzgeç formu gecikmeli açılmamalı (ADR-017)`).toBeLessThan(0.05);
    });
  }

  test('kitap sayfasında sipariş düğmesi ilk ekranda (390×664)', async ({ browser }) => {
    const ctx = await baglam(browser, { ...telefon, viewport: { width: 390, height: 664 } });
    const sayfa = await ac(ctx, '/kitap/sen-neden-kor-edildin/');
    const kutu = await sayfa.locator('a.kitap-detay__hizli-siparis').boundingBox();
    await ctx.close();
    expect(kutu, 'düğme bulunamadı').not.toBeNull();
    expect(kutu!.y + kutu!.height).toBeLessThanOrEqual(664);
  });

  test('uzun listede "başa dön" düğmesi iki ekran sonra belirir ve işler', async ({ browser }) => {
    const ctx = await baglam(browser, { ...telefon });
    const sayfa = await ac(ctx, '/kitaplar/');
    const dugme = sayfa.locator('.basa-don');
    await expect(dugme).toBeHidden();
    await sayfa.evaluate(() => window.scrollTo({ top: 3000, behavior: 'instant' }));
    await expect(dugme).toBeVisible();
    await dugme.click();
    await expect.poll(() => sayfa.evaluate(() => window.scrollY)).toBeLessThan(50);
    await expect(dugme).toBeHidden();
    await ctx.close();
  });
});

test.describe('mobil: yatay telefon', () => {
  test('önizleme penceresi sayfaya ekranın yarısından fazlasını verir ve telif notu görünür', async ({ browser }) => {
    const ctx = await baglam(browser, { ...devices['iPhone 13 landscape'] });
    const sayfa = await ac(ctx, '/');
    const tetik = sayfa.locator('button.sekme[data-onizleme]').first();
    await tetik.scrollIntoViewIfNeeded();
    await tetik.tap();
    await sayfa.waitForSelector('dialog.onizleme[open]');
    await sayfa.waitForTimeout(1500);
    const olcu = await sayfa.evaluate(() => {
      const al = (s: string) => document.querySelector(s)?.getBoundingClientRect();
      const not = document.querySelector('.onizleme__not');
      return { sahne: al('.onizleme__sahne')?.height ?? 0, vh: innerHeight, notGorunur: !!not && getComputedStyle(not).display !== 'none' && (not.getBoundingClientRect().bottom <= innerHeight + 1) };
    });
    await ctx.close();
    expect(olcu.sahne / olcu.vh, `sahne ${olcu.sahne}px / ekran ${olcu.vh}px`).toBeGreaterThan(0.5);
    expect(olcu.notGorunur, 'telif notu (ADR-007) yatayda da görünür olmalı').toBe(true);
  });

  test('yatay telefonda katalog taşmaz', async ({ browser }) => {
    const ctx = await baglam(browser, { ...devices['iPhone 13 landscape'] });
    const sayfa = await ac(ctx, '/kitaplar/');
    const m = await sayfa.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    await ctx.close();
    expect(m.sw).toBeLessThanOrEqual(m.cw);
  });
});
