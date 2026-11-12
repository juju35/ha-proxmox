/*
 * Shared by the Proxmox panel and the Proxmox cards (ES module, served without long-term caching so that both
 * always get the version installed): languages, strings, icons, formatting and the reading of the Proxmox VE states.
 * https://github.com/juju35/ha-proxmox
 */

export const PROXMOX_PANEL_LANGS = ["en", "fr", "de", "es", "sr", "sr-Latn", "it", "nl", "pt", "pl", "ro", "da", "sv", "bg", "ru", "uk", "hu", "sk", "cs", "sl", "lv", "el"];
// Actions that stop or restart something: confirmed first when the setting asks for it
export const PROXMOX_PANEL_CUTTING = ["stop", "shutdown", "reset", "restart", "hibernate", "reboot", "stop_all", "suspend_all"];
// Buttons of a machine, in the order the unfolded row shows them
export const PROXMOX_PANEL_ACTIONS = ["start", "resume", "pause", "hibernate", "restart", "reset", "shutdown", "stop", "snapshot_create"];
export const PROXMOX_PANEL_NODE_ACTIONS = ["start_all", "suspend_all", "stop_all", "reboot", "shutdown"];
// The buttons that make sense in each status (any of them when the status is unknown)
export const PROXMOX_PANEL_FOR_STATUS = {
  running: ["pause", "hibernate", "restart", "reset", "shutdown", "stop", "snapshot_create"],
  stopped: ["start", "snapshot_create"],
  suspended: ["resume", "stop", "snapshot_create"],
};

export const PROXMOX_PANEL_EN = {
  title: "Proxmox",
  nodes: "Nodes",
  vms: "VMs",
  containers: "Containers",
  storage: "Storage",
  backups: "Backups",
  settings: "Settings",
  open_integration: "Proxmox VE integration",
  loading: "Loading…",
  no_proxmox: "The Proxmox VE integration is not set up yet. Add it with your Proxmox server: this panel shows what it offers.",
  add_proxmox: "Add the Proxmox VE integration",
  not_loaded: "{title} is not loaded ({state}): its values stay unavailable until it is.",
  denied: "This panel is kept for administrators.",
  error: "Error: {error}",
  retry: "Retry",
  empty_nodes: "No node.",
  empty_vms: "No virtual machine.",
  empty_containers: "No container.",
  empty_storage: "No storage.",
  no_match: "Nothing matches.",
  search: "Search",
  all_nodes: "All nodes",
  sum_vms: "VMs: {n} · Running: {running}",
  sum_containers: "Containers: {n} · Running: {running}",
  sum_storage: "Storage: {n}",
  hidden_stopped: "Stopped and hidden: {n}",
  st_running: "Running",
  st_stopped: "Stopped",
  st_suspended: "Suspended",
  st_online: "Online",
  st_offline: "Offline",
  st_unavailable: "Unavailable",
  update: "Update available",
  up_for: "Up for {d}",
  cpus: "CPUs: {n}",
  cpu: "CPU",
  ram: "RAM",
  disk: "Disk",
  of: "{used} / {total}",
  vms_running: "VMs running: {running}/{n}",
  containers_running: "Containers running: {running}/{n}",
  a_start: "Start",
  a_stop: "Stop",
  a_shutdown: "Shut down",
  a_restart: "Restart",
  a_reboot: "Restart",
  a_pause: "Pause",
  a_hibernate: "Hibernate",
  a_resume: "Resume",
  a_reset: "Reset",
  a_snapshot_create: "Snapshot",
  a_start_all: "Start all",
  a_stop_all: "Stop all",
  a_suspend_all: "Suspend all",
  confirm: "{action}: {name}?",
  cancel: "Cancel",
  sent: "Sent: {action} · {name}",
  download: "Download",
  upload: "Upload",
  details: "Show or hide the details",
  open_proxmox: "Open in Proxmox",
  used: "Used: {v}",
  free: "Free: {v}",
  total: "Total: {v}",
  active: "Active",
  inactive: "Inactive",
  shared: "Shared",
  last_backup: "Last backup: {when}",
  no_backup: "No backup yet",
  duration: "Duration: {d}",
  backup_ok: "OK",
  backup_failed: "Failed",
  backup_disabled: "The backup sensors of {node} are disabled in Home Assistant: enable them on the node's device to follow its backups here.",
  open_device: "Open the device",
  snapshots: "Manual snapshot",
  no_snapshot: "No virtual machine or container offers a snapshot.",
  s_show_stopped: "Show stopped machines",
  s_show_stopped_hint: "In the VMs and Containers tabs.",
  s_confirm: "Ask before stopping or restarting",
  s_confirm_hint: "Stop, shut down, reset, restart, hibernate and the node-wide actions.",
  s_hide_storage: "Hide inactive storage",
  s_hide_storage_hint: "Storage that is disabled or not active.",
  save: "Save",
  saved: "Saved.",
  // Cards
  c_no_integration: "Add the Proxmox Panel integration: the Proxmox cards read the Proxmox VE integration through it.",
  c_no_node: "No Proxmox VE node found.",
  c_no_guest: "Choose a virtual machine or a container in the card's settings.",
  c_guest_missing: "Not found in Proxmox VE: {guest}",
  c_more: "More: {n}",
  c_nodes: "Nodes: {n}",
  c_running: "Running: {running}/{n}",
  c_vm: "VM {id}",
  c_container: "Container {id}",
  c_zoom_in: "Show the full card",
  c_zoom_out: "Back to the compact view",
  e_node: "Node",
  e_first_node: "First node",
  e_guests: "Virtual machines and containers",
  e_show_vms: "Virtual machines",
  e_show_containers: "Containers",
  e_show_storage: "Storage",
  e_show_stopped: "Stopped machines",
  e_show_actions: "Actions (administrators)",
  e_show_network: "Network",
  e_show_title: "Title",
  e_show_subtitle: "Subtitle",
  e_zoom: "Button to the full card",
  e_max_items: "Machines shown per list",
  e_language: "Language",
  e_lang_auto: "As in Home Assistant",
};

