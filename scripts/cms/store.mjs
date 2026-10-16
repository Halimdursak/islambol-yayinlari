import { mkdir, readFile, readdir, open, rename, rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { CmsError, createValidators, maintainRelations } from "./content.mjs";

const FILES = {
  books: "data/catalog/books.json", authors: "data/catalog/authors.json", campaigns: "data/site/campaigns.json",
  vitrin: "data/site/vitrin.json", covers: "data/catalog/kapaklar-opt.json", og: "data/catalog/og.json",
};

export function containedPath(root, ...parts) {
  const path = resolve(root, ...parts);
  const remainder = relative(resolve(root), path);
  if (!remainder || isAbsolute(remainder) || remainder === ".." || remainder.startsWith(`..${sep}`) || resolve(path) === resolve(root)) throw new Error("İşlem yolu proje klasörünün dışında.");
  return path;
}

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
      if (!Object.hasOwn(FILES, key)) throw new Error("Geçersiz CMS kurtarma kaydı.");
      const path = containedPath(root, FILES[key]);
      if (value === null) await rm(path, { force: true });
      else await atomicWrite(path, value);
    }
  }
  if (interrupted) {
    await restore(JSON.parse(interrupted));
    await rm(journal);
    logger("Yarım kalan CMS işlemi son sağlam kayda geri alındı.");
  }
  const validators = createValidators(JSON.parse(await readFile(containedPath(root, "data/catalog/books.schema.json"), "utf8")));
  let queue = Promise.resolve();
  async function snapshot() {
    const entries = await Promise.all(Object.entries(FILES).map(async ([key, file]) => [key, await optionalRead(containedPath(root, file))]));
    return Object.fromEntries(entries);
  }
  function decode(saved) {
    return Object.fromEntries(Object.entries(saved).map(([key, value]) => [key, value ? JSON.parse(value) : (["books", "authors", "campaigns"].includes(key) ? [] : {})]));
  }
  function publicContent(data) { return { books: data.books, authors: data.authors, campaigns: data.campaigns }; }
  async function backup(saved) {
    const directory = containedPath(root, ".local/cms-backups");
    await mkdir(directory, { recursive: true });
    await atomicWrite(join(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify(saved));
    const files = (await readdir(directory)).filter((file) => /^\d+-[a-f0-9-]+\.json$/.test(file)).sort();
    for (const file of files.slice(0, Math.max(0, files.length - 20))) await rm(containedPath(directory, file));
  }
  return {
    async read() { await queue; return publicContent(decode(await snapshot())); },
    mutate(resource, method, id, input) {
      const task = queue.then(async () => {
        const saved = await snapshot();
        const content = decode(saved);
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
        await backup(saved);
        await atomicWrite(journal, JSON.stringify(saved));
        try {
          for (const [field, file] of Object.entries(FILES)) {
            if (saved[field] !== null || ["books", "authors", "campaigns", "vitrin"].includes(field)) await atomicWrite(containedPath(root, file), JSON.stringify(content[field], null, 2) + "\n");
          }
          await build();
        } catch (error) {
          await restore(saved);
          await rm(journal, { force: true });
          logger(`CMS kaydı geri alındı: ${error.message}`);
          throw new CmsError(500, "Değişiklik yayın için derlenemedi ve geri alındı. Önceki yayın korundu; sunucu kaydını kontrol edin.");
        }
        await rm(journal, { force: true });
        return { ok: true, ...(item ? { item } : {}), ...publicContent(content) };
      });
      // A rejected save must not poison the queue for the next independent request.
      queue = task.catch(() => {});
      return task;
    },
    async idle() { await queue; },
  };
}
