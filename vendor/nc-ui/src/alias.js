/**
 * The only module that names an nc-ui custom property.
 *
 * Names are locked to nc-ui 0.1.0, commit 7d9bb4e:
 * semantic and runtime tokens are `--nc-ui-<role>`,
 * component tokens are `--nc-<domain>-<name>`.
 * `tokens/renames.json` is applied here (`renamedCssVar`). Call sites keep
 * the stable names (`accent`, `rhythm.playhead`) and never spell a CSS variable.
 *
 * Rhythm roles are `component.rhythm` in tokens.json (see
 * patches/nc-ui-rhythm-domain.patch). This file does not invent their values.
 *
 * nc-ui was created by Peter Semmelhack (https://psem.me/).
 */

import renames from "../tokens/renames.json" with { type: "json" };

/** @typedef {"color" | "family" | "length" | "duration" | "other"} TokenKind */
/** @typedef {"semantic" | "runtime" | "rhythm"} TokenTier */

/**
 * @typedef {object} AliasEntry
 * @property {string} prop
 * @property {TokenKind} kind
 * @property {TokenTier} tier
 */

/** @type {Record<string, TokenKind>} */
const semanticKinds = {
  "surface-page": "color",
  text: "color",
  "text-sub": "color",
  divider: "color",
  "surface-raised": "color",
  accent: "color",
  "on-accent": "color",
  danger: "color",
  "module-bg-adjacent-1": "color",
  "module-bg-adjacent-2": "color",
  "module-bg-adjacent-3": "color",
  "module-bg-adjacent-4": "color",
  "module-bg-stack-1": "color",
  "module-bg-stack-2": "color",
  "module-bg-stack-3": "color",
  "module-bg-stack-4": "color",
  "module-sub-stack-1": "color",
  "module-sub-stack-2": "color",
  "module-sub-stack-3": "color",
  "module-sub-stack-4": "color",
  "module-div-stack-1": "color",
  "module-div-stack-2": "color",
  "module-div-stack-3": "color",
  "module-div-stack-4": "color",
  "module-pad": "length",
  "module-pad-y-desktop": "length",
  "module-pad-x-desktop": "length",
  "module-pad-x-slim": "length",
  "module-slim-column": "length",
  "target-min": "length",
  "target-min-coarse": "length",
  "stack-card-pad-y": "length",
  "font-ui": "family",
  "font-readout": "family",
  "title-size": "length",
  "title-size-slim": "length",
  "title-weight": "other",
  "title-tracking": "other",
  "label-size": "length",
  "label-weight": "other",
  "label-tracking": "other",
  "readout-size": "length",
  "readout-size-small": "length",
  "body-size": "length",
  "slot-font-size": "length",
  "slider-track": "color",
  "slider-progress": "color",
  "slider-thumb": "color",
  "slider-thumb-size": "length",
  "focus-ring": "color",
  "focus-width": "length",
  "focus-width-strong": "length",
  playhead: "color",
  "playhead-width": "length",
  "playhead-offset": "length",
  hairline: "length",
  "rule-strong": "length",
  "slot-size": "length",
  "slot-span": "length",
  "slot-block": "length",
  "accent-tint": "color",
  "accent-soft": "color",
  "accent-faint": "color",
  "beat-gap": "length",
  "row-inset": "length",
  "marker-width": "length",
  "slot-radius": "length",
  "slot-gap": "length",
  "slot-filled-bg": "color",
  "slot-active-bg": "color",
  "slot-active-ink": "color",
  "sparkle-size": "length",
  "sparkle-icon-size": "length",
  "label-on-fill-dark": "color",
  "label-on-fill-light": "color",
  "curve-stroke": "length",
  "trace-stroke": "length",
  "grid-stroke": "length",
  "transition-feedback": "duration",
  "motion-fade": "duration",
  "motion-fade-out": "duration",
  "motion-slide": "duration",
  "motion-fade-easing": "other",
  "motion-fade-out-easing": "other",
  "motion-slide-easing": "other",
  "motion-press-easing": "other",
  "motion-thumb": "duration",
  "motion-thumb-easing": "other",
  "motion-meter-rise": "duration",
  "motion-meter-fall": "duration",
  "motion-meter-easing": "other",
  "motion-meter-hold": "duration",
  "meter-fill": "color",
  "meter-peak": "color",
  "meter-hold-mark": "color",
  "meter-clip": "color",
  "meter-track": "color",
  "meter-width": "length",
  "clip-size": "length",
  "fx-level-bar": "length",
  "fx-level-height": "length",
  "fx-level-fold-length": "length",
  "fx-level-in": "color",
  "fx-level-out": "color",
  "fx-level-hot": "color",
  "fader-height": "length",
  "fader-cap-width": "length",
  "fader-cap-height": "length",
  "fader-cap": "color",
  "fader-cap-line": "color",
  "fader-track": "color",
  "strip-width": "length",
  "strip-width-master": "length",
  "scale-size": "length",
  "fx-card-width": "length",
  "fx-fold-width": "length",
  "fx-fold-width-slim": "length",
  "eq-graph-height": "length",
  "eq-graph-height-max": "length",
  "level-steps-height": "length",
  "level-steps-height-max": "length",
  "level-steps-curve": "color",
  "level-steps-bar": "color",
  "level-steps-free": "color",
  "eq-node-size": "length",
  "eq-graph-bg": "color",
  "eq-curve": "color",
  "eq-fill": "color",
  "eq-grid": "color",
  "eq-spectrum": "color",
  "eq-band-1": "color",
  "eq-band-2": "color",
  "eq-band-3": "color",
  "eq-panel-layer": "other",
  "strip-fold-width": "length",
  "head-margin-compact": "length",
  "motion-press": "duration",
  "control-weight": "other",
  "tab-size": "length",
  "tab-pad-y": "length",
  "tab-mark": "length",
  "select-pad-end": "length",
  "page-head-layer": "other",
  "page-head-bg": "color",
  "instrument-astrid": "color",
  "instrument-petra": "color",
  "instrument-olive": "color",
  "instrument-lucy": "color",
  "instrument-nyx": "color",
  "instrument-calliope": "color",
  "fader-cap-master": "color",
  "strip-hacks-text": "color",
  "strip-alt-bg": "color",
  "strip-shade-1": "color",
  "strip-shade-2": "color",
  "strip-shade-3": "color",
  "strip-shade-4": "color",
  "strip-shade-5": "color",
  "strip-shade-6": "color",
  "strip-shade-7": "color",
  "strip-shade-8": "color",
  "strip-bg": "color",
  "strip-divider": "color",
  "page-title-size": "length",
  "page-title-tracking": "other",
  "page-sub-size": "length",
  "page-sub-gap": "length",
  "page-action-gap": "length",
  "page-pad-x": "length",
  "page-pad-x-md": "length",
  "page-pad-x-xl": "length",
  "page-pad-y": "length",
  "page-pad-y-md": "length",
  "page-head-gap": "length",
  "page-head-gap-md": "length",
  "page-body-gap": "length",
  "page-body-gap-lg": "length",
  "filter-lowpass": "color",
  "filter-highpass": "color",
  "filter-bandpass": "color",
  "toast-bg": "color",
  "toast-text": "color",
  "toast-action": "color",
  "toast-font-size": "length",
  "toast-pad-x": "length",
  "toast-gap": "length",
  "toast-radius": "length",
  "toast-offset": "length",
  "toast-anchor-gap": "length",
  "toast-target": "length",
  "move-size": "length",
  "move-icon": "length",
  "move-gap": "length",
  "move-row-gap": "length",
  "move-label-width": "length",
  "on-danger": "color",
  "dialog-scrim": "color",
  "dialog-width": "length",
  "dialog-pad": "length",
  "dialog-gap": "length",
  "dialog-button-gap": "length",
  "dialog-radius": "length",
  "dialog-leading": "other",
  "module-gap": "length",
  "control-gap": "length",
  "header-gap": "length",
  "head-margin": "length",
  "name-width": "length",
  "slider-pitch": "length",
  "knob-size": "length",
  "display-height": "length",
  "button-tracking": "other",
  "button-pad-y": "length",
  "fx-name-weight": "other",
  "label-leading": "other",
};

