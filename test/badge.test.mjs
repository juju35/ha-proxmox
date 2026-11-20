// The sidebar count module: where it finds the panel's entry and how it draws the count there.
import assert from "node:assert/strict";
import { test } from "node:test";
import "./load.mjs";

const { proxmoxDrawBadge, proxmoxSidebarItem } = await import("../custom_components/proxmox_panel/frontend/proxmox-badge.js");

// A tiny stand-in for the sidebar entry: children with a class, a slot and a dataset.
const element = (localName, attrs = {}) => {
  const el = {
    localName,
    children: [],
    style: { cssText: "" },
    dataset: {},
    ...attrs,
    appendChild(child) {
      child.parentNode = el;
      el.children.push(child);
    },
    insertBefore(child, ref) {
      child.parentNode = el;
      const i = ref ? el.children.indexOf(ref) : -1;
      if (i < 0) el.children.push(child);
      else el.children.splice(i, 0, child);
    },
    remove() {
      el.parentNode.children.splice(el.parentNode.children.indexOf(el), 1);
    },
    querySelector(sel) {
      return sel.includes("slot") ? el.children.find((c) => c.localName === "ha-icon") || null : null;
    },
    querySelectorAll() {
      return el.children.filter((c) => c.className?.includes("proxmox-panel-badge"));
    },
    get nextSibling() {
      const list = el.parentNode.children;
      return list[list.indexOf(el) + 1] || null;
    },
  };
  return el;
};

const page = (item) => {
  const sidebar = { shadowRoot: { querySelector: (sel) => (item && sel === "#sidebar-panel-proxmox" ? item : null) } };
  const main = { shadowRoot: { querySelector: () => sidebar } };
  const ha = { shadowRoot: { querySelector: () => main } };
  return { querySelector: () => ha, createElement: (name) => element(name) };
};

test("no sidebar drawn yet: nothing found, nothing drawn", () => {
  assert.equal(proxmoxSidebarItem(page(null)), null);
  assert.equal(proxmoxDrawBadge(2, page(null)), false);
});

test("the recent sidebar: a red count over the icon (folded) and at the end (unfolded), redrawn only when it changes", () => {
  const item = element("ha-md-list-item");
  const icon = element("ha-icon");
  item.appendChild(icon);
  const doc = page(item);
  assert.equal(proxmoxDrawBadge(3, doc), true);
  const [first, start, end] = item.children;
  assert.equal(first, icon);
  assert.deepEqual([start.slot, end.slot, start.textContent], ["start", "end", "3"]);
  assert.match(start.style.cssText, /background:var\(--error-color, #db4437\)/);
  proxmoxDrawBadge(3, doc);
  assert.equal(item.children[1], start); // unchanged: not rewritten
  proxmoxDrawBadge(120, doc);
  assert.equal(item.children[1].textContent, "99+");
  proxmoxDrawBadge(0, doc);
  assert.deepEqual(item.children, [icon]);
});

test("the older sidebar (a link): one count at the right of the entry", () => {
  const item = element("a");
  proxmoxDrawBadge(1, page(item));
  assert.equal(item.children.length, 1);
  assert.match(item.children[0].style.cssText, /right:12px/);
});
