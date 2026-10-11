# İslambol Yayınları — Tasarım Sistemi: "Arşiv Dosyası"

> Sahip: D1 Marka & Tasarım Sistemi · Tarih: 2026-10-11 · Durum: v1 (B1–B5 için bağlayıcı)
> Token kaynağı: `src/assets/css/tokens.css` · Tipografi: `src/assets/css/typography.css` · Fontlar: `src/assets/fonts/`
> Görsel referans: `docs/design/style-tile.html` → `docs/design/style-tile.png` (1440) ve `style-tile-mobile.png` (390)
> Kontrast ölçümü: `node scripts/design/kontrast.mjs --md` · Karo ekran görüntüsü: `node scripts/design/tile-screenshot.mjs`

---

## 0. Karakter

Site bir yayınevi vitrini değil, açılmış bir arşiv dosyasıdır: sıcak kâğıt zemin, ağır antrasit mürekkep ve tek bir mühür kırmızısı. Kapak her ekranın kahramanıdır; tipografi bir belgenin künyesi gibi sakin, kesin ve hiyerarşiktir (serif metin, Plex Sans büyük harf arşiv etiketleri). İndirim, kampanya, gradient ve süs yoktur. Güven, boşluk, ince çizgi ve doğru bilgiyle kurulur.

Kimlik bağı: logo (`public/logo/islambol-x-profil.jpg`) antrasit wordmark + kırmızı fes + kırmızı "yayınları"dır. Sitedeki mürekkep logonun antrasitinden, mühür kırmızısı logonun kırmızısından türetilmiştir; logo sitede "yabancı" durmaz.

---

## 1. Palet

Logo örneklemesi (sharp ile piksel sayımı): baskın kırmızı kümesi `rgb(200,32,40)` ≈ **#C82028**, antrasit #202020 / #303030.

### Mühür kırmızısı kararı: `#A51C22`

- Ton (hue) logodaki kırmızıyla aynı ailede tutuldu (OKLCH h≈25), açıklık düşürüldü: #C02020/#C82028 ekranda "kampanya kırmızısı" gibi parlar; #A51C22 mühür mumu/ıslak mürekkep gibi derin durur ve "arşiv" yönüne oturur.
- #8C1C13 (rakip analizi önerisi) tek başına kahverengiye kayıyor ve logodan kopuyor; o yüzden **üzerinde (hover) / basılı** tonu olarak kullanıldı. İkisi birlikte logo kırmızısının "gölgeli" iki hâli gibi çalışır.
- Ölçüm: kâğıtta 6.57:1 (AA, küçük metin dâhil), kabarık kâğıtta 7.04:1 (AAA), üzerindeki açık metin 7.04:1 (AAA). #C02020 kâğıtta yalnızca ~5.2:1 verirdi.
- Logo dosyasının kendi kırmızısına dokunulmaz; token olarak tanımlanmaz.

İkincil sessiz renk (yeşil/pirinç) **eklenmedi**: kapakların kendisi zaten çok renkli (lacivert, altın, kahve, mavi); ikinci bir arayüz rengi kapakla yarışır ve "tek vurgu" kuralını zayıflatır. Kategori etiketleri renk yerine çerçeve + dolu/boş durumla ayrışır.

### Açık tema (varsayılan, "kâğıt")

| Token | Ad | Hex | OKLCH | Rol | Kullanılır | Kullanılmaz |
|---|---|---|---|---|---|---|
| `--c-paper` | Kâğıt | #F4EFE4 | oklch(95.3% 0.016 86) | Sayfa zemini | `body`, header | Saf beyaz yerine her yerde; asla #FFF |
| `--c-paper-raised` | Kabarık kâğıt | #FAF7F0 | oklch(97.7% 0.010 87) | Kalkık yüzey | Künye tablosu, sipariş kutusu, modal, input | Büyük alan zemini |
| `--c-paper-sunk` | Çökük kâğıt | #EAE3D4 | oklch(91.7% 0.021 86) | Gömük yüzey | Kapak yuvası, filtre çubuğu, footer, flip sahnesi | Metin zemini olarak uzun okuma |
| `--c-ink` | Mürekkep | #1E1C1A | oklch(22.8% 0.005 68) | Ana metin | Başlık, gövde, ikincil düğme çerçevesi, kapat düğmesi | — |
| `--c-ink-soft` | Yumuşak mürekkep | #3A3632 | oklch(33.6% 0.009 68) | İkincil metin | Yazar adı (kart), giriş paragrafı, alıntı | Ana başlık |
| `--c-bone` | Kemik gri | #6A6257 | oklch(50.0% 0.020 76) | Künye/metadata | `.etiket`, künye başlıkları, sayfa/tarih satırı, yer tutucu | 13px altı metin; `--c-paper-sunk` üstünde uzun metin (4.70:1, sınırda) |
| `--c-rule` | Çizgi | #CFC6B4 | oklch(82.9% 0.027 85) | 1px ayırıcı | Bölüm içi çizgiler, tablo satırları, kart üst çizgisi | Metin, form sınırı (kontrastı yetmez) |
| `--c-rule-strong` | Güçlü çizgi | #8C8272 | oklch(61.1% 0.026 80) | Bileşen sınırı | Çip, input, ayraç "/" | Metin |
| `--c-seal` | Mühür kırmızısı | #A51C22 | oklch(46.8% 0.171 25) | Tek vurgu | Satır içi bağlantı, odak halkası | Büyük yüzey, arka plan, başlık metni, dekor |
| `--c-seal-fill` | Mühür (dolgu) | #A51C22 | oklch(46.8% 0.171 25) | Birincil düğme zemini | Ekran başına 1 birincil düğme | İkinci bir düğme, rozet, bant |
| `--c-seal-hover` | Koyu mühür | #8C1C13 | oklch(41.9% 0.149 29) | Bağlantı üzerinde | `a:hover` | — |
| `--c-seal-fill-hover` | Koyu mühür (dolgu) | #8C1C13 | oklch(41.9% 0.149 29) | Düğme üzerinde/basılı | `.dugme--birincil:hover/:active` | — |
| `--c-on-seal` | Mühür üstü | #FAF7F0 | oklch(97.7% 0.010 87) | Kırmızı üstündeki metin | Birincil düğme metni/ikon | — |
| `--c-selection` | Seçim | #E9D3CC | oklch(88.3% 0.026 38) | `::selection` | Metin seçimi | — |
| `--c-focus` | Odak | = `--c-seal` | | Odak halkası | `:focus-visible` | — |
| `--c-scrim` | Örtü | rgb(30 28 26 / .78) | | Modal arkası | Flipbook, mobil menü | — |
| `--c-flip-mat` | Masa | = `--c-paper-sunk` | | Sayfa çevirme sahnesi | Flipbook iç zemini | — |

