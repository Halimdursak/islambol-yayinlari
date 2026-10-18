// Yayınevinin baskı dosyalarından (data/KITAPLAR/*.pdf, depoya girmez) ön + arka kapak görselleri üretir (ADR-019).
//   npm i --no-save pdfjs-dist@3.11.174        (yalnız saf JS; native modül yok; package.json'a yazılmaz)
//   node scripts/gorsel/baski-kapaklari.mjs [--id <kitap-id>] [--dpi 300]
// PDF sayfası sistemdeki Edge (Playwright channel "msedge") içinde pdf.js ile çizilir; Pillow/Ghostscript gerekmez.
// Çıktı: public/kapaklar/<id>.jpg (1200 px, ön), public/kapaklar-arka/<id>.jpg + .webp (800 px, arka); stdout: books.json için cover/back_cover.
// Sonra: npm run gorsel  (optimize + OG), npm run build.
import http from "node:http";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, createReadStream, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const KOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PDF_DIZIN = join(KOK, "data", "KITAPLAR");
const arg = (ad, varsayilan) => { const i = process.argv.indexOf(ad); return i > 0 ? process.argv[i + 1] : varsayilan; };
const DPI = Number(arg("--dpi", 300));
const ISTENEN = arg("--id", null);
const PX_CM = DPI / 2.54;
const cm = (v) => Math.round(v * PX_CM);
const KENAR = 0.02; // cm: kesim kenarında ince beyaz çizgi kalmasın

// Taşma payı (bleed) her kenarda 0.5 cm olan, kırpma işaretsiz sayfalar: kesim kutusu = sayfa − 1 cm.
const tam = (w, h) => [0.5, 0.5, w - 1, h - 1];
// pdf: dosya adı · trim: [sol, üst, genişlik, yükseklik] cm (kesim kutusu; kırpma işaretli sayfalarda PDF TrimBox'ından) · bw: kapak paneli genişliği cm
const KAPAKLAR = {
  "1918-mutarekesinden-beri-olan-vakalar": { pdf: "Rıza_Nur_Kapak.pdf", trim: tam(36.5, 24.5), bw: 16.5 },
  "ataturk-ingiliz-ajani-miydi-tartismasi": { pdf: "İngiliz_Ajanımıydı_Tartışması.pdf", trim: tam(30.2, 22), bw: 13.5 },
  "ataturkun-manevi-kizi-zehra-aylinin-munasebetsiz-olumu": { pdf: "Zehra_Aylin_Kapak.pdf", trim: tam(29.7, 22), bw: 13.5 },
  "ataturkun-usaginin-gizli-defteri": { pdf: "2_kapak_atatürkun_usaginin.pdf", trim: [1.16, 1.16, 29.5, 19.5], bw: 13.5 },
  "bir-ingiliz-operasyonu-turk-kurtulus-savasi": { pdf: "Bir_İngiliz_Operasyonu_Kapak.pdf", trim: tam(29.5, 22), bw: 13.5 },
  "butun-ciplakligiyla-31-mart-faciasi": { pdf: "kapak_bütün.pdf", trim: [1.16, 1.16, 28.5, 19.5], bw: 13.5 },
  "devlet-i-osmaniye-ve-siyonistler": { pdf: "DevletiOsmaniye_Kapak.pdf", trim: tam(28.4, 20.5), bw: 13.5 },
  "haim-nahum": { pdf: "6_kapak_haim.pdf", trim: [1.25, 1.21, 28.0, 21.0], bw: 13.5 },
  "ittihad-ve-terakki-cemiyeti": { pdf: "İttihat_ve_terakki_cemiyeti.pdf", trim: tam(30.5, 22), bw: 13.5 },
  "kemalistlerin-din-dusmanligi": { pdf: "3_kapak_kemalistlerin.pdf", trim: [1.16, 1.16, 27.7, 19.5], bw: 13.5 },
  "kuran-i-kerimde-peygamberlerin-sunumu-ve-mucizeleri": { pdf: "Ali_Altunsoy_Kapak.pdf", trim: tam(30.5, 22), bw: 13.5 },
  "kurtulus-savasinin-sansursuz-tarihi": { pdf: "Kurtuluş_Savaşı_Sansürsüz_Kapak.pdf", trim: tam(29.2, 22), bw: 13.5 },
  "milli-din-duygusu-ve-oz-turk-dini": { pdf: "Milli_din_kapak.pdf", trim: tam(28.4, 20.5), bw: 13.5 },
  "mustafa-kemal-az-bilinenler": { pdf: "Mustafa_Kemal_Az_Bilinenler.pdf", trim: tam(37.7, 24.5), bw: 16.5 },
  "mustafa-kemal-icki-ve-kadinlar": { pdf: "Mustafa_Kemal_içki_kadınlar.pdf", trim: tam(29.2, 22), bw: 13.5 },
  "nebile-sait-irdelp-unutulan-bir-hayatin-kronolojisi": { pdf: "Nebile_Sait_İrdelp.pdf", trim: tam(29.7, 22), bw: 13.5 },
  "takiyyeli-fuhrer": { pdf: "takiyyeli_führer_kapak.pdf", trim: tam(28.9, 22), bw: 13.5 },
  "turk-basininda-tartismalarin-odaginda-ataturk-ve-ataturkculuk": { pdf: "Atatürk_Atatürkçülük.pdf", trim: tam(30.0, 22), bw: 13.5 },
  "turkun-yeni-amentusu": { pdf: "3_kapak_Türkün.pdf", trim: [1.16, 1.16, 27.7, 19.5], bw: 13.5 },
  "yeryuzunun-hakiki-canileri-israil": { pdf: "kapak_yeryüzünün.pdf", trim: [1.16, 1.16, 29.0, 19.5], bw: 13.5 },
  "zampara-diktator": { pdf: "Zampara_Diktatör.pdf", trim: tam(29.2, 22), bw: 13.5 },
};

