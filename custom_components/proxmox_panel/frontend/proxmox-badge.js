/*
 * Proxmox Panel sidebar count, loaded on every page of Home Assistant by the integration.
 * https://github.com/juju35/ha-proxmox
 *
 * A red count on the panel's sidebar entry, like Home Assistant's own notifications count: the nodes down plus the
 * machines unavailable on a node that is up (see proxmoxProblems). For administrators only, as the panel. Which
 * entity is which comes from the integration's proxmox_panel/inventory command (read again every 5 minutes), the
 * statuses from the states (every 15 seconds). The last count is kept by the browser, so the sidebar shows it at once.
 */
import { proxmoxProblems } from "./proxmox-common.js";

const KEY = "proxmox-panel-count";
const EVERY_MS = 15000;
const INVENTORY_MS = 300000;
const PANEL = "proxmox";

let count = 0;
try {
  count = Math.max(0, Number.parseInt(localStorage.getItem(KEY), 10) || 0);
} catch (_err) {
  // no storage: drawn once counted
}
let inventory = null;
let inventoryAt = 0;

/** The panel's entry in Home Assistant's sidebar, or null until the sidebar is drawn. */
export const proxmoxSidebarItem = (doc = document) => {
  const main = doc.querySelector("home-assistant")?.shadowRoot?.querySelector("home-assistant-main");
  const sidebar = main?.shadowRoot?.querySelector("ha-sidebar")?.shadowRoot;
  if (!sidebar) return null;
  return sidebar.querySelector(`#sidebar-panel-${PANEL}`) || sidebar.querySelector(`[href="/${PANEL}"]`) || sidebar.querySelector(`[data-panel="${PANEL}"]`);
};

/** A count span in Home Assistant's own sidebar badge style (`badge`, placed by the sidebar by its slot), in red. */
const span = (doc, text, slot) => {
  const el = doc.createElement("span");
  el.className = "badge proxmox-panel-badge";
  el.slot = slot;
  el.dataset.text = text;
  el.textContent = text;
  // Over the icon when the sidebar is folded (a custom icon is an <ha-icon>, which the sidebar's rule does not place)
  const place = slot === "start" ? "position:absolute; top:var(--ha-space-1, 4px); left:26px; z-index:1; pointer-events:none; " : "";
  el.style.cssText = `${place}display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; box-sizing:border-box; padding:0 5px; border-radius:9px; font-size:11px; font-weight:500; line-height:1; color:#fff; background:var(--error-color, #db4437);`;
  return el;
};

/** The count drawn on the sidebar entry (none at 0); unchanged, nothing is written. False until the entry exists. */
export const proxmoxDrawBadge = (n, doc = document) => {
  const item = proxmoxSidebarItem(doc);
  if (!item) return false;
  const old = item.querySelectorAll(":scope > .proxmox-panel-badge");
  const text = n > 99 ? "99+" : String(n);
  if (!n) {
    for (const el of old) el.remove();
    return true;
  }
  const want = item.localName === "a" ? 1 : 2;
  if (old.length === want && old[0].dataset.text === text) return true;
  for (const el of old) el.remove();
  if (want === 1) {
    // The older sidebar (an <a>): one count at the right of the entry
    const el = span(doc, text, "end");
    el.style.cssText += " position:absolute; right:12px; top:50%; transform:translateY(-50%); pointer-events:none;";
    item.style.position = "relative";
    item.appendChild(el);
    return true;
  }
  // The recent sidebar: one count in the start slot (folded) and one in the end slot (unfolded), as its own badges
  const icon = item.querySelector(':scope > ha-icon[slot="start"], :scope > ha-svg-icon[slot="start"]');
  item.insertBefore(span(doc, text, "start"), icon ? icon.nextSibling : null);
  item.appendChild(span(doc, text, "end"));
  return true;
};

const setCount = (n) => {
  if (n === count) return;
  count = n;
  try {
    localStorage.setItem(KEY, String(n));
  } catch (_err) {
    // drawn anyway, not kept
  }
  proxmoxDrawBadge(count);
};

/** The inventory read again when older than 5 minutes, then the count from the states. */
const follow = async () => {
  const hass = document.querySelector("home-assistant")?.hass;
  if (!hass?.user?.is_admin || document.hidden) return;
  if (!inventory || Date.now() - inventoryAt > INVENTORY_MS) {
    try {
      inventory = await hass.callWS({ type: "proxmox_panel/inventory" });
      inventoryAt = Date.now();
    } catch (_err) {
      return; // Home Assistant starting, the integration removed: tried again next time
    }
  }
  setCount(proxmoxProblems(hass, inventory));
};

if (typeof window !== "undefined" && typeof document !== "undefined" && document.querySelector && !window.__proxmoxPanelBadge) {
  window.__proxmoxPanelBadge = true;
  // Until the sidebar has drawn the entry: every 250 ms for 5 seconds
  const soon = (tries = 20) => {
    if (!proxmoxDrawBadge(count) && tries > 1) setTimeout(() => soon(tries - 1), 250);
  };
  soon();
  // The sidebar rebuilds its entries (folded, unfolded, panels changed): the count added again when dropped
  const observe = () => {
    const root = proxmoxSidebarItem()?.getRootNode();
    if (!root) return setTimeout(observe, 500);
    let frame = 0;
    new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        proxmoxDrawBadge(count);
      });
    }).observe(root, { childList: true, subtree: true });
  };
  observe();
  setTimeout(follow, 3000);
  setInterval(follow, EVERY_MS);
}
