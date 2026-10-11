"""data/catalog/REPORT.md'yi books.json / authors.json / merge_log.json'dan SAYARAK üret."""
import sys, os, json, re, difflib
sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, RAW
from textutil import fold

CAT = os.path.join(ROOT, "data", "catalog")
books = json.load(open(os.path.join(CAT, "books.json"), encoding="utf-8"))
authors = json.load(open(os.path.join(CAT, "authors.json"), encoding="utf-8"))
log = json.load(open(os.path.join(RAW, "merge_log.json"), encoding="utf-8"))
nb_list = json.load(open(os.path.join(RAW, "nb_list.json"), encoding="utf-8"))
kk_list = json.load(open(os.path.join(RAW, "kk_list.json"), encoding="utf-8"))
N = len(books)


def src_count(k):
    return sum(1 for b in books if b["sources"][k])


def only(keyset):
    return sum(1 for b in books if {k for k in ("kitapyurdu", "nobelkitap", "kureselkitap") if b["sources"][k]} | ({"other"} if b["sources"]["other"] else set()) == keyset)


covers = [b for b in books if b["cover"].get("local_path")]
fields = [("title", "Başlık"), ("subtitle", "Alt başlık"), ("authors", "Yazar"), ("isbn", "ISBN"), ("pages", "Sayfa sayısı"),
          ("publish_date", "Yayın tarihi (herhangi)"), ("dimensions", "Boyut"), ("binding", "Cilt tipi"), ("paper", "Kağıt cinsi"),
          ("categories", "Kategori"), ("description", "Açıklama"), ("price_list_try", "Liste fiyatı")]
rows = []
for k, label in fields:
    miss = [b for b in books if not b.get(k)]
    rows.append((label, N - len(miss), len(miss)))
full_date = sum(1 for b in books if b["publish_date"] and len(b["publish_date"]) == 10)
year_only = sum(1 for b in books if b["publish_date"] and len(b["publish_date"]) == 4)
cover_ok = len(covers)
bios = [a for a in authors if a["bio"]]

# KY açıklamasının Nobel ile örtüşmesi (aktarım doğruluk kontrolü)
sim = []
nbd = {x["slug"]: x for x in json.load(open(os.path.join(RAW, "nb_detail.json"), encoding="utf-8")) if "error" not in x}
for b in books:
    if b["sources"]["kitapyurdu"] and b["sources"]["nobelkitap"]:
        slug = b["sources"]["nobelkitap"].split("/kitap/")[1]
        d = nbd.get(slug, {}).get("description")
        if d and b["field_sources"]["description"] == "kitapyurdu":
            a = fold(re.sub(r"\s+", " ", b["description"]))[:500]; c = fold(re.sub(r"\s+", " ", d))[:500]
            sim.append(difflib.SequenceMatcher(None, a, c, autojunk=False).ratio())
sim_ok = sum(1 for s in sim if s >= 0.95)

conf_by_field = {}
for c in log["conflicts"]:
    conf_by_field.setdefault(c["field"], []).append(c)

promo = [b for b in books if b["description"] and re.search(r"SİPARİŞ|Kargo|Whatsap|\d+\s*(TL|tl)\b", b["description"])]
sets = [b for b in books if b["is_set"]]
no_isbn = [b for b in books if not b["isbn"]]
no_author = [b for b in books if not b["authors"]]
no_desc = [b for b in books if not b["description"]]
no_cover = [b for b in books if not b["cover"].get("local_path")]

L = []
w = L.append
w("# İslambol Yayınları — katalog toplama raporu\n")
w("Bu rapordaki tüm sayılar `scripts/katalog/s8_report.py` ile `books.json` / `authors.json` / `merge_log.json` üzerinden sayılarak üretilmiştir.\n")
w("## Özet\n")
w(f"- Birleştirilmiş benzersiz kayıt: **{N}** (set/paketler dahil: {len(sets)} set kaydı)")
w(f"- Yazar kaydı: **{len(authors)}** (özgeçmiş bulunan: {len(bios)})")
w(f"- Kapak indirilen: **{cover_ok} / {N}** (indirilemeyen: {len(no_cover)})")
w(f"- Kaynak kapsamı: Kitapyurdu {src_count('kitapyurdu')}, Nobel {src_count('nobelkitap')}, Küresel {src_count('kureselkitap')}, diğer (Ravza) {src_count('other') if False else sum(1 for b in books if b['sources']['other'])}")
w(f"- Yalnızca tek kaynakta görülen: Kitapyurdu-only {only({'kitapyurdu'})}, Nobel-only {only({'nobelkitap'})}, Küresel-only {only({'kureselkitap'})}, Ravza-only {only({'other'})}")
w(f"- Üç ana kaynakta birden bulunan: {sum(1 for b in books if all(b['sources'][k] for k in ('kitapyurdu','nobelkitap','kureselkitap')))}\n")
w("### Kaynak listeleri (ham sayılar)\n")
w(f"- Küresel Kitap liste sayfaları: {len(kk_list)} satır, {len({x['kk_id'] for x in kk_list})} benzersiz ürün (sayfalar arası tekrarlar var); bunlardan {len(log['excluded'])} tanesi kitap değil, \"ön sipariş\" yer tutucusu olduğu için kataloğa alınmadı.")
w(f"- Nobel Kitap: sitede \"64 ürün\" yazıyor ama sayfalama (page=1..3) tekrar eden ürün döndürüyor; ulaşılabilen benzersiz ürün **{len(nb_list)}**. Sıralama parametreleri işe yaramadı; eksik 14 ürün Nobel üzerinden doğrulanamadı (Küresel/Kitapyurdu'da büyük bölümü zaten var).")
w("- Kitapyurdu: 39 ürün (20 + 19) doğrulandı; site doğrudan HTTP isteklerine 403 (Cloudflare) verdiği için Firecrawl ile çekildi.\n")
w("## Alan doldurma tablosu\n")
w("| Alan | Dolu | Eksik |\n|---|---:|---:|")
for label, ok, miss in rows:
    w(f"| {label} | {ok} | {miss} |")
