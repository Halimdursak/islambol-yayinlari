// Ana sayfa duyuru slaytları: data/site/campaigns.json + kitap eşlemesi.
// Çözümleme mantığı scripts/cms/resolvers.mjs'te (veri dosyasında adlandırılmış export olmaz).
import { jsonOkuVeyaBos } from "./_oku.js";
import { resolveCampaigns } from "../../scripts/cms/resolvers.mjs";
import books from "./books.js";

export default function () {
  return resolveCampaigns(jsonOkuVeyaBos("data/site/campaigns.json", []), books());
}
