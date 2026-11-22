/*
 * Proxmox panel for Home Assistant
 * https://github.com/juju35/ha-proxmox
 *
 * A sidebar panel over the core Proxmox VE integration (proxmoxve). It reads the states of its entities and acts by
 * pressing its buttons; the integration's own command (proxmox_panel/inventory) only says which entity is which.
 * The cards' illustrated header as its top bar (status pill, refresh and integration buttons), then six tabs under it, as in Smart Comfort (text tabs, the active one underlined, the tab in the address,
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
  proxmoxHealthBand,
  proxmoxRing,
  proxmoxRackSvg,
  proxmoxSceneOf,
  proxmoxUplinkHtml,
  PROXMOX_BANNER_STYLE,
  PROXMOX_COLORS,
  PROXMOX_SHARED_STYLE,
  PROXMOX_VARS,
} from "./proxmox-common.js";

export const PROXMOX_PANEL_VERSION = "1.6.1";
// Disks and Datastores come from Proxmox Extended Sensors: shown only when it offers them (juju35/ha-proxmox#14).
const PROXMOX_PANEL_TABS = ["nodes", "vms", "containers", "storage", "backups", "disks", "datastores", "settings"];
const PROXMOX_PANEL_SENSOR_TABS = { disks: "disk", datastores: "pbs" };

// ── Folded top bar ──
// As on the dashboards' illustrated headers (ha-dashboard-header): past 24 px of scroll the 90 px top bar and the
// text tabs fold into one 64 px bar — the panel's icon, title and line, the tabs as round icon pills, the status pill
// and the round buttons — sticky at the top; back under 8 px they unfold. The content does not move: the folded bar
// keeps the room of the top bar and tabs under it. On a narrow panel the pills get a row of their own under the bar,
// the status pill turns to a dot and only the first round button is kept. The folded bar mirrors the top bar and the
// tabs (their text, counts, active tab and buttons): a click on a pill or a button clicks the original.
const proxmoxPanel_FOLD_CSS = `
  .pf-sense { position:relative; height:0; }
  .pf-sense, .pf-fold, .pf-top, .pf-tabs { overflow-anchor:none; }
  .pf-sense > i { position:absolute; left:0; width:1px; height:1px; pointer-events:none; visibility:hidden; }
  .pf-sense > .pf-s1 { top:24px; } .pf-sense > .pf-s2 { top:8px; }
  .pf-fold { display:none; position:sticky; top:0; z-index:6; container-type:inline-size; color:var(--primary-text-color);
             background:var(--card-background-color, #fff); border-bottom:1px solid var(--divider-color, rgba(0,0,0,.12));
             box-shadow:0 2px 8px rgba(0,0,0,.08); }
  :host([pf-folded]) .pf-fold { display:block; }
  .pf-fold.pf-measure { display:block; position:absolute; visibility:hidden; }
  :host([pf-folded]) .pf-top, :host([pf-folded]) .pf-tabs { display:none !important; }
  .pf-bar { display:flex; flex-wrap:wrap; align-items:center; column-gap:12px; min-height:64px; padding:0 16px; box-sizing:border-box; }
  .pf-menu { flex:none; display:flex; margin-inline:-8px -4px; color:var(--primary-text-color); }
  .pf-menu[hidden] { display:none; }
  .pf-ic { flex:none; width:40px; height:40px; border-radius:50%; display:grid; place-items:center; color:var(--pf-accent);
           background:color-mix(in srgb, currentColor 14%, transparent); }
  .pf-ic svg, .pf-ic img { width:22px; height:22px; fill:currentColor; }
  .pf-ic ha-icon, .pf-ic ha-svg-icon { --mdc-icon-size:22px; }
  .pf-names { display:flex; flex-direction:column; flex:0 1 auto; min-width:0; max-width:260px; }
  .pf-t { font-size:17px; font-weight:700; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pf-s { font-size:12.5px; line-height:1.3; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pf-s:empty { display:none; }
  .pf-pills { display:flex; gap:6px; flex:1 1 0; min-width:0; overflow-x:auto; scrollbar-width:none; padding:8px 6px 6px 2px; }
  .pf-pills::-webkit-scrollbar { display:none; }
  .pf-pill { all:unset; position:relative; flex:none; width:48px; height:40px; box-sizing:border-box; border-radius:999px; cursor:pointer;
             display:grid; place-items:center; color:var(--primary-text-color); border:1px solid var(--divider-color, rgba(0,0,0,.12)); }
  .pf-pill:hover { background:color-mix(in srgb, currentColor 6%, transparent); }
  .pf-pill[aria-selected="true"] { color:var(--pf-accent); border:1.5px solid var(--pf-accent); background:color-mix(in srgb, var(--pf-accent) 14%, transparent); }
  .pf-pill:focus-visible { outline:2px solid var(--pf-accent); outline-offset:2px; }
  .pf-pill svg { width:20px; height:20px; fill:currentColor; flex:none; }
  .pf-pill ha-icon { --mdc-icon-size:20px; display:flex; }
  .pf-pill .pf-l { font-size:14px; font-weight:700; }
  .pf-pill b { position:absolute; top:-5px; right:-5px; min-width:18px; height:18px; padding:0 4px; box-sizing:border-box; border-radius:999px;
               font-size:11px; font-weight:700; line-height:14px; text-align:center; color:#fff; background:var(--pf-accent);
               border:2px solid var(--card-background-color, #fff); }
  .pf-end { display:flex; align-items:center; gap:8px; flex:0 1 auto; min-width:0; margin-inline-start:auto; }
  .pf-end > :not(.pf-stat):not(.pf-acts) { min-width:0; max-width:220px; }
  .pf-stat { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:999px; font-size:12px; font-weight:600;
             white-space:nowrap; color:var(--pf-c); background:color-mix(in srgb, var(--pf-c) 14%, transparent); }
  .pf-stat > i { width:8px; height:8px; border-radius:50%; background:currentColor; flex:none; }
  .pf-stat:empty, .pf-stat[hidden] { display:none; }
  .pf-acts { display:flex; gap:8px; }
  .pf-acts > * { all:unset; box-sizing:border-box; cursor:pointer; width:40px; height:40px; border-radius:50%; display:grid; place-items:center;
                 color:var(--primary-text-color); border:1px solid var(--divider-color, rgba(0,0,0,.12)); }
  .pf-acts > *:hover { background:color-mix(in srgb, currentColor 6%, transparent); }
  .pf-acts > *:focus-visible { outline:2px solid var(--pf-accent); outline-offset:2px; }
  .pf-acts > *[disabled] { opacity:.6; cursor:default; }
  .pf-acts svg { width:20px; height:20px; fill:currentColor; }
  .pf-acts > .on { color:var(--pf-on, var(--pf-accent)); border:1.5px solid currentColor; background:color-mix(in srgb, currentColor 14%, transparent); }
  .pf-acts ha-icon { --mdc-icon-size:20px; display:flex; }
  .pf-acts .spin svg, .pf-acts .spinning svg { animation:pf-spin 1s linear infinite; }
  @keyframes pf-spin { to { transform:rotate(360deg); } }
  .pf-extra:empty { display:none; }
  .pf-subs { position:absolute; left:0; right:0; top:100%; display:flex; gap:4px; padding:0 12px; overflow-x:auto; scrollbar-width:none;
             background:var(--card-background-color, #fff); border-bottom:1px solid var(--divider-color, rgba(0,0,0,.12));
             box-shadow:0 2px 8px rgba(0,0,0,.08); }
  .pf-subs[hidden] { display:none; }
  .pf-subs::-webkit-scrollbar { display:none; }
  .pf-sub { all:unset; flex:none; display:inline-flex; align-items:center; gap:6px; padding:9px 10px 7px; cursor:pointer; font-size:13px;
            font-weight:500; color:var(--secondary-text-color); border-bottom:2px solid transparent; white-space:nowrap; --mdc-icon-size:18px; }
  .pf-sub:hover { color:var(--primary-text-color); }
  .pf-sub[aria-selected="true"] { color:var(--primary-text-color); border-bottom-color:var(--pf-accent); }
  .pf-sub[aria-selected="true"] ha-icon { color:var(--pf-accent); }
  .pf-sub:focus-visible { outline:2px solid var(--pf-accent); outline-offset:-2px; }
  @container (max-width: 600px) {
    .pf-bar { min-height:0; padding:12px 12px 0 16px; column-gap:10px; row-gap:2px; }
    .pf-names { flex:1 1 0; max-width:none; }
    .pf-t { font-size:17px; }
    .pf-pills { order:9; flex:1 0 100%; margin:0 -12px 0 -16px; padding:6px 12px 10px; }
    .pf-stat { width:26px; height:26px; padding:0; justify-content:center; }
    .pf-stat > span { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
    .pf-acts > *:not(:first-child) { display:none; }
    .pf-end > :not(.pf-stat):not(.pf-acts) { max-width:120px; }
    .pf-amenu .pf-acts > *, .pf-amenu .pf-acts > *:not(:first-child) { display:none; }
    .pf-amenu .pf-acts > .on { display:grid; position:relative; }
    .pf-amenu .pf-acts > .on::after { content:""; position:absolute; right:-3px; bottom:-3px; width:14px; height:14px; border-radius:50%;
      background:var(--card-background-color, #fff) no-repeat center / 12px
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
      box-shadow:0 0 0 1px var(--divider-color, rgba(0,0,0,.12)); }
    .pf-amenu.pf-open .pf-acts { position:absolute; z-index:3; right:8px; top:8px; flex-direction:column; padding:6px; border-radius:26px;
      background:var(--card-background-color, #fff); box-shadow:0 6px 18px rgba(0,0,0,.18); }
    .pf-amenu.pf-open .pf-acts > * { display:grid; }
    .pf-amenu.pf-open .pf-acts > .on::after { display:none; }
  }
`;

/**
 * Folds the panel's top bar on scroll. `o`: `top` and `tabs` (the top bar and the tab row), `tab` (a tab, in the
 * row), `key` (a tab's id, from the button), `icons` (id → SVG path), `badge` (a tab's count, in it), `name`, `sub`,
 * `icon`, `status` (in the top bar), `acts` (its round buttons), `accent` (CSS colour), `extra` (an element shown
 * under the bar when folded, such as a sub-tab row: moved there while folded), `side` (an element moved before the
 * status pill while folded, such as an account picker), `subtab` (the sub-tabs of the tab shown, in the page:
 * mirrored in a row under the folded bar), `mount` (the node the folded bar goes before, when not the top bar), `menu` (() => ({ hass, narrow,
 * show })) for Home Assistant's menu button, `css` (the panel's own rules while folded; the folded bar's height is
 * `--pf-h` on the panel), `actsMenu` (narrow: only the active button `.on`, which opens the others, such as alarm
 * modes), `folded` (start folded: the page was drawn again while folded), `badgeColors` (the counts take the colours of the tabs' own badges), `skip` (() => true while the top bar must not fold). Returns { sync, detach }, or null when the panel has no top bar.
 */
