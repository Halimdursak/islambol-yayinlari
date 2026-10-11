// Q1 erişilebilirlik denetimi. Kullanım: node scripts/qa/a11y/denetle.mjs [--base http://localhost:8091]
// Önkoşul: npm run build; node scripts/qa/sunucu.mjs --dir dist --port 8091  (başka build ile çakışmamak için: --dist <klasör> ile aynı klasör verilir)
import { createRequire } from "node:module";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");
const bi = process.argv.indexOf("--base");
const BASE = bi > -1 ? process.argv[bi + 1] : "http://localhost:8091";
const KOK = resolve(import.meta.dirname, "../../..");
const CIKTI = resolve(KOK, "docs/qa/a11y");
mkdirSync(CIKTI, { recursive: true });
const AXE = resolve(KOK, "node_modules/axe-core/axe.min.js");
const di = process.argv.indexOf("--dist");
const DIST = di > -1 ? resolve(process.argv[di + 1]) : resolve(KOK, "dist");
const ilkDizi = readdirSync(resolve(DIST, "dizi"))[0];
const SAYFALAR = [
  "/", "/kitaplar/", "/kitaplar/?kategori=tarih", "/kitap/sen-neden-kor-edildin/", "/kitap/hayat-ve-hatiratim/",
  "/yazarlar/", "/yazar/cevat-rifat-atilhan/", "/diziler/", `/dizi/${ilkDizi}/`, "/hakkimizda/", "/nereden-alinir/",
  "/iletisim/", "/onizleme-hakkinda/", "/404.html",
];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const sonuc = { axe: [], klavye: [], yapi: [], reflow: [], hareket: [], dialog: {}, kontrast: [], kontrastOlcum: [] };

async function axeCalistir(page, etiket, sayfa, genislik, mod) {
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate((t) => axe.run({ runOnly: t }), TAGS);
  const ihlaller = r.violations.map((v) => ({
    kural: v.id, etki: v.impact, yardim: v.help, wcag: v.tags.filter((x) => /^wcag\d{3,}$/.test(x) || /^wcag2a/.test(x)).join(","),
    dugumSayisi: v.nodes.length,
    dugumler: v.nodes.slice(0, 3).map((n) => ({ secici: n.target.join(" "), ozet: (n.failureSummary || "").split("\n").slice(0, 3).join(" | ") })),
  }));
  sonuc.axe.push({ sayfa, genislik, mod, etiket, ihlaller, gecen: r.passes.length, tamamlanmamis: r.incomplete.map((x) => x.id),
    tamamlanmamisKontrast: (r.incomplete.find((x) => x.id === "color-contrast")?.nodes || []).slice(0, 6).map((n) => ({ secici: n.target.join(" "), neden: n.any?.[0]?.message || "" })) });
  return r;
}
const yeniSayfa = async (br, w, opts = {}) => {
  const ctx = await br.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, ...opts });
  const page = await ctx.newPage();
  return { ctx, page };
};
const sayac = (page) => page.evaluate(() => document.querySelector("[data-onizleme-sayac]").textContent.trim());
const acikMi = (page) => page.evaluate(() => document.querySelector("dialog").open);

