# Görsel ve Performans Raporu (B4)

Üretici: `npm run gorsel` (`scripts/gorsel/optimize.mjs`; yardımcılar `kapak.mjs`, `marka.mjs`, `ortak.mjs`).
Idempotent: çıktı kaynaktan yeniyse "atlandı"; `npm run gorsel -- --force` hepsini yeniden üretir. İlk tam çalışma WASM sharp ile yaklaşık 4 dk, ikinci çalışma yaklaşık 5 sn.

## 1. Önce / sonra

| Küme | Önce | Sonra | Dosya | Not |
|---|---|---|---|---|
| Kapaklar (78) | 96,51 MB (78 dosya) | 16,59 MB | 458 | 3 webp + 3 jpg / kapak (küçük kaynaklarda daha az) |
| Önsöz sayfaları (85, 9 kitap) | 7,63 MB | 3,28 MB | 85 | yalnızca webp, 800 px yükseklik |
| Logo + favicon + manifest | 0,01 MB (1 jpg) | 0,17 MB | 7 | |
| OG görselleri (1200x630) | - | 4,76 MB | 79 | `site` + 78 kitap |

Kapakların orijinal toplamına göre küçülme: tarayıcıya giden en büyük webp (960) ortalama 56 KB, @640 ortalama 34 KB, @320 ortalama 14 KB.
Bir kapak için ortalama @640: webp 34 KB, jpg 39 KB (orijinal ortalama 1,24 MB).

Kalite ayarları (`scripts/gorsel/kapak.mjs` üstündeki sabitler): kapak webp 66, kapak jpg 58 (progressive, mozjpeg), önsöz webp 72, lqip data URI en çok 571 karakter.

### Bütçe durumu

