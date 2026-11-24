// ── Illustrated header ──
import { PROXMOX_BANNER_STYLE } from "../../custom_components/proxmox_panel/frontend/proxmox-common.js";

/** The state of a machine, and of several machines (the worst of them). */
export const guestScene = (statuses) => {
  if (!statuses.length || statuses.includes("unavailable")) return "err";
  if (statuses.every((s) => s === "running")) return "ok";
  if (statuses.every((s) => s === "stopped")) return "idle";
  return "warn";
};

// The banner (its picture in proxmox-common.js, shared with the panel's top bar): the round icon, the title and the
// subtitle on the wall at its left, the zoom button of the mini cards.
export const BANNER_STYLE = `
  ${PROXMOX_BANNER_STYLE}
  .banner { margin:-14px -16px 0; }
  ha-card { container:px-card / inline-size; }
  .htext { position:absolute; left:14px; top:0; bottom:10px; right:118px; display:flex; align-items:center; gap:10px; min-width:0; }
  .htext { container:px-head / inline-size; }
  .htext .n { font-size:16px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .htext .s { font-size:13px; color:#4a5768; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .night .htext .s { color:rgba(255,255,255,.78); }
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
