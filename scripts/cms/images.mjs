// Yüklenen resimlerin doğrulanması ve boyutlandırılması. sharp yoksa/çalışmazsa özgün bayt değişmeden saklanır.
import { extname } from "node:path";
import { CmsError } from "./content.mjs";

export const MAX_UPLOAD = 8 * 1024 * 1024;
const MAX_PIXELS = 40000000;
// Kitap kapakları liste/detay için, önizleme sayfaları okunabilirlik için bu genişliğin üstüne çıkmaz.
const MAX_WIDTH = { cover: 1200, back: 800, preview: 1400, image: 1600 };
export const UPLOAD_KINDS = Object.keys(MAX_WIDTH);

function detectExtension(bytes) {
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR") return ".png";
  if (bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) return ".jpg";
  if (bytes.length >= 20 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" && bytes.readUInt32LE(4) + 8 === bytes.length && ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16))) return ".webp";
  return null;
}

function jpegSize(bytes) {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 255) { offset++; continue; }
    const marker = bytes[offset + 1];
    if (marker === 255) { offset++; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  return null;
}

function webpSize(bytes) {
  const kind = bytes.toString("ascii", 12, 16);
  if (kind === "VP8X") return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  if (kind === "VP8L") { const bits = bytes.readUInt32LE(21); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
  return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
}

/** Başlıktan genişlik/yükseklik; resim bozuksa null. */
export function imageSize(bytes, extension) {
  try {
    if (extension === ".png") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    if (extension === ".jpg") return jpegSize(bytes);
    return webpSize(bytes);
  } catch { return null; }
}

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
