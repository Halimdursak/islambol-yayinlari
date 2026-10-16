import { isAbsolute, relative, resolve, sep } from "node:path";

/** Proje kökünün dışına çıkan yolları reddeder; kökün kendisi de geçersizdir. */
export function containedPath(root, ...parts) {
  const path = resolve(root, ...parts);
  const remainder = relative(resolve(root), path);
  if (!remainder || isAbsolute(remainder) || remainder === ".." || remainder.startsWith(`..${sep}`) || resolve(path) === resolve(root)) throw new Error("İşlem yolu proje klasörünün dışında.");
  return path;
}
