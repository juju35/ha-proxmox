// Renders the sidebar panel with mock Proxmox VE data and saves the README screenshots.
// Usage: npm run screenshots (CHROMIUM_PATH=/path/to/chrome to use an installed browser)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { history, inventory, NOW, states } from "./mock-states.mjs";
import { shots } from "./screenshot-shots.mjs";
import { writeIfChanged } from "./screenshot-write.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const panelJs = readFileSync(`${root}custom_components/proxmox_panel/frontend/proxmox-panel.js`, "utf8");

const THEMES = {
  light: {
    "--primary-background-color": "#e8eaed",
    "--secondary-background-color": "#ececec",
    "--card-background-color": "#ffffff",
    "--primary-text-color": "#212121",
    "--secondary-text-color": "#727272",
    "--divider-color": "rgba(0,0,0,.12)",
    "--app-header-background-color": "#03a9f4",
    "--app-header-text-color": "#ffffff",
  },
  dark: {
    "--primary-background-color": "#111111",
    "--secondary-background-color": "#282828",
    "--card-background-color": "#1c1c1c",
    "--primary-text-color": "#e1e1e1",
    "--secondary-text-color": "#9b9b9b",
    "--divider-color": "rgba(225,225,225,.12)",
    "--app-header-background-color": "#1c1c1c",
    "--app-header-text-color": "#e1e1e1",
  },
};

const page_html = (theme, width) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  :root { --primary-color: #03a9f4; ${Object.entries(THEMES[theme]).map(([k, v]) => `${k}:${v};`).join("")} }
  body { margin: 0; background: var(--primary-background-color); color: var(--primary-text-color);
         font-family: Roboto, "Segoe UI", Helvetica, Arial, sans-serif; width: ${width}px; }
</style></head><body><div id="root"></div></body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

for (const s of shots) {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: s.width, height: 1600 } });
  await page.clock.setFixedTime(NOW);
  page.on("pageerror", (err) => console.error(`${s.file}: ${err.message}`));
  await page.setContent(page_html(s.theme, s.width));
  await page.addScriptTag({ content: panelJs });
  await page.evaluate(
    ({ tab, expand, press, states, inventory, history }) => {
      const el = document.createElement("proxmox-panel");
      el.panel = { url_path: "proxmox", config: { version: "test" } };
      el.route = { path: `/${tab}` };
      el._expanded = expand || null;
      el.hass = {
        states, language: "en", locale: { language: "en" },
        connection: { subscribeMessage: () => Promise.resolve(() => {}) },
        callWS: async (msg) => (msg.type === "proxmox_panel/inventory" ? inventory : msg.type === "history/history_during_period" ? history : { settings: inventory.settings }),
        callService: async () => {},
      };
      document.getElementById("root").appendChild(el);
      // The confirmation of an action, as a press on its button shows it
      if (press) setTimeout(() => el._askOrPress(tab, el._find(press[0]), press[1]), 200);
    },
    { tab: s.tab, expand: s.expand, press: s.press, states, inventory, history },
  );
  await page.waitForTimeout(700);
  const box = await page.locator("#root").boundingBox();
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: s.width, height: Math.ceil(box.height) + 16 }, animations: "disabled" });
  // Rewritten only when the pixels change: an identical picture never shows up as a modified file.
  const written = writeIfChanged(`${root}screenshots/${s.file}.png`, png);
  console.log(`screenshots/${s.file}.png${written ? "" : " (unchanged)"}`);
  await page.close();
}

await browser.close();
