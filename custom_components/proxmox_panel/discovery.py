"""What the Proxmox VE integration offers, read from the device and entity registries.

The core ``proxmoxve`` integration makes one device per node, virtual machine, container and storage, with these
identifiers (``<entry>`` is its config entry id):

- ``<entry>_node_<node id>`` (the node id is Proxmox's, e.g. ``node/pve1``);
- ``<entry>_vm_<vmid>``, ``<entry>_container_<vmid>``;
- ``<entry>_storage_<storage>``.

Each entity's unique id ends with the key of its description (``node_cpu``, ``vm_memory``, ``start``…). The panel
gets, per device, the entity id of each "slot" it shows (``cpu``, ``memory``, ``running``, ``start``…) and the slots
whose entity is disabled (the backup sensors are disabled by default), so that it can say how to enable them.
Nothing here talks to Proxmox: the panel reads the states, and acts by pressing the integration's buttons.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import PROXMOX_DOMAIN

# Per kind of device and entity domain: the description keys of the proxmoxve integration and the panel's slot for
# each. A key is matched as the end of the unique id, the longest first (``vm_status`` before ``status``).
SLOTS: dict[str, dict[str, dict[str, str]]] = {
    "node": {
        "sensor": {
            "node_cpu": "cpu",
            "node_max_cpu": "max_cpu",
            "node_memory": "memory",
            "node_max_memory": "max_memory",
            "node_memory_percentage": "memory_pct",
            "node_disk": "disk",
            "node_max_disk": "max_disk",
            "node_uptime": "uptime",
            "node_status": "status",
            "node_backup_last_backup": "last_backup",
            "node_backup_duration": "backup_duration",
        },
        "binary_sensor": {"status": "running", "node_backup_status": "backup_problem"},
        "button": {
            "reboot": "reboot",
            "shutdown": "shutdown",
            "start_all": "start_all",
            "stop_all": "stop_all",
            "suspend_all": "suspend_all",
        },
        "update": {"node_update": "update"},
    },
    "vm": {
        "sensor": {
            "vm_cpu": "cpu",
            "vm_max_cpu": "max_cpu",
            "vm_memory": "memory",
            "vm_max_memory": "max_memory",
            "vm_memory_percentage": "memory_pct",
            "vm_disk": "disk",
            "vm_max_disk": "max_disk",
            "vm_uptime": "uptime",
            "vm_status": "status",
            "vm_netin": "netin",
            "vm_netout": "netout",
        },
        "binary_sensor": {"status": "running"},
        "button": {
            key: key
            for key in (
                "start",
                "stop",
                "restart",
                "pause",
                "hibernate",
                "resume",
                "reset",
                "shutdown",
                "snapshot_create",
            )
        },
    },
    "container": {
        "sensor": {
            "container_cpu": "cpu",
            "container_max_cpu": "max_cpu",
            "container_memory": "memory",
            "container_max_memory": "max_memory",
            "container_memory_percentage": "memory_pct",
            "container_disk": "disk",
            "container_max_disk": "max_disk",
            "container_uptime": "uptime",
            "container_status": "status",
            "container_netin": "netin",
            "container_netout": "netout",
        },
        "binary_sensor": {"status": "running"},
        "button": {key: key for key in ("start", "stop", "restart", "snapshot_create")},
    },
    "storage": {
        "sensor": {
            "storage_used": "used",
            "storage_total": "total",
            "storage_available": "available",
            "storage_used_percentage": "used_pct",
        },
        "binary_sensor": {"storage_active": "active", "storage_enabled": "enabled", "storage_shared": "shared"},
    },
}
KINDS = tuple(SLOTS)


@dataclass
class Item:
    """A node, virtual machine, container or storage of Proxmox VE, as the panel shows it."""

    id: str  # device id in Home Assistant
    kind: str
    name: str
    entry_id: str
    key: str  # node id, vmid or storage name, as in the device identifier
    node: str | None = None  # device id of the node it belongs to
    url: str | None = None
    entities: dict[str, str] = field(default_factory=dict)
    disabled: list[str] = field(default_factory=list)


@dataclass
class Inventory:
    """Everything the panel lists, with the state of the Proxmox VE entries."""

    configured: bool = False
    entries: list[dict[str, Any]] = field(default_factory=list)
    node: list[Item] = field(default_factory=list)
    vm: list[Item] = field(default_factory=list)
    container: list[Item] = field(default_factory=list)
    storage: list[Item] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def parse_identifier(entry_id: str, identifier: str) -> tuple[str, str] | None:
    """(kind, key) of a proxmoxve device identifier of this entry, or None."""
    prefix = f"{entry_id}_"
    if not identifier.startswith(prefix):
        return None
    kind, sep, key = identifier[len(prefix) :].partition("_")
    if not sep or not key or kind not in KINDS:
        return None
    return kind, key


def slot_of(kind: str, domain: str, unique_id: str) -> str | None:
    """The panel's slot for an entity of a device of this kind, from the end of its unique id."""
    keys = SLOTS.get(kind, {}).get(domain, {})
    for key in sorted(keys, key=len, reverse=True):
        if unique_id == key or unique_id.endswith(f"_{key}"):
            return keys[key]
    return None


def _sort_key(item: Item) -> tuple:
    if item.kind in ("vm", "container") and item.key.isdigit():
        return (0, int(item.key), item.name.lower())
    return (1, 0, item.name.lower())


@callback
def async_inventory(hass: HomeAssistant) -> Inventory:
    """The nodes, virtual machines, containers and storages of every Proxmox VE entry, with their entities."""
    inventory = Inventory()
    entries = hass.config_entries.async_entries(PROXMOX_DOMAIN)
    inventory.configured = bool(entries)
    devices = dr.async_get(hass)
    entities = er.async_get(hass)
    for entry in entries:
        inventory.entries.append(
            {
                "entry_id": entry.entry_id,
                "title": entry.title,
                "state": entry.state.value,
                "loaded": entry.state is ConfigEntryState.LOADED,
            }
        )
        for device in dr.async_entries_for_config_entry(devices, entry.entry_id):
            parsed = next(
                (
                    p
                    for domain, identifier in device.identifiers
                    if domain == PROXMOX_DOMAIN and (p := parse_identifier(entry.entry_id, identifier))
                ),
                None,
            )
            if parsed is None:
                continue
            kind, key = parsed
            item = Item(
                id=device.id,
                kind=kind,
                name=device.name_by_user or device.name or key,
                entry_id=entry.entry_id,
                key=key,
                node=device.via_device_id,
                url=device.configuration_url,
            )
            for ent in er.async_entries_for_device(entities, device.id, include_disabled_entities=True):
                if ent.platform != PROXMOX_DOMAIN:
                    continue
                slot = slot_of(kind, ent.domain, ent.unique_id)
                if slot is None:
                    continue
                if ent.disabled_by is not None:
                    item.disabled.append(slot)
                else:
                    item.entities[slot] = ent.entity_id
            getattr(inventory, kind).append(item)
    for kind in KINDS:
        getattr(inventory, kind).sort(key=_sort_key)
        for item in getattr(inventory, kind):
            item.disabled.sort()
    return inventory
