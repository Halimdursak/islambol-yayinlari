"""Firecrawl sonuc dosyasindan (view_pages tiklamasi sonrasi) onizleme URL'lerini cikarir.
Kullanim: python -I extract.py <firecrawl_sonuc.txt> [...]
Cikti: data/catalog/onsoz/_raw/<kitapyurdu_id>.json
"""
import json, re, sys, html as H
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "catalog" / "onsoz" / "_raw"
IMG = re.compile(r'<img[^>]*ky-pd-pages-image[^>]*>', re.S)
ATTR = re.compile(r'\b(src|data-src)="(https://img\.kitapyurdu\.com/[^"]+)"')
URLRE = re.compile(r'kitapyurdu\.com/kitap/([^/]+)/(\d+)\.html')


def parse(path: Path) -> dict:
    d = json.loads(path.read_text(encoding="utf-8"))
    md = d.get("metadata", {})
    url = md.get("sourceURL") or md.get("url") or ""
    m = URLRE.search(url)
    slug, kid = (m.group(1), int(m.group(2))) if m else (None, None)
    title_tag = H.unescape(md.get("title") or "")
    t = re.match(r"(.*?)\s*\(([^()]*)\)\s*Fiyat", title_tag)
    title, author = (t.group(1).strip(), t.group(2).strip()) if t else (title_tag, "")
    scrapes = (d.get("actions") or {}).get("scrapes") or []
    pages, seen = [], set()
    for s in scrapes:
        h = s.get("html") or ""
        i = h.find("ky-pd-pages-modal")
        seg = h[i:] if i >= 0 else ""
        for tag in IMG.findall(seg):
            a = {k: v for k, v in ATTR.findall(tag)}
            u = a.get("src") or a.get("data-src")
            if u and u not in seen:
                seen.add(u)
                pages.append(u)
    return {"kitapyurdu_slug": slug, "kitapyurdu_id": kid, "kitapyurdu_url": url.split("?")[0],
            "title": title, "author_display": author, "pages": pages,
            "status": "ok" if pages else "onizleme_yok"}


if __name__ == "__main__":
    RAW.mkdir(parents=True, exist_ok=True)
    for f in sys.argv[1:]:
        r = parse(Path(f))
        if not r["kitapyurdu_id"]:
            print("URL cozulemedi:", f); continue
        (RAW / f"{r['kitapyurdu_id']}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
        print(r["kitapyurdu_id"], r["kitapyurdu_slug"], r["status"], len(r["pages"]), "|", r["title"], "|", r["author_display"])
