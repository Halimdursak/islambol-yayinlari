// Cloudflare Worker girişi. Derleme betiği (worker/scripts/build.mjs) bu dosyayı tek bir modüle paketler.
import { ASSETS, VERSION } from "../generated/assets.mjs";
import { createEdge } from "./edge.mjs";

export { Panel } from "./panel-do.mjs";

const edge = createEdge({ assets: ASSETS, version: VERSION });

export default {
  fetch(request, env) { return edge(request, env); },
};
