import { prop, v } from "../alias.js";
import { MODULATED_SELECTOR } from "../modulated.js";

/** A phone held sideways (the kit's landscape-phone media; the Studio mirrors it onto its frames as data-nc-landscape). */
export const LANDSCAPE_PHONE = "(orientation: landscape) and (max-height: 500px) and (max-width: 1023px)";

/** The landscape-phone module grid, under `pre` (a root selector, or ""). */
/** A phone-only group (group.js, collapse: "phone") as an ordinary group, under `pre` (a host's landscape mark). */
function phoneGroup(pre) {
  const g = `${pre}.nc-group[data-nc-collapse="phone"]`;
  return `  ${g} { display: flex; }
  ${g} > .nc-group-toggle { display: grid; }
  ${g} > .nc-group-body { display: flex; }
  ${g}[data-nc-open="false"] > .nc-group-body { display: none; }`;
}

function landscapeStack(pre) {
  const st = `${pre}.nc-stack[data-nc-layout="adjacent"]`;
  return `  ${st} {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(${v("module-slim-column")} * 2)), 1fr));
    align-items: start;
  }
  ${st} > .nc-module { border-inline-end: ${v("hairline")} solid ${v("divider")}; }
  /* Two rows tall as well, so the modules after it fill the column beside it before a new row starts. */
  ${st} > .nc-module[data-nc-lead]:not([data-nc-slim]) { grid-column: span 2; grid-row: span 2; }`;
}

