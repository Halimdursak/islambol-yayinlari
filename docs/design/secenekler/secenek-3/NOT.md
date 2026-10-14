# Seçenek 3 — Cam Bento

## Konsept
visionOS / iOS widget dili: çok hafif, kapaklardan türetilmiş pastel alanların (kitap kâğıdı kremi, logo kırmızısının tozlu gülü, kapak mavisinin kurşunisi) üzerinde yüzen buzlu cam karolar. Ana sayfa tek bir bento ızgarasıdır: büyük hero karosu (kapak + manşet), katalog rakamları, koyu cam sipariş karosu, altı kapaklı önizleme rafı, 4+4 yeni çıkanlar, yazar listesi, yayın çizgisi ve satış kanalları. Kapak fotoğrafları beyaz zeminli ürün çekimi olduğu için opak beyaz bir "sahne/tepsi" içinde `mix-blend-mode: multiply` ile gösterilir; fotoğrafın kendi gölgesi gerçek gölgeye dönüşür, beyaz kutusu kaybolur.

## Palet
- Metin: `#1d1d1f` · ikincil `#5f5f64` · üçüncül `#6e6e73` (açık zeminde ~4.9:1, AA)
- Zemin: `#f2f1f4`
- Duvar kağıdı alanları (belgeye bağlı, sayfa boyunca beş durak, düşük doygunluk): krem `#eadbc6` · tozlu gül `#e7cdd6` · kurşuni mavi `#cfdbe9` · şeftali `#ead7c8` · açık mavi `#d3dcea`
- Cam: `rgba(255,255,255,.52)` (hover `.62`), hairline `rgba(255,255,255,.6)`, iç üst ışık `inset 0 1px 0 rgba(255,255,255,.85)`, `backdrop-filter: blur(32px) saturate(160%)`
- Gezinme kapsülü: `rgba(255,255,255,.74)`; kapsül arkası: `blur(18px)` + `rgba(242,241,244,.72)`, alta doğru maskeyle solar
- Koyu cam (sipariş karosu): `rgba(24,24,26,.92)`
- Vurgu, yalnızca CTA: derin kırmızı `#b3202a` (hover `#9a1a23`); koyu karoda `#c8303a` (hover `#d93a45`, beyaz yazıyla ~5.3:1)

## Tipografi
`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Helvetica Neue", Arial, sans-serif` — web yedeği Google Fonts Inter 400/500/600/700 (css2 API latin-ext alt kümesini otomatik verir).
Manşet `clamp(40px, 4.3vw, 62px)`, ağırlık 700, izleme `-0.032em`, satır 1.0. Bölüm başlıkları `clamp(26px, 2.4vw, 34px)` / 600 / `-0.025em`. Gövde 17px / 1.47 / `-0.012em`; yayın çizgisi özeti 20–25px / 500. Etiketler 11–14px, büyük harf, `+0.02em`. Düğmeler 980px kapsül, 16px / 600. Kart başlıkları 15px, hiçbir koşulda kesilmez (clamp yok).

## Hareket
- Karo: hover'da `scale(1.01)`, gölge derinleşir, cam `.52 → .62`; 300ms `cubic-bezier(.2,.7,.2,1)`.
- Scroll parallax: karo değil, karonun içeriği (`.tile > .tin`) görüş alanı merkezine uzaklığına göre `translate: 0 ±12px` (CSS `translate` özelliği, rAF ile). Karo kutuları sabit kaldığı için bento oluklar her scroll konumunda 20px'tir; 28–40px iç boşluk kaymayı kırpmaz.
- Scroll-reveal: `.rv` öğeleri görüş alanına girince 14px yukarı kayarak belirir (550ms), aynı rAF döngüsünde deterministik kontrol. Görüş alanının üstünde kalmış öğeler (çapa atlaması) anında açılır.
- Yedekler: `prefers-reduced-motion: reduce` → parallax ve reveal kapalı, geçişler yok; `@media (scripting: none)` ve `<noscript>` → `.rv` görünür; print'te cam ve arka plan kapatılır, `.rv` açıktır. (Tam sayfa ekran görüntüsü alırken sayfayı sonuna kadar kaydırmak gerekir; reveal scroll'a bağlıdır.)

## Neden premium
1. **Malzeme tutarlılığı:** tek bir cam reçetesi (blur + saturate + hairline + iç ışık) gezinme kapsülü, karolar ve mobil menüde aynı; kromun azlığı kapakları öne çıkarır. Duvar kağıdı belgeye bağlı olduğu için her bölümün arkasında farklı bir ton vardır ve karolar onu yansıtır; dikiş yok.
2. **Ürün fotoğrafı disiplini:** kapaklar Apple Books gibi beyaz sahne/tepsi üzerinde, multiply ile gerçek gölgeli; kapağın üstünde rozet, etiket ya da metin yoktur. Hero'da kapak karonun yüksekliğinin ~%62'sini kaplar. Künye, rakamlar ve etiketler gerçek veriden gelir; fiyat ve sahte istatistik yoktur.
3. **Ölçek kontrastı ve sakinlik:** 62px sıkı izlemeli manşet, 44px katalog rakamları ve 11–13px yardımcı metin arasında net hiyerarşi; tek vurgu rengi yalnızca eylemde; kart raflarında kapak, başlık+yazar ve künye satırı ayrı hizalarda oturur.

