import assert from "node:assert/strict";
import test from "node:test";
import { createEdge } from "../src/edge.mjs";

const assets = {
  "/yonetim/": { type: "text/html; charset=utf-8", text: "<!doctype html><title>Yönetim</title>" },
  "/assets/fonts/x.woff2": { type: "font/woff2", base64: Buffer.from([1, 2, 3, 4]).toString("base64") },
};
const forwarded = [];
const env = { PANEL: { idFromName: (name) => name, get: (id) => ({ fetch: async (request) => { forwarded.push([id, new URL(request.url).pathname]); return new Response("do", { status: 200 }); } }) } };
const siteCalls = [];
const edge = createEdge({
  assets, version: "v1", siteUrl: "https://site.test",
  fetch: async (url) => { siteCalls.push(String(url)); return String(url).endsWith("/kapaklar/var.jpg") ? new Response("img", { status: 200, headers: { "content-type": "image/jpeg" } }) : new Response("yok", { status: 404 }); },
});
const get = (path, init = {}) => edge(new Request(`https://panel.test${path}`, init), env);

test("kök adres yönetim sayfasına yönlenir; /yonetim sonuna eğik çizgi alır", async () => {
  const root = await get("/");
  assert.equal(root.status, 302);
  assert.equal(root.headers.get("location"), "https://panel.test/yonetim/");
  assert.equal((await get("/yonetim")).status, 301);
});

test("gömülü dosyalar doğru tür, güvenlik başlıkları ve ETag ile sunulur; ETag eşleşince 304", async () => {
  const page = await get("/yonetim/");
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("content-type"), "text/html; charset=utf-8");
  assert.match(page.headers.get("content-security-policy"), /script-src 'self'/);
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal(page.headers.get("etag"), 'W/"v1"');
  assert.match(await page.text(), /Yönetim/);
  assert.equal((await get("/yonetim/", { headers: { "if-none-match": 'W/"v1"' } })).status, 304);
  const font = await get("/assets/fonts/x.woff2");
  assert.deepEqual([...new Uint8Array(await font.arrayBuffer())], [1, 2, 3, 4]);
});

test("API ve yükleme istekleri Durable Object'e iletilir; yazma yöntemi gömülü dosyaya uygulanmaz", async () => {
  forwarded.length = 0;
  assert.equal((await get("/api/admin/session")).status, 200);
  assert.equal((await get("/uploads/abc.jpg")).status, 200);
  assert.deepEqual(forwarded, [["panel", "/api/admin/session"], ["panel", "/uploads/abc.jpg"]]);
  assert.equal((await get("/yonetim/", { method: "POST", body: "x" })).status, 404);
});

test("site görselleri yayındaki siteden getirilir; yalnız izinli klasörler, bulunamazsa 404", async () => {
  const ok = await get("/kapaklar/var.jpg");
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/jpeg");
  assert.equal((await get("/kapaklar/yok.jpg")).status, 404);
  siteCalls.length = 0;
  assert.equal((await get("/baska/dosya.jpg")).status, 404);
  assert.equal((await get("/kapaklar/../gizli")).status, 404);
  assert.equal(siteCalls.length, 0, "izinsiz yollar siteye sorulmaz");
});
