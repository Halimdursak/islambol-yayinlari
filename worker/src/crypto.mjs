// WebCrypto yardımcıları (Cloudflare Worker ve Node 22 ortak): karma, rastgele jeton, PBKDF2 şifre karması.
const encoder = new TextEncoder();

export const toHex = (bytes) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
export const fromHex = (hex) => Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));

export const randomHex = (length = 32) => toHex(crypto.getRandomValues(new Uint8Array(length)));

export async function sha256Hex(value) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(String(value))));
}

/** Cloudflare Workers PBKDF2 yineleme sayısını en çok 100.000 ile sınırlar. */
export const PBKDF2_ITERATIONS = 100000;

export async function pbkdf2Hex(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  return toHex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations }, key, 256));
}

/** Süre sızdırmayan eşitlik denetimi (aynı uzunluktaki iki metin). */
export function sameText(a, b) {
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return diff === 0;
}

export async function newCredential(username, password) {
  const salt = randomHex(16);
  return { username, salt, hash: await pbkdf2Hex(password, salt), iterations: PBKDF2_ITERATIONS, resetId: randomHex(8) };
}
