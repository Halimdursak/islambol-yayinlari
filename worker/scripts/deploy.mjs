// Worker'ı Cloudflare REST API ile dağıtır (wrangler bu makinede çalışmaz). Adımlar:
//   derle → anahtarı doğrula → hesap/zone bul → betiği yükle (Durable Object + gizliler) → workers.dev'i kapat → panel.islambol.org'u bağla → canlı dene
// Kullanım:  node worker/scripts/deploy.mjs [--dry-run] [--reset-password] [--password <şifre>] [--username <ad>] [--iterations <n>]
import { randomInt } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { newCredential, pbkdf2Hex, randomHex, PBKDF2_ITERATIONS } from "../src/crypto.mjs";
import { loadSecret } from "./anahtar-kasasi.mjs";
import { ROOT, buildAll } from "./build.mjs";

export const WORKER_NAME = "islambol-panel";
export const HOSTNAME = "panel.islambol.org";
export const ZONE = "islambol.org";
export const REPO = "Halimdursak/islambol-yayinlari";
const API = "https://api.cloudflare.com/client/v4";
const COMPATIBILITY_DATE = "2025-06-01";
const CREDENTIAL_FILE = ".local/panel-giris.json";
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export class CloudflareError extends Error {
  constructor(message, errors = []) { super(message); this.name = "CloudflareError"; this.errors = errors; }
}

