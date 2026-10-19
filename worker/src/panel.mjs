// Cloudflare yönetim paneli API'si: yerel sunucunun (scripts/cms/server.mjs) uç noktalarının aynısı, ama GitHub üzerinde çalışır.
// Durable Object içinde çalıştırılır; tüm durum `storage` üzerindedir. Test edilebilsin diye Cloudflare'e bağımlı değildir.
import { CmsError, createValidators } from "../../scripts/cms/content.mjs";
import { checkUsername } from "../../scripts/cms/auth-rules.mjs";
import { createAuth, MAX_PASSWORD, MIN_PASSWORD } from "./auth.mjs";
import { createContentStore } from "./content-store.mjs";
import { createGithub } from "./github.mjs";
import { createLock } from "./lock.mjs";
import { createPublisher } from "./publisher.mjs";
import { CONTENT_TYPES, MAX_UPLOAD_BYTES, UPLOAD_JSON_LIMIT, prepareUpload } from "./upload.mjs";

const COOKIE = "__Host-islambol_cms";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

const json = (status, value, headers = {}) => new Response(JSON.stringify(value), { status, headers: { ...JSON_HEADERS, ...headers } });

/** Gövdeyi parça parça okur ve sınırı aşar aşmaz bırakır (Content-Length'siz dev gövde belleği doldurmasın). */
async function readBody(request, limit) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel().catch(() => {}); throw new CmsError(413, "İstek boyutu izin verilen sınırı aşıyor."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function readJson(request, limit = 256 * 1024) {
  if (!String(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) throw new CmsError(415, "İstek application/json biçiminde olmalıdır.");
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new CmsError(413, "İstek boyutu izin verilen sınırı aşıyor.");
  const text = await readBody(request, limit);
  let value;
  try { value = JSON.parse(text); } catch { throw new CmsError(400, "JSON içeriği okunamadı."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CmsError(422, "İstek bir JSON nesnesi olmalıdır.");
  return value;
}

function cookieToken(request) {
  const match = String(request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
  return match ? match.slice(COOKIE.length + 1) : "";
}

const sessionCookie = (token, maxAgeSeconds) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;

/**
 * @param {object} options
 * @param {object} options.storage Durable Object depolaması (get/put/delete/list)
 * @param {object} options.env { GITHUB_TOKEN, GITHUB_REPO, INITIAL_CREDENTIAL, ALLOWED_HOSTS, SITE_URL }
 * @param {Function} options.validateBook derlenmiş kitap doğrulayıcısı
 */
export function createPanel({ storage, env, validateBook, fetch: fetchImpl = globalThis.fetch, now = Date.now, previewSlugs = [], categories = [], apiBase, subrequestLimit, minPassword = MIN_PASSWORD, log = console }) {
  const github = createGithub({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, fetch: fetchImpl, ...(apiBase ? { apiBase } : {}), ...(subrequestLimit ? { limit: subrequestLimit } : {}) });
  const siteUrl = env.SITE_URL || "https://islambol.org";
  const allowedHosts = new Set(String(env.ALLOWED_HOSTS || "panel.islambol.org").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));
  const auth = createAuth({ storage, initialCredential: env.INITIAL_CREDENTIAL, now });
  const store = createContentStore({ storage, github, validators: createValidators(validateBook), previewSlugs, categories, now });
  const publisher = createPublisher({ storage, github, store, siteUrl, now });
  const exclusive = createLock();
  /** Güvenlik olayları günlüğe yazılır (Workers Logs). Şifre, kullanıcı adı ya da jeton asla yazılmaz. */
  const audit = (level, event, address) => log[level](JSON.stringify({ olay: event, ip: address }));

  function checkOrigin(req, url) {
    if (!allowedHosts.has(url.host.toLowerCase())) throw new CmsError(403, "Bu adrese erişim izni yok.");
    const origin = req.headers.get("origin");
    if (origin && origin !== `${url.protocol}//${url.host}`) throw new CmsError(403, "İstek aynı site üzerinden yapılmalıdır.");
    const site = req.headers.get("sec-fetch-site");
    if (site && !["same-origin", "none"].includes(site)) throw new CmsError(403, "İstek aynı site üzerinden yapılmalıdır.");
  }

  async function serveUpload(req, name, session) {
    const record = await store.getUpload(name);
    if (record && session) {
      return new Response(req.method === "HEAD" ? null : record.data, { status: 200, headers: { "content-type": CONTENT_TYPES[name.slice(name.lastIndexOf(".")).toLowerCase()] ?? "application/octet-stream", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
    }
    // Yayınlanmış yükleme: herkese açık sitedeki kopyadan. İçerik türü uzantıdan gelir (üst sunucunun başlığına güvenilmez).
    const origin = await fetchImpl(`${siteUrl}/uploads/${name}`);
    if (!origin.ok) throw new CmsError(404, "Görsel bulunamadı.");
    return new Response(req.method === "HEAD" ? null : origin.body, { status: 200, headers: { "content-type": CONTENT_TYPES[name.slice(name.lastIndexOf(".")).toLowerCase()], "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
  }

  async function api(req, pathname, token, session, address) {
    if (pathname === "/api/admin/session" && req.method === "GET") {
      const credential = session ? await auth.credential() : null;
      return json(200, { authenticated: Boolean(session), csrfToken: session?.csrfToken ?? null, username: credential?.username ?? null, mode: "cloud", maxUploadBytes: MAX_UPLOAD_BYTES, minPassword });
    }
    if (pathname === "/api/admin/login" && req.method === "POST") {
      try { await auth.takeAttempt(address); } catch (error) { audit("warn", "giris-engellendi", address); throw error; }
      const { username, password, remember } = await readJson(req, 2048);
      if (typeof password !== "string" || password.length > MAX_PASSWORD || typeof username !== "string" || username.length > 100) throw new CmsError(422, "Kullanıcı adı veya şifre geçersiz.");
      if (!(await auth.verify(username, password))) { audit("warn", "giris-basarisiz", address); throw new CmsError(401, "Kullanıcı adı veya şifre yanlış."); }
      await auth.clearAttempts(address);
      audit("log", "giris-basarili", address);
      if (token) await auth.removeSession(token);
      const created = await auth.createSession(remember === true);
      const credential = await auth.credential();
      return json(200, { authenticated: true, csrfToken: created.csrfToken, username: credential.username, mode: "cloud", maxUploadBytes: MAX_UPLOAD_BYTES, minPassword }, { "set-cookie": sessionCookie(created.token, Math.floor(created.maxAge / 1000)) });
    }
    if (!session) throw new CmsError(401, "Yönetici girişi gereklidir.");
    if (req.method !== "GET" && req.headers.get("x-csrf-token") !== session.csrfToken) throw new CmsError(403, "Güvenlik oturumu geçersiz; sayfayı yenileyin.");
    if (pathname === "/api/admin/logout" && req.method === "POST") {
      await auth.removeSession(token);
      return json(200, { authenticated: false }, { "set-cookie": sessionCookie("", 0) });
    }
    if (pathname === "/api/admin/content" && req.method === "GET") return json(200, await exclusive(() => store.read()));
    if (pathname === "/api/admin/upload" && req.method === "POST") {
      const body = await readJson(req, UPLOAD_JSON_LIMIT);
      const { bytes, extension, width, height, kind } = prepareUpload(body);
      const name = crypto.randomUUID() + extension;
      await store.putUpload(name, bytes);
      const local_path = `public/uploads/${name}`;
      return json(201, { url: `/uploads/${name}`, local_path, width, height, ...(kind === "back" && extension === ".webp" ? { webp_path: local_path } : {}) });
    }
    if (pathname === "/api/admin/site" && req.method === "PUT") { const input = await readJson(req); return json(200, await exclusive(() => store.updateSite(input))); }
    if (pathname === "/api/admin/vitrin" && req.method === "PUT") { const input = await readJson(req); return json(200, await exclusive(() => store.updateVitrin(input))); }
    const page = pathname.match(/^\/api\/admin\/pages\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if (page && req.method === "PUT") { const input = await readJson(req); return json(200, await exclusive(() => store.updatePage(page[1], input))); }
    if (pathname === "/api/admin/password" && req.method === "POST") { const result = await changeCredentials(req, token, address); audit("warn", "hesap-bilgisi-degisti", address); return json(200, result); }
    if (pathname === "/api/admin/publish" && req.method === "GET") return json(200, await exclusive(() => publisher.changes()));
    if (pathname === "/api/admin/publish" && req.method === "POST") {
      await readJson(req, 1024);
      const started = await exclusive(() => publisher.start());
      audit("log", started.started ? "yayin-basladi" : "yayin-reddedildi", address);
      const status = started.started ? 202 : 409;
      return json(status, { ...started, ...(status === 409 ? { error: started.reason } : {}), ...(await exclusive(() => publisher.changes())) });
    }
    if (pathname === "/api/admin/publish/discard" && req.method === "POST") {
      await exclusive(() => publisher.discard());
      audit("log", "degisiklikler-geri-alindi", address);
      return json(200, { ok: true, ...(await exclusive(() => store.read())), ...(await exclusive(() => publisher.changes())) });
    }
    const match = pathname.match(/^\/api\/admin\/(books|authors|campaigns)(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?$/);
    if (!match) throw new CmsError(404, "Yönetim işlemi bulunamadı.");
    const [, resource, id] = match;
    if (req.method === "GET") {
      const content = await exclusive(() => store.read());
      const value = id ? content[resource].find((item) => item[resource === "authors" ? "slug" : "id"] === id) : content[resource];
      if (!value) throw new CmsError(404, "Kayıt bulunamadı.");
      return json(200, value);
    }
    if ((req.method === "POST" && id) || (["PUT", "DELETE"].includes(req.method) && !id) || !["POST", "PUT", "DELETE"].includes(req.method)) throw new CmsError(405, "Bu kayıt için yöntem desteklenmiyor.");
    const body = req.method === "DELETE" ? undefined : await readJson(req);
    return json(req.method === "POST" ? 201 : 200, await exclusive(() => store.mutate(resource, req.method, id, body)));
  }

  async function changeCredentials(req, token, address) {
    const { current, next, username } = await readJson(req, 4096);
    if (typeof current !== "string" || current.length > MAX_PASSWORD) throw new CmsError(422, "Şifre bilgileri geçersiz.");
    const wantsPassword = typeof next === "string" && next.length > 0;
    if (next !== undefined && next !== null && next !== "" && (typeof next !== "string" || next.length > MAX_PASSWORD)) throw new CmsError(422, "Şifre bilgileri geçersiz.");
    const record = await auth.credential();
    const newName = username === undefined || username === null || username === "" ? record.username : checkUsername(username);
    if (!wantsPassword && newName === record.username) throw new CmsError(422, "Değiştirilecek bir bilgi girilmedi.");
    await auth.takeAttempt(address);
    if (!(await auth.verifyPassword(current))) throw new CmsError(401, "Şimdiki şifre yanlış.");
    if (wantsPassword) {
      if ([...next].length < minPassword) throw new CmsError(422, `Yeni şifre en az ${minPassword} karakter olmalıdır.`);
      if (next === current) throw new CmsError(422, "Yeni şifre şimdikinden farklı olmalıdır.");
    }
    await auth.clearAttempts(address);
    const saved = wantsPassword ? await auth.change({ username: newName, password: next }) : await auth.rename(newName);
    await auth.removeOtherSessions(token);
    return { ok: true, username: saved.username };
  }

  /** Bir isteği işler; her zaman bir Response döner (hatalar Türkçe JSON'a çevrilir). */
  async function handle(req) {
    github.resetBudget();
    try {
      const url = new URL(req.url);
      checkOrigin(req, url);
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new CmsError(400, "İstek adresi geçersiz."); }
      if (/[\\\u0000]/.test(pathname)) throw new CmsError(400, "İstek adresi geçersiz.");
      const token = cookieToken(req);
      const session = await auth.findSession(token);
      const address = req.headers.get("cf-connecting-ip") ?? "bilinmiyor";
      const upload = pathname.match(/^\/uploads\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp))$/i);
      if (upload && ["GET", "HEAD"].includes(req.method)) return await serveUpload(req, upload[1], session);
      if (!pathname.startsWith("/api/")) throw new CmsError(404, "Sayfa bulunamadı.");
      return await api(req, pathname, token, session, address);
    } catch (error) {
      if (!(error instanceof CmsError)) console.error(`Panel hatası: ${error?.stack ?? error}`);
      return json(error.status ?? 500, { error: error instanceof CmsError ? error.message : "Sunucu işlemi tamamlanamadı; birazdan yeniden deneyin." });
    }
  }

  return { handle, store, publisher, auth, github };
}
