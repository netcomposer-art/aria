// nc-ui toast: one short message with one action (e.g. "Surprise applied" + Undo).
// Framework-free DOM, so React, Preact or plain pages can all use it. Styles: the .nc-ui-toast rules in kit.js.
// It reads semantic tokens only; it fades in with motion-fade and out with motion-fade-out.
import { constants } from "../../dist/tokens.js";
import { prop } from "../alias.js";

/** How long a toast stays (ms) unless something closes it sooner. */
export const TOAST_DURATION = constants["toast-duration"];

/** What a screen reader hears: the message, then the action ("Surprise applied, Undo"). */
export function toastAnnouncement({ message, actionLabel }) {
  return actionLabel ? `${message}, ${actionLabel}` : String(message);
}

/**
 * Bottom of the viewport unless a rect to avoid (keys, slots) is in that band and the top band is clear.
 * Rects are { top, bottom } in viewport px.
 */
export function pickToastPlacement(avoid, viewportHeight, toastHeight, offset) {
  const band = (top) => ({ top, bottom: top + toastHeight });
  const hits = (b) => avoid.some((r) => r && r.bottom > b.top && r.top < b.bottom);
  const bottom = band(viewportHeight - offset - toastHeight);
  if (!hits(bottom)) return "bottom";
  return hits(band(offset)) ? "bottom" : "top";
}

/**
 * Anchored placement (e.g. under the module the action lives in): left-aligned with the anchor, `gap` below it,
 * pushed further down past any rect to avoid it would cover, and kept inside the viewport width.
 * Rects are viewport px { top, bottom, left, right }; returns viewport px { top, left }.
 */
export function anchorToastPosition(anchor, avoid, toast, viewportWidth, gap, edge) {
  let top = anchor.bottom + gap;
  const left = Math.max(edge, Math.min(anchor.left, viewportWidth - edge - toast.width));
  for (let moved = true, n = 0; moved && n < 8; n++) {
    moved = false;
    for (const r of avoid)
      if (
        r &&
        r.bottom > top &&
        r.top < top + toast.height &&
        r.right > left &&
        r.left < left + toast.width
      ) {
        top = r.bottom + gap;
        moved = true;
      }
  }
  return { top, left };
}

const LIVE_ATTR = "data-nc-ui-toast-live";

/** One polite live region per host, made once and kept, so screen readers hear each new toast. */
function liveRegion(doc, host) {
  let live = host.querySelector(`[${LIVE_ATTR}]`);
  if (!live) {
    live = doc.createElement("div");
    live.setAttribute(LIVE_ATTR, "");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    live.setAttribute("role", "status");
    live.className = "nc-ui-toast-live";
    host.appendChild(live);
  }
  return live;
}

/**
 * Show a toast. Returns { el, close(reason), closed }.
 * @param {object} p
 * @param {string} p.message
 * @param {string} [p.actionLabel]  the one action (e.g. "Undo"); omit for a plain message
 * @param {() => void} [p.onAction]  runs on the action, then the toast closes
 * @param {number} [p.duration]  ms before it fades out (default: the toast-duration constant, 5500)
 * @param {(reason: 'timeout'|'action'|'close') => void} [p.onClose]  once, when it starts to fade out
 * @param {Array<Element|null>} [p.avoid]  elements it must not cover (it picks the top edge if they sit at the bottom)
 * @param {Element} [p.anchor]  sit just below this element (left-aligned, scrolls with the page) instead of at a viewport edge
 * @param {Element} [p.host]  where it mounts (default document.body)
 */
