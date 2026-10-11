"""Kapak görsellerini indir -> public/kapaklar/<id>.<uzantı>; books.json cover alanlarını güncelle.

Kaynak sırası: Kitapyurdu (wi:1200 / orijinal, hangisi büyükse) -> Nobel (-large) -> Küresel (orijinal boy) -> Ravza.
İndirme başarısızsa cover alanları null kalır (uydurma yok).
"""
import sys, os, json, re, struct
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, RAW, get

CAT = os.path.join(ROOT, "data", "catalog", "books.json")
OUT = os.path.join(ROOT, "public", "kapaklar")
CC = {}
os.makedirs(OUT, exist_ok=True)


def sniff(b):
    """(ext, width, height) ya da None"""
    if b[:3] == b"\xff\xd8\xff":
        i = 2
        while i < len(b) - 9:
            if b[i] != 0xFF: i += 1; continue
            mk = b[i + 1]
            if mk in (0xD8, 0x01) or 0xD0 <= mk <= 0xD7: i += 2; continue
            ln = struct.unpack(">H", b[i + 2:i + 4])[0]
            if mk in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                h, w = struct.unpack(">HH", b[i + 5:i + 9]); return "jpg", w, h
            i += 2 + ln
        return None
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        w, h = struct.unpack(">II", b[16:24]); return "png", w, h
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        c = b[12:16]
        if c == b"VP8 ":
            w, h = struct.unpack("<HH", b[26:30]); return "webp", w & 0x3FFF, h & 0x3FFF
        if c == b"VP8L":
            v = struct.unpack("<I", b[21:25])[0]; return "webp", (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
        if c == b"VP8X":
            w = int.from_bytes(b[24:27], "little") + 1; h = int.from_bytes(b[27:30], "little") + 1; return "webp", w, h
    if b[:6] in (b"GIF87a", b"GIF89a"):
        w, h = struct.unpack("<HH", b[6:10]); return "gif", w, h
    return None


def candidates(book):
    c = CC.get(book["id"], {})
    out = []
    ky = c.get("kitapyurdu")
    if ky:
        out.append(("kitapyurdu", ky.replace("/wi:500", "/wi:1200")))
        out.append(("kitapyurdu", re.sub(r"/wi:\d+", "", ky)))
    nb = c.get("nobelkitap")
    if nb:
        out.append(("nobelkitap", nb.replace("-medium.", "-large.")))
        out.append(("nobelkitap", nb))
    kk = c.get("kureselkitap")
    if kk:
        out.append(("kureselkitap", kk.replace("/320px/", "/")))
        out.append(("kureselkitap", kk))
    rv = c.get("ravzakitap")
    if rv: out.append(("ravzakitap", rv))
    return out


def main():
    global CC
    CC = json.load(open(os.path.join(RAW, "cover_candidates.json"), encoding="utf-8"))
    books = json.load(open(CAT, encoding="utf-8"))
    ok = 0
    for b in books:
        best = None  # (alan, ext, w, h, data, src, url)
        groups = {}
        for src, url in candidates(b): groups.setdefault(src, []).append(url)
        for src, urls in groups.items():
            for url in urls:
                data = get(url, binary=True, delay=0.8, retries=1)
                if not data or len(data) < 2000: continue
                info = sniff(data)
                if not info: continue
                ext, w, h = info
                if best is None or w * h > best[0]:
                    best = (w * h, ext, w, h, data, src, url)
            if best and best[2] >= 500: break
        if best is None:
            b["cover"] = {"source_url": None, "local_path": None, "width": None, "height": None}
            b["cover"]["note"] = "indirilemedi"
            continue
        _, ext, w, h, data, src, url = best
        path = os.path.join(OUT, f"{b['id']}.{ext}")
        open(path, "wb").write(data)
        b["cover"] = {"source_url": url, "source": src, "local_path": f"public/kapaklar/{b['id']}.{ext}", "width": w, "height": h}
        ok += 1
    json.dump(books, open(CAT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("covers", ok, "/", len(books))


if __name__ == "__main__":
    main()
