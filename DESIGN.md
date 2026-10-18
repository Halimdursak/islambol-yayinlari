# İslambol Yayınları — Tasarım Sistemi: "Beyaz Vitrin"

> Sürüm: v2 · 16 Ekim 2026 · Önceki sürüm: "Arşiv Dosyası" (v1, 11 Ekim; kullanıcı beğenmedi, ADR-010 ile değişti)
> Token kaynağı: `src/assets/css/tokens.css` · Tipografi: `typography.css` · Fontlar: `src/assets/fonts/`
> Referans: `docs/design/secenekler/secenek-1/` (canlı `index.html`, `kitap.html`, `NOT.md`) · Kontrast ölçümü: `node scripts/design/kontrast.mjs`

---

## 0. Karakter

apple.com ürün sayfasının dili, bir yayınevi vitrinine uyarlandı: beyaz zemin ile `#f5f5f7` bantlar dönüşümlü, krom neredeyse yok, sahnede yalnızca kitap. Hiyerarşiyi ölçek ve boşluk kurar; derinliği yalnızca yumuşak gölge ve bant kontrastı verir. Kapaklar kutusuz, "ürün fotoğrafı" gibi durur. Tek vurgu rengi logodaki kırmızıdır ve yalnızca iki yerde kullanılır: birincil eylem düğmesi ve "Önizle" rozeti.

Yapı (arama çubuklu üst bar, duyuru slaytı, yuvarlak portreli yazar şeridi, kategori karoları, yönetim paneli) 14 Ekim "yeni vitrin" çalışmasından korunmuştur; değişen yalnızca görünümdür (ADR-010, ADR-012).

---

## 1. Palet

| Token | Hex | Rol |
|---|---|---|
| `--c-bg` | `#ffffff` | Sayfa zemini, kart, modal |
| `--c-band` | `#f5f5f7` | Dönüşümlü bölüm bandı, arama çubuğu, modal sahnesi |
| `--c-ink` | `#1d1d1f` | Ana metin, seçili çip, koyu düğme |
| `--c-ink-2` | `#6e6e73` | İkincil metin, künye, yer tutucu |
| `--c-ink-soft` | `#424245` | Renkli yüzey (hero karosu) üstündeki ikincil metin |
| `--c-line` | `#d2d2d7` | 1px ayırıcı, bileşen çizgisi |
| `--c-fill` / `--c-fill-hover` | `#e8e8ed` / `#dcdce1` | İkincil düğme, çip, ok, kapat düğmesi |
| `--c-accent` / `--c-accent-hover` | `#d11a2a` / `#b5151f` | **Yalnız** birincil CTA ve "Önizle" rozeti |
| `--c-on-accent` | `#ffffff` | Kırmızı üstündeki metin |
| `--c-focus` | `#0071e3` | Odak halkası (işlevsel; vurgu değildir) |
| `--c-whatsapp` / `-hover` | `#25d366` / `#1ebe5a` | **Yalnız** üst bardaki resmî WhatsApp logosu |
| `--c-scrim` | `rgb(0 0 0 / .42)` | Modal perdesi |

Hero karosu tonları (`vitrin.css`): `peach #f6efe9`, `sage #eef2ed`, `cream #f5f3ec` panelden seçilir; `blue #edf1f6` CSS'te hazırdır ama yönetim paneli şimdilik sunmaz (`scripts/cms/content.mjs` yalnız peach/sage/cream kabul eder; geçersiz değer cream'e düşer). Yalnızca çok hafif bir ton verir.

Kurallar:
- Ekranda tek vurgu rengi: kırmızı. Kırmızı başlık, kırmızı büyük yüzey, kırmızı dekor yok. Bağlantı rengi mürekkeptir, vurgu hover'da altçizgiyle verilir.
- İstisna: WhatsApp yeşili. Marka işareti olduğu için resmî renginde kalır, başka hiçbir yerde kullanılmaz (kullanıcı isteği, 16 Ekim).
- Saf siyah yok (`#000` yalnızca gölgede), gradyan yok (kapak gölgesi ve cilt gölgesi bulanık gölgedir).
- Karanlık mod yoktur: sayfa her sistem ayarında açık tema kullanır (`color-scheme: light`; e2e testi bunu doğrular).

