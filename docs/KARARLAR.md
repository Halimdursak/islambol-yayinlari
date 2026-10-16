# Mimari Karar Kayıtları (ADR)

Her karar: Bağlam → Seçenekler → Karar → Sonuçlar. Tarih: 11 Ekim 2026.

## ADR-001 Site türü: tanıtım + katalog, mağaza değil

Bağlam: Yayınevinin kendi e-ticareti yok; satış WhatsApp (0505 980 87 35), Küresel Kitap, Kitapyurdu, Hepsiburada, Trendyol üzerinden. Türk yayınevi siteleri (Ketebe, Timaş, Erkam, Semerkand) neredeyse tamamen mağaza.
Seçenekler: (a) mağaza klonu (sepet, ödeme) (b) tanıtım + "nereden alınır" + WhatsApp sipariş CTA (c) sadece vitrin.
Karar: (b). Ödeme altyapısı, stok, KVKK yükü yok; yayınevinin gerçek satış akışına bağlanır.
Sonuç: Site fiyat göstermez (eskir); her kitapta kaynak mağaza bağlantıları + WhatsApp "Sipariş ver" bağlantısı (`https://wa.me/905059808735?text=...` kitap adı önceden dolu).

## ADR-002 Çatı: Astro 5, statik çıktı, vanilla TS

Bağlam: ~70 kitap, ~45 yazar, 5-6 statik sayfa. İçerik JSON'da. Kullanıcı sonradan tek başına kitap ekleyecek.
Seçenekler: (a) saf HTML/CSS/JS (70 sayfa el ile) (b) Next.js (c) Astro (d) 11ty.
Karar: Astro. İçerik koleksiyonu + zod şema JSON'u doğrular; sayfa başına sıfır JS; `[slug].astro` ile 70 sayfa otomatik; GitHub Pages adaptörü hazır.
Sonuç: Node 24 yeterli; `npm run build` → `dist/`. Tailwind kullanılmaz (ADR-004).

## ADR-003 Sayfa çevirme: `page-flip` (StPageFlip) dinamik import

Bağlam: Kullanıcı isteği: kapağa dokununca ilk sayfalar sayfa çevirme efektiyle açılsın. Kaynak: Kitapyurdu "İç Sayfalara Gözat" galerisi (sayfa görselleri).
Seçenekler: (a) turn.js (jQuery, eski) (b) page-flip / StPageFlip (vanilla, MIT, dokunma) (c) saf CSS 3D transform el yapımı (d) flipbook SaaS iframe.
Karar: (b), Rakip Analisti'nin kütüphane karşılaştırması aksini göstermezse. El yapımı CSS yalnızca `prefers-reduced-motion` fallback'i için.
Sonuç: Kütüphane yalnızca önizleme modalı açılınca yüklenir (ana paket şişmez). Sayfa içeriği görsel (JPG) olarak gösterilir; metin varsa alt metin olarak eklenir (erişilebilirlik + SEO).

## ADR-004 Stil: saf CSS + token'lar, Tailwind yok

Bağlam: "Çok profesyonel", şablon görünümü istenmiyor. ECC design-quality kuralı: şablon görünümü yasak.
Karar: `src/styles/tokens.css` (`:root` değişkenleri, OKLCH), `typography.css`, `global.css`; bileşen başına scoped CSS (Astro).
Sonuç: Tasarım D1 tarafından DESIGN.md'de tanımlanır; open-design kütüphanesinden `editorial` / `warm-editorial` / `publication` / `vintage` adayları incelenir, biri temel alınıp yayınevi karakterine uyarlanır.

## ADR-005 Veri: `data/catalog/books.json` tek doğruluk kaynağı

Bağlam: Kitap verisi 3 kitapçıdan derleniyor; kullanıcı sonradan kendisi güncelleyecek.
Karar: Tek JSON dosyası + zod şema; görseller `public/kapaklar/<id>.jpg`; önsöz görselleri `public/onsoz/<id>/NN.jpg`. Astro build sırasında JSON'u okur.
Sonuç: Yeni kitap = 1 JSON kaydı + 1 kapak dosyası. README'de adım adım anlatılır ve QA bir sahte kayıtla dener.

