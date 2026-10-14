// secenek-4 "Editoryal Books" — JSON'dan index.html + kitap.html üretir.
// Çalıştır: node docs/design/secenekler/secenek-4/uret.mjs  (proje kökünden ya da herhangi bir yerden)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const PUB = "../../../../public"; // sayfadan public klasörüne göreli yol
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const books = J("data/catalog/books.json");
const authors = J("data/catalog/authors.json");
const vitrin = J("data/site/vitrin.json");
const site = J("data/site/site.json");
const mt = J("data/site/mikrometin.json");
const kapak = J("data/catalog/kapaklar-opt.json");
const onsoz = J("data/catalog/onsoz-opt.json");
const yayinMd = readFileSync(join(ROOT, "data/site/sayfalar/yayin-cizgisi.md"), "utf8");

// ---------- yardımcılar ----------
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
// tipografik kesme: Allah'a -> Allah’a (yalnizca gorunen metinde; href/src'ye uygulanmaz)
const tipo = (s) => String(s ?? "").replace(/([\p{L}\p{N}])'(\p{L})/gu, "$1’$2");
const tx = (s) => esc(tipo(s));
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const tarih = (d) => {
  if (!d) return "";
  if (d.length === 4) return d;
  const [y, m] = d.split("-");
  return `${AYLAR[Number(m) - 1]} ${y}`;
};
const sortKey = (d) => (!d ? "0000-00-00" : d.length === 4 ? `${d}-00-00` : d);
const byId = Object.fromEntries(books.map((b) => [b.id, b]));
// kapaklar-opt.json'da kaydı olsa da dosyası diskte olmayan kapaklar var (örn. rabbimizi-taniyalim-1); diske bak
const hasCover = (id) => Boolean(kapak[id]) && [320, 640, 960].every((w) => existsSync(join(ROOT, `public/kapaklar-opt/${id}-${w}.webp`)));
const coverSrc = (id, w = 640) => `${PUB}/kapaklar-opt/${id}-${w}.webp`;
const coverAttrs = (id) => {
  const k = kapak[id];
  return k ? `width="${k.genislik}" height="${k.yukseklik}" style="aspect-ratio:${k.genislik}/${k.yukseklik}"` : "";
};
const coverImg = (id, { sizes = "320px", eager = false, cls = "" } = {}) => {
  if (!hasCover(id)) return `<div class="nocover">${tx(mt.bos_durum_gorsel)}</div>`;
  const b = byId[id];
  return `<img class="${cls}" src="${coverSrc(id, 640)}" srcset="${coverSrc(id, 320)} 320w, ${coverSrc(id, 640)} 640w, ${coverSrc(id, 960)} 960w" sizes="${sizes}" alt="${tx(b.title)} kapağı" ${coverAttrs(id)} ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
};
const bookHref = (id) => (id === vitrin.one_cikan ? "kitap.html" : `/kitaplar/${id}/`);
const waHref = (title) => site.whatsapp_url_sablonu.replace("{kitap_adi}", encodeURIComponent(title));
const frontmatter = (md, key) => (md.match(new RegExp(`^${key}:\\s*"?(.+?)"?\\s*$`, "m")) || [])[1] || "";

// ---------- kapak baskın rengi → düz tonlu zemin ----------
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
async function baskinTon(id) {
  // Kapağı küçült, doygun pikselleri hue bölmelerine ayır, en ağır bölmenin dairesel ortalama hue'sunu al.
  const { data, info } = await sharp(join(ROOT, `public/kapaklar-opt/${id}-320.webp`))
    .resize(48, 48, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const bins = new Array(24).fill(0), sx = new Array(24).fill(0), sy = new Array(24).fill(0);
  let doygun = 0, toplam = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const [h, s, l] = rgb2hsl(data[i], data[i + 1], data[i + 2]);
    toplam++;
    if (s < 0.18 || l < 0.12 || l > 0.9) continue;
    doygun++;
    const k = Math.floor(h / 15) % 24, w = s * (1 - Math.abs(l - 0.5));
    bins[k] += w; sx[k] += w * Math.cos((h * Math.PI) / 180); sy[k] += w * Math.sin((h * Math.PI) / 180);
  }
  if (doygun / toplam < 0.06) return { h: 32, tint: "hsl(32 18% 91%)", deep: "hsl(32 22% 30%)", nötr: true }; // sepya/siyah-beyaz kapak → kağıt tonu
  const k = bins.indexOf(Math.max(...bins));
  let h = (Math.atan2(sy[k], sx[k]) * 180) / Math.PI; if (h < 0) h += 360;
  h = Math.round(h);
  return { h, tint: `hsl(${h} 36% 91%)`, deep: `hsl(${h} 42% 28%)`, nötr: false };
}

// ---------- veri seçimi ----------
const haric = new Set(vitrin.vitrin_haric);
// hero'da kahraman olan one_cikan kitap feature kartlarinda ikinci kez gelmez (5 kart = ikili + buyuk + ikili)
const onizlemeli = vitrin.onizleme_vitrini.map((id) => byId[id]).filter(Boolean).filter((b) => b.id !== vitrin.one_cikan);
const yeni = books
  .filter((b) => !b.is_set && !haric.has(b.id))
  .sort((a, b) => sortKey(b.publish_date).localeCompare(sortKey(a.publish_date)))
  .slice(0, vitrin.yeni_cikanlar_adet);
const yazarlar = authors
  .map((a, i) => ({ ...a, i, n: (a.book_ids || []).filter((id) => byId[id]).length }))
  .sort((a, b) => b.n - a.n || a.i - b.i)
  .slice(0, vitrin.yazar_seridi_adet);
const sayilar = {
  kitap: books.length,
  yazar: authors.length,
  onizleme: Object.keys(onsoz).length,
  set: books.filter((b) => b.is_set).length,
};
const oneCikan = byId[vitrin.one_cikan];
const yayinOzet = frontmatter(yayinMd, "ozet");
const yayinAlanlar = [...yayinMd.matchAll(/^## (.+)$/gm)].map((m) => m[1]).filter((t) => t !== "Yayın ilkeleri");
const kanallar = site.satis_kanallari.filter((k) => k.url);
const YIL = 2026;

const tonlar = {};
for (const b of [oneCikan, ...onizlemeli]) tonlar[b.id] ??= await baskinTon(b.id);

// logo: 480×480 PNG'nin içinde görünür alan — nav'da sadece o alanı göstermek için kırpma değerleri
const logoTrim = await sharp(join(ROOT, "public/logo/islambol-logo.png")).trim().toBuffer({ resolveWithObject: true });
const logoMeta = await sharp(join(ROOT, "public/logo/islambol-logo.png")).metadata();
const LOGO_H = 40; // nav'daki görünür yükseklik (elestiri sonrasi 28 -> 35: alt satir okunur)
const lk = LOGO_H / logoTrim.info.height;
const logoCss = `.logo{display:block;width:${Math.round(logoTrim.info.width * lk)}px;height:${LOGO_H}px;overflow:hidden}
.logo img{display:block;width:${Math.round(logoMeta.width * lk)}px;height:${Math.round(logoMeta.height * lk)}px;margin:${Math.round(logoTrim.info.trimOffsetTop * lk)}px 0 0 ${Math.round(logoTrim.info.trimOffsetLeft * lk)}px;max-width:none}`;
const LOGO_FOOT_H = 44;
const lf = LOGO_FOOT_H / logoTrim.info.height;
const logoFootCss = `.logo.lg{width:${Math.round(logoTrim.info.width * lf)}px;height:${LOGO_FOOT_H}px}
.logo.lg img{width:${Math.round(logoMeta.width * lf)}px;height:${Math.round(logoMeta.height * lf)}px;margin:${Math.round(logoTrim.info.trimOffsetTop * lf)}px 0 0 ${Math.round(logoTrim.info.trimOffsetLeft * lf)}px}`;

// ---------- CSS ----------
const css = `
:root{
  --bg:#ffffff; --bg2:#f5f5f7; --ink:#1d1d1f; --ink2:#6e6e73; --line:#d2d2d7; --line2:rgba(0,0,0,.08);
  --accent:#a51c22; --accent-h:#8c161b;
  --serif:"Fraunces","Iowan Old Style","Palatino Linotype",Georgia,serif;
  --sans:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Inter,"Helvetica Neue",Arial,sans-serif;
  --wrap:1200px; --gut:22px; --r-card:20px; --r-feat:28px;
  --ease:cubic-bezier(.2,.7,.2,1); --t:320ms;
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:17px;line-height:1.47;letter-spacing:-0.01em;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;height:auto;display:block}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
h1,h2,h3,.serif{font-family:var(--serif);font-weight:500;letter-spacing:-0.01em;margin:0;font-optical-sizing:auto}
.wrap{max-width:var(--wrap);margin:0 auto;padding:0 var(--gut)}
.skip{position:absolute;left:-999px;top:8px;background:var(--ink);color:#fff;padding:8px 14px;border-radius:980px;z-index:100}
.skip:focus{left:16px}
.eyebrow{font-family:var(--sans);font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);margin:0 0 14px}
.btn{display:inline-flex;align-items:center;gap:8px;border-radius:980px;padding:12px 22px;font-size:15px;font-weight:500;letter-spacing:-0.01em;line-height:1.2;transition:background var(--t) var(--ease),transform var(--t) var(--ease),box-shadow var(--t) var(--ease),border-color var(--t) var(--ease);white-space:nowrap}
.btn:active{transform:scale(.98)}
.btn.p{background:var(--accent);color:#fff}
.btn.p:hover{background:var(--accent-h)}
.btn.d{background:var(--ink);color:#fff}
.btn.d:hover{background:#000}
.btn.g{border:1px solid rgba(0,0,0,.22);color:var(--ink);background:transparent}
.btn.g:hover{background:rgba(0,0,0,.05);border-color:rgba(0,0,0,.35)}
.btn.w{background:#fff;color:var(--ink)}
.btn.w:hover{background:#f0f0f2}
.btn.sm{padding:8px 15px;font-size:13px}
.btn svg{width:16px;height:16px;flex:none}
.more{display:inline-flex;align-items:center;gap:4px;font-size:15px;font-weight:500;color:var(--ink);white-space:nowrap}
.more .chev{transition:transform var(--t) var(--ease)}
.more:hover .chev{transform:translateX(3px)}
.chev{display:inline-block;width:8px;height:8px;border-right:1.5px solid currentColor;border-top:1.5px solid currentColor;transform:rotate(45deg);margin-left:4px}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px;border-radius:6px}

/* ---- nav ---- */
.nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.72);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--line2)}
.nav .wrap{height:56px;display:flex;align-items:center;gap:24px}
${logoCss}
${logoFootCss}
.nav .wrap>nav{flex:1;display:flex;justify-content:center}
.menu{display:flex;gap:26px;margin:0;padding:0;list-style:none}
.menu a{font-size:14px;color:var(--ink);opacity:.86;transition:opacity var(--t) var(--ease)}
.menu a:hover{opacity:1}
.burger{display:none;width:40px;height:40px;position:relative;margin-left:auto}
.burger span{position:absolute;left:11px;width:18px;height:1.5px;background:var(--ink);transition:transform var(--t) var(--ease),opacity var(--t) var(--ease)}
.burger span:first-child{top:15px}.burger span:last-child{top:23px}
.nav.open .burger span:first-child{transform:translateY(4px) rotate(45deg)}
.nav.open .burger span:last-child{transform:translateY(-4px) rotate(-45deg)}
.mmenu{display:none}
@media (max-width:980px){
  .nav .wrap>nav{display:none}
  .burger{display:block}
  .nav .cta{display:none}
  .nav.open .mmenu{display:block;position:absolute;left:0;right:0;top:56px;background:#fff;box-shadow:0 24px 40px -24px rgba(0,0,0,.18);border-bottom:1px solid var(--line2);padding:8px 0 16px}
  .nav.open{background:#fff}
  .mmenu ul{list-style:none;margin:0;padding:0}
  .mmenu a{display:block;padding:12px var(--gut);font-size:18px;font-weight:500}
  .mmenu .btn{margin:10px var(--gut) 0}
}

/* ---- bölüm ritmi ---- */
.sec{padding:clamp(64px,8vw,116px) 0}
.sec.gray{background:var(--bg2)}
.chap{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:clamp(28px,4vw,48px)}
.chap h2{font-size:clamp(32px,4.2vw,52px);line-height:1.05}
.chap .lead{font-size:19px;line-height:1.42;color:var(--ink2);max-width:620px;margin:14px 0 0}
.chap .more{margin-bottom:8px}
@media (max-width:700px){.chap{flex-direction:column;align-items:flex-start}.chap .more{margin:4px 0 0}}

/* ---- hero ---- */
.hero{padding:clamp(40px,6vw,80px) 0 clamp(48px,6vw,96px)}
.hero .wrap{display:grid;grid-template-columns:.92fr 1.08fr;gap:clamp(32px,5vw,72px);align-items:center}
.hero h1{font-size:clamp(40px,4.8vw,68px);line-height:1.02;letter-spacing:-0.012em;text-wrap:balance}
.hero .alt{font-size:clamp(18px,1.6vw,21px);line-height:1.42;color:var(--ink2);max-width:480px;margin:24px 0 32px}
.hero .ctas{display:flex;flex-wrap:wrap;gap:12px}
.hero .facts{display:flex;flex-wrap:wrap;gap:6px 18px;margin:36px 0 0;padding:0;list-style:none;font-size:14px;color:var(--ink2)}
.hero .facts b{color:var(--ink);font-weight:600}
.plate{position:relative;border-radius:32px;padding:56px 40px 64px;display:grid;place-items:center;overflow:hidden}
.plate img{width:min(100%,400px);mix-blend-mode:multiply;filter:brightness(1.04);transition:transform 600ms var(--ease)}
.plate:hover img{transform:translateY(-6px)}
@media (max-width:860px){
  .hero .wrap{grid-template-columns:1fr}
  .plate{max-width:460px;margin:0 auto;width:100%;padding:40px 28px 48px}
  .plate img{width:min(64%,400px)}
}

/* ---- feature kartları (önizlemeli) ---- */
.feats{display:grid;gap:20px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.feat{position:relative;border-radius:var(--r-feat);padding:clamp(28px,4vw,56px);display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(20px,3vw,40px);align-items:center;overflow:hidden;transition:transform var(--t) var(--ease)}
.feat .txt{position:relative;z-index:1}
.feat .eyebrow{color:var(--deep)}
.feat h3{font-size:clamp(32px,3.8vw,56px);line-height:1.04;text-wrap:balance}
.feat .au{font-size:17px;color:#515154;margin:14px 0 26px}
.feat .cv{display:grid;place-items:center;position:relative}
/* zemin golgesi: kapak fotografindaki gomulu golgenin duz kesilen alt kenarini yumusatir.
   ::before img'den once boyanir, multiply onun ustune biner. .cv'ye isolation/mask VERME: multiply olur. */
.feat .cv::before{content:"";position:absolute;left:4%;right:2%;bottom:-12px;height:34px;background:radial-gradient(closest-side,rgba(0,0,0,.46),transparent);filter:blur(7px);pointer-events:none}
.feat .cv img{width:min(100%,360px);mix-blend-mode:multiply;filter:brightness(1.04);transition:transform 600ms var(--ease)}
.feat:hover .cv img{transform:translateY(-6px)}
.feat.half{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);column-gap:clamp(16px,1.8vw,26px);padding:clamp(24px,2.6vw,36px);min-height:360px}
.feat.half h3{font-size:clamp(28px,2.7vw,38px);line-height:1.06}
.feat.half .cv img{width:min(100%,260px)}
.feat.half .au{margin:10px 0 20px;font-size:15px}
.feat.big{grid-template-columns:minmax(0,440px) minmax(0,360px);justify-content:center;column-gap:clamp(40px,8vw,128px);min-height:0}
.feat.big h3{font-size:clamp(40px,4.6vw,68px);letter-spacing:-0.015em}
.nocover{aspect-ratio:3/4.4;background:rgba(0,0,0,.05);border-radius:8px;display:grid;place-items:center;font-size:13px;color:var(--ink2);padding:12px;text-align:center}
@media (max-width:980px){.pair{grid-template-columns:1fr}}
@media (max-width:700px){
  /* Apple Books/Today gibi yatay snap rafi: 5 kart tek sutun yigini yerine kaydirilir */
  .feats{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 calc(var(--gut)*-1);padding:0 var(--gut) 14px;scroll-padding-inline:var(--gut);scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .feats::-webkit-scrollbar{display:none}
  .pair{display:contents}
  .feat,.feat.half,.feat.big{flex:0 0 82%;scroll-snap-align:start;min-height:0;grid-template-columns:minmax(0,1fr);padding:28px 24px 24px;justify-content:stretch}
  .js .feats .feat.rv{opacity:1;transform:none}
  .feat .cv{order:-1}
  .feat .cv img,.feat.half .cv img{width:min(64%,240px)}
  .feat h3,.feat.half h3,.feat.big h3{font-size:clamp(28px,7.6vw,36px)}
}

/* ---- raf (yeni çıkanlar) ---- */
.shelf .chap{margin-bottom:28px}
.arrows{display:flex;gap:10px;margin-bottom:6px}
.arrows button{width:40px;height:40px;border-radius:50%;background:#fff;border:1px solid var(--line);display:grid;place-items:center;transition:background var(--t) var(--ease),opacity var(--t) var(--ease)}
.arrows button:hover{background:#ececef}
.arrows button[disabled]{opacity:.35;cursor:default}
.arrows .chev{margin:0}
.arrows .l .chev{transform:rotate(-135deg);margin-left:3px}
.track{display:flex;gap:20px;overflow-x:auto;scroll-snap-type:x mandatory;padding:8px max(var(--gut),calc((100% - var(--wrap))/2 + var(--gut))) 24px;scroll-padding-inline:max(var(--gut),calc((100% - var(--wrap))/2 + var(--gut)));scrollbar-width:none;-webkit-overflow-scrolling:touch}
.track::-webkit-scrollbar{display:none}
.card{flex:none;width:224px;scroll-snap-align:start;display:flex;flex-direction:column}
.card .tray{background:#fff;border-radius:var(--r-card);padding:22px 20px;aspect-ratio:1/1.26;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.03),0 10px 30px -14px rgba(0,0,0,.14);transition:transform var(--t) var(--ease),box-shadow var(--t) var(--ease)}
.card .tray img{width:auto;height:100%;max-width:100%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.04)}
.card:hover .tray{transform:translateY(-5px);box-shadow:0 2px 4px rgba(0,0,0,.04),0 24px 44px -18px rgba(0,0,0,.22)}
.card .meta{padding:14px 2px 0;flex:1;display:flex;flex-direction:column}
.card .date{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)}
.card h3{font-size:19px;line-height:1.22;margin:6px 0 4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card .au{font-size:14px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:auto;padding-top:4px}
@media (max-width:700px){.card{width:168px}.card .tray{padding:20px 18px}.card h3{font-size:17px;-webkit-line-clamp:4}}

/* ---- yazarlar ---- */
.auths{display:grid;grid-template-columns:1fr 1fr;column-gap:64px}
.auth{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:20px;padding:18px 0;border-top:1px solid var(--line);transition:background var(--t) var(--ease)}
.auths .auth:nth-last-child(-n+2){border-bottom:1px solid var(--line)}
.fan{position:relative;width:88px;height:68px}
.fan img,.fan .ph{position:absolute;bottom:0;width:44px;height:64px;object-fit:cover;object-position:top;border-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,.15),0 6px 14px -4px rgba(0,0,0,.25);background:#f0f0f2;transition:transform var(--t) var(--ease)}
.fan .ph{display:grid;place-items:center;font-family:var(--serif);font-size:20px;color:var(--ink2)}
.fan > :nth-child(1){left:0;z-index:3}
.fan > :nth-child(2){left:20px;z-index:2;transform:scale(.94);transform-origin:bottom}
.fan > :nth-child(3){left:40px;z-index:1;transform:scale(.88);transform-origin:bottom}
.auth:hover .fan > :nth-child(2){transform:scale(.94) translateX(2px)}
.auth:hover .fan > :nth-child(3){transform:scale(.88) translateX(4px)}
.auth .nm{font-family:var(--serif);font-weight:500;letter-spacing:-0.01em;font-size:24px;line-height:1.15}
.auth .ct{font-size:14px;color:var(--ink2);margin-top:4px}
.auth .chev{width:10px;height:10px;color:var(--ink2);transition:transform var(--t) var(--ease)}
.auth:hover .chev{transform:rotate(45deg) translate(2px,-2px)}
@media (max-width:860px){.auths{grid-template-columns:1fr}.auths .auth:nth-last-child(2){border-bottom:0}}
@media (max-width:700px){
  .fan{width:64px;height:52px}
  .fan img,.fan .ph{width:34px;height:50px}
  .fan>:nth-child(2){left:14px}
  .fan>:nth-child(3){left:28px}
  .auth{gap:14px}
  .auth .nm{font-size:21px}
}

/* ---- yayın çizgisi ---- */
.line .wrap{display:grid;grid-template-columns:1fr 1.4fr;gap:clamp(28px,5vw,80px);align-items:start}
.line .chap{margin:0;display:block}
.line .pull{font-family:var(--serif);font-size:clamp(22px,2.3vw,31px);line-height:1.3;letter-spacing:-0.01em;margin:0 0 28px;text-wrap:pretty}
.areas{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 28px;padding:0;list-style:none}
.areas li{font-size:14px;font-weight:500;padding:8px 14px;border:1px solid var(--line);border-radius:980px;background:#fff}
@media (max-width:860px){.line .wrap{grid-template-columns:1fr}}

/* ---- nereden alınır ---- */
.buy .grid{display:grid;grid-template-columns:1fr 1.15fr;gap:20px;align-items:stretch}
.wa{background:var(--ink);color:#fff;border-radius:var(--r-feat);padding:clamp(28px,3.5vw,48px);display:flex;flex-direction:column;justify-content:space-between;gap:28px;box-shadow:0 30px 60px -30px rgba(0,0,0,.45)}
.wa .eyebrow{color:rgba(255,255,255,.6)}
.wa h3{font-size:clamp(28px,2.6vw,36px);line-height:1.08}
.wa .tel{font-family:var(--serif);font-size:clamp(30px,3vw,42px);letter-spacing:-0.01em;margin:16px 0 8px;font-weight:500}
.wa .note{color:rgba(255,255,255,.66);font-size:15px;margin:0}
.chan{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.chan li{border-top:1px solid var(--line)}
.chan li:last-child{border-bottom:1px solid var(--line)}
.chan a{display:grid;grid-template-columns:1fr auto;align-items:center;gap:16px;padding:20px 4px;transition:background var(--t) var(--ease)}
.chan a:hover{background:var(--bg2)}
.chan .nm{font-family:var(--serif);font-size:23px;font-weight:500;line-height:1.15}
.chan .nt{font-size:14px;color:var(--ink2);margin-top:3px}
.chan .ext{width:18px;height:18px;color:var(--ink2);transition:transform var(--t) var(--ease)}
.chan a:hover .ext{transform:translate(2px,-2px)}
.fine{font-size:13px;color:var(--ink2);margin:28px 0 0;max-width:720px}
@media (max-width:860px){.buy .grid{grid-template-columns:1fr}}

/* ---- footer ---- */
.foot{background:var(--bg2);border-top:1px solid var(--line2);padding:48px 0 32px;font-size:13px;color:var(--ink2)}
.foot .top{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:32px;padding-bottom:32px;border-bottom:1px solid var(--line)}
.foot .slogan{font-family:var(--serif);font-size:19px;color:var(--ink);margin:14px 0 0;font-weight:500}
.foot h4{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);margin:0 0 12px}
.foot ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.foot a:hover{color:var(--ink);text-decoration:underline}
.foot .bot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;padding-top:20px;font-size:12px}
@media (max-width:860px){.foot .top{grid-template-columns:1fr 1fr}}
@media (max-width:480px){.foot .top{grid-template-columns:1fr}}

/* ---- kitap sayfası ---- */
.crumb{font-size:13px;color:var(--ink2);padding:18px 0 0;display:flex;gap:8px;align-items:center}
.crumb .chev{width:6px;height:6px;margin:0}
.bhero{padding:clamp(28px,4vw,56px) 0 clamp(48px,6vw,88px)}
.bhero .wrap{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(28px,5vw,72px);align-items:center}
.bhero .plate{padding:48px}
.bhero .plate img{width:66%}
.bhero h1{font-size:clamp(40px,5.2vw,76px);line-height:1.02;letter-spacing:-0.016em;text-wrap:balance}
.bhero .au{font-size:21px;color:var(--ink2);margin:16px 0 0}
.bhero .tags{display:flex;flex-wrap:wrap;gap:6px 14px;margin:22px 0 30px;padding:0;list-style:none;font-size:14px;color:var(--ink2)}
.bhero .tags li+li::before{content:"·";margin-right:14px}
.bhero .ctas{display:flex;flex-wrap:wrap;gap:12px}
@media (max-width:860px){.bhero .wrap{grid-template-columns:1fr}.bhero .plate{max-width:420px;margin:0 auto;width:100%}}
.about .wrap{display:grid;grid-template-columns:1.3fr .8fr;gap:clamp(32px,5vw,80px);align-items:start}
.about .desc{font-size:19px;line-height:1.55;max-width:680px}
.about .desc p{margin:0 0 1.2em}
.about .desc h2+p{font-family:var(--serif);font-size:clamp(22px,2.1vw,27px);line-height:1.35;letter-spacing:-0.01em}
.kunye{background:var(--bg2);border-radius:var(--r-card);padding:28px 30px;position:sticky;top:76px}
.kunye h3{font-size:24px;margin-bottom:14px}
.kunye dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:10px 22px;font-size:15px}
.kunye dt{color:var(--ink2)}
.kunye dd{margin:0;font-weight:500}
@media (max-width:860px){.about .wrap{grid-template-columns:1fr}.kunye{position:static}}
.prev .chap{margin-bottom:32px}
.book{position:relative;max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;background:#fff;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.06),0 40px 80px -30px rgba(0,0,0,.35)}
.book .pg{position:relative;overflow:hidden;background:#fff}
.book .pg:first-child{border-radius:10px 2px 2px 10px;box-shadow:inset -22px 0 28px -22px rgba(0,0,0,.28)}
.book .pg:last-child{border-radius:2px 10px 10px 2px;box-shadow:inset 22px 0 28px -22px rgba(0,0,0,.28)}
.book .pg img{width:100%;height:auto;display:block;margin-top:-12px;transition:opacity var(--t) var(--ease)}
/* cilt kivrimi: img ic golgeyi ortugu icin golge sayfalarin USTUNE biner */
.book::after{content:"";position:absolute;inset:0;border-radius:10px;pointer-events:none;background:linear-gradient(90deg,transparent calc(50% - 44px),rgba(0,0,0,.07) calc(50% - 6px),rgba(0,0,0,.20) 50%,rgba(0,0,0,.07) calc(50% + 6px),transparent calc(50% + 44px))}
.pgb{display:block;width:100%;padding:0;cursor:zoom-in;background:none;border:0;font:inherit;color:inherit}
.pgb:focus-visible{outline-offset:-3px}
dialog.lb{border:0;padding:0;background:transparent;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;overflow:hidden}
dialog.lb[open]{display:grid;place-items:center}
dialog.lb::backdrop{background:rgba(20,20,22,.78);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.lb img{max-height:calc(100vh - 56px);max-width:min(calc(100vw - 32px),640px);width:auto;height:auto;border-radius:6px;background:#fff;box-shadow:0 40px 90px -20px rgba(0,0,0,.6)}
.lb .lbx{position:absolute;top:16px;right:16px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.92);color:var(--ink);font-size:26px;line-height:1;display:grid;place-items:center;transition:background var(--t) var(--ease)}
.lb .lbx:hover{background:#fff}
.book .pg img.sw{opacity:0}
.prev .ctl{display:flex;align-items:center;justify-content:center;gap:16px;margin:28px 0 0;font-size:14px;color:var(--ink2)}
.prev .ctl .arrows{margin:0}
.prev .note{text-align:center;font-size:13px;color:var(--ink2);margin:14px 0 0}
@media (max-width:600px){.book{grid-template-columns:1fr 1fr;border-radius:6px}}

/* ---- scroll reveal ---- */
.js .rv{opacity:0;transform:translateY(14px);transition:opacity 560ms var(--ease),transform 560ms var(--ease)}
.js .rv.in{opacity:1;transform:none}
@media print{.js .rv{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .js .rv{opacity:1;transform:none;transition:none}
  *{transition-duration:0ms!important}
}
`;

// ---------- ortak JS ----------
const js = `
(function(){
  var nav=document.querySelector('.nav'),bg=document.querySelector('.burger');
  if(bg){bg.addEventListener('click',function(){var o=nav.classList.toggle('open');bg.setAttribute('aria-expanded',o);bg.setAttribute('aria-label',o?${JSON.stringify(mt.menu_kapat)}:${JSON.stringify(mt.menu_ac)});});}
  var rv=[].slice.call(document.querySelectorAll('.rv'));
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.1,rootMargin:'0px 0px -6% 0px'});
    rv.forEach(function(el){io.observe(el);});
  }else{rv.forEach(function(el){el.classList.add('in');});}
  document.querySelectorAll('.shelf').forEach(function(s){
    var t=s.querySelector('.track'),l=s.querySelector('.arrows .l'),r=s.querySelector('.arrows .r');
    if(!t||!l||!r)return;
    function upd(){l.disabled=t.scrollLeft<=2;r.disabled=t.scrollLeft+t.clientWidth>=t.scrollWidth-2;}
    l.addEventListener('click',function(){t.scrollBy({left:-t.clientWidth*.8,behavior:'smooth'});});
    r.addEventListener('click',function(){t.scrollBy({left:t.clientWidth*.8,behavior:'smooth'});});
    t.addEventListener('scroll',upd,{passive:true});window.addEventListener('resize',upd);upd();
  });
})();
`;

const svgWa = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>`;
const svgExt = `<svg class="ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>`;

const head = (title, desc) => `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tx(title)}</title>
<meta name="description" content="${tx(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script>document.documentElement.classList.add('js')</script>
<style>${css}</style>
</head>
<body>
<a class="skip" href="#main">${tx(mt.skip_link)}</a>
<header class="nav">
  <div class="wrap">
    <a class="logo" href="index.html" aria-label="${tx(site.ad)}"><img src="${PUB}/logo/islambol-logo.png" alt="${tx(site.ad)}" width="${logoMeta.width}" height="${logoMeta.height}"></a>
    <nav aria-label="Ana menü"><ul class="menu">${site.menu.map((m) => `<li><a href="${esc(m.url)}">${tx(m.etiket)}</a></li>`).join("")}</ul></nav>
    <a class="btn p sm cta" href="${esc(site.whatsapp_url)}" target="_blank" rel="noopener">${svgWa}WhatsApp</a>
    <button class="burger" aria-expanded="false" aria-label="${tx(mt.menu_ac)}"><span></span><span></span></button>
  </div>
  <div class="mmenu"><ul>${site.menu.map((m) => `<li><a href="${esc(m.url)}">${tx(m.etiket)}</a></li>`).join("")}</ul><a class="btn p" href="${esc(site.whatsapp_url)}" target="_blank" rel="noopener">${svgWa}${tx(mt.whatsapp_cta)}</a></div>
</header>
<main id="main">`;

const footer = `
<footer class="foot">
  <div class="wrap">
    <div class="top">
      <div>
        <a class="logo lg" href="index.html" aria-label="${tx(site.ad)}"><img src="${PUB}/logo/islambol-logo.png" alt="" width="${logoMeta.width}" height="${logoMeta.height}"></a>
        <p class="slogan">${tx(site.slogan)}</p>
      </div>
      <div><h4>Site</h4><ul>${site.footer_menu.map((m) => `<li><a href="${esc(m.url)}">${tx(m.etiket)}</a></li>`).join("")}</ul></div>
      <div><h4>İletişim</h4><ul><li>${tx(site.adres)}</li><li><a href="tel:${esc(site.telefon.replace(/\s/g, ""))}">${tx(site.telefon_gosterim)}</a></li><li><a href="mailto:${esc(site.eposta)}">${tx(site.eposta)}</a></li></ul></div>
      <div><h4>Sosyal</h4><ul><li><a href="${esc(site.sosyal.x)}" target="_blank" rel="noopener">X</a></li><li><a href="${esc(site.sosyal.instagram)}" target="_blank" rel="noopener">Instagram</a></li><li><a href="${esc(site.sosyal.facebook)}" target="_blank" rel="noopener">Facebook</a></li></ul></div>
    </div>
    <div class="bot"><span>${tx(mt.footer_telif.replace("{yil}", String(YIL)))}</span><span>${tx(mt.kvkk_kisa)}</span></div>
  </div>
</footer>
<script>${js}</script>
</body>
</html>`;

// ---------- parçalar ----------
const featCard = (b, cls) => {
  const t = tonlar[b.id];
  return `<article class="feat ${cls} rv" style="background:${t.tint};--deep:${t.deep}">
    <div class="txt">
      <p class="eyebrow">${tx(mt.onizle)}meli · ${tx(tarih(b.publish_date))}</p>
      <h3><a href="${bookHref(b.id)}">${tx(b.title)}</a></h3>
      <p class="au">${tx(b.author_display || "")}${b.pages ? ` · ${b.pages} sayfa` : ""}</p>
      <a class="btn d" href="${bookHref(b.id)}#onizleme">${tx(mt.onizle_uzun)}</a>
    </div>
    <a class="cv" href="${bookHref(b.id)}" tabindex="-1" aria-hidden="true">${coverImg(b.id, { sizes: cls === "big" ? "(max-width:700px) 60vw, 360px" : "(max-width:700px) 60vw, 230px" })}</a>
  </article>`;
};

const shelfCard = (b) => `<a class="card rv" href="${bookHref(b.id)}">
  <div class="tray">${coverImg(b.id, { sizes: "(max-width:700px) 130px, 170px" })}</div>
  <div class="meta"><div class="date">${tx(tarih(b.publish_date))}</div><h3>${tx(b.title)}</h3><div class="au">${tx(b.author_display || "")}</div></div>
</a>`;

const authRow = (a) => {
  const covs = (a.book_ids || []).filter(hasCover).slice(0, 3);
  const fan = covs.length
    ? covs.map((id) => `<img src="${coverSrc(id, 320)}" alt="" loading="lazy" decoding="async" ${coverAttrs(id)}>`).join("")
    : `<span class="ph">${tx(a.display.charAt(0))}</span>`;
  return `<a class="auth rv" href="/yazarlar/${esc(a.slug)}/">
    <div class="fan">${fan}</div>
    <div><div class="nm">${tx(a.display)}</div><div class="ct">${a.n} kitap</div></div>
    <span class="chev" aria-hidden="true"></span>
  </a>`;
};

// ---------- index.html ----------
const heroTon = tonlar[oneCikan.id];
const index = `${head(`${site.ad} — ${site.slogan}`, mt.hero_alt_baslik)}
<section class="hero" aria-labelledby="hero-h">
  <div class="wrap">
    <div>
      <p class="eyebrow">${tx(site.ad)} · ${sayilar.kitap} kitap</p>
      <h1 id="hero-h">${tx(mt.hero_basliklar[0])}</h1>
      <p class="alt">${tx(mt.hero_alt_baslik)}</p>
      <div class="ctas"><a class="btn p" href="/kitaplar/">${tx(mt.hero_cta_birincil)}</a><a class="btn g" href="kitap.html#onizleme">${tx(mt.onizle_uzun)}</a></div>
      <ul class="facts"><li><b>${sayilar.kitap}</b> kitap</li><li><b>${sayilar.yazar}</b> yazar</li><li><b>${sayilar.onizleme}</b> önizlemeli kitap</li><li><b>${sayilar.set}</b> set</li></ul>
    </div>
    <a class="plate" href="${bookHref(oneCikan.id)}" style="background:${heroTon.tint}">
      ${coverImg(oneCikan.id, { sizes: "(max-width:860px) 60vw, 380px", eager: true })}
    </a>
  </div>
</section>

<section class="sec" aria-labelledby="oniz-h" style="padding-top:0">
  <div class="wrap">
    <div class="chap rv">
      <div><p class="eyebrow">${tx(mt.onizleme_baslik)} · ${onizlemeli.length} kitap daha</p><h2 id="oniz-h">Önizlemeli kitaplar</h2><p class="lead">${tx(mt.bolum_giris.onizlemeli)}</p></div>
      <a class="more" href="/kitaplar/">${tx(mt.tum_kitaplar)}<span class="chev"></span></a>
    </div>
    <div class="feats">
      <div class="pair">${featCard(onizlemeli[0], "half")}${featCard(onizlemeli[1], "half")}</div>
      ${featCard(onizlemeli[2], "big")}
      <div class="pair">${featCard(onizlemeli[3], "half")}${featCard(onizlemeli[4], "half")}</div>
    </div>
  </div>
</section>

<section class="sec gray shelf" aria-labelledby="yeni-h">
  <div class="wrap">
    <div class="chap rv">
      <div><p class="eyebrow">Katalog · en yeni ${yeni.length} kitap</p><h2 id="yeni-h">Yeni çıkanlar</h2><p class="lead">${tx(mt.bolum_giris.yeni_cikanlar)}</p></div>
      <div class="arrows"><button class="l" aria-label="${tx(mt.onceki)}"><span class="chev"></span></button><button class="r" aria-label="${tx(mt.sonraki)}"><span class="chev"></span></button></div>
    </div>
  </div>
  <div class="track">${yeni.map(shelfCard).join("")}</div>
</section>

<section class="sec" aria-labelledby="yazar-h">
  <div class="wrap">
    <div class="chap rv">
      <div><p class="eyebrow">${sayilar.yazar} yazar · en çok kitabı olan ${yazarlar.length}</p><h2 id="yazar-h">Yazarlar</h2><p class="lead">${tx(mt.bolum_giris.yazarlar)}</p></div>
      <a class="more" href="/yazarlar/">${tx(mt.tum_yazarlar)}<span class="chev"></span></a>
    </div>
    <div class="auths">${yazarlar.map(authRow).join("")}</div>
  </div>
</section>

<section class="sec gray line" aria-labelledby="cizgi-h">
  <div class="wrap">
    <div class="chap rv"><p class="eyebrow">Yayınevi</p><h2 id="cizgi-h">Yayın çizgisi</h2><p class="lead">${tx(mt.bolum_giris.yayin_cizgisi)}</p></div>
    <div class="rv">
      <p class="pull">${tx(yayinOzet)}</p>
      <ul class="areas">${yayinAlanlar.map((a) => `<li>${tx(a)}</li>`).join("")}</ul>
      <a class="more" href="/yayin-cizgisi/">${tx(mt.devami)}<span class="chev"></span></a>
    </div>
  </div>
</section>

<section class="sec buy" aria-labelledby="al-h">
  <div class="wrap">
    <div class="chap rv"><div><p class="eyebrow">${kanallar.length} kitabevi sitesi · WhatsApp hattı</p><h2 id="al-h">${tx(mt.nereden_alinir)}</h2><p class="lead">${tx(mt.bolum_giris.nereden_alinir)}</p></div></div>
    <div class="grid">
      <div class="wa rv">
        <div><p class="eyebrow">WhatsApp sipariş hattı</p><h3>Yayınevine doğrudan yazın</h3><p class="tel">${tx(site.telefon_gosterim)}</p><p class="note">${tx(mt.whatsapp_not)}</p></div>
        <div><a class="btn p" href="${esc(site.whatsapp_url)}" target="_blank" rel="noopener">${svgWa}${tx(mt.whatsapp_cta)}</a></div>
      </div>
      <ul class="chan rv">${kanallar.map((k) => `<li><a href="${esc(k.url)}" target="_blank" rel="noopener"><span><span class="nm">${tx(k.ad)}</span><div class="nt">${tx(k.not)}</div></span>${svgExt}</a></li>`).join("")}</ul>
    </div>
    <p class="fine">${tx(mt.footer_not)} ${tx(mt.nereden_alinir_not)}</p>
  </div>
</section>
</main>
${footer}`;

// ---------- kitap.html ----------
const b = oneCikan;
const bt = tonlar[b.id];
// acik kitap 1100 px; webp 486 px buyuyunce yumusadigi icin 607 px'lik ozgun jpg kullanilir
const sayfalar = Object.keys(onsoz[b.id]).sort((x, y) => Number(x) - Number(y)).map((n) => `${PUB}${(onsoz[b.id][n].jpg?.[0] || onsoz[b.id][n].webp[0]).url}`);
const sayfaMeta = await sharp(join(ROOT, "public", onsoz[b.id]["1"].webp[0].url)).metadata(); // açık kitap mock'u için gerçek oran
const kaynakAd = { kitapyurdu: "Kitapyurdu", nobelkitap: "Nobel Kitap", kureselkitap: "Küresel Kitap" };
const kitapKanallar = Object.entries(b.sources || {}).filter(([k, v]) => kaynakAd[k] && typeof v === "string");
const kategori = (b.categories || []).map((c) => c.split(">").pop().trim()).find(Boolean) || "";
const kunye = [
  [mt.kunye_yazar, b.author_display],
  [mt.kunye_isbn, b.isbn],
  [mt.kunye_sayfa, b.pages ? `${b.pages} sayfa` : mt.kunye_belirtilmemis],
  [mt.kunye_boyut, b.dimensions ? b.dimensions.replace(/\./g, ",").replace(" x ", " × ") : mt.kunye_belirtilmemis],
  [mt.kunye_cilt, b.binding || mt.kunye_belirtilmemis],
  [mt.kunye_yil, tarih(b.publish_date) || mt.kunye_belirtilmemis],
  [mt.kunye_dil, b.language === "tr" ? "Türkçe" : b.language || mt.kunye_belirtilmemis],
];

const kitap = `${head(`${b.title} — ${b.author_display} | ${site.ad}`, b.description.split("\n")[0].slice(0, 155))}
<div class="wrap"><nav class="crumb" aria-label="Konum"><a href="index.html">Ana sayfa</a><span class="chev"></span><a href="/kitaplar/">Kitaplar</a><span class="chev"></span><span>${tx(b.title)}</span></nav></div>
<section class="bhero" aria-labelledby="k-h">
  <div class="wrap">
    <div class="plate" style="background:${bt.tint}">${coverImg(b.id, { sizes: "(max-width:860px) 66vw, 360px", eager: true })}</div>
    <div>
      <p class="eyebrow" style="color:${bt.deep}">${tx(mt.onizle)}meli · ${tx(kategori)}</p>
      <h1 id="k-h">${tx(b.title)}</h1>
      <p class="au">${tx(b.author_display)}</p>
      <ul class="tags"><li>${b.pages} sayfa</li><li>${tx(tarih(b.publish_date))}</li><li>${tx(b.binding)}</li><li>${tx(b.dimensions.replace(/\./g, ",").replace(" x ", " × "))}</li></ul>
      <div class="ctas"><a class="btn p" href="#onizleme">${tx(mt.onizle_uzun)}</a><a class="btn d" href="${esc(waHref(b.title))}" target="_blank" rel="noopener">${svgWa}${tx(mt.whatsapp_cta)}</a></div>
    </div>
  </div>
</section>

<section class="sec about" style="padding-top:0" aria-labelledby="hak-h">
  <div class="wrap">
    <div class="desc rv"><h2 id="hak-h" class="eyebrow" style="font-family:var(--sans)">Kitap hakkında</h2>${b.description.split(/\n\s*\n/).map((p) => `<p>${tx(p)}</p>`).join("")}</div>
    <aside class="kunye rv"><h3>${tx(mt.kunye)}</h3><dl>${kunye.map(([k, v]) => `<dt>${tx(k)}</dt><dd>${tx(v)}</dd>`).join("")}</dl></aside>
  </div>
</section>

<section class="sec gray prev" id="onizleme" aria-labelledby="on-h">
  <div class="wrap">
    <div class="chap rv"><div><p class="eyebrow">${tx(mt.onizle)} · ${sayfalar.length} sayfa</p><h2 id="on-h">${tx(mt.onizleme_baslik)}</h2><p class="lead">${tx(mt.bolum_giris.onizlemeli)}</p></div></div>
    <div class="book rv" id="book">
      <div class="pg"><button class="pgb" type="button" aria-label="${tx(b.title)}: 1. sayfayı büyüt"><img id="pgL" src="${sayfalar[0]}" alt="${tx(b.title)}, 1. sayfa" width="${sayfaMeta.width}" height="${sayfaMeta.height}" style="aspect-ratio:${sayfaMeta.width}/${sayfaMeta.height}" loading="eager" decoding="async"></button></div>
      <div class="pg"><button class="pgb" type="button" aria-label="${tx(b.title)}: 2. sayfayı büyüt"><img id="pgR" src="${sayfalar[1]}" alt="${tx(b.title)}, 2. sayfa" width="${sayfaMeta.width}" height="${sayfaMeta.height}" style="aspect-ratio:${sayfaMeta.width}/${sayfaMeta.height}" loading="eager" decoding="async"></button></div>
    </div>
    <div class="ctl rv"><div class="arrows"><button class="l" id="pgPrev" aria-label="${tx(mt.onceki)}"><span class="chev"></span></button><button class="r" id="pgNext" aria-label="${tx(mt.sonraki)}"><span class="chev"></span></button></div><span id="pgCount">${mt.sayfa_sayaci.replace("{n}", "1–2").replace("{toplam}", String(sayfalar.length))}</span></div>
    <p class="note">${tx(mt.onizleme_notu)} Sayfayı büyütmek için üzerine tıklayın.</p>
  </div>
</section>

<section class="sec buy" aria-labelledby="al-h">
  <div class="wrap">
    <div class="chap rv"><div><p class="eyebrow">${tx(b.title)}</p><h2 id="al-h">${tx(mt.nereden_alinir)}</h2><p class="lead">${tx(mt.bolum_giris.nereden_alinir)}</p></div></div>
    <div class="grid">
      <div class="wa rv">
        <div><p class="eyebrow">WhatsApp sipariş hattı</p><h3>${tx(b.title)} için yazın</h3><p class="tel">${tx(site.telefon_gosterim)}</p><p class="note">${tx(mt.whatsapp_not)}</p></div>
        <div><a class="btn p" href="${esc(waHref(b.title))}" target="_blank" rel="noopener">${svgWa}${tx(mt.whatsapp_cta)}</a></div>
      </div>
      <ul class="chan rv">${kitapKanallar.map(([k, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener"><span><span class="nm">${tx(kaynakAd[k])}</span><div class="nt">${tx(mt.satis_sayfasina_git.replace("{ad}", kaynakAd[k]))}</div></span>${svgExt}</a></li>`).join("")}</ul>
    </div>
    <p class="fine">${tx(mt.footer_not)} ${tx(mt.nereden_alinir_not)}</p>
  </div>
</section>
</main>
<dialog class="lb" id="lb" aria-label="${tx(b.title)}: büyütülmüş sayfa"><button class="lbx" type="button" aria-label="${tx(mt.kapat)}">×</button><img id="lbImg" alt=""></dialog>
${footer.replace("</script>", `
(function(){
  var P=${JSON.stringify(sayfalar)},i=0,L=document.getElementById('pgL'),R=document.getElementById('pgR'),C=document.getElementById('pgCount'),pv=document.getElementById('pgPrev'),nx=document.getElementById('pgNext');
  function go(n){i=Math.max(0,Math.min(n,P.length-2));[L,R].forEach(function(im){im.classList.add('sw');});
    setTimeout(function(){L.src=P[i];R.src=P[i+1]||'';L.alt=${JSON.stringify(tipo(b.title))}+', '+(i+1)+'. sayfa';R.alt=${JSON.stringify(tipo(b.title))}+', '+(i+2)+'. sayfa';[L,R].forEach(function(im){im.classList.remove('sw');});
      C.textContent=${JSON.stringify(mt.sayfa_sayaci)}.replace('{n}',(i+1)+'–'+(i+2)).replace('{toplam}',P.length);pv.disabled=i<=0;nx.disabled=i>=P.length-2;},160);}
  pv.addEventListener('click',function(){go(i-2);});nx.addEventListener('click',function(){go(i+2);});pv.disabled=true;
  var lb=document.getElementById('lb'),lbi=document.getElementById('lbImg');
  document.querySelectorAll('.pgb').forEach(function(bt){bt.addEventListener('click',function(){var im=bt.querySelector('img');if(!im||!im.getAttribute('src'))return;lbi.src=im.src;lbi.alt=im.alt;if(lb.showModal){lb.showModal();}else{lb.setAttribute('open','');}});});
  lb.addEventListener('click',function(e){if(e.target===lb||(e.target.classList&&e.target.classList.contains('lbx'))){if(lb.close){lb.close();}else{lb.removeAttribute('open');}}});
})();
</script>`)}`;

writeFileSync(join(HERE, "index.html"), index);
writeFileSync(join(HERE, "kitap.html"), kitap);
console.log("yazıldı: index.html, kitap.html");
console.log("sayılar:", sayilar);
console.log("tonlar:", Object.fromEntries(Object.entries(tonlar).map(([k, v]) => [k, `${v.tint} (h=${v.h}${v.nötr ? ", nötr" : ""})`])));
console.log("yeni:", yeni.map((x) => `${x.publish_date} ${x.id}`));
console.log("yazarlar:", yazarlar.map((x) => `${x.display} (${x.n})`));
