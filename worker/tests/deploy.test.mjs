import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pbkdf2Hex } from "../src/crypto.mjs";
import { WORKER_NAME, buildForm, buildMetadata, createCloudflare, deployWorker, generatePassword, resolveCredential } from "../scripts/deploy.mjs";

test("şifre üretimi: xxxx-xxxx-xxxx biçimi, belirsiz harf yok, her seferinde farklı", () => {
  const seen = new Set(Array.from({ length: 50 }, generatePassword));
  assert.equal(seen.size, 50);
  for (const password of seen) assert.match(password, /^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
});

test("giriş kaydı: şifre yalnız ilk üretimde döner, sonra aynı kayıt kullanılır; sıfırlama yeni resetId verir; karma Worker ile uyumludur", async () => {
  const root = await mkdtemp(join(tmpdir(), "panel-giris-"));
  try {
    const first = await resolveCredential(root);
    assert.match(first.password, /^\w{4}-\w{4}-\w{4}$/);
    await assert.rejects(() => readFile(join(root, ".local/panel-giris.json"), "utf8"), { code: "ENOENT" }, "yükleme başarılı olmadan kayıt yazılmaz");
    await first.save();
    assert.equal(first.credential.hash, await pbkdf2Hex(first.password, first.credential.salt, first.credential.iterations));
    const again = await resolveCredential(root);
    assert.equal(again.password, null);
    assert.deepEqual(again.credential, first.credential);
    const reset = await resolveCredential(root, { reset: true });
    assert.notEqual(reset.credential.resetId, first.credential.resetId);
    const fixed = await resolveCredential(root, { password: "elle-verilen-sifre", username: "baska" });
    await fixed.save();
    assert.equal(fixed.credential.username, "baska");
    assert.equal(JSON.parse(await readFile(join(root, ".local/panel-giris.json"), "utf8")).resetId, fixed.credential.resetId);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("yükleme üst verisi: SQLite DO sınıfı, gizliler gizli bağlama olarak, yalnız panel alan adı izinli", () => {
  const metadata = buildMetadata({ githubToken: "ghp_x", credential: { username: "u", salt: "s", hash: "h", resetId: "r" } });
  assert.equal(metadata.main_module, "worker.mjs");
  assert.deepEqual(metadata.exports, { Panel: { type: "durable-object", storage: "sqlite" } });
  assert.equal(metadata.migrations, undefined);
  const byName = Object.fromEntries(metadata.bindings.map((b) => [b.name, b]));
  assert.equal(byName.PANEL.type, "durable_object_namespace");
  assert.equal(byName.PANEL.class_name, "Panel");
  assert.equal(byName.GITHUB_TOKEN.type, "secret_text");
  assert.equal(byName.INITIAL_CREDENTIAL.type, "secret_text");
  assert.equal(byName.ALLOWED_HOSTS.text, "panel.islambol.org");
  const legacy = buildMetadata({ githubToken: "x", credential: {}, legacyMigration: true });
  assert.deepEqual(legacy.migrations, { new_tag: "v1", new_sqlite_classes: ["Panel"] });
  assert.equal(legacy.exports, undefined);
});

test("dağıtım sırası: betik yükle → workers.dev kapat → özel alan adı bağla; modül parçası doğru türde", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    const path = new URL(url).pathname.replace("/client/v4", "");
    calls.push({ method: init.method, path, headers: init.headers, body: init.body });
    return new Response(JSON.stringify({ success: true, result: { startup_time_ms: 5, id: "x" } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const cf = createCloudflare({ token: "cf-token", fetch: fakeFetch });
  await deployWorker({ cf, accountId: "acc1", zoneId: "zone1", code: "export default {};", githubToken: "gh", credential: { username: "u" } });
  assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), [
    `PUT /accounts/acc1/workers/scripts/${WORKER_NAME}`,
    `POST /accounts/acc1/workers/scripts/${WORKER_NAME}/subdomain`,
    "PUT /accounts/acc1/workers/domains",
  ]);
  assert.equal(calls[0].headers.authorization, "Bearer cf-token");
  const form = calls[0].body;
  assert.ok(form instanceof FormData);
  assert.equal(JSON.parse(form.get("metadata")).main_module, "worker.mjs");
  assert.equal(form.get("worker.mjs").type, "application/javascript+module");
  assert.deepEqual(JSON.parse(calls[1].body), { enabled: false, previews_enabled: false });
  assert.deepEqual(JSON.parse(calls[2].body), { hostname: "panel.islambol.org", service: WORKER_NAME, zone_id: "zone1", zone_name: "islambol.org", enabled: true });
});

test("exports yolu reddedilirse eski migrations yolu denenir; Cloudflare hatası okunur kalır", async () => {
  const seen = [];
  const fakeFetch = async (url, init) => {
    const path = new URL(url).pathname;
    if (init.method === "PUT" && path.endsWith(`/scripts/${WORKER_NAME}`)) {
      const metadata = JSON.parse(init.body.get("metadata"));
      seen.push(metadata.exports ? "exports" : "migrations");
      if (metadata.exports) return new Response(JSON.stringify({ success: false, errors: [{ code: 10021, message: "exports desteklenmiyor" }] }), { status: 400 });
    }
    return new Response(JSON.stringify({ success: true, result: {} }), { status: 200 });
  };
  const cf = createCloudflare({ token: "t", fetch: fakeFetch });
  await deployWorker({ cf, accountId: "a", zoneId: "z", code: "x", githubToken: "g", credential: {} });
  assert.deepEqual(seen, ["exports", "migrations"]);
  const failing = createCloudflare({ token: "t", fetch: async () => new Response(JSON.stringify({ success: false, errors: [{ code: 10000, message: "Authentication error" }] }), { status: 403 }) });
  await assert.rejects(() => failing("/accounts"), /\[10000\] Authentication error/);
});

test("buildForm tek bir modül dosyası ve üst veri içerir", () => {
  const form = buildForm({ main_module: "worker.mjs" }, "export default {}");
  assert.deepEqual([...form.keys()].sort(), ["metadata", "worker.mjs"]);
});

test("Workers hesapta açılmamışsa (10063) eski yola düşülmez, kullanıcıya ne yapacağı söylenir", async () => {
  let puts = 0;
  const fakeFetch = async (url, init) => { if (init.method === "PUT") puts += 1; return new Response(JSON.stringify({ success: false, errors: [{ code: 10063, message: "You need a workers.dev subdomain" }] }), { status: 403 }); };
  const cf = createCloudflare({ token: "t", fetch: fakeFetch });
  await assert.rejects(() => deployWorker({ cf, accountId: "a", zoneId: "z", code: "x", githubToken: "g", credential: {} }), /Workers & Pages/);
  assert.equal(puts, 1, "aynı hata için ikinci yol denenmez");
});
