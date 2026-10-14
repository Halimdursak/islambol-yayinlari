// Beyaz Vitrin (secenek-1) — JSON'dan index.html ve kitap.html üretir.
// Çalıştır: node docs/design/secenekler/secenek-1/uret.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const REL = '../../../../'; // sayfadan proje köküne göreli yol
const rj = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// ---------- VERİ ----------
const books = rj('data/catalog/books.json');
const authors = rj('data/catalog/authors.json');
const vitrin = rj('data/site/vitrin.json');
const site = rj('data/site/site.json');
const mt = rj('data/site/mikrometin.json');
const ycMd = fs.readFileSync(path.join(ROOT, 'data/site/sayfalar/yayin-cizgisi.md'), 'utf8');
const ozet = /^ozet:\s*"(.*)"\s*$/m.exec(ycMd)[1];

const YIL = 2026;
const byId = new Map(books.map((b) => [b.id, b]));
const haric = new Set(vitrin.vitrin_haric);

const oneCikan = byId.get(vitrin.one_cikan);
const onizlemeli = vitrin.onizleme_vitrini.map((id) => byId.get(id)).filter(Boolean);
const yeni = books
  .filter((b) => !b.is_set && !haric.has(b.id))
  .sort((a, b) => String(b.publish_date).localeCompare(String(a.publish_date)) || a.title.localeCompare(b.title, 'tr'))
  .slice(0, vitrin.yeni_cikanlar_adet || 8);

const enYeniTarih = (a) => a.book_ids.map((id) => String(byId.get(id)?.publish_date || '')).sort().pop() || '';
const yazarlar = [...authors]
  .sort((a, b) => b.book_ids.length - a.book_ids.length || enYeniTarih(b).localeCompare(enYeniTarih(a)) || a.display.localeCompare(b.display, 'tr'))
  .slice(0, vitrin.yazar_seridi_adet || 8);

const onsozDir = path.join(ROOT, 'public/onsoz-opt');
const sayilar = {
  kitap: books.length,
  yazar: authors.length,
  onizleme: fs.readdirSync(onsozDir).filter((d) => fs.statSync(path.join(onsozDir, d)).isDirectory()).length,
  set: books.filter((b) => b.is_set).length,
};

