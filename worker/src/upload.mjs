// Yüklenen resmin doğrulanması (Worker'da resim işleme yoktur: tarayıcı yüklemeden önce küçültür; burada yalnız başlık okunur).
import { CmsError } from "../../scripts/cms/content.mjs";
import { MAX_PIXELS, UPLOAD_KINDS, detectExtension, imageSize } from "../../scripts/cms/image-info.mjs";

/** Durable Object depolama değeri sınırı (2 MiB) altında kalmak için kodlanmış resim en çok bu kadar olabilir. */
export const MAX_UPLOAD_BYTES = 1_900_000;
export const UPLOAD_JSON_LIMIT = Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 4096;

export function decodeBase64(data) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** İstek gövdesini doğrular; { bytes, extension, width, height, kind } döndürür. */
export function prepareUpload(body) {
  if (typeof body.filename !== "string" || body.filename.length > 255 || typeof body.data !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data) || body.data.length % 4 !== 0) throw new CmsError(422, "Yüklenen resim bilgileri geçersiz.");
  const kind = body.kind ?? "image";
  if (!UPLOAD_KINDS.includes(kind)) throw new CmsError(422, "Yükleme türü geçersiz.");
  if (body.data.length > UPLOAD_JSON_LIMIT) throw new CmsError(413, "Resim çok büyük. Daha küçük bir dosya seçin.");
  const bytes = decodeBase64(body.data);
  if (!bytes.length) throw new CmsError(422, "Yüklenen resim bilgileri geçersiz.");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new CmsError(413, "Resim çok büyük. Daha küçük bir dosya seçin.");
  const extension = detectExtension(bytes);
  if (!extension) throw new CmsError(422, "Yalnızca gerçek PNG, JPEG veya WebP resimleri yüklenebilir.");
  const named = (body.filename.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
  if (!(extension === ".jpg" ? [".jpg", ".jpeg"] : [extension]).includes(named)) throw new CmsError(422, "Dosya uzantısı resim türüyle eşleşmiyor.");
  const size = imageSize(bytes, extension);
  if (!size || !size.width || !size.height || size.width * size.height > MAX_PIXELS) throw new CmsError(422, "Resim boyutları geçersiz veya çok büyük.");
  return { bytes, extension, kind, ...size };
}

export const CONTENT_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
