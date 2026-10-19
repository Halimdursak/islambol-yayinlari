// Diskteki site/katalog dosyalarından panel verisini okuyan yardımcılar (yerel sunucu). Saf mantık site-content.mjs'te.
import { readFile, readdir } from "node:fs/promises";
import { containedPath } from "./paths.mjs";
import { categoriesFrom, previewIdsFrom, readablePage } from "./site-content.mjs";

const PAGE_DIRECTORY = "data/site/sayfalar";

async function optionalJson(root, file, fallback) {
  try { return JSON.parse(await readFile(containedPath(root, file), "utf8")); } catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}

export async function listPages(root) {
  const directory = containedPath(root, PAGE_DIRECTORY);
  let names;
  try { names = (await readdir(directory)).filter((name) => /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(name)).sort(); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  return Promise.all(names.map(async (name) => readablePage(name.slice(0, -3), await readFile(containedPath(directory, name), "utf8"))));
}

/** Önizleme sayfaları olan kitapyurdu kısa adları (data/catalog/onsoz). Worker'a derleme zamanında gömülür. */
export async function publisherPreviewSlugs(root) {
  const index = await optionalJson(root, "data/catalog/onsoz/INDEX.json", []);
  const list = Array.isArray(index) ? index : index.kitaplar ?? index.items ?? [];
  const slugs = new Set();
  for (const entry of list) {
    const slug = entry.slug ?? entry.kitapyurdu_slug;
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) continue;
    const detail = await optionalJson(root, `data/catalog/onsoz/${slug}.json`, null);
    if (detail && Array.isArray(detail.pages) && detail.pages.length) slugs.add(slug);
  }
  return slugs;
}

/** Yayınevinin (kitapyurdu kaynaklı) önizleme sayfası olan kitap kimlikleri. */
export async function publisherPreviewIds(root, books) {
  return previewIdsFrom(await publisherPreviewSlugs(root), books);
}

export async function listCategories(root) {
  return categoriesFrom(await optionalJson(root, "data/site/sozluk.json", { kategoriler: [] }));
}