| Hedef | Gerçekleşen | Durum |
|---|---|---|
| `kapaklar-opt` ≤ 12 MB | 16,59 MB | AŞILDI (kalite 78/78 -> 66/58'e düşürüldü, 23,9 MB -> 16,6 MB) |
| `onsoz-opt` ≤ 6 MB | 3,28 MB | tamam |

Kapaklar için "3 webp + 3 jpg" kabul koşulu korundu. Bütçeye girmenin tek makul yolu 960 px jpg'yi atmak (yaklaşık -5 MB, toplam ~11,5 MB); eski tarayıcı yedeği 640 px'e iner. Bunun için `scripts/gorsel/kapak.mjs` içinde jpg boyut listesi ayrılabilir; Direktör kararı bekleniyor.

## 2. En büyük 10 dosya

Kaynak (public/kapaklar) -> en büyük optimize webp (960 px, 1200x~1850 kaynaktan):

| Dosya | Önce | Sonra (webp 960) |
|---|---|---|
| gozyasi-denizi.png | 4,71 MB | 103 KB |
| mustafa-sabri-efendi.png | 4,38 MB | 158 KB |
| yakin-tarihimizi-sorgulamak.png | 3,85 MB | 78 KB |
| 1918-mutarekesinden-beri-olan-vakalar.png | 3,77 MB | 70 KB |
| turk-oglu-dusmanini-tani-masonlugun-ic-yuzu.png | 3,76 MB | 72 KB |
| filistin-suriye-cephesinde-kahramanlar-ve-hainler.png | 3,59 MB | 77 KB |
| mizac-dersleri.png | 3,36 MB | 50 KB |
| butun-acikligiyla-inonu-savaslari-ve-hakiki-kahramanlari.png | 3,36 MB | 71 KB |
| medeniyetin-batisi.png | 3,20 MB | 59 KB |
| igneli-fici.png | 3,20 MB | 41 KB |

Optimize çıktılar içinde en büyük 10 dosya (hepsi 960 px; tek kapakta webp+jpg):

| Dosya | Boyut |
|---|---|
| mustafa-sabri-efendi-960.jpg | 163 KB |
| mustafa-sabri-efendi-960.webp | 158 KB |
| gargat-1-2-960.webp | 148 KB |
| enver-ve-mustafa-kemalin-kitabi-1908-1938-960.webp | 135 KB |
| gargat-1-2-960.jpg | 133 KB |
| son-sultan-vahideddinin-hatiralari-ve-beyannamesi-960.jpg | 132 KB |
| gozyasi-denizi-960.jpg | 127 KB |
| enver-ve-mustafa-kemalin-kitabi-1908-1938-960.jpg | 124 KB |
| son-sultan-vahideddinin-hatiralari-ve-beyannamesi-960.webp | 123 KB |
| bilinmeyen-yonleriyle-mustafa-kemal-ve-kurtulus-savasi-gercekleri-serisi-960.jpg | 114 KB |

## 3. Manifestler

| Dosya | İçerik |
|---|---|
| `data/catalog/kapaklar-opt.json` | 78 anahtar; `orijinal, genislik, yukseklik, oran, lqip, kaynaklar.{webp,jpg}[{w,url}]` (`src/_data/kapaklar.js` sözleşmesi) |
| `data/catalog/onsoz-opt.json` | 9 slug, 85 indeks; `{ webp:[{w,url}], jpg:[{w,url}] }`. `w` gerçek piksel genişliğidir. `jpg` yedeği ek dosya üretmez, orijinal `/onsoz/<slug>/NN.jpg` dosyasını gösterir |
| `data/catalog/og.json` | `{ "site": "/og/site.png", "<id>": "/og/<id>.png" }` (79 anahtar) |

## 4. B2 için `<picture>` önerisi

Kapak ızgarasında kart genişliği mobilde ekranın ~45 %'i, masaüstünde ~240 px:

```html
<picture>
  <source type="image/webp"
          srcset="/kapaklar-opt/ID-320.webp 320w, /kapaklar-opt/ID-640.webp 640w, /kapaklar-opt/ID-960.webp 960w"
          sizes="(max-width: 640px) 45vw, 240px">
  <img src="/kapaklar-opt/ID-640.jpg"
       srcset="/kapaklar-opt/ID-320.jpg 320w, /kapaklar-opt/ID-640.jpg 640w, /kapaklar-opt/ID-960.jpg 960w"
       sizes="(max-width: 640px) 45vw, 240px"
       width="1200" height="1853" alt="..." loading="lazy" decoding="async"
       style="background-image:url(LQIP);background-size:cover">
</picture>
```

Kurallar:
- `width`/`height` her zaman manifestteki `genislik`/`yukseklik` (CLS = 0; ya da `aspect-ratio: oran`).
- Ana sayfadaki ilk görünür kapak (LCP adayı): `loading="eager" fetchpriority="high"`, diğerleri `loading="lazy"`.
- `lqip` data URI'si `background-image` olarak verilir (CSS `background-size: cover`); ek istek yoktur.
- Kitap detay sayfasında büyük kapak: `sizes="(max-width: 768px) 80vw, 420px"`.
- Küçük kaynaklı kapaklarda (aşağıya bakın) `kaynaklar.webp` daha kısadır; srcset döngüsü uzunluktan bağımsız yazılmalıdır.
- Önsöz sayfalarında 800 px yüksekliğe karşılık gelen webp kullanılır; `jpg` girişi orijinal dosyadır (`<img src>` yedeği).

## 5. Öneriler

1. `dist/` içine `public/` altındaki 96 MB orijinal kapaklar da kopyalanıyor (passthrough). Şablonlar yalnızca `kapaklar-opt` kullanıyorsa orijinal klasörünü yayına almamak (`dist/kapaklar` hariç tutmak ya da orijinalleri repo dışında arşivlemek) dağıtımı ~96 MB küçültür. Karar Direktörde.
2. Favicon için `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, `<link rel="icon" href="/favicon-32.png" sizes="32x32">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, `<link rel="manifest" href="/site.webmanifest">`, `<meta name="theme-color" content="#ffffff">`.
3. OG: `<meta property="og:image" content="{{ site.url }}/og/<id>.png">` ve `og:image:width=1200`, `og:image:height=630`. Kitap yoksa `/og/site.png`.
4. Kapak görseline `font-display`-benzeri bir şey gerekmez; ama kapak yüklenene kadar kartın beyaz zemini görünür; kapakların beyazımsı fotoğraf zemini `mix-blend-mode: multiply` ile eritilir (DESIGN.md §5).
5. Lighthouse (mobil) ölçümü bu rapora eklenmedi: şablonlar (B1/B2/B3/B5) henüz birleşmedi. Şablonlar bitince yerel `npx lighthouse` ile LCP/CLS ölçülmeli (hedef LCP < 2,5 sn, CLS < 0,1).

## 6. Bilinen sınırlar

- **WASM hızı:** bu makinede sharp native `.node` yerine WASM yedeğiyle çalışıyor; tam üretim ~4 dk. CI'da sharp wasm olmayabilir, bu yüzden `public/kapaklar-opt`, `public/onsoz-opt`, `public/og` repoya girecek şekilde tasarlandı (`.gitignore`'a dokunulmadı).
- **Büyütülmeyen kaynaklar:** hedef genişlik kaynaktan büyükse üretilmez; kaynağın kendi genişliği son boyut olur.
  - `cumhuriyetin-ilk-yillarinda-satilan-camiler-ve-yasaklanan-dini-kitaplar` (500x625): 320 + 500 (640/960 yok)
  - `hayat-ve-hatiratim` (500x625): 320 + 500
  - `kemalist-mezalim` (500x625): 320 + 500
  - `rabbimizi-taniyalim-1` (251x400): yalnızca 251 (320 bile büyütme olurdu)
  - Bu dört kayıtta `kaynaklar.webp/jpg` uzunluğu 2 (sonuncusu 1) olur; diğer 74 kapakta 3.
  - Bu kaynaklarla 640/960 CSS genişliğinde (2x ekran) görsel yumuşak görünür; daha iyi kaynak dosyası gerekir.
