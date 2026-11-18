// Renders the sidebar panel with mock Proxmox VE data and saves the README screenshots.
// Usage: npm run screenshots (CHROMIUM_PATH=/path/to/chrome to use an installed browser)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { history, inventory, NOW, states } from "./mock-states.mjs";
import { gifs, shots } from "./screenshot-shots.mjs";
import { writeIfChanged } from "./screenshot-write.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const frontend = `${root}custom_components/proxmox_panel/frontend/`;
// The panel and the cards are ES modules importing proxmox-common.js: the page is served from a fake origin whose
// /proxmox_panel/ files come from the repository.
const ORIGIN = "http://ha.test";

// Minimal stand-in for Home Assistant's <ha-card>.
const HA_CARD = `customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--card-background-color);border-radius:12px;" +
      "border:1px solid var(--divider-color);color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});`;

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
  body.card { padding: 16px; }
</style></head><body><div id="root"></div></body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// A page showing the panel or a card of the setup `s`, with the mock data (`s.states` overriding some states).
async function open(s) {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: s.width + (s.card ? 32 : 0), height: 1600 } });
  await page.clock.setFixedTime(NOW);
  page.on("pageerror", (err) => console.error(`${s.file}: ${err.message}`));
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/proxmox_panel/") && path.endsWith(".js"))
      return route.fulfill({ contentType: "text/javascript", body: readFileSync(`${frontend}${path.slice(15)}`, "utf8") });
    if (path.startsWith("/proxmox_panel/i18n/")) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: "text/html", body: page_html(s.theme, s.width) });
  });
  await page.goto(`${ORIGIN}/`);
  await page.addScriptTag({ content: HA_CARD });
  await page.addScriptTag({ url: `/proxmox_panel/${s.card ? "proxmox-cards.js" : "proxmox-panel.js"}`, type: "module" });
  await page.evaluate(
    async ({ s, states, inventory, history }) => {
      const hass = {
        states, language: "en", locale: { language: "en" }, user: { is_admin: true }, themes: { darkMode: s.theme === "dark" },
        connection: { subscribeMessage: () => Promise.resolve(() => {}) },
        callWS: async (msg) =>
          msg.type === "proxmox_panel/inventory"
            ? inventory
            : msg.type === "proxmox_panel/cards"
              ? { ...inventory, confirm_actions: true }
              : msg.type === "history/history_during_period"
                ? history
                : { settings: inventory.settings },
        callService: async () => {},
      };
      if (s.card) {
        document.body.classList.add("card");
        await customElements.whenDefined(s.card);
        const el = document.createElement(s.card);
        el.setConfig({ type: `custom:${s.card}`, ...(s.config || {}) });
        el.hass = hass;
        document.getElementById("root").appendChild(el);
        if (s.zoom) setTimeout(() => el._setZoom(true), 150);
        if (s.press) setTimeout(() => el._action("press", { item: s.press[0], press: s.press[1] }), 150);
        return;
      }
      await customElements.whenDefined("proxmox-panel");
      const el = document.createElement("proxmox-panel");
      el.panel = { url_path: "proxmox", config: { version: "test" } };
      el.route = { path: `/${s.tab}` };
      el._expanded = s.expand || null;
      el.hass = hass;
      document.getElementById("root").appendChild(el);
      // The confirmation of an action, as a press on its button shows it
      if (s.press) setTimeout(() => el._askOrPress(s.tab, el._find(s.press[0]), s.press[1]), 200);
    },
    { s, states: { ...states, ...(s.states || {}) }, inventory, history },
  );
  await page.waitForTimeout(800);
  return page;
}

// Pauses every animation of the page at `t` ms, so a capture never depends on how fast the machine rendered it.
// Collected per document / shadow root: unlike Element.getAnimations(), DocumentOrShadowRoot.getAnimations() also
// returns the ::before/::after animations (the uplink's packets), which otherwise kept running in real time.
const seek = (page, t) =>
  page.evaluate((t) => {
    const walk = (root, out) => {
      out.push(...root.getAnimations());
      for (const el of root.querySelectorAll("*")) if (el.shadowRoot) walk(el.shadowRoot, out);
      return out;
    };
    for (const a of walk(document, [])) {
      a.pause();
      a.currentTime = t;
    }
  }, t);

for (const s of shots) {
  const page = await open(s);
  await seek(page, 0);
  const box = await page.locator("#root").boundingBox();
  const pad = s.card ? 16 : 0;
  const png = await page.screenshot({
    clip: { x: 0, y: 0, width: s.width + 2 * pad, height: Math.ceil(box.height) + 2 * pad + (s.card ? 0 : 16) },
    animations: "disabled",
  });
  // Rewritten only when the pixels change: an identical picture never shows up as a modified file.
  const written = writeIfChanged(`${root}screenshots/${s.file}.png`, png);
  console.log(`screenshots/${s.file}.png${written ? "" : " (unchanged)"}`);
  await page.close();
}

// The banner's animations, one looping GIF per state (screenshots/<file>.gif): every animation paused and stepped
// frame by frame over a 2.4 s loop (two blinks of the status lights, one pass of the uplink's slow packets), so the
// GIF is the same whatever the machine's speed.
const FPS = 10;
const CYCLE = 2400;
for (const g of gifs) {
  const page = await open(g);
  const clip = await page.evaluate(() => {
    const b = document.querySelector("#root > *").shadowRoot.querySelector(".banner").getBoundingClientRect();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  });
  const dir = mkdtempSync(join(tmpdir(), "px-frames-"));
  const frames = (CYCLE / 1000) * FPS;
  for (let i = 0; i < frames; i++) {
    await seek(page, 3 * CYCLE + (i * 1000) / FPS);
    await page.screenshot({ path: join(dir, `f${String(i).padStart(3, "0")}.png`), clip, animations: "allow" });
  }
  const out = join(dir, "out.gif");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%03d.png"),
    "-vf", "split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
    "-fflags", "+bitexact", "-flags", "+bitexact", "-loop", "0", out,
  ]);
  const written = writeIfChanged(`${root}screenshots/${g.file}.gif`, readFileSync(out));
  console.log(`screenshots/${g.file}.gif${written ? "" : " (unchanged)"}`);
  rmSync(dir, { recursive: true });
  await page.close();
}

await browser.close();
