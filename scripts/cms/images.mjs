// Yüklenen resimlerin doğrulanması ve boyutlandırılması. sharp yoksa/çalışmazsa özgün bayt değişmeden saklanır.
import { extname } from "node:path";
import { CmsError } from "./content.mjs";
import { MAX_PIXELS, MAX_WIDTH, UPLOAD_KINDS, detectExtension, imageSize } from "./image-info.mjs";

export { UPLOAD_KINDS, imageSize };

export const MAX_UPLOAD = 8 * 1024 * 1024;

async function optimize(bytes, extension, limit) {
  let sharp;
  try { sharp = (await import("sharp")).default; } catch { return null; }
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: "none" }).rotate();
    const meta = await image.metadata();
    if (!meta.width || meta.width <= limit) return null;
    const resized = image.resize({ width: limit, withoutEnlargement: true });
    const output = extension === ".png" ? await resized.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : extension === ".webp" ? await resized.webp({ quality: 86 }).toBuffer({ resolveWithObject: true })
        : await resized.jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    return { bytes: output.data, width: output.info.width, height: output.info.height };
  } catch { return null; }
}

/** Arka kapak için WebP eşi (sharp yoksa null: site JPEG ile de çalışır). */
export async function toWebp(bytes) {
  let sharp;
  try { sharp = (await import("sharp")).default; } catch { return null; }
  try { return await sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: "none" }).rotate().webp({ quality: 72, effort: 5 }).toBuffer(); } catch { return null; }
}

/** İstek gövdesini doğrular; { bytes, extension, width, height } döndürür. */
export async function prepareImage(body) {
  if (typeof body.filename !== "string" || body.filename.length > 255 || typeof body.data !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data) || body.data.length % 4 !== 0) throw new CmsError(422, "Yüklenen resim bilgileri geçersiz.");
  const kind = body.kind ?? "image";
  if (!UPLOAD_KINDS.includes(kind)) throw new CmsError(422, "Yükleme türü geçersiz.");
  const original = Buffer.from(body.data, "base64");
  if (!original.length || original.length > MAX_UPLOAD) throw new CmsError(413, "Resim en fazla 8 MB olabilir.");
  const extension = detectExtension(original);
  if (!extension) throw new CmsError(422, "Yalnızca gerçek PNG, JPEG veya WebP resimleri yüklenebilir.");
  const namedExtension = extname(body.filename).toLowerCase();
  if (!(extension === ".jpg" ? [".jpg", ".jpeg"] : [extension]).includes(namedExtension)) throw new CmsError(422, "Dosya uzantısı resim türüyle eşleşmiyor.");
  const size = imageSize(original, extension);
  if (!size || !size.width || !size.height || size.width * size.height > MAX_PIXELS) throw new CmsError(422, "Resim boyutları geçersiz veya çok büyük.");
  const smaller = await optimize(original, extension, MAX_WIDTH[kind]);
  return smaller ? { ...smaller, extension } : { bytes: original, extension, ...size };
}
