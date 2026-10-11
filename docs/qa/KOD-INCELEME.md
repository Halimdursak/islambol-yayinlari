# Kod İncelemesi — Q3

İnceleyen: Q3 Kod İncelemeci · Tarih: 11 Ekim 2026 · Kapsam: `src/**`, `eleventy.config.js`, `scripts/**`, `data/catalog/books.schema.json`, `package.json`, `.gitignore`/`.gitattributes`.
Durum: HEAD `feb9910` + çalışma ağacındaki commit edilmemiş değişiklikler (O1/Q1/Q2/Q4 dosyaları). İnceleme sırasında `dist/` başka bir oturum tarafından yeniden üretiliyordu; çıktıya dayanan kanıtlar o anki derlemeden ya da veri katmanının doğrudan çalıştırılmasından alındı.
Kod değiştirilmedi. Düzeltmeler SAHİP sütunundaki role gider (EKIP.md §5 kural 2).

## Özet

| Seviye | Sayı | Durum |
|---|---|---|
| CRITICAL | 0 | geçti |
| HIGH | 3 | uyarı |
| MEDIUM | 9 | bilgi |
| LOW | 11 | not |

**Karar: WARNING.** CRITICAL bulgu yok. Ancak 3 HIGH bulgu var; Q3 kabul ölçütü (EKIP.md: "CRITICAL 0, HIGH 0") karşılanmıyor, bu yüzden düzeltme turu gerekiyor. En ağır bulgu H1: `typography.css` içindeki tırnak hatası yüzünden dosyanın 27 kuralından 26'sı tarayıcıda hiç uygulanmıyor. Bunu Edge'de ölçtüm.

## Bulgular

### HIGH