Doku: `--texture-paper` (SVG `feTurbulence`, rect opaklığı **0.03**, 160px döşeme, ~0.5 KB data URI). Yalnız `body` zemininde; kart ve modal üstünde kullanılmaz. Karanlık temada `none`.

### Karanlık tema ("gece arşivi") — §6'ya bakınız

| Token | Hex | OKLCH |
|---|---|---|
| `--c-paper` | #171513 | oklch(19.7% 0.005 68) |
| `--c-paper-raised` | #201D1A | oklch(23.3% 0.007 67) |
| `--c-paper-sunk` | #110F0E | oklch(17.0% 0.004 48) |
| `--c-ink` | #ECE5D6 | oklch(92.3% 0.021 86) |
| `--c-ink-soft` | #CFC7B7 | oklch(83.2% 0.024 85) |
| `--c-bone` | #A39886 | oklch(68.4% 0.029 80) |
| `--c-rule` | #3A352F | oklch(33.2% 0.012 72) |
| `--c-rule-strong` | #7A705F | oklch(54.9% 0.028 81) |
| `--c-seal` | #E0675C | oklch(65.9% 0.153 27) |
| `--c-seal-fill` | #B3262B | oklch(50.3% 0.177 25) |
| `--c-seal-hover` | #EE8B81 | oklch(74.0% 0.122 27) |
| `--c-seal-fill-hover` | #8F1D22 | oklch(42.7% 0.149 24) |
| `--c-selection` | #5A2A25 | oklch(34.9% 0.072 27) |

### Kontrast tablosu (betikle ölçüldü: `node scripts/design/kontrast.mjs --md`, 2026-10-11)

Eşik: metin 4.5:1 (AA), bileşen sınırı/odak halkası 3:1 (WCAG 1.4.11). Büyük başlıklar mürekkep (≥13:1) kullandığı için 3:1 eşiğini fazlasıyla geçer.

**Açık (kâğıt)**

| Ön plan | Zemin | Kullanım | Oran | Eşik | Seviye |
|---|---|---|---:|---:|---|
| `--c-ink` #1E1C1A | `--c-paper` #F4EFE4 | Gövde metni / sayfa | 14.81:1 | 4.5 | AAA |
| `--c-ink` #1E1C1A | `--c-paper-raised` #FAF7F0 | Gövde metni / kart, modal | 15.88:1 | 4.5 | AAA |
| `--c-ink` #1E1C1A | `--c-paper-sunk` #EAE3D4 | Metin / footer, filtre çubuğu | 13.30:1 | 4.5 | AAA |
| `--c-ink-soft` #3A3632 | `--c-paper` #F4EFE4 | İkincil metin / sayfa | 10.44:1 | 4.5 | AAA |
| `--c-ink-soft` #3A3632 | `--c-paper-sunk` #EAE3D4 | İkincil metin / footer | 9.37:1 | 4.5 | AAA |
| `--c-bone` #6A6257 | `--c-paper` #F4EFE4 | Künye, metadata / sayfa | 5.24:1 | 4.5 | AA |
| `--c-bone` #6A6257 | `--c-paper-raised` #FAF7F0 | Künye / künye tablosu | 5.61:1 | 4.5 | AA |
| `--c-bone` #6A6257 | `--c-paper-sunk` #EAE3D4 | Künye / footer | 4.70:1 | 4.5 | AA |
| `--c-seal` #A51C22 | `--c-paper` #F4EFE4 | Bağlantı, etiket vurgusu / sayfa | 6.57:1 | 4.5 | AA |
| `--c-seal` #A51C22 | `--c-paper-raised` #FAF7F0 | Bağlantı / kart | 7.04:1 | 4.5 | AAA |
| `--c-seal` #A51C22 | `--c-paper-sunk` #EAE3D4 | Bağlantı / footer | 5.89:1 | 4.5 | AA |
| `--c-seal-hover` #8C1C13 | `--c-paper` #F4EFE4 | Bağlantı üzerinde / sayfa | 8.00:1 | 4.5 | AAA |
| `--c-on-seal` #FAF7F0 | `--c-seal-fill` #A51C22 | Birincil düğme metni | 7.04:1 | 4.5 | AAA |
| `--c-on-seal` #FAF7F0 | `--c-seal-fill-hover` #8C1C13 | Birincil düğme üzerinde | 8.57:1 | 4.5 | AAA |
| `--c-paper` #F4EFE4 | `--c-ink` #1E1C1A | Ters düğme / mürekkep zemin | 14.81:1 | 4.5 | AAA |
| `--c-rule-strong` #8C8272 | `--c-paper` #F4EFE4 | Bileşen sınırı (form, çip) | 3.30:1 | 3 | AA büyük/bileşen |
| `--c-seal` #A51C22 | `--c-paper` #F4EFE4 | Odak halkası (bileşen) | 6.57:1 | 3 | AA |
| `--c-ink` #1E1C1A | `--c-selection` #E9D3CC | Seçili metin | 11.85:1 | 4.5 | AAA |

