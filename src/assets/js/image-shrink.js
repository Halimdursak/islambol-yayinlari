/* Bulut yönetim paneli: resimler sunucuya gitmeden önce tarayıcıda küçültülür (sunucuda resim işleme yoktur).
   Yerel panelde kullanılmaz; orada sunucu sharp ile küçültür. */
const MAX_WIDTH = { cover: 1200, back: 800, preview: 1400, image: 1600 };
const QUALITIES = [0.86, 0.78, 0.68, 0.58];

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

function drawn(bitmap, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";   // saydam PNG siyaha dönmesin
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Genişlik sınırını ve bayt sınırını aşan resmi JPEG'e küçültür; zaten uygunsa dosyayı olduğu gibi döndürür. */
export async function shrinkImage(file, kind, maxBytes) {
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { return file; }   // çözülemeyen dosyayı sunucu reddeder
  try {
    const limit = MAX_WIDTH[kind] ?? MAX_WIDTH.image;
    if (bitmap.width <= limit && file.size <= maxBytes) return file;
    let scale = Math.min(1, limit / bitmap.width);
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = drawn(bitmap, scale);
      for (const quality of QUALITIES) {
        const blob = await toBlob(canvas, "image/jpeg", quality);
        if (blob && blob.size <= maxBytes) return blob;
      }
      scale *= 0.85;
    }
    return file;
  } finally { bitmap.close?.(); }
}

/** Arka kapağın WebP eşi (tarayıcı WebP kodlayamıyorsa null: site JPEG ile de çalışır). */
export async function webpCompanion(file) {
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { return null; }
  try {
    const blob = await toBlob(drawn(bitmap, 1), "image/webp", 0.72);
    return blob && blob.type === "image/webp" ? blob : null;
  } finally { bitmap.close?.(); }
}
