import assert from "node:assert/strict";
import test from "node:test";
import { createPanel } from "../src/panel.mjs";
import { newCredential } from "../src/crypto.mjs";
import { HOST, PASSWORD, USER, advance, bookValidator, createFixture, newBook, tinyPng } from "./helpers/panel.mjs";

const FIVE_MIN = 5 * 60 * 1000;
const cover = (width = 800, height = 1200) => ({ filename: "kapak.png", data: tinyPng(width, height).toString("base64"), kind: "cover" });
const asJson = (value) => JSON.stringify(value, null, 2) + "\n";

test("giriş: yanlış şifre reddedilir, doğru şifre çerez ve CSRF jetonu verir, oturum sorgulanabilir", async () => {
  const f = await createFixture();
  assert.equal((await f.call("/api/admin/session", "GET", undefined, { anonymous: true })).value.authenticated, false);
  assert.equal((await f.call("/api/admin/login", "POST", { username: USER, password: "yanlis" }, { anonymous: true })).status, 401);
  const ok = await f.login(true);
  assert.match(ok.response.headers.get("set-cookie"), /^__Host-islambol_cms=[0-9a-f]{64}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000$/);
  const session = await f.call("/api/admin/session");
  assert.deepEqual({ ok: session.value.authenticated, user: session.value.username, mode: session.value.mode }, { ok: true, user: USER, mode: "cloud" });
});

test("giriş: kullanıcı adı büyük/küçük harf ve Türkçe aksan farkını görmezden gelir; hata hangisinin yanlış olduğunu söylemez", async () => {
  const f = await createFixture();
  const wrongName = await f.call("/api/admin/login", "POST", { username: "baska", password: PASSWORD }, { anonymous: true });
  const wrongPass = await f.call("/api/admin/login", "POST", { username: USER, password: "yanlis-sifre" }, { anonymous: true });
  assert.equal(wrongName.value.error, wrongPass.value.error);
  assert.equal((await f.call("/api/admin/login", "POST", { username: "YAYİNEVİ", password: PASSWORD }, { anonymous: true })).status, 200);
});

test("hatalı deneme sınırı: 8 hakkın ötesi 429; doğru şifre de kilit sürerken bekler, süre dolunca açılır", async () => {
  const f = await createFixture();
  const results = await Promise.all(Array.from({ length: 20 }, () => f.call("/api/admin/login", "POST", { username: USER, password: "yanlis-sifre" }, { anonymous: true })));
  assert.ok(results.filter((r) => r.status === 401).length <= 8);
  assert.ok(results.filter((r) => r.status === 429).length >= 12);
  assert.equal((await f.call("/api/admin/login", "POST", { username: USER, password: PASSWORD }, { anonymous: true })).status, 429);
  advance(f, 16 * 60 * 1000);
  assert.equal((await f.call("/api/admin/login", "POST", { username: USER, password: PASSWORD }, { anonymous: true })).status, 200);
});