/** 12 karakterlik, okunması kolay (0/o, 1/l yok) şifre: xxxx-xxxx-xxxx. */
export function generatePassword() {
  const group = () => Array.from({ length: 4 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

export function createCloudflare({ token, fetch: request = globalThis.fetch }) {
  return async function call(path, { method = "GET", json, form, headers = {} } = {}) {
    const response = await request(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(json ? { "content-type": "application/json" } : {}), ...headers }, body: form ?? (json ? JSON.stringify(json) : undefined) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      const errors = body.errors ?? [];
      throw new CloudflareError(`Cloudflare ${method} ${path.split("?")[0]} → ${response.status}: ${errors.map((e) => `[${e.code}] ${e.message}`).join("; ") || "yanıt okunamadı"}`, errors);
    }
    return body.result;
  };
}

/** Worker yükleme isteğinin üst verisi. Gizliler her dağıtımda yeniden gönderilir (keep_bindings çakışması belgede doğrulanmadı). */
export function buildMetadata({ githubToken, credential, legacyMigration = false }) {
  return {
    main_module: "worker.mjs",
    compatibility_date: COMPATIBILITY_DATE,
    observability: { enabled: true },   // güvenlik olayları günlüğü (Workers Logs)
    bindings: [
      { type: "durable_object_namespace", name: "PANEL", class_name: "Panel" },
      { type: "plain_text", name: "GITHUB_REPO", text: REPO },
      { type: "plain_text", name: "ALLOWED_HOSTS", text: HOSTNAME },
      { type: "plain_text", name: "SITE_URL", text: "https://islambol.org" },
      { type: "secret_text", name: "GITHUB_TOKEN", text: githubToken },
      { type: "secret_text", name: "INITIAL_CREDENTIAL", text: JSON.stringify(credential) },
    ],
    // Ücretsiz planda yalnız SQLite destekli sınıf olur. `exports` her dağıtımda aynı gönderilebilir; eski yol yalnız ilk dağıtımda `migrations` ister.
    ...(legacyMigration ? { migrations: { new_tag: "v1", new_sqlite_classes: ["Panel"] } } : { exports: { Panel: { type: "durable-object", storage: "sqlite" } } }),
  };
}

export function buildForm(metadata, code) {
  const form = new FormData();
  form.set("metadata", JSON.stringify(metadata));
  form.set("worker.mjs", new File([code], "worker.mjs", { type: "application/javascript+module" }));
  return form;
}

/**
 * Giriş kaydı: var olanı korur; yoksa ya da sıfırlama istenmişse yeni şifre üretir (şifre yalnız bir kez döner).
 * Yeni kayıt, yükleme başarılı olunca `save()` ile diske yazılır; yükleme düşerse eski kayıt bozulmaz.
 */
export async function resolveCredential(root, { reset = false, password, username = "yayinevi", iterations = PBKDF2_ITERATIONS } = {}) {
  const path = join(root, CREDENTIAL_FILE);
  if (!reset && !password) {
    try { return { credential: JSON.parse(await readFile(path, "utf8")), password: null, save: async () => {} }; } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const chosen = password ?? generatePassword();
  const salt = randomHex(16);
  const credential = { username, salt, hash: await pbkdf2Hex(chosen, salt, iterations), iterations, resetId: randomHex(8) };
  const save = async () => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(credential, null, 2) + "\n");
  };
  return { credential, password: chosen, save };
}

async function findAccount(cf, hint) {
  if (hint) return hint;
  const accounts = await cf("/accounts?per_page=50");
  if (accounts.length === 1) return accounts[0].id;
  throw new CloudflareError(accounts.length ? `Birden çok Cloudflare hesabı var: ${accounts.map((a) => `${a.name} (${a.id})`).join(", ")}. CLOUDFLARE_ACCOUNT_ID ile birini seçin.` : "Cloudflare hesabı bulunamadı.");
}

export async function deployWorker({ cf, accountId, zoneId, code, githubToken, credential, log = () => {} }) {
  const scripts = `/accounts/${accountId}/workers/scripts/${WORKER_NAME}`;
  const upload = async (legacyMigration) => cf(scripts, { method: "PUT", form: buildForm(buildMetadata({ githubToken, credential, legacyMigration }), code) });
  let result;
  try { result = await upload(false); }
  catch (error) {
    // Hesapta workers.dev alt alanı yoksa hangi yol denenirse denensin aynı hata gelir: kullanıcıya ne yapacağı söylenir.
    if (error.errors?.some((e) => e.code === 10063)) throw new CloudflareError("Cloudflare hesabında Workers henüz açılmamış. dash.cloudflare.com adresinde sol menüden “Workers & Pages”e bir kez tıklayın (bir şey kurmanız gerekmez), sonra bu komutu yeniden çalıştırın.", error.errors);
    // `exports` yolu reddedilirse eski `migrations` yolu yalnız ilk dağıtımda denenir.
    log(`exports yolu reddedildi (${error.message}); eski migrations yolu deneniyor…`);
    result = await upload(true);
  }
  log(`Worker yüklendi (başlatma ${result?.startup_time_ms ?? "?"} ms).`);
  await cf(`${scripts}/subdomain`, { method: "POST", json: { enabled: false, previews_enabled: false }, headers: { "cloudflare-workers-script-api-date": "2025-08-01" } })
    .then(() => log("workers.dev adresi kapatıldı."))
    .catch((error) => log(`workers.dev kapatılamadı (önemsiz, panel zaten yalnız ${HOSTNAME} adresini kabul eder): ${error.message}`));
  const domain = await cf(`/accounts/${accountId}/workers/domains`, { method: "PUT", json: { hostname: HOSTNAME, service: WORKER_NAME, zone_id: zoneId, zone_name: ZONE, enabled: true } });
  log(`${HOSTNAME} adresi Worker'a bağlandı.`);
  return { result, domain };
}

async function waitUntilLive(request = globalThis.fetch, log = () => {}) {
  for (let attempt = 1; attempt <= 24; attempt++) {
    try {
      const response = await request(`https://${HOSTNAME}/yonetim/`, { headers: { "user-agent": "islambol-deploy" } });
      if (response.ok) return true;
      log(`  deneme ${attempt}: HTTP ${response.status}`);
    } catch (error) { log(`  deneme ${attempt}: ${error.cause?.code ?? error.message}`); }
    await delay(10000);
  }
  return false;
}

function flag(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const log = (text) => console.log(text);
  const built = await buildAll();
  log(`Derlendi: ${(built.worker.bytes / 1024).toFixed(0)} KB, ${built.assets.files.length} gömülü dosya.`);
  const iterations = flag("--iterations") ? Number(flag("--iterations")) : PBKDF2_ITERATIONS;
  const { credential, password, save } = await resolveCredential(ROOT, { reset: process.argv.includes("--reset-password"), password: flag("--password"), username: flag("--username") ?? "yayinevi", iterations });
  if (process.argv.includes("--dry-run")) {
    const metadata = buildMetadata({ githubToken: "<gizli>", credential: { ...credential, hash: "<gizli>" } });
    log(`Kuru çalıştırma: yükleme üst verisi\n${JSON.stringify(metadata, null, 2)}`);
    process.exit(0);
  }
  const cloudflareToken = await loadSecret(ROOT, "cloudflare", "CLOUDFLARE_API_TOKEN");
  const githubToken = await loadSecret(ROOT, "github", "GITHUB_TOKEN");
  if (!cloudflareToken || !githubToken) { console.error("Anahtarlar eksik: önce panel-anahtarlari-gir.bat dosyasını çalıştırın."); process.exit(1); }
  const cf = createCloudflare({ token: cloudflareToken });
  const accountId = await findAccount(cf, process.env.CLOUDFLARE_ACCOUNT_ID);
  const zones = await cf(`/zones?name=${ZONE}&status=active`);
  if (!zones.length) { console.error(`${ZONE} alan adı bu Cloudflare hesabında bulunamadı (anahtarın “Zone Resources” kapsamında islambol.org seçili olmalı; “Zone → Zone → Read” izni gerekir).`); process.exit(1); }
  log(`Hesap ve alan adı bulundu (${ZONE}).`);
  const code = await readFile(join(ROOT, "worker/dist/worker.mjs"), "utf8");
  await deployWorker({ cf, accountId, zoneId: zones[0].id, code, githubToken, credential, log });
  await save();
  if (password) log(`\nYönetici girişi (şifre yalnızca bu kez gösterilir)\n  Adres:         https://${HOSTNAME}/\n  Kullanıcı adı: ${credential.username}\n  Şifre:         ${password}\n`);
  else log(`Giriş kaydı değişmedi (kullanıcı adı: ${credential.username}).`);
  log("Adresin açılması bekleniyor (sertifika birkaç dakika sürebilir)…");
  log((await waitUntilLive(globalThis.fetch, log)) ? `Canlı: https://${HOSTNAME}/yonetim/` : "Adres henüz yanıt vermiyor; birkaç dakika sonra tekrar deneyin.");
}
