"""Sidebar panel and its WebSocket commands.

The panel (``frontend/proxmox-panel.js``) has six tabs: Nodes, Virtual machines, Containers, Storage, Backups and
Settings. It reads the states of the Proxmox VE entities and acts by pressing their buttons, so it only needs:

- ``proxmox_panel/inventory``: the nodes, virtual machines, containers and storages with their entity ids;
- ``proxmox_panel/settings`` / ``proxmox_panel/update_settings``: the settings (options of the entry);
- ``proxmox_panel/cards``: what the Lovelace cards need (the inventory and whether actions are confirmed).

The panel and its commands are for administrators only; the cards' command answers every user, as the cards show
values every user can read in the states anyway (their actions are offered to administrators only).
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import panel_custom, websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback

from .const import (
    CONF_CONFIRM_ACTIONS,
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
    """The settings, defaults filled in (an option no longer offered is left out)."""
    options = entry.options if entry else {}
    return {key: options.get(key, default) for key, default in DEFAULTS.items()}


def _entry(hass: HomeAssistant) -> ConfigEntry | None:
    entries = hass.config_entries.async_entries(DOMAIN)
    return entries[0] if entries else None


async def async_register_panel(hass: HomeAssistant) -> None:
    """Add Proxmox to the sidebar, for administrators only."""
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_PATH,
        webcomponent_name="proxmox-panel",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=f"{PANEL_URL}?v={VERSION}",
        require_admin=True,
        config={"version": VERSION},
    )


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    """The panel's WebSocket commands."""
    for command in (_ws_inventory, _ws_cards, _ws_settings, _ws_update_settings):
        websocket_api.async_register_command(hass, command)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/inventory"})
@websocket_api.require_admin
@callback
def _ws_inventory(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    connection.send_result(msg["id"], {**async_inventory(hass).as_dict(), "settings": settings(_entry(hass))})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/cards"})
@callback
def _ws_cards(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    current = settings(_entry(hass))
    connection.send_result(
        msg["id"], {**async_inventory(hass).as_dict(), "confirm_actions": current[CONF_CONFIRM_ACTIONS]}
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