| # | Seviye | Dosya:satır | Sorun | Kanıt | Öneri | SAHİP |
|---|---|---|---|---|---|---|
| H1 | HIGH | `src/assets/css/typography.css:16,24,34,42,52,60` | Altı `@font-face` satırında `url(` tek tırnakla açılıp çift tırnakla kapanıyor. Dize satır sonuna kadar kapanmadığı için CSS ayrıştırıcısı geçersiz dize üretiyor (bad-string) ve `url(` fonksiyonu dosyanın sonuna kadar açık kalıyor. Edge'de dosya ayrıştırıldı: **27 kuraldan 1'i kaldı** (o da geçersiz src'li ilk @font-face). Sonuç: web fontları hiç yüklenmiyor. `html`, `body`, `h1–h4`, `p`, `.etiket`, `.rakam`, `.metin-hero`, `.metin-giris`, `::selection` kurallarının hepsi düşüyor. Diğer 4 CSS dosyası 1:1 ayrışıyor. Hata `feb9910` ("alt dizin uyumu") commit'inde, `"/assets/fonts/…"` yolu `'../fonts/…` ile değiştirilirken girmiş. | `src: url('../fonts/eb-garamond-latin.woff2") format("woff2");` | Altı satırı da `url("../fonts/….woff2")` biçimine getirin (tırnaklar eşleşsin). Q2'ye Edge'de `document.styleSheets` kural sayısı kontrolü ya da görsel regresyon testi önerilir. | D1 (typography.css sahibi; hatayı alt dizin düzeltmesi soktu) |
| H2 | HIGH | `src/_includes/components/kitap/yardimci.mjs:148,156` + `src/_data/books.js:15` | Kitapçı metinlerindeki kampanya satırlarını temizleyen iki ayrı filtre var ve ikisi de gerçek tanıtım metnini siliyor. B2'nin filtresinde `hediye` için kelime sınırı yok ve süzme paragraf düzeyinde. Bu yüzden **2 kitabın sayfasında tanıtım metni hiç görünmüyor**: `uzgunum-viyanada-dogdum` ("Sen Viyana'nın hediyesisin" cümlesi tüm tek paragrafı düşürüyor) ve `son-sultan-vahideddinin-hatiralari-ve-beyannamesi` (tek paragraf). Derlenmiş `dist/kitap/<id>/index.html` dosyasında `kitap-detay__metin` 0 adet. `yeryuzunun-hakiki-canileri-israil` kitabında da yazarın ithaf satırı ("ruhlarına hediye ediyorum") `books.js` filtresinde `\bhediye\b` ile siliniyor. Meta description ve JSON-LD ise metni gösteriyor, yani sayfa ile SEO çıktısı birbirini tutmuyor. | `const KAMPANYA = /(\d[\d.,]*\s*(TL\|₺))\|kargo\|hediye\|sipariş\s+hattı\|whats?\s?ap/i;` · `.filter((p) => p && !KAMPANYA.test(p));` | Tek filtre kalsın (`books.js`, satır düzeyi). `aciklamaParagraflari` yalnızca paragraflara bölsün. `hediye` ve `kargo` yalnızca kampanya kalıbında eşleşsin (ör. `/kargo (ücretsiz\|bedava)/i`, `/hediye (ediliyor\|olarak)/i` + TL tutarı). Etkilenen 6 kaydı (aşağıdaki liste) Q4 ile birlikte gözden geçirin. | B2 (yardimci.mjs) + Direktör (books.js) |
| H3 | HIGH | `src/_includes/components/seo.njk:120` | JSON-LD `</` kaçışı **etkisiz**. Nunjucks dize sabitinde `\/` kaçışı `/` olarak çözülüyor, yani `replace("</", "</")` hiçbir şey yapmıyor. Bunu Eleventy'nin kendi Nunjucks'ıyla `a</script>b` girdisi vererek denedim; çıktı aynen `a</script>b`. `kitap.title`, `subtitle`, `authors`, `yazar.name`, `dizi.ad` striptags'ten geçmeden `\| safe` ile `<script>` içine basılıyor. **Hata senaryosu:** R1 kitapçıdan başlığı birebir kopyalıyor; kitapçı sayfasındaki başlık `</script><script>…` içerirse kalıcı XSS oluşur. Şema `title` için yalnızca `minLength` istiyor. Bugünkü 78 kayıtta `<` ya da `>` yok, yani şu an tetiklenmiyor; ama koruma sadece görünüşte var. | `{{ _grafJson \| replace("</", "<\/") \| safe }}` | `replace("<", "\u003c")` kullanın (Nunjucks'ta `"\u003c"` → JSON'da geçerli `<`). Q2'ye başlığında `</script>` geçen sahte kayıtla bir test önerilir. | B5 |

### MEDIUM

| # | Seviye | Dosya:satır | Sorun | Kanıt | Öneri | SAHİP |
|---|---|---|---|---|---|---|
| M1 | MEDIUM | `data/catalog/books.schema.json:39-45`; `src/_data/authors.js` | Dış kaynaklı URL'ler href'e doğrulanmadan basılıyor. `sources.*` için şemada yalnızca `"type": "string"` var. `authors.json` (`bio_source`) hiç doğrulanmıyor. Otomatik kaçış `javascript:` şemasını engellemez (`nereden-alinir.njk:16`, `yazar.njk:28`). Bugün tüm değerler `https://` ile başlıyor. | `"kitapyurdu": { "type": ["string", "null"] }` | Şemaya `"pattern": "^https://"` ekleyin. `authors.json` için küçük bir ajv şeması ekleyin (`bio_source`, `kitapyurdu_author_url`). | Direktör (şema; B2 genişletebilir) |
| M2 | MEDIUM | `src/_data/authors.js:11` | `k.book_ids`: `k` bir kitap, `book_ids` ise yazar alanı. Kitaplarda bu alan yok (0/78), bu yüzden her seferinde `y.book_ids`'e düşüyor ve kod tesadüfen doğru çalışıyor. İleride kitap kaydına (ör. set üyeleri için) `book_ids` eklenirse eşleme sessizce bozulur. Bugün `book_ids` ile `yazar_sluglari` 36 yazarda birebir tutarlı (doğrulandı). | `(k.book_ids ?? y.book_ids ?? []).includes?.(k.id) \|\| k.yazar_sluglari.includes(slug)` | `const kimlikler = new Set(y.book_ids ?? []);` → `kimlikler.has(k.id) \|\| k.yazar_sluglari.includes(slug)` | Direktör |
| M3 | MEDIUM | `src/_data/books.js:25-42` ↔ `src/_includes/components/kitap/yardimci.mjs:26-69` | Kategori eşleme iki ayrı algoritmayla yazılmış ve sonuçları farklı. `haim-nahum` (D: islam-dusuncesi · B2: + hatiralar-biyografi) ve `turk-basininda-tartismalarin-odaginda-ataturk-ve-ataturkculuk` (D: siyaset · B2: + tarih). `/kitaplar/` B2'nin sonucunu, ana sayfa ve yazar sayfası kartları ise `books.js`'in sonucunu `data-kategori`ye yazıyor. `books.js`'teki `site_kategori_sluglari` ve `kategori_sluglari` hiçbir yerde kullanılmıyor. | `kategoriliKitaplar(d.books, …)` → `site_kategorileri` alanını üzerine yazıyor | Tek eşleme kalsın. Seçenekler: `books.js` B2'nin `kategoriEsle`'sini içe aktarır, ya da `kitaplar.11tydata.js` doğrudan `books.site_kategorileri`'ni kullanır. | Direktör + B2 |
| M4 | MEDIUM | `src/_data/books.js:116`; `yardimci.mjs:141` | WhatsApp numarası koda gömülü (2 yer). `site.json`'da `whatsapp_url` ve kullanılmayan `whatsapp_url_sablonu` alanları var. Numara değişirse header/footer güncellenir ama 78 kitap sayfasının sipariş düğmesi eski numarada kalır. | `` whatsapp_url: `https://wa.me/905059808735?text=${…}` `` | `books.js` `site.json`'ı okusun ya da `whatsappBaglantisi(site, k.title)` tek kaynak olsun. Kullanılmayan şablon alanı ya kullanılsın ya silinsin. | Direktör + B2 |
| M5 | MEDIUM | `src/assets/js/flipbook.js:38-43, 91-93` | Tıklamada `preventDefault()`, şablonun var olup olmadığına bakılmadan çağrılıyor. Tetikleyicisi olup şablonu olmayan öğe (ör. `vitrin.json`'da `one_cikan` `onizleme_vitrini` dışında seçilirse hero bağlantısı) **ölü tıklama** olur: ne modal açılır ne kitap sayfasına gidilir. Bugünkü vitrinde hero şablonu mevcut (doğrulandı). | `e.preventDefault(); ac(t);` → `if (!kitap \|\| !kitap.sayfalar.length) return;` | Önce `kitapOku` çağrılsın; yalnızca kitap bulunduysa `preventDefault` + aç. | B3 |
| M6 | MEDIUM | `flipbook.js:17` (`kur` 281 satır); `filtre.js:66` (`baslat` 74); `scripts/katalog/s5_merge.py` (`build` 119, `main` 71); `s3_kureselkitap_detail.py` (`parse` 57) | 50 satır fonksiyon kuralı aşılıyor. `kur` tüm modal durumunu tek kapanışta tutuyor; okunabilirliği ve test edilebilirliği düşük. | — | `flipbook.js` için `veri.js` (kitapOku/kaynakSec), `sahne` (page-flip kur/boyutla), `galeri` (yedek) gibi modül ya da fonksiyonlara bölün. Python tarafında `build` alan başına yardımcılara ayrılsın. | B3 / B2 / R1 |
| M7 | MEDIUM | `public/site.webmanifest:6,11-24` | HtmlBasePlugin manifest dosyasını dönüştürmez. GitHub Pages'te (`PATH_PREFIX=/islambol-yayinlari/`) `start_url: "/"` alan adı köküne gider ve 3 ikon yolu 404 verir. | `"start_url": "/"`, `"src": "/favicon-192.png"` | Manifest içinde göreli yollar kullanın (`"start_url": "./"`, `"src": "favicon-192.png"`; manifest URL'sine göre çözülür). | B4 |
| M8 | MEDIUM | `scripts/gorsel/orijinal-kucult.mjs:29-30, 37-46` | (a) Tüzük ihlali: B4 betiği R1'in dosyalarını yerinde değiştiriyor (`public/kapaklar/*`, `data/catalog/books.json`). (b) PNG→JPG dönüşümünde kaynak **yazmadan önce siliniyor**; `writeFileSync` başarısız olursa (disk dolu, kilitli dosya) orijinal kapak kaybolur. | `if (hedef !== src) unlinkSync(src);` `writeFileSync(hedef, buf);` | Önce yazın, sonra silin. Kapak küçültme ve `books.json` yol güncellemesi R1'e öneri olarak verilsin (ya da Direktör yetkiyi karta yazsın). | B4 (yetki: R1/Direktör) |
| M9 | MEDIUM | `public/logo/islambol-logo.png` (127 KB, 800×800); `header.njk:11-12` | Her sayfada ekranın üstünde görünen logo yaklaşık 152 px genişlikte gösteriliyor, ama 800×800 PNG olarak iniyor. Dosyanın yaklaşık %75'i şeffaf alan; CSS ile kırpılıyor. Koyu tema sürümü de 42 KB. Kapaksız sayfalarda LCP adayı. | `<img src="/logo/islambol-logo.png" width="800" height="800" …>` | `marka.mjs`'te içerik kutusuna (598×199) kırpılmış, 2x genişlikte (~320 px) WebP/PNG üretin; CSS kırpma hilesini kaldırın. | B4 (üretim) + B1 (header) |

### LOW

| # | Seviye | Dosya:satır | Sorun | Öneri | SAHİP |
|---|---|---|---|---|---|
| L1 | LOW | `eleventy.config.js:18-33`; `yardimci.mjs:57`; `books.js:66-68,107,113`; `kitap.njk:11` | Ölü kod: `tarih` ve `kisalt` filtreleri hiçbir şablonda kullanılmıyor (B2'nin `bicim.njk` `tarih` makrosu aynı işi yapıyor). `eslesmeyenler` dışa aktarılmış ama kullanılmıyor. `kategori_sluglari`, `site_kategori_sluglari`, `has_onsoz`, `kaynak_url` alanları okunmuyor. `kitap.njk:11`'deki `set onizleme_kitaplar` layout'a ulaşmıyor (değeri `kitap.11tydata.js` zaten veriyor). | Tek `tarih` uygulaması kalsın (filtre). Kullanılmayanlar silinsin. | B1 / B2 / Direktör |
| L2 | LOW | `package.json:12` | `"dogrula": "node scripts/qa/dogrula.mjs"` → bu dosya yok (`dogrula.py` var, `dogrula:icerik` ile çağrılıyor). `npm run dogrula` hata veriyor. | Betik silinsin ya da `dogrula:icerik` + `dogrula:seo` zinciri olsun. | Direktör/B1 (package.json) |
| L3 | LOW | `src/_includes/components/kitap/kunye-tablosu.njk:7` | `kitap.contributors.split(": ")` alanın metin olduğunu varsayıyor. `books.js` dizi ve nesne biçimini de kabul ediyor (`katkidaBulunanlar`). R1 dizi üretirse build "undefined çağrılamaz" hatasıyla düşer. Bugün 7/7 kayıt metin. | `books.js` normalleştirilmiş `katkida_bulunanlar` listesini dışa versin; şablon onu kullansın. | B2 + Direktör |
| L4 | LOW | `kitap.njk:44,63,78`; `kunye-tablosu.njk:17,23,24,27,31`; `filtre.njk:34,37`; `dizi.njk:37,45`; `footer.njk:13,21`; `index.njk:56,68,79,90`; `seo.njk:57` | Mikrometin dışında kalmış sabit metinler: "Takım", "Bu kayıt, birden fazla ciltten…", "Aynı yazardan", "Katkıda bulunanlar", "Kâğıt", "Yayın tarihi", "Kategori", "Dizi", "Ara", "Önizlemeli", "Ciltler", "Kitap sayfası", "Yayınevi", "İletişim", bölüm başlıkları. JSON-LD adresi ("Fatih/İstanbul") de `site.json` yerine koda yazılmış. | D2'nin `mikrometin.json` / `site.json` dosyalarına taşınsın (D2 yazar, B'ler okur). | B1 / B2 / B5 (metin: D2) |
| L5 | LOW | `src/sitemap.njk:11` | Her URL'nin `lastmod` değeri sitemap'in kendi `page.date`'i (derleme tarihi). Bu, arama motoruna yanlış "her şey değişti" sinyali verir. | `sayfa.date` kullanılsın ya da `lastmod` hiç yazılmasın. | B5 |
| L6 | LOW | `scripts/qa/sunucu.mjs:21-22,31` | `startsWith(DIR)` kontrolünde ayraç yok (`…\dist2\…` geçer). `decodeURIComponent` bozuk `%` dizisinde yakalanmayan hata fırlatıyor ve sunucuyu çökertiyor. Yalnızca 127.0.0.1'e bağlı QA aracı. | `startsWith(DIR + sep)`; decode `try/catch` içine alınıp 400 dönülsün. | sahipsiz (Q2'ye önerilir) |
| L7 | LOW | `src/_data/authors.js:8`, `diziler.js:22`, `vitrin.js:10,20` | `books()` derleme başına en az 4 kez çalışıyor (her seferinde JSON okuma + ajv derleme + önsöz dosyaları). `authors()` 2 kez çalışıyor. Bu yalnızca derleme süresini etkiler. | `books.js` sonucu modül düzeyinde önbelleğe alınsın (`let onbellek`). | Direktör |
| L8 | LOW | kök: `_t.png`, `.impeccable/` | `_t.png` takip edilmiyor ama ignore'da da değil; yanlışlıkla commit'e girebilir. `.impeccable/` yalnızca yerel `.git/info/exclude` ile dışarıda; temiz klonda korunmaz. | `_t.png` silinsin; `.impeccable/` `.gitignore`'a eklensin. | Direktör / O1 |
| L9 | LOW | `eleventy.config.js:11` | `public/kapaklar` (12 MB) ve `public/onsoz` (7,9 MB) orijinalleri `dist/`'e kopyalanıyor. Kullanıldıkları yerler: JSON-LD `image`, hero/kapak `src` yedeği (srcset varken inmez), önsöz `noscript` bağlantısı, flipbook `data-src` yedeği. Tüm 78 kapak ve 85 önsöz sayfasının optimize sürümü mevcut. Kullanıcıya inen yükü artırmıyor, yalnızca artifact boyutunu büyütüyor. | JSON-LD ve `src` yedeği en büyük `kapaklar-opt` JPG'ye çevrilirse orijinaller `addPassthroughCopy` dışına alınabilir. | B4 + Direktör |
| L10 | LOW | `scripts/qa/dogrula.py` (907 satır) | 800 satır dosya sınırı aşılıyor. | Kontrol grupları modüllere bölünsün. | Q4 |
| L11 | LOW | `src/index.njk:40` | `hero.yazar_gosterim` null olursa figcaption " · Başlık" olarak basılıyor. Bugünkü `one_cikan` için yazar dolu. | `{% if hero.yazar_gosterim %}… · {% endif %}` | B1 |

