# Q4 İçerik Doğrulama Raporu

- Tarih: 2026-10-12
- Kapsam: `dist/` (npm run build çıktısı, 132 HTML), `data/catalog/books.json` (78 kitap), `data/catalog/authors.json` (36 yazar), `data/catalog/onsoz/INDEX.json` (yalnızca bilgi, doğrudan kontrol yok), `data/site/vitrin.json`, `data/site/site.json`, `data/site/sayfalar/*.md`.
- Betik: `python -I -X utf8 scripts/qa/dogrula.py` (dış örneklem: `--dis-ornek 15`; `--dis-yok` ile atlanır)
- Denetlenen dizin: `C:\Users\LENOVO\Desktop\islambol_yayinlari\dist` (çalışma öncesi/sonrası dizin imzası aynı kaldıysa geçerli)
- Çıkış kodu: **1** (hata var)

## Özet

- Kontrol grubu: 27; tekil denetim: 11713; **kalan (KALDI): 7**; doğrulanamadı: 1; uyarı (elle teyit): 3; uygulanamadı (N/A): 7.
- Hata sayılmayan sonuçlar: DOĞRULANAMADI (403/Cloudflare/ağ) ve UYARI. Çıkış kodu yalnızca KALDI için 1 olur.

## Kontrol tablosu

