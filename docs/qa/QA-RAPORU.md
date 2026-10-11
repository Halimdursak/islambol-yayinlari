# QA ve Görsel Regresyon Raporu (Q2)

Tarih: 2026-10-12 · Araç: Playwright 1.64, `channel: 'msedge'` · Hedef: Direktör düzeltme turu sonrası `npm run build` çıktısı (`dist/`: 133 dosya, 132 HTML; 78 kitap, 36 yazar, 5 dizi sayfası; sitemap 131 URL).

## Komut

```
npm run build
npx playwright test          # webServer: node scripts/qa/sunucu.mjs --dir dist --port 8092 (reuseExistingServer)
```

İsteğe bağlı ortam değişkenleri: `QA_DIST` (varsayılan `dist`), `QA_PORT` (varsayılan `8092`). HTML rapor: `playwright-report/`. Koşu süresi ≈ 3,5 dk (4 işçi).

## Sonuç

| Proje | Geçen | Kalan | Atlanan | Toplam |
|---|---|---|---|---|
| masaustu (1440×900) | 343 | 0 | 1 | 344 |
| mobil (390×844, dokunmatik) | 163 | 0 | 1 | 164 |
| **Toplam** | **506** | **0** | **2** | **508** |

Atlananlar tasarım gereğidir: ArrowRight/Escape testi yalnız masaüstünde, "Sonraki sayfa" dokunma testi yalnız mobilde koşar (her biri öbür projede atlanır). **Tüm testler yeşil.**

