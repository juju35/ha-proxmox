// ── Node card ──
import { findNode, gaugeLevel, inDialog, watchOutside } from "./inventory.js";
import { ProxmoxBaseCard } from "./base-card.js";
import { Zoomable } from "./zoom-mini-cards.js";
import { proxmoxHealthBand, proxmoxNum, proxmoxPanelDuration, proxmoxPanelEsc as esc, proxmoxPanelIcon as icon, proxmoxPct, proxmoxSceneOf, proxmoxState, proxmoxStatus, proxmoxUptime } from "../../custom_components/proxmox_panel/frontend/proxmox-common.js";

export class ProxmoxCard extends ProxmoxBaseCard {
  static getConfigElement() {
    return document.createElement("proxmox-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    // `collapsed: true`: a click elsewhere on the page folds the sections opened (as in ha-carburants-france)
    this._onOutsideFold = (ev) => {
      if (!this._config?.collapsed || ev.composedPath().includes(this) || inDialog(ev)) return;
      const set = this._folded();
      if (set.size === 3) return;
      for (const k of ["vm", "container", "storage"]) set.add(k);
      this._update(true);
    };
  }

  connectedCallback() {
    super.connectedCallback?.();
    this._foldWatch ??= watchOutside(this, this._onOutsideFold);
    this._foldWatch.on();
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    this._foldWatch?.off();
    // Left (another dashboard view): the sections come back as configured
    this._foldState = null;
  }

  _several() {
    return this._nodes().length > 1;
  }

  _action(action, data, ev) {
    if (action === "fold") {
      ev?.stopPropagation?.();
      const set = this._folded();
      if (set.has(data.section)) set.delete(data.section);
      else set.add(data.section);
      this._update(true);
      this.dispatchEvent(new Event("iron-resize", { bubbles: true, composed: true }));
      return;
    }
    super._action(action, data, ev);
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
    if (!this._illustrated()) return `${notes}${nodes.map((n) => `<div class="block">${this._nodeHtml(n)}</div>`).join("")}`;
    // Illustrated: one node in the banner; several under a banner summing them up, each keeping its own header
    if (nodes.length === 1) return `${this._nodeBanner(nodes[0])}${notes}<div class="block">${this._nodeHtml(nodes[0], true)}</div>`;
    return `${this._nodesBanner(nodes)}${notes}${nodes.map((n) => `<div class="block">${this._nodeHtml(n)}</div>`).join("")}`;
  }

  /** The banner's state over nodes: down when one is offline, a warning when some machines are stopped, else running. */
  _sceneOf(nodes) {
    return proxmoxSceneOf(this._hass, nodes, [...this._items("vm"), ...this._items("container")]);
  }


  _nodeBanner(node, aside = "") {
    const status = proxmoxStatus(this._hass, node);
    const update = proxmoxState(this._hass, node.entities.update)?.state === "on" ? this._updatePill(node.entities.update) : "";
    return this._banner({ ...this._sceneOf([node]), iconName: "server", title: this._titleFor(node.name), subtitle: this._nodeSub(node, status), pills: [this._nodesPill([node]), update], aside });
  }

  _nodesBanner(nodes, aside = "") {
    const guests = [...this._items("vm"), ...this._items("container")].filter((g) => nodes.some((n) => n.id === g.node));
    const running = guests.filter((g) => proxmoxStatus(this._hass, g) === "running").length;
    // The machines running are in the pill when some are stopped: not repeated in the subtitle then.
    const warn = this._sceneOf(nodes).state === "warn";
    const subtitle = warn ? this._t("c_nodes", { n: nodes.length }) : `${this._t("c_nodes", { n: nodes.length })} · ${this._t("c_running", { running, n: guests.length })}`;
    return this._banner({ ...this._sceneOf(nodes), iconName: "server", title: this._config.title || this._t("title"), subtitle, pills: [this._nodesPill(nodes)], aside });
  }

  _nodeSub(node, status) {
    const update = proxmoxState(this._hass, node.entities.update);
    const uptime = proxmoxUptime(this._hass, node.entities.uptime);
    return [
      uptime !== null && status === "online" ? this._t("up_for", { d: proxmoxPanelDuration(uptime, this._lang()) }) : "",
      update?.attributes?.installed_version ? `PVE ${update.attributes.installed_version}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  _nodePills(node, status) {
    const e = node.entities;
    const update = proxmoxState(this._hass, e.update)?.state === "on";
    return [this._classicPill(status), update ? this._classicUpdate(e.update) : ""];
  }

  /** The classic header's "Update available" pill, its label in its title for the dot-only view. */
  _classicUpdate(entity) {
    const text = esc(this._t("update"));
    return `<button class="pill warn" data-action="more-info" data-entity="${esc(entity)}" title="${text}" aria-label="${text}">${text}</button>`;
  }

  _nodeHtml(node, bannered = false) {
    const lang = this._lang();
    const e = node.entities;
    const status = proxmoxStatus(this._hass, node);
    const parts = [bannered ? "" : this._head(this._badge("logo", status !== "online"), this._titleFor(node.name), this._nodeSub(node, status), this._nodePills(node, status)), this._rings(e)];
    // Proxmox Extended Sensors: the node's temperature and health under the rings (juju35/ha-proxmox#14)
    parts.push(proxmoxHealthBand(this._hass, lang, node));
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
    const aside = [`${running}/${all.length}`, more > 0 ? this._t("c_more", { n: more }) : ""].filter(Boolean).join(" · ");
    return this._section(kind, kind, this._t(kind === "vm" ? "vms" : "containers"), aside, `<div class="list">${rows.join("")}</div>`);
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
    // As the storage of System Hub's System Monitor card: name, used / total and percentage, the bar under them
    const rows = list.map((s) => {
      const pct = this._pctOf(s.entities.used_pct, s.entities.used, s.entities.total);
      const level = pct === null ? "" : gaugeLevel("disk", pct);
      const of = this._of(s.entities.used, s.entities.total);
      const target = s.entities.used_pct || s.entities.used;
      return `<div class="vol ${level}"${target ? ` data-action="more-info" data-entity="${esc(target)}" role="button" tabindex="0" style="cursor:pointer"` : ""}>
        <div class="line">${icon("disk")}<span class="k" title="${esc(s.key)}">${esc(s.key)}</span><span class="v">${esc([of, pct === null ? "" : `${Math.round(pct)}%`].filter(Boolean).join("  "))}</span></div>
        <div class="bar"><i style="width:${pct === null ? 0 : Math.max(0, Math.min(100, pct)).toFixed(1)}%"></i></div></div>`;
    });
    return this._section("storage", "storage", this._t("storage"), "", `<div class="vols">${rows.join("")}</div>`);
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
      const hasUpdate = proxmoxState(this._hass, n.entities.update)?.state === "on";
      const head = this._illustrated()
        ? this._banner({ ...this._sceneOf([n]), iconName: "server", title: this._titleFor(n.name), subtitle: this._counts(n), pills: [this._nodesPill([n]), hasUpdate ? this._updatePill(n.entities.update) : ""] })
        : this._head(this._badge("logo", status !== "online"), this._titleFor(n.name), this._counts(n), [this._classicPill(status), hasUpdate ? this._classicUpdate(n.entities.update) : ""]);
      return `${head}${this._notes()}${this._miniBars(n.entities)}`;
    }
    const head = this._illustrated()
      ? this._nodesBanner(nodes)
      : this._head(this._badge("logo", worst), this._config.title || this._t("title"), sub, this._classicPill(worst ? "offline" : "online"));
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
