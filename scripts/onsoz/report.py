"""INDEX.json + kitap JSON'larindan REPORT.md uretir (sayilar betikle sayilir). Kullanim: python -I report.py"""
import json
from pathlib import Path
from collections import Counter

CAT = Path(__file__).resolve().parents[2] / "data" / "catalog" / "onsoz"
idx = json.loads((CAT / "INDEX.json").read_text(encoding="utf-8"))
ok = [x for x in idx if x["status"] == "ok"]
none = [x for x in idx if x["status"] == "onizleme_yok"]
err = [x for x in idx if x["status"] == "hata"]
kinds = Counter()
total = classified = 0
for x in ok:
    b = json.loads((CAT / f"{x['slug']}.json").read_text(encoding="utf-8"))
    for p in b["pages"]:
        total += 1
        kinds[p["kind"] or "null"] += 1
        classified += p["kind"] is not None
L = []
L.append("# Önsöz Avcısı Raporu (Kitapyurdu \"İç Sayfalara Gözat\")\n")
L.append("Tarih: 2026-10-11 | Kaynak: Kitapyurdu İslambol Yayınları (yayınevi id 11783)\n")
L.append("## Sayılar (betikle sayıldı)\n")
L.append(f"- Denenen kitap: **{len(idx)}**")
L.append(f"- Önizlemesi olan kitap: **{len(ok)}**")
L.append(f"- Önizleme düğmesi olmayan kitap (onizleme_yok): **{len(none)}**")
L.append(f"- Hata (indirme/ağ): **{len(err)}**")
L.append(f"- İndirilen toplam sayfa: **{total}**")
L.append(f"- Önsöz/takdim tespit edilen kitap: **{sum(x['has_onsoz'] for x in idx)}**")
L.append(f"- Sayfa sınıf dağılımı: " + ", ".join(f"{k}={v}" for k, v in sorted(kinds.items())))
L.append(f"- Sınıflandırılan sayfa: {classified}/{total}\n")
L.append("## Önizlemeli kitaplar\n")
L.append("| Kitap | Yazar (Kitapyurdu) | Sayfa | Önsöz/takdim sayfaları |\n|---|---|---|---|")
for x in ok:
    L.append(f"| {x['title']} | {x['author']} | {x['page_count']} | {x['onsoz_pages'] or '-'} |")
L.append("\n## Önizlemesi olmayanlar (Kitapyurdu sayfasında `view_pages` düğmesi yok)\n")
L.append("Firecrawl hatası: `ActionError: Error in action 1: Element not found` (selector `button[data-action=\"view_pages\"]`). "
         "Doğrulama: bu kitaplardan biri (Türk'ün Yeni Amentüsü) için ham HTML ayrıca çekildi; sayfada `view_pages` eylemi gerçekten yok. "
         "3 kitap daha 5 sn bekleyerek yeniden denendi, aynı sonuç. Diğerleri tek denemeyle işaretlendi; bekleme süresiyle ilgili "
         "geçici bir sorun olma ihtimali düşük ama tek tek HTML ile doğrulanmadı.\n")
for x in none:
    L.append(f"- {x['title']} — {x['author']} (id {x['kitapyurdu_id']})")
