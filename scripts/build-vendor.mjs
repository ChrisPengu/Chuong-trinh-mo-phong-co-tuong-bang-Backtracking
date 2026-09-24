import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
await mkdir("vendor", { recursive: true });
await build({ entryPoints: ["scripts/vendor-entry.js"], outfile: "vendor/three.js", bundle: true, format: "esm", minify: true, legalComments: "eof" });
await copyFile("node_modules/three/LICENSE", "vendor/THREE-LICENSE.txt");
console.log("Built local Three.js bundle + MIT license.");