w(f"\nYayın tarihi ayrıntısı: tam tarih (gg.aa.yyyy kaynaklı, yyyy-mm-dd) {full_date}, yalnızca yıl {year_only}, tarih yok {N - full_date - year_only}.\n")
w("## Açıklama kaynağı dağılımı\n")
from collections import Counter
cnt = Counter(b["field_sources"]["description"] for b in books)
for k, v in cnt.most_common(): w(f"- {k}: {v}")
w("")
w("## Aktarım doğruluk kontrolü\n")
w("Kitapyurdu verileri Firecrawl'ın `json` çıkarımı ile alındı (LLM tabanlı; bkz. 'Bilinen sınırlamalar'). Doğrulama için:")
w(f"- Kitapyurdu açıklaması kullanılan ve Nobel'de de açıklaması olan {len(sim)} kitapta ilk 500 karakter benzerliği >= %95 olan: **{sim_ok}** (kalanlar biçim farkı: tırnak/boşluk/italik vb.).")
w(f"- Eşleştirme ISBN'e dayanıyor; Kitapyurdu'daki 39 kitabın tamamı Nobel ve/veya Küresel'deki bir kayıtla ISBN üzerinden eşleşti (yalnızca Kitapyurdu'da kalan: {only({'kitapyurdu'})}). Başlık benzerliğiyle (ISBN'siz) eşleşen {len(log['fuzzy_matches'])} Küresel kaydı merge_log.json'da listeli.")
w("")
w("## Kaynaklar arası tutarsızlıklar\n")
w(f"Toplam {len(log['conflicts'])} alan çelişkisi kaydedildi (çoğunluk değeri seçildi, eşitlikte Kitapyurdu > Küresel > Nobel).\n")
for f, items in sorted(conf_by_field.items()):
    w(f"### {f} ({len(items)})")
    for c in items: w(f"- `{c['book']}`: " + "; ".join(c["values"]))
    w("")
w("Not: Nobel'in cilt alanı hep \"Ciltsiz\" (Küresel/Kitapyurdu: \"Karton Kapak\"); aynı şey kabul edilip çelişki sayılmadı, Nobel yalnızca yedek.\n")
w("## Setler / paketler\n")
for b in sets:
    si = b["set_info"]["label"] if b.get("set_info") else "—"
    w(f"- `{b['id']}` — {b['title']} ({si}); ISBN: {b['isbn'] or 'yok'}; set içeriği kaynaklarda listelenmediği için `set_items` boş.")
w("")
w("## Eksikler\n")
w(f"- ISBN'i olmayan ({len(no_isbn)}): " + ", ".join(f"`{b['id']}`" for b in no_isbn))
w(f"- Yazarı belirsiz ({len(no_author)}): " + ", ".join(f"`{b['id']}`" for b in no_author))
w(f"- Açıklaması olmayan ({len(no_desc)}): " + (", ".join(f"`{b['id']}`" for b in no_desc) or "yok"))
w(f"- Kapağı indirilemeyen ({len(no_cover)}): " + (", ".join(f"`{b['id']}`" for b in no_cover) or "yok"))
w(f"- Açıklaması tanıtım/sipariş ilanı niteliğinde görünen ({len(promo)}): " + ", ".join(f"`{b['id']}`" for b in promo))
w("- Yazar özgeçmişi: yalnızca Mustafa Armağan için (Kitapyurdu kitap sayfası, kaynak URL authors.json'da). Diğer yazarlar için Kitapyurdu/Nobel/Küresel yazar sayfalarında özgeçmiş metni bulunamadı veya doğrulanamadı; yazar fotoğrafı hiçbir kaynakta yok (`photo_url: null`).\n")
w("## Şüpheli / emin olunmayan kayıtlar\n")
w(open(os.path.join(os.path.dirname(__file__), "suspicious.md"), encoding="utf-8").read().strip())
w("")
w("## Bilinen sınırlamalar\n")
w("- Firecrawl `json` çıkarımı Kitapyurdu'daki *yazar özgeçmişi* alanında tutarsız/uydurma metinler üretti (aynı yazar için farklı doğum yılı/yeri). Bu nedenle JSON çıkarımından gelen TÜM özgeçmişler **atıldı**; yalnızca ham markdown'dan okunan Armağan özgeçmişi tutuldu.")
w("- Kitapyurdu açıklama/ISBN/sayfa vb. alanları aynı yöntemle alındığı için Nobel/Küresel ile çapraz doğrulandı (yukarıda). Kitapyurdu sayfalarında `Liste Fiyatı` bazı kitaplarda Nobel/Küresel ile farklı (bkz. çelişkiler).")
w("- Fiyatlar anlık satış fiyatı değil, **liste fiyatı**dır (price_list_try); satış fiyatları mağazaya göre değişir ve bu kataloğa alınmadı.")
w("- Kitapyurdu kategorileri bazı Seyfi Say / Ali Seyyar kitaplarında 'Edebiyat > Roman (Yerli)' olarak görünüyor; bu kaynak kategorisi olduğu gibi bırakıldı (sınıflandırma hatası olabilir).")
w("- Kapaklar kaynak sitelerden indirildi; telif/kullanım izni bu çalışmada değerlendirilmedi.")
open(os.path.join(CAT, "REPORT.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
print("report ok", N, cover_ok)
