export class CmsError extends Error {
  constructor(status, message) { super(message); this.name = "CmsError"; this.status = status; }
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BOOK_FIELDS = ["id", "title", "subtitle", "authors", "author_display", "isbn", "pages", "publish_date", "categories", "description", "status", "is_set", "series", "dimensions", "binding", "paper", "language", "edition", "contributors", "preview_pages", "price_list_try", "back_cover"];
const MAX_PREVIEW_PAGES = 30;
const MAX_IMAGE_SIDE = 20000;
const AUTHOR_FIELDS = ["name", "slug", "display", "bio", "bio_source", "photo_url", "book_ids", "status", "kitapyurdu_author_url"];
const CAMPAIGN_FIELDS = ["id", "title", "eyebrow", "description", "image_url", "book_id", "link_url", "button_label", "theme", "active", "order"];

export function slugify(value) {
  return String(value ?? "").replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
    .replace(/['’]/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function text(value, name, required = false, maximum = 20000) {
  if (value === null || value === undefined) {
    if (required) throw new CmsError(422, `${name} zorunludur.`);
    return null;
  }
  if (typeof value !== "string" || value.length > maximum) throw new CmsError(422, `${name} geçerli bir metin olmalıdır.`);
  const clean = value.trim();
  if (required && !clean) throw new CmsError(422, `${name} zorunludur.`);
  return clean || null;
}

function texts(value, name) {
  if (!Array.isArray(value) || value.length > 100) throw new CmsError(422, `${name} bir liste olmalıdır.`);
  return [...new Set(value.map((v) => text(v, name, true, 300)))];
}

export function identity(value, name) {
  if (typeof value !== "string" || value.length > 180 || !ID.test(value)) throw new CmsError(422, `${name} yalnızca küçük harf, rakam ve tire içermelidir.`);
  return value;
}

/** Only HTTP(S) assets and root-relative paths can reach rendered href/src attributes. */
export function safeUrl(value, name = "Bağlantı", { externalOnly = false } = {}) {
  const clean = text(value, name, false, 2048);
  if (!clean) return null;
  if (/[\u0000-\u0020\\]/.test(clean)) throw new CmsError(422, `${name} geçerli bir adres olmalıdır.`);
  if (!externalOnly && clean.startsWith("/") && !clean.startsWith("//")) {
    let decoded;
    try { decoded = decodeURIComponent(clean); } catch { throw new CmsError(422, `${name} geçerli bir adres olmalıdır.`); }
    if (decoded.startsWith("//") || /[\\\u0000-\u0020]/.test(decoded) || decoded.split(/[/?#]/).some((p) => p === "." || p === "..")) throw new CmsError(422, `${name} güvenli bir yerel yol olmalıdır.`);
    return clean;
  }
  let url;
  try { url = new URL(clean); } catch { throw new CmsError(422, `${name} geçerli bir adres olmalıdır.`); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new CmsError(422, `${name} https ile başlamalıdır.`);
  return url.href;
}

function imageSide(value, name) {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > MAX_IMAGE_SIDE) throw new CmsError(422, `${name} geçerli bir tam sayı olmalıdır.`);
  return value;
}

/** Liste fiyatı (₺): boş = sitede fiyat gösterilmez; en çok iki ondalık, 0 < fiyat ≤ 100000. */
function listPrice(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100000 || Math.round(value * 100) !== value * 100) throw new CmsError(422, "Liste fiyatı 0'dan büyük, en çok iki ondalıklı bir sayı olmalıdır.");
  return value;
}

/** Arka kapak: { local_path, webp_path?, width, height } ya da null (kaldırır). Yollar yalnız public/ altında. */
function backCover(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value) || typeof value.local_path !== "string" || !value.local_path.startsWith("public/")) throw new CmsError(422, "Arka kapak yolu public/ klasöründe olmalıdır.");
  safeUrl("/" + value.local_path.slice(7), "Arka kapak yolu");
  let webp = null;
  if (value.webp_path !== null && value.webp_path !== undefined) {
    if (typeof value.webp_path !== "string" || !value.webp_path.startsWith("public/")) throw new CmsError(422, "Arka kapak WebP yolu public/ klasöründe olmalıdır.");
    safeUrl("/" + value.webp_path.slice(7), "Arka kapak WebP yolu");
    webp = value.webp_path;
  }
  return { local_path: value.local_path, webp_path: webp, width: imageSide(value.width ?? null, "Arka kapak genişliği"), height: imageSide(value.height ?? null, "Arka kapak yüksekliği") };
}

/** Yüklenen önizleme sayfaları: sıra = gösterim sırası; yalnızca public/ altındaki yerel dosyalar. */
function previewPages(value) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PREVIEW_PAGES) throw new CmsError(422, `Önizleme sayfaları en fazla ${MAX_PREVIEW_PAGES} sayfalık bir liste olmalıdır.`);
  return value.map((page) => {
    if (!page || typeof page !== "object" || Array.isArray(page) || typeof page.local_path !== "string" || !page.local_path.startsWith("public/")) throw new CmsError(422, "Önizleme sayfası yolu public/ klasöründe olmalıdır.");
    safeUrl("/" + page.local_path.slice(7), "Önizleme sayfası yolu");
    return { local_path: page.local_path, width: imageSide(page.width ?? null, "Sayfa genişliği"), height: imageSide(page.height ?? null, "Sayfa yüksekliği") };
  });
}

function mergeFields(original, input, fields) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CmsError(422, "Kayıt bir JSON nesnesi olmalıdır.");
  const result = { ...original };
  for (const field of fields) if (Object.hasOwn(input, field)) result[field] = input[field];
  return result;
}

