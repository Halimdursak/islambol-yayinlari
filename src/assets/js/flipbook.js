/* Kitap önizleme — sayfa çevirme. Sahibi: B3.
   Tetikleyici: [data-onizleme="<kitap.id>"]. page-flip YALNIZ tıklamadan sonra dinamik yüklenir.
   Hareket azaltma tercihi veya modül hatası → düz dikey galeri (DESIGN.md §5: reduced-motion → dikey liste). */

const PAGE_FLIP_URL = new URL("../vendor/page-flip.module.js", import.meta.url).href;
/* Alt dizin barındırma: dialog data-prefix="{{ '/' | url }}" taşır; kök-göreli veri yolları (data-src, kaynaklar) buna göre öne eklenir. */
const ONEK = (document.querySelector("dialog.onizleme")?.dataset.prefix || "/").replace(/\/$/, "");
const yol = (u) => (u && ONEK && u.startsWith("/") && !u.startsWith(ONEK + "/") ? ONEK + u : u);
const TEK_SAYFA_MQ = "(max-width: 768px)";
const AZALT_MQ = "(prefers-reduced-motion: reduce)";
const ACILIS_ZAMAN_ASIMI = 8000;
const VARSAYILAN_ORAN = 0.65;

const diyalog = document.getElementById("onizleme");
if (diyalog) kur(diyalog);

