// Mock Home Assistant states of a Proxmox VE server (one node, a few virtual machines and containers, three
// storages) and the panel's inventory of them, for the README screenshots. Neutral names only.
export const NOW = Date.UTC(2026, 10, 12, 20, 30);
const ago = (s) => new Date(NOW - s * 1000).toISOString();
const GiB = 1024 ** 3;

const states = {};
const set = (id, state, attributes = {}) => {
  states[id] = { entity_id: id, state: String(state), attributes };
};
const gib = (id, bytes) => set(id, (bytes / GiB).toFixed(3), { unit_of_measurement: "GiB", device_class: "data_size" });

// Node pve1
set("sensor.pve1_cpu_usage", 23.4, { unit_of_measurement: "%" });
set("sensor.pve1_max_cpu", 8);
gib("sensor.pve1_memory_usage", 19.8 * GiB);
gib("sensor.pve1_max_memory_usage", 31.9 * GiB);
set("sensor.pve1_memory_usage_percentage", 62.1, { unit_of_measurement: "%" });
gib("sensor.pve1_disk_usage", 38.2 * GiB);
gib("sensor.pve1_max_disk_usage", 93.9 * GiB);
set("sensor.pve1_uptime", ago(12 * 86400 + 5 * 3600));
set("sensor.pve1_status", "online");
set("binary_sensor.pve1_status", "on");
set("sensor.pve1_last_backup", ago(17 * 3600 + 30 * 60));
set("sensor.pve1_backup_duration", 14.2, { unit_of_measurement: "min" });
set("binary_sensor.pve1_backup_status", "off");
set("update.pve1_software_update", "on", { installed_version: "9.1.2", latest_version: "9.1.4" });
for (const b of ["restart", "shut_down", "start_all", "stop_all", "suspend_all"]) set(`button.pve1_${b}`, "unknown");

const guests = [
  // kind, vmid, name, status, cpu %, mem %, mem GiB, max mem GiB, disk GiB, max disk GiB, in GiB, out GiB, uptime s
  ["vm", 100, "homeassistant", "running", 6.1, 48.2, 3.9, 8, 18.4, 32, 182.3, 41.7, 3 * 86400 + 4 * 3600],
  ["vm", 101, "win11", "stopped", 0, 0, 0, 16, 0, 128, 0, 0, 0],
  ["vm", 102, "docker-host", "running", 31.4, 77.3, 6.2, 8, 22.1, 64, 524.8, 97.2, 12 * 86400],
  ["vm", 103, "router-lab", "suspended", 0, 31.0, 0.6, 2, 1.8, 8, 3.2, 2.9, 0],
  ["container", 200, "nginx-proxy", "running", 1.8, 18.3, 0.09, 0.5, 1.1, 4, 64.2, 70.1, 12 * 86400],
  ["container", 201, "adguard", "running", 1.2, 22.4, 0.11, 0.5, 0.9, 4, 12.4, 10.8, 12 * 86400],
  ["container", 202, "jellyfin", "running", 12.7, 41.6, 1.66, 4, 7.2, 16, 3.1, 420.5, 6 * 86400],
  ["container", 203, "mqtt", "running", 0.4, 9.1, 0.02, 0.25, 0.4, 2, 1.2, 1.4, 12 * 86400],
  ["container", 204, "backup-sync", "running", 3.3, 12.8, 0.06, 0.5, 2.3, 8, 48.9, 950.3, 2 * 86400],
  ["container", 205, "test-debian", "stopped", 0, 0, 0, 1, 0, 8, 0, 0, 0],
];
const VM_BUTTONS = ["start", "stop", "restart", "pause", "hibernate", "resume", "reset", "shutdown", "snapshot_create"];
const CT_BUTTONS = ["start", "stop", "restart", "snapshot_create"];
const items = { node: [], vm: [], container: [], storage: [] };

items.node.push({
  id: "dev_pve1", kind: "node", name: "pve1", entry_id: "e1", key: "node/pve1", node: null, url: "https://192.168.1.10:8006/#v1:0:=node/pve1",
  entities: {
    cpu: "sensor.pve1_cpu_usage", max_cpu: "sensor.pve1_max_cpu", memory: "sensor.pve1_memory_usage", max_memory: "sensor.pve1_max_memory_usage",
    memory_pct: "sensor.pve1_memory_usage_percentage", disk: "sensor.pve1_disk_usage", max_disk: "sensor.pve1_max_disk_usage", uptime: "sensor.pve1_uptime",
    status: "sensor.pve1_status", running: "binary_sensor.pve1_status", last_backup: "sensor.pve1_last_backup", backup_duration: "sensor.pve1_backup_duration",
    backup_problem: "binary_sensor.pve1_backup_status", update: "update.pve1_software_update", reboot: "button.pve1_restart", shutdown: "button.pve1_shut_down",
    start_all: "button.pve1_start_all", stop_all: "button.pve1_stop_all", suspend_all: "button.pve1_suspend_all",
  },
  disabled: [],
});