export const proxmoxPanelEsc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// mdi paths used by the panel (ha-icon is avoided so that the screenshots and tests need no frontend), and the
// Proxmox logo (the same as the sidebar entry's, frontend/proxmox-icons.js)
export const PROXMOX_PANEL_ICONS = {
  logo: "M6.42 21.57C5.87 21.47 5.26 21.19 4.89 20.85L4.71 20.69L8.34 16.66C10.34 14.45 11.99 12.64 12.00 12.65C12.05 12.67 19.23 20.64 19.23 20.68C19.25 20.77 18.82 21.08 18.44 21.27C17.28 21.86 15.96 21.67 15.03 20.79C14.89 20.65 14.14 19.85 13.38 19.01C12.61 18.17 11.98 17.49 11.96 17.51C9.20 20.58 9.01 20.79 8.67 21.03C8.39 21.23 7.98 21.43 7.65 21.51C7.36 21.59 6.69 21.62 6.42 21.57ZM3.05 19.17C2.35 19.09 1.86 18.88 1.28 18.42C1.00 18.19 1.00 18.19 1.06 18.11C1.10 18.06 2.35 16.67 3.83 15.03C5.32 13.38 6.54 12.02 6.54 12.00C6.54 11.98 5.29 10.59 3.77 8.90L1.00 5.83L1.14 5.70C2.33 4.67 3.98 4.55 5.24 5.39C5.42 5.51 5.68 5.74 5.83 5.89C6.29 6.35 11.36 11.98 11.35 12.01C11.33 12.08 5.76 18.22 5.58 18.38C4.89 18.97 3.92 19.27 3.05 19.17ZM20.19 19.17C19.53 19.10 18.82 18.77 18.33 18.31C18.19 18.17 16.84 16.70 15.34 15.03L12.60 12.00L15.43 8.87C17.40 6.69 18.34 5.68 18.52 5.55C18.84 5.30 19.44 5.01 19.81 4.92C20.01 4.87 20.23 4.85 20.58 4.85C21.12 4.85 21.45 4.91 21.89 5.10C22.20 5.24 22.71 5.56 22.87 5.73L22.98 5.84L22.86 5.97C22.39 6.46 17.44 11.97 17.44 12.00C17.44 12.03 22.39 17.54 22.84 18.02L22.98 18.16L22.87 18.27C22.59 18.56 21.99 18.91 21.51 19.05C21.30 19.12 20.60 19.22 20.52 19.20C20.51 19.20 20.36 19.18 20.19 19.17ZM8.34 7.34L4.71 3.31L4.89 3.15C5.27 2.80 5.88 2.52 6.45 2.43C7.22 2.30 8.09 2.53 8.73 3.01C8.87 3.11 9.55 3.83 10.42 4.79C11.21 5.67 11.89 6.42 11.93 6.46C11.98 6.52 12.07 6.43 13.47 4.87C14.46 3.78 15.05 3.16 15.21 3.03C16.18 2.31 17.38 2.19 18.44 2.72C18.82 2.92 19.25 3.23 19.23 3.32C19.23 3.36 12.05 11.33 12.00 11.35C11.99 11.36 10.34 9.55 8.34 7.34Z",
  cog: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  vm: "M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z",
  container: "M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5M12,4.15L6.04,7.5L12,10.85L17.96,7.5L12,4.15M5,15.91L11,19.29V12.58L5,9.21V15.91M19,15.91V9.21L13,12.58V19.29L19,15.91Z",
  storage: "M12,3C7.58,3 4,4.79 4,7V17C4,19.21 7.59,21 12,21C16.41,21 20,19.21 20,17V7C20,4.79 16.42,3 12,3M18,17C18,17.5 15.87,19 12,19C8.13,19 6,17.5 6,17V14.77C7.61,15.55 9.72,16 12,16C14.28,16 16.39,15.55 18,14.77V17M18,12.45C16.7,13.4 14.42,14 12,14C9.58,14 7.3,13.4 6,12.45V9.64C7.47,10.47 9.61,11 12,11C14.39,11 16.53,10.47 18,9.64V12.45M12,9C8.13,9 6,7.5 6,7C6,6.5 8.13,5 12,5C15.87,5 18,6.5 18,7C18,7.5 15.87,9 12,9Z",
  start: "M8,5.14V19.14L19,12.14L8,5.14Z",
  resume: "M8,5.14V19.14L19,12.14L8,5.14Z",
  start_all: "M8,5.14V19.14L19,12.14L8,5.14Z",
  stop: "M18,18H6V6H18V18Z",
  stop_all: "M18,18H6V6H18V18Z",
  pause: "M14,19H18V5H14M6,19H10V5H6V19Z",
  suspend_all: "M14,19H18V5H14M6,19H10V5H6V19Z",
  hibernate: "M2 22V20C2 20 7 18 12 18S22 20 22 20V22H2M11.3 9.1C10.1 5.2 4 6.1 4 6.1S4.2 13.9 9.9 12.7C9.5 9.8 8 9 8 9C10.8 10 11 13.1 11 13.1V17C11.3 17 11.7 17 12 17C12.3 17 12.6 17 12.9 17C13 15 13.8 12.3 14.6 10.6C14.2 10.4 13.9 10.1 13.6 9.7C12.9 9.9 12.1 9.6 11.3 9.1M20 4C19.6 4.2 19.2 4.3 18.8 4.4C18.4 2.7 16.9 1.4 15.1 1.4C13 1.4 11.3 3.1 11.3 5.2C11.3 7.3 13 9 15.1 9C16.4 9 17.6 8.3 18.2 7.3C18.6 7.6 19.1 7.7 19.6 7.7C21.5 7.7 23 6.2 23 4.3C23 4.3 22.9 4.3 22.9 4.3C22.1 4.6 21 4.6 20 4Z",
  restart: "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  reboot: "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  reset: "M12,5V1L7,6L12,11V7A6,6 0 0,1 18,13A6,6 0 0,1 12,19A6,6 0 0,1 6,13H4A8,8 0 0,0 12,21A8,8 0 0,0 20,13A8,8 0 0,0 12,5Z",
  shutdown: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
  snapshot_create: "M4,4H7L9,2H15L17,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z",
  chevron: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  open: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  backup: "M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3",
  download: "M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z",
  upload: "M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z",
};
export const proxmoxPanelIcon = (name, cls = "i") =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PROXMOX_PANEL_ICONS[name] || ""}"/></svg>`;

