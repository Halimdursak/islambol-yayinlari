# İslambol Yayınları — Tanıtım ve Katalog Sitesi

İslambol Yayınları'nın kitaplarını, yazarlarını ve ilk sayfalarını (önizleme) tanıtan statik web sitesi.

## İçindekiler

1. [Proje nedir](#proje-nedir)
2. [Canlı adres ve yayın akışı](#canlı-adres-ve-yayın-akışı)
3. [Hızlı başlangıç](#hızlı-başlangıç)
4. [Windows'ta native modül engeli](#windowsta-native-modül-engeli)
5. [Proje yapısı](#proje-yapısı)
6. [Veri modeli](#veri-modeli)
7. [Yeni kitap ekleme — adım adım](#yeni-kitap-ekleme--adım-adım)
8. [Önizleme (iç sayfalar) ekleme](#önizleme-iç-sayfalar-ekleme)
9. [Vitrin düzenleme](#vitrin-düzenleme)
10. [Site metinlerini düzenleme](#site-metinlerini-düzenleme)
11. [Tasarım](#tasarım)
12. [SEO](#seo)
13. [QA komutları](#qa-komutları)
14. [GitHub'a yayınlama](#githuba-yayınlama)
15. [Telif ve lisans](#telif-ve-lisans)
16. [Ekip ve kararlar](#ekip-ve-kararlar)
17. [Bilinen sınırlar](#bilinen-sınırlar)

---

## Proje nedir

Bu bir **tanıtım ve katalog sitesidir, mağaza değildir** (ADR-001). Sepet, ödeme, üyelik, çerez ve fiyat yoktur. Her kitap sayfasında kitabın künyesi, tanıtım metni, varsa ilk sayfaları (kapağa dokununca sayfa çevirme efektiyle açılan önizleme) ve "nereden alınır" bağlantıları (Küresel Kitap, Kitapyurdu, Hepsiburada, Trendyol) ile kitap adı önceden doldurulmuş bir WhatsApp sipariş bağlantısı bulunur. Satış, yayınevinin mevcut kanallarında gerçekleşir.

Teknik olarak: **Eleventy 3** (Nunjucks şablonları), saf CSS (tasarım token'ları), sayfa çevirme için `page-flip` kütüphanesi. Tüm içerik JSON ve Markdown dosyalarından derlenir; sunucu tarafı kod yoktur. Çıktı `dist/` klasörüne yazılan düz HTML/CSS/JS'tir.

## Canlı adres ve yayın akışı

- Yayın adresi: **https://islambol.org** (GitHub Pages + özel alan adı, kökte yayın; kurulum: [Özel alan adı](#özel-alan-adı-islambolorg)). Alan adı bağlanana kadar geçici adres: https://halimdursak.github.io/islambol-yayinlari/ (bu adreste alt dizin öneki gerekir, bkz. aşağı). Depo: https://github.com/Halimdursak/islambol-yayinlari.
- `main` dalına her `git push` → GitHub Actions (`.github/workflows/deploy.yml`) siteyi derler (`npm ci && npm run build`) ve Pages'e yayınlar. Tipik süre 1-2 dakika.
- Elle yayın: GitHub'da depo → **Actions → "Pages'e yayınla" → Run workflow**.
- Pull request ve diğer dallarda `ci.yml` çalışır: derleme + SEO denetimi (yayın yapmaz).
- Alt dizin ayarı ortam değişkenleriyle yapılır: `PATH_PREFIX` (yerelde ve özel alan adında `/`) ve `SITE_URL` (kanonik/OG adreslerinde kullanılır). Workflow dosyalarında bunlar `/` ve `https://islambol.org` olarak ayarlıdır (ADR-016). Geçici olarak `halimdursak.github.io/islambol-yayinlari/` adresinden yayın gerekirse bu ikisi `/islambol-yayinlari/` ve `https://halimdursak.github.io/islambol-yayinlari` yapılır.

## Hızlı başlangıç

Gereksinim: **Node.js 22 veya üzeri** (yerelde Node 24 kullanılıyor). Python 3 yalnızca katalog/önsöz betikleri ve içerik doğrulaması için gerekir.

```bash
npm ci               # bağımlılıkları kurar (package-lock.json'a birebir uyar)
npm run dev          # geliştirme sunucusu, http://localhost:8080 (değişiklikte otomatik yeniler)
npm run build        # üretim derlemesi → dist/
npm run serve        # dist/ klasörünü http://localhost:8090 adresinde sunar (QA sunucusu)
node scripts/qa/sunucu.mjs --dir dist --port 8090   # npm run serve ile aynı
```

Notlar:

- `npm run dev` ve `npm run build` varsayılan olarak `PATH_PREFIX=/` ile çalışır; yerelde alt dizin yoktur. GitHub Pages benzeri alt dizini denemek için: `PATH_PREFIX=/islambol-yayinlari/ npm run build` ve `node scripts/qa/sunucu.mjs --dir dist --port 8090 --prefix /islambol-yayinlari/`.
- **Git Bash uyarısı (Windows):** Git Bash `PATH_PREFIX=/islambol-yayinlari/` gibi `/` ile başlayan ortam değişkenini `C:/Program Files/Git/...` yoluna çevirip bağlantıları bozar. Git Bash'te `MSYS_NO_PATHCONV=1 PATH_PREFIX=/islambol-yayinlari/ npm run build` yazın; PowerShell'de `$env:PATH_PREFIX='/islambol-yayinlari/'; npm run build`. Linux/CI'da sorun yoktur. Alt dizin sunumu: `npm run serve -- --prefix /islambol-yayinlari/`.
- `npm run build` sırasında `data/catalog/books.json` şemaya karşı doğrulanır (Ajv). Şemaya uymayan kayıt build'i durdurur ve hatayı yazar.
- Build sonunda `[sayfalar] N [[SORU]] işareti yayından ayıklandı` satırı normaldir (bkz. [Site metinlerini düzenleme](#site-metinlerini-düzenleme)).

## Windows'ta native modül engeli

**ADR-008 / ADR-009.** Bu geliştirme makinesinde Windows **Uygulama Denetimi** (Smart App Control / WDAC) ilkesi imzasız native `.node` modüllerinin yüklenmesini engeller.

- **Belirti:** `ERR_DLOPEN_FAILED: Uygulama Denetimi ilkesi bu dosyayı engelledi.` (ya da aynı anlamda İngilizce metin) ve çoğunlukla `esbuild.exe`, `rolldown`, `sharp` gibi paketlerin `.node`/`.exe` dosyaları için.
- **Sebep:** Vite/Astro/rolldown/esbuild tabanlı araç zincirleri yüklemede native ikili dosyalara dayanır; ilke bunları reddeder.
- **Çözüm (uygulanan):**
  - Site oluşturucusu **Eleventy 3**'tür: saf JavaScript, sıfır native modül (Astro 7 bu yüzden bırakıldı, ADR-009).
  - Görsel optimizasyonunda **sharp**, native yerine WebAssembly yedeğini (`@img/sharp-wasm32`) kullanır; `npm run gorsel` bu makinede çalışır (biraz yavaş).
  - **Playwright** testleri paketle gelen Chromium yerine sistemdeki imzalı **Microsoft Edge**'i kullanır: `playwright.config.ts` içinde `channel: 'msedge'`.
  - **Sistem güvenlik ayarlarına dokunulmaz.** Ilkeyi kapatmak, istisna eklemek ya da Geliştirici Modu açmak çözüm değildir ve önerilmez.
- **CI (GitHub Actions, Linux)** bu sorundan etkilenmez; aynı komutlar (`npm ci && npm run build`) standart ortamda çalışır. Sorun yalnızca bu geliştirme makinesine özgüdür.
- Yeni bir bağımlılık eklemeden önce `.node`/`.exe` içerip içermediğine bakın (`npm ls` + `node_modules` içinde `*.node` araması). Native bağımlılık eklenirse build bu makinede kırılabilir.

## Proje yapısı

```text
.
├── .github/workflows/     CI/CD: deploy.yml (Pages yayını), ci.yml (derleme + SEO denetimi)
├── data/
│   ├── catalog/           KATALOG VERİSİ: books.json (tek doğruluk kaynağı), books.schema.json, authors.json,
│   │                      onsoz/ (önizleme meta verisi), *-opt.json (görsel manifestleri; npm run gorsel üretir), REPORT.md
│   ├── site/              SİTE METİNLERİ: site.json, meta.json, sozluk.json, mikrometin.json, vitrin.json, sayfalar/*.md
│   ├── raw/               Katalog toplama ham verisi/önbelleği (betikler yazar; yayına girmez)
│   └── research/          Araştırma notları
├── docs/                  EKIP.md (ekip tüzüğü), KARARLAR.md (ADR'ler), SITE-HARITASI.md, SEO.md, PERFORMANS.md, design/, qa/, research/
├── public/                Statik dosyalar, build'de dist/ köküne olduğu gibi kopyalanır
│   ├── kapaklar/          Kitap kapakları (orijinal, ≤1600 px): <id>.jpg
│   ├── kapaklar-opt/      Optimize kapak boyutları (webp/jpg; npm run gorsel üretir)
│   ├── onsoz/             Önizleme sayfaları: <slug>/01.jpg, 02.jpg ...
│   ├── onsoz-opt/         Optimize önizleme sayfaları (npm run gorsel üretir)
│   ├── og/                Paylaşım (Open Graph) görselleri, 1200x630
│   ├── logo/, favicon*, site.webmanifest, robots.txt
├── scripts/
│   ├── gorsel/            Görsel hattı: optimize.mjs (npm run gorsel), orijinal-kucult.mjs, kapak.mjs, marka.mjs
│   ├── katalog/           Kitap verisi toplama (Python; README.md'ye bakın)
│   ├── onsoz/             Kitapyurdu "iç sayfalara gözat" toplayıcı (Python; README.md'ye bakın)
│   ├── qa/                sunucu.mjs (dist/ sunucusu), dogrula.py (içerik doğrulaması, varsa), a11y/
│   ├── seo/               dogrula.mjs (dist/ SEO denetimi)
│   └── design/            Kontrast ve style-tile araçları
├── src/
│   ├── _data/             Veri yükleyicileri (books, authors, diziler, vitrin, sayfalar, site, kapaklar); JSON → şablon verisi, Ajv doğrulaması
│   ├── _includes/         layouts/base.njk ve components/ (header, footer, kitap kartı, önizleme, SEO ...)
│   ├── assets/            css/ (tokens, typography, global, kartlar, vitrin, katalog, flipbook, admin), js/, fonts/ (yerel Inter, değişken ağırlık)
│   ├── *.njk              Sayfa şablonları (index, kitaplar, kitap, yazarlar, yazar, diziler, dizi, statik sayfalar, sitemap, 404)
│   └── *.11tydata.js      Sayfa başına hesaplanan veri (başlık, açıklama, ilgili kitaplar)
├── tests/                 Playwright e2e testleri (varsa)
├── DESIGN.md              Tasarım sistemi ("Beyaz Vitrin"): palet, tipografi, boşluk, bileşenler
├── eleventy.config.js     Eleventy yapılandırması (PATH_PREFIX, HtmlBasePlugin, passthrough, filtreler)
├── playwright.config.ts   E2E yapılandırması (channel: msedge)
└── package.json
```

`dist/` (çıktı) ve `node_modules/` git'e girmez.

## Veri modeli

### `data/catalog/books.json`

Kitap kayıtlarının dizisi; **tek doğruluk kaynağı** (ADR-005). Şema: `data/catalog/books.schema.json`. Şemada yalnızca ilk altı alan zorunludur; ek alanlara izin verilir.

| Alan | Tür | Zorunlu | Açıklama |
|---|---|---|---|
| `id` | metin | evet | Kitabın kalıcı kimliği; URL'yi (`/kitap/<id>/`) ve kapak dosya adını belirler. Küçük harf, rakam, tire (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). Benzersiz olmalı (yinelenen `id` build'i durdurur). |
| `title` | metin | evet | Kitap adı. |
| `subtitle` | metin / null | hayır | Alt başlık. |
| `alt_titles` | metin dizisi | hayır | Aynı kitabın kitapçılardaki farklı yazımları (eşleştirme için). |
| `edition` | metin / null | hayır | Baskı bilgisi. |
| `authors` | metin dizisi | evet | Yazarların adları (boş dizi olabilir; set/derleme için). |
| `author_display` | metin / null | evet | Sitede gösterilecek yazar adı (ör. "Dr. Rıza Nur"). Yoksa `null`. |
| `isbn` | metin / null | hayır | 10-17 karakter; rakam ve `X`/`-`. ISBN-13 ise sağlama toplamı SEO denetiminde kontrol edilir. |
| `pages` | tamsayı / null | hayır | Sayfa sayısı (≥ 1). |
| `publish_date` | metin / null | hayır | `YYYY`, `YYYY-MM` veya `YYYY-MM-DD`. Katalog "en yeniden eskiye" bu alana göre sıralanır. |
| `dimensions`, `binding`, `paper`, `language` | metin / null | hayır | Boyut, cilt, kâğıt, dil (`tr`). |
| `categories` | metin dizisi | hayır | Kitapçı kategori yolları; `data/site/sozluk.json` ile sitenin 7 kategorisine eşlenir. |
| `description` | metin / null | hayır | Yayınevinin tanıtım metni. Kampanya/fiyat/kargo satırları build'de otomatik ayıklanır. |
| `price_list_try` | sayı / null | hayır | Liste fiyatı. **Sitede gösterilmez** (ADR-001); yalnızca arşiv verisidir. |
| `is_set`, `set_items` | mantıksal, dizi | hayır | Set/paket kaydı mı; üyeleri. |
| `series` | metin / null | hayır | Dizi/seri adı. |
| `contributors` | metin / dizi / nesne | hayır | Çevirmen, editör vb. |
| `cover` | nesne | evet | `local_path` (örn. `public/kapaklar/<id>.jpg`; sitede `/kapaklar/<id>.jpg` olur), `source_url`, `width`, `height`. |
| `sources` | nesne | evet | `kitapyurdu`, `nobelkitap`, `kureselkitap` (ürün sayfası adresleri; yoksa `null`). Kitapyurdu adresinin slug'ı önizleme eşlemesinde kullanılır. |

Gerisi (`category_sources`, `field_sources`, `set_info`) toplama betiklerinin izlenebilirlik alanlarıdır; elle eklenen kayıtta gerekmez.

### `data/catalog/authors.json`

Yazar kayıtları: `name`, `slug`, `display`, `bio`, `bio_source`, `book_ids` (kitap `id`'leri), `photo_url`, `kitapyurdu_author_url`. **Yazar sayfası (`/yazar/<slug>/`) yalnızca bu dosyadaki kayıtlar için üretilir**; yeni bir yazar için buraya da kayıt ekleyin (`slug`, adın küçük harf/tireli hâli: `ç→c ğ→g ı→i ö→o ş→s ü→u`). Kitabın `authors` alanındaki adın sluglaştırılmış hâli `slug` ile eşleşmelidir.

### `data/catalog/onsoz/`

Önizleme (kitabın ilk sayfaları) verisi. `INDEX.json` tüm önizlemeli kitapların listesidir; her kitap için `<slug>.json` sayfaların dosya yolunu, boyutunu ve türünü (`kapak_ici`, `takdim`, `onsoz`, `icindekiler`, `metin` ya da `null`) tutar. Ayrıntı için bkz. [Önizleme ekleme](#önizleme-iç-sayfalar-ekleme). `REPORT.md` toplama sonuç raporudur.

### `data/site/*`

| Dosya | İçerik |
|---|---|
| `site.json` | Yayınevi adı, slogan, telefon, WhatsApp, e-posta, adres, sosyal bağlantılar, satış kanalları, menüler. |
| `meta.json` | Sayfa başına `<title>` ve açıklama (SEO) ile kitap/yazar sayfası şablonları. |
| `sozluk.json` | Site kategorileri (ad, slug, açıklama, kitapçı kategori eşleşmeleri) ve dizi/set adları. |
| `mikrometin.json` | Arayüz metinleri (düğme etiketleri, önizleme bildirimleri, WhatsApp çağrısı). |
| `vitrin.json` | Ana sayfa vitrin kararı (bkz. [Vitrin düzenleme](#vitrin-düzenleme)). |
| `sayfalar/*.md` | Statik sayfa metinleri: hakkimizda, iletisim, nereden-alinir, yayin-cizgisi, onizleme-hakkinda, kvkk-ve-cerezler, 404. |

## Yönetim paneli (önerilen yol)

Teknik bilgisi olmayan biri için kitap, yazar, duyuru, ana sayfa vitrini, sayfa metinleri, telefon/WhatsApp numarası ve site bilgileri bir yönetim panelinden değiştirilir. Aşağıdaki JSON akışı (kitap ekleme, vitrin, site metinleri) panelin arkasındaki dosyalardır; panel onlara güvenli yazar.

- **Başlatma:** `yonetim-baslat.bat` dosyasına çift tıklayın (ya da `npm run cms`). Siyah pencere açılır, site hazırlanır ve tarayıcıda `http://127.0.0.1:8090/yonetim/` açılır. İlk açılışta pencerede **bir kez gösterilen şifre** vardır; panelde "Şifre değiştir" ile kendi şifrenizi belirleyin. Unuttuysanız `yonetim-sifre-sifirla.bat`.
- **Sadece bu bilgisayarda çalışır** (`127.0.0.1`). Şifre `.local/cms-auth.json` içinde karma olarak durur (Git'e girmez).
- **Kaydedince** değişiklik veri dosyalarına yazılır ve site otomatik yeniden derlenir (birkaç saniye); önceki sürüm yedeklenir ve derleme hatasında geri alınır. Bu bilgisayardaki `dist/` hemen güncellenir.
- **İnternetteki siteyi güncellemek ayrı adımdır:** GitHub Pages statik olduğu için panel orada çalışmaz. Değişiklikler `data/`, `public/uploads/` içindedir; commit edip gönderdiğinizde (bkz. [GitHub'a yayınlama](#githuba-yayınlama)) yayına çıkar.
- **Telefon/WhatsApp numarası tek yerden değişir** (Site ayarları). Üst bardaki WhatsApp logosu, alt bilgi, iletişim sayfası, SEO açıklamaları ve kitap sipariş bağlantıları aynı kaynaktan (`data/site/site.json`) beslenir.
- **Önizleme sayfası yükleme:** bir kitabın düzenleme penceresinde en fazla 30 sayfa resmi yüklenir ve sıralanır; ana sayfa "Sayfalarına göz atın" rafına eklenebilir. Yayınevinin kendi önizlemesi varsa yüklenen sayfalar onun yerine geçer.
- **Sayfa metinlerinde yer tutucular:** `{telefon_gosterim}`, `{telefon}`, `{whatsapp_url}`, `{eposta}`, `{adres}`, `{sosyal_liste}` yazılırsa site ayarlarındaki güncel değerle değişir. Başka süslü parantezler olduğu gibi kalır.

Mimari ve güvenlik kararları: [ADR-015](docs/KARARLAR.md).

## Yeni kitap ekleme — adım adım (elle, JSON ile)

Yeni kitap = **1 JSON kaydı + 1 kapak dosyası**. Aşağıdaki akış sahte bir kayıtla denenmiştir.

### 1. `data/catalog/books.json` dosyasına kayıt ekleyin

Dizinin sonuna (son `}` ile `]` arasına, öncekinin sonuna virgül koyarak) ekleyin. Gerçek bir kayıttan (`inas`) türetilmiş örnek; bilmediğiniz alanı `null` bırakın, **tahmin yazmayın**:

```json
{
  "id": "inas",
  "title": "İnas",
  "subtitle": null,
  "alt_titles": [],
  "edition": null,
  "authors": ["İyad Kunaybi"],
  "author_display": "Dr. İyad Kunaybi",
  "isbn": "9786258230895",
  "pages": 256,
  "publish_date": "2025-03-24",
  "dimensions": "13.5 x 21 cm",
  "binding": "Karton Kapak",
  "paper": "Kitap Kağıdı",
  "language": "tr",
  "categories": ["Roman"],
  "description": "Kitabın yayınevi tanıtım metni...",
  "price_list_try": null,
  "is_set": false,
  "set_items": [],
  "series": null,
  "cover": {
    "source_url": null,
    "local_path": "public/kapaklar/inas.jpg",
    "width": null,
    "height": null
  },
  "sources": {
    "kitapyurdu": "https://www.kitapyurdu.com/kitap/inas/714274.html",
    "nobelkitap": null,
    "kureselkitap": null
  }
}
```

Kurallar:

- `id`: küçük harf, rakam, tire; Türkçe karakter yok; benzersiz; **yayına girdikten sonra değiştirmeyin** (URL kırılır).
- `categories`: `data/site/sozluk.json` içindeki kategori adlarından (örn. `Tarih`) ya da `kaynak_adlari` listesindeki kitapçı kategorisinden biri olmalı; eşleşmeyen kitap kategori sayfalarında görünmez ama katalogda yer alır.
- `cover.local_path` her zaman `public/kapaklar/<id>.jpg` olmalı.
- Kitapyurdu adresi varsa **olduğu gibi** yazın (`/kitap/<slug>/<sayı>.html` biçimi); önizleme eşlemesi bu adresin slug'ına dayanır.

### 2. Kapak dosyasını ekleyin

`public/kapaklar/<id>.jpg` olarak kaydedin (dosya adı `id` ile birebir aynı). Öneri: JPEG, uzun kenar ≤ 1600 px, dik (kitap oranı). Büyük ya da PNG dosyalar için:

```bash
node scripts/gorsel/orijinal-kucult.mjs   # >1600 px olanları küçültür, PNG'yi JPEG'e çevirir (idempotent)
```

### 3. Görselleri optimize edin

```bash
npm run gorsel          # kapaklar-opt/ (webp+jpg, 320/640/960 px), bulanık yer tutucu, OG görseli
```

Çıktılar: `public/kapaklar-opt/<id>-*.webp|jpg`, `public/og/<id>.png`, `data/catalog/kapaklar-opt.json`, `data/catalog/og.json`. Bu dosyaların hepsi commit edilir. Betik idempotenttir (güncel olanı atlar); hepsini yeniden üretmek için `npm run gorsel -- --force`.

> Bu adım atlanırsa site yine derlenir (kapak orijinal dosyadan gösterilir) ama hızlı görsel kümeleri ve paylaşım görseli olmaz.

### 4. Derleyin

```bash
npm run build
```

Sonuç: `dist/kitap/<id>/index.html` oluşur; kitap `/kitaplar/` listesinde, `sitemap.xml`'de ve yazar sayfasında görünür. Hata varsa mesaj hangi alanın şemaya uymadığını söyler.

### 5. Yeni yazar mı?

Kitabın yazarı katalogda yoksa `data/catalog/authors.json`'a yazar kaydı ekleyin (`name`, `slug`, `display`, `book_ids`; diğer alanlar `null`). Bu kayıt olmadan kitap yayınlanır ama `/yazar/<slug>/` sayfası üretilmez.

### 6. Kontrol edin

```bash
npm run serve                  # http://localhost:8090/kitap/<id>/ adresini açın
npm run dogrula:seo            # SEO denetimi: hata olmamalı
npm run dogrula:icerik         # içerik doğrulaması (scripts/qa/dogrula.py mevcutsa)
```

### 7. Commit ve yayın

```bash
git add data public
git commit -m "feat: yeni kitap eklendi (<kitap adı>)"
git push
```

`main`'e push edilince site otomatik yayınlanır (bkz. [yayın akışı](#canlı-adres-ve-yayın-akışı)).

## Önizleme (iç sayfalar) ekleme

Önizleme, kitap sayfasında kapağa dokununca açılan sayfa çevirme galerisidir. Yayınevinin önizleme politikasına uygun olarak en çok ilk 8-10 sayfa konur (ADR-007).

1. **Görseller:** `public/onsoz/<slug>/01.jpg`, `02.jpg`, `03.jpg` ... Sıra numarası ikişer haneli ve 1'den başlar. `<slug>` kitabın **Kitapyurdu adresindeki slug**'tır (`https://www.kitapyurdu.com/kitap/inas/714274.html` → `inas`); bu, `books.json` içindeki `sources.kitapyurdu` ile eşleşmelidir.
2. **Meta veri:** `data/catalog/onsoz/<slug>.json`. Mevcut bir dosyayı (örn. `inas.json`) kopyalayıp güncelleyin:

   ```json
   {
     "kitapyurdu_slug": "inas",
     "kitapyurdu_id": 714274,
     "kitapyurdu_url": "https://www.kitapyurdu.com/kitap/inas/714274.html",
     "title": "İnas",
     "author_display": "Dr. İyad Kunaybi",
     "source_type": "kitapyurdu-preview",
     "page_count": 10,
     "pages": [
       { "index": 1, "source_url": null, "local_path": "public/onsoz/inas/01.jpg", "width": 604, "height": 1000, "kind": "kapak_ici" },
       { "index": 2, "source_url": null, "local_path": "public/onsoz/inas/02.jpg", "width": 610, "height": 1000, "kind": null }
     ]
   }
   ```

   `kind`: `kapak_ici`, `takdim`, `onsoz`, `icindekiler`, `metin` ya da `null`. `takdim`/`onsoz`/`giris` içeren kitaplar "önsöz var" olarak işaretlenir.
3. **Dizin:** `data/catalog/onsoz/INDEX.json` listesine kitabı ekleyin: `slug`, `kitapyurdu_id`, `title`, `author`, `page_count`, `has_onsoz`, `onsoz_pages` (önsöz sayfa numaraları), `status: "ok"`.
4. `npm run gorsel` → `public/onsoz-opt/` ve `data/catalog/onsoz-opt.json` üretilir.
5. `npm run build` ve kitap sayfasında önizlemeyi deneyin.

Kitapyurdu "İç Sayfalara Gözat" galerisinden otomatik toplama akışı iki parçalıdır (Firecrawl ile elle adım + Python betikleri); ayrıntı: [`scripts/onsoz/README.md`](scripts/onsoz/README.md). Katalog verisini yeniden toplamak için: [`scripts/katalog/README.md`](scripts/katalog/README.md).

## Vitrin düzenleme

Ana sayfadaki öne çıkan kitap, önizleme vitrini ve yeni çıkanlar `data/site/vitrin.json` ile yönetilir:

| Alan | Anlamı |
|---|---|
| `one_cikan` | Ana sayfada büyük gösterilen kitabın `id`'si. |
| `onizleme_vitrini` | "Ön sayfalarına göz atın" şeridindeki kitap `id`'leri (sırası korunur; önizlemesi olmayanlar atlanır). |
| `vitrin_haric` | Ana sayfa ve öne çıkarma alanlarına alınmayacak `id`'ler (katalogda ve kendi sayfasında yine görünür). |
| `yeni_cikanlar_adet`, `yazar_seridi_adet` | Yeni çıkanlar ve yazar şeridi uzunluğu. |

Listede olmayan bir `id` yazarsanız build "katalogda olmayan id'ler" hatasıyla durur.

## Site metinlerini düzenleme

- **Statik sayfalar:** `data/site/sayfalar/*.md`. Başında YAML bilgi bloğu (`title`, `slug`, `description`, `son_guncelleme`), sonra Markdown gövde. İlk `# Başlık` şablon başlığı olarak kullanılır.
- **`[[SORU: ...]]` kuralı:** Yayınevinden öğrenilmesi gereken bilgi için metne `[[SORU: soru metni]]` yazılır. Bu işaretli parçalar **yayına girmez**, build çıktısında sayılıp konsola yazılır. Bilgi geldiğinde işaret ve soru metni silinip yerine gerçek cümle yazılır. Bekleyen soruların listesi: [`docs/SITE-HARITASI.md`](docs/SITE-HARITASI.md) ("Direktöre sorular") ve `data/site/sayfalar/` altındaki `[[SORU` işaretleri (`grep -rn "SORU" data/site`).
- **Yer tutucular:** sayfa gövdesinde ve `description` içinde `{telefon_gosterim}`, `{whatsapp_url}`, `{eposta}`, `{adres}`, `{sosyal_liste}` kullanılabilir; `site.json` değerleriyle dolar. Telefon, e-posta ve adresi sayfa metinlerine elle yazmayın.
- **Menü, iletişim, satış kanalları:** `data/site/site.json` (telefon, e-posta, adres, sosyal medya ve satış noktaları yönetim panelinin "Site ayarları" bölümünden de değişir).
- **Sayfa başlığı/açıklaması (SEO):** `data/site/meta.json`.
- **Arayüz etiketleri:** `data/site/mikrometin.json`.
- **Kategoriler:** `data/site/sozluk.json`.
- Fiyat ya da kampanya yazmayın (ADR-001). Bilgi uydurmayın; bilmediğiniz yere `[[SORU: ...]]` koyun.

## Tasarım

Tasarım sistemi kökteki [`DESIGN.md`](DESIGN.md) dosyasındadır ("Beyaz Vitrin": apple.com ürün sayfası dili; beyaz ve #f5f5f7 bantlar, Inter, tek kırmızı vurgu, kapak sahnede). Token'lar `src/assets/css/tokens.css` içindedir; tipografi `typography.css`, genel kurallar ve üst bar/alt bilgi `global.css`, kitap/yazar kartı ve yatay raf `kartlar.css`, ana sayfa `vitrin.css`, katalog ve kitap detayı `katalog.css`, sayfa çevirme `flipbook.css`, yönetim paneli `admin.css`. Renk ya da yazı tipi değiştirmeden önce DESIGN.md'yi okuyun; kontrastı `node scripts/design/kontrast.mjs` ile yeniden ölçün. Yazı tipi (Inter, SIL OFL) yerel dosyadır (`src/assets/fonts/`), üçüncü taraf istek yapılmaz.

## SEO

Ayrıntı: [`docs/SEO.md`](docs/SEO.md) (title/description kuralları, JSON-LD `@graph`, sitemap, robots, bilinen sınırlar). Özet Google Search Console adımları:

1. search.google.com/search-console → **Özellik ekle → Alan adı** → `islambol.org` (DNS TXT kaydıyla doğrulanır) ya da **URL öneki** → `https://islambol.org/`.
2. URL öneki seçtiyseniz doğrulama **HTML etiketi**: verilen `<meta name="google-site-verification" ...>` etiketini `src/_includes/components/seo.njk` içine ekletin ve siteyi yayınlayın.
3. **Site haritaları → `sitemap.xml`** gönderin (`robots.txt` artık alan adı kökünde olduğundan arama motorları sitemap'i oradan da bulur).
4. **URL denetimi** ile ana sayfayı ve bir kitap sayfasını indekslemeye gönderin.
5. Rich Results Test ile bir kitap sayfasını deneyin (`Book` şeması; fiyat yok, ürün zengin sonucu beklenmemeli).

## QA komutları

| Komut | Ne yapar |
|---|---|
| `npm run build` | Derler ve veriyi şemaya karşı doğrular. |
| `npm run serve` | `dist/` klasörünü `http://localhost:8090` üzerinde sunar. |
| `npm run dogrula:seo` (= `node scripts/seo/dogrula.mjs`) | `dist/` içindeki tüm sayfalarda title/description/canonical/JSON-LD/ISBN kontrolü; hata varsa çıkış kodu 1. Uyarılar (uzun title vb.) çıkış kodunu etkilemez. |
| `npm run dogrula:icerik` (= `python -I -X utf8 scripts/qa/dogrula.py`) | İçerik doğrulaması (Q4 tarafından yazılıyor). Betik `scripts/qa/dogrula.py` mevcutsa çalışır. |
| `npm run test:e2e` | Playwright uçtan uca testleri. **Önce `npm run build` gerekir.** Bu makinede yalnızca sistemdeki **Edge** (`channel: 'msedge'`) çalışır, ayrıca tarayıcı indirmeyin. Testler CI'da çalıştırılmaz (CI Linux'ta Edge yoktur). |
| `npm run gorsel` | Kapak/önsöz/OG görsel optimizasyonu. |
| `node scripts/design/kontrast.mjs --md` | Tasarım renklerinin WCAG kontrast ölçümü. |

## GitHub'a yayınlama

Bu bölüm depo sahibi (kullanıcı) içindir; kimlik doğrulama sizin hesabınızla yapılır. Yerel `main` dalı hazırdır, henüz GitHub'a push edilmedi.

1. **Giriş (bir kez):**

   ```bash
   gh auth login --web --git-protocol https
   ```

   Tarayıcı açılır; GitHub hesabı `Halimdursak` ile onaylayın.
2. **Depoyu oluşturup push edin:**

   ```bash
   gh repo create islambol-yayinlari --public --source=. --remote=origin --push
   ```

   Depo adı `islambol-yayinlari` olsun (www CNAME'i `halimdursak.github.io`'ya gider; depo adı adreste görünmez).
3. **Pages kaynağını ayarlayın (bir kez):** GitHub'da depo → **Settings → Pages → Build and deployment → Source: "GitHub Actions"**. (Komutla: `gh api -X POST repos/Halimdursak/islambol-yayinlari/pages -f build_type=workflow`.)
4. **İlk yayın:** Push zaten `deploy.yml` iş akışını başlatır; ayarı sonradan yaptıysanız **Actions → "Pages'e yayınla" → Run workflow**. Bitince adres: https://halimdursak.github.io/islambol-yayinlari/ (özel alan adı bağlanınca https://islambol.org; yönlendirme için [Özel alan adı](#özel-alan-adı-islambolorg)). Not: iş akışı artık kök derlemesi yaptığından alan adı bağlanmadan bu geçici adreste sayfalar/stiller kırık görünür; önce 1. adımı (Custom domain) yapın ya da yukarıdaki geçici `PATH_PREFIX` ayarını kullanın.
5. **Sonraki yayınlar:** `git push` yeter.

### Özel alan adı (islambol.org)

Depo tarafı hazırdır (ADR-016): `deploy.yml`/`ci.yml` `SITE_URL=https://islambol.org`, `PATH_PREFIX=/` ile derler; `robots.txt` ve kanonik adresler alan adına bakar. Actions ile yayınlandığı için `CNAME` dosyası gerekmez. Sizin yapacağınız sıra:

1. **GitHub'da depo → Settings → Pages → Custom domain** kutusuna `islambol.org` yazıp **Save** deyin. (DNS kayıtlarından ÖNCE yapın; aksi hâlde başkası alt alan adınızı kullanabilir.) İsterseniz önce alan adını GitHub'da doğrulayın (hesap **Settings → Pages → Add a domain**, size bir TXT kaydı verir).
2. **Natro'da DNS kayıtları** (alan adı → DNS yönetimi; kayıt düzenleme bölümü yoksa Natro destek ya da Profesyonel DNS gerekebilir). Önce `@` için mevcut/varsayılan A–AAAA kayıtlarını silin, sonra ekleyin:

   | Tür | Ad | Değer |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` (dört ayrı kayıt; isteğe bağlı) |
   | CNAME | `www` | `halimdursak.github.io` (depo adı olmadan) |

   Joker (`*`) kayıt eklemeyin. Natro'nun park sayfası/yönlendirme (hosting) hizmeti açıksa kapatın. Değerler GitHub belgesinden doğrulanmıştır (16 Ekim 2026): docs.github.com → "Managing a custom domain for your GitHub Pages site".
3. DNS yayılması birkaç dakika ile 24 saat sürebilir. Kontrol: `Resolve-DnsName islambol.org -Type A` (PowerShell).
4. DNS oturunca **Settings → Pages → Enforce HTTPS**'i açın (sertifika hazır olunca seçilebilir hâle gelir; 24 saate kadar sürebilir).
5. Search Console'da yeni adresi ekleyin (yukarıdaki [SEO](#seo) adımları) ve eski `github.io` adresi alan adına yönlenir.

## Telif ve lisans

- **İçerik** (kitap kapakları, tanıtım metinleri, önizleme sayfaları, logo, site metinleri) **© İslambol Yayınları**'na aittir; izinsiz kopyalanamaz, çoğaltılamaz (ADR-007). Siteye yalnızca yayınevinin kendi içeriği girer; önizleme sayfaları yayınevinin önizleme politikasına uygun sayıdadır. Yayına almadan önce yayınevi sahibinin içerik onayı alınmalıdır.
- **Kod lisansı henüz seçilmedi** ve bu depoya bilerek `LICENSE` dosyası eklenmedi; lisans seçimi depo sahibinin kararıdır. Lisans dosyası yoksa varsayılan olarak tüm hakları saklıdır. Seçenekler:
  - **Hiç lisans koymamak / özel (kapalı) tutmak:** kodu başkası kullanamaz. Depo `--public` açılırsa herkes görebilir ama yeniden kullanamaz.
  - **MIT:** kodun serbestçe kullanılmasına izin verir; içerik yine yayınevinindir (içeriği lisanstan açıkça hariç tutan bir not ekleyin).
  - **Apache-2.0:** MIT'ye benzer, patent hakkı hükmü içerir.
  - **Kod için MIT + içerik için "tüm hakları saklıdır" (önerilen ayrım):** `LICENSE` (kod) ile `data/`, `public/` ve `src/` altındaki içeriği kapsayan bir `CONTENT-LICENSE` notu.
- Üçüncü taraf bileşenler: `page-flip` (MIT), yazı tipi Inter (SIL OFL; metin: `src/assets/fonts/OFL.txt`).

## Ekip ve kararlar

- [`docs/EKIP.md`](docs/EKIP.md): ekip tüzüğü, rol kartları (kim neye yazabilir), iş akışı ve kabul ölçütleri.
- [`docs/KARARLAR.md`](docs/KARARLAR.md): mimari karar kayıtları (ADR-001 mağaza yok; 005 veri tek kaynak; 006 GitHub Pages; 007 telif; 008 Uygulama Denetimi; 009 Eleventy).
- [`docs/SITE-HARITASI.md`](docs/SITE-HARITASI.md): URL ağacı, sayfa kartları, bekleyen sorular.
- [`docs/PERFORMANS.md`](docs/PERFORMANS.md), [`docs/SEO.md`](docs/SEO.md), [`CONTRIBUTING.md`](CONTRIBUTING.md): performans bütçesi, SEO, katkı kuralları.

## Bilinen sınırlar

- **`gh auth login` kullanıcıdan beklenir:** depo henüz GitHub'da yok; yayın için yukarıdaki [GitHub'a yayınlama](#githuba-yayınlama) adımları gerekir.
- **Trendyol mağaza adresi yok:** "Nereden alınır" sayfasındaki Trendyol satırı `[[SORU]]` ile bekliyor; yayınevinden alınacak.
- **Bekleyen yayınevi bilgileri (`[[SORU]]`):** kuruluş yılı ve yayın kurulu, toplam kitap sayısı, açık adres ve çalışma saatleri, ödeme/kargo yöntemleri, toptan satış yolu, önizleme kullanım koşulları, barındırma ve analitik kararı. Tam liste: `docs/SITE-HARITASI.md` ("Direktöre sorular") ve `grep -rn "SORU" data/site`.
- **Alt dizin yayını:** `robots.txt` alan adı kökünde olmadığı için projesayfası adresinde arama motorlarınca okunmaz; sitemap Search Console'dan elle bildirilir (özel alan adıyla çözülür).
- **Önizleme kapsamı:** yalnızca Kitapyurdu'nda "iç sayfalara gözat" bulunan kitapların önizlemesi vardır; diğerleri "önizleme eklenmedi" der.
- **Fiyat gösterilmez** (ADR-001); fiyat bilgisi `price_list_try` alanında arşiv amaçlı tutulur.
- **E2E testleri CI'da çalışmaz** (Edge kanalına bağlı); yerelde `npm run test:e2e` ile çalıştırılır.
- **Native modül yasağı (geliştirme makinesi):** bkz. [Windows'ta native modül engeli](#windowsta-native-modül-engeli).