### Kontrast (betikle ölçüldü: `node scripts/design/kontrast.mjs --md`, 16 Ekim 2026)

Eşik: metin 4.5:1, bileşen sınırı ve odak halkası 3:1 (WCAG 1.4.11). Resmî WhatsApp logosu marka işareti olarak eşikten muaftır (WCAG 1.4.11, "essential" istisnası).

| Ön plan | Zemin | Kullanım | Oran | Eşik | Seviye |
|---|---|---|---:|---:|---|
| `ink` #1d1d1f | `bg` #ffffff | Gövde metni / sayfa | 16.83:1 | 4.5 | AAA |
| `ink` #1d1d1f | `band` #f5f5f7 | Gövde metni / bant | 15.46:1 | 4.5 | AAA |
| `ink` #1d1d1f | `fill` #e8e8ed | Çip, ikincil düğme metni | 13.78:1 | 4.5 | AAA |
| `ink` #1d1d1f | `fill-hover` #dcdce1 | İkincil düğme üzerinde | 12.32:1 | 4.5 | AAA |
| `ink-2` #6e6e73 | `bg` #ffffff | İkincil metin, künye / sayfa | 5.07:1 | 4.5 | AA |
| `ink-2` #6e6e73 | `band` #f5f5f7 | İkincil metin / bant, arama yer tutucusu | 4.66:1 | 4.5 | AA |
| `ink 70%` #1d1d1f | `fill` #e8e8ed | Çip sayacı (%70 opak) | 5.63:1 | 4.5 | AA |
| `ink 70%` #1d1d1f | `fill-hover` #dcdce1 | Çip sayacı üzerinde (%70 opak) | 5.35:1 | 4.5 | AA |
| `on-accent` #ffffff | `accent` #d11a2a | Birincil düğme, Önizle rozeti | 5.40:1 | 4.5 | AA |
| `on-accent` #ffffff | `accent-hover` #b5151f | Birincil düğme üzerinde | 6.79:1 | 4.5 | AA |
| `accent` #d11a2a | `bg` #ffffff | Vurgu rengi metin (geçerli menü öğesi) / sayfa | 5.40:1 | 4.5 | AA |
| `accent` #d11a2a | `band` #f5f5f7 | Vurgu rengi metin / bant | 4.96:1 | 4.5 | AA |
| `bg` #ffffff | `ink` #1d1d1f | Seçili çip, koyu düğme metni | 16.83:1 | 4.5 | AAA |
| `focus` #0071e3 | `bg` #ffffff | Odak halkası / sayfa (bileşen) | 4.70:1 | 3 | AA |
| `focus` #0071e3 | `band` #f5f5f7 | Odak halkası / bant (bileşen) | 4.31:1 | 3 | AA bileşen/büyük |
| `focus` #0071e3 | `fill` #e8e8ed | Odak halkası / çip, düğme (bileşen) | 3.85:1 | 3 | AA bileşen/büyük |
| `ink` #1d1d1f | `ton-peach` #f6efe9 | Hero başlığı / peach tonu | 14.78:1 | 4.5 | AAA |
| `ink-soft` #424245 | `ton-peach` #f6efe9 | Hero açıklaması / peach tonu | 8.79:1 | 4.5 | AAA |
| `ink` #1d1d1f | `ton-sage` #eef2ed | Hero başlığı / sage tonu | 14.87:1 | 4.5 | AAA |
| `ink-soft` #424245 | `ton-sage` #eef2ed | Hero açıklaması / sage tonu | 8.85:1 | 4.5 | AAA |
| `ink` #1d1d1f | `ton-blue` #edf1f6 | Hero başlığı / blue tonu | 14.84:1 | 4.5 | AAA |
| `ink-soft` #424245 | `ton-blue` #edf1f6 | Hero açıklaması / blue tonu | 8.83:1 | 4.5 | AAA |
| `ink` #1d1d1f | `ton-cream` #f5f3ec | Hero başlığı / cream tonu | 15.16:1 | 4.5 | AAA |
| `ink-soft` #424245 | `ton-cream` #f5f3ec | Hero açıklaması / cream tonu | 9.02:1 | 4.5 | AAA |

---

## 2. Tipografi

