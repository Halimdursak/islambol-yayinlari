// Ana sayfa vitrini: data/site/vitrin.json kararlarını kitap nesnelerine çevirir.
// Şablonlar: vitrin.one_cikan (kitap), vitrin.onizlemeli (kitap[]), vitrin.yeni_cikanlar (kitap[]), vitrin.yazarlar (yazar[])
// Sahibi: Site Direktörü.
import { jsonOku } from "./_oku.js";
import books from "./books.js";
import authors from "./authors.js";

export default function () {
  const karar = jsonOku("data/site/vitrin.json");
  const kitaplar = books();
  const byId = new Map(kitaplar.map((k) => [k.id, k]));
  const haric = new Set(karar.vitrin_haric ?? []);
  const eksik = [...(karar.onizleme_vitrini ?? []), karar.one_cikan].filter((id) => id && !byId.has(id));
  if (eksik.length) throw new Error(`vitrin.json: katalogda olmayan id'ler: ${eksik.join(", ")}`);

  const onizlemeli = (karar.onizleme_vitrini ?? []).map((id) => byId.get(id)).filter((k) => k && k.onizleme);
  const yeni = kitaplar
    .filter((k) => !haric.has(k.id) && !k.is_set && k.publish_date)
    .slice(0, karar.yeni_cikanlar_adet ?? 8);
  const yazarlar = authors().filter((y) => y.kitap_sayisi > 0).slice(0, karar.yazar_seridi_adet ?? 8);

  return {
    one_cikan: byId.get(karar.one_cikan) ?? onizlemeli[0] ?? kitaplar[0],
    onizlemeli,
    yeni_cikanlar: yeni,
    yazarlar,
    haric: [...haric],
  };
}
