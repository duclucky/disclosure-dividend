import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const dist = path.join(root, "dist");
const serverDir = path.join(dist, "server");
const indexHtml = readFileSync(path.join(dist, "index.html"), "utf8");

mkdirSync(serverDir, { recursive: true });
writeFileSync(
  path.join(serverDir, "index.js"),
  `const INDEX_HTML = ${JSON.stringify(indexHtml)};

export default {
  async fetch(request, env) {
    if (env?.ASSETS?.fetch) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;
    }
    return new Response(INDEX_HTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
`,
  "utf8",
);
