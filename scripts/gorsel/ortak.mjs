// Görsel betiklerinin ortak yardımcıları (B4 Görsel & Performans).
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const yol = (...parcalar) => join(KOK, ...parcalar);

/** Çıktı var ve tüm kaynaklardan yeni mi? */
export function guncelMi(cikti, ...kaynaklar) {
  if (!existsSync(cikti)) return false;
  const t = statSync(cikti).mtimeMs;
  return kaynaklar.every((k) => statSync(k).mtimeMs <= t);
}

/**
 * Hedef boyutlardan, kaynağı büyütmeden uygun olanları seçer.
 * Kaynak en büyük hedeften küçükse ve son seçimden belirgin büyükse (>= 80 px)
 * kaynağın kendi boyutu "yerli" bir üst sürüm olarak eklenir (yerliEkle=true).
 */
export function boyutlariSec(kaynakBoyut, hedefler, yerliEkle = true) {
  const liste = hedefler.filter((t) => t <= kaynakBoyut);
  const son = liste.at(-1) ?? 0;
  const enBuyukHedef = Math.max(...hedefler);
  if (yerliEkle && kaynakBoyut < enBuyukHedef && (liste.length === 0 || kaynakBoyut - son >= 80)) {
    liste.push(kaynakBoyut);
  }
  return liste;
}

export function dizinDosyalari(dizin, filtre = () => true) {
  if (!existsSync(dizin)) return [];
  const sonuc = [];
  for (const ad of readdirSync(dizin, { withFileTypes: true })) {
    const tam = join(dizin, ad.name);
    if (ad.isDirectory()) sonuc.push(...dizinDosyalari(tam, filtre));
    else if (filtre(tam)) sonuc.push(tam);
  }
  return sonuc;
}

export const toplamBayt = (dosyalar) => dosyalar.reduce((t, d) => t + statSync(d).size, 0);
export const mb = (bayt) => (bayt / 1048576).toFixed(2);
