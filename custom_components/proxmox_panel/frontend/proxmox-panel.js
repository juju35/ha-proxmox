/*
 * Proxmox panel for Home Assistant
 * https://github.com/juju35/ha-proxmox
 *
 * A sidebar panel over the core Proxmox VE integration (proxmoxve). It reads the states of its entities and acts by
 * pressing its buttons; the integration's own command (proxmox_panel/inventory) only says which entity is which.
 * Six tabs under the toolbar, as in Smart Comfort (text tabs, the active one underlined, the tab in the address,
 * Settings last):
 * - Nodes: each node with its CPU, RAM and disk rings (24 h curves behind CPU and RAM), uptime, pending updates, how
 *   many virtual machines and containers run, and the node-wide actions;
 * - Virtual machines and Containers: one row per machine, its status and quick actions, unfolding into the details
 *   and the other actions; filtered by node and by a search;
 * - Storage: one gauge per storage, with its active / shared state;
 * - Backups: the last backup of each node (its sensors are disabled by default in the integration) and a manual
 *   snapshot of each machine;
 * - Settings: stopped machines shown or not, confirmation of the actions that stop or restart, inactive storage
 *   hidden.
 * The panel is for administrators only (registered with require_admin, its commands too).
 * English is built in; the other languages are loaded on demand from /proxmox_panel/i18n/<lang>.json.
 */

import {
  PROXMOX_PANEL_CUTTING,
  PROXMOX_PANEL_ACTIONS,
  PROXMOX_PANEL_NODE_ACTIONS,
  PROXMOX_PANEL_FOR_STATUS,
  proxmoxPanelEsc,
  proxmoxPanelIcon,
  proxmoxPanelBytes,
  proxmoxPanelDuration,
  proxmoxLang,
  proxmoxLoadStrings,
  proxmoxT,
  proxmoxState,
  proxmoxNum,
  proxmoxBytesOf,
  proxmoxHoldUnderPress,
  proxmoxReleasePress,
  proxmoxUptime,
  proxmoxPct,
  proxmoxStatus,
  proxmoxStatusPill,
  proxmoxAgo,
  proxmoxFind,
  proxmoxHistory,
  proxmoxRing,
  PROXMOX_COLORS,
  PROXMOX_SHARED_STYLE,
  PROXMOX_VARS,
} from "./proxmox-common.js";

export const PROXMOX_PANEL_VERSION = "1.1.0";
const PROXMOX_PANEL_TABS = ["nodes", "vms", "containers", "storage", "backups", "settings"];

