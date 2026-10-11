// /kitap/<id>/ için hesaplanan veri (alias: kitap).
import { aciklamaParagraflari, kategoriEsle, kategoriIndeksi, kitapMeta } from "./_includes/components/kitap/yardimci.mjs";

const AYNI_YAZARDAN_ADET = 4;

export default {
  eleventyComputed: {
    title: (d) => kitapMeta(d.kitap, d.site.meta.sablonlar).title,
    description: (d) => kitapMeta(d.kitap, d.site.meta.sablonlar).description,
    onizleme_kitaplar: (d) => [d.kitap],
    kitap_paragraflar: (d) => aciklamaParagraflari(d.kitap.description),
    kitap_kategorileri: (d) => kategoriEsle(d.kitap, kategoriIndeksi(d.site.sozluk.kategoriler)),
    ayni_yazardan: (d) => {
      const gorulen = new Set([d.kitap.id]);
      const sonuc = [];
      for (const slug of d.kitap.yazar_sluglari) {
        const yazar = d.authors.find((y) => y.slug === slug);
        for (const k of yazar?.kitaplar ?? []) {
          if (gorulen.has(k.id)) continue;
          gorulen.add(k.id);
          sonuc.push(k);
        }
      }
      return sonuc.slice(0, AYNI_YAZARDAN_ADET);
    },
    kitap_dizileri: (d) => d.diziler.filter((z) => z.kitaplar.some((k) => k.id === d.kitap.id)),
  },
};
