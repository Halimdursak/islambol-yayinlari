// Eleventy 3 yapılandırması — İslambol Yayınları
// Kaynak: src/  Çıktı: dist/  Statik dosyalar: public/ → dist/ (kök)
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ public: "/" });
  eleventyConfig.addPassthroughCopy({ "src/assets": "/assets" });
  eleventyConfig.addPassthroughCopy({
    "node_modules/page-flip/dist/js/page-flip.module.js": "/assets/vendor/page-flip.module.js",
  });
  eleventyConfig.setServerOptions({ port: 8080, showAllHosts: false });
  return {
    dir: { input: "src", output: "dist", includes: "_includes", data: "_data" },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "md", "11ty.js"],
  };
}
