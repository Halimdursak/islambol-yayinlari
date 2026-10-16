// İslambol Yayınları — site.js: dar ekran menü paneli (aç/kapat, aria-expanded, Esc) ve arama simgesi.
const dugme = document.querySelector(".ust__menu-dugme");
const menu = dugme ? document.getElementById(dugme.getAttribute("aria-controls")) : null;

if (dugme && menu) {
  const masaustu = window.matchMedia("(min-width: 68.75rem)");
  const araDugme = document.querySelector(".ust__ara-dugme");

  const ayarla = (acik) => {
    menu.classList.toggle("is-acik", acik);
    dugme.setAttribute("aria-expanded", String(acik));
    dugme.textContent = acik ? dugme.dataset.kapat : dugme.dataset.ac;
  };

  dugme.addEventListener("click", () => ayarla(dugme.getAttribute("aria-expanded") !== "true"));

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
