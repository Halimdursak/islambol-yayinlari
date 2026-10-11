export default {
  eleventyComputed: {
    title: (d) => d.site.meta.sayfalar["/yazarlar/"].title,
    description: (d) => d.site.meta.sayfalar["/yazarlar/"].description,
  },
};