**Karanlık (gece arşivi)**

| Ön plan | Zemin | Kullanım | Oran | Eşik | Seviye |
|---|---|---|---:|---:|---|
| `--c-ink` #ECE5D6 | `--c-paper` #171513 | Gövde metni / sayfa | 14.52:1 | 4.5 | AAA |
| `--c-ink` #ECE5D6 | `--c-paper-raised` #201D1A | Gövde metni / kart, modal | 13.37:1 | 4.5 | AAA |
| `--c-ink` #ECE5D6 | `--c-paper-sunk` #110F0E | Metin / footer, filtre çubuğu | 15.24:1 | 4.5 | AAA |
| `--c-ink-soft` #CFC7B7 | `--c-paper` #171513 | İkincil metin / sayfa | 10.85:1 | 4.5 | AAA |
| `--c-ink-soft` #CFC7B7 | `--c-paper-sunk` #110F0E | İkincil metin / footer | 11.38:1 | 4.5 | AAA |
| `--c-bone` #A39886 | `--c-paper` #171513 | Künye, metadata / sayfa | 6.41:1 | 4.5 | AA |
| `--c-bone` #A39886 | `--c-paper-raised` #201D1A | Künye / künye tablosu | 5.90:1 | 4.5 | AA |
| `--c-bone` #A39886 | `--c-paper-sunk` #110F0E | Künye / footer | 6.73:1 | 4.5 | AA |
| `--c-seal` #E0675C | `--c-paper` #171513 | Bağlantı, etiket vurgusu / sayfa | 5.43:1 | 4.5 | AA |
| `--c-seal` #E0675C | `--c-paper-raised` #201D1A | Bağlantı / kart | 5.00:1 | 4.5 | AA |
| `--c-seal` #E0675C | `--c-paper-sunk` #110F0E | Bağlantı / footer | 5.70:1 | 4.5 | AA |
| `--c-seal-hover` #EE8B81 | `--c-paper` #171513 | Bağlantı üzerinde / sayfa | 7.50:1 | 4.5 | AAA |
| `--c-on-seal` #FAF7F0 | `--c-seal-fill` #B3262B | Birincil düğme metni | 6.08:1 | 4.5 | AA |
| `--c-on-seal` #FAF7F0 | `--c-seal-fill-hover` #8F1D22 | Birincil düğme üzerinde | 8.29:1 | 4.5 | AAA |
| `--c-paper` #171513 | `--c-ink` #ECE5D6 | Ters düğme / mürekkep zemin | 14.52:1 | 4.5 | AAA |
| `--c-rule-strong` #7A705F | `--c-paper` #171513 | Bileşen sınırı (form, çip) | 3.74:1 | 3 | AA büyük/bileşen |
| `--c-seal` #E0675C | `--c-paper` #171513 | Odak halkası (bileşen) | 5.43:1 | 3 | AA |
| `--c-ink` #ECE5D6 | `--c-selection` #5A2A25 | Seçili metin | 9.34:1 | 4.5 | AAA |

--c- token sayısı (:root): 17 · ölçülen çift: 36 · başarısız: 0

---

## 2. Tipografi

Tam **2 aile**. Üçüncü aile (mono dâhil) yoktur; ISBN, sayfa, tarih ve sayaçlar Plex Sans + `font-variant-numeric: tabular-nums` (`.rakam`).

| Aile | Rol | Ağırlık | Dosya |
|---|---|---|---|
| **EB Garamond** (OFL) | Başlıklar, kitap adları, uzun metin, alıntı, footer sloganı | 400 (gövde, hero), 500 (h1–h3); italik 400 eser adları için | Değişken font 400–700, normal + italik |
| **IBM Plex Sans** (OFL) | Menü, düğme, etiket, künye, form, yazar adı (büyük harf), sayaç | 400 (metin), 500 (etiket/düğme), 600 (vurgu, `h4`) | Değişken font 400–600 |

### Ölçek (7 kademe, `clamp()`, 360 → 1440px)

| Token | Aralık | Kullanım | Aile / ağırlık | Satır yüksekliği | Harf aralığı |
|---|---|---|---|---|---|
| `--text-xs` | 12 → 13px | `.etiket` (KAYIT NO, KÜNYE), künye başlıkları, kart künyesi | Plex 500, BÜYÜK HARF | 1.45 | +0.12em |
| `--text-sm` | 14 → 15px | Menü, düğme, form, künye değerleri | Plex 400–500 | 1.45 | 0 / +0.01em |
| `--text-base` | 17 → 19px | Gövde metni | Garamond 400 | 1.62 | 0 |
| `--text-lg` | 20 → 24px | Kart başlığı, giriş paragrafı, `h3` | Garamond 400–500 | 1.22 | 0 |
| `--text-xl` | 26 → 36px | Bölüm başlığı (`h2`) | Garamond 500 | 1.22 | −0.012em |
| `--text-2xl` | 34 → 56px | Sayfa başlığı (`h1`) | Garamond 500 | 1.08 | −0.012em |
| `--text-3xl` | 44 → 88px | Hero kitap adı (`.metin-hero`) | Garamond 400 | 1.08 | −0.012em |

