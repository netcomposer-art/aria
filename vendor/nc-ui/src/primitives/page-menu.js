// nc-ui page menu (Peter, 2026-11-01, iPhone: "On mobile put the top menu choices in a hamburger").
// On phones (the kit's phone breakpoint, PAGE_MENU_PHONE) a page header's text actions (Save, Load, New, the theme...)
// sit behind one ☰ button at the right of the header; on wider screens nothing changes.
//
// The app wraps those actions in one element, the panel, and hands it here. The kit sheet (kit.js) does the rest:
// wider than a phone the panel is `display: contents`, so its children lay out exactly as before; on a phone it is
// hidden until the ☰ opens it, then a flat list under the header (kit tokens, light and dark), each item a full-width
// target-min row. Anything the app keeps outside the panel (Panic: a performer needs it in one tap) stays in the
// header. The panel draws over the page, so opening it never shifts the layout.
//
// The button is a real disclosure button: aria-expanded, aria-controls naming the panel, labelled "Menu". Opening
// moves the focus to the first item; a click on an item (a button), Escape or a click outside closes it, and the focus
// goes back to the ☰ when it was in the panel. The file has no imports, so an app can vendor it alone.

/** The kit's phone breakpoint (kit.js @media (max-width: 768px)). */
export const PAGE_MENU_PHONE = "(max-width: 768px)";

/** The ☰ glyph as inline SVG (a missing font glyph sends the first layout through font fallback). */
export const PAGE_MENU_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2 3.25h12v1.5H2zM2 7.25h12v1.5H2zM2 11.25h12v1.5H2z"/></svg>';

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

let seq = 0;

/**
 * Put a page header's actions behind a ☰ on phones.
 * @param {{ panel: HTMLElement, button?: HTMLButtonElement, label?: string, media?: string }} opts
 */
export function pageMenu({ panel, button, label = "Menu", media = PAGE_MENU_PHONE }) {
  const doc = panel.ownerDocument;
  const win = doc.defaultView ?? globalThis;
  panel.classList.add("nc-page-menu");
  if (!panel.id) panel.id = `nc-page-menu-${++seq}`;
  const btn = button ?? doc.createElement("button");
  if (!button) {
    btn.type = "button";
    btn.innerHTML = PAGE_MENU_ICON;
  }
  btn.classList.add("nc-page-menu-btn");
  btn.setAttribute("aria-label", label);
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", panel.id);

  const isOpen = () => panel.hasAttribute("data-nc-open");

  function open() {
    if (isOpen()) return;
    panel.setAttribute("data-nc-open", "");
    btn.setAttribute("aria-expanded", "true");
    doc.addEventListener("keydown", onKey, true);
    doc.addEventListener("pointerdown", onOutside, true);
    const first = [...panel.querySelectorAll(FOCUSABLE)].find(
      (el) => !el.hidden && el.getClientRects?.().length !== 0,
    );
    first?.focus?.({ preventScroll: true });
  }

  /** Close; the focus goes back to the ☰ when it was in the panel (or `focus: true`). */
  function close({ focus } = {}) {
    if (!isOpen()) return;
    const inside = panel.contains(doc.activeElement);
    panel.removeAttribute("data-nc-open");
    btn.setAttribute("aria-expanded", "false");
    doc.removeEventListener("keydown", onKey, true);
    doc.removeEventListener("pointerdown", onOutside, true);
    if (focus ?? inside) btn.focus?.({ preventScroll: true });
  }

  function onKey(e) {
    if (e.key !== "Escape") return;
    // The open menu takes Escape (an instrument's Escape is Panic: closing the menu must not also silence it).
    e.preventDefault();
    e.stopPropagation();
    close({ focus: true });
  }

  function onOutside(e) {
    const t = e.target;
    if (t instanceof win.Node && (panel.contains(t) || btn.contains(t))) return;
    close({ focus: false });
  }

  const onButton = () => (isOpen() ? close({ focus: true }) : open());
  // An item's own click runs first (it is the target); then the menu closes. A button marked
  // data-nc-menu-stay (or a slider, a field) keeps it open.
  const onItem = (e) => {
    const t = e.target;
    const item = t instanceof win.Element ? t.closest("button") : null;
    if (!item || !panel.contains(item) || item.closest("[data-nc-menu-stay]")) return;
    close({ focus: true });
  };
  btn.addEventListener("click", onButton);
  panel.addEventListener("click", onItem);

  // Wider than a phone the actions are inline again: never leave the menu open behind them.
  const mq = win.matchMedia?.(media);
  const onMedia = () => {
    if (!mq?.matches) close({ focus: false });
  };
  mq?.addEventListener?.("change", onMedia);

  return {
    button: btn,
    panel,
    open,
    close,
    isOpen,
    destroy() {
      close({ focus: false });
      btn.removeEventListener("click", onButton);
      panel.removeEventListener("click", onItem);
      mq?.removeEventListener?.("change", onMedia);
    },
  };
}