| Kimlik | Kontrol | Sonuç | Denetim | Kalan | Doğrulanamadı | Uyarı | N/A | Sahip (kalan) |
|---|---|---|---|---|---|---|---|---|
| 1.1 | Kitap sayfası üretildi (dist/kitap/<id>/index.html) | GEÇTİ | 78 | 0 | 0 | 0 | 0 | — |
| 1.2 | Sayfa h1 = title | GEÇTİ | 78 | 0 | 0 | 0 | 0 | — |
| 1.3 | Yazar adlarının her biri sayfada | GEÇTİ | 76 | 0 | 0 | 0 | 2 | — |
| 1.4 | ISBN (null değilse) sayfada | GEÇTİ | 73 | 0 | 0 | 0 | 5 | — |
| 1.5 | Sayfa sayısı (null değilse) sayfada | GEÇTİ | 78 | 0 | 0 | 0 | 0 | — |
| 1.6 | Kapak img/source yolları dist'te var | GEÇTİ | 1875 | 0 | 0 | 0 | 0 | — |
| 1.7 | sources dolu URL'ler sayfada bağlantı | GEÇTİ | 165 | 0 | 0 | 0 | 0 | — |
| 1.8 | WhatsApp bağlantısı (wa.me/905059808735) | GEÇTİ | 78 | 0 | 0 | 0 | 0 | — |
| 1.9 | is_set kitaplarda Takım rozeti/etiketi | GEÇTİ | 7 | 0 | 0 | 0 | 0 | — |
| 2.1 | Yazar sayfası üretildi (dist/yazar/<slug>/index.html) | GEÇTİ | 36 | 0 | 0 | 0 | 0 | — |
| 2.2 | Yazar sayfası h1 = name | KALDI | 36 | 7 | 0 | 0 | 0 | B2 (yazar şablonu) |
| 2.3 | Listelenen kitaplar = authors.json book_ids | GEÇTİ | 36 | 0 | 0 | 0 | 0 | — |
| 2.4 | book_ids ↔ books.json authors eşleşmesi (veri tutarlılığı) | GEÇTİ | 36 | 0 | 0 | 0 | 0 | — |
| 3.1 | Önizleme vitrini ve öne çıkan kitaplar ana sayfada | GEÇTİ | 7 | 0 | 0 | 0 | 0 | — |
| 3.2 | vitrin_haric kitapları ana sayfada yok | GEÇTİ | 3 | 0 | 0 | 0 | 0 | — |
| 4.1 | Yasaklı teknik dizgi yok (null, undefined, [[SORU, NaN, mojibake, TODO vb.) | GEÇTİ | 132 | 0 | 0 | 0 | 0 | — |
| 4.2 | Fiyat/kampanya dizgisi yok (TL, kargo ücretsiz, indirim, kampanya) | GEÇTİ | 132 | 0 | 0 | 0 | 0 | — |
| 5.1 | Her HTML katı UTF-8 olarak çözülüyor | GEÇTİ | 132 | 0 | 0 | 0 | 0 | — |
| 5.2 | <html lang="tr"> | GEÇTİ | 132 | 0 | 0 | 0 | 0 | — |
| 6.1 | İç bağlantı ve kaynaklar dist'te karşılık buluyor | GEÇTİ | 8363 | 0 | 0 | 0 | 0 | — |
| 7.1 | Dış kaynak bağlantıları (rastgele örneklem) | DOĞRULANAMADI | 1 | 0 | 1 | 0 | 0 | — |
| 8.1 | Site metinlerinde [[SORU işareti dist'te yok | GEÇTİ | 7 | 0 | 0 | 0 | 0 | — |
| 8.2 | Sayfalar: ilk paragraf dist'te geçiyor | GEÇTİ | 6 | 0 | 0 | 0 | 0 | — |
| 8.3 | Sayfalar: SORU ayıklamasından öksüz kalıntı adayları (elle teyit) | UYARI | 14 | 0 | 0 | 3 | 0 | — |
| 8.4 | Sayfalar: yönerge/editör notu sızıntısı yok | N/A | 0 | 0 | 0 | 0 | 0 | — |
| 9.1 | Sitemap URL sayısı = HTML sayısı − 404 − _test | GEÇTİ | 1 | 0 | 0 | 0 | 0 | — |
| 9.2 | Sitemap her URL dist'te karşılık buluyor | GEÇTİ | 131 | 0 | 0 | 0 | 0 | — |

## Uyumsuzluklar (tam liste)

Toplam 7 kayıt, 7 tekil uyumsuzluk (aynı değerli kayıtlar gruplandı).

| # | Kimlik | Varlık (adet, örnek) | Alan | Beklenen | Bulunan | SAHİP | Not |
|---|---|---|---|---|---|---|---|
| 1 | 2.2 | 1 × yazar:ali-seyyar | h1 | Ali Seyyar | Prof. Dr. Ali Seyyar | B2 (yazar şablonu) | display alanı ayrı: Prof. Dr. Ali Seyyar |
| 2 | 2.2 | 1 × yazar:iyad-kunaybi | h1 | İyad Kunaybi | Dr. İyad Kunaybi | B2 (yazar şablonu) | display alanı ayrı: Dr. İyad Kunaybi |
| 3 | 2.2 | 1 × yazar:m-hudai-senturk | h1 | M. Hüdai Şentürk | Dr. M. Hüdai Şentürk | B2 (yazar şablonu) | display alanı ayrı: Dr. M. Hüdai Şentürk |
| 4 | 2.2 | 1 × yazar:muferrih-b-suleyman-el-kusi | h1 | Müferrih b. Süleyman el-Kûsî | Prof. Dr. Müferrih B. Süleyman El-Kûsî | B2 (yazar şablonu) | display alanı ayrı: Prof. Dr. Müferrih B. Süleyman El-Kûsî |
| 5 | 2.2 | 1 × yazar:mustafa-sabri-efendi | h1 | Mustafa Sabri Efendi | Şeyhülislam Mustafa Sabri Efendi | B2 (yazar şablonu) | display alanı ayrı: Şeyhülislam Mustafa Sabri Efendi |
| 6 | 2.2 | 1 × yazar:riza-nur | h1 | Rıza Nur | Dr. Rıza Nur | B2 (yazar şablonu) | display alanı ayrı: Dr. Rıza Nur |
| 7 | 2.2 | 1 × yazar:seyfi-say | h1 | Seyfi Say | Dr. Seyfi Say | B2 (yazar şablonu) | display alanı ayrı: Dr. Seyfi Say |

## Doğrulanamayan ve uyarı kayıtları

| Kimlik | Sonuç | Varlık | Alan | Beklenen | Bulunan | Not |
|---|---|---|---|---|---|---|
| 7.1 | DOĞRULANAMADI | tüm dış bağlantılar | dış denetim | — | --dis-yok ile atlandı |  |
| 8.3 | UYARI | hakkimizda.md | SORU ayıklama: içerik kaybı | SORU dışı içerik korunmalı | Yayınevi tarihinden bu yana faaliyet göstermektedir | cümlenin SORU dışındaki kısmı yayından düşüyor (elle karar) |
| 8.3 | UYARI | hakkimizda.md | SORU ayıklama: içerik kaybı | SORU dışı içerik korunmalı | Toplam kitap sayısı için şimdilik katalogdaki kayıtlar esas alınmıştır yayınevinin resmî sayısı olarak teyit edilecektir | cümlenin SORU dışındaki kısmı yayından düşüyor (elle karar) |
| 8.3 | UYARI | kvkk-ve-cerezler.md | SORU ayıklama | akıcı cümle | ## Toplanan kişisel veriler | cümle sonu işareti yok |

## Dış bağlantı sonuçları (örneklem)

Kaynak havuzu: 165 tekil URL. Örneklem tohumu 20261011, sayı 15.

Dış denetim yapılmadı.

## Öksüz kalıntı adayları (SORU ayıklaması)

Yöntem: her `[[SORU: …]]` işaretinin bulunduğu cümle `sorulariAyikla` ile çıkarılır; kalan blok sezgisel olarak denetlenir (küçük harfle başlayan cümle, bağlaçla biten/başlayan kalıntı, noktalama öncesi boşluk, cümle sonu eksikliği). İşaret yoksa aday sayılmaz; işaret olsa bile insan teyidi gerekir.

| Dosya | SORU konusu | Çıkarılan parça | Kalan blok | Sezgisel işaret |
|---|---|---|---|---|
| hakkimizda.md | Kuruluş yılı nedir ve kurucu ya da yayın yönetmeni kimdir? Metinde adı geçmesini istiyors… | Yayınevi [[SORU: Kuruluş yılı nedir ve kurucu ya da yayın yönetmeni kimdir? Metinde adı geçmesini istiyorsanız belirtin.]] tarihinden bu yana faaliye… | İslambol Yayınları, İstanbul'un Fatih ilçesinde yayın yapan bir yayınevidir. | yok |
| hakkimizda.md | Yayınevinin bugüne kadar çıkardığı toplam kitap sayısı ve katalogdaki kitapların tamamını… | Toplam kitap sayısı için şimdilik katalogdaki kayıtlar esas alınmıştır; yayınevinin resmî sayısı [[SORU: Yayınevinin bugüne kadar çıkardığı toplam ki… | Katalogda Cevat Rıfat Atilhan, Seyfi Say, Ali Seyyar, Mustafa Sabri Efendi, Rıza Nur ve Ömer Faruk Altay gibi yazarların kitapları yer alır. Güncel liste [yazarlar](/yazarlar/) sa… | yok |
| hakkimizda.md | Yayınlarda editör, çevirmen ya da hakem heyeti gibi bir yayın kurulu var mı; varsa adları… | [[SORU: Yayınlarda editör, çevirmen ya da hakem heyeti gibi bir yayın kurulu var mı; varsa adları ve görevleri bu sayfaya eklensin mi?]] |  | yok |
| iletisim.md | Hat hangi gün ve saatlerde yanıt veriyor? | [[SORU: Hat hangi gün ve saatlerde yanıt veriyor?]] |  | yok |
| iletisim.md | Açık adres nedir ve yayınevi ziyaretçi kabul ediyor mu? Kabul ediyorsa çalışma saatleri n… | [[SORU: Açık adres nedir ve yayınevi ziyaretçi kabul ediyor mu? Kabul ediyorsa çalışma saatleri nedir?]] |  | yok |
| iletisim.md | Yazar/telif teklifleri, basın ve kütüphane talepleri için ayrı bir e-posta veya yönlendir… | [[SORU: Yazar/telif teklifleri, basın ve kütüphane talepleri için ayrı bir e-posta veya yönlendirme var mı?]] |  | yok |
| kvkk-ve-cerezler.md | Siteye analitik aracı (ör. çerezsiz istatistik) eklenecek mi? | [[SORU: Siteye analitik aracı (ör. çerezsiz istatistik) eklenecek mi?]] | ## Toplanan kişisel veriler | cümle sonu işareti yok |
| kvkk-ve-cerezler.md | Site hangi barındırma hizmetinde yayımlanacak ve bu hizmetin kayıt tutma süresi nedir? | [[SORU: Site hangi barındırma hizmetinde yayımlanacak ve bu hizmetin kayıt tutma süresi nedir?]] | Siteyi barındıran hizmet, tarayıcınızın bağlantı sırasında ilettiği teknik bilgileri (IP adresi, tarayıcı türü, istek zamanı) güvenlik ve işleyiş amacıyla kayıt altına alabilir. B… | yok |
| kvkk-ve-cerezler.md | Veri sorumlusu olarak hangi unvan ve adres yazılacak; yayınevinin VERBİS kaydı gerekli mi? | [[SORU: Veri sorumlusu olarak hangi unvan ve adres yazılacak; yayınevinin VERBİS kaydı gerekli mi?]] | 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamındaki haklarınız için **islambolyayinlari@gmail.com** adresine yazabilirsiniz. | yok |
| nereden-alinir.md | Yayınevinin Trendyol mağaza adresi nedir? | - **Trendyol**: [[SORU: Yayınevinin Trendyol mağaza adresi nedir?]] | - **Küresel Kitap**: yayınevi sayfası bağlantısı sitede verilir. - **Kitapyurdu**: yayınevi sayfası bağlantısı sitede verilir. - **Nobel Kitap**: yayınevi sayfası bağlantısı sited… | yok |
| nereden-alinir.md | WhatsApp hattından sipariş alınırken ödeme ve kargo yöntemleri nelerdir (havale/EFT, kapı… | [[SORU: WhatsApp hattından sipariş alınırken ödeme ve kargo yöntemleri nelerdir (havale/EFT, kapıda ödeme, kargo firması)? Metne eklenecek mi?]] |  | yok |
| nereden-alinir.md | Toptan satış, kitabevi ve kütüphane siparişleri için ayrı bir yol var mı? | [[SORU: Toptan satış, kitabevi ve kütüphane siparişleri için ayrı bir yol var mı?]] |  | yok |
| onizleme-hakkinda.md | Önizlenen sayfaların kullanım koşulları (alıntı, paylaşma) için yayınevinin resmî bir ifa… | [[SORU: Önizlenen sayfaların kullanım koşulları (alıntı, paylaşma) için yayınevinin resmî bir ifadesi var mı? Yoksa bu paragraf kısa tutulacak.]] | Önizlemedeki sayfalar, kapak ve metinler İslambol Yayınları'na aittir ve yayınevinin izniyle gösterilir. Kopyalanması, çoğaltılması ve başka yerde yayımlanması yayınevinin yazılı … | yok |
| yayin-cizgisi.md | Yayınevinin yazılı bir yayın ilkesi, editoryal yaklaşımı ya da kaynak gösterme politikası… | [[SORU: Yayınevinin yazılı bir yayın ilkesi, editoryal yaklaşımı ya da kaynak gösterme politikası var mı? Varsa bu bölüm onunla doldurulacak; yoksa b… |  | yok |

## Sayfalar: ilk paragraf kontrolü

- `hakkimizda`: TAMAM — "İslambol Yayınları, İstanbul'un Fatih ilçesinde yayın yapan bir yayınevidir.…"
- `iletisim`: TAMAM — "Fatih, İstanbul 34112.…"
- `kvkk-ve-cerezler`: TAMAM — "Bu site çerez kullanmaz ve ziyaretçilerin davranışını izleyen bir analitik ya da reklam ar…"
- `nereden-alinir`: TAMAM — "İslambol Yayınları'nın kendi çevrim içi mağazası yoktur; bu sitede satış yapılmaz. Kitapla…"
- `onizleme-hakkinda`: TAMAM — "Bazı kitapların sayfasında "Önizle" düğmesi bulunur. Düğmeye bastığınızda kitabın ilk sayf…"
- `yayin-cizgisi`: TAMAM — "İslambol Yayınları kataloğu birkaç alanda toplanır. Aşağıdaki başlıklar, kataloğa işlenmiş…"

## Sitemap

- sitemap `<loc>` sayısı: 131; dist HTML sayısı: 132; hariç tutulan (404 ve _test): 1; beklenen: 131.
- Not: `data/site/site.json` / betik taban adresi `https://adursak63.github.io/islambol-yayinlari` (yol öneki `/islambol-yayinlari`). Varsayılan build `PATH_PREFIX=/` ile çalışır; sitemap'in dağıtım adresiyle tutarlılığı için dağıtım komutunda `PATH_PREFIX=/islambol-yayinlari/` kullanıldığı teyit edilmeli.

## Betik ve yöntem notları

- Girdiler proje verisinden doğrudan okunur; beklenen değerler `books.json`/`authors.json`/`vitrin.json` ham değerleridir, yükleyici (`src/_data`) çıktısı değildir.
- Görünür metin karşılaştırmaları HTML entity ve boşluk normalizasyonu sonrası yapılır (`&amp;` → `&`, NBSP → boşluk).
- Yasaklı dizgi taraması `<script>` ve `<style>` içerikleri hariç yapılır (JS içindeki `null`/`undefined` yanlış pozitif olmasın diye).
- `onsoz/INDEX.json` ve `kapaklar-opt.json`/`onsoz-opt.json` bu sürümde doğrudan denetlenmez; yalnızca dist üzerinden dolaylı olarak doğrulanır.
- `package.json` içindeki `dogrula` betiği `scripts/qa/dogrula.mjs` gösteriyor; bu betik `dogrula.py`'dir. Kod ve paket dosyaları bu rolün yazma kapsamında değildir; SAHİP'in düzeltmesi gerekir.

