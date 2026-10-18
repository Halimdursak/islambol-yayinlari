// Kitap kataloğu: data/catalog/books.json → doğrulanmış, zenginleştirilmiş dizi.
// Sahibi: Site Direktörü. Şema: data/catalog/books.schema.json. Önizleme birleştirme: data/catalog/onsoz/*.json
import Ajv from "ajv";
import { jsonOku, jsonOkuVeyaBos, publicUrl, slugla } from "./_oku.js";
import { publishedBooks } from "../../scripts/cms/resolvers.mjs";

function kitapyurduSlug(url) {
  const m = String(url ?? "").match(/\/kitap\/([^/]+)\/\d+\.html/);
  return m ? m[1] : null;
}

/**
 * Kitapçı sitelerinden gelen tanıtım metinlerinde kampanya satırları olabilir ("2000 TL", "Kargo ücretsiz", "sipariş hattı").
 * ADR-001: site fiyat/kampanya göstermez. Bu satırlar ve yalnızca bunlardan oluşan paragraflar ayıklanır; ham metin description_ham'da kalır.
 */
const KAMPANYA = /(\b\d[\d.,]*\s*(tl|₺)\b|\bkargo\b|\d+\s*(kitap|adet)\s*hediye|sürpriz kitap|sipariş hattı|whatsap|kampanya|indirim|ön sipariş)/i;
function aciklamaTemizle(metin) {
  if (!metin) return metin;
  const paragraflar = String(metin).split(/\n{2,}/).map((p) =>
    p.split(/\n/).filter((satir) => !KAMPANYA.test(satir)).join("\n").trim()
  ).filter(Boolean);
  return paragraflar.join("\n\n");
}

/** Kitapçı kategori adlarını site kategorilerine (data/site/sozluk.json) eşler: tam ad, sonra üst yol ("Siyaset > Diğer" → "Siyaset"). */
function kategoriEsleyici() {
  const sozluk = jsonOkuVeyaBos("data/site/sozluk.json", { kategoriler: [] });
  const harita = new Map();
  for (const k of sozluk.kategoriler ?? []) {
    for (const ad of [k.ad, ...(k.kaynak_adlari ?? [])]) harita.set(String(ad).trim().toLowerCase(), { ad: k.ad, slug: k.slug });
  }
  return (hamKategoriler) => {
    const sonuc = [];
    for (const ham of hamKategoriler ?? []) {
      const parcalar = String(ham).split(">").map((x) => x.trim()).filter((x) => x && x.toLowerCase() !== "kitap");
      let bulunan = null;
      for (let i = parcalar.length; i > 0 && !bulunan; i--) bulunan = harita.get(parcalar.slice(0, i).join(" > ").toLowerCase()) ?? null;
      if (!bulunan) for (let i = parcalar.length - 1; i >= 0 && !bulunan; i--) bulunan = harita.get(parcalar[i].toLowerCase()) ?? null;
      if (bulunan && !sonuc.some((x) => x.slug === bulunan.slug)) sonuc.push(bulunan);
    }
    return sonuc;
  };
}

/** contributors alanı kaynağa göre dizi, nesne ya da metin olabilir; hepsini "Rol: Ad" listesine çevirir. */
function katkidaBulunanlar(c) {
  if (!c) return [];
  if (typeof c === "string") return [c];
  if (Array.isArray(c)) return c.map((x) => (typeof x === "string" ? x : [x.role ?? x.rol, x.name ?? x.ad].filter(Boolean).join(": "))).filter(Boolean);
  if (typeof c === "object") return Object.entries(c).map(([rol, ad]) => (Array.isArray(ad) ? `${rol}: ${ad.join(", ")}` : `${rol}: ${ad}`));
  return [];
}

// WhatsApp tabanı tek kaynaktan (data/site/site.json); şablonlar kitap.whatsapp_url kullanır (Q3 M)
const WHATSAPP = String(jsonOku("data/site/site.json").whatsapp_url).replace(/\?.*$/, "");

/** Yönetim panelinden yüklenen önizleme sayfaları (kitap.preview_pages); yayınevi önizlemesinin yerine geçer. */
function yuklenenOnizleme(kitap) {
  const sayfalar = (kitap.preview_pages ?? []).map((sayfa, sira) => ({
    sira: sira + 1,
    url: publicUrl(sayfa.local_path),
    tur: null,
    genislik: sayfa.width ?? null,
    yukseklik: sayfa.height ?? null,
    kaynaklar: null,
  }));
  return sayfalar.length
    ? { kaynak: "yayinevi-yukleme", kaynak_url: null, sayfa_sayisi: sayfalar.length, has_onsoz: false, sayfalar }
    : null;
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
  const kategoriEsle = kategoriEsleyici();
  const yazarKimlikleri = new Map(jsonOku("data/catalog/authors.json")
    .filter((y) => y.status !== "draft")
    .flatMap((y) => [y.name, y.display].filter(Boolean).map((name) => [slugla(name), y.slug ?? slugla(y.name)])));
  const gorulen = new Set();
  for (const k of ham) {
    if (gorulen.has(k.id)) throw new Error(`Tekrarlanan kitap id: ${k.id}`);
    gorulen.add(k.id);
  }
  const kitaplar = publishedBooks(ham).map((k) => {
    const kySlug = kitapyurduSlug(k.sources?.kitapyurdu);
    const onizleme = yuklenenOnizleme(k) ?? (kySlug ? onsoz.get(kySlug) ?? null : null);
    const yil = k.publish_date ? Number(String(k.publish_date).slice(0, 4)) : null;
    const katkida = katkidaBulunanlar(k.contributors);
    const siteKategorileri = kategoriEsle(k.categories);
    return {
      ...k,
      description_ham: k.description ?? null,
      description: aciklamaTemizle(k.description),
      site_kategorileri: siteKategorileri,                 // [{ad, slug}] — sözlükle eşlenmiş site kategorileri
      site_kategori_sluglari: siteKategorileri.map((x) => x.slug),
      url: `/kitap/${k.id}/`,
      // Liste fiyatı (ADR-018): yalnız kayıtta varsa; "1.200 ₺" biçimi. JSON-LD'ye offers EKLENMEZ.
      fiyat: k.price_list_try ?? null,
      fiyat_gosterim: k.price_list_try ? `${Number(k.price_list_try).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺` : null,
      // Yazarsız kayıtlarda (derleme, set ilanı) gösterim: katkıda bulunan ya da null → şablon "Yazar belirtilmemiş" basar
      yazar_gosterim: k.author_display ?? (katkida.length ? katkida.join(", ") : null),
      kapak_url: publicUrl(k.cover?.local_path),
      // Null keeps name indices intact while preventing links to withdrawn or absent authors.
      yazar_sluglari: (k.authors ?? []).map((name) => yazarKimlikleri.get(slugla(name)) ?? null),
      kategori_sluglari: (k.categories ?? []).map(slugla),
      yil,
      onizleme,
      whatsapp_url: `${WHATSAPP}?text=${encodeURIComponent(`Merhaba, "${k.title}" kitabını sipariş etmek istiyorum.`)}`,
    };
  });
  // En yeniden eskiye; tarihi olmayanlar sona
  kitaplar.sort((a, b) => String(b.publish_date ?? "").localeCompare(String(a.publish_date ?? "")));
  return kitaplar;
}
