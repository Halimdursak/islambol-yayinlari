// /dizi/<slug>/ için hesaplanan veri (alias: dizi).
import { diziMeta, kategoriEsle, kategoriIndeksi, whatsappBaglantisi } from "./_includes/components/kitap/yardimci.mjs";

export default {
  eleventyComputed: {
    title: (d) => diziMeta(d.dizi, d.site.meta.sablonlar).title,
    description: (d) => diziMeta(d.dizi, d.site.meta.sablonlar).description,
    set_kategorileri: (d) => (d.dizi.set_kaydi ? kategoriEsle(d.dizi.set_kaydi, kategoriIndeksi(d.site.sozluk.kategoriler)) : []),
    dizi_whatsapp: (d) => d.dizi.set_kaydi?.whatsapp_url ?? whatsappBaglantisi(d.site, d.dizi.ad),
  },
};
