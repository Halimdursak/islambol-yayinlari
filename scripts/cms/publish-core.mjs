// Yayınlama mantığının saf bölümü: yerel git yayıncısı (publish.mjs) ve Cloudflare Worker ortak kullanır.

/** Panelin yazdığı sabit yollar. Kod, şablon ve test dosyaları (başkasının yarım işi) yayınlamaya hiç karışmaz. */
export const CONTENT_PATHS = ["data/catalog/books.json", "data/catalog/authors.json", "data/catalog/kapaklar-opt.json", "data/catalog/og.json", "data/site"];
/** Yüklemeler klasörü: yalnız içerik dosyalarında adı geçen dosyalar yayınlanır (terk edilmiş yüklemeler genel depoya gitmez). */
export const UPLOADS_DIR = "public/uploads";
// Yalnız bu sitenin yolları: "public/uploads/x.jpg" ya da "/uploads/x.jpg" (başka sitenin https://baska.example/uploads/x.jpg adresi sayılmaz).
const UPLOAD_REF = /(?<![\w.:/-])(?:public)?\/uploads\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp))/gi;
export const PANEL_UPLOAD = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i;   // panelin yüklediği dosyalar; elle konan adlı dosyalara dokunulmaz
/** Yayın commit başlığının öneki; panelin kendi işlerini başkalarınınkinden ayırır. */
export const PANEL_PREFIX = "içerik: panelden güncelleme";

const titleOf = (book) => String(book?.title ?? book?.id ?? "?").replace(/\s+/g, " ").trim();
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Yayında (HEAD) olan kitap listesi ile çalışma klasöründekini karşılaştırır: eklenen / değişen / silinen başlıklar. */
export function diffBooks(before, after) {
  const was = new Map(before.map((b) => [b.id, b]));
  const now = new Map(after.map((b) => [b.id, b]));
  const added = after.filter((b) => !was.has(b.id)).map(titleOf);
  const removed = before.filter((b) => !now.has(b.id)).map(titleOf);
  const changed = after.filter((b) => was.has(b.id) && !sameJson(was.get(b.id), b)).map(titleOf);
  return { added, changed, removed };
}

/** "2 yeni kitap, 1 düzenlenen kitap, site bilgileri" gibi tek satırlık özet. */
export function describeChanges({ added, changed, removed, other }) {
  const parts = [];
  if (added.length) parts.push(`${added.length} yeni kitap`);
  if (changed.length) parts.push(`${changed.length} düzenlenen kitap`);
  if (removed.length) parts.push(`${removed.length} silinen kitap`);
  if (other) parts.push("site bilgileri");
  return parts.join(", ");
}

/** İçerik dosyalarının metninden "public/uploads/<ad>" yollarını toplar. */
export function uploadRefs(texts) {
  const found = new Set();
  for (const text of texts) for (const match of String(text).matchAll(UPLOAD_REF)) found.add(`${UPLOADS_DIR}/${match[1]}`);
  return found;
}
