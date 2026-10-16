import { jsonOkuVeyaBos } from "./_oku.js";

export default function () {
  return jsonOkuVeyaBos("data/catalog/og.json", { site: "/og/site.png" });
}
