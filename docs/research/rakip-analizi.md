# İslambol Yayınları — Rakip ve Referans Analizi

Tarih: 2026-10-11. Kaynak: firecrawl ekran görüntüleri, doğrudan HTML/CSS okuması (curl), kitap sayfası taraması, GitHub/npm API.
Etiketler: **okundu** = CSS/HTML'den okundu; **tahmin** = görsel/çıkarım; **görüldü** = ekran görüntüsünü ben inceledim; **doğrulanmadı** = bakmadım; **alınamadı** = site erişilemedi.

Dürüstlük notları:
- Mobil kalite (1-5) HİÇ puanlanmadı. 5 sitenin mobil ekran görüntüsü alındı (ketebe, otuken, kronik, fitzcarraldo, dergah; `-mobile.png`) ama incelenmedi.
- Tasarım puanını yalnızca Ketebe, Kronik, Dergâh, Fitzcarraldo, Verso için ekran görüntüsüne bakarak verdim ("görüldü"); diğerleri "tahmin".
- Timaş, Erkam, Semerkand, Ötüken için firecrawl markdown + HTML kullandım. Erkam ve Gallimard'ın ham HTML'i curl'e kapalı (yalnızca ekran görüntüsü).
- İz Yayıncılık alınamadı (aşağıda). Verilen Dergâh adresi (dergahyayinlari.com) çözülmedi; gerçek site dergah.com.tr.
- Playwright tam sayfa ekran görüntüsü zaman aşımı verdi; tüm görüntüler firecrawl'dan (1440x900 viewport, fullPage).

## a. Yönetici özeti

1. TR rakipler (Ketebe, Erkam, Semerkand, Ötüken, Timaş) hazır e-ticaret şablonu üstüne kuruldu (T-Soft, Ticimax, IdeaSoft, Bootstrap): indirim rozetleri, kampanya şeritleri, mega menü. Karakter yok.
2. Tek TR istisna Kronik Kitap: Cormorant Garamond başlık, kapak renginden türeyen kart zeminleri, yazar portre şeridi. Görsel kimlik tutarlı.
3. Dergâh (dergah.com.tr) içerik omurgası (Yeni Çıkanlar / Tekrar Baskılar / Yazarlar / Blog / Video) olarak İslambol'a en yakın, ama uygulaması dağınık.
4. Kitap önizlemesi TR'de neredeyse yok: Yapı Kredi "tadımlık" PDF, Dergâh Google Docs Viewer iframe'i. Ketebe sayfaya turn.js yüklemiş ama tanıdığım 17 kitap sayfasında #flipbook öğesi yok.
5. Gerçek sayfa çevirme (flip) hiçbir incelediğim sitede doğrulanamadı. Dünya örnekleri düz metin modal (Fitzcarraldo "Read preview") veya PDF (Suhrkamp "Leseprobe") kullanıyor. Sayfa çevirme bu yüzden fark yaratan bir özellik olur; arşiv belgesi/ilk sayfa temasına da çok uygun.
6. Dünya çıtası: Fitzcarraldo (tek renk, tam genişlik ürün fotoğrafı, minimum menü), Verso (manşet tipografisi, üyelik), Sternberg/Loose Joints (yazar-seri-arşiv, "out of print" rafı).
7. Yazar sayfası, seri/kitaplık sayfası, bülten TR'de standart; blog/haber ve etkinlik çoğunda zayıf veya yok.
8. İslambol'un fırsatı: "üzeri örtülen hakikatler", arşiv belgesi, hatırat, Osmanlı-Cumhuriyet dönemi. Rakiplerin hiçbiri belge/arşiv estetiğini kullanmıyor.
9. Tek başına sayfa çevirme için önerilen kütüphane: StPageFlip (page-flip, MIT, bağımlılıksız, mobil, ~44 KB).
10. Performans: Timaş ana sayfası 1.3 MB HTML; Ketebe 346 KB; hafif site (≤150 KB JS) başlı başına avantaj olur.

## b. Özellik matrisi

Makine okunur hali: `docs/research/rakip-ozet.json`.

