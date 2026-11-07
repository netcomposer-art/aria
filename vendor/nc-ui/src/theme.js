// nc-ui theme: light, dark, or the system setting. The colours live in the tokens (tokens.json `dark`, emitted under
// :root[data-nc-theme="dark"] and the prefers-color-scheme media query); this module only sets and watches the
// attribute, so CSS follows by itself and canvas code knows when to re-read its colours.
// nc-ui was created by Peter Semmelhack (https://psem.me/). MIT License.
import { themes } from "../dist/tokens.js";

/** The attribute on <html>: "light" or "dark" is an explicit choice; absent means follow the system. */
export const THEME_ATTR = "data-nc-theme";
/** Dispatched on the document (detail: { choice, theme }) by applyTheme. onThemeChange also sees system changes. */
export const THEME_EVENT = "nc-ui-theme-change";
/** The choices a theme control offers. */
export const THEME_CHOICES = Object.freeze(["system", "light", "dark"]);
/** Where the Studio keeps the choice (localStorage). */
export const STUDIO_THEME_KEY = "netcomposer.studio.theme.v1";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const rootOf = (doc) => doc?.documentElement ?? null;
const media = (doc) => doc?.defaultView?.matchMedia?.(DARK_QUERY) ?? null;

/** A stored or passed value as a choice: "light", "dark" or "system" (anything else). */
export const normalizeTheme = (v) => (v === "light" || v === "dark" ? v : "system");

/** The choice on this document: "light", "dark", or "system" when the attribute is absent. */
export function themeChoice(doc = globalThis.document) {
  return normalizeTheme(rootOf(doc)?.getAttribute(THEME_ATTR));
}

/** The theme in effect: "light" or "dark" (the choice, or the system setting when the choice is "system"). */
export function currentTheme(doc = globalThis.document) {
  const c = themeChoice(doc);
  if (c !== "system") return c;
  return media(doc)?.matches ? "dark" : "light";
}

/** Set the choice on a document (an iframe's too): sets or removes data-nc-theme and dispatches THEME_EVENT. */
export function applyTheme(choice, doc = globalThis.document) {
  const root = rootOf(doc);
  if (!root) return "light";
  const c = normalizeTheme(choice);
  if (c === "system") root.removeAttribute(THEME_ATTR);
  else root.setAttribute(THEME_ATTR, c);
  const theme = currentTheme(doc);
  const CE = doc.defaultView?.CustomEvent;
  if (CE) doc.dispatchEvent(new CE(THEME_EVENT, { detail: { choice: c, theme } }));
  return theme;
}

/**
 * Inside a same-origin host (the Studio's iframe), take the host page's choice now, before first paint. Opened on its
 * own, a page keeps following the system. Returns the choice taken, or null when there is no readable host.
 */
export function followHostTheme(win = globalThis.window) {
  try {
    const host = win?.frameElement?.ownerDocument;
    if (!host || host === win.document) return null;
    const choice = themeChoice(host);
    applyTheme(choice, win.document);
    return choice;
  } catch {
    return null;
  }
}

/**
 * Call `fn(theme)` whenever the theme in effect changes: the attribute (a MutationObserver, so a host setting it on
 * this document counts) or the system setting while the choice is "system". Returns an unsubscribe function.
 */
export function onThemeChange(fn, doc = globalThis.document) {
  const root = rootOf(doc);
  if (!root) return () => {};
  let last = currentTheme(doc);
  const check = () => {
    const t = currentTheme(doc);
    if (t !== last) { last = t; fn(t); }
  };
  const MO = doc.defaultView?.MutationObserver;
  const obs = MO ? new MO(check) : null;
  obs?.observe(root, { attributes: true, attributeFilter: [THEME_ATTR] });
  const mq = media(doc);
  mq?.addEventListener?.("change", check);
  doc.addEventListener(THEME_EVENT, check);
  return () => {
    obs?.disconnect();
    mq?.removeEventListener?.("change", check);
    doc.removeEventListener(THEME_EVENT, check);
  };
}

/** The resolved colours of a theme (color, semantic, component, runtime), for canvas and SVG code. */
export function themeTokens(theme = currentTheme()) {
  return themes[theme] ?? themes.light;
}
