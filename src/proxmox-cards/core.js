/*
 * Proxmox cards for Home Assistant
 * https://github.com/juju35/ha-proxmox
 *
 * Lovelace cards over the core Proxmox VE integration, served and added to the dashboards by Proxmox Panel:
 * - proxmox-card: a node with its CPU, RAM and disk rings (24 h curves behind CPU and RAM), its virtual machines and
 *   containers, and its storage (`node: all` stacks every node);
 * - proxmox-mini-card: one line per node (CPU, RAM and disk bars, machines running), its zoom button switching to
 *   proxmox-card and a click outside the card coming back;
 * - proxmox-guest-card: one or several virtual machines or containers, with their rings, network and actions;
 * - proxmox-guest-mini-card: one line per machine, its zoom button switching to proxmox-guest-card.
 * Every user sees the cards; the actions (the Proxmox VE integration's buttons) are shown to administrators only.
 * Which entity is which comes from the integration's proxmox_panel/cards command, the values from the states.
 */

import {
  PROXMOX_BANNER_STYLE,
  PROXMOX_PANEL_ACTIONS,
  PROXMOX_PANEL_CUTTING,
  PROXMOX_PANEL_FOR_STATUS,
  PROXMOX_PANEL_LANGS,
  PROXMOX_SHARED_STYLE,
  PROXMOX_VARS,
  proxmoxBytesOf,
  proxmoxFind,
  proxmoxHealthBand,
  proxmoxHistory,
  proxmoxHoldUnderPress,
  proxmoxLang,
  proxmoxLoadStrings,
  proxmoxNum,
  proxmoxPanelBytes,
  proxmoxPanelDuration,
  proxmoxPanelEsc as esc,
  proxmoxPanelIcon as icon,
  proxmoxPct,
  proxmoxRackSvg,
  proxmoxReleasePress,
  proxmoxSceneOf,
  proxmoxState,
  proxmoxStatus,
  proxmoxStatusPill,
  proxmoxT,
  proxmoxUplinkHtml,
  proxmoxUptime,
} from "../../custom_components/proxmox_panel/frontend/proxmox-common.js";

export { UPLINK_MODES, uplinkMode } from "../../custom_components/proxmox_panel/frontend/proxmox-common.js";
