"""The inventory read from the Proxmox Extended Sensors integration (juju35/ha-proxmox#14)."""

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.proxmox_panel.discovery import (
    async_inventory,
    parse_sensors_identifier,
    sensors_slot_of,
)

SENSORS = "proxmox_sensors"


def _device(hass, entry, identifier, name, via=None):
    registry = dr.async_get(hass)
    device = registry.async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={(SENSORS, identifier)},
        name=name,
        configuration_url="https://192.168.1.10:8006/",
    )
    return registry.async_update_device(device.id, via_device_id=via.id) if via else device


def _entity(hass, entry, device, domain, unique, translation_key, disabled=False):
    return er.async_get(hass).async_get_or_create(
        domain,
        SENSORS,
        unique,
        config_entry=entry,
        device_id=device.id,
        translation_key=translation_key,
        disabled_by=er.RegistryEntryDisabler.INTEGRATION if disabled else None,
    )


def test_parse_sensors_identifier():
    # Guests end with the vmid and _v1, in the node or the cluster scope
    assert parse_sensors_identifier("proxmox_vm_pve1_100_v1") == ("vm", "100")
    assert parse_sensors_identifier("proxmox_vm_cluster_abcd_100_v1") == ("vm", "100")
    assert parse_sensors_identifier("proxmox_ct_pve1_200_v1") == ("container", "200")
    # The others are known prefixes
    assert parse_sensors_identifier("proxmox_node_pve1")[0] == "node"
    assert parse_sensors_identifier("proxmox_node_uuid_pve1")[0] == "node"
    assert parse_sensors_identifier("proxmox_storage_uuid_pve1_local")[0] == "storage"
    assert parse_sensors_identifier("proxmox_physical_disk_v2_wwn123")[0] == "disk"
    assert parse_sensors_identifier("proxmox_disks_group_pve1")[0] == "disk"
    assert parse_sensors_identifier("pbs_datastore:srv:store")[0] == "pbs"
    assert parse_sensors_identifier("datastore_store")[0] == "pbs"
    assert parse_sensors_identifier("pbs_server_srv") is None
    assert parse_sensors_identifier("proxmox_cluster_entry") is None


def test_sensors_slot_of():
    assert sensors_slot_of("node", "sensor", "node_cpu") == "cpu"
    assert sensors_slot_of("node", "sensor", "node_memory_usage") == "memory_pct"
    assert sensors_slot_of("node", "sensor", "node_rootfs_usage") == "disk_pct"
    assert sensors_slot_of("node", "sensor", "cpu_temperature") == "temperature"
    assert sensors_slot_of("node", "sensor", "node_score") == "health_score"
    assert sensors_slot_of("node", "binary_sensor", "node_overloaded") == "overloaded"
    assert sensors_slot_of("vm", "sensor", "vm_status") == "status"
    assert sensors_slot_of("vm", "sensor", "vm_memory_used") == "memory"
    assert sensors_slot_of("vm", "button", "vm_reboot") == "restart"
    assert sensors_slot_of("vm", "button", "vm_shutdown") == "shutdown"
    assert sensors_slot_of("container", "sensor", "ct_disk_used") == "disk"
    assert sensors_slot_of("container", "button", "ct_reset") is None  # not a CT command
    assert sensors_slot_of("storage", "sensor", "storage_usage") == "used_pct"
    assert sensors_slot_of("disk", "sensor", "disk_smart_status") == "health"
    assert sensors_slot_of("disk", "sensor", "disk_temperature_c") == "temperature"
    assert sensors_slot_of("pbs", "sensor", "pbs_datastore_usage") == "used_pct"
    assert sensors_slot_of("node", "sensor", None) is None
    assert sensors_slot_of("vm", "sensor", "vm_unknown") is None


