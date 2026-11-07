// nc-ui group: a collapsible run of controls inside a module (Peter, 2026-10-31; NYX's "Tune & shape" under Slices).
// A header button (title, and while closed a short summary such as what differs from the defaults) opens and closes
// the controls under it. It looks like the FX card's More toggle (`.nc-ui-more > summary`) and has the same touch
// target. It is a real button: aria-expanded, aria-controls naming the body, Enter and Space. It shows and hides
// at once, with no motion.
//
// `collapse: "phone"` (Peter, 2026-11-01: "collapse the functions on all modules that are advanced and/or lesser used")
// makes the group a phone-only fold: on a phone (portrait, max-width 768px; a landscape phone, LANDSCAPE_PHONE; or a
// Studio frame marked html[data-nc-landscape]) it is a group like any other, closed until toggled; on a tablet or
// desktop the kit's CSS flattens it (no header, its controls laid out as if the group weren't there), so a wide
// screen looks exactly as before. Pure CSS: turning the phone round re-lays it out with no script.
//
// Whether a group is open is a browser-wide UI preference, kept like the modules' hide (localStorage,
// GROUP_OPEN_KEY, by the group's id). It is never part of an app's document. `open` is only the first state, until
// the group is toggled.

export const GROUP_OPEN_KEY = "netcomposer.groups.v1";

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The groups toggled in this browser: id → open. */
export function readGroups(storage = safeStorage(), key = GROUP_OPEN_KEY) {
  try {
    const raw = JSON.parse(storage?.getItem(key) ?? "{}");
    const out = new Map();
    if (raw && typeof raw === "object" && !Array.isArray(raw))
      for (const [id, open] of Object.entries(raw)) if (typeof open === "boolean") out.set(id, open);
    return out;
  } catch {
    return new Map();
  }
}

export function writeGroup(storage, id, open, key = GROUP_OPEN_KEY) {
  const next = readGroups(storage, key);
  next.set(id, open);
  try {
    storage?.setItem(key, JSON.stringify(Object.fromEntries(next)));
  } catch {
    /* private mode: the group still opens, it just isn't remembered */
  }
}

/** Whether a group shows open: what this browser remembers, else the control's `open` (default closed). */
export function groupOpen(control, storage = safeStorage()) {
  return readGroups(storage).get(control.id) ?? control.open === true;
}

export function renderGroup(control, lookup, renderChild) {
  const wrap = document.createElement("div");
  wrap.className = "nc-group";
  wrap.dataset.ncId = control.id;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "nc-group-toggle";
  toggle.id = `${control.id}-group-toggle`;
  const title = document.createElement("span");
  title.className = "nc-group-title";
  const summary = document.createElement("span");
  summary.className = "nc-group-summary";
  const mark = document.createElement("span");
  mark.className = "nc-group-mark";
  mark.setAttribute("aria-hidden", "true");
  toggle.append(title, summary, mark);
  const body = document.createElement("div");
  body.className = "nc-group-body";
  body.id = `${control.id}-group-body`;
  body.setAttribute("role", "group");
  body.setAttribute("aria-labelledby", toggle.id);
  toggle.setAttribute("aria-controls", body.id);
  for (const child of control.controls) body.append(renderChild(child, lookup));
  toggle.addEventListener("click", () => {
    const open = wrap.dataset.ncOpen !== "true";
    writeGroup(safeStorage(), control.id, open);
    setOpen(wrap, open);
    const live = lookup(wrap);
    if (live?.type === "group") live.onToggle?.(open);
  });
  wrap.append(toggle, body);
  markCollapse(wrap, control);
  setOpen(wrap, groupOpen(control));
  patchGroup(wrap, control);
  return wrap;
}

function setOpen(wrap, open) {
  wrap.dataset.ncOpen = open ? "true" : "false";
  const toggle = wrap.querySelector(":scope > .nc-group-toggle");
  const body = wrap.querySelector(":scope > .nc-group-body");
  toggle?.setAttribute("aria-expanded", open ? "true" : "false");
  const mark = toggle?.querySelector(".nc-group-mark");
  if (mark) mark.textContent = open ? "−" : "+";
  // A phone-only group's body is never `hidden` (the page's `.nc [hidden]` is display: none !important, which would
  // hide it on a desktop too): the kit's phone CSS hides it from data-nc-open instead.
  if (body instanceof HTMLElement) body.hidden = !open && wrap.dataset.ncCollapse !== "phone";
}

/** data-nc-collapse="phone" from the control; true when it changed. */
function markCollapse(node, control) {
  const want = control.collapse === "phone" ? "phone" : undefined;
  if (node.dataset.ncCollapse === want) return false;
  if (want) node.dataset.ncCollapse = want;
  else delete node.dataset.ncCollapse;
  return true;
}

/** The header's words (the open state is the kit's own; the children are patched by the caller). */
export function patchGroup(node, control) {
  if (markCollapse(node, control)) setOpen(node, node.dataset.ncOpen === "true");
  const title = node.querySelector(":scope > .nc-group-toggle > .nc-group-title");
  if (title && title.textContent !== control.title) title.textContent = control.title;
  const summary = node.querySelector(":scope > .nc-group-toggle > .nc-group-summary");
  const text = control.summary ?? "";
  if (summary && summary.textContent !== text) summary.textContent = text;
}
