"""Küresel Kitap ürün sayfalarını çek ve ayrıştır -> data/raw/kk_detail.json"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from bs4 import BeautifulSoup

def parse(html, base):
    s = BeautifulSoup(html, "html.parser")
    for t in s(["script", "style"]): t.decompose()
    book = s.select_one('[itemtype$="Book"]')
    if book is None:
        return None
    # ana ürün bloğu: "Ürün Kategorileri" sonrası ile "DİĞER ÜRÜNLER" öncesi dahil
    main = book
    for _ in range(6):
        if main.parent is not None and "DİĞER ÜRÜNLER" not in main.get_text() and main.name != "body":
            main = main.parent
        else:
            break
    d = {}
    name = book.select_one('[itemprop=name]')
    d["title_raw"] = name.get_text(" ", strip=True) if name else None
    # başlık ve yazar satırları
    h1 = s.select_one("h1")
    d["h1"] = h1.get_text(" ", strip=True) if h1 else None
    for key, prop in [("isbn", "isbn"), ("pages", "numberOfPages"), ("language", "inLanguage"),
                      ("binding", "bookFormat"), ("year", "datePublished"), ("price_sale", "price")]:
        e = book.select_one(f"[itemprop={prop}]")
        d[key] = (e.get("content") or e.get_text(strip=True)) if e else None
    desc = book.select_one("[itemprop=description]")
    d["description"] = "\n\n".join(p.strip() for p in desc.get_text("\n").split("\n") if p.strip()) if desc else None
    txt = book.get_text("\n", strip=True).split("\n")
    def after(label):
        for i, l in enumerate(txt):
            if l.strip() == label and i + 1 < len(txt):
                return txt[i + 1].strip()
    d["paper"] = after("Kağıt Türü"); d["dimensions"] = after("Ebat")
    d["dimension_raw"] = d["dimensions"]
    # liste fiyatı
    lf = book.select_one(".LFiyat span, .LFiyat")
    d["price_list"] = lf.get_text(strip=True).replace("TL", "").strip() if lf else None
    # katkıda bulunanlar, kategoriler
    full = "\n".join(txt)
    m = re.search(r"Katkıda Bulunanlar\n(.*?)\nÜrün Kategorileri", full, re.S)
    d["contributors"] = m.group(1).replace("\n", " ") if m else None
    cats = [a.get_text(strip=True) for a in book.select("a") if "/kategori/" in a.get("href", "")]
    d["categories"] = cats
    # alt başlık ve yazar(lar): yalnızca ürün üst bilgi bloğunda
    alt = book.select_one(".AltUrunAdi")
    d["subtitle"] = alt.get_text(" ", strip=True) if alt else None
    top = book.select_one(".UrunDetaySag") or book
    d["authors_links"] = []
    for a in top.select('[itemprop=author] a[href*="/kisi/"]'):
        n = a.get_text(strip=True)
        if n and n not in d["authors_links"]: d["authors_links"].append(n)
    d["title_clean"] = (d["title_raw"] or "")
    if d["subtitle"] and d["title_clean"].endswith(d["subtitle"]):
        d["title_clean"] = d["title_clean"][: -len(d["subtitle"])].strip()
    d["image"] = None
    im = book.select_one("img")
    if im and im.get("src"): d["image"] = base + im["src"]
    return d

if __name__ == "__main__":
    lst = json.load(open(os.path.join(RAW, "kk_list.json"), encoding="utf-8"))
    seen = {}
    for it in lst:
        seen.setdefault(it["kk_id"], it)
    out = []
    offline = "--offline" in sys.argv
    for kid, it in seen.items():
        cp = os.path.join(RAW, "kk", f"{kid}.html")
        if offline and not os.path.exists(cp):
            out.append({"kk_id": kid, "url": it["url"], "error": "fetch"}); continue
        h = get(it["url"], f"kk/{kid}.html", retries=3, delay=6)
        if not h:
            out.append({"kk_id": kid, "url": it["url"], "error": "fetch"}); continue
        d = parse(h, "https://www.kureselkitap.com")
        if d is None:
            out.append({"kk_id": kid, "url": it["url"], "error": "parse"}); continue
        d.update({"kk_id": kid, "url": it["url"], "list_title": it["title"],
                  "list_price_listing": it["price_list"], "sale_price_listing": it["price_sale"]})
        out.append(d)
    json.dump(out, open(os.path.join(RAW, "kk_detail.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(out), sum(1 for o in out if "error" in o))
