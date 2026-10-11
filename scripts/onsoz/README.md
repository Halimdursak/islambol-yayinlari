# scripts/onsoz — Kitapyurdu önizleme (İç Sayfalara Gözat) toplayıcı

Firecrawl MCP betikten çağrılamaz; o yüzden akış iki parçalı:

1. **(Araçla, elle)** Her kitap URL'si (`data/catalog/onsoz/_raw/urls.txt`) için Firecrawl `firecrawl_scrape`:
   `formats:["links"], onlyMainContent:false, maxAge:0,
   actions:[wait 1500, click button[data-action="view_pages"], wait 4000, scrape]`.
   Sonuç büyükse dosyaya kaydedilir. Düğme yoksa Firecrawl "Element not found" verir -> kitap `onizleme_yok`.
2. `python -I scripts/onsoz/extract.py <sonuc.txt> ...` -> `_raw/<id>.json` (modal içindeki `ky-pd-pages-image` URL'leri).
3. `PYTHONIOENCODING=utf-8 python -I scripts/onsoz/build.py` -> görselleri `public/onsoz/<slug>/NN.jpg` olarak indirir
   (UA + Referer, 1 sn bekleme, mevcutları atlar), `data/catalog/onsoz/<slug>.json` ve `INDEX.json` üretir.
   `kinds.json` (slug -> sayfa sınıfları listesi) JSON'lara `kind` olarak işlenir; elle sınıflandırma buradan güncellenir.
4. `python -I scripts/onsoz/report.py` -> `REPORT.md` (sayılar betikle hesaplanır).

Başlık/yazar: `_raw/listing_meta.tsv` (yayınevi liste sayfasından, Türkçe karakterli). Pillow bu makinede
Uygulama Denetimi ilkesiyle engelli; bu yüzden JPEG boyutu saf Python ile okunuyor.
