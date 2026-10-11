// Set ve seriler: katalogdaki set kayıtları (is_set) esas; data/site/sozluk.json "diziler" ad/açıklama katmanı.
// Aynı set iki kaynakta farklı adla geçebilir; slug içerme ile birleştirilir. Kitapsız dizi sayfası üretilmez.
// Sahibi: Site Direktörü.
import { jsonOku, slugla } from "./_oku.js";
import books from "./books.js";

function kok(slug) {
  // "enver-ve-mustafa-kemalin-kitabi-1908-1938" ~ "enver-ve-mustafa-kemalin-kitabi-3-cilt" → ortak önek
  return slug.replace(/-\d+-(cilt|kitap)\b.*$/, "").replace(/-(serisi|seti|kitapligi|takim)$/, "").replace(/-\d{4}(-\d{4})?$/, "");
}

/** İki dizi slug'ı aynı seti mi anlatıyor? Kök eşitliği ya da birinin ötekinin öneki olması (en az 12 karakter). */
function ayniDizi(a, b) {
  const ka = kok(a), kb = kok(b);
  if (ka === kb) return true;
  const kisa = ka.length < kb.length ? ka : kb, uzun = ka.length < kb.length ? kb : ka;
  return kisa.length >= 12 && uzun.startsWith(kisa + "-");
}

export default function () {
  const sozluk = jsonOku("data/site/sozluk.json");
  const kitaplar = books();
  const diziler = [];

  // 1) Katalogdaki set/paket kayıtları ve series alanı
  for (const k of kitaplar) {
    const adlar = [];
    if (k.is_set) adlar.push({ ad: k.title, uyeler: [k], set_kaydi: k });
    if (k.series) adlar.push({ ad: k.series, uyeler: [k], set_kaydi: null });
    for (const a of adlar) {
      const slug = slugla(a.ad);
      let dizi = diziler.find((d) => d.slug === slug || ayniDizi(d.slug, slug));
      if (!dizi) {
        dizi = { ad: a.ad, slug, aciklama: null, url: `/dizi/${slug}/`, kitaplar: [], set_kaydi: a.set_kaydi, kaynak: "katalog" };
        diziler.push(dizi);
      }
      if (!dizi.set_kaydi && a.set_kaydi) dizi.set_kaydi = a.set_kaydi;
      for (const u of a.uyeler) if (!dizi.kitaplar.some((x) => x.id === u.id)) dizi.kitaplar.push(u);
    }
  }

  // 2) Sözlük: ad/açıklama katmanı + üye başlıklarıyla tekil kitapları bağla
  for (const d of sozluk.diziler ?? []) {
    const slug = d.slug ?? slugla(d.ad);
    let dizi = diziler.find((x) => x.slug === slug || ayniDizi(x.slug, slug));
    if (!dizi) {
      dizi = { ad: d.ad, slug, aciklama: d.aciklama ?? null, url: `/dizi/${slug}/`, kitaplar: [], set_kaydi: null, kaynak: "sozluk" };
      diziler.push(dizi);
    } else {
      dizi.ad = d.ad; // sözlükteki düzgün ad öncelikli; URL katalog slug'ında kalır (kararlılık)
      dizi.aciklama = d.aciklama ?? dizi.aciklama;
    }
    for (const baslik of d.uye_basliklari ?? []) {
      const b = slugla(baslik);
      for (const k of kitaplar) {
        const eslesti = slugla(k.title) === b || (k.alt_titles ?? []).some((t) => slugla(t) === b);
        if (eslesti && !dizi.kitaplar.some((x) => x.id === k.id)) dizi.kitaplar.push(k);
      }
    }
  }

  // Set kaydının kendisi "üye" olarak değil, dizinin kapağı/künyesi olarak kullanılır
  for (const d of diziler) {
    d.kapak_url = d.set_kaydi?.kapak_url ?? d.kitaplar[0]?.kapak_url ?? null;
    d.uyeler = d.kitaplar.filter((k) => !k.is_set);
    d.kitap_sayisi = d.uyeler.length || (d.set_kaydi ? 1 : 0);
  }
  return diziler.filter((d) => d.kitaplar.length > 0).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}