## Üretim
`node docs/design/secenekler/secenek-3/uret.mjs` → `index.html` + `kitap.html` (tek dosya, inline style/script; harici yalnızca Google Fonts).
Kaynaklar: `data/catalog/books.json` (78), `data/catalog/authors.json` (36), `data/site/vitrin.json`, `data/site/site.json`, `data/site/mikrometin.json`, `data/site/sayfalar/yayin-cizgisi.md` (ozet + alan başlıkları), `public/kapaklar-opt`, `public/onsoz-opt/sen-neden-kor-edildin`, `public/logo`.
Doğrulama: Playwright (msedge) ile 390/768/1440'ta `scrollWidth == innerWidth` (ana ve kitap), konsol hatası 0, 404 yok.

## Eleştiri sonrası
Tasarım direktörü 6.5/10 verdi; altı bulgunun tamamı uygulandı.

1. **Parallax ızgarayı kırıyordu (yüksek).** `--py` artık karoya değil `.tile > .tin`'e `translate` ile uygulanıyor; `.tile` yalnızca `scale` alıyor. Ölçüm (1440×900, scrollY 0–2100, 8 konum): tüm yatay oluklar 20px, hero/istatistik/sipariş ve yeni çıkanlar/yazarlar üst-alt kayması 0px (önceden 2–12px). `@media (scripting:none)` ve `<noscript>` ile `.rv` yedeği eklendi; NOT.md'deki "hiçbir koşulda gizli kalmaz" iddiası yukarıdaki gerçek kapsamla değiştirildi.
2. **Rozetler kapağı örtüyordu (yüksek).** "Önizleme" ve "Yeni" rozetleri kaldırıldı; kapak tepsisinde artık yalnızca görsel var. Önizleme kartında sayfa sayısı, yeni çıkanlarda ay-yıl metin satırında. Ön sipariş (gelecek tarihli) bir kitap olursa `.flag` etiketi metin bloğunda gösterilir (şu an 8 kitabın hiçbiri ön siparişte değil).
3. **Hero'da kapak küçüktü (yüksek).** Sütunlar eşitlendi (`1fr 1fr`), manşet 70 → 62px, sahne 380 → 400px ve iç boşluğu sahne genişliğine orantılı hâle getirildi (önceden kapsayıcıya göre hesaplanıyordu; mobilde kapak küçülüyordu). 1440'ta kapak 218×314 → 294×422 (karo genişliğinin %37'si, yüksekliğinin %62'si); manşet 4 satırda kalıyor, taşma yok. `sizes` değerleri yeni boyuta göre güncellendi.
4. **Kart metni kesiliyordu (orta).** Başlıkta line-clamp ve yazarda ellipsis kaldırıldı (kesilen başlık 0, kırpılan yazar 0). Kart `grid-template-rows: subgrid` ile 3 satıra bağlandı: kapak / başlık+yazar / künye. Ölçüm: 6'lı rafta künye satırları tek y'de (1244 ×6), 4'lü raflarda 1792 ×4 ve 2158 ×4. Subgrid desteklemeyen tarayıcılar için `@supports not` yedeği var.
5. **Cam okunmuyordu (orta).** `.sky` `position: fixed` yerine belgeye bağlı (`absolute`, tüm sayfa yüksekliği) ve beş durağa bölündü; y=900'deki dikiş kayboldu. Cam `.62 → .52`, ikincil/üçüncül metin `#6e6e73/#86868b → #5f5f64/#6e6e73` (AA), koyu karo `rgba(24,24,26,.92)`, koyu karoda düğme `#c8303a`.
6. **Gezinme 901–1040px'te kırılıyordu (orta).** `.menu a { white-space: nowrap }`; hamburger eşiği 900 → 1040px. Test: 901, 960, 1000, 1040'ta tek satırlı hamburger kapsülü, 1041–1200'de tek satırlı menü, `scrollWidth == innerWidth`. Kapsülün arkasına alta doğru solan bir bulanıklık ölçeği eklendi; kapsül `.74` beyaz. Mobil açılır menü, iç içe `backdrop-filter` page içeriğini bulandırmadığı için opak (`.98`) yapıldı; arkadaki koyu karo artık hayalet gibi görünmüyor.

Düşük önemli ek düzeltmeler: görüş alanının üstünde kalan `.rv` öğeleri çapa atlamasında anında açılıyor; kitap sayfası kapak `sizes` değeri güncellendi.
