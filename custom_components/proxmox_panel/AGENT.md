# Proxmox Panel Integration — Agent Context

## Purpose
Home Assistant custom integration (domain `proxmox_panel`, repository juju35/ha-proxmox) on top of the core `proxmoxve`
integration: a sidebar panel (`/proxmox`, administrators only) showing its nodes, virtual machines, containers, storage
and backups, and four Lovelace cards (`proxmox-card`, `proxmox-mini-card`, `proxmox-guest-card`, `proxmox-guest-mini-card`)
seen by every user, acting through its button entities (actions for administrators only). It has no Proxmox connection or credentials of its own and creates no entity.

## Architecture
```
custom_components/proxmox_panel/
├── __init__.py      # Static paths (panel, icon set, i18n), extra JS for the icon set, panel on setup_entry,
│                    # registered again when the options change (require_admin)
├── config_flow.py   # Single entry (manifest single_config_entry), no question; settings live in the panel
├── const.py         # DOMAIN, VERSION, URLs, panel path/icon, settings keys and defaults
├── discovery.py     # Inventory from the device / entity registries: device identifiers <entry>_<kind>_<key>,
│                    # entities matched by the end of their unique id (SLOTS), disabled ones reported
├── panel.py         # panel_custom registration and proxmox_panel/* WebSocket commands (cards: every user)
├── translations/    # Config flow strings, 22 languages
├── brand/           # Integration icon (Proxmox logo on an orange tile, server badge)
└── frontend/        # proxmox-common.js (shared ES module: strings, icons, formatting, rings; served without cache),
                     # proxmox-panel.js (6 tabs), proxmox-cards.js (4 cards + editors, a dashboard resource),
                     # i18n/<lang>.json (21 languages, on demand), proxmox-icons.js (icon set proxmox_panel:logo)
```

## Rules
- Versions must agree (Release workflow): manifest.json, const.py VERSION, proxmox-panel.js PROXMOX_PANEL_VERSION,
  proxmox-cards.js PROXMOX_CARDS_VERSION, package.json (and package-lock.json).
- Every key of PROXMOX_PANEL_EN (proxmox-common.js) must be in each frontend/i18n file with the same placeholders (tests check it).
- Card actions are shown to administrators only; the panel and its commands are administrators only.
- The panel only presses `button.*` entities of the proxmoxve integration; never talk to Proxmox directly.
- When proxmoxve changes its description keys or identifiers, update SLOTS / parse_identifier and the tests; the custom
  Proxmox VE integration (dougiteixeira/proxmoxve, same domain) has its own: CUSTOM_KINDS / CUSTOM_SLOTS / CUSTOM_BACKUP_SLOTS.
