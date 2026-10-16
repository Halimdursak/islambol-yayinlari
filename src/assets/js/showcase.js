// Manual campaign controls keep reading time in the visitor's hands.
for (const carousel of document.querySelectorAll("[data-carousel]")) {
  const slides = [...carousel.querySelectorAll("[data-slide]")];
  const controls = carousel.querySelector("[data-carousel-controls]");
  if (slides.length < 2 || !controls) continue;

  const dots = [...carousel.querySelectorAll("[data-slide-to]")];
  const status = carousel.querySelector("[data-slide-status]");
  let current = 0;

  function show(index) {
    current = (index + slides.length) % slides.length;
    for (const [position, slide] of slides.entries()) slide.hidden = position !== current;
    for (const [position, dot] of dots.entries()) {
      if (position === current) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    }
    if (status) status.textContent = `${current + 1} / ${slides.length}: ${slides[current].querySelector("h2")?.textContent ?? "Duyuru"}`;
  }

  carousel.querySelector("[data-slide-prev]")?.addEventListener("click", () => show(current - 1));
  carousel.querySelector("[data-slide-next]")?.addEventListener("click", () => show(current + 1));
  for (const dot of dots) dot.addEventListener("click", () => show(Number(dot.dataset.slideTo)));
  controls.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    show(current + (event.key === "ArrowRight" ? 1 : -1));
  });
  controls.hidden = false;
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
for (const shelf of document.querySelectorAll("[data-scroll-shelf]")) {
  const track = shelf.querySelector("[data-scroll-track]");
  const controls = shelf.querySelector("[data-scroll-controls]");
  const previous = shelf.querySelector("[data-scroll-prev]");
  const next = shelf.querySelector("[data-scroll-next]");
  if (!track || !controls || !previous || !next) continue;

  function update() {
    const overflowing = track.scrollWidth > track.clientWidth + 2;
    controls.hidden = !overflowing;
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  }
  function scroll(direction) {
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: reducedMotion.matches ? "instant" : "smooth" });
  }
  previous.addEventListener("click", () => scroll(-1));
  next.addEventListener("click", () => scroll(1));
  track.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(update).observe(track);
  update();
}
