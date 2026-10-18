// İslambol Yayınları — site.js: dar ekran menü paneli (aç/kapat, aria-expanded, Esc) ve arama simgesi.
const dugme = document.querySelector(".ust__menu-dugme");
const menu = dugme ? document.getElementById(dugme.getAttribute("aria-controls")) : null;

if (dugme && menu) {
  const masaustu = window.matchMedia("(min-width: 68.75rem)");
  const araDugme = document.querySelector(".ust__ara-dugme");

  const ayarla = (acik) => {
    menu.classList.toggle("is-acik", acik);
    document.documentElement.classList.toggle("menu-acik", acik);   // panel açıkken arka sayfa kaymasın
    dugme.setAttribute("aria-expanded", String(acik));
    dugme.textContent = acik ? dugme.dataset.kapat : dugme.dataset.ac;
  };

  dugme.addEventListener("click", (olay) => {
    const acilacak = dugme.getAttribute("aria-expanded") !== "true";
    ayarla(acilacak);
    // Klavyeyle (Enter/Boşluk: detail === 0) açılınca odak panelin ilk öğesine geçer; DOM sırasında panel düğmeden önce
    // olduğu için Tab aksi hâlde sayfa içeriğine giderdi (WCAG 2.4.3). Dokunma/fare odağı değiştirmez.
    if (acilacak && olay.detail === 0) menu.querySelector("a, input, button")?.focus();
  });

  // Arama simgesi paneli açar ve arama kutusuna odaklanır (panelde arama en üsttedir).
  araDugme?.addEventListener("click", () => {
    ayarla(true);
    document.getElementById("ust-arama")?.focus();
  });

  document.addEventListener("keydown", (olay) => {
    if (olay.key === "Escape" && dugme.getAttribute("aria-expanded") === "true") {
      ayarla(false);
      dugme.focus();
    }
  });

  // Masaüstü genişliğine geçilince panel durumu sıfırlanır.
  masaustu.addEventListener("change", (olay) => {
    if (olay.matches) ayarla(false);
  });
}

// Uzun listelerde (katalog, yazarlar, setler) iki ekran aşağıda "başa dön" düğmesi belirir; yalnız dar ekranda görünür (CSS).
if (document.querySelector(".katalog")) {
  const basaDon = document.createElement("button");
  basaDon.type = "button";
  basaDon.className = "basa-don";
  basaDon.setAttribute("aria-label", "Sayfanın başına dön");
  basaDon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.append(basaDon);

  let bekliyor = false;
  const guncelle = () => {
    bekliyor = false;
    basaDon.classList.toggle("is-gorunur", window.scrollY > window.innerHeight * 1.5);
  };
  window.addEventListener("scroll", () => {
    if (!bekliyor) { bekliyor = true; requestAnimationFrame(guncelle); }
  }, { passive: true });
  basaDon.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("icerik")?.focus({ preventScroll: true });
  });
  guncelle();
}

// Kitap sayfası: ön / arka kapak seçici. Düğmeler JS yokken gizli kalır (noscript bağlantısı arka kapağı açar).
const kapakSecici = document.querySelector("[data-kapak-secici]");
if (kapakSecici) {
  const yuzler = document.querySelectorAll(".kitap-detay__kapak [data-kapak-yuzu]");
  const dugmeler = kapakSecici.querySelectorAll("button[data-yuz]");
  const buyut = kapakSecici.querySelector("[data-buyut]");
  kapakSecici.hidden = false;
  dugmeler.forEach((d) => d.addEventListener("click", () => {
    dugmeler.forEach((x) => x.setAttribute("aria-pressed", String(x === d)));
    yuzler.forEach((y) => { y.hidden = y.dataset.kapakYuzu !== d.dataset.yuz; });
    if (buyut) buyut.hidden = d.dataset.yuz !== "arka";
  }));
}
