// ── Registration ──
import { pickerDefine } from "./card-picker.js";
import { PROXMOX_CARDS_VERSION } from "./constants.js";
import { ProxmoxCard, ProxmoxMiniCard } from "./node-card.js";
import { ProxmoxGuestCard, ProxmoxGuestMiniCard } from "./machine-card.js";
import { ProxmoxCardEditor, ProxmoxGuestCardEditor, ProxmoxGuestMiniCardEditor, ProxmoxMiniCardEditor } from "./editors.js";

export const define = (name, cls) => {
  if (!customElements.get(name)) pickerDefine(name, cls);
};
define("proxmox-card", ProxmoxCard);
define("proxmox-mini-card", ProxmoxMiniCard);
define("proxmox-guest-card", ProxmoxGuestCard);
define("proxmox-guest-mini-card", ProxmoxGuestMiniCard);
define("proxmox-card-editor", ProxmoxCardEditor);
define("proxmox-mini-card-editor", ProxmoxMiniCardEditor);
define("proxmox-guest-card-editor", ProxmoxGuestCardEditor);
define("proxmox-guest-mini-card-editor", ProxmoxGuestMiniCardEditor);

if (typeof window !== "undefined") {
  window.customCards = window.customCards || [];
  for (const card of [
    { type: "proxmox-card", name: "Proxmox Card", description: "A Proxmox VE node: CPU, RAM and disk, its virtual machines, containers and storage." },
    { type: "proxmox-mini-card", name: "Proxmox Mini Card", description: "Your Proxmox VE nodes on one line each, opening the full card." },
    { type: "proxmox-guest-card", name: "Proxmox Machine Card", description: "A Proxmox VE virtual machine or container: status, CPU, RAM, disk, network and actions." },
    { type: "proxmox-guest-mini-card", name: "Proxmox Machine Mini Card", description: "Proxmox VE virtual machines or containers on one line each, opening the full card." },
  ]) {
    if (!window.customCards.some((c) => c.type === card.type))
      window.customCards.push({ ...card, preview: true, documentationURL: "https://github.com/juju35/ha-proxmox" });
  }
  console.info(`%c PROXMOX-CARDS %c v${PROXMOX_CARDS_VERSION} `, "color: white; background: #e57000; font-weight: 700;", "color: #e57000; background: white; font-weight: 700;");
}