## ADR-006 Yayın: GitHub Pages + Actions

Bağlam: `gh` giriş yapmamış; kullanıcı `gh auth login` yapınca repo oluşturulup push edilecek.
Karar: `.github/workflows/deploy.yml` (withastro/action). Repo adı önerisi: `islambol-yayinlari`. Özel alan adı sonradan `CNAME` ile.
Sonuç: Yerel repo hazır; push tek komut.

## ADR-007 Telif ve içerik sınırı

Bağlam: Kapaklar, arka kapak metinleri, iç sayfa görselleri yayınevine aittir; site yayınevi adına yapılıyor. Rakip ekran görüntüleri yalnızca araştırma dosyasında.
Karar: Siteye yalnızca İslambol'a ait içerik girer. Kitapçılardan alınan metinler yayınevinin kendi tanıtım metinleridir (kitapçılar yayınevinden alır). Önizleme sayfaları yayınevinin kendi önizleme politikasına uygun sayıda (en fazla ilk 8-10 sayfa).
Sonuç: Yayınevi sahibi yayına almadan önce içerik onayı verir; README'de belirtilir.

## ADR-008 Windows Uygulama Denetimi ilkesi: native .node modülleri engelli → WASM binding'ler

Bağlam: Bu makinede `require('@rolldown/binding-win32-x64-msvc')` `ERR_DLOPEN_FAILED: "Uygulama Denetimi ilkesi bu dosyayı engelledi."` ile düşüyor (11 Ekim 2026). Astro 7 / Vite 8'in paketleyicisi rolldown native binding ister; sharp da native ister. Sistem güvenlik ayarı değiştirilmeyecek.
Karar: `@rolldown/binding-wasm32-wasi` ve sharp'ın `@img/sharp-wasm32` yedeği kullanılır (DLL yüklemez). Build biraz daha yavaş ama güvenlik ilkesine dokunulmaz. Playwright için bundled Chromium engellenirse `channel: 'msedge'` (sistemdeki imzalı Edge) kullanılır.
Sonuç: `package.json` bu paketleri açık bağımlılık olarak taşır; README "Windows'ta native modül engeli" notu içerir; CI (GitHub Actions, Linux) native binding ile çalışır, sorun yalnızca bu geliştirme makinesinde.

## ADR-009 Çatı değişikliği: Astro 7 → Eleventy 3 (ADR-002'yi geçersiz kılar)

