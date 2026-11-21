// Unit tests for the sidebar icon module: the logo as an icon set, the sidebar icon drawn again when it was drawn
// before the set was known (Home Assistant's legacy mode).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../custom_components/proxmox_panel/frontend/proxmox-icons.js", import.meta.url), "utf8");

function load(root) {
  const timers = [];
  const frames = [];
  const context = {
    window: {},
    document: { querySelector: () => (root ? { shadowRoot: root } : null) },
    requestAnimationFrame: (fn) => frames.push(fn),
    setTimeout: (fn) => timers.push(fn),
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, timers, frames };
}

const tree = (els) => ({ querySelectorAll: () => els });

test("icon set: the logo for every name", async () => {
  const { context } = load(null);
  const set = context.window.customIcons.proxmox_panel;
  const logo = await set.getIcon("logo");
  assert.match(logo.path, /^M/);
  assert.equal(logo.viewBox, "0 0 24 24");
  assert.equal((await set.getIcon("other")).path, logo.path);
});

test("a sidebar icon drawn in legacy mode is reset and drawn again", () => {
  const sidebar = { localName: "ha-icon", icon: "proxmox_panel:logo", _legacy: true };
  const other = { localName: "ha-icon", icon: "mdi:server", _legacy: false };
  const host = { localName: "ha-sidebar", shadowRoot: tree([sidebar]) };
  const { timers, frames } = load(tree([other, host]));
  assert.equal(sidebar._legacy, false);
  assert.equal(sidebar.icon, "");
  for (const fn of frames) fn();
  assert.equal(sidebar.icon, "proxmox_panel:logo");
  assert.equal(other.icon, "mdi:server");
  // Found at once: no retry
  assert.equal(timers.length, 0);
});

test("an icon already drawn is left alone; no sidebar yet: tried again later, 60 times at most", () => {
  const drawn = { localName: "ha-icon", icon: "proxmox_panel:logo", _legacy: false };
  const { frames } = load(tree([drawn]));
  assert.equal(drawn.icon, "proxmox_panel:logo");
  assert.equal(frames.length, 0);

  const { timers } = load(null);
  let tries = 1;
  while (timers.length) {
    timers.shift()();
    tries += 1;
  }
  assert.equal(tries, 60);
});
