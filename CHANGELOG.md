# Changelog

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