test("güvenlik: yanlış ana makine, çapraz site ve CSRF'siz yazma reddedilir; oturumsuz API 401", async () => {
  const f = await createFixture();
  assert.equal((await f.call("/api/admin/session", "GET", undefined, { anonymous: true, host: "kotu.example" })).status, 403);
  assert.equal((await f.call("/api/admin/session", "GET", undefined, { anonymous: true, headers: { origin: "https://kotu.example" } })).status, 403);
  assert.equal((await f.call("/api/admin/session", "GET", undefined, { anonymous: true, headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal((await f.call("/api/admin/content", "GET", undefined, { anonymous: true })).status, 401);
  await f.login();
  assert.equal((await f.call("/api/admin/books", "POST", newBook(), { headers: { "x-csrf-token": "yanlis" } })).status, 403);
});

test("içerik GitHub'dan okunur: ilk açılış alt istek sınırı içinde kalır, sonraki okumalar GitHub'a gitmez, 30 sn sonra yalnız bir ref sorulur", async () => {
  const f = await createFixture();
  await f.login();
  f.github.resetLog();
  const first = await f.call("/api/admin/content");
  assert.equal(first.status, 200);
  assert.ok(first.value.books.length > 20, "gerçek katalog okundu");
  assert.ok(first.value.pages.length >= 5, "sayfa metinleri okundu");
  assert.ok(f.github.log.length <= 30, `ilk okuma ${f.github.log.length} istek`);
  f.github.resetLog();
  await f.call("/api/admin/content");
  assert.equal(f.github.log.length, 0, "taze önbellek: GitHub'a gidilmez");
  advance(f, FIVE_MIN);
  await f.call("/api/admin/content");
  assert.deepEqual(f.github.log.map((entry) => entry.path), ["/git/ref/heads/main"]);
});

test("yeni kitap yalnız taslağa yazılır: GitHub'a hiçbir şey gitmez, yayın çubuğu bekleyen değişikliği gösterir", async () => {
  const f = await createFixture();
  await f.login();
  const before = f.github.commitCount();
  const created = await f.call("/api/admin/books", "POST", newBook());
  assert.equal(created.status, 201);
  assert.equal(created.value.item.id, "deneme-kitabi");
  assert.equal(f.github.commitCount(), before, "kayıt GitHub'a commit atmaz");
  const info = (await f.call("/api/admin/publish")).value;
  assert.equal(info.pending, true);
  assert.match(info.text, /1 yeni kitap/);
  assert.ok((await f.call("/api/admin/books/deneme-kitabi")).value.title);
});

test("geçersiz kitap 422 döner ve hiçbir taslak bırakmaz", async () => {
  const f = await createFixture();
  await f.login();
  const bad = await f.call("/api/admin/books", "POST", newBook({ isbn: "bu-isbn-degil" }));
  assert.equal(bad.status, 422);
  assert.equal((await f.call("/api/admin/publish")).value.pending, false);
});

test("görsel yükleme: oturumla kendi görseli döner, oturumsuz istek yayındaki siteye düşer; sahte resim, büyük dosya ve bilinmeyen tür reddedilir", async () => {
  const f = await createFixture();
  await f.login();
  const up = await f.call("/api/admin/upload", "POST", cover());
  assert.equal(up.status, 201);
  assert.match(up.value.local_path, /^public\/uploads\/[0-9a-f-]{36}\.png$/);
  assert.deepEqual([up.value.width, up.value.height], [800, 1200]);
  const own = await f.call(up.value.url, "GET", undefined, { raw: true });
  assert.equal(own.status, 200);
  assert.equal(own.headers.get("content-type"), "image/png");
  assert.equal((await f.call(up.value.url, "GET", undefined, { anonymous: true, raw: true })).status, 404, "oturumsuz: taslak görsel sızmaz");
  f.site.set("/uploads/yayinda.jpg", Buffer.from("jpeg"));
  assert.equal((await f.call("/uploads/yayinda.jpg", "GET", undefined, { anonymous: true, raw: true })).status, 200, "yayındaki görsel siteden gelir");
  assert.equal((await f.call("/api/admin/upload", "POST", { filename: "x.png", data: Buffer.from("png degil").toString("base64"), kind: "cover" })).status, 422);
  const big = Buffer.concat([tinyPng(), Buffer.alloc(2_000_000)]).toString("base64");
  assert.equal((await f.call("/api/admin/upload", "POST", { filename: "x.png", data: big, kind: "cover" })).status, 413);
  assert.equal((await f.call("/api/admin/upload", "POST", { ...cover(), kind: "bilinmeyen" })).status, 422);
});

test("yayınla: tek commit (içerik + yalnız kullanılan yükleme), diğer dosyalara dokunulmaz, dağıtım izlenir", async () => {
  const f = await createFixture();
  await f.login();
  const used = (await f.call("/api/admin/upload", "POST", cover())).value;
  const orphan = (await f.call("/api/admin/upload", "POST", cover(600, 900))).value;
  await f.call("/api/admin/books", "POST", newBook({ cover: { local_path: used.local_path, width: used.width, height: used.height } }));
  const base = f.github.head();
  const started = await f.call("/api/admin/publish", "POST", {});
  assert.equal(started.status, 202);
  const head = f.github.head();
  assert.notEqual(head, base);
  assert.equal(f.github.commits.get(head).parents[0], base, "tek commit, öncekinin üstüne");
  assert.match(f.github.commits.get(head).message, /^içerik: panelden güncelleme \(1 yeni kitap/);
  assert.match(f.github.fileText("data/catalog/books.json"), /"id": "deneme-kitabi"/);
  assert.ok(f.github.fileBytes(used.local_path), "kullanılan görsel commit'te");
  assert.equal(f.github.fileBytes(orphan.local_path), null, "kullanılmayan yükleme herkese açık depoya gitmez");
  assert.equal(f.github.fileText("README.md"), "dokunulmaz");
  let info = (await f.call("/api/admin/publish")).value;
  assert.equal(info.pending, false, "yayından sonra bekleyen yok");
  assert.equal(info.running, true);
  assert.match(info.job.message, /başlatıyor/);
  f.github.setRuns(head, [{ name: "Pages'e yayınla", status: "in_progress", conclusion: null }]);
  advance(f, 4000);
  info = (await f.call("/api/admin/publish")).value;
  assert.equal(info.running, true);
  f.github.setRuns(head, [{ name: "Pages'e yayınla", status: "completed", conclusion: "success" }, { name: "CI", status: "completed", conclusion: "success" }]);
  advance(f, 4000);
  info = (await f.call("/api/admin/publish")).value;
  assert.equal(info.running, false);
  assert.equal(info.job.phase, "done");
  assert.match(info.job.message, /Yayında/);
  assert.equal(await f.storage.get(`up:${used.local_path.split("/").pop()}`), undefined, "yayınlanan yükleme depodan temizlendi");
});

test("başarısız dağıtım hata olarak gösterilir", async () => {
  const f = await createFixture();
  await f.login();
  await f.call("/api/admin/books", "POST", newBook());
  await f.call("/api/admin/publish", "POST", {});
  f.github.setRuns(f.github.head(), [{ name: "Pages'e yayınla", status: "completed", conclusion: "failure" }]);
  advance(f, 4000);
  const info = (await f.call("/api/admin/publish")).value;
  assert.equal(info.job.phase, "error");
  assert.match(info.job.message, /başarısız/);
  assert.equal(info.running, false);
});

test("başkası başka bir dosyayı değiştirdiyse onun değişikliği korunur (üç yönlü birleştirme)", async () => {
  const f = await createFixture();
  await f.login();
  await f.call("/api/admin/books", "POST", newBook());
  const site = JSON.parse(f.github.fileText("data/site/site.json"));
  f.github.pushExternal({ "data/site/site.json": asJson({ ...site, slogan: "Başkasının sloganı" }) });
  advance(f, FIVE_MIN);
  assert.equal((await f.call("/api/admin/publish", "POST", {})).status, 202);
  assert.match(f.github.fileText("data/site/site.json"), /Başkasının sloganı/);
  assert.match(f.github.fileText("data/catalog/books.json"), /deneme-kitabi/);
});

test("aynı dosyada çakışma: yayın reddedilir, 'geri al' temizler, içerik başkasının güncel haliyle gelir", async () => {
  const f = await createFixture();
  await f.login();
  await f.call("/api/admin/books", "POST", newBook());
  const books = JSON.parse(f.github.fileText("data/catalog/books.json"));
  books[0].title = "Başkası değiştirdi";
  f.github.pushExternal({ "data/catalog/books.json": asJson(books) });
  advance(f, FIVE_MIN);
  const info = (await f.call("/api/admin/publish")).value;
  assert.deepEqual(info.conflicts, ["data/catalog/books.json"]);
  const refused = await f.call("/api/admin/publish", "POST", {});
  assert.equal(refused.status, 409);
  assert.match(refused.value.error, /çakışıyor/);
  assert.equal((await f.call("/api/admin/publish/discard", "POST", {})).status, 200);
  const content = (await f.call("/api/admin/content")).value;
  assert.equal(content.books.some((b) => b.id === "deneme-kitabi"), false);
  assert.equal(content.books[0].title, "Başkası değiştirdi");
  assert.equal((await f.call("/api/admin/publish")).value.pending, false);
});

test("geri al: taslaklar silinir, yedek saklanır; bekleyen yokken 409", async () => {
  const f = await createFixture();
  await f.login();
  assert.equal((await f.call("/api/admin/publish/discard", "POST", {})).status, 409);
  await f.call("/api/admin/books", "POST", newBook());
  assert.equal((await f.call("/api/admin/publish/discard", "POST", {})).status, 200);
  assert.equal((await f.call("/api/admin/books/deneme-kitabi")).status, 404);
  assert.equal([...(await f.storage.list({ prefix: "backup:" })).keys()].length, 1);
});

test("main arada ilerlerse (422) yayın güvenli biçimde durur ve tekrar denenebilir", async () => {
  const f = await createFixture();
  await f.login();
  await f.call("/api/admin/books", "POST", newBook());
  const original = f.github.fetch;
  let injected = false;
  f.github.fetch = async (input, init = {}) => {
    if (!injected && init.method === "PATCH") { injected = true; f.github.pushExternal({ "docs.txt": "araya giren commit" }); }
    return original(input, init);
  };
  await f.call("/api/admin/publish", "POST", {});
  const info = (await f.call("/api/admin/publish")).value;
  assert.equal(info.job.phase, "error");
  assert.match(info.job.message, /başka bir değişiklik/);
  assert.equal(f.github.fileText("data/catalog/books.json").includes("deneme-kitabi"), false, "commit main'e girmedi");
  const retry = await f.call("/api/admin/publish", "POST", {});
  assert.equal(retry.status, 202);
  assert.match(f.github.fileText("data/catalog/books.json"), /deneme-kitabi/);
});

test("çok sayıda görsel alt istek sınırını aşmadan, yoklamayla adım adım yayınlanır", async () => {
  const f = await createFixture({ limit: 20 });
  await f.login();
  const pages = [];
  for (let index = 0; index < 20; index++) {
    const up = (await f.call("/api/admin/upload", "POST", { ...cover(1000 + index, 1400), kind: "preview" })).value;
    pages.push({ local_path: up.local_path, width: up.width, height: up.height });
  }
  await f.call("/api/admin/books", "POST", newBook({ preview_pages: pages }));
  const base = f.github.head();
  await f.call("/api/admin/publish", "POST", {});
  let info = (await f.call("/api/admin/publish")).value;
  for (let guard = 0; guard < 20 && info.job.phase === "working"; guard++) info = (await f.call("/api/admin/publish")).value;
  assert.equal(info.job.phase, "waiting");
  assert.notEqual(f.github.head(), base);
  assert.ok(pages.every((page) => f.github.fileBytes(page.local_path)), "yirmi sayfa görseli de commit'te");
  assert.equal(f.github.log.filter((entry) => entry.method === "PATCH").length, 1, "main yalnız bir kez ilerletildi");
});

test("şifre ve kullanıcı adı değiştirme: eski şifre doğrulanır, yeni bilgiyle girilir", async () => {
  const f = await createFixture();
  await f.login();
  assert.equal((await f.call("/api/admin/password", "POST", { current: "yanlis", next: "yeni-sifre-12345" })).status, 401);
  assert.equal((await f.call("/api/admin/password", "POST", { current: PASSWORD, next: "kisa" })).status, 422);
  assert.equal((await f.call("/api/admin/password", "POST", { current: PASSWORD })).status, 422);
  const done = await f.call("/api/admin/password", "POST", { current: PASSWORD, next: "yeni-sifre-12345", username: "yeniad" });
  assert.equal(done.status, 200);
  assert.equal(done.value.username, "yeniad");
  assert.equal((await f.call("/api/admin/login", "POST", { username: USER, password: PASSWORD }, { anonymous: true })).status, 401);
  assert.equal((await f.call("/api/admin/login", "POST", { username: "yeniad", password: "yeni-sifre-12345" }, { anonymous: true })).status, 200);
});

test("dağıtımda verilen ilk giriş kaydı içeri alınır; resetId değişirse yenisi geçerli olur ve eski oturumlar kapanır", async () => {
  const f = await createFixture();
  await f.login();
  assert.equal((await f.call("/api/admin/session")).value.authenticated, true);
  const reset = await newCredential(USER, "sifirlanan-sifre-99");
  const env = { ...f.env, INITIAL_CREDENTIAL: JSON.stringify(reset) };
  // Aynı depolamayı yeni ortam kaydıyla açan yeni örnek (yeniden dağıtım).
  const panel = createPanel({ storage: f.storage, env, validateBook: await bookValidator(), fetch: f.fetchImpl, now: () => f.time.value });
  const response = await panel.handle(new Request(`https://${HOST}/api/admin/session`, { headers: { cookie: f.cookie } }));
  assert.equal((await response.json()).authenticated, false, "eski oturum kapandı");
  const login = await panel.handle(new Request(`https://${HOST}/api/admin/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: USER, password: "sifirlanan-sifre-99" }) }));
  assert.equal(login.status, 200);
});
