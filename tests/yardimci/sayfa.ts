import type { Page } from '@playwright/test';

export interface KonsolKaydi {
  tur: 'console' | 'pageerror' | 'istek';
  metin: string;
}

/** Sayfa açılmadan ÖNCE çağır. console.error, yakalanmamış istisna ve başarısız alt kaynak istekleri toplanır. */
export function konsolToplayici(page: Page): KonsolKaydi[] {
  const kayitlar: KonsolKaydi[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') kayitlar.push({ tur: 'console', metin: `${m.text()} @ ${m.location().url}` });
  });
  page.on('pageerror', (e) => kayitlar.push({ tur: 'pageerror', metin: e.message }));
  page.on('requestfailed', (r) => {
    const hata = r.failure()?.errorText ?? '';
    // Gezinme sırasında iptal edilen istekler hata değildir.
    if (hata.includes('ERR_ABORTED')) return;
    kayitlar.push({ tur: 'istek', metin: `${r.url()} ${hata}` });
  });
  return kayitlar;
}

/** Tembel görselleri tetiklemek için sayfayı sonuna kadar kaydırır, başa döner, ağın durulmasını bekler. */
export async function sonunaKaydir(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const adim = Math.max(200, Math.floor(window.innerHeight * 0.8));
    let son = -1;
    while (window.scrollY !== son) {
      son = window.scrollY;
      window.scrollBy(0, adim);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
}

/** Yüklenmiş ama çözülememiş (naturalWidth 0) görsellerin kaynakları. */
export async function kirikGorseller(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.images]
      .filter((i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src) !== '')
      .map((i) => i.currentSrc || i.src),
  );
}

/** Yatay kaydırma ölçümü. */
export async function yatayTasma(page: Page): Promise<{ scrollWidth: number; innerWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}
