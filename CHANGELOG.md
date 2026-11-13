# Changelog

## 1.1.1 - 2026-11-14

### Fixes
- Node mini card visual editor: the node card options shown in its zoomed view (`show_vms`, `show_containers`, `show_storage`, `show_stopped`, `show_actions`, `max_items`, `collapsed`) can now be set there too.

## 1.1.0 - 2026-11-13

### Features
- **Title** ([#7](https://github.com/juju35/ha-proxmox/issues/7), suggested by @mielikki33): `title` (also in the visual editors) replaces the node's name in the header of the node cards (*Proxmox* instead of *pve*), the machine's on the machine cards, and the header of the mini card over several nodes.
- **Sections that fold** (#7): on the node card, the virtual machines, the containers and the storage are sections with their icon, their count and a chevron; a click on their heading folds or unfolds them. `collapsed: true` (also in the visual editor) starts them folded, and a click elsewhere on the page folds them again.

### Improvements
- **CPU, RAM and disk as the other cards** (#7): the gauges are drawn as on System Hub's System Monitor card and the NAS card, a ring with the metric's icon and its whole percentage, blue then orange and red from the thresholds (70 / 90 % for the CPU and the RAM, 80 / 90 % for the disk), the 24-hour curve behind the whole gauge; a gauge opens its entity. The storage reads as System Monitor's: name, used / total and percentage, the bar under them, in the same colours. The mini cards' bars follow.

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