| Site | Kendi satış | Önizleme / içine bak | Yazar sayfası | Seri | Arama | Filtre | Bülten | Blog/haber | Etkinlik | Mobil (1-5) | Tasarım (1-5) | Tipografi | Palet |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ketebe | evet (T-Soft; sepet, üye, bayi girişi, %35 indirim etiketi) | turn.js yüklü ve #flipbook.turn() çağrısı var; test edilen 17 kitap sayfasında #flipbook öğesi YOK -> aktif önizleme kanıtlanamadı | evet (/necip-fazil-kisakurek, /hayden-white) | evet (Kemal Tahir Kitaplığı, Gazzâli Kitaplığı, Diziler menüsü) | evet (üstte arama + "Popüler Aramalar") | kategori menüsü; ayrıntılı filtre doğrulanmadı | evet (E-Bülten) | hayır (Medya Merkezi linki var, içeriğine bakılmadı) | doğrulanmadı | ölçülmedi | 3 (görüldü) | Open Sans (okundu, 70 kullanım); Montserrat+Roboto Google Fonts bağlı | #e35252 kırmızı (okundu), #000000, #6c6c6c |
| Timaş | evet (sepet ikonu; çerez politikası satinal.timas.com.tr alt alanında) | doğrulanmadı | evet ("Yazarlarımız" bölümü) | evet (çok sayıda kitaplık/dizi menüsü, yaş grupları) | evet (Ara ikonu) | yaş/kategori menü ağacı | doğrulanmadı | hayır | "Yazar İmzalı Kitaplar" kampanya sayfası; etkinlik takvimi yok | ölçülmedi | 3 (tahmin (ekran görüntüsü incelenmedi)) | American Typewriter (serif, 22 kullanım), SF Pro Display, Inter (okundu) | #ec6608 turuncu (--primary okundu), #e57868, #7e212a |
| Erkam | evet (Ticimax altyapısı, 122 "sepete ekle") | hayır (markdown ve menüde yok) | evet (/yazarlar, yazar kitaplıkları) | evet (30+ "Kitaplığı": Mahmud Sami Ramazanoğlu, Tasavvuf, İslam Tarihi...) | evet (sesli arama ikonu görüldü) | kategori menüsü | görülmedi | hayır; dergi sayfaları (Altınoluk, Bizim Bahçe) | görülmedi | ölçülmedi | 2 (tahmin) | okunamadı (ham HTML 5 KB, bot koruması) | okunamadı |
| Semerkand Kitap | evet (IdeaSoft; çok yayınevli kitapçı) | hayır (e-kitap kategorisi var, kitap sayfasında önizleme yok) | yalnızca liste sayfası (/sayfa/yazarlar) | yayınevi/marka sayfaları (50+ marka) | evet | kategori + marka | evet | evet (Blog) | görülmedi | ölçülmedi | 2 (tahmin) | sistem sans (Bootstrap varsayılanı, okundu); Font Awesome | #00aebc turkuaz (okundu), #313131, #4b4b4b |
| Ötüken | evet (kendi sepet, %20 indirimli fiyat, mobil uygulama iOS/Android) | hayır (kitap sayfasında anahtar sözcük yok) | evet (/yazarlar, /yazar/ziya-gokalp-1343) | evet ("modül" sayfaları: İttihat ve Terakki, Miras Kitaplığı, Kırım Kitaplığı, Hayatıhakikiye Tefrikaları, Cumhuriyetin 100. Yılı) | doğrulanmadı | /categories | evet ("Kaydol") | hayır | metinde "yazar etkinlikleri" geçiyor, sayfa yok | ölçülmedi | 3 (tahmin) | Open Sans + Bootstrap (okundu) | #e52c17 kırmızı (okundu), #212529, #ffffff |
| Kronik Kitap | doğrulanamadı (menüde sepet görülmedi) | doğrulanmadı | evet (/yazarlar, siyah-beyaz portre karuseli) | kategori ve "kitaplık" (Tarık Zafer Tunaya, Doğan Cüceloğlu) | evet (menüde) | kategori sayfaları | evet ("Haberdar Ol" + popup) | hayır | görülmedi | ölçülmedi | 4 (görüldü) | Cormorant Garamond (başlık) + Montserrat (okundu) | #005e85 mavi (okundu), #000000, #ffffff |
| Yapı Kredi Yayınları | hayır (satış noktaları sayfasına yönlendirme, kitap.ykykultur.com.tr) | evet, PDF "tadımlık" sekmesi (#tab-tadimlik; ilk sayfalar PDF olarak yeni sekmede) | doğrulanmadı | evet (Meridyen, Delta, Cogito, Doğan Kardeş, Kitap-lık dizi/dergi sayfaları) | doğrulanmadı | doğrulanmadı | doğrulanmadı | evet (Kitap-lık dergisi) | sergi kitapları/katalog | ölçülmedi | 3 (tahmin) | Open Sans + Quicksand (okundu) | #743790 mor (okundu), #33183f, #eaeaea |
| İletişim Yayınları | evet (kargo/iade koşulları, ETBİS, üyelik) | doğrulanmadı | evet (/yazarlar) | doğrulanmadı | doğrulanmadı | doğrulanmadı | doğrulanmadı | RSS: yeni-cikanlar, tekrar-baskilar | doğrulanmadı | ölçülmedi | 3 (tahmin) | Noto Sans (okundu) | #461a57 mor (theme-color okundu), #007bff Bootstrap, #212529 |
| Dergâh | doğrulanamadı (kitap sayfasında fiyat/sepet bakılmadı) | evet: kitap sayfasında Google Docs Viewer ile PDF gömülü (iframe, 600px) | evet (/yazarlar/mustafa-kutlu ...) | evet (Diziler menüsü) | evet (ikon) | /kitaplar listesi | evet | evet (Blog), videolar, Instagram/Facebook embed | fuar duyuruları blogda | ölçülmedi | 3 (görüldü) | Montserrat (@font-face okundu); geniş harf aralıklı büyük harf bölüm başlıkları | #1a1a18 (okundu), #747474, #e9e9e9 |
| İz Yayıncılık | alınamadı | alınamadı | alınamadı | alınamadı | alınamadı | alınamadı | alınamadı | alınamadı | alınamadı | ölçülmedi | - (alınamadı) | alınamadı | alınamadı |
| Fitzcarraldo Editions | evet (basket; perakendeci listesi de var: Kobo, Libro.fm) | evet: "Read preview" -> modal içinde HTML metin alıntısı + sesli örnek (mp3 butonu); sayfa çevirme yok | evet (/authors/) | evet (Essentials, Modern Gothic, Nobel Essentials; Fiction/Essays/Poetry/Classics) | evet (ikon) | tür bazlı (Fiction, Essays, Poetry...) | evet (koyu footer bandı) | evet (News & Events, Prizes) | evet | ölçülmedi | 5 (görüldü) | Serif başlık+gövde (CSS dosyasından okunamadı; görsel tahmin: Garamond/Caslon benzeri), cömert boşluk | #1f3fa0 mavi (tahmin, kapak rengi), #ffffff, #14192b lacivert footer (tahmin) |
| Verso Books | evet (Shopify, Book Club üyeliği) | doğrulanamadı (kitap sayfası istekle engellendi) | evet (/blogs/authors/...) | koleksiyon (Palestinian Voices, Featured) | evet (ikon) | doğrulanmadı | evet | evet (Blog) | doğrulanmadı | ölçülmedi | 4 (görüldü) | Tiempos Headline/Text (serif) + Aktiv Grotesk (okundu, Typekit) | #eb0000 kırmızı, #271b1b, #b6afaf (hepsi okundu) |
| New York Review Books | evet (Shopify) | doğrulanmadı | doğrulanmadı | evet (Classics, Comics, Kids, Elsewhere Editions koleksiyonları) | doğrulanmadı | koleksiyon | doğrulanmadı | evet (nyrb-news, events) | evet (/blogs/events) | ölçülmedi | 3 (tahmin) | Lato + Fira Sans (okundu, tema) | #d3232e, #333333, #89bf87 |
| Penguin Books UK | hayır (perakendeci ve affiliate linkleri: Waterstones vb.) | API alanı "seeInsidePdf" var ama incelenen kitapta null; gözlemlenemedi | evet (/authors) | evet (/series) | evet | evet | evet | evet | evet | ölçülmedi | 4 (tahmin) | Penguin Inclusive Sans (okundu) | #fa6400 turuncu, #0b0c0c, #e6e5df (okundu) |
| Gallimard | doğrulanamadı | doğrulanamadı (curl engellendi) | meta: "agenda des auteurs" | doğrulanamadı | meta: "recherche de citations" | doğrulanamadı | doğrulanamadı | meta: actualités, vidéos | meta: agenda des auteurs | ölçülmedi | 4 (tahmin (ekran görüntüsü incelenmedi)) | okunamadı | okunamadı |
| Suhrkamp | evet (Onlineshop) | evet: "Leseprobe" düğmesi -> Cloudinary'de PDF (*_leseprobe.pdf) | evet (/autoren) | evet (Insel, Bibliothek Suhrkamp) | evet | evet | doğrulanmadı | evet (Gespräche, Interviews) | doğrulanmadı | ölçülmedi | 3 (tahmin) | Roboto + Arimo (okundu) | #295fcc mavi, #121212, #dadada |
| Sternberg Press (siteinspire) | evet (WooCommerce) | evet: /preview/ sayfası (yaklaşan kitaplar önizleme listesi; sayfa içi okuma örneği değil) | evet (/all-authors/) | evet (/all-series/) | doğrulanmadı | doğrulanmadı | evet (/newsletter/) | doğrulanmadı | doğrulanmadı | ölçülmedi | 4 (tahmin) | Proto (sans) + Sainte Colombe (serif) (okundu @font-face) | #de1623 kırmızı, #6e1531 şarap, #dddddd (okundu) |
| Loose Joints (siteinspire) | evet (Shopify) | doğrulanmadı | doğrulanmadı | koleksiyonlar (current, forthcoming, signed, special-rare, out-of-print) | doğrulanmadı | koleksiyon | doğrulanmadı | doğrulanmadı | doğrulanmadı | ölçülmedi | 4 (tahmin) | Diatype (okundu) | #fbe122 sarı, #253525, #161d25 (okundu) |
| Place Press (siteinspire) | evet (Shop) | doğrulanmadı | doğrulanmadı | doğrulanmadı | doğrulanmadı | doğrulanmadı | doğrulanmadı | doğrulanmadı | doğrulanmadı | ölçülmedi | - (yalnızca ekran görüntüsü alındı, incelenmedi) | incelenmedi | incelenmedi |
| Blackbook Publications (siteinspire) | doğrulanmadı (Shopify göstergesi var) | doğrulanmadı | doğrulanmadı | doğrulanmadı | doğrulanmadı | doğrulanmadı | doğrulanmadı | doğrulanmadı | doğrulanmadı | ölçülmedi | - (yalnızca ekran görüntüsü alındı, incelenmedi) | incelenmedi | incelenmedi |

Not: Ketebe (T-Soft), Erkam (Ticimax), Semerkand (IdeaSoft) "hazır e-ticaret" yazılımları; Ötüken, İletişim, Yapı Kredi, Dergâh Bootstrap/jQuery/WordPress karışımı; Kronik WordPress; Fitzcarraldo WordPress; Verso, NYRB, Loose Joints Shopify; Sternberg WooCommerce; Suhrkamp Next.js + Cloudinary; Gallimard Drupal 10 (kütüphane tespitleri HTML içinde anahtar kelime aramasıdır, kaba).

## c. Site kartları

İz Yayıncılık: https://izyayincilik.com HTTP 200 döndü ama gövde 0 bayt; .com.tr alan adı DNS çözülemedi; ekran görüntüsü boş beyaz (`docs/research/screenshots/iz.jpg`). **Alınamadı**.

Mobil ekran görüntüleri (incelenmedi): `docs/research/screenshots/ketebe-mobile.jpg`, `otuken-mobile.png`, `kronik-mobile.png`, `fitzcarraldo-mobile.png`, `dergah-mobile.png`.

Yazar ve kitap detay sayfaları incelenenler: Ketebe (/pratik-gecmis-hayden-white, /hayden-white), Ötüken (/kitap/toprak-ana-104, /yazar/ziya-gokalp-1343), Semerkand (/urun/bostanul-arifin), Dergâh (/kitaplar/bahtimin-yildizi), YKY (Dokun Hisset kitabı), Fitzcarraldo (/books/cafes/), Sternberg (/product/a-rage-in-harlem/, /preview/), Suhrkamp (Kosmische Verbindungen), Penguin (Elif Şafak kitabı). Diğerlerinde kitap/yazar detayına bakılmadı (doğrulanmadı).

### Ketebe
- URL: https://www.ketebe.com/
- Güçlü: Kampanya şeritli slider (aylık "Ketebe Ekim"), kitaplık banner blokları (renkli çerçeveli koleksiyon afişleri), vitrin/çok satan/yeni sekmeleri
- Zayıf: Şablon e-ticaret hissi, indirim rozetleri ve kırmızı şeritler kaos yaratıyor, tipografik karakter yok, tarih/hatırat ayrımı yok
- Ekran görüntüsü: docs/research/screenshots/ketebe.jpg, docs/research/screenshots/ketebe-mobile.jpg

### Timaş
- URL: https://timas.com.tr/
- Güçlü: 20+ yayınevini tek çatıda toplayan mega menü, yaş filtresi, SSS ve dosya değerlendirme başvuru formu
- Zayıf: 1.3 MB HTML, çok ağır; çocuk ağırlıklı, tarih okuruna uygun değil
- Ekran görüntüsü: docs/research/screenshots/timas.jpg

### Erkam
- URL: https://www.erkamyayinlari.com/
- Güçlü: Marka/imprint yapısı (Pırıltı, Ser Kitap, Akademi), yazar adına kitaplık modeli
- Zayıf: Yoğun mega menü, e-ticaret şablonu, görsel kimlik zayıf
- Ekran görüntüsü: docs/research/screenshots/erkam.jpg

### Semerkand Kitap
- URL: https://www.semerkandkitap.com/
- Güçlü: Dergi aboneliği, set kitaplar, hediyelik, 50+ yayınevi kataloğu (Ketebe, Dergah, Timaş burada da satılıyor)
- Zayıf: Pazaryeri görüntüsü, marka kimliği yok
- Ekran görüntüsü: docs/research/screenshots/semerkand.jpg

### Ötüken
- URL: https://otuken.com.tr/
- Güçlü: Tematik "modül" koleksiyonları (tarih serileri: en yakın rakip yaklaşım), alt imprint kartları, Cumhuriyetin 100. Yılı vitrini
- Zayıf: Bootstrap varsayılanı, belge/arşiv duygusu yok, indirim etiketli kart kalabalığı
- Ekran görüntüsü: docs/research/screenshots/otuken.jpg, docs/research/screenshots/otuken-mobile.jpg

### Kronik Kitap
- URL: https://www.kronikkitap.com/
- Güçlü: Kapak rengini kart zeminine taşıyan renkli kart ızgarası, serif başlık, yazar portre şeridi; TR içindeki en tutarlı kimlik
- Zayıf: Kart altlarında bilgi kısıtlı, popup bülten rahatsız edici
- Ekran görüntüsü: docs/research/screenshots/kronik.jpg, docs/research/screenshots/kronik-mobile.jpg

### Yapı Kredi Yayınları
- URL: https://www.yapikrediyayinlari.com.tr/
- Güçlü: Dizi isimleri (Cogito, Delta) markaya dönüşmüş; tadımlık PDF
- Zayıf: Eski ASP altyapısı, 14px gri metin
- Ekran görüntüsü: docs/research/screenshots/yky.jpg

### İletişim Yayınları
- URL: https://iletisim.com.tr/
- Güçlü: Güçlü marka sesi (başlıkta "Okumak İptiladır Müptelalara Selam!"), /katalog sayfası
- Zayıf: Bootstrap varsayılanı
- Ekran görüntüsü: docs/research/screenshots/iletisim.jpg

### Dergâh
- URL: https://www.dergah.com.tr/ (verilen dergahyayinlari.com adresi çözülemedi)
- Güçlü: En yakın tür: "yeni çıkanlar / tekrar baskılar / yazarlar / blog" omurgası, ortalanmış logolu menü
- Zayıf: Boş video bölümü, gri slider, sosyal embedler yarım yüklü, PDF önizleme çirkin
- Ekran görüntüsü: docs/research/screenshots/dergah.jpg, docs/research/screenshots/dergah-mobile.jpg

### İz Yayıncılık
- URL: https://izyayincilik.com
- Güçlü: -
- Zayıf: .com.tr DNS çözülemedi; izyayincilik.com HTTP 200 ama gövde 0 bayt, ekran görüntüsü tamamen beyaz -> alınamadı
- Ekran görüntüsü: iz.png (boş beyaz)

### Fitzcarraldo Editions
- URL: https://fitzcarraldoeditions.com/
- Güçlü: Kapak ürün fotoğrafı tam genişlik hero, tek renk kimlik (kitap mavisi), koleksiyon fotoğrafları, minimum menü (Shop/Authors/Prizes)
- Zayıf: Vitrinde fiyat yok, keşif zayıf
- Ekran görüntüsü: docs/research/screenshots/fitzcarraldo.jpg, docs/research/screenshots/fitzcarraldo-mobile.jpg

### Verso Books
- URL: https://www.versobooks.com/
- Güçlü: Siyasi duruşu görsele döküyor: ince kırmızı çizgili bölüm başlıkları, manşet gibi duyuru kutuları, üyelik (Book Club)
- Zayıf: Sıkışık, çok bölüm
- Ekran görüntüsü: docs/research/screenshots/verso.jpg

### New York Review Books
- URL: https://www.nyrb.com/
- Güçlü: Seri kimliği güçlü (Classics koleksiyonları), haber
- Zayıf: Genel Shopify teması
- Ekran görüntüsü: docs/research/screenshots/nyrb.jpg

### Penguin Books UK
- URL: https://www.penguin.co.uk/
- Güçlü: Marka rengi tutarlı kullanım, ölçeklenebilir kitap/yazar/dizi şablonu
- Zayıf: Kurumsal ölçek, kişisel ton yok
- Ekran görüntüsü: docs/research/screenshots/penguin.jpg

### Gallimard
- URL: https://www.gallimard.fr/
- Güçlü: Drupal 10; ekran görüntüsü alındı, HTML botlara kapalı
- Zayıf: Analiz kısıtlı
- Ekran görüntüsü: docs/research/screenshots/gallimard.jpg

### Suhrkamp
- URL: https://www.suhrkamp.de/
- Güçlü: Her kitapta indirilebilir PDF okuma örneği, Next.js+Cloudinary
- Zayıf: Sade sans, tipografi karakteri zayıf
- Ekran görüntüsü: docs/research/screenshots/suhrkamp.jpg

### Sternberg Press (siteinspire)
- URL: https://www.sternberg-press.com/
- Güçlü: Yazar / seri / ürün üç ayrı arşiv sayfası
- Zayıf: -
- Ekran görüntüsü: docs/research/screenshots/sternberg.jpg

### Loose Joints (siteinspire)
- URL: https://loosejoints.biz/
- Güçlü: Out-of-print / signed / special-rare koleksiyonları (tükenmiş kitap rafı fikri)
- Zayıf: -
- Ekran görüntüsü: docs/research/screenshots/loose-joints.jpg

### Place Press (siteinspire)
- URL: https://placepress.com/
- Güçlü: -
- Zayıf: -
- Ekran görüntüsü: docs/research/screenshots/place-press.jpg

### Blackbook Publications (siteinspire)
- URL: https://blackbookpublications.com/
- Güçlü: -
- Zayıf: -
- Ekran görüntüsü: docs/research/screenshots/blackbook.jpg

## d. "Olmazsa olmaz" 10 madde (sektör standardı)

Kanıt: incelenen sitelerin çoğunda gözlendi.

1. Ana sayfa vitrini: yeni çıkanlar + çok satanlar/tekrar baskılar (Ötüken, Dergâh, Ketebe, Kronik).
2. Kitap kartı: kapak (yaklaşık 2:3), başlık, yazar adı; bazılarında fiyat.
3. Kitap detay: künye (sayfa sayısı, boyut, ISBN, çevirmen), kısa tanıtım, kategori/dizi bağlantısı (Ketebe "Sayfa Sayısı / Boyut" satırları).
4. Yazar sayfası ve yazarlar listesi (Dergâh, Ötüken, Kronik, Ketebe, Erkam).
5. Dizi/kitaplık sayfaları (Erkam 30+ kitaplık, Ötüken modüller, Ketebe kitaplıklar, YKY Meridyen/Delta/Cogito).
6. Kategori menüsü + arama.
7. Bülten kaydı (Kronik, Dergâh, Ötüken, Ketebe, Semerkand).
8. İletişim/kurumsal/hakkımızda + KVKK, çerez, iade-teslimat sayfaları (satış yapan sitelerde zorunlu).
9. Sosyal medya bağlantıları (hepsi).
10. Satış noktaları veya satın alma yolu: ya kendi sepet (Ketebe, Ötüken, Erkam) ya da kitapçı yönlendirmesi (YKY, Penguin). İslambol için kendi satışı yoksa kitapçı yönlendirmesi (Kitapyurdu, D&R, İdefix, Amazon) şart.

## e. "Fark yaratan" 10 madde

1. Tek renk marka kimliği, kitap kapağıyla aynı renk (Fitzcarraldo mavisi).
2. Tam genişlik kapak/ürün fotoğrafı hero (Fitzcarraldo); TR'de hiç yok.
3. Okuma örneği: Fitzcarraldo "Read preview" modal metni + ses örneği; Suhrkamp PDF Leseprobe; YKY tadımlık PDF; Dergâh gömülü PDF. Sayfa çevirmeli olan görmedim.
4. Kapak rengini kart zeminine taşımak (Kronik).
5. Manşet gibi editoryal tipografi ve ince çizgili bölüm başlıkları (Verso).
6. Üyelik/destek kulübü (Verso Book Club).
7. Tükenmiş/imzalı/özel baskı rafı (Loose Joints out-of-print, signed, special-rare) — arşiv kitapları için ideal.
8. Ayrı yazar / seri / ürün arşivleri (Sternberg: all-authors, all-series, all-products, preview).
9. Yazar portreleri siyah-beyaz bant (Kronik, Verso, Fitzcarraldo okuma videoları).
10. Haber, ödül, etkinlik akışı (Fitzcarraldo News & Events, Prizes; NYRB events; Penguin).

## f. İslambol için 3 tasarım yönü

Yayınevi karakteri: yakın tarih, Osmanlı-Cumhuriyet, arşiv belgesi, hatırat, "üzeri örtülen hakikatler", ciddi/akademik ama halka açık. Hex ve font çiftleri öneridir (tahmin; piksel testi yapılmadı). Fontlar Google Fonts'ta bulunan açık lisanslı; Türkçe karakter (ğ ı İ ş) desteklerini uygulama aşamasında doğrula.

### Yön 1 — "Arşiv Dosyası"
- Duygu: sessiz güven, dosya kabuğunu açmak, belgeyi eline almak.
- Palet: kâğıt #F1EBDD, mürekkep #1B1A17, mühür kırmızısı #8C1C13, kemik gri #6B6355, ince çizgi #CFC6B2.
- Tipografi: EB Garamond (başlık/gövde) + IBM Plex Mono (künye, tarih, "kayıt no" gibi arşiv etiketleri).
- Referans: Fitzcarraldo Editions (tek renk, cömert boşluk, ürün fotoğrafı hero) + Sternberg Press (ayrı yazar/seri/arşiv sayfaları).
- Neden uyar: İslambol'un iddiası "belge" ve "kaynak"; kitap kapakları arşiv fotoğrafı/belge görünümlü olarak hero'da büyük durur. Sayfa çevirmeli "ilk sayfalar" bu dilin doğal uzantısı. Rakiplerde yok (hiçbiri arşiv estetiği kullanmıyor).

### Yön 2 — "Hatırat Defteri"
- Duygu: sıcak, kişisel, anı ve tanıklık; halka açık ton.
- Palet: sepya krem #EADFC8, koyu kahve #3A2A1E, pas turuncusu #A94F1D, soluk yeşil #5D6B4F, beyaz #FBF8F1.
- Tipografi: Spectral (başlık+gövde) + Work Sans (arayüz, düğmeler).
- Referans: Kronik Kitap (kapak rengini kart zeminine taşıma, yazar portre bandı) + NYRB (seri kimliği).
- Neden uyar: hatırat ve biyografi ağırlıklı kitaplar için yazarın yüzü ve sesi öne çıkar; her kitap kapak renginden türetilen sıcak zeminde durur; kitap kartlarında bilgi yoğunluğu Kronik'ten daha yüksek tutulur.

### Yön 3 — "Mecmua"
- Duygu: dönemin gazete/mecmua dili, manşet, çok sütun, tarihi bir tartışma.
- Palet: gece lacivert #14213D, kemik #F4F1E8, kızıl #B3202A, pirinç #B8903D, gri #7A7A74.
- Tipografi: Source Serif 4 (manşet/gövde, ağır kontrast) + Archivo Narrow (kısa etiketler, menü, tarih damgası).
- Referans: Verso Books (manşet kutuları, kırmızı çizgili bölüm başlıkları, Book Club) + Penguin (ölçeklenebilir dizi/yazar şablonu).
- Neden uyar: "üzeri örtülen hakikatler" iddiası manşet diliyle iyi gider; Cumhuriyet dönemi gazete düzenine referans verir; blog/dosya/haber bölümleri doğal olarak "sayı" ve "dosya" formatında kurulur. Risk: kızıl tonu aktivist/siyasi okunabilir; dengeyi pirinç ve lacivertle kur.

Kaçınılacaklar (rakiplerin ortak zayıfı): indirim rozetleri, kırmızı kampanya bantları, Bootstrap varsayılanları, 1+ MB sayfa ağırlığı.

## g. "Sayfa çevirme / ilk sayfalar": kim nasıl yapmış

Gözlenenler:

| Site | Ne yapıyor | Teknik (okundu/tahmin) |
|---|---|---|
| Ketebe | turn.js yükleniyor (`/Data/EditorFiles/frontend/js/turn.js`), `$("#flipbook").turn({width:670,height:500,autoCenter:true,acceleration:true,next:true})` çağrısı sayfada var. 17 kitap sayfasında `#flipbook` öğesi yok; çalışan bir önizleme göremedim. | okundu (HTML); jQuery + turn.js; T-Soft şablonu |
| Yapı Kredi | "Tadımlık" sekmesi, PDF bağlantısı yeni sekmede ("PDF formatlı tadımlık için tıklayınız") | okundu |
| Dergâh | Google Docs Viewer iframe'i ile PDF gömülü (`docs.google.com/viewer?...&embedded=true`, 600px) | okundu |
| Fitzcarraldo | "Read preview" -> `#preview` modal dialog içinde HTML metin + ses örneği (mp3) | okundu; sayfa çevirme yok |
| Suhrkamp | "Leseprobe" düğmesi -> Cloudinary PDF | okundu |
| Penguin | Veri alanında `seeInsidePdf` (incelenen kitapta null) | okundu (JSON), görsel gözlem yok |
| Sternberg | `/preview/` yaklaşan kitaplar sayfası | okundu |
| Verso, NYRB, Gallimard | doğrulanamadı | - |

Sonuç: incelediğim hiçbir sitede çalışan sayfa çevirme animasyonu gözlemlemedim. İslambol'da bu gerçek bir ayrışma olur.

Kütüphane karşılaştırması (GitHub API / npm API, 2026-10-11 okundu):

| Kütüphane | Lisans | Boyut | Mobil dokunma | Bakım (son commit) | Vanilla JS |
|---|---|---|---|---|---|
| StPageFlip (`page-flip` 2.0.7) | MIT | browser bundle 44 KB (unpkg, sıkıştırılmamış) | evet (README: mobil uyumlu, dikey/yatay) | son commit 2021-04-18 (repo push 2024-01-08); 885 yıldız; 48 açık issue; npm ~578 bin indirme/ay | evet, bağımlılık yok |
| turn.js (blasten/turn.js) | GitHub "NOASSERTION" (lisans dosyası bulunamadı); v4 ticari olarak biliniyor, doğrulanmadı | ~25 KB min (tahmin) + jQuery | dokunma desteği sınırlı (tahmin) | son commit 2013-05-04; 7489 yıldız | hayır, jQuery gerekli |
| DearFlip (dearhive/dearflip-js-flipbook) | NOASSERTION; ücretsiz sürüm + ticari pro olduğu doğrulanmadı | büyük (3D, PDF.js bağımlı) | var (tahmin) | son commit 2026-07-03 (aktif) | jQuery/Three.js bağımlılığı olabilir |
| flipbook-js (taufiqelrahman) | lisans yok | küçük | belirsiz | 2025-12-04; 23 yıldız | evet |
| PDFlipbook (SympleNZ) | MIT | belirsiz | belirsiz | 2026-06-14; 8 yıldız (çok yeni/az kullanılan) | evet |
| Heyzine / Issuu / FlipHTML5 | SaaS (ücretli, bakılmadı) | iframe | var | servis | iframe; veri üçüncü tarafta |

### Öneri: StPageFlip (`page-flip`, MIT)

Gerekçe: MIT lisans, bağımlılık yok (vanilla JS), 44 KB, dokunma ve dikey/yatay mod desteği, hem görsel (canvas) hem HTML sayfa modu, ayda ~578 bin npm indirmesi. Risk: 2021'den beri commit yok. Önlem: sürümü sabitle ve depoya kopyala (vendor), sayfaları WebP görsel olarak önceden üret (PDF.js gerekmez), JS kapalı/çok eski cihazda düz görsel galeriye düş, `prefers-reduced-motion` ve klavye oklarını kendin ekle (erişilebilirlik kütüphanede garantili değil, doğrulanmadı).