function publicationStatus(value) {
  if (!new Set(["published", "draft"]).has(value)) throw new CmsError(422, "Yayın durumu yayınlanmış veya taslak olmalıdır.");
  return value;
}

/** `validateBook`: derlenmiş kitap doğrulayıcısı (Node: book-validator.mjs, Worker: derleme zamanında üretilmiş). */
export function createValidators(validateBook) {
  return {
    books(input, original = {}) {
      const record = mergeFields({ subtitle: null, authors: [], author_display: null, isbn: null, pages: null, publish_date: null, categories: [], description: null, cover: { local_path: null, source_url: null, width: null, height: null }, sources: { kitapyurdu: null, nobelkitap: null, kureselkitap: null, other: [] }, is_set: false, series: null, status: "published", ...original }, input, BOOK_FIELDS);
      record.id = identity(record.id || slugify(record.title), "Kitap kimliği");
      record.title = text(record.title, "Kitap adı", true, 500);
      record.authors = texts(record.authors, "Yazarlar");
      record.categories = texts(record.categories, "Kategoriler");
      record.status = publicationStatus(record.status);
      for (const field of ["subtitle", "author_display", "isbn", "publish_date", "description", "series", "dimensions", "binding", "paper", "language", "edition", "contributors"]) if (Object.hasOwn(record, field)) record[field] = text(record[field], field);
      if (typeof record.is_set !== "boolean") throw new CmsError(422, "Set bilgisi doğru veya yanlış olmalıdır.");
      if (input.cover !== undefined) {
        if (!input.cover || typeof input.cover !== "object" || Array.isArray(input.cover)) throw new CmsError(422, "Kapak bilgisi geçersiz.");
        record.cover = { ...record.cover };
        if (Object.hasOwn(input.cover, "local_path")) {
          // A replaced cover must not keep the previous image's dimensions.
          if (input.cover.local_path !== record.cover.local_path) record.cover.width = record.cover.height = null;
          record.cover.local_path = input.cover.local_path;
        }
        for (const side of ["width", "height"]) if (Object.hasOwn(input.cover, side)) record.cover[side] = imageSide(input.cover[side], `Kapak ${side === "width" ? "genişliği" : "yüksekliği"}`);
      }
      if (Object.hasOwn(record, "preview_pages")) record.preview_pages = previewPages(record.preview_pages);
      if (Object.hasOwn(record, "price_list_try")) record.price_list_try = listPrice(record.price_list_try);
      if (Object.hasOwn(record, "back_cover")) record.back_cover = backCover(record.back_cover);
      if (record.cover.local_path) {
        const path = record.cover.local_path;
        if (typeof path !== "string" || !path.startsWith("public/")) throw new CmsError(422, "Kapak yolu public/ klasöründe olmalıdır.");
        safeUrl("/" + path.slice(7), "Kapak yolu");
      }
      if (input.sources !== undefined) {
        if (!input.sources || typeof input.sources !== "object" || Array.isArray(input.sources)) throw new CmsError(422, "Satış bağlantıları geçersiz.");
        record.sources = { ...record.sources };
        for (const source of ["kitapyurdu", "nobelkitap", "kureselkitap"]) if (Object.hasOwn(input.sources, source)) record.sources[source] = safeUrl(input.sources[source], "Satış bağlantısı", { externalOnly: true });
        if (Object.hasOwn(input.sources, "other")) {
          if (!Array.isArray(input.sources.other) || input.sources.other.length > 20) throw new CmsError(422, "Diğer satış bağlantıları bir liste olmalıdır.");
          record.sources.other = input.sources.other.map((item) => ({ name: text(item.name, "Satış noktası", false, 200), url: safeUrl(item.url, "Satış bağlantısı", { externalOnly: true }) }));
        }
      }
      if (!validateBook(record)) throw new CmsError(422, "Kitap bilgileri geçersiz: " + validateBook.errors.slice(0, 3).map((e) => `${e.instancePath} ${e.message}`).join("; "));
      return record;
    },
    authors(input, original = {}) {
      const record = mergeFields({ bio: null, photo_url: null, book_ids: [], status: "published", ...original }, input, AUTHOR_FIELDS);
      record.name = text(record.name, "Yazar adı", true, 300);
      record.slug = identity(record.slug || slugify(record.name), "Yazar kimliği");
      record.display = text(record.display || record.name, "Görünen yazar adı", true, 300);
      record.bio = text(record.bio, "Biyografi");
      record.photo_url = safeUrl(String(record.photo_url ?? "").replace(/^public\//, "/"), "Yazar fotoğrafı");
      record.book_ids = texts(record.book_ids, "Yazarın kitapları").map((id) => identity(id, "Kitap kimliği"));
      record.status = publicationStatus(record.status);
      for (const field of ["bio_source", "kitapyurdu_author_url"]) if (record[field]) record[field] = safeUrl(record[field], "Yazar bağlantısı", { externalOnly: true });
      return record;
    },
    campaigns(input, original = {}) {
      const record = mergeFields({ eyebrow: "İslambol Yayınları", description: null, image_url: null, book_id: null, link_url: null, button_label: "Kitabı keşfet", theme: "cream", active: true, order: 0, ...original }, input, CAMPAIGN_FIELDS);
      record.title = text(record.title, "Duyuru başlığı", true, 500);
      record.id = identity(record.id || slugify(record.title), "Duyuru kimliği");
      for (const field of ["eyebrow", "description", "button_label"]) record[field] = text(record[field], field);
      record.image_url = safeUrl(String(record.image_url ?? "").replace(/^public\//, "/"), "Duyuru görseli");
      record.link_url = safeUrl(record.link_url, "Duyuru bağlantısı");
      record.book_id = record.book_id ? identity(record.book_id, "Duyuru kitabı") : null;
      if (!new Set(["peach", "sage", "cream"]).has(record.theme)) throw new CmsError(422, "Duyuru teması peach, sage veya cream olmalıdır.");
      if (typeof record.active !== "boolean") throw new CmsError(422, "Duyuru görünürlüğü doğru veya yanlış olmalıdır.");
      if (!Number.isInteger(record.order) || Math.abs(record.order) > 10000) throw new CmsError(422, "Duyuru sırası geçerli bir tam sayı olmalıdır.");
      return record;
    },
  };
}

export function maintainRelations(content, resource, previous, item, deleted) {
  if (resource === "books") {
    if (deleted) {
      for (const author of content.authors) author.book_ids = (author.book_ids ?? []).filter((id) => id !== previous.id);
      for (const campaign of content.campaigns) if (campaign.book_id === previous.id) { campaign.book_id = null; campaign.active = false; campaign.link_url = null; }
      if (content.vitrin.one_cikan === previous.id) content.vitrin.one_cikan = null;
      for (const key of ["onizleme_vitrini", "vitrin_haric"]) content.vitrin[key] = (content.vitrin[key] ?? []).filter((id) => id !== previous.id);
    } else {
      for (const name of item.authors) {
        const slug = slugify(name);
        if (!slug) throw new CmsError(422, "Yazar adı geçerli bir kimlik oluşturmalıdır.");
        let author = content.authors.find((a) => a.slug === slug || slugify(a.name) === slug);
        // Editing an unchanged credit must not silently restore a deliberately removed author profile.
        if (!author && !(previous?.authors ?? []).some((oldName) => slugify(oldName) === slug)) { author = { name, slug, display: name, bio: null, photo_url: null, book_ids: [], status: "published" }; content.authors.push(author); }
        if (!author) continue;
        author.book_ids = [...new Set([...(author.book_ids ?? []), item.id])];
      }
      for (const author of content.authors) {
        if ((previous?.authors ?? []).some((name) => slugify(name) === slugify(author.name)) && !item.authors.some((name) => slugify(name) === slugify(author.name))) author.book_ids = (author.book_ids ?? []).filter((id) => id !== item.id);
      }
    }
    if (deleted || (previous && previous.cover?.local_path !== item.cover?.local_path)) {
      delete content.covers[previous.id];
      delete content.og[previous.id];
    }
  }
  // Author profiles can be removed while the book's original bibliographic attribution remains intact.
  if (resource === "authors" && previous && !deleted && (previous.name !== item.name || previous.display !== item.display)) {
    for (const book of content.books) {
      const oldNames = book.authors ?? [];
      const affected = oldNames.some((name) => slugify(name) === slugify(previous.name));
      if (!affected) continue;
      book.authors = oldNames.map((name) => slugify(name) === slugify(previous.name) ? item.name : name);
      if (book.author_display === previous.name || book.author_display === previous.display) book.author_display = book.authors.length === 1 ? item.display : book.authors.join(", ");
    }
  }
  const ids = new Set(content.books.map((book) => book.id));
  for (const author of content.authors) if ((author.book_ids ?? []).some((id) => !ids.has(id))) throw new CmsError(422, "Yazarın kitap listesinde katalogda bulunmayan bir kitap var.");
  for (const campaign of content.campaigns) if (campaign.book_id && !ids.has(campaign.book_id)) throw new CmsError(422, "Duyuru kitabı katalogda bulunamadı.");
}