for (const [kind, vmid, name, status, cpu, memPct, mem, maxMem, disk, maxDisk, netin, netout, up] of guests) {
  const p = `${kind === "vm" ? "vm" : "ct"}_${name.replace(/-/g, "_")}`;
  const on = status === "running";
  set(`sensor.${p}_cpu_usage`, on ? cpu : 0, { unit_of_measurement: "%" });
  set(`sensor.${p}_max_cpu`, kind === "vm" ? 4 : 2);
  gib(`sensor.${p}_memory_usage`, mem * GiB);
  gib(`sensor.${p}_max_memory_usage`, maxMem * GiB);
  set(`sensor.${p}_memory_usage_percentage`, memPct, { unit_of_measurement: "%" });
  gib(`sensor.${p}_disk_usage`, disk * GiB);
  gib(`sensor.${p}_max_disk_usage`, maxDisk * GiB);
  gib(`sensor.${p}_network_input`, netin * GiB);
  gib(`sensor.${p}_network_output`, netout * GiB);
  set(`sensor.${p}_uptime`, on ? ago(up) : "unknown");
  set(`sensor.${p}_status`, status);
  set(`binary_sensor.${p}_status`, on ? "on" : "off");
  const entities = {
    cpu: `sensor.${p}_cpu_usage`, max_cpu: `sensor.${p}_max_cpu`, memory: `sensor.${p}_memory_usage`, max_memory: `sensor.${p}_max_memory_usage`,
    memory_pct: `sensor.${p}_memory_usage_percentage`, disk: `sensor.${p}_disk_usage`, max_disk: `sensor.${p}_max_disk_usage`,
    netin: `sensor.${p}_network_input`, netout: `sensor.${p}_network_output`, uptime: `sensor.${p}_uptime`, status: `sensor.${p}_status`,
    running: `binary_sensor.${p}_status`,
  };
  for (const b of kind === "vm" ? VM_BUTTONS : CT_BUTTONS) entities[b] = `button.${p}_${b}`;
  items[kind].push({
    id: `dev_${vmid}`, kind, name, entry_id: "e1", key: String(vmid), node: "dev_pve1",
    url: `https://192.168.1.10:8006/#v1:0:=${kind === "vm" ? "qemu" : "lxc"}/${vmid}`, entities, disabled: [],
  });
}

const storages = [
  // name, used GiB, total GiB, active, shared
  ["local", 12.4, 93.9, true, false],
  ["local-lvm", 268.2, 372.0, true, false],
  ["nas-backup", 1433.6, 3686.4, true, true],
  ["usb-archive", null, null, false, false],
];
for (const [name, used, total, active, shared] of storages) {
  const p = `storage_${name.replace(/-/g, "_")}`;
  const entities = { active: `binary_sensor.${p}_storage_active`, enabled: `binary_sensor.${p}_storage_enabled`, shared: `binary_sensor.${p}_storage_shared` };
  set(entities.active, active ? "on" : "off");
  set(entities.enabled, "on");
  set(entities.shared, shared ? "on" : "off");
  if (used !== null) {
    Object.assign(entities, { used: `sensor.${p}_used_storage`, total: `sensor.${p}_total_storage`, available: `sensor.${p}_available_storage`, used_pct: `sensor.${p}_storage_usage_percentage` });
    gib(entities.used, used * GiB);
    gib(entities.total, total * GiB);
    gib(entities.available, (total - used) * GiB);
    set(entities.used_pct, ((used / total) * 100).toFixed(1), { unit_of_measurement: "%" });
  }
  items.storage.push({ id: `dev_st_${name}`, kind: "storage", name: `Storage (${name})`, entry_id: "e1", key: name, node: "dev_pve1", url: null, entities, disabled: [] });
}

// 24 h of CPU and RAM, every 10 minutes: a calm day with a backup at night and a busier evening
const history = {};
const curve = (base, swing, spike) =>
  Array.from({ length: 145 }, (_, i) => {
    const t = NOW - (144 - i) * 600000;
    const h = new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60;
    const night = h >= 2 && h < 3 ? spike : 0;
    const evening = h >= 17 && h < 22 ? swing : 0;
    const wobble = Math.sin(i / 3) * 2 + Math.sin(i / 11) * 3;
    return { s: String(Math.max(1, Math.min(99, base + night + evening + wobble)).toFixed(1)), lu: t / 1000 };
  });
history["sensor.pve1_cpu_usage"] = curve(14, 9, 38);
history["sensor.pve1_memory_usage_percentage"] = curve(56, 6, 12);

export const inventory = {
  configured: true,
  entries: [{ entry_id: "e1", title: "192.168.1.10", state: "loaded", loaded: true }],
  ...items,
  settings: { show_stopped: true, confirm_actions: true, hide_inactive_storage: false, show_history: true },
};
export { history, states };
