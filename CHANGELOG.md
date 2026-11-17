# Changelog

## 1.4.0 - 2026-11-17

### Features
- **Illustrated header** on the four cards (full and mini): a 90 px banner with a server rack on a concrete floor strip, its status lights blinking, and a "PVE" tag in the state's colour — running (all machines up), a warning when some machines are stopped or suspended, grey for a stopped machine, red when the node is down or unavailable. The round icon (server, VM or container) takes the state's colour and carries the Proxmox logo. A night picture shows when `sun.sun` is below the horizon or the theme is dark (even while the sun is up), forced with `illustration_theme: day | night`; `illustration: false` brings the classic header back. Both options are in the visual editors.
- **Network uplink** in the banner: a cable along the top of the floor strip runs into the rack, its packets flowing in the state's colour — slower and sparser on a warning, red dashes blinking with no flow when the node is down, a grey still cable for a stopped machine. Still with `prefers-reduced-motion`.
- README: the banner's animations as GIFs (running, warning, node down), light and dark.
- **Status pill on every banner**, right after the title with a dot, in the colour of the header icon: Online, the machines running when some are stopped, Offline, or the machine's state (also on the mini cards and the summing-up banners, which had none); on a narrow card it moves under the subtitle, then keeps only its dot. A second pill (Update available) sits beside it when there is room, else at the end of the subtitle's line (only its dot when narrower), never down on the floor strip. The mini cards' expand / collapse button sits in the banner's top right corner (24 px, frosted), in the compact **and** the expanded view, and in the card's corner without the illustration.

### Fixes
- The 24 h sparklines of the CPU / RAM / disk gauges no longer run under the text: they sit in a 24 px band of their own under the ring and its labels ("RAM 19.8 GiB / 31.9 GiB"); the gauges' used / total line no longer drops to 10 px on narrow cards (11 px).

## 1.3.0 - 2026-11-15

### Features
- **Proxmox Extended Sensors** ([#14](https://github.com/juju35/ha-proxmox/issues/14), requested by @stevaedrum): the panel and the cards also read the [Proxmox Extended Sensors](https://github.com/Javisen/proxmox_sensors) integration (`proxmox_sensors`), whose devices carry the resource in their identifier and the metric in each entity's translation key. Its nodes, virtual machines, containers and storages fill the panel and the cards as the Proxmox VE integration's do, with the guests' start, stop, reboot, shutdown, pause, hibernate, reset and resume buttons. The built-in and custom Proxmox VE integrations are read as before.
- **Node temperature and health**: when Proxmox Extended Sensors provides them, a band under the node rings (node card and Nodes tab) shows the CPU temperature, the health score and the IO wait, and a state from the overload sensors (healthy, disk pressure, stressed or overloaded).
- **Disks and Datastores tabs**: two tabs appear in the panel when Proxmox Extended Sensors offers them — the physical disks with their SMART health, temperature, wear and power-on time, and the Proxmox Backup Server datastores with their usage, deduplication, last backup and GC / prune / verify status.

## 1.2.0 - 2026-11-14

### Features
- **24 h history as an option** ([#11](https://github.com/juju35/ha-proxmox/issues/11), suggested by @mielikki33): `show_history: false` (also in the visual editors) draws the CPU and RAM gauges of the cards without their 24-hour curves, and fetches no history. In the panel, the **Show 24 h history** setting does the same for the nodes' rings.
- **Custom Proxmox VE integration** ([#12](https://github.com/juju35/ha-proxmox/issues/12), reported by @scmsohel): the panel and the cards also read the custom [Proxmox VE](https://github.com/dougiteixeira/proxmoxve) integration (same `proxmoxve` domain), whose identifiers are in upper case (`NODE`, `QEMU`, `LXC`, `STORAGE`) and whose entities have their own keys: CPU, RAM, disk, uptime, status, network, storage usage, the node and machine buttons and the last backup of a node are found. The built-in integration is read as before.

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
