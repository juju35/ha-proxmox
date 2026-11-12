"""Config flow: one entry, no question (the settings are edited in the sidebar panel)."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DEFAULTS, DOMAIN


class ProxmoxPanelConfigFlow(ConfigFlow, domain=DOMAIN):
    """Add the Proxmox panel to the sidebar."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is None:
            return self.async_show_form(step_id="user")
        return self.async_create_entry(title="Proxmox Panel", data={}, options=dict(DEFAULTS))
