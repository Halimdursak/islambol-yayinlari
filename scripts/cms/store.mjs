import { mkdir, readFile, readdir, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { compileBookValidator } from "./book-validator.mjs";
import { CmsError, createValidators } from "./content.mjs";
import { FILES, applyPage, applySite, applyVitrin, decode, fileFor, mutateRecord } from "./mutations.mjs";
import { containedPath } from "./paths.mjs";
import { publicSite } from "./site-content.mjs";
import { listCategories, listPages, publisherPreviewIds } from "./site-fs.mjs";

export { containedPath };

export async function atomicWrite(path, value) {
  await mkdir(join(path, ".."), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); }
  try { await rename(temporary, path); } catch (error) { await rm(temporary, { force: true }); throw error; }
}

async function optionalRead(path) {
  try { return await readFile(path, "utf8"); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export async function createStore(root, build, logger) {
  const journal = containedPath(root, ".local/cms-transaction.json");
  const interrupted = await optionalRead(journal);
  async function restore(snapshot) {
    for (const [key, value] of Object.entries(snapshot)) {
      const path = containedPath(root, fileFor(key));
      if (value === null) await rm(path, { force: true });
      else await atomicWrite(path, value);
    }
  }
  if (interrupted) {
    await restore(JSON.parse(interrupted));
    await rm(journal);
    logger("Yarım kalan CMS işlemi son sağlam kayda geri alındı.");
  }
  const validators = createValidators(compileBookValidator(JSON.parse(await readFile(containedPath(root, "data/catalog/books.schema.json"), "utf8"))));
  let queue = Promise.resolve();
  async function snapshot(extraKeys = []) {
    const keys = [...Object.keys(FILES), "site", ...extraKeys];
    const entries = await Promise.all(keys.map(async (key) => [key, await optionalRead(containedPath(root, fileFor(key)))]));
    return Object.fromEntries(entries);
  }
  /** Panelin gördüğü tüm içerik: koleksiyonlar + site ayarları + vitrin + sayfa metinleri + kategori seçenekleri. */
  async function publicContent(data) {
    const previews = await publisherPreviewIds(root, data.books);
    return {
      books: data.books.map((book) => ({ ...book, onizleme_var: previews.has(book.id) })),
      authors: data.authors,
      campaigns: data.campaigns,
      site: publicSite(data.site),
      vitrin: data.vitrin,
      pages: await listPages(root),
      categories: await listCategories(root),
    };
  }
  async function backup(saved) {
    const directory = containedPath(root, ".local/cms-backups");
    await mkdir(directory, { recursive: true });
    await atomicWrite(join(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify(saved));
    const files = (await readdir(directory)).filter((file) => /^\d+-[a-f0-9-]+\.json$/.test(file)).sort();
    for (const file of files.slice(0, Math.max(0, files.length - 20))) await rm(containedPath(directory, file));
  }
  /**
   * Tek işlem: durum anlık görüntüsü → doğrula → yedekle + günlük → yaz → siteyi derle.
   * Herhangi bir adım düşerse anlık görüntü geri yazılır; önceki yayın korunur. `apply` yazılacak dosyaları döndürür.
   */
  function transact(extraKeys, apply) {
    const task = queue.then(async () => {
      const saved = await snapshot(extraKeys);
      const content = decode(saved);
      const { files, item, extra } = await apply(content, saved);
      await backup(saved);
      await atomicWrite(journal, JSON.stringify(saved));
      try {
        for (const [key, value] of Object.entries(files)) await atomicWrite(containedPath(root, fileFor(key)), value);
        await build();
      } catch (error) {
        await restore(saved);
        await rm(journal, { force: true });
        logger(`CMS kaydı geri alındı: ${error.message}`);
        throw new CmsError(500, "Değişiklik yayın için derlenemedi ve geri alındı. Önceki yayın korundu; sunucu kaydını kontrol edin.");
      }
      await rm(journal, { force: true });
      return { ok: true, ...(item ? { item } : {}), ...extra, ...(await publicContent(content)) };
    });
    // A rejected save must not poison the queue for the next independent request.
    queue = task.catch(() => {});
    return task;
  }
  return {
    async read() { await queue; return publicContent(decode(await snapshot())); },
    mutate(resource, method, id, input) {
      return transact([], (content, saved) => mutateRecord({ content, saved, validators, resource, method, id, input }));
    },
    updateSite(input) {
      return transact([], (content) => applySite({ content, input }));
    },
    updateVitrin(input) {
      return transact([], (content) => applyVitrin({ content, input }));
    },
    updatePage(slug, input, today = new Date().toLocaleDateString("sv-SE")) {
      return transact([`page:${slug}`], (content, saved) => applyPage({ saved, slug, input, today }));
    },
    /** Yayınlama / geri alma gibi diskteki dosyaları kaydetmelerle çakışmadan işleyen işlemler sırayla çalışır. */
    exclusive(task) {
      const run = queue.then(task);
      queue = run.catch(() => {});
      return run;
    },
    async idle() { await queue; },
  };
}
