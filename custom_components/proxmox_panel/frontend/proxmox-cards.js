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
  PROXMOX_PANEL_ACTIONS,
  PROXMOX_PANEL_CUTTING,
  PROXMOX_PANEL_FOR_STATUS,
  PROXMOX_PANEL_LANGS,
  PROXMOX_SHARED_STYLE,
  PROXMOX_VARS,
  proxmoxBytesOf,
  proxmoxFind,
  proxmoxHealthBand,
  proxmoxHistory,
  proxmoxHoldUnderPress,
  proxmoxLang,
  proxmoxLoadStrings,
  proxmoxNum,
  proxmoxPanelBytes,
  proxmoxPanelDuration,
  proxmoxPanelEsc as esc,
  proxmoxPanelIcon as icon,
  proxmoxPct,
  proxmoxReleasePress,
  proxmoxState,
  proxmoxStatus,
  proxmoxStatusPill,
  proxmoxT,
  proxmoxUptime,
} from "./proxmox-common.js";

export const PROXMOX_CARDS_VERSION = "1.4.2";
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

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to
// the page. The handler runs when the press and the release are both outside the card (a slider dragged out of the
// card does not count), and a scroll does not count (the browser cancels the pointer); keyboard clicks still go
// through the click event. The handler keeps its own checks (outside of the card, not in a dialog).
const watchOutside = (card, handler) => {
  let downOutside = false;
  const onDown = (ev) => {
    downOutside = !ev.composedPath().includes(card);
  };
  const onUp = (ev) => {
    if (downOutside) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0) handler(ev);
  };
  return {
    on() {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("click", onClick, true);
    },
    off() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("click", onClick, true);
    },
    // A tap (press and release at the same spot), for the tests.
    tap(ev) {
      onDown(ev);
      onUp(ev);
    },
  };
};

/** A node by its name, its Proxmox id (node/pve1) or its device id. */
const findNode = (nodes, wanted) => {
  const w = String(wanted).toLowerCase();
  return nodes.find((n) => n.name.toLowerCase() === w || n.key.toLowerCase() === w || n.key.toLowerCase() === `node/${w}` || n.id === wanted);
};

// The thresholds of the gauges (orange, then red), those of System Hub's System Monitor card
const GAUGE_LEVELS = { cpu: [70, 90], ram: [70, 90], disk: [80, 90] };
const gaugeLevel = (metric, pct) => {
  if (pct === null) return "muted";
  const [warn, crit] = GAUGE_LEVELS[metric];
  return pct >= crit ? "crit" : pct >= warn ? "warn" : "ok";
};

