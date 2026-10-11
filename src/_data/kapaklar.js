// Optimize kapak manifesti: data/catalog/kapaklar-opt.json (B4 Görsel & Performans üretir).
// Yoksa boş nesne döner; şablonlar orijinal kapağa (kitap.kapak_url) düşer.
// Manifest biçimi (kitap id → kayıt):
// {
//   "<id>": {
//     "orijinal": "/kapaklar/<id>.jpg", "genislik": 1200, "yukseklik": 1800, "oran": 0.6667,
//     "lqip": "data:image/jpeg;base64,...",            // ≤ 600 bayt bulanık yer tutucu (isteğe bağlı)
//     "kaynaklar": {
//       "webp": [{ "w": 320, "url": "/kapaklar-opt/<id>-320.webp" }, { "w": 640, ... }, { "w": 960, ... }],
//       "jpg":  [{ "w": 320, "url": "/kapaklar-opt/<id>-320.jpg" }, ...]
//     }
//   }
// }
// Sahibi: Site Direktörü.
import { jsonOkuVeyaBos } from "./_oku.js";

export default function () {
  return jsonOkuVeyaBos("data/catalog/kapaklar-opt.json", {});
}
