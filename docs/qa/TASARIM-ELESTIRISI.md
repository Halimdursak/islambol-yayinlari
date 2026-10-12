# Tasarım Eleştirisi — Sentez

Tarih: 12 Ekim 2026 · Yöntem: Workflow `tasarim-elestirisi` (3 bağımsız eleştirmen → her bulguya 2 şüpheci doğrulayıcı → sentez). Sentez aşaması oturum limiti yüzünden Direktör tarafından yazıldı; eleştiri ve doğrulama çıktıları günlükte (`subagents/workflows/wf_660fd7e8-4ea/journal.jsonl`).

## Genel değerlendirme

Üç eleştirmen bağımsız olarak **7/10** verdi (profesyonel yayınevi sitesi çıtası). Ortak izlenim: tasarım sistemi gerçek ve disiplinli (iki aile, akışkan tip ölçeği, tek vurgu, keskin köşeler, arşiv etiketleri, künye tablosu, çalışan sayfa çevirme); şablon izi yok; incelenen Türk rakiplerinin hiçbirinde olmayan bir "belge" hissi var; 320'de taşma yok; karanlık tema tutarlı. Eksikler hiyerarşi ve ritim ayrıntılarındaydı: eser adının kendi sayfasında en küçük h1 olması, bölüm başlıklarının etiket genişliğine göre kayması, bazı kırılmalarda artık ızgara hücreleri, 45–75 karakter bandını aşan satırlar. Bunların hepsi düzeltildi; cila sonrası beklenen puan 8+/10 (yeniden puanlama yapılmadı).

## Uygulanan cila maddeleri (iki doğrulayıcıdan geçti)

| # | Bulgu | Dosya | Değişiklik | Ölçülen sonuç |
|---|---|---|---|---|
| 1 | tipografi-1 / marka-2: kitap sayfasında eser adı sitenin en küçük h1'iydi (36px) | `src/assets/css/katalog.css` `.kitap-detay__baslik` | `--text-2xl` + `text-wrap: balance` | 1440'ta 56px |
| 2 | duzen-1 / tipografi-5: bölüm başlıkları etiket genişliğine göre 25px kayıyordu | `src/assets/css/global.css` `.bolum-basligi` (≥48rem) | `grid-template-columns: 7rem 1fr auto` | h2 sol kenarı 5 bölümde aynı (1024: 164px, 768: 156px) |
| 3 | duzen-2: 1024'te önizleme şeridi 5+1, 768'de yeni çıkanlar 3+3+2 | `global.css` `.serit`, `.kart-izgara` | `auto-fit, minmax(8.5rem,1fr)`; ≥48rem 4 sütun | 1024'te 6 sütun tek sıra |
| 4 | tipografi-2: okuma sütunu 76–90 karakter | `src/assets/css/tokens.css` `--max-w-prose` | 38rem → 34rem | 544px (~66–70 karakter, 19px Garamond) |
| 5 | duzen-5: modal dip notu sola kayıyordu (genel `p { max-width }` sızıntısı) | `src/assets/css/flipbook.css` | `.onizleme__not, .onizleme__yukleniyor { max-width: none }` | not merkezi = viewport merkezi (720/720) |
| 6 | duzen-4: birincil sipariş CTA'sı 1,75 ekran aşağıdaydı, sol sütun boştu | `src/kitap.njk`, `katalog.css` | kapağın altına ikinci WhatsApp CTA'sı (düşük riskli varyant; kutu taşınmadı) | CTA y=926 (ilk ekranda) |
| 7 | tipografi-6 / marka-1: hero'da eser adı 13px figcaption'daydı | `src/index.njk`, `global.css` `.hero__kitap-adi` | eser adı serif `--text-lg`, yazar etiket olarak kaldı; H1 iddia başlığı korundu (SITE-HARITASI ile uyum) | 24px EB Garamond |
| 8 | duzen-3: footer önünde 2× boşluk (224px) | `global.css` `.alt`, `main > :last-child`, `.bolum--son`; `katalog.css` `.kitap-detay` | footer `margin-top: 0`; alt boşluk main'in son çocuğunda tek kaynak | son bölüm altı = footer üstü (112px padding) |
| 9 | tipografi-3: düz kesme (') ve "..." dizgisi | `eleventy.config.js` `tipografi` transform | metin düğümlerinde harfler arası ' → ’, ... → … (attribute'lar, script/style/pre hariç) | "okumak için…"; `data-ara` dokunulmadı |

## Doğrulanan ama ertelenen

| Bulgu | Neden ertelendi |
|---|---|
| tipografi-7: yazar adının üç farklı Plex tedavisi | Öncelik 2/3; `.yazar-adi` yardımcı sınıfı ve 5 dosyada seçici değişikliği gerektiriyor; doğrulayıcı `text-decoration: none` önerisinin bağlantıyı tanınmaz kıldığını ölçtü. Sonraki tur. |
| marka-1 tam varyantı (88px hero kitap adı, H1 değişimi) | SITE-HARITASI.md ile çelişiyor; ılımlı varyant (madde 7) uygulandı. |

## Çürütülen

| Bulgu | Gerekçe |
|---|---|
| marka-2 (çipleri kaldırma kısmı) | Başlık boyutu zaten düzeltildi; kategori çipleri "Yeni" rozetini de taşıyor, kaldırmak bilgi kaybı. |

## Doğrulanamayan (ağ/limit kesintisi; uygulanmadı, aday listesi)

marka-3 (karanlık temada kapak yuvası token'ları), marka-4 (logo kalitesi — vektör bekleniyor, docs/SORULAR.md C.9), marka-5 (bölüm etiketlerinin başlığı tekrar etmesi; "Raf/Kayıt/Dosya/Belge" dili önerisi), marka-6 (baş harf kutuları yerine mini kapaklar), marka-7 (/kitaplar/ listesinde yıla göre gruplama), marka-8 / tipografi-8 (tireli ISBN gösterimi), duzen-6 (1024–1151 aralığında hamburger menü), duzen-7 (768'de hero kapak tepsisi genişliği), duzen-8 (320'de kart başlığı boyutu), tipografi-4 (şerit sütun genişliği ve kart başlığı kademesi).

## Dokunulmaması gerekenler (güçlü yönler)

1. Kâğıt/mürekkep/mühür paleti ve tek vurgu disiplini; keskin köşeli kapak tepsileri.
2. EB Garamond + IBM Plex Sans ikilisi, akışkan ölçek, ölçülmüş yedek metrikler, `lang="tr"` ile doğru İ/ı.
3. Künye tablosu ve "Nereden alınır" kutusu: e-ticaret artığı olmadan kurumsal güven.
4. Sayfa çevirme modalı: çift/tek sayfa, klavye, odak, reduced-motion galerisi, tembel yükleme.
5. Arşiv etiketi + bölüm başlığı makrosu ve hero kompozisyonu (kapak kahraman).
