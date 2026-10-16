> **16 Ekim 2026 notu:** Bu istem uygulandı. Tasarım olarak Seçenek 1 (Beyaz Vitrin) ve 14 Ekim vitrin/CMS yapısı seçildi; ayrıntı için OTURUM-OZETI.md §15 ve KARARLAR.md ADR-010..014. Aşağıdaki metin tarihsel kayıttır.

# Yeni Oturum Prompt'u

Yeni bir Claude Code penceresi açıp çalışma klasörünü `C:\Users\LENOVO\Desktop\islambol_yayinlari` yapın, aşağıdaki bloğu olduğu gibi yapıştırın.

```text
İslambol Yayınları (İstanbul, yakın tarih/hatırat yayınevi) için tanıtım + katalog web sitesi projesine devam ediyoruz. Çalışma klasörü: C:\Users\LENOVO\Desktop\islambol_yayinlari. Önceki oturumda site yapıldı, test edildi ve yerelde commit'lendi; şimdi TASARIM DEĞİŞİKLİĞİ aşamasındayız.

ÖNCE ŞUNLARI OKU (sırayla, kısa tut):
1. docs/OTURUM-OZETI.md  — önceki oturumun tam kaydı, kararlar, tuzaklar, açık işler
2. docs/KARARLAR.md  — ADR-001…009
3. docs/SORULAR.md  — yayınevine sorular ve bekleyen kararlar
4. docs/design/secenekler/secenek-1..4/NOT.md  — dört tasarım seçeneğinin konsepti
5. DESIGN.md  — mevcut (reddedilen) "Arşiv Dosyası" sözleşmesi; yeni tasarımla değişecek
Sonra: git log --oneline | head, git status.

DURUM (doğrula, varsayma):
- Site Eleventy 3 + Nunjucks + saf CSS; npm run build → dist/ (133 dosya). 78 kitap, 36 yazar, 7 set; 9 kitapta sayfa çevirmeli önizleme (page-flip). Test: e2e 506/506, axe 0, SEO 0 hata.
- Kullanıcı mevcut tasarımı BEĞENMEDİ. Premium, modern, iPhone/Apple görünümlü 4 seçenek hazırlandı: 1 Beyaz Vitrin, 2 Pro Siyah, 3 Cam Bento, 4 Editoryal Books (docs/design/secenekler/, canlı index.html + kitap.html, canvas: https://claude.ai/artifact/FTt5ikDHjYZT64qLaEGLyH). Kullanıcının seçimi: [BURAYA YAZ: 1/2/3/4 ya da karışım].
- GitHub'a henüz push edilmedi (gh oturumu açık değil; kullanıcı adımı: gh auth login --web --git-protocol https).

GÖREV:
Seçilen tasarımı gerçek siteye uygula. Şablon yapısını ve veri katmanını koru (src/_data/*.js, data/**, kitap-onizleme.njk + flipbook.js sözleşmesi: [data-onizleme="<kitap.id>"]); yalnızca görünümü yeniden yaz: DESIGN.md, src/assets/css/{tokens,typography,global,katalog,flipbook}.css, src/_includes/** ve gerekli src/*.njk işaretlemesi. Seçeneğin uret.mjs ve index.html'ini referans al ama kopyalama; Nunjucks şablonlarına uyarla. Fontları self-host et (Google Fonts bağımlılığı kalmasın). Kapağın beyazımsı zeminini seçenekteki çözümle (multiply/açık podyum) ele al. Yeni tasarım bitince: build, e2e (npx playwright test), axe (node scripts/qa/a11y/denetle.mjs), SEO (node scripts/seo/dogrula.mjs), içerik doğrulama (python -I -X utf8 scripts/qa/dogrula.py --dis-yok); 390/768/1440'ta ekran görüntülerini Read ile kendin aç ve bak; DESIGN.md ve KARARLAR.md'yi güncelle (yeni ADR); commit at.

MAKİNE KURALLARI (ihlal etme):
- Native .node modülü yükleyen araç kullanma (Windows Uygulama Denetimi engelli); Playwright yalnızca chromium.launch({channel:'msedge'}).
- Git Bash'te PATH_PREFIX için MSYS_NO_PATHCONV=1 kullan. awk çalışmıyor. taskkill //IM node.exe YASAK; yalnızca kendi başlattığın PID'yi kapat.
- Uydurma bilgi yok (kuruluş yılı, yazar özgeçmişi vb.). Fiyat gösterme. İşaretli [[SORU]] metinleri yayına girmez.
- Üç kitap bilinçli olarak ana sayfa vitrini dışında (data/site/vitrin.json → vitrin_haric); değiştirme.

ÇALIŞMA YÖNTEMİ: önce kısa plan; zor/çok parçalı işte Workflow ile agent ekibi (tasarımcı → eleştirmen → düzeltme) kullan, dosya sahipliğini ayır, aynı dosyaya iki agent yazmasın; her sonucu kendi gözünle doğrula; sonunda kısa Türkçe rapor ver ve kullanıcıya yalnızca gerçekten ona ait olan soruları sor.
```

Seçimi yazmadan önce prompt'taki `[BURAYA YAZ: ...]` kısmını doldurun.
