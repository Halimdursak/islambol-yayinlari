// Ana sayfa vitrini: data/site/vitrin.json kararlarını kitap nesnelerine çevirir.
// Şablonlar: vitrin.one_cikan (kitap), vitrin.onizlemeli (kitap[]), vitrin.yeni_cikanlar (kitap[]), vitrin.yazarlar (yazar[])
// Sahibi: Site Direktörü. Çözümleme mantığı scripts/cms/resolvers.mjs'te (veri dosyasında adlandırılmış export olmaz).
import { jsonOku } from "./_oku.js";
import { resolveVitrin } from "../../scripts/cms/resolvers.mjs";
import books from "./books.js";
import authors from "./authors.js";

export default function () {
  return resolveVitrin(jsonOku("data/site/vitrin.json"), books(), authors());
}
