"""Kaynakları birleştir -> data/catalog/books.json, authors.json (+ data/raw/merge_log.json)

Girdiler:
  data/raw/ky/b*.py      Kitapyurdu detay sayfaları (firecrawl ile çekilip elle aktarıldı)
  data/raw/nb_detail.json  Nobel Kitap (s4)
  data/raw/kk_detail.json  Küresel Kitap (s3)
  data/raw/extra/*.json  (varsa) diğer kaynaklardan eksik başlıklar
"""
import sys, os, json, re, glob, importlib.util, difflib
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, RAW
from textutil import slugify, norm_title, isbn_norm, strip_titles, fold

CAT = os.path.join(ROOT, "data", "catalog")
os.makedirs(CAT, exist_ok=True)
LOG = {"fuzzy_matches": [], "unmatched_kk": [], "conflicts": [], "excluded": []}

# ---- elle düzeltme tabloları -------------------------------------------------
AUTHOR_CANON = {
    "halid-el-huseynan": "Halid el-Huseynan",
    "halid-el-huseynan-": "Halid el-Huseynan",
    "muferrih-b-suleyman-el-kusi": "Müferrih b. Süleyman el-Kûsî",
    "muferrih-bin-suleyman-el-kusi": "Müferrih b. Süleyman el-Kûsî",
    "m-hudai-senturk": "M. Hüdai Şentürk",
    "iyad-kunaybi": "İyad Kunaybi",
    "riza-nur": "Rıza Nur",
    "ali-seyyar": "Ali Seyyar",
    "mustafa-sabri-efendi": "Mustafa Sabri Efendi",
}
EXCLUDE_KK_TITLE = re.compile(r"yeni eserler|yeni kitaplar", re.I)  # "ön sipariş" yer tutucu ilanları


# Kaynak metnindeki açık ifadelere dayanan elle düzeltmeler (neden: yorumda)
OVERRIDES = {
    # Küresel açıklaması: "İki Eser ... iki kitap toplam 80 sayfa" -> ikili paket
    "cumhuriyetin-ilk-yillarinda-satilan-camiler-ve-yasaklanan-dini-kitaplar": {
        "is_set": True, "set_info": {"count": 2, "unit": "Kitap", "label": "İki Eser (Küresel açıklaması)"}},
}


def money(s):
    if s is None: return None
    s = str(s).strip().replace("TL", "").replace("₺", "").strip()
    if not re.search(r"\d", s): return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try: return float(s)
    except ValueError: return None


def ky_date(s):
    m = re.match(r"(\d\d)\.(\d\d)\.(\d{4})$", s or "")
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


def dims(s):
    if not s: return None
    m = re.search(r"(\d+[.,]?\d*)\s*[xX]\s*(\d+[.,]?\d*)", s)
    if not m: return None
    a, b = sorted((x.replace(",", ".") for x in m.groups()), key=float)
    return f"{a} x {b} cm"


def load_ky():
    out = []
    for p in sorted(glob.glob(os.path.join(RAW, "ky", "b*.py"))):
        spec = importlib.util.spec_from_file_location("kyb", p)
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        out.extend(m.B)
    for b in out: b["desc"] = b["desc"].strip()
    return out


def clean_desc(d):
    if not d: return d
    d = d.replace("\xad", "").replace("\r", "")
    d = re.sub(r"\n*\s*Devamını Oku\s*$", "", d.strip())
    parts = [p.strip() for p in d.split("\n\n")]
    out = []
    for p in parts:           # PDF'ten yapıştırma artığı: tek harflik satırları birleştir
        if out and (len(p) <= 2 or len(out[-1]) <= 2) and p and not re.match(r"^[-–•\d]", p):
            out[-1] = out[-1] + p
        else:
            out.append(p)
    d = "\n\n".join(x for x in out if x)
    d = re.sub(r"(?m)^[-–•]\s{2,}", "- ", d)
    return d.strip()


def unwrap(s):
    """Tamamı tek bir parantez çifti içindeyse dış parantezi kaldır."""
    if not s or not (s.startswith("(") and s.endswith(")")): return s
    depth = 0
    for i, ch in enumerate(s):
        depth += (ch == "(") - (ch == ")")
        if depth == 0 and i < len(s) - 1: return s
    return s[1:-1].strip()


