"""Kayitli _raw/<id>.json dosyalarindan: gorselleri indirir, kitap JSON'larini ve INDEX.json'u uretir.
Tekrar calistirilabilir: mevcut gorselleri atlar, daha once girilmis `kind` degerlerini korur.
Kullanim: python -I build.py [--no-download]
"""
import json, sys, time, urllib.request, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAT = ROOT / "data" / "catalog" / "onsoz"
RAW = CAT / "_raw"
PUB = ROOT / "public" / "onsoz"
FETCHED = "2026-10-11"
RIGHTS = "Yayınevinin kendi önizleme görselleri; site yayınevi adına yapılıyor."
ONSOZ_KINDS = {"onsoz", "takdim"}
UA = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.kitapyurdu.com/"}


def jpeg_size(b: bytes):
    i = 2
    while i < len(b) - 9:
        if b[i] != 0xFF:
            i += 1; continue
        m = b[i + 1]
        if 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):
            h, w = struct.unpack(">HH", b[i + 5:i + 9]); return w, h
        i += 2 + struct.unpack(">H", b[i + 2:i + 4])[0]
    return None, None


def load_kinds():
    f = Path(__file__).with_name("kinds.json")
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


def load_meta():
    out = {}
    for line in (RAW / "listing_meta.tsv").read_text(encoding="utf-8").splitlines():
        kid, title, author, pg, date = line.split("\t")
        out[int(kid)] = {"title": title, "author": author, "book_pages": int(pg), "date": date}
    return out


def fetch(url, dest: Path):
    if dest.exists() and dest.stat().st_size > 1000:
        return dest.read_bytes()
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    time.sleep(1)
    return data


def main(download=True):
    meta = load_meta()
    kinds = load_kinds()
    index, errors = [], []
    for url in (RAW / "urls.txt").read_text(encoding="utf-8").split():
        slug, kid = url.rstrip(".html").split("/kitap/")[1].split("/")
        kid = int(kid.replace(".html", "")) if not kid.isdigit() else int(kid)
        slug = url.split("/kitap/")[1].split("/")[0]
        m = meta.get(kid, {})
        raw_f = RAW / f"{kid}.json"
        raw = json.loads(raw_f.read_text(encoding="utf-8")) if raw_f.exists() else {"pages": []}
        bf = CAT / f"{slug}.json"
        old = json.loads(bf.read_text(encoding="utf-8")) if bf.exists() else {}
        old_kind = {p["index"]: p.get("kind") for p in old.get("pages", [])}
        pages, status = [], ("ok" if raw["pages"] else "onizleme_yok")
        for i, src in enumerate(raw["pages"], 1):
            rel = f"public/onsoz/{slug}/{i:02d}.jpg"
            w = h = None
            if download:
                try:
                    data = fetch(src, ROOT / rel)
                    w, h = jpeg_size(data)
                except Exception as e:  # noqa: BLE001
                    errors.append((url, f"{src}: {e}")); status = "hata"; continue
            pages.append({"index": i, "source_url": src, "local_path": rel, "width": w, "height": h,
                          "kind": (kinds.get(slug, [])[i - 1] if i <= len(kinds.get(slug, [])) else old_kind.get(i))})
        rec = {"kitapyurdu_slug": slug, "kitapyurdu_id": kid, "kitapyurdu_url": url,
               "title": m.get("title"), "author_display": m.get("author"),
               "source_type": "kitapyurdu-preview", "page_count": len(pages), "pages": pages,
               "fetched_at": FETCHED, "rights_note": RIGHTS}
        bf.write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
        op = [p["index"] for p in pages if p["kind"] in ONSOZ_KINDS]
        index.append({"slug": slug, "kitapyurdu_id": kid, "title": m.get("title"), "author": m.get("author"),
                      "page_count": len(pages), "has_onsoz": bool(op), "onsoz_pages": op, "status": status})
    (CAT / "INDEX.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = [x for x in index if x["status"] == "ok"]
    print(f"denenen={len(index)} onizlemeli={len(ok)} yok={sum(x['status']=='onizleme_yok' for x in index)} "
          f"hata={sum(x['status']=='hata' for x in index)} sayfa={sum(x['page_count'] for x in index)} "
          f"onsozlu={sum(x['has_onsoz'] for x in index)}")
    for e in errors:
        print("HATA", *e)


if __name__ == "__main__":
    main(download="--no-download" not in sys.argv)
