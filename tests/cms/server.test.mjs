import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { createCmsServer } from "../../scripts/cms/server.mjs";

const PASSWORD = "cms-fixture-password-12345";
const USER = "yayinevi";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR4sAAAAASUVORK5CYII=";
const book = { id: "ilk-kitap", title: "İlk Kitap", authors: ["İlk Yazar"], author_display: "İlk Yazar", cover: { local_path: null }, sources: { kitapyurdu: "https://www.kitapyurdu.com/kitap/ilk-kitap/1.html" }, field_sources: { title: "archive" } };
const SITE = { ad: "Deneme Yayınları", slogan: "Deneme sloganı", telefon: "+90 505 000 00 00", telefon_gosterim: "0505 000 00 00", whatsapp_url_sablonu: "https://wa.me/905050000000?text={kitap_adi}", whatsapp_url: "https://wa.me/905050000000", eposta: "info@example.com", adres: "Fatih, İstanbul", sosyal: { x: "https://x.com/deneme" }, satis_kanallari: [{ ad: "Mağaza", url: "https://example.com/magaza", not: null }], menu: [{ etiket: "Kitaplar", url: "/kitaplar/" }], dil: "tr" };
const PAGE = `---\ntitle: İletişim\nslug: iletisim\ndescription: Telefon {telefon_gosterim}\nson_guncelleme: 2026-01-01\nozet: "Korunan alan"\n---\n\n# İletişim\n\n**{telefon_gosterim}** numarasını arayın.\n`;

