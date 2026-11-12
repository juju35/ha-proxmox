"""Proxmox Panel: a sidebar panel and Lovelace cards for the nodes, machines, storage and backups of Proxmox VE."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from homeassistant.components import frontend
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, Event, HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import CARDS_URL, COMMON_URL, DOMAIN, I18N_URL, ICONS_URL, PANEL_PATH, PANEL_URL, VERSION
from .panel import async_register_commands, async_register_panel

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
# Set once the cards are loaded, cleared when the entry is removed
CARDS_LOADED = f"{DOMAIN}_cards_loaded"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the panel, the cards and their language files, and add their commands."""
    base = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(PANEL_URL, str(base / "proxmox-panel.js"), True),
            StaticPathConfig(CARDS_URL, str(base / "proxmox-cards.js"), True),
            # Imported by the panel and the cards without a version: not cached for long, so both get the one installed
            StaticPathConfig(COMMON_URL, str(base / "proxmox-common.js"), False),
            StaticPathConfig(ICONS_URL, str(base / "proxmox-icons.js"), True),
            StaticPathConfig(I18N_URL, str(base / "i18n"), True),
        ]
    )
    async_register_commands(hass)
    # The sidebar entry shows the Proxmox logo: its icon set is loaded on every page
    add_extra_js_url(hass, f"{ICONS_URL}?v={VERSION}")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Add the panel to the sidebar (administrators only) and the cards to the dashboards."""
    await async_register_panel(hass)

    async def _load(_: Event | None = None) -> None:
        if not hass.data.get(CARDS_LOADED):
            await _async_load_cards(hass)

    if hass.state is CoreState.running:
        await _load()
    else:
        entry.async_on_unload(hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _load))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Remove the panel from the sidebar; the cards stay loaded until the entry is removed."""
    frontend.async_remove_panel(hass, PANEL_PATH)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Drop the cards' dashboard resource."""
    hass.data[CARDS_LOADED] = False
    if (resources := _storage_resources(hass)) is None:
        return
    await resources.async_get_info()
    for item in list(resources.async_items()):
        if item.get("url", "").split("?")[0] == CARDS_URL:
            await resources.async_delete_item(item["id"])


async def _async_load_cards(hass: HomeAssistant) -> None:
    """Add the cards to the dashboard resources, or load them on every page in YAML mode."""
    hass.data[CARDS_LOADED] = True
    if not await _async_register_resource(hass):
        add_extra_js_url(hass, f"{CARDS_URL}?v={VERSION}")


def _storage_resources(hass: HomeAssistant) -> Any | None:
    """The dashboard resources collection when it is editable from the UI.

    hass.data["lovelace"] is a dataclass whose `mode` field became `resource_mode` in Home Assistant 2026.2.
    """
    lovelace = hass.data.get("lovelace")
    if getattr(lovelace, "resource_mode", getattr(lovelace, "mode", None)) != "storage":
        return None
    return getattr(lovelace, "resources", None)


async def _async_register_resource(hass: HomeAssistant) -> bool:
    """Add or update the cards in Settings → Dashboards → Resources (a module, its version in the address)."""
    resources = _storage_resources(hass)
    if resources is None:
        return False
    url = f"{CARDS_URL}?v={VERSION}"
    try:
        await resources.async_get_info()  # loads the collection from storage
        existing = [item for item in resources.async_items() if item.get("url", "").split("?")[0] == CARDS_URL]
        if not existing:
            await resources.async_create_item({"res_type": "module", "url": url})
            return True
        if existing[0]["url"] != url:
            await resources.async_update_item(existing[0]["id"], {"res_type": "module", "url": url})
        for duplicate in existing[1:]:
            await resources.async_delete_item(duplicate["id"])
    except Exception:  # noqa: BLE001 - never block the integration on the cards
        _LOGGER.exception("Could not register the Proxmox cards as a dashboard resource")
        return False
    return True
