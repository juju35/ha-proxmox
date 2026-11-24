// ── Editors ──
import { LANGUAGE_NAMES, PROXMOX_CARDS_VERSION } from "./constants.js";
import { inventory, loadInventory } from "./inventory.js";
import { PROXMOX_PANEL_LANGS, proxmoxLang, proxmoxLoadStrings, proxmoxT } from "../../custom_components/proxmox_panel/frontend/proxmox-common.js";

export class ProxmoxEditorBase extends HTMLElement {
  static get toggles() {
    return ["illustration", "show_title", "show_subtitle"];
  }

  static get defaults() {
    return { illustration_theme: "auto" };
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first)
      Promise.all([loadInventory(hass), proxmoxLoadStrings(proxmoxLang(hass, this._config?.language), PROXMOX_CARDS_VERSION)]).then(() => {
        this._schemaKey = null;
        this._render();
      });
    this._render();
  }

  _t(key) {
    return proxmoxT(proxmoxLang(this._hass, this._config?.language), key);
  }

  _languageField() {
    return {
      name: "language",
      selector: {
        select: { mode: "dropdown", options: [{ value: "", label: this._t("e_lang_auto") }, ...PROXMOX_PANEL_LANGS.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))] },
      },
    };
  }

  _schema() {
    return [
      { name: "title", selector: { text: {} } },
      ...this._fields(),
      { type: "grid", name: "", schema: this.constructor.toggles.map((name) => ({ name, selector: { boolean: {} } })) },
      {
        name: "illustration_theme",
        selector: { select: { mode: "dropdown", options: ["auto", "day", "night"].map((v) => ({ value: v, label: this._t(`e_theme_${v}`) })) } },
      },
      this._languageField(),
    ];
  }

  _fields() {
    return [];
  }

  /** Keeps the YAML minimal: no empty values, no toggle left on, no option at its default. */
  _clean(config) {
    const out = { ...config };
    for (const [k, v] of Object.entries(out)) {
      const empty = v === "" || v === undefined || v === null || (Array.isArray(v) && !v.length);
      if (empty || (this.constructor.toggles.includes(k) && v === true) || this.constructor.defaults[k] === v) delete out[k];
    }
    return out;
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => this._t(`e_${s.name}`);
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._config = this._clean(this._fromForm(ev.detail.value));
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const key = JSON.stringify([inventory?.data ? 1 : 0, proxmoxLang(this._hass, this._config.language)]);
    if (key !== this._schemaKey) {
      this._schemaKey = key;
      this._form.schema = this._schema();
    }
    if (this._formConfig !== this._config) {
      this._formConfig = this._config;
      const data = { ...this.constructor.defaults, ...this._toForm(this._config) };
      for (const name of this.constructor.toggles) if (data[name] === undefined) data[name] = true;
      this._form.data = data;
    }
  }

  _toForm(config) {
    return config;
  }

  _fromForm(value) {
    return value;
  }
}

export class ProxmoxCardEditor extends ProxmoxEditorBase {
  static get toggles() {
    return ["illustration", "show_vms", "show_containers", "show_storage", "show_stopped", "show_history", "show_actions", "show_title", "show_subtitle"];
  }

  static get defaults() {
    return { ...super.defaults, max_items: 5, collapsed: false };
  }

  _nodeField() {
    const nodes = inventory?.data?.node || [];
    return {
      name: "node",
      selector: {
        select: {
          mode: "dropdown",
          options: [{ value: "", label: this._t("e_first_node") }, { value: "all", label: this._t("all_nodes") }, ...nodes.map((n) => ({ value: n.name, label: n.name }))],
        },
      },
    };
  }

  _fields() {
    return [
      this._nodeField(),
      { name: "max_items", selector: { number: { min: 1, max: 30, step: 1, mode: "box" } } },
      { name: "collapsed", selector: { boolean: {} } },
    ];
  }
}

// The zoomed view of the mini card is the node card: its editor offers the node card's options too.
export class ProxmoxMiniCardEditor extends ProxmoxCardEditor {
  static get toggles() {
    return ["zoom", ...ProxmoxCardEditor.toggles];
  }

  _nodeField() {
    const nodes = inventory?.data?.node || [];
    return {
      name: "node",
      selector: { select: { mode: "dropdown", options: [{ value: "", label: this._t("all_nodes") }, ...nodes.map((n) => ({ value: n.name, label: n.name }))] } },
    };
  }
}

export class ProxmoxGuestCardEditor extends ProxmoxEditorBase {
  static get toggles() {
    return ["illustration", "show_network", "show_history", "show_actions", "show_title", "show_subtitle"];
  }

  _fields() {
    const guests = [...(inventory?.data?.vm || []), ...(inventory?.data?.container || [])].sort((a, b) => Number(a.key) - Number(b.key));
    return [
      {
        name: "guests",
        selector: { select: { multiple: true, mode: "dropdown", custom_value: true, options: guests.map((g) => ({ value: g.key, label: `${g.key} · ${g.name}` })) } },
      },
    ];
  }

  // `guest: 102` for one machine, `guests: [100, 202]` for several; the editor shows both as one list.
  _toForm(config) {
    const { guest, ...rest } = config;
    const guests = config.guests ?? (guest !== undefined ? [guest] : []);
    return { ...rest, guests: [].concat(guests).map(String) };
  }

  _fromForm(value) {
    const { guests = [], ...rest } = value;
    const ids = guests.map((g) => (/^\d+$/.test(g) ? Number(g) : g));
    if (ids.length === 1) return { ...rest, guest: ids[0], guests: undefined };
    return { ...rest, guests: ids, guest: undefined };
  }
}

export class ProxmoxGuestMiniCardEditor extends ProxmoxGuestCardEditor {
  static get toggles() {
    return ["zoom", "illustration", "show_network", "show_history", "show_actions", "show_title", "show_subtitle"];
  }
}
