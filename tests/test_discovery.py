"""The inventory read from the device and entity registries of the Proxmox VE integration."""

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.proxmox_panel.discovery import async_inventory, parse_identifier, slot_of

PROXMOX = "proxmoxve"


def _device(hass, entry, identifier, name, via=None):
    return dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={(PROXMOX, f"{entry.entry_id}_{identifier}")},
        name=name,
        via_device=(PROXMOX, f"{entry.entry_id}_{via}") if via else None,
        configuration_url="https://192.168.1.10:8006/",
    )


def _entity(hass, entry, device, domain, unique, disabled=False):
    return er.async_get(hass).async_get_or_create(
        domain,
        PROXMOX,
        f"{entry.entry_id}_{unique}",
        config_entry=entry,
        device_id=device.id,
        disabled_by=er.RegistryEntryDisabler.INTEGRATION if disabled else None,
    )


def test_parse_identifier():
    assert parse_identifier("abc", "abc_node_node/pve1") == ("node", "node/pve1")
    assert parse_identifier("abc", "abc_vm_100") == ("vm", "100")
    assert parse_identifier("abc", "abc_container_200") == ("container", "200")
    assert parse_identifier("abc", "abc_storage_local-lvm") == ("storage", "local-lvm")
    assert parse_identifier("abc", "other_vm_100") is None
    assert parse_identifier("abc", "abc_disk_1") is None
    assert parse_identifier("abc", "abc_vm") is None


def test_slot_of_matches_the_longest_key_per_domain():
    assert slot_of("vm", "sensor", "e_100_vm_status") == "status"
    assert slot_of("vm", "binary_sensor", "e_100_status") == "running"
    assert slot_of("node", "binary_sensor", "e_node/pve1_node_backup_status") == "backup_problem"
    assert slot_of("node", "binary_sensor", "e_node/pve1_status") == "running"
    assert slot_of("node", "sensor", "e_node/pve1_node_memory_percentage") == "memory_pct"
    assert slot_of("node", "sensor", "e_node/pve1_node_max_memory") == "max_memory"
    assert slot_of("container", "button", "e_200_snapshot_create") == "snapshot_create"
    assert slot_of("container", "button", "e_200_hibernate") is None
    assert slot_of("storage", "sensor", "e_pve1_local_storage_used_percentage") == "used_pct"
    assert slot_of("vm", "sensor", "e_100_something_else") is None


async def test_inventory(hass: HomeAssistant):
    assert async_inventory(hass).as_dict()["configured"] is False

    entry = MockConfigEntry(domain=PROXMOX, title="192.168.1.10", state=ConfigEntryState.LOADED)
    entry.add_to_hass(hass)
    node = _device(hass, entry, "node_node/pve1", "pve1")
    for domain, unique in (
        ("sensor", "node/pve1_node_cpu"),
        ("sensor", "node/pve1_node_memory_percentage"),
        ("binary_sensor", "node/pve1_status"),
        ("button", "node/pve1_start_all"),
        ("update", "node/pve1_node_update"),
    ):
        _entity(hass, entry, node, domain, unique)
    _entity(hass, entry, node, "sensor", "node/pve1_node_backup_last_backup", disabled=True)
    vm101 = _device(hass, entry, "vm_101", "win11", via="node_node/pve1")
    vm100 = _device(hass, entry, "vm_100", "homeassistant", via="node_node/pve1")
    for unique in ("100_vm_cpu", "100_vm_status"):
        _entity(hass, entry, vm100, "sensor", unique)
    _entity(hass, entry, vm100, "binary_sensor", "100_status")
    _entity(hass, entry, vm100, "button", "100_shutdown")
    _entity(hass, entry, vm101, "button", "101_start")
    ct = _device(hass, entry, "container_200", "nginx", via="node_node/pve1")
    _entity(hass, entry, ct, "button", "200_restart")
    storage = _device(hass, entry, "storage_local-lvm", "Storage (local-lvm)", via="node_node/pve1")
    _entity(hass, entry, storage, "sensor", "pve1_local-lvm_storage_used_percentage")
    _entity(hass, entry, storage, "binary_sensor", "pve1_local-lvm_storage_active")
    # A device of another integration on the same entry is left out
    dr.async_get(hass).async_get_or_create(config_entry_id=entry.entry_id, identifiers={("other", "x")}, name="x")

    inv = async_inventory(hass).as_dict()
    assert inv["configured"] is True
    assert inv["entries"] == [{"entry_id": entry.entry_id, "title": "192.168.1.10", "state": "loaded", "loaded": True}]
    [n] = inv["node"]
    assert n["name"] == "pve1" and n["key"] == "node/pve1" and n["node"] is None
    assert set(n["entities"]) == {"cpu", "memory_pct", "running", "start_all", "update"}
    assert n["entities"]["running"].startswith("binary_sensor.")
    assert n["disabled"] == ["last_backup"]
    assert [v["key"] for v in inv["vm"]] == ["100", "101"]  # by vmid
    vm = inv["vm"][0]
    assert vm["node"] == node.id
    assert set(vm["entities"]) == {"cpu", "status", "running", "shutdown"}
    assert vm["entities"]["status"].startswith("sensor.")
    assert list(inv["container"][0]["entities"]) == ["restart"]
    assert inv["storage"][0]["key"] == "local-lvm"
    assert set(inv["storage"][0]["entities"]) == {"used_pct", "active"}
