/*
 * Proxmox cards for Home Assistant
 * https://github.com/juju35/ha-proxmox
 *
 * Lovelace cards over the core Proxmox VE integration, served and added to the dashboards by Proxmox Panel:
 * - proxmox-card: a node with its CPU, RAM and disk rings (24 h curves behind CPU and RAM), its virtual machines and
 *   containers, and its storage (`node: all` stacks every node);
 * - proxmox-mini-card: one line per node (CPU, RAM and disk bars, machines running), its zoom button switching to
 *   proxmox-card and a click outside the card coming back;
 * - proxmox-guest-card: one or several virtual machines or containers, with their rings, network and actions;
 * - proxmox-guest-mini-card: one line per machine, its zoom button switching to proxmox-guest-card.
 * Every user sees the cards; the actions (the Proxmox VE integration's buttons) are shown to administrators only.
 * Which entity is which comes from the integration's proxmox_panel/cards command, the values from the states.
 */

import {
  PROXMOX_COLORS,
  PROXMOX_PANEL_ACTIONS,
  PROXMOX_PANEL_CUTTING,
  PROXMOX_PANEL_FOR_STATUS,
  PROXMOX_PANEL_LANGS,
  PROXMOX_SHARED_STYLE,
  PROXMOX_VARS,
  proxmoxBytesOf,
  proxmoxFind,
  proxmoxHistory,
  proxmoxLang,
  proxmoxLoadStrings,
  proxmoxNum,
  proxmoxPanelBytes,
  proxmoxPanelDuration,
  proxmoxPanelEsc as esc,
  proxmoxPanelIcon as icon,
  proxmoxPct,
  proxmoxRing,
  proxmoxState,
  proxmoxStatus,
  proxmoxStatusPill,
  proxmoxT,
  proxmoxUptime,
} from "./proxmox-common.js";

export const PROXMOX_CARDS_VERSION = "1.0.0";
const LANGUAGE_NAMES = {
  en: "English", fr: "Français", de: "Deutsch", es: "Español", sr: "Српски", "sr-Latn": "Srpski (latinica)", it: "Italiano",
  nl: "Nederlands", pt: "Português", pl: "Polski", ro: "Română", da: "Dansk", sv: "Svenska", bg: "Български", ru: "Русский",
  uk: "Українська", hu: "Magyar", sk: "Slovenčina", cs: "Čeština", sl: "Slovenščina", lv: "Latviešu", el: "Ελληνικά",
};
const EXPAND = "M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z";
const COLLAPSE = "M19.5,3.09L15,7.59V4H13V11H20V9H16.41L20.91,4.5L19.5,3.09M4,13V15H7.59L3.09,19.5L4.5,20.91L9,16.41V20H11V13H4Z";

// ── Data shared by every card of the page ──

const INVENTORY_TTL = 300000;
let inventory = null; // { at, promise, data, error }

/** The inventory of the Proxmox VE devices and their entities, read once for every card and kept 5 minutes. */
export const loadInventory = (hass, force = false) => {
  if (!force && inventory && Date.now() - inventory.at < INVENTORY_TTL) return inventory.promise;
  const entry = { at: Date.now(), data: null, error: null };
  entry.promise = hass
    .callWS({ type: "proxmox_panel/cards" })
    .then((data) => {
      entry.data = data;
      return data;
    })
    .catch((err) => {
      entry.error = err?.code || err?.message || String(err);
      entry.at = Date.now() - INVENTORY_TTL + 30000; // tried again in 30 s
      return null;
    });
  inventory = entry;
  return entry.promise;
};

export const resetInventory = () => {
  inventory = null;
};

const inDialog = (ev) => ev.composedPath().some((el) => /dialog|more-info/i.test(el?.tagName || ""));

/** A node by its name, its Proxmox id (node/pve1) or its device id. */
const findNode = (nodes, wanted) => {
  const w = String(wanted).toLowerCase();
  return nodes.find((n) => n.name.toLowerCase() === w || n.key.toLowerCase() === w || n.key.toLowerCase() === `node/${w}` || n.id === wanted);
};

