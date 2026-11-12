"""Setup, the sidebar panel and the WebSocket commands."""

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.proxmox_panel.const import (
    CARDS_URL,
    COMMON_URL,
    DEFAULTS,
    DOMAIN,
    PANEL_ICON,
    PANEL_PATH,
    VERSION,
)


async def _setup(hass: HomeAssistant, options=None) -> MockConfigEntry:
    assert await async_setup_component(hass, "http", {})
    assert await async_setup_component(hass, "lovelace", {})
    entry = MockConfigEntry(domain=DOMAIN, title="Proxmox Panel", data={}, options=options or dict(DEFAULTS))
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_config_flow_single_entry(hass: HomeAssistant):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] == "form"
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] == "create_entry"
    assert result["options"] == DEFAULTS
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] == "abort"
    assert result["reason"] == "single_instance_allowed"


async def test_panel_and_icons(hass: HomeAssistant, stub_frontend):
    entry = await _setup(hass)
    panel = hass.data["frontend_panels"][PANEL_PATH]
    assert panel.sidebar_icon == PANEL_ICON == "proxmox_panel:logo"
    assert panel.require_admin is True
    assert any("proxmox-icons.js" in call.args[1] for call in stub_frontend.call_args_list)
    await hass.config_entries.async_unload(entry.entry_id)
    assert PANEL_PATH not in hass.data["frontend_panels"]


async def test_inventory_command(hass: HomeAssistant, hass_ws_client):
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/inventory"})
    res = await client.receive_json()
    assert res["success"]
    assert res["result"]["configured"] is False
    assert res["result"]["settings"] == DEFAULTS


async def test_administrators_only(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    # An option of 0.1.0 opened the panel to everyone: it is no longer read
    await _setup(hass, options={**DEFAULTS, "admin_only": False})
    assert hass.data["frontend_panels"][PANEL_PATH].require_admin is True
    hass_admin_user.groups = []  # no longer an administrator
    client = await hass_ws_client(hass)
    for command in ("inventory", "settings", "update_settings"):
        await client.send_json_auto_id({"type": f"{DOMAIN}/{command}"})
        res = await client.receive_json()
        assert not res["success"] and res["error"]["code"] == "unauthorized", command


async def test_update_settings(hass: HomeAssistant, hass_ws_client):
    entry = await _setup(hass, options={**DEFAULTS, "admin_only": False})
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/update_settings", "show_stopped": False})
    res = await client.receive_json()
    assert res["success"] and res["result"]["ok"]
    await hass.async_block_till_done()
    assert dict(entry.options) == {**DEFAULTS, "show_stopped": False}
    assert hass.data["frontend_panels"][PANEL_PATH].require_admin is True

    await client.send_json_auto_id({"type": f"{DOMAIN}/settings"})
    res = await client.receive_json()
    assert res["result"]["settings"] == {**DEFAULTS, "show_stopped": False}

    for bad in ({"admin_only": False}, {"unknown": True}):
        await client.send_json_auto_id({"type": f"{DOMAIN}/update_settings", **bad})
        res = await client.receive_json()
        assert not res["success"], bad


async def test_cards_command_for_every_user(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    await _setup(hass, options={**DEFAULTS, "confirm_actions": False})
    hass_admin_user.groups = []  # not an administrator: the cards still read the inventory
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/cards"})
    res = await client.receive_json()
    assert res["success"]
    assert res["result"]["configured"] is False
    assert res["result"]["confirm_actions"] is False
    assert "settings" not in res["result"]


async def test_cards_resource_and_files(hass: HomeAssistant, hass_client):
    entry = await _setup(hass)
    resources = hass.data["lovelace"].resources
    await resources.async_get_info()
    assert [item["url"] for item in resources.async_items()] == [f"{CARDS_URL}?v={VERSION}"]
    client = await hass_client()
    for url, marker in ((CARDS_URL, f'PROXMOX_CARDS_VERSION = "{VERSION}"'), (COMMON_URL, "export const proxmoxRing")):
        resp = await client.get(url)
        assert resp.status == 200
        assert marker in await resp.text()
    # An older version is replaced, a duplicate removed
    first = resources.async_items()[0]["id"]
    await resources.async_update_item(first, {"res_type": "module", "url": f"{CARDS_URL}?v=0.0.1"})
    await resources.async_create_item({"res_type": "module", "url": f"{CARDS_URL}?v=0.0.2"})
    hass.data["proxmox_panel_cards_loaded"] = False
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert [item["url"] for item in resources.async_items()] == [f"{CARDS_URL}?v={VERSION}"]
    # Removed with the entry
    await hass.config_entries.async_remove(entry.entry_id)
    assert not list(resources.async_items())
