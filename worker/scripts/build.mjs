// Worker'ı tek bir ES modülüne paketler (Windows'ta wrangler/esbuild.exe çalışmadığı için esbuild-wasm kullanılır).
// Üretilenler (worker/generated, worker/dist) git'e girmez:
//   validate-book.cjs  kitap şemasından derleme zamanında üretilmiş doğrulayıcı (Workers'ta çalışma anında kod üretimi yasaktır)
//   data.mjs           önizlemesi olan kitapların kısa adları + kategori listesi
//   assets.mjs         yönetim sayfası dosyaları (HTML, CSS, JS, yazı tipleri, pdf.js)
//   dist/worker.mjs    paketlenmiş Worker
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone/index.js";
import { publisherPreviewSlugs } from "../../scripts/cms/site-fs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "../..");
const GENERATED = join(ROOT, "worker/generated");
const DIST = join(ROOT, "worker/dist");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const VENDOR = { "/yonetim-lib/pdfjs/pdf.min.js": "scripts/cms/vendor/pdfjs/pdf.min.js", "/yonetim-lib/pdfjs/pdf.worker.min.js": "scripts/cms/vendor/pdfjs/pdf.worker.min.js" };
export const MAX_COMPRESSED_BYTES = 2_800_000;   // Ücretsiz plan sınırı 3 MB (sıkıştırılmış)

const extensionOf = (path) => path.slice(path.lastIndexOf(".")).toLowerCase();
const stripFrontMatter = (source) => source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

/** Kitap şemasından, çalışma anında `new Function` gerektirmeyen bağımsız doğrulayıcı üretir. */
export async function buildValidator(root = ROOT) {
  const schema = JSON.parse(await readFile(join(root, "data/catalog/books.schema.json"), "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false, code: { source: true } });
  const code = standaloneCode(ajv, ajv.compile(schema.items));
  await mkdir(GENERATED, { recursive: true });
  await writeFile(join(GENERATED, "validate-book.cjs"), code);
  return code.length;
}

export async function buildData(root = ROOT) {
  const dictionary = JSON.parse(await readFile(join(root, "data/site/sozluk.json"), "utf8"));
  const slugs = [...await publisherPreviewSlugs(root)].sort();
  const categories = (dictionary.kategoriler ?? []).map(({ ad, slug }) => ({ ad, slug }));
  await mkdir(GENERATED, { recursive: true });
  await writeFile(join(GENERATED, "data.mjs"), `export const PREVIEW_SLUGS = ${JSON.stringify(slugs)};\nexport const CATEGORIES = ${JSON.stringify(categories)};\n`);
  return { previews: slugs.length, categories: categories.length };
}

function sourceFor(root, urlPath) {
  if (VENDOR[urlPath]) return join(root, VENDOR[urlPath]);
  if (urlPath.startsWith("/assets/")) return join(root, "src", urlPath);
  return join(root, "public", urlPath);
}

/** HTML'den başlayıp CSS (url) ve JS (import) bağlantılarını izleyerek gereken tüm dosyaları toplar. */
async function discover(root) {
  const html = stripFrontMatter(await readFile(join(root, "src/yonetim.njk"), "utf8"));
  if (/\{\{|\{%/.test(html)) throw new Error("src/yonetim.njk şablon etiketi içeriyor; Worker gömülü HTML'i düz olmalı.");
  const assets = { "/yonetim/": { type: MIME[".html"], text: html } };
  const queue = [...html.matchAll(/(?:href|src)="(\/[^"#?]+)"/g)].map((match) => match[1]).filter((path) => !path.startsWith("/yonetim"));
  queue.push(...Object.keys(VENDOR));
  while (queue.length) {
    const path = queue.shift();
    if (assets[path]) continue;
    const type = MIME[extensionOf(path)];
    if (!type) throw new Error(`Desteklenmeyen dosya türü: ${path}`);
    const bytes = await readFile(sourceFor(root, path));
    if (type.startsWith("text/") || type.startsWith("image/svg")) {
      const text = bytes.toString("utf8");
      assets[path] = { type, text };
      const directory = posix.dirname(path);
      if (path.endsWith(".css")) for (const match of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) if (!/^(data:|https?:)/.test(match[1])) queue.push(posix.normalize(posix.join(directory, match[1])));
      if (path.endsWith(".js") && !path.includes("/pdfjs/")) for (const match of text.matchAll(/(?:^|\n)\s*import\s[^"']*["'](\.\/[^"']+)["']/g)) queue.push(posix.normalize(posix.join(directory, match[1])));
    } else {
      assets[path] = { type, base64: bytes.toString("base64") };
    }
  }
  return assets;
}

export async function buildAssets(root = ROOT) {
  const assets = await discover(root);
  const ordered = Object.fromEntries(Object.entries(assets).sort(([a], [b]) => (a < b ? -1 : 1)));
  const version = createHash("sha256").update(JSON.stringify(ordered)).digest("hex").slice(0, 16);
  await mkdir(GENERATED, { recursive: true });
  await writeFile(join(GENERATED, "assets.mjs"), `export const VERSION = ${JSON.stringify(version)};\nexport const ASSETS = ${JSON.stringify(ordered)};\n`);
  return { version, files: Object.keys(ordered) };
}

export async function bundle(root = ROOT) {
  const esbuild = await import("esbuild-wasm");
  await esbuild.initialize({ worker: false });
  try {
    const result = await esbuild.build({
      entryPoints: [join(root, "worker/src/index.mjs")], bundle: true, format: "esm", platform: "neutral", target: "es2022", write: false, minify: true,
      mainFields: ["module", "main"], conditions: ["workerd", "worker", "browser"], legalComments: "none", logLevel: "silent",
    });
    const code = result.outputFiles[0].text;
    await mkdir(DIST, { recursive: true });
    await writeFile(join(DIST, "worker.mjs"), code);
    return { bytes: Buffer.byteLength(code), compressed: gzipSync(code).length };
  } finally { await esbuild.stop(); }
}

export async function buildAll(root = ROOT) {
  await buildValidator(root);
  const data = await buildData(root);
  const assets = await buildAssets(root);
  const worker = await bundle(root);
  if (worker.compressed > MAX_COMPRESSED_BYTES) throw new Error(`Worker çok büyük: ${worker.compressed} bayt sıkıştırılmış (sınır ${MAX_COMPRESSED_BYTES}).`);
  return { data, assets, worker };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildAll();
  console.log(`Worker derlendi: ${(result.worker.bytes / 1024).toFixed(0)} KB (sıkıştırılmış ${(result.worker.compressed / 1024).toFixed(0)} KB), ${result.assets.files.length} gömülü dosya, sürüm ${result.assets.version}.`);
}
