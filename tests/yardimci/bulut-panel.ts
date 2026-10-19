// Bulut yönetim paneli e2e yardımcısı: paketlenecek Worker kodunun aynısı (ön katman + panel) Node içinde çalışır;
// GitHub sahtedir (bellek içi), site görselleri sahte bir PNG ile yanıtlanır. Gerçek Cloudflare'e dokunulmaz.
import { createServer, type Server } from 'node:http';
import sharp from 'sharp';

export const KULLANICI = 'yayinevi';
export const SIFRE = 'bulut-test-sifresi-12345';

export interface BulutPanel {
  adres: string;
  github: any;
  storage: any;
  ilerlet: (ms: number) => void;
  kapat: () => Promise<void>;
}

const IZINLI_BASLIK = ['cookie', 'content-type', 'x-csrf-token', 'origin', 'sec-fetch-site', 'accept', 'if-none-match', 'cf-connecting-ip'];

export async function bulutPanelBaslat(): Promise<BulutPanel> {
  const { buildAssets } = await import('../../worker/scripts/build.mjs');
  await buildAssets();
  const { ASSETS, VERSION } = await import('../../worker/generated/assets.mjs');
  const { createEdge } = await import('../../worker/src/edge.mjs');
  const { createPanel } = await import('../../worker/src/panel.mjs');
  const { newCredential } = await import('../../worker/src/crypto.mjs');
  const { createFakeGithub } = await import('../../worker/tests/helpers/fake-github.mjs');
  const { MemoryStorage, bookValidator, realFiles } = await import('../../worker/tests/helpers/panel.mjs');

  const github = createFakeGithub({ repo: 'owner/repo', files: await realFiles() });
  const storage = new MemoryStorage();
  const saat = { ileri: 0 };   // gerçek saat + testin ilerlettiği süre
  // WASM sharp'ın döndürdüğü tampon başka bir bellek bölgesinden gelebilir; Response'un doğru bayt sayması için kopyalanır.
  const siteResmi = Uint8Array.from(await sharp({ create: { width: 400, height: 600, channels: 3, background: '#7a4a2b' } }).jpeg().toBuffer());
  const fetchImpl = async (girdi: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const adres = String(girdi);
    if (adres.startsWith('https://api.github.com')) return github.fetch(adres, init);
    return new Response(siteResmi, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  };

  let panel: any;
  const sunucu: Server = createServer(async (istek, yanit) => {
    try {
      const parcalar: Buffer[] = [];
      for await (const parca of istek) parcalar.push(parca as Buffer);
      const basliklar = new Headers();
      for (const ad of IZINLI_BASLIK) if (istek.headers[ad]) basliklar.set(ad, String(istek.headers[ad]));
      const govdeli = !['GET', 'HEAD'].includes(istek.method ?? 'GET');
      const request = new Request(`http://${istek.headers.host}${istek.url}`, { method: istek.method, headers: basliklar, body: govdeli ? Buffer.concat(parcalar) : undefined });
      const yanitim = await edge(request, { PANEL: { idFromName: () => 'panel', get: () => ({ fetch: (istekim: Request) => panel.handle(istekim) }) } });
      const basliklarim: Record<string, string> = {};
      yanitim.headers.forEach((deger, ad) => { basliklarim[ad] = deger; });
      yanit.writeHead(yanitim.status, basliklarim);
      yanit.end(Buffer.from(await yanitim.arrayBuffer()));
    } catch (hata) {
      yanit.writeHead(500, { 'content-type': 'text/plain' });
      yanit.end(String(hata));
    }
  });
  await new Promise<void>((tamam) => sunucu.listen(0, '127.0.0.1', tamam));
  const port = (sunucu.address() as { port: number }).port;
  const host = `127.0.0.1:${port}`;
  const edge = createEdge({ assets: ASSETS, version: VERSION, siteUrl: 'https://site.test', fetch: fetchImpl });
  const env = { GITHUB_TOKEN: 't', GITHUB_REPO: 'owner/repo', ALLOWED_HOSTS: host, SITE_URL: 'https://site.test', INITIAL_CREDENTIAL: JSON.stringify(await newCredential(KULLANICI, SIFRE)) };
  panel = createPanel({ storage, env, validateBook: await bookValidator(), fetch: fetchImpl, now: () => Date.now() + saat.ileri, previewSlugs: [], categories: [{ ad: 'Tarih', slug: 'tarih' }, { ad: 'Siyaset', slug: 'siyaset' }] });
  return {
    adres: `http://${host}`, github, storage,
    ilerlet: (ms) => { saat.ileri += ms; },
    kapat: () => new Promise<void>((tamam) => { sunucu.closeAllConnections(); sunucu.close(() => tamam()); }),
  };
}
