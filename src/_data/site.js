// Site kimliği: data/site/site.json (+ meta, sözlük, mikrometin) — Sahibi: Site Direktörü.
import { jsonOku } from "./_oku.js";
import { fillDeep } from "../../scripts/cms/tokens.mjs";

export default function () {
  const site = jsonOku("data/site/site.json");
  const meta = fillDeep(jsonOku("data/site/meta.json"), site);   // meta açıklamalarında da {telefon_gosterim} vb. kullanılabilir
  const sozluk = jsonOku("data/site/sozluk.json");
  const mikrometin = jsonOku("data/site/mikrometin.json");
  return {
    ...site,
    url: process.env.SITE_URL ?? "https://islambol.org",
    yil: new Date().getFullYear(),
    meta,
    sozluk,
    mikrometin,
  };
}
