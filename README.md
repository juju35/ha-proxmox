# ha-proxmox

[![Marketplace](https://img.shields.io/badge/Marketplace-Custom-41BDF5.svg)](https://www.home-assistant.io/integrations/marketplace/)
[![HACS Validation](https://github.com/juju35/ha-proxmox/actions/workflows/hacs.yml/badge.svg)](https://github.com/juju35/ha-proxmox/actions/workflows/hacs.yml)
[![Validate](https://github.com/juju35/ha-proxmox/actions/workflows/validate.yml/badge.svg)](https://github.com/juju35/ha-proxmox/actions/workflows/validate.yml)
[![Lint](https://github.com/juju35/ha-proxmox/actions/workflows/lint.yml/badge.svg)](https://github.com/juju35/ha-proxmox/actions/workflows/lint.yml)
[![Release](https://img.shields.io/github/v/release/juju35/ha-proxmox)](https://github.com/juju35/ha-proxmox/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/juju35/ha-proxmox/blob/main/LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/julienstep9)

<p align="center"><img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/custom_components/proxmox_panel/brand/icon.png" alt="Proxmox Panel" width="120"></p>

Home Assistant integration that adds a **Proxmox** panel to the sidebar, on top of the built-in [Proxmox VE integration](https://www.home-assistant.io/integrations/proxmoxve/): your nodes, virtual machines, containers, storage and backups on one page, with the actions of the integration's buttons (start, shut down, restart, snapshot…) one click away.

<p align="center"><img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-nodes.png" alt="Nodes tab" width="600"></p>

[![Open your Home Assistant instance and open a repository inside the Marketplace.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=juju35&repository=ha-proxmox&category=integration)

## Features

- **Nodes**: each node with its CPU, RAM and disk rings (the last 24 hours of CPU and RAM drawn behind them), uptime, CPUs, Proxmox VE version, pending update, how many virtual machines and containers run, and the node-wide actions (start all, suspend all, stop all, restart, shut down)
- **VMs** and **Containers**: one row per machine with its status, CPU, RAM and uptime, and the action that fits (start a stopped one, restart or shut down a running one, resume a suspended one); its name unfolds the details (RAM, disk, network download / upload, CPUs) and every other action that fits its status, with a link to the machine in the Proxmox web interface. Search by name or ID, filter by node
- **Storage**: one gauge per storage (green, amber from 75 %, red from 90 %), with used, free and total space, and its active and shared state
- **Backups**: the last backup of each node, how long it took and whether it failed, and a manual **Snapshot** of each virtual machine and container
- **Confirmation** before the actions that stop or restart something (stop, shut down, reset, restart, hibernate, node-wide actions), at the top of the list
- **Settings** (administrators): stopped machines shown or not, the confirmation, the panel kept for administrators or opened to everyone (the Settings tab stays for administrators), inactive storage hidden
- The **Proxmox logo** as the sidebar icon
- Light and dark themes, phones and desktops, 22 languages
- No connection to Proxmox of its own: the panel reads the entities of the Proxmox VE integration and presses its buttons, with the permissions you gave it

## Supported integrations

| Integration | What it is used for |
|---|---|
| [Proxmox VE](https://www.home-assistant.io/integrations/proxmoxve/) (built in) | Everything the panel shows: its devices (nodes, virtual machines, containers, storage), their sensors, binary sensors and update entities, and its buttons for the actions |

## Prerequisites

Home Assistant 2026.11 or later, and the [Proxmox VE integration](https://www.home-assistant.io/integrations/proxmoxve/) added with your Proxmox server (**Settings → Devices & services → Add integration → Proxmox VE**). The actions need the matching permissions on the Proxmox user or token (`VM.PowerMgmt`, `VM.Snapshot`, `Sys.PowerMgmt`): the integration only creates the buttons it is allowed to press.

The backup sensors of the nodes (last backup, duration, status) are **disabled by default** in the Proxmox VE integration: enable them on the node's device to see the backups in the panel. The Backups tab links to the device when they are off.

## Installation

### Via the Marketplace (recommended)

Click the button below to add the repository directly:

[![Add to the Marketplace](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=juju35&repository=ha-proxmox&category=integration)

Then click **Install** and restart Home Assistant.

Or manually:

1. Open **Settings → Marketplace → Add from link** (top right; this needs a GitHub account connected)
2. Add `https://github.com/juju35/ha-proxmox` — Type: **Integration**
3. Open **Proxmox Panel** and click **Install**, then restart Home Assistant

Then **Settings → Devices & services → Add integration → Proxmox Panel**: the **Proxmox** entry appears in the sidebar.

### Manual

1. Download `proxmox_panel.zip` from the [latest release](https://github.com/juju35/ha-proxmox/releases/latest)
2. Extract it to `/config/custom_components/proxmox_panel/`
3. Restart Home Assistant and add the **Proxmox Panel** integration

## Panel

The **Proxmox** entry of the sidebar, at `/proxmox` (each tab has its own address: `/proxmox/vms`, `/proxmox/containers`, `/proxmox/storage`, `/proxmox/backups`, `/proxmox/settings`). It is kept for administrators unless the settings open it to everyone.

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-nodes.png" alt="Nodes tab" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-nodes-dark.png" alt="Nodes tab dark" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-vms.png" alt="VMs tab, a machine unfolded" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-vms-dark.png" alt="VMs tab, a machine unfolded dark" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-containers.png" alt="Containers tab" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-containers-dark.png" alt="Containers tab dark" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-confirm.png" alt="Confirmation of an action" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-confirm-dark.png" alt="Confirmation of an action dark" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-storage.png" alt="Storage tab" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-storage-dark.png" alt="Storage tab dark" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-backups.png" alt="Backups tab" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-backups-dark.png" alt="Backups tab dark" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-settings.png" alt="Settings tab" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-proxmox/main/screenshots/panel-settings-dark.png" alt="Settings tab dark" width="400"> |

### Settings

| Setting | Default | What it does |
|---|---|---|
| Show stopped machines | on | Off: the VMs and Containers tabs list the running and suspended machines only, and say how many are hidden |
| Ask before stopping or restarting | on | Stop, shut down, reset, restart, hibernate and the node-wide actions wait for a confirmation |
| Keep the panel for administrators | on | Off: every user sees the panel and can use its actions; the Settings tab stays for administrators |
| Hide inactive storage | off | Storage that is disabled or not active is left out of the Storage tab |

## How it works

The Proxmox VE integration creates one device per node, virtual machine, container and storage. The panel's integration reads the device and entity registries and tells the panel which entity is which: each device is recognized by its identifier (`<entry>_node_<id>`, `<entry>_vm_<vmid>`, `<entry>_container_<vmid>`, `<entry>_storage_<name>`), and each entity by the end of its unique ID (`node_cpu`, `vm_memory`, `start`, `snapshot_create`…), so renamed entities and entity IDs in another language are supported. Disabled entities are reported too, which is how the Backups tab knows that the backup sensors are off.

The panel then reads the states as Home Assistant updates them (every 60 seconds by default in the Proxmox VE integration), and an action is a press of the matching button entity (`button.press`). The 24-hour curves come from the recorder's history of the nodes' CPU and RAM sensors. Several Proxmox VE servers (several entries) are shown together, with a node filter.

Sizes are shown in base 1024 (KiB, MiB, GiB, TiB) with 2, 1 or 0 decimals as the value grows, percentages as whole numbers, and download in green, upload in blue, as in the other ha-* projects.

## Development

```bash
pip install -r requirements_test.txt && pytest   # integration tests (Home Assistant test harness)
npm ci && npm test                               # panel tests
npm run screenshots                              # renders the panel with mock data into screenshots/
```

The panel is a plain JavaScript file in `custom_components/proxmox_panel/frontend/`, served by the integration with its language files (`frontend/i18n/`): nothing to build.

### Releasing

1. Bump the version in `custom_components/proxmox_panel/manifest.json`, `const.py` (`VERSION`), `frontend/proxmox-panel.js` (`PROXMOX_PANEL_VERSION`) and `package.json` (`npm install` updates `package-lock.json`)
2. Add a `## <version>` section at the top of [CHANGELOG.md](https://github.com/juju35/ha-proxmox/blob/main/CHANGELOG.md)
3. Push to `main`: the **Release** workflow checks that the versions agree, creates the tag and the GitHub release with the changelog section as notes, and attaches `proxmox_panel.zip`

## Translations

The panel auto-detects the language from your Home Assistant settings. English is built in; the other languages are loaded on demand. Currently supported:

| Language | Code |
|---|---|
| English | `en` |
| Français | `fr` |
| Deutsch | `de` |
| Español | `es` |
| Српски | `sr` |
| Srpski (latinica) | `sr-Latn` |
| Italiano | `it` |
| Nederlands | `nl` |
| Português (Portugal) | `pt` |
| Polski | `pl` |
| Română | `ro` |
| Dansk | `da` |
| Svenska | `sv` |
| Български | `bg` |
| Русский | `ru` |
| Українська | `uk` |
| Magyar | `hu` |
| Slovenčina | `sk` |
| Čeština | `cs` |
| Slovenščina | `sl` |
| Latviešu | `lv` |
| Ελληνικά | `el` |

Regional variants fall back to the base language (`it-IT` → `it`, `nl-BE` → `nl`); Brazilian Portuguese (`pt-BR`) uses the European Portuguese translation. Counts read "label: {n}" in every language (`VMs: 4`, `Storage: 3`), so that no plural form is ever wrong.

Contributions for additional languages are welcome!

## Trademark

Proxmox® is a registered trademark of Proxmox Server Solutions GmbH. This project is not affiliated with or endorsed by Proxmox Server Solutions GmbH; the logo is used to identify the integration it works with.

## License

[MIT](https://github.com/juju35/ha-proxmox/blob/main/LICENSE)

## Support

If you find this project useful, you can support its development:

<a href="https://buymeacoffee.com/julienstep9"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="50"></a>
