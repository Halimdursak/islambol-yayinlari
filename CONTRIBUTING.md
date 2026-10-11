# Katkı Rehberi

Bu depo İslambol Yayınları tanıtım ve katalog sitesidir. Ayrıntılı kullanım için [README.md](README.md) dosyasına bakın.

## Dal ve commit

- Ana dal `main`'dir; `main`'e her push siteyi yayınlar. Büyük değişiklikleri ayrı dalda yapın (`kitap/yeni-kitap-adi`, `duzeltme/aciklama`) ve pull request açın.
- Commit mesajı: `<tip>: <açıklama>`. Tipler: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.
  Örnek: `feat: yeni kitap eklendi (Inas)`, `fix: kapak yolu düzeltildi`.
- Açıklama Türkçe, kısa ve eylem odaklı olsun.

## İsimlendirme

- Türkçe isimlendirme esastır (dosya, değişken, veri alanı). Mevcut alan adlarını (`title`, `authors`, `cover` ...) şemadan (`data/catalog/books.schema.json`) olduğu gibi kullanın.
- Kitap `id`'si küçük harf, rakam ve tire içerir; Türkçe karakter yoktur (`ç→c`, `ğ→g`, `ı→i`, `ö→o`, `ş→s`, `ü→u`). Örnek: `allaha-husnuzan-beslemek`.
- Dosya adlarında boşluk ve büyük harf kullanmayın.

## Veri uydurma yasağı

- Kitap bilgisi (ISBN, sayfa sayısı, tarih, açıklama) yalnızca yayınevinin kendi kaynaklarından (kitap künyesi, Küresel Kitap, Kitapyurdu, Nobel) alınır. Bilmediğiniz alanı `null` bırakın; tahmin yazmayın.
- Sitede fiyat gösterilmez (ADR-001). `price_list_try` verisi tutulur ama yayınlanmaz.
- Site metinlerinde bilinmeyen bilgi için uydurma cümle yerine `[[SORU: ...]]` işareti kullanın; işaretli cümleler yayına girmez.
- Yalnızca İslambol Yayınları'na ait içerik siteye girer (ADR-007). Başka yayınevlerinin kapak ya da sayfa görselleri eklenmez.

## Pull request öncesi

1. `npm run build` hatasız bitmeli (şema doğrulaması dahil).
2. `npm run dogrula:seo` hatasız (çıkış kodu 0) olmalı.
3. İçerik değiştiyse `python -I -X utf8 scripts/qa/dogrula.py` (varsa) çalıştırın.
4. Görsel eklediyseniz `npm run gorsel` çalıştırılmış ve üretilen `public/*-opt` dosyaları ile `data/catalog/*-opt.json` commit'e dahil olmalı.
5. Sırlar (`.env`, anahtar, parola) asla commit edilmez.