/** The last 24 hours of a percentage behind a whole gauge, 0 % at its bottom and 100 % at its top. */
const gaugeCurve = (points) => {
  const t0 = Date.now() - 86400000;
  const recent = (points || []).filter(([t]) => t >= t0);
  if (recent.length < 2) return "";
  const y = (p) => (30 - (Math.max(0, Math.min(100, p)) / 100) * 28).toFixed(2);
  const xy = recent.map(([t, p]) => `${(((t - t0) / 86400000) * 100).toFixed(2)},${y(p)}`);
  const line = `M${xy.join("L")}L100,${y(recent[recent.length - 1][1])}`;
  return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="spark-a" d="${line}L100,30L${xy[0].split(",")[0]},30Z"/><path class="spark-l" d="${line}"/></svg>`;
};

// ── Illustrated header ──

// The header's state: ok (running), warn (some machines stopped, suspended), idle (stopped), err (node down,
// unavailable). It colours the icon, the rack's lights and its "PVE" tag.
const SCENE_TAG = { ok: "#43a047", warn: "#f29d0b", idle: "#8a94a3", err: "#e5484d" };

/** The state of a machine, and of several machines (the worst of them). */
const guestScene = (statuses) => {
  if (!statuses.length || statuses.includes("unavailable")) return "err";
  if (statuses.every((s) => s === "running")) return "ok";
  if (statuses.every((s) => s === "stopped")) return "idle";
  return "warn";
};

/**
 * The picture at the right of the banner, 110 × 80 above its 10 px ground strip: a server rack standing on the floor
 * (six units, their status lights blinking), and its "PVE" tag in the state's colour. `dim` counts the units drawn
 * stopped (warn); `tagLow` moves the tag under the zoom button of the mini cards; `uid` keeps the gradient of each card apart on a page with several cards.
 */
const rackSvg = (state, uid, dim = 1, tagLow = false) => {
  const units = Array.from({ length: 6 }, (_, r) => {
    const y = 13 + r * 10.6;
    const off = state === "idle" || (state === "err" && r > 0) || (state === "warn" && r >= 6 - dim);
    const led = state === "err" && r === 0 ? SCENE_TAG.err : off ? (state === "warn" ? SCENE_TAG.warn : "#59616e") : r % 2 ? "#2f80ed" : "#43c463";
    const blink = !off ? ` class="px-blink" style="animation-delay:${(r * 0.2).toFixed(1)}s"` : "";
    return `<rect class="px-unit${off ? " off" : ""}" x="38" y="${y}" width="32" height="8" rx="1.4"/><circle${blink} cx="42" cy="${y + 4}" r="1.2" fill="${led}"/>
      <rect class="px-slot" x="46" y="${y + 3.2}" width="${12 + ((r * 7) % 10)}" height="1.6" rx=".8"/><rect class="px-slot" x="64" y="${y + 2}" width="3" height="4" rx=".6"/>`;
  }).join("");
  return `<svg class="px-scene" viewBox="0 0 110 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
    <defs><linearGradient id="px-sheen-${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <rect class="px-rack" x="34" y="7" width="40" height="73" rx="3"/><rect x="34" y="7" width="40" height="73" rx="3" fill="url(#px-sheen-${uid})"/>
    <rect class="px-top" x="38" y="9.2" width="32" height="1.4" rx=".7"/>${units}
    <g transform="translate(88 ${tagLow ? 56 : 22})"><rect x="-12" y="-8" width="24" height="16" rx="3" fill="${SCENE_TAG[state]}"/><text y="3" text-anchor="middle" font-size="7" font-weight="700" fill="#fff" font-family="sans-serif">PVE</text></g>
  </svg>`;
};

/**
 * The network uplink of the banner: a cable along the top of the ground strip into the rack, its packets in the
 * state's colour. Running: packets flowing in; warning: slower, sparser packets; node down: red dashes blinking, no
 * flow; stopped: a grey cable, nothing moving.
 */
export const UPLINK_MODES = { ok: "flow", warn: "slow", err: "cut", idle: "still" };
export const uplinkMode = (state) => UPLINK_MODES[state] || "still";
const uplinkHtml = (state) => `<div class="px-cable ${uplinkMode(state)}" aria-hidden="true"></div>`;

// The banner: 90 px high, a server room's wall, the rack at its right and a 10 px concrete strip edge to edge at its
// bottom; the round icon, the title and the subtitle on the wall at its left. Day and night pictures.
const BANNER_STYLE = `
  ha-card { container:px-card / inline-size; }
  .banner { --st:var(--tone-good); position:relative; overflow:hidden; height:90px; flex:none; margin:-14px -16px 0; color:#1b2533; background:#e3e8ef; }
  .banner.night { color:#fff; background:#161c28; }
  .banner.warn { --st:var(--tone-warn); } .banner.err { --st:var(--tone-bad); } .banner.idle { --st:#8a94a3; }
  .px-ground { position:absolute; left:0; right:0; bottom:0; height:10px; background:#9aa1a9; box-shadow:inset 0 2px 0 #b5bbc2; }
  .night .px-ground { background:#2c323b; box-shadow:inset 0 2px 0 #39404a; }
  .px-scene { position:absolute; right:0; bottom:10px; height:80px; width:110px; }
  .px-rack { fill:#2a3038; } .night .px-rack { fill:#262c35; stroke:#3a4352; stroke-width:.8; }
  .px-top { fill:#3d4552; }
  .px-unit { fill:#3d4552; } .px-unit.off { fill:#333a45; }
  .px-slot { fill:#5c6678; } .err .px-rack, .idle .px-rack { fill:#2f343c; }
  .px-blink { animation:px-blink 1.2s steps(2) infinite; }
  @keyframes px-blink { 50% { opacity:.2; } }
  /* The uplink (see uplinkHtml): it runs under the rack, whose left side is 76 px from the banner's right. Every
     cycle divides 2.4 s, the GIFs' loop. */
  .px-cable { position:absolute; left:0; right:72px; bottom:10px; height:4px; background:#5c6678; border-radius:0 2px 2px 0; }
  .night .px-cable { background:#3a4352; }
  .px-cable::after { content:""; position:absolute; left:0; right:0; top:1px; height:2px; }
  .px-cable.flow::after { background:repeating-linear-gradient(90deg, var(--st) 0 6px, transparent 6px 18px); animation:px-flow .6s linear infinite; }
  .px-cable.slow::after { background:repeating-linear-gradient(90deg, var(--st) 0 6px, transparent 6px 36px); animation:px-flow-slow 2.4s linear infinite; }
  .px-cable.cut::after { background:repeating-linear-gradient(90deg, var(--st) 0 4px, transparent 4px 10px); animation:px-blink 1.2s steps(2) infinite; }
  .px-cable.still::after { display:none; }
  @keyframes px-flow { to { background-position:18px 0; } }
  @keyframes px-flow-slow { to { background-position:36px 0; } }
  @media (prefers-reduced-motion: reduce) { .px-blink, .px-cable::after { animation:none !important; } }
  .htext { position:absolute; left:14px; top:0; bottom:10px; right:118px; display:flex; align-items:center; gap:10px; min-width:0; }
  .htext { container:px-head / inline-size; }
  .htext .n { font-size:16px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .htext .s { font-size:13px; color:#4a5768; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .night .htext .s { color:rgba(255,255,255,.78); }
  .banner .badge { position:relative; color:var(--st); background:rgba(255,255,255,.62); box-shadow:inset 0 0 0 1px rgba(27,37,51,.12); }
  .banner.night .badge { background:rgba(255,255,255,.12); box-shadow:inset 0 0 0 1px rgba(255,255,255,.14); }
  /* Pills on the wall: a dot and the label in their colour (the status pill in the icon's, --st), on frosted glass. */
  .banner .pill { --c:#8a94a3; display:inline-flex; align-items:center; gap:4px; padding:1px 8px; line-height:16px; font-size:11px; font-weight:500;
                  background:color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color:color-mix(in srgb, var(--c) 45%, #0d2a45); }
  .banner .pill::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--c); flex:none; }
  .banner .pill.good { --c:var(--tone-good); } .banner .pill.warn { --c:var(--tone-warn); } .banner .pill.bad { --c:var(--tone-bad); } .banner .pill.st { --c:var(--st); }
  .banner.night .pill { background:color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color:color-mix(in srgb, var(--c) 35%, #ffffff); }
  /* The Proxmox logo on a white tile at the icon's bottom right, readable on any theme. */
  .brand { position:absolute; right:-4px; bottom:-4px; width:18px; height:18px; border-radius:5px; padding:2px; box-sizing:border-box;
           display:grid; place-items:center; background:#fff; color:var(--px-accent); box-shadow:0 0 0 1px rgba(27,37,51,.16), 0 1px 3px rgba(27,37,51,.18); }
  .brand .i { width:14px; height:14px; }
  /* The mini cards' zoom button: 24 px frosted round in the banner's top right corner. */
  .banner .zoom { position:absolute; z-index:2; top:5px; right:5px; width:24px; height:24px; border:0; color:#33506b;
                  background:rgba(255,255,255,.55); box-shadow:inset 0 0 0 1px rgba(255,255,255,.7); -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); }
  .banner .zoom:hover { background:rgba(255,255,255,.75); }
  .banner.night .zoom { color:#fff; background:rgba(255,255,255,.12); box-shadow:inset 0 0 0 1px rgba(255,255,255,.2); }
  .banner.night .zoom:hover { background:rgba(255,255,255,.22); }
  .banner .zoom .i { width:16px; height:16px; }
  @container (max-width: 300px) { .px-scene, .px-cable { display:none; } .htext { right:40px; } }
`;

let bannerUid = 0;

// ── Base card ──

class ProxmoxBaseCard extends HTMLElement {
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
    return `<div class="banner ${state}${this._night() ? " night" : ""}"><div class="px-ground"></div>${uplinkHtml(state)}${rackSvg(state, this._uid, dim, !!aside)}
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

// ── Node card ──

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
    const ids = new Set(nodes.map((n) => n.id));
    const guests = [...this._items("vm"), ...this._items("container")].filter((g) => ids.has(g.node)).map((g) => proxmoxStatus(this._hass, g));
    const stopped = guests.filter((s) => s !== "running").length;
    const down = nodes.some((n) => proxmoxStatus(this._hass, n) !== "online");
    return {
      state: down ? "err" : stopped ? "warn" : "ok",
      dim: guests.length ? Math.min(5, Math.max(1, Math.round((6 * stopped) / guests.length))) : 1,
    };
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

// ── Editors ──

class ProxmoxEditorBase extends HTMLElement {
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

class ProxmoxCardEditor extends ProxmoxEditorBase {
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
class ProxmoxMiniCardEditor extends ProxmoxCardEditor {
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

class ProxmoxGuestCardEditor extends ProxmoxEditorBase {
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

class ProxmoxGuestMiniCardEditor extends ProxmoxGuestCardEditor {
  static get toggles() {
    return ["zoom", "illustration", "show_network", "show_history", "show_actions", "show_title", "show_subtitle"];
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
