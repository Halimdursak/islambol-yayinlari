export default {
  eleventyComputed: {
    title: (d) => d.site.meta.sayfalar["/diziler/"].title,
    description: (d) => d.site.meta.sayfalar["/diziler/"].description,
  },
};
