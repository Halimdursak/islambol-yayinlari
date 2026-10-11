"""Küresel Kitap liste sayfalarını (1-4) çek -> data/raw/kk_list.json"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from bs4 import BeautifulSoup
items = []
for p in range(1, 5):
    url = f"https://www.kureselkitap.com/firma/7929/islambol-yayinlari/!Sayfa={p}&Siralama=&GosterimSayisi=25&Satista=0&"
    h = get(url, f"kk_p{p}.html")
    if not h: continue
    s = BeautifulSoup(h, "html.parser")
    for li in s.select("li[id^=Urun-]"):
        a = li.select_one(".UrunAdi a")
        img = li.select_one("img")
        pr = li.select_one("meta[itemprop=price]")
        lf = li.select_one(".LFiyat span")
        items.append({"kk_id": li["id"].split("-")[1], "title": a.get_text(strip=True),
                      "url": "https://www.kureselkitap.com" + a["href"],
                      "price_sale": pr["content"] if pr else None,
                      "price_list": lf.get_text(strip=True) if lf else None,
                      "img": img.get("src") if img else None, "page": p})
json.dump(items, open(os.path.join(RAW, "kk_list.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(items), len({i['kk_id'] for i in items}))