export function createToast({
  message,
  actionLabel,
  onAction,
  duration = TOAST_DURATION,
  onClose,
  avoid = [],
  anchor,
  host,
  document: doc = globalThis.document,
} = {}) {
  host = host ?? doc.body;
  const win = doc.defaultView ?? globalThis;
  const el = doc.createElement("div");
  el.className = "nc-ui-toast";
  el.setAttribute("data-state", "enter");
  const msg = doc.createElement("span");
  msg.className = "nc-ui-toast-message";
  msg.textContent = message;
  el.appendChild(msg);
  let button = null;
  if (actionLabel) {
    button = doc.createElement("button");
    button.type = "button";
    button.className = "nc-ui-toast-action";
    button.textContent = actionLabel;
    el.appendChild(button);
  }
  host.appendChild(el);
  let state = "open";

  // Place it clear of what it must not cover.
  const rect = (n) =>
    n && typeof n.getBoundingClientRect === "function" ? n.getBoundingClientRect() : null;
  const own = rect(el);
  const h = own?.height || 44;
  const cs0 = win.getComputedStyle?.(el);
  const offset = Number.parseFloat(cs0?.getPropertyValue(prop("toast-offset"))) || 16;
  const gap = Number.parseFloat(cs0?.getPropertyValue(prop("toast-anchor-gap"))) || 8;
  const a = rect(anchor);
  const vh = win.innerHeight ?? 0;
  const avoidRects = avoid.map(rect).filter(Boolean);
  const pos =
    a && a.bottom > 0 && a.top < vh
      ? anchorToastPosition(
          a,
          avoidRects,
          { width: own?.width || 0, height: h },
          win.innerWidth ?? 0,
          gap,
          offset,
        )
      : null;
  if (pos && pos.top + h <= vh) {
    // Document coordinates, so it stays with the module if the page scrolls.
    el.setAttribute("data-placement", "anchor");
    el.style.top = `${pos.top + (win.scrollY ?? 0)}px`;
    el.style.left = `${pos.left + (win.scrollX ?? 0)}px`;
  } else el.setAttribute("data-placement", pickToastPlacement(avoidRects, vh, h, offset));

  // Fade in (motion-fade): the next frame flips enter -> open.
  const raf = win.requestAnimationFrame?.bind(win) ?? ((f) => setTimeout(f, 16));
  raf(() =>
    raf(() => {
      if (state === "open") el.setAttribute("data-state", "open");
    }),
  );
  liveRegion(doc, host).textContent = toastAnnouncement({ message, actionLabel });

  let timer;
  let resolveClosed;
  const closed = new Promise((r) => {
    resolveClosed = r;
  });
  const start = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(() => close("timeout"), ms);
  };
  let left = duration;
  let since = Date.now();
  // Hover or focus keeps it up (WCAG 2.2.1); leaving gives back the time that was left.
  const pause = () => {
    if (state !== "open") return;
    clearTimeout(timer);
    left = Math.max(0, left - (Date.now() - since));
  };
  const resume = () => {
    if (state !== "open") return;
    since = Date.now();
    start(left);
  };
  el.addEventListener("pointerenter", pause);
  el.addEventListener("pointerleave", resume);
  el.addEventListener("focusin", pause);
  el.addEventListener("focusout", resume);
  button?.addEventListener("click", () => {
    if (state !== "open") return;
    try {
      onAction?.();
    } finally {
      close("action");
    }
  });
  if (Number.isFinite(duration)) start(duration);

  /** Fade out (motion-fade-out), then leave the DOM. Safe to call more than once. */
  function close(reason = "close") {
    if (state !== "open") return;
    state = "closing";
    clearTimeout(timer);
    el.setAttribute("data-state", "closing");
    onClose?.(reason);
    const cs = win.getComputedStyle?.(el);
    const ms = cs
      ? Math.max(
          0,
          ...String(cs.transitionDuration || "")
            .split(",")
            .map((d) => Number.parseFloat(d) * (d.trim().endsWith("ms") ? 1 : 1000) || 0),
        )
      : 0;
    const done = () => {
      if (state === "gone") return;
      state = "gone";
      el.remove();
      resolveClosed(reason);
    };
    el.addEventListener("transitionend", done);
    setTimeout(done, ms + 50); // reduced motion (no transition) or a missed transitionend
  }

  return { el, close, closed };
}
