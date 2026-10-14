// Seçenek 2 · "Pro Siyah" — JSON'dan index.html ve kitap.html üretir.
// Çalıştır: node docs/design/secenekler/secenek-2/uret.mjs  (proje kökünden ya da herhangi bir yerden)
// Veri kaynakları: data/catalog/books.json, authors.json, kapaklar-opt.json, onsoz-opt.json,
//                  data/site/site.json, vitrin.json, mikrometin.json, sayfalar/yayin-cizgisi.md
// Fiyat basılmaz. Sayılar (78 kitap · 36 yazar · 9 önizlemeli · 7 set) veriden hesaplanır.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const PUB = '../../../../public'; // sayfa docs/design/secenekler/secenek-2/ altında

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const books = readJson('data/catalog/books.json');
const authors = readJson('data/catalog/authors.json');
const kapak = readJson('data/catalog/kapaklar-opt.json');
const onsoz = readJson('data/catalog/onsoz-opt.json');
const site = readJson('data/site/site.json');
const vitrin = readJson('data/site/vitrin.json');
const mt = readJson('data/site/mikrometin.json');
const yayinMd = fs.readFileSync(path.join(ROOT, 'data/site/sayfalar/yayin-cizgisi.md'), 'utf8');
const ozetMatch = /^ozet:\s*"(.*)"\s*$/m.exec(yayinMd);
if (!ozetMatch) throw new Error('yayin-cizgisi.md içinde ozet alanı bulunamadı');
const yayinOzet = ozetMatch[1];

// ---------- yardımcılar ----------
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
function tarihTR(iso) {
  if (!iso) return '';
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(iso);
  if (!m) return iso;
  return m[2] ? `${AYLAR[Number(m[2]) - 1]} ${m[1]}` : m[1];
}
const trCmp = (a, b) => a.localeCompare(b, 'tr');

const byId = new Map(books.map((b) => [b.id, b]));
const getBook = (id) => {
  const b = byId.get(id);
  if (!b) throw new Error('Katalogda kitap yok: ' + id);
  return b;
};

// ---------- seçimler (hepsi veriden) ----------
const oneCikan = getBook(vitrin.one_cikan);
const onizlemeli = vitrin.onizleme_vitrini.map(getBook);
const haric = new Set(vitrin.vitrin_haric);
const yeniCikanlar = books
  .filter((b) => !b.is_set && !haric.has(b.id))
  .sort((a, b) => (b.publish_date || '').localeCompare(a.publish_date || '') || trCmp(a.title, b.title))
  .slice(0, vitrin.yeni_cikanlar_adet);

const sonTarih = (a) => a.book_ids.map((id) => byId.get(id)?.publish_date || '').sort().pop() || '';
const yazarlar = [...authors]
  .sort((a, b) => b.book_ids.length - a.book_ids.length || sonTarih(b).localeCompare(sonTarih(a)) || trCmp(a.display, b.display))
  .slice(0, vitrin.yazar_seridi_adet);

const stats = {
  kitap: books.length,
  yazar: authors.length,
  onizleme: Object.keys(onsoz).length,
  set: books.filter((b) => b.is_set).length,
};

const satisKanallari = site.satis_kanallari.filter((k) => k.url); // bağlantısı doğrulanmamış kanal basılmaz
const yil = 2026;
const slogan = site.slogan.replace(/\.{3}$/, '…'); // "için..." -> "için…"
const telif = mt.footer_telif.replace('{yil}', String(yil));
const waKitap = (title) => site.whatsapp_url_sablonu.replace('{kitap_adi}', encodeURIComponent(title));

// ---------- görsel yardımcıları ----------
function kapakImg(book, { sizes, maxW = 640, eager = false, cls = '' } = {}) {
  const m = kapak[book.id];
  if (!m) throw new Error('Kapak manifesti yok: ' + book.id);
  const webp = [...m.kaynaklar.webp].sort((a, b) => a.w - b.w);
  const pick = webp.filter((s) => s.w <= maxW).pop() || webp[webp.length - 1];
  const h = Math.round(pick.w / m.oran);
  const srcset = webp.map((s) => `${PUB}${s.url} ${s.w}w`).join(', ');
  return `<img class="${cls}" src="${PUB}${pick.url}" srcset="${srcset}" sizes="${sizes}" width="${pick.w}" height="${h}"` +
    ` alt="${esc(book.title)} — kapak" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}` +
    ` style="background-image:url(${m.lqip})">`;
}

