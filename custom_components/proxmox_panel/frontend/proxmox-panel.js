/*
 * Proxmox panel for Home Assistant
 * https://github.com/juju35/ha-proxmox
 *
 * A sidebar panel over the core Proxmox VE integration (proxmoxve). It reads the states of its entities and acts by
 * pressing its buttons; the integration's own command (proxmox_panel/inventory) only says which entity is which.
 * Six tabs under the toolbar, as in Smart Comfort (text tabs, the active one underlined, the tab in the address,
 * Settings last):
 * - Nodes: each node with its CPU, RAM and disk rings (24 h curves behind CPU and RAM), uptime, pending updates, how
 *   many virtual machines and containers run, and the node-wide actions;
 * - Virtual machines and Containers: one row per machine, its status and quick actions, unfolding into the details
 *   and the other actions; filtered by node and by a search;
 * - Storage: one gauge per storage, with its active / shared state;
 * - Backups: the last backup of each node (its sensors are disabled by default in the integration) and a manual
 *   snapshot of each machine;
 * - Settings (administrators): stopped machines shown or not, confirmation of the actions that stop or restart,
 *   panel kept for administrators, inactive storage hidden.
 * English is built in; the other languages are loaded on demand from /proxmox_panel/i18n/<lang>.json.
 */

const PROXMOX_PANEL_VERSION = "0.1.0";
const PROXMOX_PANEL_TABS = ["nodes", "vms", "containers", "storage", "backups", "settings"];
const PROXMOX_PANEL_LANGS = ["en", "fr", "de", "es", "sr", "sr-Latn", "it", "nl", "pt", "pl", "ro", "da", "sv", "bg", "ru", "uk", "hu", "sk", "cs", "sl", "lv", "el"];
// Actions that stop or restart something: confirmed first when the setting asks for it
const PROXMOX_PANEL_CUTTING = ["stop", "shutdown", "reset", "restart", "hibernate", "reboot", "stop_all", "suspend_all"];
// Buttons of a machine, in the order the unfolded row shows them
const PROXMOX_PANEL_ACTIONS = ["start", "resume", "pause", "hibernate", "restart", "reset", "shutdown", "stop", "snapshot_create"];
const PROXMOX_PANEL_NODE_ACTIONS = ["start_all", "suspend_all", "stop_all", "reboot", "shutdown"];
// The buttons that make sense in each status (any of them when the status is unknown)
const PROXMOX_PANEL_FOR_STATUS = {
  running: ["pause", "hibernate", "restart", "reset", "shutdown", "stop", "snapshot_create"],
  stopped: ["start", "snapshot_create"],
  suspended: ["resume", "stop", "snapshot_create"],
};

const PROXMOX_PANEL_EN = {
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
  s_admin: "Keep the panel for administrators",
  s_admin_hint: "Off: everyone sees the panel; the Settings tab stays for administrators.",
  s_hide_storage: "Hide inactive storage",
  s_hide_storage_hint: "Storage that is disabled or not active.",
  save: "Save",
  saved: "Saved.",
};

const proxmoxPanelEsc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// mdi paths used by the panel (ha-icon is avoided so that the screenshots and tests need no frontend), and the
// Proxmox logo (the same as the sidebar entry's, frontend/proxmox-icons.js)
const PROXMOX_PANEL_ICONS = {
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
const proxmoxPanelIcon = (name, cls = "i") =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PROXMOX_PANEL_ICONS[name] || ""}"/></svg>`;

