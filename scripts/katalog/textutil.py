import re, unicodedata
TR = str.maketrans({"ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g", "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c",
                    "â": "a", "Â": "a", "î": "i", "Î": "i", "û": "u", "Û": "u", "ô": "o", "ê": "e", "ʻ": "", "’": "", "‘": "", "'": "", "“": "", "”": "", '"': ""})
def fold(s):
    s = (s or "").translate(TR)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower()
def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", fold(s)).strip("-")
def norm_title(s):
    s = fold(s)
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"\b(\d+\.?\s*baski|\d+\s*(cilt|kitap)|takim|seti?)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)
def isbn_norm(s):
    d = re.sub(r"\D", "", s or "")
    return d if len(d) == 13 else None
TITLES = re.compile(r"^((prof|doc|dr|doç|şeyhülislam|seyhulislam|sultan|general)\.?\s*)+", re.I)
def strip_titles(name):
    n = name.strip()
    prev = None
    while prev != n:
        prev = n
        n = re.sub(r"^(Prof\.|Doç\.|Dr\.|Şeyhülislam|Şeyhülislâm|Yrd\.|Öğr\.|Üyesi)\s*", "", n).strip()
    return n
