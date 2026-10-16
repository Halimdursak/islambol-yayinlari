import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, access, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rebuildSite } from "../../scripts/cms/build.mjs";
import { containedPath } from "../../scripts/cms/store.mjs";

test("gerçek Eleventy derlemesi yeni ağacı yayınlar ve silinen sayfayı kaldırır", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "islambol-cms-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ["src/_data", "dist/kitap/silinen"]) await mkdir(join(root, directory), { recursive: true });
  await writeFile(join(root, "eleventy.config.js"), 'export default function() { return { dir: { input: "src", output: "dist", data: "_data" } }; }');
  await writeFile(join(root, "src/index.njk"), "<h1>Yeni yayın</h1>");
  await writeFile(join(root, "src/kitap.njk"), "---\npagination:\n  data: books\n  size: 1\n  alias: book\npermalink: /kitap/{{ book.id }}/\n---\n<h1>{{ book.title }}</h1>");
  await writeFile(join(root, "src/_data/books.json"), JSON.stringify([{ id: "guncel", title: "Güncel Kitap" }]));
  await writeFile(join(root, "dist/index.html"), "<h1>Eski yayın</h1>");
  await writeFile(join(root, "dist/kitap/silinen/index.html"), "Silinmesi gereken sayfa");
  await rebuildSite(root);
  assert.match(await readFile(join(root, "dist/index.html"), "utf8"), /Yeni yayın/);
  assert.match(await readFile(join(root, "dist/kitap/guncel/index.html"), "utf8"), /Güncel Kitap/);
  await assert.rejects(access(join(root, "dist/kitap/silinen/index.html")));
  const saved = await readFile(join(root, "dist/index.html"), "utf8");
  await writeFile(join(root, "src/index.njk"), "{{ value | olmayanFiltre }}");
  await assert.rejects(rebuildSite(root), /Eleventy derlemesi başarısız/);
  assert.equal(await readFile(join(root, "dist/index.html"), "utf8"), saved);
  assert.deepEqual((await readdir(join(root, ".local"))).filter((name) => name.startsWith("cms-build-") || name.startsWith("cms-old-")), []);
});

test("Windows UNC, disk değişimi ve üst klasör yolları hiçbir dosya erişiminden önce reddedilir", () => {
  const root = process.cwd();
  for (const path of ["../secret", "\\\\server\\share\\secret", "Z:\\secret"]) assert.throws(() => containedPath(root, path));
  assert.equal(containedPath(root, ".local/cms-auth.json"), join(root, ".local/cms-auth.json"));
});