H2'den etkilenen kayıtlar (ham açıklama üzerinden B2 filtresinin simülasyonu, paragraf sayısı önce → sonra):
`bilinmeyen-yonleriyle-mustafa-kemal-ve-kurtulus-savasi-gercekleri-serisi` 9→6, `cumhuriyetin-ilk-yillarinda-satilan-camiler-ve-yasaklanan-dini-kitaplar` 7→5, `general-cevat-rifat-atilhan-kitapligi` 11→6, `son-sultan-vahideddinin-hatiralari-ve-beyannamesi` 1→0, `uzgunum-viyanada-dogdum` 1→0, `yeryuzunun-hakiki-canileri-israil` 6→5. İlk üçündeki kayıplar gerçekten "Kargo ücretsiz" satırları olabilir; son üçü meşru metin.

## Güvenlik bölümü

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| Nunjucks otomatik kaçış | **Açık.** Eleventy `nunjucksEnvironmentOptions` = `{ dev: true }`; Nunjucks varsayılanı `autoescape: true`. | Derlenmiş meta description: `Savaşı&#39;nın` |
| Kitapçı metinleri (`title`, `author`, `description`) `\| safe` ile basılıyor mu? | **Hayır**, gövdede hepsi kaçışlı. `\| safe` yalnızca şuralarda var: `content` (layout), `s.html` (kendi markdown'ımız; `markdown-it` `html: false`, `validateLink` `javascript:`'i engeller), `nereden-alinir.njk` parçaları (aynı kaynak) ve JSON-LD. | `grep "\| safe"` → 8 satır, hepsi tek tek incelendi |
| JSON-LD `dump` + `</` kaçışı | **Etkisiz** → H3 | Nunjucks testinde `a</script>b` değişmeden çıktı |
| `data-kaynaklar="{{ … \| dump }}"` | Güvenli. `dump` çıktısı otomatik kaçışla `&quot;` olarak basılıyor. `flipbook.js` `JSON.parse`'ı `try/catch` içinde çağırıyor. | `{"u":"a\"b<"}` → `{&quot;u&quot;:…&lt;…}` |
| `flipbook.js` DOM yazımı | Güvenli. Yalnızca `textContent`, `createElement` ve `img.src` kullanılıyor; `innerHTML` yok. Şablon seçicisi `CSS.escape(id)`. Görsel URL'leri derleme verisinden geliyor. | `ogeler.baslik.textContent = kitap.baslik;` |
| `filtre.js` URL parametreleri | Güvenli. `kategori`, `yazar`, `yil` izinli küme (allowlist) ile süzülüyor. `q` yalnızca `input.value`'ya yazılıyor. Sonuç metni `textContent` ile basılıyor. | `izinli[ad].has(p.get(ad)) ? p.get(ad) : ""` |
| Dış URL'ler `javascript:` olabilir mi? | Şema bunu engellemiyor → M1 (bugünkü veri temiz). | `sources.*` = 3 alan adı, hepsi https |
| `wa.me` bağlantısı | `encodeURIComponent` ile kodlanıyor (`books.js:116`, `yardimci.mjs:142`). | — |
| Dış bağlantılarda `rel` | Tüm dış bağlantılarda `rel="noopener noreferrer"` var. `target="_blank"` hiç kullanılmamış (tabnabbing riski yok). | `grep target=` → 0 |
| `innerHTML` / `eval` / `insertAdjacentHTML` | Yok. | — |
| Gizli bilgi (secret) | Yok. `.env` ignore'da. Telefon ve e-posta zaten yayımlanan iletişim bilgisi. | — |
| Python kazıyıcılar | `requests` `timeout=30`, istekler arası 2,5 sn bekleme, 429'da `Retry-After`. `shell=True`, `eval` ya da `verify=False` yok. | `scripts/katalog/common.py:19` |

