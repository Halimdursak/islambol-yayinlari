// /kitaplar/ için hesaplanan veri: kitaplara site kategorileri eklenir; filtre seçenekleri kurulur.
import { kategoriliKitaplar } from "./_includes/components/kitap/yardimci.mjs";

const EN_COK_YAZAR = 12;

export default {
  eleventyComputed: {
    title: (d) => d.site.meta.sayfalar["/kitaplar/"].title,
    description: (d) => d.site.meta.sayfalar["/kitaplar/"].description,
    katalog: (d) => kategoriliKitaplar(d.books, d.site.sozluk.kategoriler),
    filtreKategoriler: (d) => {
      const katalog = kategoriliKitaplar(d.books, d.site.sozluk.kategoriler);
      return d.site.sozluk.kategoriler
        .map((k) => ({ ad: k.ad, slug: k.slug, sayi: katalog.filter((b) => b.site_kategorileri.some((x) => x.slug === k.slug)).length }))
        .filter((k) => k.sayi > 0);
    },
    filtreYazarlar: (d) =>
      d.authors
        .filter((y) => y.kitap_sayisi >= 2)
        .slice(0, EN_COK_YAZAR)
        .map((y) => ({ ad: y.display, slug: y.slug, sayi: y.kitap_sayisi })),
    filtreYillar: (d) => {
      const sayac = new Map();
      for (const b of d.books) if (b.yil) sayac.set(b.yil, (sayac.get(b.yil) ?? 0) + 1);
      return [...sayac].sort((a, b) => b[0] - a[0]).map(([yil, sayi]) => ({ yil, sayi }));
    },
  },
};
