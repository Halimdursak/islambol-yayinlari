# Seçenek 4 — Editoryal Books

## Konsept (3 cümle)
Apple Books'un "Bugün" sekmesi ile Apple Newsroom'un buluşması: beyaz zemin, New York dergisi hissi veren Fraunces serif manşetler ve SF benzeri Inter gövde. Önizlemeli kitaplar, kapağın baskın renginden türetilmiş düz tonlu zeminli büyük "feature" kartlarında (ikili + tam genişlik ritmiyle) sunulur; yeni çıkanlar Apple Books rafı gibi yatay kayar. Tek vurgu rengi koyu kırmızı yalnızca düğmelerde; bölümler beyaz → açık gri → beyaz ritmiyle akar, krom azdır, kapaklar konuşur.

## Palet (hex)
- Beyaz zemin `#ffffff`, açık gri bölüm `#f5f5f7`
- Mürekkep `#1d1d1f`, ikincil metin `#6e6e73`, çizgi `#d2d2d7`
- Vurgu (yalnızca düğmeler) `#a51c22`, hover `#8c161b`
- Feature kart zeminleri kapaktan türetilir (`uret.mjs` → `baskinTon`, sharp ile 48×48 örnekleme, hue histogramı): `hsl(h 36% 91%)`; sepya/siyah-beyaz kapakta kağıt tonu `hsl(32 18% 91%)`. Bu üretimde: Sen Neden Kör Edildin? `hsl(51 36% 91%)`, Son Halifenin Dramı `hsl(32 18% 91%)` (nötr), İnas `hsl(323 36% 91%)`, Filistin-Suriye Cephesinde… `hsl(125 36% 91%)`, Menemen Hadisesinin İçyüzü `hsl(1 36% 91%)`, Allah'a Hüsnüzan Beslemek `hsl(167 36% 91%)`.

## Tipografi
- Manşet/serif: Google Fonts **Fraunces** 500–600 (latin-ext, optik boyut otomatik), izleme −0.01em (hero −0.012em, büyük feature −0.015em). Hero `clamp(40px, 4.8vw, 68px)`, bölüm başlıkları `clamp(32px, 4.2vw, 52px)`, büyük feature kart `clamp(40px, 4.6vw, 68px)` / ikili kartta `clamp(28px, 2.7vw, 38px)`, raf kart başlığı 19px (mobilde 17px), yazar adı 24px (mobilde 21px).
- Gövde/sans: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Helvetica Neue", Arial` (web yedeği Google Fonts **Inter** 400/500/600). Gövde 17px, alt başlık 19–21px, etiketler 12px büyük harf `.1em`.

## Hareket
- Kapsül düğmeler ve kartlar 320 ms `cubic-bezier(.2,.7,.2,1)`; kapaklar hover'da 6px yükselir (600 ms).
- Scroll-reveal: IntersectionObserver ile `.rv → .in` (560 ms, 14px yukarı kayma). Yatay raf okları `scrollBy` ile 20px köşe kartları snap'ler. Kitap sayfasında sayfa çevirme 160 ms çapraz solma.
- `prefers-reduced-motion: reduce` → tüm geçişler kapalı, reveal anında görünür, smooth scroll kapalı.

## Neden premium (3 madde)
1. **Renk kapaktan gelir, şablondan değil:** her feature kartın zemini o kitabın kapağındaki baskın tondan hesaplanır; kapağın beyazımsı fotoğraf zemini `mix-blend-mode: multiply` ile yok olur, kapak doğrudan tonlu yüzeyin üstünde "ürün fotoğrafı" gibi durur.
2. **Editoryal ölçek ve ritim:** 68px serif manşet, Newsroom tarzı küçük etiket + büyük başlık chapter'ları, ikili/tam genişlik feature ritmi, raf ve sanatçı-satırı yazar listesi — tek tip kart ızgarası yok, az krom, geniş boşluk.
3. **Gerçek veri, gerçek sayılar, tek vurgu:** 78 kitap / 36 yazar / 9 önizlemeli / 7 set katalogdan sayılır, 8 yeni çıkan tarihle sıralanır, 8 yazar kitap sayısına göre seçilir; fiyat yok, sahte yorum yok; kırmızı yalnızca eylem düğmelerinde olduğu için her düğme ağırlık taşır.

