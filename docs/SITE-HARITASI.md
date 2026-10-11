# İslambol Yayınları — Site Haritası ve Bilgi Mimarisi

Hazırlayan: D2 (Bilgi Mimarı & İçerik Yazarı) · Tarih: 2026-10-11 · Dayanak: ADR-001 (mağaza yok), ADR-007 (telif), `docs/research/rakip-analizi.md` §d–§e, `data/research/yayinevi-kimlik.json`.

Veri kaynakları: `books.json` (kitap), `authors.json` (yazar), `data/site/site.json` (iletişim, menü, satış kanalları), `data/site/sozluk.json` (kategori, dizi), `data/site/mikrometin.json` (etiketler), `data/site/meta.json` (title/description), `data/site/sayfalar/*.md` (statik sayfa gövdesi).

## 1. URL ağacı

```
/                                   Ana sayfa
├─ /kitaplar/                       Katalog (ızgara + süzgeç)
│   └─ /kitap/<id>/                 Kitap sayfası (kitap başına bir)
├─ /yazarlar/                       Yazar dizini
│   └─ /yazar/<slug>/               Yazar sayfası
├─ /diziler/                        Set ve seriler dizini (EK, bkz. §4)
│   └─ /dizi/<slug>/                Set / seri sayfası
├─ /yayin-cizgisi/
├─ /hakkimizda/
├─ /nereden-alinir/
├─ /iletisim/
├─ /onizleme-hakkinda/
├─ /kvkk-ve-cerezler/
└─ /404.html
```

