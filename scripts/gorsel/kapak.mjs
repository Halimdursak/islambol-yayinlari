// Kapak ve önsöz sayfası optimizasyonu: webp/jpg boyut kümeleri + manifest.
import sharp from "sharp";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { yol, guncelMi, boyutlariSec } from "./ortak.mjs";

export const KAPAK_GENISLIK = [320, 640, 960];
export const KAPAK_WEBP_KALITE = 66;
export const KAPAK_JPG_KALITE = 58;
export const ONSOZ_YUKSEKLIK = [800, 1200];
export const ONSOZ_WEBP_KALITE = 72;
export const ONSOZ_YERLI_EKLE = false; // true: 1000 px kaynaklar için ek yerli boyutlu sürüm (~+4 MB)
export const LQIP_BAYT_SINIRI = 410; // data URI toplamı ≤ ~600 karakter

const jsonOku = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {});

/** 16 px genişlikte, ≤ ~600 karakterlik bulanık jpeg data URI. */
async function lqipUret(tampon) {
  for (let kalite = 40; kalite >= 6; kalite -= 4) {
    const jpg = await sharp(tampon)
      .flatten({ background: "#ffffff" })
      .resize({ width: 16 })
      .jpeg({ quality: kalite, mozjpeg: true })
      .toBuffer();
    if (jpg.length <= LQIP_BAYT_SINIRI) return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  }
  return null;
}

async function kapakDosyasiIsle(dosya, force, eskiKayit) {
  const kaynakYol = yol("public", "kapaklar", dosya);
  const id = basename(dosya, extname(dosya));
  const meta = await sharp(kaynakYol).metadata();
  const boyutlar = boyutlariSec(meta.width, KAPAK_GENISLIK);
  const cikti = (w, bicim) => yol("public", "kapaklar-opt", `${id}-${w}.${bicim}`);
  const hepsiGuncel = boyutlar.every((w) => guncelMi(cikti(w, "webp"), kaynakYol) && guncelMi(cikti(w, "jpg"), kaynakYol));

  if (!force && hepsiGuncel && eskiKayit?.lqip) return { kayit: eskiKayit, atlandi: true };

  const tampon = readFileSync(kaynakYol);
  const kaynaklar = { webp: [], jpg: [] };
  for (const w of boyutlar) {
    const taban = sharp(tampon).resize({ width: w, withoutEnlargement: true, kernel: "lanczos3" });
    const webp = await taban.clone().webp({ quality: KAPAK_WEBP_KALITE, effort: 5 }).toBuffer({ resolveWithObject: true });
    const jpg = await taban
      .clone()
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: KAPAK_JPG_KALITE, progressive: true, mozjpeg: true })
      .toBuffer();
    writeFileSync(cikti(w, "webp"), webp.data);
    writeFileSync(cikti(w, "jpg"), jpg);
    kaynaklar.webp.push({ w: webp.info.width, url: `/kapaklar-opt/${id}-${w}.webp` });
    kaynaklar.jpg.push({ w: webp.info.width, url: `/kapaklar-opt/${id}-${w}.jpg` });
  }
  const kayit = {
    orijinal: `/kapaklar/${dosya}`,
    genislik: meta.width,
    yukseklik: meta.height,
    oran: Number((meta.width / meta.height).toFixed(4)),
    lqip: await lqipUret(tampon),
    kaynaklar,
  };
  return { kayit, atlandi: false };
}

export async function kapaklariIsle(force) {
  mkdirSync(yol("public", "kapaklar-opt"), { recursive: true });
  const manifestYolu = yol("data", "catalog", "kapaklar-opt.json");
  const eski = jsonOku(manifestYolu);
  const manifest = {};
  let islenen = 0;
  let atlanan = 0;
  const dosyalar = readdirSync(yol("public", "kapaklar")).filter((d) => /\.(jpe?g|png)$/i.test(d)).sort();
  for (const dosya of dosyalar) {
    const id = basename(dosya, extname(dosya));
    const { kayit, atlandi } = await kapakDosyasiIsle(dosya, force, eski[id]);
    manifest[id] = kayit;
    if (atlandi) atlanan++;
    else islenen++;
  }
  writeFileSync(manifestYolu, JSON.stringify(manifest, null, 2) + "\n");
  return { toplam: dosyalar.length, islenen, atlanan };
}

async function onsozSayfasiIsle(slug, dosya, force) {
  const kaynakYol = yol("public", "onsoz", slug, dosya);
  const ad = basename(dosya, ".jpg");
  const meta = await sharp(kaynakYol).metadata();
  const boyutlar = boyutlariSec(meta.height, ONSOZ_YUKSEKLIK, ONSOZ_YERLI_EKLE);
  const cikti = (h) => yol("public", "onsoz-opt", slug, `${ad}-${h}.webp`);
  const guncel = boyutlar.every((h) => guncelMi(cikti(h), kaynakYol));
  const webp = [];
  for (const h of boyutlar) {
    const url = `/onsoz-opt/${slug}/${ad}-${h}.webp`;
    if (force || !guncel) {
      const sonuc = await sharp(kaynakYol)
        .resize({ height: h, withoutEnlargement: true, kernel: "lanczos3" })
        .webp({ quality: ONSOZ_WEBP_KALITE, effort: 5 })
        .toBuffer({ resolveWithObject: true });
      writeFileSync(cikti(h), sonuc.data);
      webp.push({ w: sonuc.info.width, url });
    } else {
      const m = await sharp(cikti(h)).metadata();
      webp.push({ w: m.width, url });
    }
  }
  // jpg yedeği: orijinal dosya zaten public/onsoz altında sunuluyor (ek boyut maliyeti yok).
  const jpg = [{ w: meta.width, url: `/onsoz/${slug}/${dosya}` }];
  return { indeks: String(parseInt(ad, 10)), kayit: { webp, jpg }, atlandi: !force && guncel };
}

export async function onsozleriIsle(force) {
  const manifest = {};
  let islenen = 0;
  let atlanan = 0;
  const kok = yol("public", "onsoz");
  for (const slug of readdirSync(kok).sort()) {
    mkdirSync(yol("public", "onsoz-opt", slug), { recursive: true });
    manifest[slug] = {};
    const dosyalar = readdirSync(join(kok, slug)).filter((d) => /^\d+\.jpe?g$/i.test(d)).sort();
    for (const dosya of dosyalar) {
      const { indeks, kayit, atlandi } = await onsozSayfasiIsle(slug, dosya, force);
      manifest[slug][indeks] = kayit;
      if (atlandi) atlanan++;
      else islenen++;
    }
  }
  writeFileSync(yol("data", "catalog", "onsoz-opt.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { toplam: islenen + atlanan, islenen, atlanan };
}
