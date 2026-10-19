// Güvenlik incelemesinde (ADR-021) bulunan açıkların tekrar açılmaması için testler.
import assert from "node:assert/strict";
import test from "node:test";
import { uploadRefs } from "../../scripts/cms/publish-core.mjs";
import { limiterKey } from "../src/auth.mjs";
import { createEdge } from "../src/edge.mjs";
import { HOST, PASSWORD, USER, advance, createFixture, newBook } from "./helpers/panel.mjs";

const ipCall = (f, ip, password = "yanlis-sifre") => f.call("/api/admin/login", "POST", { username: USER, password }, { anonymous: true, headers: { "cf-connecting-ip": ip } });

test("limiterKey: IPv6 yazımları aynı /64 bloğuna iner; IPv4 ve IPv4-eşlemeli adresler olduğu gibi kalır", () => {
  assert.equal(limiterKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), limiterKey("2001:0db8:0001:0002::1"));
  assert.equal(limiterKey("2001:db8::1"), "2001:0db8:0000:0000/64");
  assert.notEqual(limiterKey("2001:db8:1:2::1"), limiterKey("2001:db8:1:3::1"));
  assert.equal(limiterKey("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(limiterKey("203.0.113.7"), "203.0.113.7");
  assert.equal(limiterKey("fe80::1%eth0"), "fe80:0000:0000:0000/64");
});

test("hız sınırı: aynı /64 içindeki farklı IPv6 adresleri tek hak havuzunu paylaşır", async () => {
  const f = await createFixture();
  const statuses = [];
  for (let index = 1; index <= 20; index++) statuses.push((await ipCall(f, `2001:db8:aaaa:bbbb::${index.toString(16)}`)).status);
  assert.equal(statuses.filter((s) => s === 401).length, 8);
  assert.equal(statuses.filter((s) => s === 429).length, 12);
});

test("dağıtık saldırı: çok sayıda farklı adres toplam sınırda (100) durdurulur; kilit süre dolunca açılır", async () => {
  const f = await createFixture();
  let wrong = 0;
  for (let index = 0; index < 130; index++) if ((await ipCall(f, `198.51.${Math.floor(index / 250)}.${index % 250}`)).status === 401) wrong += 1;
  assert.equal(wrong, 100, "toplam 100 hatalı denemeden sonra herkes bekletilir");
  assert.equal((await ipCall(f, "203.0.113.9", PASSWORD)).status, 429, "doğru şifre bile toplam kilitte beklemeli");
  advance(f, 16 * 60 * 1000);
  assert.equal((await ipCall(f, "203.0.113.9", PASSWORD)).status, 200);
  const stale = [...(await f.storage.list({ prefix: "r:" })).keys()];
  assert.ok(stale.length <= 3, `eski sayaçlar temizlendi (kalan: ${stale.length})`);
});

test("başarılı giriş adresin sayacını siler ve toplamdan bir hak iade eder", async () => {
  const f = await createFixture();
  for (let index = 0; index < 5; index++) await ipCall(f, "203.0.113.50");
  assert.equal((await ipCall(f, "203.0.113.50", PASSWORD)).status, 200);
  assert.equal((await f.storage.get("r:203.0.113.50")), undefined);
  assert.equal((await f.storage.get("r:*toplam")).count, 5);
});

test("devasa gövde (Content-Length'siz) sınır aşılınca okuma bırakılır: 413 ve akışın tamamı çekilmez", async () => {
  const f = await createFixture();
  let pulled = 0;
  const body = new ReadableStream({ pull(controller) { pulled += 1; controller.enqueue(new Uint8Array(1024).fill(97)); if (pulled >= 5000) controller.close(); } });
  const result = await f.call("/api/admin/login", "POST", body, { anonymous: true, stream: true });
  assert.equal(result.status, 413);
  assert.ok(pulled < 20, `akıştan yalnız ${pulled} parça çekildi`);
});

test("contributors alanı metin ya da boş olmalı; dizi/nesne 422 alır (şablonu çökertmesin)", async () => {
  const f = await createFixture();
  await f.login();
  assert.equal((await f.call("/api/admin/books", "POST", newBook({ contributors: ["a", "b"] }))).status, 422);
  assert.equal((await f.call("/api/admin/books", "POST", newBook({ contributors: { x: 1 } }))).status, 422);
  const ok = await f.call("/api/admin/books", "POST", newBook({ contributors: "Çeviri: Ali Veli" }));
  assert.equal(ok.status, 201);
  assert.equal(ok.value.item.contributors, "Çeviri: Ali Veli");
});

test("uploadRefs: başka sitenin /uploads/ adresi yükleme sayılmaz; kendi yolları sayılır", () => {
  const refs = uploadRefs([
    "Bkz https://baska.example/uploads/foto.jpg ve http://x.org/public/uploads/y.png",
    '{"cover":{"local_path":"public/uploads/a-1.jpg"}} ![](/uploads/b.webp) src="/uploads/c.PNG"',
  ]);
  assert.deepEqual([...refs].sort(), ["public/uploads/a-1.jpg", "public/uploads/b.webp", "public/uploads/c.PNG"]);
});

test("açıklamada başka sitenin /uploads/ adresi olan kitap yine de yayınlanır", async () => {
  const f = await createFixture();
  await f.login();
  await f.call("/api/admin/books", "POST", newBook({ description: "Görsel: https://baska.example/uploads/foto.jpg adresinde." }));
  assert.equal((await f.call("/api/admin/publish", "POST", {})).status, 202);
});

test("güvenlik günlüğü: giriş başarısız/başarılı/engellendi, yayın ve hesap değişimi kaydedilir; şifre ve kullanıcı adı yazılmaz", async () => {
  const f = await createFixture();
  await ipCall(f, "203.0.113.70", "gizli-yanlis-sifre-xyz");
  await f.login();
  await f.call("/api/admin/books", "POST", newBook());
  await f.call("/api/admin/publish", "POST", {});
  await f.call("/api/admin/password", "POST", { current: PASSWORD, next: "yeni-sifre-12345", username: "baskaad" });
  for (let index = 0; index < 9; index++) await ipCall(f, "203.0.113.71");
  const events = f.logs.map(([level, text]) => `${level}:${JSON.parse(text).olay}`);
  for (const expected of ["warn:giris-basarisiz", "log:giris-basarili", "log:yayin-basladi", "warn:hesap-bilgisi-degisti", "warn:giris-engellendi"]) assert.ok(events.includes(expected), `${expected} yok: ${events.join(", ")}`);
  const all = f.logs.map(([, text]) => text).join("\n");
  for (const secret of ["gizli-yanlis-sifre-xyz", PASSWORD, "yeni-sifre-12345", "baskaad", "yayinevi"]) assert.ok(!all.includes(secret), `günlükte sır var: ${secret}`);
});

test("bulut paneli yeni şifrede en az 12 karakter ister ve bunu oturum bilgisinde bildirir", async () => {
  const f = await createFixture({ minPassword: 12 });
  const session = await f.login();
  assert.equal((await f.call("/api/admin/session")).value.minPassword, 12);
  assert.equal(session.value.minPassword, 12);
  const short = await f.call("/api/admin/password", "POST", { current: PASSWORD, next: "onbir-harfli" .slice(0, 11) });
  assert.equal(short.status, 422);
  assert.match(short.value.error, /en az 12/);
  assert.equal((await f.call("/api/admin/password", "POST", { current: PASSWORD, next: "on-iki-harfli-sifre" })).status, 200);
});

test("görsel vekilleri: yalnız resim uzantıları, içerik türü sabit (üst sunucunun başlığına güvenilmez)", async () => {
  const requested = [];
  const edge = createEdge({
    assets: {}, version: "v", siteUrl: "https://site.test",
    fetch: async (url) => { requested.push(String(url)); return new Response("<script>alert(1)</script>", { status: 200, headers: { "content-type": "text/html" } }); },
  });
  const env = { PANEL: { idFromName: () => "p", get: () => ({ fetch: async () => new Response("do") }) } };
  const html = await edge(new Request(`https://${HOST}/kapaklar/oyun.html`), env);
  assert.equal(html.status, 404);
  assert.equal((await edge(new Request(`https://${HOST}/logo/x.svg`), env)).status, 404);
  assert.equal(requested.length, 0, "izinsiz uzantı siteye hiç sorulmaz");
  const image = await edge(new Request(`https://${HOST}/kapaklar/a.png`), env);
  assert.equal(image.headers.get("content-type"), "image/png", "üst sunucu text/html dese de resim türü sabit");

  const f = await createFixture();
  await f.login();
  f.site.set("/uploads/yayinda.png", Buffer.from("x"));
  const proxied = await f.call("/uploads/yayinda.png", "GET", undefined, { raw: true });
  assert.equal(proxied.headers.get("content-type"), "image/png");
  assert.equal((await f.call("/uploads/oyun.html", "GET", undefined, { raw: true })).status, 404, "resim olmayan uzantı API'ye de düşmez");
});
