// Ortak yardımcılar: proje kökünden JSON ve markdown okuma.
// Sahibi: Site Direktörü (entegrasyon katmanı). B1–B5 bu dosyaları değiştirmez, öneri bildirir.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function kokYolu(...parcalar) {
  return join(KOK, ...parcalar);
}

export function jsonOku(goreliYol) {
  const yol = kokYolu(goreliYol);
  if (!existsSync(yol)) throw new Error(`Veri dosyası yok: ${goreliYol}`);
  return JSON.parse(readFileSync(yol, "utf8"));
}

export function jsonOkuVeyaBos(goreliYol, bos) {
  const yol = kokYolu(goreliYol);
  return existsSync(yol) ? JSON.parse(readFileSync(yol, "utf8")) : bos;
}

/** `---` ile ayrılmış basit YAML ön bilgisini (yalnızca `anahtar: değer`) ayrıştırır. */
export function onBilgiAyir(metin) {
  const m = metin.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { veri: {}, govde: metin };
  const veri = {};
  for (const satir of m[1].split(/\r?\n/)) {
    const k = satir.match(/^([A-Za-z0-9_çğıöşüÇĞİÖŞÜ-]+):\s*(.*)$/);
    if (k) veri[k[1]] = k[2].replace(/^["']|["']$/g, "");
  }
  return { veri, govde: m[2] };
}

/**
 * `[[SORU: ...]]` işaretli cümleleri metinden çıkarır; soruları ayrı döndürür.
 * D2 bilinmeyen olguları bu işaretle bıraktı; yayına girmemeli (EKIP.md ortak kural 1).
 */
export function sorulariAyikla(metin) {
  const sorular = [];
  const temiz = metin.replace(/[^.!?\n]*\[\[SORU:\s*([^\]]*)\]\][^.!?\n]*[.!?]?/g, (_, soru) => {
    sorular.push(soru.trim());
    return "";
  });
  return { metin: temiz.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), sorular };
}

export function mdDosyalari(goreliKlasor) {
  const klasor = kokYolu(goreliKlasor);
  if (!existsSync(klasor)) return [];
  return readdirSync(klasor)
    .filter((d) => d.endsWith(".md"))
    .map((d) => ({ ad: basename(d, ".md"), metin: readFileSync(join(klasor, d), "utf8") }));
}

/** `public/...` yerel yolunu site köküne göre URL'ye çevirir. */
export function publicUrl(yerelYol) {
  if (!yerelYol) return null;
  const p = String(yerelYol).replace(/\\/g, "/").replace(/^\.?\/?public\//, "/");
  return p.startsWith("/") ? p : `/${p}`;
}

export function slugla(metin) {
  const harita = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u", Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u", Â: "a", Î: "i", Û: "u" };
  return String(metin)
    .replace(/['’`´]/g, "") // kesme işareti ayraç değil: "Kemal'in" → "kemalin" (katalog id'leriyle uyum)
    .replace(/[çğıöşüâîûÇĞİIÖŞÜÂÎÛ]/g, (c) => harita[c] ?? c)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
