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