const require = createRequire(import.meta.url);
let pdfjsDizin;
try { pdfjsDizin = dirname(require.resolve("pdfjs-dist/build/pdf.min.js")); } catch { throw new Error("pdfjs-dist yok: npm i --no-save pdfjs-dist@3.11.174"); }
// Dosya adlarındaki Türkçe karakterler macOS/Windows'ta farklı Unicode biçiminde olabilir: NFC'ye göre eşle.
const pdfBul = (ad) => {
  const adaylar = new Set([ad, ad.normalize("NFC"), ad.normalize("NFD")]);
  for (const aday of adaylar) if (existsSync(join(PDF_DIZIN, aday))) return join(PDF_DIZIN, aday);
  throw new Error(`PDF bulunamadı: ${ad} (${PDF_DIZIN})`);
};

const sunucu = http.createServer((istek, yanit) => {
  const url = decodeURIComponent(istek.url.split("?")[0]);
  if (url === "/") { yanit.setHeader("content-type", "text/html"); yanit.end("<!doctype html><meta charset=utf-8><canvas id=c></canvas>"); return; }
  const dosya = url.startsWith("/pdf/") ? pdfBul(url.slice(5)) : url.startsWith("/lib/") ? join(pdfjsDizin, url.slice(5)) : null;
  if (!dosya || !existsSync(dosya)) { yanit.statusCode = 404; yanit.end(); return; }
  yanit.setHeader("content-type", dosya.endsWith(".js") ? "text/javascript" : "application/pdf");
  createReadStream(dosya).pipe(yanit);
}).listen(0, "127.0.0.1");

const tarayici = await chromium.launch({ channel: "msedge" });
const sayfa = await tarayici.newPage();
await sayfa.goto(`http://127.0.0.1:${sunucu.address().port}/`);
await sayfa.addScriptTag({ url: "/lib/pdf.min.js" });
await sayfa.evaluate(() => { pdfjsLib.GlobalWorkerOptions.workerSrc = "/lib/pdf.worker.min.js"; });

mkdirSync(join(KOK, "public", "kapaklar-arka"), { recursive: true });
const rapor = {};
for (const [id, k] of Object.entries(KAPAKLAR)) {
  if (ISTENEN && ISTENEN !== id) continue;
  const png = await sayfa.evaluate(async ({ pdf, dpi }) => {
    const belge = await pdfjsLib.getDocument({ url: "/pdf/" + encodeURIComponent(pdf) }).promise;
    const s = await belge.getPage(1);
    const vp = s.getViewport({ scale: dpi / 72 });
    const c = document.getElementById("c");
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await s.render({ canvasContext: ctx, viewport: vp }).promise;
    return c.toDataURL("image/png");
  }, { pdf: k.pdf, dpi: DPI });
  const kaynak = Buffer.from(png.split(",")[1], "base64");
  const [tl, tt, tw, th] = k.trim;
  const ust = cm(tt + KENAR), yukseklik = cm(th - 2 * KENAR), genislik = cm(k.bw - 2 * KENAR);
  const on = { left: cm(tl + tw - k.bw + KENAR), top: ust, width: genislik, height: yukseklik };
  const arka = { left: cm(tl + KENAR), top: ust, width: genislik, height: yukseklik };
  const f = await sharp(kaynak).extract(on).resize({ width: 1200 }).jpeg({ quality: 88, mozjpeg: true }).toFile(join(KOK, "public", "kapaklar", `${id}.jpg`));
  const a = await sharp(kaynak).extract(arka).resize({ width: 800 }).jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(join(KOK, "public", "kapaklar-arka", `${id}.jpg`));
  await sharp(kaynak).extract(arka).resize({ width: 800 }).webp({ quality: 72, effort: 5 }).toFile(join(KOK, "public", "kapaklar-arka", `${id}.webp`));
  rapor[id] = {
    cover: { source_url: null, source: "yayinevi", local_path: `public/kapaklar/${id}.jpg`, width: f.width, height: f.height },
    back_cover: { local_path: `public/kapaklar-arka/${id}.jpg`, webp_path: `public/kapaklar-arka/${id}.webp`, width: a.width, height: a.height },
    sirt_cm: Number((tw - 2 * k.bw).toFixed(2)),
  };
  console.error(`ok ${id}  ön ${f.width}x${f.height}  arka ${a.width}x${a.height}  sırt ${rapor[id].sirt_cm} cm`);
}
console.log(JSON.stringify(rapor, null, 2));
await tarayici.close();
sunucu.close();
