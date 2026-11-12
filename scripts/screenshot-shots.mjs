// The README screenshots rendered by scripts/screenshots.mjs: one entry per PNG in screenshots/.
// Every screenshot is rendered in both themes from one setup, so a light/dark pair shows exactly the same state.
const pairs = [
  { light: "panel-nodes", dark: "panel-nodes-dark", tab: "nodes" },
  { light: "panel-vms", dark: "panel-vms-dark", tab: "vms", expand: "dev_102" },
  { light: "panel-containers", dark: "panel-containers-dark", tab: "containers" },
  { light: "panel-confirm", dark: "panel-confirm-dark", tab: "containers", press: ["dev_202", "restart"] },
  { light: "panel-storage", dark: "panel-storage-dark", tab: "storage" },
  { light: "panel-backups", dark: "panel-backups-dark", tab: "backups" },
  { light: "panel-settings", dark: "panel-settings-dark", tab: "settings" },
  { light: "card", dark: "card-dark", card: "proxmox-card", width: 460 },
  { light: "card-options", dark: "card-options-dark", card: "proxmox-card", width: 460, config: { max_items: 2, show_stopped: false, show_storage: false } },
  { light: "card-confirm", dark: "card-confirm-dark", card: "proxmox-card", width: 460, config: { show_storage: false }, press: ["dev_100", "restart"] },
  { light: "mini-card", dark: "mini-card-dark", card: "proxmox-mini-card", width: 380 },
  { light: "mini-card-zoom", dark: "mini-card-zoom-dark", card: "proxmox-mini-card", width: 460, zoom: true },
  { light: "guest-card", dark: "guest-card-dark", card: "proxmox-guest-card", width: 460, config: { guest: 102 } },
  { light: "guest-card-stopped", dark: "guest-card-stopped-dark", card: "proxmox-guest-card", width: 460, config: { guest: 205 } },
  { light: "guest-mini-card", dark: "guest-mini-card-dark", card: "proxmox-guest-mini-card", width: 380, config: { guests: [102, 202, 101] } },
  { light: "guest-mini-card-zoom", dark: "guest-mini-card-zoom-dark", card: "proxmox-guest-mini-card", width: 460, config: { guest: 102 }, zoom: true },
];

export const shots = pairs.flatMap(({ light, dark, ...setup }) => [
  { file: light, theme: "light", width: 820, ...setup },
  { file: dark, theme: "dark", width: 820, ...setup },
]);