// ── Base card ──

class ProxmoxBaseCard extends HTMLElement {
  static STYLE = `${PROXMOX_SHARED_STYLE}
    :host { ${PROXMOX_VARS} display:block; }
    ha-card { padding:14px 16px; display:flex; flex-direction:column; gap:12px; overflow:hidden; color:var(--primary-text-color); }
    .head { display:flex; align-items:center; gap:12px; }
    .head .t { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .head .n { font-size:16px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .head .s { font-size:12px; color:var(--secondary-text-color); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .zoom { all:unset; display:grid; place-items:center; width:32px; height:32px; border-radius:50%; cursor:pointer; flex:none;
            color:var(--secondary-text-color); border:1px solid var(--divider-color, rgba(127,127,127,.3)); }
    .zoom:hover { background:color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
    .zoom:focus-visible, .act:focus-visible, .name:focus-visible { outline:2px solid var(--px-accent); outline-offset:1px; }
    .zoom .i { width:18px; height:18px; }
    .note { font-size:13px; color:var(--secondary-text-color); }
    .note.bad { color:color-mix(in srgb, var(--tone-bad) 50%, var(--primary-text-color)); }
    .note.good { color:color-mix(in srgb, var(--tone-good) 50%, var(--primary-text-color)); }
    .sec { font-size:12px; color:var(--secondary-text-color); display:flex; justify-content:space-between; gap:8px; margin-top:2px; }
    .list { display:flex; flex-direction:column; }
    .row { display:flex; align-items:center; gap:10px; padding:7px 0; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); min-height:34px; }
    .list > .row:first-child { border-top:0; }
    .dot { width:8px; height:8px; border-radius:50%; flex:none; background:var(--disabled-text-color, #9e9e9e); }
    .dot.running, .dot.online { background:var(--tone-good); } .dot.suspended { background:var(--tone-warn); } .dot.offline { background:var(--tone-bad); }
    .row .t { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
    .name { all:unset; cursor:pointer; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .name .id { color:var(--secondary-text-color); }
    .srow { display:flex; align-items:center; gap:10px; padding:4px 0; font-size:13px; }
    .srow .k { width:30%; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .srow .bar { flex:1; }
    .srow .v { font-size:12px; color:var(--secondary-text-color); min-width:3em; text-align:right; }
    .bars { flex:1; min-width:0; display:grid; grid-template-columns:repeat(var(--cols, 3), minmax(0, 1fr)); gap:8px; }
    .bars .l { font-size:11px; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .bars .bar { height:5px; margin-top:2px; }
    .block { display:flex; flex-direction:column; gap:12px; }
    .block + .block { border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); padding-top:12px; }
    @media (max-width: 420px) { .ring svg.r { width:68px; height:68px; } }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._history = {};
    this._confirm = null; // { entity, action, name }
    this._message = null; // { tone, text }
    this.shadowRoot.addEventListener("click", (ev) => {
      const el = ev.composedPath().find((n) => n?.dataset?.action);
      if (el) this._action(el.dataset.action, el.dataset, ev);
    });
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    this._last = null;
    this._update();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first || this._lang() !== this._langLoaded) this._prepare();
    else this._update();
  }

  get hass() {
    return this._hass;
  }

  async _prepare() {
    const lang = this._lang();
    await Promise.all([proxmoxLoadStrings(lang, PROXMOX_CARDS_VERSION), loadInventory(this._hass)]);
    this._langLoaded = lang;
    this._loadHistory();
    this._update(true);
  }

  _lang() {
    return proxmoxLang(this._hass, this._config?.language);
  }

  _t(key, vars) {
    return proxmoxT(this._lang(), key, vars);
  }

  _inv() {
    if (inventory && Date.now() - inventory.at >= INVENTORY_TTL && this._hass) loadInventory(this._hass).then(() => this._update(true));
    return inventory?.data || null;
  }

  _items(kind) {
    return this._inv()?.[kind] || [];
  }

  _admin() {
    return !!this._hass?.user?.is_admin;
  }

  /** Entity ids whose history draws the curves behind the rings. */
  _historyIds() {
    return [];
  }

  async _loadHistory() {
    if (this._historyAt && Date.now() - this._historyAt < INVENTORY_TTL) return;
    this._historyAt = Date.now();
    const history = await proxmoxHistory(this._hass, this._historyIds());
    if (Object.keys(history).length) {
      this._history = history;
      this._update(true);
    }
  }

  /** Renders again only when what the card shows changed (its states, the language, the zoom). */
  _update(force = false) {
    if (!this._hass || !this._config) return;
    if (this._historyAt && Date.now() - this._historyAt >= INVENTORY_TTL) this._loadHistory();
    const html = this._card();
    if (!force && html === this._last) return;
    this._last = html;
    this.shadowRoot.innerHTML = `<style>${this.constructor.STYLE}</style><ha-card>${html}</ha-card>`;
  }

  _card() {
    const inv = this._inv();
    if (!inv) {
      if (inventory?.error) return `<div class="note">${esc(this._t("c_no_integration"))}</div>`;
      return `<div class="note">${esc(this._t("loading"))}</div>`;
    }
    return this._render(inv);
  }

  _notes() {
    const out = [];
    if (this._message) out.push(`<div class="note ${this._message.tone}" role="status">${esc(this._message.text)}</div>`);
    if (this._confirm) {
      const action = this._t(`a_${this._confirm.action}`);
      out.push(`<div class="confirm" role="alertdialog"><div class="note">${esc(this._t("confirm", { action, name: this._confirm.name }))}</div>
        <div class="acts"><button class="act quiet" data-action="cancel">${esc(this._t("cancel"))}</button>
        <button class="act bad" data-action="confirmed">${icon(this._confirm.action)}${esc(action)}</button></div></div>`);
    }
    return out.join("");
  }

  _head(badge, title, subtitle, aside) {
    const t = this._config.show_title === false ? "" : `<span class="n">${esc(title)}</span>`;
    const s = this._config.show_subtitle === false || !subtitle ? "" : `<span class="s">${esc(subtitle)}</span>`;
    return `<div class="head">${badge}<div class="t">${t}${s}</div>${aside}</div>`;
  }

  _badge(name, muted) {
    return `<span class="badge${muted ? " muted" : ""}">${icon(name)}</span>`;
  }

  _button(item, action, label = true) {
    if (!this._admin() || this._config.show_actions === false || !item.entities[action]) return "";
    const text = esc(this._t(`a_${action}`));
    const tone = action === "start" || action === "resume" || action === "snapshot_create" || action === "start_all" ? "" : action === "stop" || action === "reset" ? " bad" : " quiet";
    if (!label) return `<button class="act quiet icon" data-action="press" data-item="${esc(item.id)}" data-press="${action}" title="${text}" aria-label="${text}">${icon(action)}</button>`;
    return `<button class="act${tone}" data-action="press" data-item="${esc(item.id)}" data-press="${action}">${icon(action)}${text}</button>`;
  }

  /** The quick actions of a machine: restart and shut down (else stop) when running, start when stopped, resume when suspended. */
  _quick(item) {
    const e = item.entities;
    const status = proxmoxStatus(this._hass, item);
    if (status === "running") return ["restart", e.shutdown ? "shutdown" : "stop"];
    if (status === "suspended") return [e.resume ? "resume" : "start"];
    if (status === "stopped") return ["start"];
    return [];
  }

  _of(usedId, maxId) {
    const lang = this._lang();
    const a = proxmoxBytesOf(this._hass, usedId);
    const b = proxmoxBytesOf(this._hass, maxId);
    return a !== null && b !== null ? this._t("of", { used: proxmoxPanelBytes(a, lang), total: proxmoxPanelBytes(b, lang) }) : "";
  }

  _pctOf(pctId, usedId, maxId) {
    const pct = proxmoxNum(this._hass, pctId);
    if (pct !== null) return pct;
    const a = proxmoxBytesOf(this._hass, usedId);
    const b = proxmoxBytesOf(this._hass, maxId);
    return a !== null && b ? (a / b) * 100 : null;
  }

  _rings(e) {
    return `<div class="rings">
        ${proxmoxRing(this._t("cpu"), proxmoxNum(this._hass, e.cpu), PROXMOX_COLORS.cpu, "", this._history[e.cpu] || [])}
        ${proxmoxRing(this._t("ram"), this._pctOf(e.memory_pct, e.memory, e.max_memory), PROXMOX_COLORS.ram, this._of(e.memory, e.max_memory), this._history[e.memory_pct] || [])}
        ${proxmoxRing(this._t("disk"), this._pctOf(null, e.disk, e.max_disk), PROXMOX_COLORS.disk, this._of(e.disk, e.max_disk))}
      </div>`;
  }

  _miniBars(e) {
    const bar = (label, pct, color) =>
      `<div><div class="l">${esc(label)} ${proxmoxPct(pct)}</div><div class="bar"><i style="width:${pct === null ? 0 : Math.max(0, Math.min(100, pct)).toFixed(1)}%;background:${color}"></i></div></div>`;
    const bars = [bar(this._t("cpu"), proxmoxNum(this._hass, e.cpu), PROXMOX_COLORS.cpu), bar(this._t("ram"), this._pctOf(e.memory_pct, e.memory, e.max_memory), PROXMOX_COLORS.ram)];
    if (e.disk || e.max_disk) bars.push(bar(this._t("disk"), this._pctOf(null, e.disk, e.max_disk), PROXMOX_COLORS.disk));
    return `<div class="bars" style="--cols:${bars.length}">${bars.join("")}</div>`;
  }

  _find(id) {
    return proxmoxFind(this._inv(), id);
  }

  _action(action, data, ev) {
    if (action === "more-info" && data.entity) {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: data.entity }, bubbles: true, composed: true }));
      return;
    }
    if (action === "cancel") {
      this._confirm = null;
      return this._update();
    }
    if (action === "confirmed" && this._confirm) return this._press(this._confirm.entity, this._confirm.action, this._confirm.name);
    if (action === "press") {
      ev?.stopPropagation?.();
      const item = this._find(data.item);
      const entity = item?.entities?.[data.press];
      if (!entity || !this._admin()) return;
      if (this._inv()?.confirm_actions !== false && PROXMOX_PANEL_CUTTING.includes(data.press)) {
        this._confirm = { entity, action: data.press, name: item.name };
        this._message = null;
        return this._update();
      }
      return this._press(entity, data.press, item.name);
    }
  }

  async _press(entity, action, name) {
    this._confirm = null;
    try {
      await this._hass.callService("button", "press", {}, { entity_id: entity });
      this._message = { tone: "good", text: this._t("sent", { action: this._t(`a_${action}`), name }) };
    } catch (err) {
      this._message = { tone: "bad", text: this._t("error", { error: err?.message || err }) };
    }
    this._update();
    clearTimeout(this._messageTimer);
    this._messageTimer = setTimeout(() => {
      this._message = null;
      this._update();
    }, 5000);
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }
}

// ── Zoom of the mini cards ──

const Zoomable = (Base) =>
  class extends Base {
    constructor() {
      super();
      this._zoomed = false;
      this._onOutside = (ev) => {
        if (this._zoomed && !ev.composedPath().includes(this) && !inDialog(ev)) this._setZoom(false);
      };
    }

    connectedCallback() {
      document.addEventListener("click", this._onOutside, true);
    }

    disconnectedCallback() {
      document.removeEventListener("click", this._onOutside, true);
    }

    getCardSize() {
      return this._zoomed ? super.getCardSize() : 3;
    }

    getGridOptions() {
      return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 };
    }

    _zoomButton() {
      if (this._config.zoom === false) return "";
      const title = esc(this._t(this._zoomed ? "c_zoom_out" : "c_zoom_in"));
      return `<button class="zoom" data-action="zoom" title="${title}" aria-label="${title}"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${this._zoomed ? COLLAPSE : EXPAND}"/></svg></button>`;
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

