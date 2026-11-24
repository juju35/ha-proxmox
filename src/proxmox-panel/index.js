// Entry point: the modules in their original order. scripts/build-frontend.mjs (scripts/bundle.mjs) concatenates them
// in this order into the single module the integration serves.
import "./core.js";
import "./fold-css.js";
import "./fold.js";
import "./panel.js";
// The assembled module's own exports (the other `export`s only join the modules)
export { PROXMOX_PANEL_VERSION } from "./core.js";
export { ProxmoxPanel } from "./panel.js";
