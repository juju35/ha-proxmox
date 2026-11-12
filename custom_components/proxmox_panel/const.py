"""Constants for the Proxmox Panel integration."""

DOMAIN = "proxmox_panel"
VERSION = "0.1.0"

# The core Proxmox VE integration, whose devices and entities the panel shows
PROXMOX_DOMAIN = "proxmoxve"

# Files served by the integration, and the sidebar panel (its own path, not /proxmox_panel,
# so the frontend's panel route never shadows the files)
URL_BASE = f"/{DOMAIN}"
PANEL_URL = f"{URL_BASE}/proxmox-panel.js"
I18N_URL = f"{URL_BASE}/i18n"
PANEL_PATH = "proxmox"
PANEL_TITLE = "Proxmox"
# The Proxmox logo, from the icon set of frontend/proxmox-icons.js (loaded on every page)
PANEL_ICON = "proxmox_panel:logo"
ICONS_URL = f"{URL_BASE}/proxmox-icons.js"

# Settings (options of the config entry), edited in the panel's Settings tab
CONF_SHOW_STOPPED = "show_stopped"
CONF_CONFIRM_ACTIONS = "confirm_actions"
CONF_ADMIN_ONLY = "admin_only"
CONF_HIDE_INACTIVE_STORAGE = "hide_inactive_storage"
DEFAULTS = {
    CONF_SHOW_STOPPED: True,
    CONF_CONFIRM_ACTIONS: True,
    CONF_ADMIN_ONLY: True,
    CONF_HIDE_INACTIVE_STORAGE: False,
}
