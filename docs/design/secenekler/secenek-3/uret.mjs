// Seçenek 3 — "Cam Bento" üretim betiği.
// JSON verisinden index.html ve kitap.html üretir. Elle yazılmış kitap/yazar yoktur.
// Çalıştır: node docs/design/secenekler/secenek-3/uret.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const R = (...p) => path.join(ROOT, ...p);
const J = (p) => JSON.parse(fs.readFileSync(R(p), "utf8"));
const PUB = "../../../../public"; // sayfa docs/design/secenekler/secenek-3/ altında

// ---------- Veri ----------
const books = J("data/catalog/books.json");
const authors = J("data/catalog/authors.json");
const vitrin = J("data/site/vitrin.json");
const site = J("data/site/site.json");
const mt = J("data/site/mikrometin.json");
const yayinMd = fs.readFileSync(R("data/site/sayfalar/yayin-cizgisi.md"), "utf8");

const YIL = 2026;
const BUGUN = "2026-10-13";
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const normDate = (d) => { const s = String(d ?? ""); return s.length === 4 ? `${s}-01-01` : s; };
const tarihAyYil = (d) => {
  const s = String(d ?? "");
  if (s.length === 4) return s;
  const [y, m] = s.split("-");
  return `${AYLAR[Number(m) - 1] ?? ""} ${y}`.trim();
};
const boyut = (s) => (s ? s.replace(/\./g, ",").replace(/\s*x\s*/i, " × ") : null);
const byId = new Map(books.map((b) => [b.id, b]));

