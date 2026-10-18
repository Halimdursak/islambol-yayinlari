# Mimari Karar Kayıtları (ADR)

Her karar: Bağlam → Seçenekler → Karar → Sonuçlar. Tarih: 11 Ekim 2026.

## ADR-001 Site türü: tanıtım + katalog, mağaza değil

Bağlam: Yayınevinin kendi e-ticareti yok; satış WhatsApp (0505 980 87 35), Küresel Kitap, Kitapyurdu, Hepsiburada, Trendyol üzerinden. Türk yayınevi siteleri (Ketebe, Timaş, Erkam, Semerkand) neredeyse tamamen mağaza.
Seçenekler: (a) mağaza klonu (sepet, ödeme) (b) tanıtım + "nereden alınır" + WhatsApp sipariş CTA (c) sadece vitrin.
Karar: (b). Ödeme altyapısı, stok, KVKK yükü yok; yayınevinin gerçek satış akışına bağlanır.
Sonuç: Site fiyat göstermez (eskir) [bu cümle ADR-018 ile değişti: yalnız liste fiyatı gösterilir]; her kitapta kaynak mağaza bağlantıları + WhatsApp "Sipariş ver" bağlantısı (`https://wa.me/905059808735?text=...` kitap adı önceden dolu).

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
Karar: Site alan adı kökünde yayınlanır: `deploy.yml`/`ci.yml` `SITE_URL=https://islambol.org`, `PATH_PREFIX=/`; `site.js`, `seo/dogrula.mjs`, `dogrula.py` varsayılanları ve `robots.txt` Sitemap satırı aynı adrese bakar. Actions ile yayınlandığından `CNAME` dosyası gerekmez; alan adı depo → Settings → Pages → Custom domain'e yazılır (DNS kayıtlarından önce). DNS (Natro): apex için GitHub Pages A (ve isteğe bağlı AAAA) kayıtları, `www` için `halimdursak.github.io` CNAME'i (GitHub hesabı `Halimdursak`, depo `Halimdursak/islambol-yayinlari`; Pages kaynağı Actions ve Custom domain `islambol.org` API ile ayarlandı); değerler GitHub belgesinden doğrulandı (README "Özel alan adı").
Sonuç (tamamlandı, 18 Ekim 2026): Site https://islambol.org adresinde yayında, HTTPS zorunlu, sertifika GitHub'dan (otomatik yenilenir). Natro'da DNS kaydı (A/CNAME) düzenlemek ücretli olduğundan (Profesyonel DNS) DNS yönetimi **Cloudflare ücretsiz planına** taşındı: Natro'daki nameserver'lar `clyde.ns.cloudflare.com` ve `julissa.ns.cloudflare.com`; Cloudflare'de `@` için 4 A kaydı (185.199.108–111.153) ve `www` CNAME → `halimdursak.github.io`, hepsi "DNS only" (gri bulut). **Cloudflare hesabı silinmemeli**; kayıt değişikliği orada yapılır. Yönetim paneli (ADR-015) yine yalnızca yerelde çalışır. Not: alan adı 16 Aralık 2026'da yenilenir (Natro'da otomatik yenileme açık).

## ADR-018 Liste fiyatı sitede gösterilir (ADR-001'in fiyat kısmını değiştirir)

