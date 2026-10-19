// Cloudflare tarafındaki içerik deposu.
//  - "Yayın hâli" (live): GitHub main dalındaki izlenen dosyalar; Durable Object depolamasında önbelleklenir.
//  - "Taslak" (draft): panelde kaydedilmiş ama henüz yayınlanmamış dosya sürümleri. GitHub'a yalnız "Yayınla" ile gider.
//  - Yüklenen görseller: taslakla birlikte burada durur; yayınlanırken commit'e eklenir.
// Panelin gördüğü içerik = yayın hâli üzerine taslaklar.
import { FILES, SITE_FILE, applyPage, applySite, applyVitrin, decode, fileFor, mutateRecord } from "../../scripts/cms/mutations.mjs";
import { UPLOADS_DIR } from "../../scripts/cms/publish-core.mjs";
import { categoriesFrom, previewIdsFrom, publicSite, readablePage } from "../../scripts/cms/site-content.mjs";
import { mapLimit } from "./lock.mjs";

const LIVE_CHECK_MS = 30_000;
const PAGE_DIR = "data/site/sayfalar/";
const PAGE_FILE = /^data\/site\/sayfalar\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const FIXED = new Set([...Object.values(FILES), SITE_FILE]);
const UPLOAD_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i;
const UNREFERENCED_MAX_AGE = 3 * 24 * 60 * 60 * 1000;

export const K = {
  live: "live",
  file: (path) => `lf:${path}`,
  draft: (path) => `dr:${path}`,
  upload: (name) => `up:${name}`,
};

const isTracked = (path) => FIXED.has(path) || PAGE_FILE.test(path);

