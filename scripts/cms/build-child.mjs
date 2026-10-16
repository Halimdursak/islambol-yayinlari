import Eleventy from "@11ty/eleventy";
import { relative, resolve, sep } from "node:path";

const [root, output] = process.argv.slice(2);
if (!root || !output) throw new Error("CMS derleme yolları belirtilmedi.");
process.chdir(root);
// CLI source freezes the explicit output directory instead of allowing config.dir.output to replace it.
const eleventy = new Eleventy("src", relative(root, output).split(sep).join("/"), { source: "cli", configPath: resolve(root, "eleventy.config.js"), quietMode: true });
await eleventy.write();
