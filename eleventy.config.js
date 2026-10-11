// Eleventy 3 yapılandırması — İslambol Yayınları
// Kaynak: src/  Çıktı: dist/  Statik dosyalar: public/ → dist/ (kök)
import { HtmlBasePlugin } from "@11ty/eleventy";

// Alt dizin barındırma (GitHub Pages: /islambol-yayinlari/): PATH_PREFIX ortam değişkeni; HtmlBasePlugin
// HTML çıktısındaki kök-göreli href/src/srcset yollarını öne ekler (ADR-006). Yerelde ve özel alan adında "/".
const PATH_PREFIX = process.env.PATH_PREFIX || "/";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy({ public: "/" });
  eleventyConfig.addPassthroughCopy({ "src/assets": "/assets" });
  eleventyConfig.addPassthroughCopy({
    "node_modules/page-flip/dist/js/page-flip.module.js": "/assets/vendor/page-flip.module.js",
  });
  // B1 filtreleri: tarih ("2026-08-31" -> "31 Ağustos 2026"; "2026-08" -> "Ağustos 2026"; "2026" -> "2026") ve kisalt(n)
  const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  eleventyConfig.addFilter("tarih", (deger) => {
    if (deger === null || deger === undefined || deger === "") return "";
    const m = String(deger).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!m) return String(deger);
    const [, yil, ay, gun] = m;
    const adi = ay ? AYLAR[Number(ay) - 1] : null;
    if (!adi) return yil;
    return gun ? `${Number(gun)} ${adi} ${yil}` : `${adi} ${yil}`;
  });
  eleventyConfig.addFilter("kisalt", (metin, n = 160) => {
    const duz = String(metin ?? "").replace(/\s+/g, " ").trim();
    if (duz.length <= n) return duz;
    const kesik = duz.slice(0, n - 1);
    const son = kesik.lastIndexOf(" ");
    return `${(son > n * 0.6 ? kesik.slice(0, son) : kesik).replace(/[\s,.;:!?-]+$/, "")}…`;
  });
  eleventyConfig.setServerOptions({ port: 8080, showAllHosts: false });
  return {
    dir: { input: "src", output: "dist", includes: "_includes", data: "_data" },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "md", "11ty.js"],
    pathPrefix: PATH_PREFIX,
  };
}