Toplam: 11 sabit sayfa (`/`, `/kitaplar/`, `/yazarlar/`, `/diziler/`, `/yayin-cizgisi/`, `/hakkimizda/`, `/nereden-alinir/`, `/iletisim/`, `/onizleme-hakkinda/`, `/kvkk-ve-cerezler/`, `/404.html`) + üç şablon ailesi (`/kitap/<id>/` ≈ 66, `/yazar/<slug>/` ≈ 33, `/dizi/<slug>/` = 5; sayılar 2026-10-11 tarihli `books.json`/`authors.json`/`sozluk.json`'dan). Yaklaşık 115 çıktı sayfası.

Kategori için ayrı URL kurulmaz; `/kitaplar/?kategori=<slug>&yazar=<slug>&yil=<yyyy>` sorgu parametreleriyle süzülür (URL paylaşılabilir; JS yoksa tüm liste görünür). Kategori başına indekslenebilir sayfa istenirse §4'teki öneri 3 uygulanır.

Menü (üst): Kitaplar · Yazarlar · Set ve Seriler · Yayın Çizgisi · Nereden Alınır · Hakkımızda · İletişim. Footer: Hakkımızda · Yayın Çizgisi · Önizleme Hakkında · Nereden Alınır · İletişim · KVKK ve Çerezler + sosyal bağlantılar. Menü etiketleri `site.json`'dadır.

## 2. Sayfa kartları

### `/` Ana sayfa
- **Amaç:** Yayınevini ve çizgisini bir bakışta tanıtmak; kitaplara ve önizlemeye yönlendirmek.
- **Hedef kullanıcı:** Yeni gelen okur; X/Instagram'dan bir kitap duyurusuyla gelen ziyaretçi; tarih/hatırat meraklısı.
- **Birincil CTA:** "Kitapları incele" (`/kitaplar/`). İkincil: "Nereden alınır".
- **İçerik blokları (sırayla):**
  1. Hero: öne çıkan kitap kapağı + başlık (3 alternatif `mikrometin.json → hero_basliklar`) + alt başlık + iki CTA. Slogan "Tarihi doğru okumak için..." hero üstünde küçük "Künye şeridi" olarak.
  2. Yeni çıkanlar: son eklenen/ön siparişteki 4–6 kitap (kartta kapak, başlık, yazar; fiyat yok).
  3. Önizlemeli kitaplar: sayfa çevirme vitrini, "Önizle" düğmeli kapaklar (3–5 kitap).
  4. Yazarlar şeridi: kitap sayısına göre ilk 6 yazar (portre yoksa adlı arşiv kartı).
  5. Yayın çizgisi: 4 alanlı kısa özet + `/yayin-cizgisi/` bağlantısı.
  6. Set ve seriler: 3–5 set kartı.
  7. Nereden alınır: kanal logosuz ad listesi + WhatsApp CTA.
  8. İletişim şeridi (telefon, e-posta, sosyal).
- **Veri:** `books.json` (öne çıkan, yeni, `preview` olan), `authors.json`, `site.json`, `mikrometin.json`.
- **SEO notu:** H1 hero başlığı; `Organization` + `WebSite` JSON-LD (B5); title 56 karakter. Hero başlığı sloganın tekrarı olmamalı (slogan metin içinde ayrı geçer).

### `/kitaplar/` Katalog
- **Amaç:** Tüm kitapları bulunur kılmak (rakip analizi §d-1,2,6).
- **Hedef kullanıcı:** Belirli bir konuyu/yazarı arayan okur.
- **Birincil CTA:** Kitap kartına tıkla → `/kitap/<id>/`.
- **Bloklar:** Başlık + kayıt sayısı ("66 kayıt"); süzgeç çubuğu (kategori, yazar, yıl, serbest arama); ızgara (kapak 2:3, başlık, yazar, varsa "Yeni baskı"/"Ön sipariş" etiketi); boş durum; sayfalama yok (≈66 kayıt tek sayfada).
- **Veri:** `books.json`, `sozluk.json` (kategori adları), `mikrometin.json` (`filtre_*`, `bos_durum_*`).
- **SEO:** Sorgu parametreli adresler `canonical` = `/kitaplar/`. ItemList JSON-LD önerilir.

### `/kitap/<id>/` Kitap sayfası
- **Amaç:** Karar vermek ve ulaşmak: kitap ne, nereden alınır.
- **Hedef kullanıcı:** Kitabı seçmiş ya da paylaşılan bağlantıdan gelmiş okur.
- **Birincil CTA:** "WhatsApp'tan sipariş ver" (`https://wa.me/905059808735?text=<kitap adı, URL-kodlanmış>`). İkincil: "Önizle", "Nereden alınır" bağlantıları.
- **Bloklar:** (1) Kapak + başlık + alt başlık + yazar(lar) (yazar sayfasına bağlantılı); (2) Künye tablosu (yazar, sayfa, boyut, baskı, ISBN, dil, cilt; olmayan alan gizlenir, "—" gösterilmez); (3) Tanıtım metni (`description`); (4) Önizle düğmesi + `onizleme_notu`; (5) Nereden alınır: kitaba özgü kitabevi bağlantıları + WhatsApp; (6) Set/seri üyeliği (`dizi` bağlantısı); (7) Aynı yazardan / aynı kategoriden 3–4 kitap; (8) Kategori etiketleri.
- **Veri:** `books.json`, `authors.json`, `sozluk.json`, `site.json`.
- **SEO:** Şablon `meta.json → sablonlar.kitap`; `Book` + `Offer` YOK (fiyat gösterilmez; `Book` + `workExample` yeterli). Tanıtım metni yayınevinin kendi metni olduğu için tekrar içerik riski kapalı (kitabevi sitelerinde aynı metin var → canonical bu sayfa).

### `/yazarlar/` Yazar dizini
- **Amaç:** Yazara göre keşif; bu yayınevinde yazar adı çoğu zaman kitaptan önce gelir (Cevat Rıfat Atilhan, Seyfi Say, Ali Seyyar).
- **Hedef kullanıcı:** Belirli bir yazarın okuru.
- **Birincil CTA:** Yazar kartı → `/yazar/<slug>/`.
- **Bloklar:** Başlık + giriş cümlesi; kitap sayısına göre sıralı yazar kartları (ad, kitap sayısı, ilk 2 başlık); alfabetik atlama bağlantıları (A–Z, ≥20 yazar olduğu için).
- **Veri:** `authors.json`, `books.json` (sayım).
- **SEO:** `CollectionPage`; ad varyantları (Rıza Nur / Dr. Rıza Nur) `authors.json` alias alanına.

### `/yazar/<slug>/` Yazar sayfası
- **Amaç:** Yazarın tüm kitaplarını toplamak; yazar araması için indekslenebilir sayfa.
- **Birincil CTA:** Kitap kartı → kitap sayfası.
- **Bloklar:** Ad + (varsa) kısa biyografi (`bio`, kaynaklı; yoksa blok hiç görünmez, uydurma yok); kitap ızgarası; varsa set/seri bağlantıları.
- **Veri:** `authors.json`, `books.json`.
- **SEO:** Şablon `meta.json → sablonlar.yazar`; `Person` JSON-LD (bio varsa). Kitabı 1 olan yazarlar için de sayfa üretilir (iç bağlantı ağı), ancak `bio` yoksa ve tek kitap varsa `noindex` önerilir (ince içerik).

### `/diziler/` ve `/dizi/<slug>/` Set ve seriler
- **Amaç:** Çok ciltli eserleri bütün olarak göstermek (Hayat ve Hatıratım, Enver ve Mustafa Kemal'in Kitabı, Bilinmeyen Yönleriyle Mustafa Kemal…, GARGAT, Mevkıfu'l Akl).
- **Hedef kullanıcı:** Seti tamamlamak veya tek bir cilt yerine tüm seti almak isteyen okur.
- **Birincil CTA:** "WhatsApp'tan sipariş ver" (set adıyla) / üye kitaplara git.
- **Bloklar (`/dizi/<slug>/`):** Ad + açıklama (`sozluk.json`); üye ciltler (sıralı, kapaklı); set hakkında not (cilt sayısı, toplam sayfa — yalnızca `books.json`'da varsa); nereden alınır.
- **Veri:** `sozluk.json → diziler`, `books.json` (`is_set`, `set_info`, `series`).
- **SEO:** Şablon `meta.json → sablonlar.dizi`; `CollectionPage`.

### `/yayin-cizgisi/`
- **Amaç:** Yayınevinin hangi alanlarda yayın yaptığını "manifesto" olmadan, kataloğa dayanarak anlatmak.
- **Hedef kullanıcı:** Yayınevini tanımak, güvenilirliğini tartmak isteyen okur; basın, kütüphaneci.
- **Birincil CTA:** "Kataloğu incele" (`/kitaplar/`).
- **Bloklar:** Giriş; beş alan (yakın tarih, hatırat, arşiv/belge, İslam düşüncesi, edebiyat) her biri 2–3 cümle + ilgili kategori bağlantısı; yayın ilkeleri (şimdilik `[[SORU]]`).
- **Veri:** `sayfalar/yayin-cizgisi.md`, `sozluk.json`.
- **SEO:** Bilgi sayfası; `AboutPage`.

### `/hakkimizda/`
- **Amaç:** Yayınevini somut, doğrulanabilir bilgiyle tanıtmak.
- **Birincil CTA:** "İletişim".
- **Bloklar:** 180–280 kelime metin: konum, yayın alanı, yazarlar, satış yolu; bilinmeyenler `[[SORU]]` işaretli (kuruluş yılı, kurucu, kitap sayısı, yayın kurulu).
- **Veri:** `sayfalar/hakkimizda.md`, `site.json`.
- **SEO:** `Organization` JSON-LD (`sameAs` = sosyal hesaplar).

### `/nereden-alinir/`
- **Amaç:** Satın alma yolunu tek yerde toplamak (rakip analizi §d-10).
- **Birincil CTA:** "WhatsApp'tan sipariş ver" + kanal bağlantıları.
- **Bloklar:** Kanal listesi (Küresel Kitap, Kitapyurdu, Nobel Kitap, Hepsiburada, Trendyol) — URL'si olmayan kanal gizlenir; WhatsApp hattı; ödeme/kargo notu (`[[SORU]]`); ön siparişler.
- **Veri:** `sayfalar/nereden-alinir.md`, `site.json → satis_kanallari`.
- **SEO:** Fiyat yok; bağlantılar `rel="noopener"` + dış bağlantı etiketi.

### `/iletisim/`
- **Amaç:** Hızlı ulaşım.
- **Birincil CTA:** WhatsApp bağlantısı.
- **Bloklar:** Telefon/WhatsApp, e-posta, adres (Fatih), sosyal hesaplar; form YOK (kullanıcı verisi toplanmaz, EKIP.md ortak kural 5).
- **Veri:** `sayfalar/iletisim.md`, `site.json`.
- **SEO:** `ContactPoint`; tıklanabilir `tel:` ve `mailto:`.

### `/onizleme-hakkinda/`
- **Amaç:** Sayfa çevirmeli önizlemeyi ve telif sınırını açıklamak (ADR-007).
- **Birincil CTA:** "Önizlemeli kitapları gör" (ana sayfa bloğu ya da `/kitaplar/?onizleme=1`).
- **Bloklar:** Nedir, hangi sayfalar (en fazla ilk 8–10), nasıl kullanılır (klavye/dokunma), telif notu.
- **Veri:** `sayfalar/onizleme-hakkinda.md`.
- **SEO:** Düşük öncelikli; footer'dan bağlanır, `Önizle` düğmesinin yanında "bilgi" bağlantısı olarak da verilir.

### `/kvkk-ve-cerezler/`
- **Amaç:** Çerez/analitik kullanılmadığını ve veri işlenme sınırlarını söylemek.
- **Birincil CTA:** Yok (bilgilendirme); e-posta bağlantısı.
- **Bloklar:** Çerezler (kullanılmıyor + koşullu paragraf), toplanan veri, iletişim kanalları, harici bağlantılar, haklar.
- **Veri:** `sayfalar/kvkk-ve-cerezler.md`.
- **SEO:** `noindex` gerekmez; footer bağlantısı.

### `/404.html`
- **Amaç:** Kaybolan kullanıcıyı kataloga ve ana sayfaya yönlendirmek.
- **Birincil CTA:** "Ana sayfaya dön".
- **Bloklar:** Başlık, tek cümle, üç bağlantı.
- **Veri:** `sayfalar/404.md`, `mikrometin.json`.
- **SEO:** `noindex`, HTTP 404.

## 3. Rakip bulgularıyla eşleme

| Rakip bulgusu (§d/§e) | Bu haritada |
|---|---|
| d1 Vitrin: yeni çıkanlar | Ana sayfa blok 2 |
| d2 Kitap kartı | `/kitaplar/` ızgara (fiyatsız) |
| d3 Künye + tanıtım | `/kitap/<id>/` bloklar 2–3 |
| d4 Yazar sayfası/listesi | `/yazarlar/`, `/yazar/<slug>/` |
| d5 Dizi/kitaplık | `/diziler/`, `/dizi/<slug>/` |
| d6 Kategori + arama | `/kitaplar/` süzgeç + arama |
| d7 Bülten | Kasıtlı yok (veri toplamama kararı); yerine WhatsApp ve sosyal bağlantılar |
| d8 İletişim, KVKK | `/iletisim/`, `/kvkk-ve-cerezler/` |
| d9 Sosyal bağlantılar | Footer + `/iletisim/` |
| d10 Satış yolu | Kitap sayfası blok 5, `/nereden-alinir/` |
| e3 Okuma örneği (sayfa çevirmeli) | Ana sayfa blok 3, kitap sayfası blok 4, `/onizleme-hakkinda/` |
| e5 Editoryal tipografi | D1 tasarım sistemi |
| e7 Tükenmiş/özel baskı rafı | Öneri 2 (§4) |
| e8 Yazar/seri/ürün arşivleri | `/yazarlar/`, `/diziler/`, `/kitaplar/` |

## 4. Eklenen ve önerilen sayfalar

1. **`/diziler/` (EKLENDİ):** İstenen listede yalnızca `/dizi/<slug>/` vardı. Dizin sayfası olmadan setler menüden bulunamaz ve breadcrumb kırılır; set sayısı az (5) ama okuru toplu alım yoluna götürür.
2. **Tükenen/ön sipariş rafı (ÖNERİ, sayfa değil süzgeç):** `/kitaplar/?durum=on-siparis` ve `?durum=tukenmek-uzere`. Yayınevinin X'te kullandığı iki durum (Put Adam "tükenmek üzere", GARGAT ön sipariş) bunu gerektiriyor; `books.json`'da `durum` alanı yok, R1/Direktör eklerse etkinleşir. Bu alan olmazsa süzgeç gizlenir.
3. **Kategori sayfaları (ÖNERİ):** `/kategori/<slug>/` her kategori için kısa metin (`sozluk.json → aciklama`) + kitaplar; arama niyetine ("rıza nur hatıratı", "osmanlı tarihi kitapları") cevap verir. İlk sürümde süzgeçle yetinilir, ek iş küçük olduğu için Direktör onayıyla eklenir.
4. **`/haberler/` (KASITLI YOK):** Rakiplerde zayıf olduğu için gerekmiyor; yayınevinin duyuru kanalı X. Ana sayfaya X'ten son gönderiler gömülmez (üçüncü taraf betik = çerez/izleme).
5. **`sitemap.xml`, `robots.txt`, `llms.txt` (B5):** Bu haritadaki tüm URL'ler sitemap'e girer; 404 ve sorgu parametreli adresler girmez.

## 5. İç bağlantı ve gezinti kuralları

- Kitap → yazar, dizi, kategori süzgeci; yazar → kitaplar; dizi → ciltler.
- Her sayfanın altında "Nereden alınır" şeridi (tek tip) ve WhatsApp bağlantısı.
- Breadcrumb: Ana sayfa › Kitaplar › Kitap adı; Ana sayfa › Yazarlar › Yazar adı; Ana sayfa › Set ve Seriler › Dizi adı.
- Kullanıcıya kayıt/form/bülten yok; çerez yok; üçüncü taraf betik yok.

## Direktöre sorular

1. **Kuruluş yılı, kurucu/yayın yönetmeni ve yayın kurulu** bilgisi paylaşılacak mı? Hakkımızda sayfasının en zayıf yeri burası; yayınevi sahibinden alınmalı.
2. **Trendyol mağaza bağlantısı ve ödeme/kargo/toptan satış ayrıntıları** (WhatsApp siparişinde havale, kapıda ödeme, kargo) yayınevinden alınabilir mi? `/nereden-alinir/` bununla tamamlanır.
3. **Fiyat sorusu:** X gönderilerinde fiyat ve kampanya yazıyor ("700 TL", "300 TL"). Site fiyat göstermiyor (ADR-001); bu kararın yayınevi sahibiyle teyidi ve metinlerde "Güncel fiyat için satış sayfasına bakın" notunun kabulü gerekli.
4. **Kategori adlarının uzlaştırılması:** `sozluk.json` kategorileri kitapçı sitelerindeki adlardan kuruldu; R1'in `books.json` sonrası eşleştirmesi ile ("Tarih > Türkiye" vs "Türkiye ve Cumhuriyet Tarihi") birleştirilecek mi, yoksa 7 kategori sabit kalacak mı?
5. **Önizlemenin kullanım koşulları** (alıntı/paylaşım izni) için yayınevinin resmî bir ifadesi var mı? Yoksa `/onizleme-hakkinda/` sade tutulur.

## Varsayımlar

- Kitap sayısı (66) yalnızca 2026-10-11 tarihli `books.json` sayımıdır; sitede sabit sayı yazılmaz, listeden hesaplanır. Yayınevinin toplam kitap sayısı bilinmiyor (`[[SORU]]`).
- GARGAT ciltleri henüz `books.json`'da yok (yayınevinin X gönderilerinden: 1. cilt 448 sayfa, 2. cilt 460 sayfa, birlikte 908). `sozluk.json`'daki dizi üyeleri bu gönderilerden alındı; R1 kitabı eklediğinde `uye_basliklari` kitap başlığıyla eşlenir.
- "Yayın çizgisi" sayfasındaki yazar ve eser adları Direktör bilgisi ile `books.json`/X gönderilerine dayanır; İskilipli Atıf Efendi, İyad Kunaybi ve Fevzi Çakmak adları için `books.json` kaydı henüz doğrulanmadı (Q4 denetler).
- Site çerez ve analitik kullanmaz (EKIP.md ortak kural 5, ADR-001); KVKK metni buna göre yazıldı, analitik eklenirse koşullu paragraf devreye girer.
- Hero başlığı olarak üç alternatiften biri seçilene kadar `hero_basliklar[0]` kullanılır. Hiçbiri polemik, fiyat ya da "gizlenen hakikat" söylemi taşımaz; yayınevinin X tonundan bilinçli olarak sakinleştirilmiştir.
- WhatsApp bağlantısındaki kitap adı URL-kodlanır (`encodeURIComponent`); Türkçe karakterler kodlanarak korunur.
- "Künye" etiketi tasarım dilinden gelir; "Belge" ve "Kayıt" etiketleri mikrometinde tanımlıdır ama yalnızca arşiv/belge türü kitap kartlarında ve katalog sayacında kullanılmalıdır, her kitaba "belge" denmemelidir.
