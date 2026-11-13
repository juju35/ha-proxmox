// Imports the panel and the cards (ES modules) with just enough browser stubs to define their elements.
const defined = new Map();
globalThis.HTMLElement ??= class {
  attachShadow() {
    const listeners = [];
    this.shadowRoot = {
      innerHTML: "",
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      addEventListener: (type, fn) => listeners.push([type, fn]),
    };
    return this.shadowRoot;
  }
  dispatchEvent(ev) {
    (this.events ||= []).push(ev);
  }
};
globalThis.customElements ??= { get: (n) => defined.get(n), define: (n, c) => defined.set(n, c) };
globalThis.CustomEvent ??= class {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};
globalThis.history ??= { replaceState() {}, pushState() {} };
globalThis.window ??= { dispatchEvent() {}, addEventListener() {}, removeEventListener() {}, customCards: [] };
globalThis.document ??= { addEventListener() {}, removeEventListener() {}, createElement: () => ({ addEventListener() {}, appendChild() {} }) };

const base = new URL("../custom_components/proxmox_panel/frontend/", import.meta.url);
export const common = await import(new URL("proxmox-common.js", base));
export const panel = await import(new URL("proxmox-panel.js", base));
export const cards = await import(new URL("proxmox-cards.js", base));