// Sizes: base 1024 in KiB / MiB / GiB / TiB, 2, 1 or 0 decimals as the value grows (the ha-* convention)
export const PROXMOX_PANEL_UNITS = {
  B: 1, bit: 1 / 8, kB: 1e3, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15,
  KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4, PiB: 1024 ** 5,
};
export const proxmoxPanelBytes = (bytes, lang = "en") => {
  if (bytes === null || !Number.isFinite(bytes)) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let i = 0;
  let v = Math.abs(bytes);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : v < 10 ? 2 : v < 100 ? 1 : 0;
  try {
    return `${new Intl.NumberFormat(lang, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)} ${units[i]}`;
  } catch (_err) {
    return `${v.toFixed(digits)} ${units[i]}`;
  }
};

// A duration in seconds, as "12 d", "5 h" or "34 min" (the largest unit), in the panel's language
export const proxmoxPanelDuration = (seconds, lang = "en") => {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const [unit, size] = seconds >= 86400 ? ["day", 86400] : seconds >= 3600 ? ["hour", 3600] : ["minute", 60];
  const n = Math.max(unit === "minute" ? 1 : 0, Math.floor(seconds / size));
  try {
    return new Intl.NumberFormat(lang, { style: "unit", unit, unitDisplay: "short" }).format(n);
  } catch (_err) {
    return `${n} ${unit}`;
  }
};

