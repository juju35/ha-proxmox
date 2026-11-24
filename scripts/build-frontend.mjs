// Assembles the frontend's ES modules: every src/<stem>/index.js becomes custom_components/proxmox_panel/frontend/<stem>.js,
// the module Home Assistant serves (scripts/bundle.mjs). The assembled files are not committed: run this before the
// tests, the screenshots and the release zip (npm run build; npm test runs it first).
// Usage: node scripts/build-frontend.mjs
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bundle } from "./bundle.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = "custom_components/proxmox_panel/frontend";

for (const stem of readdirSync(`${root}src`).sort()) {
  if (!existsSync(`${root}src/${stem}/index.js`)) continue;
  const code = bundle(`src/${stem}/index.js`, `${out}/${stem}.js`);
  writeFileSync(`${root}${out}/${stem}.js`, code);
  console.log(`src/${stem}/ → ${out}/${stem}.js (${(code.length / 1024).toFixed(1)} KB)`);
}
