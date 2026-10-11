// Yazarlar: data/catalog/authors.json + kitap eşlemesi.
// Sahibi: Site Direktörü.
import { jsonOku, slugla } from "./_oku.js";
import books from "./books.js";

export default function () {
  const ham = jsonOku("data/catalog/authors.json");
  const kitaplar = books();
  const yazarlar = ham.map((y) => {
    const slug = y.slug ?? slugla(y.name);
    const kendiKitaplari = kitaplar.filter((k) => (k.book_ids ?? y.book_ids ?? []).includes?.(k.id) || k.yazar_sluglari.includes(slug));
    return {
      ...y,
      slug,
      url: `/yazar/${slug}/`,
      kitaplar: kendiKitaplari,
      kitap_sayisi: kendiKitaplari.length,
    };
  });
  yazarlar.sort((a, b) => b.kitap_sayisi - a.kitap_sayisi || a.name.localeCompare(b.name, "tr"));
  return yazarlar;
}
