// Kitap kataloğu: data/catalog/books.json → doğrulanmış, zenginleştirilmiş dizi.
// Sahibi: Site Direktörü. Şema: data/catalog/books.schema.json. Önizleme birleştirme: data/catalog/onsoz/*.json
import Ajv from "ajv";
import { jsonOku, jsonOkuVeyaBos, publicUrl, slugla } from "./_oku.js";

function kitapyurduSlug(url) {
  const m = String(url ?? "").match(/\/kitap\/([^/]+)\/\d+\.html/);
  return m ? m[1] : null;
}

/** contributors alanı kaynağa göre dizi, nesne ya da metin olabilir; hepsini "Rol: Ad" listesine çevirir. */
function katkidaBulunanlar(c) {
  if (!c) return [];
  if (typeof c === "string") return [c];
  if (Array.isArray(c)) return c.map((x) => (typeof x === "string" ? x : [x.role ?? x.rol, x.name ?? x.ad].filter(Boolean).join(": "))).filter(Boolean);
  if (typeof c === "object") return Object.entries(c).map(([rol, ad]) => (Array.isArray(ad) ? `${rol}: ${ad.join(", ")}` : `${rol}: ${ad}`));
  return [];
}

function onsozHaritasi() {
  // B4 üretirse: data/catalog/onsoz-opt.json → { "<kitapyurdu_slug>": { "<index>": { "webp": [{w,url}], "jpg": [{w,url}] } } }
  const opt = jsonOkuVeyaBos("data/catalog/onsoz-opt.json", {});
  const indeks = jsonOkuVeyaBos("data/catalog/onsoz/INDEX.json", []);
  const liste = Array.isArray(indeks) ? indeks : indeks.kitaplar ?? indeks.items ?? [];
  const harita = new Map();
  for (const kayit of liste) {
    const slug = kayit.slug ?? kayit.kitapyurdu_slug;
    if (!slug) continue;
    const detay = jsonOkuVeyaBos(`data/catalog/onsoz/${slug}.json`, null);
    if (!detay || !Array.isArray(detay.pages) || detay.pages.length === 0) continue;
    harita.set(slug, {
      kaynak: detay.source_type ?? "kitapyurdu-preview",
      kaynak_url: detay.kitapyurdu_url ?? null,
      sayfa_sayisi: detay.pages.length,
      has_onsoz: Boolean(kayit.has_onsoz ?? detay.pages.some((p) => ["onsoz", "takdim", "giris"].includes(p.kind))),
      sayfalar: detay.pages.map((p) => ({
        sira: p.index,
        url: publicUrl(p.local_path),
        tur: p.kind ?? null,
        genislik: p.width ?? null,
        yukseklik: p.height ?? null,
        kaynaklar: opt?.[slug]?.[String(p.index)] ?? null,
      })),
    });
  }
  return harita;
}

export default function () {
  const ham = jsonOku("data/catalog/books.json");
  const sema = jsonOku("data/catalog/books.schema.json");
  const ajv = new Ajv({ allErrors: true, strict: false });
  const dogrula = ajv.compile(sema);
  if (!dogrula(ham)) {
    const ilk = dogrula.errors.slice(0, 10).map((e) => `${e.instancePath || "/"} ${e.message}`).join("\n  ");
    throw new Error(`books.json şemaya uymuyor (${dogrula.errors.length} hata):\n  ${ilk}`);
  }
  const onsoz = onsozHaritasi();
  const gorulen = new Set();
  const kitaplar = ham.map((k) => {
    if (gorulen.has(k.id)) throw new Error(`Tekrarlanan kitap id: ${k.id}`);
    gorulen.add(k.id);
    const kySlug = kitapyurduSlug(k.sources?.kitapyurdu);
    const onizleme = kySlug ? onsoz.get(kySlug) ?? null : null;
    const yil = k.publish_date ? Number(String(k.publish_date).slice(0, 4)) : null;
    const katkida = katkidaBulunanlar(k.contributors);
    return {
      ...k,
      url: `/kitap/${k.id}/`,
      // Yazarsız kayıtlarda (derleme, set ilanı) gösterim: katkıda bulunan ya da null → şablon "Yazar belirtilmemiş" basar
      yazar_gosterim: k.author_display ?? (katkida.length ? katkida.join(", ") : null),
      kapak_url: publicUrl(k.cover?.local_path),
      yazar_sluglari: (k.authors ?? []).map(slugla),
      kategori_sluglari: (k.categories ?? []).map(slugla),
      yil,
      onizleme,
      whatsapp_url: `https://wa.me/905059808735?text=${encodeURIComponent(`Merhaba, "${k.title}" kitabını sipariş etmek istiyorum.`)}`,
    };
  });
  // En yeniden eskiye; tarihi olmayanlar sona
  kitaplar.sort((a, b) => String(b.publish_date ?? "").localeCompare(String(a.publish_date ?? "")));
  return kitaplar;
}
