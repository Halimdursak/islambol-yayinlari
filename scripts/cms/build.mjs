import { spawn } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { containedPath } from "./store.mjs";

const CHILD = join(dirname(fileURLToPath(import.meta.url)), "build-child.mjs");

async function childBuild(root, staging) {
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, [CHILD, root, staging], { cwd: root, windowsHide: true, env: { ...process.env, PATH_PREFIX: "/" }, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    const append = (chunk) => { log = (log + chunk.toString()).slice(-12000); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => { child.kill(); reject(new Error("CMS derlemesi 120 saniyede tamamlanamadı.")); }, 120000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("exit", (code) => { clearTimeout(timer); code === 0 ? done() : reject(new Error(`Eleventy derlemesi başarısız (${code}): ${log}`)); });
  });
}

/** A fresh output tree removes pages for deleted records without deleting the last good publication first. */
export async function rebuildSite(root, logger = console.warn) {
  const staging = containedPath(root, `.local/cms-build-${randomUUID()}`);
  const old = containedPath(root, `.local/cms-old-${randomUUID()}`);
  const output = containedPath(root, "dist");
  let moved = false;
  await mkdir(dirname(staging), { recursive: true });
  try {
    await childBuild(root, staging);
    try { await rename(output, old); moved = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
    try { await rename(staging, output); } catch (error) { if (moved) await rename(old, output); throw error; }
  } finally {
    // Both recursive deletion targets are fixed descendants of the verified project root.
    try { await rm(containedPath(root, staging), { recursive: true, force: true }); }
    catch (error) { logger(`CMS geçici derleme klasörü temizlenemedi: ${error.message}`); }
  }
  // Publication has committed. Cleanup failures must not roll content back under the new HTML.
  if (moved) {
    try { await rm(containedPath(root, old), { recursive: true, force: true }); }
    catch (error) { logger(`CMS önceki yayın klasörü temizlenemedi: ${error.message}`); }
  }
}
