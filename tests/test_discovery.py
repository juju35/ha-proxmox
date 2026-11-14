"""The inventory read from the device and entity registries of the Proxmox VE integration."""

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.proxmox_panel.discovery import async_inventory, custom_slot_of, parse_identifier, slot_of

PROXMOX = "proxmoxve"


def _device(hass, entry, identifier, name, via=None):
    registry = dr.async_get(hass)
    device = registry.async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={(PROXMOX, f"{entry.entry_id}_{identifier}")},
        name=name,
        configuration_url="https://192.168.1.10:8006/",
    )
    # The node it belongs to (async_get_or_create only takes via_device_id since Home Assistant 2026.10)
    return registry.async_update_device(device.id, via_device_id=via.id) if via else device


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
    assert parse_identifier("abc", "abc_node_node/pve1") == ("node", "node/pve1", False)
    assert parse_identifier("abc", "abc_vm_100") == ("vm", "100", False)
    assert parse_identifier("abc", "abc_container_200") == ("container", "200", False)
    assert parse_identifier("abc", "abc_storage_local-lvm") == ("storage", "local-lvm", False)
    assert parse_identifier("abc", "other_vm_100") is None
    assert parse_identifier("abc", "abc_disk_1") is None
    assert parse_identifier("abc", "abc_vm") is None
    # The custom Proxmox VE integration: kinds in upper case (#12)
    assert parse_identifier("abc", "abc_NODE_pve") == ("node", "pve", True)
    assert parse_identifier("abc", "abc_QEMU_100") == ("vm", "100", True)
    assert parse_identifier("abc", "abc_LXC_200") == ("container", "200", True)
    assert parse_identifier("abc", "abc_STORAGE_local-lvm") == ("storage", "local-lvm", True)
    assert parse_identifier("abc", "abc_DISK_pve_sda") is None


def test_custom_slot_of():
    assert custom_slot_of("e", "node", "pve", "sensor", "e_pve_cpu") == "cpu"
    assert custom_slot_of("e", "node", "pve", "sensor", "e_pve_memory_used_perc") == "memory_pct"
    assert custom_slot_of("e", "node", "pve", "binary_sensor", "e_pve_status") == "running"
    # The backup status of a node is not its running state
    assert custom_slot_of("e", "node", "pve", "binary_sensor", "e_backup_pve_status") == "backup_problem"
    assert custom_slot_of("e", "node", "pve", "sensor", "e_backup_pve_finished") == "last_backup"
    assert custom_slot_of("e", "node", "pve", "sensor", "e_replication_pve_status") is None
    assert custom_slot_of("e", "node", "pve", "button", "e_pve_startall") == "start_all"
    assert custom_slot_of("e", "vm", "100", "sensor", "e_100_status_raw") == "status"
    assert custom_slot_of("e", "vm", "100", "button", "e_100_reboot") == "restart"
    assert custom_slot_of("e", "container", "200", "sensor", "e_200_cpu") == "cpu"
    assert custom_slot_of("e", "storage", "local", "sensor", "e_local_disk_used_perc") == "used_pct"
    assert custom_slot_of("e", "storage", "local", "sensor", "e_storage/local_disk_used_perc") == "used_pct"
    assert custom_slot_of("e", "vm", "100", "sensor", "e_100_pressure_cpu_some") is None


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
    vm101 = _device(hass, entry, "vm_101", "win11", via=node)
    vm100 = _device(hass, entry, "vm_100", "homeassistant", via=node)
    for unique in ("100_vm_cpu", "100_vm_status"):
        _entity(hass, entry, vm100, "sensor", unique)
    _entity(hass, entry, vm100, "binary_sensor", "100_status")
    _entity(hass, entry, vm100, "button", "100_shutdown")
    _entity(hass, entry, vm101, "button", "101_start")
    ct = _device(hass, entry, "container_200", "nginx", via=node)
    _entity(hass, entry, ct, "button", "200_restart")
    storage = _device(hass, entry, "storage_local-lvm", "Storage (local-lvm)", via=node)
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


async def test_inventory_custom_integration(hass: HomeAssistant):
    entry = MockConfigEntry(domain=PROXMOX, title="pve", state=ConfigEntryState.LOADED)
    entry.add_to_hass(hass)
    node = _device(hass, entry, "NODE_pve", "Node pve")
    for domain, unique in (
        ("sensor", "pve_cpu"),
        ("sensor", "pve_memory_used_perc"),
        ("sensor", "pve_disk_used"),
        ("binary_sensor", "pve_status"),
        ("binary_sensor", "backup_pve_status"),
        ("sensor", "backup_pve_finished"),
        ("button", "pve_reboot"),
    ):
        _entity(hass, entry, node, domain, unique)
    vm = _device(hass, entry, "QEMU_100", "homeassistant", via=node)
    _entity(hass, entry, vm, "sensor", "100_cpu")
    _entity(hass, entry, vm, "sensor", "100_status_raw")
    ct = _device(hass, entry, "LXC_200", "nginx", via=node)
    _entity(hass, entry, ct, "button", "200_start")
    storage = _device(hass, entry, "STORAGE_local", "Storage local", via=node)
    _entity(hass, entry, storage, "sensor", "local_disk_used_perc")

    inv = async_inventory(hass).as_dict()
    [n] = inv["node"]
    assert n["key"] == "pve"
    assert set(n["entities"]) == {"cpu", "memory_pct", "disk", "running", "backup_problem", "last_backup", "reboot"}
    assert n["entities"]["running"] != n["entities"]["backup_problem"]
    assert set(inv["vm"][0]["entities"]) == {"cpu", "status"} and inv["vm"][0]["node"] == node.id
    assert list(inv["container"][0]["entities"]) == ["start"]
    assert list(inv["storage"][0]["entities"]) == ["used_pct"]