/** @type {Record<string, TokenKind>} */
const rhythmKinds = {
  "step-cell-off": "color",
  "step-cell-on": "color",
  "step-cell-ink": "color",
  "step-cell-accent": "color",
  "step-cell-size": "length",
  "step-gap": "length",
  playhead: "color",
  "track-mute": "color",
  "track-solo": "color",
  "velocity-bar": "color",
  "velocity-min": "color",
  "velocity-max": "color",
  "accent-mark": "color",
  "accent-mark-size": "length",
  "bar-accent": "color",
  "lane-1": "color",
  "lane-2": "color",
  "lane-3": "color",
  "lane-4": "color",
  "sparkle-gap": "length",
  "morph-max": "length",
  "morph-min": "length",
  "morph-readout": "length",
  "brand-size": "length",
  "brand-tracking": "other",
  "brand-weight": "other",
  "brand-sub-size": "length",
  "brand-sub-gap": "length",
};

/** @type {Record<string, TokenKind>} */
const runtimeKinds = {
  "surprise-fill": "color",
  "surprise-ink": "color",
  "surprise-on": "color",
  "surprise-on-ink": "color",
  "velocity-fill": "color",
};

/** @type {Record<string, AliasEntry>} */
export const tokenAlias = {};
for (const [name, kind] of Object.entries(semanticKinds)) {
  tokenAlias[name] = { prop: `--nc-ui-${name}`, kind, tier: "semantic" };
}
for (const [name, kind] of Object.entries(runtimeKinds)) {
  tokenAlias[name] = { prop: `--nc-ui-${name}`, kind, tier: "runtime" };
}
for (const [name, kind] of Object.entries(rhythmKinds)) {
  tokenAlias[`rhythm.${name}`] = { prop: `--nc-rhythm-${name}`, kind, tier: "rhythm" };
}

