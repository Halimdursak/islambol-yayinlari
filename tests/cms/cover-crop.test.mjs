import test from "node:test";
import assert from "node:assert/strict";
import { findArtwork, planCrops } from "../../src/assets/js/cover-crop.js";

const DPI = 254;                         // 100 px / cm: ölçüler okunur
const cm = (v) => Math.round(v * 100);

/** Sentetik baskı sayfası: sayfa genişliği × yüksekliği (cm); artBox (cm) içi renkli, dışı kâğıt beyazı. */
function page(widthCm, heightCm, artBox, { light = false } = {}) {
  const width = cm(widthCm);
  const height = cm(heightCm);
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const [l, t, r, b] = artBox.map(cm);
  for (let y = t; y < b; y++) {
    for (let x = l; x < r; x++) {
      const i = (y * width + x) * 4;
      // "light": sağ yarı (ön kapak) çok açık renkli ama beyaz değil
      const v = light && x > (l + r) / 2 ? 250 : 40;
      data[i] = data[i + 1] = v; data[i + 2] = v === 250 ? 246 : 90;
    }
  }
  return { data, width, height };
}

const near = (a, b, tolerance, label) => assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} ≈ ${b} (±${tolerance})`);

test("kırpma işaretli sayfa: kenar boşluğu atılır, ön ve arka panel 13,5 cm, sırt doğru bulunur", () => {
  // 31,83 × 21,83 cm sayfa; sanat (taşmalı) 0,64..31,19 × 0,64..21,2 → kesim 29,5 × 19,5, sırt 2,5 cm
  const raster = page(31.83, 21.83, [0.64, 0.64, 31.19, 21.2]);
  const art = findArtwork(raster);
  assert.equal(art.marginless, false);
  near(art.left, cm(0.64), 6, "sanat sol");
  near(art.right, cm(31.19), 6, "sanat sağ");
  const plan = planCrops({ art, dpi: DPI });
  assert.equal(plan.ok, true);
  assert.equal(plan.bookWidthCm, 13.5);
  near(plan.spineCm, 2.5, 0.1, "sırt");
  near(plan.front.width, cm(13.5), 6, "ön genişlik");
  near(plan.front.height, cm(19.5), 8, "yükseklik");
  near(plan.front.left + plan.front.width, cm(31.19 - 0.5), 8, "ön panel sağ kenarı kesim sınırında");
  near(plan.back.left, cm(0.64 + 0.5), 8, "arka panel sol kenarı kesim sınırında");
  assert.ok(plan.front.left > plan.back.left + plan.back.width, "paneller çakışmaz; arada sırt vardır");
});

test("kırpma işaretsiz (tam taşırmalı) sayfa: tüm sayfa sanat sayılır; açık renkli ön kapak yanlış kırpılmaz", () => {
  const raster = page(30.5, 22, [0, 0, 30.5, 22], { light: true });
  const art = findArtwork(raster);
  assert.equal(art.marginless, true);
  assert.deepEqual([art.left, art.top, art.right, art.bottom], [0, 0, raster.width, raster.height]);
  const plan = planCrops({ art, dpi: DPI });
  assert.equal(plan.ok, true);
  near(plan.front.left + plan.front.width, cm(30.5 - 0.5), 8, "ön panel sağ kesim sınırı");
  near(plan.bookHeightCm, 21, 0.05, "kitap yüksekliği");
});

test("büyük boy (16,5 cm) kitap sayfa genişliğinden tanınır", () => {
  const plan = planCrops({ art: { left: 0, top: 0, right: cm(37.7), bottom: cm(24.5) }, dpi: DPI });
  assert.equal(plan.ok, true);
  assert.equal(plan.bookWidthCm, 16.5);
  near(plan.spineCm, 3.7, 0.1, "sırt");
});

test("elle verilen kitap genişliği öncelikli; makul sırt çıkmayan sayfa ok=false döner ve nedenini söyler", () => {
  const art = { left: 0, top: 0, right: cm(29.5), bottom: cm(22) };
  assert.equal(planCrops({ art, dpi: DPI, bookWidthCm: 13.5 }).ok, true);
  const tooNarrow = planCrops({ art: { left: 0, top: 0, right: cm(20), bottom: cm(22) }, dpi: DPI });
  assert.equal(tooNarrow.ok, false);
  assert.equal(tooNarrow.front, null);
  assert.match(tooNarrow.warnings.join(" "), /otomatik bulunamadı/);
  const tooWide = planCrops({ art: { left: 0, top: 0, right: cm(45), bottom: cm(22) }, dpi: DPI });
  assert.equal(tooWide.ok, false);
});

test("bütünüyle beyaz sayfada çökmeden tüm sayfayı döndürür", () => {
  const blank = { data: new Uint8ClampedArray(200 * 100 * 4).fill(255), width: 200, height: 100 };
  const art = findArtwork(blank);
  assert.equal(art.marginless, true);
});