Tek aile: **Inter** (SIL OFL, self-host, değişken ağırlık 100–900). Apple cihazlarda sistem fontu SF Pro öncelikli çözülür; yığın: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Arial, sans-serif`.

| Kullanım | Ölçü | Ağırlık | Satır / aralık |
|---|---|---|---|
| Sayfa başlığı `h1` | `clamp(2.5rem, …, 4.5rem)` (40→72px) | 600 | 1.04 / −0.03em |
| Bölüm başlığı `h2` | `clamp(2rem, …, 3rem)` (32→48px) | 600 | 1.08 / −0.025em |
| Giriş metni, hero açıklaması | 19→23px | 400 | 1.4 / −0.012em |
| Gövde | 17px | 400 | 1.47 / −0.01em |
| Kart başlığı | 17px | 600 | 1.25 |
| İkincil / yazar | 15px | 400 | 1.3 |
| Mikro (künye, sayaç) | 13px | 400 | 1.5, tabular-nums |

- Etiketler cümle düzeninde yazılır ("Yeni çıkanlar", "İlk sayfalar sizi bekliyor"); büyük harf zorlaması, geniş harf aralığı ve numaralı bölümler (01/02) yoktur.
- Başlıklarda `text-wrap: balance`, paragrafta `pretty`. Türkçe uzun gövde paragrafında (`.okuma`, `.kitap-detay__metin`, `.yazar-bio__metin`) otomatik tireleme açıktır, başlık ve etiketlerde kapalıdır.
- Sayılar (ISBN, sayfa, tarih, telefon, sayaçlar) `font-variant-numeric: tabular-nums` (`.rakam`).
- Dosyalar: `inter-latin-wght-normal.woff2` (48 KB, ı dahil), `inter-latin-ext-wght-normal.woff2` (85 KB, ğ Ğ ş Ş İ). `font-display: swap`, yalnız latin dosyası `preload` edilir. Toplam ~133 KB, italik yok.
- Lisans metni `src/assets/fonts/OFL.txt` (Inter Project Authors).

---

## 3. Yerleşim

- Kap `.kap`: en çok `--max-w` 1180px (içerik 1136px), yan boşluk `--gutter` 22px (≤640px: 20px).
- Bölüm boşluğu `--sec-pad`: 96px; ≤834px: 72px; ≤640px: 64px. Bölüm başlığından içeriğe `--head-gap` 36px (mobil 24px). Raflar gölge payını kendisi taşır (`.bolum--raf`, alt boşluk −56px).
- Ana sayfa bant ritmi: beyaz (hero, kısayollar, yeni çıkanlar) → **bant** (önizlemeli) → beyaz (yazarlar) → **bant** (kategoriler) → beyaz (hikâye ve sayılar) → **bant** (satış) → beyaz alt bilgi.
- Şekil: kart `--radius-card` 20px, büyük modül ve modal `--radius-lg` 28px (mobil 24px), düğme ve çip `--radius-pill` 980px.
- Gölge: `--shadow-card` (durağan), `--shadow-card-hover`, `--shadow-modal`, `--shadow-page` (sayfa çevirme sayfaları).

### 3.1 Mobil sözleşmesi (ADR-017; `tests/e2e/mobil.spec.ts` bunu denetler)

1. **Taşma yok:** 320–412 px genişlikte ve sistem yazı tipi %150–200'e çıksa da hiçbir sayfa yatay genişlemez (aksi hâlde mobil tarayıcı sayfayı küçültüp sığdırır ve her şey minik görünür). Düğmeler, telefon numarası, e-posta ve kart başlıkları sarar (`.dugme` artık `nowrap` değildir; kartlar ve alt bilgi `overflow-wrap: anywhere`).
2. **Dokunma hedefi ≥ 44×44 px** (`@media (pointer: coarse)` ve üst bar her yerde): üst bar düğmeleri, çipler, slayt okları ve noktaları, konum yolu, alt bilgi bağlantıları, liste/künye bağlantıları. Genişletilmiş alan için `::after` kullanılır, görünüm değişmez. Paragraf içi bağlantılar WCAG 2.5.8 satır içi istisnasındadır.
3. **Yazı ≥ 13 px** (`--text-xs`): rozetler, alt bilgi ve notlar dahil 12 px kullanılmaz.
4. **Yerleşim kayması < 0,05 (CLS):** geç açılan arayüz parçası yoktur. Katalog süzgeci sunucudan görünür gelir; JS yoksa `<noscript>` stili gizler.
5. **İlk ekran:** kitap sayfasında sıra çipler → ad → yazar → **sipariş düğmeleri** → kapak (390×664'te düğme kaydırmadan görünür). Üst bar: logo · WhatsApp · arama · **Menü** (kısa etiket; panel açıkken "Kapat").
6. **Uzun liste:** iki ekran aşağıda "başa dön" düğmesi (yalnız dar ekran); kategori çipleri sağ kenarda solarak "devamı var" der.
7. **Yatay telefon:** önizleme penceresi tam ekran, başlık tek satır; sayfa sahnesi yüksekliğin yarısından fazlasını alır, telif notu görünür kalır.
8. **Logo:** üst bar/alt bilgi önceden kırpılmış `islambol-logo-yatay.webp` (300×102, ~13 KB) kullanır; kaynak logo (`islambol-logo.png`) değişmez (ADR-014).

---

## 4. Bileşenler

### 4.1 Üst bar `.ust`
Masaüstü (≥1100px): tek sıra, yapışkan, yarı saydam cam şerit (`backdrop-filter: blur(20px) saturate(180%)`), yükseklik ~57px: logo · menü (7 bağlantı, tek satır, geçerli sayfa 600) · arama kapsülü (210px, `--c-band`) · WhatsApp logosu. Dar ekran: logo · WhatsApp · arama simgesi · "Menüyü aç"; panel açılınca opak beyaz, görünür alanın tamamını kaplar, arama en üstte, menü altında; arka sayfa kaymaz (`html.menu-acik`). Esc kapatır ve odağı düğmeye geri verir; klavyeyle (Enter/Boşluk) açılınca odak panelin ilk bağlantısına geçer (DOM'da panel düğmeden önce olduğu için); arama simgesi paneli açıp aramaya odaklanır (`site.js`). JS yoksa `<noscript>` stili paneli açık bırakır. Simge düğmeleri 40px, ≤380px 36–38px.

Logo, şeffaf PNG'nin içerik kutusunun (x 99–696, y 305–503 / 800) kırpılmasıyla gösterilir (`--lh` yüksekliği).

**WhatsApp düğmesi `.ust__wa`:** 36px yeşil daire içinde resmî WhatsApp glifi (beyaz), `site.whatsapp_url` adresine doğrudan gider (yeni sekme, `rel="noopener noreferrer"`), erişilebilir adı "WhatsApp ile yazın". Numara tek kaynaktan gelir: `data/site/site.json`.

### 4.2 Alt bilgi `.alt`
Beyaz zemin, üstte 1px çizgi, 13px ikincil metin. 4 sütun (marka+slogan, Yayınevi, İletişim, Nereden alınır); dipte telif, not ve "Yönetici paneli" bağlantısı. Kuruluş yılı gibi doğrulanmamış bilgi yazılmaz.

### 4.3 Düğme `.dugme`
44px, 980px yarıçap, 600/17px. `--birincil` kırmızı (ekran başına ana eylem), `--ikincil` `--c-fill`, `--ucuncul` düz metin + "›", `--kucuk` 36px. Basınca `scale(.97)`. Yuvarlak ok düğmesi `.yuvarlak-dugme` 36px.

### 4.4 Çip `.cip`
36px kapsül, `--c-fill`; `aria-pressed="true"` → mürekkep zemin beyaz metin; `--durum` ince çerçeveli, etkileşimsiz etiket. Sayaç `.cip__sayi` %70 opak (kontrast 5.6:1).

### 4.5 Bölüm/raf başlığı `.raf-basligi`, `.bolum-basligi`
Sol: ikincil etiket (17px/600) + `h2`; sağ: bağlantı ("Tüm kitaplar ›") ve raf okları. Dokunmatik cihazda oklar gizlenir (raf parmakla kaydırılır).

### 4.6 Kitap kartı `.kitap-karti` (`kartlar.css`)
Beyaz, 20px, `--shadow-card`; hover/odakta −4px yükselir ve gölge büyür (zıplama yok). Yapı: kapak yuvası (kesin 2:3; görsel mutlak konumlu `object-fit: contain`, tabana oturur, böylece farklı oranlı kapaklarda başlıklar tek taban çizgisinde kalır; `multiply`, bkz. §5) · yazar (15px gri) · başlık (17px/600, tüm kartı kaplayan bağlantı) · künye (13px). **"Önizle" rozeti** `.sekme`: kırmızı kapsül, kartın sol altında. Sayfada o kitabın önizleme `<template>`'i basılıyorsa rozet gerçek düğmedir (`data-onizleme="<id>"`, sayfa çevirmeyi açar, görünmeyen isabet alanı ~44px); değilse yalnızca etikettir ve `pointer-events: none` ile kart bağlantısının tıklamasını yutmaz. JS kapalıyken düğme gizlenir. Kart odak halkası bağlantının `::after` katmanındadır (`:has()` gerekmez). "Takım" rozeti nötr gridir.

### 4.7 Yatay raf `.serit`
`scroll-snap-type: x mandatory`; kenara taşar, iç boşluk içerik ızgarasına hizalıdır. Kart 232px (≤834: 204, ≤640: 184). `data-scroll-shelf/track/controls` işaretleri `showcase.js`'i sürer (ok durumları, taşma algısı).

### 4.8 Yazar kartı `.yazar-karti`
Yuvarlak 132px portre (fotoğraf yoksa baş harfler, `--c-band` zemin, 600); altında ad ve kitap sayısı. Hover'da portre hafifçe yükselir.

### 4.9 Duyuru slaytı `.vitrin` (panelden yönetilir)
28px yuvarlak karo, iki sütun: sol metin (etiket, `h2` ≤60px/600, açıklama, kırmızı CTA + ikincil "İlk sayfalara göz at"), sağ sahne (ana kapak perspektifli `rotateY(-7deg)`, iki arka kapak ±9° dönük ve sahne genişliğine oranlı konumlu, altta yazar ve başlık). Arka kapaklar slayttan slayta değişir. Tüm slaytlar aynı ızgara hücresinde üst üste durur (kap en yüksek slayta göre ölçülür; etkin olmayan `visibility: hidden`), böylece slayt değişince sayfa kaymaz. Panelden görsel yüklenirse sahneyi o doldurur. Kontroller: önceki/sonraki yuvarlak düğmeler ve nokta göstergesi (aktif nokta uzar); yalnız kullanıcı kontrolüyle değişir, kendiliğinden kaymaz. Slayt başlığındaki satır sonları korunur (`white-space: pre-line`). Ana kapak ve ikincil düğme, kitap vitrin önizlemelisindeyse `data-onizleme` taşır.

### 4.10 Kısayollar `.kesif-kisayollari`
Üç bağlantı (kitap bul, satın almadan önce oku, nereden alınır), ince dikey çizgilerle ayrılmış, simge + metin + "›". Mobilde alt alta.

### 4.11 Kategori karoları `.kategori-karti`
Bant üstünde beyaz 28px karolar: ad 28px/600 (alt-sol), o kategoriden üç gerçek kapak (sağ üst, sabit 54×84px kutularda `contain`, hafif dönük, `multiply` dönen kutuda; editoryal olarak vitrin dışı bırakılan kitaplar hariç), yuvarlak ok (alt-sağ; mobilde sağ üst, kapaklar yazının üstünde). Hover'da yükselir.

### 4.12 Yayın hikâyesi ve sayılar
Ortalı slogan (`h2`), 30px/500 özet, üçüncül bağlantı. Altında dört sayı (kitap, yazar, önizlemeli kitap, set ve seri): 64px/600, üstte 1px çizgi, hepsi katalog verisinden hesaplanır.

### 4.13 Satış modülleri `.satis-vitrini`
İki modül: sol beyaz karoda telefon (40px) + kırmızı WhatsApp düğmesi; sağ tek gruplu kanal listesi (ad, not, ↗), satırlar ince çizgili. Satış fiyatı gösterilmez; yalnızca kitap kartı ve sayfasında liste fiyatı (ADR-018).

### 4.14 Katalog ve kitap detayı (`katalog.css`)
**Liste sayfaları** (kitaplar, yazarlar, diziler, yazar): `.katalog` sarmalayıcısı tam genişlik `--c-band` zemindir; üstte etiket, `h1` (40→64px/600) ve gri sayı satırı. Kartlar beyazdır.
- **Süzgeç `.filtre`** (sunucudan görünür gelir; JS yokken `<noscript>` stili gizler ve liste tam görünür): beyaz 28px kap + `--shadow-card`; kategori çipleri (mobilde tek satır yatay kaydırma, kenardaki yarım çip kaydırmayı ima eder), 44px kapsül Yazar / Yıl / Ara alanları (`--c-band` dolgu, kenarlıksız, tek tip ok ve büyüteç SVG'si), "Önizlemeli" çipi, sonuç sayısı (`role="status"`), "Temizle" üçüncül düğme.
- **Kitap ızgarası `.kartlar`**: 2 sütun (<640px), 3 (≥640px), 4 (≥1100px); kartın kendisi `kartlar.css`. Boş durum `.bos-durum`: ortalı, gri, "Temizle" düğmeli.
- **Yazarlar**: beyaz kart + yuvarlak portre (`auto-fill minmax(200px, 1fr)`); hover'da kartın kendisi yükselir. **Yazar sayfası**: okuma genişliğinde (760px) beyaz biyografi kartı, gri kaynak satırı; altında kitap kartları ve "Set ve seriler".
- **Set/seri kartı `.dizi-karti`**: beyaz kart, kare kapak kutusu (görsel taban hizalı, multiply), etiket + ad (21px/600) + gri ek + açıklama; bütün kart tek bağlantıdır.

**Kitap/set detayı `.kitap-detay`**: bloklar dönüşümlüdür: 1. beyaz (kapak + eser bilgisi), 2. bant (künye), 3. beyaz ("Aynı yazardan"), 4. bant ("Bu kitabın dizisi").
- ≥900px iki sütun (sol 330–420px kapak sütunu; yeterince yüksek ekranda `sticky`), altı tek sütun; kitap adı ve yazar ilk ekranda görünsün diye sıra çipler → ad → yazar → kapak sahnesi → eylemler → metin (sütun sarmalayıcıları `display: contents` ile düşürülüp `order` verilir; DOM sırası okuma sırasını korur).
- **Kapak sahnesi**: `--c-band` 28px karo; kapak `perspective` + `rotateY(-7deg) rotateX(1.5deg)` ile durur, `multiply` dönen kapta (§5), kapağın arkasında bulanık temas gölgesi, hover'da düzleşir. Altında tam genişlik **kırmızı CTA** ("WhatsApp'tan sipariş ver"), gri "İlk sayfalara göz at" (`data-onizleme`), küçük gri not.
- **Ön / arka kapak seçicisi** (`.kapak-secici`, yalnız `back_cover` varsa): sahnenin altında iki hap düğme ("Ön kapak" / "Arka kapak", ≥44px, seçili olan `--c-ink` zeminli) ve arka yüzde "Büyüt" bağlantısı. İki yüz aynı ızgara hücresinde üst üste durur (gizli yüz `visibility: hidden`), böylece geçişte sahne yüksekliği oynamaz; arka yüz ters yönde (+7°) eğimlidir. JS yokken seçici gizli kalır, `<noscript>` bağlantısı arka kapağı açar.
- **Sağ sütun**: çipler, başlık (uzunluğa göre üç kademe: 64 → 52 → 44px), gri alt başlık ve yazar (21px), giriş paragrafı 24px/500 (yalnız 80–480 karakterlik ilk paragraf), gövde 19px/1.55, "Takım" kutusu, **"Nereden alınır" `.siparis`** (bant 28px modül: WhatsApp düğmesi + not, çizgili kitapçı satırları ve "›").
- **Künye `.kunye-kart`**: bant bloğunda ortalı beyaz 20px kart; tablo semantiği korunur (`caption` başlık, `th scope="row"` gri 15px, `td` 500, ince satır çizgileri). Boş alanın satırı basılmaz; yazarsız kayıtta "—" satırı yoktur.
- Sayfada iki kırmızı düğme vardır (kapak altı ve "Nereden alınır" içi): aynı eylemin iki konumu; ikincisi sayfa sonuna yakın kullanıcı içindir.

### 4.15 Statik sayfalar `.sayfa`, `.okuma`
Dar okuma sütunu (760px), başlık `clamp(36→64px)/600`; gövdede ilk paragraf 26px/500 giriş, sonra 19px/1.58; `h2` 32px; bağlantılar alt çizgili. Kanal listesi `.kanallar` ve WhatsApp kutusu `.hat` bant zeminli 28px modüllerdir.

### 4.16 Sayfa çevirme önizlemesi `.onizleme` (`flipbook.css`)
Beyaz 28px diyalog (≤1080px, mobilde tam ekran), `::backdrop` bulanık perde. Üst şerit: gri etiket, 21–24px/600 kitap adı, gri yazar, sağda 40px yuvarlak kapat düğmesi; alt çizgi. Sahne `--c-band`, sayfalar beyaz + `--shadow-page`, ortada bulanık cilt gölgesi. Alt şerit: "Önceki/Sonraki" kapsül düğmeleri (≤480px yalnız ok), tabular sayaç, klavye ipucu, not. Esc ve ← → çalışır, odak kapat düğmesine gider ve tetikleyiciye döner. `prefers-reduced-motion` veya hata durumunda dikey beyaz sayfa galerisi (page-flip yüklenmez). Mobil tek sayfa modu, güvenli alanlara saygılı.

### 4.17 Odak, atlama bağlantısı, konum yolu
Odak halkası global: `2px solid #0071e3`, 3px ofset (`:focus-visible`), hiçbir yerde kaldırılmaz; kartlarda halka bağlantının tüm kartı kaplayan `::after` katmanına verilir. Dokunma hedefleri ≥24px (WCAG 2.5.8), birincil simge/düğmeler 40px; Apple'ın 44px önerisine kıyasla üst bar simgeleri (40px) ve "Önizle" rozeti (görünür 27px, isabet alanı daha büyük) bilinçli olarak küçüktür. Atlama bağlantısı `.atla` ilk odaklanabilir öğedir. Konum yolu `.iz` 13px, "›" ayraçlı.