// ── Languages ──

// Strings of the other languages, loaded once per page from /proxmox_panel/i18n/<lang>.json
const proxmoxStrings = { en: PROXMOX_PANEL_EN };
const proxmoxLoading = {};

/** Full code when there is a translation (sr-Latn), else its base (de-AT → de), else English. */
export const proxmoxLang = (hass, override) => {
  const code = override || hass?.locale?.language || hass?.language || "en";
  if (PROXMOX_PANEL_LANGS.includes(code)) return code;
  const base = code.split("-")[0];
  return PROXMOX_PANEL_LANGS.includes(base) ? base : "en";
};

export const proxmoxLoadStrings = (lang, version) => {
  if (proxmoxStrings[lang]) return Promise.resolve();
  proxmoxLoading[lang] ||= fetch(`/proxmox_panel/i18n/${lang}.json?v=${version}`)
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({})) // English meanwhile
    .then((strings) => {
      proxmoxStrings[lang] = strings;
    });
  return proxmoxLoading[lang];
};

export const proxmoxT = (lang, key, vars = {}) => {
  let text = proxmoxStrings[lang]?.[key] ?? PROXMOX_PANEL_EN[key] ?? key;
  for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
  return text;
};

// ── States ──

/** A node, machine or storage of the inventory by its device id. */
export const proxmoxFind = (inv, id) => {
  for (const kind of ["node", "vm", "container", "storage"]) {
    const item = (inv?.[kind] || []).find((i) => i.id === id);
    if (item) return item;
  }
  return null;
};

export const proxmoxState = (hass, id) => {
  const s = id ? hass?.states?.[id] : null;
  return s && s.state !== "unavailable" && s.state !== "unknown" ? s : null;
};

export const proxmoxNum = (hass, id) => {
  const s = proxmoxState(hass, id);
  const v = s ? Number(s.state) : Number.NaN;
  return Number.isFinite(v) ? v : null;
};

/** A data size sensor in bytes, whatever unit it shows. */
export const proxmoxBytesOf = (hass, id) => {
  const v = proxmoxNum(hass, id);
  if (v === null) return null;
  const unit = hass.states[id].attributes?.unit_of_measurement || "B";
  return v * (PROXMOX_PANEL_UNITS[unit] ?? 1);
};

/** Seconds since an uptime sensor's start (a timestamp). */
export const proxmoxUptime = (hass, id) => {
  const s = proxmoxState(hass, id);
  const t = s ? Date.parse(s.state) : Number.NaN;
  return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 1000) : null;
};

export const proxmoxPct = (v) => (v === null ? "—" : `${Math.round(v)} %`);

