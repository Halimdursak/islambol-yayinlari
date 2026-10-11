"""Nobel Kitap liste sayfaları -> data/raw/nb_list.json"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(__file__))
from common import *
from bs4 import BeautifulSoup
items = {}
for p in range(1, 6):
    url = "https://nobelkitap.com/yayinevi/islambol-yayinlari" + ("" if p == 1 else f"?page={p}")
    h = get(url, f"nb_p{p}.html")
    if not h: break
    s = BeautifulSoup(h, "html.parser")
    n = 0
    for a in s.select('a[href^="/kitap/"]'):
        href = a["href"]
        if href in items: continue
        n += 1
        txt = a.get_text(" ", strip=True)
        items[href] = {"slug": href.split("/kitap/")[1], "url": "https://nobelkitap.com" + href,
                       "title_attr": a.get("title"), "text": txt, "page": p}
    print("page", p, "new", n)
    if n == 0: break
json.dump(list(items.values()), open(os.path.join(RAW, "nb_list.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(items))
