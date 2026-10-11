// Statik sayfa metinleri: data/site/sayfalar/*.md → { slug: { title, description, html, sorular } }
// [[SORU: ...]] işaretli cümleler yayına girmez; sorular ayrı listelenir (build sonunda konsola yazılır).
// Sahibi: Site Direktörü.
import MarkdownIt from "markdown-it";
import { mdDosyalari, onBilgiAyir, sorulariAyikla } from "./_oku.js";

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

export default function () {
  const sonuc = {};
  const tumSorular = [];
  for (const { ad, metin } of mdDosyalari("data/site/sayfalar")) {
    const { veri, govde } = onBilgiAyir(metin);
    const { metin: temiz, sorular } = sorulariAyikla(govde);
    // İlk H1'i şablon başlığı olarak kullanıyoruz; gövdeden çıkar.
    const govdeBasliksiz = temiz.replace(/^#\s+.*\r?\n?/, "");
    sonuc[veri.slug ?? ad] = {
      ...veri,
      slug: veri.slug ?? ad,
      html: md.render(govdeBasliksiz),
      sorular,
    };
    for (const s of sorular) tumSorular.push(`${ad}: ${s}`);
  }
  if (tumSorular.length && !process.env.SESSIZ) {
    console.log(`[sayfalar] ${tumSorular.length} [[SORU]] işareti yayından ayıklandı (yanıtlar için docs/SITE-HARITASI.md).`);
  }
  return sonuc;
}
