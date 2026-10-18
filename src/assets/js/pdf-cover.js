// Baskı kapağı PDF'inin ilk sayfasını tarayıcıda (pdf.js) çizer; ön ve arka kapak resimlerini üretir. Dosya bilgisayardan çıkmaz.
import { findArtwork, planCrops } from "./cover-crop.js";

const MAX_PIXELS = 28_000_000;       // ~110 MB bellek; çok büyük sayfalarda çözünürlük düşürülür
const RENDER_TIMEOUT_MS = 90_000;    // takılan PDF paneli kilitlemesin
let loading = null;

/** pdf.js yönetim sunucusundan (aynı kaynak) bir kez yüklenir; sayfa açılışını yavaşlatmaz. */
function loadPdfjs(libBase) {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${libBase}pdf.min.js`;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${libBase}pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => { loading = null; reject(new Error("PDF okuyucu yüklenemedi. Yönetim penceresinin açık olduğundan emin olun.")); };
    document.head.append(script);
  });
  return loading;
}

function cropToJpeg(source, box, maxWidth, quality) {
  const scale = Math.min(1, maxWidth / box.width);
  const out = document.createElement("canvas");
  out.width = Math.round(box.width * scale);
  out.height = Math.round(box.height * scale);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, box.left, box.top, box.width, box.height, 0, 0, out.width, out.height);
  const dataUrl = out.toDataURL("image/jpeg", quality);
  const size = { width: out.width, height: out.height };
  out.width = out.height = 0;
  return { dataUrl, ...size };
}

/**
 * file: PDF dosyası. Dönüş: { ok, front, back, spineCm, bookWidthCm, message }
 * front/back: { dataUrl (jpeg), width, height }. ok=false: ön kapak otomatik bulunamadı (message açıklar).
 */
export async function pdfToCovers(file, { libBase, dpi = 300, bookWidthCm, onStatus = () => {} } = {}) {
  onStatus("PDF açılıyor…");
  const pdfjs = await loadPdfjs(libBase);
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true }).promise;
  } catch (error) {
    throw new Error(error?.name === "PasswordException" ? "Bu PDF şifreli; şifresiz bir kopya yükleyin." : "PDF okunamadı. Dosya bozuk olabilir; kapağı resim olarak yüklemeyi deneyin.");
  }
  let page = null;
  let canvas = null;
  try {
    page = await doc.getPage(1);
    return await buildCovers({ page, dpi, bookWidthCm, onStatus, makeCanvas: (c) => { canvas = c; } });
  } finally {
    // Her bırakılan PDF bir okuyucu ve büyük bir tuval tutar: hata olsa da serbest bırakılır.
    if (canvas) canvas.width = canvas.height = 0;
    try { page?.cleanup(); } catch { /* yoksay */ }
    try { await doc.destroy(); } catch { /* yoksay */ }
  }
}

async function buildCovers({ page, dpi, bookWidthCm, onStatus, makeCanvas }) {
  const base = page.getViewport({ scale: 1 });
  const wIn = base.width / 72;
  const hIn = base.height / 72;
  const useDpi = wIn * hIn * dpi * dpi > MAX_PIXELS ? Math.floor(Math.sqrt(MAX_PIXELS / (wIn * hIn))) : dpi;
  const viewport = page.getViewport({ scale: useDpi / 72 });
  const canvas = document.createElement("canvas");
  makeCanvas(canvas);
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  onStatus("Kapak çiziliyor…");
  const task = page.render({ canvasContext: ctx, viewport });
  const timer = setTimeout(() => task.cancel(), RENDER_TIMEOUT_MS);
  try { await task.promise; }
  catch (error) { throw new Error(error?.name === "RenderingCancelledException" ? "PDF çok uzun sürdü ve durduruldu. Kapağı resim olarak yüklemeyi deneyin." : "PDF çizilemedi. Kapağı resim olarak yüklemeyi deneyin."); }
  finally { clearTimeout(timer); }
  onStatus("Ön ve arka kapak ayrılıyor…");
  const art = findArtwork(ctx.getImageData(0, 0, canvas.width, canvas.height));
  const plan = planCrops({ art, dpi: useDpi, bookWidthCm });
  if (!plan.ok) {
    canvas.width = canvas.height = 0;
    return { ok: false, front: null, back: null, spineCm: null, bookWidthCm: null, message: "Bu PDF'te ön ve arka kapağı otomatik bulamadım. Ön kapağı resim olarak yükleyin." };
  }
  const front = cropToJpeg(canvas, plan.front, 1200, 0.9);
  const back = cropToJpeg(canvas, plan.back, 800, 0.85);
  canvas.width = canvas.height = 0;
  return { ok: true, front, back, spineCm: plan.spineCm, bookWidthCm: plan.bookWidthCm, message: "" };
}