// Kapak çözümleyici: mevcut webp boyutlarını diskten bulur (bazı kitaplarda 640/960 yok).
const SIZES = [251, 320, 500, 640, 960];
function webpDim(file) {
  const b = fs.readFileSync(file);
  const c = b.toString("ascii", 12, 16);
  if (c === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (c === "VP8L") { const x = b.readUInt32LE(21); return [(x & 0x3fff) + 1, ((x >> 14) & 0x3fff) + 1]; }
  if (c === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  return [3, 4];
}
function kapak(id) {
  const avail = SIZES.filter((s) => fs.existsSync(R("public/kapaklar-opt", `${id}-${s}.webp`)));
  if (!avail.length) return null;
  const nearest = (want) => avail.reduce((best, s) => (Math.abs(s - want) < Math.abs(best - want) ? s : best), avail[0]);
  const url = (s) => `${PUB}/kapaklar-opt/${id}-${s}.webp`;
  const main = nearest(640);
  const [w, h] = webpDim(R("public/kapaklar-opt", `${id}-${main}.webp`));
  return {
    src: url(main),
    srcset: avail.map((s) => `${url(s)} ${s}w`).join(", "),
    hero: url(nearest(960)),
    thumb: url(avail[0]),
    heroDim: webpDim(R("public/kapaklar-opt", `${id}-${nearest(960)}.webp`)),
    w, h,
  };
}

// Türetilmiş listeler
const oneCikan = byId.get(vitrin.one_cikan);
const onizlemeli = vitrin.onizleme_vitrini.map((id) => byId.get(id)).filter(Boolean);
const yeniCikanlar = books
  .filter((b) => !b.is_set && !vitrin.vitrin_haric.includes(b.id) && b.publish_date)
  .sort((a, b) => normDate(b.publish_date).localeCompare(normDate(a.publish_date)) || a.title.localeCompare(b.title, "tr"))
  .slice(0, vitrin.yeni_cikanlar_adet ?? 8);
const yazarlar = [...authors]
  .sort((a, b) => (b.book_ids?.length ?? 0) - (a.book_ids?.length ?? 0) || a.display.localeCompare(b.display, "tr"))
  .slice(0, vitrin.yazar_seridi_adet ?? 8);
const onizlemeliSayisi = fs.readdirSync(R("public/onsoz-opt"), { withFileTypes: true }).filter((d) => d.isDirectory()).length;
const istatistik = { kitap: books.length, yazar: authors.length, onizleme: onizlemeliSayisi, set: books.filter((b) => b.is_set).length };
const ozet = (yayinMd.match(/^ozet:\s*"(.*)"\s*$/m) || [])[1] ?? "";
const alanlar = [...yayinMd.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()).filter((h) => h !== "Yayın ilkeleri");
const satisKanallari = site.satis_kanallari.filter((k) => k.url);
const waKitap = (title) => site.whatsapp_url_sablonu.replace("{kitap_adi}", encodeURIComponent(title));

// Doğrulama: uydurma sayı olmasın
console.log("kitap:", istatistik.kitap, "yazar:", istatistik.yazar, "önizlemeli:", istatistik.onizleme, "set:", istatistik.set);
console.log("önizleme vitrini:", onizlemeli.length, "yeni çıkanlar:", yeniCikanlar.length, "yazar şeridi:", yazarlar.length);
if (!oneCikan) throw new Error("one_cikan bulunamadı");

// ---------- Ortak parçalar ----------
const ICON = {
  book: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
  chat: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.2A8 8 0 1 1 21 12z"/></svg>',
  ext: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
};

const logoImg = (s, dark = false) =>
  `<span class="logo" style="--s:${s}"><img src="${PUB}/logo/${dark ? "islambol-logo-koyu-zemin" : "islambol-logo"}.png" alt="" width="480" height="480" decoding="async"></span>`;

function nav() {
  return `
<header class="navwrap">
  <nav class="nav" aria-label="Ana gezinme">
    <a class="brand" href="index.html" aria-label="${esc(site.ad)} ana sayfa">${logoImg(0.26)}</a>
    <ul class="menu" id="menu">
      ${site.menu.map((m) => `<li><a href="${esc(m.url)}">${esc(m.etiket)}</a></li>`).join("\n      ")}
    </ul>
    <a class="btn btn-accent btn-sm nav-wa" href="${esc(site.whatsapp_url)}" target="_blank" rel="noopener">${ICON.chat}<span>WhatsApp</span></a>
    <button class="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="${esc(mt.menu_ac)}"><span></span></button>
  </nav>
</header>`;
}

function footer() {
  const sosyal = Object.entries(site.sosyal).map(([k, u]) => {
    const ad = { x: "X", instagram: "Instagram", facebook: "Facebook" }[k] ?? k;
    return `<li><a href="${esc(u)}" target="_blank" rel="noopener">${ad}</a></li>`;
  }).join("");
  return `
<footer class="foot wrap">
  <div class="foot-grid">
    <div class="foot-brand">
      <a href="index.html" aria-label="${esc(site.ad)}">${logoImg(0.34)}</a>
      <p class="slogan">${esc(site.slogan)}</p>
      <address>
        <span>${esc(site.adres)}</span>
        <a href="tel:${esc(site.telefon.replace(/\s+/g, ""))}">${esc(site.telefon_gosterim)}</a>
        <a href="mailto:${esc(site.eposta)}">${esc(site.eposta)}</a>
      </address>
    </div>
    <nav aria-label="Alt menü"><h3>Sayfalar</h3><ul>${site.footer_menu.map((m) => `<li><a href="${esc(m.url)}">${esc(m.etiket)}</a></li>`).join("")}</ul></nav>
    <nav aria-label="Sosyal"><h3>Sosyal</h3><ul>${sosyal}</ul></nav>
  </div>
  <div class="foot-base">
    <p>${esc(mt.footer_telif.replace("{yil}", YIL))}</p>
    <p>${esc(mt.footer_not)} ${esc(mt.kvkk_kisa)}</p>
  </div>
</footer>`;
}

function kapakImg(b, { lazy = true, sizes = "(max-width: 560px) 45vw, (max-width: 1024px) 30vw, 200px", cls = "" } = {}) {
  const k = kapak(b.id);
  if (!k) return `<div class="nocover" role="img" aria-label="${esc(mt.bos_durum_gorsel)}"><span>${esc(b.title)}</span></div>`;
  return `<img class="${cls}" src="${k.src}" srcset="${k.srcset}" sizes="${sizes}" width="${k.w}" height="${k.h}" alt="${esc(b.title)} kapağı" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`;
}

const kitapHref = (b) => (b.id === oneCikan.id ? "kitap.html" : `/kitaplar/${b.id}/`);

function kitapKarti(b, { meta = null, flag = null } = {}) {
  // Kapağın üstünde hiçbir öğe yok; tarih/sayfa bilgisi metin bloğunda.
  const alt = [meta ? esc(meta) : "", flag ? `<span class="flag">${esc(flag)}</span>` : ""].join("");
  return `
<a class="card" href="${kitapHref(b)}">
  <div class="tray">${kapakImg(b)}</div>
  <div class="txt"><h3>${esc(b.title)}</h3><p class="by">${esc(b.author_display)}</p></div>
  ${alt ? `<p class="meta">${alt}</p>` : ""}
</a>`;
}

// ---------- CSS ----------
const css = `
:root{
  --ink:#1d1d1f;--ink2:#5f5f64;--ink3:#6e6e73;--line:rgba(29,29,31,.08);
  --accent:#b3202a;--accent-h:#9a1a23;
  --bg:#f2f1f4;
  --t1:#ece3d8;--t2:#e8d9de;--t3:#d9e1ea;
  --glass:rgba(255,255,255,.52);--glass-h:rgba(255,255,255,.62);--hair:rgba(255,255,255,.6);
  --dark:rgba(24,24,26,.92);
  --r-tile:28px;--r-card:18px;--pill:980px;
  --ease:cubic-bezier(.2,.7,.2,1);--t:300ms;
  --font:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Inter,"Helvetica Neue",Arial,sans-serif;
  --gap:20px;--pad:clamp(22px,2.6vw,40px);
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{font-family:var(--font);color:var(--ink);background:var(--bg);font-size:17px;line-height:1.47;letter-spacing:-.012em;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;font-optical-sizing:auto;min-height:100vh;overflow-x:clip;position:relative}
img{max-width:100%;display:block}
a{color:inherit}
ul{list-style:none}
h1,h2,h3{font-weight:600;line-height:1.1;letter-spacing:-.025em;text-wrap:balance}
p{text-wrap:pretty}
.sky{position:absolute;inset:0;height:100%;z-index:-1;pointer-events:none;background:
  radial-gradient(70% 16% at 4% 3%,#eadbc6,rgba(234,219,198,0)),
  radial-gradient(55% 14% at 98% 15%,#e7cdd6,rgba(231,205,214,0)),
  radial-gradient(60% 14% at 2% 38%,#cfdbe9,rgba(207,219,233,0)),
  radial-gradient(55% 14% at 98% 58%,#ead7c8,rgba(234,215,200,0)),
  radial-gradient(70% 14% at 20% 88%,#d3dcea,rgba(211,220,234,0)),
  var(--bg)}
.skip{position:absolute;left:16px;top:-60px;z-index:100;background:#fff;color:var(--ink);padding:10px 16px;border-radius:var(--pill);box-shadow:0 8px 24px rgba(0,0,0,.15);transition:top .2s}
.skip:focus{top:16px}
.wrap{max-width:1280px;margin:0 auto;padding-left:clamp(16px,3vw,32px);padding-right:clamp(16px,3vw,32px)}

/* Logo kırpma: 480px PNG'de yazı kutusu x59–418, y183–302 */
.logo{--s:.26;display:block;width:calc(360px*var(--s));height:calc(120px*var(--s));overflow:hidden;flex:none}
.logo img{width:calc(480px*var(--s));height:calc(480px*var(--s));max-width:none;margin:calc(-183px*var(--s)) 0 0 calc(-59px*var(--s))}

/* Gezinme — yüzen cam kapsül */
.navwrap{position:sticky;top:12px;z-index:50;padding:12px clamp(16px,3vw,32px) 0}
.navwrap::before{content:"";position:absolute;left:0;right:0;top:-12px;bottom:-14px;z-index:-1;pointer-events:none;background:rgba(242,241,244,.72);
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  -webkit-mask-image:linear-gradient(#000 60%,transparent);mask-image:linear-gradient(#000 60%,transparent)}
.nav{position:relative;max-width:1216px;margin:0 auto;height:58px;display:flex;align-items:center;gap:6px;padding:0 10px 0 20px;border-radius:var(--pill);
  background:rgba(255,255,255,.74);backdrop-filter:blur(30px) saturate(160%);-webkit-backdrop-filter:blur(30px) saturate(160%);
  border:1px solid var(--hair);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 12px 32px -16px rgba(29,29,31,.22)}
.brand{display:flex;align-items:center}
.menu{display:flex;gap:2px;margin-left:auto}
.menu a{display:block;white-space:nowrap;padding:8px 13px;border-radius:var(--pill);font-size:14px;font-weight:500;letter-spacing:-.01em;text-decoration:none;transition:background var(--t) var(--ease)}
.menu a:hover{background:rgba(29,29,31,.06)}
.burger{display:none;width:40px;height:40px;border:0;background:transparent;border-radius:50%;cursor:pointer;position:relative}
.burger span,.burger span::before,.burger span::after{content:"";position:absolute;left:11px;width:18px;height:2px;background:var(--ink);border-radius:2px;transition:transform var(--t) var(--ease),opacity var(--t)}
.burger span{top:19px}.burger span::before{left:0;top:-6px}.burger span::after{left:0;top:6px}
.nav.open .burger span{background:transparent}
.nav.open .burger span::before{transform:translateY(6px) rotate(45deg)}
.nav.open .burger span::after{transform:translateY(-6px) rotate(-45deg)}

/* Düğmeler */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 22px;border-radius:var(--pill);font-size:16px;font-weight:600;letter-spacing:-.01em;text-decoration:none;line-height:1;border:1px solid transparent;transition:transform var(--t) var(--ease),background var(--t) var(--ease),box-shadow var(--t) var(--ease);white-space:nowrap}
.btn:active{transform:scale(.98)}
.btn-accent{background:var(--accent);color:#fff;box-shadow:0 10px 24px -12px rgba(179,32,42,.55)}
.btn-accent:hover{background:var(--accent-h);transform:translateY(-1px);box-shadow:0 14px 28px -12px rgba(179,32,42,.6)}
.btn-ghost{background:rgba(29,29,31,.06);color:var(--ink);border-color:rgba(29,29,31,.06)}
.btn-ghost:hover{background:rgba(29,29,31,.1);transform:translateY(-1px)}
.btn-light{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.18)}
.btn-light:hover{background:rgba(255,255,255,.22)}
.btn-sm{padding:9px 16px;font-size:14px}
.more{display:inline-flex;align-items:center;gap:6px;font-size:15px;font-weight:600;text-decoration:none;color:var(--ink);padding:8px 0;white-space:nowrap}
.more svg{transition:transform var(--t) var(--ease)}
.more:hover svg{transform:translateX(3px)}

/* Bento */
main{padding-top:28px;padding-bottom:40px}
.bento{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--gap)}
.tile{position:relative;min-width:0;border-radius:var(--r-tile);overflow:hidden;
  background:var(--glass);backdrop-filter:blur(32px) saturate(160%);-webkit-backdrop-filter:blur(32px) saturate(160%);
  border:1px solid var(--hair);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 1px 2px rgba(29,29,31,.03),0 30px 60px -36px rgba(29,29,31,.22);
  transform:scale(var(--sc,1));transition:transform var(--t) var(--ease),box-shadow var(--t) var(--ease),background var(--t) var(--ease)}
.tile>.tin{translate:0 var(--py,0)}
.tile:hover{--sc:1.01;background:var(--glass-h);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 2px 4px rgba(29,29,31,.04),0 44px 80px -36px rgba(29,29,31,.3)}
.tin{padding:var(--pad);height:100%;display:flex;flex-direction:column;gap:22px}
.t-dark{background:var(--dark);color:#fff;border-color:rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 30px 60px -30px rgba(29,29,31,.5)}
.t-dark:hover{background:rgba(24,24,26,.96)}
.t-dark .btn-accent{background:#c8303a}
.t-dark .btn-accent:hover{background:#d93a45}
.t-dark .eyebrow,.t-dark .lead,.t-dark p{color:rgba(255,255,255,.72)}
.t-dark h2{color:#fff}
.eyebrow{font-size:13px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--ink2)}
.th{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}
.th h2{font-size:clamp(26px,2.4vw,34px)}
.lead{color:var(--ink2);font-size:17px;max-width:62ch;margin-top:8px}

/* Hero */
.t-hero{grid-column:span 8;grid-row:span 2;min-height:640px}
.t-hero .tin{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:center}
.hero-copy{display:flex;flex-direction:column;gap:22px;min-width:0}
.hero-copy h1{font-size:clamp(40px,4.3vw,62px);line-height:1;letter-spacing:-.032em;font-weight:700}
.hero-copy .sub{font-size:clamp(17px,1.35vw,21px);color:var(--ink2);max-width:40ch;line-height:1.4}
.ctas{display:flex;gap:12px;flex-wrap:wrap}
.hero-vis{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:18px;min-width:0}
/* Sahne: opak beyaz "stüdyo süpürmesi"; kapak fotoğrafının beyaz zemini multiply ile kaybolur */
.stage{position:relative;display:flow-root;width:min(100%,400px);border-radius:24px;isolation:isolate;
  background:linear-gradient(180deg,#fff 0%,#f6f5f7 100%);
  box-shadow:inset 0 0 0 1px rgba(29,29,31,.05),inset 0 1px 0 #fff,0 34px 64px -34px rgba(29,29,31,.38);transition:transform var(--t) var(--ease),box-shadow var(--t) var(--ease)}
.stage:hover{transform:translateY(-3px);box-shadow:inset 0 0 0 1px rgba(29,29,31,.05),inset 0 1px 0 #fff,0 44px 76px -34px rgba(29,29,31,.44)}
.stage img{width:84%;height:auto;margin:6% 8% 4%;mix-blend-mode:multiply;filter:brightness(1.04)}
.feat{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--ink2);flex-wrap:wrap;justify-content:center;text-align:center}
.feat strong{color:var(--ink);font-weight:600}
.pill{display:inline-flex;align-items:center;padding:4px 10px;border-radius:var(--pill);background:rgba(29,29,31,.06);font-size:12px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--ink)}

/* Katalog rakamları */
.t-stats{grid-column:span 4}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:18px 20px;margin-top:auto}
.stats div{display:flex;flex-direction:column-reverse;gap:2px;padding-top:14px;border-top:1px solid var(--line)}
.stats dd{font-size:clamp(34px,3vw,44px);font-weight:600;letter-spacing:-.035em;line-height:1}
.stats dt{font-size:14px;color:var(--ink2);font-weight:500}

/* Sipariş */
.t-order{grid-column:span 4}
.t-order h2{font-size:clamp(24px,2.2vw,30px)}
.t-order .tin{gap:14px}
.t-order .btn{margin-top:auto;align-self:flex-start}
.t-order .tel{font-size:15px;color:rgba(255,255,255,.82);text-decoration:none}

/* Kart ızgaraları */
.t-prev{grid-column:span 12}
.t-new{grid-column:span 8}
.t-auth{grid-column:span 4}
.cards{display:grid;column-gap:18px;row-gap:0;margin-bottom:-26px}
.cards-6{grid-template-columns:repeat(6,minmax(0,1fr))}
.cards-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.card{display:grid;grid-row:span 3;grid-template-rows:subgrid;row-gap:0;align-content:start;padding-bottom:26px;text-decoration:none;min-width:0}
.card .tray{position:relative;aspect-ratio:3/4;border-radius:var(--r-card);background:#fff;display:grid;place-items:center;padding:10%;overflow:hidden;
  box-shadow:inset 0 0 0 1px rgba(29,29,31,.05),0 14px 28px -18px rgba(29,29,31,.28);transition:transform var(--t) var(--ease),box-shadow var(--t) var(--ease)}
.card .tray img{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.03)}
.card:hover .tray{transform:translateY(-4px);box-shadow:inset 0 0 0 1px rgba(29,29,31,.05),0 26px 40px -20px rgba(29,29,31,.34)}
.card .txt{margin-top:12px;align-self:start}
.card h3{font-size:15px;line-height:1.25;letter-spacing:-.015em;overflow-wrap:break-word}
.card .by{font-size:13px;line-height:1.35;color:var(--ink2);margin-top:4px}
.card .meta{font-size:12px;color:var(--ink3);margin-top:8px;align-self:start}
.card .flag{display:flex;align-items:center;gap:5px;margin-top:8px;font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--ink2)}
@supports not (grid-template-rows:subgrid){.cards{row-gap:26px;margin-bottom:0}.card{display:block;grid-row:auto;padding-bottom:0}}
.nocover{width:100%;height:100%;display:grid;place-items:center;font-size:12px;color:var(--ink2);text-align:center;padding:8px}

/* Yazarlar */
.alist{display:flex;flex-direction:column}
.arow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid var(--line);text-decoration:none;transition:padding-left var(--t) var(--ease)}
.arow:first-child{border-top:0;padding-top:0}
.arow:hover{padding-left:4px}
.arow h3{font-size:16px;letter-spacing:-.015em;line-height:1.2}
.arow p{font-size:13px;color:var(--ink2);margin-top:2px}
.fan{display:flex;flex:none;padding-left:12px}
.fan img{width:30px;height:42px;object-fit:cover;border-radius:4px;margin-left:-12px;background:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.9),0 6px 12px -6px rgba(29,29,31,.4)}
.fan img:nth-child(2){transform:rotate(2deg)}
.fan img:nth-child(3){transform:rotate(5deg)}
.fan-txt{width:30px;height:42px;border-radius:4px;display:grid;place-items:center;font-size:14px;font-weight:600;background:rgba(29,29,31,.06)}

/* Yayın çizgisi + Nereden alınır */
.t-line{grid-column:span 7}
.t-buy{grid-column:span 5}
.big{font-size:clamp(20px,1.8vw,25px);line-height:1.3;letter-spacing:-.022em;font-weight:500;max-width:34ch}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips li{padding:7px 13px;border-radius:var(--pill);background:rgba(29,29,31,.05);font-size:14px;font-weight:500;border:1px solid rgba(29,29,31,.04)}
.chan{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.chan a{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.7);text-decoration:none;transition:background var(--t) var(--ease),transform var(--t) var(--ease);box-shadow:0 1px 2px rgba(29,29,31,.03)}
.chan a:hover{background:#fff;transform:translateY(-2px)}
.chan strong{display:block;font-size:15px;font-weight:600;letter-spacing:-.01em}
.chan small{display:block;font-size:12px;color:var(--ink2);margin-top:2px}
.chan svg{color:var(--ink3);flex:none}
.note{font-size:13px;color:var(--ink3)}
.t-buy .ctas{margin-top:auto}

/* Kitap sayfası */
.t-book{grid-column:span 12}
.t-book .tin{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:40px;align-items:center}
.t-book .stage{width:min(100%,420px);margin:0 auto}
.book-copy{display:flex;flex-direction:column;gap:18px;min-width:0}
.book-copy h1{font-size:clamp(34px,4vw,58px);line-height:1.02;letter-spacing:-.03em;font-weight:700}
.book-copy .by{font-size:19px;color:var(--ink2)}
.book-copy .by a{text-decoration:none;font-weight:500;color:var(--ink)}
.book-copy .sub{font-size:17px;color:var(--ink2);line-height:1.5}
.t-kunye{grid-column:span 4}
.kunye{display:flex;flex-direction:column}
.kunye div{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-top:1px solid var(--line);font-size:15px}
.kunye div:first-child{border-top:0;padding-top:0}
.kunye dt{color:var(--ink2)}
.kunye dd{font-weight:500;text-align:right}
.t-desc{grid-column:span 8}
.prose{display:flex;flex-direction:column;gap:14px;font-size:17px;line-height:1.55;max-width:68ch}
.t-preview{grid-column:span 12}
.spread{display:grid;grid-template-columns:1fr 1fr;max-width:840px;margin:8px auto 0;perspective:1800px;filter:drop-shadow(0 34px 44px rgba(29,29,31,.2))}
.pg{position:relative;background:#fff;overflow:hidden}
.pg img{width:100%;height:auto;display:block}
.pg::after{content:"";position:absolute;inset:0;pointer-events:none}
.pg-l{transform:rotateY(3deg);transform-origin:right center;border-radius:8px 0 0 8px}
.pg-l::after{background:linear-gradient(to left,rgba(29,29,31,.18),rgba(29,29,31,.04) 10%,rgba(29,29,31,0) 22%)}
.pg-r{transform:rotateY(-3deg);transform-origin:left center;border-radius:0 8px 8px 0}
.pg-r::after{background:linear-gradient(to right,rgba(29,29,31,.18),rgba(29,29,31,.04) 10%,rgba(29,29,31,0) 22%)}
.pg-cap{display:flex;justify-content:space-between;gap:12px;max-width:840px;margin:18px auto 0;font-size:13px;color:var(--ink3)}
.t-buy-wide{grid-column:span 8}
.t-buy-wide .chan{grid-template-columns:repeat(4,minmax(0,1fr))}

/* Alt bilgi */
.foot{padding-top:56px;padding-bottom:40px;color:var(--ink2);font-size:14px}
.foot-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr;gap:32px;padding-top:28px;border-top:1px solid rgba(29,29,31,.1)}
.foot-brand{display:flex;flex-direction:column;gap:10px}
.foot .slogan{color:var(--ink);font-weight:500;font-size:15px}
.foot address{font-style:normal;display:flex;flex-direction:column;gap:4px}
.foot a{text-decoration:none}
.foot a:hover{color:var(--ink)}
.foot h3{font-size:13px;letter-spacing:.02em;text-transform:uppercase;color:var(--ink);margin-bottom:10px}
.foot nav li{margin:6px 0}
.foot-base{margin-top:36px;padding-top:18px;border-top:1px solid rgba(29,29,31,.08);display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink3)}

/* Hareket */
.rv{opacity:0;transform:translateY(14px);transition:opacity .55s var(--ease),transform .55s var(--ease)}
.rv.in{opacity:1;transform:none}
@media (scripting:none){.rv{opacity:1;transform:none}}
@media print{.rv{opacity:1;transform:none}.sky{display:none}.tile{backdrop-filter:none;background:#fff}}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .rv{opacity:1;transform:none;transition:none}
  .tile,.btn,.card .tray,.more svg,.chan a,.arow{transition:none}
  .tile{transform:none}
  .tile>.tin{translate:none}
}

/* Duyarlı */
@media (max-width:1040px){
  .menu{display:none}
  .burger{display:block}
  .nav.open .menu{display:flex;flex-direction:column;gap:2px;position:absolute;left:0;right:0;top:calc(100% + 10px);padding:10px;border-radius:24px;
    background:rgba(251,251,253,.98);border:1px solid var(--hair);box-shadow:0 24px 48px -20px rgba(29,29,31,.3)}
  .nav.open .menu a{padding:12px 16px;font-size:16px}
  .nav-wa{margin-left:auto;padding:9px 11px}
  .nav-wa span{display:none}
}
@media (max-width:1024px){
  .bento{grid-template-columns:repeat(6,minmax(0,1fr))}
  .t-hero{grid-column:span 6;grid-row:auto;min-height:0}
  .t-stats,.t-order{grid-column:span 3}
  .t-prev,.t-new,.t-auth,.t-line,.t-buy,.t-book,.t-kunye,.t-desc,.t-preview,.t-buy-wide{grid-column:span 6}
  .cards-6{grid-template-columns:repeat(3,minmax(0,1fr))}
  .t-buy-wide .chan{grid-template-columns:1fr 1fr}
}
@media (max-width:900px){
  .stage{width:min(100%,340px)}
  .t-book .stage{width:min(100%,320px)}
  .t-hero .tin,.t-book .tin{grid-template-columns:1fr}
}
@media (max-width:768px){
  .bento{grid-template-columns:1fr;gap:16px}
  .t-hero,.t-stats,.t-order,.t-prev,.t-new,.t-auth,.t-line,.t-buy,.t-book,.t-kunye,.t-desc,.t-preview,.t-buy-wide{grid-column:auto}
  .navwrap{top:8px;padding-top:8px}
  .nav{height:54px;padding-left:16px}
  main{padding-top:20px}
  .foot-grid{grid-template-columns:1fr 1fr}
  .foot-brand{grid-column:span 2}
}
@media (max-width:560px){
  .cards-6,.cards-4{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
  .hero-copy h1{font-size:clamp(38px,11vw,46px)}
  .ctas .btn{flex:1 1 auto}
  .chan,.t-buy-wide .chan{grid-template-columns:1fr}
  .stats{gap:14px 16px}
  .foot-grid{grid-template-columns:1fr}
  .foot-brand{grid-column:auto}
}
`;

// ---------- JS ----------
const js = `
(function(){
  var rm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav=document.querySelector('.nav'),btn=document.querySelector('.burger');
  if(btn){btn.addEventListener('click',function(){var o=nav.classList.toggle('open');btn.setAttribute('aria-expanded',String(o));btn.setAttribute('aria-label',o?${JSON.stringify(mt.menu_kapat)}:${JSON.stringify(mt.menu_ac)});});}
  var rv=[].slice.call(document.querySelectorAll('.rv'));
  if(rm){rv.forEach(function(e){e.classList.add('in')});return;}
  var tiles=[].slice.call(document.querySelectorAll('.tile')),ticking=false;
  function upd(){
    ticking=false;var vh=window.innerHeight||1;
    for(var i=0;i<tiles.length;i++){var r=tiles[i].getBoundingClientRect();var k=(r.top+r.height/2-vh/2)/(vh/2);k=Math.max(-1,Math.min(1,k));tiles[i].style.setProperty('--py',(-k*12).toFixed(1)+'px');}
    for(var j=rv.length-1;j>=0;j--){var q=rv[j].getBoundingClientRect();if(q.top<vh*.92){rv[j].classList.add('in');rv.splice(j,1);}}
  }
  function onScroll(){if(!ticking){ticking=true;window.requestAnimationFrame(upd);}}
  window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',onScroll);window.addEventListener('load',onScroll);upd();
})();`;

const head = (title, desc) => `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#f2f1f4">
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style>
<noscript><style>.rv{opacity:1;transform:none}</style></noscript>
</head>
<body>
<div class="sky" aria-hidden="true"></div>
<a class="skip" href="#icerik">${esc(mt.skip_link)}</a>`;

const tail = () => `${footer()}
<script>${js}</script>
</body>
</html>
`;

// ---------- index.html ----------
function anaSayfa() {
  const hk = kapak(oneCikan.id);
  const heroImg = `<img src="${hk.hero}" srcset="${hk.srcset}" sizes="(max-width: 900px) 286px, 295px" width="${hk.heroDim[0]}" height="${hk.heroDim[1]}" alt="${esc(oneCikan.title)} kapağı" fetchpriority="high" decoding="async">`;

  const yazarSatiri = (y) => {
    const ks = (y.book_ids || []).map((id) => byId.get(id)).filter(Boolean).slice(0, 3);
    const fan = ks.map((b) => {
      const k = kapak(b.id);
      return k ? `<img src="${k.thumb}" alt="" width="30" height="42" loading="lazy" decoding="async">` : "";
    }).join("");
    const n = y.book_ids?.length ?? 0;
    return `<a class="arow" href="/yazarlar/${esc(y.slug)}/"><div><h3>${esc(y.display)}</h3><p>${n} kitap</p></div><div class="fan">${fan}</div></a>`;
  };

  return `${head(`${site.ad} — ${site.slogan}`, mt.hero_alt_baslik)}
${nav()}
<main id="icerik" class="wrap">
<section class="bento" aria-label="Ana sayfa">

  <article class="tile t-hero">
    <div class="tin">
      <div class="hero-copy rv">
        <p class="eyebrow">${esc(site.ad)}</p>
        <h1>${esc(mt.hero_basliklar[0])}</h1>
        <p class="sub">${esc(mt.hero_alt_baslik)}</p>
        <div class="ctas">
          <a class="btn btn-accent" href="/kitaplar/">${esc(mt.hero_cta_birincil)}</a>
          <a class="btn btn-ghost" href="kitap.html#onizleme">${esc(mt.onizle_uzun)}${ICON.arrow}</a>
        </div>
      </div>
      <div class="hero-vis rv">
        <a class="stage" href="kitap.html" aria-label="${esc(oneCikan.title)} kitap sayfası">${heroImg}</a>
        <p class="feat"><span class="pill">Öne çıkan</span><span><strong>${esc(oneCikan.title)}</strong> · ${esc(oneCikan.author_display)}</span></p>
      </div>
    </div>
  </article>

  <article class="tile t-stats">
    <div class="tin rv">
      <p class="eyebrow">Katalog</p>
      <dl class="stats">
        <div><dt>Kitap</dt><dd>${istatistik.kitap}</dd></div>
        <div><dt>Yazar</dt><dd>${istatistik.yazar}</dd></div>
        <div><dt>Önizlemeli kitap</dt><dd>${istatistik.onizleme}</dd></div>
        <div><dt>Set ve seri</dt><dd>${istatistik.set}</dd></div>
      </dl>
    </div>
  </article>

  <article class="tile t-dark t-order">
    <div class="tin rv">
      <p class="eyebrow">Sipariş</p>
      <h2>Doğrudan yayınevinden.</h2>
      <p>${esc(mt.bolum_giris.iletisim)} ${esc(mt.whatsapp_not)}</p>
      <a class="tel" href="tel:${esc(site.telefon.replace(/\s+/g, ""))}">${esc(site.telefon_gosterim)}</a>
      <a class="btn btn-accent" href="${esc(site.whatsapp_url)}" target="_blank" rel="noopener">${ICON.chat}${esc(mt.whatsapp_cta)}</a>
    </div>
  </article>

  <article class="tile t-prev" id="onizlemeli">
    <div class="tin rv">
      <header class="th">
        <div><h2>Önizlemeli kitaplar</h2><p class="lead">${esc(mt.bolum_giris.onizlemeli)}</p></div>
        <a class="more" href="/kitaplar/">${esc(mt.tum_kitaplar)}${ICON.arrow}</a>
      </header>
      <div class="cards cards-6">
        ${onizlemeli.map((b) => kitapKarti(b, { meta: b.pages ? `${b.pages} sayfa` : null })).join("\n")}
      </div>
    </div>
  </article>

  <article class="tile t-new" id="yeni">
    <div class="tin rv">
      <header class="th">
        <div><h2>Yeni çıkanlar</h2><p class="lead">${esc(mt.bolum_giris.yeni_cikanlar)}</p></div>
        <a class="more" href="/kitaplar/">${esc(mt.tum_kitaplar)}${ICON.arrow}</a>
      </header>
      <div class="cards cards-4">
        ${yeniCikanlar.map((b) => kitapKarti(b, { flag: normDate(b.publish_date) > BUGUN ? mt.on_siparis : null, meta: tarihAyYil(b.publish_date) })).join("\n")}
      </div>
    </div>
  </article>

  <article class="tile t-auth" id="yazarlar">
    <div class="tin rv">
      <header class="th">
        <div><h2>Yazarlar</h2><p class="lead">${esc(mt.bolum_giris.yazarlar)}</p></div>
      </header>
      <div class="alist">
        ${yazarlar.map(yazarSatiri).join("\n")}
      </div>
      <a class="more" href="/yazarlar/">${esc(mt.tum_yazarlar)}${ICON.arrow}</a>
    </div>
  </article>

  <article class="tile t-line" id="yayin-cizgisi">
    <div class="tin rv">
      <header class="th"><div><h2>Yayın çizgisi</h2><p class="lead">${esc(mt.bolum_giris.yayin_cizgisi)}</p></div></header>
      <p class="big">${esc(ozet)}</p>
      <ul class="chips" aria-label="Yayın alanları">${alanlar.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
      <a class="more" href="/yayin-cizgisi/">${esc(mt.devami)}${ICON.arrow}</a>
    </div>
  </article>

  <article class="tile t-buy" id="nereden-alinir">
    <div class="tin rv">
      <header class="th"><div><h2>${esc(mt.nereden_alinir)}</h2><p class="lead">${esc(mt.bolum_giris.nereden_alinir)}</p></div></header>
      <ul class="chan">
        ${satisKanallari.map((k) => `<li><a href="${esc(k.url)}" target="_blank" rel="noopener"><span><strong>${esc(k.ad)}</strong><small>${esc(k.not)}</small></span>${ICON.ext}</a></li>`).join("\n        ")}
      </ul>
      <div class="ctas"><a class="btn btn-accent" href="${esc(site.whatsapp_url)}" target="_blank" rel="noopener">${ICON.chat}${esc(mt.whatsapp_cta)}</a></div>
      <p class="note">${esc(mt.nereden_alinir_not)}</p>
    </div>
  </article>

</section>
</main>
${tail()}`;
}

// ---------- kitap.html ----------
function kitapSayfasi(b) {
  const k = kapak(b.id);
  const img = `<img src="${k.hero}" srcset="${k.srcset}" sizes="(max-width: 900px) 270px, 360px" width="${k.heroDim[0]}" height="${k.heroDim[1]}" alt="${esc(b.title)} kapağı" fetchpriority="high" decoding="async">`;
  const paras = String(b.description || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const kategori = (b.categories || [])
    .flatMap((c) => c.split(">").map((s) => s.trim().replace(/\s*-\s*/g, "-")))
    .filter((s) => s && s.toLocaleLowerCase("tr") !== "kitap")
    .filter((v, i, a) => a.findIndex((x) => x.toLocaleLowerCase("tr") === v.toLocaleLowerCase("tr")) === i)
    .slice(0, 3);
  const ilkCumle = (paras[0] || "").split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ"“])/)[0] || "";
  const yazar = authors.find((a) => (a.book_ids || []).includes(b.id));
  const yazarLink = yazar ? `<a href="/yazarlar/${esc(yazar.slug)}/">${esc(b.author_display)}</a>` : esc(b.author_display);
  const sayfalar = ["02", "03"].map((n) => `${PUB}/onsoz-opt/${b.id}/${n}-800.webp`);
  const kunye = [
    [mt.kunye_yazar, b.author_display],
    [mt.kunye_isbn, b.isbn],
    [mt.kunye_sayfa, b.pages ? `${b.pages} sayfa` : null],
    [mt.kunye_boyut, boyut(b.dimensions)],
    [mt.kunye_yil, tarihAyYil(b.publish_date)],
    [mt.kunye_cilt, b.binding],
    ["Kağıt", b.paper],
    [mt.kunye_dil, b.language === "tr" ? "Türkçe" : b.language],
  ].filter(([, v]) => v);

  return `${head(`${b.title} — ${b.author_display} | ${site.ad}`, paras[0] ? paras[0].slice(0, 155) : b.title)}
${nav()}
<main id="icerik" class="wrap">
<section class="bento" aria-label="${esc(b.title)}">

  <article class="tile t-book">
    <div class="tin">
      <div class="rv"><div class="stage">${img}</div></div>
      <div class="book-copy rv">
        <p class="eyebrow">${esc(kategori.join(" · ") || "Kitap")}</p>
        <h1>${esc(b.title)}</h1>
        ${b.subtitle ? `<p class="sub">${esc(b.subtitle)}</p>` : ""}
        <p class="by">${yazarLink}</p>
        <p class="sub">${esc(ilkCumle)}</p>
        <div class="ctas">
          <a class="btn btn-ghost" href="#onizleme">${ICON.book}${esc(mt.onizle_uzun)}</a>
          <a class="btn btn-accent" href="${esc(waKitap(b.title))}" target="_blank" rel="noopener">${ICON.chat}${esc(mt.whatsapp_cta)}</a>
        </div>
        <p class="note">${esc(mt.whatsapp_not)}</p>
      </div>
    </div>
  </article>

  <article class="tile t-kunye">
    <div class="tin rv">
      <header class="th"><div><h2>${esc(mt.kunye)}</h2></div></header>
      <dl class="kunye">
        ${kunye.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("\n        ")}
      </dl>
    </div>
  </article>

  <article class="tile t-desc">
    <div class="tin rv">
      <header class="th"><div><h2>Kitap hakkında</h2></div></header>
      <div class="prose">${paras.map((p) => `<p>${esc(p)}</p>`).join("\n")}</div>
    </div>
  </article>

  <article class="tile t-preview" id="onizleme">
    <div class="tin rv">
      <header class="th">
        <div><h2>${esc(mt.onizleme_baslik)}</h2><p class="lead">${esc(mt.onizleme_notu)}</p></div>
        <span class="pill">${esc(mt.sayfa_sayaci.replace("{n}", "2–3").replace("{toplam}", "10"))}</span>
      </header>
      <div class="spread" role="group" aria-label="${esc(mt.onizleme_baslik)}">
        <div class="pg pg-l"><img src="${sayfalar[0]}" width="486" height="800" alt="${esc(b.title)}, 2. sayfa: yazar hakkında" loading="lazy" decoding="async"></div>
        <div class="pg pg-r"><img src="${sayfalar[1]}" width="486" height="800" alt="${esc(b.title)}, 3. sayfa: içindekiler" loading="lazy" decoding="async"></div>
      </div>
      <div class="pg-cap"><span>${esc(b.title)} · ${esc(b.author_display)}</span><span>${esc(site.ad)}</span></div>
    </div>
  </article>

  <article class="tile t-buy t-buy-wide">
    <div class="tin rv">
      <header class="th"><div><h2>${esc(mt.nereden_alinir)}</h2><p class="lead">${esc(mt.bolum_giris.nereden_alinir)}</p></div></header>
      <ul class="chan">
        ${satisKanallari.map((k) => `<li><a href="${esc(k.url)}" target="_blank" rel="noopener"><span><strong>${esc(k.ad)}</strong><small>${esc(k.not)}</small></span>${ICON.ext}</a></li>`).join("\n        ")}
      </ul>
      <p class="note">${esc(mt.nereden_alinir_not)}</p>
    </div>
  </article>

  <article class="tile t-dark t-order">
    <div class="tin rv">
      <p class="eyebrow">Sipariş</p>
      <h2>${esc(b.title)}</h2>
      <p>${esc(mt.whatsapp_not)}</p>
      <a class="tel" href="tel:${esc(site.telefon.replace(/\s+/g, ""))}">${esc(site.telefon_gosterim)}</a>
      <a class="btn btn-accent" href="${esc(waKitap(b.title))}" target="_blank" rel="noopener">${ICON.chat}${esc(mt.whatsapp_cta)}</a>
    </div>
  </article>

</section>
</main>
${tail()}`;
}

fs.writeFileSync(path.join(HERE, "index.html"), anaSayfa(), "utf8");
fs.writeFileSync(path.join(HERE, "kitap.html"), kitapSayfasi(oneCikan), "utf8");
console.log("yazıldı:", path.join(HERE, "index.html"), path.join(HERE, "kitap.html"));
