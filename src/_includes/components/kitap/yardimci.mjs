// B2 yardımcıları: kategori eşleme + meta üretimi. Eleventy şablonları değil, *.11tydata.js dosyaları içe aktarır.
// Kaynak: site.sozluk.kategoriler[{ad, slug, kaynak_adlari[]}] (Direktör) — eşleme verisi burada kodlanmaz.

const MAKS_BASLIK = 60;
const MAKS_ACIKLAMA = 155;
const MARKA = "İslambol Yayınları";

/** Karşılaştırma için: küçük harf (tr), tireler çevresindeki boşluklar silinir, boşluklar tekilleşir. */
function norm(s) {
  return String(s ?? "")
    .toLocaleLowerCase("tr")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kitapçı kategori adını parçalara böler ("A > B > Kitap > C" birleşik kayıtlarını ayırır). */
function parcalar(ad) {
  return String(ad)
    .split(/\s>\s(?=Kitap\s>\s)/)
    .map((p) => p.replace(/^(Kitap\s>\s)+/, "").trim())
    .filter(Boolean);
}

/** kategoriler → Map(norm(kaynak_adi) → kategori) */
export function kategoriIndeksi(kategoriler) {
  const harita = new Map();
  for (const k of kategoriler ?? []) {
    for (const ad of k.kaynak_adlari ?? []) harita.set(norm(ad), k);
  }
  return harita;
}

/** Bir kaynak yolu için önce tam eşleşme, sonra üst yola (son bölüm atılarak) eşleşme arar. */
function esleYol(yol, indeks) {
  const bolumler = yol.split(" > ");
  for (let n = bolumler.length; n >= 1; n--) {
    const bulunan = indeks.get(norm(bolumler.slice(0, n).join(" > ")));
    if (bulunan) return bulunan;
  }
  return null;
}

/** Kitabın `categories` alanını site kategorilerine çevirir → [{ad, slug}] (tekrarsız, sıralı). */
export function kategoriEsle(kitap, indeks) {
  const sonuc = new Map();
  for (const ham of kitap.categories ?? []) {
    for (const parca of parcalar(ham)) {
      const k = esleYol(parca, indeks);
      if (k && !sonuc.has(k.slug)) sonuc.set(k.slug, { ad: k.ad, slug: k.slug });
    }
  }
  return [...sonuc.values()];
}

/** Eşleşmeyen ham kategori adları (rapor için). */
export function eslesmeyenler(kitap, indeks) {
  const yok = [];
  for (const ham of kitap.categories ?? []) {
    for (const parca of parcalar(ham)) if (!esleYol(parca, indeks)) yok.push(parca);
  }
  return yok;
}

/** Kitap listesine `site_kategorileri` ekler (kaynak nesneyi değiştirmez). */
export function kategoriliKitaplar(kitaplar, kategoriler) {
  const indeks = kategoriIndeksi(kategoriler);
  return kitaplar.map((k) => ({ ...k, site_kategorileri: kategoriEsle(k, indeks) }));
}

// ---- Meta üretimi ---------------------------------------------------------

function kes(metin, maks) {
  if (metin.length <= maks) return metin;
  const parca = metin.slice(0, maks - 1);
  const bosluk = parca.lastIndexOf(" ");
  return (bosluk > maks * 0.6 ? parca.slice(0, bosluk) : parca).replace(/[\s,;:.\-–—]+$/, "") + "…";
}

function doldur(sablon, degerler) {
  return sablon.replace(/\{\{(\w+)\}\}/g, (_, ad) => degerler[ad] ?? "");
}

function ilkCumle(metin) {
  if (!metin) return "";
  const tek = metin.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
  const m = tek.match(/^(.+?[.!?…])(\s|$)/);
  return (m ? m[1] : tek).trim();
}

/** `{{baslik}} — {{yazar}} | …` şablonunu 60 karakter sınırında kurar; başlık gerekirse kısaltılır. */
function baslikSigdir(sablon, degerler, kisaltilacak) {
  let sonuc = doldur(sablon, degerler);
  if (sonuc.length <= MAKS_BASLIK) return sonuc;
  const fazla = sonuc.length - MAKS_BASLIK;
  const kisa = kes(degerler[kisaltilacak], Math.max(10, degerler[kisaltilacak].length - fazla));
  sonuc = doldur(sablon, { ...degerler, [kisaltilacak]: kisa });
  return sonuc;
}

export function kitapMeta(kitap, sablonlar) {
  const s = sablonlar.kitap;
  const yazar = kitap.yazar_gosterim ?? "";
  const sablonYazarsiz = s.title.replace(" — {{yazar}}", "");
  const sablonBaslik = yazar ? s.title : sablonYazarsiz;
  // Önce tam başlık + yazar; sığmazsa yazar ekini düşür; o da sığmazsa başlığı kısalt (Q1 bulgusu: kelime ortası kesme)
  const tam = doldur(sablonBaslik, { baslik: kitap.title, yazar });
  const title = tam.length <= MAKS_BASLIK ? tam
    : (doldur(sablonYazarsiz, { baslik: kitap.title, yazar }).length <= MAKS_BASLIK ? doldur(sablonYazarsiz, { baslik: kitap.title, yazar })
    : baslikSigdir(sablonYazarsiz, { baslik: kitap.title, yazar }, "baslik"));

  const ozet = ilkCumle(kitap.description) || (yazar ? `${MARKA}'ndan ${yazar} kitabı.` : `${MARKA} kitabı.`);
  let sablon = s.description;
  if (!kitap.pages) sablon = sablon.replace("{{sayfa_sayisi}} sayfa. ", "");
  const sabit = doldur(sablon, { ozet_ilk_cumle: "", sayfa_sayisi: String(kitap.pages ?? "") }).trim().length;
  const butce = Math.max(40, MAKS_ACIKLAMA - sabit - 1);
  const description = kes(
    doldur(sablon, { ozet_ilk_cumle: kes(ozet, butce), sayfa_sayisi: String(kitap.pages ?? "") }).replace(/\s+/g, " ").trim(),
    MAKS_ACIKLAMA,
  );
  return { title, description };
}

export function yazarMeta(yazar, sablonlar) {
  const s = sablonlar.yazar;
  let title = doldur(s.title, { yazar: yazar.display });
  if (title.length > MAKS_BASLIK) title = doldur(s.title.replace(" — Kitapları", ""), { yazar: yazar.display });
  const ilkUc = yazar.kitaplar.slice(0, 3).map((k) => k.title).join(", ");
  const description = kes(
    doldur(s.description, { yazar: yazar.display, kitap_sayisi: String(yazar.kitap_sayisi), ilk_uc_baslik: ilkUc }),
    MAKS_ACIKLAMA,
  );
  return { title, description };
}

export function diziMeta(dizi, sablonlar) {
  const s = sablonlar.dizi;
  const title = baslikSigdir(s.title, { dizi_adi: dizi.ad }, "dizi_adi");
  const sablon = dizi.aciklama ? s.description : s.description.replace("{{aciklama}} ", "");
  const description = kes(doldur(sablon, { dizi_adi: dizi.ad, aciklama: dizi.aciklama ?? "" }), MAKS_ACIKLAMA);
  return { title, description };
}

/** WhatsApp bağlantısı: kitap adı URL-kodlanır (site.json şablonundan bağımsız, books.js ile aynı biçim). */
export function whatsappBaglantisi(site, ad) {
  const taban = site.whatsapp_url ?? "https://wa.me/905059808735";
  return `${taban}?text=${encodeURIComponent(`Merhaba, "${ad}" kitabını sipariş etmek istiyorum.`)}`;
}

// ---- Tanıtım metni ----------------------------------------------------------

/** Kampanya/fiyat/kargo satırları (ADR-001: site fiyat göstermez). Kitabevi metinlerinden sızan paragrafları eler. */
const KAMPANYA = /(\d[\d.,]*\s*(TL|₺))|kargo|hediye|sipariş\s+hattı|whats?\s?ap/i;

/** Açıklamayı paragraflara böler; kampanya paragraflarını atar. */
export function aciklamaParagraflari(aciklama) {
  if (!aciklama) return [];
  return String(aciklama)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p); // kampanya temizliği veri katmanında (src/_data/books.js aciklamaTemizle); çift filtre açıklama kaybına yol açıyordu (Q3 H2)
}