Kurallar:
- Gövde satırı en fazla `--max-w-prose` (38rem ≈ 68 karakter). Başlıklarda `text-wrap: balance`, paragrafta `pretty`.
- `html[lang="tr"] { hyphens: auto }`; başlık ve etiketlerde heceleme kapalı.
- Büyük harf dönüşümü **yalnızca** `lang="tr"` altında (i → İ doğru çıkar; karoda "YENİ ÇIKAN", "İLK SAYFALAR", "CEVAT RIFAT ATİLHAN" doğrulandı). Kaynak metin büyük harfle yazılmaz, CSS ile dönüştürülür.
- Yazar adı kartta Plex büyük harf (+0.06em), başlık Garamond normal: "belge sahibi / belge adı" ikiliği.

### Yükleme stratejisi

Dosyalar (`src/assets/fonts/`, Google Fonts css2 API'den Chrome UA ile indirildi, 2026-10-11):

| Dosya | Boyut | İçerik |
|---|---|---|
| `eb-garamond-latin.woff2` | 44 336 B | U+0000-00FF + **ı (U+0131)** |
| `eb-garamond-latin-ext.woff2` | 113 928 B | **ğ Ğ ş Ş İ** (U+0100-02BA aralığı) |
| `eb-garamond-italic-latin.woff2` | 47 940 B | italik |
| `eb-garamond-italic-latin-ext.woff2` | 88 576 B | italik Türkçe harfler |
| `ibm-plex-sans-latin.woff2` | 45 712 B | |
| `ibm-plex-sans-latin-ext.woff2` | 30 964 B | |
| `OFL.txt` | 9 227 B | İki ailenin lisansı |

- `font-display: swap`, `unicode-range` ile alt küme bölme (typography.css).
- **Preload (2 kritik dosya):** `eb-garamond-latin.woff2` ve `ibm-plex-sans-latin.woff2` (`<link rel="preload" as="font" type="font/woff2" crossorigin>`). Not: Türkçe sayfada ğ/ş/İ neredeyse her zaman bulunduğu için latin-ext dosyaları da hemen indirilir; ama ilk boyamadaki glifin çoğu latin dosyasındadır. Lighthouse ölçümünde Garamond latin-ext'i preload'a almak daha iyi sonuç verirse B4 değiştirebilir (en fazla 2 preload kuralı korunur).
- Yedek metrikler (CLS için), Edge'de aynı Türkçe cümle ölçülerek hesaplandı:
  - `"EB Garamond Yedek"` → `local("Times New Roman")`, `size-adjust: 94.18%`, `ascent-override: 107.2%`, `descent-override: 31.9%`, `line-gap-override: 0%`
  - `"IBM Plex Sans Yedek"` → `local("Arial")`, `size-adjust: 100.37%`, `ascent-override: 102.6%`, `descent-override: 27.9%`
- Yığınlar: `--font-serif: "EB Garamond", "EB Garamond Yedek", Garamond, "Times New Roman", serif` · `--font-sans: "IBM Plex Sans", "IBM Plex Sans Yedek", "Segoe UI", Arial, sans-serif`.
- Toplam font ağırlığı (normal Türkçe sayfa, italiksiz): ~235 KB; italik kullanan sayfa +~137 KB. Italik yalnız eser adı/alıntıda kullanılmalı.

---

## 3. Boşluk ve ızgara

Ölçek (4px tabanlı): `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 24 (oluk) · `-6` 32 · `-7` 48 · `-8` 64 · `-9` 96 · `-10` 128.

- Izgara: 12 sütun, oluk `--space-gutter` 24px, kap `--max-w-page` 1280px (içerik ızgarası `--max-w-wide` 1200px), yan boşluk `--space-page-x` 16 → 48px.
- Bölüm ritmi `--space-section`: 56px (telefon) → 112px (masaüstü). Bölüm başlığından içeriğe `--space-7` (48px). Kartlar arası dikey `--space-7`, yatay oluk.
- Ritim kuralı: aynı boşluk iki kez üst üste gelmez. Hero sıkı (başlık-yazar 16px), sonra eylem öncesi 32px; künye satırları 12px; bölümler arası 112px. Eşit "her yerde 24px" yasak.

| Kırılım | Izgara | Hero | Katalog | Bölüm aralığı |
|---|---|---|---|---|
| Masaüstü ≥1025px | 12 sütun | Kapak 1–6, metin 8–12 (1 sütun nefes), min-yükseklik `--hero-min-h` = min(80vh, 56rem) | 3–4 kart/satır | 112px |
| Tablet 768–1024 | 12 sütun | Kapak 1–6, metin 7–12 | 3 kart | ~80px |
| Telefon <768 | tek akış | Kapak üstte (≤52vh), metin altta | 2 kart | 56px |

Editoryal asimetri: hero'da metin sütunu kapak yüksekliğinin ortasına hizalanır; bölüm başlığı sol etiket + serif başlık + sağ bağlantı şeklinde 3 parçalı ve üstte 1px mürekkep çizgiyle açılır.

---

## 4. Bileşen envanteri

Genel durumlar: **hover** renk/alt çizgi değişimi (150ms); **focus-visible** `2px solid var(--c-focus)` + `2px` offset (her etkileşimli öğede, kaldırılmaz); **active** 1px aşağı kayma; **disabled** kemik metin + çizgi sınır, `cursor: not-allowed`. Dokunma hedefi ≥44×44px (çip 32px yükseklik + 4px aralık istisnası; çip satırı mobilde sarılır).

### 4.1 Header + nav
- Anatomi: logo (sol, 150px; JPG beyaz zeminli olduğu için `mix-blend-mode: multiply` + negatif dikey margin ile kırpılır) · `nav` (Plex 14–15px, 24px aralık) · dikey 1px çizgi · "WhatsApp sipariş" metin bağlantısı. Alt kenar `--rule-hair`. Yükseklik 76px. Yapışkan değil (okuma alanı korunur); B1 isterse kaydırma yukarıdayken yapışkan yapabilir.
- Durumlar: hover → 1px alt çizgi soldan dolar (`background-size` 0 → 100%, 150ms); `aria-current="page"` → kalıcı alt çizgi + 600 ağırlık; focus-visible → kırmızı halka.
- Mobil (<768): nav gizlenir, "Menü" ikincil düğmesi (`aria-expanded`, `aria-controls`). Açılınca tam ekran `--c-paper` panel, bağlantılar Garamond `--text-xl`, alt alta, 1px çizgilerle ayrılmış; Esc ve kapat düğmesi; odak panel içinde tutulur; `body` kaydırması kilitlenir.
- Token: `--c-paper`, `--c-ink`, `--rule-hair`, `--font-sans`, `--text-sm`, `--duration-fast`, `--z-header`, `--z-menu`.

### 4.2 Footer
- Anatomi: üstte `--rule-ink`, zemin `--c-paper-sunk`; sol 5 sütun slogan "Tarihi doğru okumak için…" (Garamond italik `--text-xl`); sağda 3 kolon (Katalog / Yayınevi / Bağlantı), kolon başlığı `.etiket`; dipte 1px çizgi + adres + yasal bağlantılar (`--c-bone`, xs).
- Durumlar: bağlantı hover → alt çizgi. Kuruluş yılı gibi doğrulanmamış bilgi yazılmaz.

### 4.3 Düğme
| Varyant | Görünüm | Hover/Active | Kullanım |
|---|---|---|---|
| Birincil `.dugme--birincil` | `--c-seal-fill` dolgu, `--c-on-seal` metin | `--c-seal-fill-hover`; active 1px aşağı | **Ekran başına 1**: ana sayfada "İlk sayfaları çevir", detayda "WhatsApp ile sipariş ver" |
| İkincil `.dugme--ikincil` | Şeffaf, 1px `--c-ink` çerçeve, mürekkep metin | Ters çevrilir: mürekkep zemin, kâğıt metin | "Tüm kitaplar", flip ileri/geri, Menü |
| Üçüncül `.dugme--ucuncul` | Metin + `--c-rule-strong` alt çizgi | Alt çizgi mürekkep olur | "Künyeyi gör", kitapçı bağlantıları |
- Anatomi: min-yükseklik 44px, yatay 24px, Plex 500 `--text-sm`, yarıçap `--radius-1` (2px), isteğe bağlı 18px SVG ikon (stroke 1.5, emoji yok), `white-space: nowrap`.
- Disabled: birincilde dolgu `--c-paper-sunk` + `--c-rule` çerçeve + kemik metin.

### 4.4 Kitap kartı `.kitap-karti`
- Anatomi: (1) kapak yuvası `__kapak`: oran `--cover-ratio` 2:3, zemin `--c-paper-sunk`, iç boşluk 24px, `img` `object-fit: contain` + `mix-blend-mode: multiply` (kapak görselleri beyaz zeminli 3B çekimler; çarpma ile beyaz kâğıda karışır, kapak renkleri bozulmaz); (2) **"Önizle" dosya sekmesi** `.sekme`: yuvanın sol üstünde, üst köşeleri 4px, 1px çizgi, kabarık kâğıt, kitap ikonu + "ÖNİZLE" etiketi; yalnız önizlemesi olan kitapta; (3) gövde: üstte 1px çizgi, yazar (Plex 500 xs büyük harf, `--c-ink-soft`), başlık (Garamond `--text-lg`, bağlantı `::after` ile tüm kartı kaplar), künye satırı (sayfa · ay yıl, Plex xs kemik, tabular).
- Durumlar: hover → kapak `translateY(var(--lift-card))` (−4px, 220ms ease-out) + başlık alt çizgisi soldan belirir; **zıplama/ölçek yok**; focus-within → kartın tamamına kırmızı halka (6px offset); active → yok; görselsiz kitap → yuvada başlık Garamond ile ortalanır (B4 yer tutucu).
- Kapak yuvası kartın tek görsel ağırlığıdır; kart kutusu gölgesiz ve çerçevesizdir (Kronik tarzı renkli kart zemini **yok**).
- Kapak gölgesi: mevcut kapaklar 3B mockup ve kendi gölgeleri var → `--shadow-cover` **uygulanmaz**. Düz (2B) kapak gelirse `--shadow-cover` / hover'da `--shadow-cover-lift`.

### 4.5 Kitap detay künye tablosu `.kunye`
- Anatomi: `<table>` + `<caption class="etiket">Künye</caption>`; üst kenar `--rule-ink`, satırlar `--rule-hair`; `th scope="row"` Plex 500 xs büyük harf kemik (genişlik %36), `td` Plex `--text-sm` mürekkep; ISBN/sayfa/boyut/tarih `.rakam`; kategori ve dizi `td` içinde bağlantı. Zemin `--c-paper-raised`.
- Sıra: Yazar · (Çevirmen/Hazırlayan) · ISBN · Sayfa · Boyut · Cilt · Kâğıt · Yayın tarihi · Kategori · Dizi. **Boş alan satırı hiç basılmaz** (null → satır yok).
- ISBN gösterimi tireli (978-625-5529-43-5); `itemprop`/JSON-LD için ham değer B5'te.

### 4.6 Yazar kartı `.yazar-karti`
- Anatomi: 72×96px portre (gri tonlama `filter: grayscale(1)`, 1px çizgi) · `.etiket` "Yazar" · ad (Garamond `--text-lg`, bağlantı tüm kartı kaplar) · ek satır (kitap sayısı vb., yalnız veriden). Portre yoksa baş harf "mührü": `--c-paper-sunk` kutuda Garamond baş harfler.
- Hover: ad altı çizgili. Focus-within: kart halkası.

### 4.7 Bölüm başlığı + çizgi `.bolum-basligi`
- Anatomi: üstte 1px `--rule-ink` · 3 sütun: sol kısa arşiv etiketi (Plex xs büyük harf, kemik; ör. "YENİ ÇIKANLAR", "RAF", "DOSYA") · Garamond `--text-xl` başlık (`h2`) · sağ "Tümü →" bağlantısı. Numara (01/02…) **kullanılmaz** (şablon izi).
- Mobilde sağ bağlantı alt satıra iner.

### 4.8 Etiket / çip `.cip`
- Anatomi: 32px yükseklik, 12px yatay, Plex 500 xs, 1px `--c-rule-strong` çerçeve, 2px yarıçap; isteğe bağlı sayı (`.cip__sayi`, tabular, %70 opak).
- Durumlar: hover → `--c-paper-sunk` zemin; seçili (`aria-pressed="true"`) → mürekkep zemin + kâğıt metin; focus-visible halka. **Kategori başına renk yok.**
- Takım (set) kitaplar için "Takım" çipi aynı stilde, renksiz.

### 4.9 Breadcrumb `.iz`
- `<nav aria-label="Konum"><ol>`; Plex xs; ayraç "/" `--c-rule-strong` (CSS `::before`, okunmaz); son öğe `aria-current="page"` mürekkep, bağlantısız.

### 4.10 WhatsApp sipariş CTA `.siparis`
- Anatomi: 1px `--rule-ink` çerçeveli kabarık kâğıt kutu · `.etiket` "Sipariş hattı" · bir cümle (Garamond) · **birincil** düğme (WhatsApp çizgi ikonu + "WhatsApp ile sipariş ver"; `href` `https://wa.me/905059808735?text=` + kitap adı, B2) · telefon numarası (Plex, tabular) · üçüncül "Kitapçılarda bul" bağlantısı.
- WhatsApp yeşili **kullanılmaz** (tek vurgu kuralı); tanınırlık ikon + metinle sağlanır.

### 4.11 Flipbook modal çerçevesi `.flip`
- Anatomi: `--c-scrim` örtü · `role="dialog" aria-modal="true"` kutu, `--c-paper-raised`, yarıçap 4px, `--shadow-modal`, maks. `--max-w-modal` · **üst şerit**: `.etiket` "İlk sayfalar" + kitap adı (Garamond lg) + sağda 44×44 **mürekkep kapat düğmesi** (kâğıt renkli × SVG, `aria-label="Önizlemeyi kapat"`) · **sahne**: `--c-flip-mat` (çökük kâğıt) zemin üstünde iki sayfalık yayılım, `--shadow-page` + ortada 48px cilt gölgesi gradyanı (yalnız sayfa kıvrımı gölgesi; dekoratif gradient değil) · **alt şerit**: ikincil "← Önceki" / "Sonraki →", sayaç "Sayfa 2–3 / N" (Plex tabular, `aria-live="polite"`), klavye ipucu (masaüstü).
- Neden bu zemin: iç sayfa görselleri (`docs/design/ornek-ic-sayfa-*.jpg`) saf beyaz (ölçüldü: 255,255,255). Kâğıt-çökük zemin beyaz sayfayı "masaya konmuş yaprak" gibi ayırır; sayfalar boyanmaz.
- Telefon (<768): tek sayfa modu, cilt gölgesi yok, düğmeler sarılmaz.
- Durumlar: açılış `opacity` + 8px `translateY`, `--duration-slow` ease-out; reduced-motion → animasyonsuz, sayfalar dikey kaydırmalı liste (B3).

### 4.12 Filtre çubuğu `.filtre`
- Anatomi: `--c-paper-sunk` zemin, üst/alt 1px çizgi, 16×24 iç boşluk · sol çip grubu (`role="group" aria-label="Kategori"`) · sağ arama: `.etiket` "Ara" + `input type="search"` (40px, kabarık kâğıt, `--rule-strong`, yer tutucu kemik).
- Mobil: çipler sarılır, arama tam genişlik alta iner. Sonuç sayısı `aria-live` ile duyurulur (B2).

### 4.13 Sayfalama `.sayfalama`
- `<nav aria-label="Sayfalar">`; üstte 1px çizgi; 44×44 hücreler; mevcut sayfa `aria-current="page"` 1px mürekkep çerçeve + 600; hover 1px güçlü çizgi; pasif yön `aria-disabled` kemik. Mobilde sarılır (B2 isterse "…" ve uç sayıları gizler).

### 4.14 Skip-link `.atla`
- İlk odaklanabilir öğe, "İçeriğe geç" → `#icerik`. Normalde ekran dışı (`top:-100px`), odakta sol üstte mürekkep zemin + kâğıt metin, `--z-skip`.

### 4.15 Odak halkası
- Global: `:focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px; }`. Kart gibi bileşik öğelerde `:focus-within` ile kartın dışına (6px). `outline: none` yalnız halka başka öğeye taşınıyorsa.

---

## 5. Hareket

| Ne | Süre | Eğri | Özellik |
|---|---|---|---|
| Renk, alt çizgi, çip zemini | `--duration-fast` 150ms | `--ease-out` | `color`, `background-color`, `background-size` |
| Kart kapağı yükselmesi, menü paneli | `--duration-base` 220ms | `--ease-out` | `transform` (−4px) |
| Modal açılışı, sayfa çevirme | `--duration-slow` 300ms | `--ease-out` | `opacity`, `transform` |

- Yalnız `transform` / `opacity` / `background-size` animasyonu; `width/height/top/margin` yok.
- Zıplama (bounce/spring), ölçekleme, parallax, kaydırmaya bağlı giriş animasyonu **yok**.
- `prefers-reduced-motion: reduce` → tokens.css süreleri 0ms ve `--lift-card` 0px yapar; B3 flip animasyonunu kapatıp dikey listeye düşer.

---

## 6. Karanlık mod: "gece arşivi"

- Varsayılan açık tema. Karanlık değerler `@media (prefers-color-scheme: dark)` altında `:root:not([data-theme="light"])` ve elle seçim için `:root[data-theme="dark"]` altında (ikisi aynı değerler; tek doğruluk için değişiklikte ikisi birlikte güncellenir, `kontrast.mjs` `[data-theme="dark"]` bloğunu ölçer).
- Koyu kâğıt #171513, açık mürekkep #ECE5D6. **Kırmızı korunur**: metin/çizgi vurgusu açılır (#E0675C, 5.0–5.7:1), düğme dolgusu koyu kalır (#B3262B, açık metinle 6.08:1). Bağlantı hover açılır (#EE8B81), düğme hover koyulur (#8F1D22).
- Doku kapalı (`--texture-paper: none`), gölgeler siyaha çekilir.
- **Kapak yuvası karanlıkta da açık kâğıt kalır** (karoda `#EAE3D4`): kapak görselleri beyaz zeminli olduğundan `multiply` karanlık zeminde çalışmaz. B1/B4 bunun için bileşen düzeyinde `.kitap-karti__kapak` zeminini karanlıkta sabit açık tutmalı (bkz. §9, açık soru 1).
- Logo JPG karanlık zeminde beyaz kare olarak görünür → karanlık tema, şeffaf/SVG logo gelene kadar header'da logoyu açık kâğıt "etiket" kutusu içinde gösterir.
- Tema düğmesi zorunlu değil; eklenirse header sağında üçüncül düğme, seçim `localStorage` (try/catch).

---

## 7. Yapılmayacaklar

- Saf beyaz (#FFF) zemin; gradient (tek istisna: flipbook cilt gölgesi); emoji; indirim/kampanya rozeti ve bandı; "Çok satan" kırmızı damgası.
- Ekranda birden fazla kırmızı dolu öğe; kırmızı başlık; kırmızı büyük yüzey.
- 4px'ten büyük köşe yarıçapı; hap (pill) şekilli düğme/çip; kart gölgesi; 1px'ten kalın dekoratif çizgi (odak halkası ve `--rule-seal` hariç).
- Üçüncü font ailesi (mono, display, ikon fontu); sahte kalın/italik; Plex'te 600 üstü.
- Bölüm numaraları (01/02/03), ortalanmış jenerik hero + gradient blob, eşit aralıklı hiyerarşisiz kart ızgarası, Bootstrap/şablon varsayılanları.
- Kategoriye göre renk kodlama; kapak renginden türetilmiş kart zemini (Kronik yöntemi; bizde kapak yuvası nötr).
- Zıplayan/ölçeklenen hover, parallax, otomatik kayan karusel.
- Doğrulanmamış marka bilgisi (kuruluş yılı, ekip, "X yıllık tecrübe", satış rakamı).
- Kapak görselini kırpmak veya üstüne yazı/etiket bindirmek (Önizle sekmesi yuvanın dışında, üst kenarda durur).

---

## 8. Anti-template kontrol listesi (ECC design-quality, 10 madde)

| # | Madde | Durum | Nasıl karşılandı |
|---|---|---|---|
| 1 | Ölçek karşıtlığıyla net hiyerarşi | **✓** | Hero kitap adı 88px Garamond ↔ 12px Plex büyük harf etiket (7.3× oran); yazar Plex büyük harf, başlık serif; künye kemik grisi. |
| 2 | Kasıtlı boşluk ritmi (her yerde aynı padding değil) | **✓** | Bölüm 112px, başlık→içerik 48px, hero içi 16/32px, künye satırı 12px; §3 ritim kuralı "aynı boşluk üst üste gelmez". |
| 3 | Katman/derinlik (örtüşme, yüzey, hareket) | **✓** | Üç kâğıt seviyesi (çökük/kâğıt/kabarık); "Önizle" dosya sekmesi yuvanın üst kenarına taşar; kapak −4px yükselir; modal + masa + sayfa üçlü katmanı. |
| 4 | Karakterli tipografi ve gerçek eşleştirme | **✓** | EB Garamond (tarihî kitap yazısı) + IBM Plex Sans (teknik, arşiv fişi); roller ayrık; ölçülmüş yedek metrikler; Türkçe büyük harf `lang` ile. |
| 5 | Rengin anlamsal kullanımı | **✓** | Kırmızı = yalnız eylem/bağlantı/odak (ekran başına tek dolu öğe); kemik = metadata; çizgi tonları bileşen sınırı ile dekoratif ayrımı (3:1 ölçüldü). |
| 6 | Tasarlanmış hover/focus/active | **✓** | Alt çizginin soldan dolması, ikincil düğmenin ters çevrilmesi, kart yükselmesi + başlık çizgisi, 2px kırmızı odak halkası, 1px basılma; tümü §4 ve karoda gösterildi. |
| 7 | Izgara kıran editoryal/bento kompozisyon | **✓** | Hero 6+1+5 asimetrik bölünme; bölüm başlığı 3 parçalı arşiv başlığı; detayda künye 7 sütun / yan kolon 4 sütun. |
| 8 | Doku/atmosfer | **✓** | %3 opak SVG kâğıt gürültüsü; dosya sekmesi; künye tablosu belge formu; cilt gölgesi. |
| 9 | Akışı açıklayan hareket | **✓** | Hover yükselmesi "açılabilir" bilgisini verir; modal açılışı kaynağından; sayfa çevirme gerçek fiziksel metafor; reduced-motion karşılığı tanımlı. |
| 10 | Veri görselleştirme sistemin parçası | ✗ | Sitede grafik yok; kapsam dışı (künye tablosu tabular rakamla tasarlandı ama veri görselleştirmesi sayılmaz). |

**Skor: 9 / 10** (eşik ≥6).

---

## 9. B1–B5 için uygulama notları

### Dosya düzeni
```
src/assets/css/
  tokens.css        D1 — yalnız değişkenler (dokunmayın; değişiklik önerisi D1'e)
  typography.css    D1 — @font-face + temel metin + .etiket/.serif/.sans/.rakam/.metin-hero/.metin-giris
  global.css        B1 — reset, body zemini/doku, :focus-visible, .sarmal, .izgara, header, footer, düğme, bölüm başlığı, skip-link, breadcrumb, sayfalama
  katalog.css       B2 — kitap kartı, filtre, çip, künye tablosu, yazar kartı, sipariş CTA (B2 kendi dosyasını açar; global.css'e yazmaz)
  flipbook.css      B3 — modal, sahne, sayaç
src/assets/fonts/   D1 — woff2 + OFL.txt (passthrough: /assets/fonts/)
```
Yükleme sırası: `tokens.css` → `typography.css` → `global.css` → sayfaya özgü CSS. `<head>`'e iki preload (§2).

### Sınıf adlandırma (BEM benzeri, Türkçe)
Blok `.kitap-karti`, öğe `.kitap-karti__baslik`, değiştirici `.dugme--birincil`, durum `.is-acik` / ARIA öznitelikleri (`aria-current`, `aria-pressed`, `aria-expanded`) tercih edilir. Karodaki adlar referanstır: `.ust`, `.nav`, `.alt`, `.dugme(--birincil|--ikincil|--ucuncul)`, `.bolum-basligi(__no|__ek)`, `.kitap-karti(__kapak|__govde|__yazar|__baslik|__kunye)`, `.sekme`, `.kunye`, `.yazar-karti(__portre|__ad|__ek)`, `.cip(__sayi)`, `.iz`, `.siparis(__no)`, `.flip(__ust|__baslik|__kapat|__sahne|__yayilim|__alt|__sayac)`, `.filtre(__ara)`, `.sayfalama(__yon)`, `.atla`, `.sarmal`, `.izgara`.

### Rol bazlı notlar
- **B1:** `body { background: var(--c-paper) var(--texture-paper); }`. Header logo için `mix-blend-mode: multiply` + kırpma (karodaki gibi); karanlık temada logo kutusu açık kâğıt. Ana sayfa hero: tek kapak büyük (60–80vh), birincil düğme "İlk sayfaları çevir" (önizlemesi olan kitap seçilmeli). `global.css`'teki mevcut 1 satırlık geçici `:root` kaldırılmalı (tokens.css'le çakışır: `--c-bg`, `--c-fg`).
- **B2:** Kart künye satırı: `pages` + ay/yıl (`publish_date`); null ise satır kısalır, uydurulmaz. Detay sayfasında birincil düğme WhatsApp CTA'dır; "Önizle" sekmesi/kapak tıklaması ikincil yoldur. Kategori çipleri renksiz.
- **B3:** Modal yapısı §4.11; sahne zemini `--c-flip-mat`; sayfa görselleri boyanmaz/filtrelenmez; kapat düğmesi mürekkep; Esc, odak tuzağı, ← →; sayaç `aria-live`. Reduced-motion → dikey liste.
- **B4:** Kapak görselleri 3B mockup + beyaz zemin; yuvada `object-fit: contain` + `multiply`. Kapak oranı ~0.645 (2:3'e yakın); kırpma yok. Hero kapağı `fetchpriority="high"`, diğerleri lazy. Font dosyaları zaten optimize (alt kümeli woff2); yeniden alt kümeleme gerekmez.
- **B5:** ISBN JSON-LD'de ham (tiresiz); görünürde tireli. Font preload'ları `crossorigin` ile.

### Doğrulama komutları
```
node scripts/design/kontrast.mjs           # tablo; başarısızlıkta çıkış kodu 1
node scripts/design/kontrast.mjs --md --oklch
node scripts/design/tile-screenshot.mjs    # docs/design/style-tile(.png|-mobile.png)
```

### Açık sorular (Direktöre)
1. Kapak görselleri beyaz zeminli 3B mockup. Karanlık temada kapak yuvasını açık kâğıt tutmayı seçtim; alternatif, B4'ün kapakları şeffaf PNG/WebP'ye ayırması (arka plan silme) — maliyet/öncelik kararı gerekli.
2. Logo yalnızca 400px beyaz zeminli JPG. Şeffaf PNG veya SVG kaynak yayınevinden istenebilir mi? (Karanlık tema ve keskin header için gerekli.)
3. Tema seçici düğmesi (açık/karanlık) eklensin mi, yoksa yalnız sistem tercihi mi izlensin?
