// /yazar/<slug>/ için hesaplanan veri (alias: yazar).
import { yazarMeta } from "./_includes/components/kitap/yardimci.mjs";

export default {
  eleventyComputed: {
    title: (d) => yazarMeta(d.yazar, d.site.meta.sablonlar).title,
    description: (d) => yazarMeta(d.yazar, d.site.meta.sablonlar).description,
    yazar_dizileri: (d) => d.diziler.filter((z) => z.kitaplar.some((k) => k.yazar_sluglari.includes(d.yazar.slug))),
  },
};
