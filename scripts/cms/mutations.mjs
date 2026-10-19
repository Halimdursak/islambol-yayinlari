// CMS değişikliklerinin saf (dosya sistemi bilmeyen) çekirdeği: yerel sunucu (store.mjs) ve Cloudflare Worker (GitHub üzerinde) aynısını kullanır.
// Girdi: o anki içerik (decode edilmiş) + ham dosya metinleri (saved). Çıktı: yazılacak dosyalar ({ anahtar: metin }) ve ürün kaydı.
import { CmsError, maintainRelations } from "./content.mjs";
import { pageFile, validatePage, validateSite, validateVitrin } from "./site-content.mjs";

// Koleksiyon dosyaları her kitap/yazar/duyuru kaydında birlikte yazılır; site ve sayfa dosyaları yalnız kendi işleminde.
export const FILES = {
  books: "data/catalog/books.json", authors: "data/catalog/authors.json", campaigns: "data/site/campaigns.json",
  vitrin: "data/site/vitrin.json", covers: "data/catalog/kapaklar-opt.json", og: "data/catalog/og.json",
};
export const SITE_FILE = "data/site/site.json";
export const COLLECTION_KEYS = ["books", "authors", "campaigns"];

export const json = (value) => JSON.stringify(value, null, 2) + "\n";

/** Kurtarma kaydındaki anahtar → proje içi dosya yolu. Bilinmeyen anahtar reddedilir. */
export function fileFor(key) {
  if (Object.hasOwn(FILES, key)) return FILES[key];
  if (key === "site") return SITE_FILE;
  const page = key.match(/^page:([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (page) return pageFile(page[1]);
  throw new Error("Geçersiz CMS kurtarma kaydı.");
}

/** Ham dosya metinlerinden ({ anahtar: metin|null }) çalışma içeriğini kurar. */
export function decode(saved) {
  return Object.fromEntries(Object.entries(saved)
    .filter(([key]) => Object.hasOwn(FILES, key) || key === "site")
    .map(([key, value]) => [key, value ? JSON.parse(value) : (COLLECTION_KEYS.includes(key) ? [] : {})]));
}

/** Kitap / yazar / duyuru kaydı ekler, günceller ya da siler. */
export function mutateRecord({ content, saved, validators, resource, method, id, input }) {
  const key = resource === "authors" ? "slug" : "id";
  const index = content[resource].findIndex((entry) => entry[key] === id);
  const previous = index >= 0 ? content[resource][index] : null;
  if (method !== "POST" && !previous) throw new CmsError(404, "Kayıt bulunamadı.");
  const item = method === "DELETE" ? null : validators[resource](input, previous ?? {});
  if (method !== "POST" && item && item[key] !== id) throw new CmsError(409, "Kayıt kimliği düzenlenemez; yeni kayıt oluşturun.");
  if (method === "POST" && content[resource].some((entry) => entry[key] === item[key])) throw new CmsError(409, "Bu kimlikte bir kayıt zaten var.");
  if (method === "POST") content[resource].push(item);
  else if (method === "DELETE") content[resource].splice(index, 1);
  else content[resource][index] = item;
  maintainRelations(content, resource, previous, item, method === "DELETE");
  const files = {};
  for (const field of Object.keys(FILES)) if (saved[field] !== null || ["books", "authors", "campaigns", "vitrin"].includes(field)) files[field] = json(content[field]);
  return { files, item };
}

export function applySite({ content, input }) {
  content.site = validateSite(input, content.site);
  return { files: { site: json(content.site) } };
}

export function applyVitrin({ content, input }) {
  content.vitrin = validateVitrin(input, content.vitrin, content.books);
  return { files: { vitrin: json(content.vitrin) } };
}

export function applyPage({ saved, slug, input, today }) {
  const key = `page:${slug}`;
  if (saved[key] === null || saved[key] === undefined) throw new CmsError(404, "Sayfa bulunamadı.");
  const { file, page } = validatePage(input, saved[key], today);
  return { files: { [key]: file }, extra: { page: { ...page, slug } } };
}
