// Katalog süzgeci (B2) — bağımlılıksız ESM.
// URL ile eşitlenir: /kitaplar/?kategori=<slug>&yazar=<slug>&yil=<yyyy>&q=<metin>&onizleme=1
// JS yoksa form `hidden` kalır ve tüm liste görünür; bu betik formu açar (ilerlemeli iyileştirme).

const PARAMLAR = ["kategori", "yazar", "yil", "q", "onizleme"];
const ARAMA_GECIKMESI_MS = 120;

/** Türkçe duyarlı, aksan ve büyük/küçük harf farkını yok sayan karşılaştırma biçimi. */
function normla(metin) {
  return String(metin ?? "")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .trim();
}

function kumeOlustur(deger) {
  return new Set(String(deger ?? "").split(" ").filter(Boolean));
}

function kartlariOku(liste) {
  return [...liste.querySelectorAll(".kitap-karti")].map((el) => ({
    el,
    kategori: kumeOlustur(el.dataset.kategori),
    yazar: kumeOlustur(el.dataset.yazar),
    yil: el.dataset.yil ?? "",
    ara: normla(el.dataset.ara),
    onizlemeli: el.hasAttribute("data-onizlemeli"),
  }));
}

function izinliDegerler(form) {
  const kategoriler = new Set([...form.querySelectorAll("[data-kategori-cip]")].map((b) => b.dataset.kategoriCip).filter(Boolean));
  const secenek = (ad) => new Set([...form.querySelectorAll(`[data-alan="${ad}"] option`)].map((o) => o.value).filter(Boolean));
  return { kategori: kategoriler, yazar: secenek("yazar"), yil: secenek("yil") };
}

function durumuUrldenOku(izinli) {
  const p = new URLSearchParams(location.search);
  const al = (ad) => (izinli[ad].has(p.get(ad)) ? p.get(ad) : "");
  return { kategori: al("kategori"), yazar: al("yazar"), yil: al("yil"), q: p.get("q") ?? "", onizleme: p.get("onizleme") === "1" };
}

function urleYaz(durum, yontem) {
  const url = new URL(location.href);
  for (const ad of PARAMLAR) url.searchParams.delete(ad);
  if (durum.kategori) url.searchParams.set("kategori", durum.kategori);
  if (durum.yazar) url.searchParams.set("yazar", durum.yazar);
  if (durum.yil) url.searchParams.set("yil", durum.yil);
  if (durum.q) url.searchParams.set("q", durum.q);
  if (durum.onizleme) url.searchParams.set("onizleme", "1");
  const hedef = url.pathname + url.search + url.hash;
  if (hedef !== location.pathname + location.search + location.hash) history[yontem === "push" ? "pushState" : "replaceState"](null, "", hedef);
}

function uyar(durum, kart, aranan) {
  if (durum.kategori && !kart.kategori.has(durum.kategori)) return false;
  if (durum.yazar && !kart.yazar.has(durum.yazar)) return false;
  if (durum.yil && kart.yil !== durum.yil) return false;
  if (durum.onizleme && !kart.onizlemeli) return false;
  return !aranan || kart.ara.includes(aranan);
}

function baslat(form) {
  const liste = document.querySelector("[data-liste]");
  if (!liste) return;
  const bos = document.querySelector("[data-bos]");
  const sonucYeri = form.querySelector("[data-sonuc]");
  const temizleDugmeleri = document.querySelectorAll("[data-temizle]");
  const kategoriCipleri = [...form.querySelectorAll("[data-kategori-cip]")];
  const onizlemeCipi = form.querySelector("[data-onizlemeli-cip]");
  const yazarSecimi = form.querySelector('[data-alan="yazar"]');
  const yilSecimi = form.querySelector('[data-alan="yil"]');
  const aramaKutusu = form.querySelector('[data-alan="q"]');
  const sablon = form.dataset.sonucSablon ?? "{n}";
  const kartlar = kartlariOku(liste);
  const izinli = izinliDegerler(form);
  let durum = durumuUrldenOku(izinli);

  function denetimleriEsitle() {
    for (const cip of kategoriCipleri) cip.setAttribute("aria-pressed", String(cip.dataset.kategoriCip === durum.kategori));
    onizlemeCipi?.setAttribute("aria-pressed", String(durum.onizleme));
    if (yazarSecimi) yazarSecimi.value = durum.yazar;
    if (yilSecimi) yilSecimi.value = durum.yil;
    if (aramaKutusu && aramaKutusu.value !== durum.q) aramaKutusu.value = durum.q;
  }

  function uygula() {
    const aranan = normla(durum.q);
    let gorunen = 0;
    for (const kart of kartlar) {
      const goster = uyar(durum, kart, aranan);
      kart.el.hidden = !goster;
      if (goster) gorunen += 1;
    }
    sonucYeri.textContent = sablon.replace("{n}", gorunen);
    if (bos) bos.hidden = gorunen > 0;
    liste.hidden = gorunen === 0;
    const suzgecVar = Boolean(durum.kategori || durum.yazar || durum.yil || durum.q || durum.onizleme);
    for (const d of form.querySelectorAll("[data-temizle]")) d.hidden = !suzgecVar;
    denetimleriEsitle();
  }

  function degistir(degisiklik, yontem = "push") {
    durum = { ...durum, ...degisiklik };
    urleYaz(durum, yontem);
    uygula();
  }

  for (const cip of kategoriCipleri) cip.addEventListener("click", () => degistir({ kategori: cip.dataset.kategoriCip }));
  onizlemeCipi?.addEventListener("click", () => degistir({ onizleme: !durum.onizleme }));
  yazarSecimi?.addEventListener("change", () => degistir({ yazar: yazarSecimi.value }));
  yilSecimi?.addEventListener("change", () => degistir({ yil: yilSecimi.value }));

  let zamanlayici;
  aramaKutusu?.addEventListener("input", () => {
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(() => degistir({ q: aramaKutusu.value.trim() }, "replace"), ARAMA_GECIKMESI_MS);
  });
  form.addEventListener("submit", (olay) => olay.preventDefault());

  for (const d of temizleDugmeleri) {
    d.addEventListener("click", () => {
      degistir({ kategori: "", yazar: "", yil: "", q: "", onizleme: false });
      if (aramaKutusu) aramaKutusu.value = "";
    });
  }

  window.addEventListener("popstate", () => {
    durum = durumuUrldenOku(izinli);
    uygula();
  });

  uygula(); // form hâlâ gizliyken: canlı bölge ilk metni duyurmaz
  form.hidden = false;
}

const form = document.querySelector("[data-filtre]");
if (form) baslat(form);