function kur(dlg) {
  const $ = (s) => dlg.querySelector(s);
  const ogeler = {
    baslik: $("[data-onizleme-baslik]"),
    yazar: $("[data-onizleme-yazar]"),
    alan: $("[data-onizleme-alan]"),
    kutu: $("[data-onizleme-kitap-kutu]"),
    galeri: $("[data-onizleme-galeri]"),
    yukleniyor: $("[data-onizleme-yukleniyor]"),
    sayac: $("[data-onizleme-sayac]"),
    onceki: $("[data-onizleme-onceki]"),
    sonraki: $("[data-onizleme-sonraki]"),
  };
  const metin = { sayac: dlg.dataset.sayac, yukleniyor: dlg.dataset.yukleniyor, hata: dlg.dataset.hata };
  const tekSayfaMq = window.matchMedia(TEK_SAYFA_MQ);
  const azaltMq = window.matchMedia(AZALT_MQ);

  /** Açık oturum durumu; kapanınca sıfırlanır. */
  let oturum = null;
  let tetikleyici = null;

  document.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target.closest("[data-onizleme]") : null;
    if (!t) return;
    e.preventDefault();
    ac(t);
  });

  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-onizleme-kapat]")) dlg.close();
  });
  dlg.addEventListener("close", temizle);
  dlg.addEventListener("keydown", (e) => {
    if (!oturum || oturum.galeri || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") { e.preventDefault(); sonraki(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); onceki(); }
  });
  ogeler.onceki.addEventListener("click", onceki);
  ogeler.sonraki.addEventListener("click", sonraki);

  /* ---- veri ---- */
  function kitapOku(id) {
    const tpl = document.querySelector(`template[data-onizleme-kitap="${CSS.escape(id)}"]`);
    if (!tpl) return null;
    const sayfalar = [...tpl.content.querySelectorAll("li")].map((li) => {
      let kaynaklar = null;
      try { kaynaklar = li.dataset.kaynaklar ? JSON.parse(li.dataset.kaynaklar) : null; } catch { /* düz kaynağa düş */ }
      if (kaynaklar) for (const k of Object.keys(kaynaklar)) if (Array.isArray(kaynaklar[k])) kaynaklar[k] = kaynaklar[k].map((x) => ({ ...x, url: yol(x.url) }));
      return {
        src: yol(li.dataset.src),
        w: Number(li.dataset.w) || 0,
        h: Number(li.dataset.h) || 0,
        tur: li.dataset.tur || "",
        alt: li.dataset.alt || "",
        kaynaklar,
      };
    });
    return { baslik: tpl.dataset.baslik, yazar: tpl.dataset.yazar, sayfalar };
  }

  function sayfaOrani(sayfalar) {
    const ic = sayfalar.find((s) => s.w && s.h);
    return ic ? ic.w / ic.h : VARSAYILAN_ORAN;
  }

  /** En uygun webp genişliği (kaynaklar varsa), yoksa düz url. */
  function kaynakSec(s, hedefGenislik) {
    const liste = s.kaynaklar && s.kaynaklar.webp;
    if (!liste || !liste.length) return s.src;
    const sirali = [...liste].sort((a, b) => a.w - b.w);
    return (sirali.find((k) => k.w >= hedefGenislik) || sirali[sirali.length - 1]).url;
  }

  /* ---- açma / kapama ---- */
  function ac(t) {
    const kitap = kitapOku(t.dataset.onizleme);
    if (!kitap || !kitap.sayfalar.length) return;
    tetikleyici = t;
    oturum = { kitap, pf: null, galeri: false, mod: null, iptal: false, ro: null };
    ogeler.baslik.textContent = kitap.baslik;
    ogeler.yazar.textContent = kitap.yazar;
    ogeler.yukleniyor.textContent = metin.yukleniyor;
    ogeler.yukleniyor.hidden = false;
    document.documentElement.classList.add("onizleme-acik");
    dlg.showModal();
    if (azaltMq.matches) { galeriyeGec(false); return; }
    baslat(oturum);
  }

  function temizle() {
    const o = oturum;
    oturum = null;
    if (o) {
      o.iptal = true;
      clearTimeout(o.zamanAsimi);
      if (o.ro) o.ro.disconnect();
      if (o.mqDinle) tekSayfaMq.removeEventListener("change", o.mqDinle);
      pfYokEt(o);
    }
    ogeler.kutu.replaceChildren();
    ogeler.kutu.removeAttribute("style");
    ogeler.kutu.removeAttribute("data-durum");
    ogeler.kutu.hidden = false;
    ogeler.galeri.replaceChildren();
    ogeler.galeri.hidden = true;
    dlg.removeAttribute("data-galeri");
    ogeler.sayac.textContent = "";
    document.documentElement.classList.remove("onizleme-acik");
    if (tetikleyici && tetikleyici.isConnected) tetikleyici.focus({ preventScroll: true });
    tetikleyici = null;
  }

  function pfYokEt(o) {
    if (!o.pf) return;
    try { o.pf.destroy(); } catch { /* kapanırken yoksay */ }
    o.pf = null;
    ogeler.kutu.replaceChildren();
  }

  /* ---- page-flip ---- */
  async function baslat(o) {
    let PageFlip;
    try {
      ({ PageFlip } = await import(PAGE_FLIP_URL));
    } catch (err) {
      console.warn("page-flip yüklenemedi, galeriye düşülüyor", err);
      if (!o.iptal) galeriyeGec(true);
      return;
    }
    if (o.iptal) return;
    o.PageFlip = PageFlip;
    o.mqDinle = () => { if (oturum === o && !o.galeri) yenidenKur(o); };
    tekSayfaMq.addEventListener("change", o.mqDinle);
    o.ro = new ResizeObserver(() => { if (oturum === o && !o.galeri) boyutla(o); });
    o.ro.observe(ogeler.alan);
    kitapKur(o, 0);
  }

  function yenidenKur(o) {
    const sayfa = o.pf ? o.pf.getCurrentPageIndex() : 0;
    pfYokEt(o);
    kitapKur(o, sayfa);
  }

  function kitapKur(o, baslangic) {
    const tek = tekSayfaMq.matches;
    o.mod = tek ? "tek" : "cift";
    o.oran = sayfaOrani(o.kitap.sayfalar);
    ogeler.kutu.dataset.mod = o.mod;
    const boy = boyutHesapla(o);
    if (!boy.w || !boy.h) {
      requestAnimationFrame(() => { if (oturum === o && !o.galeri) kitapKur(o, baslangic); });
      return;
    }
    const sayfaGenislik = tek ? boy.w : boy.w / 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const imgler = o.kitap.sayfalar.map((s) => kaynakSec(s, sayfaGenislik * dpr));

    try {
      const pf = new o.PageFlip(ogeler.kutu, {
        width: 400,
        height: Math.round(400 / o.oran),
        size: "stretch",
        minWidth: tek ? 1000 : 1, // portre/yatay modu biz seçiyoruz: tek → hep portre (e < 2·minWidth)
        maxWidth: 4000,
        minHeight: 1,
        maxHeight: 4000,
        showCover: true,
        usePortrait: tek,
        mobileScrollSupport: false,
        flippingTime: 700,
        maxShadowOpacity: 0.45,
        startPage: baslangic,
      });
      o.pf = pf;
      pf.on("flip", () => durumGuncelle(o));
      pf.on("changeOrientation", () => durumGuncelle(o));
      pf.on("init", () => { clearTimeout(o.zamanAsimi); ogeler.yukleniyor.hidden = true; durumGuncelle(o); });
      pf.loadFromImages(imgler);
      boyutUygula(boy); // kütüphane arayüzü loadFromImages'ta kurar; boyut ondan SONRA sabitlenmeli
    } catch (err) {
      console.warn("page-flip başlatılamadı, galeriye düşülüyor", err);
      pfYokEt(o);
      galeriyeGec(true);
      return;
    }
    // "init" gelmezse kullanıcıyı boş sahnede bırakma.
    clearTimeout(o.zamanAsimi);
    o.zamanAsimi = setTimeout(() => {
      if (oturum === o && !o.galeri && !ogeler.yukleniyor.hidden) galeriyeGec(true);
    }, ACILIS_ZAMAN_ASIMI);
    durumGuncelle(o);
  }

  function boyutHesapla(o) {
    const aw = ogeler.alan.clientWidth;
    const ah = ogeler.alan.clientHeight;
    const tek = o.mod === "tek";
    const sayfaGenislikMax = tek ? aw : aw / 2;
    const sayfaGenislik = Math.max(0, Math.min(sayfaGenislikMax, ah * o.oran));
    return {
      w: Math.floor(sayfaGenislik * (tek ? 1 : 2)),
      h: Math.floor(sayfaGenislik / o.oran),
    };
  }

  /** Kütüphane kendi yerleşimini (width:100%, min/max-width) kurucuda yazar; kutuyu tam sayfa boyuna sabitleriz. */
  function boyutUygula(boy) {
    const st = ogeler.kutu.style;
    st.width = `${boy.w}px`;
    st.height = `${boy.h}px`;
    st.minWidth = "0";
    st.minHeight = "0";
    st.maxWidth = "none";
  }

  function boyutla(o) {
    if (!o.pf) return;
    const boy = boyutHesapla(o);
    if (!boy.w || !boy.h) return;
    boyutUygula(boy);
    try { o.pf.update(); } catch { /* yoksay */ }
  }

  function durumGuncelle(o) {
    if (!o.pf || oturum !== o) return;
    const toplam = o.pf.getPageCount();
    const i = o.pf.getCurrentPageIndex();
    const portre = o.pf.getOrientation() === "portrait";
    let n;
    if (portre || i === 0) n = String(i + 1);
    else n = i + 2 > toplam ? String(i + 1) : `${i + 1}–${i + 2}`;
    ogeler.sayac.textContent = metin.sayac.replace("{n}", n).replace("{toplam}", String(toplam));
    // İlk sayfa tek başına sağ yarıda, son sayfa (çift sayıda ise) tek başına sol yarıda durur:
    // kutuyu ortala, boş yarıyı kırp; cilt gölgesi yalnız açık yayılımda.
    let durum = "acik";
    if (!portre && i === 0) durum = "ilk";
    else if (!portre && i === toplam - 1) durum = "son";
    ogeler.kutu.dataset.durum = durum;
    ogeler.onceki.setAttribute("aria-disabled", String(i <= 0));
    const son = portre ? i >= toplam - 1 : i + 2 >= toplam;
    ogeler.sonraki.setAttribute("aria-disabled", String(son));
  }

  function sonraki() {
    if (oturum && oturum.pf && ogeler.sonraki.getAttribute("aria-disabled") !== "true") oturum.pf.flipNext();
  }
  function onceki() {
    if (oturum && oturum.pf && ogeler.onceki.getAttribute("aria-disabled") !== "true") oturum.pf.flipPrev();
  }

  /* ---- düz galeri (reduced-motion ve hata yedeği) ---- */
  function galeriyeGec(hataMi) {
    const o = oturum;
    if (!o) return;
    clearTimeout(o.zamanAsimi);
    if (o.ro) { o.ro.disconnect(); o.ro = null; }
    pfYokEt(o);
    o.galeri = true;
    dlg.dataset.galeri = "";
    ogeler.kutu.hidden = true;
    ogeler.yukleniyor.textContent = hataMi ? metin.hata : "";
    ogeler.yukleniyor.hidden = !hataMi;
    ogeler.sayac.textContent = "";
    ogeler.galeri.replaceChildren(
      ...o.kitap.sayfalar.map((s, i) => {
        const li = document.createElement("li");
        const img = document.createElement("img");
        img.src = kaynakSec(s, 900);
        img.alt = s.alt;
        if (s.w && s.h) { img.width = s.w; img.height = s.h; }
        img.decoding = "async";
        if (i > 1) img.loading = "lazy";
        li.append(img);
        return li;
      }),
    );
    ogeler.galeri.hidden = false;
  }
}
