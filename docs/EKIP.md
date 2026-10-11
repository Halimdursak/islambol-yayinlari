# İslambol Yayınları Web Sitesi — Agent Ekibi Tüzüğü

Sürüm: v2 (puanlama sonrası düzeltilmiş) · Tarih: 11 Ekim 2026 · Yönetici: Site Direktörü (Fable 5.1, bu oturum)

## 0. Bitmiş hali neye benziyor

Tek cümle: `adursak63.github.io/islambol-yayinlari` (ya da özel alan adı) altında, 70 civarı kitabın kapak + künye + arka kapak metniyle listelendiği, en az 4 kitapta kapağa dokununca gerçek ilk sayfaların sayfa çevirme efektiyle açıldığı, mobilde kusursuz, Lighthouse 90+ ve WCAG 2.2 AA bir tanıtım sitesi; kaynak kodu GitHub'da, her kitap `data/catalog/books.json`'a tek kayıt eklenerek siteye girer.

Kontrol: Playwright ile 4 kırılma noktasında ekran görüntüsü, her kitap sayfasının 200 dönmesi, JSON'daki her kaydın sitede görünmesi, sayfa çevirmenin dokunma + klavye ile çalışması, Lighthouse raporu.

## 1. Temel kararlar (ADR özeti, ayrıntı: docs/KARARLAR.md)