async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "islambol-cms-test-"));
  for (const directory of ["data/catalog", "data/catalog/onsoz", "data/site/sayfalar", "dist", "public/uploads"]) await mkdir(join(root, directory), { recursive: true });
  await writeFile(join(root, "data/site/sayfalar/iletisim.md"), PAGE);
  await writeFile(join(root, "data/catalog/books.schema.json"), await readFile(resolve("data/catalog/books.schema.json")));
  const files = {
    "data/catalog/books.json": [book],
    "data/catalog/authors.json": [{ name: "İlk Yazar", display: "İlk Yazar", slug: "ilk-yazar", book_ids: [book.id] }],
    "data/site/campaigns.json": [{ id: "ilk-duyuru", title: "İlk Duyuru", book_id: book.id, active: true, order: 0 }],
    "data/site/vitrin.json": { one_cikan: book.id, onizleme_vitrini: [book.id], vitrin_haric: [] },
    "data/catalog/kapaklar-opt.json": {},
    "data/catalog/og.json": {},
    "data/site/site.json": SITE,
    "data/site/sozluk.json": { kategoriler: [{ ad: "Tarih", slug: "tarih" }, { ad: "Siyaset", slug: "siyaset" }] },
    "data/catalog/onsoz/INDEX.json": [{ slug: "ilk-kitap" }],
    "data/catalog/onsoz/ilk-kitap.json": { pages: [{ index: 1, local_path: "public/x.png" }] },
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
    const result = await request("/api/admin/login", "POST", { username: USER, password: PASSWORD });
    assert.equal(result.response.status, 200);
    csrf = result.value.csrfToken;
    return result;
  }
  async function restart(keepSession = false, serverOptions = {}) {
    await app.close();
    app = await createCmsServer({ root, build, logger: () => {}, ...serverOptions });
    await new Promise((done) => app.server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${app.server.address().port}`;
    if (!keepSession) cookie = csrf = "";
  }
  t.after(async () => { await app.close(); await rm(root, { recursive: true, force: true }); });
  return { root, request, login, restart, builds: () => builds, base: () => base };
}

test("giriş, HttpOnly cookie, CSRF ve çıkış gerçek sunucuda doğrulanır", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request("/api/admin/session")).value.authenticated, false);
  assert.equal((await f.request("/api/admin/content")).response.status, 401);
  assert.equal((await f.request("/api/admin/login", "POST", { username: USER, password: "yanlis" })).response.status, 401);
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

test("içerik yanıtı site, vitrin, sayfalar, kategoriler ve yayınevi önizleme bilgisini taşır", async (t) => {
  const f = await fixture(t);
  await f.login();
  const content = (await f.request("/api/admin/content")).value;
  assert.equal(content.site.numara, "0505 000 00 00");
  assert.equal(content.site.slogan, "Deneme sloganı");
  assert.deepEqual(content.site.satis_kanallari, SITE.satis_kanallari);
  assert.equal(content.vitrin.one_cikan, "ilk-kitap");
  assert.deepEqual(content.categories, [{ ad: "Tarih", slug: "tarih" }, { ad: "Siyaset", slug: "siyaset" }]);
  assert.equal(content.books[0].onizleme_var, true);
  assert.deepEqual(content.pages, [{ slug: "iletisim", title: "İletişim", description: "Telefon {telefon_gosterim}", body: "**{telefon_gosterim}** numarasını arayın." }]);
});

test("site ayarları: numara normalleşir, WhatsApp bağlantısı üretilir, diğer alanlar korunur", async (t) => {
  const f = await fixture(t);
  await f.login();
  const saved = await f.request("/api/admin/site", "PUT", { numara: "+90 (532) 111-22-33", eposta: "yeni@example.com", adres: "", slogan: "Yeni slogan", sosyal: { x: "https://x.com/yeni", instagram: "", facebook: null }, satis_kanallari: [{ ad: "Mağaza", url: "https://example.com/m", not: "Not" }, { ad: "Yakında", url: "", not: null }] });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.value.site.numara, "0532 111 22 33");
  assert.equal(saved.value.site.whatsapp_url, "https://wa.me/905321112233");
  const file = JSON.parse(await readFile(join(f.root, "data/site/site.json"), "utf8"));
  assert.equal(file.telefon, "+90 532 111 22 33");
  assert.equal(file.whatsapp_url_sablonu, "https://wa.me/905321112233?text={kitap_adi}");
  assert.deepEqual(file.sosyal, { x: "https://x.com/yeni", instagram: null, facebook: null });
  assert.equal(file.satis_kanallari[1].url, null);
  assert.deepEqual(file.menu, SITE.menu);
  assert.equal(file.ad, SITE.ad);
  assert.equal(f.builds() >= 2, true);
});

test("site ayarları: geçersiz numara, e-posta ve güvensiz adresler reddedilir", async (t) => {
  const f = await fixture(t);
  await f.login();
  const before = await readFile(join(f.root, "data/site/site.json"), "utf8");
  const valid = { numara: "0505 000 00 00", eposta: "info@example.com", slogan: "Slogan" };
  for (const bad of [{ numara: "12345" }, { numara: "abc" }, { numara: "0111 111 11 11" }, { eposta: "bozuk" }, { slogan: "" }, { sosyal: { x: "javascript:alert(1)" } }, { satis_kanallari: [{ ad: "", url: "https://example.com" }] }, { satis_kanallari: [{ ad: "Mağaza", url: "http://example.com" }] }]) {
    const result = await f.request("/api/admin/site", "PUT", { ...valid, ...bad });
    assert.equal(result.response.status, 422, JSON.stringify(bad));
  }
  assert.equal(await readFile(join(f.root, "data/site/site.json"), "utf8"), before);
});

test("ana sayfa vitrini: yalnızca yayındaki kitaplar seçilir, sayılar 1-12 olur, kalıcıdır", async (t) => {
  const f = await fixture(t);
  await f.login();
  await f.request("/api/admin/books", "POST", { id: "taslak-kitap", title: "Taslak", authors: ["Yazar"], status: "draft" });
  await f.request("/api/admin/books", "POST", { id: "ikinci-kitap", title: "İkinci", authors: ["Yazar"] });
  for (const bad of [{ one_cikan: "taslak-kitap" }, { one_cikan: "yok" }, { onizleme_vitrini: ["ikinci-kitap", "ikinci-kitap"] }, { vitrin_haric: ["../x"] }, { yeni_cikanlar_adet: 13 }, { yazar_seridi_adet: 0 }, { yeni_cikanlar_adet: 2.5 }]) {
    assert.equal((await f.request("/api/admin/vitrin", "PUT", bad)).response.status, 422, JSON.stringify(bad));
  }
  const saved = await f.request("/api/admin/vitrin", "PUT", { one_cikan: "ikinci-kitap", onizleme_vitrini: ["ikinci-kitap", "ilk-kitap"], vitrin_haric: ["taslak-kitap"], yeni_cikanlar_adet: 4, yazar_seridi_adet: 6 });
  assert.equal(saved.response.status, 200);
  assert.deepEqual(saved.value.vitrin.onizleme_vitrini, ["ikinci-kitap", "ilk-kitap"]);
  await f.restart();
  await f.login();
  const vitrin = (await f.request("/api/admin/content")).value.vitrin;
  assert.equal(vitrin.one_cikan, "ikinci-kitap");
  assert.equal(vitrin.yazar_seridi_adet, 6);
  assert.equal((await f.request("/api/admin/vitrin", "PUT", { one_cikan: "" })).value.vitrin.one_cikan, null);
});

test("sayfa metni: ön bilgi korunur, başlık yeniden yazılır, bozuk yer tutucu ve olmayan sayfa reddedilir", async (t) => {
  const f = await fixture(t);
  await f.login();
  const saved = await f.request("/api/admin/pages/iletisim", "PUT", { title: "Bize Ulaşın", description: "Yeni açıklama", body: "Bize **{telefon_gosterim}** numarasından ulaşın." });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.value.page.slug, "iletisim");
  const file = await readFile(join(f.root, "data/site/sayfalar/iletisim.md"), "utf8");
  assert.match(file, /^---\ntitle: Bize Ulaşın\nslug: iletisim\ndescription: Yeni açıklama\nson_guncelleme: \d{4}-\d{2}-\d{2}\nozet: Korunan alan\n---\n\n# Bize Ulaşın\n\nBize \*\*\{telefon_gosterim\}\*\* numarasından ulaşın\.\n$/);
  assert.equal((await f.request("/api/admin/content")).value.pages[0].body, "Bize **{telefon_gosterim}** numarasından ulaşın.");
  assert.equal((await f.request("/api/admin/pages/iletisim", "PUT", { title: "X", body: "Arayın {telefon_gosterimi}" })).response.status, 422);
  assert.equal((await f.request("/api/admin/pages/iletisim", "PUT", { title: "", body: "Metin" })).response.status, 422);
  assert.equal((await f.request("/api/admin/pages/olmayan", "PUT", { title: "X", body: "Metin" })).response.status, 404);
  assert.equal((await f.request("/api/admin/pages/..%2Fsite", "PUT", { title: "X", body: "Metin" })).response.status, 404);
  assert.equal(await readFile(join(f.root, "data/site/sayfalar/iletisim.md"), "utf8"), file);
});

test("site ve sayfa kaydı derleme hatasında geri alınır", async (t) => {
  let fail = false;
  const f = await fixture(t, { build: async () => { if (fail) throw new Error("Kontrollü build hatası"); } });
  await f.login();
  const site = await readFile(join(f.root, "data/site/site.json"), "utf8");
  const page = await readFile(join(f.root, "data/site/sayfalar/iletisim.md"), "utf8");
  fail = true;
  assert.equal((await f.request("/api/admin/site", "PUT", { numara: "0532 111 22 33", eposta: "a@example.com", slogan: "S" })).response.status, 500);
  assert.equal((await f.request("/api/admin/pages/iletisim", "PUT", { title: "Başarısız", body: "Metin" })).response.status, 500);
  assert.equal(await readFile(join(f.root, "data/site/site.json"), "utf8"), site);
  assert.equal(await readFile(join(f.root, "data/site/sayfalar/iletisim.md"), "utf8"), page);
});

test("şifre değiştirme: eski şifre doğrulanır, yeni şifre kalıcıdır, diğer oturumlar kapanır", async (t) => {
  const f = await fixture(t);
  await f.login();
  assert.equal((await f.request("/api/admin/password", "POST", { current: "yanlis-sifre", next: "yeni-parola-1234" })).response.status, 401);
  assert.equal((await f.request("/api/admin/password", "POST", { current: PASSWORD, next: "kisa" })).response.status, 422);
  assert.equal((await f.request("/api/admin/password", "POST", { current: PASSWORD, next: PASSWORD })).response.status, 422);
  assert.equal((await f.request("/api/admin/password", "POST", { current: PASSWORD, next: "yeni-parola-1234" })).response.status, 200);
  assert.equal((await f.request("/api/admin/content")).response.status, 200);
  const credential = await readFile(join(f.root, ".local/cms-auth.json"), "utf8");
  assert.equal(credential.includes("yeni-parola-1234"), false);
  await f.restart();
  assert.equal((await f.request("/api/admin/login", "POST", { username: USER, password: PASSWORD })).response.status, 401);
  assert.equal((await f.request("/api/admin/login", "POST", { username: USER, password: "yeni-parola-1234" })).response.status, 200);
});

test("yükleme türleri: boyut bilgisi döner, geçersiz tür reddedilir, önizleme sayfaları kitapta saklanır", async (t) => {
  const f = await fixture(t);
  await f.login();
  const cover = await f.request("/api/admin/upload", "POST", { filename: "kapak.png", data: PNG, kind: "cover" });
  assert.equal(cover.response.status, 201);
  assert.deepEqual([cover.value.width, cover.value.height], [1, 1]);
  assert.equal((await f.request("/api/admin/upload", "POST", { filename: "kapak.png", data: PNG, kind: "bilinmeyen" })).response.status, 422);
  const page = await f.request("/api/admin/upload", "POST", { filename: "sayfa.png", data: PNG, kind: "preview" });
  const saved = await f.request("/api/admin/books/ilk-kitap", "PUT", { cover: { local_path: cover.value.local_path, width: cover.value.width, height: cover.value.height }, preview_pages: [{ local_path: page.value.local_path, width: 1, height: 1 }] });
  assert.equal(saved.response.status, 200);
  assert.deepEqual(saved.value.item.cover.width, 1);
  assert.equal(saved.value.item.preview_pages[0].local_path, page.value.local_path);
  for (const bad of [[{ local_path: "../gizli.png" }], [{ local_path: "public/../gizli.png" }], [{ local_path: "baska/yol.png" }], "metin", Array.from({ length: 31 }, () => ({ local_path: page.value.local_path }))]) {
    assert.equal((await f.request("/api/admin/books/ilk-kitap", "PUT", { preview_pages: bad })).response.status, 422, JSON.stringify(bad).slice(0, 60));
  }
  // Kapak değişince eski boyutlar taşınmaz.
  const replaced = await f.request("/api/admin/books/ilk-kitap", "PUT", { cover: { local_path: page.value.local_path } });
  assert.deepEqual([replaced.value.item.cover.width, replaced.value.item.cover.height], [null, null]);
});

test("büyük kapak 1200 piksele küçültülür (sharp varsa)", async (t) => {
  let sharp;
  try { sharp = (await import("sharp")).default; } catch { return t.skip("sharp bu makinede yüklenemedi"); }
  const big = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#ffffff" } }).png().toBuffer();
  const f = await fixture(t);
  await f.login();
  const cover = await f.request("/api/admin/upload", "POST", { filename: "buyuk.png", data: big.toString("base64"), kind: "cover" });
  assert.equal(cover.response.status, 201);
  assert.deepEqual([cover.value.width, cover.value.height], [1200, 800]);
  const preview = await f.request("/api/admin/upload", "POST", { filename: "buyuk.png", data: big.toString("base64"), kind: "preview" });
  assert.equal(preview.value.width, 1400);
});

test("giriş kullanıcı adı ister; yanlış kullanıcı adı da şifre gibi reddedilir, hata hangisinin yanlış olduğunu söylemez", async (t) => {
  const f = await fixture(t);
  const wrongUser = await f.request("/api/admin/login", "POST", { username: "baska", password: PASSWORD });
  const wrongPass = await f.request("/api/admin/login", "POST", { username: USER, password: "yanlis" });
  assert.equal(wrongUser.response.status, 401);
  assert.equal(wrongUser.value.error, wrongPass.value.error);
  assert.equal((await f.request("/api/admin/login", "POST", { password: PASSWORD })).response.status, 422, "kullanıcı adı olmadan giriş yok");
  const ok = await f.request("/api/admin/login", "POST", { username: "YAYINEVİ", password: PASSWORD });
  assert.equal(ok.response.status, 200, "büyük/küçük harf ve Türkçe aksan farkı sorun olmaz");
  assert.equal(ok.value.username, USER);
});

test("beni hatırla: çerez 30 gün yaşar ve sunucu yeniden başlasa da oturum sürer; hatırlamayan 12 saatlik", async (t) => {
  const f = await fixture(t);
  const short = await f.request("/api/admin/login", "POST", { username: USER, password: PASSWORD });
  assert.match(short.response.headers.get("set-cookie"), /Max-Age=43200/);
  const long = await f.request("/api/admin/login", "POST", { username: USER, password: PASSWORD, remember: true });
  assert.match(long.response.headers.get("set-cookie"), /Max-Age=2592000/);
  await f.restart(true);
  const session = await f.request("/api/admin/session");
  assert.equal(session.value.authenticated, true, "yeniden başlatma sonrası oturum sürer");
  assert.equal(session.value.username, USER);
});

test("hesap: kullanıcı adı ve şifre birlikte ya da ayrı değiştirilir; boş istek reddedilir", async (t) => {
  const f = await fixture(t);
  await f.login();
  assert.equal((await f.request("/api/admin/password", "POST", { current: PASSWORD })).response.status, 422);
  assert.equal((await f.request("/api/admin/password", "POST", { current: PASSWORD, username: "x" })).response.status, 422, "çok kısa kullanıcı adı");
  const renamed = await f.request("/api/admin/password", "POST", { current: PASSWORD, username: "kutuphane" });
  assert.equal(renamed.response.status, 200);
  assert.equal(renamed.value.username, "kutuphane");
  await f.restart();
  assert.equal((await f.request("/api/admin/login", "POST", { username: USER, password: PASSWORD })).response.status, 401);
  assert.equal((await f.request("/api/admin/login", "POST", { username: "kutuphane", password: PASSWORD })).response.status, 200);
});

test("arka kapak: yükleme JPEG + WebP eşi verir, kitaba kaydedilir, kötü yol reddedilir, null kaldırır", async (t) => {
  const f = await fixture(t);
  await f.login();
  const up = await f.request("/api/admin/upload", "POST", { filename: "arka.png", data: PNG, kind: "back" });
  assert.equal(up.response.status, 201);
  assert.match(up.value.local_path, /^public\/uploads\/[0-9a-f-]{36}\.png$/);
  assert.match(up.value.webp_path ?? "", /^public\/uploads\/[0-9a-f-]{36}\.webp$/);
  assert.ok((await readFile(join(f.root, up.value.webp_path))).length > 0);
  const saved = await f.request("/api/admin/books/ilk-kitap", "PUT", { back_cover: { local_path: up.value.local_path, webp_path: up.value.webp_path, width: up.value.width, height: up.value.height } });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.value.item.back_cover.local_path, up.value.local_path);
  for (const bad of [{ local_path: "../gizli.png" }, { local_path: "baska/yol.png" }, { local_path: up.value.local_path, webp_path: "../x.webp" }, "metin"]) {
    assert.equal((await f.request("/api/admin/books/ilk-kitap", "PUT", { back_cover: bad })).response.status, 422, JSON.stringify(bad));
  }
  const cleared = await f.request("/api/admin/books/ilk-kitap", "PUT", { back_cover: null });
  assert.equal(cleared.value.item.back_cover, null);
});

test("yayınla uç noktaları: oturum ister; git deposu olmayan klasörde 'kurulu değil' döner, geri al reddedilir", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request("/api/admin/publish")).response.status, 401);
  await f.login();
  const state = await f.request("/api/admin/publish");
  assert.equal(state.response.status, 200);
  assert.equal(state.value.configured, false);
  assert.equal(state.value.pending, false);
  assert.equal((await f.request("/api/admin/publish", "POST", {}, { "x-csrf-token": "" })).response.status, 403, "CSRF jetonu şart");
  assert.equal((await f.request("/api/admin/publish/discard", "POST", {})).response.status, 409);
});

test("paralel hatalı giriş denemeleri sınırı aşamaz: 8 hakkın ötesi 429 alır", async (t) => {
  const f = await fixture(t);
  const results = await Promise.all(Array.from({ length: 40 }, () => f.request("/api/admin/login", "POST", { username: USER, password: "yanlis-sifre" })));
  const unauthorized = results.filter((r) => r.response.status === 401).length;
  const limited = results.filter((r) => r.response.status === 429).length;
  assert.ok(unauthorized <= 8, `en çok 8 yanlış deneme işlenir (işlenen: ${unauthorized})`);
  assert.ok(limited >= 32, `kalanı 429 alır (429: ${limited})`);
  assert.equal((await f.request("/api/admin/login", "POST", { username: USER, password: PASSWORD })).response.status, 429, "kilit sürerken doğru şifre de bekler");
});

test("şifre sıfırlama (--reset-password) eski oturumları, 'beni hatırla' dahil, kapatır", async (t) => {
  const f = await fixture(t);
  await f.request("/api/admin/login", "POST", { username: USER, password: PASSWORD, remember: true });
  assert.equal((await f.request("/api/admin/session")).value.authenticated, true);
  await f.restart(true, { resetPassword: true, initialPassword: "yepyeni-sifre-12345" });
  assert.equal((await f.request("/api/admin/session")).value.authenticated, false, "eski çerez artık geçersiz");
  assert.equal((await f.request("/api/admin/login", "POST", { username: USER, password: "yepyeni-sifre-12345" })).response.status, 200);
});

test("arka kapak zaten WebP ise üzerine yeniden kodlanmaz: webp_path kendisidir", async (t) => {
  const f = await fixture(t);
  await f.login();
  const webp = await sharp({ create: { width: 40, height: 60, channels: 3, background: "#336699" } }).webp().toBuffer();
  const up = await f.request("/api/admin/upload", "POST", { filename: "arka.webp", data: webp.toString("base64"), kind: "back" });
  assert.equal(up.response.status, 201);
  assert.equal(up.value.webp_path, up.value.local_path);
  assert.equal((await readFile(join(f.root, up.value.local_path))).equals(webp), true, "dosya değişmeden saklandı");
});