const br = await chromium.launch({ channel: "msedge" });
try {
  // 1) axe: tüm sayfalar x 390/1440 + yapı
  for (const s of SAYFALAR) for (const w of [390, 1440]) {
    const { ctx, page } = await yeniSayfa(br, w);
    await page.goto(BASE + s, { waitUntil: "networkidle" });
    await axeCalistir(page, "sayfa", s, w, "acik");
    if (w === 1440) {
      const y = await page.evaluate(() => {
        const bas = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((e) => !e.closest("dialog:not([open])"));
        const seviyeler = bas.map((h) => +h.tagName[1]);
        const atlama = []; let onceki = 0;
        seviyeler.forEach((l, k) => { if (onceki && l > onceki + 1) atlama.push(`h${onceki} -> h${l}: ${bas[k].textContent.trim().slice(0, 30)}`); onceki = l; });
        const imgs = [...document.images];
        const altYok = imgs.filter((im) => !im.hasAttribute("alt")).map((im) => im.src.split("/").pop());
        const altBos = imgs.filter((im) => im.getAttribute("alt") === "").length;
        const kotuLink = [...document.querySelectorAll("a")].filter((a) => /^(buraya tıklay|tıklayın|tıkla|burada|devamı|daha fazla|link)\W*$/i.test(a.textContent.trim())).map((a) => a.textContent.trim());
        const adsizLink = [...document.querySelectorAll("a[href]")].filter((a) => !(a.textContent.trim() || a.getAttribute("aria-label") || a.querySelector("img[alt]:not([alt=''])"))).map((a) => a.outerHTML.slice(0, 100));
        const adsizDugme = [...document.querySelectorAll("button")].filter((b) => !(b.textContent.trim() || b.getAttribute("aria-label"))).map((b) => b.outerHTML.slice(0, 100));
        const formAlan = [...document.querySelectorAll("input:not([type=hidden]),select,textarea")].filter((f) => !(f.labels?.length || f.getAttribute("aria-label") || f.getAttribute("aria-labelledby"))).map((f) => f.outerHTML.slice(0, 80));
        const atla = document.querySelector("a.atla");
        return {
          lang: document.documentElement.lang, h1: document.querySelectorAll("h1").length, h1Metin: document.querySelector("h1")?.textContent.trim().slice(0, 60),
          main: document.querySelectorAll("main").length, header: document.querySelectorAll("header").length,
          footer: document.querySelectorAll("footer").length, nav: document.querySelectorAll("nav").length,
          navEtiketsiz: [...document.querySelectorAll("nav")].filter((n) => !n.getAttribute("aria-label") && !n.getAttribute("aria-labelledby")).length,
          baslikAtlama: atlama, imgSayisi: imgs.length, altYok, altBos, kotuLink, adsizLink, adsizDugme, formAlan, baslik: document.title,
          atlaLink: atla?.getAttribute("href") || null, atlaHedefVar: atla ? !!document.querySelector(atla.getAttribute("href")) : false,
        };
      });
      sonuc.yapi.push({ sayfa: s, ...y });
    }
    await ctx.close();
  }

  // koyu mod
  for (const s of ["/", "/kitap/sen-neden-kor-edildin/"]) {
    const { ctx, page } = await yeniSayfa(br, 1440, { colorScheme: "dark" });
    await page.goto(BASE + s, { waitUntil: "networkidle" });
    await axeCalistir(page, "koyu", s, 1440, "koyu");
    await page.screenshot({ path: resolve(CIKTI, s === "/" ? "koyu-ana-1440.png" : "koyu-kitap-1440.png") });
    await ctx.close();
  }

  // dialog açık: axe + kontroller
  for (const [w, cs] of [[1440, "light"], [390, "light"], [1440, "dark"]]) {
    const { ctx, page } = await yeniSayfa(br, w, { colorScheme: cs });
    await page.goto(BASE + "/kitap/sen-neden-kor-edildin/", { waitUntil: "networkidle" });
    await page.focus("button[data-onizleme]");
    await page.keyboard.press("Enter");
    await page.waitForSelector("dialog[open]");
    await page.waitForTimeout(1500);
    await axeCalistir(page, "dialog-acik", "/kitap/sen-neden-kor-edildin/", w, cs === "dark" ? "koyu" : "acik");
    if (w === 1440 && cs === "light") {
      const d = {};
      d.ariaLabelledby = await page.getAttribute("dialog", "aria-labelledby");
      d.baslikMetni = (await page.textContent("#onizleme-baslik"))?.trim();
      d.kapatAriaLabel = await page.getAttribute("[data-onizleme-kapat]", "aria-label");
      d.sayacAriaLive = await page.getAttribute("[data-onizleme-sayac]", "aria-live");
      d.sayacMetni = await sayac(page);
      d.htmlSinif = await page.evaluate(() => document.documentElement.classList.contains("onizleme-acik"));
      d.overflow = await page.evaluate(() => getComputedStyle(document.documentElement).overflow + "/" + getComputedStyle(document.body).overflow);
      d.odakIlk = await page.evaluate(() => document.activeElement.outerHTML.slice(0, 90));
      d.modal = await page.evaluate(() => document.querySelector("dialog").matches(":modal"));
      const odaklar = [];
      for (let k = 0; k < 14; k++) {
        await page.keyboard.press("Tab");
        odaklar.push(await page.evaluate(() => { const a = document.activeElement; return { icinde: !!a.closest("dialog") || a === document.body, etiket: a.getAttribute("aria-label") || a.textContent.trim().slice(0, 20) || a.tagName }; }));
      }
      d.tabHapsi = odaklar.every((o) => o.icinde); // body = odak tarayıcı kromuna çıkıp geri sarıyor (native modal davranışı)
      d.tabSirasi = odaklar.map((o) => o.etiket).join(" > ");
      const s0 = await sayac(page);
      await page.keyboard.press("ArrowRight"); await page.waitForTimeout(1000);
      const s1 = await sayac(page);
      await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(1000);
      const s2 = await sayac(page);
      d.sayac = [s0, s1, s2]; d.okIleCevirir = s1 !== s0 && s2 === s0;
      await page.screenshot({ path: resolve(CIKTI, "dialog-acik-1440.png") });
      await page.focus("[data-onizleme-sonraki]");
      d.dialogOdakHalkasi = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor} off:${c.outlineOffset}`; });
      await page.keyboard.press("Escape"); await page.waitForTimeout(500);
      d.escKapatti = !(await acikMi(page));
      d.odakDugmeyeDondu = await page.evaluate(() => document.activeElement.matches("[data-onizleme]"));
      d.kilitKalkti = await page.evaluate(() => !document.documentElement.classList.contains("onizleme-acik"));
      await page.keyboard.press("Enter"); await page.waitForSelector("dialog[open]"); await page.waitForTimeout(600);
      await page.mouse.click(5, 5); await page.waitForTimeout(500);
      d.scrimKapatti = !(await acikMi(page));
      await page.focus("button[data-onizleme]"); await page.keyboard.press("Space"); await page.waitForTimeout(600);
      d.spaceIleAcilir = await acikMi(page);
      if (d.spaceIleAcilir) { await page.click("[data-onizleme-kapat]"); await page.waitForTimeout(400); d.kapatDugmesiKapatti = !(await acikMi(page)); }
      sonuc.dialog = d;
    }
    if (w === 390 && cs === "light") await page.screenshot({ path: resolve(CIKTI, "dialog-acik-390.png") });
    if (cs === "dark") await page.screenshot({ path: resolve(CIKTI, "dialog-koyu-1440.png") });
    await ctx.close();
  }

  // reduced-motion
  {
    const { ctx, page } = await yeniSayfa(br, 1440, { reducedMotion: "reduce" });
    await page.goto(BASE + "/kitap/sen-neden-kor-edildin/", { waitUntil: "networkidle" });
    await page.click("button[data-onizleme]"); await page.waitForSelector("dialog[open]"); await page.waitForTimeout(1500);
    const g = await page.evaluate(() => ({
      galeriGorunur: !document.querySelector("[data-onizleme-galeri]").hidden,
      flipKutuBos: document.querySelector("[data-onizleme-kitap-kutu]").children.length === 0,
      galeriOge: document.querySelectorAll("[data-onizleme-galeri] li").length,
    }));
    sonuc.hareket.push({ test: "onizleme-galeri-modu", ...g });
    // galeri klavyeyle kaydırılabilir mi?
    const gk = { sayfaTab: [] };
    for (let k = 0; k < 6; k++) { await page.keyboard.press("Tab"); gk.sayfaTab.push(await page.evaluate(() => { const a = document.activeElement; return a.getAttribute("aria-label") || a.className.toString().split(" ")[0] || a.tagName; })); }
    gk.galeriOdaklandi = gk.sayfaTab.some((x) => /galeri/.test(x));
    const kaydir = await page.evaluate(() => { const g = document.querySelector("[data-onizleme-galeri]"); const alan = document.querySelector("[data-onizleme-alan]"); const sc = [g, alan, g.parentElement].find((e) => e && e.scrollHeight > e.clientHeight + 2); return sc ? { eleman: sc.className, sh: sc.scrollHeight, ch: sc.clientHeight } : null; });
    gk.kaydirilabilirKap = kaydir;
    await page.focus("[data-onizleme-kapat]"); const y0 = await page.evaluate(() => (document.querySelector("[data-onizleme-alan]").scrollTop + document.querySelector("[data-onizleme-galeri]").scrollTop)); await page.keyboard.press("PageDown"); await page.waitForTimeout(400); gk.kapatOdaktaPageDownKaydirir = (await page.evaluate(() => (document.querySelector("[data-onizleme-alan]").scrollTop + document.querySelector("[data-onizleme-galeri]").scrollTop))) > y0;
    sonuc.hareket.push({ test: "galeri-klavye", ...gk });
    await axeCalistir(page, "dialog-reduced", "/kitap/sen-neden-kor-edildin/", 1440, "reduced");
    await page.screenshot({ path: resolve(CIKTI, "dialog-reduced-1440.png") });
    await ctx.close();
    for (const s of ["/", "/kitaplar/", "/kitap/sen-neden-kor-edildin/", "/hakkimizda/"]) {
      const { ctx: c2, page: p2 } = await yeniSayfa(br, 1440, { reducedMotion: "reduce" });
      await p2.goto(BASE + s, { waitUntil: "networkidle" });
      const r = await p2.evaluate(() => {
        const liste = [];
        for (const e of document.querySelectorAll("*")) {
          const c = getComputedStyle(e);
          const td = c.transitionDuration.split(",").map((x) => parseFloat(x)).some((x) => x > 0.001);
          const ad = c.animationName !== "none" && c.animationDuration.split(",").map((x) => parseFloat(x)).some((x) => x > 0.001);
          if (td || ad) liste.push(`${e.tagName.toLowerCase()}.${(e.className?.toString?.() || "").split(" ")[0]} t=${c.transitionDuration} a=${c.animationName}/${c.animationDuration}`);
        }
        return { adet: liste.length, ornek: [...new Set(liste)].slice(0, 6), scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior };
      });
      sonuc.hareket.push({ test: "hesaplanan-sure", sayfa: s, ...r });
      await c2.close();
    }
  }

  // 2) klavye
  {
    const { ctx, page } = await yeniSayfa(br, 1440);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const sira = [];
    for (let k = 0; k < 8; k++) {
      await page.keyboard.press("Tab");
      sira.push(await page.evaluate(() => { const a = document.activeElement; const c = getComputedStyle(a); const r = a.getBoundingClientRect(); return { e: `${a.tagName.toLowerCase()}${a.className ? "." + a.className.toString().split(" ")[0] : ""}`, metin: (a.textContent || "").trim().slice(0, 30), halka: `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor}`, goruk: r.width > 0 && r.bottom > 0 && r.top < innerHeight, fv: a.matches(":focus-visible") }; }));
      if (k === 0) await page.screenshot({ path: resolve(CIKTI, "odak-skip-link-1440.png"), clip: { x: 0, y: 0, width: 1440, height: 200 } });
      if (k === 2) await page.screenshot({ path: resolve(CIKTI, "odak-halkasi-1440.png"), clip: { x: 0, y: 0, width: 1440, height: 260 } });
    }
    sonuc.klavye.push({ test: "ana-sayfa-tab-sirasi", sira });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
    sonuc.klavye.push({ test: "skip-link-enter", odakSonra: await page.evaluate(() => `${document.activeElement.tagName}#${document.activeElement.id}`), hash: await page.evaluate(() => location.hash) });
    await ctx.close();
  }
  {
    const { ctx, page } = await yeniSayfa(br, 390);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const d = page.locator(".ust__menu-dugme");
    const dur = async () => ({ exp: await d.getAttribute("aria-expanded"), gorunur: await page.locator("#ana-menu").isVisible() });
    const r = { baslangic: await dur() };
    await d.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(500); r.enterSonra = await dur();
    await page.screenshot({ path: resolve(CIKTI, "menu-acik-390.png") });
    await page.keyboard.press("Escape"); await page.waitForTimeout(500); r.escSonra = await dur();
    r.escSonrasiOdak = await page.evaluate(() => document.activeElement.className.toString().slice(0, 30));
    await d.focus();
    await page.keyboard.press("Space"); await page.waitForTimeout(500); r.spaceSonra = await dur();
    await page.keyboard.press("Space"); await page.waitForTimeout(500); r.spaceIkinci = await dur();
    sonuc.klavye.push({ test: "mobil-menu", ...r });
    await ctx.close();
  }
  {
    const { ctx, page } = await yeniSayfa(br, 1440);
    await page.goto(BASE + "/kitaplar/", { waitUntil: "networkidle" });
    const goruNen = () => page.evaluate(() => [...document.querySelectorAll(".kitap-karti")].filter((k) => k.offsetParent && !k.closest("[hidden]")).length);
    const once = await goruNen();
    await page.locator('[data-kategori-cip="tarih"]').focus();
    await page.keyboard.press("Enter"); await page.waitForTimeout(600);
    const sonra = { n: await goruNen(), basili: await page.getAttribute('[data-kategori-cip="tarih"]', "aria-pressed"), url: await page.evaluate(() => location.search) };
    await page.locator('[data-kategori-cip=""]').focus(); await page.keyboard.press("Space"); await page.waitForTimeout(600);
    sonuc.klavye.push({ test: "filtre-cipleri", once, sonra, geri: await goruNen() });
    sonuc.klavye.push({ test: "filtre-sonuc-duyurusu", durum: await page.evaluate(() => [...document.querySelectorAll("[aria-live],[role=status]")].map((l) => ({ rol: l.getAttribute("role"), live: l.getAttribute("aria-live"), metin: l.textContent.trim().slice(0, 60) }))) });
    await ctx.close();
  }
  {
    const { ctx, page } = await yeniSayfa(br, 1440);
    await page.goto(BASE + "/kitap/sen-neden-kor-edildin/", { waitUntil: "networkidle" });
    await page.focus("button[data-onizleme]");
    const h = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor} off ${c.outlineOffset}`; });
    sonuc.klavye.push({ test: "kitap-onizle-dugme-odak-halkasi", halka: h });
    await page.screenshot({ path: resolve(CIKTI, "odak-onizle-dugme-1440.png") });
    await ctx.close();
  }

  // 5) reflow 320 + 720
  for (const w of [320, 720]) for (const s of SAYFALAR) {
    const { ctx, page } = await yeniSayfa(br, w);
    await page.goto(BASE + s, { waitUntil: "networkidle" });
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const tasan = [...document.querySelectorAll("body *")].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1 && !e.closest("dialog:not([open])") && !e.closest("[hidden]") && getComputedStyle(e).position !== "fixed"; }).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${e.className?.toString().split(" ")[0]} right=${Math.round(e.getBoundingClientRect().right)}`);
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, yatayKayma: de.scrollWidth > de.clientWidth + 1, tasan };
    });
    sonuc.reflow.push({ sayfa: s, genislik: w, ...r });
    await ctx.close();
  }


  // 3) elle kontrast ölçümü (axe image/gradient arkaplanlarda "incomplete" döner): hesaplanan renklerden WCAG oranı
  const OLCUM = [
    ["/", ["body p", "h1", "main a:not([class])", ".etiket", ".dugme--birincil", ".dugme--ikincil", ".ust__nav a", "footer p", "footer a", ".kitap-karti__yazar", ".kitap-karti__baslik a", ".iz a"]],
    ["/kitaplar/", [".cip", ".cip[aria-pressed=true]", ".filtre__alan span", "input[type=search]", ".katalog__sayi"]],
    ["/kitap/sen-neden-kor-edildin/", [".kunye dt", ".kunye dd", ".kitap-detay__not", ".kitap-detay__onizle", ".cip"]],
  ];
  for (const [mod, cs] of [["acik", "light"], ["koyu", "dark"]]) {
    const { ctx, page } = await yeniSayfa(br, 1440, { colorScheme: cs });
    for (const [s, secs] of OLCUM) {
      await page.goto(BASE + s, { waitUntil: "networkidle" });
      const r = await page.evaluate((secs) => {
        const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true });
        const parse = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
        const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const harman = (ust, alt) => ({ r: ust.r * ust.a + alt.r * (1 - ust.a), g: ust.g * ust.a + alt.g * (1 - ust.a), b: ust.b * ust.a + alt.b * (1 - ust.a), a: 1 });
        const bg = (el) => { const zincir = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) { zincir.push(c); if (c.a === 1) break; } } let t = { r: 255, g: 255, b: 255, a: 1 }; for (const c of zincir.reverse()) t = harman(c, t); return t; };
        return secs.map((q) => { const el = [...document.querySelectorAll(q)].find((e) => e.offsetParent && e.textContent.trim().length) || document.querySelector(q); if (!el) return { q, yok: true };
          const cs = getComputedStyle(el); const fg0 = parse(cs.color); const b = bg(el); const fg = harman(fg0, b); const L1 = lum(fg), L2 = lum(b); const oran = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const px = parseFloat(cs.fontSize), kalin = parseInt(cs.fontWeight) >= 700; const buyuk = px >= 24 || (px >= 18.66 && kalin);
          return { q, renk: cs.color, zemin: "rgb(" + [b.r, b.g, b.b].map(Math.round).join(",") + ")", oran: +oran.toFixed(2), esik: buyuk ? 3 : 4.5, px }; });
      }, secs);
      for (const x of r) sonuc.kontrastOlcum.push({ sayfa: s, mod, ...x });
    }
    await ctx.close();
  }

  sonuc.kontrast = sonuc.axe.flatMap((a) => a.ihlaller.filter((v) => v.kural === "color-contrast").map((v) => ({ sayfa: a.sayfa, genislik: a.genislik, mod: a.mod, etiket: a.etiket, dugumler: v.dugumler })));
} finally {
  await br.close();
}

writeFileSync(resolve(CIKTI, "axe-sonuc.json"), JSON.stringify(sonuc, null, 2));
const say = { critical: 0, serious: 0, moderate: 0, minor: 0 };
console.log("sayfa | genislik | mod | etiket | crit/ser/mod/min");
for (const a of sonuc.axe) {
  const c = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  a.ihlaller.forEach((v) => { c[v.etki] = (c[v.etki] || 0) + 1; say[v.etki] = (say[v.etki] || 0) + 1; });
  console.log(`${a.sayfa} | ${a.genislik} | ${a.mod} | ${a.etiket} | ${c.critical}/${c.serious}/${c.moderate}/${c.minor}` + (a.ihlaller.length ? "  " + a.ihlaller.map((v) => v.kural).join(",") : ""));
}
console.log("TOPLAM", say);
console.log("-> docs/qa/a11y/axe-sonuc.json");