/** Class sheet for the kit. Lengths and colours come from the alias module. */
export function kitCss() {
  const stack = (n) => `
    .nc-module[data-nc-place="stack"][data-nc-shade="${n}"],
    .nc-ui-fx[data-nc-depth="${n}"] {
      background: ${v(`module-bg-stack-${n}`)};
      ${prop("text-sub")}: ${v(`module-sub-stack-${n}`)};
      ${prop("divider")}: ${v(`module-div-stack-${n}`)};
      ${prop("slider-track")}: ${v(`module-div-stack-${n}`)};
    }`;
  const adjacent = (n) =>
    `.nc-module[data-nc-place="adjacent"][data-nc-shade="${n}"] { background: ${v(`module-bg-adjacent-${n}`)}; }`;
  // Inset panel: the next shade down. Below adjacent-4 it is stack-1, with that shade's sub text and
  // dividers (ASTRID's Hacks panel inside VCA is exactly stack-1 on adjacent-4).
  const inset = (n) =>
    n < 4
      ? `.nc-module[data-nc-shade="${n}"] .nc-section[data-nc-inset="true"] { background: ${v(`module-bg-adjacent-${n + 1}`)}; }`
      : `.nc-module[data-nc-shade="${n}"] .nc-section[data-nc-inset="true"] {
      background: ${v("module-bg-stack-1")};
      ${prop("text-sub")}: ${v("module-sub-stack-1")};
      ${prop("divider")}: ${v("module-div-stack-1")};
    }`;

  return `
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0;
  background: ${v("surface-page")};
  color: ${v("text")};
  font-family: ${v("font-ui")};
  font-size: ${v("body-size")};
  font-weight: ${v("title-weight")};
  line-height: ${v("label-leading")};
}
/* Phones: a page never pans sideways. A guard only: whatever is wider than the screen is the bug, fixed where it is
   (an iPhone sizes a Studio frame to its content, so one wide element pans the whole Studio: Peter, 2026-11-01).
   clip, not hidden: no scroll container, so position: sticky still sticks. */
@media (max-width: 768px) {
  html, body { overflow-x: clip; }
}
button, input, select { font: inherit; color: inherit; }
.nc [hidden] { display: none !important; }
.nc-stack { display: flex; flex-direction: column; min-width: 0; }
/* ASTRID's page frame: side gutters, a header with a divider under it, then the modules, inset from the edges. */
.nc-page {
  min-width: 0;
  padding: ${v("page-pad-y")} ${v("page-pad-x")};
}
.nc-page-hd {
  display: flex;
  flex-direction: column;
  gap: ${v("page-action-gap")};
  min-width: 0;
  padding-bottom: ${v("page-head-gap")};
  border-bottom: ${v("hairline")} solid ${v("divider")};
  position: relative;
  /* Its own layer above the page body: the band sits behind the header's content, and a menu that opens from the
     header (Bass's and Rhythm's phone menu) draws over the modules, not under them. */
  z-index: ${v("page-head-layer")};
}
/* The title band (Peter): page-head-bg from the top of the page down to the header's divider, edge to edge. It
   reaches into the page's padding, so it never widens the page; the divider keeps its inset. */
.nc-page-hd::before {
  content: "";
  position: absolute;
  z-index: -1;
  top: calc(${v("page-pad-y")} * -1);
  bottom: 0;
  left: calc(${v("page-pad-x")} * -1);
  right: calc(${v("page-pad-x")} * -1);
  background: ${v("page-head-bg")};
  pointer-events: none;
}
.nc-page-body { min-width: 0; padding-top: ${v("page-body-gap")}; }
/* Page title (ASTRID: "ASTRID / SYNTH / 01"), the line under it, and the header's text actions (Save, Load, Panic). */
.nc-page-title {
  margin: 0;
  font-size: ${v("page-title-size")};
  font-weight: ${v("label-weight")};
  letter-spacing: ${v("page-title-tracking")};
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nc-page-sub { margin: ${v("page-sub-gap")} 0 0; font-size: ${v("page-sub-size")}; color: ${v("text-sub")}; }
.nc-page-title .nc-page-sep { color: ${v("text-sub")}; }
.nc-page-actions { display: flex; flex-wrap: wrap; align-items: flex-end; gap: ${v("control-gap")} ${v("page-action-gap")}; min-width: 0; }
.nc-page-action {
  border: 0;
  border-bottom: ${v("hairline")} solid transparent;
  background: transparent;
  padding: 0 0 ${v("control-gap")};
  color: ${v("text-sub")};
  font-size: ${v("label-size")};
  font-weight: ${v("control-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  cursor: pointer;
  transition-property: color, border-color;
  transition-duration: ${v("transition-feedback")};
}
.nc-page-action:hover { color: ${v("text")}; border-bottom-color: ${v("text")}; }
.nc-page-action:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("control-gap")}; }
/* Page menu (pageMenu, page-menu.js; Peter, 2026-11-01: "On mobile put the top menu choices in a hamburger"). Wider
   than a phone the panel is display: contents, so the actions lay out as before and the ☰ hides. On a phone the
   actions wait behind the ☰ at the header's right; open, they are a flat list under the header, over the page (no
   layout shift), each a full-width target-min row. What an app keeps outside the panel (Panic) stays in the header. */
.nc-page-menu { display: contents; }
.nc-page-menu-btn { display: none; }
@media (max-width: 768px) {
  .nc-page-menu:not([data-nc-open]) { display: none !important; }
  .nc-page-menu-btn {
    display: inline-grid;
    place-items: center;
    flex: none;
    min-width: ${v("target-min")};
    min-height: ${v("target-min")};
    /* The bars' right edge on the page gutter, as the text actions' last word. */
    margin-inline-end: calc((${v("target-min")} - ${v("target-min")} / 2.75) / -2);
    padding: 0;
    border: 0;
    background: transparent;
    color: ${v("text")};
    cursor: pointer;
  }
  .nc-page-menu-btn > svg { width: calc(${v("target-min")} / 2.75); height: calc(${v("target-min")} / 2.75); fill: currentColor; }
  .nc-page-menu-btn:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: calc(${v("focus-width")} * -1); }
  .nc-page-menu[data-nc-open] {
    position: absolute;
    top: calc(100% + ${v("hairline")});
    left: 0;
    right: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    padding-block: ${v("control-gap")};
    background: ${v("surface-page")};
    color: ${v("text")};
    border-bottom: ${v("hairline")} solid ${v("divider")};
  }
  /* Under a kit header: edge to edge, the items on the page gutter. */
  .nc-page-hd .nc-page-menu[data-nc-open] {
    left: calc(${v("page-pad-x")} * -1);
    right: calc(${v("page-pad-x")} * -1);
    padding-inline: ${v("page-pad-x")};
  }
  .nc-page-menu[data-nc-open] button {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    min-height: ${v("target-min")};
    margin: 0;
    padding: 0;
    border: 0;
    text-align: left;
    color: ${v("text")};
  }
  .nc-page-menu[data-nc-open] button:focus-visible { outline-offset: calc(${v("focus-width")} * -1); }
  .nc-page-menu[data-nc-open] > .nc-field { width: auto !important; padding-block: ${v("control-gap")}; }
  /* The header with a menu keeps one row on a phone: the title at the left (cut only if it must be), the kept
     actions and the ☰ at the right. */
  .nc-page-hd:has(.nc-page-menu-btn) { flex-direction: row; align-items: center; justify-content: space-between; gap: ${v("header-gap")}; }
  .nc-page-hd:has(.nc-page-menu-btn) > :first-child { min-width: 0; }
  .nc-page-actions:has(> .nc-page-menu-btn) { flex: none; flex-wrap: nowrap; align-items: center; }
}
@media (min-width: 768px) and (max-width: 768px) {
  .nc-page-hd .nc-page-menu[data-nc-open] {
    left: calc(${v("page-pad-x-md")} * -1);
    right: calc(${v("page-pad-x-md")} * -1);
    padding-inline: ${v("page-pad-x-md")};
  }
}
.nc-module {
  background: ${v("module-bg-adjacent-1")};
  color: ${v("text")};
  padding: ${v("module-pad")};
  border: 0;
  border-bottom: ${v("hairline")} solid ${v("divider")};
  border-radius: 0;
  min-width: 0;
  position: relative;
  font-family: ${v("font-ui")};
  transition: none;
}
${[1, 2, 3, 4].map(adjacent).join("\n")}
${[1, 2, 3, 4].map(stack).join("\n")}
${[1, 2, 3, 4].map(inset).join("\n")}
.nc-module-hd {
  display: flex;
  flex-wrap: nowrap;
  align-items: baseline;
  justify-content: space-between;
  gap: ${v("header-gap")};
  min-width: 0;
}
.nc-module[data-nc-open="true"] .nc-module-hd { margin-bottom: ${v("head-margin")}; }
/* A compact header (defineModule compact): the title at the slim size and the index on one slim line, a small gap
   under it. For a module that sits over others (the Studio's Mix). */
.nc-module[data-nc-compact] .nc-title { font-size: ${v("title-size-slim")}; }
.nc-module[data-nc-compact][data-nc-open="true"] .nc-module-hd { margin-bottom: ${v("head-margin-compact")}; }
.nc-module[data-nc-compact]:not([data-nc-slim]) { padding-top: ${v("module-gap")}; }
.nc-module[data-nc-compact][data-nc-slim] { padding-block: ${v("module-gap")}; }
.nc-title {
  margin: 0;
  min-width: 0;
  font-size: ${v("title-size")};
  font-weight: ${v("title-weight")};
  letter-spacing: ${v("title-tracking")};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nc-module[data-nc-slim] .nc-title { font-size: ${v("title-size-slim")}; }
.nc-module-end { display: flex; align-items: baseline; gap: ${v("header-gap")}; flex: none; }
.nc-index {
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  color: ${v("text-sub")};
}
.nc-hide, .nc-slim {
  padding: 0 ${v("control-gap")};
  border: 0;
  background: transparent;
  color: ${v("text-sub")};
  font-family: ${v("font-readout")};
  font-size: ${v("body-size")};
  line-height: ${v("label-leading")};
  cursor: pointer;
  transition: none;
}
.nc-slim {
  display: flex;
  align-items: center;
  gap: ${v("module-gap")};
  flex: 1;
  min-width: 0;
  margin-top: ${v("module-gap")};
  text-align: left;
}
.nc-hide:hover, .nc-slim:hover { color: ${v("text")}; }
.nc-hide:focus-visible, .nc-slim:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("control-gap")};
}
.nc-slim-lines {
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nc-module-body {
  display: flex;
  flex-direction: column;
  gap: ${v("module-pad")};
  min-width: 0;
  transition: none;
}
.nc-section { display: flex; flex-direction: column; gap: ${v("module-gap")}; min-width: 0; }
.nc-row, .nc-field, .nc-controls, .nc-slot-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: ${v("module-gap")};
  min-width: 0;
}
.nc-label {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  color: ${v("text-sub")};
}
.nc-readout, .nc-mono {
  font-family: ${v("font-readout")};
  font-variant-numeric: tabular-nums;
  font-size: ${v("readout-size")};
  color: ${v("text")};
  white-space: nowrap;
}
/* One label column (the lane-name width), so the sliders in a module start together, as in ASTRID. A label is never
   cut below that column (TEMPO, SWING and DECAY stay whole), but longer text gives way on one line with an ellipsis
   instead of widening the page; the full text stays in the DOM, so the accessible name is never cut. */
.nc-field .nc-label { flex: 0 1 auto; min-width: min(${v("name-width")}, 100%); }
/* A value never gives way to its label: it keeps its width (flex: none), so a long label is cut first and 0.3 stays
   0.3. Only a value that is itself longer than the row beside a name-width label is cut, with an ellipsis. The control
   beside it (range, knob, canvas, select) keeps its size. */
.nc-field .nc-readout {
  flex: none;
  min-width: 0;
  max-width: calc(100% - ${v("name-width")} - ${v("module-gap")});
  overflow: hidden;
  text-overflow: ellipsis;
}
.nc-field .nc-range, .nc-field .nc-canvas { flex: 1 1 0; min-width: 0; }
/* A display beside a label keeps the width it has next to a column-wide label: a long label is cut, not the display. */
.nc-field > .nc-label + .nc-canvas { min-width: calc(100% - ${v("name-width")} - ${v("module-gap")}); }
/* ASTRID slider rows: label and value on one baseline, the slider full width under them. */
.nc-field[data-nc-slider] {
  display: grid;
  grid-template-columns: minmax(min(${v("name-width")}, 100%), 1fr) auto;
  grid-template-areas: "label value" "range range";
  align-items: baseline;
  column-gap: ${v("module-gap")};
  row-gap: ${v("control-gap")};
  padding-bottom: ${v("module-gap")};
}
.nc-field[data-nc-slider] .nc-label { grid-area: label; min-width: 0; }
/* In the slider grid the value column is auto (sized to the value), so the flex-row cap does not apply. */
.nc-field[data-nc-slider] .nc-readout { grid-area: value; max-width: none; text-align: right; }
.nc-field[data-nc-slider] .nc-range { grid-area: range; width: 100%; margin: 0; }
/* Tap tempo: a small outlined button on the label line, between the label and the value. */
.nc-field[data-nc-slider]:has(> .nc-tap) {
  grid-template-columns: minmax(min(${v("name-width")}, 100%), 1fr) auto auto;
  grid-template-areas: "label tap value" "range range range";
}
.nc-tap {
  grid-area: tap;
  position: relative;
  align-self: center;
  padding: 0 ${v("control-gap")};
  border: ${v("hairline")} solid ${v("divider")};
  border-radius: ${v("slot-radius")};
  background: transparent;
  color: ${v("text-sub")};
  font-family: ${v("font-ui")};
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  letter-spacing: ${v("label-tracking")};
  line-height: ${v("label-leading")};
  text-transform: uppercase;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  transition: none;
}
/* The chip stays small; an invisible 44 px box takes the touch. It stops at the slider's top edge (the row gap
   under the chip) and grows upward into the row spacing, so it never takes a drag meant for the slider. */
.nc-tap::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: calc(-1 * ${v("control-gap")});
  width: max(100%, ${v("target-min")});
  height: max(100%, ${v("target-min")});
  transform: translateX(-50%);
}
/* The chip's ::before is already its touch box and stops at the slider; a hit pad on top of it covered the top
   half of the tempo slider, so a drag there tapped instead (Rhythm #40). */
.nc-tap > .nc-hit { display: none; }
.nc-tap:hover { border-color: ${v("text-sub")}; color: ${v("text")}; }
.nc-tap:active { background: ${v("text")}; border-color: ${v("text")}; color: ${v("surface-page")}; }
.nc-tap:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
/* ASTRID row spacing: a 48 px row every 72 px (measured on ASTRID's VCA at 1280 and 390). */
/* A flat phone-only group's sliders count as the section's own (group.js, collapse: "phone"). */
.nc-section:is(:has(> .nc-field[data-nc-slider]), :has(> .nc-group[data-nc-collapse="phone"] > .nc-group-body > .nc-field[data-nc-slider])) { row-gap: ${v("module-pad")}; }
.nc-section[data-nc-inset="true"] {
  margin-inline: calc(${v("module-pad")} * -1);
  margin-bottom: calc(${v("module-pad")} * -1);
  padding: ${v("module-pad")};
}
.nc-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: ${v("slider-pitch")};
  background: transparent;
  cursor: pointer;
  transition: none;
  accent-color: ${v("accent")};
}
/* Dimming is by colour, never opacity (plan 5.1): a disabled or bypassed control's label, value, track and thumb go
   to text-sub at full strength, so every pair keeps its contrast (Lucy's panel fix: 38 of 38 pairs pass). */
.nc-range:disabled { cursor: not-allowed; accent-color: ${v("text-sub")}; }
.nc-range:disabled::-webkit-slider-thumb { background: ${v("text-sub")}; }
.nc-range:disabled::-moz-range-thumb { background: ${v("text-sub")}; }
.nc-range:disabled::-moz-range-progress { background: ${v("text-sub")}; }
[data-nc-dim="true"] .nc-label, [data-nc-dim="true"] .nc-readout, [data-nc-dim="true"] .nc-ui-fx-name, [data-nc-dim="true"] .nc-ui-fx-fold-name,
[data-nc-dim="true"] .nc-select { color: ${v("text-sub")}; }
[data-nc-dim="true"] .nc-range { accent-color: ${v("text-sub")}; }
[data-nc-dim="true"] .nc-range::-webkit-slider-thumb { background: ${v("text-sub")}; }
[data-nc-dim="true"] .nc-range::-moz-range-thumb { background: ${v("text-sub")}; }
[data-nc-dim="true"] .nc-range::-moz-range-progress { background: ${v("text-sub")}; }
.nc-range::-webkit-slider-runnable-track {
  height: ${v("hairline")};
  background: ${v("slider-track")};
  transition: none;
}
.nc-range::-moz-range-track {
  height: ${v("hairline")};
  background: ${v("slider-track")};
  transition: none;
}
.nc-range::-moz-range-progress {
  height: ${v("hairline")};
  background: ${v("slider-progress")};
  transition: none;
}
.nc-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: ${v("slider-thumb-size")};
  height: ${v("slider-thumb-size")};
  margin-top: calc(${v("slider-thumb-size")} / -2);
  border: 0;
  border-radius: 50%;
  background: ${v("slider-thumb")};
  transition: none;
}
.nc-range::-moz-range-thumb {
  width: ${v("slider-thumb-size")};
  height: ${v("slider-thumb-size")};
  border: 0;
  border-radius: 50%;
  background: ${v("slider-thumb")};
  transition: none;
}
${MODULATED_SELECTOR} { transition: none; }
.nc-range:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("control-gap")}; }
.nc-btn {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: ${v("hairline")} solid ${v("text")};
  background: transparent;
  color: ${v("text")};
  min-height: ${v("target-min")};
  padding: ${v("button-pad-y")} 0;
  font-size: ${v("readout-size")};
  letter-spacing: ${v("button-tracking")};
  text-transform: uppercase;
  cursor: pointer;
  transition-property: color, background-color, border-color, transform;
  transition-duration: ${v("transition-feedback")};
}
.nc-btn:hover { background: ${v("surface-raised")}; }
.nc-btn:active { transform: scale(0.985); }
.nc-btn[data-on="true"] {
  background: ${v("accent")};
  border-color: ${v("accent")};
  color: ${v("on-accent")};
}
.nc-btn:focus-visible {
  outline: ${v("focus-width-strong")} solid ${v("focus-ring")};
  outline-offset: ${v("control-gap")};
}
.nc-btn:disabled { color: ${v("text-sub")}; border-color: ${v("divider")}; cursor: not-allowed; }
.nc-toggle {
  border: 0;
  border-bottom: ${v("hairline")} solid transparent;
  background: transparent;
  color: ${v("text-sub")};
  font-size: ${v("label-size")};
  font-weight: ${v("control-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  padding: 0 0 ${v("control-gap")};
  cursor: pointer;
  align-self: flex-start;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition-property: color, border-color;
  transition-duration: ${v("transition-feedback")};
}
.nc-toggle:hover, .nc-toggle[aria-pressed="true"] { color: ${v("text")}; }
.nc-toggle:hover { border-bottom-color: ${v("text")}; }
.nc-toggle[aria-pressed="true"] { border-bottom-color: ${v("accent")}; }
.nc-toggle[data-nc-role="mute"][aria-pressed="true"] { color: ${v("rhythm.track-mute")}; }
.nc-toggle[data-nc-role="solo"][aria-pressed="true"] {
  color: ${v("rhythm.track-solo")};
  border-bottom-color: ${v("rhythm.track-solo")};
}
.nc-toggle:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("control-gap")};
}
/* Underline tabs (ASTRID .nc-seg): words on a hairline, the chosen one in text with a tab-mark accent bar on the
   line. Radio semantics stay (role="radio", aria-checked). */
.nc-seg {
  display: flex;
  border-bottom: ${v("hairline")} solid ${v("divider")};
  margin-bottom: ${v("module-gap")};
  min-width: 0;
}
.nc-seg > button {
  flex: 1 1 0;
  position: relative;
  min-width: 0;
  padding: ${v("tab-pad-y")} 0;
  border: 0;
  background: transparent;
  color: ${v("text-sub")};
  font-size: ${v("tab-size")};
  font-weight: ${v("control-weight")};
  white-space: nowrap;
  cursor: pointer;
  transition-property: color;
  transition-duration: ${v("transition-feedback")};
}
.nc-seg:has(> button:nth-child(4)) > button { font-size: ${v("label-size")}; padding-inline: ${v("control-gap")}; }
.nc-seg > button:hover { color: ${v("text")}; }
.nc-seg > button[aria-checked="true"] { color: ${v("text")}; }
.nc-seg > button[aria-checked="true"]::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(${v("hairline")} * -1);
  height: ${v("tab-mark")};
  background: ${v("accent")};
}
.nc-seg > button:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: calc(${v("focus-width")} * -1);
}
.nc-select {
  flex: 1 1 auto;
  min-width: 0;
  appearance: none;
  background: transparent;
  border: 0;
  border-bottom: ${v("hairline")} solid ${v("divider")};
  border-radius: 0;
  color: ${v("text")};
  font-size: ${v("body-size")};
  padding: ${v("control-gap")} ${v("select-pad-end")} ${v("control-gap")} 0;
  cursor: pointer;
  transition: none;
}
.nc-select:hover:not(:disabled) { border-bottom-color: ${v("text-sub")}; }
.nc-select:focus-visible { outline: none; border-bottom-color: ${v("accent")}; }
/* Slots on one line, Morph under them as a slider row (label and value, then the slider). */
.nc-slot-row { flex-direction: column; align-items: stretch; gap: ${v("module-gap")}; }
.nc-slot-line { display: flex; flex-wrap: nowrap; align-items: center; gap: ${v("slot-gap")}; min-width: 0; }
.nc-morph-field { padding-bottom: 0; }
.nc-snap-row {
  display: flex;
  flex-wrap: nowrap;
  gap: ${v("slot-gap")};
  min-width: 0;
  flex: 1 1 auto;
}
.nc-snap-wrap {
  position: relative;
  flex: 1 1 ${v("slot-size")};
  width: ${v("slot-size")};
  max-width: ${v("slot-size")};
  min-width: 0;
  height: ${v("slot-size")};
  -webkit-touch-callout: none;
  user-select: none;
}
.nc-snap {
  display: block;
  width: 100%;
  height: 100%;
  -webkit-touch-callout: none;
  user-select: none;
  touch-action: manipulation;
  border: ${v("hairline")} solid ${v("divider")};
  border-radius: ${v("slot-radius")};
  background: transparent;
  color: ${v("text-sub")};
  font-family: ${v("font-readout")};
  font-size: ${v("slot-font-size")};
  line-height: ${v("label-leading")};
  padding: 0;
  cursor: pointer;
  transition: none;
}
.nc-snap:hover { border-color: ${v("text-sub")}; }
/* Has saved content: an ink outline and ink digit, as in Bass (no grey fill). Empty: hairline, sub ink. */
.nc-snap[data-filled="true"] {
  border-color: ${v("text-sub")};
  color: ${v("text")};
}
/* Active (Bass): the accent outline, ink and underline, in every theme and surprise palette. */
.nc-snap[data-active="true"] {
  background: transparent;
  border-color: ${v("accent")};
  color: ${v("accent")};
  box-shadow: inset 0 calc(-1 * ${v("focus-width")} * 2) 0 ${v("accent")};
}
/* Queued for the end of the bar (Bass): a faint accent underline and outline that go full accent on each beat
   (audio-driven, from the playhead), steady under reduced motion. A second tap switches now. */
.nc-snap[data-queued="true"] {
  color: ${v("accent")};
  outline: ${v("focus-width")} solid ${v("accent-faint")};
  outline-offset: ${v("hairline")};
  box-shadow: inset 0 calc(-1 * ${v("focus-width")} * 2) 0 ${v("accent-faint")};
}
.nc-snap[data-queued="true"][data-pulse="true"] {
  outline-color: ${v("accent")};
  background: ${v("accent-soft")};
  box-shadow: inset 0 calc(-1 * ${v("focus-width")} * 2) 0 ${v("accent")};
}
/* Edited since it was stored or recalled: a small dot in the corner, in the slot's ink. */
.nc-snap[data-edited="true"] { position: relative; }
.nc-snap[data-edited="true"]::after {
  content: "";
  position: absolute;
  top: ${v("control-gap")};
  right: ${v("control-gap")};
  width: ${v("control-gap")};
  height: ${v("control-gap")};
  border-radius: 50%;
  background: currentColor;
}
.nc-snap:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("hairline")};
}
.nc-sparkle {
  position: relative;
  flex: 0 0 ${v("sparkle-size")};
  width: ${v("sparkle-size")};
  height: ${v("sparkle-size")};
  margin-inline: ${v("rhythm.sparkle-gap")};
  padding: 0;
  border: 0;
  background: transparent;
  color: ${v("text-sub")};
  display: grid;
  place-items: center;
  cursor: pointer;
  transition-property: color;
  transition-duration: ${v("transition-feedback")};
}
.nc-play-row {
  display: flex;
  align-items: stretch;
  gap: ${v("rhythm.sparkle-gap")};
}
.nc-play-row > .nc-btn { flex: 1 1 auto; width: auto; }
.nc-sparkle-btn {
  flex: 0 0 ${v("target-min")};
  width: ${v("target-min")};
  min-height: ${v("target-min")};
  padding: 0;
  border: ${v("hairline")} solid ${v("divider")};
  background: ${v("surprise-fill")};
  color: ${v("surprise-ink")};
  display: grid;
  place-items: center;
  cursor: pointer;
  transition-property: color, background-color, transform;
  transition-duration: ${v("transition-feedback")};
}
.nc-sparkle-btn svg { width: calc(${v("target-min")} / 2); height: calc(${v("target-min")} / 2); display: block; }
.nc-sparkle-btn:hover { background: ${v("surface-raised")}; }
.nc-sparkle-btn:active { transform: scale(0.985); }
.nc-sparkle-btn:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("hairline")};
}
.nc-sparkle svg { width: ${v("sparkle-icon-size")}; height: ${v("sparkle-icon-size")}; display: block; }
.nc-sparkle:hover { color: ${v("text")}; }
.nc-sparkle:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("hairline")};
}
.nc-module-hd:has(> .nc-snap-msg:not(:empty)) { flex-wrap: wrap; row-gap: 0; }
.nc-snap-msg:not(:empty) { order: 1; flex-basis: 100%; }
.nc-snap-msg {
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  color: ${v("text-sub")};
  white-space: normal;
  overflow: hidden;
  transition: none;
}
.nc-module[data-nc-slim] {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${v("header-gap")};
}
.nc-module[data-nc-slim] .nc-module-hd { display: contents; }
.nc-module[data-nc-slim] .nc-title { order: 0; }
.nc-module[data-nc-slim] .nc-snap-msg { order: 1; }
.nc-module[data-nc-slim] .nc-slim { order: 2; margin-top: 0; }
.nc-module[data-nc-slim] .nc-module-end { order: 3; }
.nc-steps {
  display: flex;
  flex-wrap: nowrap;
  gap: ${v("rhythm.step-gap")};
  min-width: 0;
  flex: 1 1 auto;
}
.nc-name {
  flex: 0 1 ${v("name-width")};
  width: ${v("name-width")};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.nc-name:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("hairline")};
}
/* Beats read at a glance: every 4 steps the gap widens from step-gap to beat-gap (one beat = one pad row on phones). */
/* Counted among the cells only ("of .nc-step-wrap"): the lane's end handle sits between cells when the lane is short,
   and must not push a beat gap onto the wrong cell. */
.nc-steps > .nc-step-wrap:nth-child(4n + 1 of .nc-step-wrap):not(:first-child) {
  margin-inline-start: calc(${v("beat-gap")} - ${v("rhythm.step-gap")});
}
/* Every lane row bleeds a little into the module padding, so the selected one can be tinted edge to edge (M, S,
   name, steps, menu) with its marker clear of the M button, without moving anything when the selection changes. */
.nc-row[data-nc-row] {
  margin-inline: calc(-1 * ${v("row-inset")});
  padding-inline: ${v("row-inset")};
}
/* The selected lane is lit, not just underlined: the whole row tinted, with a solid accent bar at its start. */
.nc-row[data-selected="true"] {
  background: ${v("accent-tint")};
  box-shadow: inset ${v("marker-width")} 0 0 ${v("accent")};
}
/* Also selected (multi-select): the same tint, no marker; the name underlined. */
.nc-row[data-picked="true"] { background: ${v("accent-tint")}; }
.nc-row[data-picked="true"] .nc-name,
.nc-row[data-selected="true"] .nc-name {
  color: ${v("text")};
  text-decoration: underline;
  text-decoration-color: ${v("accent")};
  text-decoration-thickness: ${v("hairline")};
  text-underline-offset: ${v("control-gap")};
}
/* On the tint, off steps and unlit M/S are paper squares (step-cell-off), as in the mockup, so their outlines stay
   crisp instead of melting into the tint. */
.nc-row[data-selected="true"] .nc-step:not([aria-pressed="true"]):not([data-accent="true"]):not([data-out="true"]),
.nc-row[data-selected="true"] .nc-ms:not([aria-pressed="true"]),
.nc-row[data-picked="true"] .nc-step:not([aria-pressed="true"]):not([data-accent="true"]):not([data-out="true"]),
.nc-row[data-picked="true"] .nc-ms:not([aria-pressed="true"]) { background: ${v("rhythm.step-cell-off")}; }
/* Moves (renderMoves): a label column, then quiet square icon buttons that darken on hover (Bass's look). */
.nc-moves { display: flex; flex-direction: column; gap: ${v("move-row-gap")}; margin-top: ${v("page-body-gap")}; }
.nc-moves-row { display: flex; align-items: center; gap: ${v("module-gap")}; }
.nc-moves-label {
  flex: none;
  width: ${v("move-label-width")};
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  color: ${v("text-sub")};
}
.nc-moves-btns { display: flex; flex-wrap: wrap; gap: ${v("move-gap")}; min-width: 0; }
.nc-moves-btn {
  display: grid;
  place-items: center;
  width: ${v("move-size")};
  height: ${v("move-size")};
  padding: 0;
  border: ${v("hairline")} solid ${v("divider")};
  border-radius: ${v("slot-radius")};
  background: transparent;
  color: ${v("text-sub")};
  cursor: pointer;
}
.nc-moves-icon { width: ${v("move-icon")}; height: ${v("move-icon")}; }
.nc-moves-btn:hover:not(:disabled) { color: ${v("text")}; border-color: ${v("text-sub")}; }
.nc-moves-btn:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-moves-btn:disabled { color: ${v("divider")}; cursor: default; }
@media (pointer: coarse) {
  .nc-moves-btn { width: ${v("target-min")}; height: ${v("target-min")}; }
}
/* Muted, or silenced by another lane's solo: the lane's steps dim by colour, not just its button. On steps fill with
   text-sub (the velocity shade is set aside while silent), off steps keep only a divider outline. */
.nc-row[data-silent="true"] .nc-step { border-color: ${v("divider")}; }
.nc-row[data-silent="true"] .nc-step[aria-pressed="true"] { background: ${v("text-sub")}; border-color: ${v("text-sub")}; }
.nc-name[data-nc-lane="1"] { color: ${v("rhythm.lane-1")}; }
.nc-name[data-nc-lane="2"] { color: ${v("rhythm.lane-2")}; }
.nc-name[data-nc-lane="3"] { color: ${v("rhythm.lane-3")}; }
.nc-name[data-nc-lane="4"] { color: ${v("rhythm.lane-4")}; }
.nc-ms-wrap {
  position: relative;
  flex: 0 0 ${v("slider-pitch")};
  height: ${v("slider-pitch")};
}
.nc-ms {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: ${v("hairline")} solid ${v("divider")};
  border-radius: ${v("slot-radius")};
  background: transparent;
  color: ${v("text-sub")};
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  cursor: pointer;
  transition: none;
}
.nc-ms:hover { color: ${v("text")}; }
.nc-ms[data-nc-ms="mute"][aria-pressed="true"] {
  background: ${v("rhythm.track-mute")};
  border-color: ${v("rhythm.track-mute")};
  color: ${v("surface-page")};
}
.nc-ms[data-nc-ms="solo"][aria-pressed="true"] {
  background: ${v("rhythm.track-solo")};
  border-color: ${v("rhythm.track-solo")};
  color: ${v("surface-page")};
}
.nc-ms:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("hairline")};
}
.nc-step-wrap {
  position: relative;
  flex: 1 1 ${v("rhythm.step-cell-size")};
  min-width: 0;
  aspect-ratio: 1;
  max-height: ${v("slider-pitch")};
}
.nc-step {
  position: absolute;
  inset: 0;
  overflow: hidden;
  width: 100%;
  height: 100%;
  border: ${v("hairline")} solid ${v("text-sub")};
  border-radius: ${v("slot-radius")};
  background: transparent;
  padding: 0;
  cursor: pointer;
  transition: none;
}
/* Readable grid: off = empty outline, on = solid. The fill is the step's velocity (velocity-fill, set per cell from
   velocityFill: 5% = rhythm.velocity-min, 100% = rhythm.velocity-max, the accent; step-cell-on when a cell has no
   velocity). Shade means velocity, so an accent is a mark instead: a paper bar inside the step's bottom edge (an inset
   shadow, no layout), clear on every fill of the ramp. No transition: the shade snaps when the velocity changes. */
.nc-step[aria-pressed="true"] {
  background: ${v("velocity-fill")};
  border-color: ${v("velocity-fill")};
  color: ${v("rhythm.step-cell-ink")};
}
.nc-step[aria-pressed="true"][data-accent="true"] {
  box-shadow: inset 0 calc(-1 * ${v("rhythm.accent-mark-size")}) 0 0 ${v("rhythm.accent-mark")};
}
/* The playing step, Bass's method: an accent ring outside the step, one hairline clear of it, so it reads the same on an
   empty step or a filled one at any velocity, and every lane's ring at the playhead forms one column. It lifts
   above its neighbours (the ring is wider than step-gap). No transition: it follows the audio clock, step by step. */
.nc-step[data-playhead="true"] {
  z-index: 1;
  outline: ${v("playhead-width")} solid ${v("rhythm.playhead")};
  outline-offset: ${v("playhead-offset")};
}
.nc-step[data-bar="true"] { border-bottom-color: ${v("rhythm.bar-accent")}; }
/* Chance below 100%: a dashed outline at the same width (style only, no opacity, since shade means velocity). The fill
   stops at the padding box, so the dashes are the step's own colour with the row showing between them. */
.nc-step[data-dim="true"] { border-style: dashed; background-clip: padding-box; }
/* Per-lane length: steps past the end are ghosted on the selected row; the end handle sits after the last step. */
.nc-step[data-out="true"] { border-color: ${v("divider")}; background: transparent; pointer-events: none; }
/* Every lane lays its handle out the same way, selected or not, and the handle takes no width in the row: its negative
   margins cancel its own width and the step gap it adds, so it sits centred in the gap after the last step and the
   cells never move when the selection changes. Unselected lanes keep it hidden (visibility, so it cannot be focused). */
.nc-len-handle {
  display: block;
  visibility: hidden;
  position: relative;
  flex: none;
  align-self: stretch;
  width: ${v("control-gap")};
  margin-inline: calc((${v("control-gap")} + ${v("rhythm.step-gap")}) / -2);
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
  touch-action: none;
  transition: none;
}
/* The bar itself overhangs the step row (a lane-height grip) without changing the row's layout. */
.nc-len-handle::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: ${v("hairline")};
  height: ${v("target-min")};
  max-height: calc(${v("target-min")} / 2);
  transform: translate(-50%, -50%);
  border-inline: ${v("hairline")} solid ${v("text-sub")};
  background: ${v("text-sub")};
}
.nc-row[data-selected="true"] .nc-len-handle { visibility: visible; z-index: 1; }
.nc-len-handle:hover::before, .nc-len-handle[data-dragging="true"]::before { background: ${v("text")}; border-color: ${v("text")}; }
.nc-len-handle:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
button.nc-pads-label {
  border: 0;
  background: transparent;
  min-height: ${v("target-min")};
  padding: 0;
  font-family: inherit;
  cursor: pointer;
}
button.nc-pads-label[aria-pressed="true"] { color: ${v("accent")}; }
.nc-pad[data-out="true"] { border-color: ${v("divider")}; border-style: dashed; background: transparent; color: ${v("text-sub")}; }
.nc-pad[data-end="true"] { box-shadow: inset calc(-1 * ${v("focus-width")} * 2) 0 0 ${v("text")}; }
.nc-pad[data-end="true"][aria-pressed="true"][data-accent="true"] {
  box-shadow: inset calc(-1 * ${v("focus-width")} * 2) 0 0 ${v("text")}, inset 0 calc(-1 * ${v("rhythm.accent-mark-size")}) 0 0 ${v("rhythm.accent-mark")};
}
.nc-pads { display: none; }
.nc-pads-head { display: none; }
.nc-pads-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  color: ${v("text")};
}
.nc-step-tools {
  display: flex;
  align-items: stretch;
  gap: ${v("module-gap")};
  margin-bottom: ${v("module-gap")};
}
.nc-step-tools > .nc-seg { flex: 1 1 auto; align-self: flex-end; margin-bottom: 0; }
/* No margin (nor the sparkle's): the row gap already sets the dice off the length handle, and 1024 needs the
   width for 18 px cells now that beats are split by beat-gap. */
.nc-row-dice { flex: none; margin-inline: 0; }
.nc-pads-dice svg { width: calc(${v("target-min")} / 3); height: calc(${v("target-min")} / 3); display: block; margin: auto; }
.nc-fill { padding-inline: ${v("module-gap")}; touch-action: none; user-select: none; -webkit-user-select: none; }
/* Clear is a tap, not a hold: phones still scroll over it. */
.nc-clear { touch-action: manipulation; }
.nc-fill[aria-pressed="true"] { background: ${v("text")}; border-color: ${v("text")}; color: ${v("surface-page")}; }
.nc-pads-step, .nc-pads-play, .nc-fill {
  flex: none;
  min-width: ${v("target-min")};
  min-height: ${v("target-min")};
  border: ${v("hairline")} solid ${v("divider")};
  border-radius: ${v("slot-radius")};
  background: ${v("surface-page")};
  color: ${v("text")};
  font-family: ${v("font-ui")};
  font-size: ${v("label-size")};
  font-weight: ${v("title-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  cursor: pointer;
  transition: none;
}
.nc-pads-play { padding-inline: ${v("module-gap")}; }
.nc-pads-play[aria-pressed="true"] { background: ${v("text")}; border-color: ${v("text")}; color: ${v("surface-page")}; }
.nc-pads-step:focus-visible, .nc-pads-play:focus-visible, .nc-fill:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("hairline")};
}
/* Fill and Clear are text actions, like the page's Save and Load (Peter, 2026-10-31: the buttons took too much
   height). Fill held reads as pressed: ink with an ink underline. On a coarse pointer an invisible pad keeps each a
   full target (below). */
:is(.nc-step-tools .nc-fill, .nc-fill.nc-clear) {
  min-width: 0;
  min-height: 0;
  align-self: center;
  border: 0;
  border-bottom: ${v("hairline")} solid transparent;
  border-radius: 0;
  background: transparent;
  padding: 0 0 ${v("control-gap")};
  color: ${v("text-sub")};
  font-weight: ${v("control-weight")};
  transition-property: color, border-color;
  transition-duration: ${v("transition-feedback")};
}
:is(.nc-step-tools .nc-fill, .nc-fill.nc-clear):hover,
:is(.nc-step-tools .nc-fill, .nc-fill.nc-clear)[aria-pressed="true"] { background: transparent; color: ${v("text")}; border-bottom-color: ${v("text")}; }
:is(.nc-step-tools .nc-fill, .nc-fill.nc-clear):focus-visible { outline-offset: ${v("control-gap")}; }
/* Two text actions side by side (Fill, Clear) get the page actions' gap. */
.nc-step-tools .nc-fill + .nc-fill { margin-left: ${v("page-action-gap")}; }
.nc-pad {
  position: relative;
  overflow: hidden;
  min-height: calc(${v("target-min")} * 1.25);
  border: ${v("hairline")} solid ${v("text-sub")};
  border-radius: ${v("slot-radius")};
  background: transparent;
  color: ${v("text-sub")};
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  text-align: start;
  vertical-align: top;
  padding: ${v("control-gap")} ${v("module-gap")};
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  transition: none;
}
/* Pads show the selected lane's steps, so they follow the same rules: fill = velocity, accent = the paper mark,
   chance below 100% = dashed outline. */
.nc-pad[aria-pressed="true"] {
  background: ${v("velocity-fill")};
  border-color: ${v("velocity-fill")};
  color: ${v("rhythm.step-cell-ink")};
}
.nc-pad[aria-pressed="true"][data-accent="true"] {
  box-shadow: inset 0 calc(-1 * ${v("rhythm.accent-mark-size")}) 0 0 ${v("rhythm.accent-mark")};
}
.nc-pad[data-playhead="true"] {
  outline: ${v("playhead-width")} solid ${v("rhythm.playhead")};
  outline-offset: ${v("playhead-offset")};
}
.nc-pad[data-dim="true"] { border-style: dashed; background-clip: padding-box; }
.nc-pads[data-silent="true"] .nc-pad { border-color: ${v("divider")}; color: ${v("text-sub")}; }
.nc-pads[data-silent="true"] .nc-pad[aria-pressed="true"] { background: ${v("text-sub")}; border-color: ${v("text-sub")}; color: ${v("surface-page")}; }
.nc-pad:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("hairline")};
}
.nc-step:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("hairline")};
}
/* A focused step or pad that is also playing keeps the playhead ring (focus comes later at the same specificity and
   would thin it to focus-width; both are the accent). */
.nc-step[data-playhead="true"]:focus-visible, .nc-pad[data-playhead="true"]:focus-visible {
  outline-width: ${v("playhead-width")};
  outline-offset: ${v("playhead-offset")};
}
.nc-ui-fx {
  margin-inline: calc(${v("module-pad")} * -1);
  padding: ${v("stack-card-pad-y")} ${v("module-pad")};
  min-width: 0;
  transition: none;
}
.nc-ui-fx-name {
  margin: 0 0 ${v("module-gap")} 0;
  font-size: ${v("body-size")};
  font-weight: ${v("fx-name-weight")};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* FX card header: the effect's name and its switch on one row of at least a target's height. When the switch is
   off the card dims by colour ([data-nc-dim]). "More" holds the rarely used rows (fx-blocks' <details>). */
.nc-ui-fx-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${v("module-gap")};
  margin-bottom: ${v("module-gap")};
  min-width: 0;
}
.nc-ui-fx-hd > .nc-ui-fx-name { margin: 0 auto 0 0; }
/* Fold (onFold): a −/+ after the switch. Folded, the card keeps its header row only; in a console row from 769 px it
   is a narrow column instead (below). It folds and unfolds at once: no motion. */
.nc-ui-fx-hd > [data-nc-fx-hide] { flex: none; }
/* Like a channel strip's (Peter, 2026-11-01: "the minimize icon should be positioned in the same place as the
   instrument channels"): the fold triangle sits in the card's top-left corner, above the name. */
.nc-ui-fx:has(> .nc-ui-fx-hd > [data-nc-fx-hide]) { position: relative; }
.nc-ui-fx-hd > [data-nc-fx-hide] { position: absolute; top: ${v("control-gap")}; left: ${v("control-gap")}; z-index: 1; }
/* The horizontal-fold toggle (foldToggle): a small solid triangle, about the ×'s size, in text-sub (ink on hover).
   ◀ while open, flipped to ▶ while folded; the flip takes motion-press, and reduced motion makes it instant. −/+
   (.nc-hide) stays the vertical hide: the triangle means fold sideways. */
.nc-fold-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  margin: 0;
  padding: ${v("hairline")};
  border: 0;
  background: transparent;
  color: ${v("text-sub")};
  line-height: 1;
  cursor: pointer;
}
.nc-fold-toggle:hover { color: ${v("text")}; }
.nc-fold-toggle:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-fold-tri {
  display: block;
  width: calc(${v("control-gap")} * 1.5);
  height: calc(${v("control-gap")} * 2);
  background: currentColor;
  clip-path: polygon(100% 0, 0 50%, 100% 100%);
  transition: transform ${v("motion-press")} ${v("motion-press-easing")};
}
.nc-fold-toggle[aria-expanded="false"] .nc-fold-tri,
.nc-ui-fx-fold > .nc-fold-tri { transform: scaleX(-1); }
.nc-ui-fx-fold > .nc-fold-tri { flex: none; color: ${v("text-sub")}; }
.nc-ui-fx-fold:hover > .nc-fold-tri { color: ${v("text")}; }
.nc-ui-fx-fold { display: none; }
/* A folded card's column width: fx-fold-width, or fx-fold-width-slim for a card with foldSlim (the Studio's send
   returns; Peter, 2026-11-01: "make send effect minimized state 50% thinner"). */
.nc-ui-fx { --nc-fx-fold-w: ${v("fx-fold-width")}; }
.nc-ui-fx[data-nc-fold-slim] { --nc-fx-fold-w: ${v("fx-fold-width-slim")}; }
.nc-ui-fx[data-nc-folded] > :not(.nc-ui-fx-hd, .nc-token-probe) { display: none; }
.nc-ui-fx[data-nc-folded] > .nc-ui-fx-hd { margin-bottom: 0; }
.nc-ui-fx-fold {
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: ${v("module-gap")};
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${v("text-sub")};
  font: inherit;
  cursor: pointer;
  transition: none;
}
.nc-ui-fx-fold:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("control-gap")}; }
/* The on/off word as the switch draws it: off text-sub, on text with the accent hairline. */
.nc-ui-fx-fold-state {
  padding-bottom: ${v("control-gap")};
  border-bottom: ${v("hairline")} solid transparent;
  font-size: ${v("label-size")};
  font-weight: ${v("control-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  line-height: ${v("label-leading")};
}
.nc-ui-fx-fold[data-on="true"] .nc-ui-fx-fold-state { color: ${v("text")}; border-bottom-color: ${v("accent")}; }
/* The name read bottom to top (the Studio's instrument spine). */
.nc-ui-fx-fold-name {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: ${v("body-size")};
  font-weight: ${v("fx-name-weight")};
  color: ${v("text")};
  white-space: nowrap;
}
.nc-ui-fx-fold:hover .nc-ui-fx-fold-state { color: ${v("text")}; }
/* The slim column (fx-fold-width-slim): the same parts, the on/off word a step smaller so OFF fits with room. */
.nc-ui-fx[data-nc-fold-slim] .nc-ui-fx-fold-state { font-size: ${v("scale-size")}; letter-spacing: 0; }
.nc-ui-fx-visual { display: block; width: 100%; height: ${v("display-height")}; }
/* Level steps (level-steps.js, Gate's strip): a display like the EQ graph's, a column per step (beats a gap apart,
   swing widening the first of each pair), the level a soft bar, the shape's curve in the accent over it, the playing
   step ringed (the accent while locked to Play, quieter while it runs free). Under it the step numbers and the shape
   tabs. A long press opens the shape picker over the step. */
.nc-lsteps { position: relative; min-width: 0; margin-bottom: ${v("control-gap")}; }
.nc-lsteps-plot {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: ${v("slot-gap")};
  height: ${v("level-steps-height")};
  padding: calc(${v("slot-gap")} * 2);
  background: ${v("eq-graph-bg")};
  border-radius: ${v("slot-radius")};
  box-shadow: inset 0 0 0 ${v("hairline")} ${v("divider")};
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  cursor: ns-resize;
}
.nc-lsteps-plot:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-ui-fx[data-nc-max] .nc-lsteps-plot { height: ${v("level-steps-height-max")}; }
.nc-lsteps-step { position: relative; flex: var(--nc-lsteps-grow, 1) 1 0; min-width: 0; border-radius: ${v("slot-radius")}; }
.nc-lsteps-step[data-beat="true"], .nc-lsteps-axis > span[data-beat="true"] { margin-inline-start: calc(${v("beat-gap")} - ${v("slot-gap")}); }
.nc-lsteps-step > svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; pointer-events: none; }
.nc-lsteps-level { fill: ${v("level-steps-bar")}; }
.nc-lsteps-env { fill: ${v("level-steps-curve")}; }
.nc-lsteps-top { fill: none; stroke: ${v("level-steps-curve")}; stroke-width: ${v("grid-stroke")}; vector-effect: non-scaling-stroke; }
.nc-lsteps-floor { stroke: ${v("divider")}; stroke-width: ${v("grid-stroke")}; vector-effect: non-scaling-stroke; }
.nc-lsteps-step[data-zero="true"] .nc-lsteps-floor { stroke: ${v("text-sub")}; stroke-dasharray: 2 2; }
/* 1/8T with 16 steps: 13-16 don't play. Dashed and empty, as a step grid's out-of-range steps. */
.nc-lsteps-step[data-out="true"] { box-shadow: inset 0 0 0 ${v("hairline")} ${v("divider")}; }
.nc-lsteps-step[data-out="true"] .nc-lsteps-level, .nc-lsteps-step[data-out="true"] .nc-lsteps-env { fill: transparent; }
.nc-lsteps-step[data-out="true"] .nc-lsteps-top { stroke: ${v("divider")}; }
.nc-lsteps-step[data-playhead="true"] { z-index: 1; outline: ${v("playhead-width")} solid ${v("playhead")}; outline-offset: ${v("playhead-offset")}; }
.nc-lsteps-step[data-playhead="true"][data-locked="false"] { outline-color: ${v("level-steps-free")}; outline-width: ${v("hairline")}; }
.nc-lsteps-step[data-focus="true"] { box-shadow: inset 0 calc(${v("playhead-width")} * -1) 0 0 ${v("focus-ring")}; }
.nc-lsteps-plot:not(:focus-visible) .nc-lsteps-step[data-focus="true"] { box-shadow: none; }
.nc-lsteps[data-on="false"] .nc-lsteps-env, .nc-lsteps[data-on="false"] .nc-lsteps-level { fill: ${v("divider")}; }
.nc-lsteps[data-on="false"] .nc-lsteps-top { stroke: ${v("text-sub")}; }
.nc-lsteps-step[data-dragging="true"]::after {
  content: attr(data-level);
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translate(-50%, calc(calc(${v("slot-gap")} * 2) * -1));
  padding: calc(${v("slot-gap")} / 2) calc(${v("slot-gap")} * 2);
  border-radius: ${v("slot-radius")};
  background: ${v("accent")};
  color: ${v("on-accent")};
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  white-space: nowrap;
  pointer-events: none;
}
.nc-lsteps-axis {
  display: flex;
  gap: ${v("slot-gap")};
  padding: ${v("slot-gap")} calc(${v("slot-gap")} * 2) 0;
  font-family: ${v("font-readout")};
  font-size: ${v("slot-font-size")};
  line-height: 1;
  color: ${v("text-sub")};
}
.nc-lsteps-axis > span { flex: var(--nc-lsteps-grow, 1) 1 0; min-width: 0; }
.nc-lsteps-shapes { display: flex; border-bottom: ${v("hairline")} solid ${v("divider")}; margin-top: ${v("control-gap")}; min-width: 0; }
.nc-lsteps-shapes[hidden] { display: none; }
.nc-lsteps-shape, .nc-lsteps-pick > button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${v("slot-gap")};
  border: 0;
  background: transparent;
  color: ${v("text-sub")};
  font-family: ${v("font-ui")};
  font-size: ${v("label-size")};
  cursor: pointer;
  white-space: nowrap;
}
.nc-lsteps-shape { position: relative; flex: 1 1 0; min-width: 0; padding: ${v("slot-gap")} 0 ${v("control-gap")}; }
.nc-lsteps-shape:hover, .nc-lsteps-pick > button:hover { color: ${v("text")}; }
.nc-lsteps-shape[aria-selected="true"] { color: ${v("text")}; }
.nc-lsteps-shape[aria-selected="true"]::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(${v("hairline")} * -1);
  height: ${v("tab-mark")};
  background: ${v("accent")};
}
.nc-lsteps-shape:focus-visible, .nc-lsteps-pick > button:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: calc(${v("focus-width")} * -1); }
.nc-lsteps-ico { width: calc(${v("label-size")} * 1.8); height: calc(${v("label-size")} * 0.9); overflow: visible; }
.nc-lsteps-ico path { fill: none; stroke: currentColor; stroke-width: ${v("curve-stroke")}; vector-effect: non-scaling-stroke; }
.nc-lsteps-pick {
  position: absolute;
  z-index: 3;
  top: 0;
  left: var(--nc-lsteps-pick-x, 0);
  display: flex;
  align-items: stretch;
  gap: ${v("slot-gap")};
  padding: calc(${v("slot-gap")} * 2);
  background: ${v("surface-page")};
  border-radius: ${v("slot-radius")};
  box-shadow: 0 0 0 ${v("hairline")} ${v("divider")};
}
.nc-lsteps-pick[hidden] { display: none; }
.nc-lsteps-pick-head { align-self: center; padding: 0 calc(${v("slot-gap")} * 2); font-family: ${v("font-readout")}; font-size: ${v("readout-size-small")}; color: ${v("text-sub")}; white-space: nowrap; }
.nc-lsteps-pick > button { padding: calc(${v("slot-gap")} * 2); border-radius: ${v("slot-radius")}; }
.nc-lsteps-pick > button[aria-checked="true"] { color: ${v("on-accent")}; background: ${v("accent")}; }
@media (pointer: coarse) {
  .nc-lsteps-shape, .nc-lsteps-pick > button { min-height: ${v("target-min")}; justify-content: center; }
  .nc-lsteps-pick > button { min-width: ${v("target-min")}; }
}
/* EQ graph (eq-graph.js): a display at the top of an EQ card. A plot a touch off the card's shade, a hairline frame,
   the spectrum and curve canvases filling it, and one dot per band (its own colour) over them, each a 44 px target. */
.nc-eq { position: relative; min-width: 0; margin-bottom: ${v("control-gap")}; }
.nc-eq-plot {
  position: relative;
  height: ${v("eq-graph-height")};
  background: ${v("eq-graph-bg")};
  border-radius: ${v("slot-radius")};
  box-shadow: inset 0 0 0 ${v("hairline")} ${v("divider")};
}
.nc-eq-plot > canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; pointer-events: none; }
.nc-eq-node {
  --nc-eq-tone: ${v("eq-curve")};
  position: absolute;
  width: ${v("eq-node-size")};
  height: ${v("eq-node-size")};
  margin: calc(${v("eq-node-size")} / -2) 0 0 calc(${v("eq-node-size")} / -2);
  border-radius: 50%;
  background: var(--nc-eq-tone);
  box-shadow: 0 0 0 ${v("hairline")} ${v("eq-graph-bg")};
  cursor: grab;
  touch-action: none;
  outline: none;
  z-index: 1;
}
.nc-eq-node[data-tone="1"] { --nc-eq-tone: ${v("eq-band-1")}; }
.nc-eq-node[data-tone="2"] { --nc-eq-tone: ${v("eq-band-2")}; }
.nc-eq-node[data-tone="3"] { --nc-eq-tone: ${v("eq-band-3")}; }
/* The hit area (target-min), and a soft halo in the band's colour while it is hovered, focused or dragged. */
.nc-eq-node::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: ${v("target-min")};
  height: ${v("target-min")};
  transform: translate(-50%, -50%);
  border-radius: 50%;
}
.nc-eq-node::after {
  content: "";
  position: absolute;
  inset: calc(${v("control-gap")} * -1.5);
  border-radius: 50%;
  background: color-mix(in srgb, var(--nc-eq-tone) 24%, transparent);
  transform: scale(0);
  transition: transform ${v("motion-press")} ${v("motion-press-easing")};
  pointer-events: none;
}
.nc-eq-node:hover::after, .nc-eq-node[data-active="true"]::after { transform: scale(1); }
.nc-eq-node[data-drag="true"] { cursor: grabbing; }
.nc-eq-node:focus-visible { box-shadow: 0 0 0 calc(${v("hairline")} * 2) ${v("eq-graph-bg")}, 0 0 0 calc(${v("hairline")} * 2 + ${v("focus-width")}) ${v("focus-ring")}; }
.nc-eq[data-on="false"] .nc-eq-node { --nc-eq-tone: ${v("text-sub")}; }
/* Not maximized: a display. The dots are markers; a click on the plot maximizes the card. */
.nc-eq[data-locked] .nc-eq-plot { cursor: zoom-in; }
.nc-eq[data-locked] .nc-eq-node { pointer-events: none; cursor: inherit; }
/* The readout beside the band in use: "MID −18 dB · 938 Hz · Q 0.3". */
.nc-eq-tip {
  position: absolute;
  z-index: 2;
  padding: ${v("hairline")} ${v("control-gap")};
  border-radius: ${v("slot-radius")};
  background: ${v("eq-graph-bg")};
  box-shadow: inset 0 0 0 ${v("hairline")} ${v("divider")};
  color: ${v("text")};
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  letter-spacing: ${v("label-tracking")};
  line-height: ${v("label-leading")};
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
.nc-eq-tip[hidden] { display: none; }
/* Maximize (controls.js setMax): four corner ticks, out to maximize and in to restore, after the switch. */
.nc-fx-max, .nc-fx-close {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  margin: 0;
  padding: ${v("hairline")};
  border: 0;
  background: transparent;
  color: ${v("text-sub")};
  font: inherit;
  line-height: 1;
  cursor: pointer;
}
.nc-fx-max[hidden] { display: none; }
.nc-fx-max:hover, .nc-fx-close:hover { color: ${v("text")}; }
.nc-fx-max:focus-visible, .nc-fx-close:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-fx-close { font-size: ${v("title-size")}; padding-inline: ${v("control-gap")}; }
/* Remove (onRemove): a quiet × at the header's end, after maximize, sized like the header's other marks; text-sub,
   ink on hover (the strip's × turns danger: here Undo follows, so it stays calm). Its hit area reaches past the glyph
   to the right and a little up and down, never left over maximize. Not on a folded card (as a minimized strip),
   nor beside the wide panel's own ×. */
.nc-fx-remove {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  margin: 0;
  padding: 0 ${v("hairline")};
  border: 0;
  background: transparent;
  color: ${v("text-sub")};
  font-family: ${v("font-readout")};
  font-size: ${v("body-size")};
  line-height: 1;
  cursor: pointer;
}
.nc-fx-remove::before {
  content: "";
  position: absolute;
  top: 50%;
  left: calc(${v("control-gap")} * -1);
  right: calc(${v("control-gap")} * -1);
  height: max(100%, calc(${v("control-gap")} * 5));
  transform: translateY(-50%);
}
.nc-fx-remove:hover { color: ${v("text")}; }
.nc-fx-remove:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-fx-remove[hidden],
.nc-ui-fx[data-nc-folded] > .nc-ui-fx-hd > .nc-fx-remove,
.nc-ui-fx[data-nc-max="over"] > .nc-ui-fx-hd > .nc-fx-remove { display: none; }
.nc-fx-max-icon { position: relative; display: block; width: calc(${v("control-gap")} * 2.5); height: calc(${v("control-gap")} * 2.5); }
.nc-fx-max-icon > i {
  position: absolute;
  width: calc(${v("control-gap")} * 1.1);
  height: calc(${v("control-gap")} * 1.1);
  border: 0 solid currentColor;
  transition: transform ${v("motion-press")} ${v("motion-press-easing")};
}
.nc-fx-max-icon > i:nth-child(1) { left: 0; top: 0; border-left-width: calc(${v("hairline")} * 1.5); border-top-width: calc(${v("hairline")} * 1.5); }
.nc-fx-max-icon > i:nth-child(2) { right: 0; top: 0; border-right-width: calc(${v("hairline")} * 1.5); border-top-width: calc(${v("hairline")} * 1.5); }
.nc-fx-max-icon > i:nth-child(3) { left: 0; bottom: 0; border-left-width: calc(${v("hairline")} * 1.5); border-bottom-width: calc(${v("hairline")} * 1.5); }
.nc-fx-max-icon > i:nth-child(4) { right: 0; bottom: 0; border-right-width: calc(${v("hairline")} * 1.5); border-bottom-width: calc(${v("hairline")} * 1.5); }
.nc-fx-max[aria-pressed="true"] .nc-fx-max-icon > i { transform: rotate(180deg); }
/* Maximized: a taller plot, and the dials in columns under it (row and over). */
.nc-ui-fx[data-nc-max] .nc-eq-plot { height: ${v("eq-graph-height-max")}; }
.nc-ui-fx[data-nc-max="over"],
.nc-module-body[data-nc-layout="console"] .nc-ui-fx[data-nc-max="row"] {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(${v("fx-card-width")} * 0.6)), 1fr));
  column-gap: calc(${v("module-pad")} * 2);
  row-gap: ${v("module-gap")};
  align-content: start;
}
/* Maximized, the dials sit on one line (Peter, 2026-11-01): as many columns as the card has dials (--nc-fx-dials,
   set by controls.js), sharing the width. */
.nc-ui-fx[data-nc-max="over"][style*="--nc-fx-dials"],
.nc-module-body[data-nc-layout="console"] .nc-ui-fx[data-nc-max="row"][style*="--nc-fx-dials"] {
  grid-template-columns: repeat(var(--nc-fx-dials), minmax(0, 1fr));
  column-gap: ${v("module-pad")};
}
.nc-ui-fx[data-nc-max="row"] > :is(.nc-ui-fx-hd, .nc-eq, .nc-ui-more, .nc-ui-fx-fold, .nc-note),
.nc-ui-fx[data-nc-max="over"] > :is(.nc-ui-fx-hd, .nc-eq, .nc-ui-more, .nc-ui-fx-fold, .nc-note) { grid-column: 1 / -1; }
.nc-ui-fx[data-nc-max] > .nc-eq { margin-bottom: ${v("module-gap")}; }
/* Over the modules (an instrument's Hacks column): a panel three module widths wide, in its module, above the rest. */
.nc-module:has(.nc-ui-fx[data-nc-max="over"]) { position: relative; z-index: ${v("eq-panel-layer")}; }
.nc-ui-fx[data-nc-max="over"] {
  position: absolute;
  z-index: ${v("eq-panel-layer")};
  margin: 0;
  box-shadow: 0 0 0 ${v("hairline")} ${v("text-sub")};
}
.nc-fx-ghost { margin-inline: calc(${v("module-pad")} * -1); }
.nc-ui-more > summary {
  display: flex;
  align-items: center;
  padding-block: ${v("control-gap")};
  cursor: pointer;
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  color: ${v("text-sub")};
}
.nc-ui-more > summary:hover { color: ${v("text")}; }
.nc-ui-more > summary:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: calc(${v("focus-width")} * -1); }
/* Group (group.js): a collapsible run of a module's controls. Its header is the More toggle's look (label style,
   text-sub, hover to text) as a real button: the title with the -/+ mark at the end of its line, and while closed a
   quiet summary on its own line under them, wrapping rather than cut (a narrow column still shows all of it).
   Open or closed at once: no motion. Open, its controls space as the module's own do. */
.nc-group { display: flex; flex-direction: column; gap: ${v("module-pad")}; min-width: 0; }
.nc-group-toggle {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  column-gap: ${v("module-gap")};
  row-gap: ${v("control-gap")};
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: ${v("control-gap")} 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: ${v("font-ui")};
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  text-align: start;
  color: ${v("text-sub")};
}
.nc-group-toggle:hover { color: ${v("text")}; }
.nc-group-toggle:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: calc(${v("focus-width")} * -1); }
.nc-group-title { grid-area: 1 / 1; min-width: 0; }
.nc-group-summary {
  grid-area: 2 / 1 / 3 / -1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  letter-spacing: normal;
  text-transform: none;
}
.nc-group-mark { grid-area: 1 / 2; font-family: ${v("font-readout")}; }
.nc-group-summary:empty, .nc-group[data-nc-open="true"] .nc-group-summary { display: none; }
.nc-group-body { display: flex; flex-direction: column; gap: ${v("module-pad")}; min-width: 0; }
.nc-group-body[hidden] { display: none; }
/* A phone-only group (collapse: "phone"): flat on tablets and desktops (no header; group and body are display:
   contents, so its controls are the section's own flex items, as before it was grouped); a group on phones, below,
   where data-nc-open (not the hidden attribute, which group.js leaves off it) hides its body while closed. */
.nc-group[data-nc-collapse="phone"], .nc-group[data-nc-collapse="phone"] > .nc-group-body { display: contents; }
.nc-group[data-nc-collapse="phone"] > .nc-group-toggle { display: none; }
/* On/off (ASTRID's ghost On / Off, Peter 2026-10): role="switch", the word alone, no track. Off is text-sub; on is
   text with an accent hairline under it; hover takes the word and the line to text. Both words share one grid cell,
   so the control never changes width when it flips. */
.nc-ui-switch {
  display: inline-flex;
  align-items: baseline;
  flex: none;
  margin: 0;
  padding: 0 0 ${v("control-gap")};
  border: 0;
  border-bottom: ${v("hairline")} solid transparent;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: ${v("label-size")};
  font-weight: ${v("control-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  color: ${v("text-sub")};
  transition-property: color, border-color;
  transition-duration: ${v("transition-feedback")};
}
.nc-ui-switch[aria-checked="true"] { color: ${v("text")}; border-bottom-color: ${v("accent")}; }
.nc-ui-switch:hover { color: ${v("text")}; border-bottom-color: ${v("text")}; }
.nc-ui-switch:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("control-gap")}; }
.nc-ui-switch-text { display: inline-grid; }
.nc-ui-switch-text > span { grid-area: 1 / 1; }
/* ON reads bold (Peter, 2026-11-01: "Hack OFF/ON. ON should be bold"). The word is always bold, shown or not, so the
   switch keeps one width whichever word shows. The fold column's on/off word follows. */
.nc-ui-switch [data-nc-on], .nc-ui-fx-fold[data-on="true"] .nc-ui-fx-fold-state { font-weight: var(--nc-ui-font-weight-bold); }
.nc-ui-switch[aria-checked="true"] [data-nc-off], .nc-ui-switch[aria-checked="false"] [data-nc-on] { visibility: hidden; }
/* Touch (ASTRID's coarse-pointer rule): text controls are drawn small and an invisible pad grows each to target-min,
   centred on it. A select cannot carry a pad, so it grows itself. */
@media (pointer: coarse) {
  :is(.nc-hide, .nc-slim, .nc-toggle, .nc-ui-switch, .nc-seg > button, .nc-ui-more > summary, .nc-group-toggle, .nc-page-action, .nc-step-tools .nc-fill, .nc-fill.nc-clear) { position: relative; }
  :is(.nc-hide, .nc-slim, .nc-toggle, .nc-ui-switch, .nc-seg > button, .nc-ui-more > summary, .nc-group-toggle, .nc-page-action, .nc-step-tools .nc-fill, .nc-fill.nc-clear)::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: max(100%, ${v("target-min")});
    height: max(100%, ${v("target-min")});
    transform: translate(-50%, -50%);
  }
  .nc-toggle { overflow: visible; text-overflow: clip; }
  .nc-select { min-height: ${v("target-min")}; }
}
/* A panel (Rhythm's Parameters, under the grid): a page-coloured area, full bleed to the module's sides and
   bottom, a hairline above, a title and what it edits, and its controls in columns from 1024 px. */
.nc-section[data-nc-panel="true"] {
  flex: 1 0 auto;
  margin-inline: calc(${v("module-pad")} * -1);
  margin-bottom: calc(${v("module-pad")} * -1);
  padding: ${v("module-pad")};
  background: ${v("surface-page")};
  border-top: ${v("hairline")} solid ${v("divider")};
}
.nc-panel-hd {
  display: flex;
  align-items: baseline;
  gap: ${v("module-gap")};
  min-width: 0;
}
.nc-panel-title {
  margin: 0;
  font-size: ${v("title-size")};
  font-weight: ${v("title-weight")};
  letter-spacing: ${v("title-tracking")};
  white-space: nowrap;
}
.nc-panel-subject {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  color: ${v("text-sub")};
}
.nc-section[data-nc-lane="1"] .nc-panel-subject { color: ${v("rhythm.lane-1")}; }
.nc-section[data-nc-lane="2"] .nc-panel-subject { color: ${v("rhythm.lane-2")}; }
.nc-section[data-nc-lane="3"] .nc-panel-subject { color: ${v("rhythm.lane-3")}; }
.nc-section[data-nc-lane="4"] .nc-panel-subject { color: ${v("rhythm.lane-4")}; }
.nc-panel-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${v("module-pad")};
  min-width: 0;
}
.nc-canvas {
  width: 100%;
  height: ${v("display-height")};
  display: block;
  background: transparent;
}
.nc-note {
  /* The containing block for its absolute token probe, so overflow: hidden clips the probe after a long note. */
  position: relative;
  margin: 0;
  min-width: 0;
  color: ${v("text-sub")};
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nc-note[data-nc-tone="danger"] { color: ${v("danger")}; }
.nc-knob {
  width: ${v("knob-size")};
  height: ${v("knob-size")};
  flex: none;
  border-radius: 50%;
  border: ${v("hairline")} solid ${v("divider")};
  background: ${v("surface-page")};
  position: relative;
  padding: 0;
  touch-action: none;
  cursor: pointer;
  transition: none;
}
.nc-knob-mark {
  position: absolute;
  left: 50%;
  top: ${v("control-gap")};
  width: ${v("hairline")};
  height: ${v("control-gap")};
  background: ${v("text")};
  transform-origin: center ${v("module-gap")};
  transform: rotate(calc(var(--knob-turn, 0) * 1deg));
  transition: none;
}
.nc-knob:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("hairline")};
}
/* Tabs stay on one line (no height jump); a tab that does not fit gives way with an ellipsis, and its full text stays
   its accessible name. */
.nc-choice-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: ${v("control-gap")} ${v("header-gap")};
  min-width: 0;
}
.nc-choice {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 0;
  border-bottom: ${v("hairline")} solid transparent;
  background: transparent;
  color: ${v("text-sub")};
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  padding: ${v("control-gap")} 0;
  cursor: pointer;
  transition: none;
}
/* On touch a tab cut to an ellipsis is still a full target: never narrower or shorter than target-min. */
@media (pointer: coarse) {
  .nc-choice { min-width: ${v("target-min")}; min-height: ${v("target-min")}; }
  /* Tabs that cannot shrink below target-min scroll within their row (no visible scrollbar), never the page. */
  .nc-choice-row { overflow-x: auto; scrollbar-width: none; }
  .nc-choice-row::-webkit-scrollbar { display: none; }
}
/* A captioned row (Gate's Rate in a narrow FX card): the label, then the tabs packed close so short ones never cut. */
.nc-choice-caption { flex: 0 0 auto; margin-inline-end: auto; }
.nc-choice-row[data-nc-caption] { gap: ${v("control-gap")}; margin-bottom: ${v("control-gap")}; }
.nc-choice-row[data-nc-caption] > .nc-choice { flex: 0 0 auto; overflow: visible; }
.nc-choice[aria-selected="true"] {
  color: ${v("text")};
  border-bottom-color: ${v("accent")};
}
.nc-choice:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("hairline")};
}
/* Pad grid (NYX): pads as the way in. Empty pads are shaded and say Load; filled pads carry a lane-coloured bar and
   a mini waveform; the selected pad is outlined in the accent. */
.nc-padgrid { position: relative; }
.nc-padgrid-pads { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${v("control-gap")}; }
.nc-padgrid-pads[data-nc-columns="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.nc-padgrid-pad {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr;
  align-content: start;
  min-width: 0;
  min-height: calc(${v("target-min")} * 1.5);
  padding: ${v("control-gap")} ${v("control-gap")} ${v("control-gap")} calc(${v("control-gap")} * 2);
  border: ${v("hairline")} solid ${v("text-sub")};
  border-radius: ${v("slot-radius")};
  background: transparent;
  color: ${v("text")};
  font-family: ${v("font-ui")};
  font-size: ${v("label-size")};
  text-align: left;
  cursor: pointer;
  -webkit-touch-callout: none;
  user-select: none;
  touch-action: manipulation;
}
.nc-padgrid-pad-bar {
  position: absolute;
  inset-block: ${v("control-gap")};
  inset-inline-start: ${v("hairline")};
  width: ${v("focus-width")};
  background: currentColor;
}
.nc-padgrid-pad-name { justify-self: start; align-self: flex-start; max-width: 100%; font-weight: ${v("control-weight")}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nc-padgrid-pad-hint { display: none; color: ${v("text-sub")}; font-size: ${v("readout-size-small")}; }
.nc-padgrid-pad-badge {
  position: absolute;
  inset-block-start: ${v("control-gap")};
  inset-inline-end: ${v("control-gap")};
  color: ${v("text-sub")};
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  line-height: 1;
}
.nc-padgrid-pad-badge:empty { display: none; }
.nc-padgrid-pad-wave { width: 100%; height: ${v("slider-pitch")}; align-self: end; }
.nc-padgrid-pad-wave path { fill: currentColor; fill-opacity: 0.35; stroke: currentColor; stroke-width: 0.6; vector-effect: non-scaling-stroke; }
.nc-padgrid-pad[data-nc-lane="1"] :is(.nc-padgrid-pad-bar, .nc-padgrid-pad-wave) { color: ${v("rhythm.lane-1")}; }
.nc-padgrid-pad[data-nc-lane="2"] :is(.nc-padgrid-pad-bar, .nc-padgrid-pad-wave) { color: ${v("rhythm.lane-2")}; }
.nc-padgrid-pad[data-nc-lane="3"] :is(.nc-padgrid-pad-bar, .nc-padgrid-pad-wave) { color: ${v("rhythm.lane-3")}; }
.nc-padgrid-pad[data-nc-lane="4"] :is(.nc-padgrid-pad-bar, .nc-padgrid-pad-wave) { color: ${v("rhythm.lane-4")}; }
.nc-padgrid-pad[data-empty="true"] {
  align-content: center;
  justify-items: center;
  text-align: center;
  padding-inline-start: ${v("control-gap")};
  border-color: ${v("divider")};
  background: ${v("divider")};
  color: ${v("text-sub")};
}
.nc-padgrid-pad[data-empty="true"] .nc-padgrid-pad-name { font-weight: inherit; font-size: ${v("body-size")}; }
.nc-padgrid-pad[data-empty="true"] .nc-padgrid-pad-hint { display: block; }
.nc-padgrid-pad[data-hint="true"] .nc-padgrid-pad-hint { display: block; justify-self: start; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nc-padgrid-pad[data-empty="true"] :is(.nc-padgrid-pad-bar, .nc-padgrid-pad-wave) { display: none; }
.nc-padgrid-pad:hover { border-color: ${v("text")}; }
.nc-padgrid-pad[data-selected="true"] { border-color: ${v("accent")}; box-shadow: inset 0 0 0 ${v("hairline")} ${v("accent")}; }
.nc-padgrid-rename {
  position: absolute;
  z-index: 3;
  min-height: ${v("target-min")};
  padding: 0 ${v("control-gap")};
  border: ${v("hairline")} solid ${v("accent")};
  border-radius: ${v("slot-radius")};
  background: ${v("surface-page")};
  color: ${v("text")};
  font-family: ${v("font-ui")};
  font-size: ${v("label-size")};
  font-weight: ${v("control-weight")};
}
.nc-padgrid-rename:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-padgrid-pad[data-dragging="true"] { border-style: dashed; color: ${v("text-sub")}; }
.nc-padgrid-pad[data-drop="true"] { border-style: dashed; border-color: ${v("accent")}; }
.nc-padgrid-pad[data-playing="true"] .nc-padgrid-pad-wave path { fill-opacity: 0.7; }
.nc-padgrid-pad:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-slot-row { position: relative; }
.nc-slot-menu {
  position: absolute;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${v("control-gap")};
  min-width: ${v("name-width")};
  padding: ${v("control-gap")};
  background: ${v("surface-page")};
  border: ${v("hairline")} solid ${v("divider")};
  color: ${v("text")};
}
.nc-menu-btn {
  display: flex;
  align-items: center;
  min-height: ${v("target-min")};
  border: 0;
  background: transparent;
  color: ${v("text")};
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size-small")};
  text-align: left;
  padding: 0;
  cursor: pointer;
  transition: none;
}
/* 44 px on every pointer (desktop too): a touch band drawn at the 20 px slider pitch; the extra height overlaps the
   gaps, not the rows. */
.nc-field[data-nc-slider] .nc-range {
  height: ${v("target-min")};
  margin-block: calc((${v("slider-pitch")} - ${v("target-min")}) / 2);
}
/* M and S on touch: each a full target-min box (the button paints smaller inside), touching, never overlapping.
   Only on a coarse pointer: on every pointer it made each lane target-min tall on desktop (Rhythm #40). */
@media (pointer: coarse) {
  .nc-ms-wrap { flex-basis: ${v("target-min")}; height: ${v("target-min")}; }
  .nc-ms-wrap + .nc-ms-wrap { margin-inline-start: calc(${v("module-gap")} * -1); }
  /* The ×'s touch target: target-min tall, out to the card's padding on the right; never over maximize. */
  .nc-fx-remove::before { height: max(100%, ${v("target-min")}); right: calc(${v("control-gap")} * -3); }
  .nc-fold-toggle::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: max(100%, ${v("target-min")});
    height: max(100%, ${v("target-min")});
    transform: translate(-50%, -50%);
  }
  .nc-ms {
    inset: calc((${v("target-min")} - ${v("slider-pitch")}) / 2);
    width: auto;
    height: auto;
  }
}
.nc-slot-scrim {
  position: fixed;
  inset: 0;
  z-index: 2;
  background: transparent;
  touch-action: none;
}
.nc-menu-btn:focus-visible {
  outline: ${v("focus-width")} solid ${v("focus-ring")};
  outline-offset: ${v("hairline")};
}
/* A hit pad grows a control that cannot grow its look to target-min, on every pointer. */
.nc-hit {
  display: block;
  position: absolute;
  pointer-events: auto;
  left: 50%;
  top: 50%;
  width: ${v("target-min")};
  height: ${v("target-min")};
  transform: translate(-50%, -50%);
}
@media (pointer: coarse) {
  .nc-hit { width: ${v("target-min-coarse")}; height: ${v("target-min-coarse")}; }
}
/* nc-ui step editor (openStepEditor): long-press a step for velocity and chance. Sits under the step;
   a bottom sheet at phone widths. Rows are 44 px so the sliders are thumb-sized. */
.nc-step-editor {
  position: fixed;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: ${v("module-gap")};
  width: calc(${v("name-width")} * 6);
  max-width: calc(100vw - 2 * ${v("module-gap")});
  padding: ${v("module-gap")};
  background: ${v("surface-page")};
  border: ${v("hairline")} solid ${v("divider")};
  color: ${v("text")};
}
/* The step being edited: a dark ring (as Bass marks its selected pad), full strength, fill unchanged. */
.nc-pad[data-editing="true"], .nc-step-wrap[data-editing="true"] .nc-step {
  outline: ${v("focus-width")} solid ${v("text")};
  outline-offset: ${v("hairline")};
}
.nc-step-editor-scrim[data-placement="sheet"] { z-index: 4; background: ${v("dialog-scrim")}; }
.nc-step-editor[data-placement="sheet"] { z-index: 5; }
.nc-step-editor-head { display: flex; align-items: center; justify-content: space-between; gap: ${v("module-gap")}; }
.nc-step-editor-row {
  display: flex;
  align-items: center;
  gap: ${v("module-gap")};
  min-height: ${v("target-min")};
}
.nc-step-editor-row .nc-label { flex: none; min-width: ${v("name-width")}; }
.nc-step-editor-row .nc-range { flex: 1 1 0; min-width: 0; height: ${v("target-min")}; }
.nc-step-editor-row .nc-readout { flex: none; min-width: ${v("name-width")}; text-align: right; }
.nc-step-editor-done {
  min-width: ${v("target-min")};
  min-height: ${v("target-min")};
  border: 0;
  background: none;
  color: ${v("text")};
  font-family: ${v("font-ui")};
  font-size: ${v("label-size")};
  font-weight: ${v("title-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  cursor: pointer;
  transition: none;
}
.nc-step-editor-done:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-step-editor[data-placement="sheet"] {
  left: 0;
  right: 0;
  bottom: 0;
  width: auto;
  max-width: none;
  padding-bottom: calc(${v("module-gap")} + env(safe-area-inset-bottom));
  border-width: ${v("hairline")} 0 0;
}
/* nc-ui toast (createToast): ASTRID's small dark chip with an uppercase, letter-spaced action.
   Opacity only: in with motion-fade, out with motion-fade-out. Only the chip takes taps. */
.nc-ui-toast {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: ${v("toast-gap")};
  max-width: calc(100vw - 2 * ${v("toast-offset")});
  min-height: ${v("toast-target")};
  padding: 0 0 0 ${v("toast-pad-x")};
  border-radius: ${v("toast-radius")};
  background: ${v("toast-bg")};
  color: ${v("toast-text")};
  font-family: ${v("font-ui")};
  font-size: ${v("toast-font-size")};
  line-height: ${v("label-leading")};
  white-space: nowrap;
  pointer-events: auto;
  opacity: 0;
  transition: opacity ${v("motion-fade")} ${v("motion-fade-easing")};
}
.nc-ui-toast[data-placement="bottom"] { bottom: calc(${v("toast-offset")} + env(safe-area-inset-bottom)); }
.nc-ui-toast[data-placement="top"] { top: calc(${v("toast-offset")} + env(safe-area-inset-top)); }
/* In the Studio (html[data-nc-hosted]) the frame is as tall as its page: toasts and sheets keep to the part you can
   see, which the Studio writes as --nc-host-top / --nc-host-bottom. */
html[data-nc-hosted] .nc-ui-toast[data-placement="bottom"] { bottom: calc(var(--nc-host-bottom, 0px) + ${v("toast-offset")}); }
html[data-nc-hosted] .nc-ui-toast[data-placement="top"] { top: calc(var(--nc-host-top, 0px) + ${v("toast-offset")}); }
html[data-nc-hosted] .nc-step-editor[data-placement="sheet"] { bottom: var(--nc-host-bottom, 0px); }
.nc-ui-toast[data-placement="anchor"] { position: absolute; transform: none; }
.nc-ui-toast[data-state="open"] { opacity: 1; }
.nc-ui-toast[data-state="closing"] {
  opacity: 0;
  pointer-events: none;
  transition: opacity ${v("motion-fade-out")} ${v("motion-fade-out-easing")};
}
/* nc-ui help (installHelpTips): a label's description, shown when the pointer rests on it. The toast's dark slab,
   smaller and wrapping; it never takes the pointer, so it can't block the control under it. No motion. */
[data-nc-help] { cursor: help; }
[data-nc-help]:hover { text-decoration: underline dotted; text-underline-offset: 0.2em; }
.nc-ui-help {
  position: fixed;
  z-index: 6;
  max-width: 34ch;
  padding: calc(${v("toast-pad-x")} / 2) calc(${v("toast-pad-x")} * 0.75);
  border-radius: ${v("toast-radius")};
  background: ${v("toast-bg")};
  color: ${v("toast-text")};
  font-family: ${v("font-ui")};
  font-size: ${v("toast-font-size")};
  font-weight: normal;
  line-height: 1.4;
  letter-spacing: normal;
  text-transform: none;
  text-align: left;
  white-space: normal;
  pointer-events: none;
}
.nc-ui-help[hidden] { display: none; }
/* A slider row's input reaches up over its label (the target-min hit band), so with a mouse most of the label was the
   slider's and its description never opened (found in LUCY). With a fine pointer a described label sits above the
   band; touch keeps the full band and has no hover. Nothing moves. */
@media (hover: hover) and (pointer: fine) {
  .nc-field[data-nc-slider] > .nc-label[data-nc-help] { position: relative; z-index: 1; }
}
.nc-ui-toast-message { overflow: hidden; text-overflow: ellipsis; }
.nc-ui-toast-action {
  min-width: ${v("toast-target")};
  min-height: ${v("toast-target")};
  padding: 0 ${v("toast-pad-x")};
  border: 0;
  background: none;
  color: ${v("toast-action")};
  font: inherit;
  font-weight: ${v("title-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  cursor: pointer;
  transition: none;
}
.nc-ui-toast-action:focus-visible {
  outline: ${v("focus-width")} solid ${v("toast-action")};
  outline-offset: calc(-2 * ${v("focus-width")});
}
.nc-ui-toast-live {
  position: absolute;
  width: ${v("hairline")};
  height: ${v("hairline")};
  overflow: hidden;
  clip-path: inset(50%);
  pointer-events: none;
  white-space: nowrap;
}
/* Console (the Studio's Mix): channel strips, the FX cards, then the master strip, on one row. The body bleeds to the
   module's sides and bottom so each area is a shade block: strips on the module, the FX cards one adjacent shade
   darker each, and the master darkest (stack-1), so the row reads as the signal path ending on the right. */
.nc-module-body[data-nc-layout="console"] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  grid-template-areas: "strips fx meters master";
  align-items: stretch;
  gap: 0;
  margin-inline: calc(${v("module-pad")} * -1);
  margin-bottom: calc(${v("module-pad")} * -1);
  border-top: ${v("hairline")} solid ${v("divider")};
}
.nc-module-body[data-nc-layout="console"] > .nc-section { gap: 0; padding-top: ${v("stack-card-pad-y")}; }
.nc-module-body[data-nc-layout="console"] > [data-nc-area="strips"] {
  grid-area: strips;
  flex-direction: row;
  align-items: flex-start;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  padding-inline: ${v("module-pad")} ${v("control-gap")};
  /* The strips run the full height (their own padding): no band above or below them. */
  padding-block: 0;
  /* The channel strips sit on the master's shade (Peter, 2026-10-30): the lightest step of the stack. */
  background: ${v("module-bg-stack-1")};
  ${prop("text-sub")}: ${v("module-sub-stack-1")};
  ${prop("divider")}: ${v("module-div-stack-1")};
  ${prop("slider-track")}: ${v("module-div-stack-1")};
}
/* The fx area is as wide as the cards it shows (Peter, 2026-11-01: "Weird empty slot next to Master slider"): one
   column per shown card, none held empty, so the master sits right after the last card and the strips area (the
   flexible column) takes the rest. A paged area keeps three cards' width (below). */
.nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"] {
  grid-area: fx;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: ${v("fx-card-width")};
  align-items: stretch;
  padding-top: 0;
}
/* An optional meters section (the Studio's VU meters): after the FX cards, just left of the master, on the master's
   shade with a hairline between them. Without one the column is empty. */
.nc-module-body[data-nc-layout="console"] > [data-nc-area="meters"] {
  grid-area: meters;
  padding: ${v("stack-card-pad-y")} ${v("module-pad")} ${v("module-pad")};
  border-inline-end: ${v("hairline")} solid ${v("module-div-stack-1")};
  background: ${v("module-bg-stack-1")};
  ${prop("text-sub")}: ${v("module-sub-stack-1")};
  ${prop("divider")}: ${v("module-div-stack-1")};
  ${prop("slider-track")}: ${v("module-div-stack-1")};
}
.nc-module-body[data-nc-layout="console"] > [data-nc-area="master"] {
  grid-area: master;
  align-items: center;
  padding-inline: ${v("control-gap")} ${v("module-pad")};
  padding-bottom: ${v("module-pad")};
  background: ${v("module-bg-stack-1")};
  ${prop("text-sub")}: ${v("module-sub-stack-1")};
  ${prop("divider")}: ${v("module-div-stack-1")};
  ${prop("slider-track")}: ${v("module-div-stack-1")};
}
.nc-module-body[data-nc-layout="console"] .nc-ui-fx {
  margin: 0;
  padding: ${v("stack-card-pad-y")} ${v("module-pad")} ${v("module-pad")};
  ${prop("text-sub")}: inherit;
  ${prop("divider")}: inherit;
  ${prop("slider-track")}: inherit;
}
.nc-module-body[data-nc-layout="console"] .nc-ui-fx[data-nc-depth="1"] { --nc-fx-card-bg: ${v("module-bg-adjacent-2")}; background: var(--nc-fx-card-bg); }
.nc-module-body[data-nc-layout="console"] .nc-ui-fx[data-nc-depth="2"] { --nc-fx-card-bg: ${v("module-bg-adjacent-3")}; background: var(--nc-fx-card-bg); }
.nc-module-body[data-nc-layout="console"] .nc-ui-fx[data-nc-depth="3"] { --nc-fx-card-bg: ${v("module-bg-adjacent-4")}; background: var(--nc-fx-card-bg); }
/* In the console a card is a column: a select row gets the same space under it as a slider row. */
.nc-module-body[data-nc-layout="console"] .nc-ui-fx { display: flex; flex-direction: column; gap: ${v("module-gap")}; }
.nc-module-body[data-nc-layout="console"] .nc-ui-fx > .nc-field:not([data-nc-slider]) { padding-bottom: ${v("module-gap")}; }
/* Folded cards in a console row (769 px up): a narrow column, the whole column one button. Once any card is folded the
   fx area is a row of its cards' own widths, so the strips get the room back. */
@media (min-width: 769px) {
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:has(> .nc-ui-fx[data-nc-folded]) {
    display: flex;
    flex-direction: row;
    align-items: stretch;
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:has(> .nc-ui-fx[data-nc-folded]) > .nc-ui-fx { flex: none; width: ${v("fx-card-width")}; }
  /* :has() counts its argument, so the folded card repeats it to win over the open cards' width. */
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:has(> .nc-ui-fx[data-nc-folded]) > .nc-ui-fx[data-nc-folded] {
    width: var(--nc-fx-fold-w);
    padding-inline: 0;
  }
  .nc-module-body[data-nc-layout="console"] .nc-ui-fx[data-nc-folded] > .nc-ui-fx-hd { display: none; }
  .nc-module-body[data-nc-layout="console"] .nc-ui-fx[data-nc-folded] > .nc-ui-fx-fold { display: flex; }
}
/* A maximized card in a console row takes three cards' width (the whole fx row), folded neighbours or not. */
@media (min-width: 769px) {
  /* Its neighbours (Peter, 2026-11-01: "don't wrap the other inserts below, minimize them horizontally") show as
     folded columns beside it for as long as it is maximized; a click on one restores the card (controls.js). Their
     own fold state is untouched. */
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:has(> .nc-ui-fx[data-nc-max="row"]) {
    display: flex;
    flex-direction: row;
    align-items: stretch;
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:has(> .nc-ui-fx[data-nc-max="row"]) > .nc-ui-fx:not([data-nc-max]):has(> .nc-ui-fx-fold) {
    flex: none;
    width: var(--nc-fx-fold-w);
    padding-inline: 0;
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:has(> .nc-ui-fx[data-nc-max="row"]) > .nc-ui-fx:not([data-nc-max]):has(> .nc-ui-fx-fold) > :not(.nc-ui-fx-fold, .nc-token-probe) { display: none; }
  /* !important: the fold button is [hidden] while its card is open, and .nc [hidden] is display: none !important. */
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:has(> .nc-ui-fx[data-nc-max="row"]) > .nc-ui-fx:not([data-nc-max]) > .nc-ui-fx-fold { display: flex !important; }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"] > .nc-ui-fx[data-nc-max="row"][data-nc-max="row"][data-nc-max="row"] {
    flex: none;
    width: calc(${v("fx-card-width")} * 3);
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"] > .nc-ui-fx[data-nc-max="row"] { grid-column: span 3; }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:has(> .nc-ui-fx[data-nc-folded]) > .nc-ui-fx[data-nc-max="row"][data-nc-max="row"] {
    width: calc(${v("fx-card-width")} * 3);
  }
}
/* An FX card never makes the console taller (Peter, 2026-11-01: "don't make the vertical version higher. Pin the
   graphic at the top and scroll the freq controls behind it"). From 1024 px, where the fx area shares the strips'
   row, the area takes the row's height (the strips, the master and the meters set it) and adds none of its own; a
   card taller than that keeps its header (and an EQ graph under it) pinned at its top while the rest of its controls
   scroll under them, with a soft shade at the foot while there is more below. Focus scrolls a control clear of the
   pinned part (--nc-fx-pin-h, controls.js). A maximized card's row is unchanged (it has its one-line dial row);
   tablets and phones, where the fx cards have their own row, are unchanged. */
@media (min-width: 1024px) {
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:not(:has(> .nc-ui-fx[data-nc-max="row"])) {
    height: 0;
    min-height: 100%;
    grid-auto-rows: minmax(0, 1fr);
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:not(:has(> .nc-ui-fx[data-nc-max="row"])) > .nc-ui-fx:not([data-nc-folded]) {
    min-height: 0;
    /* The pinned header carries the top padding: a sticky box sticks inside the scroller's padding. */
    padding-top: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    scrollbar-width: thin;
    scroll-padding-top: var(--nc-fx-pin-h, ${v("module-gap")});
    /* The foot shade (scroll) shows while there is more below; the card's own colour at the end of its content (local)
       covers it once scrolled to the end, or when nothing overflows. */
    background-image:
      linear-gradient(transparent, var(--nc-fx-card-bg) 70%),
      linear-gradient(transparent, ${v("divider")});
    background-position: bottom, bottom;
    background-size: 100% calc(${v("module-gap")} * 3), 100% ${v("module-gap")};
    background-repeat: no-repeat;
    background-attachment: local, scroll;
  }
  /* The pinned header (or bare name) holds the card's top padding, so nothing scrolls by above it; its fold triangle
     keeps its corner (the header is its containing block now, edge to edge). */
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:not(:has(> .nc-ui-fx[data-nc-max="row"])) > .nc-ui-fx:not([data-nc-folded]) > :is(.nc-ui-fx-hd, .nc-ui-fx-name) {
    position: sticky;
    top: 0;
    z-index: 2;
    margin: 0 calc(${v("module-pad")} * -1) calc(${v("module-gap")} * -1);
    padding: ${v("stack-card-pad-y")} ${v("module-pad")} calc(${v("module-gap")} * 2);
    background-color: var(--nc-fx-card-bg);
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:not(:has(> .nc-ui-fx[data-nc-max="row"])) > .nc-ui-fx:not([data-nc-folded]) > .nc-eq {
    position: sticky;
    top: var(--nc-fx-hd-h, 0);
    z-index: 1;
    margin-bottom: 0;
    padding-bottom: ${v("control-gap")};
    background-color: var(--nc-fx-card-bg);
    /* The card's colour out to its edges beside the graph (no spread: nothing below it is covered). */
    box-shadow: calc(${v("module-pad")} * -1) 0 0 var(--nc-fx-card-bg), ${v("module-pad")} 0 0 var(--nc-fx-card-bg);
  }
}
/* Pages (define-module.js, a section's pageSize; Peter, 2026-11-01: "don't push to a second row, create a second
   'page' ... Needs to be obvious though"). From 769 px a paged fx area shows one page of cards in its row, never a
   second row, under a slim bar: ‹ at its left end, "1 / 3" in the middle, › at its right end. The cards of the other
   pages stay laid out but unseen, at their own width and taking no room (a negative margin as wide as the card), so
   the row is as tall as the tallest card of any page and turning a page never changes the Mix's height. Phones (up
   to 768 px) stack every card as before: no bar. */
.nc-fx-pager { display: none; }
@media (min-width: 769px) {
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"][data-nc-paged] {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    padding-top: ${v("target-min")};
  }
  /* No card folded on this page: three cards' width, a part-filled last page too, so the strips never shift. */
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"][data-nc-paged]:not(:has(> .nc-ui-fx[data-nc-folded]:not([data-nc-off-page]))) {
    min-width: calc(${v("fx-card-width")} * 3);
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"][data-nc-paged] > .nc-ui-fx { flex: none; width: ${v("fx-card-width")}; }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"][data-nc-paged] > .nc-ui-fx[data-nc-off-page][data-nc-off-page][data-nc-off-page] {
    order: -1;
    flex: none;
    width: ${v("fx-card-width")};
    margin-inline-end: calc(${v("fx-card-width")} * -1);
    visibility: hidden;
    pointer-events: none;
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"][data-nc-paged] > .nc-ui-fx[data-nc-off-page][data-nc-off-page][data-nc-off-page][data-nc-folded] {
    width: var(--nc-fx-fold-w);
    margin-inline-end: calc(var(--nc-fx-fold-w) * -1);
    padding-inline: 0;
  }
  /* A maximized card takes its page (its page-mates as fold columns beside it): the other pages stay out of it. */
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"][data-nc-paged]:has(> .nc-ui-fx[data-nc-max="row"]) > .nc-ui-fx[data-nc-off-page] { display: none; }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"][data-nc-paged] > .nc-fx-pager {
    position: absolute;
    inset: 0 0 auto 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${v("module-gap")};
    height: ${v("target-min")};
  }
}
/* A chevron button: a full target, a square outline like Moves' buttons, the chevron in ink so it reads at a glance.
   At an end it stays focusable (aria-disabled) and dims by colour. */
.nc-fx-page-btn {
  display: grid;
  place-items: center;
  flex: none;
  width: ${v("target-min")};
  height: ${v("target-min")};
  margin: 0;
  padding: 0;
  border: ${v("hairline")} solid ${v("text-sub")};
  border-radius: ${v("slot-radius")};
  background: transparent;
  color: ${v("text")};
  cursor: pointer;
}
.nc-fx-page-btn:hover:not([aria-disabled="true"]) { border-color: ${v("text")}; }
.nc-fx-page-btn:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-fx-page-btn[aria-disabled="true"] { color: ${v("divider")}; border-color: ${v("divider")}; cursor: default; }
.nc-fx-page-icon {
  display: block;
  width: calc(${v("control-gap")} * 2.5);
  height: calc(${v("control-gap")} * 2.5);
  border-style: solid;
  border-color: currentColor;
  border-width: calc(${v("hairline")} * 2) calc(${v("hairline")} * 2) 0 0;
  transform: translateX(calc(${v("control-gap")} * -0.5)) rotate(45deg);
}
.nc-fx-page-btn[data-nc-fx-page="prev"] .nc-fx-page-icon { transform: translateX(calc(${v("control-gap")} * 0.5)) rotate(-135deg); }
.nc-fx-page-count {
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  letter-spacing: ${v("label-tracking")};
  font-variant-numeric: tabular-nums;
  color: ${v("text")};
  white-space: nowrap;
}
/* One channel strip: name, M and S, sends, then the fader with its scale and meter, then the readout. Every strip
   (the master too, with empty M/S and send rows) keeps the same row heights, so faders and ticks line up.
   Every row is a named area and every child is placed by name (never by auto-placement), so a row taken out (the
   sends, display: none) can't shift the rows after it, in any engine. Three columns: a control-gap gutter each side
   of the content; only M and S span the gutters, so on touch two target-min boxes fit side by side inside the strip
   (they overflowed it, and Safari drew S under the next strip; Peter, 2026-11-01). No negative margins. */
.nc-strip {
  /* The M/S row: the slider pitch; target-min on touch (the buttons' full boxes, so they never reach the pan row). */
  --nc-strip-ms-row: ${v("slider-pitch")};
  --nc-strip-knob-row: calc(${v("knob-size")} + ${v("control-gap")} + ${v("label-size")} * ${v("label-leading")});
  position: relative;
  flex: none;
  width: ${v("strip-width")};
  display: grid;
  grid-template-columns: ${v("control-gap")} minmax(0, 1fr) ${v("control-gap")};
  /* Name, Inserts, M/S, sends, pan, the fader body, the readout. */
  grid-template-rows: auto ${v("slider-pitch")} var(--nc-strip-ms-row) var(--nc-strip-knob-row) var(--nc-strip-knob-row) auto auto;
  grid-template-areas: ". hd ." ". hacks ." "ms ms ms" ". sends ." ". pan ." ". body ." ". db .";
  justify-items: center;
  row-gap: ${v("module-gap")};
  min-width: 0;
}
.nc-strip > .nc-strip-hd { grid-area: hd; }
.nc-strip > .nc-strip-hacks { grid-area: hacks; }
.nc-strip > .nc-strip-ms { grid-area: ms; }
.nc-strip > .nc-strip-sends { grid-area: sends; }
.nc-strip > .nc-strip-pan { grid-area: pan; }
.nc-strip > .nc-strip-body { grid-area: body; }
.nc-strip > .nc-strip-db, .nc-strip > .nc-strip-db-input { grid-area: db; }
@media (pointer: coarse) {
  .nc-strip { --nc-strip-ms-row: ${v("target-min")}; }
}
/* sendsHidden: no sends row (the host's "hide the sends"); give it to every strip so their rows still line up. */
.nc-strip[data-nc-sends-hidden] {
  grid-template-rows: auto ${v("slider-pitch")} var(--nc-strip-ms-row) var(--nc-strip-knob-row) auto auto;
  grid-template-areas: ". hd ." ". hacks ." "ms ms ms" ". pan ." ". body ." ". db .";
}
.nc-strip[data-nc-sends-hidden] > .nc-strip-sends { display: none; }
.nc-strip + .nc-strip { border-inline-start: ${v("hairline")} solid ${v("divider")}; }
/* Channel strips alternate light and dark grey, full height, so a row of identical strips reads apart (Peter,
   2026-10-30); the master keeps the module's shade. */
.nc-strip:not([data-nc-master]) { --nc-strip-ground: var(--nc-strip-shade, ${v("strip-bg")}); background: var(--nc-strip-ground); }
.nc-strip:not([data-nc-master]):nth-child(even of .nc-strip:not([data-nc-master])) { --nc-strip-ground: var(--nc-strip-shade, ${v("strip-alt-bg")}); }
/* A shade a player picked (shade, 1-8; Peter, 2026-11-04): one of eight neutral greys (strip-shade-1..8), in place of
   the alternation. 1 and 2 are the alternation's own greys. On the darker four (5-8) the Inserts word at rest takes
   text-sub, so it keeps its contrast (the lighter hacks grey falls to 2.2:1 there). */
${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `.nc-strip[data-nc-shade="${n}"] { --nc-strip-shade: ${v(`strip-shade-${n}`)}; }`).join("\n")}
/* A compact knob's centre is the strip's own grey (--nc-strip-ground), not the page's, so it never shows as a dot. On
   3-8 the M and S hairline is mixed from the strip's grey (strip-divider vanishes on the middle greys, and reads as a
   light box on the darkest). */
.nc-strip[data-nc-shade]:not([data-nc-shade="1"]):not([data-nc-shade="2"]):not([data-nc-master]) > .nc-strip-ms { ${prop("divider")}: color-mix(in oklab, ${v("text-sub")} 30%, var(--nc-strip-shade)); }
/* …and the knob rings' and the meter's unlit track, which (div-0) vanishes on the middle light greys. */
.nc-strip[data-nc-shade]:not([data-nc-shade="1"]):not([data-nc-shade="2"]):not([data-nc-master]) { ${prop("meter-track")}: color-mix(in oklab, ${v("text-sub")} 30%, var(--nc-strip-shade)); }
.nc-strip:is([data-nc-shade="5"], [data-nc-shade="6"], [data-nc-shade="7"], [data-nc-shade="8"]) .nc-hacks:not([aria-pressed="true"]) { color: ${v("text-sub")}; }
.nc-strip:is([data-nc-shade="5"], [data-nc-shade="6"], [data-nc-shade="7"], [data-nc-shade="8"]) .nc-hacks:not([aria-pressed="true"]):hover { color: ${v("text")}; }
/* The strip menu (onShade): a small sheet under the grip, or where the name was right-clicked: "Shade", a row of Auto
   and the eight swatches (the picked one ringed in ink), then Move left / Move right with their keys. Over the page,
   so it never shifts the layout; page ground and a hairline (the kit draws no shadows). */
.nc-strip-menu {
  position: fixed;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: ${v("control-gap")};
  min-width: calc(${v("strip-width")} * 2.5);
  padding: calc(${v("control-gap")} * 2) calc(${v("control-gap")} * 2.5);
  border: ${v("hairline")} solid ${v("divider")};
  border-radius: ${v("slot-radius")};
  background: ${v("surface-page")};
  color: ${v("text")};
  font-size: ${v("label-size")};
}
.nc-strip-menu-title { color: ${v("text-sub")}; font-weight: ${v("label-weight")}; letter-spacing: ${v("label-tracking")}; text-transform: uppercase; }
.nc-strip-menu-shades { display: flex; gap: ${v("control-gap")}; margin-bottom: ${v("control-gap")}; }
.nc-strip-menu-shades > button {
  flex: none;
  min-width: calc(${v("control-gap")} * 4.5);
  height: calc(${v("control-gap")} * 4.5);
  margin: 0;
  padding: 0 ${v("hairline")};
  border: ${v("hairline")} solid ${v("divider")};
  border-radius: ${v("slot-radius")};
  background: var(--nc-swatch, transparent);
  color: ${v("text-sub")};
  font: inherit;
  font-size: ${v("scale-size")};
  cursor: pointer;
}
.nc-strip-menu-shades > button[aria-checked="true"] { outline: calc(${v("hairline")} * 2) solid ${v("text")}; outline-offset: ${v("hairline")}; color: ${v("text")}; }
.nc-strip-menu-shades > button:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-strip-menu-item {
  display: flex;
  justify-content: space-between;
  gap: calc(${v("control-gap")} * 3);
  margin: 0;
  padding: ${v("control-gap")} 0;
  border: 0;
  border-top: ${v("hairline")} solid ${v("divider")};
  background: transparent;
  color: ${v("text")};
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.nc-strip-menu-item:disabled { color: ${v("text-sub")}; cursor: default; }
.nc-strip-menu-item > kbd { font: inherit; color: ${v("text-sub")}; }
.nc-strip-menu-item:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: calc(${v("focus-width")} * -1); }
@media (pointer: coarse) {
  .nc-strip-menu-shades > button { min-width: calc(${v("target-min")} * 0.7); height: calc(${v("target-min")} * 0.7); }
  .nc-strip-menu-item { min-height: ${v("target-min")}; align-items: center; }
}
.nc-module-body[data-nc-layout="console"] > [data-nc-area="strips"] > .nc-strip {
  align-self: stretch;
  padding-block: ${v("stack-card-pad-y")} ${v("module-pad")};
}
.nc-module-body[data-nc-layout="console"] > [data-nc-area="strips"] > .nc-strip-add { margin-block: ${v("stack-card-pad-y")} ${v("module-pad")}; }
.nc-strip[data-nc-master] { width: ${v("strip-width-master")}; }
/* Name row: the name, and the remove × when the strip can be removed. */
.nc-strip-hd { display: flex; align-items: baseline; justify-content: center; gap: ${v("control-gap")}; max-width: 100%; min-width: 0; }
.nc-strip-remove {
  position: relative;
  flex: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${v("text-sub")};
  font-family: ${v("font-readout")};
  font-size: ${v("label-size")};
  line-height: 1;
  cursor: pointer;
  transition-property: color;
  transition-duration: ${v("transition-feedback")};
}
.nc-strip-remove::before { content: ""; position: absolute; inset: calc(${v("control-gap")} * -1); }
.nc-strip-remove:hover { color: ${v("danger")}; }
.nc-strip-remove:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-strip-name {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
  color: ${v("text")};
}
.nc-strip[data-silent="true"] .nc-strip-name, .nc-strip[data-silent="true"] .nc-strip-db { color: ${v("text-sub")}; }
/* Minimize (onFold): the fold triangle in the top-left corner, above the name; the name row and its × as before, so a
   minimize click can't land on remove. Folded, the strip is a narrow column on the same rows (meters still line up): the
   ▶ in the corner, the name row kept but unseen, M and S stacked over the Inserts and M/S rows, then the name read bottom to top under a small mark in the
   fader cap's colour (one button, the FX fold's look) beside a thin meter. At once: no motion. */
/* The triangle sits in the strip's top-left corner, above the name; folded, centred over the column. */
.nc-strip > [data-nc-strip-hide] { position: absolute; top: ${v("control-gap")}; left: ${v("control-gap")}; z-index: 1; }
.nc-strip[data-nc-folded] > [data-nc-strip-hide] { left: 50%; transform: translateX(-50%); }
/* Move (onMove): a grip of six dots in the top-right corner, across from the triangle, in text-sub (ink on hover), so a
   strip says it can be dragged. touch-action none: a drag from the grip moves the strip at once on touch, never the
   page. Not on a folded strip (its column is the handle there). */
.nc-strip > [data-nc-strip-grip] {
  position: absolute;
  top: ${v("control-gap")};
  right: ${v("control-gap")};
  /* Over the next strip's fold triangle, whose touch target reaches back across the strips' edge. */
  z-index: 2;
  display: inline-flex;
  margin: 0;
  padding: ${v("hairline")};
  border: 0;
  background: transparent;
  color: ${v("text-sub")};
  line-height: 1;
  cursor: grab;
  touch-action: none;
}
.nc-strip > [data-nc-strip-grip]:hover { color: ${v("text")}; }
.nc-strip > [data-nc-strip-grip]:active { cursor: grabbing; }
.nc-strip > [data-nc-strip-grip]:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-strip-grip-dots {
  display: block;
  width: calc(${v("control-gap")} * 1.5);
  height: calc(${v("control-gap")} * 2.25);
  background: radial-gradient(circle, currentColor ${v("hairline")}, transparent calc(${v("hairline")} * 1.5)) 0 0 / calc(${v("control-gap")} * 0.75) calc(${v("control-gap")} * 0.75);
}
.nc-strip[data-nc-folded] > [data-nc-strip-grip] { display: none; }
@media (pointer: coarse) {
  .nc-strip > [data-nc-strip-grip]::before {
    content: "";
    position: absolute;
    right: calc(${v("control-gap")} * -1);
    top: calc(${v("control-gap")} * -1);
    width: calc(${v("target-min")} / 2);
    height: calc(${v("target-min")} / 2);
  }
}
/* Folded: no gutters, and M and S take the Inserts, M/S and sends rows (sends hidden: the pan row) as one area, so the
   two fit stacked at full size with the rows unchanged. */
.nc-strip[data-nc-folded] {
  width: ${v("strip-fold-width")};
  align-content: start;
  grid-template-columns: 0 minmax(0, 1fr) 0;
  grid-template-areas: ". hd ." "ms ms ms" "ms ms ms" "ms ms ms" ". pan ." ". body ." ". db .";
}
.nc-strip[data-nc-folded][data-nc-sends-hidden] {
  grid-template-areas: ". hd ." "ms ms ms" "ms ms ms" "ms ms ms" ". body ." ". db .";
}
/* Trim (a strip's trim, or the master's trimRow): a knob row at the top, under the name, before the Inserts; every row
   still named. trimHidden (the host's phones) takes the row out, the knob kept unseen. Folded, the trim row joins the
   M and S area. */
.nc-strip > .nc-strip-trim { grid-area: trim; display: flex; justify-content: center; align-items: flex-start; }
.nc-strip:not([data-nc-trim]) > .nc-strip-trim, .nc-strip[data-nc-folded] > .nc-strip-trim { display: none; }
.nc-strip[data-nc-trim] {
  grid-template-rows: auto var(--nc-strip-knob-row) ${v("slider-pitch")} var(--nc-strip-ms-row) var(--nc-strip-knob-row) var(--nc-strip-knob-row) auto auto;
  grid-template-areas: ". hd ." ". trim ." ". hacks ." "ms ms ms" ". sends ." ". pan ." ". body ." ". db .";
}
.nc-strip[data-nc-trim][data-nc-sends-hidden] {
  grid-template-rows: auto var(--nc-strip-knob-row) ${v("slider-pitch")} var(--nc-strip-ms-row) var(--nc-strip-knob-row) auto auto;
  grid-template-areas: ". hd ." ". trim ." ". hacks ." "ms ms ms" ". pan ." ". body ." ". db .";
}
.nc-strip[data-nc-folded][data-nc-trim] {
  grid-template-areas: ". hd ." "ms ms ms" "ms ms ms" "ms ms ms" "ms ms ms" ". pan ." ". body ." ". db .";
}
.nc-strip[data-nc-folded][data-nc-trim][data-nc-sends-hidden] {
  grid-template-areas: ". hd ." "ms ms ms" "ms ms ms" "ms ms ms" "ms ms ms" ". body ." ". db .";
}
.nc-strip[data-nc-folded] > .nc-strip-hd { justify-content: center; }
/* The name stays in the row, unseen and zero wide, so the row keeps the open strips' height and the meters line up. */
.nc-strip[data-nc-folded] > .nc-strip-hd > .nc-strip-name { visibility: hidden; width: 0; flex: 0 0 0; }
.nc-strip[data-nc-folded] > .nc-strip-hd > .nc-strip-remove,
.nc-strip[data-nc-folded] > .nc-strip-hacks,
.nc-strip[data-nc-folded] > .nc-strip-sends,
.nc-strip[data-nc-folded] > .nc-strip-pan,
.nc-strip[data-nc-folded] > .nc-strip-db,
.nc-strip[data-nc-folded] > .nc-strip-db-input,
.nc-strip[data-nc-folded] .nc-strip-body > .nc-fader,
.nc-strip[data-nc-folded] .nc-strip-body > .nc-scale { display: none; }
.nc-strip[data-nc-folded] > .nc-strip-ms {
  grid-auto-flow: row;
  grid-template-rows: none;
  grid-auto-columns: ${v("slider-pitch")};
  grid-auto-rows: ${v("slider-pitch")};
  gap: ${v("module-gap")};
  align-self: start;
  justify-self: center;
}
/* Touch: each folded M and S as wide as the column and target-min tall, touching (after the rule above, so it wins). */
@media (pointer: coarse) {
  .nc-strip[data-nc-folded] > .nc-strip-ms { grid-auto-columns: minmax(0, 1fr); grid-auto-rows: ${v("target-min")}; gap: 0; justify-self: stretch; }
}
.nc-strip[data-nc-folded] > .nc-strip-body {
  grid-template-columns: auto auto;
  column-gap: ${v("control-gap")};
}
.nc-strip[data-nc-folded] .nc-strip-body > .nc-strip-fold { display: flex; grid-column: 1; grid-row: 1 / span 2; width: auto; }
.nc-strip[data-nc-folded] .nc-strip-body > .nc-meter { grid-column: 2; }
.nc-strip[data-nc-folded] .nc-meter-bar { width: ${v("control-gap")}; }
.nc-strip-fold { gap: ${v("control-gap")}; }
.nc-strip-fold > .nc-ui-fx-fold-name { font-size: ${v("label-size")}; font-weight: ${v("label-weight")}; letter-spacing: ${v("label-tracking")}; text-transform: uppercase; }
.nc-strip[data-silent="true"] .nc-strip-fold > .nc-ui-fx-fold-name { color: ${v("text-sub")}; }
/* Folded with a pan: a tiny track with a dot where the pan sits (--nc-strip-pan, −1..1). */
.nc-strip-fold-pan {
  position: relative;
  flex: none;
  width: ${v("fader-cap-height")};
  height: ${v("control-gap")};
  background: linear-gradient(${v("divider")}, ${v("divider")}) center / 100% ${v("hairline")} no-repeat;
}
.nc-strip-fold-pan[hidden] { display: none; }
.nc-strip-fold-pan::after {
  content: "";
  position: absolute;
  top: 0;
  left: calc((var(--nc-strip-pan, 0) + 1) / 2 * (100% - ${v("control-gap")}));
  width: ${v("control-gap")};
  height: ${v("control-gap")};
  border-radius: 50%;
  background: ${v("text-sub")};
}
.nc-strip-fold-cap {
  flex: none;
  width: ${v("fader-cap-height")};
  height: ${v("control-gap")};
  background: var(--nc-strip-cap, ${v("fader-cap")});
}
/* M and S: an explicit two-column grid (never flex with overlapping margins), centred at the slider pitch; on touch
   it fills the strip's full width (the gutters too), two target-min boxes side by side, touching, nothing past the
   strip's edges. The kit's hit pads take any width short of target-min (the divider hairline) outward. */
.nc-strip-ms {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: ${v("slider-pitch")};
  grid-template-rows: ${v("slider-pitch")};
  column-gap: ${v("control-gap")};
  justify-self: center;
  align-self: start;
}
.nc-strip > .nc-strip-ms > .nc-ms-wrap { margin: 0; width: auto; }
/* The master's Sends button (onSendsView): Inserts' twin in the M/S row, the strip's width, the slider pitch tall. */
.nc-strip > .nc-strip-ms:has(> .nc-sends-view-wrap) { grid-auto-columns: minmax(0, 1fr); justify-self: stretch; }
.nc-strip > .nc-strip-ms > .nc-sends-view-wrap { grid-column: 1 / -1; height: ${v("slider-pitch")}; }
.nc-strip > .nc-strip-ms > .nc-sends-view-wrap > .nc-sends-view { inset-inline: ${v("control-gap")}; width: auto; }
@media (pointer: coarse) {
  .nc-strip-ms { grid-auto-columns: minmax(0, 1fr); grid-template-rows: ${v("target-min")}; column-gap: 0; justify-self: stretch; }
}
/* M and S on a channel strip: the kit's outlined squares, their hairline the one for the strip's own shade
   (strip-divider). The console's body hands its stack-1 hairline down, a near match for the light strip (gone there)
   but lighter than the alternate one (a light box there), so M and S showed boxes on every other strip only. */
.nc-strip:not([data-nc-master]) > .nc-strip-ms { ${prop("divider")}: ${v("strip-divider")}; }
/* Hacks: a full-width toggle above M and S, in mixed case and a lighter grey (Peter); pressed while the console's fx area shows this strip's stack. */
.nc-strip-hacks { display: flex; width: 100%; height: ${v("slider-pitch")}; }
.nc-hacks-wrap { position: relative; flex: 1 1 auto; height: ${v("slider-pitch")}; }
.nc-hacks {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  /* A light outline at rest, the same on every strip (Peter, 2026-11-01: the box only says the stack has effects):
     text-sub at 50% over the strip hairline; text-sub on hover, so it still reads as a button. */
  border: ${v("hairline")} solid color-mix(in oklab, ${v("text-sub")} 50%, ${v("strip-divider")});
  border-radius: ${v("slot-radius")};
  background: transparent;
  color: ${v("strip-hacks-text")};
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  /* Stated, not left out: an older bundled copy of the kit (an app's fallback layer) set uppercase and tracking. */
  letter-spacing: normal;
  text-transform: none;
  cursor: pointer;
  transition: none;
}
.nc-hacks:hover { color: ${v("text")}; border-color: ${v("text-sub")}; }
/* hacksEmpty (no effects in the stack): the plain word, no box, hover too; still a button with its focus ring. */
.nc-hacks[data-nc-empty]:not([aria-pressed="true"]) { border-color: transparent; }
.nc-hacks[aria-pressed="true"] {
  background: ${v("fader-cap-master")};
  border-color: ${v("fader-cap-master")};
  color: ${v("surface-page")};
}
.nc-hacks:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-strip-sends { display: flex; align-items: flex-start; gap: ${v("module-gap")}; }
/* Pan: one compact bipolar knob, centred, in its own row (empty on the master, so the faders line up). */
.nc-strip-pan { display: flex; justify-content: center; align-items: flex-start; }
.nc-field[data-nc-compact] {
  flex-direction: column-reverse;
  align-items: center;
  gap: ${v("control-gap")};
}
.nc-field[data-nc-compact] .nc-label { min-width: 0; line-height: ${v("label-leading")}; }
.nc-field[data-nc-compact] .nc-readout { display: none; }
/* A compact knob draws its amount: a ring over its 270° travel, filled in the meter blue up to the value. */
.nc-field[data-nc-compact] .nc-knob {
  border: 0;
  background:
    radial-gradient(closest-side, var(--nc-strip-ground, ${v("surface-page")}) 70%, transparent 72%),
    conic-gradient(from 225deg, ${v("meter-fill")} calc(var(--knob-turn, 0) * 1deg), ${v("meter-track")} 0 270deg, transparent 0);
}
/* A bipolar knob (pan) fills from the top of its travel (the centre) to the value, either way. */
.nc-field[data-nc-compact][data-nc-bipolar] .nc-knob {
  background:
    radial-gradient(closest-side, var(--nc-strip-ground, ${v("surface-page")}) 70%, transparent 72%),
    conic-gradient(from 225deg, ${v("meter-track")} calc(var(--knob-from, 135) * 1deg), ${v("meter-fill")} 0 calc(var(--knob-to, 135) * 1deg), ${v("meter-track")} 0 270deg, transparent 0);
}
/* Its value ("C", "L 30") shows in the label's place while hovered, focused or dragged; no motion. */
.nc-field[data-nc-compact][data-nc-bipolar] .nc-readout {
  order: -1;
  flex: none;
  width: auto;
  min-width: max-content;
  max-width: none;
  text-align: center;
  font-size: ${v("label-size")};
  line-height: ${v("label-leading")};
  white-space: nowrap;
}
.nc-field[data-nc-compact][data-nc-bipolar]:is(:hover, :focus-within, [data-nc-dragging]) .nc-label { display: none; }
.nc-field[data-nc-compact][data-nc-bipolar]:is(:hover, :focus-within, [data-nc-dragging]) .nc-readout { display: block; }
/* Its mark starts at the bottom of the travel (7:30) and turns 270° to 4:30, along the ring. */
.nc-field[data-nc-compact] .nc-knob-mark { transform: rotate(calc((var(--knob-turn, 0) - 135) * 1deg)); }
.nc-strip-body {
  display: grid;
  grid-template-columns: ${v("fader-cap-width")} auto auto;
  grid-template-rows: ${v("clip-size")} ${v("fader-height")};
  justify-content: center;
  column-gap: ${v("control-gap")};
  row-gap: ${v("control-gap")};
  padding-block: calc(${v("fader-cap-height")} / 2);
}
.nc-strip-body > .nc-fader { grid-column: 1; grid-row: 2; }
.nc-strip-body > .nc-scale { grid-column: 2; grid-row: 2; }
.nc-strip-body > .nc-meter { grid-column: 3; grid-row: 1 / span 2; }
/* The dB scale between fader and meter: faint mono labels, each centred on its level. */
.nc-scale {
  position: relative;
  width: 3ch;
  font-family: ${v("font-readout")};
  font-size: ${v("scale-size")};
  font-variant-numeric: tabular-nums;
  color: ${v("text-sub")};
}
.nc-scale-tick {
  position: absolute;
  right: 0;
  top: calc((1 - var(--tick-pos, 0)) * 100%);
  transform: translateY(-50%);
  line-height: 1;
  white-space: nowrap;
}
/* The console fader: a slot and a flat cap with a line across its centre. The cap follows the hand: no transition. */
.nc-fader {
  position: relative;
  width: ${v("fader-cap-width")};
  height: 100%;
  cursor: ns-resize;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  transition: none;
}
.nc-fader-track {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: ${v("rule-strong")};
  transform: translateX(-50%);
  background: ${v("fader-track")};
}
.nc-fader-cap {
  position: absolute;
  left: 0;
  width: 100%;
  height: ${v("fader-cap-height")};
  top: calc((1 - var(--fader-pos, 0)) * 100%);
  transform: translateY(-50%);
  background: ${v("fader-cap")};
  transition: none;
}
.nc-fader-cap::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: ${v("hairline")};
  transform: translateY(-50%);
  background: ${v("fader-cap-line")};
}
/* A host can colour a channel's fader cap with --nc-strip-cap (Peter, 2026-10-31: the Studio uses each instrument's
   own colour, muted). The kit names no instrument colours. Unset, the cap stays ink; the master stays accent. */
.nc-strip .nc-fader-cap { background: var(--nc-strip-cap, ${v("fader-cap")}); }
.nc-fader[data-dragging="true"] .nc-fader-cap { background: ${v("accent")}; }
/* The master's cap in Prussian blue (Peter, 2026-10-30): the master reads apart from the channels at a glance. */
.nc-module-body[data-nc-layout="console"] > [data-nc-area="master"] .nc-fader-cap { background: ${v("fader-cap-master")}; }
.nc-fader:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("control-gap")}; }
/* The level meter: peak over RMS in the lighter Prussian blue, a hold line, a clip light on top. It follows the audio
   every frame (transforms written by the meter's own ballistics), so nothing here transitions. */
.nc-meter {
  display: grid;
  grid-template-rows: subgrid;
  row-gap: ${v("control-gap")};
  justify-items: stretch;
}
.nc-meter-clip {
  position: relative;
  display: block;
  height: ${v("clip-size")};
  padding: 0;
  border: 0;
  background: ${v("meter-track")};
  cursor: pointer;
  transition: none;
}
.nc-meter-clip::before {
  content: "";
  position: absolute;
  inset: calc(${v("control-gap")} * -1);
}
.nc-meter-clip[data-lit="true"] { background: ${v("meter-clip")}; }
.nc-meter-clip:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-meter-bars { display: flex; gap: ${v("hairline")}; height: 100%; }
.nc-meter-bar {
  position: relative;
  width: ${v("meter-width")};
  height: 100%;
  overflow: hidden;
  background: ${v("meter-track")};
}
.nc-meter-peak, .nc-meter-rms {
  position: absolute;
  inset: 0;
  transform-origin: bottom;
  transform: scaleY(0);
  transition: none;
}
.nc-meter-peak { background: ${v("meter-peak")}; }
.nc-meter-rms { background: ${v("meter-fill")}; }
.nc-meter-hold {
  position: absolute;
  inset: 0;
  border-top: ${v("rule-strong")} solid ${v("meter-hold-mark")};
  transform: translateY(100%);
  transition: none;
}
.nc-meter-hold[data-off="true"] { visibility: hidden; }
/* An FX card's level meter (fx-level.js): two thin bars beside the switch, in (left) and out (right), on the card's own
   divider. Fixed size, so it never moves the header; the loop writes transforms, so nothing transitions. A bypassed
   card dims it by colour; the hot colour (ASTRID's title orange) shows only within 1 dB of full scale. Folded, it sits at the foot of the
   column and gives way when there is no room. */
.nc-fx-level { display: inline-flex; flex: none; align-items: stretch; gap: ${v("hairline")}; height: ${v("fx-level-height")}; }
.nc-fx-level-bar { position: relative; width: ${v("fx-level-bar")}; overflow: hidden; background: ${v("divider")}; }
.nc-fx-level[data-nc-rows="1"] > [data-nc-level="out"] { display: none; }
.nc-fx-level-fill {
  position: absolute;
  inset: 0;
  transform-origin: bottom;
  transform: scaleY(0);
  background: ${v("fx-level-in")};
  transition: none;
}
[data-nc-level="out"] > .nc-fx-level-fill { background: ${v("fx-level-out")}; }
[data-nc-dim="true"] .nc-fx-level-fill { background: ${v("text-sub")}; }
.nc-fx-level-fill[data-clip="true"], [data-nc-dim="true"] .nc-fx-level-fill[data-clip="true"] { background: ${v("fx-level-hot")}; }
.nc-ui-fx-fold > .nc-fx-level { margin-top: auto; height: auto; flex: 0 1 ${v("fx-level-fold-length")}; min-height: 0; }
.nc-strip-db {
  min-width: 0;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size")};
  font-variant-numeric: tabular-nums;
  color: ${v("text")};
  white-space: nowrap;
  cursor: default;
  transition: none;
}
.nc-strip-db:not(:disabled) { cursor: text; }
.nc-strip-db:hover { text-decoration: underline; text-decoration-color: ${v("divider")}; text-underline-offset: ${v("control-gap")}; }
/* The type-in: the readout opened as a field, the same size and font, an accent hairline under it. */
.nc-strip-db-input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  border-bottom: ${v("hairline")} solid ${v("accent")};
  border-radius: 0;
  background: transparent;
  color: ${v("text")};
  font-family: ${v("font-readout")};
  font-size: ${v("readout-size")};
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.nc-strip-db-input:focus-visible { outline: none; }
/* The add slot: a ghost strip after the last channel, "+ Add" over a select of what can be added. */
.nc-strip-add {
  position: relative;
  flex: none;
  align-self: stretch;
  width: ${v("strip-width")};
  margin-inline-start: ${v("module-gap")};
  border: ${v("hairline")} dashed ${v("divider")};
  color: ${v("text-sub")};
  transition-property: color, border-color;
  transition-duration: ${v("transition-feedback")};
}
.nc-strip-add:hover, .nc-strip-add:focus-within { color: ${v("text")}; border-color: ${v("text-sub")}; }
.nc-strip-add-face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${v("control-gap")};
  pointer-events: none;
}
.nc-strip-add-plus { font-family: ${v("font-readout")}; font-size: ${v("title-size-slim")}; line-height: 1; }
.nc-strip-add-label {
  font-size: ${v("label-size")};
  font-weight: ${v("label-weight")};
  letter-spacing: ${v("label-tracking")};
  text-transform: uppercase;
}
/* The select covers the slot (fully transparent, not dimmed), so a click anywhere on it opens the list. */
.nc-strip-add-select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  font-size: ${v("body-size")};
}
.nc-strip-add:has(.nc-strip-add-select:focus-visible) { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
.nc-strip-db:focus-visible { outline: ${v("focus-width")} solid ${v("focus-ring")}; outline-offset: ${v("hairline")}; }
/* Phones and tablets: the strips scroll in their row with the master pinned at the right; the FX cards go under them
   (three across on tablets, stacked on phones). */
@media (max-width: 1023px) {
  .nc-module-body[data-nc-layout="console"] {
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-areas: "strips meters master" "fx fx fx";
  }
}
@media (max-width: 1023px) {
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"] { grid-auto-flow: row; grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
/* Tablets (769-1023 px): the fx row is full width under the strips; with a card folded, the open ones share the rest. */
@media (min-width: 769px) and (max-width: 1023px) {
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"]:has(> .nc-ui-fx[data-nc-folded]) > .nc-ui-fx:not([data-nc-folded]) {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
  }
  /* Paged: a third each, so a part-filled last page keeps the columns; with a card folded on the page the open
     ones share the rest. */
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"][data-nc-paged][data-nc-paged] > .nc-ui-fx:not([data-nc-folded], [data-nc-off-page]) {
    flex: 0 0 calc(100% / 3);
    width: auto;
    min-width: 0;
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"][data-nc-paged][data-nc-paged]:has(> .nc-ui-fx[data-nc-folded]:not([data-nc-off-page])) > .nc-ui-fx:not([data-nc-folded], [data-nc-off-page]) {
    flex: 1 1 0;
  }
}
@media (max-width: 768px) {
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="fx"] { grid-template-columns: minmax(0, 1fr); }
  /* Phones: the strips and the master keep their row; the meters get their own row under it, above the FX. */
  .nc-module-body[data-nc-layout="console"] {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "strips master" "meters meters" "fx fx";
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="meters"] {
    border-inline-end: 0;
    border-top: ${v("hairline")} solid ${v("module-div-stack-1")};
  }
  /* Phones: the master as narrow as a channel strip, so the strips keep the room. */
  .nc-strip[data-nc-master] { width: ${v("strip-width")}; }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="master"] { padding-inline: 0; }
}
@media (min-width: 1024px) {
  .nc-module-body[data-nc-layout="console"] {
    margin-inline: calc(${v("module-pad-x-desktop")} * -1);
    margin-bottom: calc(${v("module-pad-y-desktop")} * -1);
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="strips"] {
    padding-inline-start: ${v("module-pad-x-desktop")};
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="strips"] > .nc-strip {
    padding-bottom: ${v("module-pad-y-desktop")};
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="strips"] > .nc-strip-add {
    margin-bottom: ${v("module-pad-y-desktop")};
  }
  .nc-module-body[data-nc-layout="console"] > [data-nc-area="master"] {
    padding-inline-end: ${v("module-pad-x-desktop")};
    padding-bottom: ${v("module-pad-y-desktop")};
  }
  .nc-module-body[data-nc-layout="console"] .nc-ui-fx {
    margin: 0;
    padding: ${v("stack-card-pad-y")} ${v("module-pad-x-desktop")} ${v("module-pad-y-desktop")};
  }
}
/* Pinned to its containing block's corner at zero size, so wherever it sits in a control (after a long label or
   note, in an unpositioned box) it can never reach past the page edge. It is empty and never shown; it only carries
   the accent and the UI font for token reads. */
.nc-token-probe {
  position: absolute;
  inset: 0 auto auto 0;
  width: 0;
  height: 0;
  overflow: hidden;
  background: ${v("accent")};
  font-family: ${v("font-ui")};
  pointer-events: none;
}
@media (min-width: 768px) {
  .nc-page { padding: ${v("page-pad-y-md")} ${v("page-pad-x-md")}; }
  .nc-page-hd { flex-direction: row; align-items: flex-end; justify-content: space-between; padding-bottom: ${v("page-head-gap-md")}; }
  .nc-page-hd::before { top: calc(${v("page-pad-y-md")} * -1); left: calc(${v("page-pad-x-md")} * -1); right: calc(${v("page-pad-x-md")} * -1); }
}
/* A minimized full-width module (compact, e.g. the Studio's Mix): one slim bar at every width, title, then the summary
   on one line (cut with an ellipsis), then the index. Overrides the column-wise slim of side-by-side modules. */
.nc-module[data-nc-compact][data-nc-slim] {
  display: flex !important;
  flex-direction: row;
  align-items: center;
  gap: ${v("header-gap")};
  padding-inline: ${v("module-pad")};
}
.nc-module[data-nc-compact][data-nc-slim] .nc-module-hd { display: contents !important; }
/* A full-width module's row is its own: minimized it keeps the whole width, not the slim side column. */
.nc-stack:has(> .nc-module[data-nc-compact]) { grid-template-columns: minmax(0, 1fr) !important; }
.nc-module[data-nc-compact][data-nc-slim] .nc-title { flex: none; }
.nc-module[data-nc-compact][data-nc-slim] .nc-slim {
  flex: 1 1 auto;
  min-width: 0;
  margin-top: 0 !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start;
  text-align: left;
}
.nc-module[data-nc-compact][data-nc-slim] .nc-slim-lines {
  white-space: nowrap !important;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Hosted (an instrument inside the Studio, html[data-nc-hosted]): the Studio already names it on its tab, so the
   title block and its band go; the header keeps only its controls (Master, Save, Load...) on one short row. */
html[data-nc-hosted] .nc-page { padding-top: ${v("module-gap")}; min-height: 0; }
html[data-nc-hosted] .nc-page-hd {
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: ${v("module-gap")};
}
html[data-nc-hosted] .nc-page-hd::before { display: none; }
html[data-nc-hosted] .nc-page-hd > :first-child { display: none; }
html[data-nc-hosted] .nc-page-body { padding-top: ${v("module-gap")}; }
/* Tablets (769-1023 px): the same 2 x 5 slot grid as phones and desktop; one row of 10 drew 14 px slots here. */
@media (min-width: 769px) and (max-width: 1023px) {
  .nc-slot-line { flex-wrap: wrap; }
  .nc-snap-row {
    flex: 1 0 100%;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: ${v("control-gap")};
  }
  .nc-snap-wrap { width: 100%; max-width: none; height: ${v("target-min")}; }
  .nc-snap { font-size: ${v("readout-size")}; }
  .nc-snap-wrap > .nc-hit { display: none; }
}
@media (min-width: 1024px) {
  .nc-page-body { padding-top: ${v("page-body-gap-lg")}; }
}
@media (min-width: 1280px) {
  .nc-page { padding-inline: ${v("page-pad-x-xl")}; }
  .nc-page-hd::before { left: calc(${v("page-pad-x-xl")} * -1); right: calc(${v("page-pad-x-xl")} * -1); }
}
@media (min-width: 1024px) {
  .nc-stack[data-nc-layout="adjacent"] {
    display: grid;
    grid-template-columns: var(--astrid-cols);
    align-items: stretch;
  }
  .nc-stack[data-nc-layout="adjacent"] > .nc-module {
    border-bottom: 0;
    border-inline-end: ${v("hairline")} solid ${v("divider")};
  }
  .nc-stack[data-nc-layout="adjacent"] > .nc-module:last-child { border-inline-end: 0; }
  .nc-module { padding: ${v("module-pad-y-desktop")} ${v("module-pad-x-desktop")}; }
  /* Desktop slots (item C): Bass's 2 x 5 grid across the column, each slot as tall as the Pattern buttons
     (target-min). One row of 10 left each slot 19 px wide at 1280 and 16 px at 1024. */
  .nc-slot-line { flex-wrap: wrap; }
  .nc-snap-row {
    flex: 1 0 100%;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: ${v("control-gap")};
  }
  .nc-snap-wrap {
    width: 100%;
    max-width: none;
    height: ${v("target-min")};
  }
  .nc-snap { font-size: ${v("readout-size")}; }
  .nc-snap-wrap > .nc-hit { display: none; }
  .nc-section[data-nc-inset="true"] {
    margin-inline: calc(${v("module-pad-x-desktop")} * -1);
    margin-bottom: calc(${v("module-pad-y-desktop")} * -1);
    padding: ${v("module-pad-y-desktop")} ${v("module-pad-x-desktop")};
  }
  .nc-section[data-nc-panel="true"] {
    margin-inline: calc(${v("module-pad-x-desktop")} * -1);
    margin-bottom: calc(${v("module-pad-y-desktop")} * -1);
    padding: ${v("module-pad-y-desktop")} ${v("module-pad-x-desktop")};
  }
  .nc-panel-body {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    column-gap: ${v("module-pad-x-desktop")};
  }
  .nc-module[data-nc-slim] {
    display: block;
    padding-inline: ${v("module-pad-x-slim")};
  }
  .nc-module[data-nc-slim] .nc-module-hd { display: flex; }
  .nc-module[data-nc-slim] .nc-module-hd,
  .nc-module[data-nc-slim] .nc-slim {
    flex-direction: column;
    align-items: flex-start;
  }
  .nc-module[data-nc-slim] .nc-slim { margin-top: ${v("module-gap")}; }
  .nc-module[data-nc-slim] .nc-slim-lines { white-space: normal; }
  .nc-ui-fx {
    margin-inline: calc(${v("module-pad-x-desktop")} * -1);
    padding-inline: ${v("module-pad-x-desktop")};
  }
}
/* 1024-1279 px (item C): four open columns left the lead about 240 px (3.5 px step cells). With a lead and three
   open modules, the last two share the last column (stacked), so the lead is 53fr against 23.333fr and every lane
   stays on one row with 18 px+ cells; the outer columns keep their width. */
@media (min-width: 1024px) and (not (min-width: 1280px)) {
  /* Three open columns (Rhythm: Transport, Pattern, Filter) get the same 53fr lead. */
  .nc-stack[data-nc-layout="adjacent"] { --astrid-lead-fr: 53fr; }
  .nc-stack[data-nc-layout="adjacent"][data-nc-stack-last="true"] {
    grid-template-columns: minmax(0, 23.333fr) minmax(0, 53fr) minmax(0, 23.333fr);
  }
  .nc-stack[data-nc-stack-last="true"] > .nc-module { grid-row: 1 / span 2; }
  .nc-stack[data-nc-stack-last="true"] > .nc-module:nth-last-child(2) {
    grid-column: 3;
    grid-row: 1;
    border-inline-end: 0;
    border-bottom: ${v("hairline")} solid ${v("divider")};
  }
  .nc-stack[data-nc-stack-last="true"] > .nc-module:last-child { grid-column: 3; grid-row: 2; }
}
/* From 1280 px the lead (Rhythm's step grid) widens from ASTRID's 30fr to 48fr so its 16 cells are 18 px+ on one row. */
@media (min-width: 1280px) {
  .nc-stack[data-nc-layout="adjacent"] {
    --astrid-lead-fr: 48fr;
    --astrid-rest-fr: 21.333fr;
  }
}
@media (max-width: 768px) {
  /* Phones: rows are the overview and lane picker; the selected lane edits on 4x4 pads (one row = one beat). */
  .nc-row-dice { display: none; }
  .nc-pads-head {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: ${v("module-gap")};
    padding-block: ${v("control-gap")};
    background: ${v("surface-page")};
    border-bottom: ${v("hairline")} solid ${v("divider")};
  }
  .nc-pads {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: ${v("module-gap")};
    touch-action: pan-y;
  }
  .nc-steps { pointer-events: none; }
  .nc-steps .nc-hit { display: none; }
  .nc-row { cursor: pointer; }
  .nc-slot-line { flex-wrap: wrap; }
  .nc-snap-row {
    flex: 1 0 100%;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .nc-snap-wrap {
    width: 100%;
    max-width: ${v("slot-span")};
    height: ${v("slot-block")};
    justify-self: center;
  }
  .nc-snap { font-size: ${v("readout-size")}; }
  .nc-snap-wrap > .nc-hit { display: none; }
}
@media (max-width: 360px) {
  .nc-label, .nc-name, .nc-note, .nc-title { text-overflow: ellipsis; }
}
/* Phones in landscape (Peter, 2026-11-01: "these sections can be side by side in landscape mode"): a short, wide
   screen puts the modules side by side, as many columns as fit at two slim columns wide (two or three on a phone),
   each module at its own height, in reading order; the lead (a step grid) takes two columns and two rows. Tablets and
   desktops are unchanged. An instrument inside the Studio has a frame as tall as its page, so its own media never
   reads as landscape: the Studio sets html[data-nc-landscape] on the frame when the Studio's screen is (LANDSCAPE_PHONE). */
@media (orientation: landscape) and (max-height: 500px) and (max-width: 1023px) {
${landscapeStack("")}
}
@media (max-width: 1023px) {
${landscapeStack("html[data-nc-landscape] ")}
}
/* Phone-only groups fold on phones: portrait, a landscape phone, and a Studio frame on a landscape phone. */
@media (max-width: 768px) {
${phoneGroup("")}
}
@media (orientation: landscape) and (max-height: 500px) and (max-width: 1023px) {
${phoneGroup("")}
}
@media (max-width: 1023px) {
${phoneGroup("html[data-nc-landscape] ")}
}
@media (prefers-reduced-motion: reduce) {
  .nc-btn, .nc-btn:active, .nc-toggle, .nc-seg > button, .nc-sparkle, .nc-sparkle-btn, .nc-sparkle-btn:active,
  .nc-ui-toast, .nc-ui-toast[data-state="closing"], .nc-ui-switch, .nc-select,
  .nc-meter, .nc-meter-fill, .nc-step[data-playhead="true"], .nc-fader-cap, .nc-meter-clip, .nc-ui-fx, .nc-ui-fx-fold, .nc-strip, .nc-eq-node::after, .nc-fx-max-icon > i, .nc-fold-tri {
    transition: none;
    animation: none;
  }
  .nc-snap[data-queued="true"][data-pulse="true"] {
    outline-color: ${v("accent-faint")};
    background: transparent;
    box-shadow: inset 0 calc(-1 * ${v("focus-width")} * 2) 0 ${v("accent-faint")};
  }
}
`;
}
