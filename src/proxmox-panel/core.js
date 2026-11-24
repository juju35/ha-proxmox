/*
 * Proxmox panel for Home Assistant
 * https://github.com/juju35/ha-proxmox
 *
 * A sidebar panel over the core Proxmox VE integration (proxmoxve). It reads the states of its entities and acts by
 * pressing its buttons; the integration's own command (proxmox_panel/inventory) only says which entity is which.
 * The cards' illustrated header as its top bar (status pill, refresh and integration buttons), then six tabs under it, as in Smart Comfort (text tabs, the active one underlined, the tab in the address,
 * Settings last):
 * - Nodes: each node with its CPU, RAM and disk rings (24 h curves behind CPU and RAM), uptime, pending updates, how
 *   many virtual machines and containers run, and the node-wide actions;
 * - Virtual machines and Containers: one row per machine, its status and quick actions, unfolding into the details
 *   and the other actions; filtered by node and by a search;
 * - Storage: one gauge per storage, with its active / shared state;
 * - Backups: the last backup of each node (its sensors are disabled by default in the integration) and a manual
 *   snapshot of each machine;
 * - Settings: stopped machines shown or not, confirmation of the actions that stop or restart, inactive storage
 *   hidden.
 * The panel is for administrators only (registered with require_admin, its commands too).
 * English is built in; the other languages are loaded on demand from /proxmox_panel/i18n/<lang>.json.
 */

import {
  PROXMOX_PANEL_CUTTING,
  PROXMOX_PANEL_ACTIONS,
  PROXMOX_PANEL_NODE_ACTIONS,
  PROXMOX_PANEL_FOR_STATUS,
  proxmoxPanelEsc,
  proxmoxPanelIcon,
  proxmoxPanelBytes,
  proxmoxPanelDuration,
  proxmoxLang,
  proxmoxLoadStrings,
  proxmoxT,
  proxmoxState,
  proxmoxNum,
  proxmoxBytesOf,
  proxmoxHoldUnderPress,
  proxmoxReleasePress,
  proxmoxUptime,
  proxmoxPct,
  proxmoxStatus,
  proxmoxStatusPill,
  proxmoxAgo,
  proxmoxFind,
  proxmoxHistory,
  proxmoxHealthBand,
  proxmoxRing,
  proxmoxRackSvg,
  proxmoxSceneOf,
  proxmoxUplinkHtml,
  PROXMOX_BANNER_STYLE,
  PROXMOX_COLORS,
  PROXMOX_SHARED_STYLE,
  PROXMOX_VARS,
} from "../../custom_components/proxmox_panel/frontend/proxmox-common.js";

export const PROXMOX_PANEL_VERSION = "1.7.1";
// The integrations whose entries the panel reads: the Proxmox VE ones (the custom one moved to proxmoxve_custom in 6.0,
// #32), then Proxmox Extended Sensors
export const PROXMOX_PANEL_VE_DOMAINS = ["proxmoxve", "proxmoxve_custom"];
export const PROXMOX_PANEL_DOMAINS = [...PROXMOX_PANEL_VE_DOMAINS, "proxmox_sensors"];
// Disks and Datastores come from Proxmox Extended Sensors: shown only when it offers them (juju35/ha-proxmox#14).
export const PROXMOX_PANEL_TABS = ["nodes", "vms", "containers", "storage", "backups", "disks", "datastores", "settings"];
export const PROXMOX_PANEL_SENSOR_TABS = { disks: "disk", datastores: "pbs" };
