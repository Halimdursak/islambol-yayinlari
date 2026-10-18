import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWrite, containedPath, createStore } from "./store.mjs";
import { CmsError } from "./content.mjs";
import { MAX_UPLOAD, prepareImage, toWebp } from "./images.mjs";
import { rebuildSite } from "./build.mjs";
import { MAX_PASSWORD, MIN_PASSWORD, checkUsername, createSessionStore, credentialFor, matchesCredential, matchesPassword, saveCredential } from "./auth.mjs";
import { createPublisher } from "./publish.mjs";

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), "vendor");
const VENDOR_FILES = { "/yonetim-lib/pdfjs/pdf.min.js": "pdfjs/pdf.min.js", "/yonetim-lib/pdfjs/pdf.worker.min.js": "pdfjs/pdf.worker.min.js" };
const FIRST_PORT = 8090;
const PORT_ATTEMPTS = 20;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json" };
const COOKIE = "islambol_cms";
const CSP = "default-src 'self'; img-src 'self' data: https:; script-src 'self'; worker-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

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

function cookieToken(request) {
  const match = String(request.headers.cookie ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
  return match ? match.slice(COOKIE.length + 1) : "";
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
export async function createCmsServer({ root = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), build, logger = console.log, initialPassword, initialUsername, resetPassword = false, publisher } = {}) {
  root = resolve(root);
  build ??= () => rebuildSite(root);
  let credential = await credentialFor(root, { initialPassword, initialUsername, resetPassword, logger });
  const store = await createStore(root, build, logger);
  publisher ??= createPublisher({ root, logger, exclusive: (task) => store.exclusive(task) });
  await build();
  const sessions = await createSessionStore(root);
  if (resetPassword) await sessions.removeOthers("");   // eski şifreyle açılmış (30 günlük "beni hatırla" dahil) tüm oturumlar kapanır
  const attempts = new Map();
  /** Hatalı deneme sınırı: sayaç eşzamanlı artırılır; her istek başarılı olsa da önce bir hak harcar, başarıyla biterse iade edilir. */
  const takeAttempt = (address) => {
    const now = Date.now();
    const slot = attempts.get(address);
    const live = slot && slot.reset > now ? slot : { count: 0, reset: now + 900000 };
    if (live.count >= 8) throw new CmsError(429, "Çok fazla hatalı deneme. 15 dakika sonra yeniden deneyin.");
    live.count += 1;
    attempts.set(address, live);
  };
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
      if (Object.hasOwn(VENDOR_FILES, pathname)) {
        const data = await readFile(join(VENDOR, VENDOR_FILES[pathname]));
        response.writeHead(200, { "content-type": MIME[".js"], "cache-control": "no-store" });
        response.end(request.method === "HEAD" ? undefined : data);
        return;
      }
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
    const token = cookieToken(request);
    const session = sessions.find(token);
    if (pathname === "/api/admin/session" && request.method === "GET") {
      sendJson(response, 200, { authenticated: Boolean(session), csrfToken: session?.csrfToken ?? null, username: session ? credential.username : null });
      return;
    }
    if (pathname === "/api/admin/login" && request.method === "POST") {
      const address = request.socket.remoteAddress;
      takeAttempt(address);
      const { username, password, remember } = await readJson(request, 2048);
      if (typeof password !== "string" || password.length > MAX_PASSWORD || typeof username !== "string" || username.length > 100) throw new CmsError(422, "Kullanıcı adı veya şifre geçersiz.");
      if (!(await matchesCredential(credential, username, password))) throw new CmsError(401, "Kullanıcı adı veya şifre yanlış.");
      attempts.delete(address);
      if (token) await sessions.remove(token);
      const created = await sessions.create(remember === true);
      sendJson(response, 200, { authenticated: true, csrfToken: created.csrfToken, username: credential.username }, { "set-cookie": `${COOKIE}=${created.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(created.maxAge / 1000)}` });
      return;
    }
    if (!session) throw new CmsError(401, "Yönetici girişi gereklidir.");
    if (request.method !== "GET") requireCsrf(request, session);
    if (pathname === "/api/admin/logout" && request.method === "POST") {
      await sessions.remove(token);
      sendJson(response, 200, { authenticated: false }, { "set-cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
      return;
    }
    if (pathname === "/api/admin/content" && request.method === "GET") { sendJson(response, 200, await store.read()); return; }
    if (pathname === "/api/admin/upload" && request.method === "POST") {
      const body = await readJson(request, Math.ceil(MAX_UPLOAD * 4 / 3) + 4096);
      const { bytes, extension, width, height } = await prepareImage(body);
      const id = randomUUID();
      const filename = id + extension;
      const local_path = `public/uploads/${filename}`;
      // Ignore user filenames completely; upload paths are immutable random identifiers.
      await atomicWrite(containedPath(root, local_path), bytes);
      const result = { url: `/uploads/${filename}`, local_path, width, height };
      if (body.kind === "back" && extension === ".webp") result.webp_path = local_path;
      else if (body.kind === "back") {
        const webp = await toWebp(bytes);
        if (webp) { await atomicWrite(containedPath(root, `public/uploads/${id}.webp`), webp); result.webp_path = `public/uploads/${id}.webp`; }
      }
      sendJson(response, 201, result);
      return;
    }
    if (pathname === "/api/admin/site" && request.method === "PUT") { sendJson(response, 200, await store.updateSite(await readJson(request))); return; }
    if (pathname === "/api/admin/vitrin" && request.method === "PUT") { sendJson(response, 200, await store.updateVitrin(await readJson(request))); return; }
    const page = pathname.match(/^\/api\/admin\/pages\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if (page && request.method === "PUT") { sendJson(response, 200, await store.updatePage(page[1], await readJson(request))); return; }
    if (pathname === "/api/admin/password" && request.method === "POST") {
      const { current, next, username } = await readJson(request, 4096);
      if (typeof current !== "string" || current.length > MAX_PASSWORD) throw new CmsError(422, "Şifre bilgileri geçersiz.");
      const wantsPassword = typeof next === "string" && next.length > 0;
      if (next !== undefined && next !== null && next !== "" && (typeof next !== "string" || next.length > MAX_PASSWORD)) throw new CmsError(422, "Şifre bilgileri geçersiz.");
      const newName = username === undefined || username === null || username === "" ? credential.username : checkUsername(username);
      if (!wantsPassword && newName === credential.username) throw new CmsError(422, "Değiştirilecek bir bilgi girilmedi.");
      const address = request.socket.remoteAddress;
      takeAttempt(address);
      if (!(await matchesPassword(credential, current))) throw new CmsError(401, "Şimdiki şifre yanlış.");
      if (wantsPassword) {
        if ([...next].length < MIN_PASSWORD) throw new CmsError(422, `Yeni şifre en az ${MIN_PASSWORD} karakter olmalıdır.`);
        if (next === current) throw new CmsError(422, "Yeni şifre şimdikinden farklı olmalıdır.");
      }
      attempts.delete(address);
      credential = await saveCredential(root, wantsPassword ? next : current, newName);
      // Diğer açık tarayıcılar yeni bilgilerle yeniden giriş yapar.
      await sessions.removeOthers(token);
      sendJson(response, 200, { ok: true, username: credential.username });
      return;
    }
    if (pathname === "/api/admin/publish" && request.method === "GET") { sendJson(response, 200, await publisher.changes()); return; }
    if (pathname === "/api/admin/publish" && request.method === "POST") {
      const body = await readJson(request, 1024);
      const started = await publisher.start({ confirmForeign: body.confirmForeign === true, confirmHead: typeof body.confirmHead === "string" ? body.confirmHead : undefined });
      const status = started.started ? 202 : started.needsConfirm ? 200 : 409;
      sendJson(response, status, { ...started, ...(status === 409 ? { error: started.reason } : {}), ...(await publisher.changes()) });
      return;
    }
    if (pathname === "/api/admin/publish/discard" && request.method === "POST") {
      try { await store.exclusive(async () => { await publisher.discard(); await build(); }); }
      catch (error) { throw new CmsError(error.friendly ? 409 : 500, error.friendly ?? "Değişiklikler geri alınamadı."); }
      sendJson(response, 200, { ok: true, ...(await store.read()), ...(await publisher.changes()) });
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
  const nameIndex = process.argv.indexOf("--username");
  const app = await createCmsServer({ resetPassword: process.argv.includes("--reset-password"), initialUsername: nameIndex >= 0 ? process.argv[nameIndex + 1] : undefined });
  const actual = await listen(app.server, port, explicit ? 1 : PORT_ATTEMPTS);
  const address = `http://127.0.0.1:${actual}/yonetim/`;
  console.log(`\nYönetim paneli hazır: ${address}\nKapatmak için bu pencereyi kapatın (Ctrl+C).`);
  if (process.argv.includes("--open")) openBrowser(address);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await app.close(); process.exit(0); });
}
