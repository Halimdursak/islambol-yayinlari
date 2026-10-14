# Seçenek 1 — Beyaz Vitrin

## Konsept
apple.com ürün sayfasının açık modu: beyaz zemin ile #f5f5f7 bölüm bantları dönüşümlü, krom neredeyse yok, sahnede yalnızca kitap. Hero'da dev ortalanmış manşet, altında tek kapak hafif perspektifle "ürün fotoğrafı" gibi durur; kitaplar Apple Books rafı gibi yatay kaydırmalı şeritlerde akar. Derinlik yalnızca gölge ve bant kontrastıyla kurulur; gradient yok.

## Palet
- Zemin: `#ffffff` · Bant: `#f5f5f7`
- Metin: `#1d1d1f` · İkincil ve üçüncül: `#6e6e73` (beyazda 5,1:1; önceki `#86868b` AA eşiğini geçmiyordu)
- Çizgi: `#d2d2d7` · Dolgu (ikincil düğme, ok): `#e8e8ed`
- Vurgu (yalnız CTA ve rozet): `#d11a2a` · hover `#b5151f`

## Tipografi
Yığın: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Helvetica Neue', Arial, sans-serif` (web yedeği Google Fonts Inter 400/500/600/700, latin-ext).
- Hero manşet: clamp(44px, 5.6vw, 80px), 600, izleme -0.03em, satır 1.03
- Bölüm başlığı: clamp(32px, 4vw, 48px), 600, -0.025em
- Gövde 17px/1.47 · giriş metni 19–23px · kart başlığı 17px 600 · yazar 15px gri · mikro 13px
- Düğmeler 980px kapsül, 44px yükseklik; kartlar 20px köşe; büyük modüller 28px

## Hareket
- Kaydırmada hafif açılma (IntersectionObserver, 600ms ease-out, 18px yukarı kayma, 70ms kademeli gecikme)
- Hero kapağı rotateY(-7°) ile durur, hover'da 600ms'de düzleşir
- Kart hover: 4px yükselme + gölge büyümesi (300ms)
- Raflar scroll-snap; daire oklarla iki kart adımıyla kayar
- `prefers-reduced-motion` açıkken tüm geçişler kapalı

## Neden premium
1. Kapak fotoğraflarının beyazımsı zemini beyaza eritildi; kitap kesilmeden, kutusuz, kendi gölgesiyle "sahnede" durur. `mix-blend-mode: multiply` dönen kabın kendisinde durur (img'de değil), temas gölgesi kısa ve dar tutuldu.
2. Tek vurgu rengi (logonun kırmızısı) yalnızca iki yerde: kapsül CTA ve "Önizleme" rozeti. Geri kalan her şey nötr; hiyerarşiyi ölçek ve boşluk kurar.
3. Tüm veri gerçek: 6 önizlemeli, 8 yeni çıkan, 8 yazar ve 78/36/9/7 sayıları JSON ve dosya sisteminden betikle üretilir; fiyat, sahte yorum, lorem ipsum yok.

## Dosyalar
- `uret.mjs` — JSON'dan `index.html` ve `kitap.html` üretir (`node docs/design/secenekler/secenek-1/uret.mjs`)
- `ekran.mjs` — Playwright (msedge) ile 4 ekran görüntüsü + 390/768/1440 yatay taşma denetimi

## Eleştiri sonrası
Tasarım direktörü 6,5/10 verdi; yüksek ve orta önemli bulguların tamamı uygulandı.

**Uygulananlar**
1. **Kapak sahnesi:** `mix-blend-mode:multiply` transform'lu `.stage-book` kabına taşındı, img normal blend + `brightness(1.04)`; kutu kenarları ve gölge kesiği kalktı (index.html ve kitap.html). CSS gölgesi küçültüldü (sol/sağ %14, 28 px, blur 24 px) ki fotoğrafa pişmiş zemin gölgesiyle çift basılmasın. İlk ekranda kapak payı: sahne boşluğu 56 → 28 px, hero üst boşluğu 52 → 40 px, manşet 88 → 80 px; 1440x900'de kapağın ~%80'i görünüyor (önceki ~%70).
2. **Raf kartları:** başlıklardaki `line-clamp` tamamen kaldırıldı (direktör 3 satır öneriyordu; 55 karakterlik adlar 390 px'te 4 satıra çıktığı için 3 de kesecekti). Hiçbir kitap adı kesilmiyor, `text-wrap:balance`. Önizleme rozeti kapağı örtmesin diye kartın altına, çip olarak alındı (`.card--badge`). Raf iç boşluğu 48 px üst, (bölüm boşluğu + 12) px alt; hover gölgesi artık kesilmiyor.
3. **Yazarlar:** iki sütun, ad solda, 3 mini kapak sağda (88 px yükseklik, `max-width` kısıtı yok, 3 satıra düşen ad kalmadı). 1099 px ve altında dört sütun yığını yerine Apple Books gibi yatay raf (scroll-snap, sonraki kart görünür); 390 px'te bölüm 2357 px yerine 549 px.
4. **Türkçe tipografi:** `tp()` esc() içinde: ASCII kesme → ’, `...` → …, ve/ile/bir/için/ilk/bu sonrası bölünmez boşluk. `text-wrap:balance` başlık, lead, özet ve kitap adında; `pretty` paragraflarda. Sonuç: "Tarihi belgeyle / ve tanıklıkla okuyun", özetin son satırı "düşüncesi eserleri ve Osmanlıca tıpkıbasımlar." Üçüncül metin rengi #6e6e73.
5. **Yayın çizgisi / Nereden alınır:** istatistikler ortalandı (max 760 px, rakamlar 64 px'e kadar). Sol kart telefon numarasını başlık yaptı (yinelenen "WhatsApp'tan sipariş ver" cümlesi kalktı, etiket "Telefon ve WhatsApp"), iki modül aynı yükseklikte; satış kanalları tek beyaz gruplu liste (ince ayırıcı, hover'da zemin tonu). Not satırı gruptan çıkarıldı.
6. **Krom:** menü logo ile CTA arasında ortalandı; nav WhatsApp düğmesi nötr (#1d1d1f), kırmızı yalnız hero CTA ve rozette; ≤640 px'te CTA'lar eşit genişlikte (300 px) ve alt alta, `btn-sm` 40 px; dokunmatikte (`hover:none`) raf okları gizli; `[data-reveal]{opacity:0}` yalnız `@media (scripting:enabled)` içinde, JS kapalıyken içerik görünür (doğrulandı).

**Atlanan / bilinçli sapma**
- Direktörün `.card h3{line-clamp:3}` önerisi yerine kesme tümden kaldırıldı (gerekçe yukarıda); kart yükseklikleri raf içinde eşitlenir, kısa başlıklı kartın altında boşluk kalır, rozet kart tabanına sabit.
- İkincil ve üçüncül gri aynı değere (#6e6e73) indi; kademe artık yalnızca ölçekle kuruluyor.
- 1099 px ve altında yazar kartı satır düzeni başlığa ~150 px bıraktığı için dikey kart + raf düzenine geçer (direktörün 640 px eşiği yerine).
- Mobilde nav düğmesi 40 px (44 px, 52 px'lik nav içinde sıkışırdı); 44 px hedef sayfa gövdesindeki düğmelerde korundu.

**Doğrulama:** 390 / 768 / 1440 px'te index.html ve kitap.html için `scrollWidth = innerWidth`; ana-1440, ana-390, kitap-1440 ve hero-1440 yeniden alındı ve gözle kontrol edildi.
