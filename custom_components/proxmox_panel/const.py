"""Constants for the Proxmox Panel integration."""

DOMAIN = "proxmox_panel"
VERSION = "1.5.0"

# The core Proxmox VE integration, whose devices and entities the panel shows
PROXMOX_DOMAIN = "proxmoxve"
# The Proxmox Extended Sensors integration (Javisen/proxmox_sensors, juju35/ha-proxmox#14): read the same way, from
# its own devices and entities, which carry the resource in the device identifier and the metric in the entity's
# translation key. It also brings a few sensors the Proxmox VE integration has no equivalent for: the node's
# temperature and health, the physical disks (SMART) and the Proxmox Backup Server datastores.
PROXMOX_SENSORS_DOMAIN = "proxmox_sensors"

# Files served by the integration, and the sidebar panel (its own path, not /proxmox_panel,
# so the frontend's panel route never shadows the files)
URL_BASE = f"/{DOMAIN}"
PANEL_URL = f"{URL_BASE}/proxmox-panel.js"
# Lovelace cards (a dashboard resource), and the module the panel and the cards share (no long-term caching)
CARDS_URL = f"{URL_BASE}/proxmox-cards.js"
COMMON_URL = f"{URL_BASE}/proxmox-common.js"
I18N_URL = f"{URL_BASE}/i18n"
PANEL_PATH = "proxmox"
PANEL_TITLE = "Proxmox"
# The Proxmox logo, from the icon set of frontend/proxmox-icons.js (loaded on every page)
PANEL_ICON = "proxmox_panel:logo"
ICONS_URL = f"{URL_BASE}/proxmox-icons.js"
# The sidebar count (nodes down + machines unavailable), loaded on every page; it imports proxmox-common.js
BADGE_URL = f"{URL_BASE}/proxmox-badge.js"

# Settings (options of the config entry), edited in the panel's Settings tab. The panel is always for
# administrators only: no setting opens it to other users.
CONF_SHOW_STOPPED = "show_stopped"
CONF_CONFIRM_ACTIONS = "confirm_actions"
CONF_HIDE_INACTIVE_STORAGE = "hide_inactive_storage"
CONF_SHOW_HISTORY = "show_history"
DEFAULTS = {
    CONF_SHOW_STOPPED: True,
    CONF_CONFIRM_ACTIONS: True,
    CONF_HIDE_INACTIVE_STORAGE: False,
    CONF_SHOW_HISTORY: True,
}
