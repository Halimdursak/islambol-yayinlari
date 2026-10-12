# -*- coding: utf-8 -*-
"""Q4 İçerik Doğrulayıcı: dist/ çıktısını katalog ve site verisine karşı denetler.

Kullanım (proje kökünden; önce `npm run build`):
    python -I -X utf8 scripts/qa/dogrula.py [--dis-yok] [--dis-ornek 15]

Çıktı: docs/qa/ICERIK-DOGRULAMA.md
Çıkış kodu: en az bir KALDI sonucu varsa 1, yoksa 0.
DOĞRULANAMADI sonuçları (403/Cloudflare, ağ hatası, zaman aşımı) hata sayılmaz.
Yalnızca standart kütüphane kullanır. Kaynak dosyaları değiştirmez.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html as htmllib
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

KOK = Path(__file__).resolve().parents[2]
DIST = KOK / "dist"
CATALOG = KOK / "data" / "catalog"
SITE = KOK / "data" / "site"
RAPOR = KOK / "docs" / "qa" / "ICERIK-DOGRULAMA.md"

SITE_URL = "https://adursak63.github.io/islambol-yayinlari"
WA_ANAHTAR = "wa.me/905059808735"
TOHUM = 20261011
UA = "Mozilla/5.0 (compatible; IslambolQA/1.0; +https://adursak63.github.io/islambol-yayinlari/)"
STATIK_SAYFALAR = ("hakkimizda", "yayin-cizgisi", "nereden-alinir", "iletisim",
                   "onizleme-hakkinda", "kvkk-ve-cerezler", "404.html")
KITAP_ALANLARI = ("kitap", "yazar", "yazarlar", "kitaplar", "dizi", "diziler")
RESIM_UZANTILARI = (".jpg", ".jpeg", ".png", ".webp", ".avif", ".svg")
DIS_ATLANAN_ONEK = ("http://", "https://", "//", "mailto:", "tel:", "javascript:", "data:", "#")

SAHIP_KITAP = "B2 (kitap şablonu)"
SAHIP_YAZAR = "B2 (yazar şablonu)"
SAHIP_ANA = "B1 (ana sayfa)"
SAHIP_VERI = "R1 (katalog verisi)"
SAHIP_LOADER = "Direktör (src/_data)"
SAHIP_SITE_METNI = "D2 (site metni)"
SAHIP_STATIK = "B1 (statik şablon)"

YASAKLI_TEKNIK = [
    ("null", r"(?<![\w-])null(?![\w-])", 0),
    ("undefined", r"undefined", 0),
    ("[[SORU", re.escape("[[SORU"), 0),
    ("NaN", r"(?<!\w)NaN(?!\w)", 0),
    ("[object Object]", re.escape("[object Object]"), 0),
    ("U+FFFD", "�", 0),
    ("mojibake", "Ã[\u0080-¿]|Ä[\u0080-¿]|Å[\u0080-¿]|Â[\u0080-¿]", 0),
    ("{{", re.escape("{{"), 0),
    ("{%", re.escape("{%"), 0),
    ("TODO", "TODO", 0),
]
YASAKLI_TICARI = [
    ("fiyat (N TL)", r"\d+\s*TL\b", re.IGNORECASE),
    ("kargo ücretsiz", r"kargo\s+ücretsiz", re.IGNORECASE),
    ("indirim", r"indirim", re.IGNORECASE),
    ("kampanya", r"kampanya", re.IGNORECASE),
]
YONERGE_DESENI = r"Koşullu paragraf|Yönerge|doldurulacak|kaldırılacak|yazılır|eklenecek|\[\["


# ---------------------------------------------------------------- yardımcılar

def norm(deger):
    """HTML entity'lerini çözer, NBSP ve çoklu boşlukları tek boşluğa indirir."""
    if deger is None:
        return ""
    metin = htmllib.unescape(str(deger)).replace(" ", " ").replace("’", "'").replace("‘", "'").replace("…", "...")  # tipografi dönüşümüne duyarsız
    return re.sub(r"\s+", " ", metin).strip()


def url_norm(url):
    return norm(url).rstrip("/").replace("http://", "https://", 1).lower()


def other_ogeleri(kaynak):
    """sources.other öğeleri metin ya da {name, url} nesnesi olabilir; (ad, url) listesi döndürür."""
    sonuc = []
    for oge in (kaynak.get("other") or []):
        if isinstance(oge, dict):
            sonuc.append((str(oge.get("name") or "other"), oge.get("url")))
        else:
            sonuc.append(("other", oge))
    return sonuc


def gorunur_html(ham):
    """Script ve style içeriğini çıkarır; kalan HTML metin ve öznitelikleri içerir."""
    temiz = re.sub(r"<script\b.*?</script>", " ", ham, flags=re.S | re.I)
    return re.sub(r"<style\b.*?</style>", " ", temiz, flags=re.S | re.I)


def sahip_sayfa(rel):
    """Dist'teki göreli yoldan sorumlu ekibi tahmin eder."""
    if rel == "index.html":
        return SAHIP_ANA
    ilk = rel.split("/")[0]
    if ilk in STATIK_SAYFALAR[:6]:
        return f"{SAHIP_SITE_METNI} / B1 (statik şablon)"
    if ilk in KITAP_ALANLARI:
        return SAHIP_KITAP
    return SAHIP_STATIK


def md_hucre(deger, uzunluk=300):
    metin = norm(deger)
    if len(metin) > uzunluk:
        metin = metin[: uzunluk - 1] + "…"
    return metin.replace("|", "\\|")


