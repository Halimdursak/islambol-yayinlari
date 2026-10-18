import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DEFAULT_USERNAME, REMEMBER_AGE, SESSION_AGE, checkUsername, createSessionStore, credentialFor, matchesCredential, saveCredential } from "../../scripts/cms/auth.mjs";

async function root(t) {
  const dir = await mkdtemp(join(tmpdir(), "islambol-auth-"));
  await mkdir(join(dir, ".local"), { recursive: true });
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("kullanıcı adı kuralları: 3–32 karakter, harf/rakam/nokta/tire/alt çizgi", () => {
  assert.equal(checkUsername("  yayinevi "), "yayinevi");
  assert.equal(checkUsername("Halim.D-1_x"), "Halim.D-1_x");
  assert.equal(checkUsername("şükrü"), "şükrü");
  for (const bad of ["", "ab", "a".repeat(33), "boş luk", "kötü<tag>", "a/b", null, undefined]) assert.throws(() => checkUsername(bad), (e) => e.status === 422, String(bad));
});

test("giriş bilgisi: kullanıcı adı ve şifre birlikte doğrulanır; kullanıcı adı büyük/küçük harf duyarsız", async (t) => {
  const dir = await root(t);
  const credential = await saveCredential(dir, "uzun-bir-sifre-123", "Yayinevi");
  assert.equal(credential.version, 2);
  assert.equal(await matchesCredential(credential, "yayinevi", "uzun-bir-sifre-123"), true);
  assert.equal(await matchesCredential(credential, "YAYINEVI", "uzun-bir-sifre-123"), true);
  assert.equal(await matchesCredential(credential, "baska", "uzun-bir-sifre-123"), false);
  assert.equal(await matchesCredential(credential, "yayinevi", "yanlis-sifre-123"), false);
  assert.equal((await readFile(join(dir, ".local/cms-auth.json"), "utf8")).includes("uzun-bir-sifre-123"), false, "şifre düz metin saklanmaz");
});

test("eski (yalnız şifreli, sürüm 1) giriş kaydı varsayılan kullanıcı adıyla çalışmaya devam eder", async (t) => {
  const dir = await root(t);
  const fresh = await saveCredential(dir, "eski-sifre-12345", "gecici");
  await writeFile(join(dir, ".local/cms-auth.json"), JSON.stringify({ version: 1, salt: fresh.salt, hash: fresh.hash }));
  const credential = await credentialFor(dir, { logger: () => {} });
  assert.equal(credential.username, DEFAULT_USERNAME);
  assert.equal(await matchesCredential(credential, DEFAULT_USERNAME, "eski-sifre-12345"), true);
});

test("yeni kayıt üretilirken kullanıcı adı ve şifre günlüğe bir kez yazılır", async (t) => {
  const dir = await root(t);
  const lines = [];
  const credential = await credentialFor(dir, { initialUsername: "kutuphane", logger: (m) => lines.push(m) });
  assert.equal(credential.username, "kutuphane");
  assert.match(lines.join("\n"), /Kullanıcı adı: kutuphane/);
  assert.match(lines.join("\n"), /Şifre:\s+\S{10,}/);
});

test("oturumlar diske karma olarak yazılır ve yeniden başlatınca (beni hatırla) sürer; süresi dolan atılır", async (t) => {
  const dir = await root(t);
  let clock = 1_000_000;
  const now = () => clock;
  const store = await createSessionStore(dir, now);
  const short = await store.create(false);
  const long = await store.create(true);
  assert.equal(short.maxAge, SESSION_AGE);
  assert.equal(long.maxAge, REMEMBER_AGE);
  const disk = await readFile(join(dir, ".local/cms-sessions.json"), "utf8");
  assert.equal(disk.includes(short.token) || disk.includes(long.token), false, "jeton düz metin saklanmaz");

  clock += SESSION_AGE + 1000;                    // 12 saat sonra: kısa oturum bitti, uzun sürüyor
  const restarted = await createSessionStore(dir, now);
  assert.equal(restarted.find(short.token), null);
  assert.equal(restarted.find(long.token)?.csrfToken, long.csrfToken);
  assert.equal(restarted.find("uydurma"), null);

  const keeper = await restarted.create(false);    // sunucu yeniden başladıktan sonra yeni bir oturum
  await restarted.removeOthers(keeper.token);       // yalnız bu oturum kalır, öbürleri kapanır
  assert.equal(restarted.find(long.token), null, "diğer oturum kapandı");
  assert.equal(restarted.find(keeper.token)?.csrfToken, keeper.csrfToken, "tutulan oturum sürüyor");
  clock += REMEMBER_AGE;
  assert.equal((await createSessionStore(dir, now)).find(long.token), null);
});

test("bozuk oturum dosyası paneli açılışta çökertmez", async (t) => {
  const dir = await root(t);
  await writeFile(join(dir, ".local/cms-sessions.json"), "{bozuk");
  const store = await createSessionStore(dir);
  assert.equal(store.find("x"), null);
  assert.ok((await store.create()).token);
});
