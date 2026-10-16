// SEO doğrulama — dist/ içindeki tüm HTML sayfalarını tarar. Sahibi: B5.
// Kullanım: node scripts/seo/dogrula.mjs [dist-dizini]   (hata varsa çıkış kodu 1)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const KOK = process.argv[2] ?? "dist";
const SITE_URL = (process.env.SITE_URL ?? "https://adursak63.github.io/islambol-yayinlari").replace(/\/$/, "");
const TITLE_MAX = 60;
const DESC_MAX = 155;

const ENTITELER = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };
const coz = (s) => s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITELER[m]);

function htmlDosyalari(dizin) {
  const sonuc = [];
  for (const ad of readdirSync(dizin)) {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) sonuc.push(...htmlDosyalari(yol));
    else if (ad.endsWith(".html")) sonuc.push(yol);
  }
  return sonuc;
}

/** ISBN-13 sağlama toplamı. */
function isbn13Gecerli(v) {
  if (!/^\d{13}$/.test(v)) return false;
  const toplam = [...v].reduce((t, c, i) => t + Number(c) * (i % 2 === 0 ? 1 : 3), 0);
  return toplam % 10 === 0;
}

function tipleriTopla(bloklar) {
  const dugumler = [];
  const gez = (o) => {
    if (Array.isArray(o)) return o.forEach(gez);
    if (o && typeof o === "object") {
      dugumler.push(o);
      if (o["@graph"]) gez(o["@graph"]);
    }
  };
  bloklar.forEach(gez);
  return dugumler;
}

function sayfaIncele(dosya) {
  const html = readFileSync(dosya, "utf8");
  const yol = "/" + relative(KOK, dosya).split(sep).join("/");
  const hatalar = [];
  const uyarilar = [];

  const titles = [...html.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => coz(m[1].trim()));
  const descs = [...html.matchAll(/<meta\s+name="description"\s+content="([^"]*)"/g)].map((m) => coz(m[1]));
  const canon = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"/g)].map((m) => m[1]);
  const ldBlok = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const yonetim = yol === "/yonetim/index.html";

  if (titles.length !== 1) hatalar.push(`title sayısı ${titles.length} (1 olmalı)`);
  if (descs.length !== 1) hatalar.push(`description sayısı ${descs.length} (1 olmalı)`);
  if (yonetim && !/<meta\s+name="robots"\s+content="noindex,\s*nofollow"/.test(html)) hatalar.push("yönetim sayfası noindex,nofollow içermeli");
  if (!yonetim && canon.length !== 1) hatalar.push(`canonical sayısı ${canon.length} (1 olmalı)`);
  else if (canon.length && !canon[0].startsWith(SITE_URL + "/")) hatalar.push(`canonical ${SITE_URL} ile başlamıyor: ${canon[0]}`);
  if (!yonetim && ldBlok.length < 1) hatalar.push("JSON-LD bloğu yok");

  const veri = [];
  ldBlok.forEach((b, i) => {
    try { veri.push(JSON.parse(b)); } catch (e) { hatalar.push(`JSON-LD #${i + 1} geçersiz JSON: ${e.message}`); }
  });
  const dugumler = tipleriTopla(veri);
  const tipler = new Set(dugumler.map((d) => d["@type"]).flat().filter(Boolean));

  for (const gerekli of ["Organization", "WebSite"]) {
    if (veri.length && !tipler.has(gerekli)) hatalar.push(`${gerekli} şeması yok`);
  }
  const kitapSayfasi = /^\/kitap\/[^/]+\/index\.html$/.test(yol);
  if (kitapSayfasi) {
    const kitap = dugumler.find((d) => d["@type"] === "Book");
    if (!kitap) hatalar.push("kitap sayfasında Book şeması yok");
    else {
      if (kitap.isbn !== undefined && !isbn13Gecerli(String(kitap.isbn))) hatalar.push(`isbn ISBN-13 değil: ${kitap.isbn}`);
      if (kitap.offers) hatalar.push("Book.offers var (ADR-001: fiyat yok)");
    }
  }

  if (titles[0] && titles[0].length > TITLE_MAX) uyarilar.push(`title ${titles[0].length} karakter (>${TITLE_MAX})`);
  if (descs[0] && descs[0].length > DESC_MAX) uyarilar.push(`description ${descs[0].length} karakter (>${DESC_MAX})`);

  return { yol, title: titles[0] ?? "", hatalar, uyarilar, tipler: [...tipler] };
}

let dosyalar;
try { dosyalar = htmlDosyalari(KOK); } catch { console.error(`HATA: ${KOK}/ okunamadı; önce npm run build.`); process.exit(2); }

const sonuclar = dosyalar.map(sayfaIncele).sort((a, b) => a.yol.localeCompare(b.yol));

// Tekrarlanan title'lar
const titleHaritasi = new Map();
for (const s of sonuclar) titleHaritasi.set(s.title, [...(titleHaritasi.get(s.title) ?? []), s.yol]);
const tekrarlar = [...titleHaritasi].filter(([t, y]) => t && y.length > 1);

console.log("SAYFA".padEnd(52), "HATA", "UYARI", "ŞEMALAR");
for (const s of sonuclar) {
  console.log(s.yol.slice(0, 51).padEnd(52), String(s.hatalar.length).padEnd(4), String(s.uyarilar.length).padEnd(5), s.tipler.join(","));
  for (const h of s.hatalar) console.log(`    HATA  ${h}`);
  for (const u of s.uyarilar) console.log(`    UYARI ${u}`);
}
if (tekrarlar.length) {
  console.log("\nTekrarlanan title'lar:");
  for (const [t, y] of tekrarlar) console.log(`  "${t}" -> ${y.join(", ")}`);
}
const hataToplam = sonuclar.reduce((t, s) => t + s.hatalar.length, 0);
const uyariToplam = sonuclar.reduce((t, s) => t + s.uyarilar.length, 0) + tekrarlar.length;
console.log(`\nÖzet: ${sonuclar.length} sayfa, ${hataToplam} hata, ${uyariToplam} uyarı (${tekrarlar.length} tekrar eden title dahil).`);
process.exit(hataToplam ? 1 : 0);