class Sayfa(HTMLParser):
    """Görünür metni, h1'leri, bağlantıları, kaynak yollarını ve blockquote'ları toplar."""

    BLOK = {"p", "div", "li", "td", "th", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section",
            "article", "header", "footer", "nav", "br", "dt", "dd", "blockquote", "figure",
            "figcaption", "table", "ul", "ol", "label", "button", "option", "caption"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lang = None
        self.h1s = []
        self.alintilar = []
        self.hrefler = []
        self.kaynaklar = []
        self.onizleme_idleri = set()
        self._parcalar = []
        self._atla = 0
        self._h1 = None
        self._alinti = None
        self._alinti_derinlik = 0

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if tag == "html":
            self.lang = a.get("lang")
        if tag in ("script", "style"):
            self._atla += 1
        if tag == "h1":
            self._h1 = []
        if tag == "blockquote":
            if self._alinti_derinlik == 0:
                self._alinti = []
            self._alinti_derinlik += 1
        if tag in self.BLOK:
            self._parcalar.append(" ")
        if tag in ("a", "link") and a.get("href"):
            self.hrefler.append(a["href"])
        if tag in ("img", "source", "script", "iframe", "video", "audio") and a.get("src"):
            self.kaynaklar.append(a["src"])
        if tag in ("img", "source") and a.get("srcset"):
            for parca in a["srcset"].split(","):
                ilk = parca.strip().split()
                if ilk:
                    self.kaynaklar.append(ilk[0])
        if a.get("data-onizleme"):
            self.onizleme_idleri.add(a["data-onizleme"])

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._atla:
            self._atla -= 1
        if tag == "h1" and self._h1 is not None:
            self.h1s.append(norm("".join(self._h1)))
            self._h1 = None
        if tag == "blockquote" and self._alinti_derinlik:
            self._alinti_derinlik -= 1
            if self._alinti_derinlik == 0 and self._alinti is not None:
                self.alintilar.append(norm("".join(self._alinti)))
                self._alinti = None
        if tag in self.BLOK:
            self._parcalar.append(" ")

    def handle_data(self, data):
        if self._atla:
            return
        self._parcalar.append(data)
        if self._h1 is not None:
            self._h1.append(data)
        if self._alinti is not None:
            self._alinti.append(data)

    @property
    def metin(self):
        return norm("".join(self._parcalar))


_BELGE_ONBELLEK = {}


def sayfa_oku(yol):
    """Dosyayı katı UTF-8 ile çözer; hata olursa kodlama hatasını kaydeder."""
    if yol in _BELGE_ONBELLEK:
        return _BELGE_ONBELLEK[yol]
    ham = yol.read_bytes()
    kodlama = None
    try:
        metin = ham.decode("utf-8")
    except UnicodeDecodeError as hata:
        metin = ham.decode("utf-8", errors="replace")
        kodlama = str(hata)
    ayristirici = Sayfa()
    ayristirici.feed(metin)
    ayristirici.close()
    belge = {"ham": metin, "p": ayristirici, "kodlama": kodlama}
    _BELGE_ONBELLEK[yol] = belge
    return belge


def yerel_hedef(kaynak, ref):
    """Kök-göreli ya da göreli bir bağlantıyı dist içindeki dosyaya çevirir; dış ise None."""
    if not ref or ref.startswith(DIS_ATLANAN_ONEK):
        return None
    yol = unquote(urlsplit(ref).path)
    if not yol:
        return None
    hedef = DIST / yol.lstrip("/") if yol.startswith("/") else (kaynak.parent / yol)
    if yol.endswith("/") or hedef.is_dir():
        hedef = hedef / "index.html"
    return hedef


def html_dosyalari():
    return sorted(DIST.rglob("*.html"))


def dist_imza():
    """dist dizininin boyut ve değişiklik zamanı özetini çıkarır; çalışma öncesi/sonrası karşılaştırılır."""
    toplam, boyut, son = 0, 0, 0.0
    for kok, _, dosyalar in os.walk(DIST):
        for ad in dosyalar:
            yol = os.path.join(kok, ad)
            durum = os.stat(yol)
            toplam += 1
            boyut += durum.st_size
            son = max(son, durum.st_mtime)
    return (toplam, boyut, round(son, 3))


# ---------------------------------------------------------------- sonuç modeli

KONTROLLER = []


class Kontrol:
    def __init__(self, kimlik, ad, grup):
        self.kimlik, self.ad, self.grup = kimlik, ad, grup
        self.toplam = 0
        self.na = 0
        self.kalan = []
        self.belirsiz = []
        self.uyari = []
        KONTROLLER.append(self)

    def gecti(self):
        self.toplam += 1

    def kaldi(self, varlik, alan, beklenen, bulunan, sahip, notu=""):
        self.toplam += 1
        self.kalan.append(dict(varlik=varlik, alan=alan, beklenen=beklenen,
                               bulunan=bulunan, sahip=sahip, notu=notu))

    def belirsiz_ekle(self, varlik, alan, beklenen, bulunan, notu=""):
        self.toplam += 1
        self.belirsiz.append(dict(varlik=varlik, alan=alan, beklenen=beklenen,
                                  bulunan=bulunan, sahip="—", notu=notu))

    def uyari_ekle(self, varlik, alan, beklenen, bulunan, sahip, notu=""):
        self.toplam += 1
        self.uyari.append(dict(varlik=varlik, alan=alan, beklenen=beklenen,
                               bulunan=bulunan, sahip=sahip, notu=notu))

    def na_ekle(self):
        self.na += 1

    @property
    def sonuc(self):
        if self.kalan:
            return "KALDI"
        if self.toplam == 0:
            return "N/A"
        if self.belirsiz:
            return "DOĞRULANAMADI"
        if self.uyari:
            return "UYARI"
        return "GEÇTİ"


K11 = Kontrol("1.1", "Kitap sayfası üretildi (dist/kitap/<id>/index.html)", "1 Kitap")
K12 = Kontrol("1.2", "Sayfa h1 = title", "1 Kitap")
K13 = Kontrol("1.3", "Yazar adlarının her biri sayfada", "1 Kitap")
K14 = Kontrol("1.4", "ISBN (null değilse) sayfada", "1 Kitap")
K15 = Kontrol("1.5", "Sayfa sayısı (null değilse) sayfada", "1 Kitap")
K16 = Kontrol("1.6", "Kapak img/source yolları dist'te var", "1 Kitap")
K17 = Kontrol("1.7", "sources dolu URL'ler sayfada bağlantı", "1 Kitap")
K18 = Kontrol("1.8", "WhatsApp bağlantısı (wa.me/905059808735)", "1 Kitap")
K19 = Kontrol("1.9", "is_set kitaplarda Takım rozeti/etiketi", "1 Kitap")
K21 = Kontrol("2.1", "Yazar sayfası üretildi (dist/yazar/<slug>/index.html)", "2 Yazar")
K22 = Kontrol("2.2", "Yazar sayfası h1 = name", "2 Yazar")
K23 = Kontrol("2.3", "Listelenen kitaplar = authors.json book_ids", "2 Yazar")
K24 = Kontrol("2.4", "book_ids ↔ books.json authors eşleşmesi (veri tutarlılığı)", "2 Yazar")
K31 = Kontrol("3.1", "Önizleme vitrini ve öne çıkan kitaplar ana sayfada", "3 Vitrin")
K32 = Kontrol("3.2", "vitrin_haric kitapları ana sayfada yok", "3 Vitrin")
K41 = Kontrol("4.1", "Yasaklı teknik dizgi yok (null, undefined, [[SORU, NaN, mojibake, TODO vb.)", "4 Yasaklı dizgi")
K42 = Kontrol("4.2", "Fiyat/kampanya dizgisi yok (TL, kargo ücretsiz, indirim, kampanya)", "4 Yasaklı dizgi")
K51 = Kontrol("5.1", "Her HTML katı UTF-8 olarak çözülüyor", "5 Türkçe ve dil")
K52 = Kontrol("5.2", "<html lang=\"tr\">", "5 Türkçe ve dil")
K61 = Kontrol("6.1", "İç bağlantı ve kaynaklar dist'te karşılık buluyor", "6 İç bağlantı")
K71 = Kontrol("7.1", "Dış kaynak bağlantıları (rastgele örneklem)", "7 Dış bağlantı")
K81 = Kontrol("8.1", "Site metinlerinde [[SORU işareti dist'te yok", "8 Site metinleri")
K82 = Kontrol("8.2", "Sayfalar: ilk paragraf dist'te geçiyor", "8 Site metinleri")
K83 = Kontrol("8.3", "Sayfalar: SORU ayıklamasından öksüz kalıntı adayları (elle teyit)", "8 Site metinleri")
K84 = Kontrol("8.4", "Sayfalar: yönerge/editör notu sızıntısı yok", "8 Site metinleri")
K91 = Kontrol("9.1", "Sitemap URL sayısı = HTML sayısı − 404 − _test", "9 Sitemap")
K92 = Kontrol("9.2", "Sitemap her URL dist'te karşılık buluyor", "9 Sitemap")

BILGI = {"kitap": 0, "yazar": 0, "html": 0, "dis": [], "oksuz": [], "sayfa_ilk": [], "sitemap": {}}


# ---------------------------------------------------------------- veri

def veriyi_yukle():
    oku = lambda yol: json.loads(yol.read_text(encoding="utf-8"))  # noqa: E731
    return {
        "kitaplar": oku(CATALOG / "books.json"),
        "yazarlar": oku(CATALOG / "authors.json"),
        "vitrin": oku(SITE / "vitrin.json"),
    }


# ---------------------------------------------------------------- 1 ve 2: kitap ve yazar

def kontrol_kitaplar(veri):
    BILGI["kitap"] = len(veri["kitaplar"])
    for b in veri["kitaplar"]:
        kid = b["id"]
        varlik = f"kitap:{kid}"
        yol = DIST / "kitap" / kid / "index.html"
        if not yol.is_file():
            K11.kaldi(varlik, "dosya", f"dist/kitap/{kid}/index.html", "yok", SAHIP_KITAP)
            continue
        K11.gecti()
        p = sayfa_oku(yol)["p"]
        metin = p.metin

        beklenen_baslik = norm(b.get("title"))
        bulunan_baslik = p.h1s[0] if p.h1s else ""
        if not beklenen_baslik:
            K12.kaldi(varlik, "title", "(dolu olmalı)", bulunan_baslik, SAHIP_VERI)
        elif beklenen_baslik == bulunan_baslik:
            K12.gecti()
        else:
            K12.kaldi(varlik, "h1", beklenen_baslik, bulunan_baslik or "(h1 yok)", SAHIP_KITAP)

        for ad in b.get("authors") or []:
            ad_n = norm(ad)
            if ad_n and ad_n in metin:
                K13.gecti()
            elif ad_n and ad_n.lower() in metin.lower():
                K13.kaldi(varlik, "yazar", ad_n, "sayfada farklı büyük/küçük harfle",
                          SAHIP_VERI, "books.json authors ile authors.json display yazımı farklı")
            else:
                K13.kaldi(varlik, "yazar", ad_n, "sayfada yok", SAHIP_KITAP)
        if not (b.get("authors") or []):
            K13.na_ekle()

        isbn = b.get("isbn")
        if isbn is None:
            K14.na_ekle()
        elif norm(isbn) in metin:
            K14.gecti()
        else:
            K14.kaldi(varlik, "isbn", norm(isbn), "sayfada yok", SAHIP_KITAP)

        sayfa_sayisi = b.get("pages")
        if sayfa_sayisi is None:
            K15.na_ekle()
        elif re.search(rf"(?<!\d){re.escape(str(sayfa_sayisi))}(?!\d)", metin):
            K15.gecti()
        else:
            K15.kaldi(varlik, "pages", str(sayfa_sayisi), "sayfada yok", SAHIP_KITAP)

        kontrol_kapak(b, varlik, yol, p)
        kontrol_kaynaklar(b, varlik, p)

        if any(WA_ANAHTAR in h for h in p.hrefler):
            K18.gecti()
        else:
            K18.kaldi(varlik, "whatsapp", WA_ANAHTAR, "bağlantı yok", f"{SAHIP_KITAP} / {SAHIP_LOADER}")

        if b.get("is_set"):
            if re.search(r"\bTakım\b", metin):
                K19.gecti()
            else:
                K19.kaldi(varlik, "is_set rozet", "Takım", "yok", SAHIP_KITAP)


def kontrol_kapak(b, varlik, yol, p):
    kapak = b.get("cover") or {}
    yerel = kapak.get("local_path")
    if yerel and not (KOK / yerel).is_file():
        K16.kaldi(varlik, "cover.local_path (veri dosyası)", yerel, "yok", SAHIP_VERI)
    resimler = [s for s in p.kaynaklar
                if not s.startswith(DIS_ATLANAN_ONEK)
                and s.lower().split("?")[0].endswith(RESIM_UZANTILARI)]
    if not resimler:
        K16.kaldi(varlik, "kapak img/source", "en az bir yerel kapak yolu", "yok", SAHIP_KITAP)
        return
    for s in resimler:
        hedef = yerel_hedef(yol, s)
        if hedef is not None and hedef.is_file():
            K16.gecti()
        else:
            K16.kaldi(varlik, "kapak yolu", s, "dist'te dosya yok", SAHIP_VERI)


def kontrol_kaynaklar(b, varlik, p):
    kaynak = b.get("sources") or {}
    adaylar = [(ad, kaynak.get(ad)) for ad in ("kitapyurdu", "nobelkitap", "kureselkitap")]
    adaylar += [(ad, u) for ad, u in other_ogeleri(kaynak)]
    if not any(u for _, u in adaylar):
        K17.na_ekle()
        return
    hrefler = {url_norm(h) for h in p.hrefler}
    for anahtar, url in adaylar:
        if not url:
            continue
        if url_norm(url) in hrefler:
            K17.gecti()
        else:
            diger = anahtar not in ("kitapyurdu", "nobelkitap", "kureselkitap")
            notu = ("nereden-alinir.njk yalnızca kitapyurdu/nobelkitap/kureselkitap basar; "
                    "other alanı basılmıyor") if diger else ""
            K17.kaldi(varlik, f"sources.{anahtar}", url, "bağlantı yok", SAHIP_KITAP, notu)


def kontrol_yazarlar(veri):
    BILGI["yazar"] = len(veri["yazarlar"])
    for y in veri["yazarlar"]:
        slug = y["slug"]
        ad = norm(y.get("name"))
        varlik = f"yazar:{slug}"
        yol = DIST / "yazar" / slug / "index.html"
        if not yol.is_file():
            K21.kaldi(varlik, "dosya", f"dist/yazar/{slug}/index.html", "yok", SAHIP_YAZAR)
            continue
        K21.gecti()
        p = sayfa_oku(yol)["p"]
        bulunan = p.h1s[0] if p.h1s else ""
        if bulunan == ad:
            K22.gecti()
        else:
            K22.kaldi(varlik, "h1", ad, bulunan or "(h1 yok)", SAHIP_YAZAR,
                      "display alanı ayrı: " + norm(y.get("display")) if y.get("display") else "")
        bekl = set(y.get("book_ids") or [])
        sayfa_ids = {h.strip("/").split("/")[1] for h in p.hrefler
                     if re.fullmatch(r"/kitap/[^/]+/", h)}
        if sayfa_ids == bekl:
            K23.gecti()
        else:
            K23.kaldi(varlik, "listelenen kitaplar", f"{len(bekl)}: {sorted(bekl)}",
                      f"{len(sayfa_ids)}: {sorted(sayfa_ids)}", f"{SAHIP_YAZAR} / R1 (authors.json)")
        ad_eslesen = {b["id"] for b in veri["kitaplar"]
                      if ad in [norm(x) for x in (b.get("authors") or [])]}
        if ad_eslesen == bekl:
            K24.gecti()
        else:
            K24.kaldi(varlik, "book_ids ↔ authors", f"book_ids={sorted(bekl)}",
                      f"authors eşleşmesi={sorted(ad_eslesen)}", SAHIP_VERI)


# ---------------------------------------------------------------- 3: vitrin

def kontrol_vitrin(veri):
    karar = veri["vitrin"]
    ana = DIST / "index.html"
    if not ana.is_file():
        K31.kaldi("ana sayfa", "dosya", "dist/index.html", "yok", SAHIP_ANA)
        return
    p = sayfa_oku(ana)["p"]
    basliklar = {b["id"]: norm(b.get("title")) for b in veri["kitaplar"]}
    for kid in list(karar.get("onizleme_vitrini") or []) + [karar.get("one_cikan")]:
        if not kid:
            continue
        if f"/kitap/{kid}/" in p.hrefler or kid in p.onizleme_idleri:
            K31.gecti()
        else:
            K31.kaldi(f"vitrin:{kid}", "ana sayfa bağlantısı", f"/kitap/{kid}/ veya data-onizleme",
                      "yok", f"{SAHIP_ANA} / Direktör (vitrin.js)")
    for kid in karar.get("vitrin_haric") or []:
        baslik = basliklar.get(kid, "")
        gorunur_baglanti = f"/kitap/{kid}/" in p.hrefler or kid in p.onizleme_idleri
        gorunur_baslik = bool(baslik) and baslik in p.metin
        if gorunur_baglanti or gorunur_baslik:
            K32.kaldi(f"vitrin_haric:{kid}", "ana sayfada görünüyor",
                      "görünmemeli", "bağlantı" if gorunur_baglanti else "başlık metni",
                      f"{SAHIP_ANA} / Direktör (vitrin.js)")
        else:
            K32.gecti()


# ---------------------------------------------------------------- 4 ve 5: dizgi, dil, kodlama

def kontrol_yasakli_ve_dil():
    for dosya in html_dosyalari():
        BILGI["html"] += 1
        rel = dosya.relative_to(DIST).as_posix()
        belge = sayfa_oku(dosya)
        gorunur = gorunur_html(belge["ham"])
        sahip = sahip_sayfa(rel)
        bulgu = False
        for ad, desen, bayrak in YASAKLI_TEKNIK:
            for eslesme in list(re.finditer(desen, gorunur, bayrak))[:2]:
                bulgu = True
                bag = norm(gorunur[max(0, eslesme.start() - 50): eslesme.end() + 50])
                K41.kaldi(rel, ad, "yok", bag, sahip)
        for ad, desen, bayrak in YASAKLI_TICARI:
            for eslesme in list(re.finditer(desen, gorunur, bayrak))[:2]:
                bulgu = True
                bag = norm(gorunur[max(0, eslesme.start() - 50): eslesme.end() + 50])
                K42.kaldi(rel, ad, "yok", bag, sahip)
        if not bulgu:
            K41.gecti()
            K42.gecti()

        if belge["kodlama"]:
            K51.kaldi(rel, "UTF-8 çözümleme", "geçerli UTF-8", belge["kodlama"], "B1 (statik şablon)")
        else:
            K51.gecti()
        if belge["p"].lang == "tr":
            K52.gecti()
        else:
            K52.kaldi(rel, "html lang", "tr", str(belge["p"].lang), sahip)


# ---------------------------------------------------------------- 6: iç bağlantılar

def kontrol_ic_baglanti():
    for dosya in html_dosyalari():
        rel = dosya.relative_to(DIST).as_posix()
        p = sayfa_oku(dosya)["p"]
        for ref in p.hrefler + p.kaynaklar:
            hedef = yerel_hedef(dosya, ref)
            if hedef is None:
                continue
            if hedef.is_file():
                K61.gecti()
            else:
                K61.kaldi(rel, "bağlantı/kaynak", ref, "dist'te dosya yok", sahip_sayfa(rel))


# ---------------------------------------------------------------- 7: dış bağlantılar

def dis_istek(url):
    """HEAD dener; HTTP hatasında GET ile doğrular. (durum, kod, not) döndürür."""
    son_kod, son_not = None, ""
    for metot in ("HEAD", "GET"):
        istek = urllib.request.Request(url, method=metot,
                                       headers={"User-Agent": UA, "Accept": "text/html,*/*;q=0.8"})
        try:
            with urllib.request.urlopen(istek, timeout=10) as yanit:
                return dis_sinifla(yanit.status, yanit.headers)
        except urllib.error.HTTPError as hata:
            son_kod, son_not = hata.code, dis_sinifla(hata.code, hata.headers)[2]
            if metot == "GET":
                return dis_sinifla(hata.code, hata.headers)
        except Exception as hata:  # ağ, DNS, zaman aşımı
            son_not = f"ağ hatası: {type(hata).__name__}"
            if metot == "GET" or son_kod is None:
                if metot == "GET":
                    return ("DOĞRULANAMADI", None, son_not)
                continue
    return ("DOĞRULANAMADI", son_kod, son_not)


def dis_sinifla(kod, basliklar):
    server = (basliklar.get("server", "") if basliklar else "").lower()
    cf = bool(basliklar and (basliklar.get("cf-mitigated") or "cloudflare" in server))
    if 200 <= kod < 400:
        return ("TAMAM", kod, "")
    if kod in (404, 410):
        return ("HATA", kod, "sayfa bulunamadı")
    if kod == 403 or cf:
        return ("DOĞRULANAMADI", kod, "403/Cloudflare: doğrulanamadı")
    return ("DOĞRULANAMADI", kod, f"HTTP {kod}")


def dis_kaynaklar(veri):
    urller = set()
    for b in veri["kitaplar"]:
        kaynak = b.get("sources") or {}
        for ad in ("kitapyurdu", "nobelkitap", "kureselkitap"):
            if kaynak.get(ad):
                urller.add(kaynak[ad])
        for _, u in other_ogeleri(kaynak):
            if u:
                urller.add(u)
    return sorted(urller)


def kontrol_dis_baglanti(veri, ornek_sayisi, atla):
    urller = dis_kaynaklar(veri)
    if atla:
        K71.belirsiz_ekle("tüm dış bağlantılar", "dış denetim", "—", "--dis-yok ile atlandı")
        return
    if len(urller) > ornek_sayisi:
        secim = random.Random(TOHUM).sample(urller, ornek_sayisi)
    else:
        secim = urller
    for i, url in enumerate(secim):
        if i:
            time.sleep(1)
        durum, kod, notu = dis_istek(url)
        BILGI["dis"].append({"url": url, "durum": durum, "kod": kod, "notu": notu})
        if durum == "TAMAM":
            K71.gecti()
        elif durum == "HATA":
            K71.kaldi(url, "HTTP", "200-399", str(kod), "B2 (kitap şablonu) / R1 (katalog verisi)", notu)
        else:
            K71.belirsiz_ekle(url, "HTTP", "200-399", f"{kod or '-'} {notu}".strip())


# ---------------------------------------------------------------- 8: site metinleri

def sorulari_ayikla(govde):
    """_oku.js sorulariAyikla ile aynı mantık (Python sürümü)."""
    temiz = re.sub(r"[^.!?\n]*\[\[SORU:\s*([^\]]*)\]\][^.!?\n]*[.!?]?", "", govde)
    temiz = re.sub(r"[ \t]+\n", "\n", temiz)
    temiz = re.sub(r"\n{3,}", "\n\n", temiz)
    return temiz.strip()


def md_duz(metin):
    metin = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", metin)
    metin = re.sub(r"[*_`]+", "", metin)
    metin = re.sub(r"^\s*(>|-|\*|\d+\.)\s*", "", metin, flags=re.M)
    return norm(metin)


def oksuz_isaretleri(blok):
    isaretler = []
    if re.search(r"[.!?]\s+[a-zçğıöşü]", blok):
        isaretler.append("cümle küçük harfle başlıyor")
    if re.search(r"\s[,;:.]", blok):
        isaretler.append("noktalama öncesi boşluk")
    if re.search(r"\s{2,}", blok):
        isaretler.append("çift boşluk")
    son = blok.rstrip()[-1:]
    if son and son not in ".!?:)\"”»|":
        isaretler.append("cümle sonu işareti yok")
    if re.search(r"\b(ve|ile|veya|ama|ancak|ya|da|de|bu|için|ki|tarihinden|tarihten)\s*$", blok.rstrip()):
        isaretler.append("bağlaçla bitiyor")
    if re.match(r"^\s*(tarihinden|tarihten|ile|ve|ama|bu|için|ki|ancak|olarak)\b", blok):
        isaretler.append("bağlaçla başlıyor")
    return isaretler


def kontrol_site_metinleri():
    klasor = SITE / "sayfalar"
    for md in sorted(klasor.glob("*.md")):
        ham = md.read_text(encoding="utf-8")
        on = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n?(.*)$", ham, re.S)
        govde = on.group(2) if on else ham
        slug_m = re.search(r"^slug:\s*(\S+)", on.group(1), re.M) if on else None
        slug = slug_m.group(1).strip("\"'") if slug_m else md.stem
        rel = f"{slug}/index.html" if slug != "404" else "404.html"
        yol = DIST / rel
        if not yol.is_file():
            K81.kaldi(md.name, "dist sayfası", rel, "yok", SAHIP_SITE_METNI)
            continue
        belge = sayfa_oku(yol)
        p = belge["p"]
        if "[[SORU" in belge["ham"]:
            K81.kaldi(rel, "[[SORU", "yok", "var", SAHIP_SITE_METNI)
        else:
            K81.gecti()
        if slug == "404":
            continue
        kontrol_ilk_paragraf(md, slug, govde, p)
        kontrol_oksuz_adaylari(md, slug, govde)
        for alinti in p.alintilar:
            if re.search(YONERGE_DESENI, alinti, re.I):
                K84.kaldi(rel, "blockquote", "editör notu yok", alinti[:160], SAHIP_SITE_METNI,
                          "yönerge metni yayına sızmış olabilir")
            else:
                K84.gecti()


def kontrol_ilk_paragraf(md, slug, govde, p):
    temiz = sorulari_ayikla(govde)
    temiz = re.sub(r"^#\s+.*\r?\n?", "", temiz, count=1)
    bloklar = [b.strip() for b in re.split(r"\n\s*\n", temiz) if b.strip()]
    ilk = next((b for b in bloklar if not b.startswith(("#", ">", "-", "|", "*", "1."))), "")
    duz = md_duz(ilk)
    if not duz:
        K82.belirsiz_ekle(slug, "ilk paragraf", "—", "md'de paragraf bulunamadı")
        return
    sayfa_metni = p.metin
    if duz[:120] in sayfa_metni:
        K82.gecti()
        BILGI["sayfa_ilk"].append({"slug": slug, "durum": "TAMAM", "not": duz[:90]})
    else:
        K82.kaldi(slug, "ilk paragraf", duz[:120], "dist metninde yok", SAHIP_SITE_METNI)
        BILGI["sayfa_ilk"].append({"slug": slug, "durum": "KALDI", "not": duz[:90]})


def kontrol_oksuz_adaylari(md, slug, govde):
    """Her SORU'nun çıkarıldığı cümleyi ve kalan blok bağlamını listeler; sezgisel işaretler verir."""
    desen = r"[^.!?\n]*\[\[SORU:\s*([^\]]*)\]\][^.!?\n]*[.!?]?"
    for eslesme in re.finditer(desen, govde):
        cikan = eslesme.group(0)
        bas, son = eslesme.start(), eslesme.end()
        blok_bas = govde.rfind("\n\n", 0, bas)
        blok_bas = 0 if blok_bas == -1 else blok_bas + 2
        blok_son = govde.find("\n\n", son)
        blok_son = len(govde) if blok_son == -1 else blok_son
        blok = govde[blok_bas:blok_son]
        kalan = norm(blok.replace(cikan.strip(), "", 1))
        isaretler = oksuz_isaretleri(kalan)
        kayit = {"dosya": md.name, "soru": norm(eslesme.group(1))[:110],
                 "cikan": norm(cikan)[:160], "kalan": kalan[:220], "isaret": isaretler}
        BILGI["oksuz"].append(kayit)
        # Ayıklama cümlenin tamamını düşürür; SORU dışındaki içerik de kaybolmuş olabilir.
        ceker = norm(re.sub(r"\[\[SORU:[^\]]*\]\]", " ", cikan))
        ceker = re.sub(r"[\s.!?:;,\-*]+", " ", ceker).strip()
        ornek = ceker if len(ceker.split()) >= 3 else ""
        if ornek:
            kayit["kayip"] = ornek
        if isaretler:
            K83.uyari_ekle(md.name, "SORU ayıklama", "akıcı cümle", kalan[:160],
                           SAHIP_SITE_METNI, "; ".join(isaretler))
        elif ornek:
            K83.uyari_ekle(md.name, "SORU ayıklama: içerik kaybı", "SORU dışı içerik korunmalı",
                           ornek[:160], SAHIP_SITE_METNI,
                           "cümlenin SORU dışındaki kısmı yayından düşüyor (elle karar)")
        else:
            K83.gecti()


# ---------------------------------------------------------------- 9: sitemap

def kontrol_sitemap():
    sm = DIST / "sitemap.xml"
    if not sm.is_file():
        K91.kaldi("sitemap.xml", "dosya", "dist/sitemap.xml", "yok", SAHIP_STATIK)
        return
    locs = re.findall(r"<loc>([^<]+)</loc>", sm.read_text(encoding="utf-8"))
    html_hepsi = html_dosyalari()
    haric = [x for x in html_hepsi
             if x.relative_to(DIST).as_posix() == "404.html" or "_test" in x.relative_to(DIST).parts]
    beklenen = len(html_hepsi) - len(haric)
    BILGI["sitemap"] = {"loc": len(locs), "html": len(html_hepsi), "haric": len(haric), "beklenen": beklenen}
    if len(locs) == beklenen:
        K91.gecti()
    else:
        K91.kaldi("sitemap.xml", "URL sayısı", str(beklenen), str(len(locs)), SAHIP_STATIK)
    for loc in locs:
        if not loc.startswith(SITE_URL):
            K92.kaldi(loc, "önek", SITE_URL, loc, "Direktör (site.json/url) / B1")
            continue
        yol = loc[len(SITE_URL):] or "/"
        hedef = DIST / yol.lstrip("/")
        if yol.endswith("/") or hedef.is_dir():
            hedef = hedef / "index.html"
        if hedef.is_file():
            K92.gecti()
        else:
            K92.kaldi(loc, "dosya", str(hedef.relative_to(DIST)), "yok", SAHIP_STATIK)


# ---------------------------------------------------------------- rapor

def rapor_yaz(kod, veri, ornek_sayisi):
    tarih = dt.date.today().isoformat()
    satir = []
    a = satir.append
    toplam = sum(k.toplam for k in KONTROLLER)
    kalan_say = sum(len(k.kalan) for k in KONTROLLER)
    belirsiz_say = sum(len(k.belirsiz) for k in KONTROLLER)
    uyari_say = sum(len(k.uyari) for k in KONTROLLER)
    na_say = sum(k.na for k in KONTROLLER)
    a("# Q4 İçerik Doğrulama Raporu")
    a("")
    a(f"- Tarih: {tarih}")
    a("- Kapsam: `dist/` (npm run build çıktısı, {0} HTML), `data/catalog/books.json` ({1} kitap), "
      "`data/catalog/authors.json` ({2} yazar), `data/catalog/onsoz/INDEX.json` (yalnızca bilgi, doğrudan kontrol yok), "
      "`data/site/vitrin.json`, `data/site/site.json`, `data/site/sayfalar/*.md`.".format(
          BILGI["html"], BILGI["kitap"], BILGI["yazar"]))
    a("- Betik: `python -I -X utf8 scripts/qa/dogrula.py` (dış örneklem: `--dis-ornek {0}`; `--dis-yok` ile atlanır)".format(ornek_sayisi))
    a(f"- Denetlenen dizin: `{DIST}` (çalışma öncesi/sonrası dizin imzası aynı kaldıysa geçerli)")
    a(f"- Çıkış kodu: **{kod}** ({'hata var' if kod else 'hata yok'})")
    a("")
    a("## Özet")
    a("")
    a(f"- Kontrol grubu: {len(KONTROLLER)}; tekil denetim: {toplam}; **kalan (KALDI): {kalan_say}**; "
      f"doğrulanamadı: {belirsiz_say}; uyarı (elle teyit): {uyari_say}; uygulanamadı (N/A): {na_say}.")
    a("- Hata sayılmayan sonuçlar: DOĞRULANAMADI (403/Cloudflare/ağ) ve UYARI. Çıkış kodu yalnızca KALDI için 1 olur.")
    a("")
    a("## Kontrol tablosu")
    a("")
    a("| Kimlik | Kontrol | Sonuç | Denetim | Kalan | Doğrulanamadı | Uyarı | N/A | Sahip (kalan) |")
    a("|---|---|---|---|---|---|---|---|---|")
    for k in KONTROLLER:
        sahipler = sorted({x["sahip"] for x in k.kalan}) or ["—"]
        a(f"| {k.kimlik} | {md_hucre(k.ad)} | {k.sonuc} | {k.toplam} | {len(k.kalan)} | "
          f"{len(k.belirsiz)} | {len(k.uyari)} | {k.na} | {md_hucre('; '.join(sahipler))} |")
    a("")
    a("## Uyumsuzluklar (tam liste)")
    a("")
    kalanlar = [(k, x) for k in KONTROLLER for x in k.kalan]
    if not kalanlar:
        a("Uyumsuzluk yok.")
    else:
        gruplar = {}
        for k, x in kalanlar:
            anahtar = (k.kimlik, x["alan"], str(x["beklenen"]), str(x["bulunan"]), x["sahip"], x["notu"])
            gruplar.setdefault(anahtar, []).append(x["varlik"])
        a(f"Toplam {len(kalanlar)} kayıt, {len(gruplar)} tekil uyumsuzluk (aynı değerli kayıtlar gruplandı).")
        a("")
        a("| # | Kimlik | Varlık (adet, örnek) | Alan | Beklenen | Bulunan | SAHİP | Not |")
        a("|---|---|---|---|---|---|---|---|")
        for i, ((kimlik, alan, bekl, bulun, sahip, notu), varliklar) in enumerate(gruplar.items(), 1):
            ornekler = ", ".join(sorted(set(varliklar))[:3])
            a(f"| {i} | {kimlik} | {len(varliklar)} × {md_hucre(ornekler, 160)} | {md_hucre(alan, 80)} | "
              f"{md_hucre(bekl, 200)} | {md_hucre(bulun, 200)} | {md_hucre(sahip, 80)} | "
              f"{md_hucre(notu, 200)} |")
    a("")
    a("## Doğrulanamayan ve uyarı kayıtları")
    a("")
    ekstra = [(k, x, "DOĞRULANAMADI") for k in KONTROLLER for x in k.belirsiz] + \
             [(k, x, "UYARI") for k in KONTROLLER for x in k.uyari]
    if not ekstra:
        a("Yok.")
    else:
        a("| Kimlik | Sonuç | Varlık | Alan | Beklenen | Bulunan | Not |")
        a("|---|---|---|---|---|---|---|")
        for k, x, s in ekstra:
            a(f"| {k.kimlik} | {s} | {md_hucre(x['varlik'], 120)} | {md_hucre(x['alan'], 80)} | "
              f"{md_hucre(x['beklenen'], 160)} | {md_hucre(x['bulunan'], 160)} | {md_hucre(x['notu'], 160)} |")
    a("")
    a("## Dış bağlantı sonuçları (örneklem)")
    a("")
    a(f"Kaynak havuzu: {len(dis_kaynaklar(veri))} tekil URL. Örneklem tohumu {TOHUM}, sayı {ornek_sayisi}.")
    a("")
    if BILGI["dis"]:
        a("| URL | Sonuç | HTTP | Not |")
        a("|---|---|---|---|")
        for d in BILGI["dis"]:
            a(f"| {md_hucre(d['url'], 160)} | {d['durum']} | {d['kod'] or '-'} | {md_hucre(d['notu'], 120)} |")
    else:
        a("Dış denetim yapılmadı.")
    a("")
    a("## Öksüz kalıntı adayları (SORU ayıklaması)")
    a("")
    a("Yöntem: her `[[SORU: …]]` işaretinin bulunduğu cümle `sorulariAyikla` ile çıkarılır; kalan blok sezgisel "
      "olarak denetlenir (küçük harfle başlayan cümle, bağlaçla biten/başlayan kalıntı, noktalama öncesi boşluk, "
      "cümle sonu eksikliği). İşaret yoksa aday sayılmaz; işaret olsa bile insan teyidi gerekir.")
    a("")
    a("| Dosya | SORU konusu | Çıkarılan parça | Kalan blok | Sezgisel işaret |")
    a("|---|---|---|---|---|")
    for o in BILGI["oksuz"]:
        a(f"| {o['dosya']} | {md_hucre(o['soru'], 90)} | {md_hucre(o['cikan'], 150)} | "
          f"{md_hucre(o['kalan'], 180)} | {md_hucre('; '.join(o['isaret']) or 'yok', 120)} |")
    a("")
    a("## Sayfalar: ilk paragraf kontrolü")
    a("")
    for s in BILGI["sayfa_ilk"]:
        a(f"- `{s['slug']}`: {s['durum']} — \"{md_hucre(s['not'], 90)}…\"")
    a("")
    a("## Sitemap")
    a("")
    sm = BILGI["sitemap"]
    if sm:
        a(f"- sitemap `<loc>` sayısı: {sm['loc']}; dist HTML sayısı: {sm['html']}; "
          f"hariç tutulan (404 ve _test): {sm['haric']}; beklenen: {sm['beklenen']}.")
    a("- Not: `data/site/site.json` / betik taban adresi `https://adursak63.github.io/islambol-yayinlari` "
      "(yol öneki `/islambol-yayinlari`). Varsayılan build `PATH_PREFIX=/` ile çalışır; sitemap'in dağıtım "
      "adresiyle tutarlılığı için dağıtım komutunda `PATH_PREFIX=/islambol-yayinlari/` kullanıldığı teyit edilmeli.")
    a("")
    a("## Betik ve yöntem notları")
    a("")
    a("- Girdiler proje verisinden doğrudan okunur; beklenen değerler `books.json`/`authors.json`/`vitrin.json` "
      "ham değerleridir, yükleyici (`src/_data`) çıktısı değildir.")
    a("- Görünür metin karşılaştırmaları HTML entity ve boşluk normalizasyonu sonrası yapılır (`&amp;` → `&`, NBSP → boşluk).")
    a("- Yasaklı dizgi taraması `<script>` ve `<style>` içerikleri hariç yapılır (JS içindeki `null`/`undefined` yanlış pozitif olmasın diye).")
    a("- `onsoz/INDEX.json` ve `kapaklar-opt.json`/`onsoz-opt.json` bu sürümde doğrudan denetlenmez; yalnızca dist üzerinden dolaylı olarak doğrulanır.")
    a("- `package.json` içindeki `dogrula` betiği `scripts/qa/dogrula.mjs` gösteriyor; bu betik `dogrula.py`'dir. "
      "Kod ve paket dosyaları bu rolün yazma kapsamında değildir; SAHİP'in düzeltmesi gerekir.")
    a("")
    RAPOR.parent.mkdir(parents=True, exist_ok=True)
    RAPOR.write_text("\n".join(satir) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- giriş

def main(argv=None):
    global DIST
    sys.stdout.reconfigure(encoding="utf-8")
    ayar = argparse.ArgumentParser(description="Q4 İçerik Doğrulayıcı")
    ayar.add_argument("--dis-yok", action="store_true", help="dış bağlantı denetimini atla")
    ayar.add_argument("--dis-ornek", type=int, default=15, help="dış bağlantı örneklem sayısı")
    ayar.add_argument("--dist", type=Path, default=None,
                      help="denetlenecek dist kopyası (ör. kararlı bir anlık görüntü); varsayılan proje dist/")
    args = ayar.parse_args(argv)
    if args.dist is not None:
        DIST = args.dist.resolve()

    if not (DIST / "index.html").is_file():
        print("HATA: dist/ yok. Önce `npm run build` çalıştırın.", file=sys.stderr)
        return 1

    imza_once = dist_imza()
    veri = veriyi_yukle()
    kontrol_kitaplar(veri)
    kontrol_yazarlar(veri)
    kontrol_vitrin(veri)
    kontrol_yasakli_ve_dil()
    kontrol_ic_baglanti()
    kontrol_dis_baglanti(veri, args.dis_ornek, args.dis_yok)
    kontrol_site_metinleri()
    kontrol_sitemap()
    imza_sonra = dist_imza()

    kalan = sum(len(k.kalan) for k in KONTROLLER)
    kararsiz = imza_once != imza_sonra
    if kararsiz:
        # Çalışma sırasında dist değişti: sonuçlar karışık bir anlık görüntüye ait, geçersiz say.
        K91.kaldi("dist/", "çalışma sırasında değişti", f"{imza_once}", f"{imza_sonra}", "Q4 / yapım sahibi",
                  "dist betik çalışırken yeniden üretildi; kararlı bir dist ile yeniden çalıştırın")
        kalan = sum(len(k.kalan) for k in KONTROLLER)
    kod = 1 if kalan else 0
    rapor_yaz(kod, veri, args.dis_ornek)

    toplam = sum(k.toplam for k in KONTROLLER)
    print(f"Kontrol grubu: {len(KONTROLLER)} | tekil denetim: {toplam} | kalan (KALDI): {kalan} | "
          f"doğrulanamadı: {sum(len(k.belirsiz) for k in KONTROLLER)} | "
          f"uyarı: {sum(len(k.uyari) for k in KONTROLLER)}")
    print(f"Rapor: {RAPOR}")
    print(f"Çıkış kodu: {kod}")
    return kod


if __name__ == "__main__":
    sys.exit(main())
