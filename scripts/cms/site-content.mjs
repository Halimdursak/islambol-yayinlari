// Site ayarları, ana sayfa vitrini ve sayfa metinleri: doğrulama ve dosya biçimi. Yalnız saf işlevler (Node ve Cloudflare Worker ortak kullanır);
// diskten okuyan yardımcılar site-fs.mjs'te.
import { CmsError, identity, safeUrl, text } from "./content.mjs";
import { TOKEN_NAMES } from "./tokens.mjs";

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
const MAX_PAGE_BODY = 60000;
const MAX_SHOWCASE = 24;
const MAX_CHANNELS = 20;
const PAGE_DIRECTORY = "data/site/sayfalar";

const groups = (digits) => `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;

/** Serbest yazılmış numarayı site biçimlerine çevirir: görünen, tel: ve WhatsApp bağlantısı. */
export function normalizePhone(value) {
  const raw = text(value, "Telefon numarası", true, 40);
  if (!/^[+\d\s().-]+$/.test(raw)) throw new CmsError(422, "Telefon numarası yalnızca rakam, boşluk, + ve tire içerebilir. Örnek: 0505 980 87 35");
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && !digits.startsWith("90")) {
    if (digits.length < 8 || digits.length > 15) throw new CmsError(422, "Telefon numarası geçerli uzunlukta değil.");
    return { telefon: `+${digits}`, telefon_gosterim: `+${digits}`, whatsapp_url: `https://wa.me/${digits}` };
  }
  if (digits.startsWith("00")) digits = digits.slice(2);
  let national;
  if (digits.startsWith("90") && digits.length === 12) national = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) national = digits.slice(1);
  else if (digits.length === 10) national = digits;
  if (!national || !/^[2-5]\d{9}$/.test(national)) throw new CmsError(422, "Telefon numarası 10 haneli olmalıdır. Örnek: 0505 980 87 35");
  return { telefon: `+90 ${groups(national)}`, telefon_gosterim: `0${groups(national)}`, whatsapp_url: `https://wa.me/90${national}` };
}

/** Kaydedilmiş site kaydından panelde gösterilen numara biçimi. */
export function publicSite(site) {
  if (!site || typeof site !== "object") return {};
  return { ad: site.ad ?? null, slogan: site.slogan ?? null, numara: site.telefon_gosterim ?? null, telefon_gosterim: site.telefon_gosterim ?? null, whatsapp_url: site.whatsapp_url ?? null, eposta: site.eposta ?? null, adres: site.adres ?? null, sosyal: { x: null, instagram: null, facebook: null, ...(site.sosyal ?? {}) }, satis_kanallari: site.satis_kanallari ?? [] };
}

export function validateSite(input, previous = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CmsError(422, "Site ayarları bir JSON nesnesi olmalıdır.");
  const phone = normalizePhone(input.numara ?? previous.telefon_gosterim);
  const email = text(input.eposta ?? previous.eposta, "E-posta", true, 254);
  if (!EMAIL.test(email)) throw new CmsError(422, "E-posta adresi geçerli değil.");
  if (input.sosyal !== undefined && (!input.sosyal || typeof input.sosyal !== "object" || Array.isArray(input.sosyal))) throw new CmsError(422, "Sosyal medya bağlantıları geçersiz.");
  const social = {};
  for (const name of ["x", "instagram", "facebook"]) social[name] = safeUrl(input.sosyal?.[name] ?? previous.sosyal?.[name] ?? null, `${name} bağlantısı`, { externalOnly: true });
  const channelsInput = input.satis_kanallari ?? previous.satis_kanallari ?? [];
  if (!Array.isArray(channelsInput) || channelsInput.length > MAX_CHANNELS) throw new CmsError(422, `Satış noktaları en fazla ${MAX_CHANNELS} kayıtlık bir liste olmalıdır.`);
  const channels = channelsInput.map((channel) => {
    if (!channel || typeof channel !== "object" || Array.isArray(channel)) throw new CmsError(422, "Satış noktası geçersiz.");
    return { ad: text(channel.ad, "Satış noktası adı", true, 100), url: safeUrl(channel.url, "Satış noktası adresi", { externalOnly: true }), not: text(channel.not, "Satış noktası notu", false, 300) };
  });
  const record = { ...previous, ...phone, eposta: email, adres: text(input.adres ?? previous.adres, "Adres", false, 300) ?? "", slogan: text(input.slogan ?? previous.slogan, "Slogan", true, 200), sosyal: social, satis_kanallari: channels };
  record.whatsapp_url_sablonu = `${phone.whatsapp_url}?text={kitap_adi}`;
  return record;
}

function idList(value, name, books, { published = false, maximum = MAX_SHOWCASE } = {}) {
  if (!Array.isArray(value) || value.length > maximum) throw new CmsError(422, `${name} en fazla ${maximum} kitaplık bir liste olmalıdır.`);
  const seen = new Set();
  for (const id of value) {
    identity(id, `${name} kitap kimliği`);
    const book = books.find((entry) => entry.id === id);
    if (!book) throw new CmsError(422, `${name} listesinde katalogda bulunmayan bir kitap var.`);
    if (published && book.status === "draft") throw new CmsError(422, `"${book.title}" taslak olduğu için vitrinde gösterilemez.`);
    if (seen.has(id)) throw new CmsError(422, `${name} listesinde aynı kitap birden fazla kez var.`);
    seen.add(id);
  }
  return value;
}

