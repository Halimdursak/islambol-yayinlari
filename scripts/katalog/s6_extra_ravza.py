"""Kitapyurdu/Nobel/Küresel'de olmayıp Ravza Kitap'ta görülen başlık(lar) -> data/raw/extra/*.json"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from bs4 import BeautifulSoup
os.makedirs(os.path.join(RAW, "extra"), exist_ok=True)
PAGES = [("rabbimizi-taniyalim-1", "https://www.ravzakitap.com/rabbimizi-taniyalim-1-marifetullah-ilmi")]
for bid, url in PAGES:
    h = get(url, f"other_ravza_{bid}.html", delay=3)
    s = BeautifulSoup(h, "html.parser")
    og = re.search(r'og:image" content="([^"]+)', h)
    for t in s(["script", "style"]): t.decompose()
    lines = s.get_text("\n", strip=True).split("\n")
    def spec(label):
        for i, l in enumerate(lines):
            if l == label and i + 1 < len(lines): return lines[i + 1].strip()
    i = lines.index("Kitap Açıklaması"); j = lines.index("Kitap Özellikleri")
    desc = "\n\n".join(lines[i + 1:j])
    price = re.search(r"%\n\d+\n([\d.,]+)\nTL\n([\d.,]+)\nTL", "\n".join(lines))
    rec = {"source": "ravzakitap", "url": url, "title": lines[lines.index("Yazar:") - 1], "authors": [spec("Yazar")], "isbn": spec("Barkod"),
           "year": spec("Basım Yılı"), "pages": spec("Sayfa Sayısı"), "binding": spec("Cilt Durumu"), "paper": spec("Kağıt Türü"),
           "dimensions": spec("Ebat"), "price_list": price.group(1) if price else None, "price_sale": price.group(2) if price else None,
           "description": desc, "cover_url": og.group(1) if og else None}
    json.dump(rec, open(os.path.join(RAW, "extra", f"{bid}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(bid, rec["isbn"], rec["pages"], rec["price_list"], len(desc))
