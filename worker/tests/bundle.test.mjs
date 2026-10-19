import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildAll } from "../scripts/build.mjs";

test("paketlenmiş Worker, kod üretimi yasakken (Cloudflare koşulu) çalışır ve boyut sınırının altındadır", async () => {
  const built = await buildAll();
  assert.ok(built.worker.compressed < 2_800_000, `sıkıştırılmış boyut ${built.worker.compressed}`);
  assert.ok(built.assets.files.includes("/yonetim/") && built.assets.files.includes("/assets/js/admin.js") && built.assets.files.some((f) => f.endsWith(".woff2")) && built.assets.files.includes("/yonetim-lib/pdfjs/pdf.worker.min.js"));
  const smoke = fileURLToPath(new URL("./bundle-smoke.mjs", import.meta.url));
  const result = spawnSync(process.execPath, ["--disallow-code-generation-from-strings", smoke], { encoding: "utf8", timeout: 120000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /paket duman testi geçti/);
});
