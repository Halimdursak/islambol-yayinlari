"""Nobel Kitap ürün sayfaları -> data/raw/nb_detail.json (JSON-LD + metin)"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from bs4 import BeautifulSoup

def parse(html):
    s = BeautifulSoup(html, "html.parser")
    d = {"jsonld_book": None, "breadcrumb": []}
    for ld in s.select('script[type="application/ld+json"]'):
        try: j = json.loads(ld.string)
        except Exception: continue
        graph = j.get("@graph", [j]) if isinstance(j, dict) else j
        for g in graph:
            if g.get("@type") == "Book": d["jsonld_book"] = g
            if g.get("@type") == "BreadcrumbList":
                d["breadcrumb"] = [i["name"] for i in g["itemListElement"]]
    for t in s(["script", "style"]): t.decompose()
    lines = [l for l in s.get_text("\n", strip=True).split("\n")]
    def after(label):
        for i, l in enumerate(lines):
            if l.strip() == label and i + 1 < len(lines): return lines[i + 1].strip()
    d["pages"] = after("Sayfa Sayısı:"); d["dimensions"] = after("Ürün Ebatı:")
    d["language"] = after("Dil:"); d["binding"] = after("Cilt Durumu:"); d["paper"] = after("Kağıt Tipi:")
    d["print_no"] = after("Baskı Sayısı:"); d["isbn_text"] = after("ISBN:")
    d["author_text"] = after("Yazar:")
    # fiyatlar: "Yazar:" sonrası 400.00 ₺ 500.00 ₺
    m = re.search(r"Yazar:\n[^\n]+\n(?:[^\n]*\n)?([\d.]+)\n₺\n([\d.]+)\n₺", "\n".join(lines))
    d["price_sale"], d["price_list"] = (m.group(1), m.group(2)) if m else (None, None)
    # açıklama
    desc = []
    try:
        i = [k for k, l in enumerate(lines) if l == "Kitap Hakkında"][-1] + 1
        while i < len(lines) and lines[i] not in ("Detaylar", "Değerlendirmeler", "Yorumlar") and not lines[i].startswith("Benzer"):
            desc.append(lines[i]); i += 1
    except IndexError:
        pass
    d["description"] = "\n\n".join(desc) if desc else None
    return d

if __name__ == "__main__":
    lst = json.load(open(os.path.join(RAW, "nb_list.json"), encoding="utf-8"))
    out = []
    for it in lst:
        h = get(it["url"], f"nb/{it['slug']}.html")
        if not h:
            out.append({"slug": it["slug"], "url": it["url"], "error": "fetch"}); continue
        d = parse(h); d.update({"slug": it["slug"], "url": it["url"], "list_text": it["text"]})
        out.append(d)
    json.dump(out, open(os.path.join(RAW, "nb_detail.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(out), sum(1 for o in out if "error" in o))