---

## 5. Kapak sunumu

Kapak fotoğrafları beyazımsı (`~#f6f6f6`) zeminli 3B çekimdir. Zemin şu kuralla eritilir:
- `mix-blend-mode: multiply` + `filter: brightness(1.04)`: zemin beyaza/banda karışır, kitap kendi gölgesiyle durur.
- **Dönen/yükselen sarmalayıcıda `multiply` sarmalayıcının KENDİSİNDE durur** (`transform` yalıtılmış katman açar; `img`'de olursa zemin erimez). `multiply` uygulanan öğenin atalarında `z-index`, `opacity`, `filter`, `transform` bulunmamalı (hero kapakları, detay sahnesi).
- Kapak kırpılmaz, üstüne rozet/metin bindirilmez; "Önizle" rozeti kartın altındadır.
- Kapak gölgesi yalnız temas gölgesidir (bulanık elips); mockup zaten kendi gölgesini taşır.

---

## 6. Hareket

Yalnızca `transform`, `opacity`, renk. Süreler: 300ms (`--dur`), 600ms (`--dur-slow`), eğri `cubic-bezier(.22,.61,.36,1)`. Kart ve karo hover'ı −4px; düğme basışı `scale(.97)`; hero kapağı hover'da düzleşir; modal açılışı opacity + 8px. `prefers-reduced-motion: reduce` → tüm süreler 0, hover kayması ve düzleşme yok (kitap detayında kapak eğimi sabit kalır, hero kapağı geçişsiz), önizleme dikey galeriye düşer. Dokunmatikte (`hover: none`) hover yükselmesi uygulanmaz.

---

## 7. Yapılmayacaklar

- Kırmızıyı CTA ve "Önizle" rozeti dışında kullanmak; WhatsApp yeşilini üst bar logosu dışında kullanmak.
- Başlık/etiketlerde büyük harf zorlaması, bölüm numaraları, emoji, gradyan, neon.
- İndirim/kampanya fiyatı ve üstü çizili fiyat (yalnız tek "Liste fiyatı" satırı, ADR-018), "çok satan" rozeti, sahte yorum/istatistik, doğrulanmamış marka bilgisi (kuruluş yılı, ekip).
- Kapağı kırpmak, üstüne etiket bindirmek; `multiply`'ı yalıtılmış katmanın içinde kullanmak.
- Yerleşim özelliği (`width`, `height`, `margin`, `padding`) animasyonu; kendiliğinden kayan karusel; zıplama/ölçek hover'ı.
- Karanlık mod, ikinci font ailesi, üçüncü taraf font isteği (Google Fonts bağımlılığı yoktur).

---

## 8. Dosya düzeni ve sözleşmeler

```
src/assets/css/
  tokens.css      değişkenler (yalnız tanım)
  typography.css  @font-face (Inter), gövde, başlıklar, .etiket, .rakam
  global.css      sıfırlama, .kap/.bolum/.bant, düğme, çip, başlıklar, .iz, üst bar, alt bilgi, statik sayfa, .kanallar, .hat
  kartlar.css     kitap kartı, .sekme, .serit (raf), yazar kartı + yazar ızgarası
  vitrin.css      ana sayfa: slayt, kısayollar, kategori, hikâye+sayılar, satış modülleri (yalnız index.njk yükler)
  katalog.css     katalog, filtre, kitap detayı, künye, yazar/dizi sayfaları (sayfa front matter'ı yükler)
  flipbook.css    önizleme modalı (kitap-onizleme.njk yükler)
  admin.css       yönetim paneli (yalnız /yonetim/)
```
Yükleme sırası: `tokens → typography → global → kartlar → ekstra_css` (`layouts/base.njk`).

Sözleşmeler (bozma):
- **Önizleme tetikleyicisi:** `[data-onizleme="<kitap.id>"]`. Yalnız sayfada o kitabın `<template data-onizleme-kitap>`'i varsa çalışır (aksi hâlde bağlantı olarak davranır). Kart rozeti için `onizleme_tetik = true` verilir.
- **Veri dosyaları:** `src/_data/*.js` yalnızca `export default` taşır; adlandırılmış export Eleventy'de veriyi modül nesnesine çevirir (ADR-011). Yardımcılar `scripts/cms/resolvers.mjs`'tedir.
- **WhatsApp numarası:** `data/site/site.json` (`whatsapp_url`, `whatsapp_url_sablonu`, `telefon_gosterim`).
- Sınıf adları Türkçe BEM (`.kitap-karti__baslik`, `.dugme--birincil`); durumlar `aria-*` ve `.is-acik`.

---

## 9. Anti-şablon kontrolü (ECC design-quality)

| # | Madde | Durum |
|---|---|---|
| 1 | Ölçek karşıtlığıyla hiyerarşi | ✓ 60–72px başlıklar ↔ 13px künye |
| 2 | Kasıtlı boşluk ritmi | ✓ 96px bölüm, 36px başlık boşluğu, bant dönüşümü |
| 3 | Katman/derinlik | ✓ bant ↔ beyaz kart, hover yükselmesi, cam üst bar, modal perdesi |
| 4 | Karakterli tipografi | ✓ Inter 600 sıkı aralık; SF Pro Apple cihazlarda (Inter "yaygın font" uyarısı bilinçli: seçilen Apple dili) |
| 5 | Rengin anlamsal kullanımı | ✓ kırmızı yalnız eylem/rozet; gri hiyerarşi |
| 6 | Tasarlanmış hover/focus/active | ✓ |
| 7 | Izgara kıran kompozisyon | ✓ taşan raflar, perspektifli kapak, iki sütunlu karo |
| 8 | Doku/atmosfer | kısmen (cam şerit, bulanık perde; kâğıt dokusu yok) |
| 9 | Akışı açıklayan hareket | ✓ yükselme "tıklanabilir", modal kaynaktan açılır |
| 10 | Veri görselleştirme | sayılar şeridi (grafik yok) |

---

## 10. Doğrulama komutları

```
npm run build
node scripts/design/kontrast.mjs [--md]     # token kontrastı
npx playwright test                         # e2e (channel: msedge)
node scripts/qa/a11y/denetle.mjs --base http://localhost:8091 --dist dist
node scripts/seo/dogrula.mjs
python -I -X utf8 scripts/qa/dogrula.py --dis-yok
```