// Sizes: base 1024 in KiB / MiB / GiB / TiB, 2, 1 or 0 decimals as the value grows (the ha-* convention)
const PROXMOX_PANEL_UNITS = {
  B: 1, bit: 1 / 8, kB: 1e3, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15,
  KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4, PiB: 1024 ** 5,
};
const proxmoxPanelBytes = (bytes, lang = "en") => {
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
const proxmoxPanelDuration = (seconds, lang = "en") => {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const [unit, size] = seconds >= 86400 ? ["day", 86400] : seconds >= 3600 ? ["hour", 3600] : ["minute", 60];
  const n = Math.max(unit === "minute" ? 1 : 0, Math.floor(seconds / size));
  try {
    return new Intl.NumberFormat(lang, { style: "unit", unit, unitDisplay: "short" }).format(n);
  } catch (_err) {
    return `${n} ${unit}`;
  }
};

class ProxmoxPanel extends HTMLElement {
  static STYLE = `
    :host { display:block; min-height:100%; background:var(--primary-background-color); color:var(--primary-text-color);
            --px-accent:#e57000; --tone-good:var(--success-color, #43a047); --tone-warn:var(--warning-color, #ffa600);
            --tone-bad:var(--error-color, #db4437); --tone-down:#43a047; --tone-up:#1e88e5; }
    .i { width:18px; height:18px; fill:currentColor; flex:none; }
    .toolbar { height:var(--header-height, 56px); display:flex; align-items:center; gap:8px; padding:0 12px; box-sizing:border-box;
               background:var(--app-header-background-color, var(--primary-color)); color:var(--app-header-text-color, #fff);
               border-bottom:var(--app-header-border-bottom, none); font-size:20px; position:sticky; top:0; z-index:2; }
    .toolbar .grow { flex:1; }
    .toolbar a { color:inherit; display:flex; padding:8px; border-radius:50%; }
    .toolbar a .i { width:22px; height:22px; }
    .toolbar a:hover { background:rgba(255,255,255,.12); }
    .tabs { display:flex; gap:4px; padding:0 12px; overflow-x:auto; background:var(--app-header-background-color, var(--primary-color));
            position:sticky; top:var(--header-height, 56px); z-index:2; }
    .tab { background:none; border:none; border-bottom:2px solid transparent; color:var(--app-header-text-color, #fff); opacity:.75;
           padding:12px 14px; font:inherit; font-size:14px; cursor:pointer; white-space:nowrap; }
    .tab:hover, .tab:focus-visible { opacity:1; outline:none; }
    .tab.active { opacity:1; border-bottom-color:var(--app-header-text-color, #fff); }
    main { max-width:1040px; margin:0 auto; padding:16px; box-sizing:border-box; display:flex; flex-direction:column; gap:16px; }
    section { display:flex; flex-direction:column; gap:16px; }
    section[hidden] { display:none; }
    .box { background:var(--card-background-color, #fff); border-radius:var(--ha-card-border-radius, 12px);
           border:1px solid var(--divider-color, rgba(127,127,127,.2)); padding:14px 16px; display:flex; flex-direction:column; gap:12px; }
    .note { font-size:14px; color:var(--secondary-text-color); }
    .note.warn { color:color-mix(in srgb, var(--tone-warn) 50%, var(--primary-text-color)); }
    .note.bad { color:color-mix(in srgb, var(--tone-bad) 50%, var(--primary-text-color)); }
    .note.good { color:color-mix(in srgb, var(--tone-good) 50%, var(--primary-text-color)); }
    .head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .head .sum { flex:1 1 180px; font-size:14px; color:var(--secondary-text-color); }
    .search { flex:0 1 220px; display:flex; align-items:center; border-radius:8px; border:1px solid var(--divider-color, rgba(127,127,127,.3));
              background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .search:focus-within { border-color:var(--px-accent); }
    .search input { flex:1; min-width:0; border:0; outline:0; background:none; color:inherit; font:inherit; font-size:14px; padding:7px 10px; }
    .pick { flex:0 1 200px; min-width:0; border-radius:8px; border:1px solid var(--divider-color, rgba(127,127,127,.3)); padding:7px 8px;
            background:var(--secondary-background-color, rgba(127,127,127,.08)); color:inherit; font:inherit; font-size:14px; }
    /* Buttons: outlined or tinted, never filled */
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
    .act:focus-visible, .tab:focus-visible, a:focus-visible, input:focus-visible, .fold:focus-visible { outline:2px solid var(--px-accent); outline-offset:1px; }
    .acts { display:flex; gap:8px; flex-wrap:wrap; }
    .pill { font-size:11px; font-weight:500; padding:2px 8px; border-radius:12px; flex:none; white-space:nowrap;
            color:var(--secondary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
    .pill.good { color:color-mix(in srgb, var(--tone-good) 50%, var(--primary-text-color)); background:color-mix(in srgb, var(--tone-good) 15%, transparent); }
    .pill.warn { color:color-mix(in srgb, var(--tone-warn) 50%, var(--primary-text-color)); background:color-mix(in srgb, var(--tone-warn) 15%, transparent); }
    .pill.bad { color:color-mix(in srgb, var(--tone-bad) 50%, var(--primary-text-color)); background:color-mix(in srgb, var(--tone-bad) 15%, transparent); }
    button.pill { border:0; font-family:inherit; cursor:pointer; }
    .m { font-size:12px; color:var(--secondary-text-color); display:flex; flex-wrap:wrap; gap:2px 12px; align-items:center; }
    .m > span { display:inline-flex; align-items:center; gap:3px; }
    .m .i { width:14px; height:14px; }
    .m .down .i { color:var(--tone-down); } .m .up .i { color:var(--tone-up); }
    /* Header of a node: the Proxmox logo in a tinted 40px round, as the cards' header icons */
    .nhead { display:flex; align-items:center; gap:12px; }
    .badge { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; flex:none; color:var(--px-accent);
             background:color-mix(in srgb, var(--px-accent) 15%, transparent); }
    .badge .i { width:22px; height:22px; }
    .badge.muted { color:var(--secondary-text-color); background:color-mix(in srgb, var(--secondary-text-color) 14%, transparent); }
    .nhead .t { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .nhead .n { font-size:16px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .link { display:grid; place-items:center; width:28px; height:28px; border-radius:50%; color:var(--secondary-text-color); flex:none; }
    .link:hover { background:color-mix(in srgb, var(--secondary-text-color) 15%, transparent); }
    .link .i { width:16px; height:16px; }
    /* Rings: CPU, RAM, disk; a 24 h curve behind CPU and RAM on a 0-100 scale */
    .rings { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
    .ring { position:relative; display:flex; flex-direction:column; align-items:center; gap:4px; padding:6px 0 4px; font-size:12px;
            color:var(--secondary-text-color); text-align:center; }
    .ring .curve { position:absolute; inset:0 0 22px 0; width:100%; height:calc(100% - 22px); pointer-events:none; }
    .ring svg.r { position:relative; width:84px; height:84px; }
    .ring .track { fill:none; stroke:color-mix(in srgb, var(--secondary-text-color) 18%, transparent); stroke-width:7; }
    .ring .val { fill:none; stroke-width:7; stroke-linecap:round; transform:rotate(-90deg); transform-origin:50% 50%; transition:stroke-dasharray .4s; }
    .ring text { fill:var(--primary-text-color); font-size:16px; font-family:inherit; }
    .ring .lbl { position:relative; }
    .list { display:flex; flex-direction:column; }
    .row { display:flex; align-items:center; gap:10px; padding:8px 0; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); min-height:40px; }
    .list > :first-child { border-top:0; }
    .row > .i { color:var(--secondary-text-color); }
    .fold { all:unset; flex:1; min-width:0; display:flex; align-items:center; gap:8px; cursor:pointer; border-radius:6px; }
    .fold > .i { color:var(--secondary-text-color); transition:transform .15s; }
    .row.open .fold > .i { transform:rotate(90deg); }
    .fold .t, .row .t { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .n { font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .n .id { color:var(--secondary-text-color); }
    .detail { padding:2px 0 12px 26px; display:flex; flex-direction:column; gap:10px; }
    .bar { height:6px; border-radius:3px; background:color-mix(in srgb, var(--secondary-text-color) 18%, transparent); overflow:hidden; }
    .bar > i { display:block; height:100%; border-radius:3px; }
    .srow { display:flex; flex-direction:column; gap:6px; padding:10px 0; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); }
    .srow .line { display:flex; align-items:center; gap:10px; }
    .srow .line > .i { color:var(--secondary-text-color); }
    .srow .pct { font-size:13px; min-width:3em; text-align:right; }
    .sub { font-size:12px; color:var(--secondary-text-color); padding-top:4px; }
    /* Confirmation at the top of what it acts on, like the card popups */
    .confirm { display:flex; flex-direction:column; gap:8px; padding:10px 12px; border-radius:10px;
               border:1px solid color-mix(in srgb, var(--tone-bad) 45%, transparent); background:color-mix(in srgb, var(--tone-bad) 8%, transparent); }
    .confirm .acts { justify-content:flex-end; }
    .form { display:flex; flex-direction:column; gap:14px; }
    .toggle { display:flex; align-items:center; gap:12px; cursor:pointer; }
    .toggle > div { flex:1; display:flex; flex-direction:column; gap:2px; font-size:14px; }
    .toggle small { font-size:11px; color:var(--secondary-text-color); }
    .toggle input { width:18px; height:18px; accent-color:var(--px-accent); }
    .bar-save { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    @media (max-width: 600px) {
      .row .hide-narrow { display:none; }
      .detail { padding-left:0; }
      .ring svg.r { width:70px; height:70px; }
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._tab = "nodes";
    this._inv = null; // proxmox_panel/inventory
    this._settings = null;
    this._draft = {};
    this._saved = false;
    this._query = { vms: "", containers: "" };
    this._node = ""; // node filter of the VMs, Containers and Storage tabs (device id)
    this._expanded = null; // device id of the unfolded machine
    this._confirm = null; // { entity, action, name, tab }
    this._message = null; // { tone, text, tab }
    this._history = {}; // entity id → [[time ms, value]]
    this._strings = { en: PROXMOX_PANEL_EN };
    this._bodies = {}; // tab → last rendered body markup
  }

  // /proxmox/<tab> opens that tab (Home Assistant sets the route; the base address is Nodes)
  set route(route) {
    const path = (route?.path || "").split("/").filter(Boolean)[0];
    const tab = PROXMOX_PANEL_TABS.includes(path) ? path : "nodes";
    if (tab !== this._tab) this._showTab(tab);
  }

  set panel(panel) {
    this._panel = panel;
  }

  set narrow(narrow) {
    this._narrow = narrow;
    if (this._menu) this._menu.narrow = narrow;
  }

  set hass(hass) {
    const first = !this._hass;
    const before = this._lang();
    this._hass = hass;
    if (this._menu) this._menu.hass = hass;
    if (first) this._start();
    else if (this._lang() !== before) this._loadLang().then(() => this._render());
    else this._refresh();
  }

  connectedCallback() {
    if (this._hass && !this._unsub) this._subscribe();
    if (this._hass && this._failed) this._load();
    clearInterval(this._historyTimer);
    this._historyTimer = setInterval(() => this.isConnected && this._loadHistory(), 300000);
  }

  disconnectedCallback() {
    clearInterval(this._historyTimer);
    clearTimeout(this._retryTimer);
    if (this._unsub) {
      this._unsub.then((off) => off()).catch(() => {});
      this._unsub = null;
    }
  }

  // ── Language ──

  // Full code when the panel has it (sr-Latn), else its base (de-AT → de), else English
  _lang() {
    const code = this._hass?.locale?.language || this._hass?.language || "en";
    if (PROXMOX_PANEL_LANGS.includes(code)) return code;
    const base = code.split("-")[0];
    return PROXMOX_PANEL_LANGS.includes(base) ? base : "en";
  }

  async _loadLang() {
    const lang = this._lang();
    if (this._strings[lang]) return;
    const version = this._panel?.config?.version || PROXMOX_PANEL_VERSION;
    try {
      const res = await fetch(`/proxmox_panel/i18n/${lang}.json?v=${version}`);
      this._strings[lang] = res.ok ? await res.json() : {};
    } catch (_err) {
      this._strings[lang] = {}; // English meanwhile
    }
  }

  _t(key, vars = {}) {
    let text = this._strings[this._lang()]?.[key] ?? PROXMOX_PANEL_EN[key] ?? key;
    for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
    return text;
  }

  // ── Data ──

  async _start() {
    this._render();
    this._subscribe();
    await this._loadLang();
    this._render();
    await this._load();
  }

  // Reload when a Proxmox VE entry changes (set up, reloaded, removed): its devices and entities may have changed
  _subscribe() {
    if (this._unsub || !this._hass?.connection) return;
    this._unsub = this._hass.connection
      .subscribeMessage(
        (events) => {
          if ([].concat(events || []).some((ev) => ev?.entry?.domain === "proxmoxve")) this._load();
        },
        { type: "config_entries/subscribe" },
      )
      .catch(() => () => {});
  }

  async _load() {
    clearTimeout(this._retryTimer);
    try {
      this._inv = await this._hass.callWS({ type: "proxmox_panel/inventory" });
      this._settings = this._inv.settings;
      this._failed = false;
      this._retries = 0;
      if (this._message?.load) this._message = null;
    } catch (err) {
      if (err?.code === "unauthorized") this._inv = { denied: true };
      else {
        this._message = { tone: "bad", text: this._t("error", { error: err?.message || err }), load: true };
        // Home Assistant still starting, the connection dropped: again after 2 s, 5 s, 15 s, then every 30 s
        this._failed = true;
        const delay = [2000, 5000, 15000, 30000][Math.min(this._retries || 0, 3)];
        this._retries = (this._retries || 0) + 1;
        this._retryTimer = setTimeout(() => this.isConnected && this._load(), delay);
      }
    }
    this._render();
    this._loadHistory();
  }

  _items(kind) {
    return this._inv?.[kind] || [];
  }

  /** The 24 h history of the nodes' CPU and RAM, for the curves behind their rings. */
  async _loadHistory() {
    const ids = this._items("node").flatMap((n) => [n.entities.cpu, n.entities.memory_pct]).filter(Boolean);
    if (!ids.length || !this._hass?.callWS) return;
    try {
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(Date.now() - 86400000).toISOString(),
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      this._history = Object.fromEntries(
        Object.entries(res || {}).map(([id, list]) => [
          id,
          list
            .map((p) => [(p.lu ?? p.lc ?? 0) * 1000, Number(p.s)])
            .filter(([t, v]) => t && Number.isFinite(v)),
        ]),
      );
      this._bodies.nodes = null;
      this._refresh();
    } catch (_err) {
      // no recorder, or no history yet: the rings alone
    }
  }

  // ── States ──

  _state(id) {
    const s = id ? this._hass?.states?.[id] : null;
    return s && s.state !== "unavailable" && s.state !== "unknown" ? s : null;
  }

  _num(id) {
    const s = this._state(id);
    const v = s ? Number(s.state) : Number.NaN;
    return Number.isFinite(v) ? v : null;
  }

  /** A data size sensor in bytes, whatever unit it shows. */
  _bytes(id) {
    const v = this._num(id);
    if (v === null) return null;
    const unit = this._hass.states[id].attributes?.unit_of_measurement || "B";
    return v * (PROXMOX_PANEL_UNITS[unit] ?? 1);
  }

  /** Seconds since an uptime sensor's start (a timestamp). */
  _uptime(id) {
    const s = this._state(id);
    const t = s ? Date.parse(s.state) : Number.NaN;
    return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 1000) : null;
  }

  _pct(v) {
    return v === null ? "—" : `${Math.round(v)} %`;
  }

  /** running, stopped, suspended or unavailable, from the status sensor, else the running binary sensor. */
  _status(item) {
    const status = this._state(item.entities.status)?.state;
    if (status) return status;
    const running = this._state(item.entities.running)?.state;
    if (running === "on") return item.kind === "node" ? "online" : "running";
    if (running === "off") return item.kind === "node" ? "offline" : "stopped";
    return "unavailable";
  }

  _statusPill(status) {
    const tone = { running: "good", online: "good", suspended: "warn", paused: "warn", offline: "bad" }[status] || "";
    const key = `st_${status}`;
    const text = PROXMOX_PANEL_EN[key] ? this._t(key) : status;
    return `<span class="pill ${tone}">${proxmoxPanelEsc(text)}</span>`;
  }

  _nodeName(id) {
    return this._items("node").find((n) => n.id === id)?.name || "";
  }

  // ── Actions ──

  _askOrPress(tab, item, action) {
    const entity = item.entities[action];
    if (!entity) return;
    if (this._settings?.confirm_actions !== false && PROXMOX_PANEL_CUTTING.includes(action)) {
      this._confirm = { tab, entity, action, name: item.name };
      this._message = null;
      this._renderTab(tab, true);
      return;
    }
    this._press(tab, entity, action, item.name);
  }

  async _press(tab, entity, action, name) {
    this._confirm = null;
    try {
      await this._hass.callService("button", "press", {}, { entity_id: entity });
      this._message = { tone: "good", tab, text: this._t("sent", { action: this._t(`a_${action}`), name }) };
    } catch (err) {
      this._message = { tone: "bad", tab, text: this._t("error", { error: err?.message || err }) };
    }
    this._renderTab(tab, true);
  }

  _navigate(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  // ── Tabs ──

  _tabs() {
    // Settings only for administrators
    return PROXMOX_PANEL_TABS.filter((t) => t !== "settings" || this._inv?.admin !== false);
  }

  _goTab(tab, focus) {
    if (!this._tabs().includes(tab)) return;
    this._showTab(tab, focus);
    const base = (this._panel?.url_path || "proxmox").replace(/^\//, "");
    try {
      history.replaceState(history.state, "", `/${base}${tab === "nodes" ? "" : `/${tab}`}`);
    } catch (_err) {
      // no history (a test, a sandboxed page): the tab still shows
    }
  }

  _showTab(tab, focus) {
    this._tab = tab;
    const root = this.shadowRoot;
    for (const button of root.querySelectorAll?.(".tab") || []) {
      const selected = button.dataset.tab === tab;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus({ preventScroll: true });
    }
    for (const name of PROXMOX_PANEL_TABS) {
      const section = root.getElementById?.(`tab-${name}`);
      if (section) section.hidden = name !== tab;
    }
    this._renderTab(tab);
  }

  _render() {
    const root = this.shadowRoot;
    const esc = proxmoxPanelEsc;
    const tabs = this._tabs();
    if (!tabs.includes(this._tab)) this._tab = "nodes";
    root.innerHTML = `
      <style>${ProxmoxPanel.STYLE}</style>
      <div class="toolbar">
        <ha-menu-button></ha-menu-button>
        <span class="grow">${esc(this._t("title"))}</span>
        ${this._inv?.admin === false ? "" : `<a href="/config/integrations/integration/proxmoxve" title="${esc(this._t("open_integration"))}" aria-label="${esc(this._t("open_integration"))}">${proxmoxPanelIcon("cog")}</a>`}
      </div>
      <div class="tabs" role="tablist">${tabs
        .map((tab) => {
          const selected = tab === this._tab;
          return `<button class="tab${selected ? " active" : ""}" role="tab" id="tabbtn-${tab}" data-tab="${tab}" aria-selected="${selected}" aria-controls="tab-${tab}" tabindex="${selected ? 0 : -1}">${esc(this._t(tab))}</button>`;
        })
        .join("")}</div>
      <main>${tabs.map((tab) => `<section id="tab-${tab}" role="tabpanel" aria-labelledby="tabbtn-${tab}"${tab === this._tab ? "" : " hidden"}></section>`).join("")}</main>`;
    this._menu = root.querySelector("ha-menu-button");
    if (this._menu) {
      this._menu.hass = this._hass;
      this._menu.narrow = this._narrow;
    }
    for (const button of root.querySelectorAll(".tab")) {
      button.addEventListener("click", () => this._goTab(button.dataset.tab));
      // Left and right arrows move between the tabs, as in a native tab bar
      button.addEventListener("keydown", (ev) => {
        const step = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        ev.preventDefault();
        const i = tabs.indexOf(this._tab);
        this._goTab(tabs[(i + step + tabs.length) % tabs.length], true);
      });
    }
    this._bodies = {};
    this._renderTab(this._tab, true);
  }

  /** States changed: the shown tab's body again, only if its markup changed (the search keeps its focus). */
  _refresh() {
    if (this._tab !== "settings") this._renderTab(this._tab);
  }

  /** A tab: its head (search, filter) once, its body whenever its markup changes, or all of it with `full`. */
  _renderTab(tab, full = false) {
    const section = this.shadowRoot.getElementById?.(`tab-${tab}`);
    if (!section) return;
    const intro = this._introHtml(tab);
    if (intro !== null) {
      section.innerHTML = intro;
      this._bodies[tab] = null;
      this._bind(section, tab);
      return;
    }
    if (tab === "settings") {
      section.innerHTML = this._settingsHtml();
      this._bindSettings(section);
      return;
    }
    let body = section.querySelector(".body");
    if (full || !body) {
      section.innerHTML = `${this._headHtml(tab)}<div class="body"></div>`;
      body = section.querySelector(".body");
      this._bodies[tab] = null;
      this._bindHead(section, tab);
    }
    const html = this._bodyHtml(tab);
    if (html !== this._bodies[tab]) {
      this._bodies[tab] = html;
      body.innerHTML = html;
      this._bind(body, tab);
    }
  }

  /** What shows instead of a tab: loading, no Proxmox VE, not allowed. Null when the tab has its content. */
  _introHtml(tab) {
    const esc = proxmoxPanelEsc;
    const inv = this._inv;
    if (!inv) {
      const retry = this._message?.load ? ` <button class="act quiet" data-action="retry">${esc(this._t("retry"))}</button>` : "";
      const text = this._message?.load ? `<div class="note bad" role="status">${esc(this._message.text)}${retry}</div>` : `<div class="note">${esc(this._t("loading"))}</div>`;
      return `<div class="box">${text}</div>`;
    }
    if (inv.denied) return `<div class="box"><div class="note">${esc(this._t("denied"))}</div></div>`;
    if (!inv.configured && tab !== "settings")
      return `<div class="box"><div class="note">${esc(this._t("no_proxmox"))}</div>
        <div class="acts"><button class="act" data-action="add-proxmox">${esc(this._t("add_proxmox"))}</button></div></div>`;
    return null;
  }

  _notesHtml(tab) {
    const esc = proxmoxPanelEsc;
    const notes = (this._inv?.entries || [])
      .filter((e) => !e.loaded)
      .map((e) => `<div class="note warn">${esc(this._t("not_loaded", { title: e.title, state: e.state }))}</div>`);
    if (this._message && (this._message.tab === tab || this._message.load))
      notes.push(`<div class="note ${this._message.tone}" role="status">${esc(this._message.text)}</div>`);
    if (this._confirm?.tab === tab) {
      const c = this._confirm;
      const action = this._t(`a_${c.action}`);
      notes.push(`<div class="confirm" role="alertdialog"><div class="note">${esc(this._t("confirm", { action, name: c.name }))}</div>
        <div class="acts"><button class="act quiet" data-action="cancel">${esc(this._t("cancel"))}</button>
        <button class="act bad" data-action="confirmed">${proxmoxPanelIcon(c.action)}${esc(action)}</button></div></div>`);
    }
    return notes.join("");
  }

  _headHtml(tab) {
    if (tab !== "vms" && tab !== "containers" && tab !== "storage") return "";
    const esc = proxmoxPanelEsc;
    const nodes = this._items("node");
    const filter =
      nodes.length > 1
        ? `<select class="pick" data-node aria-label="${esc(this._t("all_nodes"))}"><option value="">${esc(this._t("all_nodes"))}</option>${nodes
            .map((n) => `<option value="${esc(n.id)}"${n.id === this._node ? " selected" : ""}>${esc(n.name)}</option>`)
            .join("")}</select>`
        : "";
    const search =
      tab === "storage"
        ? ""
        : `<label class="search"><input type="search" placeholder="${esc(this._t("search"))}" aria-label="${esc(this._t("search"))}" value="${esc(this._query[tab])}"></label>`;
    return filter || search ? `<div class="head head-top">${filter}${search}</div>` : "";
  }

  _bodyHtml(tab) {
    if (tab === "nodes") return this._nodesHtml();
    if (tab === "vms") return this._guestsHtml("vm", "vms");
    if (tab === "containers") return this._guestsHtml("container", "containers");
    if (tab === "storage") return this._storageHtml();
    if (tab === "backups") return this._backupsHtml();
    return "";
  }

  // ── Nodes tab ──

  _ringHtml(label, pct, color, sub, historyId) {
    const r = 34;
    const c = 2 * Math.PI * r;
    const v = pct === null ? 0 : Math.max(0, Math.min(100, pct));
    const points = (this._history[historyId] || []).filter(([t]) => t >= Date.now() - 86400000);
    let curve = "";
    if (points.length > 1) {
      const t0 = Date.now() - 86400000;
      const xy = points.map(([t, p]) => `${(((t - t0) / 86400000) * 100).toFixed(2)},${(40 - (Math.max(0, Math.min(100, p)) / 100) * 40).toFixed(2)}`);
      const last = (40 - (Math.max(0, Math.min(100, points[points.length - 1][1])) / 100) * 40).toFixed(2);
      const line = `M${xy.join("L")}L100,${last}`;
      curve = `<svg class="curve" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="${line}L100,40L${xy[0].split(",")[0]},40Z" fill="${color}" fill-opacity=".12"/>
        <path d="${line}" fill="none" stroke="${color}" stroke-opacity=".5" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`;
    }
    return `<div class="ring">${curve}
        <svg class="r" viewBox="0 0 84 84" role="img" aria-label="${proxmoxPanelEsc(`${label} ${this._pct(pct)}`)}">
          <circle class="track" cx="42" cy="42" r="${r}"/>
          <circle class="val" cx="42" cy="42" r="${r}" stroke="${color}" stroke-dasharray="${((v / 100) * c).toFixed(1)} ${c.toFixed(1)}"/>
          <text x="42" y="48" text-anchor="middle">${this._pct(pct)}</text></svg>
        <span class="lbl">${proxmoxPanelEsc(sub ? `${label} · ${sub}` : label)}</span></div>`;
  }

  _nodesHtml() {
    const esc = proxmoxPanelEsc;
    const lang = this._lang();
    const nodes = this._items("node");
    const notes = this._notesHtml("nodes");
    if (!nodes.length) return `${notes ? `<div class="box">${notes}</div>` : ""}<div class="box"><div class="note">${esc(this._t("empty_nodes"))}</div></div>`;
    const boxes = nodes.map((node) => {
      const e = node.entities;
      const status = this._status(node);
      const update = this._state(e.update);
      const uptime = this._uptime(e.uptime);
      const cpus = this._num(e.max_cpu);
      const meta = [
        uptime !== null && status === "online" ? `<span>${esc(this._t("up_for", { d: proxmoxPanelDuration(uptime, lang) }))}</span>` : "",
        cpus !== null ? `<span>${esc(this._t("cpus", { n: cpus }))}</span>` : "",
        update?.attributes?.installed_version ? `<span>PVE ${esc(update.attributes.installed_version)}</span>` : "",
      ].join("");
      const mem = this._bytes(e.memory);
      const maxMem = this._bytes(e.max_memory);
      const memPct = this._num(e.memory_pct) ?? (mem !== null && maxMem ? (mem / maxMem) * 100 : null);
      const disk = this._bytes(e.disk);
      const maxDisk = this._bytes(e.max_disk);
      const diskPct = disk !== null && maxDisk ? (disk / maxDisk) * 100 : null;
      const of = (a, b) => (a !== null && b !== null ? this._t("of", { used: proxmoxPanelBytes(a, lang), total: proxmoxPanelBytes(b, lang) }) : "");
      const count = (kind) => {
        const list = this._items(kind).filter((g) => g.node === node.id);
        return { n: list.length, running: list.filter((g) => this._status(g) === "running").length };
      };
      const vms = count("vm");
      const cts = count("container");
      const actions = PROXMOX_PANEL_NODE_ACTIONS.filter((a) => e[a])
        .map((a) => {
          const tone = a === "start_all" ? "" : a === "shutdown" ? " bad" : " quiet";
          return `<button class="act${tone}" data-action="press" data-item="${esc(node.id)}" data-press="${a}">${proxmoxPanelIcon(a)}${esc(this._t(`a_${a}`))}</button>`;
        })
        .join("");
      const link = node.url ? `<a class="link" href="${esc(node.url)}" target="_blank" rel="noopener noreferrer" title="${esc(this._t("open_proxmox"))}" aria-label="${esc(this._t("open_proxmox"))}">${proxmoxPanelIcon("open")}</a>` : "";
      return `<div class="box">
          <div class="nhead"><span class="badge${status === "online" ? "" : " muted"}">${proxmoxPanelIcon("logo")}</span>
            <div class="t"><span class="n">${esc(node.name)}</span><div class="m">${meta}</div></div>
            ${update?.state === "on" ? `<button class="pill warn" data-action="more-info" data-entity="${esc(e.update)}">${esc(this._t("update"))}</button>` : ""}
            ${this._statusPill(status)}${link}</div>
          <div class="rings">
            ${this._ringHtml(this._t("cpu"), this._num(e.cpu), "#378add", "", e.cpu)}
            ${this._ringHtml(this._t("ram"), memPct, "#7f77dd", of(mem, maxMem), e.memory_pct)}
            ${this._ringHtml(this._t("disk"), diskPct, "#1d9e75", of(disk, maxDisk), null)}
          </div>
          <div class="m">${vms.n ? `<span>${proxmoxPanelIcon("vm")}${esc(this._t("vms_running", vms))}</span>` : ""}${cts.n ? `<span>${proxmoxPanelIcon("container")}${esc(this._t("containers_running", cts))}</span>` : ""}</div>
          ${actions ? `<div class="acts">${actions}</div>` : ""}
        </div>`;
    });
    return `${notes ? `<div class="box">${notes}</div>` : ""}${boxes.join("")}`;
  }

  // ── VMs and Containers tabs ──

  _guests(kind, tab) {
    const q = (this._query[tab] || "").trim().toLowerCase();
    return this._items(kind).filter(
      (g) => (!this._node || g.node === this._node) && (!q || g.name.toLowerCase().includes(q) || g.key.includes(q)),
    );
  }

  _guestsHtml(kind, tab) {
    const esc = proxmoxPanelEsc;
    const lang = this._lang();
    const all = this._guests(kind, tab);
    const running = all.filter((g) => this._status(g) === "running").length;
    const showStopped = this._settings?.show_stopped !== false;
    const shown = showStopped ? all : all.filter((g) => this._status(g) !== "stopped");
    const hidden = all.length - shown.length;
    const rows = shown.map((g) => {
      const e = g.entities;
      const status = this._status(g);
      const on = status === "running";
      const mem = this._num(e.memory_pct);
      const uptime = this._uptime(e.uptime);
      const meta = [
        this._items("node").length > 1 ? `<span>${esc(this._nodeName(g.node))}</span>` : "",
        on && this._num(e.cpu) !== null ? `<span>${esc(this._t("cpu"))} ${this._pct(this._num(e.cpu))}</span>` : "",
        on && mem !== null ? `<span>${esc(this._t("ram"))} ${this._pct(mem)}</span>` : "",
        on && uptime !== null ? `<span class="hide-narrow">${esc(proxmoxPanelDuration(uptime, lang))}</span>` : "",
      ].join("");
      // Quick actions: restart and shut down (else stop) when running, start when stopped, resume when suspended
      const quick = on
        ? ["restart", e.shutdown ? "shutdown" : "stop"]
        : status === "suspended"
          ? [e.resume ? "resume" : "start"]
          : status === "stopped"
            ? ["start"]
            : [];
      const quickHtml = quick
        .filter((a) => e[a])
        .map((a) =>
          a === "start" || a === "resume"
            ? `<button class="act" data-action="press" data-item="${esc(g.id)}" data-press="${a}">${proxmoxPanelIcon(a)}${esc(this._t(`a_${a}`))}</button>`
            : `<button class="act quiet icon" data-action="press" data-item="${esc(g.id)}" data-press="${a}" title="${esc(this._t(`a_${a}`))}" aria-label="${esc(this._t(`a_${a}`))}">${proxmoxPanelIcon(a)}</button>`,
        )
        .join("");
      const open = this._expanded === g.id;
      return `<div class="row${open ? " open" : ""}">
          <button class="fold" data-action="expand" data-item="${esc(g.id)}" aria-expanded="${open}" title="${esc(this._t("details"))}">${proxmoxPanelIcon("chevron")}
            <span class="t"><span class="n"><span class="id">${esc(g.key)}</span> · ${esc(g.name)}</span><span class="m">${meta}</span></span></button>
          ${this._statusPill(status)}${quickHtml}</div>${open ? this._detailHtml(g, quick) : ""}`;
    });
    const sum = this._t(kind === "vm" ? "sum_vms" : "sum_containers", { n: all.length, running });
    const notes = this._notesHtml(tab);
    const empty = this._items(kind).length ? this._t("no_match") : this._t(kind === "vm" ? "empty_vms" : "empty_containers");
    return `<div class="box">
        <div class="head"><span class="sum">${esc(sum)}${hidden ? ` · ${esc(this._t("hidden_stopped", { n: hidden }))}` : ""}</span></div>
        ${notes}
        <div class="list">${rows.length ? rows.join("") : `<div class="note">${esc(empty)}</div>`}</div>
      </div>`;
  }

  _detailHtml(g, quick) {
    const esc = proxmoxPanelEsc;
    const lang = this._lang();
    const e = g.entities;
    const facts = [];
    const pair = (used, max, label) => {
      const a = this._bytes(used);
      const b = this._bytes(max);
      if (a !== null && b !== null) facts.push(`<span>${esc(label)} ${esc(this._t("of", { used: proxmoxPanelBytes(a, lang), total: proxmoxPanelBytes(b, lang) }))}</span>`);
      else if (b !== null) facts.push(`<span>${esc(label)} ${esc(proxmoxPanelBytes(b, lang))}</span>`);
    };
    const cpus = this._num(e.max_cpu);
    if (cpus !== null) facts.push(`<span>${esc(this._t("cpus", { n: cpus }))}</span>`);
    pair(e.memory, e.max_memory, this._t("ram"));
    pair(e.disk, e.max_disk, this._t("disk"));
    const down = this._bytes(e.netin);
    const up = this._bytes(e.netout);
    if (down !== null) facts.push(`<span class="down">${proxmoxPanelIcon("download")}${esc(this._t("download"))} ${esc(proxmoxPanelBytes(down, lang))}</span>`);
    if (up !== null) facts.push(`<span class="up">${proxmoxPanelIcon("upload")}${esc(this._t("upload"))} ${esc(proxmoxPanelBytes(up, lang))}</span>`);
    const uptime = this._uptime(e.uptime);
    if (uptime !== null && this._status(g) === "running") facts.push(`<span>${esc(this._t("up_for", { d: proxmoxPanelDuration(uptime, lang) }))}</span>`);
    const fits = PROXMOX_PANEL_FOR_STATUS[this._status(g)] || PROXMOX_PANEL_ACTIONS;
    const actions = PROXMOX_PANEL_ACTIONS.filter((a) => e[a] && fits.includes(a) && !quick.includes(a))
      .map((a) => {
        const tone = a === "snapshot_create" ? "" : a === "stop" || a === "reset" ? " bad" : " quiet";
        return `<button class="act${tone}" data-action="press" data-item="${esc(g.id)}" data-press="${a}">${proxmoxPanelIcon(a)}${esc(this._t(`a_${a}`))}</button>`;
      })
      .join("");
    const link = g.url ? `<a class="act quiet" href="${esc(g.url)}" target="_blank" rel="noopener noreferrer">${proxmoxPanelIcon("open")}${esc(this._t("open_proxmox"))}</a>` : "";
    return `<div class="detail">${facts.length ? `<div class="m">${facts.join("")}</div>` : ""}<div class="acts">${actions}${link}</div></div>`;
  }

  // ── Storage tab ──

  _storageHtml() {
    const esc = proxmoxPanelEsc;
    const lang = this._lang();
    let list = this._items("storage").filter((s) => !this._node || s.node === this._node);
    const state = (s, slot) => this._state(s.entities[slot])?.state;
    if (this._settings?.hide_inactive_storage) list = list.filter((s) => state(s, "active") !== "off" && state(s, "enabled") !== "off");
    const rows = list.map((s) => {
      const e = s.entities;
      const used = this._bytes(e.used);
      const total = this._bytes(e.total);
      const avail = this._bytes(e.available);
      const pct = this._num(e.used_pct) ?? (used !== null && total ? (used / total) * 100 : null);
      const color = pct === null ? "transparent" : pct >= 90 ? "var(--tone-bad)" : pct >= 75 ? "var(--tone-warn)" : "var(--tone-good)";
      const pills = [
        state(s, "shared") === "on" ? `<span class="pill">${esc(this._t("shared"))}</span>` : "",
        state(s, "active") === "on" ? `<span class="pill good">${esc(this._t("active"))}</span>` : "",
        state(s, "active") === "off" || state(s, "enabled") === "off" ? `<span class="pill bad">${esc(this._t("inactive"))}</span>` : "",
      ].join("");
      const facts = [
        used !== null ? `<span>${esc(this._t("used", { v: proxmoxPanelBytes(used, lang) }))}</span>` : "",
        avail !== null ? `<span>${esc(this._t("free", { v: proxmoxPanelBytes(avail, lang) }))}</span>` : "",
        total !== null ? `<span>${esc(this._t("total", { v: proxmoxPanelBytes(total, lang) }))}</span>` : "",
      ].join("");
      const node = this._items("node").length > 1 ? ` <span class="id">· ${esc(this._nodeName(s.node))}</span>` : "";
      return `<div class="srow">
          <div class="line">${proxmoxPanelIcon("storage")}<span class="n" style="flex:1">${esc(s.key)}${node}</span>${pills}<span class="pct">${pct === null ? "" : this._pct(pct)}</span></div>
          ${pct === null ? "" : `<div class="bar"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%;background:${color}"></i></div>`}
          ${facts ? `<div class="m">${facts}</div>` : ""}</div>`;
    });
    return `<div class="box">
        <div class="head"><span class="sum">${esc(this._t("sum_storage", { n: list.length }))}</span></div>
        ${this._notesHtml("storage")}
        <div class="list">${rows.length ? rows.join("") : `<div class="note">${esc(this._t("empty_storage"))}</div>`}</div></div>`;
  }

  // ── Backups tab ──

  _ago(ms) {
    const seconds = (ms - Date.now()) / 1000;
    const steps = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    const [unit, size] = steps.find(([, n]) => Math.abs(seconds) >= n) || ["second", 1];
    try {
      return new Intl.RelativeTimeFormat(this._lang(), { numeric: "auto" }).format(Math.round(seconds / size), unit);
    } catch (_err) {
      return new Date(ms).toISOString();
    }
  }

  _backupsHtml() {
    const esc = proxmoxPanelEsc;
    const lang = this._lang();
    const nodes = this._items("node").map((node) => {
      const e = node.entities;
      if (!e.last_backup && node.disabled.includes("last_backup"))
        return `<div class="row">${proxmoxPanelIcon("backup")}<span class="t"><span class="n">${esc(node.name)}</span>
            <span class="note warn">${esc(this._t("backup_disabled", { node: node.name }))}</span></span>
            <button class="act quiet" data-action="device" data-item="${esc(node.id)}">${esc(this._t("open_device"))}</button></div>`;
      const last = this._state(e.last_backup);
      const time = last ? Date.parse(last.state) : Number.NaN;
      const dur = this._state(e.backup_duration);
      const factor = { s: 1, min: 60, h: 3600, d: 86400 }[dur?.attributes?.unit_of_measurement] ?? 1;
      const meta = [
        Number.isFinite(time) ? `<span title="${esc(new Date(time).toLocaleString(lang))}">${esc(this._t("last_backup", { when: this._ago(time) }))}</span>` : `<span>${esc(this._t("no_backup"))}</span>`,
        dur && Number.isFinite(Number(dur.state)) ? `<span>${esc(this._t("duration", { d: proxmoxPanelDuration(Number(dur.state) * factor, lang) }))}</span>` : "",
      ].join("");
      const problem = this._state(e.backup_problem)?.state;
      const pill = problem === "on" ? `<span class="pill bad">${esc(this._t("backup_failed"))}</span>` : problem === "off" && Number.isFinite(time) ? `<span class="pill good">${esc(this._t("backup_ok"))}</span>` : "";
      return `<div class="row">${proxmoxPanelIcon("backup")}<span class="t"><span class="n">${esc(node.name)}</span><span class="m">${meta}</span></span>${pill}</div>`;
    });
    const guests = [...this._items("vm"), ...this._items("container")].filter((g) => g.entities.snapshot_create);
    const snaps = guests.map(
      (g) => `<div class="row">${proxmoxPanelIcon(g.kind === "vm" ? "vm" : "container")}<span class="t"><span class="n"><span class="id">${esc(g.key)}</span> · ${esc(g.name)}</span></span>
        <button class="act" data-action="press" data-item="${esc(g.id)}" data-press="snapshot_create">${proxmoxPanelIcon("snapshot_create")}${esc(this._t("a_snapshot_create"))}</button></div>`,
    );
    return `<div class="box">${this._notesHtml("backups")}
        <div class="list">${nodes.length ? nodes.join("") : `<div class="note">${esc(this._t("empty_nodes"))}</div>`}</div>
        <div class="sub">${esc(this._t("snapshots"))}</div>
        <div class="list">${snaps.length ? snaps.join("") : `<div class="note">${esc(this._t("no_snapshot"))}</div>`}</div></div>`;
  }

  // ── Settings tab ──

  _value(key) {
    return key in this._draft ? this._draft[key] : this._settings?.[key];
  }

  _settingsHtml() {
    const esc = proxmoxPanelEsc;
    if (!this._settings) return `<div class="box"><div class="note">${esc(this._t("loading"))}</div></div>`;
    const toggle = (key, label) => `<label class="toggle"><div><span>${esc(this._t(label))}</span><small>${esc(this._t(`${label}_hint`))}</small></div>
        <input type="checkbox" data-key="${key}"${this._value(key) ? " checked" : ""}></label>`;
    const changed = Object.keys(this._draft).some((k) => this._draft[k] !== this._settings[k]);
    return `<div class="box form">
        ${toggle("show_stopped", "s_show_stopped")}
        ${toggle("confirm_actions", "s_confirm")}
        ${toggle("admin_only", "s_admin")}
        ${toggle("hide_inactive_storage", "s_hide_storage")}
        <div class="bar-save"><button class="act" data-action="save"${changed ? "" : " disabled"}>${esc(this._t("save"))}</button>
          ${this._saved ? `<span class="note good" role="status">${esc(this._t("saved"))}</span>` : ""}</div></div>`;
  }

  _bindSettings(host) {
    for (const input of host.querySelectorAll("input[data-key]")) {
      input.addEventListener("change", () => {
        this._draft[input.dataset.key] = input.checked;
        this._saved = false;
        const save = host.querySelector("[data-action=save]");
        if (save) save.disabled = !Object.keys(this._draft).some((k) => this._draft[k] !== this._settings[k]);
        host.querySelector(".note.good")?.remove();
      });
    }
    host.querySelector("[data-action=save]")?.addEventListener("click", () => this._save());
  }

  async _save() {
    try {
      const res = await this._hass.callWS({ type: "proxmox_panel/update_settings", ...this._draft });
      if (res.ok) {
        this._settings = res.settings;
        if (this._inv) this._inv.settings = res.settings;
        this._draft = {};
        this._saved = true;
      }
    } catch (err) {
      this._message = { tone: "bad", tab: "settings", text: this._t("error", { error: err?.message || err }) };
    }
    this._bodies = {};
    this._renderTab("settings");
  }

  // ── Events ──

  _bindHead(section, tab) {
    section.querySelector("select[data-node]")?.addEventListener("change", (ev) => {
      this._node = ev.target.value;
      for (const t of ["vms", "containers", "storage"]) this._bodies[t] = null;
      this._renderTab(tab);
    });
    const input = section.querySelector("input[type=search]");
    input?.addEventListener("input", () => {
      this._query[tab] = input.value;
      this._renderTab(tab);
    });
  }

  _bind(host, tab) {
    for (const el of host.querySelectorAll("[data-action]")) el.addEventListener("click", (ev) => this._action(tab, el.dataset, ev));
  }

  _find(id) {
    for (const kind of ["node", "vm", "container", "storage"]) {
      const item = this._items(kind).find((i) => i.id === id);
      if (item) return item;
    }
    return null;
  }

  _action(tab, data, ev) {
    const action = data.action;
    if (action === "retry") return this._load();
    if (action === "add-proxmox") return this._navigate("/config/integrations/dashboard/add?domain=proxmoxve");
    if (action === "device") return this._navigate(`/config/devices/device/${data.item}`);
    if (action === "more-info") return this._moreInfo(data.entity);
    if (action === "cancel") {
      this._confirm = null;
      return this._renderTab(tab, true);
    }
    if (action === "confirmed" && this._confirm) {
      const c = this._confirm;
      return this._press(c.tab, c.entity, c.action, c.name);
    }
    const item = this._find(data.item);
    if (!item) return;
    if (action === "expand") {
      // One machine unfolded at a time; its name again folds it
      this._expanded = this._expanded === item.id ? null : item.id;
      return this._renderTab(tab);
    }
    if (action === "press") {
      ev?.stopPropagation?.();
      this._askOrPress(tab, item, data.press);
    }
  }
}

if (!customElements.get("proxmox-panel")) customElements.define("proxmox-panel", ProxmoxPanel);
