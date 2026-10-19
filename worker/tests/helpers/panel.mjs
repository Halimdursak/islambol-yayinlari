// Worker testleri için ortak düzen: bellek içi Durable Object depolaması, sahte GitHub, gerçek katalog verisi, çerezli istek yardımcıları.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileBookValidator } from "../../../scripts/cms/book-validator.mjs";
import { createPanel } from "../../src/panel.mjs";
import { newCredential } from "../../src/crypto.mjs";
import { createFakeGithub } from "./fake-github.mjs";

export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const USER = "yayinevi";
export const PASSWORD = "deneme-sifresi-1234";
export const HOST = "panel.test";

/** DO depolamasının davranışı: değerler yapısal kopyalanır, list() Map döner. */
export class MemoryStorage {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.has(key) ? structuredClone(this.map.get(key)) : undefined; }
  async put(key, value) { this.map.set(key, structuredClone(value)); }
  async delete(key) { return this.map.delete(key); }
  async list({ prefix = "" } = {}) {
    return new Map([...this.map].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, value]) => [key, structuredClone(value)]));
  }
}

const TRACKED = ["data/catalog/books.json", "data/catalog/authors.json", "data/catalog/kapaklar-opt.json", "data/catalog/og.json", "data/site/site.json", "data/site/vitrin.json", "data/site/campaigns.json"];

/** Gerçek depodaki izlenen içerik dosyaları + sayfalar + birkaç yükleme adı. */
export async function realFiles() {
  const files = {};
  for (const path of TRACKED) files[path] = (await readFile(join(ROOT, path), "utf8")).replace(/\r\n/g, "\n");
  for (const name of await readdir(join(ROOT, "data/site/sayfalar"))) if (name.endsWith(".md")) files[`data/site/sayfalar/${name}`] = (await readFile(join(ROOT, "data/site/sayfalar", name), "utf8")).replace(/\r\n/g, "\n");
  for (const name of await readdir(join(ROOT, "public/uploads"))) files[`public/uploads/${name}`] = "jpeg";   // içerikte adı geçen mevcut yüklemeler yayında vardır
  files["README.md"] = "dokunulmaz";
  return files;
}

let validator;
export async function bookValidator() {
  validator ??= compileBookValidator(JSON.parse(await readFile(join(ROOT, "data/catalog/books.schema.json"), "utf8")));
  return validator;
}

/** 1×1 geçerli PNG (başlık denetimi için). */
export function tinyPng(width = 1, height = 1) {
  const bytes = Buffer.alloc(40);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

export async function createFixture({ files, limit, credential, now: clock, minPassword } = {}) {
  const github = createFakeGithub({ repo: "owner/repo", files: files ?? await realFiles() });
  const storage = new MemoryStorage();
  const time = { value: Date.UTC(2026, 9, 18, 10, 0, 0) };
  const initial = credential ?? await newCredential(USER, PASSWORD);
  const logs = [];   // güvenlik günlüğü: [düzey, metin]
  const log = { log: (text) => logs.push(["log", text]), warn: (text) => logs.push(["warn", text]) };
  const site = new Map();   // yayındaki sitede bulunan dosyalar: yol → bayt
  const siteFetch = async (input) => {
    const bytes = site.get(new URL(String(input)).pathname);
    return bytes ? new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } }) : new Response("yok", { status: 404 });
  };
  const env = { GITHUB_TOKEN: "t", GITHUB_REPO: "owner/repo", INITIAL_CREDENTIAL: JSON.stringify(initial), ALLOWED_HOSTS: HOST, SITE_URL: "https://site.test" };
  const fetchImpl = (input, init) => (String(input).startsWith("https://api.github.com") ? github.fetch(input, init) : siteFetch(input, init));
  const panel = createPanel({ storage, env, validateBook: await bookValidator(), fetch: fetchImpl, now: clock ?? (() => time.value), previewSlugs: [], categories: [{ ad: "Tarih", slug: "tarih" }], ...(limit ? { subrequestLimit: limit } : {}), ...(minPassword ? { minPassword } : {}), log });
  let cookie = "";
  let csrf = "";

  async function call(path, method = "GET", body, { headers = {}, anonymous = false, host = HOST, raw = false, stream = false } = {}) {
    const init = { method, headers: { ...(anonymous ? {} : { cookie, "x-csrf-token": csrf }), ...headers } };
    if (stream) { init.body = body; init.duplex = "half"; init.headers["content-type"] ??= "application/json"; }
    else if (body !== undefined) { init.body = typeof body === "string" ? body : JSON.stringify(body); init.headers["content-type"] ??= "application/json"; }
    const response = await panel.handle(new Request(`https://${host}${path}`, init));
    if (raw) return response;
    const value = response.headers.get("content-type")?.includes("json") ? await response.json() : await response.text();
    return { response, value, status: response.status };
  }
  async function login(remember = false) {
    const result = await call("/api/admin/login", "POST", { username: USER, password: PASSWORD, remember }, { anonymous: true });
    if (result.status !== 200) throw new Error(`giriş başarısız: ${JSON.stringify(result.value)}`);
    cookie = result.response.headers.get("set-cookie").split(";")[0];
    csrf = result.value.csrfToken;
    return result;
  }
  return { panel, github, storage, time, site, logs, call, login, env, fetchImpl, get cookie() { return cookie; }, get csrf() { return csrf; }, setSession(c, t) { cookie = c; csrf = t; } };
}

export const advance = (fixture, ms) => { fixture.time.value += ms; };

export function newBook(overrides = {}) {
  return { title: "Deneme Kitabı", authors: ["Deneme Yazar"], author_display: "Deneme Yazar", categories: ["Tarih"], description: "Kısa bir açıklama.", ...overrides };
}