## Sağlam bulunanlar

- **ajv doğrulaması** (`books.js:84-90`): şema hatasında build duruyor; ilk 10 hata yazdırılıyor. Tekrarlanan id kontrolü var. `vitrin.json`'daki bilinmeyen id'ler build'i düşürüyor.
- **`[[SORU]]` ayıklama** (`_oku.js:40-47`): 14 işaretin hepsi doğru kaldırılıyor. Cümle ortasındaki işaret (`hakkimizda.md:10`) önceki cümleyi bozmadan siliniyor; sonda boşluk ya da bağlaç artığı kalmıyor (`sayfalar.js` çıktısı satır satır karşılaştırıldı). Liste maddesindeki işaret (`nereden-alinir.md:18`) satırın tamamını temiz biçimde götürüyor.
- **`publish_date` yalnızca yıl olduğunda**: `yil` alanı, `bicim.njk` `tarih` makrosu ve şema deseni dördü de `YYYY`, `YYYY-MM` ve `YYYY-MM-DD` biçimlerini kaldırıyor (veride 10 ve 4 karakterlik iki biçim var).
- **Null sızıntısı**: `yazar_gosterim` null olduğunda kartta `kunye_belirtilmemis` ("—") basılıyor. Yazarsız 2 kayıt (`cumhuriyetin-ilk-…`, `raculus-sanem`) doğru davranıyor. Künye tablosunda boş alanın satırı hiç basılmıyor. Nunjucks null/undefined değeri boş dize olarak basıyor.
- **`kapaklar[id]` yokken**: `kapak.njk` önce `kitap.kapak_url` + `cover.width/height`, en son 600×900'e düşüyor. Bugün 78/78 kapakta optimize kayıt var, 85/85 önsöz sayfasında opt var. Her `<img>`'de width/height var.
- **HtmlBasePlugin ve `| url`**: `| url` yalnızca `data-prefix` için kullanılıyor (eklenti `data-*` özniteliklerine dokunmaz), bu yüzden çift önek yok. `flipbook.js` içindeki `ONEK`/`yol()` hem `/` (ONEK boş → dokunmaz) hem `/islambol-yayinlari/` için doğru, zaten önekli yolu yeniden öneklemiyor. `page-flip` yolu `import.meta.url`'e göre çözülüyor. Canonical/OG mutlak adresleri `site.url + page.url` biçiminde kuruluyor (önek bir kez).
- **`diziler.js` `ayniDizi`**: bugünkü veride 7 dizide yanlış birleştirme yok (dizi → kitap listesi döküldü). Önek kuralı (≥12 karakter + `-`) ileride benzer adlı iki ayrı seride risk taşıyabilir; şu an tetiklenmiyor.
- **Yazar eşleme**: tüm `yazar_sluglari` bir yazar sayfasına çıkıyor (yetim slug yok, 404 bağlantı yok).
- **ADR-001**: `price_list_try` hiçbir şablonda basılmıyor; JSON-LD'de `offers` yok.
- **ADR-004 / renkler**: `global.css`, `katalog.css`, `flipbook.css` ve `typography.css` içinde hex ya da rgba yok; renkler token'lardan geliyor (tek istisna `seo.njk`'deki `theme-color` meta etiketi, orada değişken kullanılamaz). DESIGN §9'daki geçici `:root` `global.css`'ten kaldırılmış.
- **ADR-008**: `@img/sharp-wasm32` kilit dosyasında; `cpu` kısıtı olmadığı için `npm ci` ile kuruluyor.
- **Performans**: `page-flip` yalnızca tıklamadan sonra dinamik import ediliyor. Hero `loading="eager"` + `fetchpriority="high"`, diğer görseller `lazy`. `<picture>` `sizes` değerleri yerleşimle uyumlu. Yalnızca 2 font preload var ve ikisinde de `crossorigin` var. Katalog sayfasında CSS toplamı yaklaşık 57 KB ham (bütçe 30 KB gz altında). `flipbook.css` yalnızca önizlemeli sayfalarda yükleniyor.
- **Satır sonları**: `.gitattributes` `* text=auto eol=lf`; `git ls-files --eol` ile CRLF içeren izlenen dosya yok. `.editorconfig` LF.
- **`console.log`**: tarayıcı JS'inde yok. `flipbook.js` yalnızca yedeğe düşerken `console.warn` kullanıyor; bu bilinçli. `sayfalar.js:26` derleme anında bilgi veriyor ve `SESSIZ` ile kapatılabiliyor. `scripts/**` CLI çıktıları meşru.
- **Bağımlılıklar**: `ajv` (veri doğrulama), `markdown-it` (statik sayfalar) ve `page-flip` (vendor kopyası) çalışma zamanında kullanılıyor. `sharp` (`scripts/gorsel`), `axe-core` (`scripts/qa/a11y/denetle.mjs`) ve `@playwright/test` (`tests/`) devDependency olarak doğru yerde. Gereksiz bağımlılık yok.
- **Dosya boyutu**: `src/` altında 800 satırı aşan dosya yok (en büyüğü `global.css`, 431 satır).