/** running, stopped, suspended or unavailable (online / offline for a node), from the status sensor, else the running binary sensor. */
export const proxmoxStatus = (hass, item) => {
  const status = proxmoxState(hass, item.entities.status)?.state;
  if (status) return status;
  const running = proxmoxState(hass, item.entities.running)?.state;
  if (running === "on") return item.kind === "node" ? "online" : "running";
  if (running === "off") return item.kind === "node" ? "offline" : "stopped";
  return "unavailable";
};

export const proxmoxStatusPill = (lang, status) => {
  const tone = { running: "good", online: "good", suspended: "warn", paused: "warn", offline: "bad" }[status] || "";
  const key = `st_${status}`;
  const text = PROXMOX_PANEL_EN[key] ? proxmoxT(lang, key) : status;
  return `<span class="pill ${tone}">${proxmoxPanelEsc(text)}</span>`;
};

/** "3 days ago" in the given language. */
export const proxmoxAgo = (lang, ms) => {
  const seconds = (ms - Date.now()) / 1000;
  const steps = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  const [unit, size] = steps.find(([, n]) => Math.abs(seconds) >= n) || ["second", 1];
  try {
    return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(Math.round(seconds / size), unit);
  } catch (_err) {
    return new Date(ms).toISOString();
  }
};

/** Last 24 hours of numeric sensors from the recorder: { entity id: [[time ms, value]] } (empty without a recorder). */
export const proxmoxHistory = async (hass, ids) => {
  if (!ids.length || !hass?.callWS) return {};
  try {
    const res = await hass.callWS({
      type: "history/history_during_period",
      start_time: new Date(Date.now() - 86400000).toISOString(),
      entity_ids: ids,
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    });
    return Object.fromEntries(
      Object.entries(res || {}).map(([id, list]) => [
        id,
        list.map((p) => [(p.lu ?? p.lc ?? 0) * 1000, Number(p.s)]).filter(([t, v]) => t && Number.isFinite(v)),
      ]),
    );
  } catch (_err) {
    return {};
  }
};

/** A ring (CPU, RAM, disk), with the 24 h curve of `points` behind it on a 0-100 scale. */
export const proxmoxRing = (label, pct, color, sub, points = []) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  const v = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const recent = points.filter(([t]) => t >= Date.now() - 86400000);
  let curve = "";
  if (recent.length > 1) {
    const t0 = Date.now() - 86400000;
    const y = (p) => (40 - (Math.max(0, Math.min(100, p)) / 100) * 40).toFixed(2);
    const xy = recent.map(([t, p]) => `${(((t - t0) / 86400000) * 100).toFixed(2)},${y(p)}`);
    const line = `M${xy.join("L")}L100,${y(recent[recent.length - 1][1])}`;
    curve = `<svg class="curve" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path d="${line}L100,40L${xy[0].split(",")[0]},40Z" fill="${color}" fill-opacity=".12"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-opacity=".5" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`;
  }
  return `<div class="ring">${curve}
      <svg class="r" viewBox="0 0 84 84" role="img" aria-label="${proxmoxPanelEsc(`${label} ${proxmoxPct(pct)}`)}">
        <circle class="track" cx="42" cy="42" r="${r}"/>
        <circle class="val" cx="42" cy="42" r="${r}" stroke="${color}" stroke-dasharray="${((v / 100) * c).toFixed(1)} ${c.toFixed(1)}"/>
        <text x="42" y="48" text-anchor="middle">${proxmoxPct(pct)}</text></svg>
      <span class="lbl">${proxmoxPanelEsc(label)}${sub ? `<small>${proxmoxPanelEsc(sub)}</small>` : ""}</span></div>`;
};

// Colours of the rings, the ha-* convention's
export const PROXMOX_COLORS = { cpu: "#378add", ram: "#7f77dd", disk: "#1d9e75" };