Kapsam: `sayfalar` (sitemap'teki her URL 200; olmayan yol 404; 132 sayfa × 2 proje: tek `<h1>`, `<title>`, konsol/istek hatası, kırık görsel), `katalog` (kart sayısı = 78, kategori süzgeci + URL, "halife" araması, boş durum, JS kapalı = 78 kart), `kitap` (10 örnek: ilk, son, en uzun başlık, 2 set, 3 önizlemeli, yazarsız; 78 kitap ve 36 yazar kaydı ↔ sayfa eşleşmesi; fiyat taraması), `onizleme` (açılış, 1 / 10, ArrowRight, Escape + odak, mobil dokunma 2 / 10, page-flip tıklamadan önce yok/sonra var, reduced-motion galeri, ana sayfa hero), `baglantilar` (Node: iç href/src/srcset/çapa, dış HEAD), `gorsel` (4 genişlik × 11 sayfa), `gorsel-ekstra` (önizleme açık, koyu tema), `seo` (132 sayfa: 1 canonical kendine işaret eder, 1 description, JSON-LD parse, kitapta `Book`; sitemap XML; robots).

## Engelleyici

**0.** Kalan test yok. (Önceki koşuda sitemap'te yalnız 13 URL vardı; Direktör düzeltmesinden sonra 131 URL ve test yeşil.)

## Konsol hataları

132 sayfa × 2 proje + önizleme akışları: `console.error`, yakalanmamış istisna, başarısız alt kaynak isteği = **0**. Web fontları artık yükleniyor (ekran görüntülerinde Garamond/Plex tipografisi görünüyor).

## Kırık bağlantılar

- İç `href` (a, link), iç `src`/`srcset`, sayfa içi `#çapa`: **0** kırık.
- Kırık görsel (sayfa sonuna kaydırılıp `networkidle` sonrası `naturalWidth === 0`): **0**.
- JSON ↔ sayfa: 78/78 kitap, 36/36 yazar; fazla veya eksik sayfa yok.
- Fiyat (`/\d+\s*TL\b/i`) 78 kitap sayfasının görünür metninde: **0**.
- Dış bağlantılar (alan adı başına bir örnek, HEAD; 9 alan adı): wa.me 200, kureselkitap.com 200, nobelkitap.com 200, hepsiburada.com 200, x.com 200, instagram.com 200, facebook.com 200, ravzakitap.com 200; **kitapyurdu.com 403 → doğrulanamadı** (bot koruması; kırık sayılmadı). Kitap bazlı Kitapyurdu bağlantıları tek tek denenmedi.

## Yatay kaydırma (scrollWidth ≤ innerWidth)

`html`/`body` `overflow-x: visible` olduğundan ölçüm anlamlıdır. 50 ölçümün hiçbirinde taşma yok.

| Sayfa | 320 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| ana-sayfa | ok | ok | ok | ok |
| kitaplar | ok | ok | ok | ok |
| kitap/sen-neden-kor-edildin | ok | ok | ok | ok |
| kitap/hayat-ve-hatiratim | ok | ok | ok | ok |
| yazarlar | ok | ok | ok | ok |
| yazar/cevat-rifat-atilhan | ok | ok | ok | ok |
| diziler | ok | ok | ok | ok |
| hakkimizda | ok | ok | ok | ok |
| nereden-alinir | ok | ok | ok | ok |
| iletisim | ok | ok | ok | ok |
| 404 | ok | ok | ok | ok |

Ek ölçümler (hepsi ok): önizleme açık 1440/390; koyu tema ana sayfa ve kitap 1440/390 (koyu temada gövde arka planı gerçekten koyu).

## Ekran görüntüleri (50)

- `docs/qa/screenshots/{320,768,1024,1440}/<ad>.png` (44): `ana-sayfa, kitaplar, kitap-sen-neden-kor-edildin, kitap-hayat-ve-hatiratim, yazarlar, yazar-cevat-rifat-atilhan, diziler, hakkimizda, nereden-alinir, iletisim, 404`
- `docs/qa/screenshots/onizleme/{1440,390}-sen-neden-kor-edildin.png`
- `docs/qa/screenshots/koyu/{1440,390}/{ana-sayfa,kitap-sen-neden-kor-edildin}.png`

## Gözle inceleme

Yeni koşudan açılanlar: `1440/kitap-sen-neden-kor-edildin`, `320/ana-sayfa`; önceki koşudan (düzeltme öncesi, bulgular geçerliliğini korudu): `1440/ana-sayfa`, `320/kitap-sen-neden-kor-edildin`, `onizleme/1440-…`, `onizleme/390-…`, `koyu/390/ana-sayfa`, `768/kitaplar`.

- Kitap 1440: kapak, başlık, tam açıklama, künye ve "Nereden alınır" kutusu düzenli, metin okunur, fiyat yok. Gözlem (düşük): sol sütun kapak altında boş kalıyor ve künye/bloktan sonra footer'a kadar ~150 px boşluk var — **B1** (kozmetik).
- Ana sayfa 320: tek sütun, kapak ve kartlar yüklü, taşma yok; yazarlar bölümü okunaklı.
- Önizleme 1440/390: kapak sayfası, "1 / 10" sayacı, düğmeler doğru; 390'da önceki/sonraki yalnız ikon, dokunma hedefi yeterli.
- Koyu 390: kontrast okunur, kapak zeminleri uyumlu (görüntü küçültülmüş; ince tipografi ayrıntısı doğrulanamadı).
- Katalog 768: 2 sütunlu ızgara düzenli; sayfa ≈16 000 px (78 kayıt tek sayfa, tasarım kararı).
- Ana sayfa 1440 (önceki koşu): "Yayın çizgisi" bölümünde metin sütunu sağa kaymış, solda geniş boşluk — **B1** (gözlem, tasarım tercihi olabilir; yeni koşuda tekrar açılmadı).

## En önemli bulgular

1. Engelleyici yok; 506/506 çalışan test yeşil.
2. Kitapyurdu dış bağlantıları 403 (bot koruması) — doğrulanamadı; elle kontrol — Q4.
3. `books.json` içinde 2 kayıtta `\d+ TL` benzeri metin var; sayfalara yansımıyor, şablon değişirse sızar — Direktör (veri katmanı).
4. Kitap sayfası masaüstü: sol sütun boş ve alt boşluk (kozmetik) — B1.
5. Ana sayfa "Yayın çizgisi" bölüm hizası (gözlem) — B1.

## Doğrulayamadıklarım

- Yalnız Edge (Chromium); Firefox/Safari yok.
- Görsel regresyon taraması + ölçümdür; piksel karşılaştırmalı baseline henüz yok (bu koşu baseline olabilir).
- Alt dizin (`PATH_PREFIX`) yapısı bu koşuda sınanmadı.
