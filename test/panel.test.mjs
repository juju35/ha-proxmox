// The sidebar panel: languages, formatting, what each tab shows and the buttons it presses.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { common, panel as panelModule } from "./load.mjs";
import { inventory, states } from "../scripts/mock-states.mjs";

const lib = { ...common, ...panelModule };
const i18n = new URL("../custom_components/proxmox_panel/frontend/i18n/", import.meta.url);
const placeholders = (s) => (String(s).match(/\{\w+\}/g) || []).sort();

test("every language file has one string per English key, with its placeholders", () => {
  const files = readdirSync(i18n).map((f) => f.replace(/\.json$/, ""));
  assert.deepEqual([...files].sort(), lib.PROXMOX_PANEL_LANGS.filter((l) => l !== "en").sort());
  for (const lang of files) {
    const strings = JSON.parse(readFileSync(new URL(`${lang}.json`, i18n), "utf8"));
    assert.deepEqual(Object.keys(strings).sort(), Object.keys(lib.PROXMOX_PANEL_EN).sort(), lang);
    for (const [k, v] of Object.entries(strings)) assert.deepEqual(placeholders(v), placeholders(lib.PROXMOX_PANEL_EN[k]), `${lang}.${k}`);
  }
});

test("counts use the label: {n} form", () => {
  for (const k of ["sum_storage", "hidden_stopped", "cpus"]) assert.match(lib.PROXMOX_PANEL_EN[k], /:\s?\{n\}$/);
});

test("sizes in base 1024 with 2, 1 or 0 decimals; durations in their largest unit", () => {
  assert.equal(lib.proxmoxPanelBytes(6.2 * 1024 ** 3), "6.20 GiB");
  assert.equal(lib.proxmoxPanelBytes(38.2 * 1024 ** 3), "38.2 GiB");
  assert.equal(lib.proxmoxPanelBytes(268 * 1024 ** 3), "268 GiB");
  assert.equal(lib.proxmoxPanelBytes(1.4 * 1024 ** 4), "1.40 TiB");
  assert.equal(lib.proxmoxPanelBytes(512), "512 B");
  assert.equal(lib.proxmoxPanelBytes(null), "—");
  assert.equal(lib.proxmoxPanelBytes(6.2 * 1024 ** 3, "fr"), "6,20 GiB");
  assert.equal(lib.proxmoxPanelDuration(12 * 86400 + 3600), "12 days");
  assert.equal(lib.proxmoxPanelDuration(5 * 3600), "5 hr");
  assert.equal(lib.proxmoxPanelDuration(20), "1 min");
});

const panel = (calls = [], settings = {}) => {
  const p = new lib.ProxmoxPanel();
  p._hass = {
    states,
    language: "en",
    callService: async (...args) => calls.push(args),
    callWS: async () => ({}),
  };
  p._inv = JSON.parse(JSON.stringify(inventory));
  p._settings = { ...inventory.settings, ...settings };
  return p;
};

test("the language resolves to the full code, then its base, then English", () => {
  const p = panel();
  for (const [code, lang] of [["fr-FR", "fr"], ["sr-Latn", "sr-Latn"], ["pt-BR", "pt"], ["ja", "en"]]) {
    p._hass = { language: code };
    assert.equal(p._lang(), lang);
  }
});

test("statuses come from the status sensor, else the running binary sensor", () => {
  const p = panel();
  const [vm100, vm101, , vm103] = p._items("vm");
  assert.equal(p._status(vm100), "running");
  assert.equal(p._status(vm101), "stopped");
  assert.equal(p._status(vm103), "suspended");
  assert.equal(p._status({ kind: "vm", entities: { running: "binary_sensor.vm_homeassistant_status" } }), "running");
  assert.equal(p._status({ kind: "node", entities: {} }), "unavailable");
  assert.equal(p._status(p._items("node")[0]), "online");
});

test("VMs: rows with their quick actions; stopped ones hidden when the setting says so", () => {
  const p = panel();
  const html = p._guestsHtml("vm", "vms");
  assert.match(html, /VMs: 4 · Running: 2/);
  assert.match(html, /docker-host/);
  assert.match(html, /data-item="dev_101" data-press="start"/);
  assert.match(html, /data-item="dev_100" data-press="shutdown"/);
  assert.match(html, /data-item="dev_103" data-press="resume"/);
  const hidden = panel([], { show_stopped: false })._guestsHtml("vm", "vms");
  assert.doesNotMatch(hidden, /win11/);
  assert.match(hidden, /Stopped and hidden: 1/);
});

