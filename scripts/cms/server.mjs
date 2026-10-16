import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWrite, containedPath, createStore } from "./store.mjs";
import { CmsError } from "./content.mjs";
import { MAX_UPLOAD, prepareImage } from "./images.mjs";
import { rebuildSite } from "./build.mjs";

const deriveKey = promisify(scrypt);
const SESSION_AGE = 8 * 60 * 60 * 1000;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 512;
const FIRST_PORT = 8090;
const PORT_ATTEMPTS = 20;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json" };
const COOKIE = "islambol_cms";
const CSP = "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const credentialPath = (root) => containedPath(root, ".local/cms-auth.json");

async function saveCredential(root, password) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await deriveKey(password, salt, 64)).toString("hex");
  const credential = { version: 1, salt, hash };
  await atomicWrite(credentialPath(root), JSON.stringify(credential, null, 2) + "\n");
  return credential;
}

async function credentialFor(root, { initialPassword, resetPassword, logger }) {
  if (!resetPassword) {
    try {
      const credential = JSON.parse(await readFile(credentialPath(root), "utf8"));
      if (credential.version !== 1 || !/^[a-f0-9]{32}$/.test(credential.salt) || !/^[a-f0-9]{128}$/.test(credential.hash)) throw new Error("CMS giriş kaydı bozuk; --reset-password ile sıfırlayın.");
      return credential;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const password = initialPassword || randomBytes(18).toString("base64url");
  const credential = await saveCredential(root, password);
  logger(`Yönetici şifresi (yalnızca bu kez gösterilir): ${password}`);
  return credential;
}

async function matchesPassword(credential, password) {
  return timingSafeEqual(await deriveKey(password, credential.salt, 64), Buffer.from(credential.hash, "hex"));
}

async function readJson(request, limit = 256 * 1024) {
  if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) throw new CmsError(415, "İstek application/json biçiminde olmalıdır.");
  if (Number(request.headers["content-length"] ?? 0) > limit) throw new CmsError(413, "İstek boyutu izin verilen sınırı aşıyor.");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new CmsError(413, "İstek boyutu izin verilen sınırı aşıyor.");
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new CmsError(400, "JSON içeriği okunamadı."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CmsError(422, "İstek bir JSON nesnesi olmalıdır.");
  return value;
}

function sendJson(response, status, value, extraHeaders = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extraHeaders });
  response.end(JSON.stringify(value));
}

function checkOrigin(request, allowedHosts) {
  const host = String(request.headers.host ?? "").toLowerCase();
  if (!allowedHosts.has(host)) throw new CmsError(403, "Bu sunucu adresine erişim izni yok.");
  const origin = request.headers.origin;
  if (origin && !new Set([...allowedHosts].map((h) => `http://${h}`)).has(origin)) throw new CmsError(403, "İstek aynı site üzerinden yapılmalıdır.");
  if (["cross-site", "same-site"].includes(request.headers["sec-fetch-site"])) throw new CmsError(403, "İstek aynı site üzerinden yapılmalıdır.");
}

function findSession(request, sessions) {
  const match = String(request.headers.cookie ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
  const token = match ? match.slice(COOKIE.length + 1) : "";
  const now = Date.now();
  for (const [id, session] of sessions) if (session.expires <= now) sessions.delete(id);
  return { token, session: sessions.get(token) ?? null };
}

function requireCsrf(request, session) {
  if (request.headers["x-csrf-token"] !== session.csrfToken) throw new CmsError(403, "Güvenlik oturumu geçersiz; sayfayı yenileyin.");
}

async function staticFile(root, pathname) {
  const upload = pathname.startsWith("/uploads/");
  const base = containedPath(root, upload ? "public/uploads" : "dist");
  const requested = upload ? pathname.slice("/uploads/".length) : pathname.replace(/^\/+/, "") || "index.html";
  let file;
  try {
    file = containedPath(base, requested);
    if ((await stat(file)).isDirectory()) file = containedPath(file, "index.html");
    const [actual, actualBase] = await Promise.all([realpath(file), realpath(base)]);
    const remainder = relative(actualBase, actual);
    if (isAbsolute(remainder) || remainder === ".." || remainder.startsWith(`..${sep}`)) return null;
    return actual;
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(error.code) || error.message === "İşlem yolu proje klasörünün dışında.") return null;
    throw error;
  }
}

