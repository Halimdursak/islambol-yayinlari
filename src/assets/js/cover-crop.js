// Baskı kapağı (arka + sırt + ön yayılım) üzerinde ön ve arka kapak panellerini bulur. DOM yok: tarayıcıda ve Node testinde çalışır.
// Varsayımlar (yayınevinin 21 baskı dosyasında doğrulandı): her kenarda 0,5 cm taşma payı; kitap genişliği 13,5 cm (büyük boy 16,5 cm);
// kırpma işaretli dosyalarda çevresinde beyaz boşluk vardır, işaretsiz dosyalarda sanat sayfayı tamamen kaplar.

export const BLEED_CM = 0.5;
export const BOOK_WIDTHS_CM = [13.5, 16.5];
const SPINE_MIN_CM = 0.2;
const SPINE_MAX_CM = 6;
const INSET_CM = 0.02;      // kesim kenarında ince beyaz çizgi kalmasın

/**
 * Sanatın sınırlarını bulur: kenarlardaki "kâğıt beyazı" boşluğu (kırpma işareti ve renk çubukları dahil) dışarıda bırakır.
 * Kenar boşluğu yoksa (sol/üst/alt kenarda sanat başlıyorsa) tüm sayfa sanat sayılır; açık renkli ön kapak yanlış kırpılmasın.
 * rgba: { data: Uint8ClampedArray (RGBA), width, height }
 */
export function findArtwork({ data, width, height }, { stride = 4, paper = 248, coverage = 0.55 } = {}) {
  const cols = new Float64Array(width);
  const rows = new Float64Array(height);
  let sampledRows = 0;
  let sampledCols = 0;
  for (let y = 0; y < height; y += stride) {
    sampledRows += 1;
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      if (Math.min(data[i], data[i + 1], data[i + 2]) < paper) { cols[x] += 1; rows[y] += 1; }
    }
  }
  for (let x = 0; x < width; x += stride) sampledCols += 1;
  let left = 0;
  let right = width - 1;
  let top = 0;
  let bottom = height - 1;
  while (left < width && cols[left - (left % stride)] / sampledRows < coverage) left += 1;
  while (right > 0 && cols[right - (right % stride)] / sampledRows < coverage) right -= 1;
  while (top < height && rows[top - (top % stride)] / sampledCols < coverage) top += 1;
  while (bottom > 0 && rows[bottom - (bottom % stride)] / sampledCols < coverage) bottom -= 1;
  const marginless = left <= stride && top <= stride && bottom >= height - 1 - stride;
  if (marginless || right <= left || bottom <= top) return { left: 0, top: 0, right: width, bottom: height, marginless: true };
  return { left, top, right: right + 1, bottom: bottom + 1, marginless: false };
}

/**
 * Sanat kutusundan ön/arka panel kutularını (piksel) hesaplar.
 * Dönüş: { ok, bookWidthCm, spineCm, front, back, warnings } — front/back: { left, top, width, height }.
 * ok=false ise sırt kalınlığı makul çıkmadı: arayüz elle düzeltme ya da tek resim yükleme önerir.
 */
export function planCrops({ art, dpi, bleedCm = BLEED_CM, bookWidthCm } = {}) {
  const pxPerCm = dpi / 2.54;
  const cm = (v) => Math.round(v * pxPerCm);
  const trim = { left: art.left + cm(bleedCm), top: art.top + cm(bleedCm), width: art.right - art.left - cm(2 * bleedCm), height: art.bottom - art.top - cm(2 * bleedCm) };
  const trimWidthCm = trim.width / pxPerCm;
  const candidates = bookWidthCm ? [bookWidthCm] : (trimWidthCm > 33 ? [16.5, 13.5] : [13.5, 16.5]);
  const warnings = [];
  for (const widthCm of candidates) {
    const spineCm = trimWidthCm - 2 * widthCm;
    if (spineCm < SPINE_MIN_CM || spineCm > SPINE_MAX_CM) continue;
    const panelWidth = cm(widthCm - 2 * INSET_CM);
    const top = trim.top + cm(INSET_CM);
    const height = trim.height - cm(2 * INSET_CM);
    return {
      ok: true,
      bookWidthCm: widthCm,
      bookHeightCm: Number((trim.height / pxPerCm).toFixed(2)),
      spineCm: Number(spineCm.toFixed(2)),
      front: { left: trim.left + trim.width - cm(widthCm) + cm(INSET_CM), top, width: panelWidth, height },
      back: { left: trim.left + cm(INSET_CM), top, width: panelWidth, height },
      warnings,
    };
  }
  warnings.push(`Sayfa ${trimWidthCm.toFixed(1)} cm genişliğinde; ön ve arka kapak yerleri otomatik bulunamadı.`);
  return { ok: false, bookWidthCm: null, bookHeightCm: Number((trim.height / pxPerCm).toFixed(2)), spineCm: null, front: null, back: null, warnings };
}
