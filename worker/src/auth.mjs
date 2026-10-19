// Cloudflare tarafı giriş: kullanıcı adı + şifre (PBKDF2), oturumlar yalnız SHA-256 karmasıyla saklanır, hatalı deneme sınırı.
import { CmsError } from "../../scripts/cms/content.mjs";
import { MAX_PASSWORD, MIN_PASSWORD, REMEMBER_AGE, SESSION_AGE, checkUsername, normalizeName } from "../../scripts/cms/auth-rules.mjs";
import { PBKDF2_ITERATIONS, newCredential, pbkdf2Hex, randomHex, sameText, sha256Hex } from "./crypto.mjs";
import { createLock } from "./lock.mjs";

const ATTEMPT_LIMIT = 8;
const GLOBAL_LIMIT = 100;   // tüm adreslerden toplam hatalı deneme (dağıtık saldırı tavanı)
const GLOBAL_KEY = "r:*toplam";
const ATTEMPT_WINDOW = 15 * 60 * 1000;

/** Hız sınırı anahtarı: IPv4 olduğu gibi; IPv6'da bir kişi /64 bloğunun hepsini kullanabildiği için ilk 64 bit. */
export function limiterKey(address) {
  const raw = String(address).split("%")[0].toLowerCase();
  const mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  if (!raw.includes(":")) return raw;
  const [head, tail] = raw.split("::");
  const front = head ? head.split(":") : [];
  const back = tail === undefined ? [] : tail ? tail.split(":") : [];
  const groups = tail === undefined ? front : [...front, ...Array(Math.max(0, 8 - front.length - back.length)).fill("0"), ...back];
  return `${groups.slice(0, 4).map((group) => (group || "0").padStart(4, "0")).join(":")}/64`;
}
export { MAX_PASSWORD, MIN_PASSWORD };

export function createAuth({ storage, initialCredential, now = Date.now }) {
  const lock = createLock();
  const initial = (() => {
    if (!initialCredential) return null;
    try { return typeof initialCredential === "string" ? JSON.parse(initialCredential) : initialCredential; } catch { return null; }
  })();

  /**
   * Geçerli giriş kaydı. Dağıtım betiğinin ürettiği ilk kayıt ilk kullanımda içeri alınır;
   * `resetId` değişirse (şifre sıfırlama) ortamdaki kayıt kazanır ve açık oturumlar kapanır.
   */
  async function credential() {
    const stored = await storage.get("cred");
    if (!initial || (stored && stored.resetId === initial.resetId)) return stored ?? null;
    // İçeri alma tek seferde yapılır: eşzamanlı ilk istekler birbirinin kaydını ve oturumlarını silmesin.
    return lock(async () => {
      const again = await storage.get("cred");
      if (again && again.resetId === initial.resetId) return again;
      await storage.put("cred", initial);
      await purge("s:");
      return initial;
    });
  }

  async function purgeExpired() {
    for (const [key, slot] of await storage.list({ prefix: "r:" })) if (slot.reset <= now()) await storage.delete(key);
  }

  async function purge(prefix, keep) {
    for (const key of (await storage.list({ prefix })).keys()) if (key !== keep) await storage.delete(key);
  }

  async function matches(record, username, password) {
    const derived = await pbkdf2Hex(String(password), record.salt, record.iterations ?? PBKDF2_ITERATIONS);
    const passwordOk = sameText(derived, record.hash);
    // Kullanıcı adı yanlış olsa da şifre türetimi çalışır: yanıt süresi hangisinin yanlış olduğunu sızdırmaz.
    const userOk = username === undefined ? true : sameText(await sha256Hex(normalizeName(username)), await sha256Hex(normalizeName(record.username)));
    return passwordOk && userOk;
  }

  return {
    credential,
    /** Hatalı deneme sınırı: her deneme önce bir hak harcar, başarılı girişte iade edilir. */
    takeAttempt(address) {
      return lock(async () => {
        const key = `r:${limiterKey(address)}`;
        const read = async (name) => { const slot = await storage.get(name); return slot && slot.reset > now() ? slot : { count: 0, reset: now() + ATTEMPT_WINDOW }; };
        const mine = await read(key);
        const all = await read(GLOBAL_KEY);
        if (mine.count >= ATTEMPT_LIMIT || all.count >= GLOBAL_LIMIT) throw new CmsError(429, "Çok fazla hatalı deneme. 15 dakika sonra yeniden deneyin.");
        if (all.count === 0) await purgeExpired();   // yeni pencere: süresi dolmuş sayaçlar silinir
        await storage.put(key, { count: mine.count + 1, reset: mine.reset });
        await storage.put(GLOBAL_KEY, { count: all.count + 1, reset: all.reset });
      });
    },
    /** Başarılı girişte bu adresin sayacı silinir ve toplamdan bir hak iade edilir. */
    clearAttempts(address) {
      return lock(async () => {
        await storage.delete(`r:${limiterKey(address)}`);
        const all = await storage.get(GLOBAL_KEY);
        if (all && all.count > 0) await storage.put(GLOBAL_KEY, { ...all, count: all.count - 1 });
      });
    },
    async verify(username, password) {
      const record = await credential();
      if (!record) throw new CmsError(503, "Yönetici girişi henüz kurulmadı. Siteyi hazırlayan kişiye bildirin.");
      return matches(record, username, password);
    },
    async verifyPassword(password) {
      const record = await credential();
      return Boolean(record) && matches(record, undefined, password);
    },
    async change({ username, password }) {
      const record = await credential();
      const next = { ...(await newCredential(checkUsername(username ?? record.username), password)), resetId: record.resetId };
      await storage.put("cred", next);
      return next;
    },
    async rename(username) {
      const record = await credential();
      const next = { ...record, username: checkUsername(username) };
      await storage.put("cred", next);
      return next;
    },
    async createSession(remember = false) {
      const token = randomHex(32);
      const csrfToken = randomHex(32);
      const age = remember ? REMEMBER_AGE : SESSION_AGE;
      for (const [key, session] of await storage.list({ prefix: "s:" })) if (session.expires <= now()) await storage.delete(key);
      await storage.put(`s:${await sha256Hex(token)}`, { csrfToken, expires: now() + age });
      return { token, csrfToken, maxAge: age };
    },
    async findSession(token) {
      await credential();   // yeni dağıtımın giriş kaydı (ve şifre sıfırlama) oturumlar okunmadan önce içeri alınır
      if (!token) return null;
      const key = `s:${await sha256Hex(token)}`;
      const session = await storage.get(key);
      if (!session) return null;
      if (session.expires <= now()) { await storage.delete(key); return null; }
      return session;
    },
    async removeSession(token) { if (token) await storage.delete(`s:${await sha256Hex(token)}`); },
    /** Şifre değişince açık olan diğer tarayıcılar yeniden giriş yapar. */
    async removeOtherSessions(token) { await purge("s:", token ? `s:${await sha256Hex(token)}` : undefined); },
  };
}