def split_title(t):
    if " & " in t:
        a, b = t.split(" & ", 1)
        return a.strip(), b.strip()
    return t.strip(), None


def majority(cands):
    """cands: [(source, value)] sıralı öncelikle; çoğunluk, eşitlikte ilk."""
    vals = [(s, v) for s, v in cands if v not in (None, "")]
    if not vals: return None, None, []
    cnt = {}
    for s, v in vals: cnt.setdefault(v, []).append(s)
    best = max(cnt.items(), key=lambda kv: (len(kv[1]), -[v for _, v in vals].index(kv[0])))
    return best[0], best[1][0], (list(cnt.keys()) if len(cnt) > 1 else [])


def main():
    ky = load_ky()
    nb = [x for x in json.load(open(os.path.join(RAW, "nb_detail.json"), encoding="utf-8")) if "error" not in x]
    kk_all = json.load(open(os.path.join(RAW, "kk_detail.json"), encoding="utf-8"))
    kk = [x for x in kk_all if "error" not in x]
    kk_err = [x for x in kk_all if "error" in x]
    groups = []  # her biri {"ky":..,"nb":..,"kk":..}

    def find_by_isbn(i):
        for g in groups:
            if i and i in g["isbns"]: return g
    for b in ky:
        groups.append({"ky": b, "nb": None, "kk": None, "ot": None, "isbns": {isbn_norm(b["isbn"])} - {None}, "titles": {norm_title(split_title(b["title"])[0])}})
    for n in nb:
        j = n.get("jsonld_book") or {}
        i = isbn_norm(j.get("isbn") or n.get("isbn_text"))
        g = find_by_isbn(i)
        if g is None:
            g = {"ky": None, "nb": None, "kk": None, "ot": None, "isbns": set(), "titles": set()}; groups.append(g)
        g["nb"] = n; g["isbns"] |= ({i} - {None}); g["titles"].add(norm_title(j.get("name") or n["list_text"]))
    for k in kk:
        title = k["list_title"]
        if EXCLUDE_KK_TITLE.search(title):
            LOG["excluded"].append({"source": "kureselkitap", "title": title, "url": k["url"], "reason": "kitap değil, ön sipariş yer tutucusu"}); continue
        i = isbn_norm(k.get("isbn"))
        g = find_by_isbn(i)
        if g is None:
            nt = norm_title(title)
            best, br = None, 0
            for gg in groups:
                for t in gg["titles"]:
                    r = difflib.SequenceMatcher(None, nt, t).ratio()
                    if nt and (nt == t or t.startswith(nt) or nt.startswith(t)): r = max(r, 0.95)
                    if r > br: best, br = gg, r
            if best is not None and br >= 0.9 and not (i and best["isbns"] and i not in best["isbns"]):
                g = best; LOG["fuzzy_matches"].append({"kk": title, "ratio": round(br, 3), "matched_titles": sorted(g["titles"])})
        if g is None:
            g = {"ky": None, "nb": None, "kk": None, "ot": None, "isbns": set(), "titles": set()}; groups.append(g)
        g["kk"] = k; g["isbns"] |= ({i} - {None}); g["titles"].add(norm_title(title))
    for p_ in sorted(glob.glob(os.path.join(RAW, "extra", "*.json"))):
        o = json.load(open(p_, encoding="utf-8"))
        i = isbn_norm(o.get("isbn")); g = find_by_isbn(i)
        if g is None:
            g = {"ky": None, "nb": None, "kk": None, "ot": None, "isbns": set(), "titles": set()}; groups.append(g)
        g["ot"] = o; g["isbns"] |= ({i} - {None}); g["titles"].add(norm_title(o["title"]))
    for e in kk_err:
        LOG["unmatched_kk"].append({"kk_id": e["kk_id"], "url": e["url"], "error": e["error"]})

    books, used_ids = [], set()
    for g in groups:
        b = build(g, used_ids)
        books.append(b)
    for b in books:
        o = OVERRIDES.get(b["id"])
        if o: b.update(o)
    books.sort(key=lambda x: fold(x["title"]))
    old_path = os.path.join(CAT, "books.json")
    if os.path.exists(old_path):   # daha önce indirilmiş kapak bilgisini koru
        old = {o["id"]: o for o in json.load(open(old_path, encoding="utf-8"))}
        for bk in books:
            oc = old.get(bk["id"], {}).get("cover") or {}
            if oc.get("local_path") and os.path.exists(os.path.join(ROOT, oc["local_path"])): bk["cover"] = oc
    cc = {bk["id"]: bk.pop("_cover_candidates") for bk in books}
    json.dump(cc, open(os.path.join(RAW, "cover_candidates.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(books, open(os.path.join(CAT, "books.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    authors = build_authors(books, ky)
    json.dump(authors, open(os.path.join(CAT, "authors.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(LOG, open(os.path.join(RAW, "merge_log.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("books", len(books), "authors", len(authors), "fuzzy", len(LOG["fuzzy_matches"]), "kk fetch-error", len(kk_err))


def clean_author(name):
    name = name.strip()
    plain = strip_titles(name)
    slug = slugify(plain)
    return AUTHOR_CANON.get(slug, plain), name


def build(g, used):
    ky, nb, kk, ot = g["ky"], g["nb"], g["kk"], g["ot"]
    nbj = (nb or {}).get("jsonld_book") or {}
    srcs = {"kitapyurdu": None, "nobelkitap": None, "kureselkitap": None, "other": []}
    if ky: srcs["kitapyurdu"] = f"https://www.kitapyurdu.com/kitap/{ky_slug(ky)}/{ky['kyid']}.html"
    if nb: srcs["nobelkitap"] = nb["url"]
    if kk: srcs["kureselkitap"] = kk["url"]
    if ot: srcs["other"].append({"name": ot["source"], "url": ot["url"]})
    # başlık
    alt = []
    sub_src = None
    kk_title = (kk or {}).get("title_clean") or (kk or {}).get("list_title")
    if ky: title, subtitle = split_title(ky["title"]); sub_src = "kitapyurdu" if subtitle else None
    elif nbj.get("name"): title, subtitle = nbj["name"].strip(), None
    elif kk: title, subtitle = kk_title.strip(), None
    else:
        m_ = re.match(r"^(.*?)\s*\((.+)\)\s*$", ot["title"])
        title, subtitle = (m_.group(1).strip(), m_.group(2).strip()) if m_ else (ot["title"].strip(), None)
    if not subtitle and kk and kk.get("subtitle"):
        subtitle, sub_src = kk["subtitle"].strip(), "kureselkitap"
    subtitle = unwrap(subtitle)
    # cilt/takım ve baskı ifadelerini başlıktan ayır
    set_info, edition = None, None
    m = re.search(r"\s*\((\d+)\s*(Cilt|Kitap)(?:\s*(?:Takım|Seti))?\)\s*$", title)
    if m:
        set_info = {"count": int(m.group(1)), "unit": m.group(2), "label": m.group(0).strip(" ()")}; title = title[: m.start()].strip()
    m = re.search(r"\s*\((\d+\.\s*Baskı)\)\s*$", title)
    if m: edition = m.group(1); title = title[: m.start()].strip()
    for cand in [nbj.get("name"), kk_title, (kk or {}).get("list_title"), ky["title"] if ky else None]:
        if cand and cand.strip() and cand.strip() != title and cand.strip() not in alt:
            alt.append(cand.strip())
    alt = [a for a in alt if a != (f"{title} & {subtitle}" if subtitle else None)]
    # id
    bid = slugify(title)
    if bid in used:
        bid = slugify(title + " " + (ky["isbn"] if ky else (nbj.get("isbn") or (kk or {}).get("isbn") or "2")))
    used.add(bid)
    # yazarlar
    display = None; authors_raw = []
    contrib = (kk or {}).get("contributors") or ""
    if ky: authors_raw = ky["authors"]
    elif kk and kk.get("authors_links"):
        authors_raw = [a for a in kk["authors_links"] if a not in contrib]
    if not authors_raw and nbj.get("author"):
        a = nbj["author"]; authors_raw = [a["name"]] if isinstance(a, dict) else [x["name"] for x in a]
    if not authors_raw and nb and nb.get("author_text"): authors_raw = [nb["author_text"]]
    if not authors_raw and ot: authors_raw = ot["authors"]
    cleaned = [clean_author(a) for a in authors_raw]
    authors = [c[0] for c in cleaned]
    display = ", ".join(c[1] for c in cleaned) or None
    # alanlar (çok kaynaklı)
    fs = {}
    def pick(field, cands):
        v, src, conf = majority(cands)
        fs[field] = src
        if conf: LOG["conflicts"].append({"book": bid, "field": field, "values": [f"{s}={x}" for s, x in cands if x not in (None, "")]})
        return v
    isbn = pick("isbn", [("kitapyurdu", isbn_norm(ky["isbn"]) if ky else None), ("nobelkitap", isbn_norm(nbj.get("isbn") or (nb or {}).get("isbn_text"))), ("kureselkitap", isbn_norm((kk or {}).get("isbn"))), ("ravzakitap", isbn_norm((ot or {}).get("isbn")))])
    pages = pick("pages", [("kitapyurdu", int(ky["pages"]) if ky and ky["pages"] else None), ("kureselkitap", int(kk["pages"]) if kk and (kk.get("pages") or "").isdigit() else None), ("nobelkitap", int(nb["pages"]) if nb and (nb.get("pages") or "").isdigit() else None), ("ravzakitap", int(ot["pages"]) if ot and (ot.get("pages") or "").isdigit() else None)])
    kyd = ky_date(ky["date"]) if ky else None
    kky = (kk or {}).get("year")
    if kyd and kky and kyd[:4] != kky:
        LOG["conflicts"].append({"book": bid, "field": "publish_date", "values": [f"kitapyurdu={kyd}", f"kureselkitap={kky}"]})
    pdate = kyd or (kky if kky and re.match(r"^\d{4}$", kky) else None)
    fs["publish_date"] = "kitapyurdu" if kyd else ("kureselkitap" if pdate else None)
    if not pdate and ot and re.match(r"^\d{4}$", ot.get("year") or ""): pdate, fs["publish_date"] = ot["year"], "ravzakitap"
    dimension = pick("dimensions", [("kitapyurdu", dims(ky["dim"]) if ky else None), ("kureselkitap", dims((kk or {}).get("dimensions"))), ("nobelkitap", dims((nb or {}).get("dimensions"))), ("ravzakitap", dims((ot or {}).get("dimensions")))])
    binding = pick("binding", [("kitapyurdu", ky["binding"] if ky else None), ("kureselkitap", (kk or {}).get("binding"))])
    if binding is None and ot and ot.get("binding"): binding, fs["binding"] = ot["binding"], "ravzakitap"
    if binding is None and nb and nb.get("binding"):
        binding = nb["binding"]; fs["binding"] = "nobelkitap"
    paper = ky["paper"] if ky else None
    fs["paper"] = "kitapyurdu" if paper else None
    if not paper and kk and kk.get("paper"): paper, fs["paper"] = kk["paper"], "kureselkitap"
    if not paper and nb and nb.get("paper"): paper, fs["paper"] = nb["paper"], "nobelkitap"
    if not paper and ot and ot.get("paper"): paper, fs["paper"] = ot["paper"], "ravzakitap"
    price = pick("price_list_try", [("kitapyurdu", money(ky["price"]) if ky else None), ("kureselkitap", money((kk or {}).get("price_list"))), ("nobelkitap", money((nb or {}).get("price_list"))), ("ravzakitap", money((ot or {}).get("price_list")))])
    # açıklama: Kitapyurdu > Nobel > Küresel; ama başka kaynak %15'ten fazla uzunsa (KY kesilmiş olabilir) uzun olan
    cands = [(src, clean_desc(d)) for src, d in [("kitapyurdu", ky["desc"] if ky else None), ("nobelkitap", (nb or {}).get("description")),
                                                 ("kureselkitap", (kk or {}).get("description")), ("ravzakitap", (ot or {}).get("description"))] if d and d.strip()]
    desc, dsrc = (cands[0][1], cands[0][0]) if cands else (None, None)
    for src, d in cands[1:]:
        if len(d) > len(desc) * 1.15:
            desc, dsrc = d, src
    fs["description"] = dsrc
    fs["subtitle"] = sub_src
    if ky and nb and nb.get("description") and dsrc == "kitapyurdu":
        r = difflib.SequenceMatcher(None, fold(re.sub(r"\s+", " ", desc))[:600], fold(re.sub(r"\s+", " ", clean_desc(nb["description"])))[:600], autojunk=False).ratio()
        if r < 0.9: LOG["conflicts"].append({"book": bid, "field": "description(ky vs nobel, ilk 600 karakter)", "values": [f"benzerlik={r:.2f}"]})
    cats = {}
    if ky and ky["cats"]: cats["kitapyurdu"] = ky["cats"]
    if kk and kk.get("categories"): cats["kureselkitap"] = [" > ".join(kk["categories"])]
    if nb and len(nb.get("breadcrumb", [])) > 2: cats["nobelkitap"] = [" > ".join(nb["breadcrumb"][1:-1])]
    allc = []
    for s in ("kitapyurdu", "kureselkitap", "nobelkitap"):
        for c in cats.get(s, []):
            if c not in allc: allc.append(c)
    full_title = (ky["title"] if ky else title)
    SETRE = r"seti|kitaplığı|serisi"
    is_set = set_info is not None or bool(re.search(SETRE, ky["title"] if ky else "", re.I)) or bool(re.search(SETRE, (kk or {}).get("list_title", ""), re.I))
    cover_src = None
    if ky: cover_src = ky["cover"]
    book = {
        "id": bid, "title": title, "subtitle": subtitle, "alt_titles": alt, "edition": edition,
        "authors": authors, "author_display": display,
        "isbn": isbn, "pages": pages, "publish_date": pdate,
        "dimensions": dimension, "binding": binding, "paper": paper, "language": "tr",
        "categories": allc, "category_sources": cats,
        "description": desc, "price_list_try": price,
        "is_set": is_set, "set_info": set_info, "set_items": [], "series": None,
        "contributors": (kk or {}).get("contributors"),
        "cover": {"source_url": cover_src, "local_path": None, "width": None, "height": None},
        "sources": srcs,
        "field_sources": fs,
        "_cover_candidates": {"kitapyurdu": ky["cover"] if ky else None, "nobelkitap": nbj_image(nbj), "kureselkitap": (kk or {}).get("image"), "ravzakitap": (ot or {}).get("cover_url")},
    }
    return book


def nbj_image(j):
    im = j.get("image")
    if isinstance(im, list): im = im[0] if im else None
    return im


_KYMAP = {}
for _l in open(os.path.join(RAW, "ky_urls.txt"), encoding="utf-8"):
    if "|" in _l:
        _i, _s = _l.strip().split("|", 1); _KYMAP[_i] = _s


def ky_slug(ky):
    return _KYMAP.get(ky["kyid"], "")


def build_authors(books, ky):
    ky_urls = {}
    ky_bio = {}
    for b in ky:
        for a in b["authors"]:
            plain, _ = clean_author(a)
            if b.get("author_url"): ky_urls.setdefault(plain, b["author_url"])
            if b.get("bio"): ky_bio[plain] = (b["bio"].strip(), b.get("author_url"))
    amap = {}
    for bk in books:
        raw = bk["author_display"].split(", ") if bk["author_display"] else []
        for plain, rawname in zip(bk["authors"], raw):
            a = amap.setdefault(plain, {"name": plain, "slug": slugify(plain), "display": rawname, "bio": None, "bio_source": None,
                                         "book_ids": [], "photo_url": None, "kitapyurdu_author_url": ky_urls.get(plain)})
            if len(rawname) > len(a["display"]): a["display"] = rawname
            a["book_ids"].append(bk["id"])
            if plain in ky_bio: a["bio"], a["bio_source"] = ky_bio[plain]
    return sorted(amap.values(), key=lambda a: fold(a["name"]))


if __name__ == "__main__":
    main()