async def test_inventory_extended_sensors(hass: HomeAssistant):
    entry = MockConfigEntry(domain=SENSORS, title="Proxmox pve1", state=ConfigEntryState.LOADED)
    entry.add_to_hass(hass)

    node = _device(hass, entry, "proxmox_node_uuid_pve1", "1. Node: pve1")
    for domain, unique, key in (
        ("sensor", "pve_uuid_proxmox_node_pve1_cpu", "node_cpu"),
        ("sensor", "pve_uuid_proxmox_node_pve1_memory_usage", "node_memory_usage"),
        ("sensor", "pve_uuid_proxmox_node_pve1_rootfs", "node_rootfs_usage"),
        ("sensor", "pve_uuid_proxmox_cpu_temp_pve1", "cpu_temperature"),
        ("sensor", "pve_uuid_proxmox_node_pve1_score", "node_score"),
        ("sensor", "pve_uuid_proxmox_node_pve1_iowait", "node_iowait"),
        ("binary_sensor", "uuid_node_overloaded_pve1", "node_overloaded"),
        ("binary_sensor", "uuid_node_stressed_pve1", "node_stressed"),
    ):
        _entity(hass, entry, node, domain, unique, key)

    vm = _device(hass, entry, "proxmox_vm_pve1_100_v1", "homeassistant", via=node)
    for domain, unique, key in (
        ("sensor", "pve_uuid_proxmox_vm_pve1_100_status_v1", "vm_status"),
        ("sensor", "pve_uuid_proxmox_vm_pve1_100_cpu_usage_v1", "vm_cpu_usage"),
        ("sensor", "pve_uuid_proxmox_vm_pve1_100_memory_used_v1", "vm_memory_used"),
        ("sensor", "pve_uuid_proxmox_vm_pve1_100_memory_total_v1", "vm_memory_total"),
        ("button", "proxmox_vm_pve1_100_shutdown", "vm_shutdown"),
        ("button", "proxmox_vm_pve1_100_reboot", "vm_reboot"),
    ):
        _entity(hass, entry, vm, domain, unique, key)

    ct = _device(hass, entry, "proxmox_ct_pve1_200_v1", "nginx", via=node)
    _entity(hass, entry, ct, "sensor", "pve_uuid_proxmox_ct_pve1_200_status_v1", "ct_status")
    _entity(hass, entry, ct, "button", "proxmox_ct_pve1_200_start", "ct_start")

    storage = _device(hass, entry, "proxmox_storage_uuid_pve1_local", "local", via=node)
    _entity(hass, entry, storage, "sensor", "pve_uuid_proxmox_storage_pve1_local", "storage_usage")

    disk = _device(hass, entry, "proxmox_physical_disk_v2_wwn1", "2. SSD Samsung 1 TB", via=node)
    _entity(hass, entry, disk, "sensor", "wwn1_smart_status", "disk_smart_status")
    _entity(hass, entry, disk, "sensor", "wwn1_temperature_c", "disk_temperature_c")

    pbs = _device(hass, entry, "pbs_datastore:srv:store", "Datastore: store")
    _entity(hass, entry, pbs, "sensor", "pbs_srv_store_usage", "pbs_datastore_usage")
    _entity(hass, entry, pbs, "sensor", "pbs_srv_store_last_backup", "pbs_last_backup_time")

    inv = async_inventory(hass).as_dict()
    assert inv["configured"] is True
    assert inv["entries"][0]["source"] == "sensors"

    [n] = inv["node"]
    assert n["name"] == "pve1" and n["key"] == "pve1" and n["source"] == "sensors"
    assert set(n["entities"]) == {
        "cpu", "memory_pct", "disk_pct", "temperature", "health_score", "io_wait", "overloaded", "stressed"
    }

    [v] = inv["vm"]
    assert v["key"] == "100" and v["node"] == node.id
    assert set(v["entities"]) == {"status", "cpu", "memory", "max_memory", "shutdown", "restart"}

    [c] = inv["container"]
    assert c["key"] == "200" and set(c["entities"]) == {"status", "start"}

    [s] = inv["storage"]
    assert s["name"] == "local" and s["node"] == node.id and set(s["entities"]) == {"used_pct"}

    [d] = inv["disk"]
    assert d["name"] == "SSD Samsung 1 TB" and set(d["entities"]) == {"health", "temperature"}

    [p] = inv["pbs"]
    assert p["name"] == "Datastore: store" and set(p["entities"]) == {"used_pct", "last_backup"}