## Testler

`tests/e2e/katalog.spec.ts`, `tests/e2e/sayfalar.spec.ts` ve `tests/yardimci/dist.ts` çalışma ağacında var ama commit edilmemiş; Q2 bunları hâlâ yazıyor. Bu incelemede testleri çalıştırmadım ve kapsamayı hesaplamadım. Birim testi yok: `_oku.js` (`slugla`, `sorulariAyikla`, `onBilgiAyir`), `yardimci.mjs` (`kategoriEsle`, `kitapMeta`) ve `books.js` (`aciklamaTemizle`) saf fonksiyonlar, birim test için uygunlar. H1, H2 ve H3'ün her biri için regresyon testi önerilir (sırasıyla: CSS kural sayısı, `uzgunum-viyanada-dogdum` sayfasında metin, başlığında `</script>` geçen sahte kayıt).

## Tüzük uyumu (dosya listesi × EKIP.md §3)

| Dosya / klasör | Beklenen sahip | Durum |
|---|---|---|
| `src/_data/*.js` | Direktör | Uygun |
| `eleventy.config.js` | Direktör (B1 kartı: "kök yapılandırma", B1 geliştirir) | Uygun. İki kartta örtüşen ifade var; filtreleri B1 eklemiş. Tek sahip yazılması önerilir. |
| `data/catalog/books.schema.json` | Direktör (B2 genişletebilir) | Uygun |
| `src/_includes/layouts/base.njk` | Direktör iskeleti / B1 | Uygun |
| `src/_includes/components/` altındaki header, footer, dugme, bolum-basligi, hat-kutusu, satis-kanallari, statik-sayfa | B1 | Uygun |
| `src/_includes/components/seo.njk`, `src/sitemap.njk`, `public/robots.txt` | B5 | Uygun |
| `src/_includes/components/kitap/**` (+ `yardimci.mjs`) | B2 | Uygun. Not: B4 kartındaki `kapak-gorseli.njk` yok; işi B2'nin `kitap/kapak.njk` dosyası yapıyor. Kart güncellenmeli. |
| `src/_includes/components/onizleme/kitap-onizleme.njk` | B3 | Uygun (kartta adı geçen `flipbook.njk` ayrı dosya olarak yok, birleştirilmiş) |
| `src/` altındaki kitaplar, kitap, yazarlar, yazar, dizi, diziler `.njk` + `src/*.11tydata.js` | B2 | Uygun (`*.11tydata.js` ve `diziler.njk` kartta adıyla geçmiyor; görev tanımına uyuyor) |
| `src/` altındaki index, hakkimizda, iletisim, nereden-alinir `.njk` | B1 | Uygun |
| `src/` altındaki yayin-cizgisi, kvkk-ve-cerezler, onizleme-hakkinda, 404 `.njk` | **Kartta yok** | Sahipsiz (fiilen B1). Karta eklenmeli. |
| `src/assets/css/tokens.css`, `typography.css`, `src/assets/fonts/**` | D1 | Uygun (fonts kartta değil, DESIGN §9'da D1) |
| `src/assets/css/global.css`, `src/assets/js/site.js` | B1 | Uygun |
| `src/assets/css/katalog.css`, `src/assets/js/filtre.js` | B2 | Uygun (`katalog.css` kartta değil, DESIGN §9'da B2) |
| `src/assets/css/flipbook.css`, `src/assets/js/flipbook.js` | B3 | Uygun |
| `scripts/katalog/**` | R1 | Uygun |
| `scripts/onsoz/**` | R3 | **Kartta yok** (R3 yetkisi yalnızca `data/catalog/onsoz/**` ve `public/onsoz/**`). Karta eklenmeli. |
| `scripts/gorsel/**` | B4 | Uygun. **Ancak** `orijinal-kucult.mjs` R1 alanına (`public/kapaklar/*`, `data/catalog/books.json`) yazıyor → M8. `data/catalog/kapaklar-opt.json`, `data/catalog/onsoz-opt.json` ve `public/onsoz-opt/**` B4 tarafından üretiliyor ama B4'ün yazma hakkında yok. |
| `public/logo/**`, `public/favicon*`, `public/site.webmanifest` | B4 (çıktı listesinde "favicon seti") | Yazma hakkı satırında yok. Karta eklenmeli. |
| `scripts/seo/**` | B5 | Kartta yok (kabul ölçütündeki "betikle" ifadesine uyuyor). Karta eklenmeli. |
| `scripts/design/**` | D1 (DESIGN §9 doğrulama komutları) | Kartta yok. |
| `scripts/arastirma/ss-kucult.mjs` | R2 (tahmin) | Kartta yok (R2 yetkisi `docs/research/**`). |
| `scripts/qa/sunucu.mjs` | — | **Sahipsiz.** |
| `scripts/qa/a11y/**`, `docs/qa/a11y/**` | Q1 | **Kart dışı** (Q1 yetkisi yalnızca `docs/qa/A11Y.md`). |
| `scripts/qa/dogrula.py` | Q4 | Uygun |
| `tests/**`, `playwright.config.ts` | Q2 | `tests/**` uygun. `playwright.config.ts` kökte; kartta yok. |
| `.github/**`, `README.md`, `CONTRIBUTING.md`, `.gitignore`, `.editorconfig` | O1 | Uygun |
| `package.json` | Direktör kurdu / B1 geliştirir | Çalışma ağacında değişiklik var (O1/Q betikleri eklemiş). Sahibi netleştirilmeli. |
| `_t.png` (kök) | — | Sahipsiz geçici dosya → L8 |

Özet: Başka rolün dosyasına doğrudan yazılmış **içerik** dosyası yalnızca bir tane bulundu: B4 → R1 (M8). Geri kalan sapmalar, kartta yazılmamış ama fiilen tek sahibi olan yollar. EKIP.md §3'te kartların bu yollarla güncellenmesi önerilir. §7 puanlamasındaki "iki yazar aynı dosyaya dokunmuyor" kriteri, M8 dışında tutuyor.