// ---------- YARDIMCILAR ----------
// Türkçe tipografi: ASCII kesme -> ’, ... -> …, kısa bağlaç/belirteçten sonra bölünmez boşluk (NBSP).
const URL_GIBI = /^(?:https?:|mailto:|tel:|\/|#|\.\.?\/)\S*$/;
const tp = (s) => {
  const t = String(s ?? '');
  if (URL_GIBI.test(t)) return t;
  return t
    .replace(/(\p{L})'(\p{L})/gu, '$1’$2')
    .replace(/\.\.\./g, '…')
    .replace(/(?<![\p{L}\p{N}])([vV]e|[iİ]le|[bB]ir|[iİ]çin|[iİ]lk|[bB]u) /gu, '$1\u00A0');
};
const esc = (s) => tp(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const tarih = (d) => {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(String(d || ''));
  if (!m) return '';
  return m[2] ? `${AYLAR[+m[2] - 1]} ${m[1]}` : m[1];
};
const boyut = (s) => String(s || '').replace(/\./g, ',').replace(/\s*x\s*/i, ' × ');

const kapakDir = path.join(ROOT, 'public/kapaklar-opt');
const kapakDosyalari = fs.readdirSync(kapakDir);
function kapakBoyutlari(id) {
  return kapakDosyalari
    .filter((f) => f.startsWith(id + '-') && f.endsWith('.webp'))
    .map((f) => +f.slice(id.length + 1, -5))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}
// En yakın büyük boyutu seçer; yoksa eldeki en büyüğü.
function kapak(b, istenen = 640) {
  const sizes = kapakBoyutlari(b.id);
  if (!sizes.length) return null;
  const s = sizes.find((x) => x >= istenen) ?? sizes[sizes.length - 1];
  const oran = b.cover?.width && b.cover?.height ? b.cover.height / b.cover.width : 1.5;
  return {
    src: `${REL}public/kapaklar-opt/${b.id}-${s}.webp`,
    srcset: sizes.map((x) => `${REL}public/kapaklar-opt/${b.id}-${x}.webp ${x}w`).join(', '),
    w: s,
    h: Math.round(s * oran),
  };
}
const waUrl = (title) => site.whatsapp_url_sablonu.replace('{kitap_adi}', encodeURIComponent(title));
const kitapUrl = (b) => (b.id === oneCikan.id ? 'kitap.html' : `/kitaplar/${b.id}/`);

// Menü: mock içinde var olan bölümlere çıpa, diğerleri site.json adresi.
const CIPA = { Kitaplar: '#onizlemeli', Yazarlar: '#yazarlar', 'Yayın Çizgisi': '#yayin-cizgisi', 'Nereden Alınır': '#nereden-alinir' };
const menuHref = (m, prefix) => (CIPA[m.etiket] ? prefix + CIPA[m.etiket] : m.url);

// ---------- İKONLAR ----------
const ICO = {
  wa: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"/><path d="M9.3 8.3c.2-.4.4-.4.7-.4h.4c.2 0 .4.1.5.4l.7 1.5c.1.2 0 .4-.1.6l-.4.5c-.1.1-.1.3 0 .4.6 1 1.4 1.8 2.4 2.4.1.1.3.1.4 0l.5-.4c.2-.2.4-.2.6-.1l1.5.7c.3.1.4.3.4.5v.4c0 .3-.1.5-.4.7-.5.4-1.1.6-1.7.5-2.7-.4-5.1-2.8-5.5-5.5-.1-.6.1-1.2.5-1.7z"/></svg>',
  left: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  burger: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16"/><path d="M4 17h16"/></svg>',
};

// ---------- CSS ----------
const CSS = `
:root{
  --bg:#ffffff;--band:#f5f5f7;--ink:#1d1d1f;--sec:#6e6e73;--ter:#6e6e73;--line:#d2d2d7;--fill:#e8e8ed;--fill-h:#dcdce1;
  --accent:#d11a2a;--accent-h:#b5151f;
  --font:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',Inter,'Helvetica Neue',Arial,sans-serif;
  --max:1180px;--gutter:22px;--nav-h:52px;--r-card:20px;--r-pill:980px;--sec-pad:96px;--head-gap:36px;
  --ease:cubic-bezier(.22,.61,.36,1);--dur:300ms;
  --sh-card:0 2px 6px rgba(0,0,0,.04),0 12px 32px rgba(0,0,0,.07);
  --sh-card-h:0 4px 10px rgba(0,0,0,.05),0 24px 56px rgba(0,0,0,.13);
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:17px;line-height:1.47;letter-spacing:-.01em;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
img{max-width:100%;height:auto}
a{color:inherit}
h1,h2,h3,h4{margin:0;font-weight:600}
h2{font-size:clamp(32px,4vw,48px);line-height:1.08;letter-spacing:-.025em}
p{margin:0;text-wrap:pretty}
h1,h2,h3,.hero .lead,.sec-head p,.line-in .ozet,.bk-title,.buy-cta h3{text-wrap:balance}
.skip{position:absolute;left:-999px;top:8px;background:var(--ink);color:#fff;padding:10px 16px;border-radius:var(--r-pill);z-index:100}
.skip:focus{left:16px}
.wrap{max-width:var(--max);margin:0 auto;padding:0 var(--gutter)}
.band{background:var(--band)}
.section{padding:var(--sec-pad) 0}

/* NAV */
.nav{position:sticky;top:0;z-index:50;height:var(--nav-h);background:rgba(255,255,255,.72);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid rgba(0,0,0,.06)}
.nav-in{max-width:var(--max);margin:0 auto;padding:0 var(--gutter);height:100%;display:flex;align-items:center;gap:20px}
.logo{--lh:26px;display:block;width:calc(var(--lh)*3.02);height:var(--lh);overflow:hidden;position:relative;flex:none}
.logo img{position:absolute;width:calc(var(--lh)*4.034);height:calc(var(--lh)*4.034);max-width:none;left:calc(var(--lh)*-.496);top:calc(var(--lh)*-1.538)}
.nav-in nav{flex:1;display:flex;justify-content:center}
.nav-menu{display:flex;gap:28px;margin:0;padding:0;list-style:none}
.nav-menu a{font-size:14px;font-weight:400;color:var(--ink);text-decoration:none;opacity:.86;transition:opacity var(--dur) var(--ease)}
.nav-menu a:hover{opacity:1}
.nav-cta{margin-left:auto;display:flex;align-items:center;gap:10px}
.nav-cta .btn-primary{background:var(--ink)}
.nav-cta .btn-primary:hover{background:#000}
.burger{display:none;width:40px;height:40px;border:0;background:transparent;color:var(--ink);border-radius:50%;cursor:pointer;place-items:center}
.burger:hover{background:var(--fill)}
.nav-panel{display:none}
@media (max-width:834px){
  .nav-menu{display:none}
  .burger{display:grid}
  .nav--open .nav-panel{display:block;position:absolute;left:0;right:0;top:var(--nav-h);background:rgba(255,255,255,.92);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid rgba(0,0,0,.06);padding:8px var(--gutter) 16px}
  .nav-panel ul{list-style:none;margin:0;padding:0}
  .nav-panel a{display:block;padding:14px 0;font-size:17px;font-weight:500;text-decoration:none;border-bottom:1px solid var(--line)}
  .nav-panel li:last-child a{border-bottom:0}
}

/* DÜĞME */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 22px;border:0;border-radius:var(--r-pill);font:600 17px/1 var(--font);letter-spacing:-.01em;text-decoration:none;cursor:pointer;white-space:nowrap;transition:background var(--dur) var(--ease),transform var(--dur) var(--ease),color var(--dur) var(--ease)}
.btn:active{transform:scale(.97)}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{background:var(--accent-h)}
.btn-light{background:var(--fill);color:var(--ink)}
.btn-light:hover{background:var(--fill-h)}
.btn-dark{background:var(--ink);color:#fff}
.btn-dark:hover{background:#000}
.btn-sm{min-height:36px;padding:0 16px;font-size:14px}
.link{font-size:17px;font-weight:500;color:var(--ink);text-decoration:none;white-space:nowrap}
.link::after{content:' ›';}
.link:hover{text-decoration:underline;text-underline-offset:3px}

/* HERO */
.hero{padding:40px var(--gutter) 104px;text-align:center}
.hero-in{max-width:980px;margin:0 auto}
.eyebrow{font-size:17px;font-weight:600;color:var(--sec);margin-bottom:14px}
.hero h1{font-size:clamp(44px,5.6vw,80px);line-height:1.03;letter-spacing:-.03em;margin:0 0 18px}
.hero .lead{font-size:clamp(19px,2vw,23px);line-height:1.4;color:var(--sec);max-width:720px;margin:0 auto 30px;letter-spacing:-.012em}
.cta-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.stage{position:relative;width:min(72vw,360px);margin:28px auto 0;perspective:1400px}
.stage-shadow{position:absolute;left:14%;right:14%;bottom:-2px;height:28px;border-radius:50%;background:rgba(0,0,0,.34);filter:blur(24px)}
/* Kapak fotoğraflarının #f6f6f6 zemini: transform yalıtılmış bir katman açtığı için multiply, dönen kabın KENDİSİNDE durur
   (img'de değil); böylece zemin altındaki gölgeyle çarpılır, kutu kenarı ve gölge kesiği oluşmaz. */
.stage-book{display:block;transform:rotateY(-7deg) rotateX(1.5deg);transform-origin:50% 60%;transition:transform 600ms var(--ease);mix-blend-mode:multiply}
.stage:hover .stage-book{transform:none}
.stage-book img{display:block;width:100%;height:auto;mix-blend-mode:normal;filter:brightness(1.04)}
.stage-cap{margin-top:30px;font-size:15px;color:var(--sec)}
.stage-cap a{color:var(--ink);font-weight:600;text-decoration:none}
.stage-cap a:hover{text-decoration:underline;text-underline-offset:3px}

/* BÖLÜM BAŞI */
.sec-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:var(--head-gap)}
.sec-head h2{margin-bottom:10px}
.sec-head p{font-size:19px;line-height:1.4;color:var(--sec);max-width:640px;letter-spacing:-.012em}
.sec-tools{display:flex;align-items:center;gap:18px;flex:none;padding-bottom:6px}
.arrows{display:flex;gap:8px}
.arrow{width:36px;height:36px;border-radius:50%;border:0;background:var(--fill);color:var(--ink);display:grid;place-items:center;cursor:pointer;transition:background var(--dur) var(--ease),transform var(--dur) var(--ease)}
.arrow:hover{background:var(--fill-h)}
.arrow:active{transform:scale(.94)}

/* RAF */
.shelf{display:flex;gap:20px;overflow-x:auto;scroll-snap-type:x mandatory;padding:48px max(var(--gutter),calc((100% - var(--max))/2 + var(--gutter))) calc(var(--sec-pad) + 12px);margin:calc(var(--head-gap)*-1) 0 calc(var(--sec-pad)*-1);scroll-padding-inline:max(var(--gutter),calc((100% - var(--max))/2 + var(--gutter)));scrollbar-width:none;-webkit-overflow-scrolling:touch}
.shelf::-webkit-scrollbar{display:none}
.card{scroll-snap-align:start;flex:0 0 232px;background:#fff;border-radius:var(--r-card);padding:18px 18px 22px;box-shadow:var(--sh-card);text-decoration:none;color:var(--ink);position:relative;transition:transform var(--dur) var(--ease),box-shadow var(--dur) var(--ease)}
.card:hover{transform:translateY(-4px);box-shadow:var(--sh-card-h)}
.card-cover{aspect-ratio:2/3;display:flex;align-items:flex-end;justify-content:center;margin-bottom:16px}
.card-cover img{max-width:100%;max-height:100%;width:auto;height:auto;mix-blend-mode:multiply;filter:brightness(1.04);display:block}
.card h3{font-size:17px;line-height:1.25;letter-spacing:-.012em;margin-bottom:4px}
.card .by{font-size:15px;line-height:1.3;color:var(--sec)}
.card .meta{font-size:13px;color:var(--ter);margin-top:8px}
.card--badge{padding-bottom:58px}
.badge{position:absolute;bottom:20px;left:18px;z-index:1;background:var(--accent);color:#fff;font-size:12px;font-weight:600;line-height:1;padding:6px 10px;border-radius:var(--r-pill)}

/* YAZARLAR */
/* Masaüstü: iki sütun, ad solda, üç mini kapak sağda. ≤1099px: Apple Books gibi yatay raf. */
.authors{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
.author{background:#fff;border-radius:var(--r-card);padding:20px 28px;min-height:128px;box-shadow:var(--sh-card);text-decoration:none;color:var(--ink);display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:24px;transition:transform var(--dur) var(--ease),box-shadow var(--dur) var(--ease)}
.author:hover{transform:translateY(-4px);box-shadow:var(--sh-card-h)}
.author h3{font-size:clamp(22px,1.8vw,26px);line-height:1.14;letter-spacing:-.022em}
.author .count{font-size:15px;color:var(--sec);margin-top:6px}
.minis{display:flex;gap:6px;align-items:flex-end;height:88px;margin:0;flex:none}
.minis img{height:100%;width:auto;max-width:none;object-fit:contain;object-position:bottom;mix-blend-mode:multiply;filter:brightness(1.04)}
@media (max-width:1099px){
  .authors{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:16px;margin:-20px calc(var(--gutter)*-1) -32px;padding:20px var(--gutter) 56px;scroll-padding-inline:var(--gutter);scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .authors::-webkit-scrollbar{display:none}
  .author{flex:0 0 min(78%,380px);flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:20px;min-height:0;scroll-snap-align:start}
  .author h3{font-size:24px}
  .minis{height:96px;margin-top:auto}
}

/* YAYIN ÇİZGİSİ */
.line-in{max-width:880px;margin:0 auto;text-align:center}
.line-in h2{margin-bottom:24px}
.line-in .ozet{font-size:clamp(21px,2.4vw,30px);line-height:1.32;letter-spacing:-.02em;font-weight:500;margin-bottom:30px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin:64px auto 0;max-width:760px}
.stat{border-top:1px solid var(--line);padding-top:18px;text-align:center}
.stat b{display:block;font-size:clamp(40px,4.4vw,64px);font-weight:600;letter-spacing:-.03em;line-height:1;margin-bottom:8px}
.stat span{font-size:15px;color:var(--sec)}

/* NEREDEN ALINIR */
.buy{display:grid;grid-template-columns:1.05fr 1fr;gap:40px;align-items:stretch}
.buy-cta{background:#fff;border-radius:28px;padding:40px;box-shadow:var(--sh-card);display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.buy-label{font-size:15px;font-weight:600;color:var(--sec);margin-bottom:8px}
.buy-cta h3{font-size:clamp(30px,8vw,40px);letter-spacing:-.025em;line-height:1.08;margin-bottom:12px;font-variant-numeric:tabular-nums}
.buy-cta h3 a{color:inherit;text-decoration:none}
.buy-cta .buy-note{color:var(--sec);margin-bottom:26px}
/* Apple Store tarzı tek gruplu liste: tek beyaz modül, satırlar ince çizgiyle ayrılır. */
.channels{display:grid;gap:0;background:#fff;border-radius:28px;box-shadow:var(--sh-card);overflow:hidden;align-content:center}
.channel{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 28px;text-decoration:none;color:var(--ink);border-bottom:1px solid var(--line);font-size:17px;font-weight:600;transition:background var(--dur) var(--ease)}
.channel:last-child{border-bottom:0}
.channel:hover{background:#fafafc}
.channel small{display:block;font-size:14px;font-weight:400;color:var(--sec);margin-top:2px}
.channel .chev{color:var(--ter);flex:none;display:grid}
.channels-note{font-size:13px;color:var(--ter);margin-top:20px;text-align:center}

/* FOOTER */
.footer{padding:56px 0 40px;border-top:1px solid var(--line);font-size:13px;color:var(--sec);line-height:1.5}
.foot-grid{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:40px;margin-bottom:40px}
.foot-grid h4{font-size:13px;color:var(--ink);margin-bottom:12px}
.foot-grid ul{list-style:none;margin:0;padding:0}
.foot-grid li{margin-bottom:8px}
.foot-grid a{color:var(--sec);text-decoration:none}
.foot-grid a:hover{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.foot-brand .logo{--lh:30px;margin-bottom:16px}
.foot-brand p{max-width:420px}
.foot-bottom{border-top:1px solid var(--line);padding-top:20px;display:flex;justify-content:space-between;gap:16px 32px;flex-wrap:wrap;font-size:12px}

/* KİTAP SAYFASI */
.crumbs{font-size:13px;color:var(--sec);margin-bottom:28px}
.crumbs a{text-decoration:none;color:var(--sec)}
.crumbs a:hover{color:var(--ink)}
.bk-hero{padding:40px 0 96px}
.bk-grid{display:grid;grid-template-columns:minmax(280px,420px) 1fr;gap:72px;align-items:center}
.bk-stage{margin:24px auto 0;width:min(72vw,380px)}
.bk-title{font-size:clamp(36px,4.6vw,64px);line-height:1.04;letter-spacing:-.03em;margin-bottom:14px}
.bk-author{font-size:21px;color:var(--sec);margin-bottom:28px;letter-spacing:-.012em}
.bk-facts{display:flex;gap:32px;flex-wrap:wrap;margin-top:34px;padding-top:24px;border-top:1px solid var(--line);font-size:14px;color:var(--sec)}
.bk-facts b{display:block;color:var(--ink);font-size:17px;font-weight:600;margin-bottom:2px}
.prose{max-width:760px;margin:0 auto}
.prose h2{margin-bottom:26px}
.prose p{font-size:19px;line-height:1.55;letter-spacing:-.012em;margin-bottom:22px}
.prose p:first-of-type{font-size:clamp(21px,2.2vw,26px);line-height:1.38;letter-spacing:-.018em;font-weight:500}
.kunye{max-width:760px;margin:0 auto}
.kunye h2{margin-bottom:26px}
.kunye dl{margin:0;background:#fff;border-radius:var(--r-card);box-shadow:var(--sh-card);padding:8px 28px}
.kunye .row{display:grid;grid-template-columns:180px 1fr;gap:16px;padding:16px 0;border-bottom:1px solid var(--line)}
.kunye .row:last-child{border-bottom:0}
.kunye dt{color:var(--sec);font-size:15px}
.kunye dd{margin:0;font-weight:500}
.preview-head{text-align:center;max-width:720px;margin:0 auto 44px}
.preview-head h2{margin-bottom:12px}
.preview-head p{color:var(--sec);font-size:17px}
.book{position:relative;display:grid;grid-template-columns:1fr 1fr;max-width:960px;margin:0 auto;perspective:2000px}
.page{background:#fff;box-shadow:0 30px 60px rgba(0,0,0,.14),0 2px 6px rgba(0,0,0,.06);overflow:hidden}
.page img{display:block;width:100%;height:auto}
.page-l{border-radius:10px 2px 2px 10px;transform:rotateY(5deg);transform-origin:right center}
.page-r{border-radius:2px 10px 10px 2px;transform:rotateY(-5deg);transform-origin:left center}
.spine{position:absolute;left:50%;top:2%;bottom:2%;width:34px;transform:translateX(-50%);background:rgba(0,0,0,.16);filter:blur(12px);pointer-events:none}
.pager{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:40px;font-size:15px;color:var(--sec)}
.pager .arrow{width:40px;height:40px}
.pager .arrow:disabled{opacity:.35;cursor:default}

/* HAREKET */
@media (scripting:enabled){
  [data-reveal]{opacity:0;transform:translateY(18px);transition:opacity 600ms var(--ease),transform 600ms var(--ease);transition-delay:calc(var(--i,0)*70ms)}
  [data-reveal].in{opacity:1;transform:none}
}
@media (hover:none){.arrows{display:none}}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  [data-reveal]{opacity:1;transform:none;transition:none}
  .stage-book,.card,.author,.channel,.btn,.arrow{transition:none}
}

/* DUYARLI */
@media (max-width:1100px){
  .buy{grid-template-columns:1fr}
  .stats{grid-template-columns:repeat(2,1fr)}
  .bk-grid{grid-template-columns:1fr;gap:40px;text-align:center}
  .bk-facts{justify-content:center}
  .cta-row.left{justify-content:center!important}
}
@media (max-width:834px){
  :root{--sec-pad:72px;--head-gap:24px}
  .sec-head{flex-direction:column;align-items:flex-start;gap:16px}
  .sec-tools{padding-bottom:0}
  .card{flex-basis:204px}
  .foot-grid{grid-template-columns:1fr;gap:28px}
  .hero{padding:40px var(--gutter) 88px}
  .stage{margin-top:36px}
}
@media (max-width:640px){
  :root{--gutter:20px;--sec-pad:64px}
  .card{flex-basis:184px;padding:14px 14px 18px}
  .card--badge{padding-bottom:54px}
  .badge{left:14px;bottom:16px}
  .cta-row{flex-direction:column;align-items:stretch;max-width:300px;margin-inline:auto}
  .btn-sm{min-height:40px}
  .author h3{font-size:22px}
  .buy-cta .btn{align-self:stretch}
  .buy-cta{padding:28px 24px;border-radius:24px}
  .kunye .row{grid-template-columns:1fr;gap:4px}
  .kunye dl{padding:6px 20px}
  .pager{gap:12px}
  .foot-bottom{flex-direction:column}
}
`;

// ---------- JS ----------
const JS = `
(function(){
  var nav=document.querySelector('.nav'),burger=document.querySelector('.burger');
  if(burger){burger.addEventListener('click',function(){var open=nav.classList.toggle('nav--open');burger.setAttribute('aria-expanded',open?'true':'false');burger.setAttribute('aria-label',open?${JSON.stringify(mt.menu_kapat)}:${JSON.stringify(mt.menu_ac)});});}
  document.querySelectorAll('[data-shelf]').forEach(function(sec){
    var shelf=sec.querySelector('.shelf');
    sec.querySelectorAll('[data-dir]').forEach(function(b){b.addEventListener('click',function(){var card=shelf.querySelector('.card');var step=(card?card.getBoundingClientRect().width:232)+20;shelf.scrollBy({left:(+b.dataset.dir)*step*2,behavior:'smooth'});});});
  });
  var els=[].slice.call(document.querySelectorAll('[data-reveal]'));
  var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(rm||!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in');});}
  else{var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}});},{rootMargin:'0px 0px -6% 0px',threshold:.06});els.forEach(function(e){io.observe(e);});}
  var book=document.querySelector('[data-book]');
  if(book){
    var pages=JSON.parse(book.getAttribute('data-book'));var i=+book.getAttribute('data-start')||0;var total=pages.length;
    var l=book.querySelector('.page-l img'),r=book.querySelector('.page-r img'),cnt=document.querySelector('[data-count]'),prev=document.querySelector('[data-prev]'),next=document.querySelector('[data-next]');
    function show(){var a=pages[i],b=pages[i+1];l.src=a.src;l.alt=a.alt;if(b){r.src=b.src;r.alt=b.alt;r.parentNode.style.visibility='';}else{r.parentNode.style.visibility='hidden';}
      cnt.textContent=(b?(i+1)+'\\u2013'+(i+2):(i+1))+' / '+total;prev.disabled=i<=0;next.disabled=i+2>=total;}
    prev.addEventListener('click',function(){if(i>0){i-=2;show();}});
    next.addEventListener('click',function(){if(i+2<total){i+=2;show();}});
    show();
  }
})();
`;

// ---------- PARÇALAR ----------
function head(title, desc) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="${REL}public/logo/islambol-logo.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap&subset=latin-ext" rel="stylesheet">
<style>${CSS}</style>
</head>`;
}

function nav(prefix) {
  const items = site.menu.map((m) => `<li><a href="${esc(menuHref(m, prefix))}">${esc(m.etiket)}</a></li>`).join('');
  return `<a class="skip" href="#icerik">${esc(mt.skip_link)}</a>
<header class="nav">
  <div class="nav-in">
    <a class="logo" href="${prefix || 'index.html'}" aria-label="${esc(site.ad)}"><img src="${REL}public/logo/islambol-logo.png" alt="${esc(site.ad)}" width="480" height="480"></a>
    <nav aria-label="Ana menü"><ul class="nav-menu">${items}</ul></nav>
    <div class="nav-cta">
      <a class="btn btn-primary btn-sm" href="${esc(site.whatsapp_url)}" target="_blank" rel="noopener">${ICO.wa}WhatsApp</a>
      <button class="burger" type="button" aria-expanded="false" aria-label="${esc(mt.menu_ac)}">${ICO.burger}</button>
    </div>
  </div>
  <div class="nav-panel"><ul>${items}</ul></div>
</header>`;
}

function footer() {
  const sosyal = Object.entries(site.sosyal).map(([k, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc({ x: 'X', instagram: 'Instagram', facebook: 'Facebook' }[k] || k)}</a></li>`).join('');
  const fm = site.footer_menu.map((m) => `<li><a href="${esc(m.url)}">${esc(m.etiket)}</a></li>`).join('');
  return `<footer class="footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="logo" href="index.html" aria-label="${esc(site.ad)}"><img src="${REL}public/logo/islambol-logo.png" alt="" width="480" height="480"></a>
        <p>${esc(site.adres)}<br><a href="tel:${esc(site.telefon.replace(/\s/g, ''))}">${esc(site.telefon_gosterim)}</a> · <a href="mailto:${esc(site.eposta)}">${esc(site.eposta)}</a></p>
        <p style="margin-top:12px">${esc(mt.footer_not)}</p>
      </div>
      <div><h4>Yayınevi</h4><ul>${fm}</ul></div>
      <div><h4>Sosyal</h4><ul>${sosyal}</ul></div>
    </div>
    <div class="foot-bottom">
      <span>${esc(mt.footer_telif.replace('{yil}', YIL))}</span>
      <span>${esc(mt.kvkk_kisa)}</span>
    </div>
  </div>
</footer>`;
}

function coverImg(b, size, extra = '') {
  const k = kapak(b, size);
  if (!k) return `<div class="no-cover">${esc(mt.bos_durum_gorsel)}</div>`;
  return `<img src="${k.src}" srcset="${k.srcset}" width="${k.w}" height="${k.h}" alt="${esc(b.title)} kapağı" ${extra}>`;
}

function card(b, { badge = null, meta = true, i = 0 } = {}) {
  return `<a class="card${badge ? ' card--badge' : ''}" href="${esc(kitapUrl(b))}" style="--i:${i}">
  ${badge ? `<span class="badge">${esc(badge)}</span>` : ''}
  <div class="card-cover">${coverImg(b, 320, 'loading="lazy" sizes="200px"')}</div>
  <h3>${esc(b.title)}</h3>
  <p class="by">${esc(b.author_display)}</p>
  ${meta && b.publish_date ? `<p class="meta">${esc(tarih(b.publish_date))}</p>` : ''}
</a>`;
}

function shelf(id, title, intro, link, list, opts) {
  return `<section class="section ${opts.band ? 'band' : ''}" id="${id}" data-shelf>
  <div class="wrap sec-head" data-reveal>
    <div><h2>${esc(title)}</h2><p>${esc(intro)}</p></div>
    <div class="sec-tools">
      ${link ? `<a class="link" href="${esc(link.href)}">${esc(link.text)}</a>` : ''}
      <div class="arrows"><button class="arrow" type="button" data-dir="-1" aria-label="${esc(mt.onceki)}">${ICO.left}</button><button class="arrow" type="button" data-dir="1" aria-label="${esc(mt.sonraki)}">${ICO.right}</button></div>
    </div>
  </div>
  <div class="shelf" data-reveal>${list.map((b, i) => card(b, { ...opts.card, i })).join('')}</div>
</section>`;
}

function authorCard(a, i) {
  const minis = a.book_ids
    .map((id) => byId.get(id))
    .filter((b) => b && !haric.has(b.id)) // vitrin_haric ana sayfada hiç görünmez
    .sort((x, y) => (x.is_set ? 1 : 0) - (y.is_set ? 1 : 0) || String(y.publish_date).localeCompare(String(x.publish_date)))
    .map((b) => ({ b, k: kapak(b, 320) }))
    .filter((x) => x.k)
    .slice(0, 3);
  return `<a class="author" href="/yazarlar/${esc(a.slug)}/" data-reveal style="--i:${i % 4}">
  <div><h3>${esc(a.display)}</h3><p class="count">${a.book_ids.length} kitap</p></div>
  <div class="minis">${minis.map(({ b, k }) => `<img src="${k.src}" alt="${esc(b.title)}" loading="lazy" width="${k.w}" height="${k.h}">`).join('')}</div>
</a>`;
}

function buySection(kitapAdi, band) {
  const chans = site.satis_kanallari.filter((c) => c.url);
  const wa = kitapAdi ? waUrl(kitapAdi) : site.whatsapp_url;
  return `<section class="section ${band ? 'band' : ''}" id="nereden-alinir">
  <div class="wrap">
    <div class="sec-head" data-reveal><div><h2>${esc(mt.nereden_alinir)}</h2><p>${esc(mt.bolum_giris.nereden_alinir)}</p></div></div>
    <div class="buy">
      <div class="buy-cta" data-reveal>
        <p class="buy-label">Telefon ve WhatsApp</p>
        <h3><a href="tel:${esc(site.telefon.replace(/\s/g, ''))}">${esc(site.telefon_gosterim)}</a></h3>
        <p class="buy-note">${esc(mt.whatsapp_not)}</p>
        <a class="btn btn-primary" href="${esc(wa)}" target="_blank" rel="noopener">${ICO.wa}${esc(mt.whatsapp_cta)}</a>
      </div>
      <div class="channels" data-reveal style="--i:1">
        ${chans.map((c) => `<a class="channel" href="${esc(c.url)}" target="_blank" rel="noopener"><span>${esc(c.ad)}<small>${esc(c.not)}</small></span><span class="chev">${ICO.right}</span></a>`).join('')}
      </div>
    </div>
    <p class="channels-note" data-reveal>${esc(mt.nereden_alinir_not)}</p>
  </div>
</section>`;
}

// ---------- INDEX ----------
const heroK = kapak(oneCikan, 960);
const index = `${head(`${site.ad} — ${site.slogan}`, mt.hero_alt_baslik)}
<body>
${nav('')}
<main id="icerik">
<section class="hero">
  <div class="hero-in">
    <p class="eyebrow" data-reveal>${esc(site.slogan)}</p>
    <h1 data-reveal style="--i:1">${esc(mt.hero_basliklar[0])}</h1>
    <p class="lead" data-reveal style="--i:2">${esc(mt.hero_alt_baslik)}</p>
    <div class="cta-row" data-reveal style="--i:3">
      <a class="btn btn-primary" href="#onizlemeli">${esc(mt.hero_cta_birincil)}</a>
      <a class="btn btn-light" href="kitap.html#ilk-sayfalar">${esc(mt.onizle_uzun)}</a>
    </div>
  </div>
  <div class="stage" data-reveal style="--i:4">
    <div class="stage-shadow"></div>
    <a class="stage-book" href="kitap.html"><img src="${heroK.src}" srcset="${heroK.srcset}" sizes="(max-width:640px) 72vw, 360px" width="${heroK.w}" height="${heroK.h}" alt="${esc(oneCikan.title)} kapağı" fetchpriority="high"></a>
  </div>
  <p class="stage-cap" data-reveal style="--i:5"><a href="kitap.html">${esc(oneCikan.title)}</a> · ${esc(oneCikan.author_display)}</p>
</section>

${shelf('onizlemeli', 'Önizlemeli kitaplar', mt.bolum_giris.onizlemeli, { href: '/kitaplar/', text: mt.tum_kitaplar }, onizlemeli, { band: true, card: { badge: 'Önizleme', meta: false } })}

${shelf('yeni-cikanlar', 'Yeni çıkanlar', mt.bolum_giris.yeni_cikanlar, { href: '/kitaplar/', text: mt.tum_kitaplar }, yeni, { band: false, card: { meta: true } })}

<section class="section band" id="yazarlar">
  <div class="wrap">
    <div class="sec-head" data-reveal>
      <div><h2>Yazarlar</h2><p>${esc(mt.bolum_giris.yazarlar)}</p></div>
      <div class="sec-tools"><a class="link" href="/yazarlar/">${esc(mt.tum_yazarlar)}</a></div>
    </div>
    <div class="authors">${yazarlar.map(authorCard).join('')}</div>
  </div>
</section>

<section class="section" id="yayin-cizgisi">
  <div class="wrap line-in">
    <h2 data-reveal>Yayın çizgisi</h2>
    <p class="ozet" data-reveal style="--i:1">${esc(ozet)}</p>
    <a class="link" href="/yayin-cizgisi/" data-reveal style="--i:2">${esc(mt.devami)}</a>
    <div class="stats" data-reveal style="--i:3">
      <div class="stat"><b>${sayilar.kitap}</b><span>kitap</span></div>
      <div class="stat"><b>${sayilar.yazar}</b><span>yazar</span></div>
      <div class="stat"><b>${sayilar.onizleme}</b><span>önizlemeli kitap</span></div>
      <div class="stat"><b>${sayilar.set}</b><span>set ve seri</span></div>
    </div>
  </div>
</section>

${buySection(null, true)}
</main>
${footer()}
<script>${JS}</script>
</body>
</html>
`;

// ---------- KİTAP ----------
const k = oneCikan;
const kK = kapak(k, 960);
const sayfalar = fs.readdirSync(path.join(onsozDir, k.id)).filter((f) => f.endsWith('-800.webp')).sort();
const pagesJson = JSON.stringify(sayfalar.map((f, i) => ({ src: `${REL}public/onsoz-opt/${k.id}/${f}`, alt: `${k.title} — ${i + 1}. sayfa` })));
const START = 4; // 05–06. sayfalar (Önsöz) açık gelsin
const paras = k.description.split(/\n\s*\n/).map((p) => `<p>${esc(p.trim())}</p>`).join('\n');
const kitap = `${head(`${k.title} — ${k.author_display} | ${site.ad}`, k.description.slice(0, 155))}
<body>
${nav('index.html')}
<main id="icerik">
<section class="bk-hero">
  <div class="wrap">
    <p class="crumbs"><a href="index.html">Ana sayfa</a> › <a href="/kitaplar/">Kitaplar</a> › ${esc(k.title)}</p>
    <div class="bk-grid">
      <div class="bk-stage stage" data-reveal>
        <div class="stage-shadow"></div>
        <span class="stage-book"><img src="${kK.src}" srcset="${kK.srcset}" sizes="(max-width:640px) 72vw, 380px" width="${kK.w}" height="${kK.h}" alt="${esc(k.title)} kapağı" fetchpriority="high"></span>
      </div>
      <div>
        <h1 class="bk-title" data-reveal style="--i:1">${esc(k.title)}</h1>
        <p class="bk-author" data-reveal style="--i:2">${esc(k.author_display)}</p>
        <div class="cta-row left" style="justify-content:flex-start;--i:3" data-reveal>
          <a class="btn btn-primary" href="#ilk-sayfalar">${esc(mt.onizle_uzun)}</a>
          <a class="btn btn-light" href="${esc(waUrl(k.title))}" target="_blank" rel="noopener">${ICO.wa}${esc(mt.whatsapp_cta)}</a>
        </div>
        <div class="bk-facts" data-reveal style="--i:4">
          <div><b>${k.pages}</b>${esc(mt.kunye_sayfa.toLowerCase())}</div>
          <div><b>${esc(boyut(k.dimensions))}</b>${esc(mt.kunye_boyut.toLowerCase())}</div>
          <div><b>${esc(tarih(k.publish_date))}</b>${esc(mt.kunye_yil.toLowerCase())}</div>
          <div><b>${esc(k.binding)}</b>${esc(mt.kunye_cilt.toLowerCase())}</div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section band">
  <div class="wrap prose" data-reveal>
    <h2>Kitap hakkında</h2>
    ${paras}
  </div>
</section>

<section class="section" id="ilk-sayfalar">
  <div class="wrap">
    <div class="preview-head" data-reveal><h2>${esc(mt.onizleme_baslik)}</h2><p>${esc(mt.onizleme_notu)}</p></div>
    <div class="book" data-reveal style="--i:1" data-book='${pagesJson.replace(/'/g, '&#39;')}' data-start="${START}">
      <div class="page page-l"><img src="" alt="" width="800" height="1264"></div>
      <div class="page page-r"><img src="" alt="" width="800" height="1264"></div>
      <div class="spine"></div>
    </div>
    <div class="pager" data-reveal style="--i:2">
      <button class="arrow" type="button" data-prev aria-label="${esc(mt.onceki)}">${ICO.left}</button>
      <span data-count></span>
      <button class="arrow" type="button" data-next aria-label="${esc(mt.sonraki)}">${ICO.right}</button>
    </div>
  </div>
</section>

<section class="section band">
  <div class="wrap kunye" data-reveal>
    <h2>${esc(mt.kunye)}</h2>
    <dl>
      <div class="row"><dt>${esc(mt.kunye_yazar)}</dt><dd>${esc(k.author_display)}</dd></div>
      <div class="row"><dt>${esc(mt.kunye_isbn)}</dt><dd>${esc(k.isbn)}</dd></div>
      <div class="row"><dt>${esc(mt.kunye_sayfa)}</dt><dd>${k.pages}</dd></div>
      <div class="row"><dt>${esc(mt.kunye_boyut)}</dt><dd>${esc(boyut(k.dimensions))}</dd></div>
      <div class="row"><dt>${esc(mt.kunye_yil)}</dt><dd>${esc(tarih(k.publish_date))}</dd></div>
      <div class="row"><dt>${esc(mt.kunye_cilt)}</dt><dd>${esc(k.binding)}</dd></div>
      <div class="row"><dt>${esc(mt.kunye_dil)}</dt><dd>Türkçe</dd></div>
    </dl>
  </div>
</section>

${buySection(k.title, false)}
</main>
${footer()}
<script>${JS}</script>
</body>
</html>
`;

fs.writeFileSync(path.join(HERE, 'index.html'), index);
fs.writeFileSync(path.join(HERE, 'kitap.html'), kitap);
console.log(`index.html: ${onizlemeli.length} önizlemeli, ${yeni.length} yeni, ${yazarlar.length} yazar; sayılar ${JSON.stringify(sayilar)}`);
console.log(`kitap.html: ${k.title} — ${sayfalar.length} iç sayfa`);
