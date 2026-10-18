// Düz ön kapaktan "kitap şeklinde" (hafif döndürülmüş, sırtı ve gölgesi olan) şeffaf zeminli paylaşım görseli üretir.
// Yapay zekâ değil: kapak dikey dilimlere bölünüp perspektifle yeniden çizilir; aynı kapaktan hep aynı sonuç çıkar, internet gerekmez.
const DEG = Math.PI / 180;

/** Kapağın sol kenarından ortalama renk (sırt rengi için). */
function edgeColor(img) {
  const probe = document.createElement("canvas");
  probe.width = 1; probe.height = 1;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, Math.max(2, Math.round(img.naturalWidth * 0.03)), img.naturalHeight, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}
const shade = ([r, g, b], k) => `rgb(${Math.round(r * k)} ${Math.round(g * k)} ${Math.round(b * k)})`;

/**
 * img: yüklenmiş HTMLImageElement (ön kapak). Döner: <canvas> (size × size, şeffaf zemin).
 * yawDeg: kitabın dönüş açısı (sırt solda görünür); thickness: kitap kalınlığının kapak genişliğine oranı.
 */
export function renderBookMockup(img, { size = 1400, yawDeg = 24, thickness = 0.1 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const aspect = img.naturalHeight / img.naturalWidth;
  const H = Math.min(size * 0.76, (size * 0.62) * aspect);   // geniş/çok uzun kapaklar da çerçeveye sığsın
  const W = H / aspect;
  const T = W * thickness;
  const D = size * 3.4;                                       // kamera uzaklığı: büyüdükçe perspektif yumuşar
  const yaw = yawDeg * DEG;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const rot = (x, z) => ({ X: x * cos + z * sin, Z: -x * sin + z * cos });
  const persp = (Z) => D / (D - Z);
  const cy = size * 0.47;

  // Yatayda ortala: ön yüzün sağ ucu ile sırtın sol ucu arasının orta noktası
  const left = rot(-W / 2, -T);
  const right = rot(W / 2, 0);
  const cx = size / 2 - ((left.X * persp(left.Z) + right.X * persp(right.Z)) / 2);

  // Zemin gölgesi
  const base = rot(0, -T / 2);
  const shadowW = (right.X * persp(right.Z) - left.X * persp(left.Z)) * 0.62;
  const shadowY = cy + (H / 2) * persp(base.Z) + size * 0.012;
  const g = ctx.createRadialGradient(cx + base.X, shadowY, 4, cx + base.X, shadowY, shadowW);
  g.addColorStop(0, "rgba(0,0,0,0.34)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.translate(0, shadowY);
  ctx.scale(1, 0.085);
  ctx.translate(0, -shadowY);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx + base.X, shadowY, shadowW, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sırt (solda görünen yan yüz): kapağın kenar renginden, öne doğru açık → arkaya doğru koyu
  const color = edgeColor(img);
  const spineSlices = 24;
  for (let i = 0; i < spineSlices; i++) {
    const v0 = i / spineSlices;
    const v1 = (i + 1) / spineSlices;
    const a = rot(-W / 2, -T * v0);
    const b = rot(-W / 2, -T * v1);
    const sa = persp(a.Z);
    const sb = persp(b.Z);
    const x0 = cx + b.X * sb;
    const x1 = cx + a.X * sa;
    const hMid = H * ((sa + sb) / 2);
    ctx.fillStyle = shade(color, 0.78 - 0.32 * v0);
    ctx.fillRect(x0 - 0.5, cy - hMid / 2, x1 - x0 + 1, hMid);
  }

  // Ön yüz: dikey dilimler, her biri kendi derinliğine göre ölçeklenir (gerçek perspektif)
  const p0 = rot(-W / 2, 0);
  const frontLeft = cx + p0.X * persp(p0.Z);
  const frontRight = cx + right.X * persp(right.Z);
  const slices = Math.max(8, Math.ceil(frontRight - frontLeft));
  for (let i = 0; i < slices; i++) {
    const u0 = i / slices;
    const u1 = (i + 1) / slices;
    const a = rot(-W / 2 + u0 * W, 0);
    const b = rot(-W / 2 + u1 * W, 0);
    const sa = persp(a.Z);
    const sb = persp(b.Z);
    const x0 = cx + a.X * sa;
    const x1 = cx + b.X * sb;
    const hMid = H * ((sa + sb) / 2);
    ctx.drawImage(img, u0 * img.naturalWidth, 0, (u1 - u0) * img.naturalWidth, img.naturalHeight, x0, cy - hMid / 2, x1 - x0 + 0.7, hMid);
  }

  // Işık: sol kenarda hafif parlama, sağa doğru yumuşak kararma; yalnız çizili piksellerin üstüne
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const light = ctx.createLinearGradient(frontLeft, 0, frontRight, 0);
  light.addColorStop(0, "rgba(255,255,255,0.16)");
  light.addColorStop(0.08, "rgba(255,255,255,0)");
  light.addColorStop(0.75, "rgba(0,0,0,0)");
  light.addColorStop(1, "rgba(0,0,0,0.20)");
  ctx.fillStyle = light;
  ctx.fillRect(frontLeft - 2, 0, frontRight - frontLeft + 4, size);
  ctx.restore();

  // Cilt payı: ön yüzün sol kenarında ince koyu çizgi (kitabın "mafsalı")
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(frontLeft, cy - (H * persp(p0.Z)) / 2, 1.6, H * persp(p0.Z));
  return canvas;
}

/** PNG veri adresi (indirme bağlantısı ve önizleme için; CSP img-src data: izin verir). */
export function mockupDataUrl(img, options) {
  const canvas = renderBookMockup(img, options);
  const url = canvas.toDataURL("image/png");
  canvas.width = canvas.height = 0;      // büyük tuvalin belleği hemen bırakılır
  return url;
}
