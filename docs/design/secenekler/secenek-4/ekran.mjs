// Ekran görüntüleri + yatay kaydırma kontrolü (Playwright, msedge).
// Çalıştır: node docs/design/secenekler/secenek-4/ekran.mjs
import { chromium } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = "http://127.0.0.1:8096/docs/design/secenekler/secenek-4/";

async function hazirla(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
  // lazy görseller + reveal için sayfayı adım adım sonuna kadar kaydır
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto"; // smooth scroll animasyonu görüntüyü kaydırmasın
    const h = () => document.documentElement.scrollHeight;
    for (let y = 0; y < h(); y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); }
    window.scrollTo(0, h());
    await new Promise((r) => setTimeout(r, 300));
    // yatay rafta görünmeyen lazy görseller hiç yüklenmez; hepsini eager'a çevirip en çok 8 sn bekle
    [...document.images].forEach((i) => { i.loading = "eager"; });
    await Promise.race([
      Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
      new Promise((r) => setTimeout(r, 8000)),
    ]);
    document.querySelectorAll(".rv").forEach((e) => e.classList.add("in"));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
  await page.waitForLoadState("networkidle");
  const y = await page.evaluate(() => window.scrollY);
  if (y !== 0) throw new Error("sayfa başa dönmedi: scrollY=" + y);
}

async function kaydirmaKontrol(page, etiket) {
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    tasanlar: [...document.querySelectorAll("body *")]
      .filter((e) => { const b = e.getBoundingClientRect(); return b.right > window.innerWidth + 1 && getComputedStyle(e).position !== "fixed" && !e.closest(".track,.feats"); })
      .slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`),
  }));
  console.log(`${etiket}: scrollWidth=${r.sw} innerWidth=${r.iw} ${r.sw <= r.iw ? "OK" : "TAŞMA!"} ${r.tasanlar.length ? "taşan: " + r.tasanlar.join(", ") : ""}`);
  return r.sw <= r.iw;
}

const browser = await chromium.launch({ channel: "msedge" });
let hepsiOk = true;
for (const [sayfa, w, h, dosya, full] of [
  ["index.html", 1440, 900, "ana-1440.png", true],
  ["index.html", 1440, 900, "hero-1440.png", false],
  ["index.html", 390, 844, "ana-390.png", true],
  ["index.html", 768, 1024, null, true],
  ["kitap.html", 1440, 900, "kitap-1440.png", true],
  ["kitap.html", 390, 844, null, true],
  ["kitap.html", 768, 1024, null, true],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: "tr-TR" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("requestfailed", (r) => errs.push("istek başarısız: " + r.url()));
  await hazirla(page, BASE + sayfa);
  hepsiOk = (await kaydirmaKontrol(page, `${sayfa}@${w}`)) && hepsiOk;
  if (errs.length) console.log("  hata:", errs.join(" | "));
  if (dosya) { await page.screenshot({ path: join(HERE, dosya), fullPage: full }); console.log("  →", dosya); }
  await ctx.close();
}
await browser.close();
console.log(hepsiOk ? "YATAY KAYDIRMA YOK" : "YATAY KAYDIRMA VAR");