    _render(inv) {
      return this._zoomed ? super._render(inv) : this._compact(inv);
    }
  };

// ── Node card ──

export class ProxmoxCard extends ProxmoxBaseCard {
  static getConfigElement() {
    return document.createElement("proxmox-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  _nodes() {
    const nodes = this._items("node");
    const wanted = this._config.node;
    if (wanted === "all") return nodes;
    if (wanted) return [findNode(nodes, wanted)].filter(Boolean);
    return nodes.slice(0, 1);
  }

  _historyIds() {
    return this._nodes().flatMap((n) => [n.entities.cpu, n.entities.memory_pct]).filter(Boolean);
  }

  _render() {
    const nodes = this._nodes();
    if (!nodes.length) return `<div class="note">${esc(this._t("c_no_node"))}</div>`;
    const notes = this._notes();
    return `${notes}${nodes.map((n) => `<div class="block">${this._nodeHtml(n)}</div>`).join("")}`;
  }

  _nodeHtml(node) {
    const lang = this._lang();
    const e = node.entities;
    const status = proxmoxStatus(this._hass, node);
    const update = proxmoxState(this._hass, e.update);
    const uptime = proxmoxUptime(this._hass, e.uptime);
    const sub = [
      uptime !== null && status === "online" ? this._t("up_for", { d: proxmoxPanelDuration(uptime, lang) }) : "",
      update?.attributes?.installed_version ? `PVE ${update.attributes.installed_version}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const pills = `${update?.state === "on" ? `<button class="pill warn" data-action="more-info" data-entity="${esc(e.update)}">${esc(this._t("update"))}</button>` : ""}${proxmoxStatusPill(lang, status)}`;
    const parts = [this._head(this._badge("logo", status !== "online"), node.name, sub, pills), this._rings(e)];
    if (this._config.show_vms !== false) parts.push(this._guestList(node, "vm"));
    if (this._config.show_containers !== false) parts.push(this._guestList(node, "container"));
    if (this._config.show_storage !== false) parts.push(this._storage(node));
    return parts.join("");
  }

  _guestList(node, kind) {
    const all = this._items(kind).filter((g) => g.node === node.id);
    if (!all.length) return "";
    const order = { running: 0, suspended: 1, unavailable: 2, stopped: 3 };
    const status = (g) => proxmoxStatus(this._hass, g);
    const running = all.filter((g) => status(g) === "running").length;
    let shown = [...all].sort((a, b) => (order[status(a)] ?? 2) - (order[status(b)] ?? 2) || Number(a.key) - Number(b.key));
    if (this._config.show_stopped === false) shown = shown.filter((g) => status(g) !== "stopped");
    const max = Number(this._config.max_items) || 5;
    const more = shown.length - max;
    const rows = shown.slice(0, max).map((g) => this._guestRow(g));
    const label = this._t(kind === "vm" ? "vms_running" : "containers_running", { running, n: all.length });
    return `<div class="sec"><span>${esc(label)}</span>${more > 0 ? `<span>${esc(this._t("c_more", { n: more }))}</span>` : ""}</div>
      <div class="list">${rows.join("")}</div>`;
  }

  _guestRow(g) {
    const e = g.entities;
    const status = proxmoxStatus(this._hass, g);
    const meta =
      status === "running"
        ? [
            proxmoxNum(this._hass, e.cpu) !== null ? `${this._t("cpu")} ${proxmoxPct(proxmoxNum(this._hass, e.cpu))}` : "",
            proxmoxNum(this._hass, e.memory_pct) !== null ? `${this._t("ram")} ${proxmoxPct(proxmoxNum(this._hass, e.memory_pct))}` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : this._t(`st_${status}`);
    const target = e.status || e.running || e.cpu;
    return `<div class="row"><span class="dot ${status}"></span>
        <div class="t"><button class="name" data-action="more-info" data-entity="${esc(target || "")}"><span class="id">${esc(g.key)}</span> · ${esc(g.name)}</button>
        <span class="m">${esc(meta)}</span></div>${this._quick(g)
          .map((a) => this._button(g, a, a === "start" || a === "resume"))
          .join("")}</div>`;
  }

  _storage(node) {
    let list = this._items("storage").filter((s) => s.node === node.id);
    const state = (s, slot) => proxmoxState(this._hass, s.entities[slot])?.state;
    list = list.filter((s) => state(s, "active") !== "off" && state(s, "enabled") !== "off");
    if (!list.length) return "";
    const rows = list.map((s) => {
      const pct = this._pctOf(s.entities.used_pct, s.entities.used, s.entities.total);
      const color = pct === null ? "transparent" : pct >= 90 ? "var(--tone-bad)" : pct >= 75 ? "var(--tone-warn)" : "var(--tone-good)";
      return `<div class="srow"><span class="k" title="${esc(this._of(s.entities.used, s.entities.total))}">${esc(s.key)}</span>
        <span class="bar"><i style="width:${pct === null ? 0 : Math.max(0, Math.min(100, pct)).toFixed(1)}%;background:${color}"></i></span>
        <span class="v">${pct === null ? "" : proxmoxPct(pct)}</span></div>`;
    });
    return `<div class="sec"><span>${esc(this._t("storage"))}</span></div><div>${rows.join("")}</div>`;
  }
}

export class ProxmoxMiniCard extends Zoomable(ProxmoxCard) {
  static getConfigElement() {
    return document.createElement("proxmox-mini-card-editor");
  }

  _compact() {
    const nodes = this._config.node && this._config.node !== "all" ? this._nodes() : this._items("node");
    if (!nodes.length) return `<div class="note">${esc(this._t("c_no_node"))}</div>`;
    const guests = [...this._items("vm"), ...this._items("container")].filter((g) => nodes.some((n) => n.id === g.node));
    const running = guests.filter((g) => proxmoxStatus(this._hass, g) === "running").length;
    const single = nodes.length === 1;
    const sub = single
      ? this._t("c_running", { running, n: guests.length })
      : `${this._t("c_nodes", { n: nodes.length })} · ${this._t("c_running", { running, n: guests.length })}`;
    const worst = nodes.some((n) => proxmoxStatus(this._hass, n) !== "online");
    if (single) {
      // One node: its name in the header, its counts as the subtitle, its bars under it
      const n = nodes[0];
      const status = proxmoxStatus(this._hass, n);
      const update = proxmoxState(this._hass, n.entities.update)?.state === "on"
        ? `<button class="pill warn" data-action="more-info" data-entity="${esc(n.entities.update)}">${esc(this._t("update"))}</button>`
        : "";
      const head = this._head(this._badge("logo", status !== "online"), n.name, this._counts(n), `${update}${status === "online" ? "" : proxmoxStatusPill(this._lang(), status)}${this._zoomButton()}`);
      return `${head}${this._notes()}${this._miniBars(n.entities)}`;
    }
    const head = this._head(this._badge("logo", worst), this._t("title"), sub, this._zoomButton());
    const rows = nodes.map((n) => {
      const status = proxmoxStatus(this._hass, n);
      return `<div class="row"><span class="dot ${status}"></span>
          <div class="t" style="flex:0 1 38%"><span class="name" style="cursor:default">${esc(n.name)}</span>
          <span class="m">${esc(this._counts(n))}${esc(this._updateNote(n))}</span></div>
          ${this._miniBars(n.entities)}</div>`;
    });
    return `${head}${this._notes()}<div class="list">${rows.join("")}</div>`;
  }

  /** "VMs 2/4 · Containers 5/6": machines running out of all of the node's. */
  _counts(n) {
    const count = (kind) => {
      const list = this._items(kind).filter((g) => g.node === n.id);
      return `${list.filter((g) => proxmoxStatus(this._hass, g) === "running").length}/${list.length}`;
    };
    return `${this._t("vms")} ${count("vm")} · ${this._t("containers")} ${count("container")}`;
  }

  _updateNote(n) {
    return proxmoxState(this._hass, n.entities.update)?.state === "on" ? ` · ${this._t("update")}` : "";
  }
}

// ── Machine card ──

export class ProxmoxGuestCard extends ProxmoxBaseCard {
  static getConfigElement() {
    return document.createElement("proxmox-guest-card-editor");
  }

  static getStubConfig() {
    const first = (inventory?.data?.vm || [])[0] || (inventory?.data?.container || [])[0];
    return first ? { guest: Number(first.key) } : {};
  }

  _wanted() {
    const list = this._config.guests ?? (this._config.guest !== undefined ? [this._config.guest] : []);
    return [].concat(list).map((g) => String(g));
  }

  _guests() {
    const all = [...this._items("vm"), ...this._items("container")];
    return this._wanted().map((key) => ({ key, item: all.find((g) => g.key === key || g.name.toLowerCase() === key.toLowerCase()) }));
  }

  _historyIds() {
    return this._guests()
      .filter((g) => g.item)
      .flatMap(({ item }) => [item.entities.cpu, item.entities.memory_pct])
      .filter(Boolean);
  }

  _render() {
    const guests = this._guests();
    if (!guests.length) return `<div class="note">${esc(this._t("c_no_guest"))}</div>`;
    const blocks = guests.map(({ key, item }) =>
      item ? `<div class="block">${this._guestHtml(item)}</div>` : `<div class="note bad">${esc(this._t("c_guest_missing", { guest: key }))}</div>`,
    );
    return `${this._notes()}${blocks.join("")}`;
  }

  _subtitle(g, status) {
    const lang = this._lang();
    const node = this._items("node").find((n) => n.id === g.node);
    const uptime = proxmoxUptime(this._hass, g.entities.uptime);
    return [
      this._t(g.kind === "vm" ? "c_vm" : "c_container", { id: g.key }),
      node?.name,
      status === "running" && uptime !== null ? this._t("up_for", { d: proxmoxPanelDuration(uptime, lang) }) : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  _guestHtml(g) {
    const lang = this._lang();
    const e = g.entities;
    const status = proxmoxStatus(this._hass, g);
    const parts = [this._head(this._badge(g.kind === "vm" ? "vm" : "container", status !== "running"), g.name, this._subtitle(g, status), proxmoxStatusPill(lang, status))];
    if (status === "running") parts.push(this._rings(e));
    else {
      const facts = [];
      const cpus = proxmoxNum(this._hass, e.max_cpu);
      if (cpus !== null) facts.push(this._t("cpus", { n: cpus }));
      for (const [id, label] of [[e.max_memory, this._t("ram")], [e.max_disk, this._t("disk")]]) {
        const b = proxmoxBytesOf(this._hass, id);
        if (b !== null) facts.push(`${label} ${proxmoxPanelBytes(b, lang)}`);
      }
      if (facts.length) parts.push(`<div class="m">${facts.map((f) => `<span>${esc(f)}</span>`).join("")}</div>`);
    }
    if (this._config.show_network !== false) {
      const down = proxmoxBytesOf(this._hass, e.netin);
      const up = proxmoxBytesOf(this._hass, e.netout);
      if (down !== null || up !== null)
        parts.push(`<div class="m">${down !== null ? `<span class="down">${icon("download")}${esc(this._t("download"))} ${esc(proxmoxPanelBytes(down, lang))}</span>` : ""}${
          up !== null ? `<span class="up">${icon("upload")}${esc(this._t("upload"))} ${esc(proxmoxPanelBytes(up, lang))}</span>` : ""
        }</div>`);
    }
    const fits = PROXMOX_PANEL_FOR_STATUS[status] || PROXMOX_PANEL_ACTIONS;
    const actions = PROXMOX_PANEL_ACTIONS.filter((a) => fits.includes(a))
      .map((a) => this._button(g, a))
      .join("");
    if (actions) parts.push(`<div class="acts">${actions}</div>`);
    return parts.join("");
  }

  getCardSize() {
    return 4 * Math.max(1, this._wanted().length);
  }
}

export class ProxmoxGuestMiniCard extends Zoomable(ProxmoxGuestCard) {
  static getConfigElement() {
    return document.createElement("proxmox-guest-mini-card-editor");
  }

  _compact() {
    const guests = this._guests();
    if (!guests.length) return `<div class="note">${esc(this._t("c_no_guest"))}</div>`;
    const lang = this._lang();
    const rows = guests.map(({ key, item: g }, i) => {
      if (!g) return `<div class="note bad">${esc(this._t("c_guest_missing", { guest: key }))}</div>`;
      const status = proxmoxStatus(this._hass, g);
      const quick = status === "running" ? "" : this._quick(g).map((a) => this._button(g, a, false)).join("");
      const body = status === "running" ? this._miniBars({ ...g.entities, disk: null, max_disk: null }) : `<span class="s m">${esc(this._subtitle(g, status))}</span>`;
      const title = this._config.show_title === false ? "" : `<span class="n" style="font-size:14px">${esc(g.name)}</span>`;
      return `<div class="head"${i ? ' style="border-top:1px solid var(--divider-color, rgba(127,127,127,.15));padding-top:10px"' : ""}>
          ${this._badge(g.kind === "vm" ? "vm" : "container", status !== "running")}
          <div class="t"><div style="display:flex;align-items:center;gap:6px;min-width:0">${title}${proxmoxStatusPill(lang, status)}</div>${body}</div>
          ${quick}${i === 0 ? this._zoomButton() : ""}</div>`;
    });
    return `${this._notes()}<div class="block" style="gap:10px">${rows.join("")}</div>`;
  }
}

// ── Editors ──

class ProxmoxEditorBase extends HTMLElement {
  static get toggles() {
    return ["show_title", "show_subtitle"];
  }

  static get defaults() {
    return {};
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
      ...this._fields(),
      { type: "grid", name: "", schema: this.constructor.toggles.map((name) => ({ name, selector: { boolean: {} } })) },
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

class ProxmoxCardEditor extends ProxmoxEditorBase {
  static get toggles() {
    return ["show_vms", "show_containers", "show_storage", "show_stopped", "show_actions", "show_title", "show_subtitle"];
  }

  static get defaults() {
    return { max_items: 5 };
  }

  _fields() {
    const nodes = inventory?.data?.node || [];
    return [
      {
        name: "node",
        selector: {
          select: {
            mode: "dropdown",
            options: [{ value: "", label: this._t("e_first_node") }, { value: "all", label: this._t("all_nodes") }, ...nodes.map((n) => ({ value: n.name, label: n.name }))],
          },
        },
      },
      { name: "max_items", selector: { number: { min: 1, max: 30, step: 1, mode: "box" } } },
    ];
  }
}

class ProxmoxMiniCardEditor extends ProxmoxEditorBase {
  static get toggles() {
    return ["zoom", "show_title", "show_subtitle"];
  }

  _fields() {
    const nodes = inventory?.data?.node || [];
    return [
      {
        name: "node",
        selector: { select: { mode: "dropdown", options: [{ value: "", label: this._t("all_nodes") }, ...nodes.map((n) => ({ value: n.name, label: n.name }))] } },
      },
    ];
  }
}

class ProxmoxGuestCardEditor extends ProxmoxEditorBase {
  static get toggles() {
    return ["show_network", "show_actions", "show_title", "show_subtitle"];
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

class ProxmoxGuestMiniCardEditor extends ProxmoxGuestCardEditor {
  static get toggles() {
    return ["zoom", "show_network", "show_actions", "show_title", "show_subtitle"];
  }
}

// ── Registration ──

const define = (name, cls) => {
  if (!customElements.get(name)) customElements.define(name, cls);
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