/** Creates a local CMS without listening; tests can provide a disposable root and build callback. */
export async function createCmsServer({ root = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), build, logger = console.log, initialPassword, resetPassword = false } = {}) {
  root = resolve(root);
  build ??= () => rebuildSite(root);
  let credential = await credentialFor(root, { initialPassword, resetPassword, logger });
  const store = await createStore(root, build, logger);
  await build();
  const sessions = new Map();
  const attempts = new Map();
  const server = createServer(async (request, response) => {
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-frame-options", "DENY");
    response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
    response.setHeader("content-security-policy", CSP);
    try {
      const port = server.address().port;
      const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      checkOrigin(request, hosts);
      let pathname;
      try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); } catch { throw new CmsError(400, "İstek adresi geçersiz."); }
      if (/[\\\u0000]/.test(pathname)) throw new CmsError(400, "İstek adresi geçersiz.");
      // PageFlip positions public preview pages with runtime styles; the admin keeps the stricter policy.
      if (!pathname.startsWith("/yonetim") && !pathname.startsWith("/api/")) response.setHeader("content-security-policy", CSP.replace("style-src 'self';", "style-src 'self' 'unsafe-inline';"));
      if (pathname.startsWith("/api/")) {
        await api(request, response, pathname);
        return;
      }
      if (!["GET", "HEAD"].includes(request.method)) throw new CmsError(405, "Bu yöntem desteklenmiyor.");
      let file = await staticFile(root, pathname);
      let status = 200;
      if (!file) { file = await staticFile(root, "/404.html"); status = 404; }
      if (!file) { response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); response.end("Sayfa bulunamadı."); return; }
      const data = await readFile(file);
      response.writeHead(status, { "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" });
      response.end(request.method === "HEAD" ? undefined : data);
    } catch (error) {
      if (!(error instanceof CmsError)) logger(`CMS sunucu hatası: ${error.stack ?? error.message}`);
      if (!response.headersSent) sendJson(response, error.status ?? 500, { error: error instanceof CmsError ? error.message : "Sunucu işlemi tamamlanamadı; sunucu kaydını kontrol edin." });
      else response.destroy();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;

  async function api(request, response, pathname) {
    const { token, session } = findSession(request, sessions);
    if (pathname === "/api/admin/session" && request.method === "GET") {
      sendJson(response, 200, { authenticated: Boolean(session), csrfToken: session?.csrfToken ?? null });
      return;
    }
    if (pathname === "/api/admin/login" && request.method === "POST") {
      const address = request.socket.remoteAddress;
      const current = attempts.get(address);
      if (current && current.reset > Date.now() && current.count >= 8) throw new CmsError(429, "Çok fazla hatalı giriş. 15 dakika sonra yeniden deneyin.");
      const { password } = await readJson(request, 2048);
      if (typeof password !== "string" || password.length > 512) throw new CmsError(422, "Şifre geçersiz.");
      if (!(await matchesPassword(credential, password))) {
        attempts.set(address, { count: (current?.reset > Date.now() ? current.count : 0) + 1, reset: current?.reset > Date.now() ? current.reset : Date.now() + 900000 });
        throw new CmsError(401, "Şifre yanlış.");
      }
      attempts.delete(address);
      if (token) sessions.delete(token);
      const sessionToken = randomBytes(32).toString("hex");
      const csrfToken = randomBytes(32).toString("hex");
      sessions.set(sessionToken, { csrfToken, expires: Date.now() + SESSION_AGE });
      sendJson(response, 200, { authenticated: true, csrfToken }, { "set-cookie": `${COOKIE}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_AGE / 1000}` });
      return;
    }
    if (!session) throw new CmsError(401, "Yönetici girişi gereklidir.");
    if (request.method !== "GET") requireCsrf(request, session);
    if (pathname === "/api/admin/logout" && request.method === "POST") {
      sessions.delete(token);
      sendJson(response, 200, { authenticated: false }, { "set-cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
      return;
    }
    if (pathname === "/api/admin/content" && request.method === "GET") { sendJson(response, 200, await store.read()); return; }
    if (pathname === "/api/admin/upload" && request.method === "POST") {
      const { bytes, extension, width, height } = await prepareImage(await readJson(request, Math.ceil(MAX_UPLOAD * 4 / 3) + 4096));
      const filename = randomUUID() + extension;
      const local_path = `public/uploads/${filename}`;
      // Ignore user filenames completely; upload paths are immutable random identifiers.
      await atomicWrite(containedPath(root, local_path), bytes);
      sendJson(response, 201, { url: `/uploads/${filename}`, local_path, width, height });
      return;
    }
    if (pathname === "/api/admin/site" && request.method === "PUT") { sendJson(response, 200, await store.updateSite(await readJson(request))); return; }
    if (pathname === "/api/admin/vitrin" && request.method === "PUT") { sendJson(response, 200, await store.updateVitrin(await readJson(request))); return; }
    const page = pathname.match(/^\/api\/admin\/pages\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if (page && request.method === "PUT") { sendJson(response, 200, await store.updatePage(page[1], await readJson(request))); return; }
    if (pathname === "/api/admin/password" && request.method === "POST") {
      const { current, next } = await readJson(request, 4096);
      if (typeof current !== "string" || typeof next !== "string" || current.length > MAX_PASSWORD || next.length > MAX_PASSWORD) throw new CmsError(422, "Şifre bilgileri geçersiz.");
      const address = request.socket.remoteAddress;
      const failures = attempts.get(address);
      if (failures && failures.reset > Date.now() && failures.count >= 8) throw new CmsError(429, "Çok fazla hatalı deneme. 15 dakika sonra yeniden deneyin.");
      if (!(await matchesPassword(credential, current))) {
        attempts.set(address, { count: (failures?.reset > Date.now() ? failures.count : 0) + 1, reset: failures?.reset > Date.now() ? failures.reset : Date.now() + 900000 });
        throw new CmsError(401, "Şimdiki şifre yanlış.");
      }
      if ([...next].length < MIN_PASSWORD) throw new CmsError(422, `Yeni şifre en az ${MIN_PASSWORD} karakter olmalıdır.`);
      if (next === current) throw new CmsError(422, "Yeni şifre şimdikinden farklı olmalıdır.");
      attempts.delete(address);
      credential = await saveCredential(root, next);
      // Other signed-in browsers must sign in again with the new password.
      for (const id of sessions.keys()) if (id !== token) sessions.delete(id);
      sendJson(response, 200, { ok: true });
      return;
    }
    const match = pathname.match(/^\/api\/admin\/(books|authors|campaigns)(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?$/);
    if (!match) throw new CmsError(404, "Yönetim işlemi bulunamadı.");
    const [, resource, id] = match;
    if (request.method === "GET") {
      const content = await store.read();
      const value = id ? content[resource].find((item) => item[resource === "authors" ? "slug" : "id"] === id) : content[resource];
      if (!value) throw new CmsError(404, "Kayıt bulunamadı.");
      sendJson(response, 200, value);
      return;
    }
    if ((request.method === "POST" && id) || (["PUT", "DELETE"].includes(request.method) && !id) || !["POST", "PUT", "DELETE"].includes(request.method)) throw new CmsError(405, "Bu kayıt için yöntem desteklenmiyor.");
    const body = request.method === "DELETE" ? undefined : await readJson(request);
    sendJson(response, request.method === "POST" ? 201 : 200, await store.mutate(resource, request.method, id, body));
  }

  return {
    server,
    async close() {
      await store.idle();
      if (server.listening) await new Promise((done, reject) => { server.close((error) => error ? reject(error) : done()); server.closeIdleConnections(); });
    },
  };
}

/** İstenen port doluysa sıradakini dener (çift tıkla başlatılan pencere başka bir uygulamayla çakışmasın). Açık --port kesindir. */
function listen(server, port, attempts) {
  return new Promise((done, reject) => {
    const failed = (error) => {
      if (error.code === "EADDRINUSE" && attempts > 1) { server.removeListener("error", failed); listen(server, port + 1, attempts - 1).then(done, reject); } else reject(error);
    };
    server.once("error", failed);
    server.listen(port, "127.0.0.1", () => { server.removeListener("error", failed); done(port); });
  });
}

function openBrowser(url) {
  const command = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(command[0], command[1], { stdio: "ignore", detached: true, windowsHide: true }).on("error", () => {}).unref();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf("--port");
  const explicit = index >= 0 || Boolean(process.env.CMS_PORT);
  const port = Number(index >= 0 ? process.argv[index + 1] : process.env.CMS_PORT || FIRST_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("CMS portu geçersiz.");
  console.log("Yönetim paneli ve site hazırlanıyor; ilk açılış birkaç on saniye sürebilir...");
  const app = await createCmsServer({ resetPassword: process.argv.includes("--reset-password") });
  const actual = await listen(app.server, port, explicit ? 1 : PORT_ATTEMPTS);
  const address = `http://127.0.0.1:${actual}/yonetim/`;
  console.log(`\nYönetim paneli hazır: ${address}\nKapatmak için bu pencereyi kapatın (Ctrl+C).`);
  if (process.argv.includes("--open")) openBrowser(address);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await app.close(); process.exit(0); });
}
