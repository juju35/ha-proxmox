// ── Base card ──
import { PROXMOX_CARDS_VERSION } from "./constants.js";
import { INVENTORY_TTL, gaugeCurve, gaugeLevel, inventory, loadInventory } from "./inventory.js";
import { BANNER_STYLE } from "./illustrated-header.js";
import { PROXMOX_PANEL_CUTTING, PROXMOX_SHARED_STYLE, PROXMOX_VARS, proxmoxBytesOf, proxmoxFind, proxmoxHistory, proxmoxHoldUnderPress, proxmoxLang, proxmoxLoadStrings, proxmoxNum, proxmoxPanelBytes, proxmoxPanelEsc as esc, proxmoxPanelIcon as icon, proxmoxRackSvg, proxmoxReleasePress, proxmoxStatus, proxmoxStatusPill, proxmoxT, proxmoxUplinkHtml } from "../../custom_components/proxmox_panel/frontend/proxmox-common.js";

export let bannerUid = 0;

export class ProxmoxBaseCard extends HTMLElement {
  static STYLE = `${PROXMOX_SHARED_STYLE}
    :host { ${PROXMOX_VARS} display:block; }
    ha-card { padding:14px 16px; display:flex; flex-direction:column; gap:12px; overflow:hidden; color:var(--primary-text-color); }
    .head { display:flex; align-items:center; gap:12px; }
    /* The title keeps room for a few characters: without it, the pills go to a line of their own. */
    .head { flex-wrap:wrap; row-gap:6px; }
    /* The text (both headers): the title, then the status pill and the other pills (an update) right after it, only
       when the whole title and the whole pills fit there (measured by the card, see _fitPill); else the other pills,
       then all of them, take a line of their own under the subtitle; when even that does not fit, their dots only
       (the labels kept in their title and for screen readers). */
    .t { flex:1; min-width:0; display:grid; grid-template-columns:minmax(0,max-content) max-content max-content minmax(0,1fr);
         grid-template-areas:"n p m ." "s s s s"; column-gap:0; row-gap:2px; align-items:center; justify-items:start; }
    .t .tl { display:contents; }
    .t .n { grid-area:n; max-width:100%; min-width:0; }
    .t .tl > .pills { grid-area:p; display:flex; align-items:center; gap:4px; flex:none; margin-left:8px; }
    .t .tl > .pills.more { grid-area:m; }
    .t .s { grid-area:s; justify-self:stretch; min-width:0; }
    .t.more-below { grid-template-areas:"n p . ." "s s s s" "m m m m"; }
    .t.below { grid-template-areas:"n n n n" "s s s s" "p m . ."; }
    .t.below .n { justify-self:stretch; }
    .t.below .tl > .pills, .t.more-below .tl > .more { margin-top:2px; }
    .t.below .tl > .pills:not(.more), .t.more-below .tl > .more, .t .tl > .pills:first-child { margin-left:0; }
    .t > :not(.tl):not(.s) { grid-column:1 / -1; justify-self:stretch; min-width:0; }
    /* No room for both labels: the other pills (an update) keep their dots only (.more-dot); still none, every pill. */
    .t.dot-only .pill, .t.more-dot .more .pill { padding:4px; }
    .t.dot-only .pill .txt, .t.more-dot .more .pill .txt { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
    /* The classic header's pills: a dot in their tone before the label, as on the banner (the label hidden when dots only). */
    .head .t .pill { display:inline-flex; align-items:center; gap:4px; --c:var(--secondary-text-color); }
    .head .t .pill.good { --c:var(--tone-good); } .head .t .pill.warn { --c:var(--tone-warn); } .head .t .pill.bad { --c:var(--tone-bad); }
    .head .t .pill::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--c); flex:none; }
    .head .t.dot-only .pill, .head .t.more-dot .more .pill { font-size:0; line-height:0; gap:0; }
    @container px-card (max-width: 200px) { .banner .pill { padding:4px; }
      .banner .pill .txt { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; } }
    .head .n { font-size:16px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .head .s { font-size:12px; color:var(--secondary-text-color); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .zoom { all:unset; display:grid; place-items:center; width:32px; height:32px; border-radius:50%; cursor:pointer; flex:none;
            color:var(--secondary-text-color); border:1px solid var(--divider-color, rgba(127,127,127,.3)); }
    .zoom:hover { background:color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
    .zoom:focus-visible, .act:focus-visible, .name:focus-visible { outline:2px solid var(--px-accent); outline-offset:1px; }
    .zoom .i { width:18px; height:18px; }
    /* Without the illustration, the mini cards' zoom button in the card's top right corner, the headers clear of it. */
    ha-card { position:relative; }
    .zoom.plain { position:absolute; z-index:2; top:12px; right:12px; width:24px; height:24px; border:0; box-shadow:inset 0 0 0 1px var(--divider-color, rgba(127,127,127,.3)); }
    .zoom.plain .i { width:16px; height:16px; }
    .zoom.plain ~ .head, .zoom.plain ~ * .head:first-child { padding-right:26px; }
    .note { font-size:13px; color:var(--secondary-text-color); }
    .note.bad { color:color-mix(in srgb, var(--tone-bad) 50%, var(--primary-text-color)); }
    .note.good { color:color-mix(in srgb, var(--tone-good) 50%, var(--primary-text-color)); }
    .sec { font-size:12px; color:var(--secondary-text-color); display:flex; justify-content:space-between; gap:8px; margin-top:2px; }
    button.sec { all:unset; box-sizing:border-box; display:flex; align-items:center; gap:6px; width:100%; cursor:pointer; padding:2px 0; margin-top:2px;
                 font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.04em; color:var(--secondary-text-color); }
    button.sec:focus-visible { outline:2px solid var(--px-accent); outline-offset:2px; border-radius:4px; }
    button.sec .i { width:18px; height:18px; }
    button.sec .label { flex:0 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    button.sec .aside { flex:1; text-transform:none; letter-spacing:0; font-weight:400; white-space:nowrap; }
    button.sec .chev { transition:transform .2s; }
    button.sec.open .chev { transform:rotate(90deg); }
    .sec-wrap { display:flex; flex-direction:column; gap:4px; }
    .gauges { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:6px; container-type:inline-size; }
    .gauge { --c:var(--px-blue); position:relative; display:flex; flex-direction:column; align-items:center; min-width:0; border-radius:10px; overflow:hidden; padding:4px 0 6px; }
    .gauge[data-action] { cursor:pointer; }
    .gauge.warn { --c:var(--tone-warn); } .gauge.crit { --c:var(--tone-bad); } .gauge.muted { --c:var(--secondary-text-color); }
    .gauge > :not(.spark) { position:relative; }
    /* 24 h curve in its own 24 px band under the ring and its labels, never behind the text. */
    .gauge:has(> .spark) { padding-bottom:30px; }
    .gauge .spark { position:absolute; inset:auto 0 0; width:100%; height:24px; pointer-events:none; }
    .spark-a { fill:color-mix(in srgb, var(--c) 12%, transparent); }
    .spark-l { fill:none; stroke:color-mix(in srgb, var(--c) 50%, transparent); stroke-width:1.2; vector-effect:non-scaling-stroke; }
    .dial { position:relative; width:100%; max-width:60px; aspect-ratio:1; }
    .gauge .ring { width:100%; height:100%; transform:rotate(-90deg); display:block; }
    .gauge .ring circle { fill:none; stroke-width:6; }
    .gauge .ring .track { stroke:var(--divider-color, rgba(127,127,127,.25)); }
    .gauge .ring .value { stroke:var(--c); stroke-linecap:round; transition:stroke-dasharray .4s; }
    .dial .val { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .dial .val b { font-size:14px; font-weight:500; }
    .dial .val .i { width:12px; height:12px; color:var(--secondary-text-color); }
    .gauge .lbl { font-size:12px; color:var(--secondary-text-color); text-align:center; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .gauge .lbl2 { font-size:11px; color:var(--secondary-text-color); text-align:center; }
    @container (max-width: 300px) { .gauge .lbl, .gauge .lbl2 { font-size:11px; } }
    .list { display:flex; flex-direction:column; }
    .row { display:flex; align-items:center; gap:10px; padding:7px 0; border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); min-height:34px; }
    .list > .row:first-child { border-top:0; }
    .dot { width:8px; height:8px; border-radius:50%; flex:none; background:var(--disabled-text-color, #9e9e9e); }
    .dot.running, .dot.online { background:var(--tone-good); } .dot.suspended { background:var(--tone-warn); } .dot.offline { background:var(--tone-bad); }
    .row .t { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
    .name { all:unset; cursor:pointer; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .name .id { color:var(--secondary-text-color); }
    .vols { display:flex; flex-direction:column; gap:8px; }
    .vol { --c:var(--px-blue); display:flex; flex-direction:column; gap:4px; }
    .vol.warn { --c:var(--tone-warn); } .vol.crit { --c:var(--tone-bad); }
    .vol .line { display:flex; align-items:center; gap:8px; font-size:13px; min-width:0; }
    .vol .line > .i { color:var(--secondary-text-color); }
    .vol .k { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .vol .v { font-size:12px; color:var(--secondary-text-color); white-space:nowrap; }
    .vol .bar { height:4px; }
    .vol .bar > i { background:var(--c); }
    .bars { flex:1; min-width:0; display:grid; grid-template-columns:repeat(var(--cols, 3), minmax(0, 1fr)); gap:8px; }
    .bars .l { font-size:11px; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .bars .bar { height:5px; margin-top:2px; }
    .bars > div { --c:var(--px-blue); } .bars > .warn { --c:var(--tone-warn); } .bars > .crit { --c:var(--tone-bad); }
    .bars .bar > i { background:var(--c); }
    .block { display:flex; flex-direction:column; gap:12px; }
    .block + .block { border-top:1px solid var(--divider-color, rgba(127,127,127,.15)); padding-top:12px; }
    ${BANNER_STYLE}
  `;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._uid = ++bannerUid;
    this._history = {};
    this._confirm = null; // { entity, action, name }
    this._message = null; // { tone, text }
    // No rewrite between a press and the end of its click (see proxmoxHoldUnderPress).
    proxmoxHoldUnderPress(this, () => {
      this._update(this._dirtyForce);
      this._dirtyForce = false;
    });
    this.shadowRoot.addEventListener("click", (ev) => {
      // The click ends the press: what it changes is drawn at once.
      this._pressing = false;
      const el = ev.composedPath().find((n) => n?.dataset?.action);
      if (el) this._action(el.dataset.action, el.dataset, ev);
    });
  }

  connectedCallback() {
    // A new width (or the web font loaded): the status pill is fitted again, in the next frame.
    if (typeof ResizeObserver === "function") {
      this._resize ??= new ResizeObserver((entries) => {
        const w = Math.round(entries.at(-1).contentRect.width);
        if (w === this._fitWidth) return;
        this._fitWidth = w;
        cancelAnimationFrame(this._fitFrame);
        this._fitFrame = requestAnimationFrame(() => this._fitPill());
      });
      this._resize.observe(this);
    }
    document.fonts?.ready?.then(() => this._fitPill());
    // A font loaded later (another script's glyphs): the texts change width without the card resizing.
    this._onFonts ??= () => this._fitPill();
    document.fonts?.addEventListener?.("loadingdone", this._onFonts);
  }

  disconnectedCallback() {
    proxmoxReleasePress(this);
    document.fonts?.removeEventListener?.("loadingdone", this._onFonts);
    this._resize?.disconnect();
    this._fitWidth = null;
    // Left with a confirmation open (another view, a conditional card hidden): closed without acting, as Cancel.
    if (this._confirm) {
      this._confirm = null;
      this._last = null;
    }
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
    if (this._config?.show_history === false) return;
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
    // A press in progress: drawn once released (see _onPressStart).
    if (this._pressing) {
      this._dirty = true;
      this._dirtyForce ||= force;
      return;
    }
    if (this._historyAt && Date.now() - this._historyAt >= INVENTORY_TTL) this._loadHistory();
    const html = this._card();
    if (!force && html === this._last) return;
    this._last = html;
    this.shadowRoot.innerHTML = `<style>${this.constructor.STYLE}</style><ha-card>${html}</ha-card>`;
    this._fitPill();
  }

  /**
   * The status pill, then the other pills (an update), go right after the title only when the whole title and their
   * whole labels fit there; otherwise the other pills (.more-below), then all of them (.below), take a line of their
   * own under the subtitle (kept to one line). When the labels do not fit that line either, or the banner has no
   * room for the lines above its floor strip, the pills keep their dots only (.dot-only, back beside the title when
   * the dots fit there). Measured after render, so that it holds in every language.
   */
  _fitPill() {
    const root = this.shadowRoot;
    if (!root?.querySelectorAll || typeof getComputedStyle !== "function") return;
    for (const t of root.querySelectorAll(".t")) {
      const groups = [...t.querySelectorAll(".tl > .pills")];
      t.classList.remove("below", "more-below", "more-dot", "dot-only");
      if (!groups.length || !groups[0].getClientRects().length) continue;
      const name = t.querySelector(".tl > .n");
      const gap = 8;
      const fits = (n) => {
        let w = 0;
        if (name) {
          const range = document.createRange();
          range.selectNodeContents(name);
          w = Math.max(name.scrollWidth, range.getBoundingClientRect().width) + gap;
        }
        for (const g of groups.slice(0, n)) w += g.getBoundingClientRect().width + gap;
        return w - gap <= t.getBoundingClientRect().width + 0.5;
      };
      const place = () => {
        if (fits(groups.length)) return;
        if (groups.length > 1 && fits(1)) t.classList.add("more-below");
        else t.classList.add("below");
      };
      // Whole labels first; then the other pills (an update) as dots, the status pill keeping its label; then every
      // pill as a dot. The first that fits beside the title, or on the line under the subtitle, wins.
      for (const mode of ["", "more-dot", "dot-only"]) {
        if (mode === "more-dot" && groups.length < 2) continue;
        t.classList.remove("below", "more-below", "more-dot", "dot-only");
        if (mode) t.classList.add(mode);
        place();
        if (!t.classList.contains("below") && !t.classList.contains("more-below")) break;
        const sub = t.querySelector(".s");
        if (sub) sub.title = sub.scrollWidth > sub.clientWidth ? sub.textContent.trim() : "";
        const banner = t.closest(".banner");
        const tb = t.getBoundingClientRect();
        const bb = banner?.getBoundingClientRect();
        const tall = !!bb && (tb.top < bb.top - 0.5 || tb.bottom > bb.bottom - 10 + 0.5);
        const wide = groups.some((g) => g.scrollWidth > tb.width + 0.5 || g.getBoundingClientRect().right > tb.right + 0.5);
        if (!tall && !wide) break;
      }
    }
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

  /** The header's title: `title` when the card shows a single node or machine, else the name of each. */
  _titleFor(name) {
    return this._config.title && !this._several() ? this._config.title : name;
  }

  _several() {
    return false;
  }

  _head(badge, title, subtitle, pills = []) {
    const t = this._config.show_title === false ? "" : `<span class="n">${esc(title)}</span>`;
    const s = this._config.show_subtitle === false || !subtitle ? "" : `<span class="s">${esc(subtitle)}</span>`;
    const p = [].concat(pills).filter(Boolean);
    return `<div class="head">${badge}<div class="t"><div class="tl">${t}${p.length ? `<span class="pills">${p[0]}</span>` : ""}${
      p.length > 1 ? `<span class="pills more">${p.slice(1).join("")}</span>` : ""
    }</div>${s}</div></div>`;
  }

  /** The classic header's status pill: the panel's, with its label in its title for the dot-only view. */
  _classicPill(status) {
    const html = proxmoxStatusPill(this._lang(), status);
    return html.replace(/^<span /, `<span title="${html.replace(/<[^>]*>/g, "")}" `);
  }

  _badge(name, muted) {
    return `<span class="badge${muted ? " muted" : ""}">${icon(name)}</span>`;
  }

  /** The illustrated header is shown unless `illustration: false` (the classic header then). */
  _illustrated() {
    return this._config.illustration !== false;
  }

  /** Night picture: forced by `illustration_theme`, else Home Assistant's dark mode alone (a light theme keeps the day picture after sunset). */
  _night() {
    const theme = this._config.illustration_theme;
    if (theme === "night") return true;
    if (theme === "day") return false;
    return !!this._hass?.themes?.darkMode;
  }

  /**
   * The illustrated header: the round icon in the state's colour with the Proxmox logo on it, the title (and its
   * pills) and the subtitle on the wall, the rack at the right, the zoom button (mini cards) at the top right.
   */
  _banner({ state, iconName, title, subtitle, pills = [], aside = "", dim = 1 }) {
    // The mini cards' zoom button (compact and expanded view) goes in the first banner drawn (see Zoomable._render).
    if (this._zoomPending) {
      aside += this._zoomButton();
      this._zoomPending = false;
    }
    const t = this._config.show_title === false ? "" : `<span class="n">${esc(title)}</span>`;
    const s = this._config.show_subtitle === false || !subtitle ? "" : `<span class="s">${esc(subtitle)}</span>`;
    const p = pills.filter(Boolean);
    const badge = `<span class="badge">${icon(iconName)}<span class="brand" title="Proxmox VE">${icon("logo")}</span></span>`;
    return `<div class="banner ${state}${this._night() ? " night" : ""}"><div class="px-ground"></div>${proxmoxUplinkHtml(state)}${proxmoxRackSvg(state, this._uid, dim, !!aside)}
      <div class="htext">${badge}<div class="t"><div class="tl">${t}${p.length ? `<span class="pills">${p[0]}</span>` : ""}${p.length > 1 ? `<span class="pills more">${p.slice(1).join("")}</span>` : ""}</div>${s}</div></div>${aside}</div>`;
  }

  /** The banner's status pill: a dot and `text` in the colour of the header icon. */
  _statusPill(text) {
    return `<span class="pill st" title="${esc(text)}"><span class="txt">${esc(text)}</span></span>`;
  }

  /** A machine's or node's status in words (the raw state when it has none). */
  _statusText(status) {
    const text = this._t(`st_${status}`);
    return text === `st_${status}` ? status : text;
  }

  /** The banner's "Update available" pill, opening the node's update entity. */
  _updatePill(entity) {
    const text = this._t("update");
    return `<button class="pill warn" data-action="more-info" data-entity="${esc(entity)}" title="${esc(text)}"><span class="txt">${esc(text)}</span></button>`;
  }

  /** The status of nodes for their banner's pill: offline, else the machines running when some are not, else online. */
  _nodesPill(nodes) {
    const scene = this._sceneOf(nodes).state;
    if (scene === "err") return this._statusPill(this._t("st_offline"));
    if (scene === "warn") {
      const guests = [...this._items("vm"), ...this._items("container")].filter((g) => nodes.some((n) => n.id === g.node));
      const running = guests.filter((g) => proxmoxStatus(this._hass, g) === "running").length;
      return this._statusPill(this._t("c_running", { running, n: guests.length }));
    }
    return this._statusPill(this._t("st_online"));
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

  /**
   * CPU, RAM and disk as the other ha-* cards draw them (System Hub's System Monitor card, the NAS card): a ring with
   * the metric's icon and its whole percentage, blue then orange then red from the thresholds, the 24 h curve behind
   * the whole gauge on a 0-100 scale, the label and the used / total under it.
   */
  _rings(e) {
    const gauges = [
      this._gauge("cpu", proxmoxNum(this._hass, e.cpu), "", this._history[e.cpu], e.cpu),
      this._gauge("ram", this._pctOf(e.memory_pct, e.memory, e.max_memory), this._of(e.memory, e.max_memory), this._history[e.memory_pct], e.memory_pct || e.memory),
      this._gauge("disk", this._pctOf(e.disk_pct, e.disk, e.max_disk), this._of(e.disk, e.max_disk), null, e.disk_pct || e.disk),
    ];
    return `<div class="gauges">${gauges.join("")}</div>`;
  }

  _gauge(metric, pct, detail, points, entity) {
    const v = pct === null ? 0 : Math.max(0, Math.min(100, pct));
    const r = 26;
    const c = 2 * Math.PI * r;
    const label = this._t(metric);
    const shown = pct === null ? "—" : `${Math.round(pct)}%`;
    return `<div class="gauge ${gaugeLevel(metric, pct)}"${entity ? ` data-action="more-info" data-entity="${esc(entity)}" role="button" tabindex="0"` : ""}>${this._config.show_history === false ? "" : gaugeCurve(points)}
      <div class="dial"><svg class="ring" viewBox="0 0 60 60" role="img" aria-label="${esc(`${label} ${shown}`)}"><circle class="track" cx="30" cy="30" r="${r}"/>
        <circle class="value" cx="30" cy="30" r="${r}" stroke-dasharray="${((v / 100) * c).toFixed(1)} ${c.toFixed(1)}"/></svg>
        <div class="val">${icon(metric)}<b>${shown}</b></div></div>
      <div class="lbl" title="${esc(label)}">${esc(label)}</div>${detail ? `<div class="lbl2">${esc(detail)}</div>` : ""}</div>`;
  }

  /**
   * A section of the node card (virtual machines, containers, storage): its icon, its name, what it counts, a
   * chevron; a click folds or unfolds it. With `collapsed: true` the sections start folded and a click elsewhere on
   * the page folds them again.
   */
  _section(key, iconName, label, aside, body) {
    const open = !this._folded().has(key);
    return `<div class="sec-wrap"><button class="sec${open ? " open" : ""}" data-action="fold" data-section="${esc(key)}" aria-expanded="${open}">
        ${icon(iconName)}<span class="label" title="${esc(label)}">${esc(label)}</span>${aside ? `<span class="aside">${esc(aside)}</span>` : ""}${icon("chevron", "i chev")}</button>
      ${open ? body : ""}</div>`;
  }

  /** The sections folded: every one with `collapsed: true` until it is opened, none otherwise until it is folded. */
  _folded() {
    if (!this._foldState || this._foldState.collapsed !== !!this._config.collapsed) {
      this._foldState = { collapsed: !!this._config.collapsed, set: new Set(this._config.collapsed ? ["vm", "container", "storage"] : []) };
    }
    return this._foldState.set;
  }

  /** The mini card's bars, in the colours of its gauges (blue, then orange, then red from the thresholds). */
  _miniBars(e) {
    const bar = (metric, pct) =>
      `<div class="${gaugeLevel(metric, pct)}"><div class="l">${esc(this._t(metric))} ${pct === null ? "—" : `${Math.round(pct)}%`}</div><div class="bar"><i style="width:${pct === null ? 0 : Math.max(0, Math.min(100, pct)).toFixed(1)}%"></i></div></div>`;
    const bars = [bar("cpu", proxmoxNum(this._hass, e.cpu)), bar("ram", this._pctOf(e.memory_pct, e.memory, e.max_memory))];
    if (e.disk || e.max_disk) bars.push(bar("disk", this._pctOf(null, e.disk, e.max_disk)));
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