Bağlam: ADR-008'deki Uygulama Denetimi engeli yüzünden Astro 7'nin dört native bağımlılığı (rolldown, satteri, @astrojs/compiler-binding, sharp) WASM yedeklerine çevrildi; sharp ve compiler çalıştı ama rolldown'ın WASM sürümü Windows'ta modül çözümlemesini yapamıyor (`[UNRESOLVED_ENTRY] Cannot resolve entry module astro/entrypoints/prerender` + libuv `UV_HANDLE_CLOSING` çökmesi; sürümler 1.2.13 birebir eşit, 11 Ekim 2026). Aynı yolda üç deneme yapıldı; teşhis: "WASM yedeği yeter" varsayımı bu makinede yanlış.
Seçenekler: (a) Astro 5/6 (esbuild.exe de imzasız, aynı engel) (b) yalnızca CI'da build, yerelde önizleme yok (QA imkânsız) (c) Eleventy 3 (saf JS, sıfır native modül; ölçüldü: 129 paket, 0 `.node`, 3 sayfa 0.16 s).
Karar: (c) Eleventy 3.1.6 + Nunjucks şablonları + saf CSS + `page-flip` ESM passthrough. JSON doğrulama `ajv` ile `src/_data/books.js` içinde (zod yerine). Görsel optimizasyonu `sharp` (WASM yedeği çalışıyor).
Sonuç: Dosya düzeni: `src/_includes/layouts|components`, `src/_data/*.js` (data/catalog JSON'u okur ve doğrular), `src/kitap.njk` pagination ile 70 sayfa, `public/` passthrough. CI Linux'ta da aynı komut: `npm ci && npm run build`. EKIP.md rol kartlarındaki dosya yolları buna göre güncellendi.

## ADR-010 Tasarım yönü: "Arşiv Dosyası" → "Beyaz Vitrin" (ADR-004'ün tasarım kısmını günceller; saf CSS + token yaklaşımı geçerli)

Tarih: 16 Ekim 2026.
Bağlam: Kullanıcı "Arşiv Dosyası" tasarımını beğenmedi (14 Ekim) ve premium, modern, iPhone/Apple görünümü istedi. Dört seçenek hazırlandı (`docs/design/secenekler/`): 1 Beyaz Vitrin, 2 Pro Siyah, 3 Cam Bento, 4 Editoryal Books. Aynı gün başka bir oturum farklı bir "yeni vitrin" yapısı da üretmişti (ADR-012).
Seçenekler: (a) yalnız dört seçenekten biri, 14 Ekim yapısı atılır; (b) 14 Ekim işi olduğu gibi sürdürülür; (c) 14 Ekim yapısı (arama, duyuru slaytı, CMS) korunur, görünüm seçilen seçeneğin diliyle giydirilir; (d) ayrı dalda seçenek uygulanır, iki sürüm karşılaştırılır.
Karar: (c) Seçenek 1 "Beyaz Vitrin" görünümü + 14 Ekim yapısı (kullanıcı 16 Ekim'de "Yarım iş + Beyaz Vitrin görünümü"nü seçti). Beyaz/`#f5f5f7` bantlar, Inter (Apple cihazlarda SF öncelikli) self-host, tek kırmızı vurgu (yalnız birincil CTA ve "Önizle" rozeti), kapak fotoğrafı `multiply` ile eritilir, 20/28px kartlar, 980px kapsül düğmeler. Karanlık mod kaldırıldı (14 Ekim çalışması zaten kapatmıştı; e2e artık sistem koyu moddayken de açık temayı doğrular).
Sonuç: `DESIGN.md` v2; CSS dosyaları `tokens, typography, global, kartlar, vitrin, katalog, flipbook, admin`; `redesign.css` kaldırıldı; EB Garamond ve IBM Plex Sans dosyaları silindi; favicon ve OG görselleri yeni paletle yeniden üretildi; `kontrast.mjs` yeni token'lara uyarlandı (24 çift, 0 başarısız). Inter için `impeccable` kancası "yaygın font" uyarısı verir; seçilen Apple dilinin gereği olduğu için bilinçli kabul edilmiştir.

## ADR-011 `src/_data/*.js` dosyaları yalnızca `export default` taşır

Tarih: 16 Ekim 2026.
Bağlam: 14 Ekim çalışması `books.js`, `authors.js`, `vitrin.js`, `campaigns.js` dosyalarına yardımcı `export function` eklemişti. Derleme `d.kitap.yazar_sluglari is not iterable` ile düşüyordu. Kök neden Eleventy'nin `Util/Require.js` satır 138-141'inde: modülde yalnızca `default` varsa o veri olur; ek adlandırılmış export varsa veri `{ default, publishedBooks }` modül nesnesidir. Sayfalama nesnenin anahtarlarını dolaştı (`kitap = ""`). `vitrin` ise hatasız ama sessizce bozuk derleniyordu.
Karar: Veri dosyaları yalnızca `export default` taşır. Saf çözümleyiciler (`publishedBooks`, `resolveAuthors`, `resolveVitrin`, `resolveCampaigns`) `scripts/cms/resolvers.mjs`'e taşındı; CMS testleri oradan içe aktarır.
Sonuç: Yeni veri dosyasına yardımcı export eklemeyin; testlerinizi `resolvers.mjs`'e yazın. Derleme çıktısındaki "Wrote N files" tek başına doğrulama sayılmaz: bozuk veri dosyası hatasız derlenebilir (e2e/içerik doğrulaması şart).

## ADR-012 14 Ekim "yeni vitrin + yönetim paneli" çalışmasının korunması

Tarih: 16 Ekim 2026.
Bağlam: 14 Ekim 14:51-15:06 arasında başka bir oturum commit'siz bir yeniden tasarım ve CMS yazmıştı (`docs/plans/2026-10-14-yeniden-tasarim.md`): arama çubuklu başlık, duyuru slaytı, yuvarlak yazar şeridi, kategori karoları, kitap/yazar/duyuru yönetim paneli (`scripts/cms/`, `/yonetim/`). Derlenmiyordu (ADR-011) ve ana sayfadaki önizleme tetikleyicisi (`data-onizleme`) kaybolmuştu.
Karar: Çalışma düzeltilip `f80b45b` olarak ayrı bir geri dönüş commit'iyle kaydedildi; üzerine Beyaz Vitrin giydirildi (ADR-010). Önizleme tetikleyicisi geri getirildi: hero kapağı, hero ikincil düğmesi ve önizlemeli raf kartlarındaki "Önizle" rozeti.
Sonuç: Yönetim paneli yerel Node sunucusudur (`npm run cms`, varsayılan port 8090); GitHub Pages yalnız statik kataloğu sunar, canlı panel için kalıcı diskli bir Node barındırması gerekir (plan belgesi). `/yonetim/` `noindex`, sitemap ve SEO beklentilerinin dışındadır (`tests/yardimci/dist.ts`, `scripts/qa/dogrula.py`). Kimlik bilgileri ve yedekler `.local/` altındadır ve git'e girmez.

## ADR-013 Üst barda doğrudan WhatsApp logosu

Tarih: 16 Ekim 2026.
Bağlam: Üst barda "Satış noktaları" bağlantısı vardı. Kullanıcı, satış yeri bağlantısı yerine orijinal WhatsApp logosunun doğrudan bir numaraya yazdırmasını istedi (numara ayrıca verilecek).
Karar: Bağlantı kaldırıldı; yerine resmî WhatsApp glifi (yeşil daire, beyaz logo) `site.whatsapp_url` adresine yeni sekmede açılır. "Nereden alınır" menüde ve ana sayfa bölümünde durur. WhatsApp yeşili (`--c-whatsapp`) marka işareti olduğu için "tek kırmızı vurgu" kuralının tek istisnasıdır.
Sonuç: Numara bekleniyor; verilene kadar sitenin mevcut tek WhatsApp adresi (`data/site/site.json`) kullanılır. (ADR-015 ile numara tek kaynağa bağlandı: `site.json` değişince sayfa metinleri, meta açıklamaları, kitap sipariş bağlantıları, e2e testi ve `dogrula.py` aynı değeri okur; yedek sabitler kaldırıldı.)

## ADR-014 Marka betiği logoyu ezmez

Tarih: 16 Ekim 2026.
Bağlam: `public/logo/islambol-logo*.png` yayınevinin gönderdiği PNG'den (`islambol-logo-kaynak.png`) türetilmiş 480x480 dosyalardır; `scripts/gorsel/marka.mjs` ise yalnızca eski 400 px JPEG'den üretebilir. Betik düzenlendiğinde dosya zamanı "bayat" saydırıp logoyu düşük kaliteli büyütmeyle ezdi (fark yakalanıp geri alındı).
Karar: Logo üretiminin bayatlık kontrolü artık betik dosyasının zamanına bakmaz; yalnız `--force` ile yenilenir.
Sonuç: `npm run gorsel` favicon, manifest ve OG görsellerini yeniler, logoya dokunmaz. Vektör logo gelirse `marka.mjs`'e doğru kaynak tanıtılmalıdır.

## ADR-015 Yönetim paneli kapsamı: site ayarları, vitrin, sayfa metinleri, önizleme yükleme

Tarih: 16 Ekim 2026.
Bağlam: Kullanıcı (yayınevi sahibi, teknik değil) "ekleme çıkarma, kitap ekleme çıkarma, her şeyi yapan basit arayüzlü yönetici paneli" istedi. 14 Ekim'de kitap/yazar/duyuru için yerel bir panel (`scripts/cms/`) zaten vardı; site bilgileri, vitrin, sayfa metinleri ve önizleme sayfaları dosya düzenleme gerektiriyordu.
Karar:
- Panel yerel kalır (`127.0.0.1`, scrypt şifre, oturum çerezi + CSRF, CSP `script-src 'self'`). GitHub Pages statik olduğu için panel orada çalışamaz; yayın ayrı adımdır (commit + push). Barındırılan bir panel (sunucu/veritabanı) ayrı bir karardır ve istenmedi.
- Mevcut işlem hattı (anlık görüntü → doğrula → yedek + günlük → yaz → derle; hata olursa geri al) genelleştirildi: `store.transact`. Yeni işlemler: `PUT /api/admin/site`, `PUT /api/admin/vitrin`, `PUT /api/admin/pages/:slug`, `POST /api/admin/password`; `upload` artık `kind` (cover, preview, image) alır, sharp varsa genişliği sınırlar (1200/1400/1600 px) ve `width/height` döner. Sayfalar yalnızca düzenlenir (oluşturma/silme yok); kurtarma günlüğü `page:<slug>` anahtarını da bilir.
- Telefon/WhatsApp numarası tek kaynaktır: `data/site/site.json`. Panelde serbest yazılan numara sunucuda normalleştirilir (`telefon`, `telefon_gosterim`, `whatsapp_url`, `whatsapp_url_sablonu`). Sayfa metinleri ve `meta.json` açıklamaları `{telefon_gosterim}`, `{telefon}`, `{whatsapp_url}`, `{eposta}`, `{adres}`, `{sosyal_liste}` yer tutucularını derleme sırasında doldurur (`scripts/cms/tokens.mjs`; bağımlılıksız, Eleventy veri dosyaları kullanır). `books.js`/`yardimci.mjs` yedek sabitleri, e2e testi ve `dogrula.py` artık site.json'dan okur.
- Kitaba `preview_pages: [{local_path, width, height}]` (en çok 30) eklenebilir; varsa yayınevinin kitapyurdu önizlemesinin yerine geçer (`books.js → yuklenenOnizleme`). Panel yalnızca okur: `onizleme_var` (yayınevi önizlemesi var mı), kategori seçenekleri (`sozluk.json`) ve sayfa listesi sunucuda hesaplanır.
- Panel kitap kategorilerinde `sozluk.json`'daki site kategorilerini sunar; kayıtlı ham kategori adları ("Tarih > Kişiler") korunur.
Sonuç: Kitap ekle/sil/düzenle, yazar, duyuru, vitrin, sayfa metni, site ayarları ve şifre panelden yapılır. Telif: önizleme yüklerken ilk 8–10 sayfa önerilir (ADR-007). Başlatma: `yonetim-baslat.bat` (çift tık), şifre sıfırlama: `yonetim-sifre-sifirla.bat`.

## ADR-016 Yayın adresi: islambol.org (GitHub Pages + özel alan adı; ADR-006'yı günceller)

Tarih: 16 Ekim 2026.
Bağlam: Kullanıcı, Natro'dan aldığı `islambol.org` alan adında yayın istedi. Natro hesabında barındırma hizmeti yok (alan adı kayıtlı, DNS Natro'da, hosting "Mevcut Değil"). Seçenekler: Natro hosting (ücretli, elle FTP) ya da GitHub Pages + özel alan adı (ücretsiz, otomatik HTTPS, `git push` ile yayın). Kullanıcı GitHub Pages'i seçti.
Karar: Site alan adı kökünde yayınlanır: `deploy.yml`/`ci.yml` `SITE_URL=https://islambol.org`, `PATH_PREFIX=/`; `site.js`, `seo/dogrula.mjs`, `dogrula.py` varsayılanları ve `robots.txt` Sitemap satırı aynı adrese bakar. Actions ile yayınlandığından `CNAME` dosyası gerekmez; alan adı depo → Settings → Pages → Custom domain'e yazılır (DNS kayıtlarından önce). DNS (Natro): apex için GitHub Pages A (ve isteğe bağlı AAAA) kayıtları, `www` için `adursak63.github.io` CNAME'i; değerler GitHub belgesinden doğrulandı (README "Özel alan adı").
Sonuç: Depo tarafı hazır; yayın için kullanıcıdan gereken: `gh auth login` + depoyu oluşturup push, Pages kaynağı "GitHub Actions", Custom domain ve Natro DNS kayıtları. Alan adı bağlanana kadar `github.io/islambol-yayinlari/` adresi kök derlemesiyle kırık görünür (geçici çözüm README'de). Yönetim paneli (ADR-015) yine yalnızca yerelde çalışır. Not: alan adı 16 Aralık 2026'da yenilenir (Natro'da otomatik yenileme açık).
