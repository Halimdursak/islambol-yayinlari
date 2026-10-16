import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWrite, containedPath, createStore } from "./store.mjs";
import { CmsError } from "./content.mjs";
import { rebuildSite } from "./build.mjs";

const deriveKey = promisify(scrypt);
const SESSION_AGE = 8 * 60 * 60 * 1000;
const MAX_UPLOAD = 8 * 1024 * 1024;
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json" };
const COOKIE = "islambol_cms";
const CSP = "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

async function credentialFor(root, { initialPassword, resetPassword, logger }) {
  const path = containedPath(root, ".local/cms-auth.json");
  if (!resetPassword) {
    try {
      const credential = JSON.parse(await readFile(path, "utf8"));
      if (credential.version !== 1 || !/^[a-f0-9]{32}$/.test(credential.salt) || !/^[a-f0-9]{128}$/.test(credential.hash)) throw new Error("CMS giriş kaydı bozuk; --reset-password ile sıfırlayın.");
      return credential;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const password = initialPassword || randomBytes(18).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  const hash = (await deriveKey(password, salt, 64)).toString("hex");
  const credential = { version: 1, salt, hash };
  await atomicWrite(path, JSON.stringify(credential, null, 2) + "\n");
  logger(`Yönetici şifresi (yalnızca bu kez gösterilir): ${password}`);
  return credential;
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

function uploadImage(body) {
  if (typeof body.filename !== "string" || body.filename.length > 255 || typeof body.data !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data) || body.data.length % 4 !== 0) throw new CmsError(422, "Yüklenen resim bilgileri geçersiz.");
  const bytes = Buffer.from(body.data, "base64");
  if (!bytes.length || bytes.length > MAX_UPLOAD) throw new CmsError(413, "Resim en fazla 8 MB olabilir.");
  let extension;
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR") extension = ".png";
  else if (bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) extension = ".jpg";
  else if (bytes.length >= 20 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" && bytes.readUInt32LE(4) + 8 === bytes.length && ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16))) extension = ".webp";
  if (!extension) throw new CmsError(422, "Yalnızca gerçek PNG, JPEG veya WebP resimleri yüklenebilir.");
  const namedExtension = extname(body.filename).toLowerCase();
  const allowedExtension = extension === ".jpg" ? [".jpg", ".jpeg"] : [extension];
  if (!allowedExtension.includes(namedExtension)) throw new CmsError(422, "Dosya uzantısı resim türüyle eşleşmiyor.");
  if (extension === ".png") {
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (!width || !height || width * height > 40000000) throw new CmsError(422, "Resim boyutları geçersiz veya çok büyük.");
  }
  return { bytes, extension };
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
  const credential = await credentialFor(root, { initialPassword, resetPassword, logger });
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
      const hash = await deriveKey(password, credential.salt, 64);
      if (!timingSafeEqual(hash, Buffer.from(credential.hash, "hex"))) {
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
      const { bytes, extension } = uploadImage(await readJson(request, Math.ceil(MAX_UPLOAD * 4 / 3) + 4096));
      const filename = randomUUID() + extension;
      const local_path = `public/uploads/${filename}`;
      // Ignore user filenames completely; upload paths are immutable random identifiers.
      await atomicWrite(containedPath(root, local_path), bytes);
      sendJson(response, 201, { url: `/uploads/${filename}`, local_path });
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf("--port");
  const port = Number(index >= 0 ? process.argv[index + 1] : process.env.CMS_PORT || 8090);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("CMS portu geçersiz.");
  const app = await createCmsServer({ resetPassword: process.argv.includes("--reset-password") });
  app.server.listen(port, "127.0.0.1", () => console.log(`Yönetim paneli: http://127.0.0.1:${port}/yonetim/`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await app.close(); process.exit(0); });
}
