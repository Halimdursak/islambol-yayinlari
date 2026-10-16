// Saf çözümleyiciler: Eleventy veri dosyaları (src/_data) ve CMS testleri paylaşır.
// Neden burada: Eleventy bir _data/*.js modülünde `default` dışında adlandırılmış export görürse
// veri olarak default'u değil modül nesnesini verir (node_modules/@11ty/eleventy/src/Util/Require.js).
// Bu yüzden veri dosyaları yalnızca `export default` taşır, yardımcılar buraya konur.
import { slugla } from "../../src/_data/_oku.js";
import { safeUrl } from "./content.mjs";

// Legacy records without status remain published; a draft never reaches pagination, search or sitemap.
export function publishedBooks(records) {
  return records.filter((record) => record.status !== "draft");
}

export function resolveAuthors(records, kitaplar) {
  const yazarlar = records.filter((y) => y.status !== "draft").map((y) => {
    const slug = y.slug ?? slugla(y.name);
    const kendiKitaplari = kitaplar.filter((k) => (Array.isArray(y.book_ids) && y.book_ids.includes(k.id)) || k.yazar_sluglari.includes(slug));
    return {
      ...y,
      slug,
      display: y.display || y.name,
      photo_url: safeUrl(String(y.photo_url ?? "").replace(/^public\//, "/"), "Yazar fotoğrafı"),
      url: `/yazar/${slug}/`,
      kitaplar: kendiKitaplari,
      kitap_sayisi: kendiKitaplari.length,
    };
  });
  yazarlar.sort((a, b) => b.kitap_sayisi - a.kitap_sayisi || a.name.localeCompare(b.name, "tr"));
  return yazarlar;
}

export function resolveVitrin(karar, kitaplar, tumYazarlar) {
  const byId = new Map(kitaplar.map((k) => [k.id, k]));
  const haric = new Set(karar.vitrin_haric ?? []);
  // Draft or removed selections are skipped so an editor can withdraw a featured book safely.
  const onizlemeli = (karar.onizleme_vitrini ?? []).map((id) => byId.get(id)).filter((k) => k && k.onizleme);
  const yeni = kitaplar
    .filter((k) => !haric.has(k.id) && !k.is_set && k.publish_date)
    .slice(0, karar.yeni_cikanlar_adet ?? 8);
  const yazarlar = tumYazarlar.filter((y) => y.kitap_sayisi > 0).slice(0, karar.yazar_seridi_adet ?? 8);

  return {
    one_cikan: byId.get(karar.one_cikan) ?? onizlemeli[0] ?? kitaplar[0] ?? null,
    onizlemeli,
    yeni_cikanlar: yeni,
    yazarlar,
    haric: [...haric],
  };
}

export function resolveCampaigns(records, kitaplar) {
  const byId = new Map(kitaplar.map((kitap) => [kitap.id, kitap]));
  return records.filter((campaign) => campaign.active !== false)
    .filter((campaign) => !campaign.book_id || byId.has(campaign.book_id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((campaign) => {
      const book = byId.get(campaign.book_id) ?? null;
      return {
        ...campaign,
        book,
        url: safeUrl(campaign.link_url, "Duyuru bağlantısı") || book?.url || "/kitaplar/",
        image_url: safeUrl(String(campaign.image_url ?? "").replace(/^public\//, "/"), "Duyuru görseli"),
        theme: ["peach", "sage", "cream"].includes(campaign.theme) ? campaign.theme : "cream",
      };
    });
}
