// Ön katman (Worker): yönetim sayfasının gömülü dosyalarını sunar, API ve yükleme isteklerini Durable Object'e iletir,
// yayındaki site görsellerini (kapaklar vb.) siteden getirir. Cloudflare'e bağımlı değildir; testlerde doğrudan çağrılır.

const CSP = "default-src 'self'; img-src 'self' data: https:; script-src 'self'; worker-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const SECURITY = {
  "content-security-policy": CSP,
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};
const SITE_IMAGE_PREFIXES = ["/kapaklar/", "/kapaklar-arka/", "/kapaklar-opt/", "/og/", "/logo/", "/onsoz/"];
// Yalnız resim uzantıları ve sabit içerik türü: siteden gelen bir .html/.svg panel kökeninden çalıştırılamaz.
const IMAGE_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif" };

const decodedCache = new Map();
function binaryOf(path, asset) {
  if (!decodedCache.has(path)) {
    const binary = atob(asset.base64);
    decodedCache.set(path, Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  }
  return decodedCache.get(path);
}

const withSecurity = (response, extra = {}) => {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries({ ...SECURITY, ...extra })) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

export function createEdge({ assets, version, siteUrl = "https://islambol.org", fetch: fetchImpl = globalThis.fetch }) {
  const etag = `W/"${version}"`;

  function serveAsset(path, request) {
    const asset = assets[path];
    if (request.headers.get("if-none-match") === etag) return withSecurity(new Response(null, { status: 304 }), { etag, "cache-control": "no-cache" });
    const body = request.method === "HEAD" ? null : asset.base64 !== undefined ? binaryOf(path, asset) : asset.text;
    return withSecurity(new Response(body, { status: 200, headers: { "content-type": asset.type } }), { etag, "cache-control": "no-cache" });
  }

  async function serveSiteImage(request, url) {
    const type = IMAGE_TYPES[url.pathname.slice(url.pathname.lastIndexOf(".")).toLowerCase()];
    if (!type) return withSecurity(new Response("Görsel bulunamadı.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } }));
    const origin = await fetchImpl(`${siteUrl}${url.pathname}`, { method: "GET", cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!origin.ok) return withSecurity(new Response("Görsel bulunamadı.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } }));
    return withSecurity(new Response(request.method === "HEAD" ? null : origin.body, { status: 200, headers: { "content-type": type, "cache-control": "private, max-age=3600" } }));
  }

  return async function handle(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/") return withSecurity(Response.redirect(`${url.origin}/yonetim/`, 302));
    if (path === "/yonetim") return withSecurity(Response.redirect(`${url.origin}/yonetim/`, 301));
    if (Object.hasOwn(assets, path) && ["GET", "HEAD"].includes(request.method)) return serveAsset(path, request);
    if (path.startsWith("/api/") || path.startsWith("/uploads/")) {
      const stub = env.PANEL.get(env.PANEL.idFromName("panel"));
      return withSecurity(await stub.fetch(request));
    }
    if (SITE_IMAGE_PREFIXES.some((prefix) => path.startsWith(prefix)) && ["GET", "HEAD"].includes(request.method) && !path.includes("..")) return serveSiteImage(request, url);
    return withSecurity(new Response("Sayfa bulunamadı.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } }));
  };
}