function onsozSayfa(bookId, n, eager = false) {
  const p = onsoz[bookId]?.[String(n)];
  if (!p) throw new Error(`Önsöz sayfası yok: ${bookId} #${n}`);
  const w = p.webp[0];
  return `<img src="${PUB}${w.url}" width="${w.w}" height="800" alt="${esc(getBook(bookId).title)} — ${n}. sayfa" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
}

const logo = (h, cls = '') =>
  `<span class="logo ${cls}" style="--h:${h}px"><img src="${PUB}/logo/islambol-logo-koyu-zemin.png" alt="${esc(site.ad)}" width="480" height="480"></span>`;

const waIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3.3 4.4c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4l-2.1-1c-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5.3-.5c.1-.2 0-.4 0-.6l-.9-2.3c-.3-.6-.5-.5-.7-.5h-.6Z"/></svg>';
const arrow = '<svg class="arr" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

// ---------- parçalar ----------
function nav(current) {
  const home = current === 'index' ? './' : 'index.html';
  return `
<header class="nav" id="nav">
  <div class="wrap">
    <a class="nav-logo" href="${home}" aria-label="${esc(site.ad)} — ana sayfa">${logo(26)}</a>
    <nav aria-label="Ana menü">
      <ul class="nav-menu" id="nav-menu">
        ${site.menu.map((m) => `<li><a href="${esc(m.url)}">${esc(m.etiket)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <a class="btn btn-primary btn-sm nav-cta" href="${esc(site.whatsapp_url)}" target="_blank" rel="noopener">${waIcon}<span>WhatsApp</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="${esc(mt.menu_ac)}"><span></span><span></span></button>
  </div>
</header>`;
}

function footer() {
  const sosyal = [['X', site.sosyal.x], ['Instagram', site.sosyal.instagram], ['Facebook', site.sosyal.facebook]];
  return `
<footer class="footer">
  <div class="wrap">
    <div class="foot-top">
      <div>
        ${logo(22, 'foot-logo')}
        <p class="foot-slogan">${esc(slogan)}</p>
        <p>${esc(site.adres)}</p>
      </div>
      <div>
        <h4>İletişim</h4>
        <ul>
          <li><a href="tel:${esc(site.telefon.replace(/\s/g, ''))}">${esc(site.telefon_gosterim)}</a></li>
          <li><a href="mailto:${esc(site.eposta)}">${esc(site.eposta)}</a></li>
          <li><a href="${esc(site.whatsapp_url)}" target="_blank" rel="noopener">WhatsApp</a></li>
        </ul>
      </div>
      <div>
        <h4>Sosyal</h4>
        <ul>${sosyal.map(([ad, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener">${ad}</a></li>`).join('')}</ul>
      </div>
      <div>
        <h4>Site</h4>
        <ul>${site.footer_menu.map((m) => `<li><a href="${esc(m.url)}">${esc(m.etiket)}</a></li>`).join('')}</ul>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© ${yil} ${esc(site.ad)}</span>
      <span>${esc(telif.replace(/^©\s*\d{4}\s*İslambol Yayınları\.?\s*/, ''))} ${esc(mt.footer_not)}</span>
    </div>
  </div>
</footer>`;
}

function bookCard(book, { badge = false, meta = '', sizes, link }) {
  return `
<a class="book rv" href="${link}">
  <div class="podium">
    ${badge ? `<span class="badge">${esc(mt.onizle)}</span>` : ''}
    ${kapakImg(book, { sizes, maxW: 640 })}
  </div>
  <h3>${esc(book.title)}</h3>
  <p class="by">${esc(book.author_display)}</p>
  ${meta ? `<p class="meta">${meta}</p>` : ''}
</a>`;
}

function authorCard(a) {
  const kitaplar = a.book_ids.filter((id) => !haric.has(id)).map((id) => byId.get(id)).filter(Boolean)
    .sort((x, y) => (y.publish_date || '').localeCompare(x.publish_date || '')).slice(0, 3); // vitrin_haric ana sayfada hiç görünmez
  const n = a.book_ids.length;
  return `
<a class="auth rv" href="/yazarlar/${esc(a.slug)}/">
  <div class="auth-covers" aria-hidden="true">
    ${kitaplar.map((b) => kapakImg(b, { sizes: '72px', maxW: 320 })).join('')}
  </div>
  <div>
    <h3>${esc(a.display)}</h3>
    <p>${n} kitap</p>
  </div>
</a>`;
}

// ---------- CSS ----------
const css = `
:root{
  --bg:#000;--bg-alt:#1d1d1f;--text:#f5f5f7;--text-2:#a1a1a6;--text-3:#8e8e93;
  --hair:rgba(255,255,255,.08);--hair-2:rgba(255,255,255,.14);--glass:rgba(255,255,255,.06);--glass-2:rgba(255,255,255,.1);
  --grad:linear-gradient(92deg,#ff453a 0%,#ffb340 100%);
  --r-card:24px;--r-tile:18px;--r-pill:980px;
  --font:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',Inter,'Helvetica Neue',Arial,sans-serif;
  --ease:cubic-bezier(.22,1,.36,1);--dur:320ms;
  --gutter:clamp(16px,4vw,24px);--max:1200px;--nav-h:48px;
}
*,*::before,*::after{box-sizing:border-box}
html{background:#000;-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:calc(var(--nav-h) + 16px)}
body{margin:0;font-family:var(--font);font-size:17px;line-height:1.47;letter-spacing:-.012em;color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
img{display:block;max-width:100%;height:auto}
a{color:inherit;text-decoration:none}
h1,h2,h3,h4,p{margin:0}
:focus-visible{outline:2px solid #fff;outline-offset:3px;border-radius:4px}
.wrap{width:100%;max-width:var(--max);margin:0 auto;padding:0 var(--gutter)}
.skip{position:absolute;left:-999px;top:8px;z-index:100;padding:8px 14px;background:#fff;color:#000;border-radius:var(--r-pill)}
.skip:focus{left:8px}

/* logo: 480x480 kare PNG, işaret y 183–302 bandında (3:1) → kırparak göster */
.logo{--h:26px;position:relative;display:inline-block;height:var(--h);width:calc(var(--h) * 3);overflow:hidden;vertical-align:middle}
.logo img{position:absolute;height:calc(var(--h) * 4);width:auto;max-width:none;left:50%;top:50%;transform:translate(-50%,-50%)}

/* düğmeler */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:12px 24px;border-radius:var(--r-pill);font:inherit;font-size:17px;font-weight:500;letter-spacing:-.012em;line-height:1.2;border:1px solid transparent;cursor:pointer;white-space:nowrap;transition:background-color var(--dur) var(--ease),border-color var(--dur) var(--ease),transform 160ms var(--ease)}
.btn:active{transform:scale(.97)}
.btn-primary{background:#f5f5f7;color:#000}
.btn-primary:hover{background:#fff}
.btn-glass{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.14);color:var(--text);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.btn-glass:hover{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.22)}
.btn-sm{min-height:32px;padding:6px 14px;font-size:13px;font-weight:600;gap:6px}
.btn .arr{transition:transform var(--dur) var(--ease)}
.btn:hover .arr{transform:translateX(2px)}
.more{display:inline-flex;align-items:center;gap:4px;font-size:17px;font-weight:500;color:var(--text);transition:color var(--dur) var(--ease)}
.more:hover{color:#fff}
.more .arr{transition:transform var(--dur) var(--ease)}
.more:hover .arr{transform:translateX(3px)}

/* gezinme */
.nav{position:sticky;top:0;z-index:50;height:var(--nav-h);background:rgba(0,0,0,.72);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--hair)}
.nav .wrap{height:100%;display:flex;align-items:center;gap:28px}
.nav-logo{display:inline-flex;flex:none}
.nav nav{flex:1;min-width:0}
.nav-menu{display:flex;justify-content:center;gap:clamp(18px,2.4vw,30px);margin:0;padding:0;list-style:none}
.nav-menu a{font-size:12px;letter-spacing:-.01em;color:rgba(245,245,247,.82);white-space:nowrap;transition:color var(--dur) var(--ease)}
.nav-menu a:hover{color:#fff}
.nav-cta{flex:none}
.nav-toggle{display:none;flex:none;width:36px;height:36px;margin-left:-6px;padding:0;border:0;background:transparent;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:5px}
.nav-toggle span{display:block;width:18px;height:1.5px;background:var(--text);transition:transform var(--dur) var(--ease)}
.nav.open .nav-toggle span:first-child{transform:translateY(3.25px) rotate(45deg)}
.nav.open .nav-toggle span:last-child{transform:translateY(-3.25px) rotate(-45deg)}
@media (max-width:959px){
  .nav .wrap{gap:14px}
  .nav nav{position:absolute;left:0;right:0;top:var(--nav-h);flex:none}
  .nav-menu{display:none;flex-direction:column;gap:0;padding:4px var(--gutter) 16px;background:rgba(0,0,0,.9);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--hair)}
  .nav.open .nav-menu{display:flex}
  .nav-menu a{display:block;padding:13px 0;font-size:17px;font-weight:500;border-bottom:1px solid var(--hair);color:var(--text)}
  .nav-cta{margin-left:auto}
  .nav-toggle{display:flex;order:3}
}

/* podyum: açık "plinth" üzerinde multiply. Kapağın beyazımsı zemini erir, kitabın kendi gölgesi temas gölgesine dönüşür. */
.podium{position:relative;isolation:isolate;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:var(--r-card);background:radial-gradient(120% 80% at 50% 0%,#f7f7f9 0%,#e3e3e8 60%,#cfcfd5 100%);border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 60px rgba(0,0,0,.6)}
.podium::before,.podium::after{display:none}
.podium img{position:relative;z-index:1;width:auto;height:auto;max-width:76%;max-height:78%;border-radius:0;background-size:cover;background-position:center;box-shadow:none;mix-blend-mode:multiply;filter:brightness(1.035);transition:transform var(--dur) var(--ease)}

/* hero */
.hero{padding:clamp(40px,5vw,72px) 0 0}
.hero-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:clamp(32px,5vw,72px);align-items:center}
.hero-eyebrow{font-size:15px;font-weight:600;color:var(--text-2);margin-bottom:18px}
.hero-title{font-size:clamp(40px,5vw,72px);line-height:1.02;letter-spacing:-.032em;font-weight:600;margin-bottom:24px;text-wrap:balance}
.grad{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
.hero-sub{font-size:clamp(18px,1.6vw,21px);line-height:1.38;letter-spacing:-.014em;color:var(--text-2);max-width:32em;margin-bottom:32px}
.cta-row{display:flex;flex-wrap:wrap;gap:12px}
@media (max-width:600px){.bk-cta{flex-direction:column}.bk-cta .btn{width:100%}.cta-row .btn{flex:1 1 auto;padding-inline:14px;font-size:16px}.cta-row .btn .arr{display:none}}
.hero-note{margin-top:28px;font-size:14px;color:var(--text-3);text-wrap:balance}
.hero-note a{color:var(--text-2);transition:color var(--dur) var(--ease)}
.hero-note a:hover{color:#fff}
.hero-podium{aspect-ratio:4/5;max-width:420px;width:100%;justify-self:end}
.hero-podium img{max-width:88%;max-height:88%}
@media (max-width:1023px){
  .hero-grid{grid-template-columns:1fr;gap:40px}
  .hero-podium{justify-self:center;max-width:440px}
  .hero-sub{max-width:none}
}

/* spec satırı */
.specs{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;margin:clamp(36px,4vw,56px) 0 0;padding:0 0 clamp(56px,7vw,96px)}
.spec dt{font-size:clamp(48px,6vw,88px);font-weight:600;letter-spacing:-.045em;line-height:1;font-variant-numeric:tabular-nums}
.spec dd{margin:12px 0 0;font-size:17px;color:var(--text-2)}
@media (max-width:700px){.specs{grid-template-columns:1fr 1fr;gap:28px 16px}}

/* bölümler */
.sec{padding:clamp(72px,9vw,128px) 0}
.sec.alt{background:var(--bg-alt)}
.sec-head{text-align:center;max-width:760px;margin:0 auto clamp(36px,5vw,64px)}
.sec-head h2{font-size:clamp(32px,4.4vw,56px);line-height:1.06;letter-spacing:-.03em;font-weight:600;margin-bottom:16px;text-wrap:balance}
.sec-head p{font-size:clamp(17px,1.5vw,21px);line-height:1.4;letter-spacing:-.014em;color:var(--text-2)}
.sec-foot{text-align:center;margin-top:clamp(32px,4vw,48px)}

/* kitap ızgaraları */
.grid{display:grid;gap:clamp(14px,2vw,24px)}
.grid-3{grid-template-columns:repeat(3,1fr)}
.grid-4{grid-template-columns:repeat(4,1fr)}
@media (max-width:1023px){.grid-4{grid-template-columns:repeat(3,1fr)}}
@media (max-width:767px){.grid-3,.grid-4{grid-template-columns:repeat(2,1fr)}}
.book{display:block;min-width:0}
.book .podium{aspect-ratio:4/5;transition:transform var(--dur) var(--ease),box-shadow var(--dur) var(--ease),background-color var(--dur) var(--ease)}
.book:hover .podium{transform:translateY(-4px);box-shadow:0 40px 70px rgba(0,0,0,.65)}
.book:hover .podium img{transform:scale(1.02)}
.book h3{font-size:17px;font-weight:600;line-height:1.25;letter-spacing:-.016em;margin:16px 0 4px;overflow-wrap:anywhere}
.book .by{font-size:14px;color:var(--text-2)}
.book .meta{font-size:13px;color:var(--text-3);margin-top:4px}
.grid-3 .book h3{font-size:19px}
@media (max-width:767px){.book h3,.grid-3 .book h3{font-size:15px;line-height:1.27}.book .by{font-size:13px}}
.badge{position:absolute;z-index:3;top:14px;left:14px;display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:var(--r-pill);background:rgba(29,29,31,.88);border:1px solid rgba(255,255,255,.1);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font-size:12px;font-weight:600;letter-spacing:0;color:var(--text)}
.badge::before{content:"";width:6px;height:6px;border-radius:50%;background:#f5f5f7}
@media (max-width:767px){.badge{top:10px;left:10px;padding:4px 9px;font-size:11px}}

/* yazarlar: koyu cam kartlar */
.auth{display:flex;flex-direction:column;justify-content:space-between;gap:22px;min-width:0;min-height:0;padding:22px;border-radius:20px;background:var(--glass);border:1px solid var(--hair);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);transition:background-color var(--dur) var(--ease),transform var(--dur) var(--ease),border-color var(--dur) var(--ease)}
.auth:hover{background:var(--glass-2);border-color:var(--hair-2);transform:translateY(-3px)}
.auth-covers{display:flex;align-items:flex-end;justify-content:center;gap:10px;height:118px;padding:12px 14px 8px;overflow:hidden;border-radius:14px;background:radial-gradient(120% 90% at 50% 0%,#f7f7f9,#cdcdd3)}
.auth-covers img{flex:1 1 0;min-width:0;width:auto;height:98px;object-fit:contain;object-position:center bottom;margin:0;border-radius:0;box-shadow:none;background:none!important;mix-blend-mode:multiply;filter:brightness(1.035);transform:none;transition:transform var(--dur) var(--ease)}
.auth:hover .auth-covers img{transform:translateY(-3px)}
.auth h3{font-size:21px;font-weight:600;letter-spacing:-.022em;line-height:1.15;margin-bottom:4px;overflow-wrap:break-word}
.auth p{font-size:14px;color:var(--text-2)}
@media (max-width:1023px){.grid-auth{grid-template-columns:repeat(2,1fr)}}
@media (max-width:480px){.grid-auth{grid-template-columns:1fr}.auth{min-height:0;flex-direction:row;align-items:center;gap:16px;padding:16px}.auth > div:last-child{flex:1;min-width:0}.auth h3{font-size:18px}.auth-covers{flex:none;width:44%;max-width:170px;height:92px;padding:10px 10px 6px;gap:6px}.auth-covers img{height:76px}}

/* yayın çizgisi */
.line{text-align:center;max-width:900px;margin:0 auto}
.line .big{font-size:clamp(22px,2.7vw,34px);line-height:1.25;letter-spacing:-.024em;font-weight:500;margin:0 0 32px;text-wrap:balance}

/* nereden alınır */
.channels{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
@media (max-width:1023px){.channels{grid-template-columns:repeat(2,1fr)}}
@media (max-width:480px){.channels{grid-template-columns:1fr}}
.chan{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding:20px 22px;border-radius:var(--r-tile);background:var(--glass);border:1px solid var(--hair);transition:background-color var(--dur) var(--ease),border-color var(--dur) var(--ease)}
.chan:hover{background:var(--glass-2);border-color:var(--hair-2)}
.chan b{display:block;font-size:17px;font-weight:600;letter-spacing:-.016em}
.chan small{display:block;font-size:13px;color:var(--text-2);margin-top:2px}
.chan .arr{flex:none;color:var(--text-2)}
.chan:hover .arr{color:#fff}
.wa-box{display:grid;grid-template-columns:1.2fr auto;gap:24px;align-items:center;padding:clamp(28px,4vw,44px);border-radius:28px;background:var(--glass);border:1px solid var(--hair)}
.wa-box h3{font-size:clamp(22px,2.4vw,30px);letter-spacing:-.024em;font-weight:600;line-height:1.15;margin-bottom:8px}
.wa-box p{font-size:15px;color:var(--text-2)}
.wa-box .btn{font-size:19px;padding:14px 28px}
@media (max-width:767px){.wa-box{grid-template-columns:1fr}.wa-box .btn{width:100%}}

/* footer */
.footer{border-top:1px solid var(--hair);padding:48px 0 40px;font-size:12px;line-height:1.5;color:var(--text-2)}
.foot-top{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:32px;margin-bottom:32px}
@media (max-width:767px){.foot-top{grid-template-columns:1fr 1fr;gap:28px 20px}}
.foot-logo{margin-bottom:12px}
.foot-slogan{color:var(--text);font-weight:500;margin-bottom:6px}
.footer h4{font-size:12px;font-weight:600;color:var(--text);margin-bottom:10px}
.footer ul{list-style:none;margin:0;padding:0}
.footer li{margin-bottom:8px}
.footer a:hover{text-decoration:underline}
.foot-bottom{display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between;padding-top:20px;border-top:1px solid var(--hair);color:var(--text-3)}

/* kitap sayfası */
.crumbs{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:20px;font-size:13px;color:var(--text-3)}
.crumbs a{color:var(--text-2);transition:color var(--dur) var(--ease)}
.crumbs a:hover{color:#fff}
.bk-hero{padding:clamp(28px,4vw,48px) 0 clamp(56px,7vw,96px)}
.bk-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(32px,5vw,72px);align-items:start}
.bk-podium{aspect-ratio:4/5;position:sticky;top:calc(var(--nav-h) + 24px)}
.bk-podium img{max-width:86%;max-height:86%}
.bk-author{font-size:17px;font-weight:600;color:var(--text-2);margin-bottom:14px;transition:color var(--dur) var(--ease)}
.bk-author:hover{color:#fff}
.bk-title{font-size:clamp(36px,4.8vw,64px);line-height:1.04;letter-spacing:-.032em;font-weight:600;margin-bottom:16px;text-wrap:balance}
.bk-meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:15px;color:var(--text-2);margin-bottom:28px}
.bk-lead{font-size:clamp(18px,1.6vw,21px);line-height:1.4;letter-spacing:-.014em;color:var(--text-2);margin-bottom:28px}
.bk-cta{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px}
.bk-cta-note{font-size:13px;color:var(--text-3);margin-bottom:40px}
.kunye{padding:24px 26px;border-radius:20px;background:var(--glass);border:1px solid var(--hair);margin-bottom:40px}
.kunye h2{font-size:13px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--text-2);margin-bottom:16px}
.kunye dl{display:grid;grid-template-columns:repeat(3,1fr);gap:18px 20px;margin:0}
@media (max-width:560px){.kunye dl{grid-template-columns:1fr 1fr}}
.kunye dt{font-size:13px;color:var(--text-3)}
.kunye dd{margin:2px 0 0;font-size:17px;font-weight:600;letter-spacing:-.016em;font-variant-numeric:tabular-nums}
.bk-desc h2{font-size:24px;letter-spacing:-.024em;font-weight:600;margin-bottom:16px}
.bk-desc p{font-size:17px;line-height:1.55;color:var(--text-2);margin-bottom:18px;max-width:64ch}
.bk-desc p:last-child{margin-bottom:0}
@media (max-width:1023px){
  .bk-grid{grid-template-columns:1fr;gap:40px}
  .bk-podium{position:static;max-width:440px;width:100%;margin:0 auto}
}

/* açık kitap */
.spread-wrap{max-width:980px;margin:0 auto}
.spread-podium{aspect-ratio:auto;padding:clamp(20px,4vw,48px) clamp(16px,4vw,48px);border-radius:28px;background:var(--glass);border-color:var(--hair)}
.spread-podium::after{display:block;content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(90% 55% at 50% 0%,rgba(255,255,255,.07),transparent 62%)}
.spread{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;gap:0;width:100%;max-width:820px;margin:0 auto;perspective:1800px}
.page{position:relative;aspect-ratio:0.6;background:#fff;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.6)}
.page img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:top center;background:#fff;max-width:none;max-height:none;border-radius:0;box-shadow:none;mix-blend-mode:normal;filter:none}
.page.left{border-radius:8px 2px 2px 8px;transform-origin:right center;transform:rotateY(7deg)}
.page.right{border-radius:2px 8px 8px 2px;transform-origin:left center;transform:rotateY(-7deg)}
.page::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none}
.page.left::after{background:linear-gradient(90deg,rgba(0,0,0,0) 72%,rgba(0,0,0,.08) 92%,rgba(0,0,0,.22))}
.page.right::after{background:linear-gradient(270deg,rgba(0,0,0,0) 72%,rgba(0,0,0,.08) 92%,rgba(0,0,0,.26))}
.page.empty{background:transparent;box-shadow:none;border:1px dashed var(--hair-2)}
.page.empty img{display:none}
.spread-ctl{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:24px;font-size:14px;color:var(--text-2);font-variant-numeric:tabular-nums}
.spread-ctl button{width:40px;height:40px;border-radius:50%;border:1px solid var(--hair-2);background:rgba(255,255,255,.08);color:var(--text);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background-color var(--dur) var(--ease),opacity var(--dur) var(--ease)}
.spread-ctl button:hover{background:rgba(255,255,255,.16)}
.spread-ctl button:disabled{opacity:.3;cursor:default}
.spread-note{text-align:center;font-size:13px;color:var(--text-3);margin-top:12px}

/* hareket */
@media (prefers-reduced-motion:no-preference){
  .rv{opacity:0;transform:translateY(18px);transition:opacity 640ms var(--ease),transform 640ms var(--ease)}
  .rv.in{opacity:1;transform:none}
}
@media (prefers-reduced-motion:reduce){
  *{transition:none!important;animation:none!important;scroll-behavior:auto!important}
}
`;

// ---------- JS ----------
const js = `
(function(){
  var nav=document.getElementById('nav');
  var tg=nav&&nav.querySelector('.nav-toggle');
  if(tg){tg.addEventListener('click',function(){var o=nav.classList.toggle('open');tg.setAttribute('aria-expanded',o?'true':'false');tg.setAttribute('aria-label',o?${JSON.stringify(mt.menu_kapat)}:${JSON.stringify(mt.menu_ac)});});}
  var rv=[].slice.call(document.querySelectorAll('.rv'));
  if(!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches){rv.forEach(function(e){e.classList.add('in');});}
  else{var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);}});},{rootMargin:'0px 0px -8% 0px',threshold:.08});rv.forEach(function(e){io.observe(e);});}
  var sp=document.getElementById('spread');
  if(sp){
    var pages=JSON.parse(sp.getAttribute('data-pages'));
    var spreads=[[null,1]];for(var i=2;i<=pages.length;i+=2){spreads.push([i,i+1<=pages.length?i+1:null]);}
    var idx=1,L=sp.querySelector('.page.left'),R=sp.querySelector('.page.right'),cnt=document.getElementById('spread-cnt');
    var prev=document.getElementById('spread-prev'),next=document.getElementById('spread-next');
    function put(el,n){var img=el.querySelector('img');if(n){el.classList.remove('empty');img.src=pages[n-1];img.alt=sp.getAttribute('data-title')+' — '+n+'. sayfa';}else{el.classList.add('empty');img.removeAttribute('src');img.alt='';}}
    function render(){var s=spreads[idx];put(L,s[0]);put(R,s[1]);var lab=s[0]&&s[1]?s[0]+'–'+s[1]:(s[0]||s[1]);cnt.textContent=${JSON.stringify(mt.sayfa_sayaci)}.replace('{n}',lab).replace('{toplam}',pages.length);prev.disabled=idx===0;next.disabled=idx===spreads.length-1;}
    prev.addEventListener('click',function(){if(idx>0){idx--;render();}});
    next.addEventListener('click',function(){if(idx<spreads.length-1){idx++;render();}});
    render();
  }
})();
`;

// ---------- sayfa iskeleti ----------
function layout({ title, desc, body, current }) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#000000">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<a class="skip" href="#main">${esc(mt.skip_link)}</a>
${nav(current)}
<main id="main">
${body}
</main>
${footer()}
<script>${js}</script>
</body>
</html>
`;
}

// ---------- index.html ----------
const indexBody = `
<section class="hero" aria-labelledby="hero-h">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="hero-eyebrow">${esc(site.ad)} · ${esc(slogan)}</p>
      <h1 class="hero-title grad" id="hero-h">${esc(mt.hero_basliklar[0])}.</h1>
      <p class="hero-sub">${esc(mt.hero_alt_baslik)}</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="/kitaplar/">${esc(mt.hero_cta_birincil)}</a>
        <a class="btn btn-glass" href="kitap.html#onizleme">${esc(mt.onizle_uzun)} ${arrow}</a>
      </div>
      <p class="hero-note">Öne çıkan: <a href="kitap.html">${esc(oneCikan.title)}</a> — ${esc(oneCikan.author_display)} · ${esc(tarihTR(oneCikan.publish_date))}</p>
    </div>
    <a class="podium hero-podium" href="kitap.html" aria-label="${esc(oneCikan.title)} — kitap sayfası">
      ${kapakImg(oneCikan, { sizes: '(min-width:1024px) 40vw, 72vw', maxW: 960, eager: true })}
    </a>
  </div>
  <div class="wrap">
    <dl class="specs">
      <div class="spec"><dt>${stats.kitap}</dt><dd>kitap</dd></div>
      <div class="spec"><dt>${stats.yazar}</dt><dd>yazar</dd></div>
      <div class="spec"><dt>${stats.onizleme}</dt><dd>önizlemeli kitap</dd></div>
      <div class="spec"><dt>${stats.set}</dt><dd>set ve seri</dd></div>
    </dl>
  </div>
</section>

<section class="sec alt" id="onizlemeli" aria-labelledby="oniz-h">
  <div class="wrap">
    <div class="sec-head rv">
      <h2 id="oniz-h"><span class="grad">Önizlemeli</span> kitaplar.</h2>
      <p>${esc(mt.bolum_giris.onizlemeli)}</p>
    </div>
    <div class="grid grid-3">
      ${onizlemeli.map((b) => bookCard(b, { badge: true, link: b.id === oneCikan.id ? 'kitap.html' : `/kitaplar/${b.id}/`, sizes: '(min-width:1024px) 30vw, (min-width:768px) 30vw, 44vw', meta: `${b.pages} sayfa · ${esc(tarihTR(b.publish_date))}` })).join('')}
    </div>
    <p class="sec-foot rv"><a class="more" href="/onizleme-hakkinda/">Önizleme hakkında ${arrow}</a></p>
  </div>
</section>

<section class="sec" id="yeni" aria-labelledby="yeni-h">
  <div class="wrap">
    <div class="sec-head rv">
      <h2 id="yeni-h">Yeni çıkanlar.</h2>
      <p>${esc(mt.bolum_giris.yeni_cikanlar)}</p>
    </div>
    <div class="grid grid-4">
      ${yeniCikanlar.map((b) => bookCard(b, { link: `/kitaplar/${b.id}/`, sizes: '(min-width:1024px) 22vw, (min-width:768px) 30vw, 44vw', meta: esc(tarihTR(b.publish_date)) })).join('')}
    </div>
    <p class="sec-foot rv"><a class="more" href="/kitaplar/">${esc(mt.tum_kitaplar)} ${arrow}</a></p>
  </div>
</section>

<section class="sec alt" id="yazarlar" aria-labelledby="yazar-h">
  <div class="wrap">
    <div class="sec-head rv">
      <h2 id="yazar-h">Yazarlar.</h2>
      <p>${esc(mt.bolum_giris.yazarlar)}</p>
    </div>
    <div class="grid grid-4 grid-auth">
      ${yazarlar.map(authorCard).join('')}
    </div>
    <p class="sec-foot rv"><a class="more" href="/yazarlar/">${esc(mt.tum_yazarlar)} ${arrow}</a></p>
  </div>
</section>

<section class="sec" id="yayin-cizgisi" aria-labelledby="yc-h">
  <div class="wrap">
    <div class="sec-head rv">
      <h2 id="yc-h">Yayın çizgisi.</h2>
      <p>${esc(mt.bolum_giris.yayin_cizgisi)}</p>
    </div>
    <div class="line rv">
      <p class="big">${esc(yayinOzet)}</p>
      <a class="more" href="/yayin-cizgisi/">Yayın çizgisini okuyun ${arrow}</a>
    </div>
  </div>
</section>

<section class="sec alt" id="nereden-alinir" aria-labelledby="na-h">
  <div class="wrap">
    <div class="sec-head rv">
      <h2 id="na-h">${esc(mt.nereden_alinir)}.</h2>
      <p>${esc(mt.bolum_giris.nereden_alinir)}</p>
    </div>
    <div class="channels rv">
      ${satisKanallari.map((k) => `<a class="chan" href="${esc(k.url)}" target="_blank" rel="noopener"><span><b>${esc(k.ad)}</b><small>${esc(k.not)}</small></span>${arrow}</a>`).join('')}
    </div>
    <div class="wa-box rv">
      <div>
        <h3>${esc(mt.whatsapp_cta)}</h3>
        <p>${esc(site.telefon_gosterim)} · ${esc(mt.whatsapp_not)} ${esc(mt.nereden_alinir_not)}</p>
      </div>
      <a class="btn btn-primary" href="${esc(site.whatsapp_url)}" target="_blank" rel="noopener">${waIcon}<span>${esc(mt.whatsapp_cta)}</span></a>
    </div>
  </div>
</section>
`;

// ---------- kitap.html ----------
const paras = oneCikan.description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const kategori = (oneCikan.categories.find((c) => c.includes('>')) || oneCikan.categories[0] || '').split('>').pop().trim();
const sayfaListesi = Object.keys(onsoz[oneCikan.id]).map(Number).sort((a, b) => a - b).map((n) => `${PUB}${onsoz[oneCikan.id][String(n)].webp[0].url}`);
const kunye = [
  [mt.kunye_yazar, oneCikan.author_display],
  [mt.kunye_sayfa, `${oneCikan.pages} sayfa`],
  [mt.kunye_boyut, oneCikan.dimensions.replace('.', ',').replace(' x ', ' × ')],
  [mt.kunye_yil, tarihTR(oneCikan.publish_date)],
  [mt.kunye_isbn, oneCikan.isbn],
  [mt.kunye_cilt, oneCikan.binding],
  ['Kağıt', oneCikan.paper],
  [mt.kunye_dil, oneCikan.language === 'tr' ? 'Türkçe' : oneCikan.language],
].filter(([, v]) => v);

const kitapBody = `
<div class="wrap">
  <nav class="crumbs" aria-label="Konum"><a href="index.html">Ana sayfa</a><span>›</span><a href="/kitaplar/">Kitaplar</a><span>›</span><span>${esc(oneCikan.title)}</span></nav>
</div>
<section class="bk-hero" aria-labelledby="bk-h">
  <div class="wrap bk-grid">
    <div class="podium bk-podium">
      ${kapakImg(oneCikan, { sizes: '(min-width:1024px) 40vw, 72vw', maxW: 960, eager: true })}
    </div>
    <div>
      <a class="bk-author" href="/yazarlar/${esc(authors.find((a) => a.name === oneCikan.authors[0])?.slug || '')}/">${esc(oneCikan.author_display)}</a>
      <h1 class="bk-title grad" id="bk-h">${esc(oneCikan.title)}</h1>
      <p class="bk-meta"><span>${esc(kategori)}</span><span>·</span><span>${oneCikan.pages} sayfa</span><span>·</span><span>${esc(tarihTR(oneCikan.publish_date))}</span></p>
      <p class="bk-lead">${esc(paras[0])}</p>
      <div class="bk-cta">
        <a class="btn btn-primary" href="${esc(waKitap(oneCikan.title))}" target="_blank" rel="noopener">${waIcon}<span>${esc(mt.whatsapp_cta)}</span></a>
        <a class="btn btn-glass" href="#onizleme">${esc(mt.onizle_uzun)} ${arrow}</a>
      </div>
      <p class="bk-cta-note">${esc(mt.whatsapp_not)}</p>
      <div class="kunye">
        <h2>${esc(mt.kunye)}</h2>
        <dl>${kunye.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </div>
      <div class="bk-desc">
        <h2>Kitap hakkında</h2>
        ${paras.slice(1).map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
      </div>
    </div>
  </div>
</section>

<section class="sec alt" id="onizleme" aria-labelledby="oniz-h">
  <div class="wrap">
    <div class="sec-head rv">
      <h2 id="oniz-h">${esc(mt.onizleme_baslik)}.</h2>
      <p>${esc(mt.onizleme_notu)}</p>
    </div>
    <div class="spread-wrap rv">
      <div class="podium spread-podium">
        <div class="spread" id="spread" data-title="${esc(oneCikan.title)}" data-pages='${JSON.stringify(sayfaListesi)}'>
          <div class="page left">${onsozSayfa(oneCikan.id, 2, true)}</div>
          <div class="page right">${onsozSayfa(oneCikan.id, 3, true)}</div>
        </div>
      </div>
      <div class="spread-ctl">
        <button type="button" id="spread-prev" aria-label="${esc(mt.onceki)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
        <span id="spread-cnt" aria-live="polite"></span>
        <button type="button" id="spread-next" aria-label="${esc(mt.sonraki)}">${arrow}</button>
      </div>
      <p class="spread-note">${esc(oneCikan.title)} · ${esc(oneCikan.author_display)}</p>
    </div>
  </div>
</section>

<section class="sec" id="nereden-alinir" aria-labelledby="na-h">
  <div class="wrap">
    <div class="sec-head rv">
      <h2 id="na-h">${esc(mt.nereden_alinir)}.</h2>
      <p>${esc(mt.nereden_alinir_not)}</p>
    </div>
    <div class="channels rv">
      ${satisKanallari.map((k) => {
        const url = oneCikan.sources?.[k.ad === 'Küresel Kitap' ? 'kureselkitap' : k.ad === 'Kitapyurdu' ? 'kitapyurdu' : k.ad === 'Nobel Kitap' ? 'nobelkitap' : ''] || k.url;
        const not = url !== k.url ? 'Kitap sayfası' : k.not;
        return `<a class="chan" href="${esc(url)}" target="_blank" rel="noopener"><span><b>${esc(k.ad)}</b><small>${esc(not)}</small></span>${arrow}</a>`;
      }).join('')}
    </div>
    <div class="wa-box rv">
      <div>
        <h3>${esc(mt.whatsapp_cta)}</h3>
        <p>${esc(site.telefon_gosterim)} · ${esc(mt.whatsapp_not)}</p>
      </div>
      <a class="btn btn-primary" href="${esc(waKitap(oneCikan.title))}" target="_blank" rel="noopener">${waIcon}<span>${esc(mt.whatsapp_cta)}</span></a>
    </div>
  </div>
</section>
`;

// ---------- yaz ----------
const indexHtml = layout({
  title: `${site.ad} — ${slogan}`,
  desc: mt.hero_alt_baslik,
  body: indexBody,
  current: 'index',
});
const kitapHtml = layout({
  title: `${oneCikan.title} — ${oneCikan.author_display} · ${site.ad}`,
  desc: paras[0].slice(0, 155),
  body: kitapBody,
  current: 'kitap',
});
fs.writeFileSync(path.join(HERE, 'index.html'), indexHtml);
fs.writeFileSync(path.join(HERE, 'kitap.html'), kitapHtml);

console.log(`index.html: ${(indexHtml.length / 1024).toFixed(1)} KB · kitap.html: ${(kitapHtml.length / 1024).toFixed(1)} KB`);
console.log(`Sayılar: ${stats.kitap} kitap · ${stats.yazar} yazar · ${stats.onizleme} önizlemeli · ${stats.set} set`);
console.log(`Önizlemeli: ${onizlemeli.length} · Yeni: ${yeniCikanlar.length} · Yazar: ${yazarlar.length} · Kanal: ${satisKanallari.length}`);
console.log('Yeni çıkanlar:', yeniCikanlar.map((b) => `${b.id} (${b.publish_date})`).join(', '));
console.log('Yazarlar:', yazarlar.map((a) => `${a.display} (${a.book_ids.length})`).join(', '));
const metin = (indexHtml + kitapHtml).replace(/url\(data:[^)]*\)/g, '');
if (/fiyat|₺|\bTL\b/i.test(metin)) console.warn('UYARI: çıktıda fiyat benzeri metin var');
