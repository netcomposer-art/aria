// nc-ui help: a short description that appears when the pointer rests on a label (Peter, 2026-10-31: every label
// in every instrument gets "a hover UI element that displays a brief desc of the feature").
//
// Mark anything with data-nc-help="the words" and call installHelpTips() once per page. One listener for the whole
// page; one bubble, reused; nothing runs until the pointer moves. Touch never opens it (there is no hover), and the
// app points each control's aria-describedby at the same words for screen readers.
// Framework-free DOM, so React, Preact and plain pages all use it. Styles: the .nc-ui-help rules in kit.js.

/** The attribute that carries a description. */
export const HELP_ATTR = "data-nc-help";
/** How long the pointer rests before the description shows (ms). */
export const HELP_DELAY = 350;

/**
 * Where the bubble goes: above the anchor, left-aligned with it and kept inside the viewport width; below it when
 * there is no room above `bandTop` (the top of the part of the page you can see: 0, or the Studio's --nc-host-top).
 * Rects are viewport px; returns viewport px { top, left, side }.
 */
export function placeHelp(anchor, tip, viewportWidth, bandTop = 0, gap = 6, edge = 8) {
  const above = anchor.top - gap - tip.height;
  const side = above >= bandTop + edge ? "above" : "below";
  const top = side === "above" ? above : anchor.bottom + gap;
  const left = Math.max(edge, Math.min(anchor.left, viewportWidth - edge - tip.width));
  return { top: Math.round(top), left: Math.round(left), side };
}

const installed = new WeakMap();

function hostTop(doc) {
  const n = parseFloat(doc.defaultView?.getComputedStyle(doc.documentElement).getPropertyValue("--nc-host-top") ?? "");
  return Number.isFinite(n) ? n : 0;
}

/**
 * Turn on hover help for a document. Safe to call more than once (the second call returns the first handle).
 * `pin(el, text?, { ms })` shows the same bubble at `el` without a hover (a one-time hint, on touch too: Peter,
 * 2026-11-05, CALLIOPE's pads hint "once, when the Generator is first loaded"). A pinned bubble ignores hovers and
 * goes on any press, any key, a scroll, a blur, `hide()`, or after `ms` (0: no timeout). Returns whether it showed.
 * @returns {{ uninstall(): void, hide(): void, pin(el: Element, text?: string, opts?: { ms?: number }): boolean }}
 */
export function installHelpTips({ document: doc = globalThis.document, delay = HELP_DELAY } = {}) {
  if (!doc) return { uninstall() {}, hide() {} };
  const existing = installed.get(doc);
  if (existing) return existing;
  const win = doc.defaultView;
  let bubble = null;
  let current = null;
  let timer;
  let pinned = false;
  let pinTimer;

  const hide = () => {
    clearTimeout(timer);
    clearTimeout(pinTimer);
    current = null;
    pinned = false;
    if (bubble) {
      bubble.hidden = true;
      delete bubble.dataset.pinned;
    }
  };
  const show = (el, words) => {
    const text = words ?? el.getAttribute(HELP_ATTR);
    if (!text) return false;
    if (!bubble) {
      bubble = doc.createElement("div");
      bubble.className = "nc-ui-help";
      bubble.setAttribute("role", "tooltip");
      bubble.dataset.testid = "nc-help";
      // The kit styles it; these keep it out of the page's flow even before the kit's CSS has arrived.
      bubble.style.position = "fixed";
      bubble.style.pointerEvents = "none";
      bubble.style.zIndex = "6";
      doc.body.appendChild(bubble);
    }
    bubble.textContent = text;
    bubble.hidden = false;
    bubble.style.visibility = "hidden";
    bubble.style.top = "0px";
    bubble.style.left = "0px";
    const r = el.getBoundingClientRect();
    const p = placeHelp(r, { width: bubble.offsetWidth, height: bubble.offsetHeight }, win.innerWidth, hostTop(doc));
    bubble.style.top = `${p.top}px`;
    bubble.style.left = `${p.left}px`;
    bubble.dataset.side = p.side;
    bubble.style.visibility = "";
    return true;
  };
  const over = (e) => {
    if (pinned || e.pointerType === "touch") return;
    const el = e.target && e.target.closest ? e.target.closest(`[${HELP_ATTR}]`) : null;
    if (el === current) return;
    hide();
    if (!el) return;
    current = el;
    timer = setTimeout(() => {
      if (current === el && el.isConnected) show(el);
    }, delay);
  };
  const key = (e) => {
    if (pinned || e.key === "Escape") hide();
  };

  doc.addEventListener("pointerover", over);
  doc.addEventListener("pointerdown", hide, true);
  doc.addEventListener("keydown", key);
  win.addEventListener("scroll", hide, true);
  win.addEventListener("blur", hide);

  const handle = {
    hide,
    pin(el, text, { ms = 0 } = {}) {
      hide();
      if (!el || !el.isConnected || !show(el, text)) return false;
      pinned = true;
      bubble.dataset.pinned = "";
      if (ms > 0) pinTimer = setTimeout(hide, ms);
      return true;
    },
    uninstall() {
      hide();
      doc.removeEventListener("pointerover", over);
      doc.removeEventListener("pointerdown", hide, true);
      doc.removeEventListener("keydown", key);
      win.removeEventListener("scroll", hide, true);
      win.removeEventListener("blur", hide);
      bubble?.remove();
      bubble = null;
      installed.delete(doc);
    },
  };
  installed.set(doc, handle);
  return handle;
}
