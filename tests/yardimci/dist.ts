import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export const KOK = process.cwd();
export const DIST = resolve(KOK, process.env.QA_DIST ?? 'dist');

export interface DistSayfa {
  /** Site içi URL yolu: "/kitap/x/" ya da "/404.html" */
  url: string;
  /** Mutlak dosya yolu */
  dosya: string;
}

function yuru(dizin: string, cikti: string[]): void {
  for (const ad of readdirSync(dizin)) {
    const tam = join(dizin, ad);
    if (statSync(tam).isDirectory()) yuru(tam, cikti);
    else if (ad.endsWith('.html')) cikti.push(tam);
  }
}

/** dist/ içindeki tüm HTML dosyaları (yol sırasına göre). `_test` dizini robots ile dışlanmıştır, atlanır. */
export function distSayfalari(): DistSayfa[] {
  const dosyalar: string[] = [];
  yuru(DIST, dosyalar);
  return dosyalar
    .map((dosya) => {
      const rel = relative(DIST, dosya).split(sep).join('/');
      const url = rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? `/${rel.slice(0, -'index.html'.length)}` : `/${rel}`;
      return { url, dosya };
    })
    .filter((s) => !s.url.startsWith('/_test/'))
    .sort((a, b) => a.url.localeCompare(b.url));
}

export function htmlOku(dosya: string): string {
  return readFileSync(dosya, 'utf8');
}

/** sitemap.xml içindeki <loc> adreslerini site içi yola çevirir (alt dizin önekini düşer). */
export function sitemapYollari(): string[] {
  const xml = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  const yollar: string[] = [];
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const yol = new URL(m[1]).pathname.replace(/^\/islambol-yayinlari(?=\/)/, '');
    yollar.push(yol || '/');
  }
  return yollar;
}
