// Marka görselleri: şeffaf logo, koyu zemin logosu, favicon seti, web manifest, OG görselleri.
// NOT: sharp (WASM/resvg) sistem fontlarına erişemez; bu yüzden "İ" harfi hem SVG'de hem rasterde yol (path) olarak çizilir.
// Renkler Beyaz Vitrin tasarımından gelir (DESIGN.md): vurgu #d11a2a, zemin bandı #f5f5f7.
import sharp from "sharp";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { yol, guncelMi, dizinDosyalari, toplamBayt } from "./ortak.mjs";

const BU_DOSYA = fileURLToPath(import.meta.url);
const KAGIT = { r: 245, g: 245, b: 247 }; // #f5f5f7 (OG zemini = bölüm bandı)
const VURGU = "#d11a2a"; // tek vurgu rengi (CTA, Önizle rozeti, OG alt çizgisi, favicon)
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

// UYARI: public/logo/islambol-logo*.png şu an yayınevinin gönderdiği logo PNG'sinden (islambol-logo-kaynak.png) türetilmiş,
// elle onaylanmış dosyalardır (480×480). Bu betik yalnızca eski 400 px JPG'den (düşük kalite) üretebilir; bu yüzden
// staleness kontrolü BU_DOSYA'ya bakmaz: betiği düzenlemek logoyu ezmez. Logoyu bilerek yenilemek için `--force` kullanın.
async function logolariUret(force) {
  if (!force && guncelMi(LOGO_SEFFAF, LOGO_KAYNAK) && guncelMi(LOGO_KOYU, LOGO_KAYNAK)) return 0;
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
// Font gerektirmeyen yol (path) çizimi: yuvarlak köşeli kırmızı kare, beyaz sans "İ" (nokta + çubuk).
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="${VURGU}"/>
  <g fill="#ffffff">
    <circle cx="32" cy="16" r="4.6"/>
    <rect x="27.2" y="25" width="9.6" height="26" rx="4.8"/>
  </g>
</svg>
`;
const FAVICON_YOL_SVG = FAVICON_SVG;

const MANIFEST_SITE = {
  name: "İslambol Yayınları",
  short_name: "İslambol",
  description: "İslambol Yayınları tanıtım ve katalog sitesi",
  lang: "tr",
  start_url: "/",
  display: "standalone",
  theme_color: "#ffffff",
  background_color: "#ffffff",
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
  const cizgi = await sharp({ create: { width: OG_W, height: 8, channels: 3, background: VURGU } }).png().toBuffer();
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