- **Önsöz sayfaları** 541-654 x 1000 px; hiçbirinin yüksekliği 1200'e ulaşmadığı için `-1200` varyantı yok. Retina için 1000 px yerli sürüm istenirse `ONSOZ_YERLI_EKLE = true` yapılıp `--force` çalıştırılır (+~4 MB).
- **Logo:** `public/logo/islambol-logo*.png` yayınevinin gönderdiği PNG'den (`islambol-logo-kaynak.png`, 300 px) türetilmiş 480×480 dosyalardır; `marka.mjs` yalnızca eski 400 px JPEG'den (`islambol-x-profil.jpg`) üretebildiği için logoyu bilerek yenilemedikçe dokunmaz (`--force`). Eski not: kaynak JPEG 800 px'e Lanczos ile büyütülüp şeffaflaştırılmıştı. JPEG gürültüsü nedeniyle çok soluk benekler eşikle atıldı, "yayınları" ince harfleri hafif yumuşak. Gerçek vektör/PNG logo gelirse betik girdisi `public/logo/islambol-x-profil.jpg` değiştirilip yeniden çalıştırılır. Logo kare tuvalde ve geniş şeffaf kenar boşluklu (800x800); başlıkta kullanılacaksa CSS ile kırpılmalı (`object-fit: cover` + `object-position`) ya da kırpılmış sürüm istenmeli.
- **Favicon:** sharp (resvg WASM) sistem fontu bulamadığı için "İ" harfi hem PNG'lerde hem `favicon.svg`'de yazı tipi yerine yol (path) olarak çizilir: kırmızı (#d11a2a) yuvarlak kare, beyaz sans "İ". Görünüm yazı tipine bağlı değildir.
- **OG görselleri:** metin yok (yalnızca kapak, logo ve alt kırmızı şerit); palette PNG (256 renk) ile ortalama ~60 KB. Büyük kapak gölgesi hafif bantlaşabilir.
