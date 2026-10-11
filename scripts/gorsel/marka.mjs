// Marka görselleri: şeffaf logo, koyu zemin logosu, favicon seti, web manifest, OG görselleri.
// NOT: sharp (WASM/resvg) sistem fontlarına erişemez; bu yüzden rasterde "İ" harfi yol (path) olarak çizilir.
// public/favicon.svg ise istenen biçimde <text> kullanır (tarayıcılar Georgia/EB Garamond ile çizer).
import sharp from "sharp";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { yol, guncelMi, dizinDosyalari, toplamBayt } from "./ortak.mjs";

const BU_DOSYA = fileURLToPath(import.meta.url);
const KAGIT = { r: 244, g: 239, b: 228 }; // #F4EFE4
const MUHUR = "#A51C22";
const KIRIK_BEYAZ = [236, 229, 214]; // #ECE5D6
const LOGO_KAYNAK = yol("public", "logo", "islambol-x-profil.jpg");
const LOGO_SEFFAF = yol("public", "logo", "islambol-logo.png");
const LOGO_KOYU = yol("public", "logo", "islambol-logo-koyu-zemin.png");

const sinirla = (x, a, b) => Math.min(b, Math.max(a, x));

/** Beyaza yakın pikselleri şeffaflaştırır: min(r,g,b) 225→255 alfa, 245→0 alfa (kademeli). */
function seffafYap(ham, genislik, yukseklik, koyuZemin) {
  const cikis = Buffer.alloc(genislik * yukseklik * 4);
  for (let i = 0, o = 0; i < ham.length; i += 3, o += 4) {
    const [r, g, b] = [ham[i], ham[i + 1], ham[i + 2]];
    const en = Math.min(r, g, b);
    const ham_alfa = en >= 245 ? 0 : en <= 225 ? 255 : (255 * (245 - en)) / 20;
    // JPEG gürültüsünden kalan soluk benekleri (alfa < 90) at, kalan bandı 0-255'e yeniden ölçekle.
    const alfa = ham_alfa < 90 ? 0 : Math.round(sinirla(((ham_alfa - 90) * 255) / 120, 0, 255));
    let renk = [r, g, b];
    if (koyuZemin) {
      // gri/antrasit (doygunluğu düşük) pikseller kırık beyaza kayar; kırmızı kalır.
      const doygunluk = Math.max(r, g, b) - en;
      const agirlik = 1 - sinirla((doygunluk - 25) / 45, 0, 1);
      renk = renk.map((k, n) => Math.round(k * (1 - agirlik) + KIRIK_BEYAZ[n] * agirlik));
    }
    cikis[o] = renk[0];
    cikis[o + 1] = renk[1];
    cikis[o + 2] = renk[2];
    cikis[o + 3] = alfa;
  }
  return cikis;
}

