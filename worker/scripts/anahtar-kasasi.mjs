// Anahtarlar (Cloudflare API anahtarı, GitHub anahtarı) diskte yalnızca Windows DPAPI ile şifreli durur
// (.local/panel-anahtarlar.json, git'e girmez): yalnız bu Windows kullanıcısı bu bilgisayarda çözebilir.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const FILE = ".local/panel-anahtarlar.json";
const POWERSHELL = ["-NoProfile", "-NonInteractive", "-Command"];

const protect = (text) => execFileSync("powershell", [...POWERSHELL, "$t=[Console]::In.ReadToEnd().TrimEnd(); ConvertTo-SecureString $t -AsPlainText -Force | ConvertFrom-SecureString"], { input: text, encoding: "utf8", windowsHide: true }).trim();
const unprotect = (blob) => execFileSync("powershell", [...POWERSHELL, "$b=[Console]::In.ReadToEnd().Trim(); $s=ConvertTo-SecureString $b; (New-Object System.Management.Automation.PSCredential 'x',$s).GetNetworkCredential().Password"], { input: blob, encoding: "utf8", windowsHide: true }).replace(/\r?\n$/, "");

async function readAll(root) {
  try { return JSON.parse(await readFile(join(root, FILE), "utf8")); } catch (error) { if (error.code === "ENOENT") return {}; throw error; }
}

export async function saveSecret(root, name, value) {
  const all = await readAll(root);
  all[name] = protect(value);
  await mkdir(dirname(join(root, FILE)), { recursive: true });
  await writeFile(join(root, FILE), JSON.stringify(all, null, 2) + "\n");
}

/** Ortam değişkeni (ör. CLOUDFLARE_API_TOKEN) varsa o, yoksa şifreli kasadan okunur; yoksa null. */
export async function loadSecret(root, name, envName) {
  if (envName && process.env[envName]) return process.env[envName];
  const blob = (await readAll(root))[name];
  return blob ? unprotect(blob) : null;
}

export async function hasSecret(root, name) {
  return Boolean((await readAll(root))[name]);
}