test("the unfolded row offers only the buttons that fit the status", () => {
  const p = panel();
  const [vm100, vm101] = p._items("vm");
  const running = p._detailHtml(vm100, ["restart", "shutdown"]);
  assert.match(running, /data-press="pause"/);
  assert.doesNotMatch(running, /data-press="start"|data-press="resume"/);
  const stopped = p._detailHtml(vm101, ["start"]);
  assert.match(stopped, /data-press="snapshot_create"/);
  assert.doesNotMatch(stopped, /data-press="stop"|data-press="pause"/);
});

test("search and node filter", () => {
  const p = panel();
  p._query.containers = "jelly";
  assert.deepEqual([...p._guests("container", "containers").map((g) => g.name)], ["jellyfin"]);
  p._query.containers = "20";
  assert.equal(p._guests("container", "containers").length, 6);
  p._node = "elsewhere";
  assert.equal(p._guests("container", "containers").length, 0);
});

test("an action that stops is confirmed first, then pressed", async () => {
  const calls = [];
  const p = panel(calls);
  const ct = p._find("dev_202");
  p._askOrPress("containers", ct, "restart");
  assert.equal(calls.length, 0);
  assert.equal(p._confirm.entity, "button.ct_jellyfin_restart");
  assert.match(p._notesHtml("containers"), /Restart: jellyfin\?/);
  await p._action("containers", { action: "confirmed" });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["button", "press", {}, { entity_id: "button.ct_jellyfin_restart" }]]);
  assert.equal(p._confirm, null);
  assert.equal(p._message.text, "Sent: Restart · jellyfin");
});

test("start and snapshot go at once; everything does when confirmation is off", async () => {
  const calls = [];
  const p = panel(calls);
  await p._askOrPress("vms", p._find("dev_101"), "start");
  await p._askOrPress("backups", p._find("dev_100"), "snapshot_create");
  const q = panel(calls, { confirm_actions: false });
  await q._askOrPress("nodes", q._find("dev_pve1"), "shutdown");
  assert.deepEqual(
    calls.map((c) => c[3].entity_id),
    ["button.vm_win11_start", "button.vm_homeassistant_snapshot_create", "button.pve1_shut_down"],
  );
});

test("nodes: rings, guests running and the update", () => {
  const html = panel()._nodesHtml();
  assert.match(html, /23 %/);
  assert.match(html, /62 %/);
  assert.match(html, /RAM<small>19.8 GiB \/ 31.9 GiB<\/small>/);
  assert.match(html, /VMs running: 2\/4/);
  assert.match(html, /Containers running: 5\/6/);
  assert.match(html, /Update available/);
  assert.match(html, /data-press="start_all"/);
});

test("storage: inactive ones hidden when asked", () => {
  assert.match(panel()._storageHtml(), /usb-archive/);
  const html = panel([], { hide_inactive_storage: true })._storageHtml();
  assert.doesNotMatch(html, /usb-archive/);
  assert.match(html, /Storage: 3/);
});

test("backups: disabled sensors lead to the node's device", () => {
  const p = panel();
  const node = p._items("node")[0];
  assert.match(p._backupsHtml(), /Last backup: /);
  node.entities = { ...node.entities, last_backup: undefined };
  node.disabled = ["backup_duration", "last_backup"];
  assert.match(p._backupsHtml(), /The backup sensors of pve1 are disabled/);
  assert.match(p._backupsHtml(), /data-action="device" data-item="dev_pve1"/);
});

test("no Proxmox VE: the panel offers to add it; not allowed: says so", () => {
  const p = panel();
  p._inv = { configured: false, entries: [], node: [], vm: [], container: [], storage: [] };
  assert.match(p._introHtml("nodes"), /add-proxmox/);
  assert.equal(p._introHtml("settings"), null);
  p._inv = { denied: true };
  assert.match(p._introHtml("nodes"), /kept for administrators/);
});

test("names are escaped", () => {
  assert.equal(lib.proxmoxPanelEsc(`<b a="1">&'`), "&lt;b a=&quot;1&quot;&gt;&amp;&#39;");
});
