// Kitap şemasını Ajv ile derler. Yalnız Node tarafında kullanılır (Cloudflare Worker'da `new Function` yasaktır;
// orada worker/scripts/build-validator.mjs ile derleme zamanında üretilen hazır doğrulayıcı verilir).
import Ajv from "ajv";

export function compileBookValidator(bookSchema) {
  return new Ajv({ allErrors: true, strict: false }).compile(bookSchema.items);
}