async function logolariUret(force) {
  if (!force && guncelMi(LOGO_SEFFAF, LOGO_KAYNAK, BU_DOSYA) && guncelMi(LOGO_KOYU, LOGO_KAYNAK, BU_DOSYA)) return 0;
  const { data, info } = await sharp(LOGO_KAYNAK)
    .resize({ width: 800, kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (const [hedef, koyu] of [[LOGO_SEFFAF, false], [LOGO_KOYU, true]]) {
    const rgba = seffafYap(data, info.width, info.height, koyu);
    await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(hedef);
  }
  return 2;
}

// --- Favicon ---------------------------------------------------------------
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="2" fill="${MUHUR}"/>
  <text x="32" y="48" font-family="'EB Garamond', Georgia, serif" font-size="46" font-weight="500" text-anchor="middle" fill="#ECE5D6">İ</text>
</svg>
`;

// Aynı tasarımın font gerektirmeyen yol (path) sürümü: serifli "İ" + nokta.
const FAVICON_YOL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="2" fill="${MUHUR}"/>
  <g fill="#ECE5D6" transform="translate(0 3)">
    <circle cx="32" cy="13.2" r="3.5"/>
    <path d="M21.5 48 H42.5 V45.2 C38.6 45 36.7 44.3 36.5 41.5 V30.5 C36.7 27.7 38.6 27 41.2 26.8 V24.4 H22.8 V26.8 C25.4 27 27.3 27.7 27.5 30.5 V41.5 C27.3 44.3 25.4 45 21.5 45.2 Z"/>
  </g>
</svg>`;

const MANIFEST_SITE = {
  name: "İslambol Yayınları",
  short_name: "İslambol",
  description: "İslambol Yayınları tanıtım ve katalog sitesi",
  lang: "tr",
  start_url: "/",
  display: "standalone",
  theme_color: MUHUR,
  background_color: "#F4EFE4",
  icons: [
    { src: "/favicon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
  ],
};

async function faviconlariUret(force) {
  const cikti = ["favicon.svg", "favicon-32.png", "favicon-192.png", "apple-touch-icon.png", "site.webmanifest"].map((a) => yol("public", a));
  if (!force && cikti.every((c) => guncelMi(c, BU_DOSYA))) return 0;
  writeFileSync(yol("public", "favicon.svg"), FAVICON_SVG);
  for (const [ad, boyut] of [["favicon-32.png", 32], ["favicon-192.png", 192], ["apple-touch-icon.png", 180]]) {
    // yüksek çözünürlükte çiz, sonra küçült (kenar yumuşatma için)
    await sharp(Buffer.from(FAVICON_YOL_SVG), { density: 72 * (512 / 64) })
      .resize(boyut, boyut, { kernel: "lanczos3" })
      .png({ compressionLevel: 9 })
      .toFile(yol("public", ad));
  }
  writeFileSync(yol("public", "site.webmanifest"), JSON.stringify(MANIFEST_SITE, null, 2) + "\n");
  return 5;
}

// --- OG görselleri ---------------------------------------------------------
const OG_W = 1200;
const OG_H = 630;

async function ogTaban() {
  const kagit = await sharp({ create: { width: OG_W, height: OG_H, channels: 3, background: KAGIT } }).png().toBuffer();
  const cizgi = await sharp({ create: { width: OG_W, height: 8, channels: 3, background: MUHUR } }).png().toBuffer();
  return { kagit, cizgi, cizgiKonum: { left: 0, top: OG_H - 8 } };
}

async function kirpilmisLogo(yukseklik) {
  return sharp(LOGO_SEFFAF).trim().resize({ height: yukseklik, kernel: "lanczos3" }).png().toBuffer({ resolveWithObject: true });
}

async function siteOgUret(taban) {
  const logo = await kirpilmisLogo(300);
  const sol = Math.round((OG_W - logo.info.width) / 2);
  const ust = Math.round((OG_H - 8 - logo.info.height) / 2);
  await sharp(taban.kagit)
    .composite([{ input: logo.data, left: sol, top: ust }, { input: taban.cizgi, ...taban.cizgiKonum }])
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(yol("public", "og", "site.png"));
}

/** Kapak için yumuşak gölge katmanı (kapağın arkasına, hafif aşağı kaydırılmış). */
async function golgeKatmani(w, h) {
  const bosluk = 40;
  const dikdortgen = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 30, g: 28, b: 26, alpha: 0.5 } } }).png().toBuffer();
  const genis = await sharp(dikdortgen).extend({ top: bosluk, bottom: bosluk, left: bosluk, right: bosluk, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(14).png().toBuffer();
  return { genis, bosluk };
}

async function kitapOgUret(id, kapakYolu, taban, logo) {
  const kapak = await sharp(kapakYolu).flatten({ background: "#ffffff" }).resize({ height: 400, kernel: "lanczos3" }).png().toBuffer({ resolveWithObject: true });
  const { genis, bosluk } = await golgeKatmani(kapak.info.width, kapak.info.height);
  const sol = 170;
  const ust = Math.round((OG_H - 8 - kapak.info.height) / 2);
  await sharp(taban.kagit)
    .composite([
      { input: genis, left: sol - bosluk + 6, top: ust - bosluk + 14 },
      { input: kapak.data, left: sol, top: ust },
      { input: logo.data, left: OG_W - 70 - logo.info.width, top: OG_H - 8 - 50 - logo.info.height },
      { input: taban.cizgi, ...taban.cizgiKonum },
    ])
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(yol("public", "og", `${id}.png`));
}

async function ogGorselleriniUret(force) {
  mkdirSync(yol("public", "og"), { recursive: true });
  const taban = await ogTaban();
  const manifest = { site: "/og/site.png" };
  let islenen = 0;
  let atlanan = 0;

  const siteYolu = yol("public", "og", "site.png");
  if (force || !guncelMi(siteYolu, LOGO_SEFFAF, BU_DOSYA)) {
    await siteOgUret(taban);
    islenen++;
  } else atlanan++;

  const logo = await kirpilmisLogo(64);
  for (const dosya of readdirSync(yol("public", "kapaklar")).filter((d) => /\.(jpe?g|png)$/i.test(d)).sort()) {
    const id = basename(dosya, extname(dosya));
    const kaynak = yol("public", "kapaklar", dosya);
    manifest[id] = `/og/${id}.png`;
    if (!force && guncelMi(yol("public", "og", `${id}.png`), kaynak, LOGO_SEFFAF, BU_DOSYA)) {
      atlanan++;
      continue;
    }
    await kitapOgUret(id, kaynak, taban, logo);
    islenen++;
  }
  writeFileSync(yol("data", "catalog", "og.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { islenen, atlanan };
}

export async function markaGorselleriniUret(force) {
  const logoSayisi = await logolariUret(force);
  const faviconSayisi = await faviconlariUret(force);
  const og = await ogGorselleriniUret(force);
  const markaDosyalari = [
    yol("public", "logo", "islambol-logo.png"),
    yol("public", "logo", "islambol-logo-koyu-zemin.png"),
    ...["favicon.svg", "favicon-32.png", "favicon-192.png", "apple-touch-icon.png", "site.webmanifest"].map((a) => yol("public", a)),
  ];
  const islenen = logoSayisi + faviconSayisi;
  return {
    islenen,
    atlanan: markaDosyalari.length - islenen,
    markaBayt: toplamBayt(markaDosyalari),
    markaDosya: markaDosyalari.length,
    ogIslenen: og.islenen,
    ogAtlanan: og.atlanan,
    ogDosya: dizinDosyalari(yol("public", "og")).length,
  };
}
