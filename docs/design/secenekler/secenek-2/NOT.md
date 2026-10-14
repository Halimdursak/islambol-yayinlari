# Seçenek 2 · Pro Siyah

## Konsept (3 cümle)
iPhone Pro ürün sayfasının koyu modu bir yayınevi vitrinine çevrildi: siyah sahne, tek bir kahraman kitap, çok az krom. Her kapak, siyah sahnenin içinde açık gri bir stüdyo "plinth"inin üzerinde `multiply` ile durur; kitabın beyazımsı zemini erir, kendi gölgesi temas gölgesine dönüşür ve ürün fotoğrafı hissi verir. Bölümler #000 ve #1d1d1f arasında Apple'ın "chapter" ritmiyle dönüşür; vurgu yalnızca manşet ve tek bir bölüm başlığındaki kırmızı→amber gradyan metindir, geri kalanı beyaz kapsül düğme, cam kart ve büyük rakamlarla anlatılır.

## Palet (hex)
- Sahne: `#000000` (hero, Yeni çıkanlar, Yayın çizgisi, footer) · `#1d1d1f` (Önizlemeli, Yazarlar, Nereden alınır)
- Metin: `#f5f5f7` birincil · `#a1a1a6` ikincil · `#8e8e93` üçüncül (siyah üstünde 6.4:1, #1d1d1f üstünde 5.2:1)
- Vurgu (yalnız gradyan metin): `#ff453a` → `#ffb340`
- Kapak plinth'i (açık): `radial-gradient(120% 80% at 50% 0%, #f7f7f9 0%, #e3e3e8 60%, #cfcfd5 100%)`; yazar şeridinde `#f7f7f9 → #cdcdd3`
- Cam / hairline: `rgba(255,255,255,.06)` zemin · `rgba(255,255,255,.08)` çizgi · `rgba(255,255,255,.14)` güçlü çizgi
- Düğmeler: birincil `#f5f5f7` zemin + siyah metin · ikincil cam kapsül `rgba(255,255,255,.10)` + blur
- Gölge: `0 30px 60px rgba(0,0,0,.6)` (podyum, #1d1d1f bölümlerinde görünür)

## Tipografi
- Yığın: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Helvetica Neue', Arial, sans-serif` — web yedeği Google Fonts **Inter** 400/500/600/700 (latin-ext otomatik).
- Manşet: `clamp(40px, 5vw, 72px)`, 600, satır 1.02, izleme −0.032em (1440'ta 2 satır). Bölüm başlıkları `clamp(32px, 4.4vw, 56px)`, izleme −0.03em. Spec rakamları `clamp(48px, 6vw, 88px)`, −0.045em, tabular; etiket 17px.
- Gövde 17px / alt başlık 18–21px; nav 12px; mikro etiket 12–13px. Kapsül yarıçapı 980px; kart yarıçapları 18 / 20 / 24 / 28px.

## Hareket
- Scroll-reveal: IntersectionObserver, 640ms `cubic-bezier(.22,1,.36,1)`, 18px yukarı kayma; `prefers-reduced-motion: reduce` ise geçiş yok ve her şey anında görünür.
- Hover: kart −4px yükselir ve gölge büyür (320ms), kapak %2 ölçeklenir; yazar şeridindeki mini kapaklar 3px yukarı kalkar. Düğme basışta 0.97 ölçek.
- Kitap sayfasında açık kitap: iki sayfa ±7° `rotateY` ile hafif perspektif, önceki/sonraki ile 10 önsöz sayfası arasında gezinilir.

## Neden premium (3 madde)
1. **Tek kahraman, çok boşluk, ilk ekranda büyük rakamlar.** Hero'da yalnızca bir kitap, iki satırlık bir manşet ve iki düğme var; hemen altında 88px'lik 78 · 36 · 9 · 7 şeridi ilk ekrana oturuyor. Kapak, plinth üzerinde gerçek bir ürün fotoğrafı gibi duruyor; e-ticaret ızgarası değil ürün lansmanı hissi.
2. **Disiplinli vurgu.** Renk sadece iki yerde (manşet ve "Önizlemeli" başlığı) ve sadece gradyan metin olarak kullanılıyor; neon, blob ve dekoratif gradyan yok. Geri kalan hiyerarşi ölçek, cam ve gölgeyle kuruluyor.
3. **Gerçek veri, gerçek ölçek.** 78 · 36 · 9 · 7 spec satırı, 6 önizlemeli, 8 yeni çıkan ve 8 yazar doğrudan JSON'dan geliyor; her kapak `kapaklar-opt.json` manifestinden srcset + LQIP ile yükleniyor, 4 kitabın eksik 640/960 varyantı otomatik olarak mevcut en büyük boyuta düşüyor.

## Üretim ve doğrulama
- `node docs/design/secenekler/secenek-2/uret.mjs` → `index.html` + `kitap.html` (tek dosya, inline CSS/JS; harici yalnız Google Fonts).
- Playwright (msedge) ile 1440/768/390 genişliklerinde `scrollWidth ≤ innerWidth` doğrulandı (6 ölçüm: ana ve kitap sayfası × 3 genişlik, hepsi eşit). Fiyat basılmadı; `price_list_try` hiçbir şablonda okunmuyor.
- `vitrin_haric` 3 kitap ana sayfada hiçbir yerde yok: yeni çıkanlar listesinden ve yazar kartlarındaki mini kapak dizisinden de süzülüyor.
- Trendyol kanalı `url: null` olduğu için basılmadı (ölü bağlantı yerine 4 doğrulanmış kanal). Önizleme rozeti metni `mikrometin.onizle` ("Önizle") — istenirse "Önizleme" yapılabilir.

## Eleştiri sonrası
Tasarım direktörünün eleştirisi (6/10) şu şekilde uygulandı; hepsi `uret.mjs` içindeki CSS/üretim koduna işlendi ve sayfalar yeniden üretildi.

**Uygulananlar**
1. **Beyazımsı kapak zemini çözüldü (yüksek).** Koyu podyum yerine açık plinth: `.podium` radyal gri gradyan, `.podium img{mix-blend-mode:multiply;border-radius:0;box-shadow:none;filter:brightness(1.035)}`; `::before/::after` kapatıldı. Kapakların dikdörtgen kenarı yok oldu, kitabın baked gölgesi temas gölgesi oldu. Hero ve kitap sayfasında kapak plinth içinde %78→%88 / %86 büyütüldü (kenar görünmediği için). Yazar kartlarında aynı mantık: 118px'lik açık şerit, düz (dönüşsüz) üç mini kapak, `multiply`.
2. **Kırık yansıma kaldırıldı (yüksek).** `-webkit-box-reflect` hero ve kitap sayfası podyumundan silindi (üretilen HTML'de 0 eşleşme); derinliği plinth gradyanı ve kapağın kendi gölgesi taşıyor.
3. **Manşet 2 satıra indi (yüksek).** `clamp(40px, 5vw, 72px)`; 1440'ta "Tarihi belgeyle ve / tanıklıkla okuyun." (ölçüm: 2 satır, 72px) ve gradyan iki satırda da kırmızıdan amber'e akıyor. Eyebrow ve footer sluganındaki `...` tipografik `…` oldu (`site.slogan` verisi değişmedi, yalnız basımda dönüştürülüyor).
4. **Spec şeridi ilk ekrana alındı (orta).** Hero min-height kalktı, podyum 420px'e düştü, hero alt boşluğu spec satırına taşındı, rakamlar 48–88px. 1440×900'de rakamlar y=701–787, etiketler y≤824 (ölçüldü; ilk ekrana sığıyor, hero-1440.png'de görünüyor).
5. **İkincil metin kontrastı (orta).** `--text-3: #8e8e93` (siyah üstünde 6.44:1, #1d1d1f üstünde 5.16:1; hesaplandı).
6. **Mobil kart ve CTA kırıkları (orta).** ≤767px'te kart başlığı 15px / 1.27, yazar satırı 13px: 390'da başlıklar 3 satıra iniyor ve hizalanıyor. `.hero-note` `text-wrap:balance` (yetim "· Ocak 2026" kalktı). ≤600px'te iki CTA yan yana tek satırda (16px, ok gizli; 158+188px, 390'da ölçüldü), sığmazsa alta iniyor; kitap sayfasındaki iki CTA dikey kalır (uzun WhatsApp etiketi).

**Eleştiriyi uygularken eklenen düzeltmeler**
- `.book:hover .podium` arka planı `var(--glass-2)` ile değiştiriyordu; açık plinth'i koyu cama çevirip kapağı karartacaktı, hover artık yalnız yükseliyor/gölge büyüyor.
- Yazar şeridindeki küçük kapaklarda inline LQIP arka planı `object-fit:contain` boşluğunda döşenip "kesik çizgi" deseni üretiyordu: şerit içinde `flex:1 1 0` ile eşit üçe bölündü, `background:none!important`.
- "Önizle" rozeti açık plinth üstünde okunsun diye `rgba(29,29,31,.88)` opak koyu zemine alındı.
- Açık kitap (önsöz sayfaları) podyumu koyu cam olarak bırakıldı: beyaz sayfalar siyah sahnede daha doğru görünüyor; `.page img` için `mix-blend-mode`/`filter` sıfırlandı.
- ≤480px yazar kartı: sabit %44 genişlikli şerit + yanında ad (18px, `overflow-wrap:break-word`); "Şeyhülisla/m" gibi kelime ortasından kırılma giderildi. Kart `min-height` kaldırıldı (boş gri alan azaldı).

**Atlananlar / sapmalar**
- Eleştirideki koyu-kalma alternatifi (sharp ile flood-fill kesim, alfa kanallı WebP) uygulanmadı: brief açık plinth/multiply çözümünü de kabul ediyor ve kaynak kapak dosyalarına dokunmadan çözüm CSS'te kalıyor. Bunun bedeli, "tamamen koyu podyum" maddesinden sapmak; kapaklar artık siyah sahnede açık gri plinth'lerde duruyor (Apple Store ürün karoları gibi).
- Eyebrow'daki slugan kaldırılmadı, yalnız `…` yapıldı; slugan gerçek site verisi ve manşetle cümle olarak devam ediyor ("Tarihi doğru okumak için… / Tarihi belgeyle ve tanıklıkla okuyun.").
