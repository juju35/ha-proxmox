"""Proxmox Panel: a sidebar panel for the nodes, virtual machines, containers, storage and backups of Proxmox VE."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN, I18N_URL, ICONS_URL, PANEL_PATH, PANEL_URL, VERSION
from .panel import async_register_commands, async_register_panel

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the panel and its language files, and add the panel's commands."""
    base = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(PANEL_URL, str(base / "proxmox-panel.js"), True),
            StaticPathConfig(ICONS_URL, str(base / "proxmox-icons.js"), True),
            StaticPathConfig(I18N_URL, str(base / "i18n"), True),
        ]
    )
    async_register_commands(hass)
    # The sidebar entry shows the Proxmox logo: its icon set is loaded on every page
    add_extra_js_url(hass, f"{ICONS_URL}?v={VERSION}")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Add the panel to the sidebar; settings changes register it again (who may open it)."""
    await async_register_panel(hass, entry)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Remove the panel from the sidebar."""
    frontend.async_remove_panel(hass, PANEL_PATH)
    return True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    frontend.async_remove_panel(hass, PANEL_PATH)
    await async_register_panel(hass, entry)