export class ProxmoxPanel extends HTMLElement {
  static STYLE = `${PROXMOX_SHARED_STYLE}
    :host { display:block; min-height:100%; background:var(--primary-background-color); color:var(--primary-text-color);
            ${PROXMOX_VARS} }
    .toolbar { height:var(--header-height, 56px); display:flex; align-items:center; gap:8px; padding:0 12px; box-sizing:border-box;
               background:var(--app-header-background-color, var(--primary-color)); color:var(--app-header-text-color, #fff);
               border-bottom:var(--app-header-border-bottom, none); font-size:20px; position:sticky; top:0; z-index:2; }
    .toolbar .grow { flex:1; }
    .toolbar a { color:inherit; display:flex; padding:8px; border-radius:50%; }
    .toolbar a .i { width:22px; height:22px; }
    .toolbar a:hover { background:rgba(255,255,255,.12); }
    .tabs { display:flex; gap:4px; padding:0 12px; overflow-x:auto; background:var(--app-header-background-color, var(--primary-color));
            position:sticky; top:var(--header-height, 56px); z-index:2; }
    .tab { background:none; border:none; border-bottom:2px solid transparent; color:var(--app-header-text-color, #fff); opacity:.75;
           padding:12px 14px; font:inherit; font-size:14px; cursor:pointer; white-space:nowrap; }
    .tab:hover, .tab:focus-visible { opacity:1; outline:none; }
    .tab.active { opacity:1; border-bottom-color:var(--app-header-text-color, #fff); }
    main { max-width:1040px; margin:0 auto; padding:16px; box-sizing:border-box; display:flex; flex-direction:column; gap:16px; }
    section { display:flex; flex-direction:column; gap:16px; }
    section[hidden] { display:none; }
    .box { background:var(--card-background-color, #fff); border-radius:var(--ha-card-border-radius, 12px);
           border:1px solid var(--divider-color, rgba(127,127,127,.2)); padding:14px 16px; display:flex; flex-direction:column; gap:12px; }
    .note { font-size:14px; color:var(--secondary-text-color); }
    .note.warn { color:color-mix(in srgb, var(--tone-warn) 50%, var(--primary-text-color)); }
    .note.bad { color:color-mix(in srgb, var(--tone-bad) 50%, var(--primary-text-color)); }
    .note.good { color:color-mix(in srgb, var(--tone-good) 50%, var(--primary-text-color)); }
    .head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .head .sum { flex:1 1 180px; font-size:14px; color:var(--secondary-text-color); }
    .search { flex:0 1 220px; display:flex; align-items:center; border-radius:8px; border:1px solid var(--divider-color, rgba(127,127,127,.3));
              background:var(--secondary-background-color, rgba(127,127,127,.08)); }
    .search:focus-within { border-color:var(--px-accent); }
    .search input { flex:1; min-width:0; border:0; outline:0; background:none; color:inherit; font:inherit; font-size:14px; padding:7px 10px; }
    .pick { flex:0 1 200px; min-width:0; border-radius:8px; border:1px solid var(--divider-color, rgba(127,127,127,.3)); padding:7px 8px;
            background:var(--secondary-background-color, rgba(127,127,127,.08)); color:inherit; font:inherit; font-size:14px; }
    /* Buttons: outlined or tinted, never filled */
    .act:focus-visible, .tab:focus-visible, a:focus-visible, input:focus-visible, .fold:focus-visible { outline:2px solid var(--px-accent); outline-offset:1px; }
    /* Header of a node: the Proxmox logo in a tinted 40px round, as the cards' header icons */
    .nhead { display:flex; align-items:center; gap:12px; }
    .nhead .t { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .nhead .n { font-size:16px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .link { display:grid; place-items:center; width:28px; height:28px; border-radius:50%; color:var(--secondary-text-color); flex:none; }
    .link:hover { background:color-mix(in srgb, var(--secondary-text-color) 15%, transparent); }
    .link .i { width:16px; height:16px; }
    /* Rings: CPU, RAM, disk; a 24 h curve behind CPU and RAM on a 0-100 scale */
    .list { display:flex; flex-direction:column; }
    .row { display:flex; align-items:center; gap:10px; padding:8px 0; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); min-height:40px; }
    .list > :first-child { border-top:0; }
    .row > .i { color:var(--secondary-text-color); }
    .fold { all:unset; flex:1; min-width:0; display:flex; align-items:center; gap:8px; cursor:pointer; border-radius:6px; }
    .fold > .i { color:var(--secondary-text-color); transition:transform .15s; }
    .row.open .fold > .i { transform:rotate(90deg); }
    .fold .t, .row .t { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .n { font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .n .id { color:var(--secondary-text-color); }
    .detail { padding:2px 0 12px 26px; display:flex; flex-direction:column; gap:10px; }
    .srow { display:flex; flex-direction:column; gap:6px; padding:10px 0; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); }
    .srow .line { display:flex; align-items:center; gap:10px; }
    .srow .line > .i { color:var(--secondary-text-color); }
    .srow .pct { font-size:13px; min-width:3em; text-align:right; }
    .sub { font-size:12px; color:var(--secondary-text-color); padding-top:4px; }
    /* Confirmation at the top of what it acts on, like the card popups */
    .form { display:flex; flex-direction:column; gap:14px; }
    .toggle { display:flex; align-items:center; gap:12px; cursor:pointer; }
    .toggle > div { flex:1; display:flex; flex-direction:column; gap:2px; font-size:14px; }
    .toggle small { font-size:11px; color:var(--secondary-text-color); }
    .toggle input { width:18px; height:18px; accent-color:var(--px-accent); }
    .bar-save { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    @media (max-width: 600px) {
      .row .hide-narrow { display:none; }
      .detail { padding-left:0; }
      .ring svg.r { width:70px; height:70px; }
    }
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._tab = "nodes";
    this._inv = null; // proxmox_panel/inventory
    this._settings = null;
    this._draft = {};
    this._saved = false;
    this._query = { vms: "", containers: "" };
    this._node = ""; // node filter of the VMs, Containers and Storage tabs (device id)
    this._expanded = null; // device id of the unfolded machine
    this._confirm = null; // { entity, action, name, tab }
    this._message = null; // { tone, text, tab }
    this._history = {}; // entity id → [[time ms, value]]
    this._bodies = {}; // tab → last rendered body markup
    // No rewrite between a press and the end of its click (see proxmoxHoldUnderPress).
    proxmoxHoldUnderPress(this, () => this._refresh());
    // The click ends the press (after the element's own listeners, which draw what they change at once).
    this.shadowRoot.addEventListener("click", () => {
      this._pressing = false;
    });
  }

  // /proxmox/<tab> opens that tab (Home Assistant sets the route; the base address is Nodes)
  set route(route) {
    const path = (route?.path || "").split("/").filter(Boolean)[0];
    const tab = PROXMOX_PANEL_TABS.includes(path) ? path : "nodes";
    if (tab !== this._tab) this._showTab(tab);
  }

  set panel(panel) {
    this._panel = panel;
  }

  set narrow(narrow) {
    this._narrow = narrow;
    if (this._menu) this._menu.narrow = narrow;
  }

  set hass(hass) {
    const first = !this._hass;
    const before = this._lang();
    this._hass = hass;
    if (this._menu) this._menu.hass = hass;
    if (first) this._start();
    else if (this._lang() !== before) this._loadLang().then(() => this._render());
    else this._refresh();
  }

  connectedCallback() {
    if (this._hass && !this._unsub) this._subscribe();
    if (this._hass && this._failed) this._load();
    clearInterval(this._historyTimer);
    this._historyTimer = setInterval(() => this.isConnected && this._loadHistory(), 300000);
  }

  disconnectedCallback() {
    proxmoxReleasePress(this);
    clearInterval(this._historyTimer);
    clearTimeout(this._retryTimer);
    if (this._unsub) {
      this._unsub.then((off) => off()).catch(() => {});
      this._unsub = null;
    }
  }

  // ── Language ──

  // Full code when the panel has it (sr-Latn), else its base (de-AT → de), else English
  _lang() {
    return proxmoxLang(this._hass);
  }

  _loadLang() {
    return proxmoxLoadStrings(this._lang(), this._panel?.config?.version || PROXMOX_PANEL_VERSION);
  }

  _t(key, vars = {}) {
    return proxmoxT(this._lang(), key, vars);
  }

  // ── Data ──

  async _start() {
    this._render();
    this._subscribe();
    await this._loadLang();
    this._render();
    await this._load();
  }

  // Reload when a Proxmox VE entry changes (set up, reloaded, removed): its devices and entities may have changed
  _subscribe() {
    if (this._unsub || !this._hass?.connection) return;
    this._unsub = this._hass.connection
      .subscribeMessage(
        (events) => {
          if ([].concat(events || []).some((ev) => ev?.entry?.domain === "proxmoxve")) this._load();
        },
        { type: "config_entries/subscribe" },
      )
      .catch(() => () => {});
  }

  async _load() {
    clearTimeout(this._retryTimer);
    try {
      this._inv = await this._hass.callWS({ type: "proxmox_panel/inventory" });
      this._settings = this._inv.settings;
      this._failed = false;
      this._retries = 0;
      if (this._message?.load) this._message = null;
    } catch (err) {
      if (err?.code === "unauthorized") this._inv = { denied: true };
      else {
        this._message = { tone: "bad", text: this._t("error", { error: err?.message || err }), load: true };
        // Home Assistant still starting, the connection dropped: again after 2 s, 5 s, 15 s, then every 30 s
        this._failed = true;
        const delay = [2000, 5000, 15000, 30000][Math.min(this._retries || 0, 3)];
        this._retries = (this._retries || 0) + 1;
        this._retryTimer = setTimeout(() => this.isConnected && this._load(), delay);
      }
    }
    this._render();
    this._loadHistory();
  }

  _items(kind) {
    return this._inv?.[kind] || [];
  }

  /** The 24 h history of the nodes' CPU and RAM, for the curves behind their rings. */
  async _loadHistory() {
    const ids = this._items("node").flatMap((n) => [n.entities.cpu, n.entities.memory_pct]).filter(Boolean);
    const history = await proxmoxHistory(this._hass, ids);
    if (!Object.keys(history).length) return; // no recorder, or no history yet: the rings alone
    this._history = history;
    this._bodies.nodes = null;
    this._refresh();
  }

  // ── States ──

  _state(id) {
    return proxmoxState(this._hass, id);
  }

  _num(id) {
    return proxmoxNum(this._hass, id);
  }

  _bytes(id) {
    return proxmoxBytesOf(this._hass, id);
  }

  _uptime(id) {
    return proxmoxUptime(this._hass, id);
  }

  _pct(v) {
    return proxmoxPct(v);
  }

  _status(item) {
    return proxmoxStatus(this._hass, item);
  }

  _statusPill(status) {
    return proxmoxStatusPill(this._lang(), status);
  }

  _nodeName(id) {
    return this._items("node").find((n) => n.id === id)?.name || "";
  }

  // ── Actions ──

  _askOrPress(tab, item, action) {
    const entity = item.entities[action];
    if (!entity) return;
    if (this._settings?.confirm_actions !== false && PROXMOX_PANEL_CUTTING.includes(action)) {
      this._confirm = { tab, entity, action, name: item.name };
      this._message = null;
      this._renderTab(tab, true);
      return;
    }
    this._press(tab, entity, action, item.name);
  }

  async _press(tab, entity, action, name) {
    this._confirm = null;
    try {
      await this._hass.callService("button", "press", {}, { entity_id: entity });
      this._message = { tone: "good", tab, text: this._t("sent", { action: this._t(`a_${action}`), name }) };
    } catch (err) {
      this._message = { tone: "bad", tab, text: this._t("error", { error: err?.message || err }) };
    }
    this._renderTab(tab, true);
  }

  _navigate(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  // ── Tabs ──

  _tabs() {
    return PROXMOX_PANEL_TABS;
  }

  _goTab(tab, focus) {
    if (!this._tabs().includes(tab)) return;
    this._showTab(tab, focus);
    const base = (this._panel?.url_path || "proxmox").replace(/^\//, "");
    try {
      history.replaceState(history.state, "", `/${base}${tab === "nodes" ? "" : `/${tab}`}`);
    } catch (_err) {
      // no history (a test, a sandboxed page): the tab still shows
    }
  }

  _showTab(tab, focus) {
    this._tab = tab;
    const root = this.shadowRoot;
    for (const button of root.querySelectorAll?.(".tab") || []) {
      const selected = button.dataset.tab === tab;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus({ preventScroll: true });
    }
    for (const name of PROXMOX_PANEL_TABS) {
      const section = root.getElementById?.(`tab-${name}`);
      if (section) section.hidden = name !== tab;
    }
    this._renderTab(tab);
  }

  _render() {
    const root = this.shadowRoot;
    const esc = proxmoxPanelEsc;
    const tabs = this._tabs();
    if (!tabs.includes(this._tab)) this._tab = "nodes";
    root.innerHTML = `
      <style>${ProxmoxPanel.STYLE}</style>
      <div class="toolbar">
        <ha-menu-button></ha-menu-button>
        <span class="grow">${esc(this._t("title"))}</span>
        <a href="/config/integrations/integration/proxmoxve" title="${esc(this._t("open_integration"))}" aria-label="${esc(this._t("open_integration"))}">${proxmoxPanelIcon("cog")}</a>
      </div>
      <div class="tabs" role="tablist">${tabs
        .map((tab) => {
          const selected = tab === this._tab;
          return `<button class="tab${selected ? " active" : ""}" role="tab" id="tabbtn-${tab}" data-tab="${tab}" aria-selected="${selected}" aria-controls="tab-${tab}" tabindex="${selected ? 0 : -1}">${esc(this._t(tab))}</button>`;
        })
        .join("")}</div>
      <main>${tabs.map((tab) => `<section id="tab-${tab}" role="tabpanel" aria-labelledby="tabbtn-${tab}"${tab === this._tab ? "" : " hidden"}></section>`).join("")}</main>`;
    this._menu = root.querySelector("ha-menu-button");
    if (this._menu) {
      this._menu.hass = this._hass;
      this._menu.narrow = this._narrow;
    }
    for (const button of root.querySelectorAll(".tab")) {
      button.addEventListener("click", () => this._goTab(button.dataset.tab));
      // Left and right arrows move between the tabs, as in a native tab bar
      button.addEventListener("keydown", (ev) => {
        const step = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        ev.preventDefault();
        const i = tabs.indexOf(this._tab);
        this._goTab(tabs[(i + step + tabs.length) % tabs.length], true);
      });
    }
    this._bodies = {};
    this._renderTab(this._tab, true);
  }

  /** States changed: the shown tab's body again, only if its markup changed (the search keeps its focus). */
  _refresh() {
    // A press in progress: drawn once released (see _onPressStart).
    if (this._pressing) {
      this._dirty = true;
      return;
    }
    if (this._tab !== "settings") this._renderTab(this._tab);
  }

  /** A tab: its head (search, filter) once, its body whenever its markup changes, or all of it with `full`. */
  _renderTab(tab, full = false) {
    const section = this.shadowRoot.getElementById?.(`tab-${tab}`);
    if (!section) return;
    const intro = this._introHtml(tab);
    if (intro !== null) {
      section.innerHTML = intro;
      this._bodies[tab] = null;
      this._bind(section, tab);
      return;
    }
    if (tab === "settings") {
      section.innerHTML = this._settingsHtml();
      this._bindSettings(section);
      return;
    }
    let body = section.querySelector(".body");
    if (full || !body) {
      section.innerHTML = `${this._headHtml(tab)}<div class="body"></div>`;
      body = section.querySelector(".body");
      this._bodies[tab] = null;
      this._bindHead(section, tab);
    }
    const html = this._bodyHtml(tab);
    if (html !== this._bodies[tab]) {
      this._bodies[tab] = html;
      body.innerHTML = html;
      this._bind(body, tab);
    }
  }

  /** What shows instead of a tab: loading, no Proxmox VE, not allowed. Null when the tab has its content. */
  _introHtml(tab) {
    const esc = proxmoxPanelEsc;
    const inv = this._inv;
    if (!inv) {
      const retry = this._message?.load ? ` <button class="act quiet" data-action="retry">${esc(this._t("retry"))}</button>` : "";
      const text = this._message?.load ? `<div class="note bad" role="status">${esc(this._message.text)}${retry}</div>` : `<div class="note">${esc(this._t("loading"))}</div>`;
      return `<div class="box">${text}</div>`;
    }
    if (inv.denied) return `<div class="box"><div class="note">${esc(this._t("denied"))}</div></div>`;
    if (!inv.configured && tab !== "settings")
      return `<div class="box"><div class="note">${esc(this._t("no_proxmox"))}</div>
        <div class="acts"><button class="act" data-action="add-proxmox">${esc(this._t("add_proxmox"))}</button></div></div>`;
    return null;
  }

  _notesHtml(tab) {
    const esc = proxmoxPanelEsc;
    const notes = (this._inv?.entries || [])
      .filter((e) => !e.loaded)
      .map((e) => `<div class="note warn">${esc(this._t("not_loaded", { title: e.title, state: e.state }))}</div>`);
    if (this._message && (this._message.tab === tab || this._message.load))
      notes.push(`<div class="note ${this._message.tone}" role="status">${esc(this._message.text)}</div>`);
    if (this._confirm?.tab === tab) {
      const c = this._confirm;
      const action = this._t(`a_${c.action}`);
      notes.push(`<div class="confirm" role="alertdialog"><div class="note">${esc(this._t("confirm", { action, name: c.name }))}</div>
        <div class="acts"><button class="act quiet" data-action="cancel">${esc(this._t("cancel"))}</button>
        <button class="act bad" data-action="confirmed">${proxmoxPanelIcon(c.action)}${esc(action)}</button></div></div>`);
    }
    return notes.join("");
  }

  _headHtml(tab) {
    if (tab !== "vms" && tab !== "containers" && tab !== "storage") return "";
    const esc = proxmoxPanelEsc;
    const nodes = this._items("node");
    const filter =
      nodes.length > 1
        ? `<select class="pick" data-node aria-label="${esc(this._t("all_nodes"))}"><option value="">${esc(this._t("all_nodes"))}</option>${nodes
            .map((n) => `<option value="${esc(n.id)}"${n.id === this._node ? " selected" : ""}>${esc(n.name)}</option>`)
            .join("")}</select>`
        : "";
    const search =
      tab === "storage"
        ? ""
        : `<label class="search"><input type="search" placeholder="${esc(this._t("search"))}" aria-label="${esc(this._t("search"))}" value="${esc(this._query[tab])}"></label>`;
    return filter || search ? `<div class="head head-top">${filter}${search}</div>` : "";
  }

  _bodyHtml(tab) {
    if (tab === "nodes") return this._nodesHtml();
    if (tab === "vms") return this._guestsHtml("vm", "vms");
    if (tab === "containers") return this._guestsHtml("container", "containers");
    if (tab === "storage") return this._storageHtml();
    if (tab === "backups") return this._backupsHtml();
    return "";
  }

  // ── Nodes tab ──

  _ringHtml(label, pct, color, sub, historyId) {
    return proxmoxRing(label, pct, color, sub, this._history[historyId] || []);
  }

  _nodesHtml() {
    const esc = proxmoxPanelEsc;
    const lang = this._lang();
    const nodes = this._items("node");
    const notes = this._notesHtml("nodes");
    if (!nodes.length) return `${notes ? `<div class="box">${notes}</div>` : ""}<div class="box"><div class="note">${esc(this._t("empty_nodes"))}</div></div>`;
    const boxes = nodes.map((node) => {
      const e = node.entities;
      const status = this._status(node);
      const update = this._state(e.update);
      const uptime = this._uptime(e.uptime);
      const cpus = this._num(e.max_cpu);
      const meta = [
        uptime !== null && status === "online" ? `<span>${esc(this._t("up_for", { d: proxmoxPanelDuration(uptime, lang) }))}</span>` : "",
        cpus !== null ? `<span>${esc(this._t("cpus", { n: cpus }))}</span>` : "",
        update?.attributes?.installed_version ? `<span>PVE ${esc(update.attributes.installed_version)}</span>` : "",
      ].join("");
      const mem = this._bytes(e.memory);
      const maxMem = this._bytes(e.max_memory);
      const memPct = this._num(e.memory_pct) ?? (mem !== null && maxMem ? (mem / maxMem) * 100 : null);
      const disk = this._bytes(e.disk);
      const maxDisk = this._bytes(e.max_disk);
      const diskPct = disk !== null && maxDisk ? (disk / maxDisk) * 100 : null;
      const of = (a, b) => (a !== null && b !== null ? this._t("of", { used: proxmoxPanelBytes(a, lang), total: proxmoxPanelBytes(b, lang) }) : "");
      const count = (kind) => {
        const list = this._items(kind).filter((g) => g.node === node.id);
        return { n: list.length, running: list.filter((g) => this._status(g) === "running").length };
      };
      const vms = count("vm");
      const cts = count("container");
      const actions = PROXMOX_PANEL_NODE_ACTIONS.filter((a) => e[a])
        .map((a) => {
          const tone = a === "start_all" ? "" : a === "shutdown" ? " bad" : " quiet";
          return `<button class="act${tone}" data-action="press" data-item="${esc(node.id)}" data-press="${a}">${proxmoxPanelIcon(a)}${esc(this._t(`a_${a}`))}</button>`;
        })
        .join("");
      const link = node.url ? `<a class="link" href="${esc(node.url)}" target="_blank" rel="noopener noreferrer" title="${esc(this._t("open_proxmox"))}" aria-label="${esc(this._t("open_proxmox"))}">${proxmoxPanelIcon("open")}</a>` : "";
      return `<div class="box">
          <div class="nhead"><span class="badge${status === "online" ? "" : " muted"}">${proxmoxPanelIcon("logo")}</span>
            <div class="t"><span class="n">${esc(node.name)}</span><div class="m">${meta}</div></div>
            ${update?.state === "on" ? `<button class="pill warn" data-action="more-info" data-entity="${esc(e.update)}">${esc(this._t("update"))}</button>` : ""}
            ${this._statusPill(status)}${link}</div>
          <div class="rings">
            ${this._ringHtml(this._t("cpu"), this._num(e.cpu), PROXMOX_COLORS.cpu, "", e.cpu)}
            ${this._ringHtml(this._t("ram"), memPct, PROXMOX_COLORS.ram, of(mem, maxMem), e.memory_pct)}
            ${this._ringHtml(this._t("disk"), diskPct, PROXMOX_COLORS.disk, of(disk, maxDisk), null)}
          </div>
          <div class="m">${vms.n ? `<span>${proxmoxPanelIcon("vm")}${esc(this._t("vms_running", vms))}</span>` : ""}${cts.n ? `<span>${proxmoxPanelIcon("container")}${esc(this._t("containers_running", cts))}</span>` : ""}</div>
          ${actions ? `<div class="acts">${actions}</div>` : ""}
        </div>`;
    });
    return `${notes ? `<div class="box">${notes}</div>` : ""}${boxes.join("")}`;
  }

  // ── VMs and Containers tabs ──

  _guests(kind, tab) {
    const q = (this._query[tab] || "").trim().toLowerCase();
    return this._items(kind).filter(
      (g) => (!this._node || g.node === this._node) && (!q || g.name.toLowerCase().includes(q) || g.key.includes(q)),
    );
  }

  _guestsHtml(kind, tab) {
    const esc = proxmoxPanelEsc;
    const lang = this._lang();
    const all = this._guests(kind, tab);
    const running = all.filter((g) => this._status(g) === "running").length;
    const showStopped = this._settings?.show_stopped !== false;
    const shown = showStopped ? all : all.filter((g) => this._status(g) !== "stopped");
    const hidden = all.length - shown.length;
    const rows = shown.map((g) => {
      const e = g.entities;
      const status = this._status(g);
      const on = status === "running";
      const mem = this._num(e.memory_pct);
      const uptime = this._uptime(e.uptime);
      const meta = [
        this._items("node").length > 1 ? `<span>${esc(this._nodeName(g.node))}</span>` : "",
        on && this._num(e.cpu) !== null ? `<span>${esc(this._t("cpu"))} ${this._pct(this._num(e.cpu))}</span>` : "",
        on && mem !== null ? `<span>${esc(this._t("ram"))} ${this._pct(mem)}</span>` : "",
        on && uptime !== null ? `<span class="hide-narrow">${esc(proxmoxPanelDuration(uptime, lang))}</span>` : "",
      ].join("");
      // Quick actions: restart and shut down (else stop) when running, start when stopped, resume when suspended
      const quick = on
        ? ["restart", e.shutdown ? "shutdown" : "stop"]
        : status === "suspended"
          ? [e.resume ? "resume" : "start"]
          : status === "stopped"
            ? ["start"]
            : [];
      const quickHtml = quick
        .filter((a) => e[a])
        .map((a) =>
          a === "start" || a === "resume"
            ? `<button class="act" data-action="press" data-item="${esc(g.id)}" data-press="${a}">${proxmoxPanelIcon(a)}${esc(this._t(`a_${a}`))}</button>`
            : `<button class="act quiet icon" data-action="press" data-item="${esc(g.id)}" data-press="${a}" title="${esc(this._t(`a_${a}`))}" aria-label="${esc(this._t(`a_${a}`))}">${proxmoxPanelIcon(a)}</button>`,
        )
        .join("");
      const open = this._expanded === g.id;
      return `<div class="row${open ? " open" : ""}">
          <button class="fold" data-action="expand" data-item="${esc(g.id)}" aria-expanded="${open}" title="${esc(this._t("details"))}">${proxmoxPanelIcon("chevron")}
            <span class="t"><span class="n"><span class="id">${esc(g.key)}</span> · ${esc(g.name)}</span><span class="m">${meta}</span></span></button>
          ${this._statusPill(status)}${quickHtml}</div>${open ? this._detailHtml(g, quick) : ""}`;
    });
    const sum = this._t(kind === "vm" ? "sum_vms" : "sum_containers", { n: all.length, running });
    const notes = this._notesHtml(tab);
    const empty = this._items(kind).length ? this._t("no_match") : this._t(kind === "vm" ? "empty_vms" : "empty_containers");
    return `<div class="box">
        <div class="head"><span class="sum">${esc(sum)}${hidden ? ` · ${esc(this._t("hidden_stopped", { n: hidden }))}` : ""}</span></div>
        ${notes}
        <div class="list">${rows.length ? rows.join("") : `<div class="note">${esc(empty)}</div>`}</div>
      </div>`;
  }

  _detailHtml(g, quick) {
    const esc = proxmoxPanelEsc;
    const lang = this._lang();
    const e = g.entities;
    const facts = [];
    const pair = (used, max, label) => {
      const a = this._bytes(used);
      const b = this._bytes(max);
      if (a !== null && b !== null) facts.push(`<span>${esc(label)} ${esc(this._t("of", { used: proxmoxPanelBytes(a, lang), total: proxmoxPanelBytes(b, lang) }))}</span>`);
      else if (b !== null) facts.push(`<span>${esc(label)} ${esc(proxmoxPanelBytes(b, lang))}</span>`);
    };
    const cpus = this._num(e.max_cpu);
    if (cpus !== null) facts.push(`<span>${esc(this._t("cpus", { n: cpus }))}</span>`);
    pair(e.memory, e.max_memory, this._t("ram"));
    pair(e.disk, e.max_disk, this._t("disk"));
    const down = this._bytes(e.netin);
    const up = this._bytes(e.netout);
    if (down !== null) facts.push(`<span class="down">${proxmoxPanelIcon("download")}${esc(this._t("download"))} ${esc(proxmoxPanelBytes(down, lang))}</span>`);
    if (up !== null) facts.push(`<span class="up">${proxmoxPanelIcon("upload")}${esc(this._t("upload"))} ${esc(proxmoxPanelBytes(up, lang))}</span>`);
    const uptime = this._uptime(e.uptime);
    if (uptime !== null && this._status(g) === "running") facts.push(`<span>${esc(this._t("up_for", { d: proxmoxPanelDuration(uptime, lang) }))}</span>`);
    const fits = PROXMOX_PANEL_FOR_STATUS[this._status(g)] || PROXMOX_PANEL_ACTIONS;
    const actions = PROXMOX_PANEL_ACTIONS.filter((a) => e[a] && fits.includes(a) && !quick.includes(a))
      .map((a) => {
        const tone = a === "snapshot_create" ? "" : a === "stop" || a === "reset" ? " bad" : " quiet";
        return `<button class="act${tone}" data-action="press" data-item="${esc(g.id)}" data-press="${a}">${proxmoxPanelIcon(a)}${esc(this._t(`a_${a}`))}</button>`;
      })
      .join("");
    const link = g.url ? `<a class="act quiet" href="${esc(g.url)}" target="_blank" rel="noopener noreferrer">${proxmoxPanelIcon("open")}${esc(this._t("open_proxmox"))}</a>` : "";
    return `<div class="detail">${facts.length ? `<div class="m">${facts.join("")}</div>` : ""}<div class="acts">${actions}${link}</div></div>`;
  }

  // ── Storage tab ──

  _storageHtml() {
    const esc = proxmoxPanelEsc;
    const lang = this._lang();
    let list = this._items("storage").filter((s) => !this._node || s.node === this._node);
    const state = (s, slot) => this._state(s.entities[slot])?.state;
    if (this._settings?.hide_inactive_storage) list = list.filter((s) => state(s, "active") !== "off" && state(s, "enabled") !== "off");
    const rows = list.map((s) => {
      const e = s.entities;
      const used = this._bytes(e.used);
      const total = this._bytes(e.total);
      const avail = this._bytes(e.available);
      const pct = this._num(e.used_pct) ?? (used !== null && total ? (used / total) * 100 : null);
      const color = pct === null ? "transparent" : pct >= 90 ? "var(--tone-bad)" : pct >= 75 ? "var(--tone-warn)" : "var(--tone-good)";
      const pills = [
        state(s, "shared") === "on" ? `<span class="pill">${esc(this._t("shared"))}</span>` : "",
        state(s, "active") === "on" ? `<span class="pill good">${esc(this._t("active"))}</span>` : "",
        state(s, "active") === "off" || state(s, "enabled") === "off" ? `<span class="pill bad">${esc(this._t("inactive"))}</span>` : "",
      ].join("");
      const facts = [
        used !== null ? `<span>${esc(this._t("used", { v: proxmoxPanelBytes(used, lang) }))}</span>` : "",
        avail !== null ? `<span>${esc(this._t("free", { v: proxmoxPanelBytes(avail, lang) }))}</span>` : "",
        total !== null ? `<span>${esc(this._t("total", { v: proxmoxPanelBytes(total, lang) }))}</span>` : "",
      ].join("");
      const node = this._items("node").length > 1 ? ` <span class="id">· ${esc(this._nodeName(s.node))}</span>` : "";
      return `<div class="srow">
          <div class="line">${proxmoxPanelIcon("storage")}<span class="n" style="flex:1">${esc(s.key)}${node}</span>${pills}<span class="pct">${pct === null ? "" : this._pct(pct)}</span></div>
          ${pct === null ? "" : `<div class="bar"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%;background:${color}"></i></div>`}
          ${facts ? `<div class="m">${facts}</div>` : ""}</div>`;
    });
    return `<div class="box">
        <div class="head"><span class="sum">${esc(this._t("sum_storage", { n: list.length }))}</span></div>
        ${this._notesHtml("storage")}
        <div class="list">${rows.length ? rows.join("") : `<div class="note">${esc(this._t("empty_storage"))}</div>`}</div></div>`;
  }

  // ── Backups tab ──

  _ago(ms) {
    return proxmoxAgo(this._lang(), ms);
  }

  _backupsHtml() {
    const esc = proxmoxPanelEsc;
    const lang = this._lang();
    const nodes = this._items("node").map((node) => {
      const e = node.entities;
      if (!e.last_backup && node.disabled.includes("last_backup"))
        return `<div class="row">${proxmoxPanelIcon("backup")}<span class="t"><span class="n">${esc(node.name)}</span>
            <span class="note warn">${esc(this._t("backup_disabled", { node: node.name }))}</span></span>
            <button class="act quiet" data-action="device" data-item="${esc(node.id)}">${esc(this._t("open_device"))}</button></div>`;
      const last = this._state(e.last_backup);
      const time = last ? Date.parse(last.state) : Number.NaN;
      const dur = this._state(e.backup_duration);
      const factor = { s: 1, min: 60, h: 3600, d: 86400 }[dur?.attributes?.unit_of_measurement] ?? 1;
      const meta = [
        Number.isFinite(time) ? `<span title="${esc(new Date(time).toLocaleString(lang))}">${esc(this._t("last_backup", { when: this._ago(time) }))}</span>` : `<span>${esc(this._t("no_backup"))}</span>`,
        dur && Number.isFinite(Number(dur.state)) ? `<span>${esc(this._t("duration", { d: proxmoxPanelDuration(Number(dur.state) * factor, lang) }))}</span>` : "",
      ].join("");
      const problem = this._state(e.backup_problem)?.state;
      const pill = problem === "on" ? `<span class="pill bad">${esc(this._t("backup_failed"))}</span>` : problem === "off" && Number.isFinite(time) ? `<span class="pill good">${esc(this._t("backup_ok"))}</span>` : "";
      return `<div class="row">${proxmoxPanelIcon("backup")}<span class="t"><span class="n">${esc(node.name)}</span><span class="m">${meta}</span></span>${pill}</div>`;
    });
    const guests = [...this._items("vm"), ...this._items("container")].filter((g) => g.entities.snapshot_create);
    const snaps = guests.map(
      (g) => `<div class="row">${proxmoxPanelIcon(g.kind === "vm" ? "vm" : "container")}<span class="t"><span class="n"><span class="id">${esc(g.key)}</span> · ${esc(g.name)}</span></span>
        <button class="act" data-action="press" data-item="${esc(g.id)}" data-press="snapshot_create">${proxmoxPanelIcon("snapshot_create")}${esc(this._t("a_snapshot_create"))}</button></div>`,
    );
    return `<div class="box">${this._notesHtml("backups")}
        <div class="list">${nodes.length ? nodes.join("") : `<div class="note">${esc(this._t("empty_nodes"))}</div>`}</div>
        <div class="sub">${esc(this._t("snapshots"))}</div>
        <div class="list">${snaps.length ? snaps.join("") : `<div class="note">${esc(this._t("no_snapshot"))}</div>`}</div></div>`;
  }

  // ── Settings tab ──

  _value(key) {
    return key in this._draft ? this._draft[key] : this._settings?.[key];
  }

  _settingsHtml() {
    const esc = proxmoxPanelEsc;
    if (!this._settings) return `<div class="box"><div class="note">${esc(this._t("loading"))}</div></div>`;
    const toggle = (key, label) => `<label class="toggle"><div><span>${esc(this._t(label))}</span><small>${esc(this._t(`${label}_hint`))}</small></div>
        <input type="checkbox" data-key="${key}"${this._value(key) ? " checked" : ""}></label>`;
    const changed = Object.keys(this._draft).some((k) => this._draft[k] !== this._settings[k]);
    return `<div class="box form">
        ${toggle("show_stopped", "s_show_stopped")}
        ${toggle("confirm_actions", "s_confirm")}
        ${toggle("hide_inactive_storage", "s_hide_storage")}
        <div class="bar-save"><button class="act" data-action="save"${changed ? "" : " disabled"}>${esc(this._t("save"))}</button>
          ${this._saved ? `<span class="note good" role="status">${esc(this._t("saved"))}</span>` : ""}</div></div>`;
  }

  _bindSettings(host) {
    for (const input of host.querySelectorAll("input[data-key]")) {
      input.addEventListener("change", () => {
        this._draft[input.dataset.key] = input.checked;
        this._saved = false;
        const save = host.querySelector("[data-action=save]");
        if (save) save.disabled = !Object.keys(this._draft).some((k) => this._draft[k] !== this._settings[k]);
        host.querySelector(".note.good")?.remove();
      });
    }
    host.querySelector("[data-action=save]")?.addEventListener("click", () => this._save());
  }

  async _save() {
    try {
      const res = await this._hass.callWS({ type: "proxmox_panel/update_settings", ...this._draft });
      if (res.ok) {
        this._settings = res.settings;
        if (this._inv) this._inv.settings = res.settings;
        this._draft = {};
        this._saved = true;
      }
    } catch (err) {
      this._message = { tone: "bad", tab: "settings", text: this._t("error", { error: err?.message || err }) };
    }
    this._bodies = {};
    this._renderTab("settings");
  }

  // ── Events ──

  _bindHead(section, tab) {
    section.querySelector("select[data-node]")?.addEventListener("change", (ev) => {
      this._node = ev.target.value;
      for (const t of ["vms", "containers", "storage"]) this._bodies[t] = null;
      this._renderTab(tab);
    });
    const input = section.querySelector("input[type=search]");
    input?.addEventListener("input", () => {
      this._query[tab] = input.value;
      this._renderTab(tab);
    });
  }

  _bind(host, tab) {
    for (const el of host.querySelectorAll("[data-action]")) el.addEventListener("click", (ev) => this._action(tab, el.dataset, ev));
  }

  _find(id) {
    return proxmoxFind(this._inv, id);
  }

  _action(tab, data, ev) {
    const action = data.action;
    if (action === "retry") return this._load();
    if (action === "add-proxmox") return this._navigate("/config/integrations/dashboard/add?domain=proxmoxve");
    if (action === "device") return this._navigate(`/config/devices/device/${data.item}`);
    if (action === "more-info") return this._moreInfo(data.entity);
    if (action === "cancel") {
      this._confirm = null;
      return this._renderTab(tab, true);
    }
    if (action === "confirmed" && this._confirm) {
      const c = this._confirm;
      return this._press(c.tab, c.entity, c.action, c.name);
    }
    const item = this._find(data.item);
    if (!item) return;
    if (action === "expand") {
      // One machine unfolded at a time; its name again folds it
      this._expanded = this._expanded === item.id ? null : item.id;
      return this._renderTab(tab);
    }
    if (action === "press") {
      ev?.stopPropagation?.();
      this._askOrPress(tab, item, data.press);
    }
  }
}

if (!customElements.get("proxmox-panel")) customElements.define("proxmox-panel", ProxmoxPanel);
