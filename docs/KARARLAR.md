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
