# İslambol Yayınları: yeni vitrin ve yönetim paneli

14 Ekim 2026. Amaç: açık, kapak odaklı bir yayınevi sitesi; kitap, yazar ve ana sayfa duyurularını kod yazmadan yönetmek. Kullanıcı doğrudan satış yerine katalog ve satış noktalarına yönlendirmeyi seçti.

## Site haritası

```text
Ana sayfa
├─ Yönetilebilir duyuru vitrini (görsel, metin, bağlantı, sıralama)
├─ Yeni çıkan kitaplar
├─ Önizlemeli kitaplar
├─ Yuvarlak portreli yazar şeridi
├─ Yayın kategorileri
└─ Satış noktaları
Kitaplar → Arama / kategori / yazar / yıl / önizleme → Kitap detayı
Yazarlar → Portre / biyografi / eserler
Set ve seriler → Dizi detayı
Hakkımızda / Yayın çizgisi / İletişim / Nereden alınır
Yönetim → Giriş → Kitaplar / Yazarlar / Ana sayfa duyuruları
```

## Tasarım

Beyaz ve hafif sıcak zemin, logo kırmızısı, okunaklı IBM Plex Sans ve başlıklarda EB Garamond. Ana sayfanın ilk alanı reklam görselleri yüklenene kadar yayınevinin mevcut gerçek kapaklarıyla hazırlanır. Katalog kartları kapakları kesmeden gösterir. Yazar portresi bulunmayan kayıtlarda baş harfler kullanılır; panelden fotoğraf eklenebilir. Mobilde iki kitap sütunu ve erişilebilir açılır menü. Vitrin kullanıcı kontrolüyle değişir, kendiliğinden hareket etmez.

## İçerik yönetimi

- Kitap: ekle, düzenle, taslak/yayın durumu, kaldır; kapak yükleme, ISBN, sayfa, tarih, açıklama ve satış bağlantıları.
- Yazar: ekle, düzenle, kaldır; portre yükleme, biyografi ve kitap ilişkileri.
- Duyuru: ekle, düzenle, kaldır; görsel yükleme, kitap/hedef bağlantısı, başlık, metin, sıra ve aktiflik.
- Değişiklikler tarayıcı yerine proje JSON dosyalarında kalıcı tutulur. Kaydın ardından site yeniden derlenir; hata kullanıcıya gösterilir.
- Yönetici girişi sunucuda doğrulanır. Oturum HttpOnly çerez ve CSRF koruması kullanır. Şifre ve yedekler yayımlanan dosyalara girmez.

## Uygulama sırası

1. Referansları incele, mevcut 78 kitap ve 36 yazarı koru.
2. Yeni ana sayfa, arama, kitap rafları, ortak açık tema ve yazar şeridi.
3. Kalıcı CMS API, giriş ve güvenli görsel yükleme.
4. Türkçe yönetim paneli ve kayıt akışları.
5. Derleme, SEO, mobil/masaüstü ve gerçek ekle–düzenle–kaldır kontrolü.

## Araştırma kaynakları

Alfa Kitap ana sayfası otomatik web aracına 403 döndürdü; güncel arayüzü bu yöntemle doğrulanamadı. Kullanıcının verdiği yazar şeridi doğrudan görsel referanstır. Alfa'ya erişim ayrıca denenecek.

- https://www.alfakitap.com/
- https://www.canyayinlari.com/ — yeni çıkanlar, yazarlar ve duyuru rafları.
- https://www.canyayinlari.com/kitap-tarih — kategori, yazar ve katalog sıralama yapısı.
- https://iletisim.com.tr/ — yeni çıkanlar, tekrar baskılar ve setler.
- https://iletisim.com.tr/kitap/neandros-destani/10997 — kapak, künye ve ön okuma.

Başka yayınevlerinin marka, kitap veya reklam görselleri bu siteye içerik olarak taşınmaz.

## Barındırma

Mevcut GitHub Pages yalnızca statik kataloğu sunar. Gerçek yönetim API'si Node.js çalıştıran bir sunucu ister. İlk uygulama yerel çalışma ve önizlemeyi sağlar; canlı panel için aynı Node sunucusu kalıcı disk ve HTTPS ile barındırılmalıdır. Yerel kaydetme mevcut canlı GitHub Pages sitesini kendiliğinden güncellemez.
