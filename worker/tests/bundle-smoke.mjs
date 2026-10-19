// Paketlenmiş Worker'ın gerçek koşullara yakın duman testi. `node --disallow-code-generation-from-strings` ile çalıştırılır:
// Cloudflare Workers gibi eval / new Function'ı yasaklar. Kitap doğrulayıcısı derleme zamanında üretildiği için çalışmalıdır.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createFakeGithub } from "./helpers/fake-github.mjs";
import { MemoryStorage, PASSWORD, USER, realFiles } from "./helpers/panel.mjs";
import { newCredential } from "../src/crypto.mjs";
import { ROOT } from "./helpers/panel.mjs";

assert.throws(() => new Function("return 1"), /code generation|EvalError/i, "kod üretimi gerçekten kapalı olmalı");

const github = createFakeGithub({ repo: "owner/repo", files: await realFiles() });
globalThis.fetch = (input, init) => (String(input).startsWith("https://api.github.com") ? github.fetch(input, init) : Promise.resolve(new Response("yok", { status: 404 })));

const worker = await import(pathToFileURL(`${ROOT}worker/dist/worker.mjs`).href);
const storage = new MemoryStorage();
const env = { GITHUB_TOKEN: "t", GITHUB_REPO: "owner/repo", ALLOWED_HOSTS: "panel.test", SITE_URL: "https://site.test", INITIAL_CREDENTIAL: JSON.stringify(await newCredential(USER, PASSWORD)) };
const panel = new worker.Panel({ storage }, env);
env.PANEL = { idFromName: () => "panel", get: () => panel };

const call = async (path, init = {}) => worker.default.fetch(new Request(`https://panel.test${path}`, init), env);
const page = await call("/yonetim/");
assert.equal(page.status, 200);
assert.match(await page.text(), /Yönetim/);
assert.equal((await call("/assets/js/admin.js")).status, 200);
assert.equal((await call("/yonetim-lib/pdfjs/pdf.min.js")).status, 200);

const login = await call("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: USER, password: PASSWORD }) });
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
const { csrfToken } = await login.json();
const headers = { cookie, "x-csrf-token": csrfToken, "content-type": "application/json" };

const created = await call("/api/admin/books", { method: "POST", headers, body: JSON.stringify({ title: "Paket Testi", authors: ["Test Yazar"], author_display: "Test Yazar", categories: ["Tarih"], description: "x" }) });
assert.equal(created.status, 201, await created.clone().text());
const invalid = await call("/api/admin/books", { method: "POST", headers, body: JSON.stringify({ title: "Kötü", authors: ["A"], isbn: "isbn-degil" }) });
assert.equal(invalid.status, 422, "paketlenmiş doğrulayıcı geçersiz kitabı reddeder");
console.log("paket duman testi geçti");
