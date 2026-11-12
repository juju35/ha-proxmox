// The Lovelace cards: what each one shows, the actions kept for administrators, the editors' YAML.
import assert from "node:assert/strict";
import { test } from "node:test";
import { inventory, states } from "../scripts/mock-states.mjs";
import { cards } from "./load.mjs";

const inv = { ...JSON.parse(JSON.stringify(inventory)), confirm_actions: true };
const hass = (admin = true, calls = []) => ({
  states,
  language: "en",
  user: { is_admin: admin },
  callWS: async (msg) => (msg.type === "proxmox_panel/cards" ? inv : {}),
  callService: async (...args) => calls.push(args),
});

const make = async (Cls, config, h = hass()) => {
  cards.resetInventory();
  await cards.loadInventory(h);
  const card = new Cls();
  card.setConfig(config);
  card._hass = h;
  card._langLoaded = "en";
  return card;
};

test("node card: rings, machines running first, storage, actions for administrators only", async () => {
  const card = await make(cards.ProxmoxCard, {});
  const html = card._card();
  assert.match(html, /pve1/);
  assert.match(html, /23 %/);
  assert.match(html, /VMs running: 2\/4/);
  assert.match(html, /Containers running: 5\/6/);
  assert.ok(html.indexOf("docker-host") < html.indexOf("win11"), "running before stopped");
  assert.match(html, /local-lvm/);
  assert.doesNotMatch(html, /usb-archive/, "inactive storage left out");
  assert.match(html, /data-press="start"/);
  const user = await make(cards.ProxmoxCard, {}, hass(false));
  assert.doesNotMatch(user._card(), /data-action="press"/);
});

test("node card options: max items, stopped machines, sections, title", async () => {
  const card = await make(cards.ProxmoxCard, { max_items: 2, show_stopped: false, show_storage: false, show_vms: false, show_title: false });
  const html = card._card();
  assert.match(html, /More: 3/);
  assert.doesNotMatch(html, /test-debian/);
  assert.doesNotMatch(html, /local-lvm/);
  assert.doesNotMatch(html, /VMs running/);
  assert.doesNotMatch(html, /class="n">pve1/);
  const missing = await make(cards.ProxmoxCard, { node: "pve9" });
  assert.match(missing._card(), /No Proxmox VE node found/);
  const byName = await make(cards.ProxmoxCard, { node: "PVE1" });
  assert.match(byName._card(), /pve1/);
});

test("mini card: one line per node, zoom to the full card", async () => {
  const card = await make(cards.ProxmoxMiniCard, {});
  let html = card._card();
  assert.match(html, /VMs 2\/4 · Containers 5\/6/);
  assert.match(html, /CPU 23 %/);
  assert.match(html, /data-action="zoom"/);
  assert.doesNotMatch(html, /class="rings"/);
  card._zoomed = true;
  html = card._card();
  assert.match(html, /class="rings"/);
  const noZoom = await make(cards.ProxmoxMiniCard, { zoom: false });
  assert.doesNotMatch(noZoom._card(), /data-action="zoom"/);
});

test("machine card: a running VM, a stopped container, a missing one", async () => {
  const vm = await make(cards.ProxmoxGuestCard, { guest: 102 });
  let html = vm._card();
  assert.match(html, /docker-host/);
  assert.match(html, /VM 102 · pve1 · Up for 12 days/);
  assert.match(html, /77 %/);
  assert.match(html, /Download 525 GiB/);
  assert.match(html, /data-press="pause"/);
  assert.doesNotMatch(html, /data-press="start"/);
  const ct = await make(cards.ProxmoxGuestCard, { guests: [205, "nowhere"] });
  html = ct._card();
  assert.match(html, /Container 205/);
  assert.match(html, /data-press="start"/);
  assert.doesNotMatch(html, /class="rings"/);
  assert.match(html, /Not found in Proxmox VE: nowhere/);
  const empty = await make(cards.ProxmoxGuestCard, {});
  assert.match(empty._card(), /Choose a virtual machine or a container/);
});

test("machine mini card: bars when running, a quick start when stopped (administrators)", async () => {
  const card = await make(cards.ProxmoxGuestMiniCard, { guests: [102, 205] });
  const html = card._card();
  assert.match(html, /RAM 77 %/);
  assert.match(html, /data-item="dev_205" data-press="start"/);
  const user = await make(cards.ProxmoxGuestMiniCard, { guests: [205] }, hass(false));
  assert.doesNotMatch(user._card(), /data-press/);
});

test("an action that stops is confirmed, then pressed; a non-administrator presses nothing", async () => {
  const calls = [];
  const card = await make(cards.ProxmoxGuestCard, { guest: 202 }, hass(true, calls));
  card._action("press", { item: "dev_202", press: "restart" });
  assert.equal(calls.length, 0);
  assert.match(card._card(), /Restart: jellyfin\?/);
  await card._action("confirmed", {});
  assert.deepEqual(calls.map((c) => c[3].entity_id), ["button.ct_jellyfin_restart"]);
  card._action("press", { item: "dev_202", press: "snapshot_create" });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.length, 2);
  clearTimeout(card._messageTimer);
  const userCalls = [];
  const user = await make(cards.ProxmoxGuestCard, { guest: 202 }, hass(false, userCalls));
  await user._action("press", { item: "dev_202", press: "snapshot_create" });
  assert.equal(userCalls.length, 0);
});

test("no integration: the card says so", async () => {
  cards.resetInventory();
  const h = { ...hass(), callWS: async () => Promise.reject({ code: "unknown_command" }) };
  await cards.loadInventory(h);
  const card = new cards.ProxmoxCard();
  card.setConfig({});
  card._hass = h;
  assert.match(card._card(), /Add the Proxmox Panel integration/);
});

test("the guest editor writes guest for one machine and guests for several", () => {
  const Editor = customElements.get("proxmox-guest-card-editor");
  const e = new Editor();
  assert.deepEqual({ ...e._toForm({ guest: 102 }) }, { guests: ["102"] });
  assert.deepEqual(e._clean(e._fromForm({ guests: ["102"] })), { guest: 102 });
  assert.deepEqual(e._clean(e._fromForm({ guests: ["100", "202"] })), { guests: [100, 202] });
  assert.deepEqual(e._clean({ show_network: true, show_title: false }), { show_title: false });
});

test("every card is offered in the card picker", () => {
  const types = window.customCards.map((c) => c.type);
  for (const t of ["proxmox-card", "proxmox-mini-card", "proxmox-guest-card", "proxmox-guest-mini-card"]) assert.ok(types.includes(t), t);
});
