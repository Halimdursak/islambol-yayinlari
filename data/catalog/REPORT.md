# İslambol Yayınları — katalog toplama raporu

Bu rapordaki tüm sayılar `scripts/katalog/s8_report.py` ile `books.json` / `authors.json` / `merge_log.json` üzerinden sayılarak üretilmiştir.

## Özet

- Birleştirilmiş benzersiz kayıt: **78** (set/paketler dahil: 7 set kaydı)
- Yazar kaydı: **36** (özgeçmiş bulunan: 1)
- Kapak indirilen: **78 / 78** (indirilemeyen: 0)
- Kaynak kapsamı: Kitapyurdu 39, Nobel 50, Küresel 75, diğer (Ravza) 1
- Yalnızca tek kaynakta görülen: Kitapyurdu-only 0, Nobel-only 0, Küresel-only 18, Ravza-only 1
- Üç ana kaynakta birden bulunan: 28

### Kaynak listeleri (ham sayılar)

- Küresel Kitap liste sayfaları: 81 satır, 77 benzersiz ürün (sayfalar arası tekrarlar var); bunlardan 2 tanesi kitap değil, "ön sipariş" yer tutucusu olduğu için kataloğa alınmadı.
- Nobel Kitap: sitede "64 ürün" yazıyor ama sayfalama (page=1..3) tekrar eden ürün döndürüyor; ulaşılabilen benzersiz ürün **50**. Sıralama parametreleri işe yaramadı; eksik 14 ürün Nobel üzerinden doğrulanamadı (Küresel/Kitapyurdu'da büyük bölümü zaten var).
- Kitapyurdu: 39 ürün (20 + 19) doğrulandı; site doğrudan HTTP isteklerine 403 (Cloudflare) verdiği için Firecrawl ile çekildi.

## Alan doldurma tablosu

| Alan | Dolu | Eksik |
|---|---:|---:|
| Başlık | 78 | 0 |
| Alt başlık | 20 | 58 |
| Yazar | 76 | 2 |
| ISBN | 73 | 5 |
| Sayfa sayısı | 78 | 0 |
| Yayın tarihi (herhangi) | 78 | 0 |
| Boyut | 78 | 0 |
| Cilt tipi | 78 | 0 |
| Kağıt cinsi | 78 | 0 |
| Kategori | 77 | 1 |
| Açıklama | 76 | 2 |
| Liste fiyatı | 76 | 2 |

Yayın tarihi ayrıntısı: tam tarih (gg.aa.yyyy kaynaklı, yyyy-mm-dd) 39, yalnızca yıl 39, tarih yok 0.

## Açıklama kaynağı dağılımı

- kitapyurdu: 38
- nobelkitap: 21
- kureselkitap: 16
- None: 2
- ravzakitap: 1

## Aktarım doğruluk kontrolü

Kitapyurdu verileri Firecrawl'ın `json` çıkarımı ile alındı (LLM tabanlı; bkz. 'Bilinen sınırlamalar'). Doğrulama için:
- Kitapyurdu açıklaması kullanılan ve Nobel'de de açıklaması olan 29 kitapta ilk 500 karakter benzerliği >= %95 olan: **29** (kalanlar biçim farkı: tırnak/boşluk/italik vb.).
- Eşleştirme ISBN'e dayanıyor; Kitapyurdu'daki 39 kitabın tamamı Nobel ve/veya Küresel'deki bir kayıtla ISBN üzerinden eşleşti (yalnızca Kitapyurdu'da kalan: 0). Başlık benzerliğiyle (ISBN'siz) eşleşen 4 Küresel kaydı merge_log.json'da listeli.

## Kaynaklar arası tutarsızlıklar

Toplam 12 alan çelişkisi kaydedildi (çoğunluk değeri seçildi, eşitlikte Kitapyurdu > Küresel > Nobel).

### dimensions (2)
- `yakin-tarihimizi-sorgulamak`: kitapyurdu=13.5 x 21 cm; kureselkitap=13.5 x 21 cm; nobelkitap=13 x 21 cm
- `turkun-yeni-amentusu`: kitapyurdu=13.5 x 19.5 cm; kureselkitap=13 x 20 cm

### pages (5)
- `1918-mutarekesinden-beri-olan-vakalar`: kitapyurdu=496; kureselkitap=500; nobelkitap=496
- `halit-pasa-nasil-olduruldu`: kitapyurdu=150; kureselkitap=64; nobelkitap=64
- `vahsi-surgun`: kitapyurdu=768; kureselkitap=784; nobelkitap=784
- `enver-ve-mustafa-kemalin-kitabi-1908-1938`: kitapyurdu=1456; kureselkitap=1456; nobelkitap=1408
- `hayat-ve-hatiratim`: kureselkitap=2036; nobelkitap=2010

### price_list_try (2)
- `hucumlara-cevaplar`: kitapyurdu=180.0; kureselkitap=160.0; nobelkitap=160.0
- `gozyasi-denizi`: kitapyurdu=400.0; kureselkitap=300.0

### publish_date (3)
- `mizac-dersleri`: kitapyurdu=2026-07-06; kureselkitap=2025
- `turkun-yeni-amentusu`: kitapyurdu=2025-07-18; kureselkitap=2020
- `gozyasi-denizi`: kitapyurdu=2026-06-27; kureselkitap=2025

Not: Nobel'in cilt alanı hep "Ciltsiz" (Küresel/Kitapyurdu: "Karton Kapak"); aynı şey kabul edilip çelişki sayılmadı, Nobel yalnızca yedek.

## Setler / paketler

- `bilinmeyen-yonleriyle-mustafa-kemal-ve-kurtulus-savasi-gercekleri-serisi` — Bilinmeyen Yönleriyle Mustafa Kemal ve Kurtuluş Savaşı Gerçekleri Serisi (5 Kitap); ISBN: yok; set içeriği kaynaklarda listelenmediği için `set_items` boş.
- `cumhuriyetin-ilk-yillarinda-satilan-camiler-ve-yasaklanan-dini-kitaplar` — Cumhuriyetin İlk Yıllarında Satılan Camiler ve Yasaklanan Dini Kitaplar (İki Eser (Küresel açıklaması)); ISBN: yok; set içeriği kaynaklarda listelenmediği için `set_items` boş.
- `enver-ve-mustafa-kemalin-kitabi-1908-1938` — Enver ve Mustafa Kemal'in Kitabı 1908 - 1938 (3 Kitap Takım); ISBN: 9786255529145; set içeriği kaynaklarda listelenmediği için `set_items` boş.
- `general-cevat-rifat-atilhan-kitapligi` — General Cevat Rıfat Atilhan Kitaplığı (14 Kitap); ISBN: yok; set içeriği kaynaklarda listelenmediği için `set_items` boş.
- `hayat-ve-hatiratim` — Hayat ve Hatıratım (4 Cilt Takım); ISBN: 9786255529114; set içeriği kaynaklarda listelenmediği için `set_items` boş.
- `mevkiful-akl-akil-ilim-ve-alemin-alemlerin-rabbi-ve-rasulleri-karsisindaki-konumu` — Mevkıfu'l Akl Akıl, İlim ve Âlemin Âlemlerin Rabbi ve Rasûlleri Karşısındaki Konumu (4 Cilt Takım); ISBN: 9786256763678; set içeriği kaynaklarda listelenmediği için `set_items` boş.
- `prof-dr-ali-seyyar-seti` — Prof. Dr. Ali Seyyar Seti (6 Kitap); ISBN: yok; set içeriği kaynaklarda listelenmediği için `set_items` boş.

## Eksikler

- ISBN'i olmayan (5): `bilinmeyen-yonleriyle-mustafa-kemal-ve-kurtulus-savasi-gercekleri-serisi`, `cumhuriyetin-ilk-yillarinda-satilan-camiler-ve-yasaklanan-dini-kitaplar`, `gargat-1-2`, `general-cevat-rifat-atilhan-kitapligi`, `prof-dr-ali-seyyar-seti`
- Yazarı belirsiz (2): `cumhuriyetin-ilk-yillarinda-satilan-camiler-ve-yasaklanan-dini-kitaplar`, `raculus-sanem`
- Açıklaması olmayan (2): `gargat-1-2`, `prof-dr-ali-seyyar-seti`
- Kapağı indirilemeyen (0): yok
- Açıklaması tanıtım/sipariş ilanı niteliğinde görünen (3): `bilinmeyen-yonleriyle-mustafa-kemal-ve-kurtulus-savasi-gercekleri-serisi`, `cumhuriyetin-ilk-yillarinda-satilan-camiler-ve-yasaklanan-dini-kitaplar`, `general-cevat-rifat-atilhan-kitapligi`
- Yazar özgeçmişi: yalnızca Mustafa Armağan için (Kitapyurdu kitap sayfası, kaynak URL authors.json'da). Diğer yazarlar için Kitapyurdu/Nobel/Küresel yazar sayfalarında özgeçmiş metni bulunamadı veya doğrulanamadı; yazar fotoğrafı hiçbir kaynakta yok (`photo_url: null`).

## Şüpheli / emin olunmayan kayıtlar

1. `rabbimizi-taniyalim-1` / `rabbimizi-taniyalim-2` — Nobel'deki `rabbimizi-taniyalim` kaydı (başlıkta numara yok) **2. cildin ISBN'ini (9786259723112)** taşıyor; Kitapyurdu'daki "Rabbimizi Tanıyalım 2" ile birleştirildi. 1. cilt (ISBN 9786259723105) yalnızca Ravza Kitap'ta görüldü (400 TL liste, 400 sayfa). Kitapyurdu'da 2. cilt için "Liste Fiyatı" alanı "." idi → liste fiyatı Nobel'den (260 TL) alındı; Ravza'da 1. cilt için 260 TL satış fiyatı görünüyor, yani 260 TL'nin hangi cilde ait olduğu belirsiz.
2. `halit-pasa-nasil-olduruldu` — Kitapyurdu sayfa sayısı 150 (liste fiyatıyla aynı sayı, çıkarım hatası şüphesi), Nobel ve Küresel 64; çoğunluk (64) seçildi.
3. `hilafetin-ilgasinin-arka-plani` ve `hilafetin-ilgasinin-arka-plani-9786256763449` — aynı başlık/yazar/açıklama, iki farklı ISBN (Kitapyurdu+Nobel: 9786259066004, Küresel: 9786256763449). İki ayrı baskı mı yoksa Küresel'de yanlış ISBN mı, doğrulanamadı; ayrı kayıt tutuldu.
4. `raculus-sanem` — Küresel'de "Eski Bir Türk Subayı" alt başlık olarak, "Derleme: Harun Şimşak" katkıda bulunan olarak görünüyor; yazar bilgisi yok, `authors` boş bırakıldı.
5. `musa-dagi`, `turk-oglu-dusmanini-tani-masonlugun-ic-yuzu`, `medeniyetin-batisi` — Kitapyurdu/Nobel'de üçünün de tanıtım metni birebir aynı (Kadir Mısıroğlu'nun Cevat Rıfat Atilhan hakkındaki önsöz alıntısı); kitaba özgü arka kapak metni değil.
6. `turkun-yeni-amentusu` — Kitapyurdu yazar: "Komisyon"; Küresel URL'si yazar olarak "Sâfî" (s-fi) kullanıyor; açıklama yazarın kimliğinin kesin bilinmediğini söylüyor. Küresel yayın yılı 2020, Kitapyurdu yayın tarihi 18.07.2025 (çelişki).
7. `gargat-1-2` (Ali Akbaş) — yalnızca Küresel'de, ISBN yok, açıklama yok; başlıktaki "1-2" iki cilt olabilir ama kaynakta açık değil, set sayılmadı. İslambol kataloğuna ait olup olmadığı yalnızca Küresel'in yayınevi listesine dayanıyor.
8. `cumhuriyetin-ilk-yillarinda-satilan-camiler-ve-yasaklanan-dini-kitaplar`, `general-cevat-rifat-atilhan-kitapligi`, `prof-dr-ali-seyyar-seti`, `bilinmeyen-yonleriyle-mustafa-kemal-ve-kurtulus-savasi-gercekleri-serisi` — ISBN'siz paket/set ilanları; açıklamalar kampanya metni (fiyat, kargo, WhatsApp hattı), set içeriği (hangi kitaplar) kaynakta listelenmiyor.
9. `afet-inan`, `seyhleride-vururlar`, `daglarda-parcalarin-toplanmaz` vb. — Kitapyurdu kategorisi "Edebiyat > Roman (Yerli)" (içerik kurgu dışı görünüyor).

## Bilinen sınırlamalar

- Firecrawl `json` çıkarımı Kitapyurdu'daki *yazar özgeçmişi* alanında tutarsız/uydurma metinler üretti (aynı yazar için farklı doğum yılı/yeri). Bu nedenle JSON çıkarımından gelen TÜM özgeçmişler **atıldı**; yalnızca ham markdown'dan okunan Armağan özgeçmişi tutuldu.
- Kitapyurdu açıklama/ISBN/sayfa vb. alanları aynı yöntemle alındığı için Nobel/Küresel ile çapraz doğrulandı (yukarıda). Kitapyurdu sayfalarında `Liste Fiyatı` bazı kitaplarda Nobel/Küresel ile farklı (bkz. çelişkiler).
- Fiyatlar anlık satış fiyatı değil, **liste fiyatı**dır (price_list_try); satış fiyatları mağazaya göre değişir ve bu kataloğa alınmadı.
- Kitapyurdu kategorileri bazı Seyfi Say / Ali Seyyar kitaplarında 'Edebiyat > Roman (Yerli)' olarak görünüyor; bu kaynak kategorisi olduğu gibi bırakıldı (sınıflandırma hatası olabilir).
- Kapaklar kaynak sitelerden indirildi; telif/kullanım izni bu çalışmada değerlendirilmedi.
