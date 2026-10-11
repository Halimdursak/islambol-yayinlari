# SEO ve Yapısal Veri (B5)

Sahibi: B5. Dosyalar: `src/_includes/components/seo.njk`, `src/sitemap.njk`, `public/robots.txt`, `scripts/seo/dogrula.mjs`.

## Uygulananlar

`seo.njk`, `base.njk`'in `<head>` bölümünde çağrılır. Girdi: `title`, `description`, `page.url`, `site`, sayfaya göre `kitap` / `yazar` / `dizi`.

| Öğe | Kural |
|---|---|
| `<title>` | `title` varsa o; yoksa `site.meta.sayfalar[page.url].title`; yoksa `site.ad` |
| description | `description`; yoksa `meta.sayfalar` kaydı; yoksa slogan |
| canonical | `site.url + page.url` (alt dizin dahil, ADR-006) |
| robots | `index,follow`; `/404.html` ve `/_test/` için `noindex,follow` |
| Open Graph | `og:type` (kitap: `book`, diğer: `website`), title, description, url, site_name, locale `tr_TR`, image 1200x630 |
| OG görseli | Kitap: `<site.url>/og/<kitap.id>.png`; diğerleri: `<site.url>/og/site.png` (B4 üretir) |
| Twitter | `summary_large_image` + title/description/image |
| Diğer | `theme-color` `#A51C22`; favicon.svg, favicon-32.png, apple-touch-icon.png, site.webmanifest (B4) |

### JSON-LD (tek `@graph` bloğu)

| Şema | Sayfalar |
|---|---|
| `Organization` (ad, url, logo, telefon, e-posta, `PostalAddress` Fatih/İstanbul/TR, `sameAs`) | Her sayfa |
| `WebSite` (`inLanguage: tr`) | Her sayfa |
| `BreadcrumbList` (mutlak URL; Ana sayfa > bölüm > sayfa) | Her sayfa |
| `Book` (name, alternateName, author[], isbn, numberOfPages, datePublished, inLanguage, publisher, image, description en çok 300 kr, url; `offers` yok) | `/kitap/<id>/` |
| `Person` (name, url, bio varsa description) | `/yazar/<slug>/` |
| `CreativeWorkSeries` (name, url) | `/dizi/<slug>/` |

Bloktaki `</` dizileri `<\/` olarak kaçışlanır. Boş alanlar (isbn, sayfa sayısı vb.) hiç yazılmaz.

### sitemap.xml ve robots.txt

`sitemap.xml`: `collections.all` içinden `/404.html`, `/_test/` ve kendisi hariç tüm sayfalar; `<lastmod>` build tarihi; mutlak URL. `robots.txt`: `Allow: /`, `Disallow: /_test/`, sitemap adresi sabit yazılı (Eleventy `public/` dosyalarını işlemez; `SITE_URL` değişirse elle güncellenmeli).

## Doğrulama

`npm run build && node scripts/seo/dogrula.mjs` (hata varsa çıkış kodu 1). Kontroller: sayfa başına tam 1 title / description / canonical, canonical `site.url` ile başlıyor, en az 1 geçerli JSON-LD, Organization + WebSite var; kitap sayfasında `Book`, `isbn` varsa ISBN-13 sağlama toplamı geçerli, `offers` yok. Uyarı: title > 60, description > 155, tekrar eden title.

Son çıktı (2026-10-11, B1/B2 içerik sayfaları henüz yokken yalnızca iskelet): 2 sayfa, 0 hata, 0 uyarı.
Şablonları geçici test sayfalarıyla (66 kitap, 33 yazar, 5 dizi; sonra silindi) çalıştırınca: 123 sayfa, 0 hata. Örnek: `/kitap/sen-neden-kor-edildin/` -> `Book`, `isbn: 9786255529374`, 348 sayfa. Geçici sayfaların başlıkları sahte olduğu için uyarı sayısı anlamsızdır; gerçek uyarılar B2 sayfaları gelince yeniden alınmalıdır.

## Google Search Console adımları (kullanıcı için)

1. search.google.com/search-console -> "Özellik ekle" -> "URL öneki" -> `https://adursak63.github.io/islambol-yayinlari/` (alt dizin olduğu için alan adı özelliği seçilemez).
2. Doğrulama: "HTML etiketi" yöntemi; verilen `<meta name="google-site-verification">` etiketini `seo.njk` içine eklettirin (B5'e iletin) ve siteyi yayımlayın.
3. "Site haritaları" -> `sitemap.xml` ekleyin.
4. "URL denetimi" ile ana sayfayı ve bir kitap sayfasını indekslemeye gönderin.
5. Rich Results Test (search.google.com/test/rich-results) ile bir kitap sayfasını deneyin; `Book` için zengin sonuç garanti değildir, şema yalnızca anlam bilgisidir.

## Bilinen sınırlar

- **Alt dizin:** GitHub Pages `/islambol-yayinlari/` altında. SEO bileşeni mutlak URL'leri `site.url` ile kurar, ancak `base.njk` ve favicon bağlantıları (`/favicon.svg`, `/assets/...`) kök-göreli; özel alan adı ya da `pathPrefix` kararı verilmeden alt dizinde bu varlıklar 404 verir. `robots.txt` ve `sitemap.xml` de alt dizinde alan adı köküne konmadığı için arama motorlarınca `robots.txt` olarak okunmaz (robots yalnızca alan adı kökünde geçerli); sitemap Search Console'dan elle gönderilir.
- **OG görselleri B4'e bağlı:** `/og/<id>.png` ve `/og/site.png` üretilmezse paylaşım önizlemesi kırık görsel gösterir. `public/logo/islambol-logo.png` de şu an yok (yalnızca `islambol-x-profil.jpg`); `Organization.logo` bu dosyaya işaret eder.
- **Fiyat yok:** ADR-001 gereği `offers` / `Product` basılmaz; kitap sonuçları ürün zengin sonucu almaz.
- `ItemList` ve `CollectionPage` (dizin sayfaları), `ContactPoint` / `AboutPage` şemaları bu sürümde yok.
- Veri kaynaklı: bir dizi adı katalogdan "(5 kitap)" ekiyle geliyor; `CreativeWorkSeries.name` aynen aktarır.