function proxmoxPanelFold(host, o) {
  const root = host.shadowRoot;
  const q = (sel) => (sel ? root?.querySelector?.(sel) : null);
  const top = q(o.top);
  const tabs = q(o.tabs);
  host.removeAttribute?.("pf-folded");
  if (!root || !top || !tabs || typeof root.querySelector !== "function") return null;
  if (!root.getElementById?.("pf-style")) {
    const style = document.createElement("style");
    style.id = "pf-style";
    style.textContent = proxmoxPanel_FOLD_CSS + (o.css || "");
    root.appendChild(style);
  }
  top.classList.add("pf-top");
  tabs.classList.add("pf-tabs");
  const sense = document.createElement("div");
  sense.className = "pf-sense";
  sense.setAttribute("aria-hidden", "true");
  sense.innerHTML = '<i class="pf-s1"></i><i class="pf-s2"></i>';
  const fold = document.createElement("div");
  fold.className = "pf-fold";
  fold.style.setProperty("--pf-accent", o.accent);
  if (o.actsMenu) fold.classList.add("pf-amenu");
  fold.innerHTML = `<div class="pf-bar"><span class="pf-menu" hidden></span><span class="pf-ic" aria-hidden="true"></span>
    <div class="pf-names"><span class="pf-t"></span><span class="pf-s"></span></div>
    <div class="pf-pills" role="tablist"></div>
    <div class="pf-end"><span class="pf-stat" role="status"></span><div class="pf-acts"></div></div></div><div class="pf-extra"></div><div class="pf-subs" role="tablist" hidden></div>`;
  const at = o.mount || top;
  at.parentNode.insertBefore(sense, at);
  at.parentNode.insertBefore(fold, at);
  const el = (c) => fold.querySelector(c);
  // Home Assistant's menu button, in a shadow root of its own: the panel's own look-ups of its menu button never
  // find this one
  const menuBtn = document.createElement("ha-menu-button");
  el(".pf-menu").attachShadow?.({ mode: "open" })?.append(menuBtn);
  // A copy keeps the icons of its ha-icon elements, which panels often set as a property (not copied by cloneNode)
  const copyIcons = (from, to) => {
    const a = from.matches?.("ha-icon") ? [from] : [...from.querySelectorAll("ha-icon")];
    const b = to.matches?.("ha-icon") ? [to] : [...to.querySelectorAll("ha-icon")];
    a.forEach((n, i) => {
      const icon = n.icon || n.getAttribute("icon");
      if (b[i] && icon) b[i].setAttribute("icon", icon);
    });
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  let folded = false;
  let queued = false;
  let extraHome = null;
  let sideHome = null;

  const tabButtons = () => [...tabs.querySelectorAll(o.tab)];
  const tabLabel = (b) => {
    const clone = b.cloneNode(true);
    for (const n of clone.querySelectorAll?.(`${o.badge || ".badge"}, ha-menu-button, svg`) || []) n.remove();
    return (b.getAttribute("aria-label") || clone.textContent || "").trim();
  };
  const isActive = (b) => b.classList.contains("active") || b.getAttribute("aria-selected") === "true";

  const sync = () => {
    queued = false;
    if (!folded) return;
    const iconBox = q(o.icon);
    const icon = iconBox?.querySelector("svg, ha-icon, ha-svg-icon, img");
    const iconCopy = icon?.cloneNode(true);
    if (iconCopy) copyIcons(icon, iconCopy);
    el(".pf-ic").replaceChildren(...(iconCopy ? [iconCopy] : []));
    // The icon keeps the colour of its state, as in the top bar
    el(".pf-ic").style.color = iconBox && !o.iconAccent ? getComputedStyle(iconBox).color : "";
    el(".pf-t").textContent = (q(o.name)?.textContent || "").trim();
    el(".pf-s").textContent = (q(o.sub)?.textContent || "").trim();
    const st = q(o.status);
    const stat = el(".pf-stat");
    const text = (st?.textContent || "").trim();
    stat.hidden = !text;
    if (text) {
      stat.style.setProperty("--pf-c", getComputedStyle(st).color || "var(--pf-accent)");
      stat.setAttribute("aria-label", text);
      stat.innerHTML = `<i></i><span>${esc(text)}</span>`;
    }
    const focused = root.activeElement?.closest?.(".pf-pill")?.dataset.i;
    const shown = tabs.hidden ? [] : tabButtons();
    el(".pf-pills").innerHTML = (shown.length > 1 ? shown : [])
      .map((b, i) => {
        const id = o.key(b);
        const label = tabLabel(b);
        const badgeEl = b.querySelector(o.badge || ".badge");
        const count = (badgeEl?.textContent || "").trim();
        // The count in the colour of its tab's own badge (its tone), where the panel colours them
        let tone = "";
        if (count && o.badgeColors) {
          const cs = getComputedStyle(badgeEl);
          tone = ` style="background:${cs.backgroundColor};color:${cs.color}"`;
        }
        const path = o.icons[id];
        const own = path ? null : b.querySelector("svg, ha-icon");
        const ownIcon = own?.localName === "ha-icon" ? own.icon || own.getAttribute("icon") : null;
        const glyph = !path
          ? own
            ? ownIcon
              ? `<ha-icon icon="${esc(ownIcon)}" aria-hidden="true"></ha-icon>`
              : own.outerHTML
            : `<span class="pf-l" aria-hidden="true">${esc(label.slice(0, 1))}</span>`
          : path.startsWith("mdi:")
            ? `<ha-icon icon="${esc(path)}" aria-hidden="true"></ha-icon>`
            : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
        const on = isActive(b);
        return `<button class="pf-pill" role="tab" data-i="${i}" aria-selected="${on}" tabindex="${on ? 0 : -1}" title="${esc(label)}" aria-label="${esc(count ? `${label} (${count})` : label)}">${glyph}${count ? `<b aria-hidden="true"${tone}>${esc(count)}</b>` : ""}</button>`;
      })
      .join("");
    if (focused !== undefined) el(`.pf-pill[data-i="${focused}"]`)?.focus({ preventScroll: true });
    // The active pill in sight in a scrolling row, without scrolling the page
    const row = el(".pf-pills");
    const act = el(".pf-pill[aria-selected=true]");
    if (act && (act.offsetLeft < row.scrollLeft || act.offsetLeft + act.offsetWidth > row.scrollLeft + row.clientWidth)) {
      row.scrollLeft = Math.max(0, act.offsetLeft - 16);
    }
    // The sub-tabs of the tab shown (in the page, under the top bar), mirrored in a row under the folded bar
    const subs = o.subtab ? [...root.querySelectorAll(o.subtab)].filter((b) => !fold.contains(b)) : [];
    const subRow = el(".pf-subs");
    subRow.hidden = subs.length < 2;
    subRow.innerHTML = subs.length < 2 ? "" : subs
      .map((b, i) => {
        const on = isActive(b);
        const hi = b.querySelector("ha-icon");
        const ic = hi && (hi.icon || hi.getAttribute("icon"));
        return `<button class="pf-sub" role="tab" data-s="${i}" aria-selected="${on}" tabindex="${on ? 0 : -1}">${ic ? `<ha-icon icon="${esc(ic)}" aria-hidden="true"></ha-icon>` : ""}${esc(tabLabel(b))}</button>`;
      })
      .join("");
    subRow.onclick = (ev) => {
      const sb = ev.target.closest?.(".pf-sub");
      if (sb) subs[Number(sb.dataset.s)]?.click();
    };
    const acts = el(".pf-acts");
    acts.textContent = "";
    for (const a of o.acts ? root.querySelectorAll(o.acts) : []) {
      if (a.offsetParent === null && !top.contains(a)) continue;
      const c = a.cloneNode(true);
      copyIcons(a, c);
      c.removeAttribute("id");
      // An active button (`.on`) keeps the colour of its state
      if (c.classList.contains("on")) c.style.setProperty("--pf-on", getComputedStyle(a).color);
      if (c.tagName !== "A") {
        // The panel's own click handlers see the original only (its data-* stay off the copy)
        for (const n of [c, ...c.querySelectorAll("*")]) for (const at of [...n.attributes]) if (at.name.startsWith("data-")) n.removeAttribute(at.name);
        c.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          // Narrow, with `actsMenu`: the active button opens the list of the others first
          if (o.actsMenu && fold.clientWidth <= 600 && (!fold.classList.contains("pf-open") || c.classList.contains("on"))) {
            fold.classList.toggle("pf-open");
            return;
          }
          fold.classList.remove("pf-open");
          a.click();
        });
      }
      acts.appendChild(c);
    }
    const m = o.menu?.();
    el(".pf-menu").hidden = !m?.show;
    if (m) {
      menuBtn.hass = m.hass;
      menuBtn.narrow = m.narrow;
    }
  };
  const queue = () => {
    if (queued || !folded) return;
    queued = true;
    requestAnimationFrame(sync);
  };

  const setFolded = (v) => {
    if (v === folded) return;
    if (v) {
      const t = top.getBoundingClientRect();
      const b = tabs.getBoundingClientRect();
      if (!t.height || o.skip?.()) return; // top bar hidden (Settings): the tabs alone stay sticky
      const extra = q(o.extra);
      // The room of the top bar and the tabs (and an extra row), by their heights: the tabs may be stuck at the top
      // already (a jump down the page), where their position says nothing of the room they take in the page
      const room = t.height + b.height + (extra ? extra.getBoundingClientRect().height : 0);
      folded = true;
      sync();
      if (extra) {
        extraHome = [extra.parentNode, extra.nextSibling];
        el(".pf-extra").appendChild(extra);
      }
      const side = q(o.side);
      if (side) {
        sideHome = [side.parentNode, side.nextSibling];
        el(".pf-end").prepend(side);
      }
      // Measured out of the flow first, so that the content never moves (nor the browser's scroll anchoring with it)
      fold.style.width = `${t.width}px`;
      fold.classList.add("pf-measure");
      const h = fold.offsetHeight;
      fold.classList.remove("pf-measure");
      fold.style.width = "";
      fold.style.marginBottom = `${Math.round(room - h)}px`;
      host.style.setProperty("--pf-h", `${h}px`);
      host.setAttribute("pf-folded", "");
    } else {
      folded = false;
      const extra = el(".pf-extra").firstElementChild;
      if (extra && extraHome) extraHome[0].insertBefore(extra, extraHome[1] && extraHome[1].parentNode === extraHome[0] ? extraHome[1] : null);
      extraHome = null;
      const side = sideHome && el(".pf-end").firstElementChild;
      if (side && !side.matches(".pf-stat")) sideHome[0].insertBefore(side, sideHome[1] && sideHome[1].parentNode === sideHome[0] ? sideHome[1] : null);
      sideHome = null;
      host.removeAttribute("pf-folded");
      fold.style.marginBottom = "";
    }
  };

  el(".pf-pills").addEventListener("click", (ev) => {
    const p = ev.target.closest?.(".pf-pill");
    if (p) tabButtons()[Number(p.dataset.i)]?.click();
  });
  el(".pf-pills").addEventListener("keydown", (ev) => {
    const step = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
    const p = ev.target.closest?.(".pf-pill");
    if (!step || !p) return;
    ev.preventDefault();
    const all = [...el(".pf-pills").children];
    all[(Number(p.dataset.i) + step + all.length) % all.length]?.focus();
  });

  // The list of buttons opened (narrow, `actsMenu`) closes at a click elsewhere
  const closeMenu = (ev) => {
    if (fold.classList.contains("pf-open") && !ev.composedPath().includes(el(".pf-acts"))) fold.classList.remove("pf-open");
  };
  if (o.actsMenu) root.addEventListener("click", closeMenu, true);
  let io = null;
  if (typeof IntersectionObserver === "function") {
    const [s1, s2] = sense.children;
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const above = !e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0);
        if (e.target === s1 && above) setFolded(true);
        if (e.target === s2 && e.isIntersecting) setFolded(false);
      }
    });
    io.observe(s1);
    io.observe(s2);
  }
  const mo = typeof MutationObserver === "function" ? new MutationObserver(queue) : null;
  mo?.observe(top, { subtree: true, childList: true, characterData: true, attributes: true });
  mo?.observe(tabs, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "aria-selected", "hidden"] });
  // Drawn again while folded (a panel that rewrites its page): folded straight away, without a frame unfolded
  if (o.folded) setFolded(true);
  return {
    sync: queue,
    detach() {
      root.removeEventListener?.("click", closeMenu, true);
      io?.disconnect();
      mo?.disconnect();
      setFolded(false);
      sense.remove();
      fold.remove();
      host.removeAttribute("pf-folded");
    },
  };
}
// ── End of the folded top bar ──

