// ── Machine card ──
import { inventory } from "./inventory.js";
import { guestScene } from "./illustrated-header.js";
import { ProxmoxBaseCard } from "./base-card.js";
import { Zoomable } from "./zoom-mini-cards.js";
import { PROXMOX_PANEL_ACTIONS, PROXMOX_PANEL_FOR_STATUS, proxmoxBytesOf, proxmoxNum, proxmoxPanelBytes, proxmoxPanelDuration, proxmoxPanelEsc as esc, proxmoxPanelIcon as icon, proxmoxStatus, proxmoxUptime } from "../../custom_components/proxmox_panel/frontend/proxmox-common.js";

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

  _several() {
    return this._wanted().length > 1;
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
    if (!this._illustrated()) return `${this._notes()}${blocks.join("")}`;
    // Illustrated: one machine in the banner; several under a banner summing them up, each keeping its own header
    if (guests.length === 1 && guests[0].item) return `${this._guestBanner(guests[0].item)}${this._notes()}<div class="block">${this._guestHtml(guests[0].item, true)}</div>`;
    return `${this._guestsBanner(guests)}${this._notes()}${blocks.join("")}`;
  }

  _guestBanner(g, aside = "") {
    const status = proxmoxStatus(this._hass, g);
    return this._banner({
      state: guestScene([status]),
      iconName: g.kind === "vm" ? "vm" : "container",
      title: this._titleFor(g.name),
      subtitle: this._subtitle(g, status),
      pills: [this._statusPill(this._statusText(status))],
      aside,
    });
  }

  /** Several machines: the worst state of them (a machine not found counts as unavailable), the number running. */
  _guestsBanner(guests, aside = "") {
    const statuses = guests.map(({ item }) => (item ? proxmoxStatus(this._hass, item) : "unavailable"));
    const running = statuses.filter((s) => s === "running").length;
    const kinds = new Set(guests.map(({ item }) => item?.kind).filter(Boolean));
    const state = guestScene(statuses);
    return this._banner({
      state,
      iconName: kinds.size === 1 && kinds.has("container") ? "container" : "vm",
      title: this._config.title || this._t("title"),
      // The machines running: in the pill when some are stopped (the subtitle then empty), else in the subtitle.
      subtitle: state === "warn" ? "" : this._t("c_running", { running, n: statuses.length }),
      pills: [this._statusPill(state === "warn" ? this._t("c_running", { running, n: statuses.length }) : this._t({ ok: "st_running", idle: "st_stopped", err: "st_unavailable" }[state]))],
      dim: Math.min(5, Math.max(1, Math.round((6 * (statuses.length - running)) / Math.max(1, statuses.length)))),
      aside,
    });
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

  _guestHtml(g, bannered = false) {
    const lang = this._lang();
    const e = g.entities;
    const status = proxmoxStatus(this._hass, g);
    const parts = [bannered ? "" : this._head(this._badge(g.kind === "vm" ? "vm" : "container", status !== "running"), this._titleFor(g.name), this._subtitle(g, status), this._classicPill(status))];
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
    const illustrated = this._illustrated();
    if (illustrated && guests.length === 1 && guests[0].item) {
      // One machine: in the banner, its bars (running) or its quick actions under it
      const g = guests[0].item;
      const status = proxmoxStatus(this._hass, g);
      const quick = status === "running" ? "" : this._quick(g).map((a) => this._button(g, a)).join("");
      const body = status === "running" ? this._miniBars({ ...g.entities, disk: null, max_disk: null }) : quick ? `<div class="acts">${quick}</div>` : "";
      return `${this._guestBanner(g)}${this._notes()}${body}`;
    }
    const rows = guests.map(({ key, item: g }, i) => {
      if (!g) return `<div class="note bad">${esc(this._t("c_guest_missing", { guest: key }))}</div>`;
      const status = proxmoxStatus(this._hass, g);
      const quick = status === "running" ? "" : this._quick(g).map((a) => this._button(g, a, false)).join("");
      const body = status === "running" ? this._miniBars({ ...g.entities, disk: null, max_disk: null }) : `<span class="s m">${esc(this._subtitle(g, status))}</span>`;
      const title = this._config.show_title === false ? "" : `<span class="n" style="font-size:14px">${esc(g.name)}</span>`;
      return `<div class="head"${i ? ' style="border-top:1px solid var(--divider-color, rgba(127,127,127,.15));padding-top:10px"' : ""}>
          ${this._badge(g.kind === "vm" ? "vm" : "container", status !== "running")}
          <div class="t"><div class="tl">${title}<span class="pills">${this._classicPill(status)}</span></div>${body}</div>
          ${quick}</div>`;
    });
    const banner = illustrated ? this._guestsBanner(guests) : "";
    return `${banner}${this._notes()}<div class="block" style="gap:10px">${rows.join("")}</div>`;
  }
}
