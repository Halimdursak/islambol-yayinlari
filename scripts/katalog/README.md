# Katalog toplama betikleri

İslambol Yayınları (kendi sitesi yok) kitaplarını Küresel Kitap, Nobel Kitap, Kitapyurdu (ve Ravza Kitap çapraz kontrolü) üzerinden toplar.

Çalıştırma sırası (hepsi `python -I` ile; ağ gerekenler 1-2.5 sn aralıkla, 429'da bekleyerek çalışır):

| Betik | İş | Çıktı |
|---|---|---|
| `s1_kureselkitap_list.py` | Küresel liste sayfaları 1-4 | `data/raw/kk_list.json` |
| `s2_nobel_list.py` | Nobel liste sayfaları | `data/raw/nb_list.json` |
| `s3_kureselkitap_detail.py` | Küresel ürün sayfaları (`--offline`: yalnızca önbellek) | `data/raw/kk_detail.json` |
| `s4_nobel_detail.py` | Nobel ürün sayfaları (JSON-LD + metin) | `data/raw/nb_detail.json` |
| `s6_extra_ravza.py` | Ravza'da görülen ek başlık | `data/raw/extra/*.json` |
| `s5_merge.py` | ISBN/başlıkla birleştirme | `data/catalog/books.json`, `authors.json`, `data/raw/merge_log.json` |
| `s7_covers.py` | Kapakları indirir (en yüksek çözünürlük) | `public/kapaklar/<id>.<uzantı>` |
| `s8_report.py` | Sayarak rapor üretir (`suspicious.md` elle yazılmış notları ekler) | `data/catalog/REPORT.md` |

Kitapyurdu doğrudan HTTP isteklerine 403 verir (Cloudflare). Detay sayfaları Firecrawl (`scrape`, `json` biçimi) ile çekilip
`data/raw/ky/b1.py..b4.py` dosyalarına aktarıldı; URL listesi `data/raw/ky_urls.txt`. Bu adım betikle tekrarlanamaz (elle aktarım);
Kitapyurdu verisini yenilemek için aynı alanlar bu dosyalarda güncellenmelidir. Kitapyurdu sayfalarından gelen yazar özgeçmişleri
güvenilmez bulunduğu için kullanılmadı (bkz. REPORT.md).

Önbellek `data/raw/` altındadır; silinirse betikler yeniden çeker.
