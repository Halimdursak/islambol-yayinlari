// İslambol Yayınları — site.js (B1). Yalnızca mobil menü: aç/kapat, aria-expanded, Esc ile kapama.
const dugme = document.querySelector(".ust__menu-dugme");
const menu = dugme ? document.getElementById(dugme.getAttribute("aria-controls")) : null;

if (dugme && menu) {
  const masaustu = window.matchMedia("(min-width: 72rem)");

  const ayarla = (acik) => {
    menu.classList.toggle("is-acik", acik);
    dugme.setAttribute("aria-expanded", String(acik));
    dugme.textContent = acik ? dugme.dataset.kapat : dugme.dataset.ac;
  };

  dugme.addEventListener("click", () => ayarla(dugme.getAttribute("aria-expanded") !== "true"));

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
