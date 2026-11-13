# Changelog

## 1.0.1 - 2026-11-13

### Fixes
- Folding back on a tap elsewhere now works on iOS (Safari and the companion app): a tap on something that is not clickable sent no click to the page, so what a click elsewhere folds (unfolded sections, the detailed view of the mini card, popups) stayed open. The press and the release are caught instead; a slider dragged out of the card and a scroll do not fold anything.
- Leaving the card (another dashboard view, a conditional card hidden) brings it back in its default state.
- A click could do nothing (cards and panel): Home Assistant updates them several times a second, and a rewrite between the press and the release replaced the element pressed, so that the click was lost. They are no longer rewritten while a press is in progress; the pending update is drawn right after the click.

## 1.0.0 - 2026-11-13

First stable release.

### Features
- **Cards** for the dashboards, added to the resources by the integration, with a visual editor and 22 languages:
  - `proxmox-card`: a node (or every node with `node: all`) with its CPU, RAM and disk rings and 24-hour curves, uptime, version and pending update, its virtual machines and containers (running first, `max_items` per list) and its storage gauges;
  - `proxmox-mini-card`: one line per node with CPU, RAM and disk bars and the machines running, its zoom button showing `proxmox-card`;
  - `proxmox-guest-card`: one or several virtual machines or containers (`guest` / `guests`), with their rings, network and the actions that fit their status;
  - `proxmox-guest-mini-card`: one line per machine, a quick Start or Resume, its zoom button showing `proxmox-guest-card`.
- Every user sees the cards; their actions are offered to administrators only, and those that stop or restart are confirmed at the top of the card (the panel's setting).
- New `proxmox_panel/cards` command, open to every user, giving the cards the inventory.

### Changes
- The panel and the cards share `proxmox-common.js`; the panel's ring labels show the sizes on a line of their own.

## 0.2.0 - 2026-11-12

### Changes
- The panel is for **administrators only**, always: the *Keep the panel for administrators* setting is gone, the panel is registered for administrators and its commands refuse other users. An installation that had opened it to everyone gets it back for administrators only after the update.

## 0.1.0 - 2026-11-12

### Features
- First release: a **Proxmox** sidebar panel over the built-in Proxmox VE integration, with the Proxmox logo as its icon.
- **Nodes** tab: CPU, RAM and disk rings with 24-hour curves, uptime, CPUs, Proxmox VE version, pending update, machines running and node-wide actions.
- **VMs** and **Containers** tabs: status, CPU, RAM, uptime and quick action per machine; unfolded details (RAM, disk, network, CPUs) with every action that fits its status; search and node filter.
- **Storage** tab: usage gauges with used, free and total space, active and shared state.
- **Backups** tab: last backup, duration and status of each node (with a link to enable the backup sensors when they are off), and a manual snapshot of each machine.
- **Settings** tab: stopped machines shown or not, confirmation of the actions that stop or restart, panel kept for administrators, inactive storage hidden.
- 22 languages.