## Dosyalar
- `uret.mjs` — JSON'dan `index.html` ve `kitap.html` üretir (`node docs/design/secenekler/secenek-4/uret.mjs`).
- `ekran.mjs` — Playwright (msedge) ile 4 ekran görüntüsü + 390/768/1440'ta yatay kaydırma kontrolü.

## Eleştiri sonrası (puan 6/10 → düzeltmeler)
Uygulanan (yüksek + orta bulguların tamamı):
1. **Nav iskeleti:** `<nav>` flex:1 + ortalama; menü artık logo ile WhatsApp kapsülü arasında ortalı, kapsül içerik sağ kenarına (x=1298) oturuyor; `.menu` içindeki işe yaramayan `margin:0 auto` kaldırıldı. Logo 28 → 40 px yükseklik (108 → ~124 px genişlik), "yayınları" alt satırı okunur; footer logosu 44 px. ≤980px'te boş `<nav>` gizlendi, burger sağda. Aynı düzeltme kitap.html'de de geçerli (ortak üretim).
2. **Hero hiyerarşisi:** sütunlar .92fr/1.08fr, manşet `clamp(40px,4.8vw,68px)` (yetim "okuyun" satırı yok, izleme −0.012em), kapak 400×575 px, plate 585×~695 px; plate içindeki tekrar eden başlık/yazar altyazısı kaldırıldı. Kapak artık ilk ekranın en büyük nesnesi.
3. **Kapak sunumu:** feature kartlarda kapağın altına zemin gölgesi (`.cv::before`, multiply'ın altında boyanır; kapağın sert kesilen alt kenarını gömer). Raf kartlarında `translateY+overflow` kırpması kalktı: kapak `object-fit:contain`, tray ortalı; kartlar flex sütun, yazar satırı her kartta aynı taban çizgisinde, başlık 3 satıra kadar (mobilde 4) tam görünür.
4. **Feature kart sistemi:** hero'daki kitap vitrin listesinde ikinci kez gelmiyor (`one_cikan` filtrelendi) → 5 kart = ikili + büyük + ikili; eyebrow "5 kitap daha". Bu bilinçli bir karardır: "6 kart" şartı gevşedi. Büyük kart iki sütunu ortada toplanıyor (ölü boşluk kapandı), başlık 40–68 px; ikili kartta başlık 28–38 px ve kapak 224–260 px; yazar tonu `#515154` (≈6.8:1). Düz apostroflar serif başlıklarda kıvrık ’ oldu (Allah’a, Osmanlı’nın, Cumhuriyet’in); `tipo()` yalnızca görünen metne uygulanır, href/src'ye değil.
5. **Mobil (390):** feature kartlar yatay snap rafı (82% genişlik, bir sonraki kart görünür); yazarlar satırında yelpaze 64 px, ad 21 px; sayfa ~9000 → ~6100 px. `.rv` gizleme yalnız `<html class="js">` iken ve yazdırmada kapalı: JS yoksa her bölüm görünür.
6. **kitap.html:** cilt kıvrımı (`.book::after` gradyanı ortada görünür), açık kitap 1100 px'e genişledi, sayfa görselleri 607 px özgün jpg, üst tarama kenarı kırpıldı; sayfaya tıklayınca `<dialog>` lightbox (Esc/dışarı tıkla kapatır, düğmeler klavye erişimli); tanıtımın ilk paragrafı artık serif giriş (`h2+p` seçicisi).

Atlanan / bilinçli sapma:
- Eleştirideki "kapak %112 büyütüp kenar kırp" denenmedi (eleştiri de önermiyor); okunurluk için genişlik + lightbox seçildi.
- Eleştirinin önerdiği logo 35 px yerine 40 px kullanıldı (alt satırın okunması için); nav yüksekliği 56 px'te kaldı.
- İkili kartta eleştirinin `.cv img min(100%,260px)` önerisi sütun genişliğiyle sınırlıydı; bu yüzden ikili kart sütunları 1.05fr/.95fr ve iç boşluk 36 px'e çekildi.