export class ProxmoxPanel extends HTMLElement {
  static STYLE = `${PROXMOX_SHARED_STYLE}
    :host { display:block; min-height:100%; background:var(--primary-background-color); color:var(--primary-text-color);
            ${PROXMOX_VARS} }
    /* The top bar: the cards' illustrated header across the page (server-room wall, rack, ground strip), the round
       Proxmox icon in the worst state's colour, the title and its status pill, the round frosted buttons at the right. */
    ${PROXMOX_BANNER_STYLE}
    .banner { container:px-bar / inline-size; }
    .banner .px-scene { right:76px; }
    .banner .px-cable { right:148px; }
    .htext { position:absolute; left:8px; top:0; bottom:10px; right:186px; display:flex; align-items:center; gap:8px; min-width:0; }
    .htext ha-menu-button { flex:none; color:inherit; }
    .hinfo { display:contents; }
    .htext .badge .i { width:22px; height:22px; }
    .tt { min-width:0; display:flex; flex-direction:column; gap:2px; }
    .trow { display:flex; align-items:center; gap:8px; min-width:0; }
    .htext .n { font-size:18px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
    .trow .pill { flex:none; }
    .htext .s { font-size:12.5px; color:#4a5768; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .night .htext .s { color:rgba(255,255,255,.78); }
    /* The pill's dot alone when the title and its label do not fit (its label in its tooltip) */
    .trow.dot-only .pill { font-size:0; gap:0; padding:0; width:16px; height:16px; justify-content:center; }
    .hbtns { position:absolute; right:8px; top:0; bottom:10px; display:flex; align-items:center; gap:6px; }
    .hbtn { all:unset; box-sizing:border-box; cursor:pointer; width:36px; height:36px; border-radius:50%; display:grid; place-items:center; flex:none;
            color:#33506b; background:rgba(255,255,255,.55); box-shadow:inset 0 0 0 1px rgba(255,255,255,.7); -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); }
    .hbtn:hover { background:rgba(255,255,255,.75); }
    .night .hbtn { color:#fff; background:rgba(255,255,255,.12); box-shadow:inset 0 0 0 1px rgba(255,255,255,.2); }
    .night .hbtn:hover { background:rgba(255,255,255,.22); }
    .hbtn:focus-visible { outline:2px solid var(--px-accent); outline-offset:1px; }
    .hbtn .i { width:18px; height:18px; }
    .hbtn.spinning .i { animation:px-spin 1s linear infinite; }
    @keyframes px-spin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .hbtn.spinning .i { animation:none; } }
    /* Narrow: no picture, no subtitle, the pill as its dot, the settings button alone */
    @container px-bar (max-width: 340px) {
      .px-scene, .px-cable, .htext .s, .hbtn[data-action="reload"] { display:none; }
      .htext { right:52px; }
      .trow .pill { font-size:0; gap:0; padding:0; width:16px; height:16px; justify-content:center; }
    }
    /* Text tabs under the bar, on the card background, the active one underlined in the Proxmox orange */
    .tabs { display:flex; gap:2px; padding:0 8px; overflow-x:auto; scrollbar-width:none; background:var(--card-background-color, #fff);
            border-bottom:1px solid var(--divider-color, rgba(0,0,0,.12)); position:sticky; top:0; z-index:2; }
    .tab { background:none; border:none; border-bottom:2px solid transparent; color:var(--secondary-text-color);
           padding:13px 12px 11px; font:inherit; font-size:14px; cursor:pointer; white-space:nowrap; }
    .tab:hover { color:var(--primary-text-color); }
    .tab.active { color:var(--primary-text-color); font-weight:600; border-bottom-color:var(--px-accent); }
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
    // Kept for when its tab appears (Disks and Datastores wait for the inventory)
    this._route = tab;
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
    if (!this._fold && this.shadowRoot?.querySelector?.(".banner")) this._attachFold();
    if (this._hass && this._failed) this._load();
    clearInterval(this._historyTimer);
    this._historyTimer = setInterval(() => this.isConnected && this._loadHistory(), 300000);
  }

  disconnectedCallback() {
    proxmoxReleasePress(this);
    this._fold?.detach();
    this._fold = null;
    clearInterval(this._historyTimer);
    clearTimeout(this._retryTimer);
    // Left with a confirmation open (another panel): closed without acting, as Cancel; drawn again on the way back.
    if (this._confirm) {
      this._confirm = null;
      this._bodies = {};
    }
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
          if ([].concat(events || []).some((ev) => ev?.entry?.domain === "proxmoxve" || ev?.entry?.domain === "proxmox_sensors")) this._load();
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
    if (this._settings?.show_history === false) return;
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
    // Disks and Datastores only when Proxmox Extended Sensors offers them
    return PROXMOX_PANEL_TABS.filter((tab) => !(tab in PROXMOX_PANEL_SENSOR_TABS) || this._items(PROXMOX_PANEL_SENSOR_TABS[tab]).length);
  }

  _goTab(tab, focus) {
    if (!this._tabs().includes(tab)) return;
    this._route = tab;
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

  /** The top bar folds on scroll into one bar with the tabs as icon pills (see proxmoxPanelFold). */
  _attachFold() {
    this._fold?.detach();
    this._fold = proxmoxPanelFold(this, {
      top: ".banner",
      tabs: ".tabs",
      tab: ".tab",
      key: (b) => b.dataset.tab,
      icons: {
        nodes: "mdi:server",
        vms: "mdi:monitor",
        containers: "mdi:cube-outline",
        storage: "mdi:database-outline",
        backups: "mdi:backup-restore",
        disks: "mdi:harddisk",
        datastores: "mdi:folder-network-outline",
        settings: "mdi:cog",
      },
      badge: ".cnt",
      name: ".banner .n",
      sub: ".banner .s",
      icon: ".banner .badge",
      status: ".banner .pill.st",
      acts: ".banner .hbtns > *",
      accent: "#e57000",
      menu: () => ({ hass: this._hass, narrow: this._narrow, show: true }),
    });
  }

  _render() {
    const root = this.shadowRoot;
    const esc = proxmoxPanelEsc;
    const tabs = this._tabs();
    if (this._route && tabs.includes(this._route)) this._tab = this._route;
    else if (!tabs.includes(this._tab)) this._tab = "nodes";
    root.innerHTML = `
      <style>${ProxmoxPanel.STYLE}</style>
      <header class="banner idle"><div class="px-ground"></div><div class="scene"></div>
        <div class="htext"><ha-menu-button></ha-menu-button><div class="hinfo"></div></div><div class="hbtns"></div></header>
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
    root.querySelector(".hbtns")?.addEventListener("click", (ev) => ev.target.closest?.("[data-action=reload]") && this._reload());
    this._header = {};
    this._renderHeader();
    this._bodies = {};
    this._renderTab(this._tab, true);
    this._attachFold();
  }

  // ── Top bar ──

  /** The top bar's state over every node and machine (idle until the inventory is in), its pill and subtitle. */
  _headerState() {
    const nodes = this._items("node");
    if (!nodes.length) return { state: "idle", dim: 1, pill: "", sub: "" };
    const guests = [...this._items("vm"), ...this._items("container")];
    const scene = proxmoxSceneOf(this._hass, nodes, guests);
    const running = guests.filter((g) => this._status(g) === "running").length;
    const counts = this._t("c_running", { running, n: guests.length });
    const pill = scene.state === "err" ? this._t("st_offline") : scene.state === "warn" ? counts : this._t("st_online");
    const names = nodes.map((n) => n.name).join(", ");
    // The machines running are in the pill on a warning: not repeated in the subtitle then.
    return { ...scene, pill, sub: scene.state === "warn" || !guests.length ? names : `${names} · ${counts}` };
  }

  /** The top bar, each part written only when its markup changed (the rack keeps blinking, the menu button stays). */
  _renderHeader() {
    const root = this.shadowRoot;
    const banner = root.querySelector?.(".banner");
    if (!banner) return;
    const esc = proxmoxPanelEsc;
    const h = this._headerState();
    banner.className = `banner ${h.state}${this._hass?.themes?.darkMode ? " night" : ""}`;
    const parts = {
      scene: `${proxmoxUplinkHtml(h.state)}${proxmoxRackSvg(h.state, "panel", h.dim)}`,
      hinfo: `<span class="badge">${proxmoxPanelIcon("logo")}</span><div class="tt"><div class="trow"><span class="n">${esc(this._t("title"))}</span>${
        h.pill ? `<span class="pill st" title="${esc(h.pill)}">${esc(h.pill)}</span>` : ""
      }</div>${h.sub ? `<span class="s" title="${esc(h.sub)}">${esc(h.sub)}</span>` : ""}</div>`,
      hbtns: `${this._inv?.configured ? `<button class="hbtn${this._reloading ? " spinning" : ""}" data-action="reload" title="${esc(this._t("refresh"))}" aria-label="${esc(this._t("refresh"))}">${proxmoxPanelIcon("restart")}</button>` : ""}
        <a class="hbtn" href="/config/integrations/integration/proxmoxve" title="${esc(this._t("open_integration"))}" aria-label="${esc(this._t("open_integration"))}">${proxmoxPanelIcon("cog")}</a>`,
    };
    for (const [cls, html] of Object.entries(parts)) {
      if (this._header[cls] === html) continue;
      this._header[cls] = html;
      const el = banner.querySelector(`.${cls}`);
      if (el) el.innerHTML = html;
    }
    this._fitHeader();
  }

  /** The pill as its dot alone when the whole title and its whole label do not fit beside each other. */
  _fitHeader() {
    const row = this.shadowRoot.querySelector?.(".trow");
    if (!row?.getClientRects?.().length) return;
    row.classList.remove("dot-only");
    if (row.scrollWidth > row.clientWidth + 0.5 || row.querySelector(".n")?.scrollWidth > row.querySelector(".n")?.clientWidth + 0.5) row.classList.add("dot-only");
  }

  /** The refresh button: the inventory read again (machines added or removed in Proxmox VE), the icon turning meanwhile. */
  async _reload() {
    if (this._reloading) return;
    this._reloading = true;
    this._renderHeader();
    try {
      await this._load();
    } finally {
      this._reloading = false;
      this._renderHeader();
    }
  }

  /** States changed: the shown tab's body again, only if its markup changed (the search keeps its focus). */
  _refresh() {
    // A press in progress: drawn once released (see _onPressStart).
    if (this._pressing) {
      this._dirty = true;
      return;
    }
    this._renderHeader();
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
    if (tab === "disks") return this._disksHtml();
    if (tab === "datastores") return this._datastoresHtml();
    return "";
  }

  // ── Nodes tab ──

  _ringHtml(label, pct, color, sub, historyId) {
    return proxmoxRing(label, pct, color, sub, this._settings?.show_history === false ? [] : this._history[historyId] || []);
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
      const diskPct = this._num(e.disk_pct) ?? (disk !== null && maxDisk ? (disk / maxDisk) * 100 : null);
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
          ${proxmoxHealthBand(this._hass, lang, node)}
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

  // ── Disks tab (Proxmox Extended Sensors) ──

  _disksHtml() {
    const esc = proxmoxPanelEsc;
    const lang = this._lang();
    const disks = this._items("disk");
    const several = this._items("node").length > 1;
    const rows = disks.map((d) => {
      const e = d.entities;
      const health = this._state(e.health)?.state;
      const tone = health ? (/fail|error|bad/i.test(health) ? "bad" : /ok|pass|healthy/i.test(health) ? "good" : "") : "";
      const temp = this._num(e.temperature);
      const wear = this._num(e.wearout);
      const power = this._num(e.power_on);
      const node = several ? ` <span class="id">· ${esc(this._nodeName(d.node))}</span>` : "";
      const facts = [
        temp !== null ? `<span>${proxmoxPanelIcon("temp")}${Math.round(temp)} °C</span>` : "",
        wear !== null ? `<span>${esc(this._t("d_wearout"))} ${Math.round(wear)} %</span>` : "",
        power !== null ? `<span>${esc(this._t("d_power_on", { d: proxmoxPanelDuration(power * 3600, lang) }))}</span>` : "",
      ].join("");
      const pill = health ? `<span class="pill ${tone}">${esc(health)}</span>` : "";
      return `<div class="srow"><div class="line">${proxmoxPanelIcon("harddisk")}<span class="n" style="flex:1">${esc(d.name)}${node}</span>${pill}</div>
          ${facts ? `<div class="m">${facts}</div>` : ""}</div>`;
    });
    return `<div class="box">${this._notesHtml("disks")}
        <div class="list">${rows.length ? rows.join("") : `<div class="note">${esc(this._t("empty_disks"))}</div>`}</div></div>`;
  }

  // ── Datastores tab (Proxmox Backup Server, Proxmox Extended Sensors) ──

  _datastoresHtml() {
    const esc = proxmoxPanelEsc;
    const list = this._items("pbs");
    const pill = (e, slot, label) => {
      const s = this._state(e[slot])?.state;
      if (!s) return "";
      const tone = /fail|error/i.test(s) ? "bad" : /ok|done|finished|success|valid/i.test(s) ? "good" : "";
      return `<span class="pill ${tone}">${esc(this._t(label))}: ${esc(s)}</span>`;
    };
    const rows = list.map((p) => {
      const e = p.entities;
      const pct = this._num(e.used_pct);
      const color = pct === null ? "transparent" : pct >= 90 ? "var(--tone-bad)" : pct >= 75 ? "var(--tone-warn)" : "var(--tone-good)";
      const dedup = this._state(e.dedup)?.state;
      const last = this._state(e.last_backup);
      const time = last ? Date.parse(last.state) : Number.NaN;
      const pills = [pill(e, "gc_status", "pbs_gc"), pill(e, "prune_status", "pbs_prune"), pill(e, "verify_status", "pbs_verify")].join("");
      const facts = [
        Number.isFinite(time) ? `<span>${esc(this._t("pbs_backup", { when: this._ago(time) }))}</span>` : "",
        dedup ? `<span>${esc(this._t("pbs_dedup", { v: dedup }))}</span>` : "",
      ].join("");
      return `<div class="srow"><div class="line">${proxmoxPanelIcon("server")}<span class="n" style="flex:1">${esc(p.name)}</span><span class="pct">${pct === null ? "" : this._pct(pct)}</span></div>
          ${pct === null ? "" : `<div class="bar"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%;background:${color}"></i></div>`}
          ${pills ? `<div class="acts">${pills}</div>` : ""}${facts ? `<div class="m">${facts}</div>` : ""}</div>`;
    });
    return `<div class="box">${this._notesHtml("datastores")}
        <div class="list">${rows.length ? rows.join("") : `<div class="note">${esc(this._t("empty_datastores"))}</div>`}</div></div>`;
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
        ${toggle("show_history", "s_show_history")}
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
        // The curves behind the rings, shown again: their history, loaded now
        if (res.settings.show_history !== false && !Object.keys(this._history).length) this._loadHistory();
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
