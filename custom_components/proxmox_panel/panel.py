"""Sidebar panel and its WebSocket commands.

The panel (``frontend/proxmox-panel.js``) has six tabs: Nodes, Virtual machines, Containers, Storage, Backups and
Settings. It reads the states of the Proxmox VE entities and acts by pressing their buttons, so it only needs:

- ``proxmox_panel/inventory``: the nodes, virtual machines, containers and storages with their entity ids
  (administrators, or everyone when the panel is not kept for administrators);
- ``proxmox_panel/settings`` / ``proxmox_panel/update_settings``: the settings (options of the entry), administrators.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import panel_custom, websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback

from .const import (
    CONF_ADMIN_ONLY,
    DEFAULTS,
    DOMAIN,
    PANEL_ICON,
    PANEL_PATH,
    PANEL_TITLE,
    PANEL_URL,
    VERSION,
)
from .discovery import async_inventory


def settings(entry: ConfigEntry | None) -> dict[str, Any]:
    """The settings, defaults filled in."""
    return {**DEFAULTS, **(entry.options if entry else {})}


def _entry(hass: HomeAssistant) -> ConfigEntry | None:
    entries = hass.config_entries.async_entries(DOMAIN)
    return entries[0] if entries else None


async def async_register_panel(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Add Proxmox to the sidebar, for administrators only unless the settings open it to everyone."""
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_PATH,
        webcomponent_name="proxmox-panel",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=f"{PANEL_URL}?v={VERSION}",
        require_admin=settings(entry)[CONF_ADMIN_ONLY],
        config={"version": VERSION},
    )


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    """The panel's WebSocket commands."""
    for command in (_ws_inventory, _ws_settings, _ws_update_settings):
        websocket_api.async_register_command(hass, command)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/inventory"})
@callback
def _ws_inventory(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    current = settings(_entry(hass))
    if current[CONF_ADMIN_ONLY] and not connection.user.is_admin:
        connection.send_error(msg["id"], websocket_api.ERR_UNAUTHORIZED, "Administrators only")
        return
    connection.send_result(
        msg["id"], {**async_inventory(hass).as_dict(), "settings": current, "admin": connection.user.is_admin}
    )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/settings"})
@websocket_api.require_admin
@callback
def _ws_settings(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    connection.send_result(msg["id"], {"settings": settings(_entry(hass))})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_settings",
        **{vol.Optional(key): bool for key in DEFAULTS},
    }
)
@websocket_api.require_admin
@callback
def _ws_update_settings(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if (entry := _entry(hass)) is None:
        connection.send_result(msg["id"], {"ok": False, "error": "not_found"})
        return
    current = settings(entry)
    updated = {**current, **{key: msg[key] for key in DEFAULTS if key in msg}}
    if updated != current:
        hass.config_entries.async_update_entry(entry, options=updated)
    connection.send_result(msg["id"], {"ok": True, "settings": updated})
