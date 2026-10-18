// Yönetim paneli e2e yardımcıları: gerçek CMS sunucusu, tek kullanımlık proje klasörü ve sahte "Yayınla" (git'e dokunmaz).
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { DIST, KOK } from './dist';

export const KULLANICI = 'yayinevi';
export const SIFRE = 'panel-test-sifresi-12345';

export interface SahteYayin {
  calls: { start: number; discard: number };
  durum: Record<string, unknown>;
  changes: () => Promise<unknown>;
  start: (options?: { confirmForeign?: boolean }) => Record<string, unknown>;
  discard: () => Promise<void>;
  snapshot: () => unknown;
}

export function sahteYayin(): SahteYayin {
  const durum: Record<string, unknown> = { configured: true, pending: false, text: '', running: false, files: 0, summary: { added: [], changed: [], removed: [], other: 0 }, job: { phase: 'idle', message: '' } };
  const calls = { start: 0, discard: 0 };
  return {
    calls, durum,
    changes: async () => ({ ...durum, job: { ...(durum.job as object) } }),
    snapshot: () => ({ running: durum.running, job: durum.job }),
    start(options = {}) {
      const foreign = (durum.foreign as string[] | undefined) ?? [];
      if (foreign.length && !options.confirmForeign) return { started: false, needsConfirm: true, foreign, foreignCount: foreign.length };
      calls.start += 1;
      durum.running = true;
      durum.job = { phase: 'working', message: 'GitHub\'a gönderiliyor…' };
      setTimeout(() => { durum.running = false; durum.pending = false; durum.job = { phase: 'done', message: 'Yayında. Değişiklikler sitede görünüyor.', url: 'https://islambol.org', finishedAt: Date.now() }; }, 1200);
      return { started: true };
    },
    async discard() { calls.discard += 1; durum.pending = false; },
  };
}

const kitap = { id: 'ilk-kitap', title: 'İlk Kitap', authors: ['İlk Yazar'], author_display: 'İlk Yazar', description: 'Bu kitap, sade bir deneme kaydıdır ve kısa bir açıklama taşır.', price_list_try: 250, categories: ['Tarih'], cover: { local_path: 'public/uploads/ilk.png', width: 400, height: 600 }, sources: { kitapyurdu: null, nobelkitap: null, kureselkitap: null, other: [] }, publish_date: '2026-09' };
const SITE = { ad: 'Deneme Yayınları', slogan: 'Deneme', telefon: '+90 505 000 00 00', telefon_gosterim: '0505 000 00 00', whatsapp_url_sablonu: 'https://wa.me/905050000000?text={kitap_adi}', whatsapp_url: 'https://wa.me/905050000000', eposta: 'info@example.com', adres: 'Fatih', sosyal: {}, satis_kanallari: [], menu: [{ etiket: 'Kitaplar', url: '/kitaplar/' }], dil: 'tr' };

export async function kapakPng(yol: string, renk = '#2b5fa8', genislik = 400, yukseklik = 600): Promise<void> {
  await sharp({ create: { width: genislik, height: yukseklik, channels: 3, background: renk } }).png().toFile(yol);
}

/** En küçük geçerli PDF: 28,4 × 20,5 cm yayılım (arka koyu kırmızı | sırt | ön mavi), her kenarda 0,5 cm taşma. */
export function kapakPdf(): Buffer {
  const W = 805;   // pt
  const H = 581;
  const cm = (v: number): number => v * 72 / 2.54;
  const bleed = cm(0.5);
  const panel = cm(13.5);
  const content = [
    '0.75 0.15 0.15 rg', `0 0 ${W} ${H} re f`,                                   // zemin (arka)
    '0.17 0.37 0.66 rg', `${W - bleed - panel} ${bleed} ${panel + bleed} ${H - 2 * bleed} re f`,   // ön panel
    '1 1 1 rg', `${W - bleed - panel + 30} ${H / 2 - 40} 200 80 re f`,
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

export async function panelBaslat(yayin: SahteYayin) {
  const kok = mkdtempSync(join(tmpdir(), 'islambol-panel-e2e-'));
  for (const d of ['data/catalog', 'data/catalog/onsoz', 'data/site/sayfalar', 'dist', 'public/uploads']) mkdirSync(join(kok, d), { recursive: true });
  cpSync(join(DIST, 'yonetim'), join(kok, 'dist/yonetim'), { recursive: true });
  cpSync(join(DIST, 'assets'), join(kok, 'dist/assets'), { recursive: true });
  cpSync(join(DIST, 'favicon.svg'), join(kok, 'dist/favicon.svg'));
  cpSync(resolve(KOK, 'data/catalog/books.schema.json'), join(kok, 'data/catalog/books.schema.json'));
  await kapakPng(join(kok, 'public/uploads/ilk.png'), '#c0582b');
  const yaz = (f: string, v: unknown): void => writeFileSync(join(kok, f), typeof v === 'string' ? v : JSON.stringify(v));
  yaz('data/catalog/books.json', [kitap]);
  yaz('data/catalog/authors.json', [{ name: 'İlk Yazar', display: 'İlk Yazar', slug: 'ilk-yazar', book_ids: ['ilk-kitap'] }]);
  yaz('data/site/campaigns.json', []);
  yaz('data/site/vitrin.json', { one_cikan: 'ilk-kitap', onizleme_vitrini: [], vitrin_haric: [] });
  yaz('data/catalog/kapaklar-opt.json', {});
  yaz('data/catalog/og.json', {});
  yaz('data/site/site.json', SITE);
  yaz('data/site/sozluk.json', { kategoriler: [{ ad: 'Tarih', slug: 'tarih' }, { ad: 'Siyaset', slug: 'siyaset' }, { ad: 'İslam Düşüncesi', slug: 'islam-dusuncesi' }] });
  yaz('data/catalog/onsoz/INDEX.json', []);
  yaz('dist/index.html', '<h1>Site</h1>');
  const { createCmsServer } = await import('../../scripts/cms/server.mjs');
  const uygulama = await createCmsServer({ root: kok, build: async () => {}, initialPassword: SIFRE, initialUsername: KULLANICI, logger: () => {}, publisher: yayin });
  await new Promise<void>((done) => uygulama.server.listen(0, '127.0.0.1', done));
  const adres = `http://127.0.0.1:${(uygulama.server.address() as { port: number }).port}`;
  return { kok, adres, async kapat() { await uygulama.close(); rmSync(kok, { recursive: true, force: true }); } };
}