L.append("\n## Hatalar\n")
L.append("- İndirme/ağ hatası yok." if not err else "\n".join(f"- {x['slug']}" for x in err))
L.append("\n## Sınıflandırma güveni\n")
L.append("- Yöntem: her görsel Read ile açılıp gözle sınıflandırıldı; OCR yok. Güven yüksek: kapak_ici, icindekiler, takdim/onsoz (başlıkları görsel olarak okunuyor).")
L.append("- `kind=null`: taksonomide olmayan sayfalar (yazar/mütercim tanıtımı, besmele, ithaf/epigraf, bölüm ayracı, arka kapak, gazete fotoğrafı). Bilerek null bırakıldı.")
L.append("- `takdim` = yayınevi/editör sunuşu (\"Sunuş\", \"Takdim\"); `onsoz` = yazar/mütercim ön sözü (\"Önsöz\", \"İki Kelime\", \"Mevzuya Girmeden Evvel\", \"Sunarken\"). İkisi arasındaki sınır başlığa göre; sitede ikisi de vitrin adayı.")
L.append("- İlk 3 sayfa ve önsöz/takdim sayfaları her önizlemeli kitap için tek tek incelendi; `metin` sayfalar (gövde) yalnızca bariz olanlar için işaretlendi.")
L.append("- Künye (`kunye`) sayfası hiçbir önizlemede çıkmadı: Kitapyurdu önizlemesi kapak içinden sonra doğrudan içindekiler/takdime geçiyor.")
L.append("- Önizleme sayfa sayısı 7-10 ile sınırlı (Kitapyurdu önizleme kotası); kitap başı ~8-10 sayfa.\n")
L.append("## Dikkat edilecek noktalar\n")
L.append("- **Meta uyuşmazlığı:** \"Son Halifenin Dramı\" Kitapyurdu'da yazar \"Cevat Rıfat Atilhan\" görünüyor; iç kapakta yazar **Manavoğlu Nevres Bey** (Sunuş: Mustafa Armağan). Yayınevi doğrulamalı.")
L.append("- **İçerik/hukuki uyarı:** Atilhan başlıklarından üçü (İğneli Fıçı, Gizli Devlet ve Fesat Programı, Yeryüzünün Hakiki Canileri: İsrail) Yahudi karşıtı komplo/kan iftirası içeriği taşıyor (içindekiler ve metin sayfalarında \"Protokoller\", \"Talmud\", \"İğneli Fıçı\" gibi başlıklar). Vitrinde öne çıkarma kararı editoryal/hukuki değerlendirmeye bağlı; aşağıdaki öneri listesine bu yüzden alınmadılar.")
L.append("- **Görsel kalite:** Allah'a Hüsnüzan Beslemek ve Filistin-Suriye önizlemeleri düşük çözünürlüklü/fotokopi taramaları; sayfa çevirme efektinde bulanık görünebilir. Diğerleri net.")
L.append("- **Telif/hak:** görseller Kitapyurdu önizlemesinden; `rights_note` her JSON'da. Yayınevi onayıyla kullanım varsayımı Direktör'de.\n")
L.append("## Vitrin önerisi (sayfa çevirme için 6 kitap)\n")
L.append("1. **Sen Neden Kör Edildin?** (Mustafa Armağan) — temiz tarama, 3 sayfa Önsöz (s.5-7) + 2 sayfa içindekiler, tanınmış yazar, en sinematik sayfa akışı.")
L.append("2. **Son Halifenin Dramı** — temiz tarama, 7 sayfa Sunuş (s.4-10; Armağan metni), güçlü tema; yazar künyesi doğrulanmalı (yukarıya bak).")
L.append("3. **İnas** (İyad Kunaybi) — temiz tarama, Takdim + İkinci Baskıya Ön Söz (s.6-8), roman: katalogda tür çeşitliliği.")
L.append("4. **Filistin-Suriye Cephesinde Kahramanlar ve Hainler** (Cevat Rıfat Atilhan) — Mustafa Armağan'ın 4 sayfalık sunuşu (s.3-6); fotokopi kalitesi orta; Atilhan'ın askeri hatırat kitabı (komplo içerikli diğerlerinden farklı).")
L.append("5. **Menemen Hadisesinin İçyüzü** — net tarama, içindekiler + Önsöz (s.9-10), gazete kupürü sayfaları görsel çeşitlilik katar.")
L.append("6. **Allah'a Hüsnüzan Beslemek** (İyad Kunaybi) — içindekiler + Sunarken; manevi/kişisel gelişim türü için ama tarama kalitesi zayıf, kullanılacaksa yalnızca içindekiler/Sunarken sayfaları öne çıkarılmalı.")
(CAT / "REPORT.md").write_text("\n".join(L) + "\n", encoding="utf-8")
print("REPORT.md yazildi:", len(idx), len(ok), total, sum(x['has_onsoz'] for x in idx))
