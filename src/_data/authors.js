// Yazarlar: data/catalog/authors.json + kitap eşlemesi.
// Sahibi: Site Direktörü. Çözümleme mantığı scripts/cms/resolvers.mjs'te (veri dosyasında adlandırılmış export olmaz).
import { jsonOku } from "./_oku.js";
import { resolveAuthors } from "../../scripts/cms/resolvers.mjs";
import books from "./books.js";

export default function () {
  return resolveAuthors(jsonOku("data/catalog/authors.json"), books());
}
