# Yayınevine Sorular ve Bekleyen Kararlar

Site yayına hazır; aşağıdakiler olmadan da çalışır. Cevaplar geldikçe `data/site/sayfalar/*.md` içindeki `[[SORU: …]]` işaretleri gerçek metinle değiştirilir (işaretli cümleler yayına girmez, build sırasında ayıklanır).

## A. Metinleri tamamlayacak bilgiler (D2 işaretleri, 14)

| # | Sayfa | Soru |
|---|---|---|
| 1 | Hakkımızda | Kuruluş yılı nedir; kurucu ya da yayın yönetmeni kimdir, adı geçsin mi? |
| 2 | Hakkımızda | Bugüne kadar çıkan toplam kitap sayısı; katalogdaki kitapların hepsi hâlâ satışta mı? |
| 3 | Hakkımızda | Yayın kurulu (editör, çevirmen, hakem) var mı; adları yazılsın mı? |
| 4 | İletişim | WhatsApp hattı hangi gün ve saatlerde yanıt veriyor? |
| 5 | İletişim | Açık adres; ziyaretçi kabul ediliyor mu, çalışma saatleri? |
| 6 | İletişim | Yazar/telif teklifi, basın ve kütüphane talepleri için ayrı bir e-posta var mı? |
| 7 | KVKK | Siteye analitik (çerezsiz istatistik) eklenecek mi? Şu an hiçbir çerez/analitik yok. |
| 8 | KVKK | Barındırma GitHub Pages olarak kalacak mı (kayıt tutma metni buna göre yazılır)? |
| 9 | KVKK | Veri sorumlusu unvanı/adresi; VERBİS kaydı gerekli mi? |
| 10 | Nereden alınır | Trendyol mağaza adresi (şu an listede yok). |
| 11 | Nereden alınır | WhatsApp siparişinde ödeme ve kargo yöntemleri (havale/EFT, kapıda ödeme, kargo firması)? |
| 12 | Nereden alınır | Toptan, kitabevi ve kütüphane siparişleri için ayrı bir yol var mı? |
| 13 | Önizleme hakkında | Önizlenen sayfaların kullanım koşulları için resmî bir ifade var mı? |
| 14 | Yayın çizgisi | Yazılı yayın ilkesi ya da kaynak gösterme politikası var mı? |

## B. Direktörün verdiği, yayınevinin onaylaması gereken kararlar

| # | Karar | Gerekçe | Değiştirmek için |
|---|---|---|---|
| 1 | Site fiyat göstermiyor; "Nereden alınır" bağlantıları + WhatsApp sipariş | Fiyatlar kitapçılarda sürekli değişiyor; mağaza yok (ADR-001). Kitapçı metinlerindeki kampanya satırları da ayıklanıyor. | `src/_data/books.js` içindeki `aciklamaTemizle` ve kitap şablonu |
| 2 | Ana sayfa vitrini 6 önizlemeli kitap; 3 kitap vitrin dışı | "İğneli Fıçı", "Gizli Devlet ve Fesat Programı", "Yeryüzünün Hakiki Canileri: İsrail" katalogda ve kendi sayfalarında tam olarak var, önizlemeleri çalışıyor; yalnızca ana sayfada öne çıkarılmıyor (editoryal/hukuki değerlendirme yayınevine ait). | `data/site/vitrin.json` → `vitrin_haric` ve `onizleme_vitrini` |
| 3 | Hero kitabı: "Sen Neden Kör Edildin?" (Mustafa Armağan) | En tanınmış yazar, temiz tarama, önsözlü önizleme. | `data/site/vitrin.json` → `one_cikan` |
| 4 | Tasarım yönü: "Arşiv Dosyası" (kâğıt, mürekkep, logodan türetilmiş mühür kırmızısı #A51C22; EB Garamond + IBM Plex Sans) | Yayınevinin "belge ve kaynak" iddiası ve logo kimliğiyle örtüşüyor; rakiplerin hiçbiri arşiv estetiği kullanmıyor. | `DESIGN.md`, `src/assets/css/tokens.css` |
| 5 | Karanlık mod yalnızca sistem ayarını izler, düğme yok | Daha az durum, daha az hata. | B1 header'a düğme ekleyebilir |
| 6 | Yayın adresi: `https://adursak63.github.io/islambol-yayinlari/` (alt dizin) | GitHub Pages ücretsiz; özel alan adı alınırsa kök dizine geçer. | `.github/workflows/deploy.yml` içinde `SITE_URL` ve `PATH_PREFIX`; `public/CNAME` |

## C. Veriyle ilgili doğrulanması gerekenler (R1/R3 bulguları)

| # | Konu | Ayrıntı |
|---|---|---|
| 1 | "Son Halifenin Dramı" yazarı | Kitapyurdu: Cevat Rıfat Atilhan; iç kapak: Manavoğlu Nevres Bey. Sitede Kitapyurdu verisi kullanıldı. |
| 2 | "Hilâfetin İlgasının Arka Planı" | İki farklı ISBN ile iki kayıt (…6004 ve …3449). İki baskı mı, kitapçı hatası mı? |
| 3 | "Rabbimizi Tanıyalım 1 / 2" | 1. cilt yalnızca Ravza'da; fiyat/ISBN karışıklığı var. Kapak 251 px (düşük çözünürlük). |
| 4 | "Raculüs Sanem" ve "Cumhuriyetin İlk Yıllarında Satılan Camiler…" | Yazar alanı boş (derleme/set); sitede "—" görünüyor. |
| 5 | "Halit Paşa Nasıl Öldürüldü?" sayfa sayısı | Kitapyurdu 150, diğer iki kaynak 64; 64 kullanıldı. |
| 6 | Setlerin içeriği | 7 set kaydında ciltler listelenmiyor (kaynaklar vermiyor). Liste gelirse `set_items` alanına girer. |
| 7 | GARGAT 1-2 (Ali Akbaş) | Ön sipariş; kitapçılarda henüz künye yok, katalogda yok. |
| 8 | Yazar fotoğrafı ve özgeçmişi | Hiçbir kaynakta yazar fotoğrafı yok; özgeçmiş yalnızca Mustafa Armağan'da. Yayınevi gönderirse `authors.json`'a eklenir. |
| 9 | Logo | Elimizdeki tek kaynak 400 px JPG (X profili). Vektör (SVG/AI) ya da yüksek çözünürlüklü PNG gönderilirse `public/logo/` güncellenir. |
| 10 | Önizlemesi olmayan 69 kitap | Kitapyurdu'da yalnızca 9 kitabın iç sayfa önizlemesi var. Yayınevi PDF/JPG gönderirse diğerlerine de sayfa çevirme eklenir (README'de adımlar). |

## D. Teknik (kullanıcı kararı/adımı)

- Kod lisansı: MIT mi, kapalı mı, "kod MIT + içerik tüm hakları saklıdır" mı? Seçim gelince `LICENSE` eklenir (README "Telif ve lisans").
- Depo herkese açık (`--public`) mı olacak? Açık olursa `data/catalog/books.json` içindeki liste fiyatları (`price_list_try`, kitapçılardan alınmış kamuya açık veri) ve kaynak bağlantıları da görünür; istenirse fiyat alanı depoya girmeden önce silinebilir (site zaten göstermiyor).

- GitHub'a yayın için: `gh auth login --web --git-protocol https` sonra README'deki "GitHub'a yayınlama" bölümü.
- Google Search Console doğrulaması için meta etiket ya da DNS kaydı (docs/SEO.md).