| Karar | Seçim | Neden |
|---|---|---|
| Çatı | Eleventy 3 + Nunjucks + vanilla JS (ESM), statik çıktı — ADR-009 | Sıfır native modül (bu makinede Uygulama Denetimi native .node'ları engelliyor, ADR-008); JSON → pagination ile 70 sayfa; GitHub Pages'e doğrudan |
| Stil | Saf CSS + design token'ları (`:root` değişkenleri), Tailwind yok | Tasarım karakteri özgün olacak; utility çerçevesi şablon görünümüne iter |
| Sayfa çevirme | `page-flip` (StPageFlip, MIT) — Rakip Analisti doğrulayacak | Vanilla, dokunma desteği, aktif bakım |
| Arama/filtre | İstemci tarafı JSON filtre (yazar, kategori, yıl) | 70 kayıt için arama motoru gereksiz |
| Veri | `data/catalog/books.json` tek doğruluk kaynağı | Kullanıcı sonradan kitap ekleyebilsin |
| Yayın | GitHub Actions → GitHub Pages | Ücretsiz, otomatik |
| Satış | Mağaza YOK; "Nereden alınır" bağlantıları + WhatsApp sipariş CTA | Yayınevi böyle satıyor (0505 980 87 35, kureselkitap, kitapyurdu) |

## 2. Ekip yapısı

```
Site Direktörü (yönetici; plan, entegrasyon, son kapı)
├─ Faz 0 Araştırma
│   ├─ R1 Katalog Toplayıcı
│   ├─ R2 Rakip Analisti
│   └─ R3 Önsöz Avcısı
├─ Faz 1 Tasarım
│   ├─ D1 Marka & Tasarım Sistemi
│   └─ D2 Bilgi Mimarı & İçerik Yazarı
├─ Faz 2 Yapım (yazarlar; dosya sahipliği ayrık)
│   ├─ B1 Çekirdek Frontend
│   ├─ B2 Katalog & Kitap Detay
│   ├─ B3 Sayfa Çevirme Deneyimi
│   ├─ B4 Görsel & Performans
│   └─ B5 SEO & Yapısal Veri
├─ Faz 3 Kalite (üreten ≠ denetleyen)
│   ├─ Q1 Erişilebilirlik Denetçisi
│   ├─ Q2 QA & Görsel Regresyon
│   ├─ Q3 Kod İncelemeci
│   └─ Q4 İçerik Doğrulayıcı
└─ Faz 4 Teslim
    └─ O1 DevOps & Devir Rehberi
```

Toplam 16 rol (1 yönetici + 15 agent). Model dağılımı CLAUDE.md tablosuna göre: zor plan/mimari/inceleme → Fable/Opus; uygulama → Sonnet; mekanik tarama → Haiku.

## 3. Rol kartları

Her kartta: Girdi → Çıktı → Kabul kriteri → Model → Yazma hakkı (dosya sahipliği) → Yasaklar.

### R1 Katalog Toplayıcı — Sonnet — ÇALIŞIYOR
- Girdi: kureselkitap (77), nobelkitap (64), kitapyurdu (39) yayınevi sayfaları + detay sayfaları.
- Çıktı: `data/catalog/books.json`, `data/catalog/authors.json`, `public/kapaklar/*.jpg`, `data/catalog/REPORT.md`, `scripts/katalog/*.py`.
- Kabul: REPORT.md'deki sayılar betikle sayılmış; her kayıtta `title`, `authors`, `cover.local_path` dolu ya da raporda eksik listesinde; uydurma alan yok (`field_sources` dolu).
- Yazma hakkı: yalnızca `data/catalog/**`, `public/kapaklar/**`, `scripts/katalog/**`.
- Yasak: açıklama metni yazmak/yorumlamak; sadece kaynaktan kopyalar.

### R2 Rakip Analisti — Sonnet — ÇALIŞIYOR
- Girdi: 10 TR + 6 dünya yayınevi sitesi + siteinspire.
- Çıktı: `docs/research/rakip-analizi.md`, `docs/research/rakip-ozet.json`, `docs/research/screenshots/*.png`.
- Kabul: özellik matrisi 16+ satır; 3 tasarım yönü önerisi; sayfa çevirme kütüphane karşılaştırması (lisans, boyut, son commit) ve tek öneri.
- Yazma hakkı: `docs/research/**`.

### R3 Önsöz Avcısı — Sonnet — başlatılacak (Direktörün önizleme mekanizması probundan sonra)
- Girdi: `books.json`; Direktörün bulduğu kitapyurdu "İç Sayfalara Gözat" mekanizması; Google Books; yayınevinin X/Instagram/Facebook gönderileri.
- Çıktı: `data/catalog/onsoz/<slug>.json` → `{book_id, source_url, source_type: "kitapyurdu-preview|google-books|social|manual", pages: [{index, image_url|text}], rights_note}`; en az 4 vitrin kitabı için ilk 6-10 sayfa.
- Kabul: her sayfa için kaynak URL; metin OCR ise `ocr: true` ve düzeltilmemiş/düzeltilmiş ikisi de saklı; kaynak bulunamayan kitap listesi raporda.
- Yazma hakkı: `data/catalog/onsoz/**`, `public/onsoz/**`, `scripts/onsoz/**`.
- Plan B: metin bulunamazsa sayfa görselleri doğrudan flipbook'ta kullanılır (görsel = kabul edilebilir); o da yoksa kitap "önizleme yok" olarak işaretlenir, asla uydurma metin konmaz.

### D1 Marka & Tasarım Sistemi — Opus (Direktör gözetiminde)
- Girdi: rakip-analizi.md'deki 3 yön; `open-design/design-systems/warm-editorial/DESIGN.md` (yapısal temel; diğer adaylar jenerik çıktı); logo (`public/logo/`: antrasit wordmark + kırmızı fes/yayınları); yayınevi karakteri (yakın tarih, arşiv belgesi, hatırat, Osmanlıca kapaklar).
- Çıktı: `DESIGN.md` (palet hex + OKLCH, tipografi çifti + yükleme stratejisi, spacing ölçeği, bileşen envanteri, hareket ilkeleri, karanlık mod kararı), `src/assets/css/tokens.css`.
- Kabul: kontrast oranları AA; 2 font ailesi ile sınırlı; "anti-template" kontrol listesi (ECC design-quality) 10 maddeden en az 6'sı işaretli; tokens.css tek başına derlenebilir.
- Yazma hakkı: `DESIGN.md`, `src/assets/css/tokens.css`, `src/assets/css/typography.css`, `src/assets/fonts/**`, `docs/design/**`, `scripts/design/**`.

### D2 Bilgi Mimarı & İçerik Yazarı — Sonnet
- Girdi: books.json, authors.json, rakip-analizi.md, yayınevinin sosyal medya tonu.
- Çıktı: `docs/SITE-HARITASI.md` (sayfa listesi, her sayfanın amacı, URL, birincil CTA), `data/site/sayfalar/*.md` (Hakkımızda, Yayın çizgisi, Nereden alınır, İletişim, Önizleme hakkında, KVKK/çerez metni, 404), `data/site/site.json` (iletişim, sosyal, satış kanalları, slogan, menü), `data/site/meta.json` (her sayfa için `<title>` + meta description), `data/site/sozluk.json` (kategori ve dizi adları, slug, tek cümle açıklama), `data/site/mikrometin.json` (düğme/etiket/boş durum/flipbook metinleri).
- Kabul: Türkçe imla (TDK), 60 karakter altı başlıklar, 155 karakter altı meta; yayınevi hakkında kaynaksız iddia yok (kuruluş yılı gibi bilinmeyenler "—" bırakılır ve kullanıcıya sorulur).
- Yazma hakkı: `docs/SITE-HARITASI.md`, `data/site/**`. (B1 bunları `src/_data/site.js` yükleyicisiyle okur.)

### B1 Çekirdek Frontend — Sonnet
- Girdi: DESIGN.md, tokens.css, SITE-HARITASI.md.
- Çıktı: Eleventy iskeleti (`eleventy.config.js`, `package.json` — Direktör kurdu, B1 geliştirir), `src/_includes/layouts/base.njk`, `src/_includes/components/{header,footer,nav,button,section}.njk`, ana sayfa `src/index.njk` (hero, vitrin, yazarlar, yayın çizgisi, nereden alınır, bülten yerine WhatsApp CTA), statik sayfalar `src/{hakkimizda,iletisim,nereden-alinir}.njk`.
- Kabul: `npm run build` sıfır hata (Eleventy, bu makinede çalıştığı doğrulandı); 320–1920 arası yatay kaydırma yok; header mobilde erişilebilir menü; reduced-motion saygı.
- Yazma hakkı (Q3 düzeltmesiyle tamamlandı): statik sayfalar `src/{hakkimizda,yayin-cizgisi,nereden-alinir,iletisim,onizleme-hakkinda,kvkk-ve-cerezler,404}.njk`, kök yapılandırma, `src/_includes/layouts/**`, `src/_includes/components/**` (B2'nin `kitap/`, B3'ün `onizleme/`, B4'ün `kapak-gorseli.njk`, B5'in `seo.njk` hariç), `src/index.njk`, `src/{hakkimizda,iletisim,nereden-alinir}.njk`, `src/assets/css/global.css`, `src/assets/js/site.js`.

### B2 Katalog & Kitap Detay — Sonnet
- Girdi: books.json, authors.json, B1 bileşenleri.
- Çıktı: `src/_data/books.js` ve `src/_data/authors.js` (data/catalog JSON'unu okur, `ajv` ile `data/catalog/books.schema.json`'a göre doğrular, hata varsa build'i düşürür), `src/kitaplar.njk` (ızgara + filtre), `src/kitap.njk` (pagination size 1 → `/kitap/<id>/`), `src/yazarlar.njk`, `src/yazar.njk` (pagination), `src/dizi.njk`, `src/_includes/components/kitap/{kitap-karti,kunye-tablosu,filtre,yazar-karti}.njk`, `src/assets/js/filtre.js`.
- Kabul: JSON'daki her kitap için sayfa üretilir (build sonrası dosya sayısı = kayıt sayısı); null alan boş yerine gizlenir; set kitaplar "takım" rozetiyle; "Nereden alınır" her kitapta kaynak URL'leriyle.
- Yazma hakkı: yukarıdaki dosyalar + `src/_includes/components/kitap/**`, `data/catalog/books.schema.json`.

### B3 Sayfa Çevirme Deneyimi — Sonnet
- Girdi: R3 önsöz verisi, R2'nin kütüphane önerisi, DESIGN.md hareket ilkeleri.
- Çıktı: `src/_includes/components/onizleme/{kitap-onizleme,flipbook}.njk`, `src/assets/js/flipbook.js` (ESM; `/assets/vendor/page-flip.module.js` dinamik import), kapağa tıkla → modal → sayfa çevir; dokunma, fare sürükleme, klavye ok tuşları, kapatma (Esc), odak tuzağı; `prefers-reduced-motion` için kaydırmalı sade görünüm.
- Kabul: 375px'te dokunarak çevrilir; klavyeyle tamamen kullanılır; kütüphane dinamik import (ana sayfa paketine girmez); önizlemesi olmayan kitapta buton görünmez.
- Yazma hakkı: `src/_includes/components/onizleme/**`, `src/assets/js/flipbook.js`, `src/assets/css/flipbook.css`.

### B4 Görsel & Performans — Sonnet
- Girdi: `public/kapaklar/*`, build çıktısı.
- Çıktı: `scripts/gorsel/optimize.mjs` (sharp: webp+avif, 3 boyut, srcset), (kapak bileşeni B2'nin `components/kitap/kapak.njk` makrosudur; B4 yalnızca manifest üretir: `data/catalog/{kapaklar-opt,onsoz-opt,og}.json`), favicon seti ve `site.webmanifest`, OG görseli üretimi (`public/og/*.png`), favicon seti, `docs/PERFORMANS.md` (Lighthouse önce/sonra).
- Kabul: LCP < 2.5s (yerel Lighthouse, mobil), CLS < 0.1, her görselde width/height, toplam ana sayfa JS < 50 KB gz.
- Yazma hakkı: `scripts/gorsel/**`, `public/kapaklar-opt/**`, `public/og/**`, `src/_includes/components/kapak-gorseli.njk`, `docs/PERFORMANS.md`.

### B5 SEO & Yapısal Veri — Sonnet
- Girdi: SITE-HARITASI.md, books.json.
- Çıktı: `src/_includes/components/seo.njk` (title/meta/canonical/OG/Twitter), JSON-LD: Organization, WebSite, Book (ISBN, author, publisher), Person, BreadcrumbList; `src/sitemap.njk` (tüm sayfalar), `public/robots.txt`; `docs/SEO.md`.
- Kabul: Google Rich Results testi geçer (schema doğrulayıcı betikle); her sayfada benzersiz title; sitemap kayıt sayısı = sayfa sayısı.
- Yazma hakkı: `src/_includes/components/seo.njk`, `src/sitemap.njk`, `public/robots.txt`, `docs/SEO.md`, `scripts/seo/**`.

### Q1 Erişilebilirlik Denetçisi — Sonnet (a11y-architect agent)
- Girdi: build çıktısı, yerel sunucu.
- Çıktı: `docs/qa/A11Y.md` (axe + klavye + ekran okuyucu senaryoları, kontrast tablosu), düzeltme listesi (B1-B3'e yönlendirilir; kendisi kod yazmaz).
- Kabul: axe kritik/ciddi 0; tüm etkileşimler klavyeyle; flipbook modalında odak tuzağı doğrulanmış.
- Yazma hakkı: `docs/qa/A11Y.md`, `docs/qa/a11y/**`, `scripts/qa/a11y/**`.

### Q2 QA & Görsel Regresyon — Sonnet (e2e-runner agent)
- Girdi: build çıktısı. Playwright bu makinede `channel: 'msedge'` ile çalışır (bundled Chromium engelli, ADR-008).
- Çıktı: `tests/e2e/*.spec.ts` (Playwright), `docs/qa/screenshots/{320,768,1024,1440}/*.png`, `docs/qa/QA-RAPORU.md` (kırık link, konsol hatası, 404, JSON-sayfa eşleşmesi).
- Kabul: tüm testler yeşil; her kitap sayfası 200; konsolda hata 0; ekran görüntüleri raporda gömülü.
- Yazma hakkı: `tests/**`, `docs/qa/**` (A11Y.md hariç).

### Q3 Kod İncelemeci — Opus (code-reviewer agent)
- Girdi: tüm `src/**`, `scripts/**`.
- Çıktı: `docs/qa/KOD-INCELEME.md` — CRITICAL/HIGH/MEDIUM/LOW; güvenlik (XSS: JSON'dan gelen metin `set:html` ile basılmıyor mu), 50 satır/800 satır kuralları, ölü kod.
- Kabul: CRITICAL 0, HIGH 0 (düzeltme ilgili B rolüne geri gider).
- Yazma hakkı: `docs/qa/KOD-INCELEME.md` yalnızca.

### Q4 İçerik Doğrulayıcı — Haiku
- Girdi: books.json, build edilmiş HTML.
- Çıktı: `docs/qa/ICERIK-DOGRULAMA.md` — her kitap için başlık/yazar/ISBN sitede JSON ile birebir mi (betik), Türkçe karakter bozulması var mı, kaynak linkleri 200 dönüyor mu.
- Kabul: uyumsuzluk 0 ya da her biri gerekçeli.
- Yazma hakkı: `docs/qa/ICERIK-DOGRULAMA.md`, `scripts/qa/dogrula.py`.

### O1 DevOps & Devir Rehberi — Sonnet
- Girdi: çalışan build.
- Çıktı: `.github/workflows/deploy.yml` (Pages; `npm ci && npm run build`, artifact `dist/`), `README.md` (Windows Uygulama Denetimi notu: ADR-008) (kurulum, geliştirme, yeni kitap ekleme adım adım, önsöz ekleme, kapak kuralları), `CONTRIBUTING.md`, `.gitignore`, `.editorconfig`, `LICENSE` notu (içerik telifi yayınevine ait).
- Kabul: temiz klonda `npm ci && npm run build` geçer; README'deki "yeni kitap ekle" adımları Q4 tarafından bir sahte kayıtla denenmiş.
- Yazma hakkı: `.github/**`, `README.md`, `CONTRIBUTING.md`, `.gitignore`, `.editorconfig`.

### Site Direktörü — Fable 5.1 (bu oturum)
- Plan, kararlar, ekip puanlama, her fazın kapı kontrolü, entegrasyon çakışması çözümü, kullanıcıya rapor.
- `scripts/qa/sunucu.mjs`, `scripts/arastirma/**`, `scripts/gorsel/orijinal-kucult.mjs` (bakım betikleri) Direktör'e aittir.
- Entegrasyon katmanının sahibi (B1–B5 paralel çalışabilsin diye Direktör yazdı): `src/_data/**` (books/authors/diziler/vitrin/sayfalar/site/kapaklar yükleyicileri, ajv doğrulama, [[SORU]] ayıklama), `data/catalog/books.schema.json` (B2 genişletebilir), `data/site/vitrin.json` (ana sayfa vitrin kararı; 3 kitap editoryal olarak vitrin dışı), `src/_includes/layouts/base.njk` iskeleti ve sözleşmeleri (B1 geliştirir).
- Son kapı kontrol listesi: (1) Aşama-1 "bitmiş hali" cümlesiyle karşılaştır, (2) Q1-Q4 raporları yeşil, (3) kendi gözüyle 4 kırılma noktasında ekran görüntüsü okur, (4) flipbook'u tarayıcıda kendisi çevirir, (5) temiz klon build.

## 4. Bağımlılık grafiği (DAG)

```
R1 ─┬─▶ D2 ─▶ B1 ─▶ B2 ─▶ Q2
    ├─▶ B2             ├─▶ Q4
    └─▶ R3 ─▶ B3 ─────┤
R2 ─▶ D1 ─▶ B1        ├─▶ Q1
            B4 ◀──────┤   (B4 build çıktısına bağlı)
            B5 ◀── D2 ┘
Q1,Q2,Q3,Q4 ─▶ düzeltme turu (B*) ─▶ O1 ─▶ Direktör son kapı
```

Paralel koşabilenler: {R1, R2} · {D1, D2} (R1/R2 bitince) · {B2, B3, B5} (B1 bitince) · {Q1, Q2, Q3, Q4} (B* bitince).

## 5. Ortak kurallar (her role aynen verilir)

1. Uydurma yok. Kaynağı olmayan veri null kalır, raporda sayılır.
2. Dosya sahipliği: kartındaki yollar dışına yazma. Başkasının dosyasında değişiklik gerekiyorsa raporda "öneri" olarak yaz.
3. Her rol bitişte: ne yaptı, neyi doğruladı (komut + çıktı), neyi doğrulayamadı, şüpheleri.
4. Türkçe karakter ve imla korunur; UTF-8.
5. Kullanıcı verisi toplayan form yok (bülten yok, yorum yok) → KVKK yükü minimum; sadece WhatsApp/mail bağlantısı.
6. Kapak ve metin telifi yayınevine aittir; site onlar adına yapılıyor. Rakip ekran görüntüleri yalnızca iç araştırma içindir, siteye konmaz.
7. 3+ tekrar eden iş betikle yapılır; betik repo'ya girer.
8. Git: her faz sonunda Direktör commit eder (conventional commits); agent'lar commit etmez.

## 6. Riskler ve Plan B

| Risk | Olasılık | Plan B |
|---|---|---|
| Önsöz/ilk sayfa metni bulunamıyor | Orta | Sayfa görselleri flipbook'ta kullanılır; o da yoksa kitap önizlemesiz işaretlenir |
| Kitapyurdu önizlemesi bot duvarı arkasında | Orta | Tarayıcı otomasyonu (Playwright) ile görsel URL'leri alınır; olmazsa kullanıcıdan PDF istenir |
| gh GitHub'a giriş yapmamış | Kesin (şu an) | Yerel repo + hazır workflow; kullanıcı `gh auth login` sonrası tek komutla push |
| Yayınevi hakkında kuruluş yılı/ekip bilgisi yok | Yüksek | "Hakkımızda" sosyal medya tonundan yazılır, bilinmeyenler kullanıcıya tek soru ile sorulur; uydurulmaz |
| Kapak görselleri düşük çözünürlük | Orta | En iyi kaynağı seç; B4 yükseltme yapmaz, raporda listeler; kullanıcıdan orijinal istenir |
| Setler/takımlar (4 cilt) tekil kitaplarla karışır | Orta | `is_set` + `set_items`; set sayfası ciltleri listeler |
| Stok/fiyat bilgisi eskir | Yüksek | Site fiyat göstermez; "Nereden alınır" bağlantıları + liste fiyatı "kaynak tarihli" etiketle isteğe bağlı |

## 7. Puanlama (10 kriter × 1 puan)

| # | Kriter | v1 | v2 | v1'de eksik olan ve v2'de düzeltilen |
|---|---|---|---|---|
| 1 | Her kullanıcı isteği bir role eşleniyor | 1 | 1 | — |
| 2 | Girdi/çıktı/DAG tanımlı, döngü yok | 1 | 1 | — |
| 3 | İki yazar aynı dosyaya dokunmuyor | 0 | 1 | v1'de B1 ve B2 ikisi de `src/components/**` sahibiydi; v2'de B2 `src/components/kitap/**`, B3 `src/components/onizleme/**`, B4 tek bileşen; B1 kalan |
| 4 | Kabul kriterleri ölçülebilir | 0 | 1 | v1'de "profesyonel görünsün" gibi ölçülemez ifadeler vardı; v2'de her kart sayı/komut/test ile |
| 5 | Model/maliyet dağılımı doğru | 1 | 1 | — (Q4 Haiku, inceleme Opus, uygulama Sonnet) |
| 6 | Üreten ≠ denetleyen | 1 | 1 | — |
| 7 | Uydurma yasağı her rolde | 0 | 1 | v1'de yalnızca R1'de vardı; v2'de ortak kural 1 + D2'ye "bilinmeyeni sor" + R3'e Plan B |
| 8 | En büyük riskler için Plan B | 0 | 1 | v1'de risk tablosu yoktu; v2 bölüm 6 |
| 9 | Kullanıcıya görünürlük (ara teslim, ekran görüntüsü) | 1 | 1 | — (Q2 ekran görüntüleri, faz sonu commit + rapor) |
| 10 | Bakım devri (kullanıcı tek başına kitap ekleyebilir) | 0 | 1 | v1'de README genel; v2'de O1 "yeni kitap ekle" adımları Q4 tarafından sahte kayıtla denenir |

v1: 6/10 → v2: 10/10. Puanlama Direktör tarafından yapıldı; bağımsız ikinci görüş için Q3 (code-reviewer) teslimde tüzüğe de bakacak.

## 8. Dağıtım sırası

1. (Şimdi) R1, R2 koşuyor. Direktör önizleme mekanizmasını probluyor → R3 başlar.
2. R1+R2 bitince: D1 (Direktör + Opus), D2 (Sonnet) paralel.
3. D1+D2 bitince: B1.
4. B1 bitince: B2, B3, B5 paralel; B4 B2'den sonra.
5. B* bitince: Q1–Q4 paralel; bulgular ilgili B'ye döner; tek düzeltme turu.
6. O1; Direktör son kapı; commit; kullanıcıya rapor + `gh auth login` sonrası push talimatı.
