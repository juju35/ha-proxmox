// Entry point: the modules in their original order. scripts/build-frontend.mjs (scripts/bundle.mjs) concatenates them
// in this order into the single module the integration serves.
import "./core.js";
import "./card-picker.js";
import "./constants.js";
import "./inventory.js";
import "./illustrated-header.js";
import "./base-card.js";
import "./zoom-mini-cards.js";
import "./node-card.js";
import "./machine-card.js";
import "./editors.js";
import "./register.js";
// The assembled module's own exports (the other `export`s only join the modules)
export { PROXMOX_CARDS_VERSION } from "./constants.js";
export { loadInventory, resetInventory } from "./inventory.js";
export { ProxmoxCard, ProxmoxMiniCard } from "./node-card.js";
export { ProxmoxGuestCard, ProxmoxGuestMiniCard } from "./machine-card.js";
