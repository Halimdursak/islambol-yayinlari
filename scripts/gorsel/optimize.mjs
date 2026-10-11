// npm run gorsel [-- --force]  →  kapak/önsöz optimizasyonu + logo + favicon + OG görselleri.
// Idempotent: çıktı kaynaktan yeniyse atlanır; --force ile yeniden üretilir.
import { kapaklariIsle, onsozleriIsle } from "./kapak.mjs";
import { markaGorselleriniUret } from "./marka.mjs";
import { yol, dizinDosyalari, toplamBayt, mb } from "./ortak.mjs";

const force = process.argv.includes("--force");
const gorsel = (d) => /\.(jpe?g|png|webp)$/i.test(d);
const boyut = (...p) => toplamBayt(dizinDosyalari(yol(...p), gorsel));
const sayi = (...p) => dizinDosyalari(yol(...p), gorsel).length;

const t0 = Date.now();
const kapak = await kapaklariIsle(force);
const onsoz = await onsozleriIsle(force);
const marka = await markaGorselleriniUret(force);

const satir = (ad, ozet, onceMB, sonraMB, dosyaSayisi) =>
  `${ad.padEnd(16)} ${String(ozet).padEnd(26)} ${String(dosyaSayisi).padStart(5)} dosya   önce ${String(onceMB).padStart(7)} MB   sonra ${String(sonraMB).padStart(7)} MB`;
console.log("\n=== Görsel optimizasyon özeti ===");
console.log(satir("Kapaklar", `${kapak.islenen} işlendi, ${kapak.atlanan} atlandı`, mb(boyut("public", "kapaklar")), mb(boyut("public", "kapaklar-opt")), sayi("public", "kapaklar-opt")));
console.log(satir("Önsöz sayfaları", `${onsoz.islenen} işlendi, ${onsoz.atlanan} atlandı`, mb(boyut("public", "onsoz")), mb(boyut("public", "onsoz-opt")), sayi("public", "onsoz-opt")));
console.log(satir("Logo/favicon", `${marka.islenen} üretildi, ${marka.atlanan} atlandı`, "-", mb(marka.markaBayt), marka.markaDosya));
console.log(satir("OG (1200x630)", `${marka.ogIslenen} üretildi, ${marka.ogAtlanan} atlandı`, "-", mb(boyut("public", "og")), sayi("public", "og")));
console.log(`Süre: ${((Date.now() - t0) / 1000).toFixed(1)} sn`);
