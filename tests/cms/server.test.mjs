import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createCmsServer } from "../../scripts/cms/server.mjs";

const PASSWORD = "cms-fixture-password-12345";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR4sAAAAASUVORK5CYII=";
const book = { id: "ilk-kitap", title: "İlk Kitap", authors: ["İlk Yazar"], author_display: "İlk Yazar", cover: { local_path: null }, sources: {}, field_sources: { title: "archive" } };

async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "islambol-cms-test-"));
  for (const directory of ["data/catalog", "data/site", "dist", "public/uploads"]) await mkdir(join(root, directory), { recursive: true });
  await writeFile(join(root, "data/catalog/books.schema.json"), await readFile(resolve("data/catalog/books.schema.json")));
  const files = {
    "data/catalog/books.json": [book],
    "data/catalog/authors.json": [{ name: "İlk Yazar", display: "İlk Yazar", slug: "ilk-yazar", book_ids: [book.id] }],
    "data/site/campaigns.json": [{ id: "ilk-duyuru", title: "İlk Duyuru", book_id: book.id, active: true, order: 0 }],
    "data/site/vitrin.json": { one_cikan: book.id, onizleme_vitrini: [book.id], vitrin_haric: [] },
    "data/catalog/kapaklar-opt.json": {},
    "data/catalog/og.json": {},
  };
  for (const [file, value] of Object.entries(files)) await writeFile(join(root, file), JSON.stringify(value));
  await writeFile(join(root, "dist/index.html"), "<h1>Önceki yayın</h1>");
  let builds = 0;
  const build = async () => { builds++; await options.build?.(root); };
  let app = await createCmsServer({ root, build, initialPassword: PASSWORD, logger: () => {} });
  await new Promise((done) => app.server.listen(0, "127.0.0.1", done));
  let base = `http://127.0.0.1:${app.server.address().port}`;
  let cookie = "";
  let csrf = "";
  async function request(path, method = "GET", data, headers = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", origin: base, ...(cookie ? { cookie } : {}), ...(csrf ? { "x-csrf-token": csrf } : {}), ...headers },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const value = await response.json();
    if (response.headers.has("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
    return { response, value };
  }
  async function login() {
    const result = await request("/api/admin/login", "POST", { password: PASSWORD });
    assert.equal(result.response.status, 200);
    csrf = result.value.csrfToken;
    return result;
  }
  async function restart() {
    await app.close();
    app = await createCmsServer({ root, build, logger: () => {} });
    await new Promise((done) => app.server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${app.server.address().port}`;
    cookie = csrf = "";
  }
  t.after(async () => { await app.close(); await rm(root, { recursive: true, force: true }); });
  return { root, request, login, restart, builds: () => builds, base: () => base };
}

test("giriş, HttpOnly cookie, CSRF ve çıkış gerçek sunucuda doğrulanır", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request("/api/admin/session")).value.authenticated, false);
  assert.equal((await f.request("/api/admin/content")).response.status, 401);
  assert.equal((await f.request("/api/admin/login", "POST", { password: "yanlis" })).response.status, 401);
  const result = await f.login();
  assert.match(result.response.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  assert.ok(result.value.csrfToken);
  assert.equal((await f.request("/api/admin/session")).value.authenticated, true);
  assert.equal((await f.request("/api/admin/books", "POST", { title: "Gizli" }, { "x-csrf-token": "" })).response.status, 403);
  assert.equal((await f.request("/api/admin/logout", "POST", {})).response.status, 200);
  assert.equal((await f.request("/api/admin/content")).response.status, 401);
});

test("kitap, yazar ve duyuru ekleme/düzenleme yeniden başlatmada kalıcıdır", async (t) => {
  const f = await fixture(t);
  await f.login();
  const created = await f.request("/api/admin/books", "POST", { id: "yeni-kitap", title: "Yeni Kitap", authors: ["Yeni Yazar"], pages: 120, status: "draft" });
  assert.equal(created.response.status, 201);
  assert.equal(created.value.item.status, "draft");
  assert.ok(created.value.authors.some((a) => a.slug === "yeni-yazar"));
  assert.equal((await f.request("/api/admin/books/yeni-kitap", "PUT", { title: "Düzenlenen Kitap", status: "published" })).response.status, 200);
  assert.equal((await f.request("/api/admin/authors", "POST", { name: "Üçüncü Yazar", slug: "ucuncu-yazar", bio: "Gerçek biyografi" })).response.status, 201);
  assert.equal((await f.request("/api/admin/authors/ucuncu-yazar", "PUT", { bio: "Yeni biyografi" })).response.status, 200);
  assert.equal((await f.request("/api/admin/campaigns", "POST", { id: "yeni-duyuru", title: "Yeni Duyuru", book_id: "yeni-kitap", theme: "sage" })).response.status, 201);
  assert.equal((await f.request("/api/admin/campaigns/yeni-duyuru", "PUT", { active: false, order: 5 })).response.status, 200);
  await f.restart();
  await f.login();
  const content = (await f.request("/api/admin/content")).value;
  assert.equal(content.books.find((b) => b.id === "yeni-kitap").title, "Düzenlenen Kitap");
  assert.equal(content.authors.find((a) => a.slug === "ucuncu-yazar").bio, "Yeni biyografi");
  assert.equal(content.campaigns.find((c) => c.id === "yeni-duyuru").active, false);
  const credential = JSON.parse(await readFile(join(f.root, ".local/cms-auth.json"), "utf8"));
  assert.ok(credential.salt && credential.hash);
  assert.equal(JSON.stringify(credential).includes(PASSWORD), false);
});

test("kitap silme vitrin, yazar ve duyuru ilişkilerini temizler", async (t) => {
  const f = await fixture(t);
  await f.login();
  const result = await f.request("/api/admin/books/ilk-kitap", "DELETE");
  assert.equal(result.response.status, 200);
  assert.equal(result.value.books.length, 0);
  assert.deepEqual(result.value.authors[0].book_ids, []);
  assert.equal(result.value.campaigns[0].active, false);
  assert.equal(result.value.campaigns[0].book_id, null);
  const showcase = JSON.parse(await readFile(join(f.root, "data/site/vitrin.json"), "utf8"));
  assert.equal(showcase.one_cikan, null);
  assert.deepEqual(showcase.onizleme_vitrini, []);
  assert.equal((await f.request("/api/admin/authors/ilk-yazar", "DELETE")).response.status, 200);
  assert.equal((await f.request("/api/admin/campaigns/ilk-duyuru", "DELETE")).response.status, 200);
});

test("yazar profili silinirken kitap künyesi korunur; isim düzenlenince kitap atfı güncellenir", async (t) => {
  const f = await fixture(t);
  await f.login();
  const renamed = await f.request("/api/admin/authors/ilk-yazar", "PUT", { name: "Düzenlenen Yazar", display: "Dr. Düzenlenen Yazar" });
  assert.equal(renamed.response.status, 200);
  assert.deepEqual(renamed.value.books[0].authors, ["Düzenlenen Yazar"]);
  assert.equal(renamed.value.books[0].author_display, "Dr. Düzenlenen Yazar");
  const deleted = await f.request("/api/admin/authors/ilk-yazar", "DELETE");
  assert.equal(deleted.response.status, 200);
  assert.deepEqual(deleted.value.books[0].authors, ["Düzenlenen Yazar"]);
  assert.equal(deleted.value.books[0].author_display, "Dr. Düzenlenen Yazar");
  const edited = await f.request("/api/admin/books/ilk-kitap", "PUT", { title: "Başlık düzenlendi" });
  assert.equal(edited.value.authors.length, 0);
  assert.deepEqual(edited.value.books[0].field_sources, { title: "archive" });
});

test("bozuk veri, güvensiz URL, yinelenen kimlik ve yanlış id reddedilir", async (t) => {
  const f = await fixture(t);
  await f.login();
  for (const data of [{ id: "bad/../path", title: "Kitap" }, { id: "gecersiz-kitap", title: "Kitap", pages: -1 }, { id: "gecersiz-kitap", title: "Kitap", sources: { kitapyurdu: "javascript:alert(1)" } }]) {
    assert.equal((await f.request("/api/admin/books", "POST", data)).response.status, 422);
  }
  assert.equal((await f.request("/api/admin/books", "POST", book)).response.status, 409);
  assert.equal((await f.request("/api/admin/books/ilk-kitap", "PUT", { id: "baska-kimlik" })).response.status, 409);
  assert.equal((await f.request("/api/admin/books/olmayan", "DELETE")).response.status, 404);
  assert.equal((await f.request("/api/admin/campaigns", "POST", { title: "Duyuru", link_url: "//evil.example" })).response.status, 422);
  assert.equal((await f.request("/api/admin/books", "POST", { title: "Kitap" }, { origin: "https://evil.example" })).response.status, 403);
});

test("resim yükleme MIME imzası doğrulanır ve özgün isim yol olamaz", async (t) => {
  const f = await fixture(t);
  await f.login();
  const uploaded = await f.request("/api/admin/upload", "POST", { filename: "../../kapak.png", data: PNG });
  assert.equal(uploaded.response.status, 201);
  assert.match(uploaded.value.url, /^\/uploads\/[a-f0-9-]+\.png$/);
  assert.equal((await readFile(join(f.root, uploaded.value.local_path))).toString("base64"), PNG);
  const preview = await fetch(f.base() + uploaded.value.url);
  assert.equal(preview.headers.get("content-type"), "image/png");
  assert.equal(preview.status, 200);
  assert.equal((await f.request("/api/admin/upload", "POST", { filename: "fake.png", data: Buffer.from("<svg onload='alert(1)'></svg>").toString("base64") })).response.status, 422);
  assert.equal((await f.request("/api/admin/upload", "POST", { filename: "valid.svg", data: PNG })).response.status, 422);
});

test("build hatası kaynak kayıtlarını geri alır ve eski yayını korur", async (t) => {
  let fail = false;
  const f = await fixture(t, { build: async () => { if (fail) throw new Error("Kontrollü build hatası"); } });
  await f.login();
  const before = await readFile(join(f.root, "data/catalog/books.json"), "utf8");
  fail = true;
  const result = await f.request("/api/admin/books/ilk-kitap", "PUT", { title: "Başarısız kayıt" });
  assert.equal(result.response.status, 500);
  assert.match(result.value.error, /yayın|derle/i);
  assert.equal(await readFile(join(f.root, "data/catalog/books.json"), "utf8"), before);
  assert.equal(await readFile(join(f.root, "dist/index.html"), "utf8"), "<h1>Önceki yayın</h1>");
  fail = false;
  assert.equal((await f.request("/api/admin/books/ilk-kitap", "PUT", { title: "Sonraki başarılı kayıt" })).response.status, 200);
});

test("eş zamanlı kayıtlar kaybolmaz; özel veri ve traversal statik sunulmaz", async (t) => {
  const f = await fixture(t);
  await f.login();
  const results = await Promise.all(["birinci", "ikinci", "ucuncu"].map((id) => f.request("/api/admin/books", "POST", { id, title: id })));
  assert.ok(results.every((r) => r.response.status === 201));
  assert.equal((await f.request("/api/admin/content")).value.books.length, 4);
  for (const path of ["/.local/cms-auth.json", "/data/catalog/books.json", "/%2e%2e%2f.local%2fcms-auth.json"]) {
    const response = await fetch(f.base() + path);
    assert.equal(response.status, 404);
    assert.equal((await response.text()).includes("salt"), false);
  }
  for (const path of ["/%5c%5cserver%5cshare%5csecret", "/bad%00path"]) assert.equal((await fetch(f.base() + path)).status, 400);
});