/** Styles shared by the panel and the cards: tones, pills, buttons (never filled), rings, meta lines. */
export const PROXMOX_SHARED_STYLE = `
  .i { width:18px; height:18px; fill:currentColor; flex:none; }
  .pill { font-size:11px; font-weight:500; padding:2px 8px; border-radius:12px; flex:none; white-space:nowrap;
          color:var(--secondary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
  .pill.good { color:color-mix(in srgb, var(--tone-good) 50%, var(--primary-text-color)); background:color-mix(in srgb, var(--tone-good) 15%, transparent); }
  .pill.warn { color:color-mix(in srgb, var(--tone-warn) 50%, var(--primary-text-color)); background:color-mix(in srgb, var(--tone-warn) 15%, transparent); }
  .pill.bad { color:color-mix(in srgb, var(--tone-bad) 50%, var(--primary-text-color)); background:color-mix(in srgb, var(--tone-bad) 15%, transparent); }
  button.pill { border:0; font-family:inherit; cursor:pointer; }
  .act { display:inline-flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; font:inherit; font-size:13px; font-weight:500;
         padding:6px 12px; border-radius:16px; color:var(--px-accent); background:none; white-space:nowrap;
         border:1px solid color-mix(in srgb, var(--px-accent) 50%, transparent); }
  .act .i { width:16px; height:16px; }
  a.act { text-decoration:none; }
  .act:hover:not([disabled]) { background:color-mix(in srgb, var(--px-accent) 12%, transparent); }
  .act.quiet { color:var(--secondary-text-color); border-color:var(--divider-color, rgba(127,127,127,.3)); }
  .act.quiet:hover:not([disabled]) { background:color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
  .act.bad { color:color-mix(in srgb, var(--tone-bad) 50%, var(--primary-text-color)); border-color:color-mix(in srgb, var(--tone-bad) 45%, transparent); }
  .act.icon { padding:6px; width:32px; height:32px; box-sizing:border-box; }
  .act[disabled] { opacity:.5; cursor:default; }
  .acts { display:flex; gap:8px; flex-wrap:wrap; }
  .m { font-size:12px; color:var(--secondary-text-color); display:flex; flex-wrap:wrap; gap:2px 12px; align-items:center; }
  .m > span { display:inline-flex; align-items:center; gap:3px; }
  .m .i { width:14px; height:14px; }
  .m .down .i { color:var(--tone-down); } .m .up .i { color:var(--tone-up); }
  .badge { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; flex:none; color:var(--px-accent);
           background:color-mix(in srgb, var(--px-accent) 15%, transparent); }
  .badge .i { width:22px; height:22px; }
  .badge.muted { color:var(--secondary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
  .rings { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
  .ring { position:relative; display:flex; flex-direction:column; align-items:center; gap:4px; padding:6px 0 4px; font-size:12px;
          color:var(--secondary-text-color); text-align:center; }
  .ring .curve { position:absolute; top:6px; left:0; width:100%; height:84px; pointer-events:none; }
  .ring svg.r { position:relative; width:84px; height:84px; }
  .ring .track { fill:none; stroke:color-mix(in srgb, var(--secondary-text-color) 18%, transparent); stroke-width:7; }
  .ring .val { fill:none; stroke-width:7; stroke-linecap:round; transform:rotate(-90deg); transform-origin:50% 50%; transition:stroke-dasharray .4s; }
  .ring text { fill:var(--primary-text-color); font-size:16px; font-family:inherit; }
  .ring .lbl { position:relative; display:flex; flex-direction:column; align-items:center; max-width:100%; }
  .ring .lbl small { font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
  .bar { height:6px; border-radius:3px; background:color-mix(in srgb, var(--secondary-text-color) 18%, transparent); overflow:hidden; }
  .bar > i { display:block; height:100%; border-radius:3px; }
  .confirm { display:flex; flex-direction:column; gap:8px; padding:10px 12px; border-radius:10px;
             border:1px solid color-mix(in srgb, var(--tone-bad) 45%, transparent); background:color-mix(in srgb, var(--tone-bad) 8%, transparent); }
  .confirm .acts { justify-content:flex-end; }
`;

/** CSS variables of the panel and the cards. */
export const PROXMOX_VARS = `--px-accent:#e57000; --tone-good:var(--success-color, #43a047); --tone-warn:var(--warning-color, #ffa600);
  --tone-bad:var(--error-color, #db4437); --tone-down:#43a047; --tone-up:#1e88e5;`;