function count(value, name) {
  if (!Number.isInteger(value) || value < 1 || value > 12) throw new CmsError(422, `${name} 1 ile 12 arasında bir sayı olmalıdır.`);
  return value;
}

export function validateVitrin(input, previous = {}, books = []) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CmsError(422, "Vitrin bilgisi bir JSON nesnesi olmalıdır.");
  const featured = input.one_cikan === undefined ? previous.one_cikan ?? null : (input.one_cikan || null);
  if (featured !== null) idList([featured], "Öne çıkan kitap", books, { published: true });
  return {
    ...previous,
    one_cikan: featured,
    onizleme_vitrini: idList(input.onizleme_vitrini ?? previous.onizleme_vitrini ?? [], "Önizleme rafı", books, { published: true }),
    vitrin_haric: idList(input.vitrin_haric ?? previous.vitrin_haric ?? [], "Gösterilmeyecek kitaplar", books, { maximum: 500 }),
    yeni_cikanlar_adet: count(input.yeni_cikanlar_adet ?? previous.yeni_cikanlar_adet ?? 8, "Yeni çıkanlar sayısı"),
    yazar_seridi_adet: count(input.yazar_seridi_adet ?? previous.yazar_seridi_adet ?? 8, "Yazarlar sayısı"),
  };
}

// ---- Sayfa metinleri -------------------------------------------------------------------------------------------

/** `---` ön bilgisini sırayı ve bilinmeyen anahtarları koruyarak ayırır (src/_data/_oku.js ile aynı basit biçim). */
export function parsePage(source) {
  const match = String(source).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { entries: [], body: String(source) };
  const entries = [];
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_çğıöşüÇĞİÖŞÜ-]+):\s*(.*)$/);
    if (pair) entries.push([pair[1], pair[2].replace(/^["']|["']$/g, "")]);
  }
  return { entries, body: match[2] };
}

const oneLine = (value) => String(value).replace(/\s+/g, " ").trim();
// Ayrıştırıcı yalnızca baştaki/sondaki tırnağı soyar (kaçış çözmez): sayısal değerler ve tırnakla başlayıp biten metinler sarmalanır.
const frontValue = (value) => (/^\d+$/.test(value) || /^["']|["']$/.test(value) ? `"${value}"` : value);

export function readablePage(slug, source) {
  const { entries, body } = parsePage(source);
  const fields = Object.fromEntries(entries);
  return { slug, title: fields.title ?? slug, description: fields.description ?? "", body: body.replace(/^\s*#\s+.*\r?\n?/, "").trim() };
}

export function validatePage(input, source, today) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CmsError(422, "Sayfa bilgisi bir JSON nesnesi olmalıdır.");
  const { entries } = parsePage(source);
  const fields = new Map(entries);
  const title = oneLine(text(input.title, "Sayfa başlığı", true, 200));
  const description = oneLine(text(input.description ?? fields.get("description") ?? "", "Açıklama", false, 400) ?? "");
  const body = text(input.body, "Sayfa metni", true, MAX_PAGE_BODY);
  // Yazım hatalı yer tutucu ("{telefon_gosterimi}") sessizce yayına çıkmasın; yalnızca bilinen köklerle başlayanlar denetlenir.
  const misspelled = [...`${description}\n${body}`.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]).find((name) => /^(telefon|whatsapp|eposta|adres|sosyal)/.test(name) && !TOKEN_NAMES.includes(name));
  if (misspelled) throw new CmsError(422, `Bilinmeyen yer tutucu: {${misspelled}}. Kullanılabilenler: ${TOKEN_NAMES.map((name) => `{${name}}`).join(", ")}`);
  const next = new Map(entries);
  next.set("title", title);
  next.set("description", description);
  next.set("son_guncelleme", today);
  const lines = [...next].map(([key, value]) => `${key}: ${frontValue(String(value))}`);
  return { page: { slug: fields.get("slug") ?? null, title, description, body }, file: `---\n${lines.join("\n")}\n---\n\n# ${title}\n\n${body.replace(/\r\n/g, "\n")}\n` };
}

export const pageFile = (slug) => `${PAGE_DIRECTORY}/${identity(slug, "Sayfa kimliği")}.md`;

// ---- Katalog bilgisi ------------------------------------------------------------------------------------------

const kitapyurduSlug = (url) => String(url ?? "").match(/\/kitap\/([^/]+)\/\d+\.html/)?.[1] ?? null;

/** Önizleme sayfası olan kitapyurdu kısa adlarından, panelde "önizleme var" görünecek kitap kimliklerini çıkarır. */
export function previewIdsFrom(slugs, books) {
  const set = slugs instanceof Set ? slugs : new Set(slugs);
  return new Set(books.filter((book) => set.has(kitapyurduSlug(book.sources?.kitapyurdu))).map((book) => book.id));
}

/** Sözlük dosyasından kategori seçenekleri. */
export function categoriesFrom(dictionary) {
  return (dictionary?.kategoriler ?? []).map(({ ad, slug }) => ({ ad, slug }));
}
