"""Seslendirme parçalarını üretir: assets/vo/<anahtar>.mp3 (tr-TR-AhmetNeural, edge-tts).

Not: edge-tts metni Microsoft'un çevrimiçi ses hizmetine gönderir (yalnız kamuya açık reklam metni).
Çalıştırma: python seslendirme.py [ses] [oran] [perde]   örn. python seslendirme.py tr-TR-EmelNeural +0% +0Hz (negatif oran/perde hizmette "ses gelmedi" hatası veriyor, 18 Ekim 2026)
Metinler reel.html'deki ekran metinleriyle uyumlu tutulur; süreler reel.html'de bu parçaların uzunluğuna göre ayarlanır.
"""
import asyncio
import pathlib
import sys

import edge_tts

SEGMENTS = {
    "s1": "Sen neden kör edildin?",
    "s2": "Mustafa Armağan’dan, ezberleri sorgulatan bir tarih macerası.",
    "t1": "Talas Meydan Savaşı.",
    "t2": "Newton’ın büyücülüğü.",
    "t3": "Akşemseddin’in Fatih’e uyarı mektubu.",
    "t4": "Şakir Paşa’yı kim öldürdü?",
    "t5": "Köy Enstitülerini kim kapattı?",
    "c": "Zihninizi sorgulama yeteneğiyle donatan bir kitap.",
    "d1": "Şimşek çaktığında uyanmak da mümkün, uyumak da.",
    "d2": "Tercih sizin.",
    "e": "İslambol Yayınları’ndan. Sipariş için WhatsApp’tan yazın.",
}


async def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    voice = args[0] if len(args) > 0 else "tr-TR-AhmetNeural"
    rate = args[1] if len(args) > 1 else "+0%"
    pitch = args[2] if len(args) > 2 else "+0Hz"
    out = pathlib.Path(__file__).parent / "assets" / "vo"
    out.mkdir(parents=True, exist_ok=True)
    for key, text in SEGMENTS.items():
        target = out / f"{key}.mp3"
        if target.exists() and target.stat().st_size > 0 and "--yenile" not in sys.argv:
            print(f"{key}: var, atlandı")
            continue
        spoken = text.replace("’", "'")  # güvenli tarafta kal: düz kesme işareti
        for attempt in range(1, 7):  # hizmet aralıklı "ses gelmedi" veriyor: bekle ve yeniden dene
            try:
                await edge_tts.Communicate(spoken, voice, rate=rate, pitch=pitch).save(str(target))
                break
            except edge_tts.exceptions.NoAudioReceived:
                await asyncio.sleep(1.5 * attempt)
        else:
            print(f"{key}: HATA (ses gelmedi, 6 deneme) -> {spoken!r}")
            continue
        await asyncio.sleep(1.0)
        print(f"{key}: {target.stat().st_size} bayt")


asyncio.run(main())
