// Yönetim paneli girişi: kullanıcı adı + şifre (scrypt), oturumlar diske (karma olarak) yazılır; yeniden başlatınca "beni hatırla" sürer.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { atomicWrite } from "./store.mjs";
import { containedPath } from "./paths.mjs";
import { CmsError } from "./content.mjs";

const deriveKey = promisify(scrypt);

export const DEFAULT_USERNAME = "yayinevi";
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 512;
export const SESSION_AGE = 12 * 60 * 60 * 1000;
export const REMEMBER_AGE = 30 * 24 * 60 * 60 * 1000;

const credentialPath = (root) => containedPath(root, ".local/cms-auth.json");
const sessionsPath = (root) => containedPath(root, ".local/cms-sessions.json");
const digest = (value) => createHash("sha256").update(String(value)).digest();
/** Büyük/küçük harf ve Türkçe aksan (ı/İ, ş, ü…) farkı giriş denemesini bozmasın: "Yayınevi" ile "yayinevi" aynı kullanıcıdır. */
const normalizeName = (value) => String(value ?? "").trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i");

/** 3–32 karakter: harf, rakam, nokta, tire, alt çizgi. */
export function checkUsername(value) {
  const name = String(value ?? "").trim();
  if (!/^[\p{L}\p{N}._-]{3,32}$/u.test(name)) throw new CmsError(422, "Kullanıcı adı 3–32 karakter olmalı; yalnız harf, rakam, nokta, tire ve alt çizgi içerebilir.");
  return name;
}

export async function saveCredential(root, password, username = DEFAULT_USERNAME) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await deriveKey(password, salt, 64)).toString("hex");
  const credential = { version: 2, username: checkUsername(username), salt, hash };
  await atomicWrite(credentialPath(root), JSON.stringify(credential, null, 2) + "\n");
  return credential;
}

/** Var olan giriş kaydını okur (sürüm 1 = yalnız şifre: varsayılan kullanıcı adıyla sürer) ya da yenisini üretir. */
export async function credentialFor(root, { initialPassword, initialUsername, resetPassword, logger }) {
  if (!resetPassword) {
    try {
      const credential = JSON.parse(await readFile(credentialPath(root), "utf8"));
      if (![1, 2].includes(credential.version) || !/^[a-f0-9]{32}$/.test(credential.salt) || !/^[a-f0-9]{128}$/.test(credential.hash)) throw new Error("CMS giriş kaydı bozuk; --reset-password ile sıfırlayın.");
      return { ...credential, username: credential.username ?? DEFAULT_USERNAME };
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const password = initialPassword || randomBytes(12).toString("base64url");
  const credential = await saveCredential(root, password, initialUsername || DEFAULT_USERNAME);
  logger(`Yönetici girişi (şifre yalnızca bu kez gösterilir)\n  Kullanıcı adı: ${credential.username}\n  Şifre:         ${password}`);
  return credential;
}

/** Kullanıcı adı yanlış olsa da şifre türetimi çalışır: yanıt süresi hangisinin yanlış olduğunu sızdırmaz. */
export async function matchesCredential(credential, username, password) {
  const passwordOk = timingSafeEqual(await deriveKey(String(password), credential.salt, 64), Buffer.from(credential.hash, "hex"));
  const userOk = timingSafeEqual(digest(normalizeName(username)), digest(normalizeName(credential.username)));
  return passwordOk && userOk;
}

/** Şifre değiştirirken yalnız şifre doğrulanır (oturum zaten açık). */
export async function matchesPassword(credential, password) {
  return timingSafeEqual(await deriveKey(String(password), credential.salt, 64), Buffer.from(credential.hash, "hex"));
}

/** Oturum jetonları yalnızca SHA-256 karmasıyla saklanır; çerez değeri diskte yoktur. */
export async function createSessionStore(root, now = () => Date.now()) {
  const map = new Map();
  try {
    const saved = JSON.parse(await readFile(sessionsPath(root), "utf8"));
    for (const [key, value] of Object.entries(saved.sessions ?? {})) if (/^[a-f0-9]{64}$/.test(key) && value?.expires > now() && typeof value.csrfToken === "string") map.set(key, { csrfToken: value.csrfToken, expires: value.expires });
  } catch (error) { if (error.code !== "ENOENT") { /* bozuk dosya: temiz başla */ } }
  const key = (token) => createHash("sha256").update(String(token)).digest("hex");
  const persist = () => atomicWrite(sessionsPath(root), JSON.stringify({ version: 1, sessions: Object.fromEntries(map) }) + "\n");
  const prune = () => { for (const [id, session] of map) if (session.expires <= now()) map.delete(id); };
  return {
    find(token) {
      if (!token) return null;
      prune();
      return map.get(key(token)) ?? null;
    },
    async create(remember = false) {
      prune();
      const token = randomBytes(32).toString("hex");
      const csrfToken = randomBytes(32).toString("hex");
      const age = remember ? REMEMBER_AGE : SESSION_AGE;
      map.set(key(token), { csrfToken, expires: now() + age });
      await persist();
      return { token, csrfToken, maxAge: age };
    },
    async remove(token) { map.delete(key(token)); await persist(); },
    /** Şifre değişince açık olan diğer tarayıcılar yeniden giriş yapar. */
    async removeOthers(token) {
      const keep = key(token);
      for (const id of [...map.keys()]) if (id !== keep) map.delete(id);
      await persist();
    },
  };
}
