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
];

export const shots = pairs.flatMap(({ light, dark, ...setup }) => [
  { file: light, theme: "light", width: 820, ...setup },
  { file: dark, theme: "dark", width: 820, ...setup },
]);
