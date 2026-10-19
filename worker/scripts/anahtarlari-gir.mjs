// Panelin bulut kurulumu için iki anahtarı gizli girişle alır, doğrular ve şifreli saklar.
// Anahtarlar ekrana yazılmaz, sohbete yapıştırılmaz; yalnız bu pencereye yapıştırılır.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSecret, saveSecret } from "./anahtar-kasasi.mjs";
import { ROOT } from "./build.mjs";

const REPO = "Halimdursak/islambol-yayinlari";

function askHidden(question) {
  return new Promise((done) => {
    process.stdout.write(question);
    const { stdin } = process;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") { stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); process.stdout.write("\n"); done(value.trim()); return; }
        if (char === "\u0003") process.exit(1);
        if (char === "\u007f" || char === "\b") { value = value.slice(0, -1); continue; }
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function checkCloudflare(token) {
  const response = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: { authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (body?.result?.status === "active") return "";
  // Hesaba bağlı (account-owned) anahtarlar kullanıcı adresiyle doğrulanmayabilir; hesap listesi de yoklanır.
  const accounts = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers: { authorization: `Bearer ${token}` } });
  const list = await accounts.json().catch(() => ({}));
  return list?.success && list.result?.length ? "" : "Cloudflare bu anahtarı kabul etmedi (süresi dolmuş ya da yanlış kopyalanmış olabilir).";
}

async function checkGithub(token) {
  const call = (path, init = {}) => fetch(`https://api.github.com/repos/${REPO}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "islambol-panel", "x-github-api-version": "2022-11-28", ...(init.headers ?? {}) } });
  const read = await call("/git/ref/heads/main");
  if (read.status === 401) return "GitHub bu anahtarı kabul etmedi (yanlış kopyalanmış ya da süresi dolmuş).";
  if (!read.ok) return `GitHub depoya erişemedi (${read.status}). Anahtarın “Only select repositories” kısmında islambol-yayinlari seçili olmalı.`;
  const actions = await call("/actions/runs?per_page=1");
  if (!actions.ok) return "Anahtarın “Actions: Read-only” izni eksik.";
  // Yazma izni, hiçbir yere bağlanmayan zararsız bir nesne oluşturarak denenir.
  const write = await call("/git/blobs", { method: "POST", body: JSON.stringify({ content: "panel-anahtar-denemesi", encoding: "utf-8" }), headers: { "content-type": "application/json" } });
  if (!write.ok) return "Anahtarın “Contents: Read and write” izni eksik.";
  return "";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("\nİslambol paneli — anahtar girişi\n");
  console.log("Yazdıklarınız ekranda görünmez. Yapıştırıp Enter'a basın. İki anahtar da bu bilgisayarda şifreli saklanır.\n");
  const had = { cloudflare: Boolean(await loadSecret(ROOT, "cloudflare")), github: Boolean(await loadSecret(ROOT, "github")) };
  if (had.cloudflare || had.github) console.log("Not: daha önce kaydedilmiş anahtar(lar) var; boş bırakıp Enter'a basarsanız eskisi korunur.\n");

  const cloudflare = await askHidden("1) Cloudflare anahtarı: ");
  if (cloudflare) {
    const problem = await checkCloudflare(cloudflare);
    if (problem) { console.log(`   ✗ ${problem}`); process.exit(1); }
    await saveSecret(ROOT, "cloudflare", cloudflare);
    console.log(`   ✓ Cloudflare anahtarı geçerli (${cloudflare.length} karakter) ve şifreli kaydedildi.\n`);
  } else console.log("   (atlandı)\n");

  const github = await askHidden("2) GitHub anahtarı:     ");
  if (github) {
    const problem = await checkGithub(github);
    if (problem) { console.log(`   ✗ ${problem}`); process.exit(1); }
    await saveSecret(ROOT, "github", github);
    console.log(`   ✓ GitHub anahtarı geçerli, depoya okuma/yazma ve Actions izni var (${github.length} karakter); şifreli kaydedildi.\n`);
  } else console.log("   (atlandı)\n");
  console.log("Bitti. Bu pencereyi kapatabilirsiniz; Claude'a “anahtarları girdim” yazın.");
}