Tarih: 18 Ekim 2026.
Bağlam: ADR-001 sitenin fiyat göstermemesine karar vermişti ("eskir"). Yayınevi sahibi 18 Ekim'de "kitapların fiyatlarını diğer kitapçılardan iyice öğren, teyit et; sitedeki liste fiyatlarını koy" dedi.
Karar: Her kitapta yalnızca **liste (etiket) fiyatı** gösterilir (kartta "500 ₺", kitap sayfasında "Liste fiyatı 500 ₺" + "Satış sitelerinde indirimli olabilir; güncel fiyat için satış sayfasına bakın."). Kampanya/indirimli fiyat, üstü çizili fiyat, `Book.offers` ve metinde "TL" fiyatı yine yoktur. Veri `price_list_try` alanıdır (boşsa fiyat gösterilmez); yönetim panelinde "Liste fiyatı (₺)" alanından değişir. Kural: yalnızca en az iki satış sitesinde birbirini tutan fiyat yayına girer.
Doğrulama (18 Ekim 2026, 78 kayıt): Kitapyurdu liste fiyatı (katalogdaki kaynak) ↔ Nobel Kitap liste fiyatı ↔ Küresel Kitap (liste fiyatı; Küresel yayınevi kitaplarında tutarlı biçimde listenin %50'sini satış fiyatı yapıyor). Nobel'de bulunan 59 kitaptan 58'inde liste fiyatı katalogla birebir aynı, 1'i düzeltildi (Kemalistlerin Din Düşmanlığı 200 → 250; Nobel ve Küresel 250). Küresel ürün sayfalarındaki açık "liste fiyatı" 73 kitapta katalog ve Nobel ile birebir aynı çıktı (çelişki yok); Nobel'de olmayan kitaplar bu şekilde Küresel ile teyit edildi. Fiyatı yayınlanmayan 3 kayıt: Gözyaşı Denizi (Kitapyurdu 400 ≠ Küresel 300, yayınevinden teyit bekliyor), Cumhuriyet'in İlk Yıllarında Satılan Camiler ve General Cevat Rıfat Atilhan Kitaplığı (tek kaynak, Küresel'de liste yok). Hepsiburada'da "Hayat ve Hatıratım 4 Cilt" 1.999 TL görünüyor (diğer üç sitede 3.200 liste); satıcıya özgü kampanya sayıldı, esas alınmadı.
Sonuç: `tests/e2e/fiyat.spec.ts` fiyatın veriyle birebir aynı olduğunu, "₺"nin yalnızca fiyat öğelerinde geçtiğini ve JSON-LD'de offers olmadığını denetler. Eskime riski: fiyatlar değişirse veri güncellenmelidir (panelden). Nobel'de bulunup katalogda kaynağı eksik 12 kitaba Nobel bağlantısı eklendi (ISBN'le eşleştirildi).

## ADR-017 Mobil kalite sözleşmesi

Tarih: 18 Ekim 2026.
Bağlam: Kullanıcı canlı sitede mobil görünümün "çok kötü" olduğunu söyledi. Telefon koşullarında (dokunmatik, DPR 3, mobil UA) ölçüm: 12 sayfa × 3 cihazda yatay taşma yoktu, ama (1) sistem yazı tipi %150–200 olunca sayfa yatay genişleyip mobil tarayıcıda küçülüyordu (düğme/telefon/e-posta `nowrap`, alt bilgi sütunları), (2) katalogda süzgeç formu `hidden` gelip JS ile açıldığı için liste ~370 px aşağı sıçrıyordu (CLS 0,357), (3) sipariş düğmesi kitap sayfasında kapağın altındaydı, (4) dokunma hedefleri 19–40 px, 12 px yazılar vardı, (5) yatay telefonda önizleme sayfası ekranın ~%35'ine sıkışıyordu, (6) üst bar 800×800 PNG'yi kırpıp yüklüyordu (42 KB).
Karar: DESIGN.md §3.1 "Mobil sözleşmesi": taşma yok (%200 yazıya kadar), dokunma hedefi ≥ 44 px (`pointer: coarse` + üst bar), yazı ≥ 13 px, CLS < 0,05, sipariş düğmesi ilk ekranda, uzun listede "başa dön", yatay önizleme düzeni, kısa etiketli "Menü" düğmesi, önceden kırpılmış WebP logo. `tests/e2e/mobil.spec.ts` bunları ölçer (17 test) ve regresyonu yakalar. Denenip **eklenmeyenler**: `content-visibility: auto` (6× yavaş CPU'da uzun kareler üretti, 18 ms → 287 ms tepe), üst bar bulanıklığını kaldırma ve `multiply`'ı kapatma (kaydırma zaten akıcı, kazanç yok).
Sonuç: Katalog CLS 0,357 → 0,000; katalog LCP 2,4 s → 1,4 s (yavaş 4G + 4× CPU); katalog 860 → 734 KB; küçük yazı ve 44 px altı hedefler giderildi. Doğrulanamayanlar: gerçek iOS Safari ve gerçek Android cihaz (yalnız Edge/Chromium emülasyonu), Firefox.

## ADR-019 Yayınevinin baskı dosyalarından kapak, arka kapak ve yeni kitaplar

Tarih: 18 Ekim 2026.
Bağlam: Yayınevi yeni kitapları ve yeni baskıları `data/KITAPLAR/` altında verdi: 21 baskı kapak PDF'i (arka + sırt + ön yayılım, CMYK, kimi kırpma işaretli), 10 WhatsApp 3B görseli (tanıtım) ve "Son Halifenin Dramı" iç sayfaları (80 sayfa). Bu makinede Pillow/Ghostscript/mutool yok (Uygulama Denetimi native modülü engelliyor), `sharp` PDF okumaz, `pypdf`'in görsel çıkarımı Pillow ister. CMYK JPEG'ler saklı hâlde "ters" (255 = mürekkep yok); naif dönüşüm negatif görüntü verir.
Karar: PDF sayfaları Edge içinde **pdf.js** (saf JS) ile 300 dpi çizilir (renk, vektör yazı ve barkod doğru gelir); ön/arka panel kesim kutusundan kırpılır (kutu: PDF TrimBox'ı, yoksa sayfa − 0,5 cm taşma; panel genişliği kitap genişliği 13,5 / 16,5 cm; sırt hesabı 0,4–3,7 cm arası çıktı, tutarlı). Betik: `scripts/gorsel/baski-kapaklari.mjs` (`npm i --no-save pdfjs-dist@3.11.174`; `package.json`a yazılmaz). Ön kapak `public/kapaklar/<id>.jpg` (1200 px), arka kapak `public/kapaklar-arka/<id>.jpg|webp` (800 px) ve `books.json → back_cover {local_path, webp_path, width, height}`. Kitap sayfasında "Ön kapak / Arka kapak" seçicisi (JS yokken gizli, `<noscript>` bağlantısı arka kapağı açar; iki yüz aynı ızgara hücresinde olduğundan CLS yok); arka yüzde "Büyüt" bağlantısı görseli yeni sekmede açar.
Uygulanan: (1) 3 yeni kitap eklendi: Devlet-i Osmaniye ve Siyonistler (Mevlânzâde Rıfat Bey), Millî Din Duygusu ve Öz Türk Dini (A. İbrahim), Kur'an-ı Kerim'de … Peygamberlerin … Sunumu ve Mucizeleri (Ali Altunsoy). ISBN'ler arka kapak barkodundan okundu (EAN-13 sağlama basamağı doğrulandı); açıklamalar arka kapak metni; sayfa sayısı, boyut, fiyat çevrimiçi satış sayfaları çıkana dek boş (uydurulmadı; yayın tarihi "2026-10"). (2) Katalogdaki 18 kitabın kapağı resmî düz ön kapakla değiştirildi (eskiler Küresel/Kitapyurdu 3B görselleriydi, kimi "KÜRESELKİTAP" filigranlı ve 2000×2000 beyaz zeminliydi) ve 21 kitaba arka kapak eklendi. (3) Yeni baskılar: Kemalistlerin Din Düşmanlığı ve Türk'ün Yeni Âmentüsü "3. Baskı", Atatürk'ün Uşağının Gizli Defteri ve Son Halifenin Dramı "2. Baskı" (kapak yüzünde ve tanıtım görselinde yazılı). (4) Veri düzeltmeleri: Son Halifenin Dramı'nın yazarı Cevat Rıfat Atilhan değil **Manavoğlu Nevres Bey** (kapak, iç sayfadaki künye ve Küresel bağlantısı); Türk'ün Yeni Âmentüsü'nün yazarı "Komisyon" değil **Sâfî** (kapak; alt başlık "Kemalist Din Telakkisi 1"). (5) Son Halifenin Dramı önizlemesi yayınevinin 2. baskı iç sayfalarının ilk 10 sayfasıyla değiştirildi (`preview_pages`, 1402×2042 px; öncekiler 655×1000 Kitapyurdu görselleriydi).
Sonuç: `tests/e2e/arka-kapak.spec.ts` (seçici, yüz değişimi, yükseklik oynamaması, görsel yüklenmesi, 10 sayfalık önizleme). Ham PDF'ler ve zip `.gitignore`dadır (baskı dosyaları herkese açık depoya girmez). Bilinen sınırlar: arka kapak yüklemesi yönetim panelinde yok (betik/JSON ile); Kemalistlerin Din Düşmanlığı'nın 3. baskı baskı dosyası 13,5×19,5 cm'dir, katalog künyesi mağaza verisiyle 13,5×21 cm'de bırakıldı (teyit bekliyor).
