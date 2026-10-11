// Site kimliği: data/site/site.json (+ meta, sözlük, mikrometin) — Sahibi: Site Direktörü.
import { jsonOku } from "./_oku.js";

export default function () {
  const site = jsonOku("data/site/site.json");
  const meta = jsonOku("data/site/meta.json");
  const sozluk = jsonOku("data/site/sozluk.json");
  const mikrometin = jsonOku("data/site/mikrometin.json");
  return {
    ...site,
    url: process.env.SITE_URL ?? "https://adursak63.github.io/islambol-yayinlari",
    yil: new Date().getFullYear(),
    meta,
    sozluk,
    mikrometin,
  };
}
