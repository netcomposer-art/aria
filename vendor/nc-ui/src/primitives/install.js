import { applyAlias } from "../alias.js";
import { kitCss } from "./kit.js";

let styleEl = null;

/** The cascade layer the bundled kit goes in: a live /nc-ui/nc-ui.css (unlayered) always wins over it. */
export const FALLBACK_LAYER = "nc-ui-fallback";

/**
 * Inject the kit sheet. Safe to call more than once. The sheet sits in the `nc-ui-fallback` layer, so when the page
 * links the live nc-ui (`/nc-ui/nc-ui.css`, see `@netcomposer/nc-ui/vite`), the live rules win and this copy only
 * fills in when the live sheet is missing.
 */
export function installTheme(doc = globalThis.document) {
  if (!doc?.documentElement) return;
  applyAlias(doc.documentElement);
  if (styleEl && styleEl.ownerDocument === doc) return;
  const style = doc.createElement("style");
  style.dataset.ncKit = "";
  style.textContent = `@layer ${FALLBACK_LAYER} {\n${kitCss()}\n}\n`;
  doc.head.append(style);
  styleEl = style;
}

export function installedCss() {
  return styleEl?.textContent ?? "";
}
