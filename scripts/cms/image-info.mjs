// Yüklenen resmin türünü ve boyutunu başlıktan okur. Yalnız Uint8Array kullanır (Node Buffer'ı da bir Uint8Array'dir):
// yerel sunucu ve Cloudflare Worker aynı kodu çalıştırır.

export const MAX_PIXELS = 40000000;
/** Yükleme türü → izin verilen en büyük genişlik. Kapaklar liste/detay için, önizleme sayfaları okunabilirlik için bu genişliğin üstüne çıkmaz. */
export const MAX_WIDTH = { cover: 1200, back: 800, preview: 1400, image: 1600 };
export const UPLOAD_KINDS = Object.keys(MAX_WIDTH);

const ascii = (bytes, from, to) => String.fromCharCode(...bytes.subarray(from, to));
const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Gerçek PNG / JPEG / WebP ise ".png" / ".jpg" / ".webp", değilse null. */
export function detectExtension(bytes) {
  if (bytes.length >= 33 && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) && ascii(bytes, 12, 16) === "IHDR") return ".png";
  if (bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) return ".jpg";
  if (bytes.length >= 20 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP" && view(bytes).getUint32(4, true) + 8 === bytes.length && ["VP8 ", "VP8L", "VP8X"].includes(ascii(bytes, 12, 16))) return ".webp";
  return null;
}

function jpegSize(bytes) {
  const data = view(bytes);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 255) { offset++; continue; }
    const marker = bytes[offset + 1];
    if (marker === 255) { offset++; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: data.getUint16(offset + 5), width: data.getUint16(offset + 7) };
    offset += 2 + data.getUint16(offset + 2);
  }
  return null;
}

const uint24 = (data, offset) => data.getUint8(offset) | (data.getUint8(offset + 1) << 8) | (data.getUint8(offset + 2) << 16);

function webpSize(bytes) {
  const data = view(bytes);
  const kind = ascii(bytes, 12, 16);
  if (kind === "VP8X") return { width: 1 + uint24(data, 24), height: 1 + uint24(data, 27) };
  if (kind === "VP8L") { const bits = data.getUint32(21, true); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
  return { width: data.getUint16(26, true) & 0x3fff, height: data.getUint16(28, true) & 0x3fff };
}

/** Başlıktan genişlik/yükseklik; resim bozuksa null. */
export function imageSize(bytes, extension) {
  try {
    if (extension === ".png") return { width: view(bytes).getUint32(16), height: view(bytes).getUint32(20) };
    if (extension === ".jpg") return jpegSize(bytes);
    return webpSize(bytes);
  } catch { return null; }
}