const renameByOld = new Map(renames.renames.map((row) => [row.old, row.new]));

/**
 * Old draft variable → the locked component name in `tokens/renames.json`.
 * Filter curves are not in that table: they are semantic `--nc-ui-filter-*`.
 * @param {string} oldVar
 */
export function renamedCssVar(oldVar) {
  const next = renameByOld.get(oldVar);
  if (!next) throw new Error(`No nc-ui rename for ${oldVar}`);
  return next;
}

/** @param {string} name */
export function entry(name) {
  const token = tokenAlias[name];
  if (!token) throw new Error(`Unknown token "${name}". Add it to src/alias.js.`);
  return token;
}

/** @param {string} name */
export function prop(name) {
  return entry(name).prop;
}

/** CSS var() reference for stylesheets and inline styles. */
export function v(name) {
  return `var(${prop(name)})`;
}

/** Resolved pixel length of a token on an element. 0 when the cascade has no value yet. */
export function readCssPx(root, name) {
  if (!(root instanceof Element)) return 0;
  const value = Number.parseFloat(getComputedStyle(root).getPropertyValue(prop(name)));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Rhythm values come from tokens.css (`--nc-rhythm-*`). Kept so callers that
 * ran before the domain patch still have a hook.
 * @param {HTMLElement | null | undefined} root
 */
export function applyAlias(root) {
  void root;
}

/**
 * Resolve a token against the live cascade. Canvas drawing calls this at
 * paint time so a token edit shows up without a rebuild.
 * @param {Element} el
 * @param {string} name
 */
export function readLive(el, name) {
  const token = entry(name);
  const doc = el.ownerDocument ?? document;
  const probe = doc.createElement("span");
  probe.dataset.ncLive = name;
  probe.style.position = "absolute";
  probe.style.pointerEvents = "none";
  const ref = `var(${token.prop})`;
  if (token.kind === "family") probe.style.fontFamily = ref;
  else if (token.kind === "length" || token.kind === "other" || token.kind === "duration") {
    probe.style.paddingLeft = ref;
  } else probe.style.color = ref;
  const parent = el instanceof Element ? el : doc.documentElement;
  parent.append(probe);
  const view = doc.defaultView ?? window;
  const style = view.getComputedStyle(probe);
  const value =
    token.kind === "family"
      ? style.fontFamily
      : token.kind === "color"
        ? style.color
        : style.paddingLeft;
  probe.remove();
  return value;
}

/**
 * Shared filter-curve colours (`--nc-ui-filter-*`). Synth and rhythm both use these.
 * @param {string | undefined} mode `lp`, `hp`, or `bp`
 */
export function filterPaint(mode) {
  if (mode === "hp") return "filter-highpass";
  if (mode === "bp") return "filter-bandpass";
  return "filter-lowpass";
}

/** Font shorthand from the live label tokens. Safe to pass to canvas. */
export function readCanvasFont(el) {
  const doc = el.ownerDocument ?? document;
  const probe = doc.createElement("span");
  probe.style.fontFamily = v("font-ui");
  probe.style.fontSize = v("label-size");
  probe.style.fontWeight = v("label-weight");
  const parent = el instanceof Element ? el : doc.documentElement;
  parent.append(probe);
  const font = (doc.defaultView ?? window).getComputedStyle(probe).font;
  probe.remove();
  return font;
}
