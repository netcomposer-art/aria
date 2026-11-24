// nc-ui theme: light, dark, or the system setting. The colours live in the tokens (tokens.json `dark`, emitted under
// :root[data-nc-theme="dark"] and the prefers-color-scheme media query); this module only sets and watches the
// attribute, so CSS follows by itself and canvas code knows when to re-read its colours.
// nc-ui was created by Peter Semmelhack (https://psem.me/). MIT License.
import { skins, skinThemes, themes } from "../dist/tokens.js";

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
 * Inside a same-origin host (the Studio's iframe), take the host page's choice now, before first paint: the theme,
 * and the skin and panels (applyLook). Opened on its own, a page keeps following the system with the default look.
 * Returns the theme choice taken, or null when there is no readable host.
 */
export function followHostTheme(win = globalThis.window) {
  try {
    const host = win?.frameElement?.ownerDocument;
    if (!host || host === win.document) return null;
    const choice = themeChoice(host);
    applyLook({ skin: currentSkin(host), fill: fillOn(host) }, win.document);
    applyTheme(choice, win.document);
    return choice;
  } catch {
    return null;
  }
}

// Skins and panels (Peter, 2026-11-19). A skin is a colour scheme on top of the theme (tokens/skins/*.json; the CSS
// is in tokens.css under :root[data-nc-skin]); the default skin has no attribute. Filled panels (data-nc-fill) raise
// modules as cards on a darker ground and fill empty steps; the kit's CSS draws it. Instrument colours never change.

/** The attribute on <html> naming the skin; absent means the default skin. */
export const SKIN_ATTR = "data-nc-skin";
/** The attribute on <html> that turns filled panels on (present, empty). */
export const FILL_ATTR = "data-nc-fill";
/** Dispatched on the document (detail: { skin, fill }) by applyLook. */
export const LOOK_EVENT = "nc-ui-look-change";
/** Every skin: { id, name, about, default?, swatch: { light, dark: { paper, surf, accent } } }, the default first. */
export const SKINS = skins;
/** The default skin's id. */
export const DEFAULT_SKIN = (skins.find((s) => s.default) ?? skins[0])?.id ?? "prussian";
/** Where the Studio keeps the skin and the panels choice (localStorage). */
export const STUDIO_SKIN_KEY = "netcomposer.studio.skin.v1";
export const STUDIO_FILL_KEY = "netcomposer.studio.fill.v1";

/** A stored or passed value as a skin id: a known skin, else the default. */
export const normalizeSkin = (v) => (skins.some((s) => s.id === v) ? v : DEFAULT_SKIN);

/** The skin on this document (the default when the attribute is absent or unknown). */
export function currentSkin(doc = globalThis.document) {
  return normalizeSkin(rootOf(doc)?.getAttribute(SKIN_ATTR));
}

/** Whether filled panels are on for this document. */
export function fillOn(doc = globalThis.document) {
  return rootOf(doc)?.hasAttribute(FILL_ATTR) ?? false;
}

/**
 * Set the skin and/or panels on a document (an iframe's too). `look.skin`: a skin id (unknown or the default removes
 * the attribute); `look.fill`: true or false. Omitted keys stay as they are. Dispatches LOOK_EVENT.
 */
export function applyLook(look = {}, doc = globalThis.document) {
  const root = rootOf(doc);
  if (!root) return { skin: DEFAULT_SKIN, fill: false };
  if ("skin" in look) {
    const skin = normalizeSkin(look.skin);
    if (skin === DEFAULT_SKIN) root.removeAttribute(SKIN_ATTR);
    else root.setAttribute(SKIN_ATTR, skin);
  }
  if ("fill" in look) {
    if (look.fill) root.setAttribute(FILL_ATTR, "");
    else root.removeAttribute(FILL_ATTR);
  }
  const detail = { skin: currentSkin(doc), fill: fillOn(doc) };
  const CE = doc.defaultView?.CustomEvent;
  if (CE) doc.dispatchEvent(new CE(LOOK_EVENT, { detail }));
  return detail;
}

/**
 * Call `fn(theme)` whenever the colours in effect change: the theme (its attribute, through a MutationObserver, so a
 * host setting it on this document counts, or the system setting while the choice is "system") or the skin. So
 * canvas code that re-reads its colours here follows a skin too. Returns an unsubscribe function.
 */
export function onThemeChange(fn, doc = globalThis.document) {
  const root = rootOf(doc);
  if (!root) return () => {};
  const key = () => `${currentTheme(doc)} ${currentSkin(doc)}`;
  let last = key();
  const check = () => {
    const k = key();
    if (k !== last) { last = k; fn(currentTheme(doc)); }
  };
  const MO = doc.defaultView?.MutationObserver;
  const obs = MO ? new MO(check) : null;
  obs?.observe(root, { attributes: true, attributeFilter: [THEME_ATTR, SKIN_ATTR] });
  const mq = media(doc);
  mq?.addEventListener?.("change", check);
  doc.addEventListener(THEME_EVENT, check);
  return () => {
    obs?.disconnect();
    mq?.removeEventListener?.("change", check);
    doc.removeEventListener(THEME_EVENT, check);
  };
}

const skinned = new Map();
/**
 * The resolved colours of a theme (color, semantic, component, runtime), for canvas and SVG code, in a skin (by
 * default the one on the document). Colours mixed from others (color-mix tokens) are the build's, per skin.
 */
export function themeTokens(theme = currentTheme(), skin = currentSkin()) {
  const t = themes[theme] ?? themes.light;
  const diff = skinThemes[skin]?.[theme === "dark" ? "dark" : "light"];
  if (!diff) return t;
  const key = `${theme} ${skin}`;
  if (!skinned.has(key)) {
    const component = { ...t.component };
    for (const [dm, vals] of Object.entries(diff.component ?? {})) component[dm] = { ...t.component[dm], ...vals };
    skinned.set(key, {
      color: { ...t.color, ...diff.color },
      semantic: { ...t.semantic, ...diff.semantic },
      component,
      runtime: { ...t.runtime, ...diff.runtime },
    });
  }
  return skinned.get(key);
}
