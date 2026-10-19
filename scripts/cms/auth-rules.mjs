// Giriş kurallarının saf bölümü: yerel sunucu (scrypt, auth.mjs) ve Cloudflare Worker (PBKDF2) ortak kullanır.
import { CmsError } from "./content.mjs";

export const DEFAULT_USERNAME = "yayinevi";
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 512;
export const SESSION_AGE = 12 * 60 * 60 * 1000;
export const REMEMBER_AGE = 30 * 24 * 60 * 60 * 1000;

/** Büyük/küçük harf ve Türkçe aksan (ı/İ, ş, ü…) farkı giriş denemesini bozmasın: "Yayınevi" ile "yayinevi" aynı kullanıcıdır. */
export const normalizeName = (value) => String(value ?? "").trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i");

/** 3–32 karakter: harf, rakam, nokta, tire, alt çizgi. */
export function checkUsername(value) {
  const name = String(value ?? "").trim();
  if (!/^[\p{L}\p{N}._-]{3,32}$/u.test(name)) throw new CmsError(422, "Kullanıcı adı 3–32 karakter olmalı; yalnız harf, rakam, nokta, tire ve alt çizgi içerebilir.");
  return name;
}
