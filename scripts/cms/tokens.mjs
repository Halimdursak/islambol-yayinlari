// Sayfa metinlerinde ve meta açıklamalarında kullanılan yer tutucular (tek kaynak: data/site/site.json).
// Eleventy veri dosyaları (src/_data/sayfalar.js, site.js) ve CMS doğrulaması bunu paylaşır; bağımlılığı yoktur.

export const TOKEN_NAMES = ["telefon_gosterim", "telefon", "whatsapp_url", "eposta", "adres", "sosyal_liste"];
const PATTERN = new RegExp(`\\{(${TOKEN_NAMES.join("|")})\\}`, "g");

function handle(url) {
  try {
    const segment = new URL(url).pathname.split("/").filter(Boolean)[0];
    return segment && /^[A-Za-z0-9_.]+$/.test(segment) ? `@${segment}` : null;
  } catch { return null; }
}

/** Markdown bağlantısını bozmaması için adres içindeki parantezler kodlanır. */
const linkSafe = (url) => String(url).replace(/\(/g, "%28").replace(/\)/g, "%29");

export function socialList(site) {
  const social = site?.sosyal ?? {};
  const rows = [];
  if (social.x) rows.push(`- X: [${handle(social.x) ?? "X hesabı"}](${linkSafe(social.x)})`);
  if (social.instagram) rows.push(`- Instagram: [${handle(social.instagram) ?? "Instagram hesabı"}](${linkSafe(social.instagram)})`);
  if (social.facebook) rows.push(`- Facebook: [${site.ad ?? "Facebook"} sayfası](${linkSafe(social.facebook)})`);
  return rows.join("\n");
}

/** Bilinen yer tutucuları güncel site bilgisiyle değiştirir; bilinmeyen süslü parantezlere dokunmaz. */
export function fillTokens(value, site) {
  if (typeof value !== "string" || !value.includes("{")) return value;
  const values = {
    telefon_gosterim: site?.telefon_gosterim ?? "",
    telefon: site?.telefon ?? "",
    whatsapp_url: site?.whatsapp_url ?? "",
    eposta: site?.eposta ?? "",
    adres: site?.adres ?? "",
    sosyal_liste: socialList(site),
  };
  return value.replace(PATTERN, (_, name) => values[name]);
}

/** Nesne/dizi içindeki tüm metinlerde yer tutucuları doldurur (meta.json için). */
export function fillDeep(value, site) {
  if (typeof value === "string") return fillTokens(value, site);
  if (Array.isArray(value)) return value.map((item) => fillDeep(item, site));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillDeep(item, site)]));
  return value;
}
