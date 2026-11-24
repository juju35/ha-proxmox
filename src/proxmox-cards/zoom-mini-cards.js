// ── Zoom of the mini cards ──
import { COLLAPSE, EXPAND } from "./constants.js";
import { inDialog, watchOutside } from "./inventory.js";
import { proxmoxPanelEsc as esc } from "../../custom_components/proxmox_panel/frontend/proxmox-common.js";

export const Zoomable = (Base) =>
  class extends Base {
    constructor() {
      super();
      this._zoomed = false;
      this._onOutside = (ev) => {
        if (this._zoomed && !ev.composedPath().includes(this) && !inDialog(ev)) this._setZoom(false);
      };
    }

    connectedCallback() {
      super.connectedCallback?.();
      this._outside ??= watchOutside(this, this._onOutside);
      this._outside.on();
      // Back on the page after leaving it zoomed: rendered again in its compact view.
      if (this._unzoomedAway) {
        this._unzoomedAway = false;
        this._update();
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback?.();
      this._outside?.off();
      // Left (another dashboard view, a conditional card hidden): back to the compact view.
      if (this._zoomed) {
        this._zoomed = false;
        this._unzoomedAway = true;
      }
    }

    getCardSize() {
      return this._zoomed ? super.getCardSize() : 3;
    }

    getGridOptions() {
      return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 };
    }

    _zoomButton(cls = "") {
      if (this._config.zoom === false) return "";
      const title = esc(this._t(this._zoomed ? "c_zoom_out" : "c_zoom_in"));
      return `<button class="zoom${cls ? ` ${cls}` : ""}" data-action="zoom" title="${title}" aria-label="${title}"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${this._zoomed ? COLLAPSE : EXPAND}"/></svg></button>`;
    }

    _setZoom(zoomed) {
      this._zoomed = zoomed;
      this._update();
      this.dispatchEvent(new Event("iron-resize", { bubbles: true, composed: true }));
    }

    _action(action, data, ev) {
      if (action === "zoom") {
        ev?.stopPropagation?.();
        this._setZoom(!this._zoomed);
        if (ev && ev.detail === 0) this.shadowRoot.querySelector(".zoom")?.focus({ preventScroll: true });
        return;
      }
      super._action(action, data, ev);
    }

    // The zoom button, in the compact and the expanded view: in the top right corner of the first banner drawn
    // (see _banner), else, without the illustration, in the card's top right corner.
    _render(inv) {
      this._zoomPending = !!this._zoomButton();
      const html = this._zoomed ? super._render(inv) : this._compact(inv);
      const plain = this._zoomPending ? this._zoomButton("plain") : "";
      this._zoomPending = false;
      return `${plain}${html}`;
    }
  };