export function createContentStore({ storage, github, validators, previewSlugs = [], categories = [], now = Date.now }) {
  const previews = new Set(previewSlugs);

  // ---- Yayın hâli --------------------------------------------------------------------------------------------

  async function getLive() { return (await storage.get(K.live)) ?? null; }

  /**
   * GitHub main'in güncel durumunu okur (en çok 30 sn'de bir). Değişen izlenen dosyaları indirir ve taslakları yeni tabana göre uyumlar:
   * taslak yeni yayın hâliyle aynıysa düşer; yayın hâli arada değişmişse taslak "çakışma" olarak işaretlenir.
   */
  async function refreshLive({ force = false } = {}) {
    const known = await getLive();
    if (known && !force && now() - known.checkedAt < LIVE_CHECK_MS) return known;
    const head = await github.ref("main");
    if (known && known.sha === head) {
      const next = { ...known, checkedAt: now() };
      await storage.put(K.live, next);
      return next;
    }
    const [{ tree }, entries] = await Promise.all([github.commit(head), github.tree(head)]);
    const files = {};
    const uploads = [];
    for (const entry of entries) {
      if (entry.type !== "blob") continue;
      if (isTracked(entry.path)) files[entry.path] = entry.sha;
      else if (entry.path.startsWith(`${UPLOADS_DIR}/`) && UPLOAD_NAME.test(entry.path.slice(UPLOADS_DIR.length + 1))) uploads.push(entry.path.slice(UPLOADS_DIR.length + 1));
    }
    const old = known?.files ?? {};
    const changed = Object.entries(files).filter(([path, sha]) => old[path] !== sha);
    const texts = new Map();
    await mapLimit(changed, 4, async ([path, sha]) => { texts.set(path, await github.blob(sha)); });
    for (const [path, text] of texts) await storage.put(K.file(path), text);
    for (const path of Object.keys(old)) if (!(path in files)) await storage.delete(K.file(path));
    // Taslakları yeni tabana göre uyumla.
    for (const draft of await listDrafts()) {
      const liveText = texts.has(draft.path) ? texts.get(draft.path) : await storage.get(K.file(draft.path));
      if (liveText === draft.text) { await storage.delete(K.draft(draft.path)); continue; }
      const base = files[draft.path] ?? null;
      if (draft.base !== base) await storage.put(K.draft(draft.path), { text: draft.text, base: draft.base, conflict: true });
    }
    const next = { sha: head, tree, files, uploads, checkedAt: now() };
    await storage.put(K.live, next);
    return next;
  }

  /** Bir sonraki okumada GitHub'dan yeniden yüklenmesi için denetim zamanını sıfırlar. */
  async function invalidateLive() {
    const known = await getLive();
    if (known) await storage.put(K.live, { ...known, checkedAt: 0 });
  }

  const liveText = async (path) => (await storage.get(K.file(path))) ?? null;

  // ---- Taslaklar ---------------------------------------------------------------------------------------------

  async function listDrafts() {
    const entries = await storage.list({ prefix: "dr:" });
    return [...entries].map(([key, value]) => ({ path: key.slice(3), text: value.text, base: value.base ?? null, conflict: Boolean(value.conflict) }));
  }

  async function writeDraft(path, text) {
    if ((await liveText(path)) === text) { await storage.delete(K.draft(path)); return; }
    const existing = await storage.get(K.draft(path));
    const base = existing ? existing.base : ((await getLive())?.files[path] ?? null);
    await storage.put(K.draft(path), { text, base, ...(existing?.conflict ? { conflict: true } : {}) });
  }

  async function clearDrafts() {
    const drafts = await listDrafts();
    for (const draft of drafts) await storage.delete(K.draft(draft.path));
    return drafts;
  }

  async function overlayText(path) {
    const draft = await storage.get(K.draft(path));
    return draft ? draft.text : liveText(path);
  }

  /** Doğrulayıcıların beklediği ham dosya metinleri: { anahtar: metin | null }. */
  async function readSaved(extraKeys = []) {
    const keys = [...Object.keys(FILES), "site", ...extraKeys];
    return Object.fromEntries(await Promise.all(keys.map(async (key) => [key, await overlayText(fileFor(key))])));
  }

  /** Yüklenen görsellerin adının geçebileceği tüm izlenen dosyaların (taslak üstünde) metni. */
  async function allTexts() {
    const live = await getLive();
    const paths = new Set([...Object.keys(live?.files ?? {})]);
    for (const draft of await listDrafts()) paths.add(draft.path);
    return (await Promise.all([...paths].map((path) => overlayText(path)))).filter((text) => typeof text === "string");
  }

  // ---- Panelin gördüğü içerik --------------------------------------------------------------------------------

  async function listPages() {
    const live = await getLive();
    const paths = new Set(Object.keys(live?.files ?? {}).filter((path) => PAGE_FILE.test(path)));
    return (await Promise.all([...paths].sort().map(async (path) => readablePage(path.match(PAGE_FILE)[1], (await overlayText(path)) ?? "")))).filter(Boolean);
  }

  async function publicContent(data) {
    const previewIds = previewIdsFrom(previews, data.books);
    return {
      books: data.books.map((book) => ({ ...book, onizleme_var: previewIds.has(book.id) })),
      authors: data.authors,
      campaigns: data.campaigns,
      site: publicSite(data.site),
      vitrin: data.vitrin,
      pages: await listPages(),
      categories: categoriesFrom({ kategoriler: categories }),
    };
  }

  /** Tek işlem: doğrula → taslağa yaz. Hata olursa hiçbir şey yazılmaz (yazma doğrulamadan sonradır). */
  async function transact(extraKeys, apply) {
    await refreshLive();
    const saved = await readSaved(extraKeys);
    const content = decode(saved);
    const { files, item, extra } = apply(content, saved);
    for (const [key, text] of Object.entries(files)) await writeDraft(fileFor(key), text);
    return { ok: true, ...(item ? { item } : {}), ...extra, ...(await publicContent(content)) };
  }

  // ---- Yüklenen görseller ------------------------------------------------------------------------------------

  const getUpload = async (name) => (UPLOAD_NAME.test(name) ? (await storage.get(K.upload(name))) ?? null : null);
  const hasUpload = async (name) => Boolean(await getUpload(name));
  async function putUpload(name, bytes) {
    // Not: ArrayBuffer olarak saklanır (Durable Object yapısal kopya); kopya alınır ki çağıranın tamponu değişse de kayıt bozulmasın.
    await storage.put(K.upload(name), { data: bytes.slice().buffer, at: now() });
  }

  /** Yayında zaten bulunan ve uzun süredir kullanılmayan yüklemeleri siler. */
  async function collectUploads(referenced) {
    const live = await getLive();
    const published = new Set(live?.uploads ?? []);
    const stored = await storage.list({ prefix: "up:" });
    for (const [key, record] of stored) {
      const name = key.slice(3);
      if (published.has(name) || (!referenced.has(name) && now() - record.at > UNREFERENCED_MAX_AGE)) await storage.delete(key);
    }
  }

  // ---- Yayınlandıktan sonra ----------------------------------------------------------------------------------

  /** Yayın commit'i GitHub'a gitti: yayın hâlini onunla değiştirir, yayınlanan taslakları düşürür. */
  async function markPublished({ commit, tree, files, uploads }) {
    const live = await getLive();
    const nextFiles = { ...live.files };
    for (const file of files) {
      nextFiles[file.path] = file.sha;
      await storage.put(K.file(file.path), file.text);
      const draft = await storage.get(K.draft(file.path));
      if (!draft) continue;
      // Yayın sürerken aynı dosya yeniden düzenlendiyse yeni taslak korunur (tabanı yeni sürüm olur).
      if (draft.text === file.text) await storage.delete(K.draft(file.path));
      else await storage.put(K.draft(file.path), { text: draft.text, base: file.sha });
    }
    const next = { sha: commit, tree, files: nextFiles, uploads: [...new Set([...live.uploads, ...uploads])], checkedAt: now() };
    await storage.put(K.live, next);
    return next;
  }

  return {
    refreshLive, invalidateLive, getLive, liveText, overlayText, listDrafts, clearDrafts, readSaved, allTexts,
    publicContent, markPublished, getUpload, hasUpload, putUpload, collectUploads,
    async read() { await refreshLive(); return publicContent(decode(await readSaved())); },
    mutate(resource, method, id, input) { return transact([], (content, saved) => mutateRecord({ content, saved, validators, resource, method, id, input })); },
    updateSite(input) { return transact([], (content) => applySite({ content, input })); },
    updateVitrin(input) { return transact([], (content) => applyVitrin({ content, input })); },
    updatePage(slug, input, today = new Date().toLocaleDateString("sv-SE")) {
      return transact([`page:${slug}`], (content, saved) => applyPage({ saved, slug, input, today }));
    },
  };
}
