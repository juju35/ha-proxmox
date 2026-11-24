// ── Data shared by every card of the page ──

export const INVENTORY_TTL = 300000;
export let inventory = null; // { at, promise, data, error }

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

export const inDialog = (ev) => ev.composedPath().some((el) => /dialog|more-info/i.test(el?.tagName || ""));

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to
// the page. The handler runs when the press and the release are both outside the card (a slider dragged out of the
// card does not count), and a scroll does not count (the browser cancels the pointer); keyboard clicks still go
// through the click event. The handler keeps its own checks (outside of the card, not in a dialog).
export const watchOutside = (card, handler) => {
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
export const findNode = (nodes, wanted) => {
  const w = String(wanted).toLowerCase();
  return nodes.find((n) => n.name.toLowerCase() === w || n.key.toLowerCase() === w || n.key.toLowerCase() === `node/${w}` || n.id === wanted);
};

// The thresholds of the gauges (orange, then red), those of System Hub's System Monitor card
export const GAUGE_LEVELS = { cpu: [70, 90], ram: [70, 90], disk: [80, 90] };
export const gaugeLevel = (metric, pct) => {
  if (pct === null) return "muted";
  const [warn, crit] = GAUGE_LEVELS[metric];
  return pct >= crit ? "crit" : pct >= warn ? "warn" : "ok";
};

/** The last 24 hours of a percentage behind a whole gauge, 0 % at its bottom and 100 % at its top. */
export const gaugeCurve = (points) => {
  const t0 = Date.now() - 86400000;
  const recent = (points || []).filter(([t]) => t >= t0);
  if (recent.length < 2) return "";
  const y = (p) => (30 - (Math.max(0, Math.min(100, p)) / 100) * 28).toFixed(2);
  const xy = recent.map(([t, p]) => `${(((t - t0) / 86400000) * 100).toFixed(2)},${y(p)}`);
  const line = `M${xy.join("L")}L100,${y(recent[recent.length - 1][1])}`;
  return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="spark-a" d="${line}L100,30L${xy[0].split(",")[0]},30Z"/><path class="spark-l" d="${line}"/></svg>`;
};
